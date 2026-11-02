import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, type Options, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { ReviewReportSchema, ReviewReportJSONSchema } from './types/report-types.js';
import type { ReviewReport } from './types/report-types.js';
import { mcpServersConfig, MCP_SERVER_NAMES } from './config/mcp.config.js';
import { subagents, SUBAGENT_NAMES } from './agents/index.js';
import { buildOrchestratorPrompt } from './prompts/orchestrator.prompt.js';
import { logger, logReviewStart, logReviewComplete, logReviewError } from './utils/logger.js';
import { RateLimiter, type RateLimiterConfig } from './utils/rate-limiter.js';
import { ReviewError, ErrorCodes, withRetry, withTimeout, formatError } from './utils/error-handler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Version stamped into report metadata */
export const ORCHESTRATOR_VERSION = '1.0.0';
export const AGENT_VERSIONS: Record<string, string> = {
  orchestrator: ORCHESTRATOR_VERSION,
  'code-quality-analyzer': '1.0.0',
  'test-coverage-analyzer': '1.0.0',
  'refactoring-suggester': '1.0.0'
};

/**
 * Orchestrator configuration options
 */
export interface OrchestratorOptions {
  /** Model id (defaults to ANTHROPIC_MODEL) */
  model?: string;
  /** Max agent turns for the whole review (default 80) */
  maxTurns?: number;
  /** Directory containing .claude/skills (defaults to PROJECT_ROOT or this project) */
  projectRoot?: string;
  /** Rate limiter overrides */
  rateLimits?: Partial<RateLimiterConfig>;
  /** Overall timeout for a single review attempt in ms (default 20 minutes) */
  timeoutMs?: number;
  /** Attempts for the whole review on transient failure (default 2) */
  maxRetries?: number;
  /** Max changed files analyzed per PR (default 10) */
  maxFiles?: number;
  /** Estimated tokens per review, used by the rate limiter (default 60k) */
  estimatedTokens?: number;
  /** Print subagent progress to the logger (default true) */
  logProgress?: boolean;
  /**
   * Run the Claude Code process with a project-local CLAUDE_CONFIG_DIR in which the
   * ANTHROPIC_API_KEY is pre-approved (default true). Without this, a machine that is
   * also logged into Claude Code via OAuth ignores the custom API key in non-interactive
   * mode and sends the OAuth token to the configured endpoint instead.
   */
  isolateClaudeConfig?: boolean;
}

/** Function signature of the SDK query, injectable for tests */
export type QueryFn = typeof query;

/**
 * Main Code Review Orchestrator
 * Coordinates subagents to analyze pull requests and generate comprehensive reports
 */
export class CodeReviewOrchestrator {
  private readonly options: Required<Omit<OrchestratorOptions, 'rateLimits'>>;
  private readonly rateLimiter: RateLimiter;
  private readonly queryFn: QueryFn;
  /** Tail of the Claude Code process stderr, attached to errors for diagnosis */
  private stderrTail: string[] = [];

  constructor(options: OrchestratorOptions = {}, queryFn: QueryFn = query) {
    const model = options.model ?? process.env.ANTHROPIC_MODEL;
    if (!model) {
      throw new ReviewError(
        'ANTHROPIC_MODEL is required (e.g. claude-sonnet-4-5-20250929)',
        ErrorCodes.INVALID_CONFIG
      );
    }

    this.options = {
      model,
      maxTurns: options.maxTurns ?? 80,
      projectRoot: options.projectRoot ?? process.env.PROJECT_ROOT ?? path.resolve(__dirname, '..'),
      timeoutMs: options.timeoutMs ?? 20 * 60 * 1000,
      maxRetries: options.maxRetries ?? 2,
      maxFiles: options.maxFiles ?? 10,
      estimatedTokens: options.estimatedTokens ?? 60_000,
      logProgress: options.logProgress ?? true,
      isolateClaudeConfig: options.isolateClaudeConfig ?? true
    };
    this.rateLimiter = new RateLimiter(options.rateLimits ?? {});
    this.queryFn = queryFn;
  }

  /** Effective options (for diagnostics and tests) */
  getOptions(): Readonly<typeof this.options> {
    return this.options;
  }

  /** Rate limiter used for review requests */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /**
   * Build the SDK query options for a review.
   * Exposed so tests can assert the configuration without running the SDK.
   */
  buildQueryOptions(): Options {
    return {
      cwd: this.options.projectRoot,
      // Load .claude/skills from the project so the Skill tool can find them
      settingSources: ['project'],
      model: this.options.model,
      maxTurns: this.options.maxTurns,
      // Headless CI/CD use: never prompt, but only auto-approve the explicit
      // allowedTools list below (anything else is denied rather than bypassed)
      permissionMode: 'dontAsk',
      mcpServers: mcpServersConfig,
      agents: subagents,
      allowedTools: [
        'Task', // required to spawn subagents
        'Read',
        'Write',
        'Grep',
        'Glob',
        'Skill',
        `mcp__${MCP_SERVER_NAMES.github}__*`,
        `mcp__${MCP_SERVER_NAMES.eslint}__*`
      ],
      // Enforce the ReviewReport structure on the final answer
      outputFormat: {
        type: 'json_schema',
        schema: ReviewReportJSONSchema
      },
      // Keep the CLI's stderr for diagnostics (surfaced on failures)
      stderr: (data: string) => this.recordStderr(data),
      env: this.buildChildEnv()
    };
  }

  /**
   * Environment for the Claude Code child process.
   *
   * When an ANTHROPIC_API_KEY is configured, point the process at a project-local
   * CLAUDE_CONFIG_DIR (.temp/claude-config) where that key is marked as approved.
   * Claude Code only uses a custom API key that has been approved; in non-interactive
   * SDK mode it cannot ask, so without this it falls back to any OAuth login on the
   * machine and the request to ANTHROPIC_BASE_URL fails with an auth error.
   */
  buildChildEnv(): Record<string, string | undefined> {
    const env: Record<string, string | undefined> = { ...process.env };
    const apiKey = env.ANTHROPIC_API_KEY?.trim();
    if (!this.options.isolateClaudeConfig || !apiKey || env.CLAUDE_CONFIG_DIR) {
      return env;
    }

    const configDir = path.join(this.options.projectRoot, '.temp', 'claude-config');
    const configFile = path.join(configDir, '.claude.json');
    try {
      fs.mkdirSync(configDir, { recursive: true });
      let existing: Record<string, unknown> = {};
      if (fs.existsSync(configFile)) {
        try {
          existing = JSON.parse(fs.readFileSync(configFile, 'utf8')) as Record<string, unknown>;
        } catch {
          existing = {};
        }
      }
      const responses = (existing.customApiKeyResponses ?? {}) as { approved?: string[]; rejected?: string[] };
      const approved = new Set(responses.approved ?? []);
      approved.add(apiKey.slice(-20)); // Claude Code identifies keys by their last 20 characters
      const updated = {
        ...existing,
        hasCompletedOnboarding: true,
        customApiKeyResponses: { approved: [...approved], rejected: responses.rejected ?? [] }
      };
      fs.writeFileSync(configFile, JSON.stringify(updated, null, 2), { mode: 0o600 });
      env.CLAUDE_CONFIG_DIR = configDir;
    } catch (error) {
      logger.warn('Could not prepare isolated Claude config dir; using default config', {
        error: formatError(error)
      });
    }
    return env;
  }

  private recordStderr(data: string): void {
    const text = data.trim();
    if (!text) return;
    this.stderrTail.push(text.slice(0, 500));
    if (this.stderrTail.length > 40) this.stderrTail.shift();
    logger.debug('claude-code stderr', { data: text.slice(0, 500) });
  }

  /**
   * Review a pull request using parallel subagent analysis
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param prNumber - Pull request number
   * @returns Complete review report
   */
  async reviewPullRequest(owner: string, repo: string, prNumber: number): Promise<ReviewReport> {
    if (!owner || !repo || !Number.isInteger(prNumber) || prNumber <= 0) {
      throw new ReviewError(
        `Invalid pull request reference: ${owner}/${repo}#${prNumber}`,
        ErrorCodes.VALIDATION_FAILED
      );
    }

    logReviewStart(owner, repo, prNumber);
    const startTime = Date.now();

    await this.rateLimiter.acquire(this.options.estimatedTokens);
    try {
      let attempt = 0;
      const report = await withRetry(
        async () => {
          attempt++;
          this.stderrTail = [];
          try {
            return await withTimeout(
              () => this.runReview(owner, repo, prNumber),
              this.options.timeoutMs,
              `Review of ${owner}/${repo}#${prNumber} timed out`
            );
          } catch (error) {
            logger.warn(`Review attempt ${attempt}/${this.options.maxRetries} failed`, {
              error: formatError(error),
              retryable: isRetryableError(error),
              stderrTail: this.stderrTail.slice(-10)
            });
            throw error;
          }
        },
        this.options.maxRetries,
        2000,
        isRetryableError
      );

      const duration = Date.now() - startTime;
      const finalReport = this.finalizeReport(report, owner, repo, prNumber, duration);
      logReviewComplete(owner, repo, prNumber, finalReport.summary.overallScore, duration);
      return finalReport;
    } catch (error) {
      logReviewError(owner, repo, prNumber, error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      this.rateLimiter.release();
    }
  }

  /**
   * One attempt: run the orchestrator agent and return the validated structured output.
   */
  private async runReview(owner: string, repo: string, prNumber: number): Promise<ReviewReport> {
    const workDir = path.posix.join('.temp', 'reviews', `${owner}__${repo}__pr${prNumber}`);
    const prompt = buildOrchestratorPrompt(owner, repo, prNumber, {
      workDir,
      maxFiles: this.options.maxFiles
    });

    const invokedAgents = new Set<string>();
    let structuredOutput: unknown;
    let resultSeen = false;
    let lastApiError: string | undefined;

    for await (const message of this.queryFn({
      prompt: generateMessages(prompt),
      options: this.buildQueryOptions()
    })) {
      this.handleProgress(message, invokedAgents);

      // The SDK reports API failures (auth, rate limit, server errors) on assistant messages
      if (message.type === 'assistant' && message.error) {
        const text = message.message.content
          .map(block => (block.type === 'text' ? block.text : ''))
          .join(' ')
          .trim();
        lastApiError = `${message.error}: ${text.slice(0, 300)}`;
        logger.error('Claude API error during review', { error: message.error, detail: text.slice(0, 300) });
      }

      if (message.type !== 'result') continue;
      resultSeen = true;

      if (message.subtype === 'success') {
        if (message.is_error || (message.structured_output === undefined && lastApiError)) {
          throw new ReviewError(
            `Agent run failed: ${lastApiError ?? message.result.slice(0, 300)}`,
            lastApiError?.startsWith('authentication_failed') || /key was not found|invalid x-api-key|authentication/i.test(lastApiError ?? '')
              ? ErrorCodes.MISSING_API_KEY
              : ErrorCodes.AGENT_FAILED,
            { lastApiError, stderrTail: this.stderrTail.slice(-10) }
          );
        }
        structuredOutput = message.structured_output;
        logger.info('Orchestrator finished', {
          turns: message.num_turns,
          costUsd: message.total_cost_usd,
          durationMs: message.duration_ms,
          agentsInvoked: [...invokedAgents]
        });
        if (structuredOutput === undefined) {
          throw new ReviewError(
            'Orchestrator completed without structured output',
            ErrorCodes.STRUCTURED_OUTPUT_FAILED,
            { resultText: message.result.slice(0, 500) }
          );
        }
      } else {
        const code =
          message.subtype === 'error_max_structured_output_retries'
            ? ErrorCodes.STRUCTURED_OUTPUT_FAILED
            : ErrorCodes.AGENT_FAILED;
        throw new ReviewError(
          `Orchestrator failed (${message.subtype}): ${message.errors.join('; ') || lastApiError || 'no details'}`,
          code,
          {
            subtype: message.subtype,
            turns: message.num_turns,
            lastApiError,
            permissionDenials: message.permission_denials.slice(0, 5),
            stderrTail: this.stderrTail.slice(-10)
          }
        );
      }
    }

    if (!resultSeen) {
      throw new ReviewError('Agent stream ended without a result message', ErrorCodes.AGENT_FAILED, {
        stderrTail: this.stderrTail.slice(-10)
      });
    }

    const missing = SUBAGENT_NAMES.filter(name => !invokedAgents.has(name));
    if (missing.length > 0) {
      logger.warn('Some subagents were not invoked', { missing });
    }

    const parsed = ReviewReportSchema.safeParse(structuredOutput);
    if (!parsed.success) {
      throw new ReviewError(
        `Structured output does not match ReviewReport schema: ${parsed.error.issues
          .slice(0, 5)
          .map(i => `${i.path.join('.')}: ${i.message}`)
          .join('; ')}`,
        ErrorCodes.VALIDATION_FAILED,
        { issues: parsed.error.issues.slice(0, 20) }
      );
    }
    return parsed.data;
  }

  /** Log MCP status, subagent invocations and tool usage */
  private handleProgress(message: SDKMessage, invokedAgents: Set<string>): void {
    if (message.type === 'system' && message.subtype === 'init') {
      const notConnected = message.mcp_servers.filter(s => s.status !== 'connected');
      logger.info('Agent session started', {
        model: message.model,
        mcpServers: message.mcp_servers,
        agents: message.agents,
        skills: message.skills
      });
      if (notConnected.length > 0) {
        logger.warn('Some MCP servers are not connected', { servers: notConnected });
      }
      return;
    }

    if (message.type === 'assistant') {
      const content = message.message?.content;
      if (!Array.isArray(content)) return;
      for (const block of content) {
        if (block.type !== 'tool_use') continue;
        const input = (block.input ?? {}) as { subagent_type?: string; description?: string };
        if (block.name === 'Task' && input.subagent_type) {
          invokedAgents.add(input.subagent_type);
          if (this.options.logProgress) {
            logger.info(`Spawning subagent ${input.subagent_type}`, { task: input.description });
          }
        } else if (this.options.logProgress) {
          logger.debug('Tool call', {
            tool: block.name,
            inSubagent: Boolean(message.parent_tool_use_id)
          });
        }
      }
    }
  }

  /**
   * Recompute aggregate numbers from the file reviews and stamp real metadata,
   * so summary values are always consistent with the findings.
   */
  finalizeReport(
    report: ReviewReport,
    owner: string,
    repo: string,
    prNumber: number,
    durationMs: number
  ): ReviewReport {
    const files = report.fileReviews;
    const scores = files.map(f => f.codeQuality.overallScore);
    const overallScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    const summary = {
      totalFiles: files.length,
      overallScore,
      criticalIssues: files.reduce(
        (n, f) => n + f.codeQuality.issues.filter(i => i.severity === 'critical').length,
        0
      ),
      highPriorityTests: files.reduce(
        (n, f) =>
          n +
          f.testCoverage.untestedPaths.filter(p => p.priority === 'critical' || p.priority === 'high')
            .length,
        0
      ),
      refactoringOpportunities: files.reduce((n, f) => n + f.refactorings.suggestions.length, 0)
    };

    const finalReport: ReviewReport = {
      ...report,
      pullRequest: { owner, repo, number: prNumber },
      summary,
      recommendations: sortByPriority(report.recommendations),
      metadata: {
        analyzedAt: new Date().toISOString(),
        duration: durationMs,
        agentVersions: { ...AGENT_VERSIONS, ...report.metadata.agentVersions, orchestrator: ORCHESTRATOR_VERSION }
      }
    };

    return ReviewReportSchema.parse(finalReport);
  }
}

/** Backwards-friendly alias used in the course guide */
export { CodeReviewOrchestrator as Orchestrator };

/**
 * Async generator input mode (streaming pattern recommended for MCP/subagents)
 */
async function* generateMessages(userMessage: string) {
  yield {
    type: 'user' as const,
    message: { role: 'user' as const, content: userMessage },
    parent_tool_use_id: null,
    session_id: 'code-review-orchestrator'
  };
}

const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function sortByPriority<T extends { priority: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
  );
}

/**
 * Validation failures and bad input are permanent; everything else
 * (timeouts, agent/API errors, structured output retries) is worth retrying.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ReviewError) {
    return (
      error.code !== ErrorCodes.VALIDATION_FAILED &&
      error.code !== ErrorCodes.INVALID_CONFIG &&
      error.code !== ErrorCodes.MISSING_API_KEY
    );
  }
  logger.debug('Retrying after unexpected error', { error: formatError(error) });
  return true;
}

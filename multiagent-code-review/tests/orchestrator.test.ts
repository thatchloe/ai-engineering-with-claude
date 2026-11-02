import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { CodeReviewOrchestrator, isRetryableError, type QueryFn } from '../src/orchestrator.js';
import { ReviewReportSchema } from '../src/types/report-types.js';
import { ReviewError, ErrorCodes } from '../src/utils/error-handler.js';
import { SUBAGENT_NAMES } from '../src/agents/index.js';
import { makeReport } from './fixtures.js';

/**
 * Tests for CodeReviewOrchestrator
 *
 * The SDK `query` function is replaced with a fake that yields the same message
 * types the real SDK produces (system init, assistant Task calls, result).
 * No MCP servers or API calls are made.
 */

const base = { uuid: 'u' as never, session_id: 's' };

function initMessage(): SDKMessage {
  return {
    ...base,
    type: 'system',
    subtype: 'init',
    agents: SUBAGENT_NAMES,
    apiKeySource: 'user',
    claude_code_version: 'test',
    cwd: '/tmp',
    tools: ['Task'],
    mcp_servers: [
      { name: 'github', status: 'connected' },
      { name: 'eslint', status: 'connected' }
    ],
    model: 'claude-sonnet-4-5-20250929',
    permissionMode: 'dontAsk',
    slash_commands: [],
    output_style: 'default',
    skills: ['security-analysis'],
    plugins: []
  } as SDKMessage;
}

function taskMessage(agents: string[]): SDKMessage {
  return {
    ...base,
    type: 'assistant',
    parent_tool_use_id: null,
    message: {
      id: 'm', type: 'message', role: 'assistant', model: 'x', stop_reason: 'tool_use', stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 1 },
      content: agents.map(name => ({
        type: 'tool_use', id: `t-${name}`, name: 'Task',
        input: { subagent_type: name, description: `analyze with ${name}`, prompt: 'go' }
      }))
    }
  } as unknown as SDKMessage;
}

function successResult(structured_output: unknown): SDKMessage {
  return {
    ...base,
    type: 'result',
    subtype: 'success',
    duration_ms: 10, duration_api_ms: 5, is_error: false, num_turns: 3, result: '{}',
    total_cost_usd: 0.01, usage: {} as never, modelUsage: {}, permission_denials: [],
    structured_output
  } as SDKMessage;
}

function errorResult(subtype: 'error_max_turns' | 'error_max_structured_output_retries' | 'error_during_execution', errors: string[] = []): SDKMessage {
  return {
    ...base,
    type: 'result',
    subtype,
    duration_ms: 10, duration_api_ms: 5, is_error: true, num_turns: 3,
    total_cost_usd: 0.01, usage: {} as never, modelUsage: {}, permission_denials: [], errors
  } as SDKMessage;
}

/** Build a fake query() that yields the given messages (one script per call) */
function fakeQuery(scripts: SDKMessage[][]): { queryFn: QueryFn; calls: unknown[] } {
  const calls: unknown[] = [];
  let i = 0;
  const queryFn = ((params: unknown) => {
    calls.push(params);
    const script = scripts[Math.min(i++, scripts.length - 1)] ?? [];
    async function* gen() { for (const m of script) yield m; }
    return gen();
  }) as unknown as QueryFn;
  return { queryFn, calls };
}

const fastOptions = { model: 'claude-test', maxRetries: 1, timeoutMs: 5000, projectRoot: '/tmp/project', logProgress: false, isolateClaudeConfig: false };

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('CodeReviewOrchestrator', () => {
  describe('Configuration', () => {
    it('should initialize with default options', () => {
      const orchestrator = new CodeReviewOrchestrator({ model: 'claude-test' });
      const opts = orchestrator.getOptions();
      expect(opts.model).toBe('claude-test');
      expect(opts.maxTurns).toBeGreaterThan(10);
      expect(opts.maxRetries).toBe(2);
      expect(orchestrator.getRateLimiter().getConfig()).toMatchObject({ maxConcurrent: 5 });
    });

    it('should fall back to ANTHROPIC_MODEL and fail without a model', () => {
      vi.stubEnv('ANTHROPIC_MODEL', 'env-model');
      expect(new CodeReviewOrchestrator().getOptions().model).toBe('env-model');
      vi.stubEnv('ANTHROPIC_MODEL', '');
      expect(() => new CodeReviewOrchestrator()).toThrow(ReviewError);
      vi.unstubAllEnvs();
    });

    it('should accept custom rate limit configuration', () => {
      const orchestrator = new CodeReviewOrchestrator({
        model: 'claude-test',
        rateLimits: { maxRequestsPerMinute: 10, maxTokensPerMinute: 20_000, maxConcurrent: 2 }
      });
      expect(orchestrator.getRateLimiter().getConfig()).toEqual({
        maxRequestsPerMinute: 10,
        maxTokensPerMinute: 20_000,
        maxConcurrent: 2
      });
    });

    it('should configure MCP servers, subagents, the Task tool and structured output', () => {
      const orchestrator = new CodeReviewOrchestrator({ model: 'claude-test', projectRoot: '/tmp/project', isolateClaudeConfig: false });
      const options = orchestrator.buildQueryOptions();

      expect(Object.keys(options.mcpServers ?? {})).toEqual(['github', 'eslint']);
      expect(Object.keys(options.agents ?? {})).toEqual([
        'code-quality-analyzer',
        'test-coverage-analyzer',
        'refactoring-suggester'
      ]);
      for (const agent of Object.values(options.agents ?? {})) {
        expect(agent.model).toBe('inherit');
        expect(agent.tools).toContain('Skill');
        expect(agent.description.length).toBeGreaterThan(40);
      }
      expect(options.allowedTools).toContain('Task');
      expect(options.allowedTools).toContain('mcp__github__*');
      expect(options.model).toBe('claude-test');
      expect(options.cwd).toBe('/tmp/project');
      expect(options.settingSources).toEqual(['project']);
      expect(options.permissionMode).toBe('dontAsk');
      expect(options).not.toHaveProperty('allowDangerouslySkipPermissions');
      expect(options.outputFormat).toEqual({ type: 'json_schema', schema: expect.objectContaining({ type: 'object' }) });
    });
  });

  describe('reviewPullRequest', () => {
    it('should reject invalid PR references before calling the SDK', async () => {
      const { queryFn, calls } = fakeQuery([]);
      const orchestrator = new CodeReviewOrchestrator(fastOptions, queryFn);
      await expect(orchestrator.reviewPullRequest('', 'repo', 1)).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_FAILED });
      await expect(orchestrator.reviewPullRequest('o', 'repo', 0)).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_FAILED });
      expect(calls).toHaveLength(0);
    });

    it('should send a prompt that fetches PR files from GitHub MCP and spawns the subagents', async () => {
      const { queryFn, calls } = fakeQuery([[initMessage(), taskMessage(SUBAGENT_NAMES), successResult(makeReport())]]);
      const orchestrator = new CodeReviewOrchestrator(fastOptions, queryFn);
      await orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 3);

      expect(calls).toHaveLength(1);
      const params = calls[0] as { prompt: AsyncIterable<{ message: { content: string } }>; options: Record<string, unknown> };
      let promptText = '';
      for await (const m of params.prompt) promptText += m.message.content;
      expect(promptText).toContain('mcp__github__get_pull_request_files');
      expect(promptText).toContain('mcp__github__get_file_contents');
      expect(promptText).toContain('pull_number=3');
      expect(promptText).toContain('Use the code-quality-analyzer agent');
      expect(promptText).toContain('Use the test-coverage-analyzer agent');
      expect(promptText).toContain('Use the refactoring-suggester agent');
      expect(promptText).toContain('IN PARALLEL');
      expect(params.options.outputFormat).toBeDefined();
    });

    it('should spawn all 3 subagents in parallel (observed via Task tool calls)', async () => {
      const { queryFn } = fakeQuery([[initMessage(), taskMessage(SUBAGENT_NAMES), successResult(makeReport())]]);
      const orchestrator = new CodeReviewOrchestrator(fastOptions, queryFn);
      const infoSpy = vi.spyOn(await import('../src/utils/logger.js').then(m => m.logger), 'info');
      await orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 3);
      const finished = infoSpy.mock.calls.find(c => c[0] === 'Orchestrator finished');
      expect(finished?.[1]).toMatchObject({ agentsInvoked: expect.arrayContaining(SUBAGENT_NAMES) });
    });

    it('should aggregate results into ReviewReport and recompute the summary', async () => {
      const raw = makeReport({
        summary: { totalFiles: 99, overallScore: 1, criticalIssues: 0, highPriorityTests: 0, refactoringOpportunities: 0 },
        recommendations: [
          { priority: 'low', category: 'style', description: 'later', files: ['a.ts'] },
          { priority: 'critical', category: 'security', description: 'now', files: ['a.ts'] }
        ]
      });
      const { queryFn } = fakeQuery([[initMessage(), taskMessage(SUBAGENT_NAMES), successResult(raw)]]);
      const orchestrator = new CodeReviewOrchestrator(fastOptions, queryFn);
      const report = await orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 3);

      expect(report.pullRequest).toEqual({ owner: 'udacity', repo: 'cd14715-simple-todo-app', number: 3 });
      expect(report.summary).toEqual({
        totalFiles: 1,
        overallScore: 55,
        criticalIssues: 1,
        highPriorityTests: 1,
        refactoringOpportunities: 1
      });
      expect(report.recommendations.map(r => r.priority)).toEqual(['critical', 'low']);
      expect(report.metadata.agentVersions).toMatchObject({ orchestrator: '1.0.0', 'code-quality-analyzer': '1.0.0' });
      expect(report.metadata.duration).toBeGreaterThanOrEqual(0);
      expect(Date.parse(report.metadata.analyzedAt)).not.toBeNaN();
    });

    it('should validate output with Zod schema and reject invalid structured output', async () => {
      const invalid = { ...makeReport(), fileReviews: [{ file: 'x.ts' }] };
      const { queryFn, calls } = fakeQuery([[initMessage(), successResult(invalid)]]);
      const orchestrator = new CodeReviewOrchestrator(fastOptions, queryFn);
      await expect(orchestrator.reviewPullRequest('o', 'r', 1)).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_FAILED });
      expect(calls).toHaveLength(1); // validation failures are not retried
      expect(ReviewReportSchema.safeParse(invalid).success).toBe(false);
    });

    it('should fail with STRUCTURED_OUTPUT_FAILED when the SDK exhausts structured output retries', async () => {
      const { queryFn } = fakeQuery([[initMessage(), errorResult('error_max_structured_output_retries', ['bad json'])]]);
      const orchestrator = new CodeReviewOrchestrator(fastOptions, queryFn);
      await expect(orchestrator.reviewPullRequest('o', 'r', 1)).rejects.toMatchObject({ code: ErrorCodes.RETRY_EXHAUSTED });
    });

    it('should retry transient agent failures and succeed on the second attempt', async () => {
      const { queryFn, calls } = fakeQuery([
        [initMessage(), errorResult('error_during_execution', ['MCP server crashed'])],
        [initMessage(), taskMessage(SUBAGENT_NAMES), successResult(makeReport())]
      ]);
      const orchestrator = new CodeReviewOrchestrator({ ...fastOptions, maxRetries: 2 }, queryFn);
      const report = await orchestrator.reviewPullRequest('o', 'r', 1);
      expect(report.summary.totalFiles).toBe(1);
      expect(calls).toHaveLength(2);
    });

    it('should release the rate limiter slot even when the review fails', async () => {
      const { queryFn } = fakeQuery([[initMessage(), errorResult('error_max_turns')]]);
      const orchestrator = new CodeReviewOrchestrator(fastOptions, queryFn);
      await expect(orchestrator.reviewPullRequest('o', 'r', 1)).rejects.toBeInstanceOf(ReviewError);
      expect(orchestrator.getRateLimiter().getStatus().activeRequests).toBe(0);
    });

    it('should classify retryable vs permanent errors', () => {
      expect(isRetryableError(new ReviewError('x', ErrorCodes.VALIDATION_FAILED))).toBe(false);
      expect(isRetryableError(new ReviewError('x', ErrorCodes.INVALID_CONFIG))).toBe(false);
      expect(isRetryableError(new ReviewError('x', ErrorCodes.AGENT_TIMEOUT))).toBe(true);
      expect(isRetryableError(new Error('network'))).toBe(true);
    });
  });

  describe('Integration', () => {
    // Requires real API keys and network access; run manually:
    //   RUN_INTEGRATION=1 npm test -- orchestrator
    const run = process.env.RUN_INTEGRATION === '1' ? it : it.skip;
    run('should review a real small PR', async () => {
      const orchestrator = new CodeReviewOrchestrator({ maxFiles: 2 });
      const report = await orchestrator.reviewPullRequest('udacity', 'cd14715-simple-todo-app', 1);
      expect(report.fileReviews.length).toBeGreaterThan(0);
      expect(ReviewReportSchema.safeParse(report).success).toBe(true);
    }, 20 * 60 * 1000);
  });
});

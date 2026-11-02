import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { formatError, isReviewError } from './utils/error-handler.js';

// Load environment variables. `override: true` makes .env win over stale values
// already present in the shell (e.g. an old ANTHROPIC_API_KEY exported earlier).
// In the Vocareum workspace the key/base URL are not in .env, so the workspace
// environment still applies there.
dotenv.config({ override: true });

const USAGE = `Usage: npm run dev -- <owner> <repo> <pr-number>
Example: npm run dev -- udacity cd14715-simple-todo-app 2`;

/**
 * Validate command line arguments.
 * Returns the parsed values or exits the process with a helpful message.
 */
export function parseArgs(argv: string[]): { owner: string; repo: string; prNumber: number } {
  const [owner, repo, prStr] = argv;

  if (!owner || !repo || !prStr) {
    fail(`Missing arguments.\n${USAGE}`);
  }

  // Only accept plain positive integers (parseInt would accept "12abc")
  if (!/^\d+$/.test(prStr)) {
    fail(`Invalid PR number "${prStr}": must be a positive integer.\n${USAGE}`);
  }
  const prNumber = parseInt(prStr, 10);
  if (!Number.isSafeInteger(prNumber) || prNumber <= 0) {
    fail(`Invalid PR number "${prStr}": must be a positive integer.\n${USAGE}`);
  }

  if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) {
    fail(`Invalid owner/repo "${owner}/${repo}": use the GitHub names, e.g. udacity cd14715-simple-todo-app`);
  }

  return { owner, repo, prNumber };
}

/**
 * Validate authentication: Anthropic API key OR AWS Bedrock credentials.
 */
export function validateAuth(env: NodeJS.ProcessEnv = process.env): 'anthropic' | 'bedrock' {
  const hasAnthropicKey = Boolean(env.ANTHROPIC_API_KEY?.trim());
  const hasAwsCreds = Boolean(env.AWS_ACCESS_KEY_ID?.trim() && env.AWS_SECRET_ACCESS_KEY?.trim());
  const useBedrock = env.CLAUDE_CODE_USE_BEDROCK === '1' || (!hasAnthropicKey && hasAwsCreds);

  if (useBedrock && hasAwsCreds) {
    if (!env.AWS_REGION?.trim()) {
      fail(
        'AWS Bedrock authentication selected but AWS_REGION is not set.\n' +
          'Add to your .env: AWS_REGION=us-east-1 (or your Bedrock region)'
      );
    }
    console.log('🔐 Using AWS Bedrock authentication');
    return 'bedrock';
  }

  if (hasAnthropicKey) {
    console.log('🔐 Using Anthropic API authentication');
    if (env.ANTHROPIC_BASE_URL?.trim()) {
      console.log(`   Endpoint: ${env.ANTHROPIC_BASE_URL}`);
    }
    return 'anthropic';
  }

  fail(
    'No authentication configured. Choose ONE method and add it to .env:\n\n' +
      '  Option 1 - Anthropic API:\n' +
      '    ANTHROPIC_API_KEY=sk-ant-...\n\n' +
      '  Option 2 - AWS Bedrock:\n' +
      '    AWS_ACCESS_KEY_ID=...\n' +
      '    AWS_SECRET_ACCESS_KEY=...\n' +
      '    AWS_REGION=us-east-1\n' +
      '    CLAUDE_CODE_USE_BEDROCK=1'
  );
}

/**
 * Validate the model configuration (required for both auth methods).
 */
export function validateModel(env: NodeJS.ProcessEnv = process.env, auth: 'anthropic' | 'bedrock' = 'anthropic'): string {
  const model = env.ANTHROPIC_MODEL?.trim();
  if (!model) {
    fail(
      'ANTHROPIC_MODEL environment variable is required.\n' +
        'Add to your .env:\n' +
        '  For Anthropic API: ANTHROPIC_MODEL=claude-sonnet-4-5-20250929\n' +
        '  For AWS Bedrock:   ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0'
    );
  }
  if (auth === 'bedrock' && !model.includes('anthropic.')) {
    console.warn(
      `⚠️  ANTHROPIC_MODEL="${model}" does not look like a Bedrock model id ` +
        '(expected e.g. us.anthropic.claude-sonnet-4-5-20250929-v1:0)'
    );
  }
  console.log(`🤖 Model: ${model}`);
  return model;
}

/**
 * Write the three report formats to the reports/ directory.
 */
export function writeReports(
  report: Parameters<ReportGenerator['generateJSONReport']>[0],
  outputDir: string
): { json: string; markdown: string; html: string } {
  const generator = new ReportGenerator();
  const { owner, repo, number } = report.pullRequest;
  const base = path.join(outputDir, `${owner}_${repo}_${number}`);

  fs.mkdirSync(outputDir, { recursive: true });
  const paths = { json: `${base}.json`, markdown: `${base}.md`, html: `${base}.html` };
  fs.writeFileSync(paths.json, generator.generateJSONReport(report), 'utf8');
  fs.writeFileSync(paths.markdown, generator.generateMarkdownReport(report), 'utf8');
  fs.writeFileSync(paths.html, generator.generateHTMLReport(report), 'utf8');
  return paths;
}

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

/**
 * Main entry point for the Claude Multi-Agent Code Review System
 * Usage: npm run dev <owner> <repo> <pr-number>
 */
async function main(): Promise<void> {
  const { owner, repo, prNumber } = parseArgs(process.argv.slice(2));
  const auth = validateAuth();
  validateModel(process.env, auth);

  if (!process.env.GITHUB_TOKEN) {
    console.log('ℹ️  GITHUB_TOKEN not set: using unauthenticated GitHub access (public repos, lower rate limits)');
  }

  console.log(`\n🔍 Reviewing ${owner}/${repo} pull request #${prNumber} ...\n`);
  const started = Date.now();

  try {
    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    const outputDir = path.resolve(process.cwd(), 'reports');
    const paths = writeReports(report, outputDir);

    const s = report.summary;
    console.log('\n✅ Review complete');
    console.log(`   Files reviewed: ${s.totalFiles} | Overall score: ${s.overallScore}/100`);
    console.log(
      `   Critical issues: ${s.criticalIssues} | High-priority tests: ${s.highPriorityTests} | Refactorings: ${s.refactoringOpportunities}`
    );
    console.log(`   Duration: ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
    console.log('📄 Reports saved:');
    console.log(`   JSON:     ${path.relative(process.cwd(), paths.json)}`);
    console.log(`   Markdown: ${path.relative(process.cwd(), paths.markdown)}`);
    console.log(`   HTML:     ${path.relative(process.cwd(), paths.html)}`);
  } catch (error) {
    console.error(`\n❌ Review failed: ${formatError(error)}`);
    if (isReviewError(error) && error.metadata) {
      console.error('   Details:', JSON.stringify(error.metadata, null, 2));
    }
    console.error('\nTroubleshooting:');
    console.error('  - Check ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL and ANTHROPIC_MODEL in .env');
    console.error('  - Verify the PR exists and is accessible (set GITHUB_TOKEN for private repos)');
    console.error('  - See logs/error.log for the full error');
    process.exit(1);
  }
}

// Only run when executed directly (not when imported by tests)
const isDirectRun = process.argv[1] !== undefined && /main\.(ts|js)$/.test(process.argv[1]);
if (isDirectRun) {
  main();
}

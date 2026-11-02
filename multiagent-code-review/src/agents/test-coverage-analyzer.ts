import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { TEST_COVERAGE_ANALYZER_PROMPT } from '../prompts/test-coverage-analyzer.prompt.js';
import { GITHUB_TOOLS } from '../config/mcp.config.js';

/** Name used by the orchestrator when invoking this agent via the Task tool */
export const TEST_COVERAGE_ANALYZER_NAME = 'test-coverage-analyzer';

/**
 * Test Coverage Analyzer subagent
 *
 * Identifies functions, classes, branches and edge cases without test coverage,
 * estimates a coverage percentage and proposes concrete test cases with
 * meaningful assertions. Returns JSON matching TestCoverageResultSchema.
 *
 * Tools: read/search local files, look up existing tests in the repository via
 * GitHub MCP, and invoke the test-coverage-patterns skill.
 */
export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Test coverage reviewer. Use it to evaluate how well ONE source file is covered by tests: ' +
    'it finds existing test files (locally and in the GitHub repository), lists untested ' +
    'functions/classes/branches/edge-cases with priorities, estimates a 0-100 coverage ' +
    'percentage and suggests specific test cases with assertions. Returns a JSON TestCoverageResult.',
  prompt: TEST_COVERAGE_ANALYZER_PROMPT,
  model: 'inherit',
  tools: [
    'Read',
    'Grep',
    'Glob',
    'Skill',
    GITHUB_TOOLS.getFileContents,
    GITHUB_TOOLS.searchCode
  ]
};

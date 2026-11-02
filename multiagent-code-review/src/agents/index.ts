/**
 * Subagent exports
 *
 * `subagents` is the map passed to the SDK `agents` option; its keys are the names
 * the orchestrator uses with the Task tool.
 */
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { codeQualityAnalyzer, CODE_QUALITY_ANALYZER_NAME } from './code-quality-analyzer.js';
import { testCoverageAnalyzer, TEST_COVERAGE_ANALYZER_NAME } from './test-coverage-analyzer.js';
import { refactoringSuggester, REFACTORING_SUGGESTER_NAME } from './refactoring-suggester.js';

export { codeQualityAnalyzer, CODE_QUALITY_ANALYZER_NAME } from './code-quality-analyzer.js';
export { testCoverageAnalyzer, TEST_COVERAGE_ANALYZER_NAME } from './test-coverage-analyzer.js';
export { refactoringSuggester, REFACTORING_SUGGESTER_NAME } from './refactoring-suggester.js';

export const subagents: Record<string, AgentDefinition> = {
  [CODE_QUALITY_ANALYZER_NAME]: codeQualityAnalyzer,
  [TEST_COVERAGE_ANALYZER_NAME]: testCoverageAnalyzer,
  [REFACTORING_SUGGESTER_NAME]: refactoringSuggester
};

export const SUBAGENT_NAMES = Object.keys(subagents);

import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { CODE_QUALITY_ANALYZER_PROMPT } from '../prompts/code-quality-analyzer.prompt.js';
import { ESLINT_TOOLS, GITHUB_TOOLS } from '../config/mcp.config.js';

/** Name used by the orchestrator when invoking this agent via the Task tool */
export const CODE_QUALITY_ANALYZER_NAME = 'code-quality-analyzer';

/**
 * Code Quality Analyzer subagent
 *
 * Analyzes a single file for security vulnerabilities, performance problems,
 * maintainability concerns and best-practice violations. Returns JSON matching
 * CodeQualityResultSchema.
 *
 * Tools: read/search local copies of PR files, invoke Claude Skills
 * (security-analysis, typescript-patterns, javascript-best-practices), run ESLint
 * through the ESLint MCP server, and fetch extra files from GitHub when needed.
 */
export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Code quality reviewer. Use it to analyze ONE source file for security vulnerabilities, ' +
    'performance problems, maintainability issues, bug risks and best-practice violations. ' +
    'It invokes Claude Skills (security-analysis, typescript-patterns, javascript-best-practices) ' +
    'and ESLint, and returns a JSON CodeQualityResult with line-numbered issues, severity, ' +
    'an overall 0-100 score and a summary.',
  prompt: CODE_QUALITY_ANALYZER_PROMPT,
  model: 'inherit',
  tools: [
    'Read',
    'Grep',
    'Glob',
    'Skill',
    ESLINT_TOOLS.lintFiles,
    GITHUB_TOOLS.getFileContents
  ]
};

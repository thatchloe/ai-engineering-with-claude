import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { REFACTORING_SUGGESTER_PROMPT } from '../prompts/refactoring-suggester.prompt.js';
import { GITHUB_TOOLS } from '../config/mcp.config.js';

/** Name used by the orchestrator when invoking this agent via the Task tool */
export const REFACTORING_SUGGESTER_NAME = 'refactoring-suggester';

/**
 * Refactoring Suggester subagent
 *
 * Identifies opportunities to apply design patterns and modern language features,
 * extract functions/classes, simplify logic and remove dead code. Each suggestion
 * includes before/after code and an impact rating. Returns JSON matching
 * RefactoringSuggestionSchema.
 *
 * Tools: read/search local files, invoke refactoring/typescript/javascript skills,
 * fetch related files from GitHub for context.
 */
export const refactoringSuggester: AgentDefinition = {
  description:
    'Refactoring advisor. Use it to find structural improvements in ONE source file: ' +
    'extract-function candidates, modernization (async/await, optional chaining, proper types), ' +
    'simplification, dead-code removal, renames and design-pattern improvements. Each suggestion ' +
    'has before/after code, impact and benefits. Returns a JSON RefactoringSuggestion result.',
  prompt: REFACTORING_SUGGESTER_PROMPT,
  model: 'inherit',
  tools: ['Read', 'Grep', 'Glob', 'Skill', GITHUB_TOOLS.getFileContents]
};

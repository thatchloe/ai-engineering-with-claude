import type { McpServerConfig } from '@anthropic-ai/claude-agent-sdk';

/**
 * Model Context Protocol (MCP) server configurations
 *
 * Required MCP Servers:
 * 1. GitHub - For PR/repo operations
 * 2. ESLint - For code linting and style analysis
 *
 * Both servers use the stdio transport and are launched on demand with `npx`,
 * so nothing has to be installed globally. Tool names exposed to the agents
 * follow the SDK convention `mcp__<server>__<tool>`, e.g.
 * `mcp__github__get_pull_request_files` and `mcp__eslint__lint-files`.
 *
 * Documentation:
 * - MCP Protocol: https://modelcontextprotocol.io
 * - GitHub MCP: https://github.com/github/github-mcp-server
 * - ESLint MCP: https://eslint.org/docs/latest/use/mcp
 */

/** Names of the MCP servers, re-used when building allowed tool lists */
export const MCP_SERVER_NAMES = {
  github: 'github',
  eslint: 'eslint'
} as const;

export const mcpServersConfig: Record<string, McpServerConfig> = {
  /**
   * GitHub MCP Server
   * Provides tools for GitHub API operations (pull requests, file contents, search).
   *
   * GITHUB_TOKEN is optional (recommended for private repos and higher rate limits).
   * The GitHub MCP server expects GITHUB_PERSONAL_ACCESS_TOKEN as the env var name,
   * so we map our GITHUB_TOKEN from .env to that name.
   */
  [MCP_SERVER_NAMES.github]: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || ''
    }
  },

  /**
   * ESLint MCP Server
   * Provides the `lint-files` tool for linting local files with ESLint.
   * No authentication required. Uses the eslint.config.js in this project.
   */
  [MCP_SERVER_NAMES.eslint]: {
    type: 'stdio' as const,
    command: 'npx',
    args: ['-y', '@eslint/mcp@latest'],
    env: {}
  }
};

/** GitHub MCP tools the orchestrator and subagents are allowed to call */
export const GITHUB_TOOLS = {
  getPullRequest: 'mcp__github__get_pull_request',
  getPullRequestFiles: 'mcp__github__get_pull_request_files',
  getFileContents: 'mcp__github__get_file_contents',
  searchCode: 'mcp__github__search_code'
} as const;

/** ESLint MCP tool used by the code quality analyzer */
export const ESLINT_TOOLS = {
  lintFiles: 'mcp__eslint__lint-files'
} as const;

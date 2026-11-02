# Agentic AI with Claude Code

Coursework for the Udacity *Claude Code* course (`cd14715`): model selection, extended thinking,
agentic architecture, Claude Code configuration, the Claude Agent SDK, custom tools, structured
outputs, Claude Skills, MCP integration, multi-agent orchestration, TDD with AI, agent evaluation
and computer use.

## Capstone

[`Project-Enterprise Multi-Agent Code Review Orchestrator/`](Project-Enterprise%20Multi-Agent%20Code%20Review%20Orchestrator/) -
a production-ready multi-agent pull request reviewer built on the Claude Agent SDK:

- **Orchestrator** fetches the PR through the GitHub MCP server, stores each changed file locally,
  and dispatches three subagents in parallel with the `Task` tool.
- **Subagents** (`code-quality-analyzer`, `test-coverage-analyzer`, `refactoring-suggester`) are
  `AgentDefinition`s with `model: 'inherit'`, scoped tools, and the `Skill` tool for the bundled
  Claude Skills (security analysis, TypeScript patterns, test coverage patterns, refactoring patterns,
  JavaScript best practices). The quality analyzer also runs ESLint via the ESLint MCP server.
- **Structured output** is enforced with a Zod schema converted by `zod-to-json-schema`, then
  re-validated; summary scores are recomputed from the findings.
- **Production utilities**: exponential-backoff retry, timeout wrapper, sliding-window rate limiter,
  Winston logging, CLI validation, 51 unit tests.
- **Deliverables**: `reports/` holds the 9 required reports (JSON, Markdown, HTML) for PRs #1-#3 of
  [`udacity/cd14715-simple-todo-app`](https://github.com/udacity/cd14715-simple-todo-app).

The original assignment brief is in [`PROJECT-BRIEF.md`](PROJECT-BRIEF.md). Setup and run
instructions are in the project's own README.

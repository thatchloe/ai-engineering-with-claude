# Enterprise Multi-Agent Code Review Orchestrator

Production-ready multi-agent system that automates code review, test coverage analysis, and refactoring suggestions for GitHub pull requests using Claude Agent SDK.

## Introduction

Welcome to one of the most practical AI engineering projects you'll build: a production-ready, multi-agent code review system powered by the Claude Agent SDK.

**The Scenario:** You've just joined DevFlow, a fast-growing startup that's scaling rapidly. Your engineering team is drowning in pull request reviews. Senior developers spend 30% of their time reviewing code, creating a bottleneck that slows down the entire development pipeline. Your tech lead has tasked you with building an AI-powered solution that can provide comprehensive, automated code reviews—freeing up senior engineers to focus on architecture and mentorship.

**Your Goal:** Build a multi-agent system where specialized AI agents work together to analyze pull requests from multiple angles—code quality, test coverage, and refactoring opportunities—then synthesize their findings into a polished, actionable report.

## The Challenge

Manual code reviews are:

- **Time-consuming:** A thorough review of a 500-line PR can take 30-60 minutes
- **Inconsistent:** Different reviewers catch different issues
- **Limited in scope:** Humans often focus on logic, missing security or performance issues

Your task is to build a system that:

1. Fetches pull request data from GitHub using MCP (Model Context Protocol)
2. Dispatches three specialized subagents to analyze code
3. Aggregates their insights into a unified, validated report
4. Outputs professional HTML/Markdown/JSON reports

## Your Product

The final system architecture:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAIN ORCHESTRATOR                            │
│         (Coordinates analysis, aggregates results)              │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Code Quality  │   │ Test Coverage │   │  Refactoring  │
│   Analyzer    │   │   Analyzer    │   │   Suggester   │
│               │   │               │   │               │
│ • Security    │   │ • Coverage    │   │ • Patterns    │
│ • Performance │   │ • Test gaps   │   │ • Modernize   │
│ • Best practs │   │ • Assertions  │   │ • Clean code  │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
              ┌─────────────────────────┐
              │   ReviewReport (JSON)   │
              │   ─────────────────     │
              │   • File-by-file        │
              │   • Aggregated scores   │
              │   • Recommendations     │
              └─────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   [report.md]        [report.html]       [report.json]
```

**Key Technologies:**

- **Claude Agent SDK:** Orchestrates agents and handles tool execution
- **MCP (Model Context Protocol):** Integrates GitHub API and ESLint via standardized protocol
- **Zod:** Runtime validation of structured outputs
- **TypeScript:** Type-safe development
- **Claude Skills:** Reusable domain expertise for specialized code analysis

## Deliverables

Your submission must include all of the following:

### 1. MCP Configuration (`src/config/mcp.config.ts`)

Configure two MCP servers for external tool integration:

- **GitHub MCP server** - Enables fetching PR data and repository information
- **ESLint MCP server** - Provides code linting and style analysis capabilities

### 2. Three Specialized Subagents (`src/agents/`)

**Code Quality Analyzer** (`code-quality-analyzer.ts`)

- Analyzes code for security vulnerabilities, performance issues, and maintainability concerns
- Configured with appropriate tools for reading and analyzing code files
- Integrates Claude Skills for specialized code analysis (e.g., `javascript-best-practices`, `security-analysis`)

**Test Coverage Analyzer** (`test-coverage-analyzer.ts`)

- Identifies functions/methods without test coverage
- Suggests specific test cases with meaningful assertions
- Estimates coverage percentage and prioritizes critical untested paths

**Refactoring Suggester** (`refactoring-suggester.ts`)

- Identifies opportunities to apply design patterns and modern language features
- Suggests extract method/class candidates
- Identifies dead code or redundant logic

Each agent must:

- Be defined using the `AgentDefinition` type with clear descriptions
- Set `model: 'inherit'` to use the orchestrator's model
- Include only the tools necessary for its specific role
- Include the `Skill` tool to invoke Claude skills

### 3. Prompt Engineering (`src/prompts/`)

Create targeted prompts for:

- **Orchestrator prompt** (`orchestrator.prompt.ts`) - Instructs the main agent to fetch PR data and coordinate subagent execution
- **Code Quality prompt** (`code-quality-analyzer.prompt.ts`) - Specifies security, performance, and best practice evaluation criteria
- **Test Coverage prompt** (`test-coverage-analyzer.prompt.ts`) - Defines test completeness assessment approach
- **Refactoring prompt** (`refactoring-suggester.prompt.ts`) - Outlines architectural improvement identification

Each prompt must:

- Explicitly instruct the agent on its specific focus area
- Reference the expected output structure (Zod schema requirements)
- Provide clear guidance on when and how to leverage Claude Skills

### 4. Main Orchestrator (`src/orchestrator.ts`)

Implement the orchestration logic using Claude Agent SDK's `query` method:

- Configure with MCP servers (GitHub and ESLint)
- Include the `Task` tool for spawning subagents
- Register all three subagents in the configuration
- Use `outputFormat` with `zod-to-json-schema` for structured outputs
- Aggregate subagent findings into the `ReviewReport` schema
- Handle potential agent failures gracefully

### 5. CLI Application (`src/main.ts`)

Complete the entry point with:

- Command-line argument parsing and validation (owner, repo, PR number)
- Environment variable validation (API credentials, model configuration)
- Orchestrator instantiation and `reviewPullRequest` invocation
- Report generation using `ReportGenerator` in three formats (JSON, Markdown, HTML)
- Error handling with meaningful user messages

### 6. Error Handler (`src/utils/error-handler.ts`)

Complete the error handling utility:

- **Retry logic with exponential backoff** - Implement `withRetry` function that retries failed operations with increasing delays and jitter
- **Timeout wrapper** - Implement `withTimeout` function using `Promise.race` to limit operation duration
- Custom `ReviewError` class and `ErrorCodes` enum are provided

### 7. Rate Limiter (`src/utils/rate-limiter.ts`)

Complete the rate limiting utility:

- **Token bucket algorithm with sliding window** - Track requests and tokens used in the last 60 seconds
- **Core methods** - Implement `acquire`, `canProceed`, `waitForSlot`, `waitForRateLimit`, and `pruneOldRecords`
- **Concurrent request management** - Respect `maxConcurrent` limit to prevent overwhelming the API
- Interfaces, configuration, and helper methods are provided

### 8. Comprehensive Testing (`tests/`)

Implement and pass all tests:

- Schema validation tests (Zod schemas accept valid data, reject invalid data)
- Edge case handling (empty arrays, boundary values)
- JSON schema export validation for SDK structured outputs
- Integration test demonstrating successful PR analysis

### 9. Final Deliverables: PR Analysis Reports (`reports/`)

**REQUIRED FOR SUBMISSION:** Generate comprehensive analysis reports for three specific pull requests from the [udacity/cd14715-simple-todo-app](https://github.com/udacity/cd14715-simple-todo-app) repository:

- **PR #1:** "add clean code fixture" (merged)
- **PR #2:** "Add search functionality for todos" (open)
- **PR #3:** "Add premium subscription features" (open)

For each PR, your system must generate all three report formats:

- **JSON report** (`.json`) - Structured data matching `ReviewReport` schema
- **Markdown report** (`.md`) - Human-readable formatted report
- **HTML report** (`.html`) - Web-viewable styled report

**Total required files:** 9 reports (3 PRs × 3 formats)

**Quality requirements:**

- All reports must contain populated data from agent analysis (not empty or undefined)
- Code quality issues must include specific file paths, line numbers, and severity levels
- Test coverage analysis must include specific suggestions for missing tests
- Refactoring suggestions must be actionable with code examples
- Overall scores must be calculated based on aggregated findings
- Reports must be well-formatted and render correctly

## Success Criteria

Your implementation is complete when:

**Core Functionality:**

- [ ] MCP configuration defines GitHub and ESLint servers
- [ ] Three subagents are defined with `AgentDefinition`, `model: 'inherit'`, scoped tools, and the `Skill` tool
- [ ] Orchestrator and agent prompts reference their Zod output schemas and Claude Skills
- [ ] Orchestrator uses `query` with MCP servers, the `Task` tool, registered subagents, and structured `outputFormat`
- [ ] Subagent findings are aggregated into a valid `ReviewReport`
- [ ] CLI parses and validates arguments and environment variables
- [ ] Reports are generated in JSON, Markdown, and HTML

**Production Quality:**

- [ ] `withRetry` implements exponential backoff with jitter
- [ ] `withTimeout` limits operation duration with `Promise.race`
- [ ] Rate limiter enforces request, token, and concurrency limits over a sliding window
- [ ] All tests in `tests/` pass

**Final Deliverables (Required for Submission):**

- [ ] 3 reports for PR #1 (udacity/cd14715-simple-todo-app) - JSON, MD, HTML
- [ ] 3 reports for PR #2 (udacity/cd14715-simple-todo-app) - JSON, MD, HTML
- [ ] 3 reports for PR #3 (udacity/cd14715-simple-todo-app) - JSON, MD, HTML

## Features

- **Multi-Agent Architecture**: Coordinates 3 specialized subagents for comprehensive PR analysis
- **Code Quality Analysis**: Security vulnerabilities, performance issues, best practices
- **Test Coverage Analysis**: Identifies untested code paths with extended thinking
- **Refactoring Suggestions**: Modernization opportunities and pattern improvements
- **MCP Integration**: GitHub and Eslint servers for external data access
- **Claude Skills**: Language-specific analysis (JavaScript, TypeScript, Python, Security)
- **Production-Grade**: Rate limiting, retry logic, structured logging, error handling

## Architecture

### Orchestrator
Main coordinator that:
1. Fetches PR files via GitHub MCP
2. Spawns 3 subagents in parallel for each file
3. Aggregates results into unified review report
4. Enforces rate limits and validates structured outputs

### Subagents

| Agent | Purpose | Key Features |
|-------|---------|--------------|
| **code-quality-analyzer** | Security, performance, maintainability | Invokes Claude Skills, severity-leveled feedback |
| **test-coverage-analyzer** | Identifies untested code paths | Extended thinking, priority-based suggestions |
| **refactoring-suggester** | Modernization and patterns | Before/after examples, impact assessment |

## Prerequisites

- Node.js 20+
- Anthropic API key
- GitHub personal access token
- TypeScript 5.3+

## Installation

```bash
# Clone repository
cd project/starter

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

## Configuration

Edit `.env` with your credentials:

```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
GITHUB_TOKEN=ghp_your-token-here

# REQUIRED: Absolute path to project root (contains .claude/skills/)
PROJECT_ROOT=/absolute/path/to/project/starter

LOG_LEVEL=info
```

### MCP Servers

Configured in [starter/src/config/mcp.config.ts](starter/src/config/mcp.config.ts):
- **GitHub MCP** (`@modelcontextprotocol/server-github`): pull request metadata, changed files, file contents, code search
- **ESLint MCP** (`@eslint/mcp`): `lint-files` tool, used by the code quality analyzer on the local copies of PR files (config in `starter/eslint.config.js`)

### Claude Skills

Located in `starter/.claude/skills/`:
- `javascript-best-practices` - Modern ES patterns, async best practices (provided)
- `typescript-patterns` - Type safety, data modeling, async/error pitfalls
- `security-analysis` - OWASP Top 10, secure coding, severity guide
- `test-coverage-patterns` - Static coverage estimation, gap prioritisation, actionable test cases
- `refactoring-patterns` - Extract/simplify/modernize catalogue with before/after templates

## Usage

### Run Code Review

```bash
cd project/starter
npm run dev -- <owner> <repo> <pr-number>

# Example (one of the required submission PRs)
npm run dev -- udacity cd14715-simple-todo-app 2
```

Reports are written to `project/starter/reports/<owner>_<repo>_<pr>.{json,md,html}`.
The 9 required submission reports for PRs #1-#3 of `udacity/cd14715-simple-todo-app` live there.

### Build for Production

```bash
npm run build
npm start <owner> <repo> <pr-number>
```

### Development

```bash
# Type checking
npm run lint

# Run tests
npm test

# Watch mode
npm run test:watch
```

## Output

The system generates a structured JSON report:

```json
{
  "pullRequest": {
    "owner": "facebook",
    "repo": "react",
    "number": 12345
  },
  "fileReviews": [
    {
      "file": "src/payment.ts",
      "codeQuality": {
        "issues": [...],
        "overallScore": 85
      },
      "testCoverage": {
        "untestedPaths": [...],
        "coverageEstimate": 70
      },
      "refactorings": {
        "suggestions": [...]
      }
    }
  ],
  "summary": {
    "totalFiles": 5,
    "overallScore": 82,
    "criticalIssues": 2,
    "highPriorityTests": 3,
    "refactoringOpportunities": 7
  },
  "recommendations": [...],
  "metadata": {
    "analyzedAt": "2025-01-15T10:30:00Z",
    "duration": 15420,
    "agentVersions": {...}
  }
}
```

## Project Structure

```
project/starter/
├── src/
│   ├── main.ts                 # Entry point
│   ├── orchestrator.ts         # Main orchestrator
│   ├── agents/                 # Subagent definitions
│   │   ├── code-quality-analyzer.ts
│   │   ├── test-coverage-analyzer.ts
│   │   └── refactoring-suggester.ts
│   ├── config/
│   │   └── mcp.config.ts       # MCP server configuration
│   ├── types/
│   │   ├── analysis-results.ts # Subagent output schemas
│   │   └── report-types.ts     # Final report schema
│   └── utils/
│       ├── logger.ts           # Winston logging
│       ├── rate-limiter.ts     # Token bucket rate limiter
│       └── error-handler.ts    # Retry logic, error types
├── .claude/skills/             # Claude Skills definitions
├── tests/                      # Test suite
├── .env.example                # Environment template
└── package.json
```

## Production Reliability

### Rate Limiting
Token bucket implementation with sliding window:
- Max 50 requests/minute
- Max 100k tokens/minute
- Max 5 concurrent requests

Configure in orchestrator:
```typescript
const orchestrator = new CodeReviewOrchestrator({
  rateLimits: {
    maxRequestsPerMinute: 50,
    maxTokensPerMinute: 100000,
    maxConcurrent: 5
  }
});
```

### Error Handling
- Exponential backoff retry (3 attempts, 1s base delay)
- Graceful degradation on subagent failures
- Structured error logging with Winston

### Observability
Logs to `logs/` directory:
- `error.log` - Error-level events
- `combined.log` - All events

JSON format with timestamps:
```json
{
  "level": "info",
  "message": "Code review completed",
  "timestamp": "2025-01-15 10:30:00",
  "owner": "facebook",
  "repo": "react",
  "prNumber": 12345,
  "score": 85,
  "duration": 15420
}
```

## Limitations

- No authentication/authorization implementation (requires external wrapper)
- Estimated token usage ~10k tokens per PR
- GitHub free tier API rate limits apply
- Requires read access to target repository

## Troubleshooting

### "Skills not loading"
Ensure `PROJECT_ROOT` in `.env` points to absolute path containing `.claude/skills/`

### "Rate limit exceeded"
Adjust rate limiter configuration or wait for window reset (60 seconds)

### "GitHub API error"
Verify `GITHUB_TOKEN` has `repo` scope and read permissions

### "Structured output validation failed"
Check subagent prompts match expected output schemas in `src/types/`

## License

ISC

## Contributing

This is a Udacity course project demonstrating multi-agent systems with Claude Agent SDK.

# Claude AI Engineer — Harness Engineering

Source-of-truth repository for the exercises in the **Claude AI Engineer: Harness Engineering** course (`cd15315`). The course teaches the engineering around a Claude agent — the loop that drives it, the state and context strategies that keep it tractable over long runs, the orchestration that coordinates multiple invocations, and the Claude Code configuration a team works inside.

Each top-level folder is a self-contained course/project with a sequence of hands-on, test-driven exercises. Most exercises ship a `starter/` you fill in and a `solution/` reference, with the acceptance criteria pinned down by a pytest suite (or, for the Claude Code project, a validator).

## Projects

### [Build a Claims Intake Agent with a stop_reason-Driven Loop](Build%20a%20Claims%20Intake%20Agent%20with%20a%20stop_reason-Driven%20Loop/)

Build the agentic loop at the heart of a harness — the `while` loop the model controls, dispatching on `stop_reason` to continue on `tool_use`, return on `end_turn`, and raise on anything unexpected. The loop you write here is the artifact every later project extends.

- `exercises/01-loop/` — Build the `stop_reason`-driven agentic loop.
- `exercises/02-tools-and-audit/` — Tool execution and a per-turn audit trace.
- `exercises/03-dynamic-decomposition/` — Dynamic task decomposition on top of the loop.

### [Engineer a Long-Conversation Context Strategy for a Retail Support Copilot](Engineer%20a%20Long-Conversation%20Context%20Strategy%20for%20a%20Retail%20Support%20Copilot/)

Keep a copilot coherent over long conversations without blowing the context window: prune verbose tool output deterministically, maintain a durable case-facts block, compress under a token budget, and assemble the final prompt.

- `01-prune-tool-output/` — Trim a 57-field tool response to the fields the decision needs (no LLM call).
- `02-case-facts-block/` — Maintain a persistent case-facts block.
- `03-compress-with-budget/` — Compress conversation history under a token budget.
- `04-assemble-and-locate/` — Assemble the working prompt and locate context.

### [Build a Multi-Shift Quality Monitoring System with Claude Orchestration](Build%20a%20Multi-Shift%20Quality%20Monitoring%20System%20with%20Claude%20Orchestration/)

Engineer a Layer 3 orchestration system that runs once per 8-hour shift: tiered state to keep each session tiny, an invocation pipeline, crash recovery, and forked scratchpads.

- `01-tiered-state/` — Hot/warm/cold storage tiers (Pydantic + SQLite).
- `02-invocation-pipeline/` — The per-shift invocation pipeline.
- `03-crash-recovery/` — Resume cleanly after a crash.
- `04-fork-scratchpad/` — Fork sub-agent scratchpads.

### [Configure Claude Code for a Multi-Surface Monorepo Team](Configure%20Claude%20Code%20for%20a%20Multi-Surface%20Monorepo%20Team/)

Configure Claude Code for a team working in a multi-surface monorepo: modular `CLAUDE.md` and path-scoped rules, a project-scoped review command, a forked deploy-check skill, and a plan-mode/explore decision doc.

- `01-compose-modular-claude-code-configuration/` — Modular `CLAUDE.md` `@`-imports and path-scoped `.claude/rules/*.md`.
- `02-author-project-scoped-review-command/` — A project-scoped `/review` command.
- `03-author-forked-deploy-check-skill/` — A forked `deploy-check` skill.
- `04-plan-mode-and-explore-decision-doc/` — Plan mode vs. Explore decision doc.

### [Capstone — Harness Engineering with Claude and Claude Code](Project-Harness%20Engineering%20with%20Claude%20and%20Claude%20Code/)

In this capstone, you build, run, and verify the four systems from this course, then write a reflection brief that defends each system's design.

You receive complete reference implementations with full test suites. You do not write code. You:

- Stand each system up
- Run it against its fixtures
- Run its tests
- Capture what it produces
- Explain why it is built that way

The reflection brief's questions require citing your own run output, so generic answers will not pass.

**The four systems**

- **Agentic loop** — processes intake conversations, calls tools to gather and classify, routes or escalates each case. Control flow driven by `stop_reason`.
- **Context strategy** — compresses a long, multi-issue conversation to under half its tokens while still answering evaluation questions.
- **Claude Code config** — a `CLAUDE.md` hierarchy, path-scoped rules, a custom slash command, and a forked-context skill, checked by a validator.
- **Layer 3 orchestrator** — runs as a fresh session per shift, keeps state tiny through tiered storage and SQL pre-filtering, recovers from crashes, supports forked investigations.

**Learning objectives** — by the end of this project, you will be able to:

- Operate a `stop_reason`-driven agentic loop and identify its termination logic and the anti-patterns it avoids
- Engineer a position-aware context strategy that cuts token load while preserving answerability
- Configure a Claude Code harness with a `CLAUDE.md` hierarchy, path-scoped rules, commands, and a forked-context skill
- Implement Layer 3 orchestration with tiered state, crash recovery, and session forking
- Verify each system against its test suite and explain what the tests guarantee
- Defend architectural trade-offs in an evidence-grounded reflection brief

**Deliverables**

- **Evidence** — passing test output for all four systems (30 + 30 + 35 + 33) and the key run artifact from each, one folder per system
- **Reflection brief** — `reflection-brief-template.md`, completed, every answer citing your own run artifacts

**Resources**

- Capstone materials (`Project-Harness Engineering with Claude and Claude Code/`) — `README.md` and `reflection-brief-template.md`
- The four systems — each is the final-exercise `solution/` of its course project:
  - `Build a Claims Intake Agent with a stop_reason-Driven Loop/exercises/03-dynamic-decomposition/solution/`
  - `Engineer a Long-Conversation Context Strategy for a Retail Support Copilot/04-assemble-and-locate/solution/`
  - `Configure Claude Code for a Multi-Surface Monorepo Team/04-plan-mode-and-explore-decision-doc/solution/`
  - `Build a Multi-Shift Quality Monitoring System with Claude Orchestration/04-fork-scratchpad/solution/`

  Each project has its own `README.md`.
- Claude API key (`ANTHROPIC_API_KEY`) — required for three of the four systems.

## Folder layout

Every exercise pairs starter code with a solution and its own instructions. The exact nesting varies slightly by project:

```bash
<project>/
├── <NN-exercise-name>/        # numbered exercise step
│   ├── README.md              # exercise instructions, requirements, verify command
│   ├── starter/               # scaffold with TODO blocks to fill in
│   └── solution/              # reference implementation
```

Project-specific notes:

- **Claims Intake** nests its steps under an `exercises/` folder, and the per-exercise `README.md` lives alongside `starter/` and `solution/`.
- **Multi-Shift** keeps the instructions inside each `starter/README.md` and `solution/README.md` rather than at the exercise root.
- **Long-Conversation Context** and **Monorepo Team** put a `README.md` at the exercise root plus one inside `starter/` and `solution/`.

## Running an exercise

Each exercise's `README.md` is authoritative, but the Python projects follow the same steps — create a virtual environment, install in editable mode with dev extras, then run the scoped verify command:

```bash
cd "<project>/<exercise>/starter"
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
pytest -q   # or the scoped verify command named in the exercise README
```

Expect the starter suite to fail until the `TODO` blocks are resolved; the exercise is complete when the verify command passes cleanly.

**Run the scoped verify command, not a bare `pytest`.** The Claims Intake, Long-Conversation Context, and Monorepo Team projects are *cumulative* — each exercise ships the full project test suite, so tests for later, not-yet-built steps are present from exercise 1. A bare `pytest` (even in a correct intermediate `solution/`) will show those later tests as expected reds. Each exercise README names the exact subset that should pass at that step; only the final exercise of a project goes fully green on a bare `pytest`. (The Multi-Shift project is the exception — each stage is self-contained and passes on its own.)

## License

See [LICENSE.md](LICENSE.md). Educational content © Udacity, Inc., licensed CC BY-NC-ND 4.0 except where noted.

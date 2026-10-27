# Reflection Brief — Harness Engineering Capstone

**Name:**
**Date:** 2026-10-27

Replace each `→` with your answer. **Every answer cites at least one artifact from your own runs** — a run ID, file path, token count, claim outcome, or test count. Uncited answers do not pass. 3–6 sentences each unless noted. Paste short artifact snippets where they help.

**Environment**

- Model(s): `claude-haiku-4-5-20251001` for System 1 (`system1/run-20261027_204259/summary.md`) and System 2 (`retail_context/client.py` default). System 4 replayed a recorded `claude-sonnet-4-6` response (`fixtures/recorded_responses/shift_C_2026-04-30.json`). System 3 makes no API calls. The API was reached through the Udacity Vocareum proxy (`ANTHROPIC_BASE_URL=https://claude.vocareum.com`).
- OS / Python: macOS 15.5 (Apple Silicon); Python 3.11 in a separate `.venv` per system.
- Approx. API spend: ≈ $0.40 total. System 1 accounts for $0.1277 for the 8-claim run plus ≈ $0.05 for diagnostic reruns (`system1/rerun-backstop-claims.txt`, `system1/claim_01-final-text-probe.txt`). System 2 accounts for ≈ $0.20 on Haiku: 23.8k compression input tokens per `budget.json`, plus 8 eval calls of ≈ 16.8k input tokens each per `eval.jsonl` and `eval_control.jsonl`. System 4 ran offline at $0.

**Evidence index**

| Folder | Tests | Key artifacts |
|---|---|---|
| `system1/` | `pytest.txt` — 30 passed | `run-20261027_204259/` (`summary.md`, `traces/`, `queues/*.jsonl`, `escalations.jsonl`), `run-all.txt` |
| `system2/` | `pytest.txt` — 30 passed | `run-20261027-204259/` (`budget.json`, `context.md`, `eval.jsonl`, `eval_control.jsonl`), `run-all.txt` |
| `system3/` | `pytest.txt` — 35 passed | `validator.txt` (`OK`, exit 0), `claude-structure.txt`, `dot-claude/`, `CLAUDE.md` |
| `system4/` | `pytest.txt` — 33 passed | `run-shift-C.txt`, `hot_state.json` (965 B), `shift_scratchpad.*.jsonl`, `fork-demo.txt`, `forks/` |

---

## Part 1 — Per-system

### System 1 — Agentic loop

1. **Loop control.** Quote the `stop_reason` sequence from one trace. Name the file and function that decides continue-vs-stop, and how.
   → In `system1/run-20261027_204259/traces/claim_02_stolen_bike.jsonl` the sequence is `tool_use → tool_use → tool_use → tool_use → end_turn`. Turn 1 is `lookup_policy`, turn 2 is `record_claim_fact` ×N, turn 3 is `classify_claim`/`assess_severity`, turn 4 is `route_to_adjuster`, and turn 5 is the closing `end_turn` (33 output tokens). The decision lives in `claims_intake/loop.py::run()`. It is a `while True:` loop that checks `response.stop_reason` alone. `"end_turn"` returns a `FinalState`. `"tool_use"` runs every `tool_use` block, appends the `tool_result`s and `continue`s. Any other value raises `UnexpectedStopReason`. Across all 8 traces of my run, the only values were 21 × `tool_use` and 8 × `end_turn`, one `end_turn` per claim, so every claim terminated through the `end_turn` branch.

2. **Anti-pattern.** Name one anti-pattern `test_antipatterns.py` checks for. What would break in your run if the loop used it?
   → `test_no_integer_literal_iteration_cap_in_loop` forbids `for _ in range(N)` and `while turn < N` as the stopping rule. The only cap allowed is the config-sourced `Budget` (`--max-input-tokens 500000`, `--max-wall-clock-s 180`). My claims needed anywhere from 2 turns (`claim_01`, `claim_07`) to 5 turns (`claim_02`, `claim_04`, `claim_08`), and the `claim_07` rerun took 6 turns after one clarification (`system1/rerun-backstop-claims.txt`). A hard-coded cap of 5 would have cut that rerun off before `route_to_adjuster` and silently produced an incomplete claim. A cap of 4 would also have truncated three routed claims in the main run. The sibling test `test_no_string_membership_against_text_in_loop` guards a related failure. If the loop stopped on something like `"confirm" in text`, `claim_01`'s final prose ("Before I classify your claim, I need to get an estimate…") could be mis-read as a terminal signal.

3. **Tool design.** Pick two tools with overlapping inputs. How do the descriptions prevent misrouting? What did a structured tool error let the agent do that a generic string would not?
   → `route_to_adjuster` and `escalate_to_human` are both labelled "TERMINAL TOOL" and both end a claim. Their descriptions split on one explicit, mutually exclusive condition: route only when classification "confidence is at least 0.6 and severity has been assessed", and escalate when "confidence is below 0.6 even after clarification" or facts are missing. `route_to_adjuster.queue` is also an enum over the four claim types, so the model cannot invent a queue. In my run every routed claim had a matching `claim_type`: theft→`queues/theft.jsonl`, liability→`liability.jsonl`, auto→`auto.jsonl`, property_damage→`property_damage.jsonl`. Tool errors come back from `tools._err()` as JSON with `error_category`, `is_retryable` and a specific `message`, for example `"classify_claim must be called before routing"` or `"terminal tool already called this claim"`. That message tells the model to call the missing prerequisite and retry, or to stop instead of retrying, which a generic `"error"` string cannot. My traces log tool calls but not results, so I can't prove an error fired in this run. `test_routing_requires_classification_and_severity` and `test_double_terminal_is_graceful_error` pin the behavior instead.

4. **Your numbers.** Quote the turn count and cost for one claim. How does it differ from the README sample, and why?
   → `claim_05_auto_collision` took 4 turns, 15,507 input and 1,041 output tokens, and cost an estimated $0.0207 (`summary.md`). The whole run cost $0.1277 for 4 routed and 4 escalated claims. The exercise README's sample is "7 routed, 1 escalated, ≈ $0.05". My cost is about 2.5× higher because input tokens compound: each turn resends the system prompt, the 7 tool schemas and the growing history (claim_02's per-turn input grew 2761 → 2935 → 3553 → 3920 → 4088). My outcomes also differ. `claim_01`, `claim_03` and `claim_07` were expected to route but were escalated by the deterministic backstop ("model ended its turn without a terminal action", `escalations.jsonl`). `claim_01` stopped at turn 2 and the probe captured its final text: it asked the claimant for a damage estimate in prose instead of calling a tool. That variance is real. Rerunning `claim_07` routed it in 6 turns with 1 clarification (`rerun-backstop-claims.txt`).

### System 2 — Context strategy

5. **The reduction.** From `budget.json`: baseline tokens, assembled tokens, reduction %. Which section dominates the assembled context, and why keep it verbatim?
   → `system2/run-20261027-204259/budget.json` reports baseline 38,708 tokens, assembled 16,775 tokens, and a 56.66% reduction. The counter was `"Anthropic messages.count_tokens endpoint (model-authoritative)"`. The `active` section dominates at 15,789 of 16,775 tokens (≈ 94%). It is the unresolved payment-method update, which the copilot is still working, so exact details matter for the next action: the AVS failure code, the card last-4 digits, and the customer's own wording. A summary could paraphrase `in_progress` or drop a digit, and the next agent turn would act on the wrong fact. `test_assembled_context_active_segment_byte_exact` enforces that this segment is copied byte-for-byte from the transcript.

6. **Summarize vs preserve.** State the rule for what gets summarized vs kept byte-exact, citing your per-section token numbers.
   → Resolved issues are summarized. The live issue is kept byte-exact. Durable identifiers are pulled out into a structured facts block. In my run the refund thread compressed to 368 tokens and the subscription thread to 432; their source segments were 12,334 and 11,475 input tokens to the compressor, about a 30× reduction each. Those threads are closed, so only the outcome and key facts are still useful. The active payment-update segment stays verbatim at 15,789 tokens because it is still being worked. The `case_facts` block (204 tokens) holds the exact tokens no summary may paraphrase, such as `refund_amount_usd: $22.14`, `payment_update_failure_code: AVS_MISMATCH` and `payment_update_status: in_progress`. The rule follows from whether the content can still change and whether an exact value will be asked for.

7. **Facts block.** Compare `eval.jsonl` to `eval_control.jsonl`. Which question regressed, and what does that prove?
   → With case facts, `eval.jsonl` passed 6/6. In the control with case facts stripped, Q1 (refund amount `22.14`) still passed, but **Q6 regressed**. Q6 asks for the exact status token of the payment-method update and expects `in_progress`. The control answer, using 249 output tokens, described "an active issue" instead of producing the token, and `passed: false`. The same regression appeared in my earlier CLI-fallback run (`run-all-cli-fallback-20261027-204015.txt`: "FAIL Q6 … **Active issue**"). Q1's answer survives in the compressed refund summary, but `in_progress` exists as a machine token only in the structured record. That shows the facts block is load-bearing for exact-token recall, which the summaries and even the 15.8k-token verbatim segment did not reliably provide.

### System 3 — Claude Code config

8. **Path-scoped rules.** Quote the glob frontmatter from one rule file. Why is it better than a directory-level CLAUDE.md for cross-cutting conventions?
   → `system3/dot-claude/rules/tests.md`:
   ```yaml
   ---
   description: Conventions for test files (co-located *.test.ts and *.test.tsx)
   paths:
     - "**/*.test.tsx"
     - "**/*.test.ts"
   ---
   ```
   Tests are co-located (`Foo.tsx` next to `Foo.test.tsx`, per `CLAUDE.md`), so test files live in `src/components/`, `src/api/` and `src/db/` alike. No single directory holds them. A directory-level `CLAUDE.md` would have to be copied into every folder, or it would also load for non-test files there. The glob attaches the rule exactly when Claude touches a test file, wherever it sits, and nowhere else. `api.md` (`"src/api/**/*"`) and `react.md` follow the same pattern. `claude-structure.txt` lists all three rule files, and the validator reported `OK` (`validator.txt`, exit 0).

9. **Forked skill.** Quote the `context: fork` and `allowed-tools` lines. What does running forked + read-only buy you? What breaks without it?
   → `system3/dot-claude/skills/deploy-check/SKILL.md`:
   ```yaml
   context: fork
   allowed-tools:
     - Read
     - Grep
     - Glob
     - Bash(git status:*)
     - Bash(git diff:*)
     - Bash(git log:*)
   ```
   With the fork, the deploy check's file reads, diffs and log output stay in a sub-agent's context and only "a single pass/fail summary" comes back. The developer's main session doesn't fill up with hundreds of lines of `git diff`. The read-only allowlist means a pre-deploy check cannot change what it is checking: no Edit/Write and no arbitrary Bash such as `git push` or `rm`. Without the fork, every check would bloat the main context, much as an unsummarized resolved thread would in System 2. Without the allowlist, a "check" that decided to "fix" something would cross from verification into mutation right before a deploy. The validator's `_check_deploy_check_skill` and `tool_allowlist.write_capable_tools` enforce both, and they are part of what my `OK` covers.

10. **Scope.** From the validator output: project-level vs user-level scope. Give one example of each from this config.
    → The validator printed only `OK` (`system3/validator.txt`, exit 0). That `OK` includes `_check_claude_md`, which fails unless `CLAUDE.md` mentions project-level and user-level scope, states that user-level files are not version-controlled, and gives a user-scope example (`distinguishes_project_vs_user_scope`). Project-level example: `./CLAUDE.md` with its `@.claude/standards/*.md` imports, plus `.claude/rules/` and `.claude/commands/review.md`, all committed to git and shared by the team (`claude-structure.txt`). User-level example from the same file: a personal `/morning` summary command or commit-message style under `~/.claude/commands/` or `~/.claude/CLAUDE.md`. These stay on one laptop and never reach teammates. The test is the audience: if the whole team should follow it, it is project scope.

### System 4 — Orchestration

11. **Push work down.** Defects the SQL query returned vs warm-tier total. Name the indexed query. Why does the model never see the full history?
    → With `--since 2026-04-01T00:00:00Z`, the run printed `shift C: 17 new defects` against a warm-tier total of 40 (`system4/run-shift-C.txt`). The query is `WarmStore.defects_since()`: `SELECT * FROM defects WHERE ts > ? ORDER BY ts DESC LIMIT ?`. My `EXPLAIN QUERY PLAN` shows `SEARCH defects USING INDEX idx_defects_ts (ts>?)`, an index range scan rather than a full table scan. The pipeline's `gather_new_defects` is a pure passthrough to SQL (`test_gather_new_defects_has_no_python_side_filtering`). Only the 17 rows, plus the tiny hot state, go into the prompt, and `build_rich_prompt` is capped under 4,000 characters by `test_build_rich_prompt_stays_under_4000_chars`. The history only grows, one shift after another. The database can filter it for nearly nothing, while the model would pay tokens for every row and lose precision as the prompt lengthens. Long-range trends come from the cold tier's monthly summaries instead.

12. **Crash recovery.** The resume-vs-fresh decision and its staleness threshold (`recovery.py`). Why is a fresh start with an injected summary sometimes more reliable than resuming?
    → `recovery.decide()` returns `"fresh"` if the manifest has no steps or is already `complete`. It returns `"resume"` only if the last fsynced step is at most `STALE_RESUME_THRESHOLD_MINUTES = 30` old, otherwise `"fresh"`. Thirty minutes is about 1/16 of an 8-hour shift. Within that window the working set (new defects, hot state) is essentially unchanged. Past it, more defects have landed in the warm tier and the hot state may have been advanced, so replaying the old partial would reason from stale premises. A fresh start re-runs `defects_since` against the current data and injects the manifest's completed findings as a summary. That keeps prior work without trusting a conversation state the world has moved past. I did not simulate a crash in my run. The 33-passed `system4/pytest.txt` includes `test_recovery_decide_truth_table`, `test_threshold_constant_is_30_minutes` and `test_mid_write_read_reveals_prior_complete_lines`, which cover the decision and the torn-write case.

13. **Small state.** Byte size of your `hot_state.json`. Why does the budget matter for a system run once per shift, indefinitely?
    → My `system4/hot_state.json` is **965 bytes**. It holds 17 recent defect hashes, a one-line shift summary, 3 active alerts and 3 threshold statuses, against `HOT_STATE_BYTE_BUDGET = 5_120` and `MAX_RECENT_HASHES = 20`. 324 of those bytes are the 17-entry `recent_defect_hashes` list, which is exactly the field the 20-hash cap bounds. Without the cap, that list would grow with every shift. The system runs three shifts a day with no end date and loads this file into every prompt. Anything that grows by even a few bytes per shift would eventually swamp the context. `_trim_to_budget()` and `write_atomic()`, which raises over budget, cap the file at a hard ceiling. Shift 10,000 then gets the same tiny state as shift 1.

---

## Part 2 — Synthesis

*Graded on connecting two or more systems. Cite a named file/artifact from each.*

14. **Three layers.** Point to a file/artifact for each layer and justify.
    → Model: `system1/run-20261027_204259/traces/claim_02_stolen_bike.jsonl`. Each line is one `messages.create` call and records the model's own decision as `stop_reason` and `tool_calls`. Which tool to call, what to classify, and whether to stop all happen here, and nowhere else is behavior nondeterministic. The `claim_07` rerun flipped from escalated to routed.
    → Harness: `claims_intake/loop.py` together with the System 3 config (`system3/dot-claude/`). The harness is the deterministic code and configuration around the model: the `stop_reason` dispatch, tool execution, the `Budget`, the backstop in `run.py::_escalate_without_terminal`, and in Claude Code the path-scoped rules and the `allowed-tools` allowlist that shape what a session may see and do.
    → Orchestration: `system4/run-shift-C.txt` with `hot_state.json` and `shift_scratchpad.*.jsonl`. Each shift is a fresh session, and continuity across sessions comes from tiered state the orchestrator owns: hot JSON, warm SQLite and cold monthly summaries. The forks in `fork-demo.txt` fan out sub-investigations and merge their findings back (main scratchpad 1 → 3 lines).

15. **Deterministic vs prompt.** Cite one behavior guaranteed in code (terminal tool, read-only allowlist, atomic write, byte budget) and one guided by prompt. When is each right?
    → Guaranteed in code: every System 1 claim ends in exactly one terminal outcome. `run.py::_escalate_without_terminal` force-escalated 4 claims whose model ended without calling a terminal tool (`escalations.jsonl`: `"root_cause": "no terminal tool called before end_turn"`). System 4's `HotState.write_atomic` (temp file, fsync, `os.replace`, byte budget) is the same kind of guarantee. Guided by prompt: the choice to call `request_clarification` instead of asking in prose is only an instruction in `system_prompt.py` ("The claimant's only further input comes via `request_clarification`"). My run showed Haiku ignoring it on `claim_01`, whose final text was "Can you provide an estimate of the repair…". Use code when a violation is unsafe or corrupts state: an unrouted claim, a torn state file, a write during a deploy check. Use prompts for judgment calls that can't be enumerated, such as which question to ask or how to classify. Back every prompt rule with a code backstop for the case where the model drifts.

16. **Context, two faces.** Compare context management in System 2 (intra-session) and System 4 (cross-session) with cited numbers from both. Same principle, different mechanism — how?
    → The shared principle is to give the model only what the next decision needs and to keep exact values exact. Within a session, System 2 cut one conversation from 38,708 to 16,775 tokens (−56.66%). It summarized the closed threads to 368 and 432 tokens, kept the live thread verbatim, and pinned exact tokens in a 204-token facts block. Across sessions, System 4 never carries a conversation forward at all. Each shift starts fresh with a 965-byte `hot_state.json`, and an indexed SQL query selects 17 of 40 warm-tier rows. The mechanisms differ because the problems differ. System 2's data is already inside the window and has to be compressed with an LLM. System 4's data lives outside the window and can be filtered cheaply by a database. In both, a structured, deterministic artifact does the precision work that prose cannot: `case_facts` in System 2, the hot-state schema in System 4.

17. **Reliability you can't see in one run.** Name one behavior a test guarantees that a single successful run would not reveal. Why does it matter before shipping?
    → `test_loop_raises_on_unexpected_stop_reason` in System 1 guarantees that a `max_tokens`, `pause_turn` or `refusal` stop raises `UnexpectedStopReason` instead of being treated as done. My full run never produced one: all 29 trace lines were `tool_use` (21) or `end_turn` (8). No successful run would ever exercise that branch. If it were wrong, a truncated response would quietly look like a finished claim. System 4 has a parallel case in `test_mid_write_read_reveals_prior_complete_lines`, which simulates a crash mid-append, something my clean `run-shift-C.txt` never did. Production will eventually hit both cases, and at scale a rare path is a daily path, so the guarantee has to exist before the first incident.

18. **Blast radius.** Pick one system. What's the blast radius if it misbehaves, and what's the kill switch? Ground it in that system's tools, enforcement points, and state.
    → System 1. Its only side-effecting tools are the two terminal tools. They append to `queues/<type>.jsonl` or `escalations.jsonl` in the run directory, so the worst case is a claim in the wrong adjuster queue or an unnecessary human escalation. No payment or policy change can happen, and `lookup_policy` is read-only. Three enforcement points bound it. The `queue` enum prevents invented destinations. `ClaimSession` allows only one terminal call (`"terminal tool already called this claim"`). The backstop guarantees no claim is left unfinished: 4/8 in my run went to a human rather than nowhere. Cost and runaway loops are bounded by `Budget`, which raises `BudgetExceeded` at 500k input tokens or 180 s per claim. My heaviest claims peaked at 18,144 input tokens (`claim_08`) and 12.3 s (`claim_05`), far inside both caps. The kill switch is to stop the process and drain or re-review `runs/<ts>/queues/*.jsonl`. Because each run writes to its own timestamped directory, a bad run can be quarantined without touching others.

---

## Part 3 — Honest assessment

19. **What broke.** One thing that failed first try in your environment, and how you fixed it. (If nothing, what you checked to be sure.)
    → Three things failed first time. (a) My first System 4 shift printed `shift C: 0 new defects`. The default `--since` is 8 hours before now (2026-10-27), while the fixture defects end on 2026-04-29. I re-seeded and reran with `--since 2026-04-01T00:00:00Z`, which returned 17 (`run-shift-C.txt`). (b) My first System 2 `pytest` was "28 passed, 2 skipped". Two anti-pattern tests skip until a run artifact exists. After `retail_context.run` it was 30 passed. (c) With no `ANTHROPIC_API_KEY` set, System 2 fell back to the `claude` CLI and a `len/3.8` token heuristic (`run-20261027-204015-cli-fallback/budget.json`: baseline 47,144 vs 38,708 from the real counter). I exported the Vocareum key and `ANTHROPIC_BASE_URL` and reran, and I cite the API run. System 1 has no fallback and fails fast in `client.py`.

20. **What you'd change.** One architectural decision you'd make differently, grounded in what you observed.
    → I'd widen System 1's clarification tool. `request_clarification` requires `ambiguity_between` with at least 2 claim types, so it only fits *type* ambiguity. A missing fact, such as `claim_01`'s damage estimate needed for severity, has no tool-shaped outlet. The model asked in prose and ended its turn, and the backstop escalated a claim that should have routed. That happened to 3 of the 7 claims expected to route in `summary.md`, and in my probe `claim_01` did it again. I'd add a `missing_fact` mode (or a separate `request_missing_fact` tool) and record the final assistant text in the trace when the backstop fires. The trace should show *why* the model stopped, not just that it did. That costs one schema change and turns a silent quality loss into a visible, fixable signal.

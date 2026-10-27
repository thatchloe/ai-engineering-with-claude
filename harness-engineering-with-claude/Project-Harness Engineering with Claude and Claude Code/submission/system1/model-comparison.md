# System 1 — Haiku 4.5 vs Sonnet 4.6

Runs: `run-20261027_204259` (claude-haiku-4-5-20251001) vs `run-20261027_222418-sonnet` (claude-sonnet-4-6), same 8 fixtures, same harness.

| claim | haiku outcome | haiku turns | haiku $ | sonnet outcome | sonnet turns | sonnet $ |
|---|---|---|---|---|---|---|
| claim_01_kitchen_fire | escalated | 2 | 0.0086 | escalated | 2 | 0.0255 |
| claim_02_stolen_bike | routed | 5 | 0.0214 | escalated | 2 | 0.0237 |
| claim_03_water_damage | escalated | 3 | 0.0117 | escalated | 2 | 0.0241 |
| claim_04_neighbor_injury | routed | 5 | 0.0216 | routed | 6 | 0.0849 |
| claim_05_auto_collision | routed | 4 | 0.0207 | routed | 5 | 0.073 |
| claim_06_low_confidence_escalation | escalated | 3 | 0.0127 | escalated | 3 | 0.0391 |
| claim_07_tree_falls_on_car | escalated | 2 | 0.0087 | escalated | 3 | 0.0368 |
| claim_08_minor_porch_damage | routed | 5 | 0.0223 | routed | 5 | 0.0716 |

| model | routed | escalated (all via backstop) | total turns | input tok | output tok | est. cost |
|---|---|---|---|---|---|---|
| haiku-4-5 | 4 | 4 | 29 | 99,479 | 5,637 | $0.1277 |
| sonnet-4-6 | 3 | 5 | 28 | 97,798 | 5,689 | $0.3787 |

## Findings

- **Same harness, same failure mode.** Every escalation in both runs came from `run.py::_escalate_without_terminal` (`escalations.jsonl`: `"no terminal tool called before end_turn"`). Neither model ever called `escalate_to_human` itself — even `claim_06`, the one claim *designed* to escalate, reached its expected outcome only via the backstop on both models.
- **Sonnet did not route more claims.** Haiku routed 4/8, Sonnet 3/8. Sonnet lost `claim_02` (routed by Haiku in 5 turns): its trace is `tool_use → end_turn` after only `lookup_policy` + 3× `record_claim_fact`.
- **It is variance, not a capability gap.** Re-running `claim_02` on Sonnet routed it in 6 turns (`claim_02-sonnet-final-text-probe.txt`); the Haiku rerun of `claim_07` likewise flipped to routed (`rerun-backstop-claims.txt`). With n=1 per claim, outcome differences between models are inside run-to-run noise.
- **Cost is ~3× for the same work.** Token volume is nearly identical (97.8k vs 99.5k input, 5.7k vs 5.6k output) and total turns are 28 vs 29, so the 2.97× cost ($0.3787 vs $0.1277) is almost exactly the 3× per-token price ratio in `claims_intake/pricing.py` (Sonnet $3/$15 vs Haiku $1/$5 per MTok).
- **Sonnet's routed claims ran longer** (claim_04: 6 vs 5 turns; claim_05: 5 vs 4) — it gathered more facts before classifying, which raises per-claim cost further.
- **Conclusion.** Upgrading the model did not fix the terminal-tool problem; the fix is in the harness (a `missing_fact` clarification path, see brief Q20). On this workload Haiku is the right default.

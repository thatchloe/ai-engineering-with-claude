# Evidence pack — Evaluation and Observability capstone

Runs made 2026-10-29 on macOS 15.5 / Python 3.13.4 (`environment.txt`). Each system was installed
in its own `.venv` from the final exercise's `solution/` folder and run offline.

| File | What it shows |
|---|---|
| `reflection-brief.md` | Completed brief; every answer cites a file below |
| `perturbation-log.md` | One perturbation per system, with the unperturbed contrast |
| `environment.txt` | OS, Python, package versions, venv setup |
| `oncall-runbook-policy-pipeline.md` | Stand-out extra: 2 a.m. triage note for System 1 |

## 01-policy-pipeline
| File | What it shows |
|---|---|
| `tests.txt` | `45 passed, 3 skipped` (skips are `@pytest.mark.live`) |
| `static-checks.txt` | mypy: no issues in 11 files; ruff: all checks passed |
| `pipeline-run-live-attempt-401.txt` | The live run was attempted; the proxy key returned HTTP 401 |
| `routing-tests-offline-fallback.txt` | Documented no-API fallback: `tests/test_us04_routing.py -v`, 9 passed |
| `pipeline-run-offline.txt`, `offline_routing_run.py` | Offline reconstruction of the post-model stages (real `integration_pass`, `route_extraction`, stratified sampler) over the 10 bundled policies; header states what is real vs scenario input |
| `routing_decisions.json` | 9 routing records: 3 auto_approve / 3 human_review / 3 spot_check, 1 escalation |
| `calibration-report.txt` | Sliced `policy_type × field` report; `umbrella/exclusions conf=0.93 acc=0.00`, overall Brier 0.291 |
| `retry-tests.txt` | `tests/test_us01_retry.py -v`, incl. `missing_source_halts_immediately` |
| `perturbation-blank-premium.txt` | Required field blanked → 1 API call, `RetryFutileEscalation`; contrasts with clean (1 call) and format error (2 calls) |
| `screenshots/` | PNG renders of the captures above |

## 02-mortgage-extraction
| File | What it shows |
|---|---|
| `tests.txt` | `25 passed` |
| `static-checks.txt` | mypy: no issues in 11 files; ruff: all checks passed |
| `extract-run.txt` | `appraisal_informal_sqft.txt` → classified `appraisal`; "approximately 2,400 sq ft" → `2400` |
| `missing-field-run.txt` | `income_missing_bonus.txt` → `income_verification`; `bonus_monthly: null` |
| `discrepancy-run.txt` | `income_sum_mismatch.txt` → `consistent: false`, calculated 9642.17 vs stated 10892.17, delta −1250.0, exit 1 |
| `perturbation-tolerance.txt` | Same extraction, validator tolerance swept; flag flips at exactly $1250 |
| `perturbation-edited-document-replay.txt` | Edited document cannot be replayed (request-hash cache key) |
| `screenshots/` | PNG renders |

## 03-supply-chain
| File | What it shows |
|---|---|
| `tests.txt` | `34 passed` |
| `static-checks.txt` | mypy: no issues in 8 files; ruff: all checks passed |
| `investigation-run.txt`, `briefing.md` | Full `--offline` run; Well-Established / Contested / Incomplete; on-time delivery 95% (audit, 2026-04-10) vs 78% (logistics, 2026-04-05) in Contested |
| `timeout-run.txt`, `briefing-timeout.md` | `--simulate-timeout`: `logistics unavailable (timeout)`, `late_shipment_count` moved to Incomplete, run completes |
| `perturbation-audit-otd-78.txt` | Audit value edited 95 → 78: metric becomes corroborated, Contested is empty |
| `screenshots/` | PNG renders |

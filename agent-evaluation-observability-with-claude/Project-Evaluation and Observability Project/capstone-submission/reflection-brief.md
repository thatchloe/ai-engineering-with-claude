# Reflection Brief — Evaluation and Observability Capstone

**Name:** <your name>
**Date:** 2026-10-29

> Ground every answer in your own run. When a question asks for a number, file name, or line, paste
> it from your artifacts — a reviewer should be able to find it. Answers that are correct in the
> abstract but cite nothing do not meet the bar. Keep it short and specific.

All paths below are relative to `capstone-submission/`.

---

## 0. Environment

| Field | Value |
|---|---|
| OS & version | macOS 15.5 (build 24F74), arm64 — `environment.txt` |
| Python version | Python 3.13.4 — `environment.txt` |
| Date run | 2026-10-29 |
| Ran any system live? (which) | No. The policy pipeline live run was attempted and returned `anthropic.AuthenticationError: Error code: 401 … Invalid bearer token` (`01-policy-pipeline/pipeline-run-live-attempt-401.txt`). The course key is a proxy key that needs the course base URL, which was not available on this machine. All other runs are offline by design (`--mode replay`, `--offline`); System 1 uses the documented offline fallback (`01-policy-pipeline/routing-tests-offline-fallback.txt`) plus an offline reconstruction of the routing stage (`01-policy-pipeline/pipeline-run-offline.txt`, script in `offline_routing_run.py`). **Stated plainly: the policy pipeline did not run end to end, and `routing_decisions.json` is scenario-driven, not model-derived.** The extractor confidences and reviewer verdicts in it are values I wrote into `offline_routing_run.py`; only the validator, integration, routing, sampling and file-writing stages are the real pipeline code. I ask for the no-API fallback to be accepted for this item (see `README.md`, "Status of the System 1 live run"). |

---

## 1. Validated, routed pipeline

| Evidence | Value |
|---|---|
| Passing test count | `45 passed, 3 skipped in 0.17s` — `01-policy-pipeline/tests.txt` (the 3 skips are `@pytest.mark.live`); mypy `Success: no issues found in 11 source files`, ruff `All checks passed!` — `static-checks.txt` |
| Routing output file | `01-policy-pipeline/routing_decisions.json` (9 records, written by `write_routing_decisions`; produced by `offline_routing_run.py`, which runs the real `integration_pass → route_extraction → apply_stratified_spot_check` stages over the 10 bundled policies with `spot_check_pct=0.2, seed=42`). **Scenario-driven, not model-derived**: the per-field confidences and the reviewer verdicts fed into those stages are inputs I chose, because the live `policy-extractor pipeline` command could not authenticate (`pipeline-run-live-attempt-401.txt`). |
| auto_approve / human_review / spot_check counts | 3 / 3 / 3 (plus `"escalations": 1`, POL-2025-009) — `pipeline-run-offline.txt` |

**1a. Retry boundary.** From your perturbation run (a required field removed), paste the escalation
record. How many API calls did the system make, and why is retrying a futile case worse than
escalating it?

> From `01-policy-pipeline/perturbation-blank-premium.txt`, after blanking `Total Policy Premium … $ 1,847.62` on line 16 of a copy of POL-2025-001:
> ```
> api_calls=1  result=RetryFutileEscalation
> { "policy_id": "POL-2025-001", "field": "premium_amount", "category": "missing_source",
>   "detected_pattern": "premium_amount_absent",
>   "reason": "Field 'premium_amount' returned null — the source document does not contain this information. Retry is futile; escalate to human review." }
> ```
> Exactly **one** API call, even though `max_retries=3` and four more responses were queued. Retrying is worse than escalating because the error feedback loop can only fix what the *model* got wrong (block C in the same capture: a negative premium is a `format` error, the loop appends the error and succeeds on call 2, `retry_count=1`). When the *document* lacks the value, every retry re-reads the same text; the only ways the loop can "succeed" are by burning three more calls to reach the same null, or by pressuring the model into inventing a premium that passes the validator. Escalating on the first `missing_source` costs one call and keeps a fabricated number out of the record.

**1b. Reading the router.** Pick one `human_review` record from your routing output. Which of the
three signals (confidence, reviewer, integration) sent it to a human? If you had trusted the model's
confidence alone, what would have happened?

> `01-policy-pipeline/routing_decisions.json`, record `POL-2025-006` (umbrella):
> ```
> "decision": "human_review", "reason": "reviewer_disagreement=['exclusions']",
> "fields_below_threshold": [], "integration_failures": [], "reviewer_disagreements": ["exclusions"],
> "confidence_summary": { "exclusions": 0.93, "policy_type": 0.97, "premium_amount": 0.96, … }
> ```
> **What is real and what is not.** This record is scenario-driven, not model-derived. The live pipeline never ran (`pipeline-run-live-attempt-401.txt`), so the confidence values (`exclusions: 0.93` and the rest) and the reviewer verdict were written by me into `offline_routing_run.py`: `SCENARIO["POL-2025-006"] = "reviewer_disagrees"`, which builds the review as `_agree` on every field except `_disagree("exclusions")`. No extractor or reviewer model produced that disagreement. What *is* real is what the pipeline did with that input: `route_extraction` returned `decision="human_review"` with `reason="reviewer_disagreement=['exclusions']"`, empty `fields_below_threshold` and `integration_failures`, and `write_routing_decisions` wrote the record above. So the record demonstrates the routing rule, not an observed disagreement between two models.
> **Which signal.** The **reviewer** signal, carried in the `reviewer_disagreements` field. Confidence was clear (every field at or above the 0.90 threshold, so `fields_below_threshold` is empty) and both integration checks passed, so the reviewer disagreement is the only thing that sent it to a human.
> **Confidence alone.** With the 0.90 threshold as the only gate, the same input would have been `auto_approve` (and eligible for the stratified spot check), so an exclusions list the reviewer rejected would have shipped. Routing is `confidence ∧ reviewer ∧ integration`; any one failing signal stops an auto-approve. The real-code evidence for this is the fallback test `test_ac_04_06_high_confidence_plus_reviewer_disagreement_still_routes_to_human_review PASSED` in `routing-tests-offline-fallback.txt`, which feeds exactly this combination (all confidences high, one reviewer disagreement) into `route_extraction`.
> The other two human-review records are scenario-driven in the same way: POL-2025-008 (`fields_below_threshold=['policy_type']`) because I set that confidence to 0.62 to reflect the manifest's `other` catch-all type, and POL-2025-010 (`integration_failure=['premium_matches_components_sum']`) where the failure itself is real `integration_pass` logic over the manifest's premium components (2350.0 vs stated 2400.0) but the confidences are mine. I ask for the no-API fallback to be accepted for this item; `run-live-pipeline.sh` at the project root reproduces the live sequence once the course proxy values are available.

**1c. Where the aggregate lies.** Run the calibration snippet. Quote the one cell whose accuracy lags
its confidence, plus the overall figure. What does slicing by `policy_type × field` catch that a
single number hides?

> `01-policy-pipeline/calibration-report.txt`:
> ```
> auto      premium_amount  n=3 conf=0.95 acc=1.00 brier=0.003
> home      deductible      n=1 conf=0.90 acc=1.00 brier=0.010
> umbrella  exclusions      n=2 conf=0.93 acc=0.00 brier=0.865
> OVERALL brier=0.291
> ```
> The `umbrella / exclusions` cell is wrong every time (`acc=0.00`) while claiming `conf=0.93`. The overall Brier of 0.291 is pulled down by the four correct, well-calibrated labels, so it reads as "mediocre but usable". Slicing exposes that the miscalibration is not spread evenly: one specific document type × field is confidently wrong, which is exactly the case where a single confidence threshold (0.90) would auto-approve bad data. The slice tells you *where* to lower the threshold, add a reviewer check, or fix the prompt; the aggregate only tells you something is off somewhere.
> Note on provenance: these labels are the fixed set shipped in the provided `calibration_report.py` (run with the project venv, real `calibration_report` code), not labels harvested from my routing run. The `exclusions: 0.93` on POL-2025-006 in `routing_decisions.json` was chosen by me to mirror this cell, so the two figures agree by construction, not by observation.

---

## 2. Schema-enforced two-pass extraction

| Evidence | Value |
|---|---|
| Passing test count | `25 passed in 1.83s` — `02-mortgage-extraction/tests.txt`; mypy `Success: no issues found in 11 source files`, ruff `All checks passed!` — `static-checks.txt` |
| Document run | `fixtures/documents/appraisal_informal_sqft.txt` — `02-mortgage-extraction/extract-run.txt` (also `missing-field-run.txt`, `discrepancy-run.txt`) |
| Classified type | `classify: model=claude-haiku-4-5 … type=appraisal` then `extract: … tool=extract_appraisal` (from the `--verbose` log lines in `extract-run.txt`); the two pay stubs classify as `type=income_verification` |

**2a. Two guarantees.** Paste your discrepancy-run output. Tool use already forces valid JSON, yet the
validator still catches a bad sum. Why are these two different guarantees? Name one error each cannot
catch.

> `02-mortgage-extraction/discrepancy-run.txt` (`income_sum_mismatch.txt`):
> ```
> "income": { "base_monthly": 5416.67, "bonus_monthly": 1250.0, "commission_monthly": 2140.0,
>             "overtime_monthly": 385.5, "other_monthly": 450.0, "stated_monthly_total": 10892.17 }
> "validation": { "consistent": false,
>   "discrepancies": [ { "field": "total_monthly_income", "calculated": 9642.17,
>                        "stated": 10892.17, "delta": -1250.0 } ] }
> [exit code: 1]
> ```
> Forced tool use (`tool_choice={"type":"tool", …}` plus the JSON Schema) guarantees the *shape*: every key exists, numbers are numbers, enums are legal. The validator guarantees a *relationship between values*: the line items must sum to the stated total within $1. These are independent because the schema is checked per field and cannot express "field A equals the sum of B..F". What the schema cannot catch: a syntactically perfect record whose numbers are wrong, exactly this run (every field validates, yet the stated total overstates income by $1,250). What the validator cannot catch: an error that leaves the arithmetic intact, e.g. the model reading the wrong borrower's name or misclassifying `property_type` — `full_name` is a string the sum check never looks at, and the perturbation in `perturbation-tolerance.txt` shows the sum check itself is only as good as its tolerance (at `tolerance=1250.0` the same record becomes `consistent=True`).

**2b. Refusing to fabricate.** Run on a document missing a field. Paste that field's output. Why null
instead of an invented value? Point to the schema choice that allows it.

> `02-mortgage-extraction/missing-field-run.txt` (`income_missing_bonus.txt`, classified `income_verification`):
> ```
> "income": { "base_monthly": 5673.08, "bonus_monthly": null, "bonus_ytd": null,
>             "commission_monthly": null, …, "stated_monthly_total": null }
> "validation": { "consistent": true, "discrepancies": [] }
> ```
> The pay stub lists only Regular Salary, Holiday Pay and PTO; there is no bonus line at all, so `bonus_monthly: null` is the truthful answer. A fabricated `0.0` would assert "the document says the bonus is zero", which underwriting would treat as verified income data; `null` says "the document is silent", which routes the question to a human or another document. The schema allows this through the union-type idiom in `mortgage_extractor/schema.py`: the module docstring (lines 7–8) states nullable fields use `type: ["<base>", "null"]` "so the model can return null for absent fields rather than fabricating values", and the income block declares `"bonus_monthly": {"type": ["number", "null"]}`. The system prompt in `prompts.py` line 26 reinforces it: "Return null for any field not explicitly stated in the document. Do not infer, default, or fabricate." Without the `null` branch the forced tool call would have to put *some* number in the slot.

**2c. Normalization.** Quote one field where the source text and extracted value differ in format
("about 2,400 sq ft" → `2400`). Why normalize at extraction time rather than downstream?

> Source line in `appraisal_informal_sqft.txt`: `Gross Living Area:   approximately 2,400 sq ft (above-grade finished)`. Extracted in `02-mortgage-extraction/extract-run.txt`: `"gross_living_area_sqft": 2400` (and `"appraised_value": 410000.0` from `$ 410,000`). The schema declares the field `{"type": ["integer", "null"]}`, so the model has to commit to a number while it still has the context to resolve "approximately", the thousands separator and the unit. Downstream code would receive the string and have to re-parse it with regexes for every phrasing (`~2,400`, `2400 sf`, `2.4k`), and would have lost the surrounding text that disambiguates it. Normalizing at extraction also makes the validator and the consistency checks possible at all: `calculated 9642.17` in 2a is a sum over fields that are already floats.

---

## 3. Multi-source synthesis

| Evidence | Value |
|---|---|
| Passing test count | `34 passed in 45.53s` — `03-supply-chain/tests.txt`; mypy `Success: no issues found in 8 source files`, ruff `All checks passed!` — `static-checks.txt` |
| Briefing file | `03-supply-chain/briefing.md` (extracted from `investigation-run.txt`); timeout variant `briefing-timeout.md` (from `timeout-run.txt`) |
| Section the conflict landed in | `## Contested` — `on_time_delivery_rate  _[2 sources, conflicting]_  ⚠️ ESCALATE` |

**3a. Annotate, don't arbitrate.** Quote one conflicting-metric pair from your briefing — both values,
sources, dates. Give one way a reader is better served by the preserved conflict than by a single
reconciled number.

> `03-supply-chain/briefing.md`, Contested section:
> ```
> ### on_time_delivery_rate  _[2 sources, conflicting]_  ⚠️ ESCALATE
> - escalation: high-impact metric is contested across sources
>     - 95.0 percent — supplier_audit (as of 2026-04-10)
>     - 78.0 percent — logistics (as of 2026-04-05)
> ```
> A reconciled number (say the mean, 86.5%, or "trust the newer one", 95%) would hide the most important fact: the *supplier's own audit* says 95% while *our* logistics records of 11 late shipments (`late_shipment_count 11.0 shipments — logistics`) say 78%. A reader who sees both values with their sources can act on the disagreement itself, e.g. ask the supplier how it counts "on time", or weight the internal data for a risk decision. The perturbation in `perturbation-audit-otd-78.txt` shows the briefing only drops the escalation when the sources actually agree (both 78.0 → `corroborated across 2 sources`, `## Contested _none_`).

**3b. Source goes dark.** Run with `--simulate-timeout`. Paste the part of the briefing showing the
failed source. How is "unreachable" handled differently from "nothing to report," and why does the run
still finish?

> `03-supply-chain/briefing-timeout.md`:
> ```
> > Sources unavailable: logistics unavailable (timeout)
> …
> ## Incomplete
> ### late_shipment_count  _[missing source: timeout reading logistics]_
> - missing source: timeout reading logistics
> ### production_capacity_utilization  _[missing source: no source reported this metric]_  ⚠️ ESCALATE
> - escalation: high-impact metric has no usable source
> ```
> Both land in Incomplete but with different reasons: `timeout reading logistics` means a source exists and was unreachable (re-run later and it will fill in), whereas `no source reported this metric` means no source carries the data at all, which is the structural gap worth escalating. The timeout also demotes `on_time_delivery_rate` and `average_lead_time_days` from two sources to `_[single source only]_` instead of letting the audit's 95% read as uncontested fact. The run finishes because the coordinator treats the logistics reader's timeout as a result ("unavailable") rather than an exception that aborts the investigation: the other three readers' claims are still synthesized and the header banner records what is missing.

**3c. Dates as a guardrail.** Quote two claims about the same supplier with different dates. How does
requiring a date stop a time difference from reading as a contradiction?

> `03-supply-chain/briefing.md`, Well-Established:
> ```
> ### defect_rate_ppm  _[corroborated across 2 sources]_
>     - 180.0 ppm — supplier_audit (as of 2026-04-10)
>     - 190.0 ppm — internal_quality (as of 2026-04-08)
> ```
> Two different numbers from two different dates, yet the briefing files them as corroborating, not contested, and the reader can see why: the values sit within tolerance and the two-day gap between an internal quality snapshot and the audit report is enough to explain a 10 ppm drift. Because every `Claim` carries an `as_of` date, a change over time (a metric measured on 04-05 vs 04-10) is visible as a change over time instead of being flattened into "source A says X, source B says Y, someone is wrong". Without the date the same pair would be indistinguishable from the genuine on-time-delivery conflict in 3a.

---

## 4. Synthesis

**4a. One principle.** Name the single moment in your runs (system + artifact) where *evaluate the
output, don't trust the model's word* most clearly caught something a trusting design would have
shipped.

> System 2, `02-mortgage-extraction/discrepancy-run.txt`. The model returned a perfectly schema-valid income record with `"stated_monthly_total": 10892.17`, and nothing about the response signalled a problem. Only the validator's independent arithmetic (`"calculated": 9642.17`, `"delta": -1250.0`) exposed that the stated total overstates income by exactly the bonus line, and the CLI exited `1` instead of `0`. A design that trusted a well-formed tool call would have passed $10,892/month to underwriting.

**4b. Confidence ≠ correctness.** Pick the system where this mattered most, and explain why using
something you observed.

> System 1. In `01-policy-pipeline/calibration-report.txt` the `umbrella / exclusions` cell reports `conf=0.93` with `acc=0.00`: the model is most wrong exactly where it is confident, and the overall `brier=0.291` would not have told me which slice to distrust. The routing output applies the lesson: `POL-2025-006` in `routing_decisions.json` carries `exclusions: 0.93`, above the 0.90 threshold, and is still routed `human_review` because the reviewer input disagreed. As stated in 1b, that confidence and that disagreement are scenario inputs I wrote (the live run did not authenticate); the routing decision made from them is real pipeline logic. The model's self-rating is one input to a deterministic rule, not the gate.

**4c. Apply it.** Describe a real workflow where an LLM pulls structured results from messy input.
Which pattern — validated retry with escalation, independent review with deterministic routing, or
provenance-preserving conflict annotation — would you reach for first, and what would you instrument
to know when it broke?

> Workflow: extracting line items, totals, PO numbers and dates from scanned vendor invoices and packing slips into an accounts-payable system. I would reach first for **validated retry with escalation** (System 1's pattern), because invoices have hard arithmetic and required-field rules that a validator can check deterministically: line items must sum to the subtotal, tax must match the rate, a PO number must exist. Format and consistency errors retry with the error appended; a missing PO number is `missing_source` and goes to a clerk after one call, exactly like `premium_amount_absent` in `perturbation-blank-premium.txt`. Instrumentation, taken from what I saw break or nearly break in these runs: (1) the per-run `pattern_summary` frequency table (`pipeline-run-offline.txt` shows `endorsements_absent: count 1`) with an alert when any `detected_pattern` rate jumps, which is how you notice a vendor changed its template; (2) the calibration report sliced by `vendor × field`, re-computed weekly from the spot-check labels, alerting on any cell whose `observed_accuracy` falls more than 0.1 below its `mean_predicted_confidence` (the `umbrella / exclusions` failure mode); (3) a replay/live drift check: re-run a fixed set of recorded invoices live and diff against the recorded extractions, since replay fidelity is tied to the request hash (`No recorded response for key f2dac1d89cb945e2` in `perturbation-edited-document-replay.txt`) and model updates will silently change outputs. If I later add a second data source (e.g. the vendor portal's shipment data), the supply-chain pattern of keeping both values with source and date applies instead of overwriting one with the other.

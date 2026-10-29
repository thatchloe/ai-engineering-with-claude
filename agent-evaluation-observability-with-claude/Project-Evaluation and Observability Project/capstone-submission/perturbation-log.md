# Perturbation Log

For each system, make one deliberate change to an input or configuration, predict the outcome, run
it, and record what actually happened. See the starters in the Instructions, or design your own (your
own experiment earns more credit).

All captures referenced below live in `capstone-submission/`. Each system was run from its own
`.venv` inside the final exercise's `solution/` folder (see `environment.txt`).

---

### System 1 — validated, routed pipeline

- **Change I made (file + what I changed):** Copied `data/policies/POL-2025-001.txt` and replaced
  the only premium figure on line 16, `Total Policy Premium ... $ 1,847.62`, with
  `(see billing notice)`, so the required `premium_amount` field is genuinely absent from the
  source. The diff is at the top of `01-policy-pipeline/perturbation-blank-premium.txt`.
  Because this machine has no working API key (the live run returned HTTP 401, see
  `01-policy-pipeline/pipeline-run-live-attempt-401.txt`), the model's reply was supplied through the
  test suite's `RecordedClient` the same way `tests/test_us01_retry.py` does it: a faithful
  extractor returns `premium_amount: null` for a field the document no longer contains. Four extra
  "successful" replies were queued behind it so that, *if* the loop retried, the extra calls would be
  consumed and counted.
- **Command I ran:**
  `PYTHONPATH=. .venv/bin/python perturb_retry.py <copy with premium blanked>`
  (script saved as `01-policy-pipeline/perturbation-blank-premium.txt` header; also
  `.venv/bin/pytest tests/test_us01_retry.py -v` → `01-policy-pipeline/retry-tests.txt`)
- **What I predicted:** the validator classifies the null as `missing_source`, the loop stops after
  the first call and returns a `RetryFutileEscalation` instead of retrying up to `max_retries=3`.
- **What actually happened (paste the key output line):**
  ```
  --- B. PERTURBED copy, premium line blanked -> model returns premium_amount=null ---
  api_calls=1  result=RetryFutileEscalation
    "field": "premium_amount",
    "category": "missing_source",
    "detected_pattern": "premium_amount_absent",
  ```
  The matching test is `test_ac_01_04_missing_source_halts_immediately PASSED` in `retry-tests.txt`
  (13 passed, 1 live test skipped).
- **How this differs from the unperturbed run:** On the untouched document (block A in the same
  capture) the result is `api_calls=1  result=PolicyExtraction premium_amount=1847.62 retry_count=0`.
  A *recoverable* failure behaves differently again (block C): a negative premium is a `format`
  error, so the loop appends the error to the prompt and calls again:
  `api_calls=2  result=PolicyExtraction premium_amount=1847.62 retry_count=1 validation_history=['negative_premium']`.
  So the retry budget is spent only on errors the model can fix; a missing source value costs
  exactly one call and goes straight to a human.

---

### System 2 — schema-enforced two-pass extraction

- **Change I made (file + what I changed):** Kept the input (`fixtures/documents/income_sum_mismatch.txt`)
  and the recorded extraction identical, and changed the validator **configuration**: the
  `tolerance` argument of `mortgage_extractor.validator.validate` (default `DEFAULT_TOLERANCE_USD = 1.0`)
  was swept over 1.0, 1249.99, 1250.0 and 2000.0. I also tried editing the document itself
  (`TOTAL MONTHLY EARNINGS 10,892.17 → 9,642.17`) to show what replay mode does with a changed input.
- **Command I ran:**
  `.venv/bin/python perturb_tolerance.py fixtures/documents/income_sum_mismatch.txt`
  → `02-mortgage-extraction/perturbation-tolerance.txt`;
  `.venv/bin/mortgage-extract <edited copy> --mode replay` → `02-mortgage-extraction/perturbation-edited-document-replay.txt`
- **What I predicted:** the discrepancy (`delta = -1250.0`, the whole bonus line) is flagged at the
  $1 default and disappears once the tolerance reaches $1250; the edited document cannot be
  replayed because the cache key is a hash of the request payload.
- **What actually happened (paste the key output line):**
  ```
  tolerance=     1.0: consistent=False discrepancies=[{"field": "total_monthly_income", "calculated": 9642.17, "stated": 10892.17, "delta": -1250.0}]
  tolerance= 1249.99: consistent=False ...
  tolerance=  1250.0: consistent=True discrepancies=[]
  tolerance=  2000.0: consistent=True discrepancies=[]
  ```
  and for the edited document:
  `FileNotFoundError: No recorded response for key f2dac1d89cb945e2 (mode=replay)` with exit code 1.
- **How this differs from the unperturbed run:** The unperturbed CLI run
  (`02-mortgage-extraction/discrepancy-run.txt`) reports `"consistent": false` with the same
  `calculated 9642.17 / stated 10892.17 / delta -1250.0` record and exits with code 1. The
  perturbation shows the safeguard is a deliberate threshold, not a property of the model output:
  the extraction never changed, only the tolerance did, and a tolerance wider than the missing line
  item silently turns a $1,250/month income overstatement into a "clean" document. The replay
  failure shows the second guarantee of the design: a recorded response is bound to the exact
  request, so an edited document can never be served a stale answer.

---

### System 3 — multi-source synthesis

- **Change I made (file + what I changed):** Copied `data/meridian/` to a scratch folder and edited
  `audit.json`: the `on_time_delivery_rate` metric's `value` 95 → 78 (and `95%` → `78%` in its
  statement), so the supplier audit now agrees with the logistics feed instead of contradicting it.
  Nothing else changed; `--offline` still replays the recorded news extraction.
- **Command I ran:**
  `.venv/bin/supply-chain-investigate meridian --offline --data-root <scratch copy>`
  → `03-supply-chain/perturbation-audit-otd-78.txt`
- **What I predicted:** `on_time_delivery_rate` leaves the Contested section, lands in
  Well-Established as corroborated, and the `⚠️ ESCALATE` flag for a contested high-impact metric
  disappears; everything else in the briefing is unchanged.
- **What actually happened (paste the key output line):**
  ```
  ### on_time_delivery_rate  _[corroborated across 2 sources]_
      - 78.0 percent — supplier_audit (as of 2026-04-10)
      - 78.0 percent — logistics (as of 2026-04-05)
  ## Contested
  _none_
  ```
- **How this differs from the unperturbed run:** In `03-supply-chain/briefing.md` the same metric
  sits under `## Contested` as `_[2 sources, conflicting]_  ⚠️ ESCALATE` with
  `95.0 percent — supplier_audit (as of 2026-04-10)` and `78.0 percent — logistics (as of 2026-04-05)`
  and the reason `high-impact metric is contested across sources`. The section a claim lands in is
  therefore computed from source agreement, not hard-coded per metric: change one source's number
  and the briefing re-sorts itself. The Incomplete section
  (`production_capacity_utilization — no source reported this metric`) is identical in both runs,
  confirming the perturbation touched only the metric I edited. The provided starter
  (`--simulate-timeout`, captured in `03-supply-chain/timeout-run.txt`) is a second perturbation: the
  logistics source is marked `unavailable (timeout)` and `late_shipment_count` moves to Incomplete
  with the reason `timeout reading logistics` while the run still completes.

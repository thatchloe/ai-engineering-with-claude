# On-call note — policy extraction pipeline (System 1)

**Who this is for:** the teammate paged at 2 a.m. because the nightly `policy-extractor pipeline`
run looks wrong. Half a page; everything here is verifiable from `routing_decisions.json` and the
run's JSON summary.

## What a healthy run looks like
- The summary prints `decisions_written == policies − escalations`; `escalations` is small and
  every one has a `missing_source` pattern in `pattern_summary` (e.g. `endorsements_absent`).
- `spot_check` is never 0 when `auto_approve` > 0 — the stratified sampler promotes at least one
  record per `policy_type`. Zero spot-checks with auto-approves means the sampler was bypassed.
- `human_review` records each carry a non-empty `reason` naming one of exactly three signals:
  `fields_below_threshold=…`, `reviewer_disagreement=…`, `integration_failure=…`.

## Check first, in this order
1. **`escalations` spiked?** Open `pattern_summary`. One new `detected_pattern` across many policies
   (e.g. `premium_amount_absent` on every doc from one carrier) means the *input* changed (new
   template, OCR failure), not the model. Hold the batch; do not raise `max_retries` — retries do
   not help `missing_source` (one call, then escalate, by design).
2. **`human_review` spiked?** Group by `reason`. `integration_failure` → a deterministic check is
   failing, look at the document first. `reviewer_disagreement` on one field → the extractor or the
   reviewer prompt drifted; compare both against the source. `fields_below_threshold` → model
   confidence dropped; check whether the model version changed.
3. **`auto_approve` suspiciously high?** This is the dangerous quiet failure. Pull the last
   calibration report sliced by `policy_type × field`. A cell with high `mean_predicted_confidence`
   and low `observed_accuracy` (last seen: `umbrella / exclusions conf=0.93 acc=0.00`) means the
   model is confidently wrong and the 0.90 threshold is letting it through.

## Which signal lies
- **Model confidence lies.** It is one of three routing inputs, never the gate. Do not "fix" a
  backlog by raising the threshold, and do not trust an `auto_approve` because `confidence_summary`
  is all ≥ 0.9; the spot-check sample exists to catch exactly that.
- **The overall Brier score lies by averaging.** Always read the sliced cells.
- **Retry count does not lie.** `retry_count > 0` on a success is a format/consistency fix, fine.
  A `RetryFutileEscalation` after exactly one call is the loop working, not a bug.

## Do not
- Do not re-run escalated policies hoping for a different answer; the document is missing data.
- Do not edit `routing_decisions.json` by hand; re-run with `--seed` to reproduce the same sample.

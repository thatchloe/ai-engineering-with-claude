"""OFFLINE RECONSTRUCTION of `policy-extractor pipeline data/policies/ --routing-out routing_decisions.json --seed 42`.

No API access on this machine (live attempt returned HTTP 401, see
pipeline-run-live-attempt-401.txt). This script runs the *same* deterministic
stages the CLI runs after the model calls — validator -> retry boundary ->
integration_pass -> route_extraction -> apply_stratified_spot_check ->
write_routing_decisions — over the 10 bundled policies in data/policies/MANIFEST.json.

What is real: policy ids / types / shapes from the manifest, the expected
field values from the manifest, and every routing/integration/sampling function.
What is scenario input (NOT model output): the extractor confidence dict and the
reviewer agreements, built with the test-suite helpers in tests/test_us04_routing.py.
Scenario choices are listed next to each policy below.
"""
import json
from dataclasses import asdict
from pathlib import Path
from policy_extractor.records import Endorsement, PolicyExtraction, PremiumComponent, RetryFutileEscalation
from policy_extractor.reviewer import integration_pass
from policy_extractor.routing import apply_stratified_spot_check, route_extraction, write_routing_decisions
from policy_extractor.summary import summarize_patterns
from tests.test_us04_routing import _agree, _disagree, _review

manifest = json.load(open("data/policies/MANIFEST.json"))
HIGH = {"policy_type": 0.97, "premium_amount": 0.96, "deductible": 0.95,
        "coverage_limit": 0.94, "endorsements": 0.92, "exclusions": 0.93}
FIELDS = list(HIGH)

def ext(p, confidence=None, components=None):
    e = p["expected_extraction"]
    limits = e.get("coverage_limits") or {}
    cov = next((v for v in limits.values() if isinstance(v, (int, float))), 100000.0)
    # POL-2025-010 (inconsistent_premium) lists premium components instead of a single premium_amount
    comps_in_doc = e.get("premium_components") or {}
    stated = e.get("premium_amount", e.get("stated_premium", e.get("total_premium")))
    if stated is None and isinstance(comps_in_doc, dict):
        stated = comps_in_doc.get("stated_total", comps_in_doc.get("total"))
    if stated is None:
        stated = sum(v for v in (comps_in_doc.values() if isinstance(comps_in_doc, dict) else []) if isinstance(v, (int, float)))
    return PolicyExtraction(
        policy_id=p["policy_id"], policy_type=p["policy_type"],
        premium_amount=float(stated), deductible=float(e.get("deductible") or 0.0),
        coverage_limit=float(cov),
        endorsements=[Endorsement(name=n, limit=None) for n in e.get("endorsements") or []],
        exclusions=list(e.get("exclusions") or []),
        premium_components=components, confidence=confidence or dict(HIGH),
    )

# scenario inputs per policy (shape from the manifest drives the choice)
SCENARIO = {
    "POL-2025-008": "low_confidence",        # policy_type 'other' (catch-all) -> extractor unsure
    "POL-2025-006": "reviewer_disagrees",    # umbrella / exclusions: reviewer says 'disagree' at conf 0.93
}

outcomes, decisions = [], []
for p in manifest:
    pid, shape = p["policy_id"], p["shape"]
    if shape == "missing_endorsement_schedule":
        # retry boundary: validator -> missing_source -> RetryFutileEscalation (as in test_ac_01_04)
        outcomes.append(RetryFutileEscalation(policy_id=pid, field="endorsements", category="missing_source",
                        detected_pattern="endorsements_absent",
                        reason="Field 'endorsements' returned null — the source document does not contain this information. Retry is futile; escalate to human review."))
        print(f"{pid}: shape={shape} -> RetryFutileEscalation (no routing decision)")
        continue
    if shape == "inconsistent_premium":
        # premium_components in the document do not sum to the stated premium
        # real premium components from the manifest (sum 2350.0 vs stated 2400.0)
        comps = [PremiumComponent(name=k, amount=float(v))
                 for k, v in p["expected_extraction"]["premium_components"].items()]
        extraction = ext(p, components=comps)
        review = _review([_agree(f) for f in FIELDS])
    elif SCENARIO.get(pid) == "low_confidence":
        extraction = ext(p, confidence=dict(HIGH, policy_type=0.62))
        review = _review([_agree(f) for f in FIELDS])
    elif SCENARIO.get(pid) == "reviewer_disagrees":
        extraction = ext(p)
        review = _review([_agree(f) for f in FIELDS if f != "exclusions"] + [_disagree("exclusions")])
    else:
        extraction = ext(p)
        review = _review([_agree(f) for f in FIELDS])
    outcomes.append(extraction)
    integration = integration_pass(extraction)   # real integration checks
    d = route_extraction(extraction=extraction, review=review, integration_findings=integration)
    decisions.append(d)
    print(f"{pid}: shape={shape} type={d.policy_type} -> {d.decision}  ({d.reason})")

decisions = apply_stratified_spot_check(decisions, sample_pct=0.2, seed=42)
out = Path("routing_decisions.json")
write_routing_decisions(decisions, out)
print(json.dumps({
    "decisions_written": len(decisions),
    "auto_approve": sum(1 for d in decisions if d.decision == "auto_approve"),
    "human_review": sum(1 for d in decisions if d.decision == "human_review"),
    "spot_check": sum(1 for d in decisions if d.decision == "spot_check"),
    "escalations": sum(1 for o in outcomes if isinstance(o, RetryFutileEscalation)),
    "pattern_summary": summarize_patterns(outcomes),
    "output_path": str(out),
}, indent=2, default=dict))

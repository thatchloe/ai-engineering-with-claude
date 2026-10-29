#!/usr/bin/env bash
# Live end-to-end run of System 1 (policy pipeline) for the evidence pack.
#
# The course key is a Vocareum proxy key; it only works against the course proxy, so BOTH
# values from the course workspace must be exported first (the key is never written to disk here):
#
#   export ANTHROPIC_BASE_URL=<course proxy base URL>
#   export ANTHROPIC_API_KEY=<course key>
#   ./run-live-pipeline.sh
#
# The Anthropic SDK (2.3.0) picks both up automatically; policy_extractor/__main__.py builds the
# client with Anthropic() and no overrides.  This script then does exactly what the reviewer asked:
#   1. policy-extractor pipeline data/policies/ --routing-out routing_decisions.json --seed 42 | tee pipeline-run.txt
#   2. copy the generated routing_decisions.json into the evidence pack
#   3. re-run calibration_report.py and save calibration-report.txt
#   4. print the human_review records so reflection 1b can quote one
set -euo pipefail
: "${ANTHROPIC_API_KEY:?export ANTHROPIC_API_KEY (the course key) first}"
: "${ANTHROPIC_BASE_URL:?export ANTHROPIC_BASE_URL (the course proxy base URL) first}"

HERE="$(cd "$(dirname "$0")" && pwd)"
SOL="$HERE/../Build a Validated, Routed Insurance Policy Extraction Pipeline/04-hitl-routing/solution"
EVID="$HERE/capstone-submission/01-policy-pipeline"

cd "$SOL"
if [ ! -x .venv/bin/policy-extractor ]; then
  python3 -m venv .venv
  .venv/bin/pip install -q -e ".[dev]"
fi

echo "== 1. live pipeline run =="
{
  echo '$ .venv/bin/policy-extractor pipeline data/policies/ --routing-out routing_decisions.json --seed 42'
  echo "# ANTHROPIC_BASE_URL=$ANTHROPIC_BASE_URL  (course proxy; key exported in the shell, not shown)"
  .venv/bin/policy-extractor pipeline data/policies/ --routing-out routing_decisions.json --seed 42 2>&1
} | tee "$EVID/pipeline-run.txt"

echo "== 2. routing output -> evidence pack =="
cp routing_decisions.json "$EVID/routing_decisions.json"
ls -l "$EVID/routing_decisions.json"

echo "== 3. calibration report =="
cp "$HERE/calibration_report.py" .
{
  echo '$ .venv/bin/python calibration_report.py'
  .venv/bin/python calibration_report.py
} | tee "$EVID/calibration-report.txt"

echo "== 4. human_review records (for reflection 1b) =="
.venv/bin/python - <<'PY'
import json
from collections import Counter
decisions = json.load(open("routing_decisions.json"))
print("counts:", dict(Counter(d["decision"] for d in decisions)))
for d in decisions:
    if d["decision"] == "human_review":
        print(json.dumps(d, indent=2, sort_keys=True))
PY

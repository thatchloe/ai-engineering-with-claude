# Project Overview

In this course you built three systems that give Claude work that must be right:

- a validated, routed insurance-policy extraction pipeline
- a resilient two-pass mortgage-document extraction system
- a provenance-preserving supply-chain risk investigation

In this project you set up all three systems, run them, break them on purpose, and explain why they
behave the way they do. You write no new code. You run the systems and back up their design with your
own evidence.

## What You'll Do

1. **Reproduce** — install each system and run its full test suite and static checks
2. **Run** — execute each system end to end on its bundled data and save what it produces
3. **Perturb** — break one input per system and record what the safeguard does
4. **Reflect** — answer a short brief, grounding every answer in your own run

## What You'll Submit

- **An evidence pack** — test output, static-check output, and end-to-end runs for all three systems,
  plus the artifacts they generate (routing decisions, structured extractions, an executive briefing)
- **A perturbation log** — one experiment per system
- **A completed reflection brief**

## Graded On

- Evidence that all three systems build, run, and pass their checks
- A reflection where every answer cites a real artifact from your run, not a general description

## Resources

- The three reference systems (each with a `README`, `spec/`, and `tests`)
- The reflection brief and evidence-pack layout in `starter/`
- [Messages API](https://docs.anthropic.com/en/api/messages) ·
  [Message Batches API](https://docs.anthropic.com/en/api/creating-message-batches)

# Environment Setup

## Prerequisites

- Python 3.11+ (`python3 --version`)
- A terminal and git
- ~300 MB free disk (the supply-chain system downloads a ~90 MB embedding model on first run)

## API Access

Most work runs offline with no key:

- All three test suites replay recorded responses
- Mortgage runs offline with `--mode replay`
- Supply chain runs offline with `--offline`
- The calibration report is pure Python

One run uses the live API — the policy pipeline command. The course workspace gives you access. Set
up your key by following the course's API-key guidance.

> ⚠️ **No API access?** Use the offline fallback in the Instructions — the policy test suite
> demonstrates the same routing behavior.

## Local Machine Instructions

Set up each project in its own virtual environment. Run from inside each project folder:

```bash
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
```

Verify each one:

```bash
# policy pipeline
.venv/bin/pytest tests/ -v

# mortgage
.venv/bin/pytest tests/ -v
.venv/bin/mypy mortgage_extractor/
.venv/bin/ruff check mortgage_extractor/ tests/

# supply chain
.venv/bin/pytest tests/ -q
.venv/bin/mypy supply_chain_risk/
.venv/bin/ruff check supply_chain_risk/ tests/
```

**Windows:** drop the `.venv/bin/` prefix and use `.venv\Scripts\`.

Optional live runs only:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Workspace Instructions

The three project folders and Python 3.11+ are already here. Still create a venv per project.

- **Offline first** — run the suites and the `--offline` investigation with no key
- First supply-chain run downloads the embedding model; let it finish
- **Capture as you go** — `tee` each run into your evidence pack:

```bash
.venv/bin/pytest tests/ -v | tee 01-policy-pipeline/tests.txt
```

## Verify Your Setup

From each project folder:

```bash
.venv/bin/pytest tests/ -q
```

All suites should pass (the policy pipeline reports 45). Without a key, one live test is skipped.
Skipped is not failed.

---

# Evidence Pack — submission structure

Assemble your submission as a single folder (or `.zip`) with this layout. Fill `reflection-brief.md`
as you go — capture the evidence at the moment you run each system, not from memory afterward.

## Where each system lives

The three reference systems ship in the course repo (`cd15552 Claude AI Engineer Evaluation and
Observability`), one project per top-level folder. Run each from the `solution/` of that project's
**final** exercise (the `starter/` folders hold the fill-in exercises; the capstone runs the finished
`solution/`). Install with `pip install -e ".[dev]"` from inside the solution dir, which puts the
console command on your `PATH`.

| Evidence folder | Course project → final-exercise `solution/` | Console command |
|---|---|---|
| `01-policy-pipeline/` | `Build a Validated, Routed Insurance Policy Extraction Pipeline/04-hitl-routing/solution/` | `policy-extractor` |
| `02-mortgage-extraction/` | `Build a Resilient Mortgage Document Extraction System/04-validate-mathematical-consistency/solution/` | `mortgage-extract` |
| `03-supply-chain/` | `Investigate Supply Chain Risk with Multi-Source Synthesis/03-resilient-coordinator/solution/` | `supply-chain-investigate` |

```
capstone-submission/
├── reflection-brief.md            # the completed brief (provided — fill it in)
├── environment.txt                # `python3 --version` + OS; how you set up the venvs
├── perturbation-log.md            # one experiment per system (provided — fill it in)
│
├── 01-policy-pipeline/
│   ├── tests.txt                  # full `pytest -v` output (passing count visible)
│   ├── static-checks.txt          # `mypy` + `ruff` output
│   ├── pipeline-run.txt           # terminal capture of `policy-extractor pipeline data/policies/`
│   ├── routing_decisions.json     # generated routing output (the pipeline's --routing-out default)
│   ├── calibration-report.txt     # output of `calibration_report.py` (sliced, provided)
│   └── screenshots/               # at least one screenshot of a run
│
├── 02-mortgage-extraction/
│   ├── tests.txt
│   ├── static-checks.txt
│   ├── extract-run.txt            # `mortgage-extract <document>` output
│   ├── discrepancy-run.txt        # a run where the validator reports a discrepancy
│   └── screenshots/
│
└── 03-supply-chain/
    ├── tests.txt
    ├── static-checks.txt
    ├── investigation-run.txt      # `supply-chain-investigate meridian --offline`
    ├── briefing.*                 # generated briefing (3 sections)
    ├── timeout-run.txt            # `... --simulate-timeout` (graceful degradation)
    └── screenshots/
```

Plain text (`.txt`) captures and screenshots are both fine. The only hard rule: a reviewer should be
able to open any artifact you cite in the reflection brief and find the exact value you quoted.

## Perturbation log

A ready-to-fill `perturbation-log.md` is provided with one block per system. For **each** system, make
one deliberate change to an input or configuration, predict what will happen, run it, and record what
actually happened.

Good perturbations to start from (invent your own for stand-out credit):

- **Policy pipeline** — blank out a required field in one document so the information is genuinely
  absent. Confirm it escalates with a single API call and no invented value.
- **Mortgage extraction** — edit a stated total so it no longer matches the line items. Confirm the
  consistency validator flags the discrepancy.
- **Supply chain** — run with `--simulate-timeout`. Confirm the failed source is annotated as
  Incomplete and the run still finishes.

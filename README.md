# Agentic Core Resource Model

This repository contains an analytical resource model for an agentic 6G core control-plane architecture. It is designed for paper preparation and capacity discussion, not as a deployment benchmark. The model estimates request volume, CPU cost, memory traffic, NPU utilization, network bandwidth, and latency under different user counts and intent ratios.

## What Is Included

- `S2-2602109_was2600182_pCR_6G_23801-01_KI#18_HW_Agent_architecture.md`: source 3GPP SA2 proposal context.
- `agentic_core_resource_model.md`: English analytical model and results.
- `agentic_core_resource_model_zh.md`: Chinese version of the analytical model.
- `agentic_core_easy_explanation.md`: simplified English explanation.
- `agentic_core_easy_explanation_zh.md`: simplified Chinese explanation.
- `scripts/`: Python model implementation and plot generators.
- `outputs/`: generated CSV and PNG result artifacts.
- `webapp/`: TypeScript static web calculator.

## Model Logic

The model starts from:

1. User count.
2. Per-user event frequency per hour.
3. Intent ratio across all request types.
4. Qwen3 invocation ratio for intent requests.
5. Resource assumptions for CPU, memory, NPU, bandwidth, and latency.

It then calculates request rate, intent request rate, Qwen3 token demand, USL-inspired nonlinear overhead, CPU utilization, NPU utilization against a configured cluster, network utilization, and latency.

## Run the Python Model

Regenerate CSV and PNG outputs:

```bash
python3 scripts/agentic_resource_model.py
```

Generated files are written to `outputs/`:

- `agentic_resource_results.csv`
- `agentic_resource_sensitivity.csv`
- `agentic_qwen3_sizing_sensitivity.csv`
- `agentic_resource_utilization.png`
- `agentic_latency.png`
- `agentic_user_count_sensitivity.png`

Generate the nonlinear model comparison figure:

```bash
python3 scripts/nonlinear_model_options.py
```

Check Python syntax:

```bash
python3 -m py_compile scripts/agentic_resource_model.py scripts/agentic_model_config.py scripts/agentic_model_core.py scripts/agentic_model_outputs.py
```

## Use the Web App

Compile TypeScript after editing files in `webapp/src/`:

```bash
tsc -p webapp/tsconfig.json
```

If `tsc` is not on `PATH`, use the local TypeScript compiler available in this workspace:

```bash
/root/proj/ts/srf-perf-analyze/node_modules/typescript/bin/tsc -p webapp/tsconfig.json
```

Serve the calculator:

```bash
cd webapp
python3 -m http.server 7108 --bind 0.0.0.0
```

Open:

```text
http://127.0.0.1:7108/
```

The web app lets you tune user count, per-user request frequencies, intent ratio, CPU capacity, RAM, network capacity, Qwen3 token settings, configured NPU count for Qwen3 serving, and agent cost assumptions. Results update in the browser.

## Editing Guidance

Edit source files only:

- Python model: `scripts/agentic_model_config.py`, `scripts/agentic_model_core.py`, `scripts/agentic_model_outputs.py`
- Web app source: `webapp/src/`
- Documentation: `agentic_core_resource_model.md` and `agentic_core_resource_model_zh.md`

Do not manually edit generated files in `outputs/` or `webapp/dist/`; regenerate them from source.

## Validation Checklist

Before publishing changes, run:

```bash
python3 -m py_compile scripts/agentic_resource_model.py scripts/agentic_model_config.py scripts/agentic_model_core.py scripts/agentic_model_outputs.py
python3 scripts/agentic_resource_model.py
tsc -p webapp/tsconfig.json
git diff --check
```

Use the local TypeScript compiler path shown above if `tsc` is unavailable.

If model assumptions change, update both English and Chinese documentation and regenerate the output artifacts.

# Repository Guidelines

## Project Structure & Module Organization

This repository contains an analytical resource model for an agentic 6G core architecture and a small browser-based calculator.

- `S2-2602109_was2600182_pCR_6G_23801-01_KI#18_HW_Agent_architecture.md`: source proposal used as architecture context.
- `S2-2602109_was2600182_pCR_6G_23801-01_KI#18_HW_Agent_architecture_media/`: images referenced by the proposal.
- `agentic_core_resource_model.md`: paper-ready analytical model, assumptions, equations, and result interpretation.
- `agentic_core_resource_model_zh.md`: Chinese translation of the analytical model. Keep it synchronized with the English version.
- `scripts/agentic_resource_model.py`: Python generator for CSV results and plots.
- `outputs/`: generated CSV and PNG artifacts. Regenerate these instead of editing them manually.
- `webapp/`: static TypeScript web app. Source is in `webapp/src/app.ts`; compiled browser output is `webapp/dist/app.js`.

## Build, Test, and Development Commands

Run the analytical model and regenerate outputs:

```bash
python3 scripts/agentic_resource_model.py
```

Check Python syntax:

```bash
python3 -m py_compile scripts/agentic_resource_model.py
```

Compile the web app TypeScript:

```bash
tsc -p webapp/tsconfig.json
```

Serve the web app locally:

```bash
cd webapp
python3 -m http.server 7108 --bind 0.0.0.0
```

## Coding Style & Naming Conventions

Use 4-space indentation for Python and 2-space indentation for TypeScript, HTML, and CSS. Prefer descriptive names tied to the resource model, such as `intentRps`, `cpuUtil`, and `networkGbps`. Keep generated files in `outputs/` and `webapp/dist/`; make source changes in `scripts/` and `webapp/src/`.

## Testing Guidelines

There is no formal test suite yet. For changes to the Python model, run `py_compile` and regenerate outputs. For web app changes, run `tsc -p webapp/tsconfig.json` and verify the page in a browser at `http://127.0.0.1:7108`. Check that the live calculator updates CPU, memory, GPU, bandwidth, and latency when parameters change.

## Commit & Pull Request Guidelines

The history currently contains only an initial commit, so use concise imperative commit messages, for example `Add resource calculator web app` or `Update intent latency assumptions`. Pull requests should include a short summary, the commands run, and screenshots when UI changes are made. If model assumptions change, update `agentic_core_resource_model.md`, `agentic_core_resource_model_zh.md`, and regenerated `outputs/` artifacts.

## Agent-Specific Instructions

Do not edit generated artifacts by hand unless explicitly requested. Preserve the distinction between analytical assumptions and measured results. Avoid claiming deployment measurements unless a real testbed produced them. When editing the English analytical model, apply the equivalent update to the Chinese version in the same change.

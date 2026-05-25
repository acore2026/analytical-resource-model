#!/usr/bin/env python3
"""Generate a comparison figure for linear and nonlinear resource models."""

from __future__ import annotations

from pathlib import Path


def piecewise_multiplier(load: float) -> float:
    if load < 0.60:
        return 1.00
    if load < 0.80:
        return 1.15
    if load < 0.90:
        return 1.35
    return 1.60


def saturation_multiplier(load: float, knee: float = 0.60, alpha: float = 0.60, power: float = 2.0) -> float:
    if load <= knee:
        return 1.0
    normalized_excess = (load - knee) / (1.0 - knee)
    return 1.0 + alpha * normalized_excess**power


def main() -> None:
    import matplotlib.pyplot as plt  # type: ignore

    out_dir = Path("outputs")
    out_dir.mkdir(parents=True, exist_ok=True)

    loads = [step / 100.0 for step in range(0, 101)]
    x = [load * 100.0 for load in loads]
    linear = loads
    saturation = [load * saturation_multiplier(load) for load in loads]
    piecewise = [load * piecewise_multiplier(load) for load in loads]

    plt.figure(figsize=(7.4, 4.4))
    plt.plot(x, linear, linewidth=2.6, label="Linear model", color="#1769d1")
    plt.plot(x, saturation, linewidth=3.0, label="Saturation curve", color="#d66a00")
    plt.plot(x, piecewise, linewidth=2.6, label="Piecewise tiers", color="#3c8b4a")
    plt.axvline(60, color="#7b827c", linestyle="--", linewidth=1.2, label="Band boundary")
    plt.axvline(80, color="#7b827c", linestyle="--", linewidth=1.0)
    plt.axvline(90, color="#7b827c", linestyle="--", linewidth=1.0)
    plt.xlabel("Normalized load or intent ratio (%)")
    plt.ylabel("Normalized resource demand\n(linear = 1.0 at full load)")
    plt.title("Linear and Nonlinear Resource Demand Models")
    plt.grid(True, alpha=0.28)
    plt.legend(loc="upper left")
    plt.tight_layout()
    plt.savefig(out_dir / "nonlinear_model_options.png", dpi=180)
    plt.close()

    print("Wrote outputs/nonlinear_model_options.png")


if __name__ == "__main__":
    main()

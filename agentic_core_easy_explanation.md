# Easy Explanation of the Agentic Core Resource Model

[中文版本](agentic_core_easy_explanation_zh.md)

This document explains the main calculation logic in a simple way.

## One Sentence

We calculate request volume from users, add Agent cost for intent requests, convert complex intent requests into Qwen3 tokens, apply high-load nonlinear overhead, and calculate utilization of the configured NPU cluster assigned to Qwen3 serving.

## Step 1: Start From Users

$$
\mathrm{request\ rate} = \frac{\mathrm{users} \cdot \mathrm{events/user/hour}}{3600}
$$

The baseline has $3.6$ million users and produces $104,300$ total requests/s.

## Step 2: Find Intent Requests

Any request type may carry intent. At $100\%$ intent ratio:

$$
\lambda_I = 104,300\ \mathrm{requests/s}
$$

## Step 3: Add Agent Cost

$$
\mathrm{intent\ request} = \mathrm{normal\ core\ work} + \mathrm{Agent\ parsing/planning/tool\ cost}
$$

This affects CPU, memory, bandwidth, and latency.

## Step 4: Convert Qwen3 Requests to Tokens

By default, $10\%$ of intent requests invoke Qwen3:

$$
\lambda_Q = 104,300 \cdot 10\% = 10,430\ \mathrm{requests/s}
$$

The token profile is:

$$
L_Q = 128 + 4 = 132\ \mathrm{tokens/request}
$$

Raw token demand is:

$$
T_Q = 10,430 \cdot 132 = 1,376,760\ \mathrm{tokens/s}
$$

## Step 5: Add USL-Inspired Nonlinear Overhead

The model uses a USL-inspired multiplier. It adds extra demand for contention and coordination when the system is busy:

$$
M_{\mathrm{USL}}(u)=1+0.05u+0.10u^2
$$

$$
F_{\mathrm{USL}}(u)=u \cdot M_{\mathrm{USL}}(u)
$$

Here $u$ is the raw utilization and $F_{\mathrm{USL}}(u)$ is the effective utilization after contention and coordination overhead. This makes the line bend upward as load grows.

For the default full-intent Qwen3 case with a fixed 128-NPU cluster assigned to inference:

$$
T_{Q,\mathrm{eff}} = 2,700,304\ \mathrm{tokens/s}
$$

## Step 6: Calculate NPU Utilization

The configured NPU cluster for Qwen3 serving is:

$$
N_Q = 128\ \mathrm{NPUs}, \quad TP_Q = 4\ \mathrm{NPUs/replica}
$$

Available replicas and token capacity are:

$$
R_{Q,\mathrm{avail}} = \left\lfloor \frac{128}{4} \right\rfloor = 32
$$

$$
C_Q = 32 \cdot 15,040 = 481,280\ \mathrm{tokens/s}
$$

NPU utilization is:

$$
u_Q = \frac{2,700,304}{481,280} = 561.1\%
$$

## Main Message

For the baseline production scenario:

- User population is $3.6$ million.
- At $100\%$ intent ratio, intent traffic is $104,300$ requests/s.
- $10\%$ of intent requests invoke Qwen3.
- The configured NPU cluster for Qwen3 serving has $128$ NPUs.
- At $20\%$ intent ratio, NPU utilization is $60.7\%$.
- At $30\%$ intent ratio, NPU utilization is $95.8\%$, so the configured NPU cluster is high risk but not overloaded.
- At $40\%$ intent ratio, NPU utilization is $136.0\%$, so the configured NPU cluster is overloaded.

This is the core logic of the analysis.

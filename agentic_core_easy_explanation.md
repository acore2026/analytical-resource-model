# Easy Explanation of the Agentic Core Resource Model

[中文版本](agentic_core_easy_explanation_zh.md)

This document explains the main calculation logic in a simple way.

## One Sentence

We calculate request volume from users, add Agent cost for intent requests, convert complex intent requests into Qwen3 tokens, apply high-load nonlinear overhead, and calculate required production NPUs.

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

## Step 5: Add Nonlinear High-Load Overhead

The model uses easy operating bands instead of a complex curve:

| Load range | State | Multiplier |
| ---: | --- | ---: |
| $0\% \le u < 60\%$ | Normal | $1.00$ |
| $60\% \le u < 80\%$ | Busy | $1.15$ |
| $80\% \le u < 90\%$ | High load | $1.35$ |
| $90\% \le u$ | Critical | $1.60$ |

For the default full-intent Qwen3 case:

$$
T_{Q,\mathrm{eff}} = 1,583,274\ \mathrm{tokens/s}
$$

## Step 6: Calculate Production NPUs

The reference capacity is:

$$
\mu_Q = 15,040\ \mathrm{tokens/s/replica}, \quad TP_Q = 4\ \mathrm{NPUs/replica}, \quad u_{\mathrm{target}} = 70\%
$$

Required replicas and NPUs are:

$$
R_Q = \left\lceil \frac{1,583,274}{15,040 \cdot 70\%} \right\rceil = 151
$$

$$
N_Q = 151 \cdot 4 = 604\ \mathrm{NPUs}
$$

## Main Message

For the baseline production scenario:

- User population is $3.6$ million.
- At $100\%$ intent ratio, intent traffic is $104,300$ requests/s.
- $10\%$ of intent requests invoke Qwen3.
- Effective Qwen3 demand after nonlinear overhead is $1,583,274$ tokens/s.
- Required production capacity is $604$ NPUs.

This is the core logic of the analysis.

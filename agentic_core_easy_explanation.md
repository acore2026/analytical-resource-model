# Easy Explanation of the Agentic Core Resource Model

[中文版本](agentic_core_easy_explanation_zh.md)

This document explains the main calculation logic in a simple way.

## One Sentence

We calculate how many control-plane requests arrive, add the extra Agent cost for intent requests, convert complex intent requests into Qwen3 token demand, and then calculate how many production NPUs are required.

## Step 1: Start From Users

The model starts with the number of users and how often one user triggers each control-plane procedure.

```text
request rate [requests/s] =
  users * events per user per hour / 3600
```

For example, the baseline has `3.6M users` and produces `104,300 total requests/s`.

## Step 2: Find Intent Requests

Any request type may carry intent. The intent ratio is a tunable parameter applied to the full request stream.

At `100%` intent ratio, the baseline produces:

```text
intent requests = 104,300 requests/s
```

## Step 3: Add Agent Cost

Every request still has normal core-network cost:

```text
normal core work = CPU + memory + bandwidth + latency
```

Intent requests add Agent work:

```text
intent request = normal core work + Agent parsing/planning/tool-selection cost
```

This affects CPU, memory, bandwidth, and latency.

## Step 4: Convert Qwen3 Requests to Tokens

Not every intent request calls Qwen3. The default assumes:

```text
10% of intent requests invoke Qwen3
```

So at peak:

```text
Qwen3 requests = 104,300 * 10% = 10,430 requests/s
```

The benchmark token profile is:

```text
128 input tokens + 4 output tokens = 132 tokens/request
```

Therefore:

```text
Qwen3 token demand =
  10,430 requests/s * 132 tokens/request
  = 1,376,760 tokens/s
```

## Step 5: Calculate Production NPUs

The referenced benchmark reports:

```text
1 Qwen3 replica = 15,040 tokens/s
1 Qwen3 replica uses 4 NPUs
target utilization = 70%
```

So:

```text
required replicas =
  ceil(1,376,760 / (15,040 * 70%))
  = 131 replicas

required production NPUs =
  131 replicas * 4 NPUs/replica
  = 524 NPUs
```

## Main Message

For the baseline production scenario:

```text
3.6M users
104,300 intent requests/s
10% of intent requests invoke Qwen3
1,376,760 Qwen3 tokens/s
524 production NPUs required
```

This is the core logic of the analysis.

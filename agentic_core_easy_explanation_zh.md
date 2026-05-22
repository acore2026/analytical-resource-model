# Agentic Core 资源模型简明说明

[English version](agentic_core_easy_explanation.md)

本文用更简单的方式解释资源模型的主要计算逻辑。

## 一句话

我们先计算控制面每秒有多少请求，再为意图请求增加 Agent 成本；对于复杂意图请求，把它们换算成 Qwen3 token 需求，最后计算生产环境需要多少 NPU。

## 第一步：从用户数开始

模型从用户数和单个用户每小时触发各类控制面流程的次数开始。

```text
请求速率 [requests/s] =
  用户数 * 每用户每小时事件次数 / 3600
```

例如，基线中有 `3.6M users`，得到 `104,300 total requests/s`。

## 第二步：找出意图请求

只有部分流程可以携带意图：

- 初始 PDU 会话建立
- PDU 会话修改
- 业务请求

当可携带意图比例为 `100%` 时，这些流程产生：

```text
intent requests = 24,000 requests/s
```

## 第三步：增加 Agent 成本

每个请求仍然有普通核心网处理成本：

```text
普通核心网工作 = CPU + 内存 + 带宽 + 时延
```

意图请求还会增加 Agent 工作：

```text
意图请求 = 普通核心网工作 + Agent 解析/规划/工具选择成本
```

这会影响 CPU、内存、带宽和时延。

## 第四步：把 Qwen3 请求换算成 Token

不是所有意图请求都会调用 Qwen3。默认假设为：

```text
10% 的意图请求调用 Qwen3
```

因此在峰值下：

```text
Qwen3 requests = 24,000 * 10% = 2,400 requests/s
```

基准 token 配置为：

```text
128 input tokens + 4 output tokens = 132 tokens/request
```

所以：

```text
Qwen3 token demand =
  2,400 requests/s * 132 tokens/request
  = 316,800 tokens/s
```

## 第五步：计算生产 NPU 数量

参考基准给出：

```text
1 个 Qwen3 副本 = 15,040 tokens/s
1 个 Qwen3 副本使用 4 张 NPU
目标利用率 = 70%
```

因此：

```text
required replicas =
  ceil(316,800 / (15,040 * 70%))
  = 31 replicas

required production NPUs =
  31 replicas * 4 NPUs/replica
  = 124 NPUs
```

## 核心结论

`8 x Ascend 910B4` 服务器是实验室参考环境，不是完整生产部署规模。

在默认生产场景下：

```text
3.6M users
24,000 intent requests/s
10% 的意图请求调用 Qwen3
316,800 Qwen3 tokens/s
需要 124 张生产 NPU
```

这就是本分析的核心逻辑。

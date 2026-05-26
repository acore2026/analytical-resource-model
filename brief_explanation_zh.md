# Agentic 6G 核心网资源分析简要说明

## 1. 分析目的

本项目用于评估 Agentic 6G 核心网控制面在高并发场景下的资源需求，重点关注 CPU、内存、NPU 和网络带宽。分析对象包括注册、PDU 会话建立/释放/修改、业务请求、AN 释放、切换、寻呼等基础控制面流程。

该结果是分析型容量模型，不是实际部署测试结果。模型用于说明在目标架构下，随着用户规模、意图比例和 Qwen3 调用比例变化，系统资源压力如何变化。

## 2. 关键输入数据

| 项目 | 当前取值 |
| --- | ---: |
| 用户数 | 3.6 million |
| PDU sessions per user | 2 |
| 总控制面请求速率 | 104,300 requests/s |
| CPU 资源 | 256 CPU cores |
| RAM 资源 | 256 GB |
| NPU 资源 | 128 NPUs |
| 网络容量 | 100 Gbps |
| 推理模型 | Qwen3-30B-A3B |
| 推理运行时 | vLLM Ascend 0.11.0 |
| Qwen3 token 配置 | 128 input tokens + 4 output tokens |
| Qwen3 单副本能力 | 15,040 tokens/s/replica |
| Qwen3 张量并行规模 | 4 NPUs/replica |
| Qwen3 调用比例 | 意图请求的 10% |

## 3. 关键结论

在当前默认配置下，CPU 和网络不是最主要瓶颈；NPU 推理资源更容易成为瓶颈。

当所有请求中有 20% 携带意图时，系统仍处于稳定状态：CPU 利用率约为 69.3%，NPU 利用率约为 60.7%，网络利用率约为 8.8%。

当意图比例提高到 30% 时，NPU 利用率约为 95.8%，系统进入高风险状态。此时主要风险来自 Qwen3 推理资源，而不是 CPU 或网络。

当意图比例达到 40% 时，NPU 利用率超过 100%，表示当前 128 张 NPU 的配置已经无法承载该负载。此时需要增加 NPU 数量、降低 Qwen3 调用比例、缩短 token 配置、提升推理吞吐，或引入准入控制。

## 4. CSV 和 PNG 文件说明

CSV 文件是原始计算结果表，PNG 文件是基于同一批计算结果生成的图表。

| 文件 | 作用 |
| --- | --- |
| `outputs/agentic_resource_results.csv` | 固定用户规模下，不同意图比例对应的 CPU、内存、NPU、网络结果 |
| `outputs/agentic_resource_sensitivity.csv` | 用户规模和意图比例变化时的敏感性结果 |
| `outputs/agentic_qwen3_sizing_sensitivity.csv` | Qwen3/NPU 配置变化时的敏感性结果 |
| `outputs/agentic_resource_utilization.png` | 意图比例变化时的 CPU、网络、NPU 利用率图 |
| `outputs/agentic_user_count_sensitivity.png` | 固定 20% 意图比例时，用户数变化带来的资源压力图 |
| `outputs/nonlinear_model_options.png` | 非线性开销模型对比图 |

简单理解：CSV 是表格数据，PNG 是根据表格数据画出的图，便于汇报和审阅。

## 5. Web App 说明

当前 Web App 已部署在云服务器：

http://101.245.78.174:7108/

Web App 可在线调整关键参数，包括用户数、每用户每小时事件次数、意图比例、Qwen3 调用比例、Qwen3 token 配置、NPU 数量、CPU 核数、网络容量等。页面会实时计算 CPU、内存、NPU 和网络资源结果，并展示趋势图和结果表。

该页面适合用于会议演示：可以直接修改参数，观察系统从稳定到高风险或过载的变化过程。

## 6. 建议阅读方式

建议先阅读本文档，快速了解关键数据和结论；再阅读 `agentic_core_resource_model_zh.md`，查看完整模型、公式、参数来源和参考文献；如需核对具体数值，可查看 `outputs/` 目录下的 CSV 和 PNG 文件。

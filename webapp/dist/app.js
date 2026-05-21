"use strict";
const BASELINE = {
    totalRps: 10000,
    intentRatio: 10,
    mixRegistration: 20,
    mixPdu: 30,
    mixService: 50,
    cpuCores: 64,
    nicGbps: 100,
    ramGb: 256,
    vramGb: 24,
    gpuCapacity: 2000,
    nonIntentCpu: 0.3,
    intentCpu: 2.0,
    intentGpuMs: 8,
    intentBandwidthKb: 12
};
const PROCEDURES = [
    { key: "registration", baseLatencyMs: 30, baseCpuMs: 2.0, baseBandwidthKb: 12, intentEligible: false },
    { key: "pdu", baseLatencyMs: 40, baseCpuMs: 2.5, baseBandwidthKb: 16, intentEligible: true },
    { key: "service", baseLatencyMs: 20, baseCpuMs: 1.2, baseBandwidthKb: 8, intentEligible: true }
];
const SWEEP = [0, 1, 5, 10, 20, 50, 100];
const INPUT_IDS = [
    "totalRps",
    "intentRatio",
    "mixRegistration",
    "mixPdu",
    "mixService",
    "cpuCores",
    "nicGbps",
    "ramGb",
    "vramGb",
    "gpuCapacity",
    "nonIntentCpu",
    "intentCpu",
    "intentGpuMs",
    "intentBandwidthKb"
];
const I18N = {
    en: {
        modelMarkdown: "Model markdown",
        open: "OPEN",
        traffic: "Traffic",
        cluster: "Cluster",
        agentCost: "Agent Cost",
        totalRequestRate: "Total request rate",
        intentRatio: "Intent ratio among eligible procedures",
        registration: "Registration",
        pduSession: "PDU session",
        serviceRequest: "Service request",
        cpuCores: "CPU cores",
        nicCapacity: "NIC capacity",
        ramCapacity: "RAM capacity",
        vramCapacity: "VRAM capacity",
        gpuIntentCapacity: "GPU intent inference capacity",
        nonIntentCpuCost: "Non-intent CPU cost",
        intentCpuCost: "Intent CPU cost",
        intentInferenceLatency: "Intent inference latency",
        intentExtraBandwidth: "Intent extra bandwidth",
        resetBaseline: "Reset baseline",
        cpuDemandMetric: "CPU demand (cores)",
        memoryMetric: "Memory (GB)",
        gpuLoadMetric: "GPU load (%)",
        bandwidthMetric: "Bandwidth (Gbps)",
        meanLatencyMetric: "Mean latency (ms)",
        p95LatencyMetric: "p95 latency (ms)",
        p99LatencyMetric: "p99 latency (ms)",
        intentSweep: "Intent Sweep",
        calculatedSweep: "Calculated Sweep",
        tableEligibleIntent: "Eligible intent (%)",
        tableTotalIntent: "Total intent (%)",
        tableIntentRate: "Intent rate (req/s)",
        tableCpuUtil: "CPU util (%)",
        tableGpuUtil: "GPU util (%)",
        tableBw: "BW (Gbps)",
        tableMean: "Mean (ms)",
        tableStatus: "Status",
        totalRequestRateTip: "Offered control-plane request arrival rate across registration, PDU session establishment, and service request.",
        intentRatioTip: "Share of PDU session establishment and service request messages that carry intent. Registration is non-intent in this model.",
        registrationTip: "Traffic mix weight for UE registration requests. Mix values are normalized automatically.",
        pduSessionTip: "Traffic mix weight for PDU session establishment requests. Intent can apply to this procedure.",
        serviceRequestTip: "Traffic mix weight for service request messages. Intent can apply to this procedure.",
        cpuCoresTip: "Total CPU core capacity available to deterministic procedure handling and CPU-side agent logic.",
        nicCapacityTip: "Network interface capacity available for control-plane message traffic.",
        ramCapacityTip: "Host memory capacity for agent/NF processes, active request contexts, and runtime state.",
        vramCapacityTip: "Accelerator memory available for the inference model and active intent request state.",
        gpuIntentCapacityTip: "Maximum intent-bearing requests the accelerator can process per second before queueing becomes unstable.",
        nonIntentCpuCostTip: "CPU-ms means one CPU core occupied for one millisecond. 0.3 CPU-ms is 0.3 ms on one core, or equivalent parallel CPU work.",
        intentCpuCostTip: "CPU-side agent work for intent parsing, constraints, planning, and tool-wrapper handling outside GPU inference.",
        intentInferenceLatencyTip: "Per-request accelerator inference service time before queueing delay.",
        intentExtraBandwidthTip: "Additional control-plane message bytes caused by agent-tool wrappers and inter-agent task messages.",
        allRequests: "of all requests",
        normalizedMix: "Normalized mix",
        bottleneck: "Bottleneck",
        intentTraffic: "Intent traffic is",
        gpu70: "keeping GPU utilization at or below 70% requires",
        accelerator: "accelerator",
        accelerators: "accelerators",
        stable: "stable",
        degraded: "degraded",
        high_risk: "high risk",
        unstable: "unstable",
        cpu: "CPU",
        gpu: "GPU",
        network: "Network",
        gpuInference: "GPU inference",
        ram: "RAM",
        coresUnit: "cores"
    },
    zh: {
        modelMarkdown: "模型说明文档",
        open: "打开",
        traffic: "流量",
        cluster: "集群",
        agentCost: "Agent 成本",
        totalRequestRate: "总请求速率",
        intentRatio: "可携带意图流程中的意图比例",
        registration: "注册",
        pduSession: "PDU 会话",
        serviceRequest: "业务请求",
        cpuCores: "CPU 核数",
        nicCapacity: "网卡容量",
        ramCapacity: "内存容量",
        vramCapacity: "显存容量",
        gpuIntentCapacity: "GPU 意图推理能力",
        nonIntentCpuCost: "非意图 CPU 成本",
        intentCpuCost: "意图 CPU 成本",
        intentInferenceLatency: "意图推理时延",
        intentExtraBandwidth: "意图额外带宽",
        resetBaseline: "重置基线",
        cpuDemandMetric: "CPU 需求（核）",
        memoryMetric: "内存（GB）",
        gpuLoadMetric: "GPU 负载（%）",
        bandwidthMetric: "带宽（Gbps）",
        meanLatencyMetric: "平均时延（ms）",
        p95LatencyMetric: "p95 时延（ms）",
        p99LatencyMetric: "p99 时延（ms）",
        intentSweep: "意图比例扫描",
        calculatedSweep: "计算结果扫描",
        tableEligibleIntent: "可携带意图比例（%）",
        tableTotalIntent: "总意图比例（%）",
        tableIntentRate: "意图速率（req/s）",
        tableCpuUtil: "CPU 利用率（%）",
        tableGpuUtil: "GPU 利用率（%）",
        tableBw: "带宽（Gbps）",
        tableMean: "平均值（ms）",
        tableStatus: "状态",
        totalRequestRateTip: "注册、PDU 会话建立和业务请求的控制面总到达速率。",
        intentRatioTip: "PDU 会话建立和业务请求中携带意图的比例。本模型中注册流程不携带意图。",
        registrationTip: "UE 注册请求在流量混合中的权重。三个权重会自动归一化。",
        pduSessionTip: "PDU 会话建立请求在流量混合中的权重。该流程可携带意图。",
        serviceRequestTip: "业务请求在流量混合中的权重。该流程可携带意图。",
        cpuCoresTip: "可用于确定性流程处理和 Agent CPU 侧逻辑的总 CPU 核数。",
        nicCapacityTip: "可用于控制面消息传输的网卡容量。",
        ramCapacityTip: "主机内存容量，用于 Agent/NF 进程、活跃请求上下文和运行状态。",
        vramCapacityTip: "加速器显存容量，用于推理模型和活跃意图请求状态。",
        gpuIntentCapacityTip: "推理队列失稳前，单个加速器每秒可处理的意图请求数。",
        nonIntentCpuCostTip: "CPU-ms 表示一个 CPU 核占用一毫秒。0.3 CPU-ms 等价于单核 0.3 ms 的计算量。",
        intentCpuCostTip: "意图解析、约束检查、规划和工具封装等 GPU 推理之外的 CPU 侧 Agent 工作量。",
        intentInferenceLatencyTip: "不含排队延迟时，单个意图请求的加速器推理服务时间。",
        intentExtraBandwidthTip: "由 Agent-Tool 封装和 Agent 间任务消息带来的额外控制面消息字节数。",
        allRequests: "占全部请求",
        normalizedMix: "归一化流量混合",
        bottleneck: "瓶颈",
        intentTraffic: "意图流量为",
        gpu70: "若保持 GPU 利用率不超过 70%，需要",
        accelerator: "个加速器",
        accelerators: "个加速器",
        stable: "稳定",
        degraded: "退化",
        high_risk: "高风险",
        unstable: "不稳定",
        cpu: "CPU",
        gpu: "GPU",
        network: "网络",
        gpuInference: "GPU 推理",
        ram: "内存",
        coresUnit: "核"
    }
};
let currentLang = "en";
function t(key) {
    return I18N[currentLang][key] ?? I18N.en[key] ?? key;
}
function statusText(name) {
    return t(name);
}
function applyTranslations() {
    document.documentElement.lang = currentLang === "zh" ? "zh-CN" : "en";
    document.querySelectorAll("[data-i18n]").forEach((node) => {
        const key = node.dataset.i18n;
        if (key)
            node.textContent = t(key);
    });
    document.querySelectorAll("[data-tip-key]").forEach((node) => {
        const key = node.dataset.tipKey;
        if (key)
            node.dataset.tip = t(key);
    });
    const langToggle = mustGet("langToggle");
    langToggle.textContent = currentLang === "en" ? "中文" : "English";
    langToggle.setAttribute("aria-label", currentLang === "en" ? "Switch to Chinese" : "切换到英文");
    const docLink = mustGet("docLink");
    docLink.href = currentLang === "zh"
        ? "https://github.com/acore2026/analytical-resource-model/blob/main/agentic_core_resource_model_zh.md"
        : "https://github.com/acore2026/analytical-resource-model/blob/main/agentic_core_resource_model.md";
}
function mustGet(id) {
    const node = document.getElementById(id);
    if (!node) {
        throw new Error(`Missing DOM element: ${id}`);
    }
    return node;
}
const input = Object.fromEntries(INPUT_IDS.map((id) => [id, mustGet(id)]));
function num(id) {
    const value = Number(input[id].value);
    return Number.isFinite(value) ? value : 0;
}
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function normalizedMix() {
    const raw = {
        registration: Math.max(0, num("mixRegistration")),
        pdu: Math.max(0, num("mixPdu")),
        service: Math.max(0, num("mixService"))
    };
    const total = raw.registration + raw.pdu + raw.service || 1;
    return {
        registration: raw.registration / total,
        pdu: raw.pdu / total,
        service: raw.service / total
    };
}
function queueDelayMs(util, serviceMs) {
    if (util >= 1)
        return Infinity;
    if (util <= 0)
        return 0;
    return serviceMs * util / (1 - util);
}
function classifyStatus(util, degraded = 0.7, highRisk = 0.85) {
    if (util >= 1)
        return "unstable";
    if (util >= highRisk)
        return "high_risk";
    if (util >= degraded)
        return "degraded";
    return "stable";
}
function fmt(value, digits = 1) {
    if (!Number.isFinite(value))
        return "unstable";
    return value.toLocaleString(undefined, {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits
    });
}
function pct(value, digits = 1) {
    if (!Number.isFinite(value))
        return "unstable";
    return `${(value * 100).toFixed(digits)}%`;
}
function evaluate(intentRatioPercent = num("intentRatio")) {
    const mix = normalizedMix();
    const totalRps = Math.max(1, num("totalRps"));
    const intentRatio = clamp(intentRatioPercent / 100, 0, 1);
    const eligibleMix = mix.pdu + mix.service;
    const actualIntentShare = eligibleMix * intentRatio;
    const intentRps = totalRps * actualIntentShare;
    const baseCpuAvg = PROCEDURES.reduce((sum, proc) => sum + mix[proc.key] * proc.baseCpuMs, 0);
    const baseBandwidthAvg = PROCEDURES.reduce((sum, proc) => sum + mix[proc.key] * proc.baseBandwidthKb, 0);
    const baseLatencyAvg = PROCEDURES.reduce((sum, proc) => sum + mix[proc.key] * proc.baseLatencyMs, 0);
    const cpuMsPerRequest = baseCpuAvg
        + actualIntentShare * Math.max(0, num("intentCpu"))
        + (1 - actualIntentShare) * Math.max(0, num("nonIntentCpu"));
    const cpuCores = Math.max(1, num("cpuCores"));
    const cpuCoreDemand = totalRps * cpuMsPerRequest / 1000;
    const cpuUtil = cpuCoreDemand / cpuCores;
    const cpuDelay = queueDelayMs(cpuUtil, cpuMsPerRequest);
    const bandwidthKbPerRequest = baseBandwidthAvg + actualIntentShare * Math.max(0, num("intentBandwidthKb"));
    const networkGbps = totalRps * bandwidthKbPerRequest * 8 / 1000000;
    const networkUtil = networkGbps / Math.max(1, num("nicGbps"));
    const networkDelay = queueDelayMs(networkUtil, 0.1);
    const gpuCapacity = Math.max(1, num("gpuCapacity"));
    const gpuUtil = intentRps / gpuCapacity;
    const gpuQueueDelay = queueDelayMs(gpuUtil, 1000 / gpuCapacity);
    const intentGpuLatency = Math.max(0, num("intentGpuMs")) + gpuQueueDelay;
    const activeIntentRequests = intentRps * Math.max(0, num("intentGpuMs")) / 1000;
    const gpuVramGb = intentRps > 0 ? 16 + activeIntentRequests * 4 / 1024 : 0;
    const gpuVramUtil = gpuVramGb / Math.max(1, num("vramGb"));
    const activeRequests = totalRps * baseLatencyAvg / 1000;
    const ramGb = 32 + activeRequests * 128 / 1024 / 1024;
    const ramUtil = ramGb / Math.max(1, num("ramGb"));
    const memoryTrafficKb = (1 - actualIntentShare) * 64 + actualIntentShare * 512;
    const memoryTrafficGbps = totalRps * memoryTrafficKb * 8 / 1000000;
    let meanLatency = 0;
    for (const proc of PROCEDURES) {
        const procIntentShare = proc.intentEligible ? intentRatio : 0;
        const nonIntentLatency = proc.baseLatencyMs + 1 + cpuDelay + networkDelay;
        const intentLatency = proc.baseLatencyMs + 4 + Math.max(0, num("intentCpu")) + intentGpuLatency + cpuDelay + networkDelay;
        meanLatency += mix[proc.key] * ((1 - procIntentShare) * nonIntentLatency + procIntentShare * intentLatency);
    }
    const bottleneckUtil = Math.max(cpuUtil, gpuUtil, networkUtil);
    const unstable = cpuUtil >= 1 || gpuUtil >= 1 || networkUtil >= 1 || !Number.isFinite(meanLatency);
    let p95Latency = Infinity;
    let p99Latency = Infinity;
    if (!unstable) {
        const tailAmplifier = 1 + 2 * bottleneckUtil / Math.max(0.001, 1 - bottleneckUtil);
        p95Latency = meanLatency * Math.min(tailAmplifier, 10);
        p99Latency = meanLatency * Math.min(tailAmplifier * 1.35, 15);
    }
    else {
        meanLatency = Infinity;
    }
    const systemStatus = unstable ? "unstable" : classifyStatus(bottleneckUtil);
    const requiredGpus70 = intentRps > 0 ? Math.ceil(intentRps / (gpuCapacity * 0.7)) : 0;
    return {
        totalRps,
        eligibleMix,
        intentRatio,
        actualIntentShare,
        intentRps,
        cpuMsPerRequest,
        cpuCoreDemand,
        cpuUtil,
        ramGb,
        ramUtil,
        memoryTrafficGbps,
        gpuUtil,
        gpuVramGb,
        gpuVramUtil,
        requiredGpus70,
        networkGbps,
        networkUtil,
        meanLatency,
        p95Latency,
        p99Latency,
        systemStatus,
        cpuStatus: classifyStatus(cpuUtil),
        gpuStatus: classifyStatus(gpuUtil),
        netStatus: classifyStatus(networkUtil)
    };
}
function colorForStatus(name) {
    if (name === "stable")
        return "#3c8b4a";
    if (name === "degraded")
        return "#a76f11";
    return "#c94d41";
}
function setBar(id, util, statusName) {
    const node = mustGet(id);
    node.style.width = `${clamp(util, 0, 1) * 100}%`;
    node.style.background = colorForStatus(statusName);
}
function bottleneckLabel(result) {
    const pairs = [
        [t("cpu"), result.cpuUtil],
        [t("gpuInference"), result.gpuUtil],
        [t("network"), result.networkUtil],
        [t("ram"), result.ramUtil]
    ];
    pairs.sort((a, b) => b[1] - a[1]);
    return pairs[0][0];
}
function updateSummary(result) {
    mustGet("intentRatioLabel").textContent = `${Math.round(result.intentRatio * 100)}%`;
    mustGet("actualIntentLabel").textContent = `${pct(result.actualIntentShare)} ${t("allRequests")}`;
    const mix = normalizedMix();
    mustGet("mixHint").textContent = `${t("normalizedMix")}: ${t("registration")} ${pct(mix.registration)}, ${t("pduSession")} ${pct(mix.pdu)}, ${t("serviceRequest")} ${pct(mix.service)}.`;
    mustGet("cpuDemand").textContent = `${fmt(result.cpuCoreDemand, 1)} ${t("coresUnit")}`;
    mustGet("ramDemand").textContent = `${fmt(result.ramGb, 1)} GB`;
    mustGet("gpuDemand").textContent = pct(result.gpuUtil);
    mustGet("netDemand").textContent = `${fmt(result.networkGbps, 3)} Gbps`;
    setBar("cpuBar", result.cpuUtil, result.cpuStatus);
    setBar("ramBar", result.ramUtil, classifyStatus(result.ramUtil));
    setBar("gpuBar", result.gpuUtil, result.gpuStatus);
    setBar("netBar", result.networkUtil, result.netStatus);
    mustGet("meanLatency").textContent = `${fmt(result.meanLatency, 1)} ms`;
    mustGet("p95Latency").textContent = `${fmt(result.p95Latency, 1)} ms`;
    mustGet("p99Latency").textContent = `${fmt(result.p99Latency, 1)} ms`;
    const stateDot = mustGet("stateDot");
    const stateText = mustGet("stateText");
    stateDot.style.background = colorForStatus(result.systemStatus);
    stateDot.style.boxShadow = `0 0 20px ${colorForStatus(result.systemStatus)}`;
    stateText.textContent = statusText(result.systemStatus);
    const gpus = result.requiredGpus70;
    const acceleratorLabel = currentLang === "zh"
        ? t("accelerator")
        : (gpus === 1 ? t("accelerator") : t("accelerators"));
    mustGet("bottleneckNote").textContent = `${t("bottleneck")}: ${bottleneckLabel(result)}. ${t("intentTraffic")} ${fmt(result.intentRps, 0)} req/s; ${t("gpu70")} ${gpus} ${acceleratorLabel}.`;
}
function updateTable(rows) {
    const tbody = mustGet("sweepTable");
    tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${Math.round(row.intentRatio * 100)}%</td>
      <td>${pct(row.actualIntentShare)}</td>
      <td>${fmt(row.intentRps, 0)}</td>
      <td>${pct(row.cpuUtil)}</td>
      <td>${pct(row.gpuUtil)}</td>
      <td>${fmt(row.networkGbps, 3)} Gbps</td>
      <td>${fmt(row.meanLatency, 1)} ms</td>
      <td class="status-${row.systemStatus}">${statusText(row.systemStatus)}</td>
    </tr>
  `).join("");
}
function drawChart(rows) {
    const canvas = mustGet("sweepChart");
    const ctx = canvas.getContext("2d");
    if (!ctx)
        return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fbfcf8";
    ctx.fillRect(0, 0, width, height);
    const pad = { left: 58, right: 24, top: 24, bottom: 44 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const x = (index) => pad.left + (index / (rows.length - 1)) * plotW;
    const y = (value, max) => pad.top + plotH - (clamp(value, 0, max) / max) * plotH;
    const finiteUtils = rows.flatMap((row) => [row.cpuUtil, row.gpuUtil, row.networkUtil]).filter(Number.isFinite);
    const maxUtil = Math.max(1.1, ...finiteUtils);
    ctx.strokeStyle = "#d7ddd3";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#5f6a61";
    ctx.font = "18px Aptos, Segoe UI, sans-serif";
    for (let i = 0; i <= 4; i += 1) {
        const gy = pad.top + (i / 4) * plotH;
        ctx.beginPath();
        ctx.moveTo(pad.left, gy);
        ctx.lineTo(width - pad.right, gy);
        ctx.stroke();
        ctx.fillText(`${Math.round((1 - i / 4) * maxUtil * 100)}%`, 10, gy + 6);
    }
    const series = [
        { key: "cpuUtil", label: t("cpu"), color: "#3c8b4a" },
        { key: "gpuUtil", label: t("gpu"), color: "#d66a00" },
        { key: "networkUtil", label: t("network"), color: "#1769d1" }
    ];
    for (const item of series) {
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        rows.forEach((row, index) => {
            const pointX = x(index);
            const pointY = y(row[item.key], maxUtil);
            if (index === 0)
                ctx.moveTo(pointX, pointY);
            else
                ctx.lineTo(pointX, pointY);
        });
        ctx.stroke();
        rows.forEach((row, index) => {
            ctx.fillStyle = item.color;
            ctx.fillRect(x(index) - 4, y(row[item.key], maxUtil) - 4, 8, 8);
        });
    }
    ctx.strokeStyle = "#c94d41";
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.moveTo(pad.left, y(1, maxUtil));
    ctx.lineTo(width - pad.right, y(1, maxUtil));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#1d241f";
    ctx.font = "20px Aptos, Segoe UI, sans-serif";
    rows.forEach((row, index) => {
        ctx.fillText(`${Math.round(row.intentRatio * 100)}%`, x(index) - 14, height - 14);
    });
    let legendX = pad.left;
    for (const item of series) {
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, 18, 14, 14);
        ctx.fillStyle = "#1d241f";
        ctx.fillText(item.label, legendX + 20, 32);
        legendX += 110;
    }
}
function recompute() {
    const current = evaluate();
    const rows = SWEEP.map((ratio) => evaluate(ratio));
    updateSummary(current);
    updateTable(rows);
    drawChart(rows);
}
function reset() {
    Object.entries(BASELINE).forEach(([key, value]) => {
        input[key].value = String(value);
    });
    recompute();
}
function toggleLanguage() {
    currentLang = currentLang === "en" ? "zh" : "en";
    applyTranslations();
    recompute();
}
INPUT_IDS.forEach((id) => {
    input[id].addEventListener("input", recompute);
});
mustGet("langToggle").addEventListener("click", toggleLanguage);
mustGet("resetBtn").addEventListener("click", reset);
window.addEventListener("resize", recompute);
applyTranslations();
recompute();

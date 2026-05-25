import { EVENTS } from "./config.js";
export function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function queueDelayMs(util, serviceMs) {
    if (util >= 1)
        return Infinity;
    if (util <= 0)
        return 0;
    return serviceMs * util / (1 - util);
}
function effectiveLoadMultiplier(load) {
    const boundedLoad = Math.max(0, load);
    if (boundedLoad === 0)
        return 1;
    return continuousEffectiveLoad(boundedLoad) / boundedLoad;
}
function loadBand(load) {
    const boundedLoad = Math.max(0, load);
    if (boundedLoad < 0.6)
        return 0;
    if (boundedLoad < 0.8)
        return 1;
    if (boundedLoad < 0.9)
        return 2;
    return 3;
}
function continuousEffectiveLoad(load) {
    const boundedLoad = Math.max(0, load);
    const segments = [
        { upper: 0.6, slope: 1.0 },
        { upper: 0.8, slope: 1.15 },
        { upper: 0.9, slope: 1.35 },
        { upper: Infinity, slope: 1.6 }
    ];
    let effective = 0;
    let lower = 0;
    for (const segment of segments) {
        const segmentUpper = Math.min(boundedLoad, segment.upper);
        if (segmentUpper > lower) {
            effective += (segmentUpper - lower) * segment.slope;
        }
        if (boundedLoad < segment.upper)
            break;
        lower = segment.upper;
    }
    return effective;
}
export function classifyStatus(util, degraded = 0.7, highRisk = 0.85) {
    if (util >= 1)
        return "unstable";
    if (util >= highRisk)
        return "high_risk";
    if (util >= degraded)
        return "degraded";
    return "stable";
}
export function fmt(value, digits = 1) {
    if (!Number.isFinite(value))
        return "unstable";
    return value.toLocaleString(undefined, {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits
    });
}
export function pct(value, digits = 1) {
    if (!Number.isFinite(value))
        return "unstable";
    return `${(value * 100).toFixed(digits)}%`;
}
function eventLoads(num, userCountOverride = num("userCount")) {
    const users = Math.max(0, userCountOverride);
    return EVENTS.map((event) => {
        const perUserPerHour = Math.max(0, num(event.inputId));
        return {
            ...event,
            perUserPerHour,
            rps: users * perUserPerHour / 3600
        };
    });
}
function weightedAverage(events, totalRps, key) {
    if (totalRps <= 0)
        return 0;
    return events.reduce((sum, event) => {
        const value = event[key];
        return typeof value === "number" ? sum + event.rps * value : sum;
    }, 0) / totalRps;
}
export function evaluate(num, intentRatioPercent = num("intentRatio"), userCountOverride = num("userCount")) {
    const events = eventLoads(num, userCountOverride);
    const totalRps = events.reduce((sum, event) => sum + event.rps, 0);
    const intentCandidateRps = totalRps;
    const intentRatio = clamp(intentRatioPercent / 100, 0, 1);
    const intentRps = intentCandidateRps * intentRatio;
    const actualIntentShare = totalRps > 0 ? intentRps / totalRps : 0;
    const baseCpuAvg = weightedAverage(events, totalRps, "baseCpuMs");
    const baseBandwidthAvg = weightedAverage(events, totalRps, "baseBandwidthKb");
    const baseLatencyAvg = weightedAverage(events, totalRps, "baseLatencyMs");
    const linearCpuMsPerRequest = baseCpuAvg
        + actualIntentShare * Math.max(0, num("intentCpu"))
        + (1 - actualIntentShare) * Math.max(0, num("nonIntentCpu"));
    const cpuCores = Math.max(1, num("cpuCores"));
    const linearCpuCoreDemand = totalRps * linearCpuMsPerRequest / 1000;
    const linearCpuUtil = linearCpuCoreDemand / cpuCores;
    const cpuLoadBand = loadBand(linearCpuUtil);
    const cpuNonlinearMultiplier = effectiveLoadMultiplier(linearCpuUtil);
    const cpuMsPerRequest = linearCpuMsPerRequest * cpuNonlinearMultiplier;
    const cpuCoreDemand = totalRps * cpuMsPerRequest / 1000;
    const cpuUtil = cpuCoreDemand / cpuCores;
    const cpuDelay = queueDelayMs(cpuUtil, cpuMsPerRequest);
    const bandwidthKbPerRequest = baseBandwidthAvg + actualIntentShare * Math.max(0, num("intentBandwidthKb"));
    const linearNetworkGbps = totalRps * bandwidthKbPerRequest * 8 / 1000000;
    const linearNetworkUtil = linearNetworkGbps / Math.max(1, num("nicGbps"));
    const networkLoadBand = loadBand(linearNetworkUtil);
    const networkNonlinearMultiplier = effectiveLoadMultiplier(linearNetworkUtil);
    const networkGbps = linearNetworkGbps * networkNonlinearMultiplier;
    const networkUtil = networkGbps / Math.max(1, num("nicGbps"));
    const networkDelay = queueDelayMs(networkUtil, 0.1);
    const qwen3InvocationRatio = clamp(num("qwen3InvocationRatio") / 100, 0, 1);
    const qwen3InputTokens = Math.max(1, num("qwen3InputTokens"));
    const qwen3OutputTokens = Math.max(1, num("qwen3OutputTokens"));
    const qwen3TokensPerRequest = qwen3InputTokens + qwen3OutputTokens;
    const qwen3TokenCapacity = Math.max(1, num("qwen3TokenCapacity"));
    const qwen3TensorParallel = Math.max(1, Math.ceil(num("qwen3TensorParallel")));
    const qwen3NpuCount = Math.max(0, Math.floor(num("qwen3NpuCount")));
    const qwen3AvailableReplicas = Math.floor(qwen3NpuCount / qwen3TensorParallel);
    const qwen3ClusterCapacity = qwen3AvailableReplicas * qwen3TokenCapacity;
    const qwen3RequestRps = intentRps * qwen3InvocationRatio;
    const qwen3TokenDemand = qwen3RequestRps * qwen3TokensPerRequest;
    const qwen3RawUtil = qwen3ClusterCapacity > 0 ? qwen3TokenDemand / qwen3ClusterCapacity : 0;
    const qwen3LoadBand = loadBand(qwen3RawUtil);
    const qwen3NonlinearMultiplier = effectiveLoadMultiplier(qwen3RawUtil);
    const qwen3EffectiveTokenDemand = qwen3TokenDemand * qwen3NonlinearMultiplier;
    const npuUtil = qwen3ClusterCapacity > 0 ? qwen3EffectiveTokenDemand / qwen3ClusterCapacity : 0;
    const npuQueueDelay = qwen3ClusterCapacity > 0 ? queueDelayMs(npuUtil, 1000 / qwen3ClusterCapacity) : 0;
    const qwen3Latency = Math.max(0, num("qwen3LatencyMs")) + npuQueueDelay;
    const activeQwen3Requests = qwen3RequestRps * Math.max(0, num("qwen3LatencyMs")) / 1000;
    const activeNpuCount = qwen3AvailableReplicas * qwen3TensorParallel;
    const npuHbmGb = qwen3RequestRps > 0 ? activeNpuCount * 16 + activeQwen3Requests * 4 / 1024 : 0;
    const productionHbmGb = qwen3NpuCount * Math.max(1, num("npuHbmPerNpuGb"));
    const npuHbmUtil = productionHbmGb > 0 ? npuHbmGb / productionHbmGb : 0;
    const activeRequests = totalRps * baseLatencyAvg / 1000;
    const ramGb = 32 + activeRequests * 128 / 1024 / 1024;
    const ramUtil = ramGb / Math.max(1, num("ramGb"));
    const memoryTrafficKb = (1 - actualIntentShare) * 64 + actualIntentShare * 512;
    const memoryTrafficGbps = totalRps * memoryTrafficKb * 8 / 1000000;
    let meanLatency = 0;
    for (const event of events) {
        const eventShare = totalRps > 0 ? event.rps / totalRps : 0;
        const eventIntentShare = intentRatio;
        const nonIntentLatency = event.baseLatencyMs + 1 + cpuDelay + networkDelay;
        const intentLatency = event.baseLatencyMs
            + 4
            + Math.max(0, num("intentCpu"))
            + qwen3InvocationRatio * qwen3Latency
            + cpuDelay
            + networkDelay;
        meanLatency += eventShare * ((1 - eventIntentShare) * nonIntentLatency + eventIntentShare * intentLatency);
    }
    const bottleneckUtil = Math.max(cpuUtil, npuUtil, networkUtil);
    const unstable = cpuUtil >= 1 || npuUtil >= 1 || networkUtil >= 1 || !Number.isFinite(meanLatency);
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
    return {
        totalRps,
        intentCandidateRps,
        intentRatio,
        actualIntentShare,
        intentRps,
        cpuMsPerRequest,
        cpuLoadBand,
        cpuNonlinearMultiplier,
        cpuCoreDemand,
        cpuUtil,
        ramGb,
        ramUtil,
        memoryTrafficGbps,
        npuUtil,
        qwen3RequestRps,
        qwen3TokenDemand,
        qwen3RawUtil,
        qwen3LoadBand,
        qwen3NonlinearMultiplier,
        qwen3EffectiveTokenDemand,
        qwen3AvailableReplicas,
        npuHbmGb,
        npuHbmUtil,
        networkGbps,
        networkLoadBand,
        networkNonlinearMultiplier,
        networkUtil,
        meanLatency,
        p95Latency,
        p99Latency,
        systemStatus,
        cpuStatus: classifyStatus(cpuUtil),
        npuStatus: classifyStatus(npuUtil),
        netStatus: classifyStatus(networkUtil),
        events
    };
}

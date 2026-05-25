export const BASELINE = {
    userCount: 3600000,
    pduSessionsPerUser: 2,
    intentRatio: 10,
    cpuCores: 256,
    nicGbps: 100,
    ramGb: 256,
    npuHbmPerNpuGb: 32,
    qwen3InvocationRatio: 10,
    qwen3InputTokens: 128,
    qwen3OutputTokens: 4,
    qwen3TokenCapacity: 15040,
    qwen3TensorParallel: 4,
    qwen3TargetUtil: 70,
    nonIntentCpu: 0.3,
    intentCpu: 2.0,
    qwen3LatencyMs: 8,
    intentBandwidthKb: 12
};
export const EVENTS = [
    { key: "initialRegistration", inputId: "eventInitialRegistration", labelKey: "initialRegistration", tipKey: "initialRegistrationTip", perUserPerHour: 0.1, baseLatencyMs: 30, baseCpuMs: 2.0, baseBandwidthKb: 12 },
    { key: "periodicRegistration", inputId: "eventPeriodicRegistration", labelKey: "periodicRegistration", tipKey: "periodicRegistrationTip", perUserPerHour: 0.1, baseLatencyMs: 25, baseCpuMs: 1.5, baseBandwidthKb: 10 },
    { key: "mobilityRegistration", inputId: "eventMobilityRegistration", labelKey: "mobilityRegistration", tipKey: "mobilityRegistrationTip", perUserPerHour: 7.0, baseLatencyMs: 30, baseCpuMs: 2.0, baseBandwidthKb: 12 },
    { key: "initialPdu", inputId: "eventInitialPdu", labelKey: "initialPdu", tipKey: "initialPduTip", perUserPerHour: 1.0, baseLatencyMs: 40, baseCpuMs: 2.5, baseBandwidthKb: 16 },
    { key: "pduRelease", inputId: "eventPduRelease", labelKey: "pduRelease", tipKey: "pduReleaseTip", perUserPerHour: 1.0, baseLatencyMs: 25, baseCpuMs: 1.5, baseBandwidthKb: 10 },
    { key: "pduModification", inputId: "eventPduModification", labelKey: "pduModification", tipKey: "pduModificationTip", perUserPerHour: 2.0, baseLatencyMs: 30, baseCpuMs: 2.0, baseBandwidthKb: 12 },
    { key: "serviceRequest", inputId: "eventServiceRequest", labelKey: "serviceRequest", tipKey: "serviceRequestTip", perUserPerHour: 21.0, baseLatencyMs: 20, baseCpuMs: 1.2, baseBandwidthKb: 8 },
    { key: "anRelease", inputId: "eventAnRelease", labelKey: "anRelease", tipKey: "anReleaseTip", perUserPerHour: 35.0, baseLatencyMs: 15, baseCpuMs: 0.8, baseBandwidthKb: 6 },
    { key: "handover", inputId: "eventHandover", labelKey: "handover", tipKey: "handoverTip", perUserPerHour: 23.1, baseLatencyMs: 25, baseCpuMs: 1.8, baseBandwidthKb: 12 },
    { key: "paging", inputId: "eventPaging", labelKey: "paging", tipKey: "pagingTip", perUserPerHour: 14.0, baseLatencyMs: 12, baseCpuMs: 0.6, baseBandwidthKb: 4 }
];
export const SWEEP = [0, 1, 5, 10, 20, 50, 100];
export const USER_COUNT_SWEEP = [100000, 1000000, 3600000, 5000000, 10000000];
export const USER_COUNT_SWEEP_INTENT_RATIO = 20;
export const MODEL_INPUT_IDS = [
    "userCount",
    "pduSessionsPerUser",
    "intentRatio",
    "cpuCores",
    "nicGbps",
    "ramGb",
    "npuHbmPerNpuGb",
    "qwen3InvocationRatio",
    "qwen3InputTokens",
    "qwen3OutputTokens",
    "qwen3TokenCapacity",
    "qwen3TensorParallel",
    "qwen3TargetUtil",
    "nonIntentCpu",
    "intentCpu",
    "qwen3LatencyMs",
    "intentBandwidthKb"
];
export const INPUT_IDS = [...MODEL_INPUT_IDS, ...EVENTS.map((event) => event.inputId)];

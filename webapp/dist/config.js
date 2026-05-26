export const BASELINE = {
    userCount: 3600000,
    pduSessionsPerUser: 2,
    intentRatio: 10,
    cpuCores: 256,
    nicGbps: 100,
    ramGb: 256,
    qwen3NpuCount: 128,
    npuHbmPerNpuGb: 32,
    qwen3InvocationRatio: 10,
    qwen3InputTokens: 2000,
    qwen3OutputTokens: 100,
    qwen3TokenCapacity: 15591.71,
    qwen3TensorParallel: 4,
    nonIntentCpu: 0.3,
    intentCpu: 2.0,
    intentBandwidthKb: 12
};
export const EVENTS = [
    { key: "initialRegistration", inputId: "eventInitialRegistration", labelKey: "initialRegistration", tipKey: "initialRegistrationTip", perUserPerHour: 0.1, baseCpuMs: 2.0, baseBandwidthKb: 12 },
    { key: "periodicRegistration", inputId: "eventPeriodicRegistration", labelKey: "periodicRegistration", tipKey: "periodicRegistrationTip", perUserPerHour: 0.1, baseCpuMs: 1.5, baseBandwidthKb: 10 },
    { key: "mobilityRegistration", inputId: "eventMobilityRegistration", labelKey: "mobilityRegistration", tipKey: "mobilityRegistrationTip", perUserPerHour: 7.0, baseCpuMs: 2.0, baseBandwidthKb: 12 },
    { key: "initialPdu", inputId: "eventInitialPdu", labelKey: "initialPdu", tipKey: "initialPduTip", perUserPerHour: 1.0, baseCpuMs: 2.5, baseBandwidthKb: 16 },
    { key: "pduRelease", inputId: "eventPduRelease", labelKey: "pduRelease", tipKey: "pduReleaseTip", perUserPerHour: 1.0, baseCpuMs: 1.5, baseBandwidthKb: 10 },
    { key: "pduModification", inputId: "eventPduModification", labelKey: "pduModification", tipKey: "pduModificationTip", perUserPerHour: 2.0, baseCpuMs: 2.0, baseBandwidthKb: 12 },
    { key: "serviceRequest", inputId: "eventServiceRequest", labelKey: "serviceRequest", tipKey: "serviceRequestTip", perUserPerHour: 21.0, baseCpuMs: 1.2, baseBandwidthKb: 8 },
    { key: "anRelease", inputId: "eventAnRelease", labelKey: "anRelease", tipKey: "anReleaseTip", perUserPerHour: 35.0, baseCpuMs: 0.8, baseBandwidthKb: 6 },
    { key: "handover", inputId: "eventHandover", labelKey: "handover", tipKey: "handoverTip", perUserPerHour: 23.1, baseCpuMs: 1.8, baseBandwidthKb: 12 },
    { key: "paging", inputId: "eventPaging", labelKey: "paging", tipKey: "pagingTip", perUserPerHour: 14.0, baseCpuMs: 0.6, baseBandwidthKb: 4 }
];
export const TABLE_SWEEP = Array.from({ length: 11 }, (_, index) => index * 10);
export const CHART_SWEEP = Array.from({ length: 101 }, (_, index) => index);
export const USER_COUNT_SWEEP = [
    500000,
    1000000,
    1500000,
    2000000,
    2500000,
    3000000,
    3500000,
    4000000
];
export const USER_COUNT_SWEEP_INTENT_RATIO = 20;
export const MODEL_INPUT_IDS = [
    "userCount",
    "pduSessionsPerUser",
    "intentRatio",
    "cpuCores",
    "nicGbps",
    "ramGb",
    "qwen3NpuCount",
    "npuHbmPerNpuGb",
    "qwen3InvocationRatio",
    "qwen3InputTokens",
    "qwen3OutputTokens",
    "qwen3TokenCapacity",
    "qwen3TensorParallel",
    "nonIntentCpu",
    "intentCpu",
    "intentBandwidthKb"
];
export const INPUT_IDS = [...MODEL_INPUT_IDS, ...EVENTS.map((event) => event.inputId)];

import { BASELINE, CHART_SWEEP, EVENTS, INPUT_IDS, TABLE_SWEEP, USER_COUNT_SWEEP, USER_COUNT_SWEEP_INTENT_RATIO } from "./config.js";
import { I18N } from "./i18n.js";
import { clamp, classifyStatus, evaluate as evaluateModel, fmt, pct } from "./model.js";
let currentLang = "en";
function t(key) {
    return I18N[currentLang][key] ?? I18N.en[key] ?? key;
}
function statusText(name) {
    return t(name);
}
function mustGet(id) {
    const node = document.getElementById(id);
    if (!node) {
        throw new Error(`Missing DOM element: ${id}`);
    }
    return node;
}
function exportCanvasPng(button) {
    const chartId = button.dataset.exportChart;
    const filename = button.dataset.exportFilename ?? "agentic-resource-chart.png";
    if (!chartId)
        return;
    const canvas = mustGet(chartId);
    canvas.toBlob((blob) => {
        if (!blob)
            return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }, "image/png");
}
const input = Object.fromEntries(INPUT_IDS.map((id) => [id, mustGet(id)]));
function num(id) {
    const value = Number(input[id].value);
    return Number.isFinite(value) ? value : 0;
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
        [t("npuInference"), result.npuUtil],
        [t("network"), result.networkUtil],
        [t("ram"), result.ramUtil]
    ];
    pairs.sort((a, b) => b[1] - a[1]);
    return pairs[0][0];
}
function updateEventTable(result) {
    const tbody = mustGet("eventTable");
    tbody.innerHTML = result.events.map((event) => `
    <tr>
      <td>${t(event.labelKey)}</td>
      <td>${fmt(event.perUserPerHour, 2)}</td>
      <td>${fmt(event.rps, 0)}</td>
    </tr>
  `).join("");
}
function updateSummary(result) {
    mustGet("intentRatioLabel").textContent = `${Math.round(result.intentRatio * 100)}%`;
    mustGet("actualIntentLabel").textContent = `${pct(result.actualIntentShare)} ${t("allRequests")}`;
    mustGet("trafficHint").textContent =
        `${t("totalTraffic")}: ${fmt(result.totalRps, 0)} req/s; ${fmt(result.intentCandidateRps, 0)} req/s ${t("intentCapableTraffic")}; ${fmt(num("userCount"), 0)} ${t("users")}; ${fmt(num("pduSessionsPerUser"), 1)} ${t("sessionsPerUser")}.`;
    mustGet("cpuDemand").textContent = `${fmt(result.cpuCoreDemand, 1)} ${t("coresUnit")}`;
    mustGet("ramDemand").textContent = `${fmt(result.ramGb, 1)} GB`;
    mustGet("npuDemand").textContent = pct(result.npuUtil);
    mustGet("netDemand").textContent = `${fmt(result.networkGbps, 3)} Gbps`;
    setBar("cpuBar", result.cpuUtil, result.cpuStatus);
    setBar("ramBar", result.ramUtil, classifyStatus(result.ramUtil));
    setBar("npuBar", result.npuUtil, result.npuStatus);
    setBar("netBar", result.networkUtil, result.netStatus);
    const stateDot = mustGet("stateDot");
    const stateText = mustGet("stateText");
    stateDot.style.background = colorForStatus(result.systemStatus);
    stateDot.style.boxShadow = `0 0 20px ${colorForStatus(result.systemStatus)}`;
    stateText.textContent = statusText(result.systemStatus);
    mustGet("bottleneckNote").textContent = `${t("bottleneck")}: ${bottleneckLabel(result)}. ${t("intentTraffic")} ${fmt(result.intentRps, 0)} req/s; Qwen3 ${fmt(result.qwen3RequestRps, 0)} req/s / ${fmt(result.qwen3EffectiveTokenDemand, 0)} ${t("effectiveTokens")}; ${t("qwen3ClusterUtil")} ${pct(result.npuUtil)}.`;
    updateEventTable(result);
}
function updateTable(rows) {
    const tbody = mustGet("sweepTable");
    tbody.innerHTML = rows.map((row) => `
    <tr>
      <td>${Math.round(row.intentRatio * 100)}%</td>
      <td>${pct(row.actualIntentShare)}</td>
      <td>${fmt(row.intentRps, 0)}</td>
      <td>${fmt(row.qwen3EffectiveTokenDemand, 0)}</td>
      <td>${pct(row.cpuUtil)}</td>
      <td>${pct(row.npuUtil)}</td>
      <td>${fmt(row.networkGbps, 3)} Gbps</td>
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
    const pad = { left: 86, right: 32, top: 24, bottom: 44 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const x = (index) => pad.left + (index / (rows.length - 1)) * plotW;
    const y = (value, max) => pad.top + plotH - (clamp(value, 0, max) / max) * plotH;
    const isMajorIntentTick = (row) => Math.round(row.intentRatio * 100) % 10 === 0;
    const finiteUtils = rows.flatMap((row) => [row.cpuUtil, row.networkUtil, row.npuUtil]).filter(Number.isFinite);
    const maxUtil = Math.max(1.1, ...finiteUtils);
    ctx.strokeStyle = "#d7ddd3";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#37423b";
    ctx.font = "18px Aptos, Segoe UI, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i += 1) {
        const gy = pad.top + (i / 4) * plotH;
        ctx.beginPath();
        ctx.moveTo(pad.left, gy);
        ctx.lineTo(width - pad.right, gy);
        ctx.stroke();
        ctx.fillText(`${Math.round((1 - i / 4) * maxUtil * 100)}%`, pad.left - 14, gy);
    }
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, height - pad.bottom);
    ctx.stroke();
    ctx.textBaseline = "alphabetic";
    const utilSeries = [
        { key: "cpuUtil", label: t("cpu"), color: "#3c8b4a" },
        { key: "networkUtil", label: t("network"), color: "#1769d1" },
        { key: "npuUtil", label: t("npuInference"), color: "#d66a00" }
    ];
    for (const item of utilSeries) {
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
            if (!isMajorIntentTick(row))
                return;
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
    ctx.textAlign = "center";
    rows.forEach((row, index) => {
        if (!isMajorIntentTick(row))
            return;
        ctx.fillText(`${Math.round(row.intentRatio * 100)}%`, x(index), height - 14);
    });
    let legendX = pad.left;
    ctx.textAlign = "left";
    const legend = utilSeries;
    for (const item of legend) {
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, 18, 14, 14);
        ctx.fillStyle = "#1d241f";
        ctx.fillText(item.label, legendX + 20, 32);
        legendX += item.label.length > 14 ? 190 : 120;
    }
}
function drawUserCountChart() {
    const canvas = mustGet("userCountChart");
    const ctx = canvas.getContext("2d");
    if (!ctx)
        return;
    const rows = USER_COUNT_SWEEP.map((users) => evaluateModel(num, USER_COUNT_SWEEP_INTENT_RATIO, users));
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fbfcf8";
    ctx.fillRect(0, 0, width, height);
    const pad = { left: 86, right: 32, top: 24, bottom: 44 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;
    const x = (index) => pad.left + (index / (rows.length - 1)) * plotW;
    const y = (value, max) => pad.top + plotH - (clamp(value, 0, max) / max) * plotH;
    const finiteUtils = rows.flatMap((row) => [row.cpuUtil, row.networkUtil, row.npuUtil]).filter(Number.isFinite);
    const maxUtil = Math.max(1.1, ...finiteUtils);
    ctx.strokeStyle = "#d7ddd3";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#37423b";
    ctx.font = "18px Aptos, Segoe UI, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i += 1) {
        const gy = pad.top + (i / 4) * plotH;
        ctx.beginPath();
        ctx.moveTo(pad.left, gy);
        ctx.lineTo(width - pad.right, gy);
        ctx.stroke();
        ctx.fillText(`${Math.round((1 - i / 4) * maxUtil * 100)}%`, pad.left - 14, gy);
    }
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, height - pad.bottom);
    ctx.stroke();
    ctx.textBaseline = "alphabetic";
    const utilSeries = [
        { key: "cpuUtil", label: t("cpu"), color: "#3c8b4a" },
        { key: "networkUtil", label: t("network"), color: "#1769d1" },
        { key: "npuUtil", label: t("npuInference"), color: "#d66a00" }
    ];
    for (const item of utilSeries) {
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
    ctx.textAlign = "center";
    rows.forEach((row, index) => {
        ctx.fillText(`${fmt(row.totalRps ? USER_COUNT_SWEEP[index] / 1000000 : 0, 1)}M`, x(index), height - 14);
    });
    let legendX = pad.left;
    ctx.textAlign = "left";
    const legend = utilSeries;
    for (const item of legend) {
        ctx.fillStyle = item.color;
        ctx.fillRect(legendX, 18, 14, 14);
        ctx.fillStyle = "#1d241f";
        ctx.fillText(item.label, legendX + 20, 32);
        legendX += item.label.length > 14 ? 190 : 120;
    }
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
    mustGet("sweepChart").setAttribute("aria-label", t("intentSweepAria"));
    mustGet("userCountChart").setAttribute("aria-label", t("userCountSweepAria"));
}
function recompute() {
    const current = evaluateModel(num);
    const tableRows = TABLE_SWEEP.map((ratio) => evaluateModel(num, ratio));
    const chartRows = CHART_SWEEP.map((ratio) => evaluateModel(num, ratio));
    updateSummary(current);
    updateTable(tableRows);
    drawChart(chartRows);
    drawUserCountChart();
}
function reset() {
    Object.entries(BASELINE).forEach(([key, value]) => {
        input[key].value = String(value);
    });
    for (const event of EVENTS) {
        input[event.inputId].value = String(event.perUserPerHour);
    }
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
document.querySelectorAll("[data-export-chart]").forEach((button) => {
    button.addEventListener("click", () => exportCanvasPng(button));
});
mustGet("langToggle").addEventListener("click", toggleLanguage);
mustGet("resetBtn").addEventListener("click", reset);
window.addEventListener("resize", recompute);
applyTranslations();
recompute();

import type { Metric } from "./metrics";

export type Limits = Pick<Metric, "warningLow" | "warningHigh" | "criticalLow" | "criticalHigh">;
export type Severity = "pass" | "watch" | "critical" | "unrated";
export type MetricResult = { metric: Metric; value: number; limits: Limits; severity: Severity; score: number | null; explanation: string };
export type Assessment = {
  status: "Healthy" | "Watch" | "Degraded" | "Critical" | "Insufficient data";
  score: number | null; coverage: number; measured: number; criticalCount: number; watchCount: number; hardGate: boolean;
  results: MetricResult[]; categories: { category: string; score: number; measured: number; issues: number }[];
};

const fmt = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");

function sideScore(value: number, warning: number | undefined, critical: number | undefined, isLow: boolean) {
  if (warning === undefined) return { severity: "pass" as const, score: 100 };
  if (!(isLow ? value < warning : value > warning)) return { severity: "pass" as const, score: 100 };
  if (critical === undefined) return { severity: "watch" as const, score: 60 };
  if (isLow ? value <= critical : value >= critical) return { severity: "critical" as const, score: 0 };
  const progress = Math.abs(value - warning) / Math.max(Math.abs(critical - warning), Number.EPSILON);
  return { severity: "watch" as const, score: Math.max(10, 100 - progress * 90) };
}

export function evaluateMetric(metric: Metric, value: number, limits: Limits): MetricResult {
  if (!Object.values(limits).some((limit) => typeof limit === "number")) {
    return { metric, value, limits, severity: "unrated", score: null, explanation: "Recorded for context; no screening limit is configured." };
  }
  const low = sideScore(value, limits.warningLow, limits.criticalLow, true);
  const high = sideScore(value, limits.warningHigh, limits.criticalHigh, false);
  const selected = low.score < high.score ? low : high;
  let explanation = "Within the configured normal band.";
  if (selected.severity !== "pass") {
    const below = limits.warningLow !== undefined && value < limits.warningLow;
    const threshold = selected.severity === "critical" ? (below ? limits.criticalLow : limits.criticalHigh) : (below ? limits.warningLow : limits.warningHigh);
    explanation = `${below ? "Below" : "Above"} the configured ${selected.severity} ${below ? "minimum" : "maximum"} of ${fmt(threshold as number)} ${metric.unit}.`;
  }
  return { metric, value, limits, severity: selected.severity, score: Math.round(selected.score), explanation };
}

export function assess(metrics: Metric[], values: Record<string, number | undefined>, overrides: Record<string, Partial<Limits>>): Assessment {
  const totalWeight = metrics.reduce((sum, item) => sum + item.weight, 0);
  const results = metrics.flatMap((item) => {
    const value = values[item.id];
    if (value === undefined || Number.isNaN(value)) return [];
    return [evaluateMetric(item, value, {
      warningLow: overrides[item.id]?.warningLow ?? item.warningLow,
      warningHigh: overrides[item.id]?.warningHigh ?? item.warningHigh,
      criticalLow: overrides[item.id]?.criticalLow ?? item.criticalLow,
      criticalHigh: overrides[item.id]?.criticalHigh ?? item.criticalHigh,
    })];
  });
  const measuredWeight = results.reduce((sum, result) => sum + result.metric.weight, 0);
  const coverage = totalWeight ? Math.round(measuredWeight / totalWeight * 100) : 0;
  const rated = results.filter((result) => result.score !== null);
  const ratedWeight = rated.reduce((sum, result) => sum + result.metric.weight, 0);
  const score = ratedWeight ? Math.round(rated.reduce((sum, result) => sum + (result.score as number) * result.metric.weight, 0) / ratedWeight) : null;
  const hardGate = results.some((result) => result.severity === "critical" && result.metric.safetyCritical);
  const criticalCount = results.filter((result) => result.severity === "critical").length;
  const watchCount = results.filter((result) => result.severity === "watch").length;
  let status: Assessment["status"] = "Insufficient data";
  if (results.length >= 4 && score !== null) {
    if (hardGate || score < 55) status = "Critical";
    else if (score < 75 || criticalCount > 0) status = "Degraded";
    else if (score < 90 || watchCount > 0) status = "Watch";
    else status = "Healthy";
  }
  const categories = [...new Set(metrics.map((item) => item.category))].flatMap((category) => {
    const members = results.filter((result) => result.metric.category === category && result.score !== null);
    const weight = members.reduce((sum, result) => sum + result.metric.weight, 0);
    if (!weight) return [];
    return [{ category, score: Math.round(members.reduce((sum, result) => sum + (result.score as number) * result.metric.weight, 0) / weight), measured: members.length, issues: members.filter((result) => result.severity !== "pass").length }];
  });
  return { status, score, coverage, measured: results.length, criticalCount, watchCount, hardGate, results, categories };
}


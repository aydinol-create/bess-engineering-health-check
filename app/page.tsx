"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { assess, type Limits, type MetricResult } from "@/lib/engine";
import { categories, metrics, metricById, type Metric } from "@/lib/metrics";

type Values = Record<string, number | undefined>;
type Overrides = Record<string, Partial<Limits>>;
const STORAGE_KEY = "bess-engineering-health-check-v1";
const severityRank: Record<MetricResult["severity"], number> = { critical: 0, watch: 1, unrated: 2, pass: 3 };

const healthyExample: Values = {
  cell_voltage_min: 3.25, cell_voltage_max: 3.34, cell_voltage_spread: 18, cell_voltage_stddev: 6,
  cell_coulombic_eff: 99.5, capacity_retention: 96, energy_retention: 95, available_energy: 94,
  capacity_string_spread: 2.1, dcir_growth: 9, cell_dcir_spread: 7, connection_resistance_growth: 8,
  charge_power_capability: 98, discharge_power_capability: 97, soc_estimation_error: 1.8, soc_string_spread: 2.2,
  cell_temp_min: 21, cell_temp_max: 31, cell_temp_spread: 4, temp_rise_rate: 0.3,
  thermal_derate: 0, coolant_supply_temp: 22, coolant_return_temp: 27, coolant_flow: 98,
  coolant_pressure: 101, coolant_leak_events: 0, fan_pump_availability: 100, cell_swelling: 1.1,
  string_current_spread: 5, rack_availability: 100, contactor_drop: 38, fuse_temp_delta: 5,
  insulation_resistance: 1200, ground_fault_events: 0, protection_trips: 0, breaker_open_time: 42,
  emergency_stop_failures: 0, interlock_failures: 0, offgas_ppm: 0, hydrogen_ppm: 80,
  co_ppm: 2, smoke_alarm_events: 0, fire_panel_faults: 0, suppression_availability: 100,
  ventilation_availability: 100, gas_sensor_availability: 100, pcs_efficiency: 98.1, pcs_availability: 99.5,
  active_power_tracking_error: 0.8, power_response_time: 220, total_harmonic_distortion: 2.2,
  transformer_top_oil_temp: 62, transformer_winding_temp: 79, transformer_load: 82, ups_runtime: 54,
  dc_round_trip_eff: 95, ac_round_trip_eff: 89, system_availability: 99, plant_derate: 1.5,
  missing_data: 0.2, stale_data: 0, bms_comm_errors: 1,
};

const degradedExample: Values = {
  ...healthyExample, cell_voltage_spread: 64, capacity_retention: 84, dcir_growth: 34, cell_temp_max: 48,
  cell_temp_spread: 8, coolant_flow: 78, fan_pump_availability: 88, string_current_spread: 16,
  insulation_resistance: 420, protection_trips: 1, pcs_availability: 94, ac_round_trip_eff: 80,
  system_availability: 93, missing_data: 3.2,
};

function limitValue(metric: Metric, key: keyof Limits, overrides: Overrides) {
  const value = overrides[metric.id]?.[key] ?? metric[key];
  return value === undefined ? "" : String(value);
}

function parseNumber(text: string): number | undefined {
  if (!text.trim()) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

function download(filename: string, text: string, type: string) {
  const href = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function csvCells(row: string) {
  return row.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)?.map((cell) => cell.replace(/,$/, "").replace(/^"|"$/g, "").replaceAll('""', '"')) ?? [];
}

export default function Home() {
  const [values, setValues] = useState<Values>({});
  const [overrides, setOverrides] = useState<Overrides>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [showLimits, setShowLimits] = useState(false);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [assetName, setAssetName] = useState("BESS asset 01");
  const [period, setPeriod] = useState("Latest representative cycle");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      setValues(parsed.values ?? {});
      setOverrides(parsed.overrides ?? {});
      setAssetName(parsed.assetName ?? "BESS asset 01");
      setPeriod(parsed.period ?? "Latest representative cycle");
    } catch { /* Ignore corrupt local state. */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ values, overrides, assetName, period }));
  }, [values, overrides, assetName, period]);

  const assessment = useMemo(() => assess(metrics, values, overrides), [values, overrides]);
  const resultById = useMemo(() => new Map(assessment.results.map((item) => [item.metric.id, item])), [assessment.results]);
  const filtered = useMemo(() => metrics.filter((item) => {
    const matchesCategory = category === "All categories" || item.category === category;
    const haystack = `${item.label} ${item.description} ${item.unit} ${item.id}`.toLowerCase();
    const result = resultById.get(item.id);
    return matchesCategory && haystack.includes(search.toLowerCase()) && (!onlyIssues || (result && result.severity !== "pass"));
  }), [category, search, onlyIssues, resultById]);
  const issues = useMemo(() => assessment.results.filter((item) => item.severity === "watch" || item.severity === "critical")
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.metric.weight - a.metric.weight), [assessment.results]);

  function setValue(id: string, raw: string) {
    setValues((current) => ({ ...current, [id]: parseNumber(raw) }));
  }

  function setLimit(metric: Metric, key: keyof Limits, raw: string) {
    setOverrides((current) => ({ ...current, [metric.id]: { ...current[metric.id], [key]: parseNumber(raw) } }));
  }

  function resetAll() {
    setValues({});
    setOverrides({});
    setNotice("Assessment cleared.");
  }

  function exportJson() {
    download("bess-assessment.json", JSON.stringify({ schemaVersion: 1, assetName, period, values, overrides }, null, 2), "application/json");
    setNotice("JSON assessment exported.");
  }

  function exportCsv() {
    const header = "id,label,category,value,unit,warning_low,warning_high,critical_low,critical_high\n";
    const rows = metrics.map((item) => [item.id, `"${item.label.replaceAll('"', '""')}"`, `"${item.category}"`, values[item.id] ?? "", item.unit,
      limitValue(item, "warningLow", overrides), limitValue(item, "warningHigh", overrides), limitValue(item, "criticalLow", overrides), limitValue(item, "criticalHigh", overrides)].join(",")).join("\n");
    download("bess-assessment.csv", header + rows, "text/csv");
    setNotice("CSV assessment exported.");
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".json")) {
        const parsed = JSON.parse(text);
        setValues(parsed.values ?? {});
        setOverrides(parsed.overrides ?? {});
        setAssetName(parsed.assetName ?? assetName);
        setPeriod(parsed.period ?? period);
      } else {
        const nextValues: Values = {};
        const nextOverrides: Overrides = {};
        text.split(/\r?\n/).slice(1).forEach((row) => {
          const [id, , , value, , warningLow, warningHigh, criticalLow, criticalHigh] = csvCells(row);
          if (!metricById.has(id)) return;
          nextValues[id] = parseNumber(value);
          nextOverrides[id] = { warningLow: parseNumber(warningLow), warningHigh: parseNumber(warningHigh), criticalLow: parseNumber(criticalLow), criticalHigh: parseNumber(criticalHigh) };
        });
        setValues(nextValues);
        setOverrides(nextOverrides);
      }
      setNotice(`Imported ${file.name}.`);
    } catch {
      setNotice("Import failed. Use an exported JSON or CSV file.");
    } finally { event.target.value = ""; }
  }

  const confidence = assessment.coverage >= 70 ? "High" : assessment.coverage >= 35 ? "Moderate" : "Low";
  const statusClass = assessment.status.toLowerCase().replaceAll(" ", "-");

  return (
    <main>
      <header className="topbar">
        <div><p className="eyebrow">ENGINEERING DECISION SUPPORT · GENERIC LFP SCREENING PROFILE</p><h1>BESS Engineering Health Check</h1></div>
        <div className="header-state"><i className={`status-dot status-${statusClass}`} /><div><span>ASSESSMENT</span><strong>{assessment.status}</strong></div></div>
      </header>

      <section className="safety-banner" aria-label="Safety notice">
        <strong>Screening tool — not a safety clearance.</strong>
        <span>Use existing telemetry or qualified personnel. Never open, probe, energize, or bypass a BESS based on this site. OEM limits and active protection systems remain authoritative.</span>
      </section>

      <section className="workspace-meta">
        <label>Asset / test ID<input value={assetName} onChange={(event) => setAssetName(event.target.value)} /></label>
        <label>Assessment interval<input value={period} onChange={(event) => setPeriod(event.target.value)} /></label>
        <div className="action-row">
          <button onClick={() => { setValues(healthyExample); setNotice("Healthy example loaded."); }}>Load healthy example</button>
          <button onClick={() => { setValues(degradedExample); setNotice("Degraded example loaded."); }}>Load degraded example</button>
          <button onClick={() => fileRef.current?.click()}>Import</button>
          <input ref={fileRef} className="file-input" type="file" accept=".json,.csv" onChange={importFile} />
          <button onClick={exportJson}>Export JSON</button><button onClick={exportCsv}>Export CSV</button>
          <button className="danger-button" onClick={resetAll}>Clear</button>
        </div>
      </section>

      {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss notice">×</button></div>}

      <section className="score-grid" aria-label="Assessment summary">
        <article className={`score-card primary status-panel-${statusClass}`}><span>ENGINEERING HEALTH</span><div className="score-value">{assessment.score ?? "—"}{assessment.score !== null && <small>/100</small>}</div><strong>{assessment.status}</strong></article>
        <article className="score-card"><span>DATA COVERAGE</span><div className="score-value">{assessment.coverage}<small>%</small></div><strong>{confidence} confidence · {assessment.measured}/{metrics.length} metrics</strong></article>
        <article className="score-card"><span>CRITICAL FINDINGS</span><div className="score-value critical-text">{assessment.criticalCount}</div><strong>{assessment.hardGate ? "Safety gate active" : "No safety override"}</strong></article>
        <article className="score-card"><span>WATCH FINDINGS</span><div className="score-value watch-text">{assessment.watchCount}</div><strong>{issues.length ? `${issues.length} total issues` : "No entered value flagged"}</strong></article>
      </section>

      <section className="main-grid">
        <aside className="category-panel">
          <div className="panel-heading"><span>CATEGORY SCORES</span><small>Measured only</small></div>
          {assessment.categories.length ? assessment.categories.map((item) => (
            <button className="category-score" key={item.category} onClick={() => { setCategory(item.category); setSearch(""); }}>
              <span><strong>{item.category}</strong><small>{item.measured} values · {item.issues} issues</small></span>
              <b className={item.score < 55 ? "critical-text" : item.score < 90 ? "watch-text" : "pass-text"}>{item.score}</b><i><em style={{ width: `${item.score}%` }} /></i>
            </button>
          )) : <p className="empty-copy">Enter at least four readings or load an example to generate an assessment.</p>}
        </aside>

        <section className="input-panel">
          <div className="panel-heading"><span>ENGINEERING INPUTS</span><small>{filtered.length} shown · {metrics.length} total</small></div>
          <div className="filters">
            <input type="search" placeholder="Search voltage, thermal, PCS…" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search metrics" />
            <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter category"><option>All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
            <label className="check"><input type="checkbox" checked={onlyIssues} onChange={(event) => setOnlyIssues(event.target.checked)} /> Issues only</label>
            <label className="check"><input type="checkbox" checked={showLimits} onChange={(event) => setShowLimits(event.target.checked)} /> Edit limits</label>
          </div>
          <div className="metric-table" role="table" aria-label="Battery engineering metrics">
            <div className={`metric-row metric-header ${showLimits ? "with-limits" : ""}`} role="row"><span>Metric</span><span>Reading</span>{showLimits && <><span>Warn min</span><span>Warn max</span><span>Crit min</span><span>Crit max</span></>}<span>Result</span></div>
            {filtered.map((item) => {
              const result = resultById.get(item.id);
              return <div className={`metric-row ${showLimits ? "with-limits" : ""}`} role="row" key={item.id}>
                <div className="metric-name"><strong>{item.label}{item.safetyCritical && <b title="Safety-critical hard gate">!</b>}</strong><small>{item.category}</small><p>{item.description}</p></div>
                <label className="reading"><input type="number" step="any" value={values[item.id] ?? ""} onChange={(event) => setValue(item.id, event.target.value)} aria-label={`${item.label} reading`} /><span>{item.unit}</span></label>
                {showLimits && (["warningLow", "warningHigh", "criticalLow", "criticalHigh"] as (keyof Limits)[]).map((key) => <input className="limit-input" key={key} type="number" step="any" value={limitValue(item, key, overrides)} onChange={(event) => setLimit(item, key, event.target.value)} aria-label={`${item.label} ${key}`} />)}
                <span className={`result-tag result-${result?.severity ?? "empty"}`}>{result?.severity ?? "not entered"}</span>
              </div>;
            })}
          </div>
        </section>

        <aside className="findings-panel">
          <div className="panel-heading"><span>PRIORITISED FINDINGS</span><small>{issues.length} flagged</small></div>
          {issues.length ? issues.slice(0, 20).map((item) => <article className={`finding finding-${item.severity}`} key={item.metric.id}>
            <div><span>{item.severity.toUpperCase()}</span>{item.metric.safetyCritical && <b>SAFETY GATE</b>}</div><strong>{item.metric.label}</strong>
            <p>{item.value} {item.metric.unit} — {item.explanation}</p><button onClick={() => { setCategory(item.metric.category); setSearch(item.metric.label); }}>Open input</button>
          </article>) : <p className="empty-copy">No entered metric is outside its configured limits. Coverage still determines confidence.</p>}
          {issues.length > 20 && <p className="more-copy">+ {issues.length - 20} additional findings. Use “Issues only” to review all.</p>}
        </aside>
      </section>

      <section className="method-panel">
        <div><p className="eyebrow">HOW THE RESULT IS CALCULATED</p><h2>Traceable scoring, with no hidden model</h2></div>
        <ol>
          <li><b>1</b><span><strong>Compare each reading</strong> Normal-band readings score 100. Values between warning and critical limits decline linearly toward zero.</span></li>
          <li><b>2</b><span><strong>Weight engineering significance</strong> Capacity, safety, protection, and core performance signals carry more influence than contextual counters.</span></li>
          <li><b>3</b><span><strong>Apply hard safety gates</strong> A critical safety-tagged result forces the overall result to Critical even if the weighted average is high.</span></li>
          <li><b>4</b><span><strong>Report evidence coverage</strong> Missing readings do not count as healthy. Fewer than four readings returns Insufficient data.</span></li>
        </ol>
        <p className="method-note">Default limits are a generic LFP utility-scale screening profile, not design limits. Replace them with approved cell, rack, PCS, transformer, fire-system, site, warranty, commissioning, and grid-code limits before using the result in an engineering decision.</p>
      </section>

      <footer><span>BESS ENGINEERING HEALTH CHECK</span><span>Client-side only · values remain in this browser unless exported</span></footer>
    </main>
  );
}


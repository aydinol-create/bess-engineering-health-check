# BESS Engineering Health Check

A transparent browser-based engineering screening tool for utility-scale battery energy storage systems. Enter measured values, review category scores and prioritized findings, and replace the built-in generic LFP screening limits with approved project/OEM limits.

**Live site:** https://bess-engineering-health-check.aydinol.chatgpt.site

## Assessment logic

- Normal-band readings score 100.
- Readings between warning and critical limits decline linearly toward zero.
- Metrics are weighted by engineering significance.
- A critical safety-tagged metric forces the overall status to **Critical**.
- Missing values are excluded and reported as data coverage; fewer than four readings returns **Insufficient data**.
- Score bands are Healthy ≥90, Watch 75–89, Degraded 55–74, and Critical <55. A non-safety critical finding caps the label at Degraded.

The result is deterministic: no AI model or external service interprets readings.

## Metric catalogue

The catalogue covers cell electrical behavior, capacity and energy, resistance and power, state estimation, electrochemical diagnostics, thermal performance, cooling, mechanical condition, module/rack/string balance, insulation and protection, gas and fire systems, PCS/grid behavior, transformers and auxiliaries, whole-plant performance, operating stress, and telemetry quality.

## Local use

```bash
npm install
npm run dev
```

Values are stored in browser local storage. JSON and CSV import/export are included. No readings are sent to a server by the application.

## Safety and limits

This is an engineering screening aid, not a safety clearance, protection system, or substitute for approved design documentation. Use existing telemetry or qualified personnel. Do not open, probe, energize, or bypass BESS equipment based on this tool. Cell, rack, PCS, transformer, fire-system, site, warranty, commissioning, and grid-code limits remain authoritative.

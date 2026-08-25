export type Metric = {
  id: string;
  category: string;
  label: string;
  unit: string;
  description: string;
  warningLow?: number;
  warningHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
  weight: number;
  safetyCritical?: boolean;
  decimals?: number;
};

type Limits = Partial<Pick<Metric, "warningLow" | "warningHigh" | "criticalLow" | "criticalHigh">>;
type Spec = [string, string, string, string, string, Limits, number?, boolean?, number?];

export const categories = [
  "Cell electrical", "Capacity & energy", "Resistance & power", "State estimation",
  "Electrochemical diagnostics", "Thermal", "Cooling system", "Mechanical condition",
  "Module, rack & string", "Insulation & protection", "Gas & fire safety",
  "PCS & grid interface", "Transformer & auxiliaries", "Whole-plant performance",
  "Operating stress & data quality",
] as const;

const [CE, CAP, RES, STATE, DIAG, THERM, COOL, MECH, RACK, PROT, FIRE, PCS, TX, PLANT, DATA] = categories;
const range = (warningLow: number, warningHigh: number, criticalLow: number, criticalHigh: number): Limits => ({ warningLow, warningHigh, criticalLow, criticalHigh });
const min = (warningLow: number, criticalLow: number): Limits => ({ warningLow, criticalLow });
const max = (warningHigh: number, criticalHigh: number): Limits => ({ warningHigh, criticalHigh });

const specs: Spec[] = [
  ["cell_voltage_min", CE, "Minimum cell voltage", "V", "Lowest instantaneous cell voltage in the assessed population.", range(2.90, 3.60, 2.50, 3.65), 3, true, 3],
  ["cell_voltage_max", CE, "Maximum cell voltage", "V", "Highest instantaneous cell voltage in the assessed population.", range(2.90, 3.60, 2.50, 3.65), 3, true, 3],
  ["cell_voltage_spread", CE, "Cell voltage spread", "mV", "Maximum minus minimum cell voltage at comparable SOC and load.", max(30, 80), 3, false, 0],
  ["cell_voltage_stddev", CE, "Cell voltage standard deviation", "mV", "Population dispersion at comparable SOC and load.", max(12, 30), 2],
  ["cell_rest_voltage_drift", CE, "Rest-voltage drift", "mV/day", "Open-circuit voltage change after thermal and SOC correction.", max(3, 8), 2],
  ["cell_self_discharge", CE, "Self-discharge rate", "%/month", "SOC or capacity loss while isolated at controlled temperature.", max(3, 7), 2],
  ["cell_leakage_current", CE, "Leakage current", "mA", "Unexpected steady current with the cell or string isolated.", max(5, 20), 2],
  ["cell_coulombic_eff", CE, "Coulombic efficiency", "%", "Discharge ampere-hours divided by charge ampere-hours.", min(99, 97.5), 2],
  ["cell_energy_eff", CE, "Cell energy efficiency", "%", "Cell-level discharge energy divided by charge energy.", min(94, 88), 2],
  ["balancing_duty", CE, "Balancing duty", "% time", "Share of the observation window with active balancing.", max(20, 45), 2],

  ["capacity_retention", CAP, "Capacity retention", "% BOL", "Measured usable capacity relative to beginning-of-life reference.", min(90, 80), 4],
  ["energy_retention", CAP, "Energy retention", "% BOL", "Measured usable energy relative to beginning-of-life reference.", min(90, 80), 4],
  ["available_energy", CAP, "Available energy", "% rated", "Currently dispatchable energy inside configured operating limits.", min(90, 75), 3],
  ["capacity_cell_spread", CAP, "Cell capacity spread", "% mean", "Maximum cell-capacity deviation across the population.", max(5, 10), 3],
  ["capacity_string_spread", CAP, "String capacity spread", "% mean", "Usable-capacity variation between parallel strings.", max(4, 8), 3],
  ["charge_energy", CAP, "Last charge energy", "MWh", "Energy absorbed during the selected charge interval.", {}, 1],
  ["discharge_energy", CAP, "Last discharge energy", "MWh", "Energy delivered during the selected discharge interval.", {}, 1],
  ["energy_throughput", CAP, "Lifetime energy throughput", "MWh", "Cumulative charged plus discharged energy.", {}, 1],
  ["equivalent_cycles", CAP, "Equivalent full cycles", "EFC", "Throughput normalized to rated usable energy.", {}, 1],

  ["dcir_growth", RES, "DC resistance growth", "% BOL", "Pulse-derived DCIR change from commissioning baseline.", max(20, 40), 4],
  ["cell_dcir_spread", RES, "Cell DCIR spread", "% mean", "Maximum comparable cell-resistance deviation.", max(15, 30), 3],
  ["rack_resistance_spread", RES, "Rack resistance spread", "% mean", "Effective-resistance variation between racks.", max(10, 20), 3],
  ["connection_resistance_growth", RES, "Connection resistance growth", "% baseline", "Busbar, cable, fuse, and joint resistance change.", max(20, 50), 3, true],
  ["charge_power_capability", RES, "Charge power capability", "% rated", "BMS-permitted charge power after active derates.", min(90, 70), 3],
  ["discharge_power_capability", RES, "Discharge power capability", "% rated", "BMS-permitted discharge power after active derates.", min(90, 70), 3],
  ["voltage_sag", RES, "Voltage sag at rated discharge", "% nominal", "DC voltage reduction under a defined power step.", max(8, 15), 2],
  ["voltage_recovery_time", RES, "Voltage recovery time", "s", "Settling time after a defined current interruption.", max(10, 30), 1],

  ["soc_estimation_error", STATE, "SOC estimation error", "% points", "Difference between BMS SOC and a validated reference.", max(4, 8), 3],
  ["soc_string_spread", STATE, "String SOC spread", "% points", "Maximum SOC difference between comparable strings.", max(4, 8), 3],
  ["soh_estimation_error", STATE, "SOH estimation error", "% points", "Difference between reported SOH and capacity-test result.", max(5, 10), 3],
  ["soe_estimation_error", STATE, "SOE estimation error", "% points", "Difference between estimated and measured remaining energy.", max(5, 10), 2],
  ["soc_drift", STATE, "SOC drift per cycle", "% points", "Uncorrected estimator drift over a representative cycle.", max(1.5, 4), 2],
  ["time_sync_error", STATE, "Measurement time-sync error", "ms", "Timestamp misalignment between measurement sources.", max(100, 500), 2],

  ["eis_ohmic_growth", DIAG, "EIS ohmic resistance growth", "% BOL", "High-frequency resistance change from reference spectrum.", max(20, 40), 2],
  ["eis_charge_transfer_growth", DIAG, "Charge-transfer resistance growth", "% BOL", "Mid-frequency kinetic resistance change.", max(30, 60), 2],
  ["eis_diffusion_growth", DIAG, "Diffusion impedance growth", "% BOL", "Low-frequency mass-transport impedance change.", max(35, 70), 2],
  ["ica_peak_shift", DIAG, "ICA peak shift", "mV", "Incremental-capacity peak displacement from reference.", max(25, 60), 2],
  ["dva_peak_shift", DIAG, "DVA feature shift", "mV", "Differential-voltage feature displacement from baseline.", max(25, 60), 2],
  ["relaxation_anomaly", DIAG, "Relaxation anomaly index", "% baseline", "Post-pulse relaxation deviation from the healthy baseline.", max(20, 50), 2],

  ["cell_temp_min", THERM, "Minimum cell temperature", "°C", "Lowest cell temperature in the selected interval.", range(5, 45, -10, 55), 3, true],
  ["cell_temp_max", THERM, "Maximum cell temperature", "°C", "Highest cell temperature in the selected interval.", range(5, 45, -10, 55), 4, true],
  ["cell_temp_spread", THERM, "Cell temperature spread", "°C", "Maximum temperature difference within a module or rack.", max(5, 10), 3],
  ["rack_temp_spread", THERM, "Rack temperature spread", "°C", "Maximum temperature difference between racks.", max(5, 10), 3],
  ["temp_rise_rate", THERM, "Maximum temperature rise rate", "°C/min", "Fastest observed cell or module temperature increase.", max(1, 3), 4, true],
  ["temp_sensor_spread", THERM, "Redundant sensor disagreement", "°C", "Difference between colocated temperature sensors.", max(2, 5), 2],
  ["hotspot_delta", THERM, "Thermal-image hotspot delta", "°C", "Hotspot above comparable neighboring hardware.", max(10, 25), 3, true],
  ["ambient_temp", THERM, "Ambient temperature", "°C", "Air temperature at the relevant enclosure or intake.", range(0, 40, -20, 50), 2],
  ["thermal_derate", THERM, "Thermal derating", "% rated power", "Power capability removed by thermal constraints.", max(10, 30), 3],
  ["temp_model_residual", THERM, "Thermal-model residual", "°C", "Measured temperature minus model prediction.", max(4, 8), 2],

  ["coolant_supply_temp", COOL, "Coolant supply temperature", "°C", "Liquid temperature entering battery cold plates.", range(15, 30, 5, 40), 2],
  ["coolant_return_temp", COOL, "Coolant return temperature", "°C", "Liquid temperature leaving battery cold plates.", range(15, 35, 5, 45), 2],
  ["coolant_delta_t", COOL, "Coolant temperature rise", "°C", "Return minus supply temperature under load.", max(8, 15), 2],
  ["coolant_flow", COOL, "Coolant flow", "% design", "Measured loop flow relative to required design flow.", min(90, 70), 3, true],
  ["coolant_pressure", COOL, "Coolant pressure", "% design", "Loop pressure relative to normal setpoint.", range(85, 115, 65, 135), 3, true],
  ["coolant_leak_events", COOL, "Coolant leak events", "count", "Detected leakage events in the selected period.", max(0, 1), 4, true, 0],
  ["fan_pump_availability", COOL, "Fans/pumps available", "%", "Commanded fans or pumps confirmed operational.", min(95, 80), 3, true],
  ["hvac_capacity_margin", COOL, "HVAC capacity margin", "%", "Remaining thermal capacity at assessed conditions.", min(15, 5), 3],
  ["filter_pressure_drop", COOL, "Air-filter pressure drop", "% limit", "Restriction relative to replacement/alarm limit.", max(80, 100), 2],
  ["condensation_events", COOL, "Condensation-risk events", "count", "Periods where surfaces fell below calculated dew point.", max(0, 2), 3, true, 0],

  ["cell_swelling", MECH, "Maximum cell swelling", "% thickness", "Cell thickness change from accepted baseline.", max(3, 6), 4, true],
  ["module_compression", MECH, "Module compression", "% target", "Compressive load relative to designed target.", range(85, 115, 65, 135), 3],
  ["terminal_torque_deviation", MECH, "Terminal torque deviation", "% target", "Absolute deviation from approved fastener target.", max(10, 20), 3, true],
  ["enclosure_deformation", MECH, "Enclosure deformation index", "mm", "Maximum deformation relative to accepted geometry.", max(2, 5), 3, true],
  ["vibration_rms", MECH, "Vibration RMS", "mm/s", "Equipment vibration velocity under steady operation.", max(4.5, 7.1), 2],
  ["water_ingress_events", MECH, "Water-ingress detections", "count", "Validated liquid ingress or wetness detections.", max(0, 1), 4, true, 0],

  ["module_voltage_spread", RACK, "Module voltage spread", "% mean", "Module-voltage deviation at comparable SOC/load.", max(2, 5), 3],
  ["rack_voltage_spread", RACK, "Rack voltage spread", "% mean", "Rack-voltage deviation across parallel assets.", max(2, 5), 3],
  ["string_current_spread", RACK, "String current spread", "% mean", "Current-sharing deviation between parallel strings.", max(10, 20), 3],
  ["string_power_spread", RACK, "String power spread", "% mean", "Power-sharing deviation between parallel strings.", max(10, 20), 3],
  ["rack_availability", RACK, "Rack availability", "%", "Racks capable of service relative to installed racks.", min(98, 90), 3],
  ["offline_racks", RACK, "Offline racks", "count", "Racks unavailable for dispatch.", max(0, 3), 3, false, 0],
  ["contactor_drop", RACK, "Contactor voltage drop", "mV", "Drop across a closed main contactor at defined current.", max(80, 150), 3, true],
  ["precharge_time", RACK, "Precharge completion time", "s", "Time to reach accepted DC-link voltage ratio.", max(8, 15), 2, true],
  ["fuse_temp_delta", RACK, "Fuse temperature delta", "°C", "Fuse/holder temperature above comparable hardware.", max(15, 30), 3, true],
  ["busbar_temp_delta", RACK, "Busbar joint temperature delta", "°C", "Connection hotspot above similar loaded joints.", max(15, 30), 3, true],

  ["insulation_resistance", PROT, "Insulation resistance", "kΩ", "HV-to-chassis resistance; replace defaults with OEM limits.", min(500, 100), 5, true],
  ["insulation_trend", PROT, "Insulation resistance change", "% baseline", "Reduction from a dry, healthy baseline.", max(30, 60), 4, true],
  ["ground_fault_events", PROT, "Ground-fault events", "count", "Validated ground-fault detections in the period.", max(0, 1), 5, true, 0],
  ["protection_trips", PROT, "Protection trips", "count", "Battery, PCS, or switchgear protection operations.", max(0, 2), 4, true, 0],
  ["nuisance_trip_rate", PROT, "Unexplained trip rate", "events/month", "Protection operations without confirmed initiating fault.", max(0, 2), 3],
  ["breaker_open_time", PROT, "Breaker opening time", "ms", "Measured clearing time for the relevant breaker.", max(80, 150), 4, true],
  ["contactor_weld_checks", PROT, "Failed weld checks", "count", "Contactor weld-detection test failures.", max(0, 1), 5, true, 0],
  ["emergency_stop_failures", PROT, "Emergency-stop test failures", "count", "Failed emergency-stop channels or functional tests.", max(0, 1), 5, true, 0],
  ["interlock_failures", PROT, "Interlock test failures", "count", "Failed door, disconnect, or permissive interlocks.", max(0, 1), 5, true, 0],
  ["sensor_plausibility_faults", PROT, "Sensor plausibility faults", "count", "Voltage, current, or temperature plausibility failures.", max(0, 3), 3, true, 0],

  ["offgas_ppm", FIRE, "Off-gas concentration", "ppm", "Installed off-gas sensor maximum; use certified alarm limits.", max(5, 20), 5, true],
  ["hydrogen_ppm", FIRE, "Hydrogen concentration", "ppm", "Installed hydrogen-sensor maximum.", max(1000, 4000), 5, true],
  ["co_ppm", FIRE, "Carbon monoxide concentration", "ppm", "Installed CO sensor maximum.", max(25, 100), 5, true],
  ["smoke_alarm_events", FIRE, "Smoke alarm events", "count", "Validated smoke detections in the period.", max(0, 1), 5, true, 0],
  ["fire_panel_faults", FIRE, "Fire-panel faults", "count", "Detection, notification, suppression, or supervision faults.", max(0, 1), 5, true, 0],
  ["suppression_availability", FIRE, "Suppression system available", "%", "Required suppression zones in normal/ready state.", min(100, 99.9), 5, true],
  ["ventilation_availability", FIRE, "Emergency ventilation available", "%", "Required exhaust devices available and proven.", min(100, 90), 5, true],
  ["gas_sensor_availability", FIRE, "Gas sensors available", "%", "Installed gas channels reporting valid data.", min(100, 90), 5, true],

  ["pcs_efficiency", PCS, "PCS efficiency", "%", "Converter efficiency at representative load.", min(96, 92), 3],
  ["pcs_availability", PCS, "PCS availability", "%", "Converter capacity available for dispatch.", min(98, 90), 3],
  ["active_power_tracking_error", PCS, "Active-power tracking error", "% command", "Absolute error between commanded and measured power.", max(2, 5), 3],
  ["reactive_power_tracking_error", PCS, "Reactive-power tracking error", "% command", "Absolute reactive-power command error.", max(3, 7), 2],
  ["power_response_time", PCS, "Power response time", "ms", "Time to enter tolerance after a command step.", max(500, 1500), 3],
  ["total_harmonic_distortion", PCS, "Current THD", "%", "Total harmonic distortion at the defined measurement point.", max(5, 8), 3],
  ["dc_ripple", PCS, "DC-link current ripple", "% RMS", "AC ripple component relative to DC current.", max(3, 6), 2],
  ["dc_bus_imbalance", PCS, "DC-bus imbalance", "%", "Difference between split-bus voltages or parallel inputs.", max(2, 5), 3],
  ["grid_voltage_unbalance", PCS, "Grid voltage unbalance", "%", "Negative-sequence or phase voltage unbalance.", max(2, 3), 3],
  ["pcs_faults", PCS, "PCS faults", "count", "Converter faults in the selected period.", max(0, 3), 3, true, 0],

  ["transformer_top_oil_temp", TX, "Transformer top-oil temperature", "°C", "Highest top-oil temperature in the period.", max(85, 105), 4, true],
  ["transformer_winding_temp", TX, "Transformer winding temperature", "°C", "Highest indicated or calculated winding hotspot.", max(105, 125), 4, true],
  ["transformer_load", TX, "Transformer loading", "% nameplate", "Maximum apparent-power loading.", max(95, 110), 3],
  ["transformer_dga_index", TX, "DGA condition index", "% alarm", "Worst dissolved-gas result normalized to alarm.", max(70, 100), 4, true],
  ["auxiliary_load", TX, "Auxiliary load", "% plant power", "HVAC, controls, pumps, heaters, and standby load.", max(5, 10), 2],
  ["ups_runtime", TX, "Control UPS runtime", "min", "Validated ride-through time for critical controls.", min(30, 10), 3, true],

  ["dc_round_trip_eff", PLANT, "DC round-trip efficiency", "%", "Battery-side discharge energy divided by charge energy.", min(92, 85), 3],
  ["ac_round_trip_eff", PLANT, "AC round-trip efficiency", "%", "Grid-side discharge energy divided by charge energy.", min(85, 75), 4],
  ["system_availability", PLANT, "Technical availability", "%", "Time technically capable of operation.", min(97, 90), 4],
  ["energy_tracking_error", PLANT, "Energy tracking error", "% schedule", "Delivered-energy deviation from command/test profile.", max(2, 5), 3],
  ["response_repeatability", PLANT, "Response repeatability", "% spread", "Variation across repeated equal commands.", max(3, 7), 2],
  ["parasitic_loss", PLANT, "Standby/parasitic loss", "% rated power", "Consumption while enabled but not dispatching.", max(1.5, 3), 2],
  ["plant_derate", PLANT, "Total plant derating", "% rated power", "Unavailable power due to active constraints.", max(5, 15), 3],
  ["black_start_success", PLANT, "Black-start test success", "%", "Successful tests where designed and commissioned.", min(100, 80), 2],
  ["command_success", PLANT, "Dispatch command success", "%", "Valid commands completed without rejection or timeout.", min(99, 95), 3],

  ["average_dod", DATA, "Average depth of discharge", "%", "Mean cycle depth; compare with the warranted duty profile.", max(90, 100), 2],
  ["high_soc_dwell", DATA, "High-SOC dwell", "% time", "Time above the configured high-SOC threshold.", max(20, 50), 2],
  ["low_soc_dwell", DATA, "Low-SOC dwell", "% time", "Time below the configured low-SOC threshold.", max(10, 30), 2],
  ["max_charge_c_rate", DATA, "Maximum charge C-rate", "C", "Highest sustained normalized charge current.", max(0.5, 1), 2],
  ["max_discharge_c_rate", DATA, "Maximum discharge C-rate", "C", "Highest sustained normalized discharge current.", max(0.5, 1), 2],
  ["temperature_exposure", DATA, "High-temperature exposure", "h/month", "Time above the configured normal temperature range.", max(10, 50), 2],
  ["humidity_max", DATA, "Maximum relative humidity", "% RH", "Highest enclosure or room humidity reading.", max(85, 95), 3, true],
  ["contamination_index", DATA, "Contamination index", "% limit", "Dust, salt, or conductive contamination vs approved limit.", max(70, 100), 3],
  ["missing_data", DATA, "Missing telemetry", "% samples", "Expected samples absent from the interval.", max(1, 5), 3],
  ["stale_data", DATA, "Stale telemetry", "% channels", "Channels whose values or timestamps are not updating.", max(1, 5), 3],
  ["sensor_calibration_overdue", DATA, "Calibration-overdue channels", "%", "Channels beyond their calibration interval.", max(0, 5), 3],
  ["bms_comm_errors", DATA, "BMS communication errors", "events/day", "CRC, timeout, packet-loss, or offline events.", max(5, 25), 3],
];

export const metrics: Metric[] = specs.map(([id, category, label, unit, description, limits, weight = 1, safetyCritical = false, decimals = 2]) => ({
  id, category, label, unit, description, ...limits, weight, safetyCritical, decimals,
}));

export const metricById = new Map(metrics.map((item) => [item.id, item]));


const STORAGE_KEY="bess-engineering-health-check-pages-v1";
const LIMIT_KEYS=["warningLow","warningHigh","criticalLow","criticalHigh"];
const rank={critical:0,watch:1,unrated:2,pass:3};
let metrics=[],values={},overrides={},results=[],assessment={};

const healthy={cell_voltage_min:3.25,cell_voltage_max:3.34,cell_voltage_spread:18,cell_voltage_stddev:6,cell_coulombic_eff:99.5,capacity_retention:96,energy_retention:95,available_energy:94,capacity_string_spread:2.1,dcir_growth:9,cell_dcir_spread:7,connection_resistance_growth:8,charge_power_capability:98,discharge_power_capability:97,soc_estimation_error:1.8,soc_string_spread:2.2,cell_temp_min:21,cell_temp_max:31,cell_temp_spread:4,temp_rise_rate:.3,thermal_derate:0,coolant_supply_temp:22,coolant_return_temp:27,coolant_flow:98,coolant_pressure:101,coolant_leak_events:0,fan_pump_availability:100,cell_swelling:1.1,string_current_spread:5,rack_availability:100,contactor_drop:38,fuse_temp_delta:5,insulation_resistance:1200,ground_fault_events:0,protection_trips:0,breaker_open_time:42,emergency_stop_failures:0,interlock_failures:0,offgas_ppm:0,hydrogen_ppm:80,co_ppm:2,smoke_alarm_events:0,fire_panel_faults:0,suppression_availability:100,ventilation_availability:100,gas_sensor_availability:100,pcs_efficiency:98.1,pcs_availability:99.5,active_power_tracking_error:.8,power_response_time:220,total_harmonic_distortion:2.2,transformer_top_oil_temp:62,transformer_winding_temp:79,transformer_load:82,ups_runtime:54,dc_round_trip_eff:95,ac_round_trip_eff:89,system_availability:99,plant_derate:1.5,missing_data:.2,stale_data:0,bms_comm_errors:1};
const degraded={...healthy,cell_voltage_spread:64,capacity_retention:84,dcir_growth:34,cell_temp_max:48,cell_temp_spread:8,coolant_flow:78,fan_pump_availability:88,string_current_spread:16,insulation_resistance:420,protection_trips:1,pcs_availability:94,ac_round_trip_eff:80,system_availability:93,missing_data:3.2};
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const num=v=>v===""||v==null?undefined:Number.isFinite(Number(v))?Number(v):undefined;
const limit=(m,k)=>overrides[m.id]?.[k]??m[k];

function sideScore(value,warning,critical,isLow){
  if(warning===undefined)return{severity:"pass",score:100};
  if(!(isLow?value<warning:value>warning))return{severity:"pass",score:100};
  if(critical===undefined)return{severity:"watch",score:60};
  if(isLow?value<=critical:value>=critical)return{severity:"critical",score:0};
  const progress=Math.abs(value-warning)/Math.max(Math.abs(critical-warning),Number.EPSILON);
  return{severity:"watch",score:Math.max(10,100-progress*90)};
}

function evaluate(m,value){
  const l=Object.fromEntries(LIMIT_KEYS.map(k=>[k,limit(m,k)]));
  if(!Object.values(l).some(v=>typeof v==="number"))return{metric:m,value,limits:l,severity:"unrated",score:null,explanation:"Recorded for context; no screening limit is configured."};
  const low=sideScore(value,l.warningLow,l.criticalLow,true),high=sideScore(value,l.warningHigh,l.criticalHigh,false),chosen=low.score<high.score?low:high;
  let explanation="Within the configured normal band.";
  if(chosen.severity!=="pass"){
    const below=l.warningLow!==undefined&&value<l.warningLow;
    const threshold=chosen.severity==="critical"?(below?l.criticalLow:l.criticalHigh):(below?l.warningLow:l.warningHigh);
    explanation=`${below?"Below":"Above"} the configured ${chosen.severity} ${below?"minimum":"maximum"} of ${threshold} ${m.unit}.`;
  }
  return{metric:m,value,limits:l,severity:chosen.severity,score:Math.round(chosen.score),explanation};
}

function calculate(){
  results=metrics.flatMap(m=>values[m.id]===undefined?[]:[evaluate(m,values[m.id])]);
  const totalWeight=metrics.reduce((s,m)=>s+m.weight,0),measuredWeight=results.reduce((s,r)=>s+r.metric.weight,0);
  const rated=results.filter(r=>r.score!==null),ratedWeight=rated.reduce((s,r)=>s+r.metric.weight,0);
  const score=ratedWeight?Math.round(rated.reduce((s,r)=>s+r.score*r.metric.weight,0)/ratedWeight):null;
  const hardGate=results.some(r=>r.severity==="critical"&&r.metric.safetyCritical),criticalCount=results.filter(r=>r.severity==="critical").length,watchCount=results.filter(r=>r.severity==="watch").length;
  let status="Insufficient data";
  if(results.length>=4&&score!==null){if(hardGate||score<55)status="Critical";else if(score<75||criticalCount)status="Degraded";else if(score<90||watchCount)status="Watch";else status="Healthy"}
  const categoryScores=[...new Set(metrics.map(m=>m.category))].flatMap(category=>{const members=results.filter(r=>r.metric.category===category&&r.score!==null),weight=members.reduce((s,r)=>s+r.metric.weight,0);return weight?[{category,score:Math.round(members.reduce((s,r)=>s+r.score*r.metric.weight,0)/weight),measured:members.length,issues:members.filter(r=>r.severity!=="pass").length}]:[]});
  assessment={status,score,coverage:totalWeight?Math.round(measuredWeight/totalWeight*100):0,measured:results.length,criticalCount,watchCount,hardGate,categories:categoryScores};
}

function statusClass(s){return s.toLowerCase().replaceAll(" ","-")}
function renderSummary(){
  const a=assessment,cls=statusClass(a.status),confidence=a.coverage>=70?"High":a.coverage>=35?"Moderate":"Low";
  $("header-status").textContent=a.status;$("status-dot").className=`status-dot status-${cls}`;$("health-card").className=`score-card primary status-panel-${cls}`;
  $("score").textContent=a.score??"—";$("score-suffix").textContent=a.score===null?"":"/100";$("score-status").textContent=a.status;
  $("coverage").textContent=a.coverage;$("confidence").textContent=`${confidence} confidence · ${a.measured}/${metrics.length} metrics`;
  $("critical-count").textContent=a.criticalCount;$("hard-gate").textContent=a.hardGate?"Safety gate active":"No safety override";$("watch-count").textContent=a.watchCount;
  const issues=results.filter(r=>r.severity==="critical"||r.severity==="watch");$("issue-total").textContent=issues.length?`${issues.length} total issues`:"No entered value flagged";
}

function renderCategories(){
  $("category-scores").innerHTML=assessment.categories.length?assessment.categories.map(c=>`<button class="category-score" data-category="${esc(c.category)}"><span><strong>${esc(c.category)}</strong><small>${c.measured} values · ${c.issues} issues</small></span><b class="${c.score<55?"critical-text":c.score<90?"watch-text":"pass-text"}">${c.score}</b><i><em style="width:${c.score}%"></em></i></button>`).join(""):'<p class="empty-copy">Enter at least four readings or load an example to generate an assessment.</p>';
}

function renderTable(){
  const query=$("search").value.toLowerCase(),category=$("category").value,issuesOnly=$("issues-only").checked,showLimits=$("show-limits").checked,resultMap=new Map(results.map(r=>[r.metric.id,r]));
  const filtered=metrics.filter(m=>(category==="All categories"||m.category===category)&&`${m.label} ${m.description} ${m.unit} ${m.id}`.toLowerCase().includes(query)&&(!issuesOnly||(resultMap.get(m.id)&&resultMap.get(m.id).severity!=="pass")));
  $("metric-count").textContent=`${filtered.length} shown · ${metrics.length} total`;
  const headers=showLimits?"<span>Metric</span><span>Reading</span><span>Warn min</span><span>Warn max</span><span>Crit min</span><span>Crit max</span><span>Result</span>":"<span>Metric</span><span>Reading</span><span>Result</span>";
  $("metric-table").innerHTML=`<div class="metric-row metric-header ${showLimits?"with-limits":""}">${headers}</div>`+filtered.map(m=>{const r=resultMap.get(m.id);return`<div class="metric-row ${showLimits?"with-limits":""}"><div class="metric-name"><strong>${esc(m.label)}${m.safetyCritical?'<b title="Safety-critical hard gate">!</b>':""}</strong><small>${esc(m.category)}</small><p>${esc(m.description)}</p></div><label class="reading"><input data-value="${m.id}" type="number" step="any" value="${values[m.id]??""}" aria-label="${esc(m.label)} reading"><span>${esc(m.unit)}</span></label>${showLimits?LIMIT_KEYS.map(k=>`<input class="limit-input" data-limit="${m.id}:${k}" type="number" step="any" value="${limit(m,k)??""}" aria-label="${esc(m.label)} ${k}">`).join(""):""}<span class="result-tag result-${r?.severity??"empty"}">${r?.severity??"not entered"}</span></div>`}).join("");
}

function renderFindings(){
  const issues=results.filter(r=>r.severity==="critical"||r.severity==="watch").sort((a,b)=>rank[a.severity]-rank[b.severity]||b.metric.weight-a.metric.weight);$("finding-count").textContent=`${issues.length} flagged`;
  $("findings").innerHTML=issues.length?issues.slice(0,20).map(r=>`<article class="finding finding-${r.severity}"><div><span>${r.severity.toUpperCase()}</span>${r.metric.safetyCritical?"<b>SAFETY GATE</b>":""}</div><strong>${esc(r.metric.label)}</strong><p>${r.value} ${esc(r.metric.unit)} — ${esc(r.explanation)}</p><button data-open="${esc(r.metric.id)}">Open input</button></article>`).join("")+(issues.length>20?`<p class="more-copy">+ ${issues.length-20} additional findings. Use “Issues only” to review all.</p>`:""):'<p class="empty-copy">No entered metric is outside its configured limits. Coverage still determines confidence.</p>';
}

function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify({values,overrides,assetName:$("asset-name").value,period:$("period").value}))}
function refresh(){calculate();renderSummary();renderCategories();renderTable();renderFindings();save()}
function notice(text){const n=$("notice");n.textContent=text;n.hidden=false;clearTimeout(notice.timer);notice.timer=setTimeout(()=>n.hidden=true,3000)}
function download(name,text,type){const href=URL.createObjectURL(new Blob([text],{type})),a=document.createElement("a");a.href=href;a.download=name;a.click();URL.revokeObjectURL(href)}

function exportJSON(){download("bess-assessment.json",JSON.stringify({schemaVersion:1,assetName:$("asset-name").value,period:$("period").value,values,overrides},null,2),"application/json");notice("JSON assessment exported.")}
function exportCSV(){const header="id,label,category,value,unit,warning_low,warning_high,critical_low,critical_high\n",rows=metrics.map(m=>[m.id,`"${m.label.replaceAll('"','""')}"`,`"${m.category}"`,values[m.id]??"",m.unit,...LIMIT_KEYS.map(k=>limit(m,k)??"")].join(",")).join("\n");download("bess-assessment.csv",header+rows,"text/csv");notice("CSV assessment exported.")}

async function importFile(file){try{const text=await file.text();if(file.name.toLowerCase().endsWith(".json")){const data=JSON.parse(text);values=data.values??{};overrides=data.overrides??{};$("asset-name").value=data.assetName??$("asset-name").value;$("period").value=data.period??$("period").value}else{values={};overrides={};text.split(/\r?\n/).slice(1).forEach(row=>{const cols=row.match(/("(?:[^"]|"")*"|[^,]*)(?:,|$)/g)?.map(c=>c.replace(/,$/,"").replace(/^"|"$/g,"").replaceAll('""','"'))??[],id=cols[0];if(!metrics.some(m=>m.id===id))return;values[id]=num(cols[3]);overrides[id]={warningLow:num(cols[5]),warningHigh:num(cols[6]),criticalLow:num(cols[7]),criticalHigh:num(cols[8])}})}refresh();notice(`Imported ${file.name}.`)}catch{notice("Import failed. Use an exported JSON or CSV file.")}}

document.addEventListener("input",e=>{const id=e.target.dataset.value,lim=e.target.dataset.limit;if(id){values[id]=num(e.target.value);calculate();renderSummary();renderCategories();renderFindings();save()}else if(lim){const[mid,key]=lim.split(":");overrides[mid]={...(overrides[mid]||{}),[key]:num(e.target.value)};calculate();renderSummary();renderCategories();renderFindings();save()}else if(e.target.matches("#asset-name,#period"))save()});
document.addEventListener("change",e=>{if(e.target.dataset.value||e.target.dataset.limit)refresh();else if(e.target.matches("#search,#category,#issues-only,#show-limits"))renderTable();if(e.target.id==="file-input"&&e.target.files[0]){importFile(e.target.files[0]);e.target.value=""}});
document.addEventListener("click",e=>{const action=e.target.dataset.action,cat=e.target.closest("[data-category]")?.dataset.category,open=e.target.dataset.open;if(action==="healthy"){values={...healthy};refresh();notice("Healthy example loaded.")}if(action==="degraded"){values={...degraded};refresh();notice("Degraded example loaded.")}if(action==="import")$("file-input").click();if(action==="json")exportJSON();if(action==="csv")exportCSV();if(action==="clear"){values={};overrides={};refresh();notice("Assessment cleared.")}if(cat){$("category").value=cat;$("search").value="";renderTable()}if(open){const m=metrics.find(x=>x.id===open);$("category").value=m.category;$("search").value=m.label;renderTable();document.querySelector(".input-panel").scrollIntoView({behavior:"smooth"})}});

fetch("metrics.json").then(r=>{if(!r.ok)throw new Error("Metric catalogue unavailable");return r.json()}).then(data=>{metrics=data;[...new Set(metrics.map(m=>m.category))].forEach(c=>$("category").insertAdjacentHTML("beforeend",`<option>${esc(c)}</option>`));try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));values=saved?.values??{};overrides=saved?.overrides??{};if(saved?.assetName)$("asset-name").value=saved.assetName;if(saved?.period)$("period").value=saved.period}catch{}refresh()}).catch(()=>{$("metric-count").textContent="Unable to load metric catalogue";notice("The metric catalogue could not be loaded. Refresh the page.")});


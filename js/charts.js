// ===== CHARTS: one look for every chart on the site =====
function cssVar(n){ return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function shortDay(ymd){ return fmtDay(ymd); }
function baseChartOptions(extra){
  const dim=cssVar('--text-dim'), grid=cssVar('--grid')||cssVar('--border'), text=cssVar('--text');
  const o = {responsive:true, maintainAspectRatio:false, animation:{duration:300},
    interaction:{mode:'index', intersect:false},
    plugins:{
      legend:{position:'top', align:'end', labels:{color:text, usePointStyle:true, pointStyle:'circle', boxWidth:8, boxHeight:8, padding:14, font:{size:12, weight:'600'}}},
      tooltip:{backgroundColor:'#0f1d2a', titleFont:{weight:'700'}, padding:10, cornerRadius:8, boxPadding:4, usePointStyle:true,
        callbacks:{label:(c)=>` ${c.dataset.label}: ${Number(c.parsed.y).toLocaleString()}`}}},
    scales:{
      x:{ticks:{color:dim, maxRotation:0, autoSkipPadding:14, font:{size:11}}, grid:{display:false}, border:{color:grid}},
      y:{beginAtZero:true, ticks:{color:dim, precision:0, font:{size:11}, callback:v=>Number(v).toLocaleString()}, grid:{color:grid}, border:{display:false}}}};
  return Object.assign(o, extra||{});
}
function newChart(id, cfg){
  const el=document.getElementById(id); if(!el || typeof Chart==='undefined') return;
  if(charts[id]) charts[id].destroy();
  charts[id] = new Chart(el, cfg);
}
// Calls per day: dials as light bars, connects as a line (same unit, one axis)
function drawCallsTrend(id, dates, dials, connects, color){
  const accent = color || cssVar('--accent');
  newChart(id, {type:'bar', data:{labels:dates.map(shortDay), datasets:[
    {type:'line', label:'Connected', data:connects, borderColor:accent, backgroundColor:accent, borderWidth:2, tension:.3, pointRadius:dates.length>20?0:3, pointHoverRadius:5, order:0},
    {type:'bar', label:'Dials', data:dials, backgroundColor:cssVar('--bar-neutral')||'#dfe5ec', hoverBackgroundColor:'#c9d2dc', borderRadius:4, borderSkipped:'bottom', maxBarThickness:28, order:1},
  ]}, options:baseChartOptions()});
}
// Conversions per day (one series, so no legend)
function drawConvDaily(id, dates, data, color){
  const c = color || cssVar('--conv');
  const o = baseChartOptions(); o.plugins.legend={display:false};
  newChart(id, {type:'bar', data:{labels:dates.map(shortDay), datasets:[
    {label:'Conversions', data, backgroundColor:c, borderRadius:4, borderSkipped:'bottom', maxBarThickness:28}]}, options:o});
}
// tiny line inside a scorecard
function drawSpark(id, data, color){
  newChart(id, {type:'line', data:{labels:data.map((_,i)=>i), datasets:[{data, borderColor:color, backgroundColor:color+'1f', fill:true, borderWidth:2, tension:.35, pointRadius:0}]},
    options:{responsive:true, maintainAspectRatio:false, animation:false, plugins:{legend:{display:false}, tooltip:{enabled:false}},
      scales:{x:{display:false}, y:{display:false, beginAtZero:true}}}});
}

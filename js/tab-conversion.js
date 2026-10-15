// ===== PAGE 6: Conversions =====
// ===================== CONVERSION =====================
function renderConversion(){
  const app=document.getElementById('app');
  if(conversionDocs.length===0){ app.innerHTML=`<div class="empty-state">No conversion data for this range.${canWrite?' Use "Upload Conversion CSV" above.':''}</div>`; return; }
  const byAgent={}, byCampaign={}, byCity={}, byType={new:0,renewal:0,other:0};
  let total=0;
  conversionDocs.forEach(day=>{
    total += day.totalConversions||0;
    Object.entries(day.byAgent||{}).forEach(([n,v])=>{ byAgent[n]=(byAgent[n]||0)+v.count; });
    Object.entries(day.byCampaign||{}).forEach(([n,v])=>{ byCampaign[n]=(byCampaign[n]||0)+v.count; });
    Object.entries(day.byCity||{}).forEach(([n,v])=>{ byCity[n]=(byCity[n]||0)+v.count; });
    Object.entries(day.byType||{}).forEach(([k,v])=>{ byType[k]=(byType[k]||0)+v; });
  });
  const agentArr = Object.entries(byAgent).sort((a,b)=>b[1]-a[1]);
  const campArr = Object.entries(byCampaign).sort((a,b)=>b[1]-a[1]);
  const cityArr = Object.entries(byCity).sort((a,b)=>b[1]-a[1]);

  let html = `<div class="kpi-grid">
    <div class="kpi"><div class="kpi-label">Total Conversions</div><div class="kpi-value">${total.toLocaleString()}</div></div>
    <div class="kpi"><div class="kpi-label">New</div><div class="kpi-value">${(byType.new||0).toLocaleString()}</div></div>
    <div class="kpi"><div class="kpi-label">Renewal</div><div class="kpi-value">${(byType.renewal||0).toLocaleString()}</div></div>
    <div class="kpi"><div class="kpi-label">Days Covered</div><div class="kpi-value">${conversionDocs.length}</div></div>
  </div>`;
  html += `<div class="section"><h2>Daily Trend</h2><div class="chart-wrap"><canvas id="convTrend"></canvas></div></div>`;
  html += `<div class="section"><h2>By Agent</h2><table><thead><tr><th>Agent</th><th>Conversions</th></tr></thead><tbody>`;
  agentArr.forEach(([n,c])=>{ html+=`<tr><td>${escapeHtml(n)}</td><td>${c}</td></tr>`; });
  html += `</tbody></table></div>`;
  html += `<div class="section"><h2>By Campaign</h2><table><thead><tr><th>Campaign</th><th>Conversions</th></tr></thead><tbody>`;
  campArr.forEach(([n,c])=>{ html+=`<tr><td>${escapeHtml(n)}</td><td>${c}</td></tr>`; });
  html += `</tbody></table></div>`;
  if(cityArr.length){
    html += `<div class="section"><h2>By City</h2><table><thead><tr><th>City</th><th>Conversions</th></tr></thead><tbody>`;
    cityArr.forEach(([n,c])=>{ html+=`<tr><td>${escapeHtml(n)}</td><td>${c}</td></tr>`; });
    html += `</tbody></table></div>`;
  }
  app.innerHTML = html;
  drawTrend('convTrend', conversionDocs.map(d=>d.date), conversionDocs.map(d=>d.totalConversions||0), conversionDocs.map(()=>0));
}

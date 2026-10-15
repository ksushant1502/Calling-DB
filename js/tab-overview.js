// ===== PAGE 1: Overview =====
function renderOverview(){
  const app=document.getElementById('app');
  if(dayDocs.length===0){ app.innerHTML=`<div class="empty-state">No data for this range.${canWrite?' Use "Upload Calling CSV" in the left menu to get started.':''}</div>`; return; }
  const agg = aggregateOverview(null,'all');
  const connPct = agg.totalDials? agg.totalConnects/agg.totalDials*100:0;
  const campArr = Object.entries(agg.campaigns).map(([n,v])=>({name:n,...v,pct:v.dials?v.connects/v.dials*100:0})).sort((a,b)=>b.dials-a.dials);
  let agentArr = Object.entries(agg.agents).map(([n,v])=>({name:n,...v,pct:v.dials?v.connects/v.dials*100:0})).sort((a,b)=>b.dials-a.dials);
  if(CORE_CALLERS.length) agentArr = agentArr.filter(a=>CORE_CALLERS.includes(a.name));
  const totalConversions = conversionDocs.reduce((s,d)=>s+(d.totalConversions||0),0);
  const convPct = agg.totalConnects? totalConversions/agg.totalConnects*100:0;

  // roll campaigns up into types
  const convByCamp = conversionsByCampaign();
  const byType = {};
  CAMPAIGN_TYPES.forEach(t=>byType[t.id]={...t,campaigns:0,dials:0,connects:0,conversions:0});
  campArr.forEach(c=>{ const t=byType[campaignTypeOf(c.lob).id]; t.campaigns++; t.dials+=c.dials; t.connects+=c.connects; t.conversions+=(convByCamp[c.name]||0); });

  let html = `<div class="kpi-grid">
    <div class="kpi" style="--kpi-color:#3b5bfd"><div class="kpi-label">Total Dials</div><div class="kpi-value">${agg.totalDials.toLocaleString()}</div></div>
    <div class="kpi" style="--kpi-color:#7a56e8"><div class="kpi-label">Total Connects</div><div class="kpi-value">${agg.totalConnects.toLocaleString()}</div></div>
    <div class="kpi" style="--kpi-color:#d98a0b"><div class="kpi-label">Connection Rate</div><div class="kpi-value ${pctClass(connPct)}">${fmtPct(connPct)}</div></div>
    <div class="kpi" style="--kpi-color:#12a066"><div class="kpi-label">Conversions</div><div class="kpi-value pct-green">${totalConversions.toLocaleString()}</div><div class="kpi-sub">${fmtPct(convPct)} of connects</div></div>
    <div class="kpi" style="--kpi-color:#0f9a94"><div class="kpi-label">Active Campaigns</div><div class="kpi-value">${campArr.length}</div></div>
    <div class="kpi" style="--kpi-color:#c23b78"><div class="kpi-label">Active Agents</div><div class="kpi-value">${agentArr.length}</div></div>
  </div>`;

  html += `<div class="section"><h2>Daily trend</h2><div class="chart-wrap"><canvas id="trendCanvas"></canvas></div></div>`;

  html += `<h2 style="font-size:15.5px;margin:4px 0 12px;">By campaign type <span style="font-weight:500;color:var(--text-dim);font-size:12.5px;">— click a card to see its campaigns</span></h2><div class="type-grid">`;
  CAMPAIGN_TYPES.forEach(t=>{
    const x=byType[t.id]; if(!x.campaigns) return;
    const p = x.dials? x.connects/x.dials*100:0;
    html += `<div class="type-card" data-goto="campaigns" style="--tc:${t.color}">
      <div class="tc-name">${t.label}</div>
      <div class="tc-big">${x.dials.toLocaleString()}<span style="font-size:12px;font-weight:600;color:var(--text-dim);"> dials</span></div>
      <div class="tc-row"><span>Connects</span><b>${x.connects.toLocaleString()} · <span class="${pctClass(p)}">${fmtPct(p)}</span></b></div>
      <div class="tc-row"><span>Conversions</span><b>${x.conversions.toLocaleString()}</b></div>
      <div class="tc-row"><span>Campaigns</span><b>${x.campaigns}</b></div>
    </div>`;
  });
  html += `</div>`;

  html += `<div class="two-col">
    <div class="section"><h2>Top campaigns</h2><table><thead><tr><th>Campaign</th><th class="num">Dials</th><th class="num">Conn %</th></tr></thead><tbody>
      ${campArr.slice(0,8).map(c=>`<tr><td>${escapeHtml(c.name)}</td><td class="num">${c.dials.toLocaleString()}</td><td class="num ${pctClass(c.pct)}">${fmtPct(c.pct)}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="section"><h2>Top agents</h2><table><thead><tr><th>Agent</th><th class="num">Dials</th><th class="num">Conn %</th></tr></thead><tbody>
      ${agentArr.slice(0,8).map(a=>`<tr><td>${escapeHtml(a.name)}</td><td class="num">${a.dials.toLocaleString()}</td><td class="num ${pctClass(a.pct)}">${fmtPct(a.pct)}</td></tr>`).join('')}
    </tbody></table></div>
  </div>`;
  app.innerHTML = html;
  app.querySelectorAll('[data-goto]').forEach(el=>el.onclick=()=>{ activeTab='campaigns'; renderTabNav(); renderFilterControls(); refreshTab(); });
  drawTrend('trendCanvas', dayDocs.map(d=>d.date), dayDocs.map(d=>d.totalDials||0), dayDocs.map(d=>d.totalConnects||0));
}

function drawTrend(canvasId, labels, dials, connects){
  const ctx=document.getElementById(canvasId); if(!ctx) return;
  if(charts[canvasId]) charts[canvasId].destroy();
  const st=getComputedStyle(document.documentElement);
  const accent=st.getPropertyValue('--accent').trim(), green=st.getPropertyValue('--green').trim();
  const dim=st.getPropertyValue('--text-dim').trim(), border=st.getPropertyValue('--border').trim(), text=st.getPropertyValue('--text').trim();
  charts[canvasId] = new Chart(ctx,{type:'line',data:{labels,datasets:[
    {label:'Dials',data:dials,borderColor:accent,backgroundColor:accent+'22',fill:true,tension:0.3,pointRadius:3},
    {label:'Connects',data:connects,borderColor:green,backgroundColor:'transparent',tension:0.3,pointRadius:3},
  ]},options:{responsive:true,maintainAspectRatio:false,
    plugins:{legend:{labels:{color:text,usePointStyle:true,boxWidth:8}}},
    scales:{x:{ticks:{color:dim},grid:{display:false}}, y:{ticks:{color:dim},grid:{color:border}}}}});
}

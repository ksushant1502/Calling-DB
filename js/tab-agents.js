// ===== PAGE 3: Agents =====
// ===================== AGENTS =====================
function aggregateAgentPerformance(){
  const rows={};
  dayDocs.forEach(day=>{
    Object.entries(day.agents||{}).forEach(([agent,v])=>{
      Object.entries(v.byLob||{}).forEach(([lob,lv])=>{
        if(!lobInFilter(lob)) return;
        const key=agent+'|||'+lob;
        if(!rows[key]) rows[key]={agent,lob,dials:0,connects:0,uniqueCallIds:0,uniqueConnected:0,conversions:0};
        rows[key].dials += lv.dials||0;
        rows[key].connects += lv.connects||0;
        rows[key].uniqueCallIds += lv.uniqueCallIds||0;
        rows[key].uniqueConnected += lv.uniqueConnectedCallIds||0;
      });
    });
  });
  return rows;
}
async function renderAgents(){
  const app=document.getElementById('app');
  if(dayDocs.length===0){ app.innerHTML=`<div class="empty-state">No data for this range.</div>`; return; }
  app.innerHTML = `<div class="empty-state"><span class="spinner"></span>Loading agent performance…</div>`;
  const perf = aggregateAgentPerformance();
  const campaignLobMap = buildCampaignLobMap();
  const convRows = await loadConvRowsForRange();
  convRows.forEach(r=>{
    const lob = campaignLobMap[r.campaign] || 'Other';
    if(!lobInFilter(lob)) return;
    const key=r.agent+'|||'+lob;
    if(!perf[key]) perf[key]={agent:r.agent,lob,dials:0,connects:0,uniqueCallIds:0,uniqueConnected:0,conversions:0};
    perf[key].conversions++;
  });

  if(CORE_CALLERS.length){
    Object.keys(perf).forEach(k=>{ if(!CORE_CALLERS.includes(perf[k].agent)) delete perf[k]; });
    // make sure every core caller is listed, even with 0 calls in this range
    CORE_CALLERS.forEach(name=>{ if(!Object.values(perf).some(r=>r.agent===name)) perf[name+'|||none']={agent:name,lob:'',dials:0,connects:0,uniqueCallIds:0,uniqueConnected:0,conversions:0,zero:true}; });
  }
  let rowsArr = Object.values(perf).map(r=>({
    ...r,
    connPct: r.uniqueCallIds? r.uniqueConnected/r.uniqueCallIds*100 : 0,
    convPct: r.uniqueConnected? r.conversions/r.uniqueConnected*100 : 0,
  })).filter(r=> r.dials>0 || r.conversions>0 || r.zero)
    .sort((a,b)=> a.agent.localeCompare(b.agent) || (b.dials-a.dials));

  if(rowsArr.length===0){ app.innerHTML=`<div class="empty-state">No agent activity for this range/type filter.</div>`; return; }

  const totals = rowsArr.reduce((t,r)=>({
    leads:t.leads+r.uniqueCallIds, dialed:t.dialed+r.dials, connected:t.connected+r.uniqueConnected, conv:t.conv+r.conversions
  }), {leads:0,dialed:0,connected:0,conv:0});
  const totalConnPct = totals.leads? totals.connected/totals.leads*100:0;
  const totalConvPct = totals.connected? totals.conv/totals.connected*100:0;

  let html = `<div class="section"><h2>Agent Performance</h2>
    <div class="hint">Leads Received / Unique Connected are counted by distinct Call ID (a lead dialed more than once still counts once); Total Dialed counts every dial attempt.</div>
    <table><thead><tr><th>Agent</th><th>Campaign Type</th><th>Leads Received</th><th>Total Dialed</th><th>Unique Connected</th><th>Conn %</th><th>Conv.</th><th>Conv %</th></tr></thead><tbody>`;
  rowsArr.forEach(r=>{
    html+=`<tr><td>${escapeHtml(r.agent)}</td><td><span class="type-pill ${LOB_CLASS[r.lob]||'type-other'}">${r.lob||'—'}</span></td><td>${r.uniqueCallIds.toLocaleString()}</td><td>${r.dials.toLocaleString()}</td><td>${r.uniqueConnected.toLocaleString()}</td><td class="${pctClass(r.connPct)}">${fmtPct(r.connPct)}</td><td class="pct-green" style="font-weight:700;">${r.conversions.toLocaleString()}</td><td class="${pctClass(r.convPct)}">${fmtPct(r.convPct)}</td></tr>`;
  });
  html += `<tr style="font-weight:800;background:var(--accent-soft);"><td>TOTAL</td><td></td><td>${totals.leads.toLocaleString()}</td><td>${totals.dialed.toLocaleString()}</td><td>${totals.connected.toLocaleString()}</td><td class="${pctClass(totalConnPct)}">${fmtPct(totalConnPct)}</td><td class="pct-green">${totals.conv.toLocaleString()}</td><td class="${pctClass(totalConvPct)}">${fmtPct(totalConvPct)}</td></tr>`;
  html += `</tbody></table></div>`;
  app.innerHTML = html;
}

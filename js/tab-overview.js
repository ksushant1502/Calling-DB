// ===== PAGE 1: Overview =====
async function renderOverview(){
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
  campArr.forEach(c=>{ const t=byType[campaignTypeOf(c.lob).id]; t.campaigns++; t.dials+=c.dials; t.connects+=c.connects; });
  // conversions are attached to a type by the conversion's own campaign / queue name (so none are lost when the name has no call data)
  Object.entries(convByCamp).forEach(([n,cnt])=>{ byType[campaignTypeOf(convLobOf(n)).id].conversions += cnt; });
  // conversions by group (Enterprise / Retention / Other), per day, plus New vs Renewal
  const cg = {enterprise:0, retention:0, other:0}, cgDay = {enterprise:[], retention:[]};
  let cvNew=0, cvRenew=0;
  conversionDocs.forEach(day=>{
    const d={enterprise:0, retention:0, other:0};
    Object.entries(day.byCampaign||{}).forEach(([n,v])=>{ d[convGroupOf(n)] += (v.count||0); });
    Object.keys(d).forEach(k=>{ cg[k]+=d[k]; });
    cgDay.enterprise.push(d.enterprise); cgDay.retention.push(d.retention);
    cvNew += (day.byType||{}).new||0; cvRenew += (day.byType||{}).renewal||0;
  });
  if(conversionDocs.some(d=>d.hadExcluded)){   // days uploaded before the survey-only rule: recount New / Renewal from the rows
    const crow = await loadConvRowsForRange();
    cvNew = crow.filter(r=>r.type==='new').length; cvRenew = crow.filter(r=>r.type==='renewal').length;
  }

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
    const x=byType[t.id]; if(!x.campaigns && !x.conversions) return;
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

  html += `<div class="section"><h2>Conversions <span style="font-weight:500;color:var(--text-dim);font-size:12.5px;">— <a href="#" id="ovConvLink">open full conversion details</a></span></h2>
    ${totalConversions? `<div class="kpi-grid" style="margin-bottom:14px;">
      <div class="kpi" style="--kpi-color:#3b5bfd"><div class="kpi-label">Enterprise</div><div class="kpi-value">${cg.enterprise.toLocaleString()}</div><div class="kpi-sub">${totalConversions?(cg.enterprise/totalConversions*100).toFixed(0):0}% of conversions</div></div>
      <div class="kpi" style="--kpi-color:#0f9a94"><div class="kpi-label">Retention</div><div class="kpi-value">${cg.retention.toLocaleString()}</div><div class="kpi-sub">${totalConversions?(cg.retention/totalConversions*100).toFixed(0):0}% of conversions</div></div>
      ${cg.other?`<div class="kpi" style="--kpi-color:#7a8499"><div class="kpi-label">Other</div><div class="kpi-value">${cg.other.toLocaleString()}</div><div class="kpi-sub">city / others</div></div>`:''}
      <div class="kpi" style="--kpi-color:#12a066"><div class="kpi-label">New vs Renewal</div><div class="kpi-value" style="font-size:22px;">${cvNew.toLocaleString()} <span style="font-size:13px;color:var(--text-dim);font-weight:600;">new</span> · ${cvRenew.toLocaleString()} <span style="font-size:13px;color:var(--text-dim);font-weight:600;">renewal</span></div></div>
    </div>
    <div class="chart-wrap"><canvas id="ovConvCanvas"></canvas></div>`
    : `<div class="empty-state" style="padding:18px;">No conversion data uploaded for this range. Upload the conversion file from the Upload Status page's "Conversion data" row, or the left menu.</div>`}
  </div>`;

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
  const cl=document.getElementById('ovConvLink'); if(cl) cl.onclick=(e)=>{ e.preventDefault(); activeTab='conversion'; renderTabNav(); renderFilterControls(); refreshTab(); };
  if(totalConversions) drawConvTrend('ovConvCanvas', conversionDocs.map(d=>d.date), [{label:'Enterprise',data:cgDay.enterprise,color:'#3b5bfd'},{label:'Retention',data:cgDay.retention,color:'#0f9a94'}]);
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

// ===== SECTION PAGES: Acquisition · Retention · Surveys · City · Incoming — all share this one layout =====
// Summary (funnel, trend, campaigns, conversion breakdown) · Insights & VoC · Agents · Flags

// ---- numbers for a list of campaign types, from the loaded days ----
function statsFor(types, city){
  const dateSet = new Set([...dayDocs.map(d=>d.date), ...conversionDocs.map(d=>d.date)]);
  const dates = [...dateSet].sort();
  const idx = {}; dates.forEach((d,i)=>idx[d]=i);
  const dials = dates.map(()=>0), connects = dates.map(()=>0), convs = dates.map(()=>0);
  const camps = {};
  dayDocs.forEach(day=>{
    Object.entries(day.campaigns||{}).forEach(([name,v])=>{
      if(!lobInFilter(v.lob, types)) return;
      let d=v.dials||0, c=v.connects||0;
      if(city){ const cv=(v.byCity||{})[city]; if(!cv) return; d=cv.dials||0; c=cv.connects||0; }
      dials[idx[day.date]]+=d; connects[idx[day.date]]+=c;
      const x = camps[name] = camps[name] || {name, dials:0, connects:0, conv:0, lob:v.lob};
      x.dials+=d; x.connects+=c;
    });
  });
  if(!city) conversionDocs.forEach(day=>Object.entries(day.byCampaign||{}).forEach(([n,v])=>{
    const lob = (camps[n] && camps[n].lob) || convLobOf(n);
    if(!types.includes(campaignTypeOf(lob).id)) return;
    const k = v.count||0; convs[idx[day.date]] += k;
    const x = camps[n] = camps[n] || {name:n, dials:0, connects:0, conv:0, lob};
    x.conv += k;
  }));
  const sum = a=>a.reduce((s,x)=>s+x,0);
  const T = {dials:sum(dials), connects:sum(connects), conv:sum(convs)};
  T.rate = T.dials? T.connects/T.dials*100 : 0;
  T.per100 = T.connects? T.conv/T.connects*100 : 0;
  const list = Object.values(camps).map(c=>({...c, rate:c.dials?c.connects/c.dials*100:0, per100:c.connects?c.conv/c.connects*100:0}))
    .sort((a,b)=>b.dials-a.dials || b.conv-a.conv);
  const dedupe = list.some(c=>DEDUPE_LOBS.includes(c.lob));
  return {dates, dials, connects, convs, T, list, dedupe};
}
function prevFor(types, prevP){
  if(!prevP || !prevP.hasCalls) return null;
  const p = {dials:0, connects:0, conv:0, camps:{}};
  Object.entries(prevP.camps||{}).forEach(([n,v])=>{
    const lob = v.lob || convLobOf(n);
    if(!types.includes(campaignTypeOf(lob).id)) return;
    p.dials+=v.dials||0; p.connects+=v.connects||0; p.conv+=v.conv||0; p.camps[n]=v;
  });
  p.rate = p.dials? p.connects/p.dials*100 : 0;
  p.per100 = p.connects? p.conv/p.connects*100 : 0;
  p.hasConv = prevP.hasConv;
  return p;
}
// types shown right now on a section page (Surveys can be narrowed to one survey)
function sectionTypes(sec){ const pick = sectionPick[sec.id]; return pick && pick!=='all' && sec.types.includes(pick) ? [pick] : sec.types; }
let cityPick = 'all';

async function renderSection(sec){
  const app = document.getElementById('app');
  const types = sectionTypes(sec);
  // section-level chips: Surveys → which survey · City → which city
  let chips = '';
  if(sec.types.length>1){
    const cur = sectionPick[sec.id]||'all';
    chips = `<div class="chips">${[['all','All '+sec.label.toLowerCase()],...sec.types.map(t=>[t,CAMPAIGN_TYPES.find(x=>x.id===t).label])].map(([v,l])=>`<button class="chip ${cur===v?'active':''}" data-pick="${v}">${l}</button>`).join('')}</div>`;
  }
  if(sec.id==='city'){
    chips = `<div class="chips">${['all',...CITIES].map(c=>`<button class="chip ${cityPick===c?'active':''}" data-city="${c}">${c==='all'?'All cities':c}</button>`).join('')}</div>`;
  }
  const subs = `<div class="subtabs" role="tablist">${SUBTABS.map(s=>`<button role="tab" class="subtab ${activeSub===s.id?'active':''}" data-sub="${s.id}">${s.label}</button>`).join('')}</div>`;
  app.innerHTML = pageHead(sec.title, sec.desc, sec.color, chips) + subs + `<div id="secBody"></div>`;
  app.querySelectorAll('[data-sub]').forEach(b=>b.onclick=()=>{ activeSub=b.getAttribute('data-sub'); insightsCampaignFilter=''; renderTabNav(); renderSection(sec); });
  app.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{ sectionPick[sec.id]=b.getAttribute('data-pick'); insightsCampaignFilter=''; renderSection(sec); });
  app.querySelectorAll('[data-city]').forEach(b=>b.onclick=()=>{ cityPick=b.getAttribute('data-city'); campaignCity=cityPick; renderSection(sec); });
  const body = document.getElementById('secBody');
  if(!dayDocs.length && !conversionDocs.length){ body.innerHTML = emptyRange(); return; }
  if(activeSub==='insights'){ await renderInsights({container:body, typeId:types}); return; }
  if(activeSub==='agents'){ await renderAgents({container:body, types}); return; }
  if(activeSub==='flags'){ await renderFlags({container:body, typeId:types}); return; }
  await renderSectionSummary(sec, types, body);
}
function emptyRange(){
  return `<div class="empty-card"><div class="empty-icon">📭</div><h3>No data for these dates</h3><p>Pick other dates above${canWrite?', or upload the reports for this period':''}.</p>${canWrite?'<button class="primary" onclick="goTo(\'uploads\')">Go to Uploads</button>':''}</div>`;
}

async function renderSectionSummary(sec, types, body){
  const city = sec.id==='city' && cityPick!=='all' ? cityPick : null;
  const S = statsFor(types, city);
  if(!S.T.dials && !S.T.conv){ body.innerHTML = `<div class="empty-card"><h3>No ${escapeHtml(sec.label.toLowerCase())} calls in these dates</h3><p>Try other dates, or check the Uploads page.</p></div>`; return; }
  const prevP = await loadPreviousPeriod();
  const P = (S.dedupe || city) ? null : prevFor(types, prevP);
  const showConv = S.T.conv>0 || ['acquisition','retention'].includes(sec.id);
  let nw=0, rn=0, convRows=[];
  if(showConv && conversionDocs.length){
    convRows = (await loadConvRowsForRange()).filter(r=>types.includes(campaignTypeOf(convLobOf(r.campaign)).id));
    nw = convRows.filter(r=>r.type==='new').length; rn = convRows.filter(r=>r.type==='renewal').length;
  }

  // 1 · funnel strip
  const step = (label, value, sub, delta)=>`<div class="fs-step"><div class="fs-label">${label}</div><div class="fs-value">${value}</div><div class="fs-sub">${sub||''}</div>${delta?`<div class="fs-delta">${delta}</div>`:''}</div>`;
  const arrow = (txt)=>`<div class="fs-arrow"><span>${txt}</span></div>`;
  let strip = step('Dials', fmtNum(S.T.dials), S.dedupe?'unique numbers — each counted once':'every call attempt', P?deltaChip(S.T.dials,P.dials,'pct'):'')
    + arrow(`${S.T.rate.toFixed(1)}% connect`)
    + step('Connected', fmtNum(S.T.connects), `${S.T.rate.toFixed(1)}% of dials`, P?deltaChip(S.T.rate,P.rate,'pts'):'');
  if(showConv){
    strip += arrow(`${S.T.per100.toFixed(1)} per 100`)
      + step('Conversions', fmtNum(S.T.conv), `${S.T.per100.toFixed(1)} per 100 connects`, P&&P.hasConv?deltaChip(S.T.conv,P.conv,'pct'):'')
      + `<div class="fs-step fs-split"><div class="fs-label">New vs renewal</div>
          <div class="split-bar" title="${fmtNum(nw)} new · ${fmtNum(rn)} renewal"><i style="flex:${nw||0.0001}"></i><i style="flex:${rn||0.0001}"></i></div>
          <div class="split-legend"><span><i class="k1"></i>${fmtNum(nw)} new</span><span><i class="k2"></i>${fmtNum(rn)} renewal</span></div></div>`;
  }
  let html = `<div class="funnel-strip" style="--sc:${sec.color}">${strip}</div>`;
  if(S.dedupe) html += dedupeHint();
  if(!P && !S.dedupe && !city) html += `<div class="hint">No data for ${prevRangeText()} yet, so changes are not shown.</div>`;

  // 2 · trends
  html += `<div class="grid-2 ${showConv?'':'one'}">
    <div class="card"><div class="card-head"><h2>Calls per day</h2></div><div class="chart-wrap"><canvas id="secCalls"></canvas></div></div>
    ${showConv?`<div class="card"><div class="card-head"><h2>Conversions per day</h2></div><div class="chart-wrap"><canvas id="secConv"></canvas></div></div>`:''}
  </div>`;

  // 3 · campaigns
  const maxD = Math.max(1, ...S.list.map(c=>c.dials));
  html += `<div class="card"><div class="card-head"><h2>${sec.id==='retention'?'Queues':'Campaigns'} <span class="count">${S.list.length}</span></h2><span class="card-note">Click a row to open its insights</span></div>
    <div class="table-scroll"><table class="tbl"><thead><tr><th>${sec.id==='retention'?'Queue / campaign':'Campaign'}</th><th class="num">Dials</th><th class="num">Connected</th><th>Connect rate</th>${P?'<th class="num">vs before</th>':''}${showConv?'<th class="num">Conversions</th><th class="num">Per 100 connects</th>':''}</tr></thead><tbody>
    ${S.list.map(c=>{
      const pc = P && P.camps[c.name]; const prevRate = pc && pc.dials ? pc.connects/pc.dials*100 : null;
      return `<tr class="row-link" data-camp="${escapeHtml(c.name)}">
        <td><div class="cell-name"><i class="dot" style="background:${campaignTypeOf(c.lob).color}"></i>${escapeHtml(c.name)}${types.length>1?` <span class="muted-tag">${escapeHtml(campaignTypeOf(c.lob).label)}</span>`:''}</div>
          <div class="minibar thin"><i style="width:${(c.dials/maxD*100).toFixed(1)}%;background:${sec.color}"></i></div></td>
        <td class="num">${fmtNum(c.dials)}</td><td class="num">${fmtNum(c.connects)}</td>
        <td><span class="rate ${pctClass(c.rate)}">${c.dials?fmtPct(c.rate):'—'}</span></td>
        ${P?`<td class="num">${prevRate!=null&&c.dials?deltaChip(c.rate,prevRate,'pts'):'<span class="muted">new</span>'}</td>`:''}
        ${showConv?`<td class="num"><b>${fmtNum(c.conv)}</b></td><td class="num">${c.connects?c.per100.toFixed(1):'—'}</td>`:''}
      </tr>`; }).join('')}
    </tbody></table></div></div>`;

  // 4 · who converted
  if(showConv && convRows.length){
    html += `<div class="card"><div class="card-head"><h2>Who converted</h2><span class="card-note">${fmtNum(convRows.length)} conversions</span></div>
      <div class="conv-grid">${convTable('By agent', countBy(convRows,'agent'), convRows.length, 'Agent')}${convTable('By city', countBy(convRows,'city'), convRows.length, 'City')}${convTable(sec.id==='retention'?'By queue':'By campaign', countBy(convRows,'campaign'), convRows.length, sec.id==='retention'?'Queue':'Campaign')}</div></div>`;
  }
  if(sec.id==='city'){
    html += `<div class="card"><div class="card-head"><h2>Disposition breakdown</h2><button id="cityDispBtn">Load breakdown</button></div><div id="cityDisp" class="hint">Shows how City Calling calls ended, for the city chosen above.</div></div>`;
  }
  body.innerHTML = html;
  drawCallsTrend('secCalls', S.dates, S.dials, S.connects, sec.color);
  if(showConv) drawConvDaily('secConv', S.dates, S.convs);
  body.querySelectorAll('[data-camp]').forEach(r=>r.onclick=()=>{ insightsCampaignFilter=r.getAttribute('data-camp'); activeSub='insights'; renderTabNav(); renderSection(sec); window.scrollTo({top:0}); });
  const db = document.getElementById('cityDispBtn'); if(db) db.onclick = ()=>{ campaignCity = cityPick; loadCityDisposition(); };
}

// ---- Agents page (all sections, with a section filter) ----
async function renderAgentsPage(){
  const app=document.getElementById('app');
  const chips = `<div class="chips">${[['all','All sections'],...SECTIONS.map(s=>[s.id,s.label])].map(([v,l])=>`<button class="chip ${agentsPick===v?'active':''}" data-ap="${v}">${l}</button>`).join('')}</div>`;
  app.innerHTML = pageHead('Agents', 'Every caller in one table. Click a column title to sort.', null, chips) + `<div id="agBody"></div>`;
  app.querySelectorAll('[data-ap]').forEach(b=>b.onclick=()=>{ agentsPick=b.getAttribute('data-ap'); renderAgentsPage(); });
  const body=document.getElementById('agBody');
  if(!dayDocs.length){ body.innerHTML=emptyRange(); return; }
  await renderAgents({container:body, types: agentsPick==='all' ? CAMPAIGN_TYPES.map(t=>t.id) : sectionById(agentsPick).types});
}

// ---- Flags page (opened from Home's "needs attention") ----
async function renderFlagsPage(){
  const app=document.getElementById('app');
  const chips = `<div class="chips">${[['all','All sections'],...SECTIONS.map(s=>[s.id,s.label])].map(([v,l])=>`<button class="chip ${flagsPick===v?'active':''}" data-fp="${v}">${l}</button>`).join('')}</div>`;
  app.innerHTML = `<button class="back-link" onclick="goTo('home')">← Home</button>` + pageHead('Call flags', 'Short connects, misconduct words, callbacks, missing forms and hot leads — found when the file was uploaded.', null, chips) + `<div id="flBody"></div>`;
  app.querySelectorAll('[data-fp]').forEach(b=>b.onclick=()=>{ flagsPick=b.getAttribute('data-fp'); renderFlagsPage(); });
  const body=document.getElementById('flBody');
  if(!dayDocs.length){ body.innerHTML=emptyRange(); return; }
  await renderFlags({container:body, typeId: flagsPick==='all' ? 'all' : sectionById(flagsPick).types});
  if(flagsFocus){ const k=body.querySelector(`[data-flagkey="${flagsFocus}"]`); flagsFocus=''; if(k) k.click(); }
}

// ---- Uploads page ----
async function renderUploadsPage(){
  const app=document.getElementById('app');
  const cards = canWrite ? `<div class="upload-cards">
      <button class="upload-card" id="ucCalls"><span class="uc-icon">📞</span><span><b>Calling report</b><small>Campaign report (Enterprise, Survey, Incoming) or Retention report. Pick several files at once — the type is detected from the columns.</small></span></button>
      <button class="upload-card" id="ucConv"><span class="uc-icon">✅</span><span><b>Conversion file</b><small>Activations and extensions with the agent who converted. Survey-only campaigns are left out automatically.</small></span></button>
    </div>` : '';
  app.innerHTML = pageHead('Uploads', 'Which days have been uploaded. Green = uploaded, red = missing'+(canWrite?' (click a red day to upload it)':'')+'.', null) + cards + `<div id="covBody"></div>`;
  if(canWrite){ document.getElementById('ucCalls').onclick=()=>openUploadModal(); document.getElementById('ucConv').onclick=()=>openConversionUploadModal(); }
  await renderUploadStatus(document.getElementById('covBody'));
}

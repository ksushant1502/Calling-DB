// ===== AGENTS TABLE: used by the Agents page and by the Agents tab inside each section =====
let agentSort = {key:'conv', dir:-1};
function aggregateAgentPerformance(types){
  const rows={};
  dayDocs.forEach(day=>{
    Object.entries(day.agents||{}).forEach(([agent,v])=>{
      Object.entries(v.byLob||{}).forEach(([lob,lv])=>{
        if(!lobInFilter(lob, types)) return;
        const r = rows[agent] = rows[agent] || {agent, lobs:new Set(), dials:0, connects:0, leads:0, uconn:0, conv:0};
        r.lobs.add(lob);
        r.dials += lv.dials||0; r.connects += lv.connects||0;
        r.leads += lv.uniqueCallIds||0; r.uconn += lv.uniqueConnectedCallIds||0;
      });
    });
  });
  return rows;
}
async function renderAgents(opts){
  opts = opts||{};
  const app = opts.container || document.getElementById('app');
  const types = opts.types || CAMPAIGN_TYPES.map(t=>t.id);
  if(dayDocs.length===0){ app.innerHTML=emptyRange(); return; }
  app.innerHTML = `<div class="empty-state"><span class="spinner"></span>Loading agents…</div>`;
  const perf = aggregateAgentPerformance(types);
  const lobMap = buildCampaignLobMap();
  const convRows = conversionDocs.length ? await loadConvRowsForRange() : [];
  convRows.forEach(r=>{
    const lob = lobMap[r.campaign] || convLobOf(r.campaign);
    if(!lobInFilter(lob, types)) return;
    const p = perf[r.agent] = perf[r.agent] || {agent:r.agent, lobs:new Set(), dials:0, connects:0, leads:0, uconn:0, conv:0};
    p.lobs.add(lob); p.conv++;
  });
  if(CORE_CALLERS.length){
    Object.keys(perf).forEach(k=>{ if(!CORE_CALLERS.includes(k)) delete perf[k]; });
    CORE_CALLERS.forEach(n=>{ if(!perf[n]) perf[n]={agent:n, lobs:new Set(), dials:0, connects:0, leads:0, uconn:0, conv:0}; });
  }
  const rows = Object.values(perf).map(r=>({...r,
    rate: r.leads ? r.uconn/r.leads*100 : (r.dials? r.connects/r.dials*100 : 0),
    per100: r.uconn ? r.conv/r.uconn*100 : (r.connects? r.conv/r.connects*100 : 0),
    secs: [...new Set([...r.lobs].map(l=>sectionOfLob(l)).filter(Boolean))]}));
  if(!rows.length){ app.innerHTML=`<div class="empty-card"><h3>No agent activity for these dates</h3></div>`; return; }
  const showConv = rows.some(r=>r.conv>0);
  const T = rows.reduce((t,r)=>({leads:t.leads+r.leads, dials:t.dials+r.dials, uconn:t.uconn+r.uconn, conv:t.conv+r.conv}), {leads:0,dials:0,uconn:0,conv:0});
  const tRate = T.leads? T.uconn/T.leads*100 : 0, tPer = T.uconn? T.conv/T.uconn*100 : 0;
  const maxD = Math.max(1, ...rows.map(r=>r.dials));
  const cols = [
    {key:'agent', label:'Agent'},
    {key:'secs', label:'Sections', nosort:true},
    {key:'leads', label:'Leads', num:true, tip:'Different customers (call IDs) given to the agent'},
    {key:'dials', label:'Dials', num:true, tip:'Every call attempt'},
    {key:'uconn', label:'Connected', num:true, tip:'Different customers reached'},
    {key:'rate', label:'Connect %', num:true},
    ...(showConv?[{key:'conv', label:'Conversions', num:true},{key:'per100', label:'Per 100 connects', num:true}]:[]),
  ];
  if(!showConv && agentSort.key==='conv') agentSort={key:'dials',dir:-1};
  const draw = ()=>{
    const k=agentSort.key, d=agentSort.dir;
    rows.sort((a,b)=> k==='agent' ? d*a.agent.localeCompare(b.agent) : d*((a[k]||0)-(b[k]||0)) || b.dials-a.dials);
    app.innerHTML = `<div class="card"><div class="card-head"><h2>Agents <span class="count">${rows.length}</span></h2><span class="card-note">Connect % counts each customer once, even if dialled several times</span></div>
      <div class="table-scroll"><table class="tbl sortable"><thead><tr>${cols.map(c=>`<th class="${c.num?'num':''} ${c.nosort?'':'sort'} ${agentSort.key===c.key?'sorted':''}" ${c.nosort?'':`data-sort="${c.key}"`} ${c.tip?`title="${c.tip}"`:''}>${c.label}${agentSort.key===c.key?(agentSort.dir<0?' ↓':' ↑'):''}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(r=>`<tr>
        <td><div class="cell-name"><span class="avatar">${escapeHtml((r.agent||'?').trim().charAt(0).toUpperCase())}</span>${escapeHtml(r.agent)}</div></td>
        <td>${r.secs.map(s=>`<span class="sec-pill" style="--sc:${s.color}">${s.label}</span>`).join(' ')||'—'}</td>
        <td class="num">${fmtNum(r.leads)}</td>
        <td class="num"><div class="num-bar"><span>${fmtNum(r.dials)}</span><div class="minibar thin"><i style="width:${(r.dials/maxD*100).toFixed(1)}%"></i></div></div></td>
        <td class="num">${fmtNum(r.uconn)}</td>
        <td class="num"><span class="rate ${pctClass(r.rate)}">${r.dials?fmtPct(r.rate):'—'}</span></td>
        ${showConv?`<td class="num"><b>${fmtNum(r.conv)}</b></td><td class="num">${r.uconn||r.connects?r.per100.toFixed(1):'—'}</td>`:''}
      </tr>`).join('')}
      <tr class="total-row"><td>Total</td><td></td><td class="num">${fmtNum(T.leads)}</td><td class="num">${fmtNum(T.dials)}</td><td class="num">${fmtNum(T.uconn)}</td><td class="num">${fmtPct(tRate)}</td>${showConv?`<td class="num">${fmtNum(T.conv)}</td><td class="num">${tPer.toFixed(1)}</td>`:''}</tr>
      </tbody></table></div></div>`;
    app.querySelectorAll('[data-sort]').forEach(th=>th.onclick=()=>{ const key=th.getAttribute('data-sort'); agentSort = {key, dir: agentSort.key===key ? -agentSort.dir : (key==='agent'?1:-1)}; draw(); });
  };
  draw();
}

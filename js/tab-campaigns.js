// ===== PAGE 2: Campaign Types (campaigns grouped by type; City Calling has a city filter) =====
let campaignSearch='', campaignCity='all';
const collapsedTypes = {};   // typeId -> true when the user collapsed it

function renderCampaigns(){
  const app=document.getElementById('app');
  if(dayDocs.length===0){ app.innerHTML=`<div class="empty-state">No data for this range.</div>`; return; }
  const convByCamp = conversionsByCampaign();
  const q = campaignSearch.toLowerCase();

  let html = `<div class="filter-bar"><input type="text" id="campSearch" placeholder="Search campaigns…" value="${escapeHtml(campaignSearch)}" style="min-width:240px;"></div>`;
  let shown = 0;

  CAMPAIGN_TYPES.forEach(t=>{
    const isCity = t.id==='city';
    const agg = aggregateOverview(isCity && campaignCity!=='all' ? campaignCity : null, t.id);
    let rows = Object.entries(agg.campaigns).map(([n,v])=>({name:n,...v,pct:v.dials?v.connects/v.dials*100:0,conversions:convByCamp[n]||0}))
      .filter(c=>!q || c.name.toLowerCase().includes(q)).sort((a,b)=>b.dials-a.dials);
    if(rows.length===0) return;
    shown++;
    const dials=rows.reduce((s,c)=>s+c.dials,0), connects=rows.reduce((s,c)=>s+c.connects,0), conv=rows.reduce((s,c)=>s+c.conversions,0);
    const pct = dials? connects/dials*100:0;
    const maxDials = rows[0].dials||1;
    html += `<div class="tgroup ${collapsedTypes[t.id]?'collapsed':''}" data-type="${t.id}" style="--tc:${t.color}">
      <div class="tgroup-head" data-toggle="${t.id}">
        <div class="tgroup-title"><span class="caret">▾</span>${t.label}<span style="font-size:12px;font-weight:600;color:var(--text-dim);">${rows.length} campaign${rows.length===1?'':'s'}</span></div>
        <div class="tg-stat"><div class="v">${dials.toLocaleString()}</div><div class="l">Dials</div></div>
        <div class="tg-stat"><div class="v">${connects.toLocaleString()}</div><div class="l">Connects</div></div>
        <div class="tg-stat"><div class="v ${pctClass(pct)}">${fmtPct(pct)}</div><div class="l">Conn %</div></div>
        <div class="tg-stat"><div class="v pct-green">${conv.toLocaleString()}</div><div class="l">Conversions</div></div>
      </div>
      <div class="tgroup-body">`;
    if(isCity){
      html += `<div class="subbar"><span style="font-size:12.5px;color:var(--text-dim);font-weight:600;">City:</span>`+
        ['all',...CITIES].map(c=>`<button class="chip ${campaignCity===c?'active':''}" data-city="${c}">${c==='all'?'All cities':c}</button>`).join('')+
        `<button id="cityDispBtn" style="margin-left:auto;">Disposition breakdown</button></div><div id="cityDisp"></div>`;
    }
    html += `<table><thead><tr><th>Campaign</th><th>Type</th><th class="num">Dials</th><th>Share of type</th><th class="num">Connects</th><th class="num">Conn %</th><th class="num">Conversions</th><th class="num">Unique Call IDs</th></tr></thead><tbody>`;
    rows.forEach(c=>{
      html += `<tr><td>${escapeHtml(c.name)}</td><td><span class="type-pill ${LOB_CLASS[c.lob]||'type-other'}">${c.lob||'—'}</span></td>
        <td class="num">${c.dials.toLocaleString()}</td>
        <td><div class="bar-cell"><div class="minibar"><i style="width:${(c.dials/maxDials*100).toFixed(0)}%;background:${t.color}"></i></div></div></td>
        <td class="num">${c.connects.toLocaleString()}</td><td class="num ${pctClass(c.pct)}">${fmtPct(c.pct)}</td>
        <td class="num pct-green" style="font-weight:700;">${c.conversions.toLocaleString()}</td><td class="num">${c.uniqueCallIds.toLocaleString()}</td></tr>`;
    });
    html += `</tbody></table></div></div>`;
  });
  if(!shown) html += `<div class="empty-state">No campaigns match.</div>`;
  app.innerHTML = html;

  document.getElementById('campSearch').oninput = (e)=>{ campaignSearch=e.target.value; renderCampaigns(); const s=document.getElementById('campSearch'); s.focus(); s.setSelectionRange(s.value.length,s.value.length); };
  app.querySelectorAll('[data-toggle]').forEach(h=>h.onclick=()=>{ const id=h.getAttribute('data-toggle'); collapsedTypes[id]=!collapsedTypes[id]; h.parentElement.classList.toggle('collapsed'); });
  app.querySelectorAll('[data-city]').forEach(b=>b.onclick=(e)=>{ e.stopPropagation(); campaignCity=b.getAttribute('data-city'); renderCampaigns(); });
  const dispBtn = document.getElementById('cityDispBtn');
  if(dispBtn) dispBtn.onclick = loadCityDisposition;
}

// Disposition breakdown for City Calling (row-level, so it loads on demand)
async function loadCityDisposition(){
  const box = document.getElementById('cityDisp'); box.innerHTML = '<span class="spinner"></span>Loading…';
  let rows = (await loadRowsForRange()).filter(r=>r.lob==='CityOps' || (r.city && CITIES.includes(r.city)));
  if(campaignCity!=='all') rows = rows.filter(r=>r.city===campaignCity);
  const byDisp = {};
  rows.forEach(r=>{ const d=r.disposition||'Unknown'; (byDisp[d]=byDisp[d]||[]).push(r); });
  let h = `<table style="margin-bottom:10px;"><thead><tr><th>Disposition</th><th class="num">Count</th>${canWrite?'<th></th>':''}</tr></thead><tbody>`;
  Object.entries(byDisp).sort((a,b)=>b[1].length-a[1].length).forEach(([d,rws])=>{
    h += `<tr><td>${escapeHtml(d)}</td><td class="num">${rws.length.toLocaleString()}</td>${canWrite?`<td class="num"><button data-disp="${escapeHtml(d)}" style="font-size:11px;padding:4px 9px;">Export</button></td>`:''}</tr>`;
  });
  box.innerHTML = h + '</tbody></table>';
  if(canWrite) box.querySelectorAll('[data-disp]').forEach(btn=>{
    btn.onclick = ()=>{ const d=btn.getAttribute('data-disp'); downloadCsv(`city_${d}.csv`.replace(/[^\w.-]/g,'_'), ['agent','campaign','phone','disposition','talkSec','notes'], byDisp[d]); };
  });
}

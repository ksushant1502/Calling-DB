// ===== CALL DETAILS: every uploaded call row — phone, notes, what the customer said, and every column of the original file =====
// Only shown to people who are signed in (see hasContacts in state.js). The data comes from the locked call_contacts table.
let callsQ = {search:'', campaign:'', agent:'', outcome:'', flag:'', page:0};
const CALLS_PER_PAGE = 100;
const FLAG_NAMES = {short_connect:'Short connect', misconduct:'Misconduct', callback:'Callback', form_not_filled:'Form not filled', hot_convert:'Hot lead'};

function callSearchText(r){
  return [r.phone, r.callId, r.agent, r.campaign, r.disposition, r.notes, ...Object.values(r.form||{}), ...Object.values(r.raw||{})].join(' ').toLowerCase();
}
async function renderCalls(opts){
  const app = opts.container;
  if(!dayDocs.length){ app.innerHTML = emptyRange(); return; }
  app.innerHTML = `<div class="empty-state"><span class="spinner"></span>Loading calls…</div>`;
  const all = (await loadRowsForRange()).filter(r=>lobInFilter(r.lob, opts.types));
  if(!all.length){ app.innerHTML = `<div class="empty-card"><h3>No calls in these dates</h3></div>`; return; }
  const withContacts = all.filter(r=>r.phone || r.notes || (r.raw && Object.keys(r.raw).length)).length;
  const campaigns = [...new Set(all.map(r=>r.campaign))].sort();
  const agents = [...new Set(all.map(r=>r.agent))].sort();
  const disps = [...new Set(all.map(r=>r.disposition||'—'))].sort();
  ['campaign','agent'].forEach(k=>{ if(callsQ[k] && !(k==='campaign'?campaigns:agents).includes(callsQ[k])) callsQ[k]=''; });

  const opt = (list, cur, first)=>`<option value="">${first}</option>`+list.map(x=>`<option value="${escapeHtml(x)}" ${cur===x?'selected':''}>${escapeHtml(x)}</option>`).join('');
  app.innerHTML = `
    ${withContacts < all.length ? `<div class="admin-only-note"><b>${fmtNum(all.length-withContacts)}</b> of ${fmtNum(all.length)} calls have no phone number or notes saved. These days were uploaded before phone numbers were being saved. Upload those days again to fill them in.</div>` : ''}
    <div class="card calls-card">
      <div class="calls-filters">
        <input type="search" id="cSearch" placeholder="Search phone, call ID, agent, notes or answers…" value="${escapeHtml(callsQ.search)}">
        <select id="cCamp">${opt(campaigns, callsQ.campaign, 'All campaigns')}</select>
        <select id="cAgent">${opt(agents, callsQ.agent, 'All agents')}</select>
        <select id="cOut"><option value="">Any outcome</option><option value="__c" ${callsQ.outcome==='__c'?'selected':''}>Connected</option><option value="__n" ${callsQ.outcome==='__n'?'selected':''}>Not connected</option><optgroup label="Disposition">${disps.map(d=>`<option value="${escapeHtml(d)}" ${callsQ.outcome===d?'selected':''}>${escapeHtml(d)}</option>`).join('')}</optgroup></select>
        <select id="cFlag"><option value="">Any flag</option>${Object.entries(FLAG_NAMES).map(([k,v])=>`<option value="${k}" ${callsQ.flag===k?'selected':''}>${v}</option>`).join('')}</select>
        <button id="cExport">⬇ Export</button>
      </div>
      <div id="cList"></div>
    </div>`;

  let shown = [];
  const draw = ()=>{
    const q = callsQ.search.trim().toLowerCase();
    shown = all.filter(r=>
      (!callsQ.campaign || r.campaign===callsQ.campaign) &&
      (!callsQ.agent || r.agent===callsQ.agent) &&
      (!callsQ.flag || (r.flags||[]).includes(callsQ.flag)) &&
      (!callsQ.outcome || (callsQ.outcome==='__c' ? isConnect(r.disposition) : callsQ.outcome==='__n' ? !isConnect(r.disposition) : (r.disposition||'—')===callsQ.outcome)) &&
      (!q || callSearchText(r).includes(q))
    ).sort((a,b)=> (b.date||'').localeCompare(a.date||'') || (a.n||0)-(b.n||0));
    const pages = Math.max(1, Math.ceil(shown.length/CALLS_PER_PAGE));
    if(callsQ.page>=pages) callsQ.page=pages-1;
    const slice = shown.slice(callsQ.page*CALLS_PER_PAGE, (callsQ.page+1)*CALLS_PER_PAGE);
    const box = document.getElementById('cList');
    if(!shown.length){ box.innerHTML = `<div class="empty-state">No calls match these filters.</div>`; return; }
    box.innerHTML = `<div class="calls-count">${fmtNum(shown.length)} call${shown.length===1?'':'s'}${shown.length!==all.length?` of ${fmtNum(all.length)}`:''} · click a call to see everything about it</div>
      <div class="table-scroll"><table class="tbl calls-tbl"><thead><tr><th>Date</th><th>Phone</th><th>Agent</th><th>Campaign</th><th>Outcome</th><th class="num">Talk</th><th>${hasContacts()?'Notes / customer said':'Customer said'}</th></tr></thead><tbody>
      ${slice.map((r,i)=>{
        const said = r.notes || Object.entries(r.form||{}).filter(([,a])=>a && !/^(na|n\/a|-)$/i.test(a)).map(([q,a])=>`${q}: ${a}`).join(' · ');
        return `<tr class="row-link" data-i="${callsQ.page*CALLS_PER_PAGE+i}">
          <td class="nowrap">${fmtDay(r.date)}</td>
          <td class="nowrap mono">${r.phone?escapeHtml(r.phone):'<span class="muted">—</span>'}</td>
          <td>${escapeHtml(r.agent||'—')}</td>
          <td class="clip">${escapeHtml(r.campaign||'—')}</td>
          <td><span class="outcome ${isConnect(r.disposition)?'ok':'no'}">${escapeHtml(r.disposition||'—')}</span>${(r.flags||[]).map(f=>` <span class="flag-dot f-${f}" title="${FLAG_NAMES[f]||f}"></span>`).join('')}</td>
          <td class="num nowrap">${r.talkSec?r.talkSec+'s':'—'}</td>
          <td class="said">${said?escapeHtml(said):'<span class="muted">—</span>'}</td>
        </tr>`; }).join('')}
      </tbody></table></div>
      ${pages>1?`<div class="pager"><button id="cPrev" ${callsQ.page===0?'disabled':''}>← Previous</button><span>Page ${callsQ.page+1} of ${pages}</span><button id="cNext" ${callsQ.page>=pages-1?'disabled':''}>Next →</button></div>`:''}`;
    box.querySelectorAll('[data-i]').forEach(tr=>tr.onclick=()=>openCallDetail(shown[+tr.getAttribute('data-i')]));
    const pv=document.getElementById('cPrev'), nx=document.getElementById('cNext');
    if(pv) pv.onclick=()=>{ callsQ.page--; draw(); };
    if(nx) nx.onclick=()=>{ callsQ.page++; draw(); };
  };
  let t=null;
  document.getElementById('cSearch').oninput = e=>{ clearTimeout(t); t=setTimeout(()=>{ callsQ.search=e.target.value; callsQ.page=0; draw(); }, 200); };
  [['cCamp','campaign'],['cAgent','agent'],['cOut','outcome'],['cFlag','flag']].forEach(([id,k])=>{ document.getElementById(id).onchange = e=>{ callsQ[k]=e.target.value; callsQ.page=0; draw(); }; });
  document.getElementById('cExport').onclick = ()=>exportCalls(shown);
  draw();
}

// Everything about one call, in a side panel
function openCallDetail(r){
  if(!r) return;
  const root = document.getElementById('modalRoot');
  const answers = Object.entries(r.form||{}).filter(([,a])=>a!==''&&a!=null);
  const raw = Object.entries(r.raw||{});
  const kv = (k,v)=>`<div class="kv"><span>${escapeHtml(k)}</span><b>${v}</b></div>`;
  root.innerHTML = `<div class="overlay drawer-ov" id="ovCall"><aside class="drawer" role="dialog" aria-label="Call details">
    <div class="drawer-head"><div><div class="drawer-title mono">${r.phone?escapeHtml(r.phone):'No phone number saved'}</div>
      <div class="drawer-sub">${fmtDay(r.date,true)} · ${escapeHtml(r.campaign||'')} · ${escapeHtml(r.agent||'')}</div></div>
      <button class="drawer-x" id="closeCall" aria-label="Close">✕</button></div>
    <div class="drawer-body">
      <div class="kv-grid">
        ${kv('Outcome', `<span class="outcome ${isConnect(r.disposition)?'ok':'no'}">${escapeHtml(r.disposition||'—')}</span>`)}
        ${kv('Talk time', r.talkSec? r.talkSec+' seconds':'—')}
        ${kv('Call ID', escapeHtml(r.callId||'—'))}
        ${kv('City', escapeHtml(r.city||'—'))}
        ${kv('Section', escapeHtml(campaignTypeOf(r.lob).label))}
        ${kv('Flags', (r.flags||[]).length? r.flags.map(f=>`<span class="flag-chip flag-${f==='short_connect'?'short':f==='misconduct'?'misconduct':f==='callback'?'callback':f==='hot_convert'?'hot':'form'}">${FLAG_NAMES[f]||f}</span>`).join(' ') : '—')}
      </div>
      <h4>Agent's notes</h4>
      <div class="notes-box">${r.notes?escapeHtml(r.notes):'<span class="muted">No notes</span>'}</div>
      ${answers.length?`<h4>What the customer said</h4><div class="qa-list">${answers.map(([q,a])=>`<div class="qa"><span>${escapeHtml(q)}</span><b>${escapeHtml(a)}</b></div>`).join('')}</div>`:''}
      <h4>Everything in the uploaded file <small>${raw.length} column${raw.length===1?'':'s'}</small></h4>
      ${raw.length?`<div class="raw-list">${raw.map(([k,v])=>`<div class="raw-row"><span>${escapeHtml(k)}</span><div>${escapeHtml(v)}</div></div>`).join('')}</div>`
        : `<div class="hint">This day was uploaded before full rows were being saved. Upload it again to see everything.</div>`}
    </div>
  </aside></div>`;
  const close=()=>{ root.innerHTML=''; document.removeEventListener('keydown', esc); };
  const esc=(e)=>{ if(e.key==='Escape') close(); };
  document.addEventListener('keydown', esc);
  document.getElementById('closeCall').onclick = close;
  document.getElementById('ovCall').onclick = (e)=>{ if(e.target.id==='ovCall') close(); };
}

// Export the filtered calls with every column (the dashboard's fields first, then every column of the original files)
function exportCalls(rows){
  if(!rows.length){ toast('Nothing to export'); return; }
  const base = ['date','phone','agent','campaign','section','city','callId','disposition','talkSec','notes','flags'];
  const qs = [...new Set(rows.flatMap(r=>Object.keys(r.form||{})))];
  const rawCols = [...new Set(rows.flatMap(r=>Object.keys(r.raw||{})))];
  const out = rows.map(r=>{
    const o = {date:r.date, phone:r.phone, agent:r.agent, campaign:r.campaign, section:campaignTypeOf(r.lob).label, city:r.city, callId:r.callId, disposition:r.disposition, talkSec:r.talkSec, notes:r.notes, flags:(r.flags||[]).join('|')};
    qs.forEach(q=>o['Q: '+q]=(r.form||{})[q]||'');
    rawCols.forEach(c=>o['File: '+c]=(r.raw||{})[c]||'');
    return o;
  });
  downloadCsv(`calls_${range.start}_to_${range.end}.csv`, [...base, ...qs.map(q=>'Q: '+q), ...rawCols.map(c=>'File: '+c)], out);
}

// Converted customers (phone numbers from the conversion file)
function convCustomersCard(rows, sec){
  if(!hasContacts() || !rows.length) return '';
  const list = [...rows].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const missing = list.filter(r=>!r.phone).length;
  return `<div class="card"><div class="card-head"><h2>Converted customers <span class="count">${fmtNum(list.length)}</span></h2><button id="convExport">⬇ Export</button></div>
    ${missing?`<div class="hint" style="margin-top:-6px;">${fmtNum(missing)} have no phone number saved (uploaded before phone numbers were being saved).</div>`:''}
    <div class="table-scroll conv-cust"><table class="tbl"><thead><tr><th>Date</th><th>Phone</th><th>Agent</th><th>${sec.id==='retention'?'Queue':'Campaign'}</th><th>City</th><th>Type</th></tr></thead><tbody>
    ${list.slice(0,200).map((r,i)=>`<tr class="row-link" data-cv="${i}"><td class="nowrap">${fmtDay(r.date)}</td><td class="mono nowrap">${r.phone?escapeHtml(r.phone):'<span class="muted">—</span>'}</td><td>${escapeHtml(r.agent||'—')}</td><td class="clip">${escapeHtml(r.campaign||'—')}</td><td>${escapeHtml(r.city||'—')}</td><td>${r.type==='new'?'New':r.type==='renewal'?'Renewal':'—'}</td></tr>`).join('')}
    </tbody></table></div>${list.length>200?`<div class="hint" style="margin:10px 0 0;">Showing the latest 200. Export to get all ${fmtNum(list.length)}.</div>`:''}</div>`;
}
function wireConvCustomers(rows){
  const list = [...rows].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const ex = document.getElementById('convExport');
  if(ex) ex.onclick = ()=>{
    const rawCols = [...new Set(list.flatMap(r=>Object.keys(r.raw||{})))];
    downloadCsv(`conversions_${range.start}_to_${range.end}.csv`, ['date','phone','agent','campaign','city','type',...rawCols.map(c=>'File: '+c)],
      list.map(r=>{ const o={date:r.date, phone:r.phone, agent:r.agent, campaign:r.campaign, city:r.city, type:r.type}; rawCols.forEach(c=>o['File: '+c]=(r.raw||{})[c]||''); return o; }));
  };
  document.querySelectorAll('[data-cv]').forEach(tr=>tr.onclick=()=>{
    const r = list[+tr.getAttribute('data-cv')];
    openCallDetail({date:r.date, phone:r.phone, agent:r.agent, campaign:r.campaign, city:r.city, disposition:'Converted ('+(r.type||'')+')', lob:convLobOf(r.campaign), raw:r.raw, form:{}, flags:[], notes:''});
  });
}

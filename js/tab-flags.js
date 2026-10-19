// ===== PAGE 5: Flags =====
// ===================== FLAGS =====================
async function renderFlags(){
  const app=document.getElementById('app');
  if(dayDocs.length===0){ app.innerHTML=`<div class="empty-state">No data for this range.</div>`; return; }
  app.innerHTML = `<div class="empty-state"><span class="spinner"></span>Scanning calls for flags…</div>`;
  const rows = (await loadRowsForRange()).filter(r=>lobInFilter(r.lob));
  const flagged = [];
  rows.forEach(r=>{
    const reasons = r.flags||[];   // worked out at upload time; raw notes/phone are never stored
    if(reasons.length) flagged.push({...r, reasons});
  });

  const counts = {short_connect:0,misconduct:0,callback:0,form_not_filled:0,hot_convert:0};
  flagged.forEach(f=>f.reasons.forEach(r=>counts[r]++));

  const chipMeta = {short_connect:['flag-short','Short Connect (<30s)'],misconduct:['flag-misconduct','Misconduct Keyword'],callback:['flag-callback','Callback Logged'],form_not_filled:['flag-form','Form Not Filled'],hot_convert:['flag-hot','Hot Convert']};

  let html = `<div class="kpi-grid">`;
  Object.entries(chipMeta).forEach(([key,arr])=>{
    html += `<div class="kpi kpi-clickable" data-flagkey="${key}" title="Click to see these calls"><div class="kpi-label">${arr[1]}</div><div class="kpi-value">${counts[key]}</div></div>`;
  });
  html += `</div>`;

  html += `<div class="filter-bar">` + Object.entries(chipMeta).map(([key,arr])=>`<label><input type="checkbox" class="flagCk" value="${key}" checked> <span class="flag-chip ${arr[0]}">${arr[1]}</span></label>`).join('') + `</div>`;

  html += `<div class="section" id="flagsTableSection"><h2>Flagged Calls <span id="flagsTableTitle" style="font-weight:500;color:var(--text-dim);"></span>${canWrite? '<button id="exportFlags" style="font-size:12px;">⬇ Export CSV</button>' : ''}</h2><div id="flagsTableWrap"></div></div>`;
  app.innerHTML = html;

  function renderTable(){
    const active = [...document.querySelectorAll('.flagCk:checked')].map(c=>c.value);
    const show = flagged.filter(f=>f.reasons.some(r=>active.includes(r)));
    document.getElementById('flagsTableTitle').textContent = active.length===Object.keys(chipMeta).length ? '' : `— ${show.length.toLocaleString()} matching call${show.length===1?'':'s'}`;
    let t = `<table><thead><tr><th>Agent</th><th>Campaign</th><th>Call ID</th>${hasContacts()?'<th>Phone</th>':''}<th>Disposition</th><th>Talk (s)</th>${hasContacts()?'<th>Notes</th>':''}<th>Flags</th></tr></thead><tbody>`;
    show.slice(0,500).forEach(f=>{
      t += `<tr><td>${escapeHtml(f.agent||'—')}</td><td>${escapeHtml(f.campaign||'—')}</td><td>${escapeHtml(f.callId||'—')}</td>${hasContacts()?`<td>${escapeHtml(f.phone||'—')}</td>`:''}<td>${escapeHtml(f.disposition||'—')}</td><td>${f.talkSec||0}</td>${hasContacts()?`<td>${escapeHtml(f.notes||'—')}</td>`:''}<td>${f.reasons.map(r=>`<span class="flag-chip ${chipMeta[r][0]}">${chipMeta[r][1]}</span>`).join(' ')}</td></tr>`;
    });
    t += `</tbody></table>`;
    if(show.length===0) t = `<div class="empty-state">No calls match the selected flag(s).</div>`;
    if(show.length>500) t += `<div class="hint">Showing first 500 of ${show.length} flagged calls.</div>`;
    document.getElementById('flagsTableWrap').innerHTML = t;
    const expBtn = document.getElementById('exportFlags');
    if(expBtn) expBtn.onclick = ()=> downloadCsv('flags_export.csv', ['agent','campaign','callId','phone','disposition','talkSec','notes','reasons'], show.map(f=>({...f, reasons:f.reasons.join('|')})));
  }
  document.querySelectorAll('.flagCk').forEach(ck=>ck.onchange=renderTable);
  document.querySelectorAll('.kpi-clickable').forEach(kpi=>{
    kpi.onclick = ()=>{
      const key = kpi.getAttribute('data-flagkey');
      document.querySelectorAll('.flagCk').forEach(ck=>{ ck.checked = (ck.value===key); });
      document.querySelectorAll('.kpi-clickable').forEach(k=>k.classList.remove('active'));
      kpi.classList.add('active');
      renderTable();
      document.getElementById('flagsTableSection').scrollIntoView({behavior:'smooth', block:'start'});
    };
  });
  renderTable();
}

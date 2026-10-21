// ===== PAGE 7: Upload Status — which dates have each report uploaded (green) or missing (red) =====
async function renderUploadStatus(){
  const app=document.getElementById('app');
  const pull = (table)=> sb.from(table).select('date,file_name,uploaded_at').gte('date',range.start).lte('date',range.end);
  const rowsDef = [
    {label:'Campaign report', note:'Enterprise, Survey and Incoming calls (one file)', table:SOURCES.calls.days},
    {label:'Retention report', note:'Retention calling (separate file)',                    table:SOURCES.queue.days},
    {label:'Conversion data', note:'Conversion file',                      table:'conversion'},
  ];
  const results = await Promise.all(rowsDef.map(r=>pull(r.table)));
  if(results[0].error){ app.innerHTML=`<div class="empty-state">Could not load upload status: ${escapeHtml(results[0].error.message)}</div>`; return; }

  const out=[]; let d=new Date(range.start+'T00:00:00Z'); const end=new Date(range.end+'T00:00:00Z'); let guard=0;
  while(d<=end && guard++<400){ out.push(d.toISOString().slice(0,10)); d=new Date(d.getTime()+86400000); }

  const sections = rowsDef.map((def,i)=>{
    const have = {}; ((results[i].data)||[]).forEach(r=>have[r.date]=r);
    const missing = out.filter(x=>!have[x]).length;
    const chips = out.map(x=>{
      const r=have[x]; const dt=new Date(x+'T00:00:00Z');
      const lbl=dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'});
      const tip = r ? `${def.label} uploaded${r.file_name?': '+r.file_name:''}${r.uploaded_at?' ('+new Date(r.uploaded_at).toLocaleString()+')':''}` : `No ${def.label.toLowerCase()} uploaded for this date`;
      return `<span class="cv-chip ${r?'ok':'miss'}" title="${escapeHtml(tip)}">${lbl}<small>${r?'✓ uploaded':'missing'}</small></span>`;
    }).join('');
    return `<div class="section">
      <h2>${def.label} <span style="font-weight:500;color:var(--text-dim);font-size:13px;">— ${def.note}</span>
        <span class="cv-legend" style="margin-left:auto;">${out.length-missing} uploaded · ${missing} missing</span></h2>
      <div class="cv-row" style="margin-bottom:0;">${chips}</div>
    </div>`;
  }).join('');

  app.innerHTML = sections + `<div class="hint">Green = data uploaded for that date. Red = nothing uploaded yet. Change the dates at the top right to check a different period. A day with no calls (for example a holiday) also shows as missing. Hover over a green box to see the file name and when it was uploaded.</div>`;
}

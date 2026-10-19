// ===== COVERAGE: green/red uploaded-vs-missing day strip (one row per report type) =====
async function renderCoverage(){
  const el=document.getElementById('coverage'); if(!el) return;
  const showConv = activeTab==='conversion';
  const pull = (table)=> sb.from(table).select('date,file_name,uploaded_at').gte('date',range.start).lte('date',range.end);

  // which reports to show a row for
  const rowsDef = showConv
    ? [{label:'Conversion data', table:'conversion'}]
    : [{label:'Campaign report', table:SOURCES.calls.days}, {label:'Queue report', table:SOURCES.queue.days}];
  const results = await Promise.all(rowsDef.map(r=>pull(r.table)));
  if(results[0].error){ el.innerHTML=''; return; }

  const out=[]; let d=new Date(range.start+'T00:00:00Z'); const end=new Date(range.end+'T00:00:00Z'); let guard=0;
  while(d<=end && guard++<400){ out.push(d.toISOString().slice(0,10)); d=new Date(d.getTime()+86400000); }

  el.innerHTML = rowsDef.map((def,i)=>{
    const have = {}; ((results[i].data)||[]).forEach(r=>have[r.date]=r);
    const missing = out.filter(x=>!have[x]).length;
    const chips = out.map(x=>{
      const r=have[x]; const dt=new Date(x+'T00:00:00Z');
      const lbl=dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'});
      const tip = r ? `${def.label} uploaded${r.file_name?': '+r.file_name:''}${r.uploaded_at?' ('+new Date(r.uploaded_at).toLocaleString()+')':''}` : `No ${def.label.toLowerCase()} uploaded for this date`;
      return `<span class="cv-chip ${r?'ok':'miss'}" title="${escapeHtml(tip)}">${lbl}<small>${r?'✓ uploaded':'missing'}</small></span>`;
    }).join('');
    return `<div class="cv-row"><span class="cv-label">${def.label}:</span>${chips}<span class="cv-legend">${out.length-missing} uploaded · ${missing} missing</span></div>`;
  }).join('');
}

// ===== COVERAGE: green/red uploaded-vs-missing day strip =====
async function renderCoverage(){
  const el=document.getElementById('coverage'); if(!el) return;
  const showConv = activeTab==='conversion';
  const pull = (table)=> sb.from(table).select('date,file_name,uploaded_at').gte('date',range.start).lte('date',range.end);
  const [a, b] = await Promise.all([ pull(showConv ? 'conversion' : SOURCES.calls.days), showConv ? Promise.resolve({data:[]}) : pull(SOURCES.queue.days) ]);
  if(a.error){ el.innerHTML=''; return; }
  const have = {};
  (a.data||[]).forEach(r=>{ have[r.date]={...r, kinds:['campaign']}; });
  (b.data||[]).forEach(r=>{ if(have[r.date]){ have[r.date].kinds.push('queue'); have[r.date].file_name=[have[r.date].file_name,r.file_name].filter(Boolean).join(' + '); } else have[r.date]={...r, kinds:['queue']}; });
  const out=[]; let d=new Date(range.start+'T00:00:00Z'); const end=new Date(range.end+'T00:00:00Z'); let guard=0;
  while(d<=end && guard++<400){ out.push(d.toISOString().slice(0,10)); d=new Date(d.getTime()+86400000); }
  const missing = out.filter(x=>!have[x]).length;
  el.innerHTML = `<span class="cv-label">${showConv?'Conversion':'Call'} data status:</span>` + out.map(x=>{
    const r=have[x]; const dt=new Date(x+'T00:00:00Z');
    const lbl=dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'});
    const tip = r ? `Uploaded${r.file_name?': '+r.file_name:''}${r.uploaded_at?' ('+new Date(r.uploaded_at).toLocaleString()+')':''}` : 'No data uploaded';
    return `<span class="cv-chip ${r?'ok':'miss'}" title="${escapeHtml(tip)}">${lbl}<small>${r?(showConv?'✓ uploaded':'✓ '+(r.kinds.length>1?'camp + queue':r.kinds[0])):'missing'}</small></span>`;
  }).join('') + `<span class="cv-legend">${out.length-missing} uploaded · ${missing} missing</span>`;
}

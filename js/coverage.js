// ===== COVERAGE: green/red uploaded-vs-missing day strip =====
async function renderCoverage(){
  const el=document.getElementById('coverage'); if(!el) return;
  const showConv = activeTab==='conversion';
  const table = showConv ? 'conversion' : 'days';
  const { data, error } = await sb.from(table).select('date,file_name,uploaded_at').gte('date',range.start).lte('date',range.end);
  if(error){ el.innerHTML=''; return; }
  const have = {}; (data||[]).forEach(r=>have[r.date]=r);
  const out=[]; let d=new Date(range.start+'T00:00:00Z'); const end=new Date(range.end+'T00:00:00Z'); let guard=0;
  while(d<=end && guard++<400){ out.push(d.toISOString().slice(0,10)); d=new Date(d.getTime()+86400000); }
  const missing = out.filter(x=>!have[x]).length;
  el.innerHTML = `<span class="cv-label">${showConv?'Conversion':'Call'} data status:</span>` + out.map(x=>{
    const r=have[x]; const dt=new Date(x+'T00:00:00Z');
    const lbl=dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',timeZone:'UTC'});
    const tip = r ? `Uploaded${r.file_name?': '+r.file_name:''}${r.uploaded_at?' ('+new Date(r.uploaded_at).toLocaleString()+')':''}` : 'No data uploaded';
    return `<span class="cv-chip ${r?'ok':'miss'}" title="${escapeHtml(tip)}">${lbl}<small>${r?'✓ uploaded':'missing'}</small></span>`;
  }).join('') + `<span class="cv-legend">${out.length-missing} uploaded · ${missing} missing</span>`;
}

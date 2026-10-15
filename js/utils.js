// ===== UTILS: small helpers (dates, formatting, escaping, toast) =====
// ===================== UTIL =====================
function isConnect(disp){ if(!disp) return false; return !NON_CONNECT.includes(String(disp).trim().toLowerCase()); }
function pctClass(p){ if(p>=40) return 'pct-green'; if(p>=30) return 'pct-blue'; if(p>=22) return 'pct-amber'; return 'pct-red'; }
function fmtPct(n){ return (isFinite(n)?n:0).toFixed(1)+'%'; }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function addDays(d,n){ const x=new Date(d+'T00:00:00Z'); x.setUTCDate(x.getUTCDate()+n); return x.toISOString().slice(0,10); }
function startOfWeek(d){ const x=new Date(d+'T00:00:00Z'); const day=x.getUTCDay(); const diff=(day===0?-6:1)-day; x.setUTCDate(x.getUTCDate()+diff); return x.toISOString().slice(0,10); }
function startOfMonth(d){ return d.slice(0,7)+'-01'; }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function normalizeAgent(name){ if(!name) return 'Unknown'; const key=String(name).trim().toLowerCase(); return AGENT_NAME_MAP[key] || String(name).trim(); }
function parseTalkTime(v){
  if(v===undefined||v===null||v==='') return 0;
  if(typeof v==='number'){ return v<1 ? Math.round(v*86400) : Math.round(v); }
  const s=String(v).trim();
  if(/^\d+:\d{2}(:\d{2})?$/.test(s)){ const parts=s.split(':').map(Number); if(parts.length===3) return parts[0]*3600+parts[1]*60+parts[2]; return parts[0]*60+parts[1]; }
  const n=parseFloat(s); if(!isNaN(n)) return n<1? Math.round(n*86400): Math.round(n);
  return 0;
}
function toast(msg){ const el=document.createElement('div'); el.className='toast'; el.textContent=msg; document.getElementById('toastRoot').appendChild(el); setTimeout(()=>el.remove(),3400); }
function csvEscape(v){ if(v==null) return ''; const s=String(v); return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; }
function rowsToCsv(headers, rows){ return headers.join(',')+'\n'+rows.map(r=>headers.map(h=>csvEscape(r[h])).join(',')).join('\n'); }
function downloadCsv(filename, headers, rows){
  const csv = rowsToCsv(headers, rows);
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

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

// ---- scrambled phone key (SHA-256, first 16 hex chars) so repeat customers can be recognised without storing the number ----
function sha256Hex(str){
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const bytes=[...unescape(encodeURIComponent(str))].map(c=>c.charCodeAt(0));
  const l=bytes.length*8; bytes.push(0x80); while(bytes.length%64!==56) bytes.push(0);
  for(let i=7;i>=0;i--) bytes.push(i>=4?0:(l>>>(i*8))&255);
  let h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rr=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let o=0;o<bytes.length;o+=64){
    const w=new Array(64);
    for(let i=0;i<16;i++) w[i]=(bytes[o+i*4]<<24)|(bytes[o+i*4+1]<<16)|(bytes[o+i*4+2]<<8)|bytes[o+i*4+3];
    for(let i=16;i<64;i++){ const s0=rr(w[i-15],7)^rr(w[i-15],18)^(w[i-15]>>>3), s1=rr(w[i-2],17)^rr(w[i-2],19)^(w[i-2]>>>10); w[i]=(w[i-16]+s0+w[i-7]+s1)|0; }
    let [a,b,c,d,e,f,g,hh]=h;
    for(let i=0;i<64;i++){
      const S1=rr(e,6)^rr(e,11)^rr(e,25), ch=(e&f)^(~e&g), t1=(hh+S1+ch+K[i]+w[i])|0;
      const S0=rr(a,2)^rr(a,13)^rr(a,22), mj=(a&b)^(a&c)^(b&c), t2=(S0+mj)|0;
      hh=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
    }
    h=[(h[0]+a)|0,(h[1]+b)|0,(h[2]+c)|0,(h[3]+d)|0,(h[4]+e)|0,(h[5]+f)|0,(h[6]+g)|0,(h[7]+hh)|0];
  }
  return h.map(x=>(x>>>0).toString(16).padStart(8,'0')).join('');
}
function phoneKey(phone){
  const d=String(phone||'').replace(/\D/g,'').slice(-10);
  return d.length>=7 ? sha256Hex(PHONE_KEY_SALT+':'+d).slice(0,16) : '';
}

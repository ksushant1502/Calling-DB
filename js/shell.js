// ===== SHELL: start-up, top menu, date bar, upload menu, page addresses (#/retention/insights) =====
async function init(){
  readHash();
  renderTabNav();
  renderFilterControls();
  await initAuth();
  renderRoleBadge();
  renderUploadControls();
  showOrHideGate();
  if(REQUIRE_LOGIN && !session) return;          // nothing loads until someone signs in
  await refreshTab();
}

// ---- page address in the URL, so a link opens the same page (e.g. …/#/retention/insights) ----
function readHash(){
  const parts = (location.hash||'').replace(/^#\/?/,'').split('/').filter(Boolean);
  const page = parts[0];
  if(page && (TABS.some(t=>t.id===page) || page==='flags')) activeTab = page;
  if(sectionById(activeTab)) activeSub = SUBTABS.some(s=>s.id===parts[1]) ? parts[1] : 'summary';
}
function writeHash(){
  const h = '#/'+activeTab+(sectionById(activeTab) && activeSub!=='summary' ? '/'+activeSub : '');
  if(location.hash!==h) history.replaceState(null,'',h);
}
window.addEventListener('hashchange', ()=>{ readHash(); renderTabNav(); refreshTab(); });

// go to a page (and optionally a sub-page inside a section)
function goTo(page, sub){
  activeTab = page;
  if(sectionById(page)) activeSub = sub || 'summary';
  renderTabNav(); refreshTab(); window.scrollTo({top:0});
}

function renderRoleBadge(){
  const wrap = document.getElementById('roleBadgeWrap');
  wrap.innerHTML = !REQUIRE_LOGIN
    ? '<span class="badge admin" title="Login is switched off while the dashboard is being built">Build mode</span>'
    : canWrite
    ? '<span class="badge admin">Editor</span>'
    : '<span class="badge public">View only</span>';
}

function renderTabNav(){
  const nav = document.getElementById('tabNav');
  nav.innerHTML = TABS.map(t=>{
    const sec = sectionById(t.id);
    const lead = sec ? `<i class="nav-dot" style="background:${sec.color}"></i>` : (ICONS[t.id]||'');
    const on = activeTab===t.id || (t.id==='home' && activeTab==='flags');
    return `${t.sep?'<span class="nav-sep"></span>':''}<button class="nav-btn ${on?'active':''}" data-tab="${t.id}">${lead}<span>${t.label}</span></button>`;
  }).join('');
  nav.querySelectorAll('[data-tab]').forEach(btn=>{ btn.onclick = ()=>goTo(btn.getAttribute('data-tab')); });
  writeHash();
}

// ---- date bar ----
function fmtDay(ymd, withYear){
  const d=new Date(ymd+'T00:00:00Z');
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',...(withYear?{year:'numeric'}:{}),timeZone:'UTC'});
}
function rangeDays(){ return Math.round((new Date(range.end+'T00:00:00Z')-new Date(range.start+'T00:00:00Z'))/86400000)+1; }
function prevRangeText(){
  const n=rangeDays(), pe=addDays(range.start,-1), ps=addDays(pe,-(n-1));
  return ps===pe ? fmtDay(ps) : `${fmtDay(ps)} – ${fmtDay(pe)}`;
}
function renderRangeSummary(daysWithData){
  const el=document.getElementById('rangeSummary'); if(!el) return;
  const n=rangeDays();
  const span = range.start===range.end ? fmtDay(range.start,true) : `${fmtDay(range.start)} – ${fmtDay(range.end,true)}`;
  el.innerHTML = `<span class="ctx-range">${span}</span>
    <span class="ctx-meta">${daysWithData!=null?`${daysWithData} of ${n} day${n===1?'':'s'} with data`:`${n} day${n===1?'':'s'}`}${activeTab!=='uploads'?` · vs ${prevRangeText()}`:''}</span>`;
}

function renderFilterControls(){
  const el = document.getElementById('filterControls');
  const presets = ['Today','Yesterday','Last 7 Days','This Month','Last Month'];
  el.innerHTML = `<div class="seg">${presets.map(l=>`<button data-preset="${l}" class="${range.label===l?'active':''}">${l}</button>`).join('')}</div>
    <div class="daterange ${range.label==='Custom'?'active':''}"><input type="date" id="customStart" value="${range.start}" aria-label="From"><span>→</span><input type="date" id="customEnd" value="${range.end}" aria-label="To"><button id="applyCustom" class="primary">Apply</button></div>`;
  const t=todayStr(), lmEnd=addDays(startOfMonth(t),-1);
  const presetFns = {
    'Today': ()=>setRange(t, t, 'Today'),
    'Yesterday': ()=>setRange(addDays(t,-1), addDays(t,-1), 'Yesterday'),
    'Last 7 Days': ()=>setRange(addDays(t,-6), t, 'Last 7 Days'),
    'This Month': ()=>setRange(startOfMonth(t), t, 'This Month'),
    'Last Month': ()=>setRange(startOfMonth(lmEnd), lmEnd, 'Last Month'),
  };
  Object.entries(presetFns).forEach(([label,fn])=>{ const b=el.querySelector(`[data-preset="${label}"]`); if(b) b.onclick=fn; });
  el.querySelector('#applyCustom').onclick = ()=>{
    const s=el.querySelector('#customStart').value, e=el.querySelector('#customEnd').value;
    if(s&&e&&s<=e) setRange(s,e,'Custom'); else toast('Pick a valid start and end date');
  };
}
function setRange(start,end,label){ range={start,end,label}; renderFilterControls(); refreshTab(); }

// ---- upload menu (one button, two choices) ----
function renderUploadControls(){
  const el = document.getElementById('uploadControls');
  if(!canWrite){ el.innerHTML = session ? `<button id="logoutBtn">Sign out</button>` : ''; if(session) document.getElementById('logoutBtn').onclick=logout; return; }
  el.innerHTML = `<div class="menu-wrap">
      <button class="primary" id="uploadMenuBtn" aria-haspopup="true">＋ Upload</button>
      <div class="menu" id="uploadMenu" hidden>
        <button id="uploadCallBtn"><b>Calling report</b><small>Campaign report or Retention report — several files at once</small></button>
        <button id="uploadConvBtn"><b>Conversion file</b><small>Activations and extensions with the agent who converted</small></button>
      </div>
    </div>${REQUIRE_LOGIN?'<button id="logoutBtn">Log out</button>':''}`;
  const menu = el.querySelector('#uploadMenu');
  el.querySelector('#uploadMenuBtn').onclick = (e)=>{ e.stopPropagation(); menu.hidden = !menu.hidden; };
  document.addEventListener('click', ()=>{ menu.hidden = true; });
  el.querySelector('#uploadCallBtn').onclick = ()=>{ menu.hidden=true; openUploadModal(); };
  el.querySelector('#uploadConvBtn').onclick = ()=>{ menu.hidden=true; openConversionUploadModal(); };
  const lo = el.querySelector('#logoutBtn'); if(lo) lo.onclick = logout;
}

// Clicking the Yulu logo takes you home
(function wireBrandHome(){
  const b=document.getElementById('brandHome'); if(!b) return;
  b.onclick=()=>goTo('home');
  b.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); goTo('home'); } };
})();

// ---- small shared page pieces ----
function pageHead(title, desc, color, extra){
  return `<div class="page-head" ${color?`style="--sc:${color}"`:''}>
    <div class="page-head-text">${color?'<i class="ph-dot"></i>':''}<div><h1>${title}</h1>${desc?`<p>${desc}</p>`:''}</div></div>
    ${extra?`<div class="page-head-extra">${extra}</div>`:''}
  </div>`;
}
// ▲ / ▼ change chip.  kind: 'pct' (relative %), 'pts' (percentage points), 'abs'
function deltaChip(cur, prev, kind){
  if(prev==null || !isFinite(prev) || (kind!=='pts' && !prev)) return '';
  let d, txt;
  if(kind==='pts'){ d=cur-prev; txt=Math.abs(d).toFixed(1)+' pts'; }
  else if(kind==='abs'){ d=cur-prev; txt=Math.abs(d).toLocaleString(); }
  else { d=(cur-prev)/prev*100; txt=Math.abs(d).toFixed(0)+'%'; }
  const flat = kind==='pts' ? Math.abs(d)<0.5 : kind==='abs' ? d===0 : Math.abs(d)<1;
  const cls = flat?'flat':(d>0?'up':'down');
  return `<span class="delta ${cls}" title="Compared with ${prevRangeText()}">${flat?'●':d>0?'▲':'▼'} ${txt}</span>`;
}
function fmtNum(n){ return (n||0).toLocaleString(); }

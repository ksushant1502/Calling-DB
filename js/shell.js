// ===== SHELL: start-up, sidebar menu, date/type filters, upload buttons =====
async function init(){
  renderTabNav();
  renderFilterControls();
  await initAuth();
  renderRoleBadge();
  renderUploadControls();
  await refreshTab();
}

function renderRoleBadge(){
  const wrap = document.getElementById('roleBadgeWrap');
  wrap.innerHTML = canWrite
    ? '<span class="badge admin">Editor</span>'
    : '<span class="badge public">View only</span>';
}

function renderTabNav(){
  const nav = document.getElementById('tabNav');
  nav.innerHTML = TABS.map((t,i)=>`<button class="nav-btn ${activeTab===t.id?'active':''}" data-tab="${t.id}">${ICONS[t.id]||''}<span>${t.label}</span><span class="nav-num">${i+1}</span></button>`).join('');
  nav.querySelectorAll('[data-tab]').forEach(btn=>{
    btn.onclick = ()=>{ activeTab = btn.getAttribute('data-tab'); renderTabNav(); renderFilterControls(); refreshTab(); };
  });
  const tab = TABS.find(t=>t.id===activeTab);
  document.getElementById('pageTitle').textContent = tab ? tab.title : '';
}

// pages where the "campaign type" chips make sense (Overview & Campaign Types already show every type)
function showsTypeChips(tab){ return ['agents','insights','flags'].includes(tab); }

function renderFilterControls(){
  const el = document.getElementById('filterControls');
  const presets = ['Today','This Week','Last 7 Days','This Month'];
  let html = `<div class="seg">${presets.map(l=>`<button data-preset="${l}" class="${range.label===l?'active':''}">${l}</button>`).join('')}</div>`;
  html += `<div class="daterange"><input type="date" id="customStart" value="${range.start}"><span>→</span><input type="date" id="customEnd" value="${range.end}"><button id="applyCustom" class="primary">Apply</button></div>`;
  if(showsTypeChips(activeTab)){
    html += `<div class="typebar" style="width:100%;justify-content:flex-end;margin:0;">
      <button class="chip ${typeFilter==='all'?'active':''}" data-type="all">All types</button>
      ${CAMPAIGN_TYPES.filter(t=>t.id!=='other').map(t=>`<button class="chip ${typeFilter===t.id?'active':''}" data-type="${t.id}">${t.label}</button>`).join('')}
    </div>`;
  }
  el.innerHTML = html;

  const presetFns = {
    'Today': ()=>setRange(todayStr(), todayStr(), 'Today'),
    'This Week': ()=>setRange(startOfWeek(todayStr()), todayStr(), 'This Week'),
    'Last 7 Days': ()=>setRange(addDays(todayStr(),-6), todayStr(), 'Last 7 Days'),
    'This Month': ()=>setRange(startOfMonth(todayStr()), todayStr(), 'This Month'),
  };
  Object.entries(presetFns).forEach(([label,fn])=>{ const b=el.querySelector(`[data-preset="${label}"]`); if(b) b.onclick=fn; });
  el.querySelector('#applyCustom').onclick = ()=>{
    const s=el.querySelector('#customStart').value, e=el.querySelector('#customEnd').value;
    if(s&&e&&s<=e) setRange(s,e,'Custom'); else toast('Pick a valid start/end date');
  };
  el.querySelectorAll('[data-type]').forEach(b=>{ b.onclick=()=>{ typeFilter=b.getAttribute('data-type'); renderFilterControls(); refreshTab(); }; });
}

function setRange(start,end,label){ range={start,end,label}; renderFilterControls(); refreshTab(); }

function renderUploadControls(){
  const el = document.getElementById('uploadControls');
  if(!canWrite){ el.innerHTML = `<button id="loginBtn" class="primary">Editor Login</button>`; document.getElementById('loginBtn').onclick=openLoginModal; return; }
  el.innerHTML = `<button class="primary" id="uploadCallBtn">＋ Upload Calling CSV</button><button id="uploadConvBtn">＋ Upload Conversion CSV</button><button id="logoutBtn">Log Out</button>`;
  el.querySelector('#uploadCallBtn').onclick = openUploadModal;
  el.querySelector('#uploadConvBtn').onclick = openConversionUploadModal;
  el.querySelector('#logoutBtn').onclick = logout;
}

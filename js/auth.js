// ===== AUTH: email + password sign-in (company emails only) + editor check =====
const ALLOWED_DOMAIN = 'yulu.bike';

async function initAuth(){
  const { data } = await sb.auth.getSession();
  session = data.session;
  await applySession();
  sb.auth.onAuthStateChange(async (event, newSession)=>{
    if((newSession && newSession.access_token) === (session && session.access_token)) return;
    session = newSession;
    await applySession();
    renderRoleBadge(); renderUploadControls(); showOrHideGate(); if(session) refreshTab();
  });
}

// Work out if the signed-in person is allowed in, and whether they are an editor.
async function applySession(){
  canWrite = false;
  if(!session) return;
  const email = (session.user.email||'').toLowerCase();
  if(!email.endsWith('@'+ALLOWED_DOMAIN)){ window.__notAllowed=true; await sb.auth.signOut(); session=null; return; }
  const { data } = await sb.from('editors').select('email').eq('email', email).maybeSingle();
  canWrite = !!data;
}

function showOrHideGate(){
  const root = document.getElementById('modalRoot');
  if(session){ if(document.getElementById('ovGate')) root.innerHTML=''; return; }
  root.innerHTML = `<div class="overlay" id="ovGate"><div class="modal" style="max-width:380px;">
    <div class="brand-logo" style="margin:0 auto 10px;">Y</div>
    <h3 style="text-align:center;">Yulu Telecalling Dashboard</h3>
    <p class="hint" style="text-align:center;">Sign in with the email and password given to you.</p>
    <div class="field"><label>Email</label><input type="email" id="loginEmail" autocomplete="username"></div>
    <div class="field"><label>Password</label><input type="password" id="loginPassword" autocomplete="current-password"></div>
    <div id="gateError" style="color:var(--red);font-size:12.5px;display:none;margin-bottom:8px;"></div>
    <div class="modal-actions"><button class="primary" id="doLogin">Sign In</button></div>
  </div></div>`;
  if(window.__notAllowed){ const e=document.getElementById('gateError'); e.style.display='block'; e.textContent='Only @'+ALLOWED_DOMAIN+' accounts can open this dashboard.'; window.__notAllowed=false; }
  const submit = async ()=>{
    const email=document.getElementById('loginEmail').value.trim();
    const password=document.getElementById('loginPassword').value;
    const btn=document.getElementById('doLogin'); btn.disabled=true; btn.textContent='Signing in…';
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if(error){
      const e=document.getElementById('gateError'); e.style.display='block'; e.textContent=error.message;
      btn.disabled=false; btn.textContent='Sign In';
    }
  };
  document.getElementById('doLogin').onclick = submit;
  document.getElementById('loginPassword').addEventListener('keydown',e=>{ if(e.key==='Enter') submit(); });
}

function openLoginModal(){ showOrHideGate(); }
async function logout(){ await sb.auth.signOut(); session=null; canWrite=false; toast('Signed out'); showOrHideGate(); document.getElementById('app').innerHTML=''; }

// ===== AUTH: editor login / logout (Supabase Auth) =====
// ===================== AUTH =====================
async function initAuth(){
  const { data } = await sb.auth.getSession();
  session = data.session;
  canWrite = !!session;
  sb.auth.onAuthStateChange((event, newSession)=>{
    session = newSession; canWrite = !!session;
    renderRoleBadge(); renderUploadControls(); refreshTab();
  });
}
function openLoginModal(){
  const root=document.getElementById('modalRoot');
  root.innerHTML = `<div class="overlay" id="ovLogin"><div class="modal" style="max-width:360px;">
    <h3>Editor Login</h3>
    <div class="field"><label>Email</label><input type="email" id="loginEmail"></div>
    <div class="field"><label>Password</label><input type="password" id="loginPassword"></div>
    <div id="loginError" style="color:var(--red);font-size:12.5px;display:none;margin-bottom:8px;"></div>
    <div class="modal-actions"><button id="cancelLogin">Cancel</button><button class="primary" id="doLogin">Log In</button></div>
  </div></div>`;
  document.getElementById('cancelLogin').onclick=()=>root.innerHTML='';
  document.getElementById('ovLogin').addEventListener('click',e=>{ if(e.target.id==='ovLogin') root.innerHTML=''; });
  document.getElementById('doLogin').onclick = async ()=>{
    const email=document.getElementById('loginEmail').value.trim();
    const password=document.getElementById('loginPassword').value;
    const btn=document.getElementById('doLogin'); btn.disabled=true; btn.textContent='Logging in…';
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if(error){
      document.getElementById('loginError').style.display='block';
      document.getElementById('loginError').textContent = error.message;
      btn.disabled=false; btn.textContent='Log In';
    } else {
      root.innerHTML='';
      toast('Logged in as editor');
    }
  };
}
async function logout(){ await sb.auth.signOut(); toast('Logged out'); }

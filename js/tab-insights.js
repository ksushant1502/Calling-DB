// ===== PAGE 4: Insights & VoC =====
// ===================== INSIGHTS & VoC =====================
let insightsCampaignFilter='', insightsSearch='';
async function renderInsights(){
  const app=document.getElementById('app');
  if(dayDocs.length===0){ app.innerHTML=`<div class="empty-state">No data for this range.</div>`; return; }
  app.innerHTML = `<div class="empty-state"><span class="spinner"></span>Loading response detail…</div>`;
  const rows = (await loadRowsForRange()).filter(r=>lobInFilter(r.lob));
  const campaigns = [...new Set(rows.map(r=>r.campaign))].sort();
  const filtered = rows.filter(r=> (!insightsCampaignFilter || r.campaign===insightsCampaignFilter) );

  const isBlank = a=> /^(na|n\/a|not connected|not answered|none|null|-|nil)$/i.test(String(a).trim());
  const TOP_N = 6;
  const FLAG_LABEL = {short_connect:'Short connect', misconduct:'Misconduct', callback:'Callback', form_not_filled:'Form not filled', hot_convert:'Hot convert'};

  // group by campaign
  const byC = {};
  filtered.forEach(r=>{ (byC[r.campaign||'—'] = byC[r.campaign||'—'] || []).push(r); });
  const camps = Object.entries(byC).map(([name,rws])=>{
    const connected = rws.filter(r=>isConnect(r.disposition));
    const talk = connected.reduce((n,r)=>n+(+r.talkSec||0),0);
    const flags = {};
    rws.forEach(r=>(r.flags||[]).forEach(f=>{ if(f) flags[f]=(flags[f]||0)+1; }));
    const qa = {};
    rws.forEach(r=>{
      Object.entries(r.form||{}).forEach(([q,a])=>{
        if(a===undefined||a===null||a==='') return;
        qa[q] = qa[q]||{}; qa[q][a] = qa[q][a]||[]; qa[q][a].push(r);
      });
    });
    const disp = {};
    rws.forEach(r=>{ const d=r.disposition||'—'; disp[d]=(disp[d]||0)+1; });
    const byDate = {}, byAgent = {};
    rws.forEach(r=>{
      const con = isConnect(r.disposition);
      const dd = byDate[r.date||'—'] = byDate[r.date||'—'] || {calls:0,conn:0}; dd.calls++; if(con) dd.conn++;
      const ag = byAgent[r.agent||'—'] = byAgent[r.agent||'—'] || {calls:0,conn:0}; ag.calls++; if(con) ag.conn++;
    });
    return {byDate, byAgent, name, rws, calls:rws.length, connected:connected.length, avgTalk: connected.length? talk/connected.length : 0, flags, qa, disp, lob:rws[0].lob};
  }).sort((a,b)=>b.calls-a.calls);

  let html = `<div class="filter-bar">
    <select id="insCampaign"><option value="">All Campaigns</option>${campaigns.map(c=>`<option value="${escapeHtml(c)}" ${insightsCampaignFilter===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select>
    <input type="text" id="insSearch" placeholder="Search call ID, agent, phone or notes…" value="${escapeHtml(insightsSearch)}" style="min-width:220px;">
    <button id="insToggleAll" type="button">Expand / collapse all</button>
  </div>`;

  const barRow=(key,q,ans,n,pct,muted,pctTxt)=>`<div class="insight-bar-row ${muted?'muted':''}" data-c="${escapeHtml(key)}" data-q="${escapeHtml(q)}" data-ans="${escapeHtml(ans)}" title="${escapeHtml(ans)}">
      <div class="insight-bar-top"><span class="insight-bar-label">${escapeHtml(ans)}</span><span class="insight-bar-count">${n.toLocaleString()}${pctTxt?` <small>${pctTxt}</small>`:''}</span></div>
      <div class="insight-bar-track"><div class="insight-bar-fill" style="width:${pct}%;"></div></div>
    </div>`;

  if(!camps.length){
    html += `<div class="empty-state">No call detail found for this selection.</div>`;
  } else {
    camps.forEach((c,ci)=>{
      const cr = c.calls? (c.connected/c.calls*100):0;
      const topFlags = Object.entries(c.flags).sort((a,b)=>b[1]-a[1]).slice(0,4)
        .map(([f,n])=>`<span class="flag-chip flag-${f==='short_connect'?'short':f==='misconduct'?'misconduct':f==='callback'?'callback':f==='hot_convert'?'hot':'form'}">${FLAG_LABEL[f]||f}: ${n}</span>`).join(' ');
      const topDisp = Object.entries(c.disp).sort((a,b)=>b[1]-a[1]).slice(0,4)
        .map(([d,n])=>`${escapeHtml(d)} <b>${n.toLocaleString()}</b>`).join(' · ');
      const qs = Object.keys(c.qa).map(q=>{
        const all = Object.entries(c.qa[q]).sort((x,y)=>y[1].length-x[1].length);
        const real = all.filter(([a])=>!isBlank(a)), blank = all.filter(([a])=>isBlank(a));
        return {q, real, blank, realTotal: real.reduce((n,[,r])=>n+r.length,0), blankTotal: blank.reduce((n,[,r])=>n+r.length,0)};
      }).filter(x=>x.realTotal>0).sort((x,y)=>y.realTotal-x.realTotal);

      html += `<details class="camp-ins" data-c="${escapeHtml(c.name)}" ${(camps.length===1||insightsCampaignFilter||ci===0)?'open':''}>
        <summary>
          <div class="camp-ins-head">
            <div class="camp-ins-name">${escapeHtml(c.name)} ${c.lob?`<span class="queue-tag">${escapeHtml(campaignTypeOf(c.lob).label)}</span>`:''}</div>
            <div class="camp-ins-stats">
              <span><b>${c.calls.toLocaleString()}</b> calls</span>
              <span><b>${cr.toFixed(0)}%</b> connected</span>
              <span><b>${Math.round(c.avgTalk)}s</b> avg talk</span>
              <span><b>${qs.length}</b> question${qs.length===1?'':'s'} answered</span>
            </div>
          </div>
        </summary>
        <div class="camp-ins-body">
          <div class="camp-ins-meta"><div><span class="hint">Top dispositions:</span> ${topDisp||'—'}</div>${topFlags?`<div style="margin-top:6px;">${topFlags}</div>`:''}</div>
          <div class="camp-charts">
            <div class="camp-chart"><h4>Daily calls &amp; connects</h4><div class="cc-box"><canvas id="cc-d-${ci}"></canvas></div></div>
            <div class="camp-chart"><h4>Disposition mix</h4><div class="cc-box"><canvas id="cc-p-${ci}"></canvas></div></div>
            <div class="camp-chart"><h4>Top agents (calls vs connects)</h4><div class="cc-box"><canvas id="cc-a-${ci}"></canvas></div></div>
          </div>
          ${qs.length? `<div class="insight-grid">` + qs.map(st=>{
            let h = `<div class="insight-card" id="card-${ci}-${sanitizeId(st.q)}"><h3>${escapeHtml(st.q)}</h3>
              <div class="insight-total"><b>${st.realTotal.toLocaleString()}</b> answered${st.blankTotal?` · ${st.blankTotal.toLocaleString()} NA / not connected`:''}</div>`;
            st.real.forEach(([ans,rws],i)=>{
              const pct = st.realTotal? (rws.length/st.realTotal*100):0;
              h += `<div class="${i>=TOP_N?'insight-extra':''}" ${i>=TOP_N?'style="display:none"':''}>${barRow(c.name,st.q,ans,rws.length,pct,false,pct.toFixed(0)+'%')}</div>`;
            });
            if(st.real.length>TOP_N) h += `<button class="insight-more" type="button">Show ${st.real.length-TOP_N} more</button>`;
            st.blank.forEach(([ans,rws])=>{ h += barRow(c.name,st.q,ans,rws.length,0,true,''); });
            return h + `</div>`;
          }).join('') + `</div>` : `<div class="hint">No form answers for this campaign in the selected range.</div>`}
        </div>
      </details>`;
    });
    html += `<div class="section" id="insightDrillSection" style="display:none;"><h2 id="insightDrillTitle"></h2><div id="insightDrillBody"></div></div>`;
  }
  app.innerHTML = html;

  const drawCampCharts=(ci)=>{
    const c=camps[ci]; if(!c||typeof Chart==='undefined') return;
    const st=getComputedStyle(document.documentElement);
    const accent=st.getPropertyValue('--accent').trim(), green=st.getPropertyValue('--green').trim();
    const dim=st.getPropertyValue('--text-dim').trim(), border=st.getPropertyValue('--border').trim(), text=st.getPropertyValue('--text').trim();
    const mk=(id,cfg)=>{ const el=document.getElementById(id); if(!el) return; if(charts[id]) charts[id].destroy(); charts[id]=new Chart(el,cfg); };
    const base={responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:text,usePointStyle:true,boxWidth:8}}}};
    const ax=(grid)=>({ticks:{color:dim},grid:grid?{color:border}:{display:false}});
    const dates=Object.keys(c.byDate).sort();
    mk('cc-d-'+ci,{type:'bar',data:{labels:dates.map(d=>d.slice(5)),datasets:[
      {label:'Calls',data:dates.map(d=>c.byDate[d].calls),backgroundColor:accent+'55',borderRadius:4},
      {label:'Connects',data:dates.map(d=>c.byDate[d].conn),backgroundColor:green,borderRadius:4}]},
      options:{...base,scales:{x:ax(false),y:{...ax(true),beginAtZero:true}}}});
    const disp=Object.entries(c.disp).sort((a,b)=>b[1]-a[1]);
    const top=disp.slice(0,6), rest=disp.slice(6).reduce((n,[,v])=>n+v,0); if(rest) top.push(['Other',rest]);
    mk('cc-p-'+ci,{type:'bar',data:{labels:top.map(x=>x[0]),datasets:[{label:'Calls',data:top.map(x=>x[1]),backgroundColor:top.map(x=>isConnect(x[0])?green:'#c4cad8'),borderRadius:4}]},
      options:{...base,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{...ax(true),beginAtZero:true},y:ax(false)}}});
    const ags=Object.entries(c.byAgent).sort((a,b)=>b[1].calls-a[1].calls).slice(0,6);
    mk('cc-a-'+ci,{type:'bar',data:{labels:ags.map(x=>x[0]),datasets:[
      {label:'Calls',data:ags.map(x=>x[1].calls),backgroundColor:accent+'55',borderRadius:4},
      {label:'Connects',data:ags.map(x=>x[1].conn),backgroundColor:green,borderRadius:4}]},
      options:{...base,indexAxis:'y',scales:{x:{...ax(true),beginAtZero:true},y:ax(false)}}});
  };
  app.querySelectorAll('details.camp-ins').forEach((d,ci)=>{
    if(d.open) drawCampCharts(ci);
    d.addEventListener('toggle',()=>{ if(d.open) drawCampCharts(ci); });
  });
  document.getElementById('insCampaign').onchange = (e)=>{ insightsCampaignFilter=e.target.value; renderInsights(); };
  document.getElementById('insSearch').oninput = (e)=>{ insightsSearch=e.target.value; };
  document.getElementById('insToggleAll').onclick = ()=>{
    const ds=[...app.querySelectorAll('details.camp-ins')]; const anyClosed=ds.some(d=>!d.open); ds.forEach(d=>d.open=anyClosed);
  };
  app.querySelectorAll('.insight-more').forEach(btn=>{
    btn.onclick=()=>{
      const open = btn.dataset.open==='1';
      btn.parentElement.querySelectorAll('.insight-extra').forEach(e=>e.style.display=open?'none':'');
      btn.dataset.open = open?'0':'1';
      btn.textContent = open? 'Show more' : 'Show less';
    };
  });
  app.querySelectorAll('.insight-bar-row').forEach(row=>{
    row.onclick = ()=>{
      app.querySelectorAll('.insight-card.active').forEach(c=>c.classList.remove('active'));
      const cn=row.getAttribute('data-c'), q=row.getAttribute('data-q'), ans=row.getAttribute('data-ans');
      const card = row.closest('.insight-card'); if(card) card.classList.add('active');
      const camp = camps.find(x=>x.name===cn);
      let rws = (camp && camp.qa[q] && camp.qa[q][ans]) || [];
      const search = insightsSearch.toLowerCase();
      if(search) rws = rws.filter(r=> String(r.callId||'').toLowerCase().includes(search) || (r.agent||'').toLowerCase().includes(search) || (r.phone||'').toLowerCase().includes(search) || (r.notes||'').toLowerCase().includes(search));
      const section = document.getElementById('insightDrillSection');
      document.getElementById('insightDrillTitle').textContent = `${cn} — ${q} — "${ans}"`;
      let dhtml = `<table><thead><tr><th>Call ID</th>${hasContacts()?'<th>Phone</th>':''}<th>Agent</th><th>Campaign</th><th>Disposition</th>${hasContacts()?'<th>Notes</th>':''}</tr></thead><tbody>`;
      rws.slice(0,300).forEach(r=>{ dhtml+=`<tr><td>${escapeHtml(String(r.callId||'—'))}</td>${hasContacts()?`<td>${escapeHtml(r.phone||'—')}</td>`:''}<td>${escapeHtml(r.agent||'—')}</td><td>${escapeHtml(r.campaign||'—')}</td><td>${escapeHtml(r.disposition||'—')}</td>${hasContacts()?`<td>${escapeHtml(r.notes||'—')}</td>`:''}</tr>`; });
      dhtml += `</tbody></table>`;
      if(rws.length>300) dhtml += `<div class="hint">Showing first 300 of ${rws.length} matches.</div>`;
      if(canWrite) dhtml += `<button id="exportInsight" style="margin-top:8px;">⬇ Export CSV (${rws.length})</button>`;
      document.getElementById('insightDrillBody').innerHTML = dhtml;
      section.style.display = '';
      section.scrollIntoView({behavior:'smooth', block:'nearest'});
      if(canWrite) document.getElementById('exportInsight').onclick = ()=> downloadCsv(`insight_${cn}_${q}_${ans}.csv`.replace(/[^\w.-]/g,'_'), ['callId','phone','agent','campaign','disposition','notes'], rws);
    };
  });
}
function sanitizeId(s){ return String(s).replace(/[^a-z0-9]/gi,'_'); }

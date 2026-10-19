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

  const qa = {};
  filtered.forEach(r=>{
    Object.entries(r.form||{}).forEach(([q,a])=>{
      if(a===undefined||a===null||a==='') return;
      qa[q] = qa[q]||{};
      qa[q][a] = qa[q][a]||[];
      qa[q][a].push(r);
    });
  });

  let html = `<div class="filter-bar">
    <select id="insCampaign"><option value="">All Campaigns</option>${campaigns.map(c=>`<option value="${escapeHtml(c)}" ${insightsCampaignFilter===c?'selected':''}>${escapeHtml(c)}</option>`).join('')}</select>
    <input type="text" id="insSearch" placeholder="Search call ID, agent, phone or notes…" value="${escapeHtml(insightsSearch)}" style="min-width:220px;">
  </div>`;

  const qKeys = Object.keys(qa);
  if(qKeys.length===0){
    html += `<div class="empty-state">No form/questionnaire answers found for this selection.</div>`;
  } else {
    const isBlank = a=> /^(na|n\/a|not connected|not answered|none|null|-|nil)$/i.test(String(a).trim());
    const TOP_N = 6;
    // questions with most real answers first
    const stats = qKeys.map(q=>{
      const all = Object.entries(qa[q]).sort((x,y)=>y[1].length-x[1].length);
      const real = all.filter(([ans])=>!isBlank(ans));
      const blank = all.filter(([ans])=>isBlank(ans));
      const realTotal = real.reduce((n,[,r])=>n+r.length,0);
      const blankTotal = blank.reduce((n,[,r])=>n+r.length,0);
      return {q, real, blank, realTotal, blankTotal};
    }).sort((x,y)=>y.realTotal-x.realTotal);
    const barRow=(q,ans,n,pct,muted,pctTxt)=>`<div class="insight-bar-row ${muted?'muted':''}" data-q="${escapeHtml(q)}" data-ans="${escapeHtml(ans)}" title="${escapeHtml(ans)}">
          <div class="insight-bar-top"><span class="insight-bar-label">${escapeHtml(ans)}</span><span class="insight-bar-count">${n.toLocaleString()}${pctTxt?` <small>${pctTxt}</small>`:''}</span></div>
          <div class="insight-bar-track"><div class="insight-bar-fill" style="width:${pct}%;"></div></div>
        </div>`;
    html += `<div class="insight-grid">`;
    stats.forEach(st=>{
      const {q, real, blank, realTotal, blankTotal} = st;
      html += `<div class="insight-card" id="card-${sanitizeId(q)}"><h3>${escapeHtml(q)}</h3>
        <div class="insight-total"><b>${realTotal.toLocaleString()}</b> answered${blankTotal?` · ${blankTotal.toLocaleString()} NA / not connected`:''}</div>`;
      if(!real.length) html += `<div class="hint">No real answers in this range.</div>`;
      real.forEach(([ans,rws],i)=>{
        const pct = realTotal? (rws.length/realTotal*100):0;
        html += `<div class="${i>=TOP_N?'insight-extra':''}" ${i>=TOP_N?'style="display:none"':''}>${barRow(q,ans,rws.length,pct,false,pct.toFixed(0)+'%')}</div>`;
      });
      if(real.length>TOP_N) html += `<button class="insight-more" type="button">Show ${real.length-TOP_N} more</button>`;
      blank.forEach(([ans,rws])=>{ html += barRow(q,ans,rws.length,0,true,''); });
      html += `</div>`;
    });
    html += `</div>`;
    html += `<div class="section" id="insightDrillSection" style="display:none;"><h2 id="insightDrillTitle"></h2><div id="insightDrillBody"></div></div>`;
  }
  app.innerHTML = html;

  document.getElementById('insCampaign').onchange = (e)=>{ insightsCampaignFilter=e.target.value; renderInsights(); };
  document.getElementById('insSearch').oninput = (e)=>{ insightsSearch=e.target.value; };

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
      const q=row.getAttribute('data-q'), ans=row.getAttribute('data-ans');
      const card = document.getElementById('card-'+sanitizeId(q));
      if(card) card.classList.add('active');
      let rws = qa[q][ans];
      const search = insightsSearch.toLowerCase();
      if(search) rws = rws.filter(r=> String(r.callId||'').toLowerCase().includes(search) || (r.agent||'').toLowerCase().includes(search) || (r.phone||'').toLowerCase().includes(search) || (r.notes||'').toLowerCase().includes(search));
      const section = document.getElementById('insightDrillSection');
      document.getElementById('insightDrillTitle').textContent = `${q} — "${ans}"`;
      let dhtml = `<table><thead><tr><th>Call ID</th>${hasContacts()?'<th>Phone</th>':''}<th>Agent</th><th>Campaign</th><th>Disposition</th>${hasContacts()?'<th>Notes</th>':''}</tr></thead><tbody>`;
      rws.slice(0,300).forEach(r=>{ dhtml+=`<tr><td>${escapeHtml(String(r.callId||'—'))}</td>${hasContacts()?`<td>${escapeHtml(r.phone||'—')}</td>`:''}<td>${escapeHtml(r.agent||'—')}</td><td>${escapeHtml(r.campaign||'—')}</td><td>${escapeHtml(r.disposition||'—')}</td>${hasContacts()?`<td>${escapeHtml(r.notes||'—')}</td>`:''}</tr>`; });
      dhtml += `</tbody></table>`;
      if(rws.length>300) dhtml += `<div class="hint">Showing first 300 of ${rws.length} matches.</div>`;
      if(canWrite) dhtml += `<button id="exportInsight" style="margin-top:8px;">⬇ Export CSV (${rws.length})</button>`;
      document.getElementById('insightDrillBody').innerHTML = dhtml;
      section.style.display = '';
      section.scrollIntoView({behavior:'smooth', block:'nearest'});
      if(canWrite) document.getElementById('exportInsight').onclick = ()=> downloadCsv(`insight_${q}_${ans}.csv`.replace(/[^\w.-]/g,'_'), ['callId','phone','agent','campaign','disposition','notes'], rws);
    };
  });
}
function sanitizeId(s){ return String(s).replace(/[^a-z0-9]/gi,'_'); }

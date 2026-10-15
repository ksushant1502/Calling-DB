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
    <input type="text" id="insSearch" placeholder="Search phone/agent/notes…" value="${escapeHtml(insightsSearch)}" style="min-width:220px;">
  </div>`;

  const qKeys = Object.keys(qa);
  if(qKeys.length===0){
    html += `<div class="empty-state">No form/questionnaire answers found for this selection.</div>`;
  } else {
    html += `<div class="insight-grid">`;
    qKeys.forEach(q=>{
      const answers = Object.entries(qa[q]).sort((a,b)=>b[1].length-a[1].length);
      const total = answers.reduce((s,[,rws])=>s+rws.length,0);
      html += `<div class="insight-card" id="card-${sanitizeId(q)}"><h3>${escapeHtml(q)}</h3><div class="insight-total">${total.toLocaleString()} response${total===1?'':'s'}</div>`;
      answers.forEach(([ans,rws])=>{
        const pct = total? (rws.length/total*100):0;
        html += `<div class="insight-bar-row" data-q="${escapeHtml(q)}" data-ans="${escapeHtml(ans)}" title="${escapeHtml(ans)}">
          <div class="insight-bar-top"><span class="insight-bar-label">${escapeHtml(ans)}</span><span class="insight-bar-count">${rws.length}</span></div>
          <div class="insight-bar-track"><div class="insight-bar-fill" style="width:${pct}%;"></div></div>
        </div>`;
      });
      html += `</div>`;
    });
    html += `</div>`;
    html += `<div class="section" id="insightDrillSection" style="display:none;"><h2 id="insightDrillTitle"></h2><div id="insightDrillBody"></div></div>`;
  }
  app.innerHTML = html;

  document.getElementById('insCampaign').onchange = (e)=>{ insightsCampaignFilter=e.target.value; renderInsights(); };
  document.getElementById('insSearch').oninput = (e)=>{ insightsSearch=e.target.value; };

  app.querySelectorAll('.insight-bar-row').forEach(row=>{
    row.onclick = ()=>{
      app.querySelectorAll('.insight-card.active').forEach(c=>c.classList.remove('active'));
      const q=row.getAttribute('data-q'), ans=row.getAttribute('data-ans');
      const card = document.getElementById('card-'+sanitizeId(q));
      if(card) card.classList.add('active');
      let rws = qa[q][ans];
      const search = insightsSearch.toLowerCase();
      if(search) rws = rws.filter(r=> (r.phone||'').toLowerCase().includes(search) || (r.agent||'').toLowerCase().includes(search) || (r.notes||'').toLowerCase().includes(search));
      const section = document.getElementById('insightDrillSection');
      document.getElementById('insightDrillTitle').textContent = `${q} — "${ans}"`;
      let dhtml = `<table><thead><tr><th>Phone</th><th>Agent</th><th>Campaign</th><th>Notes</th></tr></thead><tbody>`;
      rws.slice(0,300).forEach(r=>{ dhtml+=`<tr><td>${escapeHtml(r.phone||'—')}</td><td>${escapeHtml(r.agent||'—')}</td><td>${escapeHtml(r.campaign||'—')}</td><td>${escapeHtml(r.notes||'—')}</td></tr>`; });
      dhtml += `</tbody></table>`;
      if(rws.length>300) dhtml += `<div class="hint">Showing first 300 of ${rws.length} matches.</div>`;
      if(canWrite) dhtml += `<button id="exportInsight" style="margin-top:8px;">⬇ Export CSV (${rws.length})</button>`;
      document.getElementById('insightDrillBody').innerHTML = dhtml;
      section.style.display = '';
      section.scrollIntoView({behavior:'smooth', block:'nearest'});
      if(canWrite) document.getElementById('exportInsight').onclick = ()=> downloadCsv(`insight_${q}_${ans}.csv`.replace(/[^\w.-]/g,'_'), ['phone','agent','campaign','notes'], rws);
    };
  });
}
function sanitizeId(s){ return String(s).replace(/[^a-z0-9]/gi,'_'); }

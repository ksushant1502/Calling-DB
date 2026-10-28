// ===== PAGE 4: Insights & VoC =====
// ===================== INSIGHTS & VoC =====================
let insightsCampaignFilter='', insightsSearch='';
async function renderInsights(opts){
  opts = opts || {};   // opts.container / opts.typeId let other pages (Conversions) embed the insights for one type
  const app = opts.container || document.getElementById('app');
  if(dayDocs.length===0){ app.innerHTML=`<div class="empty-state">No data for this range.</div>`; return; }
  app.innerHTML = `<div class="empty-state"><span class="spinner"></span>Loading response detail…</div>`;
  const rows = (await loadRowsForRange()).filter(r=>lobInFilter(r.lob, opts.typeId));
  const hasConv = conversionDocs.length>0;
  const [convRows, prevP] = await Promise.all([ hasConv ? loadConvRowsForRange() : Promise.resolve([]), loadPreviousPeriod() ]);
  const convByCampaign = {}, convByCampAgent = {};
  convRows.forEach(r=>{ convByCampaign[r.campaign]=(convByCampaign[r.campaign]||0)+1; const k=r.campaign+'|||'+r.agent; convByCampAgent[k]=(convByCampAgent[k]||0)+1; });
  const isInterested = d=>{ const x=String(d||'').toLowerCase(); return /(interested|intrested|converted|hot lead|ready to buy|will purchase)/.test(x) && !/not\s*[-_ ]?\s*(interested|intrested)/.test(x); };
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
    const interested = connected.filter(r=>isInterested(r.disposition)).length;
    const shortN = rws.filter(r=>(r.flags||[]).includes('short_connect')).length;
    const agentStats = Object.entries(byAgent).map(([agent,v])=>{
      const ar = rws.filter(r=>(r.agent||'—')===agent), ac = ar.filter(r=>isConnect(r.disposition));
      const talkA = ac.reduce((n,r)=>n+(+r.talkSec||0),0);
      const sh = ar.filter(r=>(r.flags||[]).includes('short_connect')).length;
      const cv = convByCampAgent[name+'|||'+agent]||0;
      return {agent, calls:v.calls, conn:v.conn, connPct:v.calls?v.conn/v.calls*100:0, avgTalk:ac.length?talkA/ac.length:0, shortPct:ac.length?sh/ac.length*100:0, conv:cv, convPer100:v.conn?cv/v.conn*100:0};
    }).sort((a,b)=>b.conv-a.conv || b.calls-a.calls);
    return {interested, shortN, agentStats, convTotal:convByCampaign[name]||0, byDate, byAgent, name, rws, calls:rws.length, connected:connected.length, avgTalk: connected.length? talk/connected.length : 0, flags, qa, disp, lob:rws[0].lob};
  }).sort((a,b)=>b.calls-a.calls);

  // ---- extra insights for one campaign: comparison cards, funnel, leaderboard ----
  const prevC = (name)=> (prevP && prevP.camps && prevP.camps[name]) || null;
  const deltaPct=(cur,prev)=>{ if(!prev) return ''; const d=(cur-prev)/prev*100; const cls=Math.abs(d)<1?'flat':(d>0?'up':'down'); return `<span class="delta ${cls}">${cls==='flat'?'●':d>0?'▲':'▼'} ${Math.abs(d).toFixed(0)}%</span>`; };
  const deltaPts=(cur,prev)=>{ const d=cur-prev; const cls=Math.abs(d)<0.5?'flat':(d>0?'up':'down'); return `<span class="delta ${cls}">${cls==='flat'?'●':d>0?'▲':'▼'} ${Math.abs(d).toFixed(1)} pts</span>`; };
  const deltaAbs=(cur,prev)=>{ const d=cur-prev; const cls=d===0?'flat':(d>0?'up':'down'); return `<span class="delta ${cls}">${d===0?'●':d>0?'▲':'▼'} ${Math.abs(d).toLocaleString()}</span>`; };
  function campExtras(c, ci){
    const dedupe = DEDUPE_LOBS.includes(c.lob);
    const pv = (!dedupe && prevP && prevP.hasCalls) ? prevC(c.name) : null;
    const cmp = pv ? ` <span style="font-size:11px;color:var(--text-dim);font-weight:500;">vs previous ${prevP.n} day${prevP.n===1?'':'s'}</span>` : '';
    const cr = c.calls? c.connected/c.calls*100:0, prevCr = pv && pv.dials? pv.connects/pv.dials*100:0;
    const conv = hasConv ? c.convTotal : null;
    const per100 = hasConv && c.connected ? conv/c.connected*100 : null;
    const prevPer100 = pv && hasConv && prevP.hasConv && pv.connects ? pv.conv/pv.connects*100 : null;
    const kc=(label,val,delta,color,first)=>`<div class="kpi" style="--kpi-color:${color}"><div class="kpi-label">${label}</div><div class="kpi-value">${val}</div>${delta?`<div>${delta}${first&&cmp?cmp:''}</div>`:''}</div>`;
    const cards = `<div class="kpi-grid camp-kpis">
      ${kc('Dials', c.calls.toLocaleString(), pv?deltaPct(c.calls,pv.dials):'', '#3b5bfd', true)}
      ${kc('Connects', c.connected.toLocaleString(), pv?deltaPct(c.connected,pv.connects):'', '#7a56e8')}
      ${kc('Connect rate', cr.toFixed(1)+'%', pv&&pv.dials?deltaPts(cr,prevCr):'', '#d98a0b')}
      ${kc('Conversions', conv===null?'—':conv.toLocaleString(), pv&&conv!==null&&prevP.hasConv?deltaAbs(conv,pv.conv):'', '#12a066')}
      ${kc('Conversion / 100 connects', per100===null?'—':per100.toFixed(1), prevPer100!==null?deltaPts(per100,prevPer100):'', '#0f9a94')}
    </div>`;
    // funnel
    const steps=[['Dials',c.calls,'#3b5bfd'],['Connected',c.connected,'#7a56e8'],['Interested / hot',c.interested,'#0f9a94']];
    if(hasConv) steps.push(['Converted',c.convTotal,'#12a066']);
    const top=c.calls||1;
    const funnel = steps.map(([label,val,color],i)=>{
      const w=Math.max(val/top*100, val>0?5:0);
      const prev=i? steps[i-1][1]:null;
      const drop = i===0?'—' : (prev? `<b>${Math.max(0,(1-val/prev)*100).toFixed(0)}%</b> ${i===1?'not connected':'dropped after '+(i===2?'connect':'interest')}` : '—');
      return `<div class="funnel-row"><span>${label}</span><div class="funnel-bar" style="width:${w}%;background:${color}">${val.toLocaleString()}</div><span class="funnel-drop">${drop}</span></div>`;
    }).join('');
    // leaderboard
    const avgConn = cr, avgPer100 = per100;
    const lb = c.agentStats.slice(0,12).map(a=>{
      let tag='<span class="vs flat">● around average</span>';
      const good = a.connPct>=avgConn+3 || (hasConv && avgPer100!==null && a.convPer100>=avgPer100*1.2 && a.conv>0);
      const bad = a.connPct<=avgConn-3 || (hasConv && avgPer100!==null && a.convPer100<=avgPer100*0.7 && a.calls>=30);
      if(good && !bad) tag='<span class="vs up">▲ above average</span>';
      else if(bad){ const note = (c.connected && a.shortPct>20)?' — check short calls':''; tag=`<span class="vs down">▼ below average${note}</span>`; }
      return `<tr><td>${escapeHtml(a.agent)}</td><td class="num">${a.calls.toLocaleString()}</td><td class="num ${pctClass(a.connPct)}">${a.connPct.toFixed(1)}%</td><td class="num">${Math.round(a.avgTalk)}s</td><td class="num">${a.shortPct.toFixed(0)}%</td><td class="num"><b>${hasConv?a.conv.toLocaleString():'—'}</b></td><td class="num">${hasConv?a.convPer100.toFixed(1):'—'}</td><td>${tag}</td></tr>`;
    }).join('');
    return `${cards}
      <div class="cols">
        <div class="camp-chart"><h4>Funnel — where do customers drop?</h4>${funnel}${hasConv?'':'<div class="hint">Upload the conversion file for these dates to see the Converted step.</div>'}</div>
        <div class="camp-chart"><h4>Disposition trend (daily)</h4><div class="hc"><canvas id="cc-t-${ci}"></canvas></div></div>
      </div>
      <div class="camp-chart" style="margin:16px 0;"><h4>Agent leaderboard in this campaign${c.agentStats.length>12?' (top 12)':''}</h4>
        <div style="overflow-x:auto"><table><thead><tr><th>Agent</th><th class="num">Calls</th><th class="num">Connect %</th><th class="num">Avg talk</th><th class="num">Short connects</th><th class="num">Conversions</th><th class="num">Conv / 100 connects</th><th>vs campaign avg</th></tr></thead><tbody>${lb}</tbody></table></div></div>`;
  }

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
          ${campExtras(c, ci)}
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
    const dim=st.getPropertyValue('--text-dim').trim(), border=st.getPropertyValue('--border').trim();
    const el=document.getElementById('cc-t-'+ci); if(!el) return;
    if(charts['cc-t-'+ci]) charts['cc-t-'+ci].destroy();
    const dates=Object.keys(c.byDate).sort();
    const perDisp={}; c.rws.forEach(r=>{ const d=r.disposition||'—'; (perDisp[d]=perDisp[d]||{})[r.date]=(perDisp[d][r.date]||0)+1; });
    const order=Object.entries(c.disp).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
    const top=order.slice(0,5), rest=order.slice(5);
    const PAL=['#12a066','#3b5bfd','#d98a0b','#7a56e8','#0f9a94'];
    const ds=top.map((d,i)=>({label:d,data:dates.map(x=>(perDisp[d]||{})[x]||0),backgroundColor:PAL[i%PAL.length]}));
    if(rest.length) ds.push({label:'Other',data:dates.map(x=>rest.reduce((n,d)=>n+((perDisp[d]||{})[x]||0),0)),backgroundColor:'#c4cad8'});
    charts['cc-t-'+ci]=new Chart(el,{type:'bar',data:{labels:dates.map(d=>d.slice(5)),datasets:ds},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{usePointStyle:true,boxWidth:8}}},
        scales:{x:{stacked:true,grid:{display:false},ticks:{color:dim}},y:{stacked:true,ticks:{color:dim},grid:{color:border}}}}});
  };
  app.querySelectorAll('details.camp-ins').forEach((d,ci)=>{
    if(d.open) drawCampCharts(ci);
    d.addEventListener('toggle',()=>{ if(d.open) drawCampCharts(ci); });
  });
  document.getElementById('insCampaign').onchange = (e)=>{ insightsCampaignFilter=e.target.value; renderInsights(opts); };
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

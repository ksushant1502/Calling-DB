// ===== PAGE 6: Conversions — split into Enterprise and Retention =====
// ===================== CONVERSION =====================
let convView = 'all';   // 'all' | 'enterprise' | 'retention'

// Which LOB does a conversion campaign / queue belong to?
function convLobOf(campaign){
  const k = lookupLobCity(String(campaign||'').trim(), '');
  if(k) return k.lob;
  const n = String(campaign||'');
  if(/churn|retention|renewal/i.test(n)) return 'Retention';
  if(/survey|feedback|experience/i.test(n)) return 'Experience';
  if(/zomato|blinkit|swiggy|instamart|enterprise|merch/i.test(n)) return 'Enterprise';
  return 'Other';
}
// Enterprise = the "New User Acquisition" type (Enterprise + Instamart). Everything that is neither goes to "other".
function convGroupOf(campaign){
  const id = campaignTypeOf(convLobOf(campaign)).id;
  return id==='acquisition' ? 'enterprise' : id==='retention' ? 'retention' : 'other';
}
const CONV_GROUPS = {
  enterprise:{ label:'Enterprise', long:'Enterprise conversions (New User Acquisition)', color:'#3b5bfd', campLabel:'Campaign' },
  retention: { label:'Retention',  long:'Retention conversions',                       color:'#0f9a94', campLabel:'Queue / Campaign' },
};

function drawConvTrend(canvasId, labels, datasets){
  const ctx=document.getElementById(canvasId); if(!ctx) return;
  if(charts[canvasId]) charts[canvasId].destroy();
  const st=getComputedStyle(document.documentElement);
  const dim=st.getPropertyValue('--text-dim').trim(), border=st.getPropertyValue('--border').trim(), text=st.getPropertyValue('--text').trim();
  charts[canvasId] = new Chart(ctx,{type:'line',data:{labels,datasets:datasets.map(d=>({label:d.label,data:d.data,borderColor:d.color,backgroundColor:d.color+'22',fill:datasets.length===1,tension:0.3,pointRadius:3}))},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{labels:{color:text,usePointStyle:true,boxWidth:8}}},
      scales:{x:{ticks:{color:dim},grid:{display:false}}, y:{beginAtZero:true,ticks:{color:dim,precision:0},grid:{color:border}}}}});
}

function countBy(rows, key){
  const m={}; rows.forEach(r=>{ const k=r[key]||'—'; m[k]=(m[k]||0)+1; });
  return Object.entries(m).sort((a,b)=>b[1]-a[1]);
}
function convTable(title, arr, total, firstCol){
  if(!arr.length) return '';
  return `<div class="conv-tbl"><div class="hint" style="font-weight:700;margin-bottom:6px;">${title}</div>
    <div class="conv-scroll"><table><thead><tr><th>${firstCol}</th><th class="num">Conv.</th><th class="num">Share</th></tr></thead><tbody>${
      arr.map(([n,c])=>`<tr><td>${escapeHtml(n)}</td><td class="num">${c.toLocaleString()}</td><td class="num" style="color:var(--text-dim);">${total?(c/total*100).toFixed(0):0}%</td></tr>`).join('')
    }</tbody></table></div></div>`;
}

async function renderConversion(){
  const app=document.getElementById('app');
  if(conversionDocs.length===0){ app.innerHTML=`<div class="empty-state">No conversion data for this range.${canWrite?' Use "Upload Conversion CSV" in the left menu.':''}</div>`; return; }
  app.innerHTML = `<div class="empty-state"><span class="spinner"></span>Loading conversions…</div>`;
  const rows = await loadConvRowsForRange();
  if(rows.length===0){ app.innerHTML=`<div class="empty-state">No conversion rows found for this range. If you uploaded before, upload the conversion file again.</div>`; return; }

  rows.forEach(r=>{ r.group = convGroupOf(r.campaign); });
  const by = { enterprise:rows.filter(r=>r.group==='enterprise'), retention:rows.filter(r=>r.group==='retention'), other:rows.filter(r=>r.group==='other') };
  const total = rows.length;
  const dates = conversionDocs.map(d=>d.date);
  const perDay = g => dates.map(d=>by[g].filter(r=>r.date===d).length);

  const kpi = (label,val,sub,g)=>`<div class="kpi ${g?'kpi-clickable':''} ${g&&convView===g?'active':''}" ${g?`data-view="${g}" title="Click to show only ${label}"`:''}><div class="kpi-label">${label}</div><div class="kpi-value">${val.toLocaleString()}</div>${sub?`<div class="kpi-sub" style="font-size:12px;color:var(--text-dim);margin-top:2px;">${sub}</div>`:''}</div>`;
  const share = n => total? (n/total*100).toFixed(0)+'% of total' : '';
  let html = `<div class="typebar" style="margin:0 0 14px;">${[['all','All'],['enterprise','Enterprise'],['retention','Retention']].map(([v,l])=>`<button class="chip ${convView===v?'active':''}" data-view="${v}">${l}</button>`).join('')}</div>`;
  html += `<div class="kpi-grid">
    ${kpi('Total Conversions', total, `${dates.length} day${dates.length===1?'':'s'}`)}
    ${kpi('Enterprise', by.enterprise.length, share(by.enterprise.length), 'enterprise')}
    ${kpi('Retention', by.retention.length, share(by.retention.length), 'retention')}
    ${by.other.length ? kpi('Other', by.other.length, 'survey, city, others') : ''}
  </div>`;

  html += `<div class="section"><h2>Daily conversions</h2><div class="chart-wrap"><canvas id="convTrend"></canvas></div></div>`;

  const groupsToShow = convView==='all' ? ['enterprise','retention'] : [convView];
  groupsToShow.forEach(g=>{
    const rs = by[g], meta = CONV_GROUPS[g];
    const nw = rs.filter(r=>r.type==='new').length, rn = rs.filter(r=>r.type==='renewal').length;
    html += `<div class="section" style="border-top:3px solid ${meta.color};">
      <h2>${meta.long}</h2>
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px;">
        ${kpi('Conversions', rs.length, share(rs.length))}
        ${kpi('New (activation)', nw)}
        ${kpi('Renewal (extension)', rn)}
        ${kpi('Campaigns / queues', new Set(rs.map(r=>r.campaign)).size)}
      </div>
      <div class="conv-grid">
        ${convTable(meta.campLabel==='Campaign'?'By campaign':'By queue / campaign', countBy(rs,'campaign'), rs.length, meta.campLabel)}
        ${convTable('By agent', countBy(rs,'agent'), rs.length, 'Agent')}
        ${convTable('By city', countBy(rs,'city'), rs.length, 'City')}
      </div>
    </div>`;
  });
  if(convView==='all' && by.other.length){
    html += `<div class="hint">Other conversions (${by.other.length.toLocaleString()}): ${countBy(by.other,'campaign').map(([n,c])=>`${escapeHtml(n)} (${c})`).join(', ')}</div>`;
  }
  app.innerHTML = html;

  app.querySelectorAll('[data-view]').forEach(b=>{ b.onclick=()=>{ convView = (convView===b.getAttribute('data-view') && b.classList.contains('kpi'))?'all':b.getAttribute('data-view'); renderConversion(); }; });
  const ds = convView==='all'
    ? [{label:'Enterprise',color:CONV_GROUPS.enterprise.color,data:perDay('enterprise')},{label:'Retention',color:CONV_GROUPS.retention.color,data:perDay('retention')}]
    : [{label:CONV_GROUPS[convView].label,color:CONV_GROUPS[convView].color,data:perDay(convView)}];
  drawConvTrend('convTrend', dates, ds);
}

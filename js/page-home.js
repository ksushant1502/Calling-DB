// ===== HOME: what needs attention · section scorecards · top agents & campaigns · daily trend =====
function greeting(){ const h=new Date().getHours(); return h<12?'Good morning':h<17?'Good afternoon':'Good evening'; }

async function renderHome(){
  const app=document.getElementById('app');
  const prevP = await loadPreviousPeriod();
  const secs = SECTIONS.map(sec=>{
    const S = statsFor(sec.types);
    const P = S.dedupe ? null : prevFor(sec.types, prevP);
    return {sec, S, P};
  });
  const all = statsFor(CAMPAIGN_TYPES.map(t=>t.id));
  const convRows = conversionDocs.length ? await loadConvRowsForRange() : [];
  const alerts = await buildAlerts(secs, all);

  let html = pageHead(greeting(), `Telecalling for ${range.start===range.end?fmtDay(range.start,true):fmtDay(range.start)+' – '+fmtDay(range.end,true)}: <b>${fmtNum(all.T.dials)}</b> dials, <b>${fmtNum(all.T.connects)}</b> connected (${all.T.rate.toFixed(1)}%), <b>${fmtNum(all.T.conv)}</b> conversions.`, null);
  if(!dayDocs.length && !conversionDocs.length){ app.innerHTML = html + alertsCard(alerts) + emptyRange(); wireAlerts(app, alerts); return; }

  // 1 · needs attention
  html += alertsCard(alerts);

  // 2 · section scorecards
  html += `<div class="score-grid">`;
  secs.forEach(({sec,S,P},i)=>{
    const has = S.T.dials || S.T.conv;
    const conv = S.T.conv>0 || ['acquisition','retention'].includes(sec.id);
    html += `<button class="score ${has?'':'empty'}" data-go="${sec.id}" style="--sc:${sec.color}">
      <div class="score-head"><span class="score-name"><i></i>${sec.label}</span><span class="score-go">Open →</span></div>
      ${has ? `<div class="score-rows">
        <div class="sr"><span>Dials</span><b>${fmtNum(S.T.dials)}</b><em>${P?deltaChip(S.T.dials,P.dials,'pct'):''}</em></div>
        <div class="sr"><span>Connect %</span><b>${S.T.rate.toFixed(1)}%</b><em>${P?deltaChip(S.T.rate,P.rate,'pts'):''}</em></div>
        ${conv?`<div class="sr"><span>Conversions</span><b>${fmtNum(S.T.conv)}</b><em>${P&&P.hasConv?deltaChip(S.T.conv,P.conv,'pct'):''}</em></div>`:`<div class="sr"><span>Connected</span><b>${fmtNum(S.T.connects)}</b><em>${P?deltaChip(S.T.connects,P.connects,'pct'):''}</em></div>`}
      </div>
      <div class="score-spark"><canvas id="spark${i}"></canvas></div>
      <div class="score-foot">${S.list.length} ${sec.id==='retention'?'queue':'campaign'}${S.list.length===1?'':'s'}${S.dedupe?' · unique numbers':''}</div>`
      : `<div class="score-none">No calls in these dates</div>`}
    </button>`;
  });
  html += `</div>`;

  // 3 · top agents & campaigns
  const hasConv = all.T.conv>0;
  const campTop = all.list.filter(c=>hasConv? c.conv>0 : c.connects>0).sort((a,b)=> hasConv ? b.conv-a.conv : b.connects-a.connects).slice(0,6);
  const agg = aggregateOverview(null,'all');
  const ag = {};
  Object.entries(agg.agents).forEach(([n,v])=>{ ag[n]={name:n, dials:v.dials, connects:v.connects, conv:0}; });
  convRows.forEach(r=>{ const n=r.agent||'—'; (ag[n]=ag[n]||{name:n,dials:0,connects:0,conv:0}).conv++; });
  let agArr = Object.values(ag);
  if(CORE_CALLERS.length) agArr = agArr.filter(a=>CORE_CALLERS.includes(a.name));
  const agTop = agArr.sort((a,b)=> hasConv ? (b.conv-a.conv || b.connects-a.connects) : b.connects-a.connects).slice(0,6);
  const maxC = Math.max(1, ...campTop.map(c=>hasConv?c.conv:c.connects)), maxA = Math.max(1, ...agTop.map(a=>hasConv?a.conv:a.connects));
  const rank = (i,name,meta,val,max,color,go)=>`<li ${go?`data-go="${go}" class="clickable"`:''}><span class="rk">${i+1}</span><div class="rk-main"><div class="rk-top"><span class="rk-name">${escapeHtml(name)}</span><b>${fmtNum(val)}</b></div>
      <div class="minibar thin"><i style="width:${(val/max*100).toFixed(1)}%;background:${color}"></i></div><div class="rk-meta">${meta}</div></div></li>`;
  html += `<div class="grid-2">
    <div class="card"><div class="card-head"><h2>Top campaigns</h2><span class="card-note">by ${hasConv?'conversions':'connected calls'}</span></div>
      <ol class="rank">${campTop.map((c,i)=>{ const s=sectionOfLob(c.lob); return rank(i,c.name,`${s?s.label:'Other'} · ${c.dials?c.rate.toFixed(1)+'% connect':''}${hasConv&&c.connects?' · '+c.per100.toFixed(1)+' per 100 connects':''}`, hasConv?c.conv:c.connects, maxC, s?s.color:'#7a8499', s?s.id:''); }).join('') || '<li class="muted">No campaigns yet</li>'}</ol></div>
    <div class="card"><div class="card-head"><h2>Top agents</h2><span class="card-note">by ${hasConv?'conversions':'connected calls'} · <a href="#/agents" data-go="agents">all agents</a></span></div>
      <ol class="rank">${agTop.map((a,i)=>rank(i,a.name,`${fmtNum(a.dials)} dials · ${a.dials?(a.connects/a.dials*100).toFixed(1)+'% connect':'—'}${hasConv?' · '+fmtNum(a.connects)+' connected':''}`, hasConv?a.conv:a.connects, maxA, cssVar('--accent'))).join('') || '<li class="muted">No agents yet</li>'}</ol></div>
  </div>`;

  // 4 · daily trend
  html += `<div class="grid-2">
    <div class="card"><div class="card-head"><h2>Calls per day</h2><span class="card-note">all sections</span></div><div class="chart-wrap"><canvas id="homeCalls"></canvas></div></div>
    <div class="card"><div class="card-head"><h2>Conversions per day</h2><span class="card-note">Acquisition + Retention</span></div><div class="chart-wrap"><canvas id="homeConv"></canvas></div></div>
  </div>`;

  app.innerHTML = html;
  wireAlerts(app, alerts);
  app.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click',(e)=>{ e.preventDefault(); const g=el.getAttribute('data-go'); if(g) goTo(g); }));
  secs.forEach(({sec,S},i)=>{ if(S.T.dials) drawSpark('spark'+i, S.connects, sec.color); });
  drawCallsTrend('homeCalls', all.dates, all.dials, all.connects);
  drawConvDaily('homeConv', all.dates, all.convs);
}

// ---- "Needs attention": missing uploads, drops vs the previous period, misconduct, weak campaigns ----
async function buildAlerts(secs, all){
  const A = [];   // {level:'bad'|'warn'|'good', title, text, action:{label, kind, ...}}
  // a) missing uploads (up to yesterday — today's files usually come in later)
  const last = range.end < todayStr() ? range.end : addDays(todayStr(),-1);
  if(last >= range.start){
    const first = range.start < addDays(todayStr(),-KEEP_DAYS) ? addDays(todayStr(),-KEEP_DAYS) : range.start;   // older days are deleted on purpose
    const days=[]; for(let d=first; d<=last && days.length<400; d=addDays(d,1)) days.push(d);
    const defs = [ {key:'calls', label:'Campaign report', table:SOURCES.calls.days}, {key:'queue', label:'Retention report', table:SOURCES.queue.days}, {key:'conversion', label:'Conversion file', table:'conversion'} ];
    try{
      const res = await Promise.all(defs.map(d=>sb.from(d.table).select('date').gte('date',first).lte('date',last)));
      defs.forEach((d,i)=>{
        if(res[i].error) return;
        const have = new Set((res[i].data||[]).map(r=>r.date));
        const miss = days.filter(x=>!have.has(x));
        if(!miss.length) return;
        const list = miss.slice(-4).map(x=>fmtDay(x)).join(', ') + (miss.length>4?` and ${miss.length-4} more`:'');
        A.push({level:'warn', title:`${d.label} missing for ${miss.length} day${miss.length===1?'':'s'}`, text:list,
          action: canWrite ? {label:`Upload ${fmtDay(miss[miss.length-1])}`, kind:'upload', report:d.key, date:miss[miss.length-1]} : {label:'See uploads', kind:'go', page:'uploads'}});
      });
    }catch(e){ console.error(e); }
  }
  // b) misconduct words in call notes
  const mis = dayDocs.reduce((s,d)=>s+((d.flagsCount||{}).misconduct||0),0);
  if(mis) A.push({level:'bad', title:`${fmtNum(mis)} call${mis===1?'':'s'} with misconduct words`, text:'Words like abuse, rude or threat were found in the call notes.', action:{label:'Review calls', kind:'go', page:'flags', focus:'misconduct'}});
  // c) sections that moved vs the previous period
  secs.forEach(({sec,S,P})=>{
    if(!P || S.T.dials<100 || P.dials<100) return;
    const dr = S.T.rate-P.rate;
    if(dr<=-3) A.push({level:'warn', title:`${sec.label}: connect rate down ${Math.abs(dr).toFixed(1)} pts`, text:`${S.T.rate.toFixed(1)}% now, ${P.rate.toFixed(1)}% in ${prevRangeText()}.`, action:{label:'Open '+sec.label, kind:'go', page:sec.id}});
    else if(dr>=3) A.push({level:'good', title:`${sec.label}: connect rate up ${dr.toFixed(1)} pts`, text:`${S.T.rate.toFixed(1)}% now, ${P.rate.toFixed(1)}% in ${prevRangeText()}.`, action:{label:'Open '+sec.label, kind:'go', page:sec.id}});
    if(P.hasConv && P.per100>0 && S.T.connects>0){
      const rel = (S.T.per100-P.per100)/P.per100*100;
      if(rel<=-15) A.push({level:'warn', title:`${sec.label}: fewer conversions per connect`, text:`${S.T.per100.toFixed(1)} per 100 connects now, ${P.per100.toFixed(1)} before (${rel.toFixed(0)}%).`, action:{label:'Open '+sec.label, kind:'go', page:sec.id}});
      else if(rel>=15) A.push({level:'good', title:`${sec.label}: more conversions per connect`, text:`${S.T.per100.toFixed(1)} per 100 connects now, ${P.per100.toFixed(1)} before (+${rel.toFixed(0)}%).`, action:{label:'Open '+sec.label, kind:'go', page:sec.id}});
    }
  });
  // d) big campaigns that hardly connect
  const weak = all.list.filter(c=>c.dials>=300 && c.rate<20 && !DEDUPE_LOBS.includes(c.lob)).sort((a,b)=>a.rate-b.rate).slice(0,3);
  if(weak.length){
    const s = sectionOfLob(weak[0].lob);
    A.push({level:'warn', title:`${weak.length} campaign${weak.length===1?'':'s'} connecting under 20%`, text: weak.map(c=>`${escapeHtml(c.name)} (${c.rate.toFixed(0)}%)`).join(', '), action: s?{label:'Open '+s.label, kind:'go', page:s.id}:null});
  }
  const order = {bad:0, warn:1, good:2};
  return A.sort((a,b)=>order[a.level]-order[b.level]).slice(0,6);
}
function alertsCard(A){
  const icon = {bad:'!', warn:'!', good:'✓'};
  const issues = A.filter(a=>a.level!=='good').length;
  return `<div class="card attention"><div class="card-head"><h2>Needs attention ${issues?`<span class="count warn">${issues}</span>`:''}</h2><span class="card-note">compared with ${prevRangeText()}</span></div>
    ${A.length ? `<ul class="alerts">${A.map((a,i)=>`<li class="al ${a.level}"><span class="al-icon">${icon[a.level]}</span><div class="al-text"><b>${a.title}</b><span>${a.text}</span></div>${a.action?`<button data-al="${i}">${a.action.label}</button>`:''}</li>`).join('')}</ul>`
      : `<div class="all-good"><span class="al-icon">✓</span> Everything looks on track — all reports are in and nothing dropped.</div>`}
  </div>`;
}
function wireAlerts(root, A){
  root.querySelectorAll('[data-al]').forEach(b=>b.onclick=()=>{
    const a = A[+b.getAttribute('data-al')].action;
    if(a.kind==='go'){ flagsFocus = a.focus||''; goTo(a.page); }
    else if(a.kind==='upload'){ if(a.report==='conversion') openConversionUploadModal({date:a.date}); else openUploadModal({source:a.report, date:a.date}); }
  });
}

// ===== DATA: loading days / rows / conversions from Supabase =====
// ===================== DATA LOADING (Supabase) =====================
async function fetchAllRows(table, date){
  let all=[], from=0, pageSize=1000;
  while(true){
    const { data, error } = await sb.from(table).select('*').eq('date', date).range(from, from+pageSize-1);
    if(error){ console.error(error); toast('Load failed: '+error.message); break; }
    all = all.concat(data||[]);
    if(!data || data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function mergeCampaignKeys(obj){
  const out={};
  Object.entries(obj||{}).forEach(([k,v])=>{
    const key=canonCampaign(k);
    if(v && typeof v==='object'){ out[key]=out[key]||{}; addCounts(out[key], v); if(v.lob) out[key].lob=canonLob(k, v.lob); }
    else out[key]=(out[key]||0)+(typeof v==='number'?v:0);
  });
  return out;
}
function mapDayDoc(r, source){
  return { date:r.date, fileName:r.file_name, totalRows:r.total_rows||0, excludedRows:r.excluded_rows||0,
    totalDials:r.total_dials||0, totalConnects:r.total_connects||0,
    campaigns:mergeCampaignKeys(r.campaigns), agents:r.agents||{}, flagsCount:r.flags_count||{}, sources:[source] };
}
function addCounts(into, from){   // sums {dials,connects,...} style objects, including nested byLob / byCity
  Object.entries(from||{}).forEach(([k,v])=>{
    if(v && typeof v==='object'){ into[k]=into[k]||{}; addCounts(into[k], v); }
    else if(typeof v==='number'){ into[k]=(into[k]||0)+v; }
    else if(into[k]===undefined){ into[k]=v; }
  });
}
// A date can have a campaign report and a queue report. Dashboard pages see them as one day.
function mergeDayDocs(a, b){
  const out = { date:a.date, fileName:[a.fileName,b.fileName].filter(Boolean).join(' + '),
    totalRows:a.totalRows+b.totalRows, excludedRows:a.excludedRows+b.excludedRows,
    totalDials:a.totalDials+b.totalDials, totalConnects:a.totalConnects+b.totalConnects,
    campaigns:{}, agents:{}, flagsCount:{}, sources:[...a.sources,...b.sources] };
  [a,b].forEach(d=>{
    addCounts(out.campaigns, d.campaigns); addCounts(out.agents, d.agents); addCounts(out.flagsCount, d.flagsCount);
  });
  return out;
}
async function loadDaySummaries(){
  const q = (table)=> sb.from(table).select('*').gte('date',range.start).lte('date',range.end).order('date',{ascending:true});
  const [c, qu] = await Promise.all([ q(SOURCES.calls.days), q(SOURCES.queue.days) ]);
  if(c.error){ console.error(c.error); toast('Load failed: '+c.error.message); return []; }
  if(qu.error){ console.error(qu.error); toast('Queue data could not be loaded (run the queue setup SQL): '+qu.error.message); }
  const byDate = {};
  (c.data||[]).forEach(r=>{ byDate[r.date]=mapDayDoc(r,'calls'); });
  (qu.data||[]).forEach(r=>{ const d=mapDayDoc(r,'queue'); byDate[r.date] = byDate[r.date] ? mergeDayDocs(byDate[r.date], d) : d; });
  return Object.keys(byDate).sort().map(k=>byDate[k]);
}
async function loadConversionSummaries(rs, re){
  const { data, error } = await sb.from('conversion').select('*').gte('date',rs||range.start).lte('date',re||range.end).order('date',{ascending:true});
  if(error){ console.error(error); return []; }
  return (data||[]).map(r=>{
    // survey-only campaigns are never conversions, even in days uploaded before this rule existed
    const byCampaign = mergeCampaignKeys(r.by_campaign);
    let removed=0; Object.keys(byCampaign).forEach(k=>{ if(isConvExcluded(k)){ removed+=(byCampaign[k].count||0); delete byCampaign[k]; } });
    return {
    date:r.date, fileName:r.file_name, totalConversions:(r.total_conversions||0)-removed, hadExcluded:removed>0,
    byAgent:r.by_agent||{}, byCampaign, byCity:r.by_city||{}, byType:r.by_type||{}
  };});
}
async function loadRowsForDate(date){
  if(rowsCache[date]) return rowsCache[date];
  const [rawC, rawQ] = await Promise.all([ fetchAllRows(SOURCES.calls.rows, date), fetchAllRows(SOURCES.queue.rows, date) ]);
  // phone + notes live in a separate table that only editors can read; merge them in by source + row number
  const contacts = (REQUIRE_LOGIN && canWrite) ? await fetchAllRows('call_contacts', date) : [];
  const byKey = {}; contacts.forEach(c=>{ byKey[(c.source||'calls')+':'+c.n]=c; });
  const conv = (r, src)=>{ const k=byKey[src+':'+r.n]||{}; return {date, pkey:r.pkey||'', phone:k.phone||'', notes:k.notes||'', source:src, agent:r.agent, campaign:canonCampaign(r.campaign), lob:canonLob(r.campaign, r.lob), city:r.city, callId:r.call_id, disposition:r.disposition, talkSec:r.talk_sec, flags:r.flags?r.flags.split(','):[], form:r.form||{}}; };
  const rows = rawC.map(r=>conv(r,'calls')).concat(rawQ.map(r=>conv(r,'queue')));
  rowsCache[date]=rows; return rows;
}
// One row per phone number for dedupe campaigns: connected first, then longest talk time, then latest date.
function pickBestPerNumber(rows){
  const best = {}, kept = [];
  let noKey = 0;
  rows.forEach(r=>{
    if(!r.pkey){ noKey++; kept.push(r); return; }
    const b = best[r.pkey];
    if(!b){ best[r.pkey]=r; return; }
    const rc=isConnect(r.disposition), bc=isConnect(b.disposition);
    let better;
    if(rc!==bc) better = rc;
    else if(rc && (r.talkSec||0)!==(b.talkSec||0)) better = (r.talkSec||0)>(b.talkSec||0);
    else better = String(r.date)>=String(b.date);
    if(better) best[r.pkey]=r;
  });
  return {kept: kept.concat(Object.values(best)), noKey};
}
let dedupeNote = {};   // section lob -> {raw, unique, noKey}  (shown on the Campaigns page)
async function loadRowsForRange(){
  const dates = dayDocs.map(d=>d.date);
  return (await Promise.all(dates.map(loadRowsForDate))).flat();   // Insights etc. show every row, campaign by campaign
}
// For dedupe sections (NCR Festival Churn Survey): each phone number is counted once, in the campaign and day of its best call.
// The campaigns stay separate, and their numbers add up to the unique total.
async function applyUniqueOverrides(){
  dedupeNote = {};
  const hasSection = d=>Object.values(d.campaigns||{}).some(v=>DEDUPE_LOBS.includes(v.lob));
  const dates = dayDocs.filter(hasSection).map(d=>d.date);
  if(!dates.length) return;
  const all = (await Promise.all(dates.map(loadRowsForDate))).flat();
  DEDUPE_LOBS.forEach(lobName=>{
    const mine = all.filter(r=>r.lob===lobName);
    if(!mine.length) return;
    const {kept, noKey} = pickBestPerNumber(mine);
    dedupeNote[lobName] = {raw:mine.length, unique:kept.length, noKey};
    const per = {};
    kept.forEach(r=>{
      const key = r.date+'|||'+r.campaign;
      const d = per[key] = per[key] || {dials:0,connects:0,uniqueCallIds:0,lob:r.lob,city:r.city,byCity:{}};
      const con = isConnect(r.disposition);
      d.dials++; d.uniqueCallIds++; if(con) d.connects++;
      if(r.city){ const bc=d.byCity[r.city]=d.byCity[r.city]||{dials:0,connects:0}; bc.dials++; if(con) bc.connects++; }
    });
    dayDocs.forEach(day=>{
      Object.entries(day.campaigns||{}).forEach(([name,old])=>{
        if(old.lob!==lobName) return;
        const nu = per[day.date+'|||'+name];
        day.totalDials = day.totalDials - (old.dials||0) + (nu?nu.dials:0);
        day.totalConnects = day.totalConnects - (old.connects||0) + (nu?nu.connects:0);
        if(nu) day.campaigns[name] = nu; else delete day.campaigns[name];
      });
    });
  });
}
async function loadConvRowsForDate(date){
  if(convRowsCache[date]) return convRowsCache[date];
  const raw = await fetchAllRows('conversion_rows', date);
  const rows = raw.filter(r=>!isConvExcluded(r.campaign)).map(r=>({date:r.date, agent:r.agent, campaign:canonCampaign(r.campaign), city:r.city, type:r.type}));
  convRowsCache[date]=rows; return rows;
}
async function loadConvRowsForRange(){
  const dates = conversionDocs.map(d=>d.date);
  const all = await Promise.all(dates.map(loadConvRowsForDate));
  return all.flat();
}
function dedupeHint(){
  const parts = Object.entries(dedupeNote||{}).map(([lobName,v])=>`<b>${escapeHtml(campaignTypeOf(lobName).label)}</b>: ${v.unique.toLocaleString()} unique numbers from ${v.raw.toLocaleString()} call rows. Each number is counted once, in the campaign where its best call happened (connected first, then not connected), so the campaigns add up to the unique total.${v.noKey?` <span style="color:var(--red,#c23b3b)">${v.noKey.toLocaleString()} rows have no phone key — re-upload those days so they can be matched.</span>`:''}`);
  return parts.length ? `<div class="admin-only-note">${parts.join('<br>')}</div>` : '';
}

// ---- previous period of the same length (for "▲ 12% vs previous 7 days" on the Insights cards) ----
function shiftDate(ymd, days){ const d=new Date(ymd+'T00:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); }
async function loadPreviousPeriod(){
  try{
    const n = Math.round((new Date(range.end+'T00:00:00Z')-new Date(range.start+'T00:00:00Z'))/86400000)+1;
    const pe = shiftDate(range.start,-1), ps = shiftDate(pe, -(n-1));
    const q = (t)=> sb.from(t).select('*').gte('date',ps).lte('date',pe);
    const [c, qu, cv] = await Promise.all([ q(SOURCES.calls.days), q(SOURCES.queue.days), loadConversionSummaries(ps, pe) ]);
    const camps = {};
    const add = (rows, src)=>(rows||[]).forEach(r=>{
      const d = mapDayDoc(r, src);
      Object.entries(d.campaigns).forEach(([name,v])=>{ const x=camps[name]=camps[name]||{dials:0,connects:0,conv:0}; x.dials+=v.dials||0; x.connects+=v.connects||0; });
    });
    add(c.data,'calls'); add(qu.data,'queue');
    cv.forEach(day=>Object.entries(day.byCampaign||{}).forEach(([name,v])=>{ const x=camps[name]=camps[name]||{dials:0,connects:0,conv:0}; x.conv+=v.count||0; }));
    return {n, start:ps, end:pe, camps, hasCalls:Object.keys(camps).length>0, hasConv:cv.length>0};
  }catch(e){ console.error(e); return {n:0,camps:{},hasCalls:false,hasConv:false}; }
}

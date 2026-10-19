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

function mapDayDoc(r, source){
  return { date:r.date, fileName:r.file_name, totalRows:r.total_rows||0, excludedRows:r.excluded_rows||0,
    totalDials:r.total_dials||0, totalConnects:r.total_connects||0,
    campaigns:r.campaigns||{}, agents:r.agents||{}, flagsCount:r.flags_count||{}, sources:[source] };
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
async function loadConversionSummaries(){
  const { data, error } = await sb.from('conversion').select('*').gte('date',range.start).lte('date',range.end).order('date',{ascending:true});
  if(error){ console.error(error); return []; }
  return (data||[]).map(r=>({
    date:r.date, fileName:r.file_name, totalConversions:r.total_conversions,
    byAgent:r.by_agent||{}, byCampaign:r.by_campaign||{}, byCity:r.by_city||{}, byType:r.by_type||{}
  }));
}
async function loadRowsForDate(date){
  if(rowsCache[date]) return rowsCache[date];
  const [rawC, rawQ] = await Promise.all([ fetchAllRows(SOURCES.calls.rows, date), fetchAllRows(SOURCES.queue.rows, date) ]);
  // phone + notes live in a separate table that only editors can read; merge them in by source + row number
  const contacts = (REQUIRE_LOGIN && canWrite) ? await fetchAllRows('call_contacts', date) : [];
  const byKey = {}; contacts.forEach(c=>{ byKey[(c.source||'calls')+':'+c.n]=c; });
  const conv = (r, src)=>{ const k=byKey[src+':'+r.n]||{}; return {phone:k.phone||'', notes:k.notes||'', source:src, agent:r.agent, campaign:r.campaign, lob:r.lob, city:r.city, callId:r.call_id, disposition:r.disposition, talkSec:r.talk_sec, flags:r.flags?r.flags.split(','):[], form:r.form||{}}; };
  const rows = rawC.map(r=>conv(r,'calls')).concat(rawQ.map(r=>conv(r,'queue')));
  rowsCache[date]=rows; return rows;
}
async function loadRowsForRange(){
  const dates = dayDocs.map(d=>d.date);
  const all = await Promise.all(dates.map(loadRowsForDate));
  return all.flat();
}
async function loadConvRowsForDate(date){
  if(convRowsCache[date]) return convRowsCache[date];
  const raw = await fetchAllRows('conversion_rows', date);
  const rows = raw.map(r=>({date:r.date, agent:r.agent, campaign:r.campaign, city:r.city, type:r.type}));
  convRowsCache[date]=rows; return rows;
}
async function loadConvRowsForRange(){
  const dates = conversionDocs.map(d=>d.date);
  const all = await Promise.all(dates.map(loadConvRowsForDate));
  return all.flat();
}

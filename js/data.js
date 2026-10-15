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

async function loadDaySummaries(){
  const { data, error } = await sb.from('days').select('*').gte('date',range.start).lte('date',range.end).order('date',{ascending:true});
  if(error){ console.error(error); toast('Load failed: '+error.message); return []; }
  return (data||[]).map(r=>({
    date:r.date, fileName:r.file_name, totalRows:r.total_rows, excludedRows:r.excluded_rows,
    totalDials:r.total_dials, totalConnects:r.total_connects,
    campaigns:r.campaigns||{}, agents:r.agents||{}, flagsCount:r.flags_count||{}
  }));
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
  const raw = await fetchAllRows('day_rows', date);
  const rows = raw.map(r=>({agent:r.agent, campaign:r.campaign, lob:r.lob, city:r.city, callId:r.call_id, phone:r.phone, disposition:r.disposition, talkSec:r.talk_sec, notes:r.notes, form:r.form||{}}));
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
  const rows = raw.map(r=>({agent:r.agent, campaign:r.campaign, city:r.city, type:r.type, phone:r.phone}));
  convRowsCache[date]=rows; return rows;
}
async function loadConvRowsForRange(){
  const dates = conversionDocs.map(d=>d.date);
  const all = await Promise.all(dates.map(loadConvRowsForDate));
  return all.flat();
}

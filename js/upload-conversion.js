// ===== UPLOAD: conversion CSV (one day or many days in one file) =====
// ===================== UPLOAD: CONVERSION DATA =====================
let pendingConvParsed=null;
let convFrom='', convTo='';

function openConversionUploadModal(){
  const root=document.getElementById('modalRoot');
  root.innerHTML = `<div class="overlay" id="ovc1"><div class="modal">
    <h3>Upload Conversion CSV</h3>
    <div class="hint">Choose the first and last date this file covers. Leave both blank to take every date found in the file (use this for a file that covers many days). Pick the same date in both to save the whole file as one day. Only rows with conversion_flag = 1 are counted.</div>
    <div class="field-row">
      <div class="field"><label>From date</label><input type="date" id="convFrom"></div>
      <div class="field"><label>To date</label><input type="date" id="convTo"></div>
    </div>
    <div class="field"><label>CSV file</label><div class="file-drop" id="convDropZone">Click to choose a CSV file</div><input type="file" id="convFileInput" accept=".csv" style="display:none;"></div>
    <div id="convFileStatus" style="font-size:12.5px;color:var(--text-dim);"></div>
    <div class="modal-actions"><button id="cancelConvUpload">Cancel</button></div>
  </div></div>`;
  document.getElementById('convDropZone').onclick=()=>document.getElementById('convFileInput').click();
  document.getElementById('convFileInput').onchange=handleConvFileSelect;
  document.getElementById('cancelConvUpload').onclick=()=>root.innerHTML='';
  document.getElementById('ovc1').addEventListener('click',e=>{ if(e.target.id==='ovc1') root.innerHTML=''; });
}
function handleConvFileSelect(e){
  const file=e.target.files[0]; if(!file) return;
  convFrom=document.getElementById('convFrom').value; convTo=document.getElementById('convTo').value;
  if(convFrom && convTo && convFrom>convTo){ [convFrom,convTo]=[convTo,convFrom]; }
  document.getElementById('convFileStatus').textContent='Parsing… (large files can take a few seconds)';
  Papa.parse(file,{header:true, skipEmptyLines:true, complete:(results)=>{
    pendingConvParsed={fileName:file.name, headers:results.meta.fields||[], rows:results.data};
    document.getElementById('convFileStatus').textContent=`Parsed ${results.data.length.toLocaleString()} rows.`;
    openConvMappingModal();
  }, error:(err)=>{ document.getElementById('convFileStatus').textContent='Failed: '+err.message; }});
}
function openConvMappingModal(){
  const headers=pendingConvParsed.headers;
  const guess = {
    agent:guessColumn(headers,['agent_username','agent']), campaign:guessColumn(headers,['campaign_name','campaign']),
    city:guessColumn(headers,['city']), type:guessColumn(headers,['conversion_type','type']),
    flag:guessColumn(headers,['conversion_flag','flag']), phone:guessColumn(headers,['contact_number','phone','mobile','number']),
    datecol:guessColumn(headers,['campaign_date','call_date','call_start_date_time','date']),
    disp:guessColumn(headers,['disposition']),
    paydate:guessColumn(headers,['payment_date']), paytime:guessColumn(headers,['payment_ts','payment_time','payment_timestamp']),
  };
  const opts=(sel)=>`<option value="">— none —</option>`+headers.map(h=>`<option value="${escapeHtml(h)}" ${h===sel?'selected':''}>${escapeHtml(h)}</option>`).join('');
  const root=document.getElementById('modalRoot');
  root.innerHTML = `<div class="overlay" id="ovc2"><div class="modal">
    <h3>Map Columns — ${escapeHtml(pendingConvParsed.fileName)}</h3>
    <div class="field-row">
      <div class="field"><label>Agent column *</label><select id="cmAgent">${opts(guess.agent)}</select></div>
      <div class="field"><label>Campaign / Queue column *</label><select id="cmCampaign">${opts(guess.campaign)}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>City column</label><select id="cmCity">${opts(guess.city)}</select></div>
      <div class="field"><label>Conversion type column</label><select id="cmType">${opts(guess.type)}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Phone / contact column</label><select id="cmPhone">${opts(guess.phone)}</select></div>
      <div class="field"><label>conversion_flag column *</label><select id="cmFlag">${opts(guess.flag)}</select></div>
    </div>
    <div class="field"><label>Disposition column *</label><select id="cmDisp">${opts(guess.disp)}</select></div>
    <div class="field-row">
      <div class="field"><label>Payment date column *</label><select id="cmPayDate">${opts(guess.paydate)}</select></div>
      <div class="field"><label>Payment date-time column *</label><select id="cmPayTime">${opts(guess.paytime)}</select></div>
    </div>
    <div class="field"><label>Date column (each conversion is counted on this date)</label><select id="cmDate">${opts(guess.datecol)}</select></div>
    <div class="hint"><b>A row counts as a conversion only if all three are true:</b> (1) the flag column is 1, (2) the disposition is a connected call, and (3) a payment date and a payment time are both present. campaign_date is the day of the call; choose the payment date column above instead if you want conversions counted on the day the customer paid.</div>
    <div class="modal-actions"><button id="backConv">Back</button><button class="primary" id="confirmConvMap">Preview & Save</button></div>
  </div></div>`;
  document.getElementById('backConv').onclick=openConversionUploadModal;
  document.getElementById('confirmConvMap').onclick=confirmConvMapping;
  document.getElementById('ovc2').addEventListener('click',e=>{ if(e.target.id==='ovc2') document.getElementById('modalRoot').innerHTML=''; });
}

// Turns the conversion rows of ONE day into the summary the dashboard stores.
function processConvRows(rows, map){
  const byAgent={}, byCampaign={}, byCity={}, byType={new:0,renewal:0,other:0};
  const kept=[]; let total=0;
  const skipped={notConnected:0, noPayment:0};
  rows.forEach(row=>{
    // Rule 1: conversion flag must be 1
    const flagVal = String(row[map.flag]||'').trim().toLowerCase();
    if(!(flagVal==='1'||flagVal==='true'||flagVal==='yes')) return;
    // Rule 2: the call must be a connected call (by disposition)
    if(!isConnect(row[map.disp])){ skipped.notConnected++; return; }
    // Rule 3: payment date AND payment time must both be present
    if(!String(row[map.paydate]||'').trim() || !String(row[map.paytime]||'').trim()){ skipped.noPayment++; return; }
    const campaign = (row[map.campaign]||'Unknown').trim();
    if(isExcludedCampaign(campaign,'queue')) return;      // retention queues are real; RSA campaigns are not
    const rawAgent = String(row[map.agent]||'').trim().toLowerCase();
    if(isRsaAgent(rawAgent)) return;
    const agent = normalizeAgent(row[map.agent]);
    let city = map.city ? (row[map.city]||'').trim() : '';
    city = CITY_CODE[city] || city;
    let type = map.type ? String(row[map.type]||'').trim().toLowerCase() : '';
    if(type.includes('activ') || type.includes('new')) type='new';
    else if(type.includes('extens') || type.includes('renew')) type='renewal';
    else type='other';
    total++;
    byAgent[agent]=byAgent[agent]||{count:0}; byAgent[agent].count++;
    byCampaign[campaign]=byCampaign[campaign]||{count:0}; byCampaign[campaign].count++;
    if(city){ byCity[city]=byCity[city]||{count:0}; byCity[city].count++; }
    byType[type] = (byType[type]||0)+1;
    const phone = map.phone ? String(row[map.phone]||'').trim() : '';
    kept.push({agent,campaign,city,type,phone});
  });
  return {totalConversions:total, byAgent, byCampaign, byCity, byType, rows:kept, skipped};
}

function confirmConvMapping(){
  const map = {
    agent:document.getElementById('cmAgent').value, campaign:document.getElementById('cmCampaign').value,
    city:document.getElementById('cmCity').value, type:document.getElementById('cmType').value,
    flag:document.getElementById('cmFlag').value, phone:document.getElementById('cmPhone').value,
    datecol:document.getElementById('cmDate').value,
    disp:document.getElementById('cmDisp').value, paydate:document.getElementById('cmPayDate').value, paytime:document.getElementById('cmPayTime').value,
  };
  if(!map.agent || !map.campaign || !map.flag || !map.disp || !map.paydate || !map.paytime){ toast('Agent, Campaign, conversion_flag, Disposition, Payment date and Payment date-time columns are required'); return; }
  const singleDay = convFrom && convTo && convFrom===convTo;
  if(!singleDay && !map.datecol){ toast('Pick the Date column so the file can be split by day — or go Back and choose the same From and To date.'); return; }

  const groups={}; let unparsed=0, outOfRange=0;
  if(singleDay){ groups[convFrom]=pendingConvParsed.rows; }
  else {
    pendingConvParsed.rows.forEach(row=>{
      const d = parseDateToYMD(row[map.datecol]);
      if(!d){ unparsed++; return; }
      if((convFrom && d<convFrom) || (convTo && d>convTo)){ outOfRange++; return; }
      (groups[d]=groups[d]||[]).push(row);        // every row counts for "which dates are in the file", conversions are picked out below
    });
  }
  if(outOfRange) toast(`${outOfRange.toLocaleString()} row(s) outside ${convFrom||'start'} → ${convTo||'end'} were skipped`);
  if(unparsed) toast(`${unparsed.toLocaleString()} row(s) had an unreadable date and were skipped`);
  const dates=Object.keys(groups).sort();
  if(dates.length===0){ toast('No rows with a readable date were found — check the Date column.'); return; }

  const daySummaries = dates.map(date=>{
    const s = processConvRows(groups[date], map);
    return {date, fileName:pendingConvParsed.fileName, totalConversions:s.totalConversions, byAgent:s.byAgent, byCampaign:s.byCampaign, byCity:s.byCity, byType:s.byType, rows:s.rows, skipped:s.skipped};
  });
  if(daySummaries.every(d=>d.totalConversions===0)){ toast('No conversions found — check that the conversion_flag column is the right one (value 1 = converted).'); return; }
  showConvPreview(daySummaries);
}

function showConvPreview(daySummaries){
  const root=document.getElementById('modalRoot');
  const multi = daySummaries.length>1;
  const grand = daySummaries.reduce((s,d)=>s+d.totalConversions,0);
  const grandNew = daySummaries.reduce((s,d)=>s+(d.byType.new||0),0);
  const grandRen = daySummaries.reduce((s,d)=>s+(d.byType.renewal||0),0);
  const skipConn = daySummaries.reduce((a,d)=>a+d.skipped.notConnected,0), skipPay = daySummaries.reduce((a,d)=>a+d.skipped.noPayment,0);
  const dayRowsHtml = daySummaries.map((s,idx)=>`<tr><td>${s.date}</td><td>${s.totalConversions.toLocaleString()}</td><td>${(s.byType.new||0).toLocaleString()}</td><td>${(s.byType.renewal||0).toLocaleString()}</td><td id="convStatus_${idx}" style="color:var(--text-dim);font-size:12px;">checking…</td></tr>`).join('');
  root.innerHTML = `<div class="overlay" id="ovc3"><div class="modal">
    <h3>${multi?`Confirm Conversion Upload — ${daySummaries.length} days detected`:`Confirm Conversion Upload — ${daySummaries[0].date}`}</h3>
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
      <div class="kpi"><div class="kpi-label">Conversions</div><div class="kpi-value">${grand.toLocaleString()}</div></div>
      <div class="kpi"><div class="kpi-label">New (activation)</div><div class="kpi-value">${grandNew.toLocaleString()}</div></div>
      <div class="kpi"><div class="kpi-label">Renewal (extension)</div><div class="kpi-value">${grandRen.toLocaleString()}</div></div>
    </div>
    <div class="hint" style="margin-bottom:10px;">Rules applied: flag = 1 · connected disposition · payment date and time present.${(skipConn||skipPay)?` <b>Not counted:</b> ${skipConn.toLocaleString()} flagged row(s) without a connected disposition, ${skipPay.toLocaleString()} without a payment date/time.`:' Every flagged row passed all three rules.'}</div>
    ${multi?`<div class="hint">Per-day breakdown:</div>
    <div style="max-height:260px;overflow:auto;"><table style="margin-bottom:10px;"><thead><tr><th>Date</th><th>Conversions</th><th>New</th><th>Renewal</th><th>Status</th></tr></thead><tbody>${dayRowsHtml}</tbody></table></div>`:''}
    <div id="convOverwriteWarn" style="display:none;color:var(--red);font-size:12.5px;margin-bottom:10px;font-weight:600;"></div>
    <div id="convProgress" style="display:none;font-size:12.5px;color:var(--text-dim);margin:10px 0;"></div>
    <div class="modal-actions"><button id="cancelConvSave">Cancel</button><button class="primary" id="saveConvDay">Save to Dashboard</button></div>
  </div></div>`;
  document.getElementById('cancelConvSave').onclick=()=>root.innerHTML='';
  document.getElementById('ovc3').addEventListener('click',e=>{ if(e.target.id==='ovc3') root.innerHTML=''; });

  let anyExists=false;
  Promise.all(daySummaries.map((s,idx)=>checkExisting('conversion', s.date).then(exists=>{
    if(exists) anyExists=true;
    const c=document.getElementById('convStatus_'+idx);
    if(c){ c.textContent = exists?'Will overwrite':'New'; c.style.color = exists?'var(--red)':'var(--green, #2a9d5c)'; c.style.fontWeight = exists?'600':'400'; }
  }))).then(()=>{
    if(anyExists){ const w=document.getElementById('convOverwriteWarn'); w.style.display='block'; w.textContent = multi ? 'One or more days already have conversion data — those dates will be overwritten.' : `Conversion data for ${daySummaries[0].date} already exists and will be overwritten.`; }
  });

  document.getElementById('saveConvDay').onclick = async ()=>{
    const btn=document.getElementById('saveConvDay'); btn.disabled=true; btn.textContent='Saving…';
    const progress=document.getElementById('convProgress'); progress.style.display='block';
    try{
      const uid = session ? session.user.id : null;
      for(let i=0;i<daySummaries.length;i++){
        const summary=daySummaries[i];
        progress.textContent=`Saving ${summary.date} (${i+1} of ${daySummaries.length})…`;
        const { error: upErr } = await sb.from('conversion').upsert({
          date: summary.date, file_name: summary.fileName, total_conversions: summary.totalConversions,
          by_agent: summary.byAgent, by_campaign: summary.byCampaign, by_city: summary.byCity, by_type: summary.byType,
          uploaded_at: new Date().toISOString(), uploaded_by: uid
        }, {onConflict:'date'});
        if(upErr) throw upErr;
        await replaceRows('conversion_rows', summary.date, summary.rows.map((r,n)=>({date:summary.date, n, agent:r.agent, campaign:r.campaign, city:r.city||null, type:r.type||null})));
        if(REQUIRE_LOGIN) await replaceRows('conversion_contacts', summary.date, summary.rows.map((r,n)=>({date:summary.date, n, phone:r.phone||null})).filter(r=>r.phone));
        delete convRowsCache[summary.date];
      }
      toast(daySummaries.length>1 ? `Saved conversions for ${daySummaries.length} days` : 'Saved conversion data for '+daySummaries[0].date);
      root.innerHTML='';
      await refreshTab();
    }catch(e){ toast('Save failed: '+(e.message||e.code||e)); btn.disabled=false; btn.textContent='Save to Dashboard'; progress.style.display='none'; }
  };
}

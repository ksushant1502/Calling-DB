// ===== UPLOAD: daily calling CSV (single or multi-day, column mapping, preview, save) =====
// ===================== UPLOAD: CALLING DATA =====================
let pendingParsed=null;
let uploadSource='calls';   // 'calls' = campaign report, 'queue' = retention queue report
let uploadFrom='', uploadTo='', uploadDefaultLob='Other', uploadDefaultCity=''; // optional date range chosen on the first screen
let uploadQueue=[];            // more files waiting after the current one (several files dropped together)
let uploadFilterByDate=false;  // true when opened from a red date on Upload Status: keep only that date's rows
function setUploadStatus(msg){ const el=document.getElementById('fileStatus'); if(el) el.textContent=msg; }
function openUploadModal(preset){
  uploadQueue=[]; uploadFilterByDate=!!(preset && preset.date);
  if(preset && preset.source) uploadSource=preset.source;
  else { const sv=safeGet('yulu_upload_source'); if(sv && SOURCES[sv]) uploadSource=sv; }
  const root=document.getElementById('modalRoot');
  root.innerHTML = `<div class="overlay" id="ov1"><div class="modal">
    <h3>Upload Calling CSV</h3>
    <div class="field"><label>Which report is this?</label>
      <select id="uploadSource">${Object.entries(SOURCES).map(([k,v])=>`<option value="${k}" ${uploadSource===k?'selected':''}>${v.label}</option>`).join('')}</select>
      <div class="hint" style="margin-top:6px;"><b>Campaign report</b>: one file with Enterprise, Survey and Incoming calls — the dashboard splits it into those sections by itself. <b>Retention report</b>: the separate file with the Queue_Name column.</div></div>
    ${uploadFilterByDate?`<div class="admin-only-note" style="margin:8px 0;">Uploading <b>${preset.date}</b> only: rows from other dates in the file are ignored.</div>`:''}
    <div class="hint">Choose the first and last date this file covers. Leave both blank to take every date found in the file. Pick the same date in both to save the whole file as one day.</div>
    <div class="field-row">
      <div class="field"><label>From date</label><input type="date" id="uploadFrom"></div>
      <div class="field"><label>To date</label><input type="date" id="uploadTo"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Default Type / LOB (only for campaigns not in the known list)</label><select id="uploadLob">${LOBS.map(l=>`<option value="${l}">${l}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Default City (optional — leave blank if not a city-ops file)</label>
      <select id="uploadCity"><option value="">— none —</option>${CITIES.map(c=>`<option value="${c}">${c}</option>`).join('')}</select></div>
    <div class="field"><label>CSV file</label><div class="file-drop" id="dropZone">Click to choose a CSV file — or select the campaign and Retention files together</div><input type="file" id="fileInput" accept=".csv" multiple style="display:none;"></div>
    <div id="fileStatus" style="font-size:12.5px;color:var(--text-dim);"></div>
    <div class="modal-actions"><button id="cancelUpload">Cancel</button></div>
  </div></div>`;
  if(uploadFilterByDate){ document.getElementById('uploadFrom').value=preset.date; document.getElementById('uploadTo').value=preset.date; }
  const dz=document.getElementById('dropZone');
  dz.ondragover=(e)=>{ e.preventDefault(); dz.style.borderColor='var(--accent)'; };
  dz.ondragleave=()=>{ dz.style.borderColor=''; };
  dz.ondrop=(e)=>{ e.preventDefault(); dz.style.borderColor=''; handleFileSelect({target:{files:e.dataTransfer.files}}); };
  document.getElementById('dropZone').onclick=()=>document.getElementById('fileInput').click();
  document.getElementById('fileInput').onchange=handleFileSelect;
  document.getElementById('cancelUpload').onclick=()=>root.innerHTML='';
  document.getElementById('ov1').addEventListener('click',e=>{ if(e.target.id==='ov1') root.innerHTML=''; });
}
function handleFileSelect(e){
  const files=[...(e.target.files||[])].filter(f=>/\.csv$/i.test(f.name)); if(!files.length) return;
  uploadSource=document.getElementById('uploadSource').value;
  uploadDefaultLob=document.getElementById('uploadLob').value; uploadDefaultCity=document.getElementById('uploadCity').value;
  uploadFrom=document.getElementById('uploadFrom').value; uploadTo=document.getElementById('uploadTo').value;
  if(uploadFrom && uploadTo && uploadFrom>uploadTo){ [uploadFrom,uploadTo]=[uploadTo,uploadFrom]; }
  uploadQueue = files.slice(1);
  if(files.length>1) toast(`${files.length} files selected — they will be uploaded one after the other`);
  parseAndOpen(files[0]);
}
function parseAndOpen(file){
  setUploadStatus('Parsing…');
  Papa.parse(file,{header:true, skipEmptyLines:true, complete:(results)=>{
    const headers=results.meta.fields||[];
    const low=headers.map(h=>h.toLowerCase().trim());
    if(low.includes('conversion_flag')){ toast(`"${file.name}" looks like a conversion file — upload it with "Upload Conversion CSV" instead. Skipped.`); document.getElementById('modalRoot').innerHTML=''; startNextQueued(); return; }
    // which report is it? decided by its column names
    let detected = null;
    if(low.includes('queue_name') && !low.includes('campaign_name')) detected='queue';
    else if(low.includes('campaign_name')) detected='calls';
    if(detected && detected!==uploadSource){ uploadSource=detected; toast(`"${file.name}" detected as: ${SOURCES[detected].label}`); }
    safeSet('yulu_upload_source', uploadSource);
    pendingParsed={fileName:file.name, headers, rows:results.data};
    setUploadStatus(`Parsed ${results.data.length.toLocaleString()} rows, ${headers.length} columns.`);
    openMappingModal();
  }, error:(err)=>{ setUploadStatus('Failed to parse CSV: '+err.message); }});
}
function startNextQueued(){
  if(!uploadQueue.length) return;
  const next=uploadQueue.shift();
  toast(`Next file: ${next.name}`);
  parseAndOpen(next);
}
function guessColumn(headers,keywords){
  const norm=h=>h.toLowerCase().replace(/\s*\(ist\)\s*$/,'').trim();
  const lower=headers.map(norm);
  for(const kw of keywords){ const i=lower.findIndex(h=>h===kw); if(i>=0) return headers[i]; }
  for(const kw of keywords){ const i=lower.findIndex(h=>h.startsWith(kw)); if(i>=0) return headers[i]; }
  for(const kw of keywords){ const i=lower.findIndex(h=>h.includes(kw)); if(i>=0) return headers[i]; }
  return '';
}

function openMappingModal(){
  const headers=pendingParsed.headers;
  const savedMap = JSON.parse(safeGet('yulu_col_map_v3_'+headers.join('|').slice(0,100))||'null');
  const guess = savedMap || {
    agent:guessColumn(headers,['agent_username','agent']), campaign:guessColumn(headers,['campaign_name','queue_name','campaign','queue']),
    callid:guessColumn(headers,['call_id','call id','callid']),
    phone:guessColumn(headers,['customer_ph_number','phone','mobile','number']), disposition:guessColumn(headers,['disposition']),
    talktime:guessColumn(headers,['talk','duration']), notes:guessColumn(headers,['note','remark','comment']),
    lobcol:guessColumn(headers,['lob','type']), citycol:guessColumn(headers,['city']),
    datecol:guessColumn(headers,['call_assigned','assigned_time','call_date','date','created']),
    formcols: []
  };
  const opts=(sel)=>`<option value="">— none —</option>`+headers.map(h=>`<option value="${escapeHtml(h)}" ${h===sel?'selected':''}>${escapeHtml(h)}</option>`).join('');
  const mappedSoFar = ['Form_Header','Form_Data','Custom_Field_1',guess.agent,guess.campaign,guess.callid,guess.phone,guess.disposition,guess.talktime,guess.notes,guess.lobcol,guess.citycol,guess.datecol].filter(Boolean);
  const formCandidates = headers.filter(h=>!mappedSoFar.includes(h));

  const root=document.getElementById('modalRoot');
  root.innerHTML = `<div class="overlay" id="ov2"><div class="modal">
    <h3>Map Columns — ${escapeHtml(pendingParsed.fileName)}</h3>
    <div class="hint">Confirm the required fields. Optional LOB/City columns override the defaults you picked, per row (use this for combined multi-LOB files). Check any columns below that are questionnaire/form answers. Call ID identifies each call/lead record — use it instead of phone for anything that needs a reliable identifier, since phone numbers can be missing, shared, or duplicated in some campaign exports.</div>
    <div class="field-row">
      <div class="field"><label>Agent column</label><select id="mapAgent">${opts(guess.agent)}</select></div>
      <div class="field"><label>Campaign column *</label><select id="mapCampaign">${opts(guess.campaign)}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Call ID column</label><select id="mapCallId">${opts(guess.callid)}</select></div>
      <div class="field"><label>Disposition column *</label><select id="mapDisposition">${opts(guess.disposition)}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Talk time column</label><select id="mapTalktime">${opts(guess.talktime)}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Phone column</label><select id="mapPhone">${opts(guess.phone)}</select></div>
      <div class="field"><label>Notes column</label><select id="mapNotes">${opts(guess.notes)}</select></div>
      <div class="field"><label>LOB/Type column (optional, per-row override)</label><select id="mapLob">${opts(guess.lobcol)}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>City column (optional, per-row override)</label><select id="mapCity">${opts(guess.citycol)}</select></div>
      <div class="field"><label>Date column ${(uploadFrom && uploadTo && uploadFrom===uploadTo)?'(not used — one day)':'*'}</label><select id="mapDateCol">${opts(guess.datecol)}</select></div>
    </div>
    <div class="hint" style="margin-top:-6px;">${(uploadFrom && uploadTo && uploadFrom===uploadTo) ? 'One-day mode: the whole file is saved under '+uploadFrom+'.' : 'Each distinct date found in the Date column (within your From–To range) is saved as its own day.'}</div>
    <div class="field"><label>Questionnaire / form columns (checked = treated as an answer)</label>
      <div class="checklist">${formCandidates.map(h=>`<label><input type="checkbox" class="formCk" value="${escapeHtml(h)}" ${(guess.formcols||[]).includes(h)?'checked':''}> ${escapeHtml(h)}</label>`).join('')}</div>
    </div>
    <div class="modal-actions"><button id="backUpload">Back</button><button class="primary" id="confirmMap">Preview & Save</button></div>
  </div></div>`;
  document.getElementById('backUpload').onclick=openUploadModal;
  document.getElementById('confirmMap').onclick=confirmMapping;
  document.getElementById('ov2').addEventListener('click',e=>{ if(e.target.id==='ov2') document.getElementById('modalRoot').innerHTML=''; });
}

// Flexible date parser for an optional "Date column" mapping: handles ISO (YYYY-MM-DD...),
// day-first DD/MM/YYYY or DD-MM-YYYY (common in Indian exports), and falls back to the
// browser's own Date parsing for anything else (e.g. full timestamps, month names).
function parseDateToYMD(v){
  if(v===undefined||v===null||v==='') return null;
  const s=String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return `${m[1]}-${String(+m[2]).padStart(2,'0')}-${String(+m[3]).padStart(2,'0')}`;
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if(m){ const d=+m[1], mo=+m[2], y=+m[3]; if(mo>=1&&mo<=12&&d>=1&&d<=31) return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
  const dt = new Date(s);
  if(!isNaN(dt.getTime())) return dt.toISOString().slice(0,10);
  return null;
}

// Runs the full per-row aggregation (dials/connects, campaigns, agents, unique-Call-ID sets,
// flag counts) over one array of raw CSV rows — used once per day when a file is split across
// multiple dates, or once for the whole file when it isn't.
const unmappedCampaigns = new Set();
let skippedRetention=0;
function processRows(rows, map, defaultLob, defaultCity, source){
  const campaigns={}, agents={};
  const callIdSets={};
  const agentLobCallIdSets={}, agentLobConnectedCallIdSets={};
  let totalDials=0, totalConnects=0;
  const compactRows=[];
  const flagCounts={short_connect:0,misconduct:0,callback:0,form_not_filled:0,hot_convert:0};

  rows.forEach(row=>{
    const campaign=(row[map.campaign]||'Unknown').trim();
    if(isExcludedCampaign(campaign, source)) return;
    const rawAgent = map.agent ? String(row[map.agent]||'').trim().toLowerCase() : '';
    const isIncomingCampaign = campaign===INCOMING_CAMPAIGN;
    if(isIncomingCampaign && !INCOMING_CALLERS[rawAgent]) return;   // incoming calls count only for the city-line callers; the rest is RSA
    if(isRsaAgent(rawAgent)) return;
    if(isRsaRow(row)) return;
    const agent = map.agent ? normalizeAgent(row[map.agent]) : 'Unknown';
    const disp = row[map.disposition]||'';
    const callId = map.callid ? String(row[map.callid]||'').trim() : '';
    const talkSec = map.talktime ? parseTalkTime(row[map.talktime]) : 0;
    const phone = map.phone ? String(row[map.phone]||'').trim() : '';
    const notes = map.notes ? String(row[map.notes]||'').trim() : '';
    const known = isIncomingCampaign ? {lob:'Incoming', city:INCOMING_CALLERS[rawAgent]} : lookupLobCity(campaign, row['Custom_Field_1']);
    if(!known) unmappedCampaigns.add(campaign);
    // priority: per-row LOB/City column  >  known campaign map  >  upload-screen default
    const lob = map.lobcol && row[map.lobcol] ? String(row[map.lobcol]).trim() : (known ? known.lob : (defaultLob||'Other'));
    const city = map.citycol && row[map.citycol] ? String(row[map.citycol]).trim() : (known ? known.city : (defaultCity||''));
    const form = {};
    // Dialer exports keep all form answers in two cells: Form_Header ("q1,q2,...") and Form_Data ("a1,a2,...")
    const fh = String(row['Form_Header']||'').trim(), fd = String(row['Form_Data']||'').trim();
    if(fh && fd){ const hs=fh.split(',').map(s=>s.trim()), ds=fd.split(',').map(s=>s.trim()); for(let i=0;i<Math.min(hs.length,ds.length);i++) if(ds[i]!=='') form[hs[i]]=ds[i]; }
    map.formcols.forEach(fc=>{ const v=row[fc]; if(v!==undefined && v!==null && String(v).trim()!=='') form[fc]=String(v).trim(); });
    if(source==='calls' && lob==='Retention'){ skippedRetention++; return; }   // Retention comes only from the separate Retention report
    const connected = isConnect(disp);

    totalDials++; if(connected) totalConnects++;
    if(!campaigns[campaign]) campaigns[campaign]={dials:0,connects:0,uniqueCallIds:0,lob,city,byCity:{}};
    campaigns[campaign].dials++; if(connected) campaigns[campaign].connects++;
    if(city){ campaigns[campaign].byCity[city]=campaigns[campaign].byCity[city]||{dials:0,connects:0}; campaigns[campaign].byCity[city].dials++; if(connected) campaigns[campaign].byCity[city].connects++; }
    if(callId){ callIdSets[campaign]=callIdSets[campaign]||new Set(); callIdSets[campaign].add(callId); }

    if(!agents[agent]) agents[agent]={dials:0,connects:0,byLob:{},byCity:{}};
    agents[agent].dials++; if(connected) agents[agent].connects++;
    agents[agent].byLob[lob]=agents[agent].byLob[lob]||{dials:0,connects:0};
    agents[agent].byLob[lob].dials++; if(connected) agents[agent].byLob[lob].connects++;
    if(city){ agents[agent].byCity[city]=agents[agent].byCity[city]||{dials:0,connects:0}; agents[agent].byCity[city].dials++; if(connected) agents[agent].byCity[city].connects++; }
    if(callId){
      const alKey=agent+'|||'+lob;
      agentLobCallIdSets[alKey]=agentLobCallIdSets[alKey]||new Set(); agentLobCallIdSets[alKey].add(callId);
      if(connected){ agentLobConnectedCallIdSets[alKey]=agentLobConnectedCallIdSets[alKey]||new Set(); agentLobConnectedCallIdSets[alKey].add(callId); }
    }

    // PRIVACY: phone and notes go into a separate editor-only table (call_contacts); the main rows never contain them.
    const notesLower=notes.toLowerCase(), dispLower=String(disp).toLowerCase();
    const reasons=[];
    if(connected && talkSec>0 && talkSec<30){ flagCounts.short_connect++; reasons.push('short_connect'); }
    if(keywordHit([notesLower,dispLower], MISCONDUCT_KEYWORDS)){ flagCounts.misconduct++; reasons.push('misconduct'); }
    if(keywordHit([dispLower], CALLBACK_KEYWORDS)){ flagCounts.callback++; reasons.push('callback'); }
    if(connected && Object.keys(form).length===0){ flagCounts.form_not_filled++; reasons.push('form_not_filled'); }
    if(keywordHit([notesLower,dispLower], HOT_KEYWORDS) && !/not\s*[-_ ]?\s*(interested|intrested)/.test(dispLower)){ flagCounts.hot_convert++; reasons.push('hot_convert'); }

    const pkey = isDedupeCampaign(campaign) ? phoneKey(phone) : '';
    compactRows.push({n:compactRows.length,agent,campaign,lob,city,callId,disposition:disp,talkSec,flags:reasons.join(','),form,phone,notes,pkey});
  });
  Object.keys(campaigns).forEach(c=>{ campaigns[c].uniqueCallIds = callIdSets[c]?callIdSets[c].size:0; });
  Object.keys(agents).forEach(agent=>{
    Object.keys(agents[agent].byLob).forEach(lob=>{
      const alKey=agent+'|||'+lob;
      agents[agent].byLob[lob].uniqueCallIds = agentLobCallIdSets[alKey]?agentLobCallIdSets[alKey].size:0;
      agents[agent].byLob[lob].uniqueConnectedCallIds = agentLobConnectedCallIdSets[alKey]?agentLobConnectedCallIdSets[alKey].size:0;
    });
  });
  return {campaigns, agents, totalDials, totalConnects, compactRows, flagCounts};
}

function confirmMapping(){
  const map = {
    agent:document.getElementById('mapAgent').value, campaign:document.getElementById('mapCampaign').value,
    callid:document.getElementById('mapCallId').value,
    phone:document.getElementById('mapPhone').value, disposition:document.getElementById('mapDisposition').value,
    talktime:document.getElementById('mapTalktime').value, notes:document.getElementById('mapNotes').value,
    lobcol:document.getElementById('mapLob').value, citycol:document.getElementById('mapCity').value,
    datecol:document.getElementById('mapDateCol').value,
    formcols: [...document.querySelectorAll('.formCk:checked')].map(c=>c.value)
  };
  if(!map.campaign || !map.disposition){ toast('Campaign and Disposition columns are required'); return; }
  safeSet('yulu_col_map_v3_'+pendingParsed.headers.join('|').slice(0,100), JSON.stringify(map));

  const defaultLob = uploadDefaultLob;
  const defaultCity = uploadDefaultCity;

  let groups = {};
  let unparsed = 0;
  const singleDay = uploadFrom && uploadTo && uploadFrom===uploadTo;
  if(!singleDay && !map.datecol){ toast('Pick the Date column (e.g. Call_Assigned_Time) so the file can be split by day — or go Back and choose the same From and To date.'); return; }
  let outOfRange = 0;
  if(singleDay && uploadFilterByDate && map.datecol){
    groups[uploadFrom] = pendingParsed.rows.filter(row=>{ const d=parseDateToYMD(row[map.datecol]); if(d===uploadFrom) return true; outOfRange++; return false; });
    if(!groups[uploadFrom].length){ toast(`No rows for ${uploadFrom} were found in this file (column "${map.datecol}").`); return; }
  } else if(singleDay){
    groups[uploadFrom] = pendingParsed.rows;
  } else {
    pendingParsed.rows.forEach(row=>{
      const d = parseDateToYMD(row[map.datecol]);
      if(!d){ unparsed++; return; }
      if((uploadFrom && d<uploadFrom) || (uploadTo && d>uploadTo)){ outOfRange++; return; }
      groups[d] = groups[d] || [];
      groups[d].push(row);
    });
  }
  if(outOfRange) toast(`${outOfRange.toLocaleString()} row(s) outside ${uploadFrom||'start'} → ${uploadTo||'end'} were skipped`);
  const dates = Object.keys(groups).sort();
  if(dates.length===0){ toast('No rows with a parseable date were found — check the Date column mapping.'); return; }
  if(unparsed) toast(`${unparsed.toLocaleString()} row(s) had an unreadable date and were skipped`);

  unmappedCampaigns.clear(); skippedRetention=0;
  const daySummaries = dates.map(date=>{
    const rows = groups[date];
    const agg = processRows(rows, map, defaultLob, defaultCity, uploadSource);
    return {
      date, fileName:pendingParsed.fileName, totalRows:rows.length, excludedRows:rows.length-agg.compactRows.length,
      totalDials:agg.totalDials, totalConnects:agg.totalConnects, campaigns:agg.campaigns, agents:agg.agents,
      flagsCount:agg.flagCounts, compactRows:agg.compactRows
    };
  });

  if(daySummaries.every(d=>d.totalDials===0)){
    toast(uploadSource==='calls'
      ? 'Every row was skipped. If this is the Retention queue file, go back and choose "Retention report".'
      : 'Every row was skipped — check the Queue / Agent column mapping.');
    return;
  }
  showPreview(daySummaries);
}

function showPreview(daySummaries){
  const root=document.getElementById('modalRoot');
  const multi = daySummaries.length>1;
  const grandDials = daySummaries.reduce((s,d)=>s+d.totalDials,0);
  const grandConnects = daySummaries.reduce((s,d)=>s+d.totalConnects,0);
  const grandConnPct = grandDials? grandConnects/grandDials*100:0;

  const dayRowsHtml = daySummaries.map((summary,idx)=>{
    const connPct = summary.totalDials? summary.totalConnects/summary.totalDials*100:0;
    return `<tr data-idx="${idx}">
      <td>${summary.date}</td>
      <td>${summary.totalDials.toLocaleString()}</td>
      <td>${summary.totalConnects.toLocaleString()}</td>
      <td class="${pctClass(connPct)}">${fmtPct(connPct)}</td>
      <td class="overwriteCell" id="overwriteCell_${idx}" style="color:var(--text-dim);font-size:12px;">checking…</td>
    </tr>`;
  }).join('');

  const byTypeAgg = {};
  daySummaries.forEach(d=>Object.values(d.campaigns).forEach(v=>{
    const t=campaignTypeOf(v.lob); const x=byTypeAgg[t.id]=byTypeAgg[t.id]||{label:t.label,dials:0,connects:0,n:0};
    x.dials+=v.dials; x.connects+=v.connects; x.n++;
  }));
  const typeBlock = `<div class="hint">What is in this file (by section):</div>
    <table style="margin-bottom:10px;"><thead><tr><th>Section</th><th>Dials</th><th>Connects</th></tr></thead><tbody>${Object.values(byTypeAgg).sort((a,b)=>b.dials-a.dials).map(x=>`<tr><td>${escapeHtml(x.label)}</td><td>${x.dials.toLocaleString()}</td><td>${x.connects.toLocaleString()}</td></tr>`).join('')}</tbody></table>
    ${skippedRetention?`<div class="hint">${skippedRetention.toLocaleString()} Retention row(s) were skipped — Retention is taken only from the separate Retention report.</div>`:''}`;

  const summaryBlock = multi
    ? `<div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px;">
        <div class="kpi"><div class="kpi-label">Days detected</div><div class="kpi-value">${daySummaries.length}</div></div>
        <div class="kpi"><div class="kpi-label">Total Dials</div><div class="kpi-value">${grandDials.toLocaleString()}</div></div>
        <div class="kpi"><div class="kpi-label">Total Connects</div><div class="kpi-value">${grandConnects.toLocaleString()}</div></div>
        <div class="kpi"><div class="kpi-label">Conn %</div><div class="kpi-value ${pctClass(grandConnPct)}">${fmtPct(grandConnPct)}</div></div>
      </div>`
    : (()=>{
        const summary=daySummaries[0];
        const connPct = summary.totalDials? summary.totalConnects/summary.totalDials*100:0;
        const topCampaigns = Object.entries(summary.campaigns).sort((a,b)=>b[1].dials-a[1].dials).slice(0,5);
        return `<div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
          <div class="kpi"><div class="kpi-label">Dials</div><div class="kpi-value">${summary.totalDials.toLocaleString()}</div></div>
          <div class="kpi"><div class="kpi-label">Connects</div><div class="kpi-value">${summary.totalConnects.toLocaleString()}</div></div>
          <div class="kpi"><div class="kpi-label">Conn %</div><div class="kpi-value ${pctClass(connPct)}">${fmtPct(connPct)}</div></div>
        </div>
        <div class="hint">Top campaigns:</div>
        <table style="margin-bottom:10px;"><thead><tr><th>Campaign</th><th>Dials</th></tr></thead><tbody>${topCampaigns.map(([n,v])=>`<tr><td>${escapeHtml(n)}</td><td>${v.dials}</td></tr>`).join('')}</tbody></table>
        <div class="hint">Flags detected: ${Object.entries(summary.flagsCount).map(([k,v])=>`${k.replace('_',' ')}: ${v}`).join(' · ')}</div>`;
      })();

  root.innerHTML = `<div class="overlay" id="ov3"><div class="modal">
    <h3>${multi ? `Confirm Upload — ${daySummaries.length} days detected` : `Confirm Upload — ${daySummaries[0].date}`}</h3>
    ${summaryBlock}
    ${typeBlock}
    ${multi ? `<div class="hint">Per-day breakdown:</div>
    <table style="margin-bottom:10px;"><thead><tr><th>Date</th><th>Dials</th><th>Connects</th><th>Conn %</th><th>Status</th></tr></thead><tbody>${dayRowsHtml}</tbody></table>` : ''}
    ${unmappedCampaigns.size ? `<div style="font-size:12.5px;margin:10px 0;padding:8px 10px;border-radius:8px;background:#fff6e0;color:#7a5200;"><b>${unmappedCampaigns.size} campaign(s) not in the known list</b> — saved with the default Type/City you picked: ${[...unmappedCampaigns].map(escapeHtml).join(', ')}. Add them to CAMPAIGN_MAP in js/config.js to classify them automatically.</div>` : ''}
    <div id="overwriteWarn" style="display:none;color:var(--red);font-size:12.5px;margin:10px 0;font-weight:600;"></div>
    <div id="saveProgress" style="display:none;font-size:12.5px;color:var(--text-dim);margin:10px 0;"></div>
    <div class="modal-actions"><button id="cancelSave">Cancel</button><button class="primary" id="saveDay">Save to Dashboard</button></div>
  </div></div>`;
  document.getElementById('cancelSave').onclick=()=>root.innerHTML='';
  document.getElementById('ov3').addEventListener('click',e=>{ if(e.target.id==='ov3') root.innerHTML=''; });

  let anyExists = false;
  Promise.all(daySummaries.map((summary,idx)=>checkExisting(SOURCES[uploadSource].days, summary.date).then(exists=>{
    if(exists) anyExists = true;
    if(multi){
      const cell = document.getElementById(`overwriteCell_${idx}`);
      if(cell){ cell.textContent = exists ? 'Will overwrite' : 'New'; cell.style.color = exists ? 'var(--red)' : 'var(--green, #2a9d5c)'; cell.style.fontWeight = exists ? '600':'400'; }
    }
    return exists;
  }))).then(()=>{
    if(!multi && anyExists){
      const w=document.getElementById('overwriteWarn'); w.style.display='block';
      w.textContent=`Data for ${daySummaries[0].date} already exists and will be overwritten.`;
    } else if(multi && anyExists){
      const w=document.getElementById('overwriteWarn'); w.style.display='block';
      w.textContent='One or more days already have data — those dates will be overwritten.';
    }
  });

  document.getElementById('saveDay').onclick = async ()=>{
    const btn=document.getElementById('saveDay'); btn.disabled=true; btn.textContent='Saving…';
    const progress = document.getElementById('saveProgress'); progress.style.display='block';
    try{
      const uid = session ? session.user.id : null;
      for(let i=0;i<daySummaries.length;i++){
        const summary = daySummaries[i];
        progress.textContent = `Saving ${summary.date} (${i+1} of ${daySummaries.length})…`;
        const { error: upErr } = await sb.from(SOURCES[uploadSource].days).upsert({
          date: summary.date, file_name: summary.fileName, total_rows: summary.totalRows, excluded_rows: summary.excludedRows,
          total_dials: summary.totalDials, total_connects: summary.totalConnects,
          campaigns: summary.campaigns, agents: summary.agents, flags_count: summary.flagsCount,
          uploaded_at: new Date().toISOString(), uploaded_by: uid
        }, {onConflict:'date'});
        if(upErr) throw upErr;
        await replaceRows(SOURCES[uploadSource].rows, summary.date, summary.compactRows.map(r=>({
          date: summary.date, n:r.n, agent:r.agent, campaign:r.campaign, lob:r.lob, city:r.city||null,
          call_id:r.callId||null, disposition:r.disposition||null, talk_sec:r.talkSec||0, flags:r.flags||null, form:r.form||{}, ...(r.pkey?{pkey:r.pkey}:{})
        })));
        // phone + notes: separate table, readable by editors only
        if(REQUIRE_LOGIN) await replaceRows('call_contacts', summary.date, summary.compactRows.filter(r=>r.phone||r.notes).map(r=>({date:summary.date, source:uploadSource, n:r.n, phone:r.phone||null, notes:r.notes||null})), {source:uploadSource});
        delete rowsCache[summary.date];
      }
      toast(daySummaries.length>1 ? `Saved data for ${daySummaries.length} days` : 'Saved data for '+daySummaries[0].date);
      root.innerHTML='';
      await refreshTab();
      startNextQueued();
    }catch(e){ toast('Save failed: '+(e.message||e.code||e)); btn.disabled=false; btn.textContent='Save to Dashboard'; progress.style.display='none'; }
  };
}

async function checkExisting(table, date){
  try{ const { data } = await sb.from(table).select('date').eq('date', date).maybeSingle(); return !!data; }catch(e){ return false; }
}

async function replaceRows(table, date, rows, extra){
  let delQ = sb.from(table).delete().eq('date', date);
  if(extra) Object.entries(extra).forEach(([k,v])=>{ delQ = delQ.eq(k,v); });
  const { error: delErr } = await delQ;
  if(delErr) throw delErr;
  const chunkSize = 500;
  for(let i=0;i<rows.length;i+=chunkSize){
    const slice = rows.slice(i, i+chunkSize);
    const { error } = await sb.from(table).insert(slice);
    if(error) throw error;
  }
}

// ===== UPLOAD: conversion CSV =====
// ===================== UPLOAD: CONVERSION DATA =====================
let pendingConvParsed=null;
function openConversionUploadModal(){
  const root=document.getElementById('modalRoot');
  root.innerHTML = `<div class="overlay" id="ovc1"><div class="modal">
    <h3>Upload Conversion CSV</h3>
    <div class="hint">Only rows with conversion_flag = 1 should be counted — you'll confirm the filter column in the next step.</div>
    <div class="field"><label>Date this file covers</label><input type="date" id="convDate" value="${todayStr()}"></div>
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
  document.getElementById('convFileStatus').textContent='Parsing…';
  Papa.parse(file,{header:true, skipEmptyLines:true, complete:(results)=>{
    pendingConvParsed={fileName:file.name, headers:results.meta.fields||[], rows:results.data};
    document.getElementById('convFileStatus').textContent=`Parsed ${results.data.length.toLocaleString()} rows.`;
    openConvMappingModal();
  }, error:(err)=>{ document.getElementById('convFileStatus').textContent='Failed: '+err.message; }});
}
function openConvMappingModal(){
  const headers=pendingConvParsed.headers;
  const guess = {
    agent:guessColumn(headers,['agent']), campaign:guessColumn(headers,['campaign']),
    city:guessColumn(headers,['city']), type:guessColumn(headers,['conversion_type','type']),
    flag:guessColumn(headers,['conversion_flag','flag']), phone:guessColumn(headers,['phone','mobile','number']),
  };
  const opts=(sel)=>`<option value="">— none —</option>`+headers.map(h=>`<option value="${escapeHtml(h)}" ${h===sel?'selected':''}>${escapeHtml(h)}</option>`).join('');
  const root=document.getElementById('modalRoot');
  root.innerHTML = `<div class="overlay" id="ovc2"><div class="modal">
    <h3>Map Columns — ${escapeHtml(pendingConvParsed.fileName)}</h3>
    <div class="field-row">
      <div class="field"><label>Agent column *</label><select id="cmAgent">${opts(guess.agent)}</select></div>
      <div class="field"><label>Campaign column *</label><select id="cmCampaign">${opts(guess.campaign)}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>City column</label><select id="cmCity">${opts(guess.city)}</select></div>
      <div class="field"><label>Conversion type column (new/renewal)</label><select id="cmType">${opts(guess.type)}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>conversion_flag column *</label><select id="cmFlag">${opts(guess.flag)}</select></div>
      <div class="field"><label>Phone column</label><select id="cmPhone">${opts(guess.phone)}</select></div>
    </div>
    <div class="hint">Only rows where the flag column equals 1 (or "1"/"true") are counted as conversions — matches the confirmed rule (conversion_flag=1 only, not paid_flag).</div>
    <div class="modal-actions"><button id="backConv">Back</button><button class="primary" id="confirmConvMap">Preview & Save</button></div>
  </div></div>`;
  document.getElementById('backConv').onclick=openConversionUploadModal;
  document.getElementById('confirmConvMap').onclick=confirmConvMapping;
  document.getElementById('ovc2').addEventListener('click',e=>{ if(e.target.id==='ovc2') document.getElementById('modalRoot').innerHTML=''; });
}
function confirmConvMapping(){
  const map = {
    agent:document.getElementById('cmAgent').value, campaign:document.getElementById('cmCampaign').value,
    city:document.getElementById('cmCity').value, type:document.getElementById('cmType').value,
    flag:document.getElementById('cmFlag').value, phone:document.getElementById('cmPhone').value,
  };
  if(!map.agent || !map.campaign || !map.flag){ toast('Agent, Campaign and conversion_flag columns are required'); return; }
  const date = document.getElementById('convDate').value || todayStr();
  const byAgent={}, byCampaign={}, byCity={}, byType={new:0,renewal:0,other:0};
  const rows=[];
  let total=0;
  pendingConvParsed.rows.forEach(row=>{
    const flagVal = String(row[map.flag]||'').trim().toLowerCase();
    if(!(flagVal==='1'||flagVal==='true'||flagVal==='yes')) return;
    const campaign = (row[map.campaign]||'Unknown').trim();
    if(isExcludedCampaign(campaign)) return;
    const agent = normalizeAgent(row[map.agent]);
    const city = map.city ? (row[map.city]||'').trim() : '';
    let type = map.type ? String(row[map.type]||'').trim().toLowerCase() : '';
    if(type.includes('new')) type='new'; else if(type.includes('renew')) type='renewal'; else type='other';
    const phone = map.phone ? String(row[map.phone]||'').trim() : '';
    total++;
    byAgent[agent]=byAgent[agent]||{count:0}; byAgent[agent].count++;
    byCampaign[campaign]=byCampaign[campaign]||{count:0}; byCampaign[campaign].count++;
    if(city){ byCity[city]=byCity[city]||{count:0}; byCity[city].count++; }
    byType[type] = (byType[type]||0)+1;
    rows.push({agent,campaign,city,type,phone});
  });
  const summary = {date, fileName:pendingConvParsed.fileName, totalConversions:total, byAgent, byCampaign, byCity, byType};
  showConvPreview(summary, rows);
}
function showConvPreview(summary, rows){
  const root=document.getElementById('modalRoot');
  root.innerHTML = `<div class="overlay" id="ovc3"><div class="modal">
    <h3>Confirm Conversion Upload — ${summary.date}</h3>
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
      <div class="kpi"><div class="kpi-label">Conversions</div><div class="kpi-value">${summary.totalConversions}</div></div>
      <div class="kpi"><div class="kpi-label">New</div><div class="kpi-value">${summary.byType.new||0}</div></div>
      <div class="kpi"><div class="kpi-label">Renewal</div><div class="kpi-value">${summary.byType.renewal||0}</div></div>
    </div>
    <div id="convOverwriteWarn" style="display:none;color:var(--red);font-size:12.5px;margin-bottom:10px;font-weight:600;"></div>
    <div class="modal-actions"><button id="cancelConvSave">Cancel</button><button class="primary" id="saveConvDay">Save to Dashboard</button></div>
  </div></div>`;
  document.getElementById('cancelConvSave').onclick=()=>root.innerHTML='';
  document.getElementById('ovc3').addEventListener('click',e=>{ if(e.target.id==='ovc3') root.innerHTML=''; });
  checkExisting('conversion', summary.date).then(exists=>{ if(exists){ const w=document.getElementById('convOverwriteWarn'); w.style.display='block'; w.textContent=`Conversion data for ${summary.date} already exists and will be overwritten.`; } });
  document.getElementById('saveConvDay').onclick = async ()=>{
    const btn=document.getElementById('saveConvDay'); btn.disabled=true; btn.textContent='Saving…';
    try{
      const uid = session ? session.user.id : null;
      const { error: upErr } = await sb.from('conversion').upsert({
        date: summary.date, file_name: summary.fileName, total_conversions: summary.totalConversions,
        by_agent: summary.byAgent, by_campaign: summary.byCampaign, by_city: summary.byCity, by_type: summary.byType,
        uploaded_at: new Date().toISOString(), uploaded_by: uid
      }, {onConflict:'date'});
      if(upErr) throw upErr;
      await replaceRows('conversion_rows', summary.date, rows.map(r=>({date:summary.date, agent:r.agent, campaign:r.campaign, city:r.city||null, type:r.type||null, phone:r.phone||null})));
      delete convRowsCache[summary.date];
      toast('Saved conversion data for '+summary.date);
      root.innerHTML='';
      await refreshTab();
    }catch(e){ toast('Save failed: '+(e.message||e.code||e)); btn.disabled=false; btn.textContent='Save to Dashboard'; }
  };
}

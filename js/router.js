// ===== ROUTER: loads the data a page needs, then draws that page =====
async function refreshTab(){
  renderLoading();
  if(activeTab==='uploads'){
    document.getElementById('rangeSummary').textContent = `${range.start} → ${range.end}`;
    await renderUploadStatus();
    return;
  }
  if(activeTab!=='conversion'){
    dayDocs = await loadDaySummaries();
    await applyUniqueOverrides();
  }
  if(['overview','campaigns','agents','conversion'].includes(activeTab)){
    conversionDocs = await loadConversionSummaries();
  }
  const n = (activeTab==='conversion' ? conversionDocs : dayDocs).length;
  document.getElementById('rangeSummary').textContent = `${range.start} → ${range.end} · ${n} day${n===1?'':'s'} with data`;
  switch(activeTab){
    case 'overview':   renderOverview(); break;
    case 'campaigns':  renderCampaigns(); break;
    case 'agents':     await renderAgents(); break;
    case 'insights':   await renderInsights(); break;
    case 'flags':      await renderFlags(); break;
    case 'conversion': await renderConversion(); break;
  }
}

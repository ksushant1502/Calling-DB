// ===== ROUTER: loads the data a page needs, then draws that page =====
async function refreshTab(){
  renderLoading();
  if(activeTab==='uploads'){
    document.getElementById('rangeSummary').textContent = `${range.start} → ${range.end}`;
    await renderUploadStatus();
    return;
  }
  dayDocs = await loadDaySummaries();   // the Conversions page needs the calls too (conversions out of how many connects)
  await applyUniqueOverrides();
  if(['overview','campaigns','agents','conversion','insights'].includes(activeTab)){
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

// ===== ROUTER: loads the data a page needs, then draws that page =====
let refreshSeq = 0;
async function refreshTab(){
  const my = ++refreshSeq;
  renderLoading();
  Object.values(charts).forEach(c=>{ try{ c.destroy(); }catch(e){} }); charts={};
  if(activeTab==='uploads'){
    renderRangeSummary(null);
    await renderUploadsPage();
    return;
  }
  dayDocs = await loadDaySummaries();
  await applyUniqueOverrides();
  conversionDocs = await loadConversionSummaries();
  if(my!==refreshSeq) return;           // the person already clicked somewhere else
  renderRangeSummary(dayDocs.length);
  const sec = sectionById(activeTab);
  if(sec){ await renderSection(sec); return; }
  switch(activeTab){
    case 'home':   await renderHome(); break;
    case 'agents': await renderAgentsPage(); break;
    case 'flags':  await renderFlagsPage(); break;
  }
}

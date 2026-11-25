// ===== ROUTER: loads the data a page needs, then draws that page =====
let refreshSeq = 0;
async function refreshTab(){
  if(REQUIRE_LOGIN && !session) return;   // nothing is loaded until someone signs in
  const my = ++refreshSeq;
  if(document.getElementById('ovCall')) document.getElementById('modalRoot').innerHTML='';   // close an open call panel
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

// ===== AGGREGATION: shared roll-up helpers used by several tabs =====
function renderLoading(){ document.getElementById('app').innerHTML = `<div class="empty-state"><span class="spinner"></span>Loading…</div>`; }

// ===================== AGGREGATION HELPERS =====================
function lobInFilter(lob, typeId){
  typeId = typeId===undefined ? typeFilter : typeId;
  if(typeId==='all') return true;
  const t = CAMPAIGN_TYPES.find(x=>x.id===typeId);
  return !!t && t.lobs.includes(lob);
}
// campaign name -> LOB, taken from the loaded days (used to attach conversions to a type)
function buildCampaignLobMap(){
  const map={};
  dayDocs.forEach(day=>{ Object.entries(day.campaigns||{}).forEach(([name,v])=>{ if(!(name in map)) map[name]=v.lob; }); });
  return map;
}
// conversions per campaign name for the loaded range
function conversionsByCampaign(){
  const m={}; conversionDocs.forEach(day=>Object.entries(day.byCampaign||{}).forEach(([n,v])=>{ m[n]=(m[n]||0)+(v.count||0); })); return m;
}

function aggregateOverview(cityFilter, typeId){
  const campaigns={}, agents={};
  dayDocs.forEach(day=>{
    Object.entries(day.campaigns||{}).forEach(([name,v])=>{
      if(!lobInFilter(v.lob,typeId)) return;
      let dials=v.dials||0, connects=v.connects||0, uniqueCallIds=(v.uniqueCallIds!=null?v.uniqueCallIds:(v.uniquePhones||0));
      if(cityFilter){
        const cv = (v.byCity||{})[cityFilter];
        if(!cv) return;
        dials=cv.dials||0; connects=cv.connects||0; uniqueCallIds=0;
      }
      if(!campaigns[name]) campaigns[name]={dials:0,connects:0,uniqueCallIds:0,lob:v.lob,city:v.city};
      campaigns[name].dials+=dials; campaigns[name].connects+=connects; campaigns[name].uniqueCallIds+=uniqueCallIds;
    });
    Object.entries(day.agents||{}).forEach(([name,v])=>{
      if(!agents[name]) agents[name]={dials:0,connects:0};
      let d=0,c=0;
      if(cityFilter){
        Object.entries(v.byCity||{}).forEach(([city,cv])=>{ if(city===cityFilter){ d+=cv.dials||0; c+=cv.connects||0; } });
      } else if((typeId===undefined?typeFilter:typeId)==='all'){
        d=v.dials||0; c=v.connects||0;
      } else {
        Object.entries(v.byLob||{}).forEach(([lob,lv])=>{ if(lobInFilter(lob,typeId)){ d+=lv.dials||0; c+=lv.connects||0; } });
      }
      agents[name].dials+=d; agents[name].connects+=c;
    });
  });
  Object.keys(agents).forEach(k=>{ if(agents[k].dials===0 && agents[k].connects===0) delete agents[k]; });
  let totalDialsCalc=0, totalConnectsCalc=0;
  Object.values(campaigns).forEach(c=>{ totalDialsCalc+=c.dials; totalConnectsCalc+=c.connects; });
  return {totalDials:totalDialsCalc, totalConnects:totalConnectsCalc, campaigns, agents};
}

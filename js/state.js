// ===== STATE: shared variables + tab list. Add a new tab here. =====
// ===================== STATE =====================
function safeGet(key){ try{ return localStorage.getItem(key); }catch(e){ return null; } }
function safeSet(key,val){ try{ localStorage.setItem(key,val); }catch(e){} }

let session=null, canWrite=false;
let range = {start:startOfMonth(todayStr()), end:todayStr(), label:'This Month'};
let typeFilter = 'all';
let activeTab = 'home';
let dayDocs=[], conversionDocs=[];
let rowsCache={};
let convRowsCache={};
let charts={};

const ICONS = {
  home:'<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
  overview:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  campaigns:'<svg viewBox="0 0 24 24"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  agents:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.5a5 5 0 0 1 4.5 5.5"/></svg>',
  insights:'<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/></svg>',
  flags:'<svg viewBox="0 0 24 24"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>',
  conversion:'<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  uploads:'<svg viewBox="0 0 24 24"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>',
};
// Top-menu pages, in order. Sections (Acquisition … Incoming) all use the same page layout: js/page-section.js
const SECTIONS = [
  {id:'acquisition', label:'Acquisition', title:'New User Acquisition', types:['acquisition'], color:'#2f6bff',
   desc:'Enterprise lead calling — Zomato, Blinkit, Swiggy and Instamart riders.'},
  {id:'retention',   label:'Retention',   title:'Retention', types:['retention'], color:'#00a3a3',
   desc:'Retention queues — soft churn, extension, payment failure and win-back.'},
  {id:'surveys',     label:'Surveys',     title:'Surveys', types:['survey','ncrchurn'], color:'#8a4fd8',
   desc:'Customer feedback calling and the NCR Festival Churn Survey. Survey calls are not counted as conversions.'},
  {id:'city',        label:'City',        title:'City Calling', types:['city'], color:'#c97a00',
   desc:'City operations calling, by city.'},
  {id:'incoming',    label:'Incoming',    title:'Incoming Customer Calls', types:['incoming'], color:'#d4497a',
   desc:'Calls that customers made to Yulu.'},
];
const TABS = [
  {id:'home', label:'Home'},
  ...SECTIONS.map(s=>({id:s.id, label:s.label, section:true})),
  {id:'agents',  label:'Agents', sep:true},
  {id:'uploads', label:'Uploads'},
];
function sectionById(id){ return SECTIONS.find(s=>s.id===id); }
function sectionOfType(typeId){ return SECTIONS.find(s=>s.types.includes(typeId)); }
function sectionOfLob(lob){ return sectionOfType(campaignTypeOf(lob).id); }
// sub-pages inside a section
const SUBTABS = [
  {id:'summary',  label:'Summary'},
  {id:'calls',    label:'Call details'},
  {id:'insights', label:'Insights & VoC'},
  {id:'agents',   label:'Agents'},
  {id:'flags',    label:'Flags'},
];
let activeSub = 'summary';
let sectionPick = {};   // section id -> chosen type inside it ('all' or a type id), e.g. Surveys → NCR only
let agentsPick = 'all'; // section filter on the Agents page
let flagsPick = 'all';
let flagsFocus = '';   // open the Flags page showing only one flag (e.g. misconduct from Home)

// phone/notes are only stored and shown when login is on and the person is an editor
// Phone numbers, notes and the full raw rows are saved and shown.
function hasContacts(){ return true; }

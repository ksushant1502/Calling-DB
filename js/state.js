// ===== STATE: shared variables + tab list. Add a new tab here. =====
// ===================== STATE =====================
function safeGet(key){ try{ return localStorage.getItem(key); }catch(e){ return null; } }
function safeSet(key,val){ try{ localStorage.setItem(key,val); }catch(e){} }

let session=null, canWrite=false;
let range = {start:startOfMonth(todayStr()), end:todayStr(), label:'This Month'};
let typeFilter = 'all';
let activeTab = 'overview';
let dayDocs=[], conversionDocs=[];
let rowsCache={};
let convRowsCache={};
let charts={};

const ICONS = {
  overview:'<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  campaigns:'<svg viewBox="0 0 24 24"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  agents:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.5a5 5 0 0 1 4.5 5.5"/></svg>',
  insights:'<svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11h7M8.5 14h4"/></svg>',
  flags:'<svg viewBox="0 0 24 24"><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></svg>',
  conversion:'<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
  uploads:'<svg viewBox="0 0 24 24"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>',
};
// Sidebar pages, in order. To add a page: add it here, create js/tab-<name>.js, add a case in js/router.js.
const TABS = [
  {id:'overview',   label:'Overview',       title:'Overview'},
  {id:'campaigns',  label:'Campaign Types', title:'Campaign Types'},
  {id:'agents',     label:'Agents',         title:'Agent Performance'},
  {id:'insights',   label:'Insights & VoC', title:'Insights & Voice of Customer'},
  {id:'flags',      label:'Flags',          title:'Call Flags'},
  {id:'conversion', label:'Conversions',    title:'Conversions'},
  {id:'uploads',    label:'Upload Status',  title:'Upload Status'},
];

// phone/notes are only stored and shown when login is on and the person is an editor
function hasContacts(){ return REQUIRE_LOGIN && canWrite; }

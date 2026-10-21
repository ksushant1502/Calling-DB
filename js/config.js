// ===== CONFIG: Supabase connection + business constants (LOBs, keywords, agent names, excluded campaigns) =====
// ===================== SUPABASE CONFIG =====================
const SUPABASE_URL = 'https://knnmfgmmlrcetejaktox.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtubm1mZ21tbHJjZXRlamFrdG94Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5ODkxOTcsImV4cCI6MjEwNjU2NTE5N30.tGkJi61ihHHSmgx1GY1yUELwtDrBAZxwK3JYywdg7Fc';
// BUILD MODE: false = anyone with the link can view AND upload (no login). Phone numbers / notes are NOT saved in this mode.
// Set to true once the website is finished and logins are set up (see README, "Turning login on").
const REQUIRE_LOGIN = false;
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== CONSTANTS =====================
const NON_CONNECT = ['call not connected','not applicable','call drop','answering machine','agent-nc','customer-nc','dnd-failure','no-disp','agent-cancelled','switched off','invalid number','wrong number','test call','telephony-failure','missed'];
const LOBS = ['Enterprise','Retention','Instamart','YBP','Experience','NCR Churn Survey','CityOps','Incoming','Other'];
// The campaign types shown across the dashboard (in this order). Each LOB belongs to exactly one type.
const CAMPAIGN_TYPES = [
  {id:'acquisition', label:'New User Acquisition', lobs:['Enterprise','Instamart'], color:'#3b5bfd'},
  {id:'retention',   label:'Retention',            lobs:['Retention','YBP'],        color:'#0f9a94'},
  {id:'survey',      label:'Survey Calling',       lobs:['Experience'],             color:'#c23b78'},
  {id:'ncrchurn',    label:'NCR Festival Churn Survey', lobs:['NCR Churn Survey'], color:'#8a4fd8'},
  {id:'city',        label:'City Calling',         lobs:['CityOps'],                color:'#d98a0b'},
  {id:'incoming',    label:'Incoming Customer Calls', lobs:['Incoming'],        color:'#5a6bd8'},
  {id:'other',       label:'Other',                lobs:['Other'],                  color:'#7a8499'},
];
function campaignTypeOf(lob){ return (CAMPAIGN_TYPES.find(t=>t.lobs.includes(lob)) || CAMPAIGN_TYPES[CAMPAIGN_TYPES.length-1]); }
// The 24 core callers (new user acquisition + survey + retention). Paste their display names here, e.g. ['Anjali Maury','Divya Mishra', ...].
// While this list is empty, every agent is shown.
const CORE_CALLERS = [];
const LOB_CLASS = {Incoming:'type-other',Enterprise:'type-ent',Retention:'type-ret',Instamart:'type-im',YBP:'type-ybp',Experience:'type-exp','NCR Churn Survey':'type-exp',CityOps:'type-other',Other:'type-other'};
const CITIES = ['Bangalore','Mumbai','NCR'];
const MISCONDUCT_KEYWORDS = ['abuse','abusive','threat','rude','misbehav','swear','harass','shout','argu'];
const CALLBACK_KEYWORDS = ['callback','call back','follow up','followup'];
const HOT_KEYWORDS = ['interested','intrested','converted','hot lead','ready to buy','wants to','will purchase','hot convert'];
const NEGATION_RE = /\b(not|no|never|isn't|wasn't|won't|don't|doesn't|didn't|n't)\b\s*(\w+\s+){0,2}$/;
function keywordHit(texts, keywords){
  for(const text of texts){
    if(!text) continue;
    for(const kw of keywords){
      let idx = text.indexOf(kw);
      while(idx !== -1){
        const before = text.slice(Math.max(0, idx-25), idx);
        if(!NEGATION_RE.test(before)) return true;
        idx = text.indexOf(kw, idx+1);
      }
    }
  }
  return false;
}
const AGENT_NAME_MAP = {
  'anchal.m':'Anchal Mishra','anjali':'Anjali Maury','aparna':'Aparna Mishra','arti.b':'Arti Bhalavi',
  'darshani':'Darshani Ghodmare','divya.m':'Divya Mishra','jagdeesh':'Jagdeesh Prasad','kalyani.s':'Kalyani Shukla',
  'karishma':'Karishma Mansuri','manish':'Manish Kumar','manish.kumar':'Manish Kumar','pankaj':'Pankaj Baghel',
  'priyanka.p':'Priyanka Pal','rajneesh':'Rajneesh Tiwari','rohit':'Rohit Kumar','sushma.s':'Sushma Sahare',
  'tamanna':'Tamanna Dhurve','kiran':'Kiran K','meenakshi':'Meenakshi Singh','puja':'Puja p','shikha.y':'Shikha Yadav',
  'sushma':'Sushma D','chandani':'Chandani Bano','vikas':'Vikas Agnihotri','krishna':'Krishna RS',
  'jitendra.mishra':'Jitendra Mishra','kratika.shukla':'Kratika Shukla','rajkumar':'Rajkumar'
};
const EXCLUDED_CAMPAIGNS = new Set(['B2B BLR','D2 Extension V1','OYC Pan India Q1','Payment failure Pan India 1','Retention calling V1 Q July','Soft Churn Pan India V1']);
// RSA (customer-support desk) agents — their calls are never saved. Login names, lower-case.
const RSA_AGENTS = new Set(['nishi.m','devraj','joy deb','muskan','rajkamal','mubasheer','kashish','manish','nisha','tanmoy','sashivusan','rohit shekhar','ravindra']);
// Callers who answer the city incoming lines (from the ops sheet). Their calls on the "Incoming Calls" campaign ARE counted,
// tagged with the city of their line. Anyone else on "Incoming Calls" is the RSA desk and is dropped.
const INCOMING_CALLERS = {
  'biswajite':'Bangalore','maghnath':'Bangalore','dhananjai':'Bangalore',   // BLR line  8047169730
  'naved':'Mumbai','sahil':'Mumbai',                                         // BOM line  8047169765
  'pawan':'NCR','ankitsingh':'NCR','rajni':'NCR'                             // DEL-NCR   8047169768
};
const INCOMING_CAMPAIGN = 'Incoming Calls';
function isRsaAgent(name){ return RSA_AGENTS.has(String(name||'').trim().toLowerCase()); }
// Any call handled as RSA (disposition or form mentions RSA) is dropped, even on a normal campaign.
function isRsaRow(row){ return /rsa/i.test(String(row['Disposition']||'')) || /rsa/i.test(String(row['Form_Header']||'')); }
// These names are only excluded from the CAMPAIGN report; in the QUEUE report they are the Retention queues and are kept.
function isExcludedCampaign(name, source){
  const n=String(name||'').trim();
  if(!EXCLUDED_CAMPAIGNS.has(n)) return false;
  return !(source==='queue' && QUEUE_NAMES.has(n));   // the retention queues are only kept for queue reports / conversions
}

// Campaign -> [LOB, city]. city: '' = none, null = take from Custom_Field_1 city code (BLR/DEL/GGN/NOI), 'RAW' = Custom_Field_1 is the city name.
const CAMPAIGN_MAP = {
  // ---- Retention QUEUES (city comes from Custom_Field_1; Payment failure has no city in the file) ----
  "Retention calling V1 Q July": ["Retention",null],
  "Soft Churn Pan India V1": ["Retention",null],
  "OYC Pan India Q1": ["Retention",null],
  "D2 Extension V1": ["Retention",null],
  "Payment failure Pan India 1": ["Retention",""],
  "Instamart WA Attached Token Leads": ["Instamart",""],
  "Instamart Enterprise Leads": ["Instamart",""],
  "Swiggy Merch Manual Campaign NEW MAY 2026": ["Enterprise",""],
  "Swiggy SSU Manual Campaign NEW MAY 2026": ["Enterprise",""],
  "Swiggy Not Connected Leads Reassigned Campaign 17092026": ["Enterprise",""],
  "Blinkit Leads Sep 2026": ["Enterprise",""],
  "Zomato Leads Sep 2026": ["Enterprise",""],
  "Instamart WA Enquiry manual campaign": ["Instamart",""],
  "IM Enterprise August2026": ["Instamart",""],
  "Post Purchase Instamart Calling Leads Updated": ["Instamart",""],
  "Cancelled Bike Swap Tokenunfulfilled automated": ["CityOps",""],
  "Central Team customer feedback Rating Leads automated": ["Experience",""],
  "NCR festival Churn calling": ["NCR Churn Survey","NCR"],
  "NCR festival Churn calling RS": ["NCR Churn Survey","NCR"],
  "NCR festival Churn calling RS Updated": ["NCR Churn Survey",null],
  "NCR Festive churn Second Time 29 Sep": ["NCR Churn Survey",null],
  "NCR Festive churn Third time V3 07 Oct": ["NCR Churn Survey",null],
  "NCR Festive churn Fourth time V4 13 Oct": ["NCR Churn Survey",null],
  "NCR Festive churn Fifth time V5 16 Oct": ["NCR Churn Survey",null],
  "NCR Festive churn Fifth time V5 16 Oct Updated": ["NCR Churn Survey",null],
  "Zomato Leads Oct 2026": ["Enterprise",""],
  "Blinkit Leads Oct 2026": ["Enterprise",""],
  "Unit pricing Survey  BLR": ["Experience",""],
  "Unit pricing Survey BLR": ["Experience",""],
  "FB BLR and DEL Live Manual campaign Updated": ["Enterprise",null],
  "BLR pending users automated": ["CityOps","Bangalore"],
  "BLR unserved users automated": ["CityOps","Bangalore"],
  "Promoter channel Not using Yulu": ["Retention",""],
  "KYC Rejected Central calling": ["Other",""],
  "Soft Churn Renewal calling D1 Pan India New Updated": ["Retention",""],
  "BOM Cluster level calling user cohort automated": ["CityOps","Mumbai"],
  "Soft churn not connected  Updated": ["Retention",""],
  "Custom Dials": ["Other",""],
  "instamart Merchant Store Leads": ["Instamart",""],
  "Grab Leads Manual campaign 08092026": ["Enterprise","RAW"],
  "Instamart No vehicle Eligible Leads": ["Instamart",""],
  "Retention Pending": ["Retention",""],
  "D2 Extension Latest": ["Retention",""],
};
const CITY_CODE = {BLR:'Bangalore',DEL:'NCR',GGN:'NCR',NOI:'NCR',HYD:'Hyderabad',BOM:'Mumbai',CCU:'Kolkata'};

// Two kinds of dialer report. Enterprise / Survey / City calls are made through CAMPAIGNS ("calls");
// Retention calls are made through QUEUES ("queue"). Each kind is stored in its own tables so a queue
// upload never overwrites a campaign upload for the same date.
const SOURCES = {
  calls:{ days:'days',       rows:'day_rows',       label:'Campaign report' },
  queue:{ days:'queue_days', rows:'queue_day_rows', label:'Queue report (Retention)' }
};
// Retention queues (names as they appear in the Queue_Name column)
const QUEUE_NAMES = new Set(['Retention calling V1 Q July','Soft Churn Pan India V1','OYC Pan India Q1','D2 Extension V1','Payment failure Pan India 1']);
// Campaigns that are re-launched every month are shown as ONE campaign. Add a line here to merge more.
// The raw name stays in the database; the merge happens when the dashboard shows the data (so old and new uploads match).
const CAMPAIGN_MERGE = [
  { match:/^\s*blinkit\s+leads\b/i, name:'Blinkit Leads', lob:'Enterprise' },
  { match:/^\s*zomato\s+leads\b/i,  name:'Zomato Leads',  lob:'Enterprise' },
];
// Campaigns that stay separate but belong to their own section ("NCR Festival Churn Survey"), whatever type they were uploaded with.
const LOB_RULES = [
  { match:/^\s*ncr\s+festi(val|ve)\s+churn/i, lob:'NCR Churn Survey', city:'NCR' },
];
// In these sections the same customer is called many times. The dashboard counts ONE row per phone number:
// connected beats not connected (then longest talk time, then latest call). Only for these sections a scrambled
// (hashed) phone key is stored, never the number itself.
const DEDUPE_LOBS = ['NCR Churn Survey'];
const PHONE_KEY_SALT = 'yulu-telecalling-2026';
function isDedupeCampaign(name){ return DEDUPE_LOBS.includes(canonLob(name, null)); }
function canonLob(name, lob){
  const r = LOB_RULES.find(x=>x.match.test(String(name||'')));
  if(r) return r.lob;
  const m = CAMPAIGN_MERGE.find(x=>x.match.test(String(name||'')));
  return m && m.lob ? m.lob : lob;
}
function canonCampaign(name){
  const n = String(name||'');
  const m = CAMPAIGN_MERGE.find(x=>x.match.test(n));
  return m ? m.name : name;
}
function lookupLobCity(campaign, customField1){
  let e = CAMPAIGN_MAP[campaign];
  if(!e){ const m = CAMPAIGN_MERGE.find(x=>x.match.test(String(campaign||''))); if(m) e = [m.lob, m.city||'']; }   // new months of a merged campaign need no config change
  if(!e){ const r = LOB_RULES.find(x=>x.match.test(String(campaign||''))); if(r) e = [r.lob, r.city||'']; }
  if(!e) return null;
  let [lob, city] = e;
  if(city===null) city = CITY_CODE[String(customField1||'').trim()] || '';
  else if(city==='RAW') city = String(customField1||'').trim();
  return {lob, city};
}

import{useState,useEffect,useCallback,useRef,memo}from"react";

// ── CONFIG SUPABASE ───────────────────────────────────────────────────────────
const SUPA_URL="https://khjljfeknwwktfjjznhp.supabase.co";
const SUPA_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoamxqZmVrbnd3a3Rmamp6bmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MDg5NjgsImV4cCI6MjEwMjA4NDk2OH0.v4H36n7prn6hVwT90nWF3yW-cxyzvmmFbW5EgH6bZX4";

const H={
  "Content-Type":"application/json",
  "apikey":SUPA_KEY,
  "Authorization":"Bearer "+SUPA_KEY,
};

// ── HELPERS ───────────────────────────────────────────────────────────────────
function uuid(){
  return crypto.randomUUID?crypto.randomUUID()
    :"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,c=>{
      const r=Math.random()*16|0;return(c==="x"?r:(r&3|8)).toString(16);
    });
}

function calcProfit(status,stake,odds){
  if(status==="won")return parseFloat((stake*(odds-1)).toFixed(2));
  if(status==="lost")return -parseFloat(stake);
  return 0;
}

function nowDT(){
  const d=new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+
    String(d.getDate()).padStart(2,"0")+"T"+
    String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
}

// ── API SUPABASE ──────────────────────────────────────────────────────────────
async function fetchBets(){
  const r=await fetch(SUPA_URL+"/rest/v1/bets?select=*&order=created_at.desc",{headers:H});
  if(!r.ok)throw new Error("fetch bets: "+r.status);
  return r.json();
}

async function insertBet(bet){
  const r=await fetch(SUPA_URL+"/rest/v1/bets",{
    method:"POST",
    headers:{...H,"Prefer":"return=representation"},
    body:JSON.stringify(bet),
  });
  if(!r.ok)throw new Error("insert: "+r.status);
  return r.json();
}

async function updateBet(id,fields){
  const r=await fetch(SUPA_URL+"/rest/v1/bets?id=eq."+id,{
    method:"PATCH",
    headers:{...H,"Prefer":"return=representation"},
    body:JSON.stringify({...fields,updated_at:new Date().toISOString()}),
  });
  if(!r.ok)throw new Error("update: "+r.status);
  return r.json();
}

async function deleteBet(id){
  const r=await fetch(SUPA_URL+"/rest/v1/bets?id=eq."+id,{method:"DELETE",headers:H});
  if(!r.ok)throw new Error("delete: "+r.status);
}


// ── BOOKMAKERS API ────────────────────────────────────────────────────────────
async function fetchBookmakers(){
  const r=await fetch(SUPA_URL+"/rest/v1/bookmakers?select=*&order=name.asc",{headers:H});
  if(!r.ok)throw new Error("fetch bookmakers: "+r.status);
  return r.json();
}

async function insertBookmaker(bk){
  const r=await fetch(SUPA_URL+"/rest/v1/bookmakers",{
    method:"POST",
    headers:{...H,"Prefer":"return=representation"},
    body:JSON.stringify(bk),
  });
  if(!r.ok){const e=await r.text();throw new Error(e);}
  return r.json();
}

async function updateBookmaker(id,fields){
  const r=await fetch(SUPA_URL+"/rest/v1/bookmakers?id=eq."+id,{
    method:"PATCH",
    headers:{...H,"Prefer":"return=representation"},
    body:JSON.stringify(fields),
  });
  if(!r.ok)throw new Error("update bookmaker: "+r.status);
  return r.json();
}

async function deleteBookmaker(id){
  const r=await fetch(SUPA_URL+"/rest/v1/bookmakers?id=eq."+id,{method:"DELETE",headers:H});
  if(!r.ok)throw new Error("delete bookmaker: "+r.status);
}

// ── TIPSTERS API ──────────────────────────────────────────────────────────────
async function fetchTipsters(){
  const r=await fetch(SUPA_URL+"/rest/v1/tipsters?select=*&order=name.asc",{headers:H});
  if(!r.ok)throw new Error("fetch tipsters: "+r.status);
  return r.json();
}

async function insertTipster(t){
  const r=await fetch(SUPA_URL+"/rest/v1/tipsters",{
    method:"POST",
    headers:{...H,"Prefer":"return=representation"},
    body:JSON.stringify(t),
  });
  if(!r.ok){const e=await r.text();throw new Error(e);}
  return r.json();
}

async function deleteTipster(id){
  const r=await fetch(SUPA_URL+"/rest/v1/tipsters?id=eq."+id,{method:"DELETE",headers:H});
  if(!r.ok)throw new Error("delete tipster: "+r.status);
}

// ── LEAGUES & CLUBS API ───────────────────────────────────────────────────────
async function fetchLeagues(){
  const r=await fetch(SUPA_URL+"/rest/v1/leagues?select=*&order=name.asc",{headers:H});
  if(!r.ok)throw new Error("fetch leagues: "+r.status);
  return r.json();
}

async function updateLeague(id,fields){
  const r=await fetch(SUPA_URL+"/rest/v1/leagues?id=eq."+id,{
    method:"PATCH",
    headers:{...H,"Prefer":"return=representation"},
    body:JSON.stringify(fields),
  });
  if(!r.ok)throw new Error("update league: "+r.status);
  return r.json();
}

async function fetchClubs(league){
  const url=league
    ?SUPA_URL+"/rest/v1/clubs?league=eq."+encodeURIComponent(league)+"&order=name.asc"
    :SUPA_URL+"/rest/v1/clubs?select=*&order=name.asc";
  const r=await fetch(url,{headers:H});
  if(!r.ok)throw new Error("fetch clubs: "+r.status);
  return r.json();
}

async function upsertClub(name,league,logo){
  const r=await fetch(SUPA_URL+"/rest/v1/clubs",{
    method:"POST",
    headers:{...H,"Prefer":"resolution=merge-duplicates,return=representation"},
    body:JSON.stringify({id:uuid(),name,league,logo}),
  });
  if(!r.ok)throw new Error("upsert club: "+r.status);
  return r.json();
}

async function updatePlayer(id,fields){
  const r=await fetch(SUPA_URL+"/rest/v1/players?id=eq."+id,{
    method:"PATCH",
    headers:{...H,"Prefer":"return=representation"},
    body:JSON.stringify(fields),
  });
  if(!r.ok)throw new Error("update player: "+r.status);
  return r.json();
}

async function fetchPlayersByLeague(league){
  const r=await fetch(
    SUPA_URL+"/rest/v1/players?game=eq."+encodeURIComponent(league)+"&select=*&order=team.asc,name.asc",
    {headers:H}
  );
  if(!r.ok)throw new Error("fetch players: "+r.status);
  return r.json();
}



async function fetchPlayers(){
  let all=[],offset=0,limit=500;
  while(true){
    const r=await fetch(
      SUPA_URL+"/rest/v1/players?select=name,game,team,role,photo_url,avatar_url&order=name.asc&limit="+limit+"&offset="+offset,
      {headers:H}
    );
    if(!r.ok)break;
    const rows=await r.json();
    all=[...all,...rows];
    if(rows.length<limit)break;
    offset+=limit;
  }
  return all;
}

async function pasteImageToSupabase(name){
  const safe=(name||"img").toLowerCase().replace(/[^a-z0-9]/g,"_").slice(0,40);
  async function uploadBlob(blob){
    const ext=blob.type.includes("png")?"png":blob.type.includes("webp")?"webp":"jpg";
    const path="photos/players/"+safe+"_"+Date.now()+"."+ext;
    const res=await fetch(SUPA_URL+"/storage/v1/object/avatars/"+path,{
      method:"POST",
      headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":blob.type,"x-upsert":"true"},
      body:blob,
    });
    if(!res.ok)throw new Error("Upload échoué");
    return SUPA_URL+"/storage/v1/object/public/avatars/"+path;
  }
  let items=[];
  try{items=await navigator.clipboard.read();}catch(e){
    try{
      const text=(await navigator.clipboard.readText()).trim();
      if(text.match(/^https?:\/\//)){
        const r=await fetch(text);
        if(r.ok){const b=await r.blob();return uploadBlob(b);}
      }
    }catch(_){}
    throw new Error("Autorise l'accès au presse-papier dans ton navigateur");
  }
  for(const item of items){
    const t=item.types.find(x=>x.startsWith("image/"));
    if(t){const blob=await item.getType(t);return uploadBlob(blob);}
  }
  for(const item of items){
    if(item.types.includes("text/html")){
      try{
        const html=await(await item.getType("text/html")).text();
        const m=html.match(/src=["']([^"']+)["']/);
        if(m&&m[1]){
          const r=await fetch(m[1]);
          if(r.ok){const b=await r.blob();return uploadBlob(b);}
        }
      }catch(_){}
    }
  }
  throw new Error("Aucune image trouvée — fais clic-droit → Copier l'image");
}

// ── STYLES CSS ────────────────────────────────────────────────────────────────
const CSS=`
*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
body{background:#0B1220;color:#E5E7EB;font-family:Inter,system-ui,sans-serif;min-height:100vh;-webkit-font-smoothing:antialiased;}
input,select,textarea,button{font-family:inherit;}
img{-webkit-backface-visibility:hidden;backface-visibility:hidden;transform:translateZ(0);}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:#1F2937;border-radius:4px;}

.app{max-width:500px;margin:0 auto;min-height:100vh;padding-bottom:80px;}

/* NAV */
.nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:500px;
  background:rgba(11,18,32,.95);backdrop-filter:blur(20px);
  border-top:1px solid #1F2937;display:flex;z-index:100;
  padding-bottom:env(safe-area-inset-bottom);}
.nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;
  padding:10px 0;border:none;background:transparent;color:#6B7280;
  font-size:10px;font-weight:600;cursor:pointer;letter-spacing:.5px;transition:color .15s;}
.nav-btn.active{color:#A78BFA;}
.nav-icon{font-size:20px;line-height:1;}
.nav-add{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#3B82F6);
  border:none;color:#fff;font-size:28px;cursor:pointer;display:flex;align-items:center;
  justify-content:center;box-shadow:0 4px 20px rgba(124,58,237,.5);margin-top:-20px;transition:transform .1s;}
.nav-add:active{transform:scale(.93);}

/* CARDS */
.card{background:#111827;border:1px solid #1F2937;border-radius:16px;padding:16px;margin-bottom:12px;}
.card-sm{background:#111827;border:1px solid #1F2937;border-radius:12px;padding:12px;margin-bottom:10px;}

/* STATUS BADGE */
.badge{display:inline-flex;align-items:center;gap:4px;border-radius:20px;
  padding:3px 10px;font-size:11px;font-weight:700;letter-spacing:.3px;}
.badge-won{background:rgba(34,197,94,.12);color:#22C55E;}
.badge-lost{background:rgba(239,68,68,.12);color:#EF4444;}
.badge-pending{background:rgba(245,158,11,.12);color:#F59E0B;}
.badge-void{background:rgba(107,114,128,.12);color:#9CA3AF;}

/* FORM */
.form-group{margin-bottom:14px;}
.form-label{font-size:11px;font-weight:700;color:#6B7280;text-transform:uppercase;
  letter-spacing:.8px;margin-bottom:6px;display:block;}
.form-input{width:100%;background:rgba(255,255,255,.04);border:1px solid #1F2937;
  border-radius:10px;padding:11px 14px;color:#E5E7EB;font-size:14px;outline:none;
  transition:border-color .15s;}
.form-input:focus{border-color:#7C3AED;}
.form-select{width:100%;background:rgba(255,255,255,.04);border:1px solid #1F2937;
  border-radius:10px;padding:11px 14px;color:#E5E7EB;font-size:14px;outline:none;
  appearance:none;-webkit-appearance:none;cursor:pointer;}
.form-select:focus{border-color:#7C3AED;}

/* BUTTONS */
.btn{border:none;border-radius:10px;padding:12px 20px;font-size:14px;font-weight:700;
  cursor:pointer;transition:opacity .15s;width:100%;}
.btn:active{opacity:.75;}
.btn-primary{background:linear-gradient(135deg,#7C3AED,#3B82F6);color:#fff;}
.btn-secondary{background:rgba(255,255,255,.06);color:#9CA3AF;border:1px solid #1F2937;}
.btn-danger{background:rgba(239,68,68,.1);color:#EF4444;border:1px solid rgba(239,68,68,.2);}
.btn-sm{padding:7px 14px;font-size:12px;border-radius:8px;}

/* PLAYER AUTOCOMPLETE */
.autocomplete{position:relative;}
.autocomplete-list{position:absolute;top:calc(100% + 4px);left:0;right:0;
  background:#111827;border:1px solid #1F2937;border-radius:12px;
  max-height:240px;overflow-y:auto;z-index:200;box-shadow:0 8px 30px rgba(0,0,0,.5);}
.autocomplete-item{display:flex;align-items:center;gap:10px;padding:10px 12px;
  cursor:pointer;transition:background .1s;}
.autocomplete-item:hover,.autocomplete-item.active{background:rgba(124,58,237,.1);}
.player-photo{width:36px;height:36px;border-radius:50%;object-fit:cover;
  object-position:50% 10%;background:#1F2937;flex-shrink:0;}
.player-name{font-size:13px;font-weight:600;color:#E5E7EB;}
.player-meta{font-size:11px;color:#6B7280;}

/* BET ROW */
.bet-row{display:flex;align-items:center;gap:12px;padding:14px;
  background:#111827;border:1px solid #1F2937;border-radius:14px;margin-bottom:8px;
  cursor:pointer;transition:border-color .15s;}
.bet-row:hover{border-color:#374151;}
.bet-photo{width:44px;height:44px;border-radius:50%;object-fit:cover;
  object-position:50% 10%;background:#1F2937;flex-shrink:0;}
.bet-photo-placeholder{width:44px;height:44px;border-radius:50%;background:#1F2937;
  display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
.bet-info{flex:1;min-width:0;}
.bet-player{font-size:14px;font-weight:700;color:#E5E7EB;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bet-desc{font-size:12px;color:#9CA3AF;margin-top:2px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bet-right{text-align:right;flex-shrink:0;}
.bet-profit{font-size:15px;font-weight:800;}
.bet-profit.pos{color:#22C55E;}
.bet-profit.neg{color:#EF4444;}
.bet-profit.neu{color:#9CA3AF;}
.bet-odds{font-size:11px;color:#6B7280;margin-top:2px;}

/* STATUS QUICK CHANGE */
.status-row{display:flex;gap:8px;margin-top:12px;}
.status-btn{flex:1;padding:9px;border-radius:9px;border:1.5px solid transparent;
  font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;background:transparent;}
.status-btn.won{border-color:rgba(34,197,94,.3);color:#22C55E;}
.status-btn.won.active{background:rgba(34,197,94,.15);border-color:#22C55E;}
.status-btn.lost{border-color:rgba(239,68,68,.3);color:#EF4444;}
.status-btn.lost.active{background:rgba(239,68,68,.15);border-color:#EF4444;}
.status-btn.pending{border-color:rgba(245,158,11,.3);color:#F59E0B;}
.status-btn.pending.active{background:rgba(245,158,11,.15);border-color:#F59E0B;}
.status-btn.void{border-color:rgba(107,114,128,.3);color:#9CA3AF;}
.status-btn.void.active{background:rgba(107,114,128,.15);border-color:#9CA3AF;}

/* STATS GRID */
.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;}
.stat-card{background:#111827;border:1px solid #1F2937;border-radius:14px;padding:14px;}
.stat-value{font-size:22px;font-weight:800;margin-bottom:2px;}
.stat-label{font-size:11px;color:#6B7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px;}

/* TOAST */
.toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);
  background:#1F2937;border:1px solid #374151;border-radius:12px;
  padding:10px 20px;font-size:13px;font-weight:600;color:#E5E7EB;
  z-index:999;pointer-events:none;white-space:nowrap;
  box-shadow:0 4px 20px rgba(0,0,0,.5);}

/* MODAL */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);
  backdrop-filter:blur(4px);z-index:300;display:flex;align-items:flex-end;}
.modal-sheet{background:#0F1629;border-radius:20px 20px 0 0;
  width:100%;max-height:92vh;overflow-y:auto;
  padding:20px 16px calc(20px + env(safe-area-inset-bottom));
  border-top:1px solid #1F2937;}
.modal-handle{width:40px;height:4px;background:#374151;border-radius:2px;
  margin:0 auto 20px;}
.modal-title{font-size:17px;font-weight:800;color:#E5E7EB;margin-bottom:20px;}

/* TABS */
.tabs{display:flex;gap:4px;background:#0F1629;border-radius:12px;padding:4px;margin-bottom:16px;}
.tab{flex:1;padding:8px;border:none;background:transparent;color:#6B7280;
  font-size:12px;font-weight:700;border-radius:9px;cursor:pointer;transition:all .15s;}
.tab.active{background:#1F2937;color:#E5E7EB;}

/* SEGMENT */
.segment{display:flex;background:rgba(255,255,255,.04);border-radius:10px;padding:3px;gap:3px;}
.seg-btn{flex:1;padding:8px;border:none;background:transparent;
  color:#6B7280;font-size:13px;font-weight:600;border-radius:8px;cursor:pointer;}
.seg-btn.active{background:#7C3AED;color:#fff;}

/* SETTINGS */
.bk-card{display:flex;align-items:center;gap:12px;padding:14px;
  background:#111827;border:1px solid #1F2937;border-radius:14px;margin-bottom:8px;}
.bk-logo{width:44px;height:44px;border-radius:10px;object-fit:contain;
  background:#1F2937;padding:4px;flex-shrink:0;}
.bk-logo-placeholder{width:44px;height:44px;border-radius:10px;background:#1F2937;
  display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
.bk-name{font-size:14px;font-weight:700;color:#E5E7EB;}
.bk-actions{display:flex;gap:6px;margin-left:auto;}
.icon-btn{width:32px;height:32px;border-radius:8px;border:1px solid #1F2937;
  background:transparent;color:#6B7280;cursor:pointer;font-size:15px;
  display:flex;align-items:center;justify-content:center;transition:all .15s;}
.icon-btn:hover{border-color:#374151;color:#E5E7EB;}
.icon-btn.danger:hover{border-color:rgba(239,68,68,.4);color:#EF4444;background:rgba(239,68,68,.05);}

/* HEADER */
.header{padding:16px 16px 0;display:flex;align-items:center;justify-content:space-between;}
.header-title{font-size:22px;font-weight:900;color:#E5E7EB;letter-spacing:-.5px;}

/* PROFIT BIG */
.profit-big{font-size:42px;font-weight:900;letter-spacing:-2px;line-height:1;}
.profit-big.pos{color:#22C55E;}
.profit-big.neg{color:#EF4444;}
.profit-big.neu{color:#E5E7EB;}

/* EMPTY */
.empty{text-align:center;padding:48px 20px;color:#6B7280;}
.empty-icon{font-size:40px;margin-bottom:12px;}
.empty-text{font-size:15px;font-weight:600;}
.empty-sub{font-size:13px;margin-top:6px;color:#4B5563;}

/* FILTERS */
.filter-row{display:flex;gap:8px;overflow-x:auto;padding:0 16px 12px;
  scrollbar-width:none;-ms-overflow-style:none;}
.filter-row::-webkit-scrollbar{display:none;}
.filter-chip{flex-shrink:0;padding:6px 14px;border-radius:20px;border:1px solid #1F2937;
  background:transparent;color:#9CA3AF;font-size:12px;font-weight:600;
  cursor:pointer;white-space:nowrap;transition:all .15s;}
.filter-chip.active{background:rgba(124,58,237,.15);border-color:#7C3AED;color:#A78BFA;}
`;

// ── BOOKMAKERS ────────────────────────────────────────────────────────────────
const DEFAULT_BOOKMAKERS=["Pinnacle","ps3838","Bet365","Unibet","Winamax","Betclic","Bwin","1xBet","Betway","DraftKings","FanDuel","BetMGM","Autre"];
const STATS_TYPES=["Points","Rebonds","Assists","Points+Rebonds","Points+Assists","Points+Rebonds+Assists","3 Points Made","Steals","Blocks","Turnovers","Fantasy Score","Double-Double","Minutes"];
const LEAGUES=["NBA","EuroLeague","EuroCup","Pro A","ACB","Lega","Bundesliga","BCL","HEBA"];

// ── COMPOSANTS ────────────────────────────────────────────────────────────────

// Toast
function useToast(){
  const[toast,setToast]=useState(null);
  const show=useCallback((msg,color="#22C55E")=>{
    setToast({msg,color});
    setTimeout(()=>setToast(null),2500);
  },[]);
  return{toast,show};
}

// Photo joueur avec lazy loading

// ── Logos ligues (ESPN/CDN) ───────────────────────────────────────────────────
// LEAGUE_LOGOS est maintenant dynamique — merge Supabase + fallback
// Mis à jour depuis l'App via setLeagueLogos
let LEAGUE_LOGOS_DYNAMIC={};
function getLeagueLogo(game,leagueLogos={}){
  // Priorité 1: logo uploadé dans Supabase (via Édition)
  if(leagueLogos[game])return leagueLogos[game];
  // Priorité 2: logo dynamique global
  if(LEAGUE_LOGOS_DYNAMIC[game])return LEAGUE_LOGOS_DYNAMIC[game];
  return null;
}
// Garder LEAGUE_LOGOS pour compatibilité (sera mergé avec Supabase)
const LEAGUE_LOGOS={};



// ── Couleurs équipes ──────────────────────────────────────────────────────────
const TEAM_COLORS={
  "Atlanta Hawks":{p:"#C8102E",s:"#FDB927"},
  "Boston Celtics":{p:"#007A33",s:"#BA9653"},
  "Brooklyn Nets":{p:"#000000",s:"#FFFFFF"},
  "Charlotte Hornets":{p:"#1D1160",s:"#00788C"},
  "Chicago Bulls":{p:"#CE1141",s:"#000000"},
  "Cleveland Cavaliers":{p:"#860038",s:"#FDBB30"},
  "Dallas Mavericks":{p:"#00538C",s:"#002B5E"},
  "Denver Nuggets":{p:"#0E2240",s:"#FEC524"},
  "Detroit Pistons":{p:"#C8102E",s:"#1D42BA"},
  "Golden State Warriors":{p:"#1D428A",s:"#FFC72C"},
  "Houston Rockets":{p:"#CE1141",s:"#000000"},
  "Indiana Pacers":{p:"#002D62",s:"#FDBB30"},
  "LA Clippers":{p:"#C8102E",s:"#1D428A"},
  "Los Angeles Lakers":{p:"#552583",s:"#FDB927"},
  "Memphis Grizzlies":{p:"#5D76A9",s:"#12173F"},
  "Miami Heat":{p:"#98002E",s:"#F9A01B"},
  "Milwaukee Bucks":{p:"#00471B",s:"#EEE1C6"},
  "Minnesota Timberwolves":{p:"#0C2340",s:"#236192"},
  "New Orleans Pelicans":{p:"#0C2340",s:"#C8102E"},
  "New York Knicks":{p:"#006BB6",s:"#F58426"},
  "Oklahoma City Thunder":{p:"#007AC1",s:"#EF3B24"},
  "Orlando Magic":{p:"#0077C0",s:"#C4CED4"},
  "Philadelphia 76ers":{p:"#006BB6",s:"#ED174C"},
  "Phoenix Suns":{p:"#1D1160",s:"#E56020"},
  "Portland Trail Blazers":{p:"#E03A3E",s:"#000000"},
  "Sacramento Kings":{p:"#5A2D81",s:"#63727A"},
  "San Antonio Spurs":{p:"#C4CED4",s:"#000000"},
  "Toronto Raptors":{p:"#CE1141",s:"#000000"},
  "Utah Jazz":{p:"#002B5C",s:"#00471B"},
  "Washington Wizards":{p:"#002B5C",s:"#E31837"},
  "Olimpia Milano":{p:"#CC0000",s:"#000000"},
  "Virtus Bologna":{p:"#000000",s:"#FFFFFF"},
  "FC Barcelona":{p:"#A50044",s:"#004D98"},
  "Real Madrid":{p:"#FEBE10",s:"#FFFFFF"},
  "LDLC ASVEL":{p:"#002F6C",s:"#E63329"},
  "Paris Basketball":{p:"#0055A4",s:"#EF4135"},
  "Panathinaikos AKTOR":{p:"#00703C",s:"#FFFFFF"},
  "Olympiacos":{p:"#CC0000",s:"#FFFFFF"},
  "Fenerbahce Tarfin":{p:"#004A97",s:"#FFCC00"},
  "Bayern Munchen":{p:"#DC052D",s:"#0066B2"},
  "Partizan Mozzart Bet":{p:"#000000",s:"#FFFFFF"},
  "Maccabi Rapyd Tel Aviv":{p:"#FFCC00",s:"#007A33"},
  "Zalgiris":{p:"#006400",s:"#FFFFFF"},
  "Anadolu Efes":{p:"#002B5C",s:"#C8A84B"},
  "Kosner Baskonia":{p:"#0055A4",s:"#FF0000"},
  "Hapoel IBI Tel Aviv":{p:"#CC0000",s:"#FFFFFF"},
  "Besiktas Gain":{p:"#000000",s:"#FFFFFF"},
  "Valencia Basket":{p:"#000000",s:"#FF6600"},
  "Dubai Basketball":{p:"#004F9F",s:"#C9A84C"},
  "Crvena Zvezda Meridianbet Belgrade":{p:"#CC0000",s:"#FFFFFF"},
};

// Helper: obtenir couleur équipe
function getTeamColor(team){
  if(!team)return null;
  return TEAM_COLORS[team]||null;
}

// Composant carte joueur pro (format vertical avec couleur équipe)
const PlayerCard=memo(function PlayerCard({player,size=72,onClick,onPhotoClick,uploading=false}){
  const photo=player.photo_url||player.avatar_url;
  const tc=getTeamColor(player.team);
  const primaryColor=tc?.p||"#1F2937";
  const secondaryColor=tc?.s||"#374151";
  const displayName=player.name.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(" ");

  const photoW=Math.round(size*1.37);
  return(
    <div onClick={onClick}
      style={{display:"flex",alignItems:"center",gap:12,
        padding:"8px 12px",
        background:"#0A0F1E",
        border:"1px solid rgba(255,255,255,.05)",
        borderRadius:16,marginBottom:6,cursor:"pointer",
        position:"relative",overflow:"hidden",
        transition:"border-color .15s"}}>

      {/* Bande couleur équipe à gauche */}
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,
        background:`linear-gradient(180deg,${primaryColor},${secondaryColor})`}}/>

      {/* Photo format ESPN avec logo club en arrière-plan */}
      <div style={{
        width:photoW,height:size,flexShrink:0,
        background:`linear-gradient(180deg,transparent,${primaryColor}28)`,
        display:"flex",alignItems:"flex-end",justifyContent:"center",
        position:"relative",overflow:"hidden",
        borderRadius:10}}>
        {/* Logo club en watermark */}
        {player.team_logo_url&&(
          <img src={player.team_logo_url} alt=""
            style={{position:"absolute",right:-4,bottom:-4,
              width:size*0.7,height:size*0.7,
              objectFit:"contain",opacity:.12,
              filter:"grayscale(30%)"}}/>
        )}
        {photo?(
          <img src={photo} alt={displayName} loading="lazy" decoding="async"
            style={{width:photoW,height:size,
              objectFit:"contain",objectPosition:"50% 85%",
              WebkitBackfaceVisibility:"hidden",
              transform:"translateZ(0)",position:"relative",zIndex:1}}
            onError={e=>{e.target.style.display="none";}}/>
        ):(
          <span style={{fontSize:size*0.5,paddingBottom:4,position:"relative",zIndex:1,color:"#4B5563"}}>○</span>
        )}
      </div>

      {/* Infos */}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:700,color:"#F3F4F6",
          whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
          letterSpacing:.1}}>{displayName}</div>
        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
          {player.role&&<span style={{
            fontSize:10,fontWeight:800,color:primaryColor==="|#FFFFFF"?"#A78BFA":primaryColor,
            background:`${primaryColor}22`,
            border:`1px solid ${primaryColor}44`,
            borderRadius:5,padding:"1px 6px",letterSpacing:.5}}>{player.role}</span>}
          {player.game&&getLeagueLogo(player.game)&&(
            <img src={getLeagueLogo(player.game)} alt={player.game}
              style={{width:14,height:14,objectFit:"contain",opacity:.85}}/>
          )}
          {player.game&&!getLeagueLogo(player.game)&&(
            <span style={{fontSize:10,color:"#6B7280"}}>{player.game}</span>
          )}
        </div>
      </div>

      {/* Bouton photo */}
      {onPhotoClick&&(
        <button disabled={uploading}
          onClick={e=>{e.stopPropagation();onPhotoClick();}}
          style={{flexShrink:0,width:32,height:32,borderRadius:9,
            border:"1px solid rgba(255,255,255,.08)",background:"transparent",
            color:"#6B7280",cursor:"pointer",fontSize:15,
            display:"flex",alignItems:"center",justifyContent:"center"}}>
          {uploading?"...":"⊕"}
        </button>
      )}
    </div>
  );
});


const PlayerPhoto=memo(function PlayerPhoto({url,size=44,style={}}){
  const[err,setErr]=useState(false);
  // Format ESPN: ratio 70x51 = ~1.37
  const w=Math.round(size*1.37);
  const h=size;
  if(!url||err)return(
    <div style={{width:w,height:h,flexShrink:0,
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:h*0.5,...style}}>○</div>
  );
  return(
    <img src={url} alt="" loading="lazy" decoding="async"
      onError={()=>setErr(true)}
      style={{
        width:w,height:h,
        objectFit:"contain",
        objectPosition:"50% 100%",
        flexShrink:0,
        WebkitBackfaceVisibility:"hidden",
        backfaceVisibility:"hidden",
        transform:"translateZ(0)",
        ...style
      }}/>
  );
});

// Autocomplete joueur
function PlayerAutocomplete({value,onChange,players,onSelect}){
  const[open,setOpen]=useState(false);
  const[idx,setIdx]=useState(0);
  const ref=useRef(null);

  const filtered=value.length>=1
    ?players.filter(p=>p.name.toLowerCase().includes(value.toLowerCase())).slice(0,8)
    :[];

  useEffect(()=>{
    function handler(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}
    document.addEventListener("mousedown",handler);
    return()=>document.removeEventListener("mousedown",handler);
  },[]);

  function handleKey(e){
    if(!open||!filtered.length)return;
    if(e.key==="ArrowDown"){e.preventDefault();setIdx(i=>Math.min(i+1,filtered.length-1));}
    if(e.key==="ArrowUp"){e.preventDefault();setIdx(i=>Math.max(i-1,0));}
    if(e.key==="Enter"){e.preventDefault();onSelect(filtered[idx]);setOpen(false);}
    if(e.key==="Escape")setOpen(false);
  }

  return(
    <div className="autocomplete" ref={ref}>
      <input className="form-input" placeholder="Nom du joueur…" value={value}
        onChange={e=>{onChange(e.target.value);setOpen(true);setIdx(0);}}
        onFocus={()=>setOpen(true)}
        onKeyDown={handleKey}
        autoComplete="off"/>
      {open&&filtered.length>0&&(
        <div className="autocomplete-list">
          {filtered.map((p,i)=>(
            <div key={p.name} className={"autocomplete-item"+(i===idx?" active":"")}
              onMouseDown={()=>{onSelect(p);setOpen(false);}}>
              <PlayerPhoto url={p.photo_url||p.avatar_url} size={36}/>
              <div>
                <div className="player-name">{p.name}</div>
                <div className="player-meta" style={{display:"flex",alignItems:"center",gap:4}}>
                  {p.team&&<span>{p.team}</span>}
                  {p.game&&getLeagueLogo(p.game)&&(
                    <img src={getLeagueLogo(p.game)} alt={p.game}
                      style={{width:12,height:12,objectFit:"contain",opacity:.8}}/>
                  )}
                  {p.game&&!getLeagueLogo(p.game)&&<span>· {p.game}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── FORMULAIRE PARI ÉQUIPE ────────────────────────────────────────────────────
const TEAM_BET_TYPES=[
  {key:"moneyline", label:"Moneyline", desc:"Équipe X gagne"},
  {key:"handicap",  label:"Handicap",  desc:"Équipe X -/+ points"},
  {key:"total",     label:"Total match",desc:"Over/Under total du match"},
  {key:"team_total",label:"Total équipe",desc:"Over/Under points d'une équipe"},
  {key:"half",      label:"Mi-temps",   desc:"Over/Under 1ère mi-temps"},
];

function AddTeamBetModal({bookmakers,tipsters=[],leagues=[],onSave,onClose,editBet=null}){
  const[form,setForm]=useState(editBet?{
    betType:editBet.bet_type||"moneyline",
    team:editBet.team||"",
    opponent:editBet.opponent||"",
    game:editBet.game||"",
    ou:editBet.over_under||"Over",
    line:editBet.line||"",
    odds:editBet.odds||"",
    stake:editBet.stake||"",
    bookmaker:editBet.bookmaker||"",
    status:editBet.status||"pending",
    tipster:editBet.tipster||"",
    notes:editBet.notes||"",
  }:{
    betType:"moneyline",
    team:"",opponent:"",game:"",
    ou:"Over",line:"",odds:"",stake:"",
    bookmaker:bookmakers[0]||"",
    status:"pending",tipster:"",notes:"",
  });
  const[saving,setSaving]=useState(false);
  const[clubs,setClubs]=useState([]);
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  // Charger clubs quand ligue change
  useEffect(()=>{
    if(!form.game)return;
    fetch(SUPA_URL+"/rest/v1/clubs?league=eq."+encodeURIComponent(form.game)+"&order=name.asc",{headers:H})
      .then(r=>r.json()).then(cs=>setClubs(Array.isArray(cs)?cs:[])).catch(()=>{});
  },[form.game]);

  const betTypeInfo=TEAM_BET_TYPES.find(t=>t.key===form.betType)||TEAM_BET_TYPES[0];
  const needsLine=["handicap","total","team_total","half"].includes(form.betType);
  const needsOU=["total","team_total","half"].includes(form.betType);
  const tc=getTeamColor(form.team);
  const pc=tc?.p||"#7C3AED";

  async function submit(){
    if(!form.team||!form.odds||!form.stake){
      alert("Équipe, cote et mise sont obligatoires");return;
    }
    setSaving(true);
    const odds=parseFloat(form.odds);
    const stake=parseFloat(form.stake);

    // Construire description
    let desc="";
    if(form.betType==="moneyline") desc=form.team+" gagne";
    else if(form.betType==="handicap") desc=form.team+" "+form.line;
    else if(form.betType==="total") desc=(form.ou||"Over")+" "+form.line+" pts (match)";
    else if(form.betType==="team_total") desc=form.team+" "+(form.ou||"Over")+" "+form.line;
    else if(form.betType==="half") desc=(form.ou||"Over")+" "+form.line+" (1re mi-temps)";

    const bet={
      player:form.team, // team name dans champ player pour compatibilité
      team:form.team,
      opponent:form.opponent||null,
      description:desc,
      over_under:form.ou||null,
      line:form.line?parseFloat(form.line):null,
      odds,stake,
      bookmaker:form.bookmaker||null,
      status:form.status,
      profit:calcProfit(form.status,stake,odds),
      game:form.game||null,
      tipster:form.tipster||null,
      notes:form.notes||null,
      bet_type:"team",
    };
    try{
      if(editBet){
        await updateBet(editBet.id,bet);
      }else{
        await insertBet({...bet,id:uuid()});
      }
      onSave();
      onClose();
    }catch(e){alert("Erreur: "+e.message);}
    setSaving(false);
  }

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle"/>
        <div className="modal-title">{editBet?"Modifier":"Nouveau pari équipe"}</div>

        {/* Type de pari */}
        <div className="form-group">
          <label className="form-label">Type de pari</label>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {TEAM_BET_TYPES.map(t=>(
              <button key={t.key}
                onClick={()=>f("betType",t.key)}
                style={{display:"flex",alignItems:"center",gap:10,
                  padding:"10px 14px",borderRadius:11,cursor:"pointer",
                  border:"1px solid "+(form.betType===t.key?"#7C3AED":"#1F2937"),
                  background:form.betType===t.key?"rgba(124,58,237,.12)":"rgba(255,255,255,.02)",
                  textAlign:"left"}}>
                <span style={{fontSize:16}}>{t.label.split(" ")[0]}</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700,
                    color:form.betType===t.key?"#A78BFA":"#E5E7EB"}}>
                    {t.label.split(" ").slice(1).join(" ")}
                  </div>
                  <div style={{fontSize:11,color:"#6B7280"}}>{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Ligue */}
        <div className="form-group">
          <label className="form-label">Ligue</label>
          <select className="form-select" value={form.game}
            onChange={e=>{f("game",e.target.value);f("team","");f("opponent","");}}>
            <option value="">Sélectionner…</option>
            {["NBA","EuroLeague","EuroCup","BCL","ACB","Betclic Elite","Lega A","BBL"].map(l=>(
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {/* Équipe */}
        <div className="form-group">
          <label className="form-label">
            {form.betType==="total"?"Équipe locale":"Équipe pariée"}
          </label>
          {clubs.length>0?(
            <select className="form-select" value={form.team}
              onChange={e=>f("team",e.target.value)}>
              <option value="">Sélectionner…</option>
              {clubs.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          ):(
            <input className="form-input" placeholder="Nom de l'équipe"
              value={form.team} onChange={e=>f("team",e.target.value)}/>
          )}
          {/* Preview couleur équipe */}
          {form.team&&tc&&(
            <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
              <div style={{width:28,height:28,borderRadius:"50%",
                background:`linear-gradient(135deg,${pc},${tc.s})`,
                border:`2px solid ${pc}55`}}/>
              <span style={{fontSize:12,color:"#9CA3AF",fontWeight:600}}>{form.team}</span>
            </div>
          )}
        </div>

        {/* Adversaire (optionnel) */}
        {clubs.length>0&&(
          <div className="form-group">
            <label className="form-label">Adversaire (optionnel)</label>
            <select className="form-select" value={form.opponent}
              onChange={e=>f("opponent",e.target.value)}>
              <option value="">Sélectionner…</option>
              {clubs.filter(c=>c.name!==form.team).map(c=>(
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Over/Under + Ligne */}
        {needsLine&&(
          <div className="form-group">
            <label className="form-label">
              {form.betType==="handicap"?"Handicap (ex: -5.5)":"Ligne"}
            </label>
            <div style={{display:"flex",gap:10}}>
              {needsOU&&(
                <div className="segment" style={{flex:"0 0 auto",minWidth:120}}>
                  {["Over","Under"].map(o=>(
                    <button key={o} className={"seg-btn"+(form.ou===o?" active":"")}
                      onClick={()=>f("ou",o)}>{o}</button>
                  ))}
                </div>
              )}
              <input className="form-input" type="number" step="0.5"
                placeholder={form.betType==="handicap"?"-5.5":"220.5"}
                value={form.line} onChange={e=>f("line",e.target.value)}
                style={{flex:1}}/>
            </div>
          </div>
        )}

        {/* Description générée */}
        {form.team&&(
          <div style={{background:"rgba(124,58,237,.08)",border:"1px solid rgba(124,58,237,.2)",
            borderRadius:10,padding:"10px 14px",marginBottom:14}}>
            <div style={{fontSize:11,color:"#7C3AED",fontWeight:700,
              textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Pari</div>
            <div style={{fontSize:14,fontWeight:600,color:"#E5E7EB"}}>
              {form.betType==="moneyline"&&form.team+" gagne"}
              {form.betType==="handicap"&&form.team+" "+form.line}
              {form.betType==="total"&&(form.ou||"Over")+" "+form.line+" pts (match total)"}
              {form.betType==="team_total"&&form.team+" "+(form.ou||"Over")+" "+form.line+" pts"}
              {form.betType==="half"&&(form.ou||"Over")+" "+form.line+" pts (1re mi-temps)"}
            </div>
            {form.opponent&&<div style={{fontSize:11,color:"#6B7280",marginTop:2}}>
              vs {form.opponent}
            </div>}
          </div>
        )}

        {/* Cote + Mise */}
        <div style={{display:"flex",gap:10}} className="form-group">
          <div style={{flex:1}}>
            <label className="form-label">Cote</label>
            <input className="form-input" type="number" step="0.01" placeholder="1.85"
              value={form.odds} onChange={e=>f("odds",e.target.value)}/>
          </div>
          <div style={{flex:1}}>
            <label className="form-label">Mise ($)</label>
            <input className="form-input" type="number" placeholder="100"
              value={form.stake} onChange={e=>f("stake",e.target.value)}/>
          </div>
        </div>

        {/* Bookmaker */}
        <div className="form-group">
          <label className="form-label">Bookmaker</label>
          <select className="form-select" value={form.bookmaker}
            onChange={e=>f("bookmaker",e.target.value)}>
            <option value="">Aucun</option>
            {bookmakers.map(b=><option key={b}>{b}</option>)}
          </select>
        </div>

        {/* Statut */}
        <div className="form-group">
          <label className="form-label">Statut</label>
          <div className="status-row">
            {["pending","won","lost","void"].map(s=>(
              <button key={s} className={"status-btn "+s+(form.status===s?" active":"")}
                onClick={()=>f("status",s)}>
                {s==="pending"?"En cours":s==="won"?"Gagné":s==="lost"?"Perdu":"Void"}
              </button>
            ))}
          </div>
        </div>

        {/* Tipster */}
        <div className="form-group">
          <label className="form-label">Tipster</label>
          {tipsters.length>0?(
            <select className="form-select" value={form.tipster}
              onChange={e=>f("tipster",e.target.value)}>
              <option value="">Aucun</option>
              {tipsters.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          ):(
            <input className="form-input" placeholder="Optionnel"
              value={form.tipster} onChange={e=>f("tipster",e.target.value)}/>
          )}
        </div>

        {/* Notes */}
        <div className="form-group">
          <label className="form-label">Notes</label>
          <input className="form-input" placeholder="Optionnel"
            value={form.notes} onChange={e=>f("notes",e.target.value)}/>
        </div>

        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving?"Enregistrement…":editBet?"Modifier":"+ Ajouter le pari"}
        </button>
        <button className="btn btn-secondary" onClick={onClose} style={{marginTop:8}}>
          Annuler
        </button>
      </div>
    </div>
  );
}


// ── FORMULAIRE AJOUT PARI (Joueur + Équipe) ──────────────────────────────────
function AddBetModal({players,bookmakers,tipsters=[],onSave,onClose,editBet=null}){
  const[step,setStep]=useState(editBet?"form":"search"); // search → form
  const[search,setSearch]=useState("");
  const[selectedType,setSelectedType]=useState(null); // {type:"player"|"team", data}
  const[clubs,setClubs]=useState([]);
  const[saving,setSaving]=useState(false);
  const[form,setForm]=useState(editBet?{
    player:editBet.player||"",
    playerObj:null,
    stat:editBet.description||"Points",
    ou:editBet.over_under||"Over",
    line:editBet.line||"",
    odds:editBet.odds||"",
    stake:editBet.stake||"",
    bookmaker:editBet.bookmaker||"",
    status:editBet.status||"pending",
    game:editBet.game||"",
    tipster:editBet.tipster||"",
    notes:editBet.notes||"",
    // team fields
    betType:editBet.bet_type==="team"?(editBet.description?.includes("gagne")?"moneyline":editBet.description?.includes("mi-temps")?"half":editBet.description?.includes("match")?"total":editBet.description?.includes("pts")?"team_total":"moneyline"):"moneyline",
    team:editBet.team||"",
    opponent:editBet.opponent||"",
  }:{
    player:"",playerObj:null,stat:"Points",ou:"Over",line:"",
    odds:"",stake:"",bookmaker:bookmakers[0]||"",
    status:"pending",game:"",tipster:"",notes:"",
    betType:"moneyline",team:"",opponent:"",
  });
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  const isTeamBet=editBet?.bet_type==="team"||(selectedType?.type==="team");

  // Recherche joueurs + équipes
  const searchLow=search.toLowerCase().trim();
  const playerResults=searchLow.length>=1
    ?Object.values(players).filter(p=>{
        const n=p.name.toLowerCase();
        const words=n.split(" ");
        const initials=words.map(w=>w[0]||"").join("");
        return n.includes(searchLow)||initials.includes(searchLow);
      }).slice(0,6)
    :[];

  // Chercher dans tous les clubs via players (teams uniques)
  const allTeams=searchLow.length>=1
    ?[...new Set(Object.values(players).map(p=>p.team).filter(Boolean))]
        .filter(t=>t.toLowerCase().includes(searchLow))
        .slice(0,4)
    :[];

  // Charger clubs si équipe sélectionnée
  useEffect(()=>{
    if(!form.game||!isTeamBet)return;
    fetch(SUPA_URL+"/rest/v1/clubs?league=eq."+encodeURIComponent(form.game)+"&order=name.asc",{headers:H})
      .then(r=>r.json()).then(cs=>setClubs(Array.isArray(cs)?cs:[])).catch(()=>{});
  },[form.game,isTeamBet]);

  function selectPlayer(p){
    f("player",p.name);f("playerObj",p);
    if(p.game)f("game",p.game);
    setSelectedType({type:"player",data:p});
    setStep("form");
  }

  function selectTeam(teamName){
    // Trouver la ligue de ce club depuis players
    const playerOfTeam=Object.values(players).find(p=>p.team===teamName);
    const game=playerOfTeam?.game||"";
    f("team",teamName);f("game",game);
    setSelectedType({type:"team",data:{name:teamName,game}});
    setStep("form");
  }

  async function submit(){
    const odds=parseFloat(form.odds);
    const stake=parseFloat(form.stake);
    if(!odds||!stake){alert("Cote et mise obligatoires");return;}

    let bet;
    if(isTeamBet){
      if(!form.team){alert("Sélectionne une équipe");return;}
      let desc="";
      if(form.betType==="moneyline") desc=form.team+" gagne";
      else if(form.betType==="handicap") desc=form.team+" "+form.line;
      else if(form.betType==="total") desc=(form.ou||"Over")+" "+form.line+" pts (match)";
      else if(form.betType==="team_total") desc=form.team+" "+(form.ou||"Over")+" "+form.line+" pts";
      else if(form.betType==="half") desc=(form.ou||"Over")+" "+form.line+" pts (1re mi-temps)";
      bet={
        player:form.team,team:form.team,opponent:form.opponent||null,
        description:desc,over_under:form.ou||null,
        line:form.line?parseFloat(form.line):null,
        odds,stake,bookmaker:form.bookmaker||null,
        status:form.status,profit:calcProfit(form.status,stake,odds),
        game:form.game||null,tipster:form.tipster||null,
        notes:form.notes||null,bet_type:"team",
      };
    }else{
      if(!form.player){alert("Sélectionne un joueur");return;}
      const desc=form.ou&&form.line&&form.stat
        ?form.ou+" "+form.line+" "+form.stat:form.stat||"";
      bet={
        player:form.player,team:form.playerObj?.team||null,
        description:desc,over_under:form.ou||null,
        line:form.line?parseFloat(form.line):null,
        odds,stake,bookmaker:form.bookmaker||null,
        status:form.status,profit:calcProfit(form.status,stake,odds),
        game:form.game||form.playerObj?.game||null,
        tipster:form.tipster||null,notes:form.notes||null,bet_type:"player",
      };
    }
    setSaving(true);
    try{
      if(editBet)await updateBet(editBet.id,bet);
      else await insertBet({...bet,id:uuid()});
      onSave();onClose();
    }catch(e){alert("Erreur: "+e.message);}
    setSaving(false);
  }

  const tc=getTeamColor(isTeamBet?form.team:(form.playerObj?.team||""));
  const pc=tc?.p||"#7C3AED";

  // ── ÉTAPE 1 : Recherche ───────────────────────────────────────
  if(step==="search")return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle"/>
        <div className="modal-title">Nouveau pari</div>

        {/* Barre de recherche */}
        <div style={{position:"relative",marginBottom:12}}>
          <span style={{position:"absolute",left:12,top:"50%",
            transform:"translateY(-50%)",fontSize:16,color:"#6B7280",
            pointerEvents:"none"}}>⌕</span>
          <input className="form-input" autoFocus
            placeholder="Joueur ou équipe… (ex: lj, BOS, Lakers)"
            value={search} onChange={e=>setSearch(e.target.value)}
            style={{paddingLeft:38}}/>
          {search&&<button onClick={()=>setSearch("")}
            style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
              background:"transparent",border:"none",color:"#6B7280",
              cursor:"pointer",fontSize:18}}>×</button>}
        </div>

        {/* Résultats équipes */}
        {allTeams.length>0&&(
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:800,color:"#F59E0B",
              letterSpacing:1.5,textTransform:"uppercase",padding:"4px 0 6px"}}>◉ Équipes</div>
            {allTeams.map(team=>{
              const tc2=getTeamColor(team);
              const pc2=tc2?.p||"#1F2937";
              const sc2=tc2?.s||"#374151";
              const playerOfTeam=Object.values(players).find(p=>p.team===team);
              return(
                <div key={team} onClick={()=>selectTeam(team)}
                  style={{display:"flex",alignItems:"center",gap:12,
                    padding:"10px 12px",background:"#0F1629",
                    border:"1px solid rgba(245,158,11,.2)",
                    borderRadius:12,marginBottom:6,cursor:"pointer"}}>
                  <div style={{width:40,height:40,borderRadius:"50%",flexShrink:0,
                    background:`linear-gradient(135deg,${pc2}CC,${sc2}88)`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    border:`2px solid ${pc2}44`,fontSize:18}}>◉</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB"}}>{team}</div>
                    {playerOfTeam?.game&&<div style={{fontSize:11,color:"#6B7280"}}>{playerOfTeam.game}</div>}
                  </div>
                  <span style={{fontSize:10,fontWeight:800,color:"#F59E0B",
                    background:"rgba(245,158,11,.12)",border:"1px solid rgba(245,158,11,.25)",
                    borderRadius:5,padding:"2px 7px"}}>ÉQUIPE</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Résultats joueurs */}
        {playerResults.length>0&&(
          <div>
            <div style={{fontSize:10,fontWeight:800,color:"#A78BFA",
              letterSpacing:1.5,textTransform:"uppercase",padding:"4px 0 6px"}}>○ Joueurs</div>
            {playerResults.map(p=>{
              const tc2=getTeamColor(p.team);
              const pc2=tc2?.p||"#1F2937";
              const sc2=tc2?.s||"#374151";
              const photo=p.photo_url||p.avatar_url;
              return(
                <div key={p.name} onClick={()=>selectPlayer(p)}
                  style={{display:"flex",alignItems:"center",gap:12,
                    padding:"10px 12px",background:"#0F1629",
                    border:"1px solid rgba(255,255,255,.06)",
                    borderRadius:12,marginBottom:6,cursor:"pointer"}}>
                  <div style={{width:56,height:56,borderRadius:"50%",flexShrink:0,
                    background:`linear-gradient(135deg,${pc2}CC,${sc2}88)`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    border:`2px solid ${pc2}44`,overflow:"hidden"}}>
                    {photo
                      ?<img src={photo} loading="lazy" decoding="async"
                          style={{width:"100%",height:"100%",objectFit:"contain",objectPosition:"50% 85%",
                            WebkitBackfaceVisibility:"hidden",transform:"translateZ(0)"}}/>
                      :<span style={{fontSize:24,color:"#4B5563"}}>○</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",
                      whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {p.name.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(" ")}
                    </div>
                    <div style={{fontSize:11,color:"#6B7280"}}>
                      {[p.role,p.team].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {search.length>=1&&playerResults.length===0&&allTeams.length===0&&(
          <div className="empty">
            <div className="empty-icon" style={{fontSize:32,color:"#374151"}}>⌕</div>
            <div className="empty-text">Aucun résultat</div>
            <div className="empty-sub">Essaie "lj", "BOS", "Lakers"…</div>
          </div>
        )}

        {search.length===0&&(
          <div style={{textAlign:"center",padding:"24px 0",color:"#4B5563",fontSize:13}}>
            Tape le nom d'un joueur ou d'une équipe
          </div>
        )}

        <button className="btn btn-secondary" onClick={onClose} style={{marginTop:16}}>
          Annuler
        </button>
      </div>
    </div>
  );

  // ── ÉTAPE 2 : Formulaire ──────────────────────────────────────
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle"/>

        {/* Header avec retour */}
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          {!editBet&&<button onClick={()=>setStep("search")}
            style={{background:"transparent",border:"none",color:"#A78BFA",
              cursor:"pointer",fontSize:22,padding:0,lineHeight:1}}>‹</button>}
          <div style={{width:48,height:48,borderRadius:"50%",flexShrink:0,
            background:`linear-gradient(135deg,${pc}CC,${tc?.s||"#374151"}88)`,
            display:"flex",alignItems:"center",justifyContent:"center",
            border:`2px solid ${pc}44`,overflow:"hidden"}}>
            {isTeamBet?<span style={{fontSize:22,color:"#374151"}}>◉</span>:(()=>{
              const photo=form.playerObj?.photo_url||form.playerObj?.avatar_url;
              return photo
                ?<img src={photo} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 8%"}}/>
                :<span style={{fontSize:22}}>○</span>;
            })()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16,fontWeight:800,color:"#E5E7EB",
              whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {isTeamBet?form.team:form.player}
            </div>
            <div style={{fontSize:11,color:"#6B7280"}}>
              {isTeamBet
                ?<span style={{color:"#F59E0B",fontWeight:700}}>Pari équipe</span>
                :<span>{form.playerObj?.team||form.game}</span>}
            </div>
          </div>
        </div>

        {/* ── PARI ÉQUIPE ── */}
        {isTeamBet&&(
          <>
            {/* Type */}
            <div className="form-group">
              <label className="form-label">Type</label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                {[
                  {key:"moneyline",label:"Moneyline"},
                  {key:"handicap", label:"Handicap"},
                  {key:"total",    label:"Total match"},
                  {key:"team_total",label:"Total équipe"},
                  {key:"half",    label:"Mi-temps"},
                ].map(t=>(
                  <button key={t.key} onClick={()=>f("betType",t.key)}
                    style={{padding:"9px 10px",borderRadius:10,cursor:"pointer",
                      border:"1px solid "+(form.betType===t.key?pc:"#1F2937"),
                      background:form.betType===t.key?`${pc}18`:"rgba(255,255,255,.02)",
                      color:form.betType===t.key?"#E5E7EB":"#9CA3AF",
                      fontSize:12,fontWeight:700,textAlign:"center"}}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Adversaire */}
            <div className="form-group">
              <label className="form-label">vs Adversaire (optionnel)</label>
              <input className="form-input" placeholder="Nom de l'adversaire"
                value={form.opponent} onChange={e=>f("opponent",e.target.value)}/>
            </div>

            {/* Over/Under + Ligne */}
            {["handicap","total","team_total","half"].includes(form.betType)&&(
              <div className="form-group">
                <label className="form-label">
                  {form.betType==="handicap"?"Handicap":"Ligne"}
                </label>
                <div style={{display:"flex",gap:10}}>
                  {["total","team_total","half"].includes(form.betType)&&(
                    <div className="segment" style={{flex:"0 0 auto",minWidth:120}}>
                      {["Over","Under"].map(o=>(
                        <button key={o} className={"seg-btn"+(form.ou===o?" active":"")}
                          onClick={()=>f("ou",o)}>{o}</button>
                      ))}
                    </div>
                  )}
                  <input className="form-input" type="number" step="0.5"
                    placeholder={form.betType==="handicap"?"-5.5":"220.5"}
                    value={form.line} onChange={e=>f("line",e.target.value)}
                    style={{flex:1}}/>
                </div>
              </div>
            )}

            {/* Résumé du pari */}
            <div style={{background:`${pc}12`,border:`1px solid ${pc}30`,
              borderRadius:12,padding:"10px 14px",marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:pc,marginBottom:3}}>Pari</div>
              <div style={{fontSize:14,fontWeight:600,color:"#E5E7EB"}}>
                {form.betType==="moneyline"&&form.team+" gagne"}
                {form.betType==="handicap"&&form.team+" "+form.line}
                {form.betType==="total"&&(form.ou||"Over")+" "+form.line+" pts (match)"}
                {form.betType==="team_total"&&form.team+" "+(form.ou||"Over")+" "+form.line+" pts"}
                {form.betType==="half"&&(form.ou||"Over")+" "+form.line+" (mi-temps)"}
              </div>
              {form.opponent&&<div style={{fontSize:11,color:"#6B7280",marginTop:2}}>vs {form.opponent}</div>}
            </div>
          </>
        )}

        {/* ── PARI JOUEUR ── */}
        {!isTeamBet&&(
          <>
            <div className="form-group">
              <label className="form-label">Pari</label>
              <div className="segment" style={{marginBottom:10}}>
                {["Over","Under"].map(o=>(
                  <button key={o} className={"seg-btn"+(form.ou===o?" active":"")}
                    onClick={()=>f("ou",o)}>{o}</button>
                ))}
              </div>
              <div style={{display:"flex",gap:10}}>
                <input className="form-input" type="number" step="0.5"
                  placeholder="Ligne (ex: 24.5)" value={form.line}
                  onChange={e=>f("line",e.target.value)} style={{flex:1}}/>
                <select className="form-select" value={form.stat}
                  onChange={e=>f("stat",e.target.value)} style={{flex:1}}>
                  {["Points","Rebonds","Assists","Points+Rebonds","Points+Assists",
                    "Points+Rebonds+Assists","3 Points Made","Steals","Blocks",
                    "Turnovers","Fantasy Score","Minutes"].map(s=>(
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        )}

        {/* ── COMMUN : Cote + Mise ── */}
        <div style={{display:"flex",gap:10}} className="form-group">
          <div style={{flex:1}}>
            <label className="form-label">Cote</label>
            <input className="form-input" type="number" step="0.01" placeholder="1.85"
              value={form.odds} onChange={e=>f("odds",e.target.value)}/>
          </div>
          <div style={{flex:1}}>
            <label className="form-label">Mise ($)</label>
            <input className="form-input" type="number" placeholder="100"
              value={form.stake} onChange={e=>f("stake",e.target.value)}/>
          </div>
        </div>

        {/* Bookmaker */}
        <div className="form-group">
          <label className="form-label">Bookmaker</label>
          <select className="form-select" value={form.bookmaker}
            onChange={e=>f("bookmaker",e.target.value)}>
            <option value="">Aucun</option>
            {bookmakers.map(b=><option key={b}>{b}</option>)}
          </select>
        </div>

        {/* Statut */}
        <div className="form-group">
          <label className="form-label">Statut</label>
          <div className="status-row">
            {["pending","won","lost","void"].map(s=>(
              <button key={s} className={"status-btn "+s+(form.status===s?" active":"")}
                onClick={()=>f("status",s)}>
                {s==="pending"?"En cours":s==="won"?"Gagné":s==="lost"?"Perdu":"Void"}
              </button>
            ))}
          </div>
        </div>

        {/* Tipster */}
        <div className="form-group">
          <label className="form-label">Tipster</label>
          {tipsters.length>0?(
            <select className="form-select" value={form.tipster}
              onChange={e=>f("tipster",e.target.value)}>
              <option value="">Aucun</option>
              {tipsters.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          ):(
            <input className="form-input" placeholder="Optionnel"
              value={form.tipster} onChange={e=>f("tipster",e.target.value)}/>
          )}
        </div>

        {/* Notes */}
        <div className="form-group">
          <label className="form-label">Notes</label>
          <input className="form-input" placeholder="Optionnel"
            value={form.notes} onChange={e=>f("notes",e.target.value)}/>
        </div>

        <button className="btn btn-primary" onClick={submit} disabled={saving}>
          {saving?"Enregistrement…":editBet?"Modifier":"+ Ajouter le pari"}
        </button>
        <button className="btn btn-secondary" onClick={onClose} style={{marginTop:8}}>
          Annuler
        </button>
      </div>
    </div>
  );
}

// ── DÉTAIL PARI ───────────────────────────────────────────────────────────────
function BetDetailModal({bet,players,onClose,onUpdate,onDelete}){
  const[saving,setSaving]=useState(false);
  const pData=players.find(p=>p.name===bet.player);
  const photo=pData?.photo_url||pData?.avatar_url;

  const profitNum=parseFloat(bet.profit||0);

  async function changeStatus(status){
    setSaving(true);
    const profit=calcProfit(status,bet.stake,bet.odds);
    await updateBet(bet.id,{status,profit});
    onUpdate();
    setSaving(false);
  }

  async function remove(){
    if(!window.confirm("Supprimer ce pari ?"))return;
    await deleteBet(bet.id);
    onUpdate();
    onClose();
  }

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle"/>

        {/* Header joueur */}
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>{
          (()=>{
            const tc2=getTeamColor(bet.team||pData?.team);
            const pc2=tc2?.p||"#1F2937";
            const sc2=tc2?.s||"#374151";
            return(
              <div style={{width:80,height:80,borderRadius:"50%",flexShrink:0,
                background:`linear-gradient(135deg,${pc2}CC,${sc2}88)`,
                display:"flex",alignItems:"center",justifyContent:"center",
                border:`2px solid ${pc2}66`,boxShadow:`0 4px 20px ${pc2}55`,
                overflow:"hidden"}}>
                {photo
                  ?<img src={photo} loading="lazy" decoding="async"
                      style={{width:"100%",height:"100%",objectFit:"contain",objectPosition:"50% 85%",
                        WebkitBackfaceVisibility:"hidden",transform:"translateZ(0)"}}/>
                  :<span style={{fontSize:26,color:"#4B5563"}}>○</span>}
              </div>
            );
          })()
        }
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16,fontWeight:800,color:"#E5E7EB"}}>{bet.player}</div>
            <div style={{fontSize:13,color:"#9CA3AF",marginTop:2}}>
              {bet.description||"—"}
            </div>
            {bet.game&&(
              <div style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>
                {getLeagueLogo(bet.game)&&<img src={getLeagueLogo(bet.game)} alt={bet.game}
                  style={{width:14,height:14,objectFit:"contain",opacity:.8}}/>}
                <span style={{fontSize:11,color:"#6B7280"}}>{bet.game}</span>
              </div>
            )}
          </div>
          <div className={"badge badge-"+bet.status}>
            {bet.status==="pending"?"En cours":bet.status==="won"?"Gagné":bet.status==="lost"?"Perdu":"Void"}
          </div>
        </div>

        {/* Profit */}
        <div className="card" style={{marginBottom:16,textAlign:"center"}}>
          <div className={"profit-big "+(profitNum>0?"pos":profitNum<0?"neg":"neu")}>
            {profitNum>0?"+":""}{profitNum.toFixed(2)}$
          </div>
          <div style={{fontSize:12,color:"#6B7280",marginTop:4}}>
            Cote {bet.odds} · Mise {bet.stake}$
            {bet.bookmaker?" · "+bet.bookmaker:""}
          </div>
        </div>

        {/* Changer statut */}
        <div className="form-group">
          <label className="form-label">Changer le statut</label>
          <div className="status-row">
            {["pending","won","lost","void"].map(s=>(
              <button key={s} className={"status-btn "+s+(bet.status===s?" active":"")}
                onClick={()=>changeStatus(s)} disabled={saving||bet.status===s}>
                {s==="pending"?"En cours":s==="won"?"Gagné":s==="lost"?"Perdu":"Void"}
              </button>
            ))}
          </div>
        </div>

        {/* Infos */}
        {(bet.tipster||bet.notes||bet.created_at)&&(
          <div className="card-sm" style={{marginBottom:16}}>
            {bet.tipster&&<div style={{fontSize:12,color:"#A78BFA",marginBottom:4}}>
              ◎ Tipster: {bet.tipster}</div>}
            {bet.notes&&<div style={{fontSize:12,color:"#9CA3AF",marginBottom:4}}>
              ✦ {bet.notes}</div>}
            {bet.created_at&&<div style={{fontSize:11,color:"#6B7280"}}>
              {new Date(bet.created_at).toLocaleString("fr-CA")}</div>}
          </div>
        )}

        <button className="btn btn-danger" onClick={remove}>Supprimer</button>
        <button className="btn btn-secondary" onClick={onClose} style={{marginTop:8}}>Fermer</button>
      </div>
    </div>
  );
}

// ── VUE ACCUEIL ───────────────────────────────────────────────────────────────
function HomeView({bets,players}){
  const settled=bets.filter(b=>b.status!=="pending"&&b.status!=="void");
  const won=bets.filter(b=>b.status==="won").length;
  const lost=bets.filter(b=>b.status==="lost").length;
  const pending=bets.filter(b=>b.status==="pending").length;
  const profit=bets.reduce((s,b)=>s+parseFloat(b.profit||0),0);
  const staked=settled.reduce((s,b)=>s+parseFloat(b.stake||0),0);
  const roi=staked>0?profit/staked*100:0;
  const wr=won+lost>0?won/(won+lost)*100:0;

  // Courbe bankroll simplifiée (derniers 10 jours)
  const sorted=[...settled].sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));

  return(
    <div style={{padding:"16px 16px 0"}}>
      {/* Profit principal */}
      <div className="card" style={{textAlign:"center",padding:"24px 16px",marginBottom:12}}>
        <div style={{fontSize:11,color:"#6B7280",fontWeight:700,letterSpacing:1,marginBottom:8}}>
          PROFIT NET
        </div>
        <div className={"profit-big "+(profit>0?"pos":profit<0?"neg":"neu")}>
          {profit>0?"+":""}{profit.toFixed(2)}$
        </div>
        <div style={{fontSize:13,color:"#6B7280",marginTop:8}}>
          {won}G · {lost}P · {pending} en cours
        </div>
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value" style={{color:wr>=55?"#22C55E":wr>=45?"#F59E0B":"#EF4444"}}>
            {wr.toFixed(1)}%
          </div>
          <div className="stat-label">Win Rate</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{color:roi>=0?"#22C55E":"#EF4444"}}>
            {roi>=0?"+":""}{roi.toFixed(1)}%
          </div>
          <div className="stat-label">ROI</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{settled.length}</div>
          <div className="stat-label">Paris réglés</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{staked.toFixed(0)}$</div>
          <div className="stat-label">Total misé</div>
        </div>
      </div>

      {/* Par bookmaker */}
      {bets.length>0&&(()=>{
        const byBK={};
        bets.forEach(b=>{
          const k=b.bookmaker||"Autre";
          if(!byBK[k])byBK[k]={profit:0,count:0};
          byBK[k].profit+=parseFloat(b.profit||0);
          byBK[k].count++;
        });
        const entries=Object.entries(byBK).sort((a,b)=>b[1].profit-a[1].profit);
        if(entries.length===0)return null;
        return(
          <div className="card" style={{marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:700,color:"#6B7280",
              textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>
              Par Bookmaker
            </div>
            {entries.map(([bk,s])=>(
              <div key={bk} style={{display:"flex",justifyContent:"space-between",
                alignItems:"center",padding:"8px 0",borderBottom:"1px solid #1F2937"}}>
                <div>
                  <span style={{fontSize:13,fontWeight:600,color:"#E5E7EB"}}>{bk}</span>
                  <span style={{fontSize:11,color:"#6B7280",marginLeft:8}}>{s.count} paris</span>
                </div>
                <span style={{fontSize:14,fontWeight:800,
                  color:s.profit>0?"#22C55E":s.profit<0?"#EF4444":"#9CA3AF"}}>
                  {s.profit>0?"+":""}{s.profit.toFixed(2)}$
                </span>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// ── VUE MES PARIS ─────────────────────────────────────────────────────────────
function BetsView({bets,players,bookmakers=[],bkPhotos={},onSelectBet,onEdit}){
  const[filter,setFilter]=useState("all");
  const[search,setSearch]=useState("");

  const filtered=bets.filter(b=>{
    if(filter!=="all"&&b.status!==filter)return false;
    if(search&&!b.player.toLowerCase().includes(search.toLowerCase())&&
       !(b.description||"").toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  const profitFiltered=filtered.reduce((s,b)=>s+parseFloat(b.profit||0),0);

  return(
    <div>
      {/* Search */}
      <div style={{padding:"12px 16px 0"}}>
        <input className="form-input" placeholder="⌕  Rechercher un joueur…"
          value={search} onChange={e=>setSearch(e.target.value)}/>
      </div>

      {/* Filtres */}
      <div className="filter-row" style={{marginTop:10}}>
        {[
          {k:"all",label:"Tous ("+bets.length+")"},
          {k:"pending",label:"En cours"},
          {k:"won",label:"Gagnés"},
          {k:"lost",label:"Perdus"},
          {k:"void",label:"Void"},
        ].map(({k,label})=>(
          <button key={k} className={"filter-chip"+(filter===k?" active":"")}
            onClick={()=>setFilter(k)}>{label}</button>
        ))}
      </div>

      {/* Profit filtré */}
      {filter!=="all"&&filtered.length>0&&(
        <div style={{padding:"0 16px 8px",fontSize:13,color:profitFiltered>=0?"#22C55E":"#EF4444",fontWeight:700}}>
          {profitFiltered>=0?"+":""}{profitFiltered.toFixed(2)}$ sur {filtered.length} paris
        </div>
      )}

      {/* Liste */}
      <div style={{padding:"0 16px"}}>
        {filtered.length===0?(
          <div className="empty">
            <div className="empty-icon" style={{fontSize:32,color:"#374151"}}>≡</div>
            <div className="empty-text">Aucun pari{search?" trouvé":""}</div>
            <div className="empty-sub">{search?"Essaie un autre terme":"Ajoute ton premier pari +"}</div>
          </div>
        ):filtered.map(b=>{
          const pData=players.find(p=>p.name===b.player);
          const photo=pData?.photo_url||pData?.avatar_url;
          const profitNum=parseFloat(b.profit||0);
          const bkObj=bookmakers?.find(bk=>bk.name===b.bookmaker);
          const tc=getTeamColor(b.team||pData?.team);
          const pc=tc?.p||"#1F2937";
          const sc2=tc?.s||"#374151";
          return(
              <div key={b.id} className="bet-row" onClick={()=>onSelectBet(b)}
                style={{position:"relative",overflow:"hidden",padding:"12px 14px"}}>
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,
                background:`linear-gradient(180deg,${pc},${sc2})`}}/>
              <div style={{width:70,height:51,flexShrink:0,
                background:`linear-gradient(180deg,transparent,${pc}22)`,
                display:"flex",alignItems:"flex-end",justifyContent:"center",
                overflow:"hidden",borderRadius:8,marginLeft:4,position:"relative"}}>
                {/* Logo club watermark */}
                {pData?.team_logo_url&&(
                  <img src={pData.team_logo_url} alt=""
                    style={{position:"absolute",right:-2,bottom:-2,
                      width:32,height:32,objectFit:"contain",
                      opacity:.12,filter:"grayscale(20%)"}}/>
                )}
                {photo
                  ?<img src={photo} loading="lazy" decoding="async"
                      style={{width:70,height:51,objectFit:"contain",objectPosition:"50% 85%",
                        WebkitBackfaceVisibility:"hidden",transform:"translateZ(0)",
                        position:"relative",zIndex:1}}
                      onError={e=>{e.target.style.display="none";}}/>
                  :<span style={{fontSize:22,paddingBottom:2,position:"relative",zIndex:1,color:"#4B5563"}}>○</span>}
              </div>
              <div className="bet-info">

                {/* Ligne 1: Nom + logo ligue + description */}
                <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4,
                  whiteSpace:"nowrap",overflow:"hidden"}}>
                  <span style={{fontSize:14,fontWeight:700,color:"#F3F4F6",flexShrink:0}}>
                    {formatName(b.player)}
                  </span>
                  {b.game&&getLeagueLogo(b.game)&&(
                    <img src={getLeagueLogo(b.game)} alt={b.game} flexShrink={0}
                      style={{width:14,height:14,objectFit:"contain",opacity:.85,flexShrink:0}}/>
                  )}
                  {b.description&&(
                    <span style={{fontSize:12,color:"#9CA3AF",
                      overflow:"hidden",textOverflow:"ellipsis"}}>
                      {b.description}
                    </span>
                  )}
                  {b.bet_type==="team"&&<span style={{fontSize:9,fontWeight:800,
                    color:"#F59E0B",background:"rgba(245,158,11,.12)",
                    border:"1px solid rgba(245,158,11,.25)",
                    borderRadius:4,padding:"1px 5px",flexShrink:0}}>ÉQUIPE</span>}
                </div>

                {/* Ligne 2: Cote · Mise · Logo BK · Tipster */}
                <div style={{display:"flex",alignItems:"center",gap:0,flexWrap:"wrap"}}>
                  <span style={{fontSize:11,fontWeight:700,color:"#E5E7EB"}}>@{b.odds}</span>
                  <span style={{fontSize:11,color:"#374151",margin:"0 4px"}}>·</span>
                  <span style={{fontSize:11,color:"#9CA3AF"}}>{b.stake}$</span>
                  {b.bookmaker&&(()=>{
                    const bkObj=bkPhotos?.[b.bookmaker];
                    return(
                      <>
                        <span style={{fontSize:11,color:"#374151",margin:"0 4px"}}>·</span>
                        {bkObj
                          ?<img src={bkObj} alt={b.bookmaker}
                              style={{width:16,height:16,objectFit:"contain",borderRadius:3}}/>
                          :<span style={{fontSize:11,color:"#6B7280"}}>{b.bookmaker}</span>
                        }
                      </>
                    );
                  })()}
                  {b.tipster&&(
                    <>
                      <span style={{fontSize:11,color:"#374151",margin:"0 4px"}}>·</span>
                      <span style={{fontSize:11,color:"#A78BFA",fontWeight:600}}>{b.tipster}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Profit à droite */}
              <div className="bet-right" style={{flexShrink:0}}>
                <div className={"bet-profit"+(profitNum>0?" pos":profitNum<0?" neg":" neu")}>
                  {profitNum>0?"+":""}{profitNum.toFixed(0)}$
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── VUE STATS ─────────────────────────────────────────────────────────────────
function StatsView({bets}){
  const settled=bets.filter(b=>b.status==="won"||b.status==="lost");
  const byGame={};
  bets.forEach(b=>{
    const k=b.game||"Autre";
    if(!byGame[k])byGame[k]={won:0,lost:0,profit:0};
    byGame[k].profit+=parseFloat(b.profit||0);
    if(b.status==="won")byGame[k].won++;
    if(b.status==="lost")byGame[k].lost++;
  });
  const byStat={};
  bets.forEach(b=>{
    const raw=b.description||"Autre";
    const k=raw.replace(/^(Over|Under)\s[\d.]+\s/,"");
    if(!byStat[k])byStat[k]={won:0,lost:0,profit:0};
    byStat[k].profit+=parseFloat(b.profit||0);
    if(b.status==="won")byStat[k].won++;
    if(b.status==="lost")byStat[k].lost++;
  });
  const byMonth={};
  settled.forEach(b=>{
    const m=b.created_at?.slice(0,7)||"?";
    if(!byMonth[m])byMonth[m]={profit:0,count:0};
    byMonth[m].profit+=parseFloat(b.profit||0);
    byMonth[m].count++;
  });

  if(bets.length===0)return(
    <div className="empty" style={{marginTop:40}}>
      <div className="empty-icon" style={{fontSize:32,color:"#374151"}}>▦</div>
      <div className="empty-text">Pas encore de données</div>
      <div className="empty-sub">Ajoute des paris pour voir tes stats</div>
    </div>
  );

  return(
    <div style={{padding:"16px"}}>
      {Object.keys(byGame).length>0&&(
        <div className="card" style={{marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Par Ligue</div>
          {Object.entries(byGame).sort((a,b)=>Math.abs(b[1].profit)-Math.abs(a[1].profit)).map(([g,s])=>{
            const wr=s.won+s.lost>0?s.won/(s.won+s.lost)*100:0;
            return(
              <div key={g} style={{marginBottom:10,paddingBottom:10,borderBottom:"1px solid #1F2937"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>{g}</span>
                  <span style={{fontSize:14,fontWeight:800,color:s.profit>0?"#22C55E":s.profit<0?"#EF4444":"#9CA3AF"}}>
                    {s.profit>0?"+":""}{s.profit.toFixed(2)}$
                  </span>
                </div>
                <div style={{fontSize:11,color:"#6B7280"}}>{s.won}G · {s.lost}P · WR {wr.toFixed(0)}%</div>
              </div>
            );
          })}
        </div>
      )}
      {Object.keys(byStat).length>0&&(
        <div className="card" style={{marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Par Type de Stat</div>
          {Object.entries(byStat).sort((a,b)=>b[1].profit-a[1].profit).slice(0,8).map(([stat,s])=>{
            const wr=s.won+s.lost>0?s.won/(s.won+s.lost)*100:0;
            return(
              <div key={stat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #1F2937"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"#E5E7EB"}}>{stat}</div>
                  <div style={{fontSize:10,color:"#6B7280"}}>{s.won+s.lost} paris · WR {wr.toFixed(0)}%</div>
                </div>
                <span style={{fontSize:13,fontWeight:800,color:s.profit>0?"#22C55E":s.profit<0?"#EF4444":"#9CA3AF"}}>
                  {s.profit>0?"+":""}{s.profit.toFixed(0)}$
                </span>
              </div>
            );
          })}
        </div>
      )}
      {Object.keys(byMonth).length>0&&(
        <div className="card">
          <div style={{fontSize:12,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Par Mois</div>
          {Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).map(([m,s])=>(
            <div key={m} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid #1F2937"}}>
              <div style={{fontSize:12,fontWeight:600,color:"#E5E7EB"}}>{m}</div>
              <div style={{textAlign:"right"}}>
                <span style={{fontSize:13,fontWeight:800,color:s.profit>0?"#22C55E":s.profit<0?"#EF4444":"#9CA3AF"}}>
                  {s.profit>0?"+":""}{s.profit.toFixed(0)}$
                </span>
                <span style={{fontSize:11,color:"#6B7280",marginLeft:8}}>{s.count} paris</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── VUE ÉDITION ──────────────────────────────────────────────────────────────

function EditView({showToast}){
  // ── Tous les hooks en haut (règle React) ─────────────────────
  const[leagues,setLeagues]=useState([]);
  const[selectedLeague,setSelectedLeague]=useState(null);
  const[clubs,setClubs]=useState([]);
  const[selectedClub,setSelectedClub]=useState(null);
  const[players,setPlayers]=useState([]);
  const[editingPlayer,setEditingPlayer]=useState(null);
  const[loading,setLoading]=useState(false);
  const[uploadingId,setUploadingId]=useState(null);
  const[globalSearch,setGlobalSearch]=useState("");
  const[playerSearch,setPlayerSearch]=useState("");

  // Charger ligues
  useEffect(()=>{
    fetchLeagues().then(rows=>{
      const ORDER=['NBA','EuroLeague','EuroCup','BCL','ACB','Betclic Elite','Lega A','BBL'];
      rows.sort((a,b)=>{
        const ia=ORDER.indexOf(a.name),ib=ORDER.indexOf(b.name);
        return (ia===-1?99:ia)-(ib===-1?99:ib);
      });
      setLeagues(rows);
    }).catch(()=>{});
  },[]);

  // Charger clubs quand ligue sélectionnée
  useEffect(()=>{
    if(!selectedLeague)return;
    setLoading(true);
    setSelectedClub(null);
    setPlayers([]);
    fetchClubs(selectedLeague.name)
      .then(cs=>setClubs(cs))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[selectedLeague]);

  // Charger joueurs quand club sélectionné
  useEffect(()=>{
    if(!selectedClub)return;
    setLoading(true);
    setPlayers([]);
    setPlayerSearch("");
    fetch(SUPA_URL+"/rest/v1/players?team=eq."+encodeURIComponent(selectedClub.name)+"&select=*&order=name.asc",{headers:H})
      .then(r=>r.json())
      .then(rows=>setPlayers(Array.isArray(rows)?rows:[]))
      .catch(()=>{})
      .finally(()=>setLoading(false));
  },[selectedClub]);

  // Helpers
  function formatName(name){
    return name.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(" ");
  }
  const POS_ORDER=["PG","SG","SF","PF","C","G","F","Guard","Wing","Forward","Big",""];
  function posRank(role){const i=POS_ORDER.indexOf(role||"");return i===-1?99:i;}

  async function pasteLeagueLogo(lg){
    try{
      const url=await pasteImageToSupabase("league_"+lg.name.replace(/\s/g,"_").toLowerCase());
      await updateLeague(lg.id,{logo:url});
      setLeagues(prev=>prev.map(l=>l.id===lg.id?{...l,logo:url}:l));
      if(selectedLeague?.id===lg.id)setSelectedLeague(prev=>({...prev,logo:url}));
      showToast("Logo ligue mis à jour ✓");
    }catch(e){showToast("Erreur: "+e.message,"#EF4444");}
  }

  async function pasteClubLogo(club){
    try{
      const url=await pasteImageToSupabase("club_"+club.name.replace(/\s/g,"_").toLowerCase());
      await upsertClub(club.name,selectedLeague.name,url);
      setClubs(prev=>prev.map(c=>c.id===club.id?{...c,logo:url}:c));
      if(selectedClub?.id===club.id)setSelectedClub(prev=>({...prev,logo:url}));
      showToast("Logo club mis à jour ✓");
    }catch(e){showToast("Erreur: "+e.message,"#EF4444");}
  }

  async function pastePlayerPhoto(p){
    setUploadingId(p.id);
    try{
      const url=await pasteImageToSupabase("player_"+p.name.replace(/\s/g,"_").toLowerCase());
      await updatePlayer(p.id,{photo_url:url,avatar_url:url});
      setPlayers(prev=>prev.map(pl=>pl.id===p.id?{...pl,photo_url:url}:pl));
      if(editingPlayer?.id===p.id)setEditingPlayer(prev=>({...prev,photo_url:url}));
      showToast("Photo mise à jour ✓");
    }catch(e){showToast("Erreur: "+e.message,"#EF4444");}
    setUploadingId(null);
  }

  async function savePlayer(p,fields){
    try{
      await updatePlayer(p.id,fields);
      setPlayers(prev=>prev.map(pl=>pl.id===p.id?{...pl,...fields}:pl));
      setEditingPlayer(null);
      showToast("Joueur mis à jour ✓");
    }catch(e){showToast("Erreur: "+e.message,"#EF4444");}
  }

  // ── NIVEAU 1 : Ligues ──────────────────────────────────────────
  if(!selectedLeague){
    const leagueMatches=globalSearch.length>=1
      ?leagues.filter(l=>l.name.toLowerCase().includes(globalSearch.toLowerCase()))
      :leagues;
    return(
      <div style={{padding:"16px"}}>
        <div style={{position:"relative",marginBottom:16}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",
            fontSize:16,color:"#6B7280",pointerEvents:"none"}}>⌕</span>
          <input className="form-input"
            placeholder="Joueur, ligue ou club… (ex: curry, NBA, Lakers)"
            value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)}
            style={{paddingLeft:38}}/>
          {globalSearch&&(
            <button onClick={()=>setGlobalSearch("")}
              style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                background:"transparent",border:"none",color:"#6B7280",
                cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
          )}
        </div>

        {/* Résultats joueurs depuis players */}
        {globalSearch.length>=2&&(()=>{
          const q=globalSearch.toLowerCase().trim();
          const playerHits=Object.values(leagues).length>0?[]:[];
          // Chercher dans players via fetch on-demand n'est pas possible ici
          // On affiche juste les ligues matchantes
          const leagueHits=leagues.filter(l=>l.name.toLowerCase().includes(q));
          if(leagueHits.length===0)return(
            <div style={{textAlign:"center",color:"#6B7280",fontSize:13,padding:"16px 0"}}>
              Aucune ligue trouvée — entre dans une ligue pour chercher les joueurs
            </div>
          );
          return null;
        })()}

        {!globalSearch&&<div style={{fontSize:12,color:"#6B7280",fontWeight:600,
          marginBottom:14,textTransform:"uppercase",letterSpacing:.8}}>Sélectionne une ligue</div>}
        {leagueMatches.map(lg=>(
          <div key={lg.id} style={{display:"flex",alignItems:"center",gap:12,
            padding:14,background:"#111827",border:"1px solid #1F2937",
            borderRadius:14,marginBottom:8,cursor:"pointer"}}
            onClick={()=>{setSelectedLeague(lg);setGlobalSearch("");}}>
            {lg.logo
              ?<img src={lg.logo} style={{width:44,height:44,objectFit:"contain",
                  borderRadius:10,background:"#1F2937",padding:4,flexShrink:0}} alt=""/>
              :<div style={{width:44,height:44,borderRadius:10,background:"#1F2937",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:22,flexShrink:0}}>◉</div>
            }
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700,color:"#E5E7EB"}}>{lg.name}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button className="icon-btn" title="Changer logo"
                onClick={e=>{e.stopPropagation();pasteLeagueLogo(lg);}}>⊕</button>
              <span style={{color:"#4B5563",fontSize:20}}>›</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── NIVEAU 2 : Clubs ───────────────────────────────────────────
  if(!selectedClub){
    return(
      <div style={{padding:"16px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <button onClick={()=>setSelectedLeague(null)}
            style={{background:"transparent",border:"none",color:"#A78BFA",
              cursor:"pointer",fontSize:24,padding:0,lineHeight:1}}>‹</button>
          {selectedLeague.logo
            ?<img src={selectedLeague.logo} style={{width:36,height:36,
                objectFit:"contain",borderRadius:8,background:"#1F2937",padding:4}} alt=""/>
            :<div style={{width:36,height:36,borderRadius:8,background:"#1F2937",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>◉</div>
          }
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:800,color:"#E5E7EB"}}>{selectedLeague.name}</div>
            <div style={{fontSize:11,color:"#6B7280"}}>{clubs.length} clubs</div>
          </div>
          <button className="icon-btn" onClick={()=>pasteLeagueLogo(selectedLeague)}
            title="Changer logo ligue">⊕</button>
        </div>
        {/* Recherche club */}
      <div style={{position:"relative",marginBottom:14}}>
        <input className="form-input"
          placeholder="Rechercher un club…"
          value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)}
          style={{paddingLeft:14}}/>
        {playerSearch&&<button onClick={()=>setPlayerSearch("")}
          style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
            background:"transparent",border:"none",color:"#6B7280",cursor:"pointer",fontSize:18}}>×</button>}
      </div>
      {loading&&<div style={{textAlign:"center",color:"#6B7280",padding:32}}>Chargement…</div>}
        {clubs.filter(c=>!playerSearch||c.name.toLowerCase().includes(playerSearch.toLowerCase())).map(club=>(
          <div key={club.id} style={{display:"flex",alignItems:"center",gap:12,
            padding:14,background:"#111827",border:"1px solid #1F2937",
            borderRadius:14,marginBottom:8,cursor:"pointer"}}
            onClick={()=>setSelectedClub(club)}>
            {club.logo
              ?<img src={club.logo} style={{width:44,height:44,objectFit:"contain",
                  borderRadius:10,background:"#1F2937",padding:4,flexShrink:0}} alt=""/>
              :<div style={{width:44,height:44,borderRadius:10,background:"#1F2937",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:20,flexShrink:0}}>◫</div>
            }
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",
                whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{club.name}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button className="icon-btn" title="Changer logo"
                onClick={e=>{e.stopPropagation();pasteClubLogo(club);}}>⊕</button>
              <span style={{color:"#4B5563",fontSize:20}}>›</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── NIVEAU 3 : Joueurs ─────────────────────────────────────────
  const searchLow=playerSearch.toLowerCase().trim();
  const filteredPlayers=[...players]
    .filter(p=>{
      if(!searchLow)return true;
      const n=p.name.toLowerCase();
      const words=n.split(" ");
      const initials=words.map(w=>w[0]||"").join("");
      return n.includes(searchLow)||initials.includes(searchLow);
    })
    .sort((a,b)=>{
      const pd=posRank(a.role)-posRank(b.role);
      if(pd!==0)return pd;
      return a.name.localeCompare(b.name);
    });

  const groups={};
  filteredPlayers.forEach(p=>{
    const pos=p.role||"Autre";
    if(!groups[pos])groups[pos]=[];
    groups[pos].push(p);
  });

  return(
    <div style={{padding:"16px"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
        <button onClick={()=>{setSelectedClub(null);setPlayerSearch("");}}
          style={{background:"transparent",border:"none",color:"#A78BFA",
            cursor:"pointer",fontSize:24,padding:0,lineHeight:1}}>‹</button>
        {selectedClub.logo
          ?<img src={selectedClub.logo} style={{width:36,height:36,
              objectFit:"contain",borderRadius:8,background:"#1F2937",padding:4}} alt=""/>
          :<div style={{width:36,height:36,borderRadius:8,background:"#1F2937",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>◫</div>
        }
        <div style={{flex:1}}>
          <div style={{fontSize:16,fontWeight:800,color:"#E5E7EB"}}>{selectedClub.name}</div>
          <div style={{fontSize:11,color:"#6B7280"}}>{players.length} joueurs</div>
        </div>
        <button className="icon-btn" onClick={()=>pasteClubLogo(selectedClub)}>⊕</button>
      </div>

      <div style={{position:"relative",marginBottom:14}}>
        <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",
          fontSize:16,color:"#6B7280",pointerEvents:"none"}}>⌕</span>
        <input className="form-input"
          placeholder="Rechercher… (ex: lj, curry)"
          value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)}
          style={{paddingLeft:38}}/>
        {playerSearch&&(
          <button onClick={()=>setPlayerSearch("")}
            style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
              background:"transparent",border:"none",color:"#6B7280",
              cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>
        )}
      </div>

      {loading&&<div style={{textAlign:"center",color:"#6B7280",padding:32}}>Chargement…</div>}
      {!loading&&filteredPlayers.length===0&&(
        <div className="empty">
          <div className="empty-icon" style={{fontSize:32,color:"#374151"}}>○</div>
          <div className="empty-text">{playerSearch?"Aucun résultat":"Aucun joueur"}</div>
        </div>
      )}

      {Object.entries(groups).map(([pos,pList])=>(
        <div key={pos} style={{marginBottom:4}}>
          <div style={{fontSize:10,fontWeight:800,color:"#7C3AED",
            letterSpacing:1.5,textTransform:"uppercase",
            padding:"8px 4px 4px",marginBottom:2}}>{pos}</div>
          {pList.map(p=>(
            <PlayerCard key={p.id} player={p} size={72}
              onClick={()=>setEditingPlayer(p)}
              onPhotoClick={()=>pastePlayerPhoto(p)}
              uploading={uploadingId===p.id}/>
          ))}
        </div>
      ))}

      {editingPlayer&&(
        <PlayerEditModal
          player={editingPlayer}
          leagues={leagues}
          clubs={clubs}
          onClose={()=>setEditingPlayer(null)}
          onPastePhoto={()=>pastePlayerPhoto(editingPlayer)}
          onSave={savePlayer}
          uploadingId={uploadingId}
        />
      )}
    </div>
  );
}

// ── MODAL ÉDITION JOUEUR ──────────────────────────────────────────────────────
function PlayerEditModal({player,leagues,clubs,onClose,onPastePhoto,onSave,uploadingId}){
  const[role,setRole]=useState(player.role||"");
  const[team,setTeam]=useState(player.team||"");
  const[game,setGame]=useState(player.game||"");
  const[saving,setSaving]=useState(false);

  const ROLES=["PG","SG","SF","PF","C","Guard","Wing","Forward","Big","G","F"];

  async function save(){
    if(saving)return;
    setSaving(true);
    await onSave(player,{role,team,game,league:game});
    setSaving(false);
  }

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle"/>

        {/* Photo + nom */}
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
          <div style={{position:"relative"}}>
            <PlayerPhoto url={player.photo_url||player.avatar_url} size={88}/>
            <div style={{position:"absolute",bottom:0,right:0,width:24,height:24,
              borderRadius:"50%",background:"#7C3AED",border:"2px solid #0F1629",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>
              {uploadingId===player.id?"...":"⊕"}
            </div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:17,fontWeight:800,color:"#E5E7EB",marginBottom:8}}>
              {player.name}
            </div>
            <button className="btn btn-secondary"
              style={{padding:"7px 14px",fontSize:12,width:"auto"}}
              onClick={onPastePhoto}
              disabled={uploadingId===player.id}>
              {uploadingId===player.id?"Upload…":"Coller une photo"}
            </button>
          </div>
        </div>

        {/* Ligue */}
        <div className="form-group">
          <label className="form-label">Ligue</label>
          <select className="form-select" value={game}
            onChange={e=>setGame(e.target.value)}>
            <option value="">Sélectionner…</option>
            {leagues.map(l=><option key={l.id} value={l.name}>{l.name}</option>)}
          </select>
        </div>

        {/* Club */}
        <div className="form-group">
          <label className="form-label">Club</label>
          {clubs.filter(c=>c.league===game).length>0?(
            <select className="form-select" value={team}
              onChange={e=>setTeam(e.target.value)}>
              <option value="">Sélectionner…</option>
              {clubs.filter(c=>c.league===game)
                .sort((a,b)=>a.name.localeCompare(b.name))
                .map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          ):(
            <input className="form-input" placeholder="Nom du club"
              value={team} onChange={e=>setTeam(e.target.value)}/>
          )}
        </div>

        {/* Position */}
        <div className="form-group">
          <label className="form-label">Position</label>
          <select className="form-select" value={role}
            onChange={e=>setRole(e.target.value)}>
            <option value="">Sélectionner…</option>
            {ROLES.map(r=><option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving?"Sauvegarde…":"Sauvegarder"}
        </button>
        <button className="btn btn-secondary" onClick={onClose}
          style={{marginTop:8}}>Annuler</button>
      </div>
    </div>
  );
}


// ── VUE SETTINGS ─────────────────────────────────────────────────────────────
function SettingsView({bookmakers,onUpdateBK,tipsters,onUpdateTip,showToast}){
  const[tab,setTab]=useState("bookmakers");
  const[showAdd,setShowAdd]=useState(false);
  const[showTeamAdd,setShowTeamAdd]=useState(false);
  const[editBK,setEditBK]=useState(null);
  const[showAddTip,setShowAddTip]=useState(false);

  // ── Bookmakers ──
  async function deleteBK(bk){
    if(!window.confirm("Supprimer "+bk.name+" ?"))return;
    try{
      await deleteBookmaker(bk.id);
      onUpdateBK();
      showToast(bk.name+" supprimé","#EF4444");
    }catch(e){ showToast("Erreur: "+e.message,"#EF4444"); }
  }

  // ── Tipsters ──
  async function deleteTip(t){
    if(!window.confirm("Supprimer "+t.name+" ?"))return;
    try{
      await deleteTipster(t.id);
      onUpdateTip();
      showToast(t.name+" supprimé","#EF4444");
    }catch(e){ showToast("Erreur: "+e.message,"#EF4444"); }
  }

  async function addTipster(){
    const name=prompt("Nom du tipster :");
    if(!name||!name.trim())return;
    const n=name.trim();
    if(tipsters.find(t=>t.name===n)){showToast(n+" existe déjà","#F59E0B");return;}
    try{
      await insertTipster({id:uuid(),name:n});
      onUpdateTip();
      showToast(n+" ajouté ✓");
    }catch(e){ showToast("Erreur: "+e.message,"#EF4444"); }
  }

  return(
    <div style={{padding:"16px"}}>
      {/* Tabs */}
      <div className="tabs">
        <button className={"tab"+(tab==="bookmakers"?" active":"")}
          onClick={()=>setTab("bookmakers")}>◉ BK</button>
        <button className={"tab"+(tab==="tipsters"?" active":"")}
          onClick={()=>setTab("tipsters")}>◎ Tips</button>
        <button className={"tab"+(tab==="edit"?" active":"")}
          onClick={()=>setTab("edit")}>✎ Édition</button>
      </div>

      {/* ── TAB BOOKMAKERS ── */}
      {tab==="bookmakers"&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:13,color:"#6B7280",fontWeight:600}}>
              {bookmakers.length} bookmaker{bookmakers.length!==1?"s":""}
            </div>
            <button className="btn btn-primary"
              style={{width:"auto",padding:"9px 18px",fontSize:13}}
              onClick={()=>{setEditBK(null);setShowAdd(true);}}>+ Ajouter</button>
          </div>

          {bookmakers.length===0&&(
            <div className="empty">
              <div className="empty-icon" style={{fontSize:32,color:"#374151"}}>◉</div>
              <div className="empty-text">Aucun bookmaker</div>
              <div className="empty-sub">Ajoute tes bookmakers pour les utiliser dans tes paris</div>
            </div>
          )}

          {bookmakers.map(bk=>(
            <div key={bk.id} className="bk-card">
              {bk.logo
                ?<img src={bk.logo} className="bk-logo" alt={bk.name}/>
                :<div className="bk-logo-placeholder">◉</div>
              }
              <div style={{flex:1,minWidth:0}}>
                <div className="bk-name">{bk.name}</div>
                {bk.url&&<div style={{fontSize:11,color:"#6B7280",marginTop:2}}>{bk.url}</div>}
              </div>
              <div className="bk-actions">
                <button className="icon-btn" title="Modifier"
                  onClick={()=>{setEditBK(bk);setShowAdd(true);}}>✎</button>
                <button className="icon-btn danger" title="Supprimer"
                  onClick={()=>deleteBK(bk)}>×</button>
              </div>
            </div>
          ))}

          {showAdd&&(
            <BKModal
              bk={editBK}
              existing={bookmakers.map(b=>b.name)}
              onClose={()=>{setShowAdd(false);setEditBK(null);}}
              onSave={async(newBK)=>{
                try{
                  if(editBK){
                    await updateBookmaker(editBK.id,{logo:newBK.logo,url:newBK.url});
                  }else{
                    await insertBookmaker({id:uuid(),name:newBK.name,logo:newBK.logo||null,url:newBK.url||null});
                  }
                  onUpdateBK();
                  setShowAdd(false);
                  setEditBK(null);
                  showToast((editBK?"Modifié: ":"Ajouté: ")+newBK.name);
                }catch(e){ showToast("Erreur: "+e.message,"#EF4444"); }
              }}
            />
          )}
        </>
      )}

      {/* ── TAB TIPSTERS ── */}
      {tab==="tipsters"&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:13,color:"#6B7280",fontWeight:600}}>
              {tipsters.length} tipster{tipsters.length!==1?"s":""}
            </div>
            <button className="btn btn-primary"
              style={{width:"auto",padding:"9px 18px",fontSize:13}}
              onClick={addTipster}>+ Ajouter</button>
          </div>

          {tipsters.length===0&&(
            <div className="empty">
              <div className="empty-icon" style={{fontSize:32,color:"#374151"}}>◎</div>
              <div className="empty-text">Aucun tipster</div>
              <div className="empty-sub">Ajoute tes tipsters pour les associer à tes paris</div>
            </div>
          )}

          {tipsters.map(t=>(
            <div key={t.id} className="bk-card">
              <div className="bk-logo-placeholder" style={{fontSize:20,color:"#374151"}}>◎</div>
              <div style={{flex:1}}>
                <div className="bk-name">{t.name}</div>
              </div>
              <div className="bk-actions">
                <button className="icon-btn danger" title="Supprimer"
                  onClick={()=>deleteTip(t)}>×</button>
              </div>
            </div>
          ))}
        </>
      )}

      {tab==="edit"&&<EditView showToast={showToast}/>}
    </div>
  );
}


// ── MODAL BOOKMAKER ───────────────────────────────────────────────────────────
function BKModal({bk,existing,onClose,onSave}){
  const[name,setName]=useState(bk?.name||"");
  const[logo,setLogo]=useState(bk?.logo||"");
  const[url,setUrl]=useState(bk?.url||"");
  const[uploading,setUploading]=useState(false);

  async function pasteLogo(){
    setUploading(true);
    try{
      const logoUrl=await pasteImageToSupabase("bk_"+(name||"logo"));
      setLogo(logoUrl);
    }catch(e){
      alert("⊕ "+e.message);
    }
    setUploading(false);
  }

  function save(){
    const n=name.trim();
    if(!n){alert("Le nom est obligatoire");return;}
    if(!bk&&existing.includes(n)){alert(n+" existe déjà");return;}
    onSave({name:n,logo:logo||null,url:url.trim()||null});
  }

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet">
        <div className="modal-handle"/>
        <div className="modal-title">{bk?"Modifier bookmaker":"Nouveau bookmaker"}</div>

        {/* Logo preview */}
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
          {logo
            ?<img src={logo} style={{width:64,height:64,borderRadius:14,objectFit:"contain",
                background:"#1F2937",padding:6}} alt="logo"/>
            :<div style={{width:64,height:64,borderRadius:14,background:"#1F2937",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>◉</div>
          }
          <div style={{flex:1}}>
            <button className="btn btn-secondary" style={{marginBottom:8}}
              onClick={pasteLogo} disabled={uploading}>
              {uploading?"Upload…":"Coller un logo"}
            </button>
            {logo&&(
              <button className="btn btn-danger"
                onClick={()=>setLogo("")}>Supprimer le logo</button>
            )}
          </div>
        </div>

        {/* Nom */}
        <div className="form-group">
          <label className="form-label">Nom *</label>
          <input className="form-input" placeholder="ex: Pinnacle"
            value={name} onChange={e=>setName(e.target.value)}
            disabled={!!bk}/>
          {bk&&<div style={{fontSize:11,color:"#6B7280",marginTop:4}}>
            Le nom ne peut pas être modifié</div>}
        </div>

        {/* URL optionnel */}
        <div className="form-group">
          <label className="form-label">Site web (optionnel)</label>
          <input className="form-input" placeholder="ex: pinnacle.com"
            value={url} onChange={e=>setUrl(e.target.value)}/>
        </div>

        <button className="btn btn-primary" onClick={save}>
          {bk?"Sauvegarder":"+ Ajouter"}
        </button>
        <button className="btn btn-secondary" onClick={onClose} style={{marginTop:8}}>
          Annuler
        </button>
      </div>
    </div>
  );
}


// ── APP PRINCIPAL ─────────────────────────────────────────────────────────────
export default function App(){
  const[bets,setBets]=useState([]);
  const[bookmakers,setBookmakers]=useState([]);
  const[tipsters,setTipsters]=useState([]);
  const[players,setPlayers]=useState([]);
  const[view,setView]=useState("home");
  const[loading,setLoading]=useState(true);
  const[showAdd,setShowAdd]=useState(false);
  const[showTeamAdd,setShowTeamAdd]=useState(false);
  const[selectedBet,setSelectedBet]=useState(null);
  const[editBet,setEditBet]=useState(null);
  const[syncing,setSyncing]=useState(false);
  const[lastSync,setLastSync]=useState(null);
  const{toast,show:showToast}=useToast();
  const pollRef=useRef(null);

  // Charger les joueurs, bookmakers, tipsters et logos ligues au démarrage
  useEffect(()=>{
    fetchPlayers().then(setPlayers).catch(()=>{});
    fetchBookmakers().then(setBookmakers).catch(()=>{});
    fetchTipsters().then(setTipsters).catch(()=>{});
    // Charger logos ligues depuis Supabase et les rendre globaux
    fetchLeagues().then(rows=>{
      const map={};
      rows.forEach(l=>{if(l.logo)map[l.name]=l.logo;});
      LEAGUE_LOGOS_DYNAMIC=map;
    }).catch(()=>{});
  },[]);

  // Charger les paris
  const loadBets=useCallback(async(silent=false)=>{
    if(!silent)setLoading(true);
    else setSyncing(true);
    try{
      const data=await fetchBets();
      setBets(data);
      setLastSync(new Date());
    }catch(e){
      if(!silent)console.error(e);
    }
    setLoading(false);
    setSyncing(false);
  },[]);

  // Chargement initial
  useEffect(()=>{loadBets();},[loadBets]);

  // Poll toutes les 30s quand l'app est visible
  useEffect(()=>{
    pollRef.current=setInterval(()=>{
      if(document.visibilityState==="visible")loadBets(true);
    },30000);
    const onVisible=()=>{if(document.visibilityState==="visible")loadBets(true);};
    document.addEventListener("visibilitychange",onVisible);
    return()=>{
      clearInterval(pollRef.current);
      document.removeEventListener("visibilitychange",onVisible);
    };
  },[loadBets]);

  function openEdit(bet){
    setSelectedBet(null);
    setEditBet(bet);
  }

  if(loading)return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",height:"100vh",gap:16}}>
      <div style={{width:48,height:48,borderRadius:16,
        background:"linear-gradient(135deg,#7C3AED,#3B82F6)",
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>◉</div>
      <div style={{color:"#6B7280",fontSize:14}}>Chargement…</div>
    </div>
  );

  return(
    <>
      <style>{CSS}</style>
      <div className="app">

        {/* Header */}
        <div className="header">
          <div>
            <div className="header-title">
              {view==="home"?"Accueil":view==="bets"?"Mes Paris":"Stats"}
            </div>
            {lastSync&&(
              <div style={{fontSize:10,color:"#4B5563",marginTop:2}}>
                {syncing?"Sync…":"↻ "+lastSync.toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit"})}
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <div style={{width:8,height:8,borderRadius:"50%",
              background:syncing?"#F59E0B":"#22C55E",
              boxShadow:"0 0 6px "+(syncing?"rgba(245,158,11,.8)":"rgba(34,197,94,.8)")}}/>
            <button onClick={()=>loadBets(true)}
              style={{background:"transparent",border:"none",color:"#6B7280",
                cursor:"pointer",fontSize:18,padding:"4px 8px"}}>↻</button>
          </div>
        </div>

        {/* Contenu */}
        <div style={{paddingTop:12}}>
          {view==="home"&&<HomeView bets={bets} players={players}/>}
          {view==="bets"&&<BetsView bets={bets} players={players} bookmakers={bookmakers} bkPhotos={Object.fromEntries(bookmakers.map(bk=>[bk.name,bk.logo]).filter(([,v])=>v))}
            onSelectBet={setSelectedBet} onEdit={openEdit}/>}
          {view==="stats"&&<StatsView bets={bets}/>}
          {view==="settings"&&<SettingsView
            bookmakers={bookmakers}
            onUpdateBK={()=>fetchBookmakers().then(setBookmakers).catch(()=>{})}
            tipsters={tipsters}
            onUpdateTip={()=>fetchTipsters().then(setTipsters).catch(()=>{})}
            showToast={showToast}
          />}
        </div>

        {/* Nav */}
        <nav className="nav">
          <button className={"nav-btn"+(view==="home"?" active":"")}
            onClick={()=>setView("home")}>
            <span className="nav-icon" style={{fontSize:22,fontWeight:300}}>⌂</span>ACCUEIL
          </button>
          <button className={"nav-btn"+(view==="bets"?" active":"")}
            onClick={()=>setView("bets")}>
            <span className="nav-icon" style={{fontSize:20}}>≡</span>MES PARIS
          </button>
          <button className="nav-add" onClick={()=>setShowAdd(true)} style={{fontSize:28,fontWeight:200}}>+</button>
          <button className={"nav-btn"+(view==="stats"?" active":"")}
            onClick={()=>setView("stats")}>
            <span className="nav-icon" style={{fontSize:20}}>◫</span>STATS
          </button>
          <button className={"nav-btn"+(view==="settings"?" active":"")}
            onClick={()=>setView("settings")}>
            <span className="nav-icon" style={{fontSize:20}}>◈</span>SETTINGS
          </button>
        </nav>

        {/* Modals */}
        {(showAdd||editBet)&&(
          <AddBetModal
            players={players}
            bookmakers={bookmakers.length>0?bookmakers.map(b=>b.name):DEFAULT_BOOKMAKERS}
            tipsters={tipsters}
            bookmarkerObjs={bookmakers}
            editBet={editBet}
            onClose={()=>{setShowAdd(false);setEditBet(null);}}
            onSave={()=>{
              loadBets(true);
              showToast(editBet?"Pari modifié ✓":"Pari ajouté ✓");
            }}
          />
        )}

{selectedBet&&(
          <BetDetailModal
            bet={selectedBet}
            players={players}
            onClose={()=>setSelectedBet(null)}
            onUpdate={()=>{loadBets(true);setSelectedBet(null);}}
            onDelete={()=>{loadBets(true);setSelectedBet(null);}}
          />
        )}

        {/* Toast */}
        {toast&&(
          <div className="toast" style={{borderColor:toast.color,color:toast.color}}>
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
}
// ── Helper formatName global ─────────────────────────────────────────────────
function formatName(name){
  if(!name)return"";
  return name.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(" ");
}

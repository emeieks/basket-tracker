import React,{useState,useEffect,useCallback,useRef,memo}from"react";

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

function formatName(name){
  if(!name)return"";
  return name.trim().split(/\s+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(" ");
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

// Charge TOUS les clubs d'un coup au démarrage pour construire le map teamName→logo
async function fetchAllClubs(){
  const r=await fetch(SUPA_URL+"/rest/v1/clubs?select=name,logo&order=name.asc",{headers:H});
  if(!r.ok)throw new Error("fetch all clubs: "+r.status);
  return r.json();
}

async function upsertClub(name,league,logo){
  const enc=v=>encodeURIComponent(v);
  const url=SUPA_URL+"/rest/v1/clubs?name=eq."+enc(name)+"&league=eq."+enc(league);
  const r=await fetch(url,{
    method:"PATCH",
    headers:{...H},
    body:JSON.stringify({logo}),
  });
  if(r.status===200||r.status===204||r.ok)return true;
  console.warn("upsertClub warning:",r.status,await r.text().catch(()=>""));
  return false;
}
// Sync logo sur TOUS les clubs du même nom (toutes ligues confondues)
async function syncClubLogoAllLeagues(name,logo){
  const enc=v=>encodeURIComponent(v);
  const r=await fetch(SUPA_URL+"/rest/v1/clubs?name=eq."+enc(name),{
    method:"PATCH",headers:{...H},body:JSON.stringify({logo}),
  });
  if(!r.ok)console.warn("syncClubLogoAllLeagues:",r.status);
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

async function fetchPlayers(){
  let all=[],offset=0,limit=500;
  while(true){
    const r=await fetch(
      SUPA_URL+"/rest/v1/players?select=name,game,team,role,photo_url,avatar_url,team_logo_url&order=name.asc&limit="+limit+"&offset="+offset,
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
    const rand=Math.random().toString(36).slice(2,7);
    const path="photos/players/"+safe+"_"+Date.now()+"_"+rand+"."+ext;
    let res=await fetch(SUPA_URL+"/storage/v1/object/avatars/"+path,{
      method:"POST",
      headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":blob.type,"x-upsert":"true"},
      body:blob,
    });
    if(!res.ok&&res.status===409){
      res=await fetch(SUPA_URL+"/storage/v1/object/avatars/"+path,{
        method:"PUT",
        headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":blob.type,"x-upsert":"true"},
        body:blob,
      });
    }
    if(!res.ok){const err=await res.text();throw new Error("Upload "+res.status+": "+err);}
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
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}

body{
  background:#18181B;
  color:#F2F2F7;
  font-family:'Outfit',system-ui,sans-serif;
  min-height:100vh;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
}
input,select,textarea,button{font-family:inherit;}
img{-webkit-backface-visibility:hidden;backface-visibility:hidden;transform:translateZ(0);}
::-webkit-scrollbar{display:none;}

.app{max-width:430px;margin:0 auto;min-height:100vh;padding-bottom:88px;}

/* ── NAV ── */
.nav{
  position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:430px;
  background:rgba(24,24,27,.96);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-top:1px solid rgba(255,255,255,.08);
  display:flex;align-items:center;z-index:100;
  padding:8px 0 calc(8px + env(safe-area-inset-bottom));
}
.nav-btn{
  flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;
  padding:4px 0;border:none;background:transparent;
  color:rgba(255,255,255,.25);
  font-size:9px;font-weight:700;cursor:pointer;
  letter-spacing:.8px;text-transform:uppercase;
  transition:color .15s;
}
.nav-btn.active{color:#A78BFA;}
.nav-icon{font-size:20px;line-height:1;}
.nav-add{
  width:48px;height:48px;border-radius:50%;
  background:#7C3AED;border:none;
  color:#fff;font-size:24px;font-weight:400;
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  margin-top:-16px;flex-shrink:0;
  transition:transform .12s;
}
.nav-add:active{transform:scale(.9);}

/* ── HEADER ── */
.header{padding:22px 20px 10px;display:flex;align-items:center;justify-content:space-between;}
.header-title{font-size:26px;font-weight:800;color:#fff;letter-spacing:-.5px;}

/* ── CARDS — carrées, minimalistes ── */
.card{background:#1C1C1F;border:1px solid #2A2A2E;border-radius:12px;padding:16px;margin-bottom:8px;}
.card-sm{background:#1C1C1F;border:1px solid #2A2A2E;border-radius:10px;padding:14px;margin-bottom:6px;}

/* ── BADGES ── */
.badge{display:inline-flex;align-items:center;border-radius:4px;padding:3px 8px;font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;}
.badge-won{background:rgba(255,255,255,.08);color:#fff;}
.badge-lost{background:rgba(255,255,255,.04);color:rgba(255,255,255,.4);}
.badge-pending{background:rgba(255,255,255,.06);color:rgba(255,255,255,.6);}
.badge-void{background:rgba(255,255,255,.04);color:rgba(255,255,255,.2);}

/* ── FORMS ── */
.form-group{margin-bottom:16px;}
.form-label{font-size:10px;font-weight:700;color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;display:block;}
.form-input{
  width:100%;
  background:linear-gradient(180deg,#1A1A1F 0%,#111114 100%);
  border:1px solid rgba(255,255,255,.09);
  border-top-color:rgba(255,255,255,.05);
  border-bottom-color:rgba(0,0,0,.4);
  border-radius:10px;padding:13px 14px;
  color:#E8E8F0;
  font-size:15px;font-family:inherit;outline:none;transition:border-color .15s;
  box-shadow:0 2px 6px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.04);
}
.form-input:focus{border-color:rgba(124,58,237,.5);box-shadow:0 0 0 3px rgba(124,58,237,.12),0 2px 6px rgba(0,0,0,.35);}
.form-input::placeholder{color:rgba(255,255,255,.22);}
.form-select{
  width:100%;
  background:linear-gradient(180deg,#1A1A1F 0%,#111114 100%);
  border:1px solid rgba(255,255,255,.09);
  border-top-color:rgba(255,255,255,.05);
  border-bottom-color:rgba(0,0,0,.4);
  border-radius:10px;padding:13px 14px;
  color:#E8E8F0;
  font-size:15px;font-family:inherit;outline:none;
  appearance:none;-webkit-appearance:none;cursor:pointer;
  box-shadow:0 2px 6px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.04);
}
.form-select:focus{border-color:rgba(124,58,237,.5);box-shadow:0 0 0 3px rgba(124,58,237,.12),0 2px 6px rgba(0,0,0,.35);}
.form-select option{background:#1A1A1F;color:#E8E8F0;}

/* ── BUTTONS ── */
.btn{border:none;border-radius:10px;padding:14px 20px;font-size:15px;font-weight:700;cursor:pointer;transition:opacity .12s;width:100%;font-family:inherit;}
.btn:active{opacity:.7;}
.btn-primary{background:#7C3AED;color:#fff;}
.btn-secondary{background:transparent;color:rgba(255,255,255,.35);border:1px solid #2A2A2E;}
.btn-danger{background:transparent;color:rgba(255,80,80,.8);border:1px solid rgba(255,80,80,.2);}
.btn-sm{padding:8px 14px;font-size:13px;border-radius:8px;}

/* ── PLAYER AVATAR ── */
.player-avatar-wrap{position:relative;flex-shrink:0;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;border-radius:8px;}
.player-avatar-wrap .team-logo-bg{position:absolute;object-fit:contain;pointer-events:none;}
.player-avatar-wrap .player-img{position:relative;z-index:1;object-fit:contain;object-position:50% 85%;-webkit-backface-visibility:hidden;backface-visibility:hidden;transform:translateZ(0);}
.player-avatar-wrap .player-placeholder{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;width:100%;height:100%;}

/* ── AUTOCOMPLETE ── */
.autocomplete{position:relative;}
.autocomplete-list{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#1C1C1F;border:1px solid #2A2A2E;border-radius:10px;max-height:260px;overflow-y:auto;z-index:200;box-shadow:0 12px 40px rgba(0,0,0,.7);}
.autocomplete-item{display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;transition:background .1s;}
.autocomplete-item:hover,.autocomplete-item.active{background:rgba(255,255,255,.04);}
.player-name{font-size:14px;font-weight:600;color:#F2F2F7;}
.player-meta{font-size:11px;color:rgba(255,255,255,.3);}

/* ── BET ROW ── */
.bet-row{display:flex;align-items:center;gap:12px;padding:13px 16px;cursor:pointer;transition:background .1s;}
.bet-row:active{background:rgba(255,255,255,.02);}
.bet-info{flex:1;min-width:0;}
.bet-player{font-size:14px;font-weight:700;color:#F2F2F7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bet-desc{font-size:12px;color:rgba(255,255,255,.3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bet-right{text-align:right;flex-shrink:0;}
.bet-profit{font-size:16px;font-weight:800;letter-spacing:-.3px;}
.bet-profit.pos{color:#00E676;}
.bet-profit.neg{color:#F87171;}
.bet-profit.neu{color:rgba(255,255,255,.3);}
.bet-odds{font-size:11px;color:rgba(255,255,255,.2);margin-top:2px;}

/* ── STATUS BUTTONS ── */
.status-row{display:flex;gap:6px;margin-top:0;}
.status-btn{flex:1;padding:11px 6px;border-radius:10px;border:1px solid rgba(255,255,255,.08);border-bottom-color:rgba(0,0,0,.4);font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;background:linear-gradient(180deg,#1A1A1F 0%,#111114 100%);color:rgba(255,255,255,.3);font-family:inherit;letter-spacing:.2px;box-shadow:0 2px 6px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04);}
.status-btn.won.active{background:rgba(0,230,118,.12);border-color:rgba(0,230,118,.35);color:#00E676;}
.status-btn.lost.active{background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.3);color:#F87171;}
.status-btn.pending.active{background:rgba(124,58,237,.12);border-color:rgba(124,58,237,.35);color:#A78BFA;}
.status-btn.void.active{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.15);color:rgba(255,255,255,.45);}

/* ── STATS GRID ── */
.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;}
.stat-card{background:#1C1C1F;border:1px solid #2A2A2E;border-radius:12px;padding:16px;}
.stat-value{font-size:26px;font-weight:800;letter-spacing:-.5px;margin-bottom:3px;}
.stat-label{font-size:10px;color:rgba(255,255,255,.28);font-weight:600;text-transform:uppercase;letter-spacing:.9px;}

/* ── TOAST ── */
.toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#2A2A2E;border:1px solid #2A2A2A;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:600;color:#F2F2F7;z-index:999;pointer-events:none;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,.5);}

/* ── MODAL / SHEET ── */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:300;display:flex;align-items:flex-end;}
.modal-sheet{background:#161619;border-radius:16px 16px 0 0;width:100%;max-height:93vh;overflow-y:auto;padding:12px 18px calc(24px + env(safe-area-inset-bottom));border:1px solid #2A2A2E;border-bottom:none;}
.modal-handle{width:32px;height:3px;background:rgba(255,255,255,.12);border-radius:2px;margin:0 auto 20px;}
.modal-title{font-size:18px;font-weight:800;color:#fff;margin-bottom:18px;letter-spacing:-.2px;}

/* ── TABS ── */
.tabs{display:flex;gap:2px;background:#1C1C1F;border-radius:8px;padding:3px;margin-bottom:14px;}
.tab{flex:1;padding:8px;border:none;background:transparent;color:rgba(255,255,255,.28);font-size:12px;font-weight:700;border-radius:6px;cursor:pointer;transition:all .15s;font-family:inherit;}
.tab.active{background:#7C3AED;color:#fff;}

/* ── SEGMENT ── */
.segment{display:flex;background:#1C1C1F;border-radius:8px;padding:3px;gap:2px;}
.seg-btn{flex:1;padding:9px;border:none;background:transparent;color:rgba(255,255,255,.3);font-size:13px;font-weight:600;border-radius:6px;cursor:pointer;transition:all .12s;font-family:inherit;}
.seg-btn.active{background:#7C3AED;color:#fff;}

/* ── SETTINGS ── */
.bk-card{display:flex;align-items:center;gap:12px;padding:14px 16px;background:#1C1C1F;border:1px solid #2A2A2E;border-radius:12px;margin-bottom:6px;}
.bk-logo{width:38px;height:38px;border-radius:8px;object-fit:contain;background:#2A2A2E;padding:4px;flex-shrink:0;}
.bk-logo-placeholder{width:38px;height:38px;border-radius:8px;background:#2A2A2E;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
.bk-name{font-size:14px;font-weight:700;color:#F2F2F7;}
.bk-actions{display:flex;gap:6px;margin-left:auto;}
.icon-btn{width:30px;height:30px;border-radius:7px;border:1px solid #2A2A2E;background:transparent;color:rgba(255,255,255,.28);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .12s;}
.icon-btn:hover{border-color:rgba(255,255,255,.2);color:#fff;}
.icon-btn.danger:hover{border-color:rgba(255,80,80,.3);color:rgba(255,80,80,.8);}

/* ── PROFIT BIG ── */
.profit-big{font-size:44px;font-weight:900;letter-spacing:-2px;line-height:1;}
.profit-big.pos{color:#00E676;}.profit-big.neg{color:#F87171;}.profit-big.neu{color:#fff;}

/* ── EMPTY STATE ── */
.empty{text-align:center;padding:60px 20px;}
.empty-icon{font-size:32px;margin-bottom:12px;opacity:.2;}
.empty-text{font-size:15px;font-weight:700;color:rgba(255,255,255,.3);}
.empty-sub{font-size:13px;margin-top:6px;color:rgba(255,255,255,.15);}

/* ── FILTERS ── */
.filter-row{display:flex;gap:6px;overflow-x:auto;padding:0 20px 14px;scrollbar-width:none;}
.filter-row::-webkit-scrollbar{display:none;}
.filter-chip{flex-shrink:0;padding:7px 16px;border-radius:20px;border:1px solid #2A2A2E;background:transparent;color:rgba(255,255,255,.3);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .12s;font-family:inherit;}
.filter-chip.active{background:rgba(124,58,237,.15);border-color:rgba(124,58,237,.4);color:#A78BFA;}
`;

// ── LEAGUE LOGOS (dynamique depuis Supabase) ─────────────────────────────────
let LEAGUE_LOGOS_DYNAMIC={};
function getLeagueLogo(game,leagueLogos={}){
  if(leagueLogos[game])return leagueLogos[game];
  if(LEAGUE_LOGOS_DYNAMIC[game])return LEAGUE_LOGOS_DYNAMIC[game];
  return null;
}

// ── CLUB LOGOS MAP global (teamName → logo URL) ───────────────────────────────
// Chargé au démarrage depuis la table clubs (ce que tu uploades dans Édition).
// PRIORITÉ : logo du club (Édition) > team_logo_url du joueur
let CLUB_LOGOS_MAP={};
function getTeamLogo(teamName,playerTeamLogoUrl=null){
  // Priorité 1 : logo du club depuis Édition (table clubs) — toujours le plus à jour
  if(teamName&&CLUB_LOGOS_MAP[teamName])return CLUB_LOGOS_MAP[teamName];
  // Priorité 2 : team_logo_url propagé sur le joueur (fallback si club pas encore dans map)
  if(playerTeamLogoUrl)return playerTeamLogoUrl;
  return null;
}

// ── COULEURS ÉQUIPES ──────────────────────────────────────────────────────────
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

function getTeamColor(team){
  if(!team)return null;
  return TEAM_COLORS[team]||null;
}

// ── COMPOSANT UNIVERSEL : Avatar joueur avec logo équipe en watermark ─────────
// w = largeur totale du conteneur, h = hauteur
// teamLogoUrl = team_logo_url du joueur (peut être null → fallback CLUB_LOGOS_MAP)
// photoUrl = photo du joueur
// teamName = nom de l'équipe → utilisé pour couleurs ET pour lookup dans CLUB_LOGOS_MAP
// round = true pour cercle, false pour rectangle arrondi
// logoSize = taille du logo watermark en ratio (0..1), défaut 0.75
const PlayerAvatar=memo(function PlayerAvatar({
  w=70,h=51,
  photoUrl=null,
  teamLogoUrl=null,   // team_logo_url direct du joueur
  teamName=null,
  round=false,
  logoSize=0.75,
  style={},
}){
  const[photoErr,setPhotoErr]=useState(false);
  const[logoErr,setLogoErr]=useState(false);
  const tc=getTeamColor(teamName);
  const pc=tc?.p||"#1E1E1E";
  const sc=tc?.s||"#374151";
  const borderR=round?"50%":"10px";
  const lgW=Math.round(w*logoSize);
  const lgH=Math.round(h*logoSize);
  // Résolution automatique : joueur → CLUB_LOGOS_MAP → null
  const resolvedLogo=getTeamLogo(teamName,teamLogoUrl);
  const hasLogo=resolvedLogo&&!logoErr;
  const hasPhoto=photoUrl&&!photoErr;

  return(
    <div style={{
      width:w,height:h,flexShrink:0,
      position:"relative",overflow:"hidden",
      borderRadius:borderR,
      background:`linear-gradient(160deg,${pc}22 0%,${sc}18 100%)`,
      display:"flex",alignItems:"flex-end",justifyContent:"center",
      ...style
    }}>
      {/* Logo équipe en watermark — très grand, bien visible */}
      {hasLogo&&(
        <img
          src={resolvedLogo}
          alt=""
          onError={()=>setLogoErr(true)}
          style={{
            position:"absolute",
            top:"50%",
            left:"50%",
            transform:"translate(-50%,-42%)",
            width:"140%",
            height:"140%",
            objectFit:"contain",
            opacity:0.45,
            filter:"saturate(0.7)",
            pointerEvents:"none",
            zIndex:0,
          }}
        />
      )}

      {/* Photo joueur */}
      {hasPhoto?(
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={()=>setPhotoErr(true)}
          style={{
            position:"relative",
            zIndex:1,
            width:w,
            height:h,
            objectFit:"contain",
            objectPosition:"50% 85%",
            WebkitBackfaceVisibility:"hidden",
            backfaceVisibility:"hidden",
            transform:"translateZ(0)",
          }}
        />
      ):(
        <span style={{
          position:"relative",zIndex:1,
          fontSize:Math.round(h*0.42),
          paddingBottom:4,
          color:"#4B5563",
        }}>○</span>
      )}
    </div>
  );
});

// ── BOOKMAKERS ────────────────────────────────────────────────────────────────
const DEFAULT_BOOKMAKERS=["Pinnacle","ps3838","Bet365","Unibet","Winamax","Betclic","Bwin","1xBet","Betway","DraftKings","FanDuel","BetMGM","Autre"];
const STATS_TYPES=["Points","Rebonds","Assists","Points+Rebonds","Points+Assists","Points+Rebonds+Assists","3 Points Made","Steals","Blocks","Turnovers","Fantasy Score","Double-Double","Minutes"];

// ── TOAST ─────────────────────────────────────────────────────────────────────
function useToast(){
  const[toast,setToast]=useState(null);
  const show=useCallback((msg,color="#00E676")=>{
    setToast({msg,color});
    setTimeout(()=>setToast(null),2500);
  },[]);
  return{toast,show};
}

// ── PLAYER CARD (EditView) ─────────────────────────────────────────────────────
const PlayerCard=memo(function PlayerCard({player,size=72,clubLogo=null,onClick,onPhotoClick,uploading=false}){
  const photo=player.photo_url||player.avatar_url;
  // clubLogo = logo uploadé dans Édition (selectedClub.logo) — priorité absolue
  const teamLogoUrl=clubLogo||getTeamLogo(player.team,player.team_logo_url)||null;
  const tc=getTeamColor(player.team);
  const primaryColor=tc?.p||"#1E1E1E";
  const secondaryColor=tc?.s||"#374151";
  const displayName=formatName(player.name);
  const photoW=Math.round(size*1.37);

  return(
    <div onClick={onClick}
      style={{display:"flex",alignItems:"center",gap:12,
        padding:"8px 12px",
        background:"#1C1C1F",
        border:"1px solid rgba(255,255,255,.05)",
        borderRadius:10,marginBottom:6,cursor:"pointer",
        position:"relative",overflow:"hidden",
        transition:"border-color .15s"}}>
      <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,
        background:`linear-gradient(180deg,${primaryColor},${secondaryColor})`}}/>

      <PlayerAvatar
        w={photoW} h={size}
        photoUrl={photo}
        teamLogoUrl={teamLogoUrl}
        teamName={player.team}
        round={false}
        logoSize={0.72}
      />

      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:700,color:"#F2F2F7",
          whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
          letterSpacing:.1}}>{displayName}</div>
        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
          {player.role&&<span style={{
            fontSize:10,fontWeight:800,color:primaryColor,
            background:`${primaryColor}22`,
            border:`1px solid ${primaryColor}44`,
            borderRadius:5,padding:"1px 6px",letterSpacing:.5}}>{player.role}</span>}
          {player.game&&getLeagueLogo(player.game)&&(
            <img src={getLeagueLogo(player.game)} alt={player.game}
              style={{width:14,height:14,objectFit:"contain",opacity:.85}}/>
          )}
          {player.game&&!getLeagueLogo(player.game)&&(
            <span style={{fontSize:10,color:"rgba(255,255,255,.28)"}}>{player.game}</span>
          )}
        </div>
      </div>

      {onPhotoClick&&(
        <button disabled={uploading}
          onClick={e=>{e.stopPropagation();onPhotoClick();}}
          style={{flexShrink:0,width:32,height:32,borderRadius:9,
            border:"1px solid rgba(255,255,255,.08)",background:"transparent",
            color:"rgba(255,255,255,.28)",cursor:"pointer",fontSize:15,
            display:"flex",alignItems:"center",justifyContent:"center"}}>
          {uploading?"...":"⊕"}
        </button>
      )}
    </div>
  );
});

// ── AUTOCOMPLETE JOUEUR ───────────────────────────────────────────────────────
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
              {/* Avatar avec logo dans l'autocomplete */}
              <PlayerAvatar
                w={48} h={36}
                photoUrl={p.photo_url||p.avatar_url}
                teamLogoUrl={p.team_logo_url||null}
                teamName={p.team}
                round={false}
                logoSize={0.7}
              />
              <div>
                <div className="player-name">{formatName(p.name)}</div>
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

// ── FORMULAIRE AJOUT/EDIT PARI ────────────────────────────────────────────────
function AddBetModal({players,bookmakers,bkPhotos={},tipsters=[],onSave,onClose,editBet=null}){
  const[step,setStep]=useState(editBet?"form":"search");
  const[search,setSearch]=useState("");
  const[selectedType,setSelectedType]=useState(null);
  const[saving,setSaving]=useState(false);
  const[lockedBK,setLockedBK]=useState(false);
  const[lockedTip,setLockedTip]=useState(false);
  const[winW,setWinW]=useState(window.innerWidth);
  useEffect(()=>{const h=()=>setWinW(window.innerWidth);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h);},[]);
  const isDesktop=winW>=768;
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

  const searchLow=search.toLowerCase().trim();
  const playerResults=searchLow.length>=1
    ?players.filter(p=>{
        const n=p.name.toLowerCase();
        const words=n.split(" ");
        const initials=words.map(w=>w[0]||"").join("");
        return n.includes(searchLow)||initials.includes(searchLow);
      }).slice(0,6)
    :[];

  const allTeams=searchLow.length>=1
    ?[...new Set(players.map(p=>p.team).filter(Boolean))]
        .filter(t=>t.toLowerCase().includes(searchLow))
        .slice(0,4)
    :[];

  function selectPlayer(p){
    f("player",p.name);f("playerObj",p);
    if(p.game)f("game",p.game);
    setSelectedType({type:"player",data:p});
    setStep("form");
  }

  function selectTeam(teamName){
    const playerOfTeam=players.find(p=>p.team===teamName);
    const game=playerOfTeam?.game||"";
    f("team",teamName);f("game",game);
    setSelectedType({type:"team",data:{name:teamName,game}});
    setStep("form");
  }

  async function submit(){
    const odds=parseFloat(form.odds);
    const stake=parseFloat(form.stake);
    if(!odds||!stake){alert("Cote et mise obligatoires");return;}
    const savedBK=lockedBK?form.bookmaker:null;
    const savedTip=lockedTip?form.tipster:null;
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
        notes:null,bet_type:"team",
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
        tipster:form.tipster||null,notes:null,bet_type:"player",
      };
    }
    setSaving(true);
    try{
      if(editBet)await updateBet(editBet.id,bet);
      else await insertBet({...bet,id:uuid()});
      await onSave();
      if(lockedBK||lockedTip){
        // Garder locked fields, reset le reste, retour à la recherche
        setStep("search");
        setForm({
          player:"",playerObj:null,stat:"Points",ou:"Over",line:"",
          odds:"",stake:"",
          bookmaker:savedBK||bookmakers[0]||"",
          status:"pending",game:"",
          tipster:savedTip||"",
          notes:"",betType:"moneyline",team:"",opponent:"",
        });
      }else{
        onClose();
      }
    }catch(e){alert("Erreur: "+e.message);}
    setSaving(false);
  }

  const tc=getTeamColor(isTeamBet?form.team:(form.playerObj?.team||""));
  const pc=tc?.p||"#EBEBEB";

  // ── ÉTAPE 1 : Recherche (pleine page) ────────────────────────
  if(step==="search")return(
    <div style={{position:"fixed",inset:0,background:"#08090E",zIndex:200,
      display:"flex",flexDirection:"column",overflowY:"auto"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:12,
        padding:"16px 16px 12px",borderBottom:"1px solid rgba(255,255,255,.06)",
        flexShrink:0}}>
        <button onClick={onClose}
          style={{width:36,height:36,borderRadius:"50%",
            background:"rgba(255,255,255,.08)",border:"none",
            color:"#F2F2F7",fontSize:20,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>‹</button>
        <div style={{fontSize:17,fontWeight:800,color:"#F2F2F7"}}>Nouveau pari</div>
      </div>

      <div style={{padding:"14px 14px 0",flex:1}}>
        {/* Barre de recherche */}
        <div style={{position:"relative",marginBottom:16}}>
          <span style={{position:"absolute",left:14,top:"50%",
            transform:"translateY(-50%)",fontSize:17,color:"#4B5563",
            pointerEvents:"none"}}>⌕</span>
          <input autoFocus
            placeholder="Joueur ou équipe… (ex: lj, BOS, Lakers)"
            value={search} onChange={e=>setSearch(e.target.value)}
            style={{
              width:"100%",padding:"13px 36px 13px 42px",
              background:"rgba(255,255,255,.06)",
              border:"1px solid rgba(255,255,255,.1)",
              borderRadius:10,color:"#F2F2F7",fontSize:15,
              outline:"none",boxSizing:"border-box",
            }}/>
          {search&&<button onClick={()=>setSearch("")}
            style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
              background:"transparent",border:"none",color:"rgba(255,255,255,.28)",
              cursor:"pointer",fontSize:22,lineHeight:1}}>×</button>}
        </div>

        {allTeams.length>0&&(
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,fontWeight:800,color:"rgba(255,255,255,.6)",
              letterSpacing:1.5,textTransform:"uppercase",padding:"4px 0 6px"}}>◉ Équipes</div>
            {allTeams.map(team=>{
              const tc2=getTeamColor(team);
              const pc2=tc2?.p||"#1E1E1E";
              const sc2=tc2?.s||"#374151";
              const playerOfTeam=players.find(p=>p.team===team);
              const teamLogoUrl=playerOfTeam?.team_logo_url||null;
              return(
                <div key={team} onClick={()=>selectTeam(team)}
                  style={{display:"flex",alignItems:"center",gap:12,
                    padding:"10px 12px",background:"#1C1C1F",
                    border:"1px solid rgba(245,158,11,.2)",
                    borderRadius:12,marginBottom:6,cursor:"pointer"}}>
                  {/* Logo équipe ou cercle couleur */}
                  {(()=>{const tl=getTeamLogo(team,teamLogoUrl);return tl?(
                    <img src={tl} alt={team}
                      style={{width:40,height:40,objectFit:"contain",borderRadius:8,
                        background:"#2A2A2E",padding:3,flexShrink:0}}/>
                  ):(
                    <div style={{width:40,height:40,borderRadius:"50%",flexShrink:0,
                      background:`linear-gradient(135deg,${pc2}CC,${sc2}88)`,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      border:`2px solid ${pc2}44`,fontSize:18}}>◉</div>
                  );})()}
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#F2F2F7"}}>{team}</div>
                    {playerOfTeam?.game&&<div style={{fontSize:11,color:"rgba(255,255,255,.28)"}}>{playerOfTeam.game}</div>}
                  </div>
                  <span style={{fontSize:9,fontWeight:800,color:"rgba(255,255,255,.6)",
                    background:"rgba(245,158,11,.12)",border:"1px solid rgba(245,158,11,.25)",
                    borderRadius:5,padding:"2px 7px"}}>ÉQUIPE</span>
                </div>
              );
            })}
          </div>
        )}

        {playerResults.length>0&&(
          <div>
            <div style={{fontSize:10,fontWeight:800,color:"rgba(255,255,255,.6)",
              letterSpacing:1.5,textTransform:"uppercase",padding:"4px 0 6px"}}>○ Joueurs</div>
            {playerResults.map(p=>{
              const tc2=getTeamColor(p.team);
              const pc2=tc2?.p||"#1E1E1E";
              const sc2=tc2?.s||"#374151";
              return(
                <div key={p.name} onClick={()=>selectPlayer(p)}
                  style={{display:"flex",alignItems:"center",gap:12,
                    padding:"10px 12px",background:"#1C1C1F",
                    border:"1px solid rgba(255,255,255,.06)",
                    borderRadius:12,marginBottom:6,cursor:"pointer"}}>
                  {/* PlayerAvatar dans la recherche */}
                  <div style={{
                    width:56,height:56,borderRadius:"50%",flexShrink:0,
                    background:`linear-gradient(135deg,${pc2}CC,${sc2}88)`,
                    border:`2px solid ${pc2}44`,overflow:"hidden",
                    position:"relative",display:"flex",alignItems:"flex-end",justifyContent:"center",
                  }}>
                    {getTeamLogo(p.team,p.team_logo_url)&&(
                      <img src={getTeamLogo(p.team,p.team_logo_url)} alt=""
                        style={{position:"absolute",width:"140%",height:"140%",
                          objectFit:"contain",opacity:.45,
                          top:"50%",left:"50%",transform:"translate(-50%,-42%)",
                          filter:"saturate(0.7)",
                          pointerEvents:"none",zIndex:0}}/>
                    )}
                    {(p.photo_url||p.avatar_url)?(
                      <img src={p.photo_url||p.avatar_url} loading="lazy" decoding="async"
                        style={{width:"100%",height:"100%",objectFit:"contain",
                          objectPosition:"50% 85%",position:"relative",zIndex:1,
                          WebkitBackfaceVisibility:"hidden",transform:"translateZ(0)"}}/>
                    ):(
                      <span style={{fontSize:24,color:"#4B5563",position:"relative",zIndex:1}}>○</span>
                    )}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:"#F2F2F7",
                      whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {formatName(p.name)}
                    </div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,.28)"}}>
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
        {search.length===0&&playerResults.length===0&&allTeams.length===0&&(
          <div style={{textAlign:"center",padding:"60px 0",color:"rgba(255,255,255,.2)",fontSize:14}}>
            Tape le nom d'un joueur ou d'une équipe
          </div>
        )}
      </div>
    </div>
  );

  // ── ÉTAPE 2 : Formulaire ──────────────────────────────────────
  const avatarPlayerObj=isTeamBet?null:form.playerObj;
  const avatarTeamLogoUrl=avatarPlayerObj?.team_logo_url||null;

  // ── helpers header ESPN ──
  const playerPhoto = !isTeamBet && (form.playerObj?.photo_url||form.playerObj?.avatar_url);
  const teamLogoHeader = isTeamBet
    ? getTeamLogo(form.team, players.find(p=>p.team===form.team)?.team_logo_url||null)
    : getTeamLogo(form.playerObj?.team, avatarTeamLogoUrl);
  const playerPosition = form.playerObj?.position||"";
  const playerTeam = form.playerObj?.team||form.game||"";

  // Résumé du pari (rempli au fur et à mesure)
  const betSummaryParts=[];
  if(!isTeamBet&&form.ou&&form.line&&form.stat)
    betSummaryParts.push(`${form.ou} ${form.line} ${form.stat}`);
  if(isTeamBet&&form.betType){
    if(form.betType==="moneyline") betSummaryParts.push(`${form.team} gagne`);
    else if(form.betType==="handicap"&&form.line) betSummaryParts.push(`Handicap ${form.line}`);
    else if(form.betType==="total"&&form.line) betSummaryParts.push(`Total ${form.ou||"Over"} ${form.line}`);
  }
  const betLine = betSummaryParts.join(" · ");

  return(
    <div style={{position:"fixed",inset:0,background:"#08090E",zIndex:200,
      display:"flex",flexDirection:"column",overflowY:"auto"}}>

      {/* ══ HERO — card style image ref ══ */}
      {(()=>{
        /* calcul profit */
        const stake=parseFloat(form.stake)||0;
        const odds=parseFloat(form.odds)||1;
        let profitStr="",profitColor="#fff";
        if(form.stake&&form.odds){
          if(form.status==="won"){profitStr="+"+(((odds-1)*stake).toFixed(0))+"€";profitColor="#00E676";}
          else if(form.status==="lost"){profitStr="-"+stake.toFixed(0)+"€";profitColor="#F87171";}
          else{profitStr="+"+(((odds-1)*stake).toFixed(0))+"€";profitColor="rgba(255,255,255,.4)";}
        }

        const parts=(form.player||"").trim().split(/\s+/);
        const firstName=parts[0]?parts[0].charAt(0).toUpperCase()+parts[0].slice(1).toLowerCase():"";
        const lastName=parts.slice(1).map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(" ");
        const displayName=isTeamBet?form.team:(lastName||firstName);
        const displayFirst=isTeamBet?null:firstName;

        const leagueName=form.league||"NBA";

        return(
          <div style={{padding:"10px 16px 0",flexShrink:0}}>
            {/* Bouton retour */}
            <button onClick={editBet?onClose:()=>setStep("search")}
              style={{background:"none",border:"none",color:"rgba(255,255,255,.5)",
                fontSize:22,cursor:"pointer",padding:"4px 0 10px",display:"block",lineHeight:1}}>‹</button>

            {/* Card hero */}
            <div style={{
              borderRadius:18,
              overflow:"hidden",
              position:"relative",
              height:isDesktop?210:180,
              background:pc?`linear-gradient(135deg,${pc}CC 0%,${pc}55 60%,#111318 100%)`:"#1C1C22",
              boxShadow:`0 8px 40px ${pc}44`,
            }}>
              {/* Overlay sombre gauche pour lisibilité texte */}
              <div style={{position:"absolute",inset:0,
                background:"linear-gradient(to right,rgba(0,0,0,.6) 0%,rgba(0,0,0,.3) 50%,rgba(0,0,0,.0) 100%)",
                zIndex:1,pointerEvents:"none"}}/>

              {/* Logo équipe en arrière-plan — zone droite seulement, derrière la photo */}
              {teamLogoHeader&&(
                <div style={{position:"absolute",right:0,top:0,bottom:0,
                  width:"60%",zIndex:2,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  pointerEvents:"none"}}>
                  <img src={teamLogoHeader} alt=""
                    style={{width:isDesktop?190:150,height:isDesktop?190:150,
                      objectFit:"contain",opacity:.28,
                      filter:"blur(0.3px)"}}/>
                </div>
              )}

              {/* Photo joueur — par-dessus le logo, zIndex:3 */}
              {playerPhoto&&(
                <img src={playerPhoto} alt={form.player}
                  style={{position:"absolute",right:0,bottom:0,
                    height:"115%",width:"auto",maxWidth:"52%",
                    objectFit:"cover",objectPosition:"50% 10%",zIndex:3,
                    filter:"brightness(1.2) contrast(1.05)",
                    maskImage:"linear-gradient(to left,black 40%,transparent 100%),linear-gradient(to bottom,transparent 0%,black 8%,black 75%,transparent 100%)",
                    maskComposite:"intersect",
                    WebkitMaskImage:"linear-gradient(to left,black 40%,transparent 100%),linear-gradient(to bottom,transparent 0%,black 8%,black 75%,transparent 100%)",
                    WebkitMaskComposite:"source-in"}}/>
              )}

              {/* Texte — gauche, zIndex:4 */}
              <div style={{position:"absolute",left:0,top:0,bottom:0,zIndex:4,
                width:"58%",
                padding:isDesktop?"16px 20px":"13px 15px",
                display:"flex",flexDirection:"column",justifyContent:"space-between"}}>

                {/* Nom + club — haut */}
                <div>
                  {!isTeamBet&&displayFirst&&(
                    <div style={{fontSize:isDesktop?14:12,fontWeight:500,
                      color:"rgba(255,255,255,.55)",lineHeight:1.2,marginBottom:1}}>
                      {displayFirst}
                    </div>
                  )}
                  {/* Nom sur UNE seule ligne — Barlow Condensed */}
                  <div style={{fontSize:isDesktop?44:32,fontWeight:900,color:"#fff",
                    letterSpacing:.5,lineHeight:1,marginBottom:6,
                    fontFamily:"'Barlow Condensed',sans-serif",textTransform:"uppercase",
                    whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {displayName}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:5}}>
                    {teamLogoHeader&&(
                      <img src={teamLogoHeader} alt=""
                        style={{width:16,height:16,objectFit:"contain",opacity:.85,flexShrink:0}}/>
                    )}
                    {(playerTeam||form.team)&&(
                      <span style={{fontSize:12,fontWeight:600,color:"rgba(255,255,255,.6)",
                        whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {playerTeam||form.team}
                      </span>
                    )}
                    {/* Logo ligue après le nom du club */}
                    {form.game&&getLeagueLogo(form.game)&&(
                      <img src={getLeagueLogo(form.game)} alt={form.game}
                        style={{width:16,height:16,objectFit:"contain",opacity:.85,flexShrink:0}}/>
                    )}
                    {form.game&&!getLeagueLogo(form.game)&&(
                      <span style={{fontSize:10,fontWeight:600,color:"rgba(255,255,255,.45)"}}>{form.game}</span>
                    )}
                  </div>
                </div>

                {/* Infos pari — bas */}
                <div style={{display:"flex",flexDirection:"column",gap:2}}>
                  {betLine&&(
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.4)",
                        textTransform:"uppercase",letterSpacing:.8,minWidth:28,flexShrink:0}}>Pari</span>
                      <span style={{fontSize:11,fontWeight:700,color:"#fff",
                        whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{betLine}</span>
                    </div>
                  )}
                  {form.odds&&(
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.4)",
                        textTransform:"uppercase",letterSpacing:.8,minWidth:28,flexShrink:0}}>Cote</span>
                      <span style={{fontSize:11,fontWeight:800,color:"#fff"}}>@{form.odds}</span>
                    </div>
                  )}
                  {form.stake&&(
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.4)",
                        textTransform:"uppercase",letterSpacing:.8,minWidth:28,flexShrink:0}}>Mise</span>
                      <span style={{fontSize:11,fontWeight:700,color:"#fff"}}>{form.stake}€</span>
                    </div>
                  )}
                  {form.tipster&&(
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.4)",
                        textTransform:"uppercase",letterSpacing:.8,minWidth:28,flexShrink:0}}>Tips</span>
                      <span style={{fontSize:11,fontWeight:600,color:"#fff"}}>{form.tipster}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
      {/* fin hero */}

      {/* ── Fond formulaire ── */}
      <div style={{flex:1,background:"#08090E",padding:"16px 16px 0"}}>

        {/* ── PARI ÉQUIPE ── */}
        {isTeamBet&&(
          <>
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
                      border:"1px solid "+(form.betType===t.key?`${pc}80`:"rgba(255,255,255,.07)"),
                      background:form.betType===t.key?`${pc}22`:"rgba(255,255,255,.03)",
                      color:form.betType===t.key?"#fff":"rgba(255,255,255,.3)",
                      fontSize:12,fontWeight:700,textAlign:"center"}}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">vs Adversaire (optionnel)</label>
              <input className="form-input" placeholder="Nom de l'adversaire"
                value={form.opponent} onChange={e=>f("opponent",e.target.value)}
                style={{background:`${pc}14`,borderColor:`${pc}40`}}/>
            </div>
            {["handicap","total","team_total","half"].includes(form.betType)&&(
              <div className="form-group">
                <label className="form-label">{form.betType==="handicap"?"Handicap":"Ligne"}</label>
                <div style={{display:"flex",gap:10}}>
                  {["total","team_total","half"].includes(form.betType)&&(
                    <div className="segment" style={{flex:"0 0 auto",minWidth:120,
                      background:`${pc}18`}}>
                      {["Over","Under"].map(o=>(
                        <button key={o}
                          onClick={()=>f("ou",o)}
                          style={{flex:1,padding:9,border:"none",borderRadius:6,cursor:"pointer",
                            background:form.ou===o?pc:"transparent",
                            color:form.ou===o?"#fff":"rgba(255,255,255,.35)",
                            fontSize:13,fontWeight:600,fontFamily:"inherit",transition:"all .12s"}}>
                          {o}
                        </button>
                      ))}
                    </div>
                  )}
                  <input className="form-input" type="number" step="0.5"
                    placeholder={form.betType==="handicap"?"-5.5":"220.5"}
                    value={form.line} onChange={e=>f("line",e.target.value)}
                    style={{flex:1,background:`${pc}14`,borderColor:`${pc}40`}}/>
                </div>
              </div>
            )}
            <div style={{background:`${pc}14`,border:`1px solid ${pc}35`,
              borderRadius:12,padding:"10px 14px",marginBottom:14}}>
              <div style={{fontSize:12,fontWeight:700,color:pc,marginBottom:3}}>Pari</div>
              <div style={{fontSize:14,fontWeight:600,color:"#F2F2F7"}}>
                {form.betType==="moneyline"&&form.team+" gagne"}
                {form.betType==="handicap"&&form.team+" "+form.line}
                {form.betType==="total"&&(form.ou||"Over")+" "+form.line+" pts (match)"}
                {form.betType==="team_total"&&form.team+" "+(form.ou||"Over")+" "+form.line+" pts"}
                {form.betType==="half"&&(form.ou||"Over")+" "+form.line+" (mi-temps)"}
              </div>
              {form.opponent&&<div style={{fontSize:11,color:"rgba(255,255,255,.28)",marginTop:2}}>vs {form.opponent}</div>}
            </div>
          </>
        )}

        {/* ── PARI JOUEUR ── */}
        {!isTeamBet&&(
          <div className="form-group">
            <label className="form-label">Pari</label>
            {/* Over/Under — couleur équipe */}
            <div style={{display:"flex",background:`${pc}18`,borderRadius:8,padding:3,gap:2,marginBottom:10}}>
              {["Over","Under"].map(o=>(
                <button key={o}
                  onClick={()=>f("ou",o)}
                  style={{flex:1,padding:"9px",border:"none",borderRadius:6,cursor:"pointer",
                    background:form.ou===o?pc:"transparent",
                    color:form.ou===o?"#fff":"rgba(255,255,255,.35)",
                    fontSize:14,fontWeight:700,fontFamily:"inherit",transition:"all .15s"}}>
                  {o}
                </button>
              ))}
            </div>
            <div style={{display:"flex",gap:10}}>
              <select className="form-select" value={form.line}
                onChange={e=>f("line",e.target.value)}
                style={{flex:1,background:`${pc}14`,borderColor:`${pc}40`}}>
                <option value="">Ligne</option>
                {Array.from({length:45},(_,i)=>(i+0.5).toFixed(1)).map(v=>(
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
              <select className="form-select" value={form.stat}
                onChange={e=>f("stat",e.target.value)}
                style={{flex:1,background:`${pc}14`,borderColor:`${pc}40`}}>
                {["Points","Rebonds","Assists","Points+Rebonds","Points+Assists",
                  "Points+Rebonds+Assists","3 Points Made","Steals","Blocks",
                  "Turnovers","Fantasy Score","Minutes"].map(s=>(
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* ── COMMUN : Cote + Mise ── */}
        <div style={{display:"flex",gap:10}} className="form-group">
          <div style={{flex:1}}>
            <label className="form-label">Cote</label>
            <input className="form-input" type="number" step="0.01" placeholder="1.85"
              value={form.odds}
              onChange={e=>f("odds",e.target.value)}
              onBlur={e=>{
                const raw=e.target.value.replace(",",".");
                const n=parseFloat(raw);
                if(!isNaN(n)&&n>=100){
                  // 185 → 1.85, 200 → 2.00, etc.
                  f("odds",(n/100).toFixed(2));
                }
              }}
              style={{background:`${pc}14`,borderColor:`${pc}40`}}/>
          </div>
          <div style={{flex:1}}>
            <label className="form-label">Mise (€)</label>
            <input className="form-input" type="number" placeholder="100"
              value={form.stake} onChange={e=>f("stake",e.target.value)}
              style={{background:`${pc}14`,borderColor:`${pc}40`}}/>
          </div>
        </div>

        {/* Quick bets — couleur équipe */}
        <div style={{display:"flex",gap:5,marginTop:-8,marginBottom:16}}>
          {[{pct:"0.5%",val:50},{pct:"0.75%",val:75},{pct:"1%",val:100},{pct:"1.25%",val:125},{pct:"1.5%",val:150}].map(({pct,val})=>{
            const active=form.stake===String(val);
            return(
              <button key={val} onClick={()=>f("stake",String(val))}
                style={{flex:1,padding:"7px 2px",borderRadius:8,cursor:"pointer",
                  border:`1px solid ${active?pc+"80":"rgba(255,255,255,.08)"}`,
                  borderBottom:`1px solid ${active?pc+"80":"rgba(0,0,0,.5)"}`,
                  background:active?`${pc}28`:"linear-gradient(180deg,#1A1A1F 0%,#111114 100%)",
                  color:active?"#fff":"rgba(255,255,255,.4)",
                  fontSize:10,fontWeight:700,textAlign:"center",lineHeight:1.3,
                  boxShadow:active?`0 0 12px ${pc}30`:"0 2px 5px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04)",
                  transition:"all .12s"}}>
                <div>{pct}</div>
                <div style={{fontSize:11,color:active?`${pc}EE`:"rgba(255,255,255,.28)"}}>{val}€</div>
              </button>
            );
          })}
        </div>

        {/* ── Bookmaker + lock ── */}
        <div className="form-group">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <label className="form-label" style={{marginBottom:0}}>Bookmaker</label>
            <button onClick={()=>setLockedBK(p=>!p)}
              style={{background:lockedBK?`${pc}20`:"transparent",
                border:`1px solid ${lockedBK?pc+"55":"rgba(255,255,255,.1)"}`,
                borderRadius:7,padding:"3px 9px",cursor:"pointer",
                fontSize:11,fontWeight:700,color:lockedBK?"#fff":"rgba(255,255,255,.3)",
                display:"flex",alignItems:"center",gap:4,transition:"all .15s"}}>
              {lockedBK?"🔒":"🔓"} {lockedBK?"Verrouillé":"Verrouiller"}
            </button>
          </div>
          <div style={{position:"relative"}}>
            {form.bookmaker&&bkPhotos[form.bookmaker]&&(
              <img src={bkPhotos[form.bookmaker]} alt=""
                style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",
                  width:20,height:20,objectFit:"contain",borderRadius:4,zIndex:1,pointerEvents:"none"}}/>
            )}
            <select className="form-select" value={form.bookmaker}
              onChange={e=>f("bookmaker",e.target.value)}
              style={{paddingLeft:form.bookmaker&&bkPhotos[form.bookmaker]?42:14,
                background:`${pc}14`,borderColor:`${pc}40`}}>
              <option value="">Aucun</option>
              {bookmakers.map(b=><option key={b}>{b}</option>)}
            </select>
          </div>
        </div>

        {/* ── Résultat ── */}
        <div className="form-group">
          <label className="form-label">Résultat du pari</label>
          <div style={{display:"flex",gap:6}}>
            {[
              {key:"pending",label:"En cours"},
              {key:"won",   label:"✓ Gagné"},
              {key:"lost",  label:"✗ Perdu"},
              {key:"void",  label:"Void"},
            ].map(({key,label})=>{
              const isActive=form.status===key;
              const colors={
                won:  {bg:"rgba(0,230,118,.15)", border:"rgba(0,230,118,.4)",  text:"#00E676"},
                lost: {bg:"rgba(248,113,113,.12)",border:"rgba(248,113,113,.35)",text:"#F87171"},
                pending:{bg:`${pc}18`,            border:`${pc}50`,             text:"#fff"},
                void: {bg:"rgba(255,255,255,.05)",border:"rgba(255,255,255,.12)",text:"rgba(255,255,255,.4)"},
              };
              const col=colors[key];
              return(
                <button key={key}
                  onClick={()=>f("status",key)}
                  style={{flex:1,padding:"11px 6px",borderRadius:10,cursor:"pointer",
                    border:`1px solid ${isActive?col.border:"rgba(255,255,255,.07)"}`,
                    background:isActive?col.bg:`${pc}08`,
                    color:isActive?col.text:"rgba(255,255,255,.22)",
                    fontSize:11,fontWeight:700,fontFamily:"inherit",letterSpacing:.1,
                    transition:"all .15s"}}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tipster + lock ── */}
        <div className="form-group">
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <label className="form-label" style={{marginBottom:0}}>Tipster</label>
            <button onClick={()=>setLockedTip(p=>!p)}
              style={{background:lockedTip?`${pc}20`:"transparent",
                border:`1px solid ${lockedTip?pc+"55":"rgba(255,255,255,.1)"}`,
                borderRadius:7,padding:"3px 9px",cursor:"pointer",
                fontSize:11,fontWeight:700,color:lockedTip?"#fff":"rgba(255,255,255,.3)",
                display:"flex",alignItems:"center",gap:4,transition:"all .15s"}}>
              {lockedTip?"🔒":"🔓"} {lockedTip?"Verrouillé":"Verrouiller"}
            </button>
          </div>
          {tipsters.length>0?(
            <select className="form-select" value={form.tipster}
              onChange={e=>f("tipster",e.target.value)}
              style={{background:`${pc}14`,borderColor:`${pc}40`}}>
              <option value="">Aucun</option>
              {tipsters.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          ):(
            <input className="form-input" placeholder="Optionnel"
              value={form.tipster} onChange={e=>f("tipster",e.target.value)}
              style={{background:`${pc}14`,borderColor:`${pc}40`}}/>
          )}
        </div>

        {/* ── Bouton submit — vert vif ── */}
        <button onClick={submit} disabled={saving}
          style={{width:"100%",marginBottom:8,marginTop:8,padding:"17px 20px",
            fontSize:17,fontWeight:800,letterSpacing:.3,textTransform:"uppercase",
            borderRadius:14,border:"none",cursor:"pointer",
            background:"linear-gradient(180deg,#00E676 0%,#00C264 100%)",
            color:"#001A0A",
            opacity:saving?.6:1,
            boxShadow:"0 4px 28px rgba(0,230,118,.4),0 0 0 1px rgba(0,230,118,.2)",
            fontFamily:"'Barlow Condensed',inherit",transition:"opacity .12s",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span style={{fontSize:20,fontWeight:900}}>+</span>
          {saving?"Enregistrement…":editBet?"Modifier le pari":"Ajouter le pari"}
        </button>
      </div>
    </div>
  );
}

// ── EditCell — hors du modal pour éviter remount à chaque render ──────────────
const EditCell=memo(function EditCell({fieldKey,label,value,suffix="",type="text",
  dirty,dropdown,setDropdown,setField,bkPhotos,bookmakerList,tipsterList,leagueList}){
  const isDropdown=["bookmaker","tipster","game"].includes(fieldKey);
  const isOpen=dropdown===fieldKey;
  const[localVal,setLocalVal]=useState(String(value||""));

  // Sync si value change de l'extérieur
  const prevValue=useRef(value);
  if(prevValue.current!==value){prevValue.current=value;setLocalVal(String(value||""));}

  const opts=fieldKey==="bookmaker"
    ?bookmakerList.map(b=>({label:b.name,logo:b.logo}))
    :fieldKey==="tipster"
      ?tipsterList.map(t=>({label:t.name,logo:null}))
      :leagueList.map(l=>({label:l.name,logo:l.logo||getLeagueLogo(l.name)}));

  const logoSrc=fieldKey==="bookmaker"?bkPhotos[value]
    :fieldKey==="game"?getLeagueLogo(value)
    :null;

  function handleBlur(e){
    let v=e.target.value.trim();
    if(fieldKey==="odds"){
      const n=parseFloat(v.replace(",","."));
      if(!isNaN(n)&&n>=100) v=(n/100).toFixed(2);
      else if(!isNaN(n)) v=n.toFixed(2);
    }
    if(v!==String(value||"")) setField(fieldKey,v);
  }

  const isDirty=dirty[fieldKey]!==undefined;

  return(
    <div style={{position:"relative",flex:1,minWidth:0}}>
      <div style={{
        background:isDirty?"rgba(0,230,118,.06)":"#1A1A20",
        borderTop:isDirty?"1px solid rgba(0,230,118,.25)":"1px solid transparent",
        padding:"14px 10px 10px",
        display:"flex",flexDirection:"column",alignItems:"center",gap:5,
        cursor:"pointer",transition:"background .15s",minHeight:72,
        borderRadius:0,position:"relative",
      }}>
        <span style={{fontSize:9,fontWeight:700,color:isDirty?"#00E676":"rgba(255,255,255,.3)",
          letterSpacing:.8,textTransform:"uppercase",transition:"color .15s"}}>{label}</span>

        {isDropdown?(
          <div onClick={e=>{e.stopPropagation();setDropdown(isOpen?null:fieldKey);}}
            style={{display:"flex",alignItems:"center",gap:4,cursor:"pointer",justifyContent:"center"}}>
            {logoSrc&&<img src={logoSrc} alt="" style={{width:16,height:16,objectFit:"contain",borderRadius:3}}/>}
            <span style={{fontSize:13,fontWeight:700,color:value?"#F2F2F7":"rgba(255,255,255,.3)",textAlign:"center"}}>
              {value||"—"}
            </span>
            <span style={{fontSize:9,color:"rgba(255,255,255,.3)",marginLeft:1}}>▾</span>
          </div>
        ):(
          <input
            type={type}
            value={localVal}
            onChange={e=>setLocalVal(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={e=>{if(e.key==="Enter")e.target.blur();}}
            style={{
              width:"100%",background:"transparent",border:"none",
              borderBottom:`1px solid ${isDirty?"rgba(0,230,118,.4)":"rgba(255,255,255,.08)"}`,
              color:"#F2F2F7",fontSize:13,fontWeight:700,textAlign:"center",
              outline:"none",padding:"2px 0",fontFamily:"inherit",
            }}
          />
        )}
        {suffix&&value&&!isDropdown&&(
          <span style={{fontSize:10,color:"rgba(255,255,255,.25)",marginTop:-4}}>{suffix}</span>
        )}

        {isOpen&&(
          <div style={{
            position:"absolute",top:"100%",left:"50%",transform:"translateX(-50%)",
            zIndex:100,background:"#242429",border:"1px solid rgba(255,255,255,.1)",
            borderRadius:12,overflow:"hidden",minWidth:140,maxHeight:220,overflowY:"auto",
            boxShadow:"0 8px 32px rgba(0,0,0,.6)",
          }}>
            {opts.map(o=>(
              <div key={o.label} onClick={e=>{e.stopPropagation();setField(fieldKey,o.label);}}
                style={{
                  display:"flex",alignItems:"center",gap:8,padding:"10px 14px",
                  cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,.04)",
                  background:value===o.label?"rgba(0,230,118,.08)":"transparent",
                  fontSize:13,fontWeight:value===o.label?700:500,
                  color:value===o.label?"#00E676":"#F2F2F7",
                }}>
                {o.logo&&<img src={o.logo} alt="" style={{width:18,height:18,objectFit:"contain",borderRadius:3,flexShrink:0}}/>}
                {o.label}
                {value===o.label&&<span style={{marginLeft:"auto",fontSize:11}}>✓</span>}
              </div>
            ))}
            {opts.length===0&&(
              <div style={{padding:"12px 14px",fontSize:12,color:"rgba(255,255,255,.3)"}}>
                Aucune option
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

// ── DÉTAIL PARI ───────────────────────────────────────────────────────────────
function BetDetailModal({bet,players,bkPhotos={},bookmakerList=[],tipsterList=[],leagueList=[],onClose,onUpdate,onDelete}){
  const[saving,setSaving]=useState(false);
  const[localBet,setLocalBet]=useState({...bet});
  const[dirty,setDirty]=useState({}); // champs modifiés non sauvegardés
  const[dropdown,setDropdown]=useState(null); // "bookmaker"|"tipster"|"game"
  const[saveAnim,setSaveAnim]=useState(false);

  const pData=players.find(p=>p.name===localBet.player);
  const isTeamBet=localBet.bet_type==="team";
  const photo=isTeamBet
    ?getTeamLogo(localBet.team||localBet.player,null)
    :(pData?.photo_url||pData?.avatar_url);
  const resolvedTeamLogo=isTeamBet?null:getTeamLogo(localBet.team||pData?.team,pData?.team_logo_url||null);
  const profitNum=parseFloat(localBet.profit||0);
  const tc=getTeamColor(localBet.team||pData?.team);
  const pc=tc?.p||"#1C1C22";

  const rawName=isTeamBet?(localBet.team||localBet.player):localBet.player;
  const nameFormatted=(rawName||"").trim().split(/\s+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(" ");

  const hasDirty=Object.keys(dirty).length>0;

  const setField=useCallback((field,value)=>{
    setLocalBet(prev=>({...prev,[field]:value}));
    setDirty(prev=>({...prev,[field]:value}));
    setDropdown(null);
  },[]);

  async function changeStatus(status){
    setSaving(true);
    const profit=calcProfit(status,localBet.stake,localBet.odds);
    await updateBet(localBet.id,{status,profit});
    setLocalBet(prev=>({...prev,status,profit}));
    setDirty({});
    onUpdate();
    setSaving(false);
  }

  async function saveAll(){
    if(!hasDirty)return;
    setSaving(true);
    const update={...dirty};
    // Recalc profit si odds/stake changés et statut fixé
    if((update.odds||update.stake)&&localBet.status!=="pending"){
      update.profit=calcProfit(localBet.status,
        update.stake||localBet.stake,
        update.odds||localBet.odds);
      setLocalBet(prev=>({...prev,...update}));
    }
    await updateBet(localBet.id,update);
    setDirty({});
    setSaveAnim(true);
    setTimeout(()=>setSaveAnim(false),1200);
    onUpdate();
    setSaving(false);
  }

  async function remove(){
    if(!window.confirm("Supprimer ce pari ?"))return;
    await deleteBet(localBet.id);
    onUpdate();
    onClose();
  }

  const statusColor=localBet.status==="won"?"#00E676":localBet.status==="lost"?"#F87171":localBet.status==="void"?"rgba(255,255,255,.3)":"rgba(255,255,255,.5)";
  const bkLogo=bkPhotos[localBet.bookmaker];

  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget){setDropdown(null);onClose();}}}>
      <div className="modal-sheet" style={{padding:0,overflow:"hidden",borderRadius:"24px 24px 0 0"}}
        onClick={()=>dropdown&&setDropdown(null)}>
        <div className="modal-handle" style={{margin:"12px auto 0"}}/>

        {/* ── HERO HEADER ── */}
        <div style={{
          position:"relative",height:200,overflow:"hidden",flexShrink:0,
          background:pc?`linear-gradient(135deg,${pc}DD 0%,${pc}55 50%,#0D0D12 100%)`:"#1C1C22",
        }}>
          {/* Logo club en fond */}
          {resolvedTeamLogo&&(
            <div style={{position:"absolute",right:-10,top:-10,bottom:-10,width:"65%",
              display:"flex",alignItems:"center",justifyContent:"center",zIndex:1,pointerEvents:"none"}}>
              <img src={resolvedTeamLogo} alt=""
                style={{width:200,height:200,objectFit:"contain",opacity:.2,filter:"blur(0.5px)"}}/>
            </div>
          )}
          {/* Overlay gauche */}
          <div style={{position:"absolute",inset:0,zIndex:2,
            background:"linear-gradient(to right,rgba(0,0,0,.75) 0%,rgba(0,0,0,.15) 52%,transparent 100%)"}}/>
          {/* Photo joueur — masque à gauche pour libérer le texte */}
          {photo&&(
            <img src={photo} alt={rawName} style={{
              position:"absolute",right:0,bottom:0,
              height:"125%",width:"auto",maxWidth:"48%",
              objectFit:"cover",objectPosition:"50% 8%",zIndex:3,
              filter:"brightness(1.1) contrast(1.05)",
              maskImage:"linear-gradient(to left,black 50%,transparent 100%),linear-gradient(to bottom,transparent 0%,black 8%,black 82%,transparent 100%)",
              maskComposite:"intersect",
              WebkitMaskImage:"linear-gradient(to left,black 50%,transparent 100%),linear-gradient(to bottom,transparent 0%,black 8%,black 82%,transparent 100%)",
              WebkitMaskComposite:"source-in",
            }}/>
          )}

          {/* Texte à gauche */}
          <div style={{position:"absolute",left:16,top:16,right:"50%",zIndex:4,display:"flex",flexDirection:"column",gap:0}}>
            {/* Statut badge + profit sur la même ligne */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:5,
                padding:"3px 10px",borderRadius:20,flexShrink:0,
                background:`${statusColor}20`,border:`1px solid ${statusColor}50`}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:statusColor}}/>
                <span style={{fontSize:10,fontWeight:700,color:statusColor,letterSpacing:.5}}>
                  {localBet.status==="pending"?"EN COURS":localBet.status==="won"?"GAGNÉ":localBet.status==="lost"?"PERDU":"VOID"}
                </span>
              </div>
              {/* Profit à côté du badge */}
              <span style={{
                fontFamily:"'Barlow Condensed',inherit",
                fontSize:20,fontWeight:900,letterSpacing:-.3,
                color:profitNum>0?"#00E676":profitNum<0?"#F87171":"rgba(255,255,255,.4)",
                textShadow:`0 0 18px ${profitNum>0?"rgba(0,230,118,.5)":profitNum<0?"rgba(248,113,113,.5)":"transparent"}`,
              }}>
                {profitNum>0?"+":""}{localBet.status==="pending"?"—":profitNum.toFixed(2)+"$"}
              </span>
            </div>
            {/* Nom */}
            <div style={{fontFamily:"'Barlow Condensed',inherit",fontSize:26,fontWeight:900,
              color:"#FFF",letterSpacing:-.3,lineHeight:1.1,textTransform:"uppercase",
              textShadow:"0 2px 10px rgba(0,0,0,.7)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {nameFormatted}
            </div>
            {/* Description */}
            <div style={{fontSize:12,color:"rgba(255,255,255,.6)",marginTop:5,fontWeight:500,lineHeight:1.3}}>
              {localBet.description||"—"}
            </div>
            {/* Ligue */}
            {localBet.game&&(
              <div style={{display:"flex",alignItems:"center",gap:5,marginTop:6}}>
                {getLeagueLogo(localBet.game)&&<img src={getLeagueLogo(localBet.game)} alt=""
                  style={{width:14,height:14,objectFit:"contain",opacity:.9}}/>}
                <span style={{fontSize:10,color:"rgba(255,255,255,.4)",fontWeight:600,letterSpacing:.3}}>{localBet.game}</span>
              </div>
            )}
            {/* Infos compactes dans le header */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10,flexWrap:"wrap"}}>
              <span style={{fontSize:13,fontWeight:800,color:"rgba(255,255,255,.9)"}}>@{localBet.odds}</span>
              <span style={{color:"rgba(255,255,255,.25)"}}>·</span>
              <span style={{fontSize:13,color:"rgba(255,255,255,.6)"}}>{localBet.stake}$</span>
              {bkLogo&&<><span style={{color:"rgba(255,255,255,.25)"}}>·</span>
                <img src={bkLogo} alt="" style={{height:14,objectFit:"contain",opacity:.85}}/></>}
              {localBet.tipster&&<><span style={{color:"rgba(255,255,255,.25)"}}>·</span>
                <span style={{fontSize:12,color:"rgba(255,255,255,.6)",fontWeight:600}}>{localBet.tipster}</span></>}
            </div>
          </div>

        </div>

        {/* ── CORPS ── */}
        <div style={{overflowY:"auto",maxHeight:"calc(90vh - 200px)"}}
          onClick={e=>e.stopPropagation()}>

          {/* 5 colonnes éditables */}
          <div style={{display:"flex",gap:1,background:"rgba(255,255,255,.04)",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
            <EditCell fieldKey="odds"      label="COTE"    value={localBet.odds}      type="number"
              dirty={dirty} dropdown={dropdown} setDropdown={setDropdown} setField={setField}
              bkPhotos={bkPhotos} bookmakerList={bookmakerList} tipsterList={tipsterList} leagueList={leagueList}/>
            <EditCell fieldKey="stake"     label="MISE"    value={localBet.stake}     suffix="$" type="number"
              dirty={dirty} dropdown={dropdown} setDropdown={setDropdown} setField={setField}
              bkPhotos={bkPhotos} bookmakerList={bookmakerList} tipsterList={tipsterList} leagueList={leagueList}/>
            <EditCell fieldKey="bookmaker" label="BOOK"    value={localBet.bookmaker}
              dirty={dirty} dropdown={dropdown} setDropdown={setDropdown} setField={setField}
              bkPhotos={bkPhotos} bookmakerList={bookmakerList} tipsterList={tipsterList} leagueList={leagueList}/>
            <EditCell fieldKey="tipster"   label="TIPSTER" value={localBet.tipster}
              dirty={dirty} dropdown={dropdown} setDropdown={setDropdown} setField={setField}
              bkPhotos={bkPhotos} bookmakerList={bookmakerList} tipsterList={tipsterList} leagueList={leagueList}/>
            <EditCell fieldKey="game"      label="LIGUE"   value={localBet.game}
              dirty={dirty} dropdown={dropdown} setDropdown={setDropdown} setField={setField}
              bkPhotos={bkPhotos} bookmakerList={bookmakerList} tipsterList={tipsterList} leagueList={leagueList}/>
          </div>

          <div style={{padding:"14px 14px 24px"}}>
            {/* Bouton Sauvegarder — visible seulement si modif */}
            {hasDirty&&(
              <button onClick={saveAll} disabled={saving}
                style={{
                  width:"100%",padding:"14px",borderRadius:12,border:"none",
                  background:"linear-gradient(180deg,#00E676 0%,#00C264 100%)",
                  color:"#001A0A",fontSize:15,fontWeight:800,
                  fontFamily:"'Barlow Condensed',inherit",letterSpacing:.3,
                  cursor:"pointer",marginBottom:12,
                  boxShadow:"0 4px 20px rgba(0,230,118,.35)",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                }}>
                {saving?"Enregistrement…":"💾  Sauvegarder les modifications"}
              </button>
            )}
            {saveAnim&&!hasDirty&&(
              <div style={{textAlign:"center",color:"#00E676",fontSize:13,fontWeight:700,marginBottom:12}}>
                ✓ Sauvegardé
              </div>
            )}

            {/* Changer statut */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.28)",
                letterSpacing:.8,marginBottom:8,textTransform:"uppercase"}}>Changer le statut</div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
                {[{k:"pending",l:"En cours"},{k:"won",l:"Gagné"},{k:"lost",l:"Perdu"},{k:"void",l:"Void"}].map(({k,l})=>{
                  const active=localBet.status===k;
                  const col=k==="won"?"#00E676":k==="lost"?"#F87171":k==="pending"?"rgba(255,255,255,.6)":"rgba(255,255,255,.3)";
                  return(
                    <button key={k} onClick={()=>!active&&changeStatus(k)} disabled={saving||active}
                      style={{padding:"10px 4px",borderRadius:10,fontSize:12,fontWeight:700,
                        border:`1px solid ${active?col+"88":"rgba(255,255,255,.08)"}`,
                        background:active?`${col}18`:"transparent",color:active?col:"rgba(255,255,255,.35)",
                        cursor:active?"default":"pointer",fontFamily:"inherit",transition:"all .15s"}}>
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date */}
            {bet.created_at&&(
              <div style={{fontSize:11,color:"rgba(255,255,255,.2)",marginBottom:14,textAlign:"center"}}>
                {new Date(bet.created_at).toLocaleString("fr-CA")}
              </div>
            )}

            {/* Actions */}
            {/* Dupliquer */}
            <button onClick={async()=>{
              const{id,...copy}=localBet;
              copy.status="pending";
              copy.profit=0;
              copy.created_at=new Date().toISOString();
              await insertBet(copy);
              onUpdate();
              onClose();
            }} style={{
              width:"100%",marginBottom:8,padding:"13px 16px",borderRadius:12,
              border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.05)",
              color:"rgba(255,255,255,.75)",fontSize:14,fontWeight:600,
              cursor:"pointer",fontFamily:"inherit",
              display:"flex",alignItems:"center",justifyContent:"center",gap:10,
            }}>
              {/* Icône dupliquer — deux pages avec coin plié */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
                <rect x="8" y="2" width="12" height="14" rx="2"/>
                <path d="M16 2v4h4"/>
              </svg>
              Dupliquer ce pari
            </button>
            <button className="btn btn-danger" onClick={remove} style={{marginBottom:8}}>Supprimer</button>
            <button className="btn btn-secondary" onClick={onClose}>Fermer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GRAPHIQUE BANKROLL SVG ────────────────────────────────────────────────────
function BankrollChart({bets,range}){
  const W=358,H=200,PAD={top:16,right:12,bottom:8,left:62};
  const inner={w:W-PAD.left-PAD.right,h:H-PAD.top-PAD.bottom};

  // Filtrer par plage temporelle
  const now=Date.now();
  const ms={
    "1j":86400000,
    "1s":7*86400000,
    "1m":30*86400000,
    "1a":365*86400000,
    "tout":null,
  };
  const cutoff=ms[range]?now-ms[range]:null;

  // Trier les paris réglés par date
  const settled=[...bets]
    .filter(b=>b.status==="won"||b.status==="lost")
    .filter(b=>!cutoff||(b.created_at&&new Date(b.created_at).getTime()>=cutoff))
    .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));

  if(settled.length<2)return(
    <div style={{height:H,display:"flex",alignItems:"center",justifyContent:"center",
      color:"rgba(255,255,255,.3)",fontSize:13}}>
      Pas assez de données
    </div>
  );

  // Construire les points cumulés
  let cum=0;
  const pts=[{t:new Date(settled[0].created_at).getTime()-1,v:0},...settled.map(b=>{
    cum+=parseFloat(b.profit||0);
    return{t:new Date(b.created_at).getTime(),v:cum};
  })];

  const minV=Math.min(0,...pts.map(p=>p.v));
  const maxV=Math.max(0,...pts.map(p=>p.v));
  const rangeV=maxV-minV||1;
  const minT=pts[0].t,maxT=pts[pts.length-1].t,rangeT=maxT-minT||1;

  const sx=t=>PAD.left+((t-minT)/rangeT)*inner.w;
  const sy=v=>PAD.top+inner.h-((v-minV)/rangeV)*inner.h;

  // Polyline path
  const polyline=pts.map((p,i)=>(i===0?"M":"L")+sx(p.t).toFixed(1)+","+sy(p.v).toFixed(1)).join(" ");
  // Area fill path
  const area=polyline+" L"+sx(maxT).toFixed(1)+","+(PAD.top+inner.h)+" L"+sx(minT).toFixed(1)+","+(PAD.top+inner.h)+" Z";

  // Graduations Y
  const steps=4;
  const yTicks=Array.from({length:steps+1},(_,i)=>{
    const v=minV+(rangeV/steps)*i;
    return{v,y:sy(v)};
  });

  const isPos=pts[pts.length-1].v>=0;
  const lineColor=isPos?"#00E676":"#F87171";
  const gradStart=isPos?"rgba(0,230,118,0.3)":"rgba(248,113,113,0.3)";
  const gradEnd="rgba(0,0,0,0)";

  return(
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:"visible"}}>
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={gradStart}/>
          <stop offset="100%" stopColor={gradEnd}/>
        </linearGradient>
        <clipPath id="chartClip">
          <rect x={PAD.left} y={PAD.top} width={inner.w} height={inner.h}/>
        </clipPath>
      </defs>
      {/* Grille horizontale */}
      {yTicks.map(({v,y},i)=>(
        <g key={i}>
          <line x1={PAD.left} y1={y} x2={PAD.left+inner.w} y2={y}
            stroke="rgba(255,255,255,.07)" strokeWidth="1"/>
          <text x={PAD.left-8} y={y+4} textAnchor="end" fontSize="9"
            fill="rgba(255,255,255,.35)" fontFamily="Outfit,system-ui,sans-serif">
            {v>=1000?Math.round(v/100)/10+"k":Math.round(v)}$
          </text>
        </g>
      ))}
      {/* Ligne zéro */}
      {minV<0&&maxV>0&&(
        <line x1={PAD.left} y1={sy(0)} x2={PAD.left+inner.w} y2={sy(0)}
          stroke="rgba(255,255,255,.2)" strokeWidth="1" strokeDasharray="4,3"/>
      )}
      {/* Area fill */}
      <path d={area} fill="url(#bgGrad)" clipPath="url(#chartClip)"/>
      {/* Line */}
      <path d={polyline} fill="none" stroke={lineColor} strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" clipPath="url(#chartClip)"/>
      {/* Point final */}
      <circle cx={sx(pts[pts.length-1].t)} cy={sy(pts[pts.length-1].v)}
        r="4" fill={lineColor} stroke="#08090E" strokeWidth="2"/>
    </svg>
  );
}

// ── VUE ACCUEIL style Bet-Analytix ───────────────────────────────────────────
function HomeView({bets,players,onNavigate}){
  const[range,setRange]=useState("1s");
  const settled=bets.filter(b=>b.status==="won"||b.status==="lost");
  const won=bets.filter(b=>b.status==="won").length;
  const lost=bets.filter(b=>b.status==="lost").length;
  const pending=bets.filter(b=>b.status==="pending").length;
  const profit=bets.reduce((s,b)=>s+parseFloat(b.profit||0),0);
  const staked=settled.reduce((s,b)=>s+parseFloat(b.stake||0),0);
  const roi=staked>0?profit/staked*100:0;
  const wr=won+lost>0?won/(won+lost)*100:0;
  // Progression = profit / bankroll initiale supposée (total misé - profit)
  const initialBankroll=staked-profit;
  const progression=initialBankroll>0?profit/initialBankroll*100:0;
  const isPos=profit>=0;
  const accentColor=isPos?"#00E676":"#F87171";

  return(
    <div style={{paddingBottom:8}}>

      {/* ── GRAPHIQUE BANKROLL ── */}
      <div style={{
        margin:"0 12px 14px",
        background:"#1C1C1F",
        borderRadius:12,
        border:"1px solid #2A2A2E",
        padding:"16px 8px 12px",
        position:"relative",
        overflow:"hidden",
      }}>
        {/* Titre bankroll */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          paddingLeft:54,paddingRight:12,marginBottom:8}}>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.35)",fontWeight:600,letterSpacing:.8}}>BANKROLL SAISON</div>
            <div style={{fontSize:24,fontWeight:900,color:isPos?"#00E676":"#F87171",letterSpacing:-1,marginTop:1}}>
              {isPos?"+":""}{profit.toFixed(2)}$
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>Win Rate</div>
            <div style={{fontSize:16,fontWeight:800,color:"#F2F2F7"}}>{wr.toFixed(1)}%</div>
          </div>
        </div>

        <BankrollChart bets={bets} range={range}/>

        {/* Sélecteurs de plage */}
        <div style={{display:"flex",gap:6,justifyContent:"center",marginTop:10}}>
          {["1j","1s","1m","1a","tout"].map(r=>(
            <button key={r} onClick={()=>setRange(r)}
              style={{
                padding:"5px 14px",borderRadius:20,fontSize:11,fontWeight:700,
                border:"1px solid "+(range===r?"rgba(124,58,237,.5)":"rgba(255,255,255,.08)"),
                background:range===r?"rgba(124,58,237,.15)":"transparent",
                color:range===r?"#A78BFA":"rgba(255,255,255,.3)",
                cursor:"pointer",letterSpacing:.3,fontFamily:"inherit",
              }}>{r}</button>
          ))}
        </div>
      </div>

      {/* ── BOUTONS RACCOURCIS ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"0 12px",marginBottom:12}}>
        <button onClick={()=>onNavigate("stats")}
          style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            padding:"13px 0",borderRadius:10,
            border:"1px solid #2A2A2E",background:"#1C1C1F",
            color:"rgba(255,255,255,.6)",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          <span style={{fontSize:15,opacity:.6}}>◫</span> Analyzer
        </button>
        <button onClick={()=>onNavigate("bets")}
          style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,
            padding:"13px 0",borderRadius:10,
            border:"1px solid #2A2A2E",background:"#1C1C1F",
            color:"rgba(255,255,255,.6)",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          <span style={{fontSize:15,opacity:.6}}>≡</span> Mes Paris
        </button>
      </div>

      {/* ── 4 STATS CARDS ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,padding:"0 12px"}}>
        {[
          {label:"PARIS",value:bets.length,green:false,fmt:v=>v},
          {label:"BÉNÉFICE",value:profit,green:profit>=0,fmt:v=>(v>0?"+":"")+v.toFixed(2)+"$"},
          {label:"ROI",value:roi,green:roi>=0,fmt:v=>(v>0?"+":"")+v.toFixed(2)+"%"},
          {label:"PROGRESSION",value:progression,green:progression>=0,fmt:v=>(v>0?"+":"")+v.toFixed(1)+"%"},
        ].map(({label,value,green,fmt})=>(
          <div key={label} style={{
            background:"#1C1C1F",border:"1px solid #2A2A2E",
            borderRadius:12,padding:"16px 14px",
          }}>
            <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.28)",
              letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>{label}</div>
            <div style={{fontSize:26,fontWeight:900,
              color:green?"#00E676":value<0?"#F87171":"#F2F2F7",
              letterSpacing:-1,lineHeight:1}}>
              {fmt(value)}
            </div>
          </div>
        ))}
      </div>

      {/* ── DERNIERS PARIS ── */}
      {bets.length>0&&(
        <div style={{padding:"14px 12px 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.4)",
              textTransform:"uppercase",letterSpacing:.8}}>Derniers paris</div>
            <button onClick={()=>onNavigate("bets")}
              style={{fontSize:12,color:"rgba(255,255,255,.6)",fontWeight:600,
                background:"transparent",border:"none",cursor:"pointer"}}>Voir tout ›</button>
          </div>
          {bets.slice(0,3).map(b=>{
            const pData=players.find(p=>p.name===b.player);
            const photo=pData?.photo_url||pData?.avatar_url;
            const tl=getTeamLogo(b.team||pData?.team,pData?.team_logo_url);
            const profitNum=parseFloat(b.profit||0);
            return(
              <div key={b.id} style={{
                display:"flex",alignItems:"center",gap:10,
                padding:"10px 12px",marginBottom:6,
                background:"#1C1C1F",border:"1px solid rgba(255,255,255,.07)",
                borderRadius:12,position:"relative",overflow:"hidden",
              }}>
                <div style={{position:"absolute",left:0,top:0,bottom:0,width:3,
                  background:b.status==="won"?"#00E676":b.status==="lost"?"#F87171":"rgba(255,255,255,.4)"}}/>
                <PlayerAvatar w={52} h={38} photoUrl={photo} teamLogoUrl={tl}
                  teamName={b.team||pData?.team} round={false} logoSize={0.8}
                  style={{marginLeft:4,borderRadius:8}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#F2F2F7",
                    whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                    {formatName(b.player)}
                  </div>
                  <div style={{fontSize:11,color:"rgba(255,255,255,.28)"}}>{b.description}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:14,fontWeight:800,
                    color:profitNum>0?"#00E676":profitNum<0?"#F87171":"rgba(255,255,255,.3)"}}>
                    {profitNum>0?"+":""}{profitNum.toFixed(0)}$
                  </div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.28)"}}>@{b.odds}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── VUE MES PARIS (style CS2/template screenshot) ─────────────────────────────
function BetsView({bets,players,bookmakers=[],bkPhotos={},onSelectBet,onEdit}){
  const[filter,setFilter]=useState("all");
  const[search,setSearch]=useState("");

  const statusFilters=["pending","won","lost","void"];
  const filtered=bets.filter(b=>{
    if(filter!=="all"){
      if(statusFilters.includes(filter)){
        if(b.status!==filter)return false;
      } else {
        // filtre par ligue (b.game)
        if(b.game!==filter)return false;
      }
    }
    if(search&&!b.player.toLowerCase().includes(search.toLowerCase())&&
       !(b.description||"").toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  });

  // Grouper par mois puis par date
  const groups=[];
  const seen={};
  filtered.forEach(b=>{
    const d=b.created_at?new Date(b.created_at):null;
    const month=d?d.toLocaleDateString("fr-CA",{month:"long",year:"numeric"}).toUpperCase():"SANS DATE";
    const dayKey=d?d.toISOString().slice(0,10):"?";
    const dayLabel=d?d.toLocaleDateString("fr-CA",{weekday:"short",day:"numeric",month:"short"}):"Sans date";
    const mKey="m:"+month;
    const dKey="d:"+dayKey;
    if(!seen[mKey]){seen[mKey]=true;groups.push({type:"month",label:month,bets:filtered.filter(x=>{
      const xd=x.created_at?new Date(x.created_at):null;
      const xm=xd?xd.toLocaleDateString("fr-CA",{month:"long",year:"numeric"}).toUpperCase():"SANS DATE";
      return xm===month;
    })});}
    if(!seen[dKey]){seen[dKey]=true;groups.push({type:"day",label:dayLabel,key:dayKey});}
    groups.push({type:"bet",bet:b});
  });

  return(
    <div style={{paddingBottom:8}}>

      {/* Barre de recherche */}
      <div style={{padding:"10px 12px 0"}}>
        <div style={{position:"relative"}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",
            fontSize:16,color:"#4B5563",pointerEvents:"none"}}>⌕</span>
          <input style={{
            width:"100%",padding:"10px 12px 10px 36px",
            background:"#1C1C1F",border:"1px solid rgba(255,255,255,.07)",
            borderRadius:12,color:"#F2F2F7",fontSize:13,
            outline:"none",boxSizing:"border-box",
          }} placeholder="Rechercher…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
      </div>

      {/* Filtres — logos de ligues uniquement */}
      <div style={{display:"flex",gap:6,padding:"10px 12px",overflowX:"auto",
        scrollbarWidth:"none",WebkitOverflowScrolling:"touch",alignItems:"center"}}>
        {/* Bouton "Tous" remplacé par icône */}
        <button onClick={()=>setFilter("all")} style={{
          flexShrink:0,padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:700,
          border:"1px solid "+(filter==="all"?"rgba(124,58,237,.5)":"rgba(255,255,255,.07)"),
          background:filter==="all"?"rgba(124,58,237,.15)":"transparent",
          color:filter==="all"?"#A78BFA":"rgba(255,255,255,.35)",cursor:"pointer",
          fontFamily:"inherit",
        }}>Tout</button>
        {/* Logos des ligues présentes dans les paris */}
        {[...new Set(bets.map(b=>b.game).filter(Boolean))].map(game=>{
          const logo=getLeagueLogo(game);
          if(!logo)return null;
          const active=filter===game;
          return(
            <button key={game} onClick={()=>setFilter(active?"all":game)} style={{
              flexShrink:0,padding:"5px 8px",borderRadius:20,
              border:"1px solid "+(active?"rgba(124,58,237,.5)":"rgba(255,255,255,.07)"),
              background:active?"rgba(124,58,237,.15)":"transparent",
              cursor:"pointer",display:"flex",alignItems:"center",gap:5,
            }}>
              <img src={logo} alt={game} style={{width:18,height:18,objectFit:"contain",opacity:active?1:.6}}/>
            </button>
          );
        })}
        {/* Statuts */}
        {[
          {k:"pending",label:"En cours"},
          {k:"won",label:"✓"},
          {k:"lost",label:"✕"},
        ].map(({k,label})=>(
          <button key={k} onClick={()=>setFilter(filter===k?"all":k)} style={{
            flexShrink:0,padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:700,
            border:"1px solid "+(filter===k?"rgba(124,58,237,.5)":"rgba(255,255,255,.07)"),
            background:filter===k?"rgba(124,58,237,.15)":"transparent",
            color:filter===k?"#A78BFA":"rgba(255,255,255,.35)",cursor:"pointer",
            fontFamily:"inherit",
          }}>{label}</button>
        ))}
      </div>

      {/* Liste groupée */}
      {filtered.length===0?(
        <div style={{textAlign:"center",padding:"60px 0",color:"rgba(255,255,255,.25)"}}>
          <div style={{fontSize:40,marginBottom:12}}>≡</div>
          <div style={{fontSize:15,fontWeight:600}}>Aucun pari{search?" trouvé":""}</div>
          <div style={{fontSize:12,marginTop:6}}>{search?"Essaie un autre terme":"Ajoute ton premier pari +"}</div>
        </div>
      ):(()=>{
        // Construire sections: mois > jours > paris
        const sections=[];
        let curMonth=null,curDay=null;
        filtered.forEach(b=>{
          const d=b.created_at?new Date(b.created_at):null;
          const month=d?d.toLocaleDateString("fr-CA",{month:"long",year:"numeric"}).toUpperCase():"SANS DATE";
          const dayKey=d?d.toISOString().slice(0,10):"?";
          const dayLabel=d?(""+d.toLocaleDateString("fr-CA",{weekday:"long",day:"numeric",month:"short"}).replace(/^\w/,c=>c.toUpperCase())):"Sans date";
          if(month!==curMonth){
            curMonth=month;curDay=null;
            const mBets=filtered.filter(x=>{
              const xd=x.created_at?new Date(x.created_at):null;
              const xm=xd?xd.toLocaleDateString("fr-CA",{month:"long",year:"numeric"}).toUpperCase():"SANS DATE";
              return xm===month;
            });
            const mProfit=mBets.reduce((s,x)=>s+parseFloat(x.profit||0),0);
            const mWR=(()=>{const w=mBets.filter(x=>x.status==="won").length,l=mBets.filter(x=>x.status==="lost").length;return w+l>0?(w/(w+l)*100):null;})();
            const mStake=mBets.reduce((s,x)=>s+parseFloat(x.stake||0),0);
            sections.push({type:"month",month,profit:mProfit,wr:mWR,count:mBets.length,stake:mStake});
          }
          if(dayKey!==curDay){
            curDay=dayKey;
            const dBets=filtered.filter(x=>{
              const xd=x.created_at?new Date(x.created_at):null;
              return xd?xd.toISOString().slice(0,10)===dayKey:"?"===dayKey;
            });
            const dProfit=dBets.reduce((s,x)=>s+parseFloat(x.profit||0),0);
            sections.push({type:"day",label:dayLabel,profit:dProfit,key:dayKey});
          }
          sections.push({type:"bet",bet:b});
        });

        return sections.map((s,i)=>{
          if(s.type==="month"){
            const isPos=s.profit>=0;
            return(
              <div key={"m"+i} style={{
                margin:"8px 12px 0",
                background:"#1C1C1F",
                borderRadius:12,
                border:"1px solid #2A2A2E",
                padding:"14px 16px 12px",
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:18,fontWeight:900,color:"#F2F2F7",letterSpacing:-.5}}>{s.month}</div>
                    <div style={{fontSize:12,color:"rgba(255,255,255,.4)",marginTop:4}}>
                      {s.count} paris · {s.wr!=null?s.wr.toFixed(0)+"% WR · ":""}{s.stake.toFixed(0)}$ misés
                    </div>
                  </div>
                  <div style={{
                    fontSize:22,fontWeight:900,
                    color:isPos?"#00E676":"#F87171",
                    letterSpacing:-1,
                  }}>{isPos?"+":""}{s.profit.toFixed(0)}$</div>
                </div>
              </div>
            );
          }
          if(s.type==="day"){
            const isPos=s.profit>=0;
            return(
              <div key={"d"+i} style={{
                display:"flex",justifyContent:"space-between",alignItems:"center",
                padding:"14px 16px 6px",
              }}>
                <span style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,.5)",textDecoration:"underline",textUnderlineOffset:3}}>{s.label}</span>
                <span style={{fontSize:13,fontWeight:800,
                  color:isPos?"#00E676":"#F87171",textDecoration:"underline",textUnderlineOffset:3}}>
                  {isPos?"+":""}{s.profit.toFixed(0)}$
                </span>
              </div>
            );
          }
          // BET ROW
          const b=s.bet;
          const pData=players.find(p=>p.name===b.player);
          const isTeamBet=b.bet_type==="team";
          const photo=isTeamBet
            ? getTeamLogo(b.team||b.player,null) // photo d'équipe si bet équipe
            : (pData?.photo_url||pData?.avatar_url||null);
          const teamLogo=isTeamBet
            ? null // pas de watermark si c'est déjà un logo d'équipe
            : getTeamLogo(b.team||pData?.team,pData?.team_logo_url);
          const profitNum=parseFloat(b.profit||0);
          const statusColor=b.status==="won"?"#00E676":b.status==="lost"?"#F87171":b.status==="void"?"rgba(255,255,255,.2)":"rgba(255,255,255,.4)";
          const bkLogo=bkPhotos?.[b.bookmaker];

          // Extraire le badge type (Map 1, Map 2, etc.) depuis la description ou un champ
          const mapMatch=(b.map_label||b.description||"").match(/Map\s*(\d)/i);
          const mapBadge=mapMatch?"Map "+mapMatch[1]:null;
          // Description sans le "Map X"
          const descClean=(b.description||"").replace(/Map\s*\d/gi,"").trim();

          return(
            <div key={b.id} onClick={()=>onSelectBet(b)}
              style={{
                display:"flex",alignItems:"center",gap:0,
                padding:"0 12px",
                cursor:"pointer",
              }}>
              <div style={{
                flex:1,
                display:"flex",alignItems:"center",gap:12,
                padding:"11px 0",
                borderBottom:"1px solid rgba(255,255,255,.05)",
                position:"relative",
              }}>
                {/* Barre latérale status */}
                <div style={{
                  position:"absolute",left:-12,top:8,bottom:8,
                  width:3,borderRadius:2,
                  background:statusColor,
                  opacity:b.status==="pending"?.5:1,
                }}/>

                {/* Avatar joueur ou logo équipe */}
                <div style={{flexShrink:0,marginLeft:4}}>
                  {isTeamBet&&photo?(
                    // Bet équipe : grand logo carré
                    <div style={{
                      width:52,height:52,borderRadius:12,
                      background:"rgba(255,255,255,.06)",
                      border:"1px solid rgba(255,255,255,.08)",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      overflow:"hidden",
                    }}>
                      <img src={photo} alt={b.team||b.player}
                        style={{width:"80%",height:"80%",objectFit:"contain"}}/>
                    </div>
                  ):(
                    // Bet joueur : photo avec watermark logo équipe
                    <PlayerAvatar
                      w={66} h={52}
                      photoUrl={photo}
                      teamLogoUrl={teamLogo}
                      teamName={b.team||pData?.team}
                      round={false}
                      logoSize={0.8}
                      style={{borderRadius:10}}
                    />
                  )}
                </div>

                {/* Infos — 2 lignes strictes */}
                <div style={{flex:1,minWidth:0}}>
                  {/* Ligne 1 : nom · logo ligue · description */}
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:5,
                    overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>
                    <span style={{fontSize:15,fontWeight:800,color:"#F2F2F7",letterSpacing:-.3,flexShrink:0}}>
                      {isTeamBet?(b.team||formatName(b.player)):formatName(b.player)}
                    </span>
                    {b.game&&getLeagueLogo(b.game)&&(
                      <img src={getLeagueLogo(b.game)} alt={b.game}
                        style={{width:14,height:14,objectFit:"contain",opacity:.7,flexShrink:0}}/>
                    )}
                    {descClean&&(
                      <span style={{fontSize:13,color:"rgba(255,255,255,.4)",fontWeight:500,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        · {descClean}
                      </span>
                    )}
                    {mapBadge&&(
                      <span style={{fontSize:10,fontWeight:800,letterSpacing:.3,color:"#F2F2F7",
                        background:"rgba(124,58,237,.25)",border:"1px solid rgba(124,58,237,.4)",
                        borderRadius:6,padding:"2px 7px",flexShrink:0}}>{mapBadge}</span>
                    )}
                  </div>
                  {/* Ligne 2 : @odds · mise · book · tipster  +  profit tout à droite */}
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:0,overflow:"hidden",minWidth:0}}>
                      <span style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.65)",flexShrink:0}}>@{b.odds}</span>
                      <span style={{fontSize:14,color:"rgba(255,255,255,.22)",margin:"0 5px",lineHeight:1,flexShrink:0}}>·</span>
                      <span style={{fontSize:12,color:"rgba(255,255,255,.4)",flexShrink:0}}>{b.stake}$</span>
                      {bkLogo&&(
                        <>
                          <span style={{fontSize:14,color:"rgba(255,255,255,.22)",margin:"0 5px",lineHeight:1,flexShrink:0}}>·</span>
                          <img src={bkLogo} alt={b.bookmaker}
                            style={{width:15,height:15,objectFit:"contain",borderRadius:3,opacity:.8,flexShrink:0}}/>
                        </>
                      )}
                      {!bkLogo&&b.bookmaker&&(
                        <>
                          <span style={{fontSize:14,color:"rgba(255,255,255,.22)",margin:"0 5px",lineHeight:1,flexShrink:0}}>·</span>
                          <span style={{fontSize:12,color:"rgba(255,255,255,.32)",flexShrink:0}}>{b.bookmaker}</span>
                        </>
                      )}
                      {b.tipster&&(
                        <>
                          <span style={{fontSize:14,color:"rgba(255,255,255,.22)",margin:"0 5px",lineHeight:1,flexShrink:0}}>·</span>
                          <span style={{fontSize:12,color:"rgba(255,255,255,.55)",fontWeight:700,flexShrink:0,
                            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.tipster}</span>
                        </>
                      )}
                    </div>
                    {/* Profit — extrême droite de la ligne 2 */}
                    <span style={{
                      flexShrink:0,marginLeft:10,
                      fontSize:14,fontWeight:900,letterSpacing:-.4,
                      color:profitNum>0?"#00E676":profitNum<0?"#F87171":"rgba(255,255,255,.28)",
                    }}>
                      {profitNum>0?"+":""}{profitNum===0&&b.status==="pending"?"—":profitNum.toFixed(2)+"$"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        });
      })()}
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
          <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.28)",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Par Ligue</div>
          {Object.entries(byGame).sort((a,b)=>Math.abs(b[1].profit)-Math.abs(a[1].profit)).map(([g,s])=>{
            const wr=s.won+s.lost>0?s.won/(s.won+s.lost)*100:0;
            return(
              <div key={g} style={{marginBottom:10,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,.06)"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:700,color:"#F2F2F7"}}>{g}</span>
                  <span style={{fontSize:14,fontWeight:800,color:s.profit>0?"#00E676":s.profit<0?"#F87171":"rgba(255,255,255,.3)"}}>
                    {s.profit>0?"+":""}{s.profit.toFixed(2)}$
                  </span>
                </div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.28)"}}>{s.won}G · {s.lost}P · WR {wr.toFixed(0)}%</div>
              </div>
            );
          })}
        </div>
      )}
      {Object.keys(byStat).length>0&&(
        <div className="card" style={{marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.28)",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Par Type de Stat</div>
          {Object.entries(byStat).sort((a,b)=>b[1].profit-a[1].profit).slice(0,8).map(([stat,s])=>{
            const wr=s.won+s.lost>0?s.won/(s.won+s.lost)*100:0;
            return(
              <div key={stat} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
                <div>
                  <div style={{fontSize:12,fontWeight:600,color:"#F2F2F7"}}>{stat}</div>
                  <div style={{fontSize:10,color:"rgba(255,255,255,.28)"}}>{s.won+s.lost} paris · WR {wr.toFixed(0)}%</div>
                </div>
                <span style={{fontSize:13,fontWeight:800,color:s.profit>0?"#00E676":s.profit<0?"#F87171":"rgba(255,255,255,.3)"}}>
                  {s.profit>0?"+":""}{s.profit.toFixed(0)}$
                </span>
              </div>
            );
          })}
        </div>
      )}
      {Object.keys(byMonth).length>0&&(
        <div className="card">
          <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.28)",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Par Mois</div>
          {Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).map(([m,s])=>(
            <div key={m} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
              <div style={{fontSize:12,fontWeight:600,color:"#F2F2F7"}}>{m}</div>
              <div style={{textAlign:"right"}}>
                <span style={{fontSize:13,fontWeight:800,color:s.profit>0?"#00E676":s.profit<0?"#F87171":"rgba(255,255,255,.3)"}}>
                  {s.profit>0?"+":""}{s.profit.toFixed(0)}$
                </span>
                <span style={{fontSize:11,color:"rgba(255,255,255,.28)",marginLeft:8}}>{s.count} paris</span>
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
  const[leagues,setLeagues]=useState([]);
  const[selectedLeague,setSelectedLeague]=useState(null);
  const[clubs,setClubs]=useState([]);
  const[selectedClub,setSelectedClub]=useState(null);
  const[players,setPlayers]=useState([]);
  const[editingPlayer,setEditingPlayer]=useState(null);
  const[creatingPlayer,setCreatingPlayer]=useState(false);
  const[loading,setLoading]=useState(false);
  const[uploadingId,setUploadingId]=useState(null);
  const[globalSearch,setGlobalSearch]=useState("");
  const[playerSearch,setPlayerSearch]=useState("");

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

  useEffect(()=>{
    if(!selectedLeague)return;
    setLoading(true);setSelectedClub(null);setPlayers([]);
    fetchClubs(selectedLeague.name).then(async cs=>{
      // 1. Appliquer logos depuis le cache global (résout le pb cross-ligue)
      cs=cs.map(c=>({...c,logo:CLUB_LOGOS_MAP[c.name]||c.logo||null}));
      // 2. Count de joueurs par club — le champ ligue s'appelle "game" dans la table players
      try{
        if(cs.length>0){
          // Récupérer par team name (couvre les clubs présents dans plusieurs ligues)
          const names=cs.map(c=>c.name);
          const q=SUPA_URL+"/rest/v1/players?team=in.("+names.map(n=>encodeURIComponent(n)).join(",")+")"+"&select=team&limit=2000";
          const r=await fetch(q,{headers:H});
          if(r.ok){
            const rows=await r.json();
            const countMap={};
            rows.forEach(p=>{if(p.team)countMap[p.team]=(countMap[p.team]||0)+1;});
            cs=cs.map(c=>({...c,player_count:countMap[c.name]||0}));
          }
        }
      }catch(_){}
      setClubs(cs);
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[selectedLeague]);

  useEffect(()=>{
    if(!selectedClub)return;
    setLoading(true);setPlayers([]);setPlayerSearch("");
    fetch(SUPA_URL+"/rest/v1/players?team=eq."+encodeURIComponent(selectedClub.name)+"&select=*&order=name.asc",{headers:H})
      .then(r=>r.json()).then(rows=>setPlayers(Array.isArray(rows)?rows:[])).catch(()=>{}).finally(()=>setLoading(false));
  },[selectedClub]);

  const POS_ORDER=["PG","SG","SF","PF","C","G","F","Guard","Wing","Forward","Big",""];
  function posRank(role){const i=POS_ORDER.indexOf(role||"");return i===-1?99:i;}

  async function pasteLeagueLogo(lg){
    try{
      const url=await pasteImageToSupabase("league_"+lg.name.replace(/\s/g,"_").toLowerCase());
      await updateLeague(lg.id,{logo:url});
      setLeagues(prev=>prev.map(l=>l.id===lg.id?{...l,logo:url}:l));
      if(selectedLeague?.id===lg.id)setSelectedLeague(prev=>({...prev,logo:url}));
      LEAGUE_LOGOS_DYNAMIC[lg.name]=url;
      showToast("Logo "+lg.name+" mis à jour ✓");
    }catch(e){showToast("Erreur: "+e.message,"#F87171");}
  }

  async function pasteClubLogo(club){
    try{
      const url=await pasteImageToSupabase("club_"+club.name.replace(/\s/g,"_").toLowerCase());
      // Mettre à jour tous les clubs du même nom en local (toutes ligues)
      setClubs(prev=>prev.map(c=>c.name===club.name?{...c,logo:url}:c));
      if(selectedClub?.name===club.name)setSelectedClub(prev=>({...prev,logo:url}));
      setPlayers(prev=>prev.map(p=>p.team===club.name?{...p,team_logo_url:url}:p));
      // Map global → toutes les vues (BetDetailModal, Mes Paris, etc.)
      CLUB_LOGOS_MAP[club.name]=url;
      // Sync DB : tous les clubs du même nom, toutes ligues
      syncClubLogoAllLeagues(club.name,url).catch(e=>console.warn("Club logo sync:",e));
      // Sync tous les joueurs du même club
      fetch(SUPA_URL+"/rest/v1/players?team=eq."+encodeURIComponent(club.name),{
        method:"PATCH",headers:{...H},body:JSON.stringify({team_logo_url:url}),
      }).catch(e=>console.warn("Players team_logo_url:",e));
      showToast("Logo "+club.name+" synchronisé sur toutes les ligues ✓");
    }catch(e){showToast("Erreur: "+e.message,"#F87171");}
  }

  async function pastePlayerPhoto(p){
    setUploadingId(p.id);
    try{
      const url=await pasteImageToSupabase("player_"+p.name.replace(/\s/g,"_").toLowerCase());
      await updatePlayer(p.id,{photo_url:url,avatar_url:url});
      setPlayers(prev=>prev.map(pl=>pl.id===p.id?{...pl,photo_url:url}:pl));
      if(editingPlayer?.id===p.id)setEditingPlayer(prev=>({...prev,photo_url:url}));
      showToast("Photo mise à jour ✓");
    }catch(e){showToast("Erreur: "+e.message,"#F87171");}
    setUploadingId(null);
  }

  async function createPlayer(fields){
    // fields: {name, role, team, game, team_logo_url, photo_url?}
    try{
      const r=await fetch(SUPA_URL+"/rest/v1/players",{
        method:"POST",
        headers:{...H,"Prefer":"return=representation"},
        body:JSON.stringify(fields),
      });
      if(!r.ok)throw new Error("create player: "+r.status);
      const[newP]=await r.json();
      setPlayers(prev=>[...prev,newP].sort((a,b)=>a.name.localeCompare(b.name)));
      setCreatingPlayer(false);
      showToast(fields.name+" ajouté ✓");
    }catch(e){showToast("Erreur: "+e.message,"#F87171");}
  }

  async function savePlayer(p,fields){
    try{
      // Si le club change, récupérer le logo du club destination (toutes ligues)
      let extraFields={};
      if(fields.team&&fields.team!==p.team){
        // Chercher le logo dans le map global d'abord
        const existingLogo=CLUB_LOGOS_MAP[fields.team];
        if(existingLogo){
          extraFields.team_logo_url=existingLogo;
        } else {
          // Sinon requête DB — prendre n'importe quelle entrée du club par nom
          try{
            const r=await fetch(SUPA_URL+"/rest/v1/clubs?name=eq."+encodeURIComponent(fields.team)+"&select=logo&limit=1",{headers:H});
            if(r.ok){const[row]=await r.json();if(row?.logo)extraFields.team_logo_url=row.logo;}
          }catch(_){}
        }
      }
      const merged={...fields,...extraFields};
      await updatePlayer(p.id,merged);
      setPlayers(prev=>prev.map(pl=>pl.id===p.id?{...pl,...merged}:pl));
      setEditingPlayer(null);
      showToast("Joueur mis à jour ✓");
    }catch(e){showToast("Erreur: "+e.message,"#F87171");}
  }

  // Niveau 1 : Ligues
  if(!selectedLeague){
    const leagueMatches=globalSearch.length>=1
      ?leagues.filter(l=>l.name.toLowerCase().includes(globalSearch.toLowerCase()))
      :leagues;
    return(
      <div style={{padding:"0"}}>
        <div style={{position:"relative",marginBottom:16}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",
            fontSize:16,color:"rgba(255,255,255,.28)",pointerEvents:"none"}}>⌕</span>
          <input className="form-input"
            placeholder="Joueur, ligue ou club…"
            value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)}
            style={{paddingLeft:38}}/>
          {globalSearch&&(
            <button onClick={()=>setGlobalSearch("")}
              style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                background:"transparent",border:"none",color:"rgba(255,255,255,.28)",cursor:"pointer",fontSize:18}}>×</button>
          )}
        </div>
        {!globalSearch&&<div style={{fontSize:12,color:"rgba(255,255,255,.28)",fontWeight:600,
          marginBottom:14,textTransform:"uppercase",letterSpacing:.8}}>Sélectionne une ligue</div>}
        {leagueMatches.map(lg=>(
          <div key={lg.id} style={{display:"flex",alignItems:"center",gap:12,
            padding:14,background:"#1C1C1F",border:"1px solid rgba(255,255,255,.07)",
            borderRadius:10,marginBottom:8,cursor:"pointer"}}
            onClick={()=>{setSelectedLeague(lg);setGlobalSearch("");}}>
            {lg.logo
              ?<img src={lg.logo} style={{width:44,height:44,objectFit:"contain",
                  borderRadius:10,background:"#2A2A2E",padding:4,flexShrink:0}} alt=""/>
              :<div style={{width:44,height:44,borderRadius:10,background:"#2A2A2E",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>◉</div>
            }
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:700,color:"#F2F2F7"}}>{lg.name}</div>
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

  // Niveau 2 : Clubs
  if(!selectedClub){
    return(
      <div style={{padding:"0"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20}}>
          <button onClick={()=>setSelectedLeague(null)}
            style={{background:"transparent",border:"none",color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:24,padding:0,lineHeight:1}}>‹</button>
          {selectedLeague.logo
            ?<img src={selectedLeague.logo} style={{width:36,height:36,objectFit:"contain",borderRadius:8,background:"#2A2A2E",padding:4}} alt=""/>
            :<div style={{width:36,height:36,borderRadius:8,background:"#2A2A2E",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>◉</div>
          }
          <div style={{flex:1}}>
            <div style={{fontSize:16,fontWeight:800,color:"#F2F2F7"}}>{selectedLeague.name}</div>
            <div style={{fontSize:11,color:"rgba(255,255,255,.28)"}}>{clubs.length} clubs</div>
          </div>
          <button className="icon-btn" onClick={()=>pasteLeagueLogo(selectedLeague)}
            style={{display:"flex",alignItems:"center",justifyContent:"center",padding:6}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
              <rect x="8" y="2" width="12" height="14" rx="2"/>
            </svg>
          </button>
        </div>
        <div style={{position:"relative",marginBottom:14}}>
          <input className="form-input" placeholder="Rechercher un club…"
            value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)}/>
          {playerSearch&&<button onClick={()=>setPlayerSearch("")}
            style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
              background:"transparent",border:"none",color:"rgba(255,255,255,.28)",cursor:"pointer",fontSize:18}}>×</button>}
        </div>
        {loading&&<div style={{textAlign:"center",color:"rgba(255,255,255,.28)",padding:32}}>Chargement…</div>}
        {clubs.filter(c=>!playerSearch||c.name.toLowerCase().includes(playerSearch.toLowerCase())).map(club=>(
          <div key={club.id} style={{display:"flex",alignItems:"center",gap:12,
            padding:14,background:"#1C1C1F",border:"1px solid rgba(255,255,255,.07)",
            borderRadius:10,marginBottom:8,cursor:"pointer"}}
            onClick={()=>setSelectedClub(club)}>
            {club.logo
              ?<img src={club.logo} style={{width:44,height:44,objectFit:"contain",borderRadius:10,background:"#2A2A2E",padding:4,flexShrink:0}} alt=""/>
              :<div style={{width:44,height:44,borderRadius:10,background:"#2A2A2E",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>◫</div>
            }
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:"#F2F2F7",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{club.name}</div>
              {club.player_count>0&&<div style={{fontSize:11,color:"rgba(255,255,255,.28)",marginTop:2}}>{club.player_count} joueur{club.player_count>1?"s":""}</div>}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <button className="icon-btn" title="Changer logo"
                onClick={e=>{e.stopPropagation();pasteClubLogo(club);}}
                style={{display:"flex",alignItems:"center",justifyContent:"center",padding:6}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
                  <rect x="8" y="2" width="12" height="14" rx="2"/>
                </svg>
              </button>
              <span style={{color:"#4B5563",fontSize:20}}>›</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Niveau 3 : Joueurs
  const searchLow2=playerSearch.toLowerCase().trim();
  const filteredPlayers=[...players]
    .filter(p=>{
      if(!searchLow2)return true;
      const n=p.name.toLowerCase();
      const words=n.split(" ");
      const initials=words.map(w=>w[0]||"").join("");
      return n.includes(searchLow2)||initials.includes(searchLow2);
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
    <div style={{padding:"0"}}>
      {/* Header club */}
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
        <button onClick={()=>{setSelectedClub(null);setPlayerSearch("");}}
          style={{background:"transparent",border:"none",color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:24,padding:0,lineHeight:1}}>‹</button>
        {selectedClub.logo
          ?<img src={selectedClub.logo} style={{width:36,height:36,objectFit:"contain",borderRadius:8,background:"#2A2A2E",padding:4}} alt=""/>
          :<div style={{width:36,height:36,borderRadius:8,background:"#2A2A2E",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>◫</div>
        }
        <div style={{flex:1}}>
          <div style={{fontSize:16,fontWeight:800,color:"#F2F2F7"}}>{selectedClub.name}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.28)"}}>{players.length} joueur{players.length!==1?"s":""}</div>
        </div>
        {/* Coller logo */}
        <button className="icon-btn" onClick={()=>pasteClubLogo(selectedClub)}
          style={{display:"flex",alignItems:"center",justifyContent:"center",padding:6}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
            <rect x="8" y="2" width="12" height="14" rx="2"/>
          </svg>
        </button>
        {/* Ajouter joueur */}
        <button onClick={()=>setCreatingPlayer(true)}
          style={{width:34,height:34,borderRadius:"50%",border:"none",
            background:"#6366F1",color:"#fff",fontSize:22,lineHeight:1,
            display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>+</button>
      </div>

      {/* Barre recherche + bouton créer joueur */}
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <div style={{position:"relative",flex:1}}>
          <span style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:16,color:"rgba(255,255,255,.28)",pointerEvents:"none"}}>⌕</span>
          <input className="form-input" placeholder="Rechercher un joueur…"
            value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)}
            style={{paddingLeft:38}}/>
          {playerSearch&&(
            <button onClick={()=>setPlayerSearch("")}
              style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",
                background:"transparent",border:"none",color:"rgba(255,255,255,.28)",cursor:"pointer",fontSize:18}}>×</button>
          )}
        </div>
      </div>

      {loading&&<div style={{textAlign:"center",color:"rgba(255,255,255,.28)",padding:32}}>Chargement…</div>}
      {!loading&&filteredPlayers.length===0&&!playerSearch&&(
        <button onClick={()=>setCreatingPlayer(true)}
          style={{width:"100%",padding:"20px 0",border:"1px dashed rgba(99,102,241,.3)",borderRadius:12,
            background:"rgba(99,102,241,.04)",color:"rgba(99,102,241,.7)",fontSize:13,fontWeight:600,
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span style={{fontSize:20,lineHeight:1}}>+</span> Ajouter le premier joueur
        </button>
      )}
      {!loading&&filteredPlayers.length===0&&playerSearch&&(
        <div className="empty">
          <div className="empty-icon" style={{fontSize:32,color:"#374151"}}>○</div>
          <div className="empty-text">Aucun résultat pour "{playerSearch}"</div>
        </div>
      )}
      {Object.entries(groups).map(([pos,pList])=>(
        <div key={pos} style={{marginBottom:4}}>
          <div style={{fontSize:10,fontWeight:800,color:"#F2F2F7",
            letterSpacing:1.5,textTransform:"uppercase",padding:"8px 4px 4px",marginBottom:2}}>{pos}</div>
          {pList.map(p=>(
            <PlayerCard key={p.id} player={p} size={72}
              clubLogo={selectedClub?.logo||p.team_logo_url||null}
              onClick={()=>setEditingPlayer(p)}
              onPhotoClick={()=>pastePlayerPhoto(p)}
              uploading={uploadingId===p.id}/>
          ))}
        </div>
      ))}

      {/* Modal édition joueur existant */}
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

      {/* Modal création joueur */}
      {creatingPlayer&&(
        <PlayerCreateModal
          club={selectedClub}
          league={selectedLeague}
          onClose={()=>setCreatingPlayer(false)}
          onCreate={createPlayer}
          pasteImage={pasteImageToSupabase}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ── MODAL CRÉATION JOUEUR ─────────────────────────────────────────────────────
function PlayerCreateModal({club,league,onClose,onCreate,pasteImage,showToast}){
  const[name,setName]=useState("");
  const[role,setRole]=useState("");
  const[photoUrl,setPhotoUrl]=useState(null);
  const[uploading,setUploading]=useState(false);
  const[saving,setSaving]=useState(false);
  const clubLogo=club?.logo||CLUB_LOGOS_MAP[club?.name]||null;

  const nameFormatted=name.trim().split(/\s+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(" ");

  async function pastePhoto(){
    if(!name.trim()){showToast("Entre d'abord le nom","#F87171");return;}
    setUploading(true);
    try{
      const url=await pasteImage("player_"+name.trim().replace(/\s/g,"_").toLowerCase());
      setPhotoUrl(url);
    }catch(e){showToast("Erreur photo: "+e.message,"#F87171");}
    setUploading(false);
  }

  async function save(){
    if(!name.trim()){showToast("Le nom est requis","#F87171");return;}
    setSaving(true);
    await onCreate({
      name:nameFormatted,
      role,
      team:club.name,
      game:league.name,
      league:league.name,
      team_logo_url:clubLogo||null,
      photo_url:photoUrl||null,
      avatar_url:photoUrl||null,
    });
    setSaving(false);
  }

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet" style={{padding:0,overflow:"hidden",borderRadius:"24px 24px 0 0"}}>
        <div className="modal-handle" style={{margin:"12px auto 0"}}/>

        {/* Mini header club */}
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"16px 16px 0"}}>
          {clubLogo
            ?<img src={clubLogo} alt="" style={{width:28,height:28,objectFit:"contain",borderRadius:6,background:"#2A2A2E",padding:3}}/>
            :<div style={{width:28,height:28,borderRadius:6,background:"#2A2A2E",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>◫</div>
          }
          <div>
            <div style={{fontSize:12,fontWeight:700,color:"#F2F2F7"}}>{club.name}</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,.3)"}}>{league.name}</div>
          </div>
          <button onClick={onClose}
            style={{marginLeft:"auto",background:"transparent",border:"none",color:"rgba(255,255,255,.4)",
              fontSize:22,cursor:"pointer",lineHeight:1,padding:4}}>×</button>
        </div>

        <div style={{padding:"16px 16px 32px",display:"flex",flexDirection:"column",gap:14}}>

          {/* Zone photo + nom */}
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            {/* Photo */}
            <div style={{position:"relative",flexShrink:0}}>
              {photoUrl?(
                <img src={photoUrl} alt="" style={{
                  width:80,height:92,objectFit:"cover",objectPosition:"top center",
                  borderRadius:12,border:"2px solid rgba(255,255,255,.1)"
                }}/>
              ):(
                <div style={{width:80,height:92,borderRadius:12,
                  background:"rgba(255,255,255,.05)",border:"1.5px dashed rgba(255,255,255,.12)",
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
                  <span style={{fontSize:24,color:"rgba(255,255,255,.15)"}}>◎</span>
                </div>
              )}
              <button onClick={pastePhoto} disabled={uploading}
                style={{position:"absolute",bottom:-6,right:-6,
                  width:26,height:26,borderRadius:"50%",
                  background:"#6366F1",border:"2px solid #111",
                  display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                {uploading
                  ?<span style={{fontSize:9,color:"#fff"}}>…</span>
                  :<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
                    <rect x="8" y="2" width="12" height="14" rx="2"/>
                  </svg>
                }
              </button>
            </div>
            {/* Nom */}
            <div style={{flex:1}}>
              <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.3)",
                letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>Nom du joueur</div>
              <input className="form-input"
                placeholder="Prénom Nom"
                value={name}
                onChange={e=>setName(e.target.value)}
                style={{fontSize:16,fontWeight:700}}
                autoFocus
              />
              {name.trim()&&<div style={{fontSize:11,color:"rgba(255,255,255,.3)",marginTop:4}}>→ {nameFormatted}</div>}
            </div>
          </div>

          {/* Position — 5 positions standard */}
          <div>
            <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.3)",
              letterSpacing:.8,textTransform:"uppercase",marginBottom:8}}>Position</div>
            <div style={{display:"flex",gap:8}}>
              {BASKET_POSITIONS.map(r=>(
                <button key={r} onClick={()=>setRole(r===role?"":r)}
                  style={{flex:1,padding:"12px 0",borderRadius:12,border:"none",cursor:"pointer",fontSize:13,fontWeight:800,letterSpacing:.3,
                    background:role===r?"#6366F1":"rgba(255,255,255,.06)",
                    color:role===r?"#fff":"rgba(255,255,255,.4)",
                    transition:"all .15s",boxShadow:role===r?"0 0 14px rgba(99,102,241,.4)":"none"}}>
                  {r}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" onClick={save} disabled={saving||!name.trim()}>
            {saving?"Création…":"Créer le joueur"}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

// ── MODAL ÉDITION JOUEUR ──────────────────────────────────────────────────────
// Les 5 positions basket standard — on peut en cumuler plusieurs
const BASKET_POSITIONS=["PG","SG","SF","PF","C"];

// game peut être "EuroLeague" ou "EuroLeague,ACB" — on parse en tableau
function parseGames(g){return(g||"").split(",").map(s=>s.trim()).filter(Boolean);}
function serializeGames(arr){return arr.join(",");}

function PlayerEditModal({player,leagues,clubs,onClose,onPastePhoto,onSave,uploadingId}){
  // Positions : tableau de positions sélectionnées (multi)
  const initRoles=parseGames(player.role||"").filter(r=>BASKET_POSITIONS.includes(r));
  const[roles,setRoles]=useState(initRoles.length?initRoles:(player.role?[player.role]:[]) );
  const[team,setTeam]=useState(player.team||"");
  // Ligues multiples
  const initGames=parseGames(player.game||"");
  const[selectedGames,setSelectedGames]=useState(initGames);
  const[saving,setSaving]=useState(false);
  const[openPicker,setOpenPicker]=useState(null);

  const photo=player.photo_url||player.avatar_url;
  const resolvedTeamLogo=getTeamLogo(team||player.team, player.team_logo_url||null);
  const tc=getTeamColor(team||player.team);
  const pc=tc?.p||"#1C1C22";
  const nameFormatted=(player.name||"").trim().split(/\s+/).map(w=>w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join(" ");

  // Clubs filtrés = union de tous les clubs de toutes les ligues sélectionnées
  const filteredClubs=clubs.filter(c=>selectedGames.includes(c.league)).sort((a,b)=>a.name.localeCompare(b.name));
  const currentClubObj=clubs.find(c=>c.name===team);
  // Affichage des logos de ligues sélectionnées
  const selectedLeagueObjs=selectedGames.map(g=>leagues.find(l=>l.name===g)).filter(Boolean);

  function toggleGame(lname){
    setSelectedGames(prev=>
      prev.includes(lname)?prev.filter(g=>g!==lname):[...prev,lname]
    );
    // Si on retire la ligue du club actuel, reset le club
    if(selectedGames.includes(lname)){
      const remaining=selectedGames.filter(g=>g!==lname);
      if(currentClubObj&&!remaining.includes(currentClubObj.league))setTeam("");
    }
  }

  function toggleRole(r){
    setRoles(prev=>prev.includes(r)?prev.filter(x=>x!==r):[...prev,r]);
  }

  async function save(){
    if(saving)return;
    setSaving(true);
    const gameStr=serializeGames(selectedGames);
    const roleStr=serializeGames(roles);
    await onSave(player,{role:roleStr,team,game:gameStr,league:gameStr});
    setSaving(false);
  }

  const roleDisplay=roles.length?roles.join(" · "):"—";

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-sheet" style={{padding:0,overflow:"hidden",borderRadius:"24px 24px 0 0"}}>
        <div className="modal-handle" style={{margin:"12px auto 0"}}/>

        {/* ── HERO HEADER ── */}
        <div style={{
          position:"relative",height:180,overflow:"hidden",flexShrink:0,
          background:pc?`linear-gradient(135deg,${pc}CC 0%,${pc}44 50%,#0D0D12 100%)`:"#1C1C22",
        }}>
          {resolvedTeamLogo&&(
            <img src={resolvedTeamLogo} alt="" style={{
              position:"absolute",right:-20,top:"50%",transform:"translateY(-50%)",
              width:160,height:160,objectFit:"contain",opacity:.08,filter:"blur(1px)",pointerEvents:"none",
            }}/>
          )}
          <div style={{position:"absolute",bottom:0,left:20,display:"flex",alignItems:"flex-end",gap:16}}>
            <div style={{position:"relative"}}>
              {photo?(
                <img src={photo} alt={nameFormatted} style={{
                  width:130,height:150,objectFit:"cover",objectPosition:"top center",
                  borderRadius:"14px 14px 0 0",
                  maskImage:"linear-gradient(to bottom,black 60%,transparent 100%)",
                  WebkitMaskImage:"linear-gradient(to bottom,black 60%,transparent 100%)",
                }}/>
              ):(
                <div style={{width:130,height:150,borderRadius:"14px 14px 0 0",
                  background:"rgba(255,255,255,.06)",display:"flex",alignItems:"center",
                  justifyContent:"center",fontSize:48,color:"rgba(255,255,255,.15)"}}>◎</div>
              )}
              <button onClick={onPastePhoto} disabled={uploadingId===player.id}
                style={{position:"absolute",bottom:8,right:8,width:30,height:30,borderRadius:"50%",
                  background:"rgba(0,0,0,.7)",border:"1.5px solid rgba(255,255,255,.2)",
                  display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                {uploadingId===player.id
                  ?<span style={{fontSize:9,color:"#fff"}}>…</span>
                  :<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
                    <rect x="8" y="2" width="12" height="14" rx="2"/>
                  </svg>}
              </button>
            </div>
            <div style={{paddingBottom:14,flex:1}}>
              <div style={{fontFamily:"'Barlow Condensed',inherit",fontSize:26,fontWeight:900,
                color:"#F2F2F7",lineHeight:1.05,letterSpacing:-.3,textShadow:"0 2px 12px rgba(0,0,0,.6)"}}>
                {nameFormatted}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:5,marginTop:5,flexWrap:"wrap"}}>
                {selectedLeagueObjs.map((l,i)=>(
                  <React.Fragment key={l.name}>
                    {i>0&&<span style={{fontSize:9,color:"rgba(255,255,255,.2)"}}>+</span>}
                    {l.logo&&<img src={l.logo} alt="" style={{width:14,height:14,objectFit:"contain",borderRadius:2}}/>}
                    <span style={{fontSize:11,color:"rgba(255,255,255,.45)",fontWeight:600}}>{l.name}</span>
                  </React.Fragment>
                ))}
                {roles.length>0&&<>
                  <span style={{fontSize:9,color:"rgba(255,255,255,.2)"}}>·</span>
                  <span style={{fontSize:11,color:"rgba(255,255,255,.45)",fontWeight:600}}>{roleDisplay}</span>
                </>}
              </div>
            </div>
          </div>
        </div>

        {/* ── CHAMPS ÉDITABLES ── */}
        <div style={{padding:"20px 16px 32px",display:"flex",flexDirection:"column",gap:10}}>

          {/* Ligues — multi-sélection */}
          <div>
            <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.3)",letterSpacing:.8,
              textTransform:"uppercase",marginBottom:6}}>
              Ligues <span style={{color:"rgba(99,102,241,.6)",fontWeight:500,letterSpacing:0,textTransform:"none",fontSize:9}}>(plusieurs possible)</span>
            </div>
            <button onClick={()=>setOpenPicker(openPicker==="league"?null:"league")}
              style={{width:"100%",background:"#1C1C22",
                border:`1px solid ${openPicker==="league"?"rgba(99,102,241,.5)":"rgba(255,255,255,.08)"}`,
                borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:8,cursor:"pointer",minHeight:46}}>
              {selectedLeagueObjs.length===0&&(
                <span style={{fontSize:14,fontWeight:600,color:"rgba(255,255,255,.3)"}}>Sélectionner…</span>
              )}
              <div style={{display:"flex",gap:6,flexWrap:"wrap",flex:1,alignItems:"center"}}>
                {selectedLeagueObjs.map(l=>(
                  <div key={l.name} style={{display:"flex",alignItems:"center",gap:5,
                    background:"rgba(99,102,241,.15)",borderRadius:20,padding:"3px 10px 3px 6px"}}>
                    {l.logo&&<img src={l.logo} alt="" style={{width:16,height:16,objectFit:"contain",borderRadius:3}}/>}
                    <span style={{fontSize:12,fontWeight:700,color:"#818CF8"}}>{l.name}</span>
                  </div>
                ))}
              </div>
              <span style={{fontSize:10,color:"rgba(255,255,255,.25)",flexShrink:0}}>▾</span>
            </button>
            {openPicker==="league"&&(
              <div style={{background:"#1C1C22",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,
                marginTop:4,overflow:"hidden",maxHeight:220,overflowY:"auto"}}>
                {leagues.map(l=>{
                  const checked=selectedGames.includes(l.name);
                  return(
                    <div key={l.id} onClick={()=>toggleGame(l.name)}
                      style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",cursor:"pointer",
                        background:checked?"rgba(99,102,241,.1)":"transparent",
                        borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                      {/* Checkbox visuelle */}
                      <div style={{width:18,height:18,borderRadius:5,flexShrink:0,
                        background:checked?"#6366F1":"transparent",
                        border:`1.5px solid ${checked?"#6366F1":"rgba(255,255,255,.2)"}`,
                        display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {checked&&<span style={{fontSize:10,color:"#fff",lineHeight:1}}>✓</span>}
                      </div>
                      {l.logo&&<img src={l.logo} alt="" style={{width:22,height:22,objectFit:"contain",borderRadius:4}}/>}
                      <span style={{fontSize:13,fontWeight:600,color:checked?"#818CF8":"#F2F2F7"}}>{l.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Club */}
          <div>
            <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.3)",letterSpacing:.8,
              textTransform:"uppercase",marginBottom:6}}>Club</div>
            <button onClick={()=>setOpenPicker(openPicker==="club"?null:"club")}
              style={{width:"100%",background:"#1C1C22",
                border:`1px solid ${openPicker==="club"?"rgba(99,102,241,.5)":"rgba(255,255,255,.08)"}`,
                borderRadius:12,padding:"12px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
              {currentClubObj?.logo&&<img src={currentClubObj.logo} alt="" style={{width:22,height:22,objectFit:"contain",borderRadius:4,background:"#2A2A2E",padding:2}}/>}
              <span style={{flex:1,textAlign:"left",fontSize:14,fontWeight:600,color:team?"#F2F2F7":"rgba(255,255,255,.3)"}}>
                {team||"Sélectionner un club…"}
              </span>
              <span style={{fontSize:10,color:"rgba(255,255,255,.25)"}}>▾</span>
            </button>
            {openPicker==="club"&&(
              <div style={{background:"#1C1C22",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,
                marginTop:4,overflow:"hidden",maxHeight:220,overflowY:"auto"}}>
                {filteredClubs.length===0&&(
                  <div style={{padding:"12px 14px",fontSize:12,color:"rgba(255,255,255,.3)"}}>
                    {selectedGames.length?"Aucun club trouvé":"Sélectionnez d'abord une ligue"}
                  </div>
                )}
                {filteredClubs.map(c=>(
                  <div key={c.id} onClick={()=>{setTeam(c.name);setOpenPicker(null);}}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",cursor:"pointer",
                      background:team===c.name?"rgba(99,102,241,.1)":"transparent",
                      borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                    {c.logo&&<img src={c.logo} alt="" style={{width:22,height:22,objectFit:"contain",borderRadius:4,background:"#2A2A2E",padding:2}}/>}
                    <span style={{flex:1,fontSize:13,fontWeight:600,color:team===c.name?"#818CF8":"#F2F2F7"}}>{c.name}</span>
                    {/* Badge ligue du club */}
                    <span style={{fontSize:10,color:"rgba(255,255,255,.25)"}}>{c.league}</span>
                    {team===c.name&&<span style={{fontSize:11,color:"#818CF8"}}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Position — 5 positions standard, multi-sélection */}
          <div>
            <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,.3)",letterSpacing:.8,
              textTransform:"uppercase",marginBottom:8}}>
              Position <span style={{color:"rgba(99,102,241,.6)",fontWeight:500,letterSpacing:0,textTransform:"none",fontSize:9}}>(plusieurs possible)</span>
            </div>
            <div style={{display:"flex",gap:8}}>
              {BASKET_POSITIONS.map(r=>{
                const active=roles.includes(r);
                return(
                  <button key={r} onClick={()=>toggleRole(r)}
                    style={{flex:1,padding:"12px 0",borderRadius:12,border:"none",cursor:"pointer",
                      fontSize:13,fontWeight:800,letterSpacing:.3,
                      background:active?"#6366F1":"rgba(255,255,255,.06)",
                      color:active?"#fff":"rgba(255,255,255,.4)",
                      transition:"all .15s",boxShadow:active?"0 0 14px rgba(99,102,241,.4)":"none"}}>
                    {r}
                  </button>
                );
              })}
            </div>
          </div>

          <button className="btn btn-primary" onClick={save} disabled={saving} style={{marginTop:6}}>
            {saving?"Sauvegarde…":"Sauvegarder"}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

// ── VUE SETTINGS ─────────────────────────────────────────────────────────────
function SettingsView({bookmakers,onUpdateBK,tipsters,onUpdateTip,showToast}){
  const[tab,setTab]=useState("bookmakers");
  const[showAdd,setShowAdd]=useState(false);
  const[editBK,setEditBK]=useState(null);

  async function deleteBK(bk){
    if(!window.confirm("Supprimer "+bk.name+" ?"))return;
    try{
      await deleteBookmaker(bk.id);
      onUpdateBK();
      showToast(bk.name+" supprimé","#F87171");
    }catch(e){showToast("Erreur: "+e.message,"#F87171");}
  }

  async function deleteTip(t){
    if(!window.confirm("Supprimer "+t.name+" ?"))return;
    try{
      await deleteTipster(t.id);
      onUpdateTip();
      showToast(t.name+" supprimé","#F87171");
    }catch(e){showToast("Erreur: "+e.message,"#F87171");}
  }

  async function addTipster(){
    const name=prompt("Nom du tipster :");
    if(!name||!name.trim())return;
    const n=name.trim();
    if(tipsters.find(t=>t.name===n)){showToast(n+" existe déjà","rgba(255,255,255,.6)");return;}
    try{
      await insertTipster({id:uuid(),name:n});
      onUpdateTip();
      showToast(n+" ajouté ✓");
    }catch(e){showToast("Erreur: "+e.message,"#F87171");}
  }

  return(
    <div style={{padding:"16px"}}>
      <div className="tabs">
        <button className={"tab"+(tab==="bookmakers"?" active":"")} onClick={()=>setTab("bookmakers")}>◉ BK</button>
        <button className={"tab"+(tab==="tipsters"?" active":"")} onClick={()=>setTab("tipsters")}>◎ Tips</button>
        <button className={"tab"+(tab==="edit"?" active":"")} onClick={()=>setTab("edit")}>✎ Édition</button>
      </div>

      {tab==="bookmakers"&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:13,color:"rgba(255,255,255,.28)",fontWeight:600}}>
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
              {bk.logo?<img src={bk.logo} className="bk-logo" alt={bk.name}/>
                :<div className="bk-logo-placeholder">◉</div>}
              <div style={{flex:1,minWidth:0}}>
                <div className="bk-name">{bk.name}</div>
                {bk.url&&<div style={{fontSize:11,color:"rgba(255,255,255,.28)",marginTop:2}}>{bk.url}</div>}
              </div>
              <div className="bk-actions">
                <button className="icon-btn" onClick={()=>{setEditBK(bk);setShowAdd(true);}}>✎</button>
                <button className="icon-btn danger" onClick={()=>deleteBK(bk)}>×</button>
              </div>
            </div>
          ))}
          {showAdd&&(
            <BKModal bk={editBK} existing={bookmakers.map(b=>b.name)}
              onClose={()=>{setShowAdd(false);setEditBK(null);}}
              onSave={async(newBK)=>{
                try{
                  if(editBK){await updateBookmaker(editBK.id,{logo:newBK.logo,url:newBK.url});}
                  else{await insertBookmaker({id:uuid(),name:newBK.name,logo:newBK.logo||null,url:newBK.url||null});}
                  onUpdateBK();setShowAdd(false);setEditBK(null);
                  showToast((editBK?"Modifié: ":"Ajouté: ")+newBK.name);
                }catch(e){showToast("Erreur: "+e.message,"#F87171");}
              }}
            />
          )}
        </>
      )}

      {tab==="tipsters"&&(
        <>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:13,color:"rgba(255,255,255,.28)",fontWeight:600}}>
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
              <div style={{flex:1}}><div className="bk-name">{t.name}</div></div>
              <div className="bk-actions">
                <button className="icon-btn danger" onClick={()=>deleteTip(t)}>×</button>
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
    }catch(e){alert("⊕ "+e.message);}
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
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
          {logo
            ?<img src={logo} style={{width:64,height:64,borderRadius:10,objectFit:"contain",background:"#2A2A2E",padding:6}} alt="logo"/>
            :<div style={{width:64,height:64,borderRadius:10,background:"#2A2A2E",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>◉</div>
          }
          <div style={{flex:1}}>
            <button className="btn btn-secondary" style={{marginBottom:8}} onClick={pasteLogo} disabled={uploading}>
              {uploading?"Upload…":"Coller un logo"}
            </button>
            {logo&&<button className="btn btn-danger" onClick={()=>setLogo("")}>Supprimer le logo</button>}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Nom *</label>
          <input className="form-input" placeholder="ex: Pinnacle"
            value={name} onChange={e=>setName(e.target.value)} disabled={!!bk}/>
          {bk&&<div style={{fontSize:11,color:"rgba(255,255,255,.28)",marginTop:4}}>Le nom ne peut pas être modifié</div>}
        </div>
        <div className="form-group">
          <label className="form-label">Site web (optionnel)</label>
          <input className="form-input" placeholder="ex: pinnacle.com"
            value={url} onChange={e=>setUrl(e.target.value)}/>
        </div>
        <button className="btn btn-primary" onClick={save}>{bk?"Sauvegarder":"+ Ajouter"}</button>
        <button className="btn btn-secondary" onClick={onClose} style={{marginTop:8}}>Annuler</button>
      </div>
    </div>
  );
}

// ── APP PRINCIPAL ─────────────────────────────────────────────────────────────
export default function App(){
  const[bets,setBets]=useState([]);
  const[bookmakers,setBookmakers]=useState([]);
  const[tipsters,setTipsters]=useState([]);
  const[leagues,setLeagues]=useState([]);
  const[players,setPlayers]=useState([]);
  const[view,setView]=useState("home");
  const[loading,setLoading]=useState(true);
  const[showAdd,setShowAdd]=useState(false);
  const[selectedBet,setSelectedBet]=useState(null);
  const[editBet,setEditBet]=useState(null);
  const[syncing,setSyncing]=useState(false);
  const[lastSync,setLastSync]=useState(null);
  const{toast,show:showToast}=useToast();
  const pollRef=useRef(null);

  useEffect(()=>{
    // ── Enregistrement Service Worker (cache images) ──
    if('serviceWorker' in navigator){
      navigator.serviceWorker.register('/sw.js',{scope:'/'})
        .then(reg=>console.log('[SW] registered, scope:',reg.scope))
        .catch(err=>console.warn('[SW] registration failed:',err));
    }

    fetchPlayers().then(setPlayers).catch(()=>{});
    fetchBookmakers().then(setBookmakers).catch(()=>{});
    fetchTipsters().then(setTipsters).catch(()=>{});
    // Logos ligues
    fetchLeagues().then(rows=>{
      const map={};
      rows.forEach(l=>{if(l.logo)map[l.name]=l.logo;});
      LEAGUE_LOGOS_DYNAMIC=map;
      setLeagues(rows);
    }).catch(()=>{});
    // Logos clubs → fallback pour team_logo_url non encore propagé sur joueurs
    fetchAllClubs().then(rows=>{
      const map={};
      rows.forEach(c=>{if(c.name&&c.logo)map[c.name]=c.logo;});
      CLUB_LOGOS_MAP=map;
    }).catch(()=>{});
  },[]);

  const loadBets=useCallback(async(silent=false)=>{
    if(!silent)setLoading(true);
    else setSyncing(true);
    try{
      const data=await fetchBets();
      setBets(data);
      setLastSync(new Date());
    }catch(e){if(!silent)console.error(e);}
    setLoading(false);
    setSyncing(false);
  },[]);

  useEffect(()=>{loadBets();},[loadBets]);

  useEffect(()=>{
    pollRef.current=setInterval(()=>{
      if(document.visibilityState==="visible")loadBets(true);
    },30000);
    const onVisible=()=>{if(document.visibilityState==="visible")loadBets(true);};
    document.addEventListener("visibilitychange",onVisible);
    return()=>{clearInterval(pollRef.current);document.removeEventListener("visibilitychange",onVisible);};
  },[loadBets]);

  function openEdit(bet){setSelectedBet(null);setEditBet(bet);}

  if(loading)return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",
      justifyContent:"center",height:"100vh",gap:16}}>
      <div style={{width:48,height:48,borderRadius:10,
        background:"#2A2A2E",
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>◉</div>
      <div style={{color:"rgba(255,255,255,.28)",fontSize:14}}>Chargement…</div>
    </div>
  );

  return(
    <>
      <style>{CSS}</style>
      <div className="app">
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
              background:syncing?"rgba(255,255,255,.6)":"#7C3AED",
              boxShadow:"0 0 6px "+(syncing?"rgba(245,158,11,.8)":"rgba(0,230,118,.8)")}}/>
            <button onClick={()=>loadBets(true)}
              style={{background:"transparent",border:"none",color:"rgba(255,255,255,.28)",cursor:"pointer",fontSize:18,padding:"4px 8px"}}>↻</button>
          </div>
        </div>

        <div style={{paddingTop:12}}>
          {view==="home"&&<HomeView bets={bets} players={players} onNavigate={setView}/>}
          {view==="bets"&&<BetsView bets={bets} players={players} bookmakers={bookmakers}
            bkPhotos={Object.fromEntries(bookmakers.map(bk=>[bk.name,bk.logo]).filter(([,v])=>v))}
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

        <nav className="nav">
          <button className={"nav-btn"+(view==="home"?" active":"")} onClick={()=>setView("home")}>
            <span className="nav-icon" style={{fontSize:22,fontWeight:300}}>⌂</span>ACCUEIL
          </button>
          <button className={"nav-btn"+(view==="bets"?" active":"")} onClick={()=>setView("bets")}>
            <span className="nav-icon" style={{fontSize:20}}>≡</span>MES PARIS
          </button>
          <button className="nav-add" onClick={()=>{setShowAdd(true);}} style={{fontSize:28,fontWeight:200}}>+</button>
          <button className={"nav-btn"+(view==="stats"?" active":"")} onClick={()=>setView("stats")}>
            <span className="nav-icon" style={{fontSize:20}}>◫</span>STATS
          </button>
          <button className={"nav-btn"+(view==="settings"?" active":"")} onClick={()=>setView("settings")}>
            <span className="nav-icon" style={{fontSize:20}}>◈</span>SETTINGS
          </button>
        </nav>

        {(showAdd||editBet)&&(
          <AddBetModal
            players={players}
            bookmakers={bookmakers.length>0?bookmakers.map(b=>b.name):DEFAULT_BOOKMAKERS}
            bkPhotos={Object.fromEntries(bookmakers.map(bk=>[bk.name,bk.logo]).filter(([,v])=>v))}
            tipsters={tipsters}
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
            bkPhotos={Object.fromEntries(bookmakers.map(bk=>[bk.name,bk.logo]).filter(([,v])=>v))}
            bookmakerList={bookmakers.map(bk=>({name:bk.name,logo:bk.logo}))}
            tipsterList={tipsters}
            leagueList={leagues}
            onClose={()=>setSelectedBet(null)}
            onUpdate={()=>{loadBets(true);setSelectedBet(null);}}
            onDelete={()=>{loadBets(true);setSelectedBet(null);}}
          />
        )}

        {toast&&(
          <div className="toast" style={{borderColor:toast.color,color:toast.color}}>
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
}

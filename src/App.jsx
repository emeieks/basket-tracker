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
          try{
            const r=await fetch(m[1]);
            if(r.ok){const b=await r.blob();if(b.type.startsWith("image/")){return uploadBlob(b);}}
          }catch(_){}
          // fallback: retourner l'URL directement si c'est une URL publique valide
          if(m[1].match(/^https?:\/\//))return m[1];
        }
      }catch(_){}
    }
  }
  // fallback: lire l'URL texte dans le presse-papier
  try{
    const text=(await navigator.clipboard.readText()).trim();
    if(text.match(/^https?:\/\/.*\.(png|jpg|jpeg|webp|svg|gif)/i))return text;
  }catch(_){}
  throw new Error("Aucune image trouvée — fais clic-droit → Copier l'image");
}

// ── STYLES CSS ────────────────────────────────────────────────────────────────
const CSS=`

*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}

body{
  background:#14161B;
  color:#F2F2F7;
  font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display',system-ui,sans-serif;
  font-variant-numeric:tabular-nums;
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
  background:rgba(20,22,27,.94);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-top:1px solid #252A34;
  display:flex;align-items:center;justify-content:space-around;z-index:100;
  padding:10px 8px calc(10px + env(safe-area-inset-bottom));
}
.nav-btn{
  width:52px;height:40px;display:flex;align-items:center;justify-content:center;
  border:none;background:transparent;color:#6B7280;cursor:pointer;transition:color .15s;
}
.nav-btn.active{color:#5B9DFF;}
.nav-add{
  width:44px;height:44px;border-radius:14px;background:#5B9DFF;border:none;color:#0C1424;
  cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .12s;
}
.nav-add:active{transform:scale(.92);}

/* ── HEADER ── */
.header{padding:calc(18px + env(safe-area-inset-top)) 20px 10px;display:flex;align-items:center;justify-content:space-between;}
.header-title{font-size:32px;font-weight:700;color:#F2F3F5;letter-spacing:-.6px;}

/* ── CHAMPS FORMULAIRE (nouveau pari) ── */
.fld{width:100%;height:54px;background:#1C1F26 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none' stroke='%238B92A0' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E") no-repeat right 12px center;
  border:1px solid #252A34;border-radius:14px;color:#F2F3F5;padding:0 30px 0 12px;font-size:16px;font-weight:600;
  appearance:none;-webkit-appearance:none;outline:none;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.fld:focus{border-color:#5B9DFF;}
.fld option{background:#1C1F26;color:#F2F3F5;}
.fld-box{height:62px;display:flex;flex-direction:column;justify-content:center;gap:2px;padding:0 14px;
  background:#1C1F26;border:1px solid #252A34;border-radius:14px;font-size:12px;color:#8B92A0;}
.fld-box:focus-within{border-color:#5B9DFF;}
.fld-box input::-webkit-outer-spin-button,.fld-box input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.fld-box input[type=number]{-moz-appearance:textfield;}
.fld-box input{border:none;background:transparent;color:#F2F3F5;font-size:18px;font-weight:600;outline:none;padding:0;width:100%;}
.row-select{flex:1;min-width:0;height:44px;border:none;background:transparent;color:#F2F3F5;font-size:15px;
  text-align:right;text-align-last:right;outline:none;appearance:none;-webkit-appearance:none;cursor:pointer;padding:0;}
.row-select option{background:#1C1F26;color:#F2F3F5;}

/* ── CARDS — carrées, minimalistes ── */
.card{background:#1C1F26;border:1px solid #252A34;border-radius:12px;padding:16px;margin-bottom:8px;}
.card-sm{background:#1C1F26;border:1px solid #252A34;border-radius:10px;padding:14px;margin-bottom:6px;}

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
.form-input:focus{border-color:rgba(91,157,255,.5);box-shadow:0 0 0 3px rgba(91,157,255,.12),0 2px 6px rgba(0,0,0,.35);}
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
.form-select:focus{border-color:rgba(91,157,255,.5);box-shadow:0 0 0 3px rgba(91,157,255,.12),0 2px 6px rgba(0,0,0,.35);}
.form-select option{background:#1A1A1F;color:#E8E8F0;}

/* ── BUTTONS ── */
.btn{border:none;border-radius:10px;padding:14px 20px;font-size:15px;font-weight:700;cursor:pointer;transition:opacity .12s;width:100%;font-family:inherit;}
.btn:active{opacity:.7;}
.btn-primary{background:#5B9DFF;color:#fff;}
.btn-secondary{background:transparent;color:rgba(255,255,255,.35);border:1px solid #252A34;}
.btn-danger{background:transparent;color:rgba(255,80,80,.8);border:1px solid rgba(255,80,80,.2);}
.btn-sm{padding:8px 14px;font-size:13px;border-radius:8px;}

/* ── PLAYER AVATAR ── */
.player-avatar-wrap{position:relative;flex-shrink:0;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;border-radius:8px;}
.player-avatar-wrap .team-logo-bg{position:absolute;object-fit:contain;pointer-events:none;}
.player-avatar-wrap .player-img{position:relative;z-index:1;object-fit:contain;object-position:50% 85%;-webkit-backface-visibility:hidden;backface-visibility:hidden;transform:translateZ(0);}
.player-avatar-wrap .player-placeholder{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;width:100%;height:100%;}

/* ── AUTOCOMPLETE ── */
.autocomplete{position:relative;}
.autocomplete-list{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#1C1F26;border:1px solid #252A34;border-radius:10px;max-height:260px;overflow-y:auto;z-index:200;box-shadow:0 12px 40px rgba(0,0,0,.7);}
.autocomplete-item{display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;transition:background .1s;}
.autocomplete-item:hover,.autocomplete-item.active{background:rgba(255,255,255,.04);}
.player-name{font-size:14px;font-weight:600;color:#F2F2F7;}
.player-meta{font-size:11px;color:rgba(255,255,255,.3);}

/* ── BET ROW ── */
.bet-row{display:flex;align-items:center;gap:12px;padding:13px 16px;cursor:pointer;transition:background .1s;}
.bet-row:active{background:rgba(255,255,255,.02);}
.bet-info{flex:1;min-width:0;}
.bet-player{font-size:14px;font-weight:700;color:#F2F2F7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bet-desc{font-size:12px;color:rgba(255,255,255,.55);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.bet-right{text-align:right;flex-shrink:0;}
.bet-profit{font-size:16px;font-weight:800;letter-spacing:-.3px;}
.bet-profit.pos{color:#4ADE80;}
.bet-profit.neg{color:#FF8A80;}
.bet-profit.neu{color:rgba(255,255,255,.3);}
.bet-odds{font-size:11px;color:rgba(255,255,255,.45);margin-top:2px;}

/* ── STATUS BUTTONS ── */
.status-row{display:flex;gap:6px;margin-top:0;}
.status-btn{flex:1;padding:11px 6px;border-radius:10px;border:1px solid rgba(255,255,255,.08);border-bottom-color:rgba(0,0,0,.4);font-size:12px;font-weight:700;cursor:pointer;transition:all .15s;background:linear-gradient(180deg,#1A1A1F 0%,#111114 100%);color:rgba(255,255,255,.3);font-family:inherit;letter-spacing:.2px;box-shadow:0 2px 6px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,255,255,.04);}
.status-btn.won.active{background:rgba(74,222,128,.12);border-color:rgba(74,222,128,.35);color:#4ADE80;}
.status-btn.lost.active{background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.3);color:#FF8A80;}
.status-btn.pending.active{background:rgba(91,157,255,.12);border-color:rgba(91,157,255,.35);color:#8BB8FF;}
.status-btn.void.active{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.15);color:rgba(255,255,255,.45);}

/* ── STATS GRID ── */
.stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;}
.stat-card{background:#1C1F26;border:1px solid #252A34;border-radius:12px;padding:16px;}
.stat-value{font-size:26px;font-weight:800;letter-spacing:-.5px;margin-bottom:3px;}
.stat-label{font-size:10px;color:rgba(255,255,255,.28);font-weight:600;text-transform:uppercase;letter-spacing:.9px;}

/* ── TOAST ── */
.toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#252A34;border:1px solid #2A2A2A;border-radius:10px;padding:10px 20px;font-size:13px;font-weight:600;color:#F2F2F7;z-index:999;pointer-events:none;white-space:nowrap;box-shadow:0 8px 32px rgba(0,0,0,.5);}

/* ── MODAL / SHEET ── */
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);z-index:300;display:flex;align-items:flex-end;}
.modal-sheet{background:#181B21;border-radius:16px 16px 0 0;width:100%;max-height:93vh;overflow-y:auto;padding:12px 18px calc(24px + env(safe-area-inset-bottom));border:1px solid #252A34;border-bottom:none;}
.modal-handle{width:32px;height:3px;background:rgba(255,255,255,.12);border-radius:2px;margin:0 auto 20px;}
.modal-title{font-size:18px;font-weight:800;color:#fff;margin-bottom:18px;letter-spacing:-.2px;}

/* ── TABS ── */
.tabs{display:flex;gap:2px;background:#1C1F26;border-radius:8px;padding:3px;margin-bottom:14px;}
.tab{flex:1;padding:8px;border:none;background:transparent;color:rgba(255,255,255,.28);font-size:12px;font-weight:700;border-radius:6px;cursor:pointer;transition:all .15s;font-family:inherit;}
.tab.active{background:#5B9DFF;color:#fff;}

/* ── SEGMENT ── */
.segment{display:flex;background:#1C1F26;border-radius:10px;padding:2px;gap:2px;}
.seg-btn{flex:1;padding:8px 4px;border:none;background:transparent;color:rgba(255,255,255,.3);font-size:13px;font-weight:600;border-radius:6px;cursor:pointer;transition:all .12s;font-family:inherit;}
.seg-btn.active{background:#323845;color:#F2F3F5;box-shadow:0 1px 2px rgba(0,0,0,.3);}

/* ── SETTINGS ── */
.bk-card{display:flex;align-items:center;gap:12px;padding:14px 16px;background:#1C1F26;border:1px solid #252A34;border-radius:12px;margin-bottom:6px;}
.bk-logo{width:38px;height:38px;border-radius:8px;object-fit:contain;background:#252A34;padding:4px;flex-shrink:0;}
.bk-logo-placeholder{width:38px;height:38px;border-radius:8px;background:#252A34;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;}
.bk-name{font-size:14px;font-weight:700;color:#F2F2F7;}
.bk-actions{display:flex;gap:6px;margin-left:auto;}
.icon-btn{width:30px;height:30px;border-radius:7px;border:1px solid #252A34;background:transparent;color:rgba(255,255,255,.28);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all .12s;}
.icon-btn:hover{border-color:rgba(255,255,255,.2);color:#fff;}
.icon-btn.danger:hover{border-color:rgba(255,80,80,.3);color:rgba(255,80,80,.8);}

/* ── PROFIT BIG ── */
.profit-big{font-size:44px;font-weight:900;letter-spacing:-2px;line-height:1;}
.profit-big.pos{color:#4ADE80;}.profit-big.neg{color:#FF8A80;}.profit-big.neu{color:#fff;}

/* ── EMPTY STATE ── */
.empty{text-align:center;padding:60px 20px;}
.empty-icon{font-size:32px;margin-bottom:12px;opacity:.2;}
.empty-text{font-size:15px;font-weight:700;color:rgba(255,255,255,.3);}
.empty-sub{font-size:13px;margin-top:6px;color:rgba(255,255,255,.15);}

/* ── FILTERS ── */
.filter-row{display:flex;gap:6px;overflow-x:auto;padding:0 20px 14px;scrollbar-width:none;}
.filter-row::-webkit-scrollbar{display:none;}
.filter-chip{flex-shrink:0;padding:7px 16px;border-radius:20px;border:1px solid #252A34;background:transparent;color:rgba(255,255,255,.3);font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .12s;font-family:inherit;}
.filter-chip.active{background:rgba(91,157,255,.15);border-color:rgba(91,157,255,.4);color:#8BB8FF;}
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
  const show=useCallback((msg,color="#4ADE80")=>{
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
        background:"#1C1F26",
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
    created_at:editBet.created_at?editBet.created_at.slice(0,16):"",
    betType:editBet.bet_type==="team"?(editBet.description?.includes("gagne")?"moneyline":editBet.description?.includes("mi-temps")?"half":editBet.description?.includes("match")?"total":editBet.description?.includes("pts")?"team_total":"moneyline"):"moneyline",
    team:editBet.team||"",
    opponent:editBet.opponent||"",
  }:{
    player:"",playerObj:null,stat:"Points",ou:"Over",line:"",
    odds:"",stake:"",bookmaker:bookmakers[0]||"",
    status:"pending",game:"",tipster:"",notes:"",created_at:"",
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
      const dateIso=form.created_at?new Date(form.created_at).toISOString():undefined;
      bet={
        player:form.team,team:form.team,opponent:form.opponent||null,
        description:desc,over_under:form.ou||null,
        line:form.line?parseFloat(form.line):null,
        odds,stake,bookmaker:form.bookmaker||null,
        status:form.status,profit:calcProfit(form.status,stake,odds),
        game:form.game||null,tipster:form.tipster||null,
        notes:null,bet_type:"team",
        ...(dateIso?{created_at:dateIso}:{}),
      };
    }else{
      if(!form.player){alert("Sélectionne un joueur");return;}
      const desc=form.ou&&form.line&&form.stat
        ?form.ou+" "+form.line+" "+form.stat:form.stat||"";
      const dateIso=form.created_at?new Date(form.created_at).toISOString():undefined;
      bet={
        player:form.player,team:form.playerObj?.team||null,
        description:desc,over_under:form.ou||null,
        line:form.line?parseFloat(form.line):null,
        odds,stake,bookmaker:form.bookmaker||null,
        status:form.status,profit:calcProfit(form.status,stake,odds),
        game:form.game||form.playerObj?.game||null,
        tipster:form.tipster||null,notes:null,bet_type:"player",
        ...(dateIso?{created_at:dateIso}:{}),
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
    <div style={{position:"fixed",inset:0,background:"#14161B",zIndex:200,
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
                    padding:"10px 12px",background:"#1C1F26",
                    border:"1px solid rgba(245,158,11,.2)",
                    borderRadius:12,marginBottom:6,cursor:"pointer"}}>
                  {/* Logo équipe ou cercle couleur */}
                  {(()=>{const tl=getTeamLogo(team,teamLogoUrl);return tl?(
                    <img src={tl} alt={team}
                      style={{width:40,height:40,objectFit:"contain",borderRadius:8,
                        background:"#252A34",padding:3,flexShrink:0}}/>
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
                    padding:"10px 12px",background:"#1C1F26",
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
  const playerPhoto=!isTeamBet&&(form.playerObj?.photo_url||form.playerObj?.avatar_url);
  const teamName=isTeamBet?form.team:(form.playerObj?.team||"");
  const teamLogoHeader=isTeamBet
    ?getTeamLogo(form.team,players.find(p=>p.team===form.team)?.team_logo_url||null)
    :getTeamLogo(form.playerObj?.team,form.playerObj?.team_logo_url||null);
  const leagueLogo=form.game?getLeagueLogo(form.game):null;
  const nameParts=(isTeamBet?form.team:formatName(form.player)).trim().split(/\s+/);
  const firstLine=isTeamBet?"":nameParts[0]||"";
  const secondLine=isTeamBet?form.team:nameParts.slice(1).join(" ")||nameParts[0]||"";
  const stakeN=parseFloat(String(form.stake).replace(",","."))||0;
  const oddsN=parseFloat(String(form.odds).replace(",","."))||0;
  const potential=stakeN&&oddsN?(stakeN*oddsN).toFixed(2)+"€":"—";
  const lockBtn=(on,toggle,label)=>(
    <button type="button" onClick={toggle} aria-label={label} title={on?"Verrouillé":"Verrouiller"}
      style={{width:44,height:44,border:"none",background:"transparent",cursor:"pointer",
        color:on?C.blue:C.dim,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="5" y="11" width="14" height="10" rx="2"/>{on?<path d="M8 11V7a4 4 0 0 1 8 0v4"/>:<path d="M8 11V7a4 4 0 0 1 7.5-2"/>}
      </svg>
    </button>
  );
  const rowStyle={display:"flex",alignItems:"center",gap:8,minHeight:52,padding:"0 4px 0 16px"};

  return(
    <div style={{position:"fixed",inset:0,background:C.bg,zIndex:200,overflowY:"auto"}}>
      <div style={{maxWidth:430,margin:"0 auto",padding:"8px 20px calc(24px + env(safe-area-inset-bottom))"}}>
        <div style={{display:"grid",gridTemplateColumns:"80px 1fr 80px",alignItems:"center"}}>
          <button onClick={onClose} style={{...linkBtn,textAlign:"left",padding:"12px 0",fontSize:16}}>Annuler</button>
          <span style={{fontSize:16,fontWeight:600,textAlign:"center"}}>{editBet?"Modifier le pari":"Nouveau pari"}</span>
          <span/>
        </div>

        {/* ── Carte joueur ── */}
        <button type="button" onClick={()=>setStep("search")}
          style={{marginTop:14,position:"relative",width:"100%",height:230,borderRadius:20,overflow:"hidden",
            border:"1px solid "+C.line,background:`linear-gradient(135deg,${pc}40 0%,${C.card} 70%)`,
            padding:0,color:C.text,textAlign:"left",cursor:"pointer",display:"block"}}>
          {teamLogoHeader&&(
            <img src={teamLogoHeader} alt="" style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
              width:170,height:170,objectFit:"contain",opacity:.14,pointerEvents:"none"}}/>
          )}
          {playerPhoto&&(
            <img src={playerPhoto} alt={form.player} style={{position:"absolute",right:0,bottom:0,height:"100%",
              maxWidth:"55%",objectFit:"contain",objectPosition:"50% 100%"}}/>
          )}
          <span style={{position:"absolute",left:18,top:20,bottom:18,right:"45%",display:"flex",flexDirection:"column",gap:8}}>
            <span style={{fontSize:13,color:"rgba(255,255,255,.6)"}}>{isTeamBet?"Équipe":"Joueur"}</span>
            <span style={{fontSize:28,fontWeight:700,letterSpacing:-.6,lineHeight:1.08}}>
              {firstLine&&<>{firstLine}<br/></>}{secondLine}
            </span>
            <span style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"rgba(255,255,255,.75)",minWidth:0}}>
              {teamName&&<MiniLogo src={teamLogoHeader} label={teamName} size={18}/>}
              {!isTeamBet&&<span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{teamName}</span>}
              {form.game&&<MiniLogo src={leagueLogo} label={form.game} size={18} round={false}/>}
            </span>
            <span style={{marginTop:"auto",alignSelf:"flex-start",height:32,padding:"0 14px",borderRadius:16,
              background:"rgba(255,255,255,.14)",fontSize:13,fontWeight:500,display:"flex",alignItems:"center"}}>
              Changer {isTeamBet?"d'équipe":"de joueur"}
            </span>
          </span>
        </button>

        <div style={{marginTop:16}}>
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
        {/* ── PARI JOUEUR : Over/Under · Ligne · Stat ── */}
        {!isTeamBet&&(
          <div style={{display:"grid",gridTemplateColumns:"104px 92px minmax(0,1fr)",gap:8}}>
            <select className="fld" aria-label="Over ou Under" value={form.ou} onChange={e=>f("ou",e.target.value)}>
              <option>Over</option><option>Under</option>
            </select>
            <select className="fld" aria-label="Ligne" value={form.line} onChange={e=>f("line",e.target.value)}>
              <option value="">Ligne</option>
              {Array.from({length:45},(_,i)=>(i+0.5).toFixed(1)).map(v=><option key={v} value={v}>{v}</option>)}
            </select>
            <select className="fld" aria-label="Type de stat" value={form.stat} onChange={e=>f("stat",e.target.value)}>
              {["Points","Rebonds","Assists","Points+Rebonds","Points+Assists",
                "Points+Rebonds+Assists","3 Points Made","Steals","Blocks",
                "Turnovers","Fantasy Score","Minutes"].map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        )}
        </div>

        {/* ── Cote + Mise ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginTop:12}}>
          <label className="fld-box">Cote
            <input type="number" step="0.01" inputMode="decimal" placeholder="1.85" value={form.odds}
              onChange={e=>f("odds",e.target.value)}
              onBlur={e=>{
                const n=parseFloat(e.target.value.replace(",","."));
                if(!isNaN(n)&&n>=100)f("odds",(n/100).toFixed(2));
              }}/>
          </label>
          <label className="fld-box">Mise (€)
            <input type="number" inputMode="decimal" placeholder="100" value={form.stake}
              onChange={e=>f("stake",e.target.value)}/>
          </label>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:6,marginTop:8}}>
          {[{pct:"0.5%",val:50},{pct:"0.75%",val:75},{pct:"1%",val:100},{pct:"1.25%",val:125},{pct:"1.5%",val:150}].map(({pct,val})=>{
            const active=String(form.stake)===String(val);
            return(
              <button key={val} type="button" onClick={()=>f("stake",String(val))}
                style={{height:40,borderRadius:10,border:"none",cursor:"pointer",
                  background:active?C.blue:C.card,color:active?"#0C1424":C.sub,
                  fontSize:12,fontWeight:600,lineHeight:1.2}}>
                {pct}<br/><span style={{fontSize:11,opacity:.8}}>{val}€</span>
              </button>
            );
          })}
        </div>

        {/* ── Bookmaker · Tipster · Date · Statut ── */}
        <div style={{marginTop:16,background:C.card,border:"1px solid "+C.line,borderRadius:16}}>
          <div style={{...rowStyle,borderBottom:"1px solid "+C.line}}>
            <span style={{fontSize:15,color:C.sub,width:88,flexShrink:0}}>Bookmaker</span>
            {form.bookmaker&&bkPhotos[form.bookmaker]&&<MiniLogo src={bkPhotos[form.bookmaker]} size={20} round={false}/>}
            <select className="row-select" value={form.bookmaker} onChange={e=>f("bookmaker",e.target.value)}>
              <option value="">Aucun</option>
              {bookmakers.map(b=><option key={b}>{b}</option>)}
            </select>
            {lockBtn(lockedBK,()=>setLockedBK(p=>!p),"Verrouiller le bookmaker")}
          </div>
          <div style={{...rowStyle,borderBottom:"1px solid "+C.line}}>
            <span style={{fontSize:15,color:C.sub,width:88,flexShrink:0}}>Tipster</span>
            {tipsters.length>0?(
              <select className="row-select" value={form.tipster} onChange={e=>f("tipster",e.target.value)}>
                <option value="">Aucun</option>
                {tipsters.map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            ):(
              <input className="row-select" placeholder="Optionnel" value={form.tipster} onChange={e=>f("tipster",e.target.value)}/>
            )}
            {lockBtn(lockedTip,()=>setLockedTip(p=>!p),"Verrouiller le tipster")}
          </div>
          <div style={{...rowStyle,borderBottom:"1px solid "+C.line,paddingRight:16}}>
            <span style={{fontSize:15,color:C.sub,width:88,flexShrink:0}}>Date</span>
            <input type="datetime-local" className="row-select" value={form.created_at||""}
              onChange={e=>f("created_at",e.target.value)} style={{colorScheme:"dark"}}/>
          </div>
          <div style={{padding:"10px 12px 12px"}}>
            <div style={{fontSize:15,color:C.sub,margin:"2px 4px 8px"}}>Statut</div>
            <div className="segment">
              {[{key:"pending",label:"En cours"},{key:"won",label:"Gagné"},{key:"lost",label:"Perdu"},{key:"void",label:"Void"}].map(({key,label})=>{
                const on=form.status===key;
                const col=key==="won"?C.green:key==="lost"?C.red:C.text;
                return(
                  <button key={key} type="button" className={"seg-btn"+(on?" active":"")}
                    onClick={()=>f("status",key)} style={on?{color:col}:undefined}>{label}</button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Gain potentiel ── */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",margin:"16px 4px 0"}}>
          <span style={{fontSize:15,color:C.sub}}>Gain potentiel</span>
          <span style={{fontSize:22,fontWeight:700,color:C.green}}>{potential}</span>
        </div>

        <button onClick={submit} disabled={saving}
          style={{width:"100%",marginTop:16,height:54,borderRadius:14,border:"none",cursor:"pointer",
            background:C.blue,color:"#0C1424",fontSize:17,fontWeight:600,opacity:saving?.6:1}}>
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
        background:isDirty?"rgba(74,222,128,.06)":"#1A1A20",
        borderTop:isDirty?"1px solid rgba(74,222,128,.25)":"1px solid transparent",
        padding:"14px 10px 10px",
        display:"flex",flexDirection:"column",alignItems:"center",gap:5,
        cursor:"pointer",transition:"background .15s",minHeight:72,
        borderRadius:0,position:"relative",
      }}>
        <span style={{fontSize:9,fontWeight:700,color:isDirty?"#4ADE80":"rgba(255,255,255,.3)",
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
              borderBottom:`1px solid ${isDirty?"rgba(74,222,128,.4)":"rgba(255,255,255,.08)"}`,
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
                  background:value===o.label?"rgba(74,222,128,.08)":"transparent",
                  fontSize:13,fontWeight:value===o.label?700:500,
                  color:value===o.label?"#4ADE80":"#F2F2F7",
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

  const statusColor=localBet.status==="won"?"#4ADE80":localBet.status==="lost"?"#FF8A80":localBet.status==="void"?"rgba(255,255,255,.3)":"rgba(255,255,255,.5)";
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
          {/* Logo club en fond — watermark discret */}
          {resolvedTeamLogo&&(
            <img src={resolvedTeamLogo} alt="" style={{
              position:"absolute",right:-30,top:"50%",transform:"translateY(-50%)",
              width:220,height:220,objectFit:"contain",
              opacity:.06,filter:"blur(2px) saturate(0)",
              pointerEvents:"none",zIndex:1,
            }}/>
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
                
                fontSize:20,fontWeight:900,letterSpacing:-.3,
                color:profitNum>0?"#4ADE80":profitNum<0?"#FF8A80":"rgba(255,255,255,.4)",
                textShadow:`0 0 18px ${profitNum>0?"rgba(74,222,128,.5)":profitNum<0?"rgba(248,113,113,.5)":"transparent"}`,
              }}>
                {profitNum>0?"+":""}{localBet.status==="pending"?"—":profitNum.toFixed(2)+"€"}
              </span>
            </div>
            {/* Nom */}
            <div style={{fontSize:26,fontWeight:900,
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
              <span style={{fontSize:13,color:"rgba(255,255,255,.6)"}}>{localBet.stake}€</span>
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
            <EditCell fieldKey="stake"     label="MISE"    value={localBet.stake}     suffix="€" type="number"
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
                  background:"linear-gradient(180deg,#4ADE80 0%,#3CC46E 100%)",
                  color:"#001A0A",fontSize:15,fontWeight:800,
                  letterSpacing:.3,
                  cursor:"pointer",marginBottom:12,
                  boxShadow:"0 4px 20px rgba(74,222,128,.35)",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                }}>
                {saving?"Enregistrement…":"💾  Sauvegarder les modifications"}
              </button>
            )}
            {saveAnim&&!hasDirty&&(
              <div style={{textAlign:"center",color:"#4ADE80",fontSize:13,fontWeight:700,marginBottom:12}}>
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
                  const col=k==="won"?"#4ADE80":k==="lost"?"#FF8A80":k==="pending"?"rgba(255,255,255,.6)":"rgba(255,255,255,.3)";
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

            {/* Date éditable */}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,fontWeight:700,color:"rgba(255,255,255,.28)",
                letterSpacing:.8,marginBottom:8,textTransform:"uppercase"}}>Date du pari</div>
              <input
                type="datetime-local"
                value={localBet.created_at?localBet.created_at.slice(0,16):""}
                onChange={e=>{
                  const iso=e.target.value?new Date(e.target.value).toISOString():"";
                  setField("created_at",iso);
                }}
                style={{
                  width:"100%",padding:"11px 14px",borderRadius:12,
                  border:`1px solid ${dirty.created_at?"rgba(99,102,241,.5)":"rgba(255,255,255,.08)"}`,
                  background:"#1C1C22",color:"#F2F2F7",fontSize:13,fontWeight:500,
                  fontFamily:"inherit",outline:"none",
                  colorScheme:"dark",
                }}
              />
            </div>

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
// ── COULEURS UI ───────────────────────────────────────────────────────────────
const C={
  bg:"#14161B",card:"#1C1F26",inner:"#181B21",line:"#252A34",chip:"#262B35",
  text:"#F2F3F5",sub:"#8B92A0",dim:"#6B7280",blue:"#5B9DFF",
  green:"#4ADE80",red:"#FF8A80",greenBorder:"#2F8F5B",redBorder:"#A8474D",
};
const money=(v,dec=2)=>(v>0?"+":v<0?"−":"")+Math.abs(v).toFixed(dec)+"€";
const pColor=v=>v>0?C.green:v<0?C.red:C.sub;

// Petit logo (club / ligue / bookmaker) avec repli sur initiales
function MiniLogo({src,label,size=16,round=true}){
  const[err,setErr]=useState(false);
  if(src&&!err)return(
    <img src={src} alt={label||""} onError={()=>setErr(true)}
      style={{width:size,height:size,objectFit:"contain",flexShrink:0,borderRadius:round?0:4}}/>
  );
  if(!label)return null;
  return(
    <span style={{width:size,height:size,borderRadius:round?size/2:4,background:C.chip,color:"#C4C9D4",
      fontSize:Math.max(7,Math.round(size*.42)),fontWeight:700,display:"inline-flex",alignItems:"center",
      justifyContent:"center",flexShrink:0}}>{label.slice(0,3).toUpperCase()}</span>
  );
}

// Photo ronde du joueur
function PlayerFace({src,name,size=46}){
  const[err,setErr]=useState(false);
  const ini=(name||"").split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase();
  return(
    <div style={{width:size,height:size,borderRadius:size/2,background:C.chip,overflow:"hidden",flexShrink:0,
      display:"flex",alignItems:"center",justifyContent:"center",color:"#C4C9D4",fontSize:Math.round(size*.3),fontWeight:600}}>
      {src&&!err
        ?<img src={src} alt={name||""} loading="lazy" onError={()=>setErr(true)}
            style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 12%"}}/>
        :ini}
    </div>
  );
}

// Carte liste (Ligues, Marchés…) avec chevron
function ListCard({rows}){
  return(
    <div style={{background:C.card,border:"1px solid "+C.line,borderRadius:16}}>
      {rows.map((r,i)=>(
        <div key={r.key} style={{display:"flex",alignItems:"center",gap:12,minHeight:62,padding:"8px 14px",
          borderBottom:i<rows.length-1?"1px solid "+C.line:"none"}}>
          {r.logo!==undefined&&<MiniLogo src={r.logo} label={r.name} size={32} round={false}/>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.name}</div>
            <div style={{fontSize:13,color:C.sub,marginTop:1}}>{r.meta}</div>
          </div>
          <span style={{fontSize:16,fontWeight:500,color:pColor(r.profit)}}>{money(r.profit)}</span>
        </div>
      ))}
    </div>
  );
}

function SectionTitle({children,right}){
  return(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",margin:"30px 0 12px"}}>
      <span style={{fontSize:20,fontWeight:600,letterSpacing:-.3}}>{children}</span>{right}
    </div>
  );
}

function groupBy(bets,keyFn){
  const g={};
  bets.forEach(b=>{
    const k=keyFn(b)||"Autre";
    if(!g[k])g[k]={won:0,lost:0,void:0,count:0,profit:0};
    g[k].profit+=parseFloat(b.profit||0);g[k].count++;
    if(b.status==="won")g[k].won++;
    if(b.status==="lost")g[k].lost++;
    if(b.status==="void")g[k].void++;
  });
  return g;
}

// ── GRAPHIQUE BANKROLL (général, depuis le début) ────────────────────────────
function BankrollChart({bets}){
  const W=340,H=170,PAD={top:14,right:6,bottom:6,left:6};
  const inner={w:W-PAD.left-PAD.right,h:H-PAD.top-PAD.bottom};
  const settled=[...bets]
    .filter(b=>(b.status==="won"||b.status==="lost")&&b.created_at)
    .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  if(settled.length<2)return(
    <div style={{height:H,display:"flex",alignItems:"center",justifyContent:"center",color:C.sub,fontSize:13}}>
      Pas assez de données
    </div>
  );
  let cum=0;
  const pts=[{t:new Date(settled[0].created_at).getTime()-1,v:0},...settled.map(b=>{
    cum+=parseFloat(b.profit||0);return{t:new Date(b.created_at).getTime(),v:cum};
  })];
  const minV=Math.min(0,...pts.map(p=>p.v)),maxV=Math.max(0,...pts.map(p=>p.v));
  const rangeV=maxV-minV||1;
  const minT=pts[0].t,maxT=pts[pts.length-1].t,rangeT=maxT-minT||1;
  const sy=v=>PAD.top+inner.h-((v-minV)/rangeV)*inner.h;
  // Courbe lissée (points espacés régulièrement, un par pari réglé)
  const P=pts.map((p,i)=>[PAD.left+(i/(pts.length-1))*inner.w,sy(p.v)]);
  let d="M"+P[0][0].toFixed(1)+","+P[0][1].toFixed(1);
  for(let i=0;i<P.length-1;i++){
    const p0=P[i-1]||P[i],p1=P[i],p2=P[i+1],p3=P[i+2]||p2;
    const lo=Math.min(p1[1],p2[1]),hi=Math.max(p1[1],p2[1]),cl=y=>Math.max(lo,Math.min(hi,y));
    const c1=[p1[0]+(p2[0]-p0[0])/6,cl(p1[1]+(p2[1]-p0[1])/6)];
    const c2=[p2[0]-(p3[0]-p1[0])/6,cl(p2[1]-(p3[1]-p1[1])/6)];
    d+=` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  const area=d+` L${P[P.length-1][0].toFixed(1)},${PAD.top+inner.h} L${P[0][0].toFixed(1)},${PAD.top+inner.h} Z`;
  const last=pts[pts.length-1];
  const col=last.v>=0?C.green:C.red;
  const fmtM=t=>new Date(t).toLocaleDateString("fr-FR",rangeT<60*86400000?{day:"numeric",month:"short"}:{month:"short",year:"2-digit"}).replace(".","");
  return(
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:"block",overflow:"visible"}}>
        {[0,.5,1].map(f=>(
          <line key={f} x1={PAD.left} x2={W-PAD.right} y1={PAD.top+inner.h*f} y2={PAD.top+inner.h*f}
            stroke="#22262F" strokeWidth="1"/>
        ))}
        {minV<0&&maxV>0&&<line x1={PAD.left} x2={W-PAD.right} y1={sy(0)} y2={sy(0)} stroke="#3A404C" strokeDasharray="2 4"/>}
        <defs><linearGradient id="bkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity=".22"/><stop offset="100%" stopColor={col} stopOpacity="0"/>
        </linearGradient></defs>
        <path d={area} fill="url(#bkFill)"/>
        <path d={d} fill="none" stroke={col} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx={P[P.length-1][0]} cy={P[P.length-1][1]} r="3.5" fill={col} stroke={C.card} strokeWidth="2"/>
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",padding:"6px 4px 0",fontSize:11,color:C.dim}}>
        <span>{fmtM(minT)}</span><span>{fmtM(minT+rangeT/2)}</span><span>{fmtM(maxT)}</span>
      </div>
    </div>
  );
}

// ── VUE ACCUEIL (Bankroll) ────────────────────────────────────────────────────
function HomeView({bets,players,onNavigate}){
  const now=new Date();
  const[cal,setCal]=useState({y:now.getFullYear(),m:now.getMonth()});
  const won=bets.filter(b=>b.status==="won").length;
  const lost=bets.filter(b=>b.status==="lost").length;
  const voids=bets.filter(b=>b.status==="void").length;
  const settled=bets.filter(b=>b.status==="won"||b.status==="lost");
  const profit=bets.reduce((s,b)=>s+parseFloat(b.profit||0),0);
  const staked=settled.reduce((s,b)=>s+parseFloat(b.stake||0),0);
  const roi=staked>0?profit/staked*100:0;

  // Calendrier du mois
  const daysInMonth=new Date(cal.y,cal.m+1,0).getDate();
  const offset=(new Date(cal.y,cal.m,1).getDay()+6)%7;
  const dayP={};
  bets.forEach(b=>{
    if(!b.created_at||b.status==="pending")return;
    const d=new Date(b.created_at);
    if(d.getFullYear()===cal.y&&d.getMonth()===cal.m){
      const k=d.getDate();dayP[k]=(dayP[k]||0)+parseFloat(b.profit||0);
    }
  });
  const monthLabel=new Date(cal.y,cal.m,1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  const shift=n=>setCal(c=>{const d=new Date(c.y,c.m+n,1);return{y:d.getFullYear(),m:d.getMonth()};});

  const byGame=groupBy(bets,b=>b.game);
  const leagueRows=Object.entries(byGame).sort((a,b)=>b[1].profit-a[1].profit).slice(0,5).map(([g,s])=>({
    key:g,name:g,logo:getLeagueLogo(g)||null,meta:`${s.won}-${s.lost}-${s.void}`,profit:s.profit,
  }));

  return(
    <div style={{padding:"0 20px 8px"}}>
      <div style={{fontSize:15,color:C.sub,marginTop:-4}}>Depuis le début · {bets.length} paris</div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",marginTop:18}}>
        <div><div style={{fontSize:13,color:C.sub}}>Profit</div>
          <div style={{fontSize:19,fontWeight:600,color:pColor(profit),marginTop:3}}>{money(profit)}</div></div>
        <div style={{textAlign:"center"}}><div style={{fontSize:13,color:C.sub}}>ROI</div>
          <div style={{fontSize:19,fontWeight:600,color:pColor(roi),marginTop:3}}>{(roi>0?"+":"")+roi.toFixed(1)} %</div></div>
        <div style={{textAlign:"right"}}><div style={{fontSize:13,color:C.sub}}>Bilan</div>
          <div style={{fontSize:19,fontWeight:600,marginTop:3}}>{won}-{lost}-{voids}</div></div>
      </div>

      <div style={{marginTop:18,background:C.card,border:"1px solid "+C.line,borderRadius:16,padding:"14px 12px 10px",position:"relative"}}>
        <span style={{position:"absolute",right:16,top:10,fontSize:12,color:C.sub}}>{money(profit)}</span>
        <BankrollChart bets={bets}/>
      </div>

      <SectionTitle right={
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <button aria-label="Mois précédent" onClick={()=>shift(-1)} style={navArrow}>‹</button>
          <span style={{fontSize:13,color:C.sub,textTransform:"capitalize",minWidth:96,textAlign:"center"}}>{monthLabel}</span>
          <button aria-label="Mois suivant" onClick={()=>shift(1)} style={navArrow}>›</button>
        </div>
      }>Calendrier</SectionTitle>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:5,fontSize:11,color:C.dim,textAlign:"center"}}>
        {["L","M","M","J","V","S","D"].map((d,i)=><span key={i}>{d}</span>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,minmax(0,1fr))",gap:5,marginTop:6}}>
        {Array.from({length:offset}).map((_,i)=><div key={"e"+i}/>)}
        {Array.from({length:daysInMonth},(_,i)=>i+1).map(day=>{
          const v=dayP[day];
          const has=v!==undefined;
          const bg=!has?"#1A1D23":v>0?"#15352A":v<0?"#3A1F24":"#1F232B";
          const fg=!has?C.dim:v>0?"#6EE7A0":v<0?C.red:C.sub;
          return(
            <div key={day} style={{height:44,borderRadius:8,background:bg,display:"flex",flexDirection:"column",
              alignItems:"center",justifyContent:"center",gap:1}}>
              <span style={{fontSize:10,color:has?fg:"#4B5260",opacity:has?.7:1}}>{day}</span>
              {has&&<span style={{fontSize:11,fontWeight:600,color:fg}}>{v===0?"–":(v>0?"+":"−")+Math.abs(v).toFixed(0)+"€"}</span>}
            </div>
          );
        })}
      </div>

      {leagueRows.length>0&&<>
        <SectionTitle right={<button onClick={()=>onNavigate("stats")} style={linkBtn}>Tout voir</button>}>Ligues</SectionTitle>
        <ListCard rows={leagueRows}/>
      </>}
    </div>
  );
}
const navArrow={width:32,height:32,border:"none",background:"transparent",color:C.blue,fontSize:20,cursor:"pointer"};
const linkBtn={border:"none",background:"transparent",color:C.blue,fontSize:15,cursor:"pointer",fontFamily:"inherit"};

// ── TICKET DE PARI ────────────────────────────────────────────────────────────
function BetSlip({b,players,bkPhotos,onClick}){
  const pData=players.find(p=>p.name===b.player);
  const isTeam=b.bet_type==="team";
  const teamName=b.team||pData?.team||"";
  const clubLogo=getTeamLogo(teamName,pData?.team_logo_url);
  const photo=isTeam?clubLogo:(pData?.photo_url||pData?.avatar_url||null);
  const leagueLogo=b.game?getLeagueLogo(b.game):null;
  const profit=parseFloat(b.profit||0);
  const stake=parseFloat(b.stake||0),odds=parseFloat(b.odds||0);
  const d=b.created_at?new Date(b.created_at):null;
  const dateStr=d?d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"}):"";
  const border=b.status==="won"?C.greenBorder:b.status==="lost"?C.redBorder:C.line;
  let result,resultCol,outLabel,out;
  if(b.status==="won"){result=money(profit);resultCol=C.green;outLabel="Retour";out=(stake+profit).toFixed(2)+"€";}
  else if(b.status==="lost"){result=money(profit);resultCol=C.red;outLabel="Retour";out="0.00€";}
  else if(b.status==="void"){result="Void";resultCol=C.sub;outLabel="Retour";out=stake.toFixed(2)+"€";}
  else{result="En cours";resultCol=C.sub;outLabel="Gain potentiel";out=(stake*odds).toFixed(2)+"€";}
  const name=isTeam?(b.team||b.player):formatName(b.player);
  const lastName=isTeam?name:(name.split(" ").slice(-1)[0]||name);
  return(
    <article onClick={onClick} style={{background:C.card,border:"1px solid "+border,borderRadius:14,
      padding:"10px 12px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}>
      <div style={{position:"relative",flexShrink:0}}>
        <PlayerFace src={photo} name={name} size={42}/>
        {teamName&&!isTeam&&(
          <span style={{position:"absolute",right:-3,bottom:-3,width:20,height:20,borderRadius:10,background:C.card,
            border:"1.5px solid "+C.card,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <MiniLogo src={clubLogo} label={teamName} size={15}/>
          </span>
        )}
      </div>
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:3}}>
        <span style={{fontSize:14,fontWeight:600,lineHeight:1.25}}>
          {lastName} · {b.description}
          {b.game&&<span style={{display:"inline-flex",verticalAlign:"-2px",marginLeft:6}}><MiniLogo src={leagueLogo} label={b.game} size={15} round={false}/></span>}
        </span>
        <span style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:C.sub,minWidth:0}}>
          {[
            b.bookmaker&&<MiniLogo key="b" src={bkPhotos?.[b.bookmaker]} label={b.bookmaker} size={15} round={false}/>,
            b.tipster&&<span key="t" style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:"#C4C9D4",fontWeight:500}}>{b.tipster}</span>,
          ].filter(Boolean).flatMap((el,i)=>i===0?[el]:[<span key={"s"+i} style={{width:4,height:4,borderRadius:2,background:"#6B7280",flexShrink:0}}/>,el])}
        </span>
      </div>
      <div style={{textAlign:"right",flexShrink:0,display:"flex",flexDirection:"column",gap:3}}>
        <span style={{fontSize:14,fontWeight:600,color:resultCol}}>{result}</span>
        <span style={{fontSize:12,color:C.sub}}>@{b.odds} · {stake.toFixed(0)}€</span>
      </div>
    </article>
  );
}

// ── VUE MES PARIS ─────────────────────────────────────────────────────────────
function BetsView({bets,players,bookmakers=[],bkPhotos={},onSelectBet,onEdit}){
  const[filter,setFilter]=useState("all");
  const[search,setSearch]=useState("");
  const filtered=bets.filter(b=>{
    if(filter==="pending"&&b.status!=="pending")return false;
    if(filter==="settled"&&b.status==="pending")return false;
    if(search){
      const q=search.toLowerCase();
      if(!(b.player||"").toLowerCase().includes(q)&&!(b.description||"").toLowerCase().includes(q)&&
         !(b.tipster||"").toLowerCase().includes(q))return false;
    }
    return true;
  });
  const months=[];
  const idx={};
  filtered.forEach(b=>{
    const d=b.created_at?new Date(b.created_at):null;
    const key=d?d.getFullYear()+"-"+d.getMonth():"?";
    if(idx[key]===undefined){
      idx[key]=months.length;
      const label=d?d.toLocaleDateString("fr-FR",{month:"long",year:"numeric"}):"Sans date";
      months.push({key,label:label.charAt(0).toUpperCase()+label.slice(1),bets:[]});
    }
    months[idx[key]].bets.push(b);
  });
  const pendingCount=bets.filter(b=>b.status==="pending").length;

  return(
    <div style={{padding:"0 20px 8px"}}>
      <div style={{position:"relative"}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="2" strokeLinecap="round"
          style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)"}}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input placeholder="Rechercher un joueur, un tipster…" value={search} onChange={e=>setSearch(e.target.value)}
          style={{width:"100%",height:42,padding:"0 14px 0 38px",background:C.card,border:"1px solid "+C.line,
            borderRadius:12,color:C.text,fontSize:15,outline:"none"}}/>
      </div>
      <div className="segment" style={{marginTop:12}}>
        {[["pending","En cours"+(pendingCount?" · "+pendingCount:"")],["settled","Réglés"],["all","Tous"]].map(([k,l])=>(
          <button key={k} className={"seg-btn"+(filter===k?" active":"")} onClick={()=>setFilter(k)}>{l}</button>
        ))}
      </div>

      {filtered.length===0?(
        <div className="empty"><div className="empty-text">Aucun pari{search?" trouvé":""}</div>
          <div className="empty-sub">{search?"Essaie un autre terme":"Ajoute ton premier pari avec +"}</div></div>
      ):months.map(m=>{
        const w=m.bets.filter(x=>x.status==="won").length;
        const l=m.bets.filter(x=>x.status==="lost").length;
        const v=m.bets.filter(x=>x.status==="void").length;
        const p=m.bets.reduce((s,x)=>s+parseFloat(x.profit||0),0);
        const st=m.bets.filter(x=>x.status==="won"||x.status==="lost").reduce((s,x)=>s+parseFloat(x.stake||0),0);
        const allSt=m.bets.reduce((s,x)=>s+parseFloat(x.stake||0),0);
        const roi=st>0?p/st*100:0;
        const pend=m.bets.filter(x=>x.status==="pending").length;
        return(
          <div key={m.key}>
            <div style={{marginTop:18,background:C.card,border:"1px solid "+C.line,borderRadius:16,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
                <div>
                  <div style={{fontSize:19,fontWeight:700,letterSpacing:-.4}}>{m.label}</div>
                  <div style={{fontSize:13,color:C.sub,marginTop:2}}>{m.bets.length} paris{pend?" · "+pend+" en cours":""}</div>
                </div>
                <span style={{fontSize:19,fontWeight:700,color:pColor(p)}}>{money(p)}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",marginTop:10,paddingTop:10,borderTop:"1px solid #2A2F3A"}}>
                <div><div style={{fontSize:12,color:C.sub}}>Bilan</div><div style={{fontSize:15,fontWeight:600}}>{w}-{l}-{v}</div></div>
                <div><div style={{fontSize:12,color:C.sub}}>ROI</div><div style={{fontSize:15,fontWeight:600,color:pColor(roi)}}>{(roi>0?"+":"")+roi.toFixed(1)} %</div></div>
                <div><div style={{fontSize:12,color:C.sub}}>Misé</div><div style={{fontSize:15,fontWeight:600}}>{allSt.toFixed(0)}€</div></div>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:10}}>
              {m.bets.map(b=><BetSlip key={b.id} b={b} players={players} bkPhotos={bkPhotos} onClick={()=>onSelectBet(b)}/>)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── VUE ANALYSE ───────────────────────────────────────────────────────────────
function StatsView({bets}){
  if(bets.length===0)return(
    <div className="empty" style={{marginTop:40}}>
      <div className="empty-text">Pas encore de données</div>
      <div className="empty-sub">Ajoute des paris pour voir tes stats</div>
    </div>
  );
  const settled=bets.filter(b=>b.status==="won"||b.status==="lost");
  const won=settled.filter(b=>b.status==="won").length;
  const profit=bets.reduce((s,b)=>s+parseFloat(b.profit||0),0);
  const staked=settled.reduce((s,b)=>s+parseFloat(b.stake||0),0);
  const roi=staked>0?profit/staked*100:0;
  const wr=settled.length?won/settled.length*100:0;
  const avgOdds=bets.length?bets.reduce((s,b)=>s+parseFloat(b.odds||0),0)/bets.length:0;
  const toRows=(g,logoFn)=>Object.entries(g).sort((a,b)=>b[1].profit-a[1].profit).map(([k,s])=>({
    key:k,name:k,logo:logoFn?logoFn(k):undefined,
    meta:`${s.won}-${s.lost}-${s.void} · ${s.count} paris`,profit:s.profit,
  }));
  const monthRows=Object.entries(groupBy(bets.filter(b=>b.created_at),b=>b.created_at.slice(0,7)))
    .sort((a,b)=>b[0].localeCompare(a[0])).map(([k,s])=>{
      const[y,mo]=k.split("-");
      const lbl=new Date(+y,+mo-1,1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
      return{key:k,name:lbl.charAt(0).toUpperCase()+lbl.slice(1),meta:`${s.won}-${s.lost}-${s.void} · ${s.count} paris`,profit:s.profit};
    });
  const kpi=(label,val,col)=>(
    <div style={{background:C.card,border:"1px solid "+C.line,borderRadius:14,padding:14}}>
      <div style={{fontSize:13,color:C.sub}}>{label}</div>
      <div style={{fontSize:22,fontWeight:600,color:col||C.text,marginTop:4}}>{val}</div>
    </div>
  );
  return(
    <div style={{padding:"0 20px 8px"}}>
      <div style={{fontSize:15,color:C.sub,marginTop:-4}}>{bets.length} paris</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginTop:18}}>
        {kpi("Profit",money(profit),pColor(profit))}
        {kpi("ROI",(roi>0?"+":"")+roi.toFixed(1)+" %",pColor(roi))}
        {kpi("Win rate",wr.toFixed(1)+" %")}
        {kpi("Cote moyenne",avgOdds.toFixed(2))}
      </div>
      <SectionTitle>Ligues</SectionTitle>
      <ListCard rows={toRows(groupBy(bets,b=>b.game),g=>getLeagueLogo(g)||null)}/>
      <SectionTitle>Marchés</SectionTitle>
      <ListCard rows={toRows(groupBy(bets,b=>(b.description||"Autre").replace(/^(Over|Under)\s[\d.]+\s/,""))).slice(0,8)}/>
      <SectionTitle>Tipsters</SectionTitle>
      <ListCard rows={toRows(groupBy(bets,b=>b.tipster||"Sans tipster"))}/>
      <SectionTitle>Par mois</SectionTitle>
      <ListCard rows={monthRows}/>
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
    }catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
  }

  async function applyClubLogo(club,url){
    setClubs(prev=>prev.map(c=>c.name===club.name?{...c,logo:url}:c));
    if(selectedClub?.name===club.name)setSelectedClub(prev=>({...prev,logo:url}));
    setPlayers(prev=>prev.map(p=>p.team===club.name?{...p,team_logo_url:url}:p));
    CLUB_LOGOS_MAP[club.name]=url;
    syncClubLogoAllLeagues(club.name,url).catch(e=>console.warn("Club logo sync:",e));
    fetch(SUPA_URL+"/rest/v1/players?team=eq."+encodeURIComponent(club.name),{
      method:"PATCH",headers:{...H},body:JSON.stringify({team_logo_url:url}),
    }).catch(e=>console.warn("Players team_logo_url:",e));
    showToast("Logo "+club.name+" synchronisé ✓");
  }

  async function pasteClubLogo(club){
    try{
      const url=await pasteImageToSupabase("club_"+club.name.replace(/\s/g,"_").toLowerCase());
      await applyClubLogo(club,url);
    }catch(e){
      // Si le presse-papier ne contient pas d'image, ouvrir le file picker
      showToast("Presse-papier vide — choisis un fichier","#F59E0B");
      pickClubLogoFile(club);
    }
  }

  function pickClubLogoFile(club){
    const input=document.createElement("input");
    input.type="file";input.accept="image/*";
    input.onchange=async()=>{
      const file=input.files[0];if(!file)return;
      try{
        const safe=club.name.replace(/\s/g,"_").toLowerCase();
        const ext=file.name.split(".").pop()||"png";
        const rand=Math.random().toString(36).slice(2,6);
        const path="photos/players/club_"+safe+"_"+Date.now()+"_"+rand+"."+ext;
        const res=await fetch(SUPA_URL+"/storage/v1/object/avatars/"+path,{
          method:"POST",
          headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":file.type,"x-upsert":"true"},
          body:file,
        });
        if(!res.ok)throw new Error("Upload "+res.status);
        const url=SUPA_URL+"/storage/v1/object/public/avatars/"+path;
        await applyClubLogo(club,url);
      }catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
    };
    input.click();
  }

  async function pastePlayerPhoto(p){
    setUploadingId(p.id);
    try{
      const url=await pasteImageToSupabase("player_"+p.name.replace(/\s/g,"_").toLowerCase());
      await updatePlayer(p.id,{photo_url:url,avatar_url:url});
      setPlayers(prev=>prev.map(pl=>pl.id===p.id?{...pl,photo_url:url}:pl));
      if(editingPlayer?.id===p.id)setEditingPlayer(prev=>({...prev,photo_url:url}));
      showToast("Photo mise à jour ✓");
    }catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
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
    }catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
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
    }catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
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
            padding:14,background:"#1C1F26",border:"1px solid rgba(255,255,255,.07)",
            borderRadius:10,marginBottom:8,cursor:"pointer"}}
            onClick={()=>{setSelectedLeague(lg);setGlobalSearch("");}}>
            {lg.logo
              ?<img src={lg.logo} style={{width:44,height:44,objectFit:"contain",
                  borderRadius:10,background:"#252A34",padding:4,flexShrink:0}} alt=""/>
              :<div style={{width:44,height:44,borderRadius:10,background:"#252A34",
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
            ?<img src={selectedLeague.logo} style={{width:36,height:36,objectFit:"contain",borderRadius:8,background:"#252A34",padding:4}} alt=""/>
            :<div style={{width:36,height:36,borderRadius:8,background:"#252A34",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>◉</div>
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
            padding:14,background:"#1C1F26",border:"1px solid rgba(255,255,255,.07)",
            borderRadius:10,marginBottom:8,cursor:"pointer"}}
            onClick={()=>setSelectedClub(club)}>
            {club.logo
              ?<img src={club.logo} style={{width:44,height:44,objectFit:"contain",borderRadius:10,background:"#252A34",padding:4,flexShrink:0}} alt=""/>
              :<div style={{width:44,height:44,borderRadius:10,background:"#252A34",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>◫</div>
            }
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:14,fontWeight:700,color:"#F2F2F7",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{club.name}</div>
              {club.player_count>0&&<div style={{fontSize:11,color:"rgba(255,255,255,.28)",marginTop:2}}>{club.player_count} joueur{club.player_count>1?"s":""}</div>}
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <button className="icon-btn" title="Coller logo (presse-papier)"
                onClick={e=>{e.stopPropagation();pasteClubLogo(club);}}
                style={{display:"flex",alignItems:"center",justifyContent:"center",padding:6}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
                  <rect x="8" y="2" width="12" height="14" rx="2"/>
                </svg>
              </button>
              <button className="icon-btn" title="Choisir logo (fichier)"
                onClick={e=>{e.stopPropagation();pickClubLogoFile(club);}}
                style={{display:"flex",alignItems:"center",justifyContent:"center",padding:6}}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
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
          ?<img src={selectedClub.logo} style={{width:36,height:36,objectFit:"contain",borderRadius:8,background:"#252A34",padding:4}} alt=""/>
          :<div style={{width:36,height:36,borderRadius:8,background:"#252A34",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>◫</div>
        }
        <div style={{flex:1}}>
          <div style={{fontSize:16,fontWeight:800,color:"#F2F2F7"}}>{selectedClub.name}</div>
          <div style={{fontSize:11,color:"rgba(255,255,255,.28)"}}>{players.length} joueur{players.length!==1?"s":""}</div>
        </div>
        {/* Logo : paste OU fichier */}
        <button className="icon-btn" title="Coller logo (presse-papier)" onClick={()=>pasteClubLogo(selectedClub)}
          style={{display:"flex",alignItems:"center",justifyContent:"center",padding:6}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>
            <rect x="8" y="2" width="12" height="14" rx="2"/>
          </svg>
        </button>
        <button className="icon-btn" title="Choisir logo depuis fichier" onClick={()=>pickClubLogoFile(selectedClub)}
          style={{display:"flex",alignItems:"center",justifyContent:"center",padding:6}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
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
    if(!name.trim()){showToast("Entre d'abord le nom","#FF8A80");return;}
    setUploading(true);
    try{
      const url=await pasteImage("player_"+name.trim().replace(/\s/g,"_").toLowerCase());
      setPhotoUrl(url);
    }catch(e){showToast("Erreur photo: "+e.message,"#FF8A80");}
    setUploading(false);
  }

  async function save(){
    if(!name.trim()){showToast("Le nom est requis","#FF8A80");return;}
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
            ?<img src={clubLogo} alt="" style={{width:28,height:28,objectFit:"contain",borderRadius:6,background:"#252A34",padding:3}}/>
            :<div style={{width:28,height:28,borderRadius:6,background:"#252A34",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>◫</div>
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
              <div style={{fontSize:26,fontWeight:900,
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
              {currentClubObj?.logo&&<img src={currentClubObj.logo} alt="" style={{width:22,height:22,objectFit:"contain",borderRadius:4,background:"#252A34",padding:2}}/>}
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
                    {c.logo&&<img src={c.logo} alt="" style={{width:22,height:22,objectFit:"contain",borderRadius:4,background:"#252A34",padding:2}}/>}
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
      showToast(bk.name+" supprimé","#FF8A80");
    }catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
  }

  async function deleteTip(t){
    if(!window.confirm("Supprimer "+t.name+" ?"))return;
    try{
      await deleteTipster(t.id);
      onUpdateTip();
      showToast(t.name+" supprimé","#FF8A80");
    }catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
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
    }catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
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
                }catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
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
            ?<img src={logo} style={{width:64,height:64,borderRadius:10,objectFit:"contain",background:"#252A34",padding:6}} alt="logo"/>
            :<div style={{width:64,height:64,borderRadius:10,background:"#252A34",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28}}>◉</div>
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
        background:"#252A34",
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>◉</div>
      <div style={{color:"rgba(255,255,255,.28)",fontSize:14}}>Chargement…</div>
    </div>
  );

  return(
    <>
      <style>{CSS}</style>
      <div className="app">
        <div className="header">
          <div className="header-title">
            {view==="home"?"Bankroll":view==="bets"?"Mes paris":view==="stats"?"Analyse":"Réglages"}
          </div>
          <button onClick={()=>loadBets(true)} aria-label="Rafraîchir"
            style={{width:44,height:44,background:"transparent",border:"none",cursor:"pointer",
              color:syncing?"#5B9DFF":"#6B7280",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"/>
            </svg>
          </button>
        </div>

        <div style={{paddingTop:4}}>
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
          <button aria-label="Bankroll" className={"nav-btn"+(view==="home"?" active":"")} onClick={()=>setView("home")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M3 20h18M6 16V10M11 16V5M16 16v-4M21 16V8"/></svg>
          </button>
          <button aria-label="Mes paris" className={"nav-btn"+(view==="bets"?" active":"")} onClick={()=>setView("bets")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"><path d="M5 3h14v18l-2.5-1.8L14 21l-2-1.8L10 21l-2.5-1.8L5 21z"/><path d="M9 8h6M9 12h6"/></svg>
          </button>
          <button aria-label="Ajouter un pari" className="nav-add" onClick={()=>setShowAdd(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button aria-label="Analyse" className={"nav-btn"+(view==="stats"?" active":"")} onClick={()=>setView("stats")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/></svg>
          </button>
          <button aria-label="Réglages" className={"nav-btn"+(view==="settings"?" active":"")} onClick={()=>setView("settings")}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
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

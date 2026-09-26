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

const START_BANKROLL=10000; // bankroll de départ (€)

function eur(v,dec=2){
  return Number(v||0).toLocaleString("fr-FR",{minimumFractionDigits:dec,maximumFractionDigits:dec})+"\u00a0€";
}

const STAT_FR={
  "Points":"Points","Rebonds":"Rebonds","Assists":"Passes",
  "Points+Rebonds":"Points + Rebonds","Points+Assists":"Points + Passes",
  "Points+Rebonds+Assists":"Points + Rebonds + Passes","3 Points Made":"Tirs à 3 pts",
  "Steals":"Interceptions","Blocks":"Contres","Turnovers":"Balles perdues",
  "Fantasy Score":"Score fantasy","Double-Double":"Double-double","Minutes":"Minutes",
};
const STAT_ABBR={
  "Points":"Pts","Rebonds":"Reb","Assists":"Pas","Points+Rebonds":"P+R","Points+Assists":"P+P",
  "Points+Rebonds+Assists":"PRA","3 Points Made":"3PTS","Steals":"Int","Blocks":"Ctr",
  "Turnovers":"BP","Fantasy Score":"Fantasy","Double-Double":"DD","Minutes":"Min",
};
const statFR=s=>STAT_FR[s]||s;
// "Over 26.5 Points+Rebonds+Assists" → { ou, line, stat }
function parseDesc(desc){
  const m=(desc||"").match(/^(Over|Under)\s+([\d.,]+)\s+(.+)$/);
  return m?{ou:m[1],line:m[2],stat:m[3]}:null;
}
function descFR(desc){const p=parseDesc(desc);return p?p.ou+" "+p.line+" "+statFR(p.stat):(desc||"");}
function descShort(desc){const p=parseDesc(desc);return p?(p.ou==="Over"?"O":"U")+" "+p.line+" "+(STAT_ABBR[p.stat]||statFR(p.stat)):(desc||"");}

// "Point Guard" → "PG", "Center" → "C"… (1er poste du joueur)
const ROLE_CODES={"point guard":"PG","meneur":"PG","shooting guard":"SG","arriere":"SG","small forward":"SF","ailier":"SF",
  "power forward":"PF","ailier fort":"PF","center":"C","centre":"C","pivot":"C","guard":"G","forward":"F"};
function roleCode(role){
  const r=(role||"").split(",")[0].trim();
  if(!r)return"";
  const k=r.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  return ROLE_CODES[k]||r.toUpperCase();
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

// Message d'erreur Supabase lisible (ex. colonne manquante)
async function supaError(prefix,r){
  let msg="";
  try{const j=await r.json();msg=j.message||j.hint||JSON.stringify(j);}catch(_){}
  const col=(msg.match(/'([a-z_]+)' column/)||msg.match(/column "?([a-z_]+)"? .*does not exist/)||[])[1];
  if(col)return new Error("La colonne « "+col+" » n'existe pas encore dans ta table bets.\nAjoute-la dans Supabase (SQL Editor) :\nalter table bets add column if not exists "+col+" "+(col==="closing_odds"?"numeric":col==="annonce"?"boolean default false":"text")+";");
  return new Error(prefix+" "+r.status+(msg?" — "+msg:""));
}

async function insertBet(bet){
  const r=await fetch(SUPA_URL+"/rest/v1/bets",{
    method:"POST",
    headers:{...H,"Prefer":"return=representation"},
    body:JSON.stringify(bet),
  });
  if(!r.ok)throw await supaError("Ajout refusé :",r);
  return r.json();
}

async function updateBet(id,fields){
  const r=await fetch(SUPA_URL+"/rest/v1/bets?id=eq."+id,{
    method:"PATCH",
    headers:{...H,"Prefer":"return=representation"},
    body:JSON.stringify({...fields,updated_at:new Date().toISOString()}),
  });
  if(!r.ok)throw await supaError("Modification refusée :",r);
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

async function insertLeague(name){
  const r=await fetch(SUPA_URL+"/rest/v1/leagues",{method:"POST",headers:{...H,"Prefer":"return=representation"},body:JSON.stringify({name})});
  if(!r.ok)throw new Error("création ligue: "+r.status+" "+(await r.text().catch(()=>"")));
  return r.json();
}
async function insertClubs(rows){
  const r=await fetch(SUPA_URL+"/rest/v1/clubs",{method:"POST",headers:{...H,"Prefer":"return=representation"},body:JSON.stringify(rows)});
  if(!r.ok)throw new Error("création club: "+r.status+" "+(await r.text().catch(()=>"")));
  return r.json();
}
// Ligues prêtes à importer (clubs de la saison 2026-27)
const LEAGUE_PRESETS={};
// Coupes nationales : affichées à part, en bas de la liste des ligues
const CUPS={
  "NBA Cup":"États-Unis","Leaders Cup":"France","Coupe de France":"France",
  "Coppa Italia":"Italie","Copa del Rey":"Espagne","BBL-Pokal":"Allemagne",
};
const isCup=name=>Object.keys(CUPS).some(c=>normTeam(c)===normTeam(name));

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
      SUPA_URL+"/rest/v1/players?select=id,name,game,team,role,photo_url,avatar_url,team_logo_url&order=name.asc&limit="+limit+"&offset="+offset,
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

const MIN_PHOTO_WIDTH=300;
function imageWidth(src){
  return new Promise(res=>{
    const im=new Image();
    im.onload=()=>res(im.naturalWidth||0);
    im.onerror=()=>res(0);
    im.src=src;
  });
}
async function confirmPhotoSize(width){
  if(width>0&&width<MIN_PHOTO_WIDTH&&
     !window.confirm("Image trop petite ("+width+" px de large) : elle sera floue.\nConseil : utilise une image d'au moins "+MIN_PHOTO_WIDTH+" px.\n\nL'utiliser quand même ?"))
    throw new Error("Collage annulé");
}

async function pasteImageToSupabase(name){
  const url=await pasteImageRaw(name);
  // Les images déjà uploadées sont vérifiées avant l'envoi ; ici on vérifie les liens directs
  if(String(name||"").startsWith("player")&&!url.startsWith(SUPA_URL))await confirmPhotoSize(await imageWidth(url));
  return url;
}

async function pasteImageRaw(name){
  const safe=(name||"img").toLowerCase().replace(/[^a-z0-9]/g,"_").slice(0,40);
  async function uploadBlob(blob){
    if(safe.startsWith("player")){
      const obj=URL.createObjectURL(blob);
      try{await confirmPhotoSize(await imageWidth(obj));}finally{URL.revokeObjectURL(obj);}
    }
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
img{image-rendering:auto;}
::-webkit-scrollbar{display:none;}

.app{max-width:430px;margin:0 auto;min-height:100vh;padding-bottom:88px;}

/* ── NAV ── */
.nav{
  position:fixed;bottom:0;left:50%;transform:translateX(-50%);
  width:100%;max-width:430px;
  background:rgba(20,22,27,.94);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border-top:1px solid #252A34;
  display:flex;align-items:center;justify-content:space-around;z-index:250;
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
.pick-head{display:flex;align-items:center;justify-content:space-between;margin:18px 2px 6px;height:32px;font-size:13px;font-weight:500;color:#8B92A0;}
.pick-head button{width:32px!important;height:32px!important;}
.chip-row{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 -20px;padding:0 20px 2px;}
.chip-row::-webkit-scrollbar{display:none;}
.pick-chip{flex-shrink:0;display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 16px;border-radius:20px;
  border:1px solid #252A34;background:#1C1F26;color:#C4C9D4;font-size:14px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .12s;}
.pick-chip:hover{border-color:#3A404C;}
.pick-chip:focus{outline:none;}.pick-chip:focus-visible{outline:2px solid #5B9DFF;outline-offset:2px;}
.pick-chip.logo{width:56px;height:48px;padding:0;justify-content:center;border-radius:14px;border-color:transparent;background:transparent;}
.pick-chip.logo:hover{border-color:transparent;background:rgba(255,255,255,.05);}
.pick-chip.logo.on{border-color:transparent;background:rgba(91,157,255,.18);}
.pick-chip.on{border-color:#5B9DFF;background:rgba(91,157,255,.14);color:#F2F3F5;}
.sentence input::-webkit-outer-spin-button,.sentence input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.sentence{display:flex;align-items:center;height:56px;background:#1C1F26;border:1px solid #252A34;border-radius:16px;overflow:hidden;}
.sent-sel{height:100%;border:none;background:transparent;color:#F2F3F5;font-size:17px;font-weight:600;font-family:inherit;
  padding:0 26px 0 14px;appearance:none;-webkit-appearance:none;outline:none;cursor:pointer;
  background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none' stroke='%238B92A0' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M1 1l4 4 4-4'/%3E%3C/svg%3E") no-repeat right 10px center;}
.sent-sel+.sent-sel{border-left:1px solid #252A34;}
.sent-sel.grow{flex:1;min-width:0;}
.sent-sel:focus-visible{background-color:rgba(91,157,255,.1);}
.sent-sel option{background:#1C1F26;color:#F2F3F5;}
.fld-box input::placeholder{color:transparent;}
/* animations */
@keyframes drawLine{from{stroke-dasharray:1;stroke-dashoffset:1;}to{stroke-dasharray:1;stroke-dashoffset:0;}}
.draw-line{animation:drawLine 1.1s cubic-bezier(.3,.7,.2,1) both;}
@keyframes fadeUp{from{opacity:0;}to{opacity:1;}}
.draw-fade{animation:fadeUp 1.2s ease .3s both;}
@keyframes pulse{0%{r:4;opacity:1;}70%{r:4;opacity:1;}100%{r:4;opacity:1;}}
.pulse-dot{filter:drop-shadow(0 0 6px currentColor);}
@keyframes viewIn{from{opacity:0;}to{opacity:1;}}
.view-in{animation:viewIn .28s ease backwards;}
@keyframes sheetUp{from{transform:translateY(40px);opacity:.4;}to{transform:none;opacity:1;}}
.modal-sheet{animation:sheetUp .32s cubic-bezier(.2,.8,.2,1) both;}
@keyframes overlayIn{from{opacity:0;}to{opacity:1;}}
.modal-overlay{animation:overlayIn .2s ease both;}
@keyframes shimmer{0%{background-position:-200px 0;}100%{background-position:calc(200px + 100%) 0;}}
.skel{background:#232730 linear-gradient(90deg,rgba(255,255,255,0) 0,rgba(255,255,255,.06) 50%,rgba(255,255,255,0) 100%) no-repeat;
  background-size:200px 100%;animation:shimmer 1.3s linear infinite;}
@media (prefers-reduced-motion:reduce){.draw-line,.draw-fade,.view-in,.modal-sheet,.modal-overlay,.fade-in,.skel{animation:none!important;}}
article,.pick-chip,.seg-btn,.nav-btn,.nav-add,.press,.s-add{transition:transform .12s ease,background .15s,border-color .15s,color .15s;}
article:active{transform:scale(.985);}
.pick-chip:active,.seg-btn:active,.press:active,.s-add:active,.nav-btn:active{transform:scale(.95);}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
.fade-in{animation:fadeIn .22s ease backwards;}
.leg-in{width:100%;height:34px;border-radius:9px;border:1px solid #252A34;background:#181B21;color:#F2F3F5;text-align:center;font-size:14px;font-weight:600;outline:none;font-family:inherit;-moz-appearance:textfield;}
.leg-in:focus{border-color:#5B9DFF;}
.leg-in::-webkit-outer-spin-button,.leg-in::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.row-select{flex:1;min-width:0;height:44px;border:none;background:transparent;color:#F2F3F5;font-size:15px;
  text-align:right;text-align-last:right;outline:none;appearance:none;-webkit-appearance:none;cursor:pointer;padding:0;}
.row-select::-webkit-outer-spin-button,.row-select::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.row-select[type=number]{-moz-appearance:textfield;}
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
.form-label{font-size:13px;font-weight:500;color:#8B92A0;margin-bottom:8px;display:block;}
.form-input,.form-select{
  width:100%;height:46px;background:#1C1F26;border:1px solid #252A34;border-radius:12px;padding:0 14px;
  color:#F2F3F5;font-size:15px;font-family:inherit;outline:none;transition:border-color .15s;
}
.form-input:focus,.form-select:focus{border-color:#5B9DFF;}
.form-input::placeholder{color:#6B7280;}
.form-input:disabled{opacity:.6;}
.form-select{appearance:none;-webkit-appearance:none;cursor:pointer;padding-right:34px;
  background:#1C1F26 url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none' stroke='%238B92A0' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='M1 1.5l5 5 5-5'/%3E%3C/svg%3E") no-repeat right 12px center;}
.form-select option{background:#1C1F26;color:#F2F3F5;}

/* ── BUTTONS ── */
.btn{border:none;border-radius:12px;height:50px;padding:0 20px;font-size:16px;font-weight:600;cursor:pointer;transition:opacity .12s;width:100%;font-family:inherit;}
.btn:active{opacity:.7;}
.btn-primary{background:#5B9DFF;color:#0C1424;}
.btn-secondary{background:#262B35;color:#F2F3F5;}
.btn-danger{background:transparent;color:#FF8A80;border:1px solid rgba(255,138,128,.35);}
.btn-sm{height:36px;padding:0 14px;font-size:13px;border-radius:10px;}

/* ── RÉGLAGES ── */
.s-icon{width:38px;height:38px;border:none;border-radius:10px;background:transparent;color:#8B92A0;cursor:pointer;
  display:flex;align-items:center;justify-content:center;transition:background .12s,color .12s;flex-shrink:0;}
.s-icon:hover{background:#262B35;color:#F2F3F5;}
.s-icon.danger:hover{background:rgba(255,138,128,.12);color:#FF8A80;}
.s-add{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border:none;border-radius:18px;
  background:rgba(91,157,255,.14);color:#8BB8FF;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;flex-shrink:0;}
.s-add:hover{background:rgba(91,157,255,.22);}

/* ── PLAYER AVATAR ── */
.player-avatar-wrap{position:relative;flex-shrink:0;display:flex;align-items:flex-end;justify-content:center;overflow:hidden;border-radius:8px;}
.player-avatar-wrap .team-logo-bg{position:absolute;object-fit:contain;pointer-events:none;}
.player-avatar-wrap .player-img{position:relative;z-index:1;object-fit:contain;object-position:50% 85%;}
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
.modal-sheet{background:#1A1D23;border-radius:20px 20px 0 0;max-width:430px;margin:0 auto;width:100%;max-height:93vh;overflow-y:auto;padding:12px 18px calc(24px + env(safe-area-inset-bottom));border:1px solid #252A34;border-bottom:none;}
.modal-handle{width:36px;height:5px;background:rgba(255,255,255,.18);border-radius:2px;margin:0 auto 20px;}
.modal-title{font-size:20px;font-weight:600;color:#F2F3F5;margin-bottom:18px;letter-spacing:-.2px;}

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
// "Bayern München" = "Bayern Munchen" = "BAYERN-MUNCHEN"
function normTeam(s){
  return (s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ß/g,"ss").replace(/ı/g,"i")
    .toLowerCase().replace(/[^a-z0-9]/g,"");
}
// même club ? nom identique après normalisation, ou même premier mot significatif (≥5 lettres)
function sameTeam(a,b){
  const na=normTeam(a),nb=normTeam(b);
  if(!na||!nb)return false;
  if(na===nb)return true;
  const w=s=>(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().split(/[^a-z0-9]+/).filter(x=>x.length>=5)[0]||"";
  const wa=w(a),wb=w(b);
  return !!wa&&wa===wb;
}
function lookupByTeam(map,name){
  if(!name)return null;
  if(map[name])return map[name];
  const n=normTeam(name);
  const k=Object.keys(map).find(k=>normTeam(k)===n);
  return k?map[k]:null;
}
function getTeamLogo(teamName,playerTeamLogoUrl=null){
  // Priorité 1 : logo du club depuis Édition (table clubs) — toujours le plus à jour
  const fromMap=lookupByTeam(CLUB_LOGOS_MAP,teamName);
  if(fromMap)return fromMap;
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
  // NBL (Australie)
  "Adelaide 36ers":{p:"#D50032",s:"#1A2B4C"},
  "Brisbane Bullets":{p:"#003DA5",s:"#FFFFFF"},
  "Cairns Taipans":{p:"#F47920",s:"#1D2A4D"},
  "Illawarra Hawks":{p:"#C8102E",s:"#FFFFFF"},
  "Melbourne United":{p:"#0A2240",s:"#6CACE4"},
  "New Zealand Breakers":{p:"#111111",s:"#E4D5B7"},
  "Perth Wildcats":{p:"#E31837",s:"#FFFFFF"},
  "S.E. Melbourne Phoenix":{p:"#D91E26",s:"#111111"},
  "Sydney Kings":{p:"#522D80",s:"#FDB927"},
  "Tasmania JackJumpers":{p:"#006747",s:"#FFD100"},
};

function getTeamColor(team){
  if(!team)return null;
  return lookupByTeam(TEAM_COLORS,team);
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
function AddBetModal({players,bookmakers,bkPhotos={},tipsters=[],onSave,onClose,editBet=null,onPlayersChanged}){
  const[playerSettings,setPlayerSettings]=useState(false);
  const[psLeagues,setPsLeagues]=useState([]);
  const[psClubs,setPsClubs]=useState([]);
  const[psUploading,setPsUploading]=useState(null);
  function openPlayerSettings(){
    if(!form.playerObj?.id){alert("Joueur introuvable, rafraîchis la page.");return;}
    Promise.all([fetchLeagues(),fetchClubs()]).then(([l,c])=>{setPsLeagues(l);setPsClubs(c);setPlayerSettings(true);})
      .catch(e=>alert("Erreur: "+e.message));
  }
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
    annonce:!!editBet.annonce,annoncePlayer:editBet.annonce_player||"",annonceSide:editBet.annonce_side||"teammate",
    annonceStatus:editBet.annonce_status||"out",annonceRole:editBet.annonce_role||"starter",annonceSearch:"",
    notes:editBet.notes||"",
    created_at:editBet.created_at?editBet.created_at.slice(0,16):"",
    betType:editBet.bet_type==="team"?(editBet.description?.includes("gagne")?"moneyline":editBet.description?.includes("mi-temps")?"half":editBet.description?.includes("match")?"total":editBet.description?.includes("pts")?"team_total":"moneyline"):"moneyline",
    team:editBet.team||"",
    opponent:editBet.opponent||"",
  }:{
    player:"",playerObj:null,stat:"",ou:"",line:"",
    odds:"",stake:"",bookmaker:bookmakers[0]||"",
    status:"pending",game:"",tipster:"",notes:"",created_at:"",annonce:false,annoncePlayer:"",annonceSide:"teammate",annonceStatus:"out",annonceRole:"starter",annonceSearch:"",
    betType:"moneyline",team:"",opponent:"",
  });
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  // Compétitions du club (championnats + coupes) pour changer la ligue du pari
  const[clubLeagues,setClubLeagues]=useState([]);
  const[leagueMenu,setLeagueMenu]=useState(false);
  const betTeam=(editBet?.bet_type==="team"||selectedType?.type==="team")?form.team:(form.playerObj?.team||editBet?.team||"");
  useEffect(()=>{
    if(!betTeam){setClubLeagues([]);return;}
    fetch(SUPA_URL+"/rest/v1/clubs?select=name,league&limit=5000",{headers:H})
      .then(r=>r.json())
      .then(rows=>{
        const ls=[...new Set((Array.isArray(rows)?rows:[]).filter(c=>c.league&&sameTeam(c.name,betTeam)).map(c=>c.league))];
        ls.sort((a,b)=>(isCup(a)?1:0)-(isCup(b)?1:0)||a.localeCompare(b));
        setClubLeagues(ls);
      }).catch(()=>setClubLeagues([]));
  },[betTeam]);

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
    setSearch("");
    f("player",p.name);f("playerObj",p);
    if(p.game)f("game",p.game);
    setSelectedType({type:"player",data:p});
    setStep("form");
  }

  function selectTeam(teamName){
    setSearch("");
    const playerOfTeam=players.find(p=>p.team===teamName);
    const game=playerOfTeam?.game||"";
    f("team",teamName);f("game",game);
    setSelectedType({type:"team",data:{name:teamName,game}});
    setStep("form");
  }

  function annPayload(){
    if(!form.annonce&&!editBet?.annonce)return{};
    const on=!!form.annonce;
    return{
      annonce:on,
      annonce_player:on?(form.annoncePlayer||null):null,
      annonce_note:on&&form.annoncePlayer?formatName(form.annoncePlayer):null,
      annonce_side:on?form.annonceSide:null,
      annonce_status:on?form.annonceStatus:null,
      annonce_role:on?form.annonceRole:null,
    };
  }
  // Ce qui manque pour pouvoir enregistrer
  function missing(){
    if(!isTeamBet&&form.player&&!form.ou)return "Choisis Over ou Under";
    if(isTeamBet){
      if(!form.team)return "Choisis une équipe";
      if(form.betType!=="moneyline"&&!String(form.line).trim())return "Indique la ligne";
    }else{
      if(!form.player)return "Choisis un joueur";
      if(!form.line)return "Choisis la ligne";
      if(!form.stat)return "Choisis la stat";
    }
    if(!parseFloat(String(form.odds).replace(",",".")))return "Indique la cote";
    if(!parseFloat(String(form.stake).replace(",",".")))return "Indique la mise";
    return null;
  }

  async function submit(){
    const why=missing();
    if(why){alert(why);return;}
    const odds=parseFloat(String(form.odds).replace(",","."));
    const stake=parseFloat(String(form.stake).replace(",","."));
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
      const dateIso=form.created_at?new Date(form.created_at).toISOString():(editBet?undefined:new Date().toISOString());
      bet={
        player:form.team,team:form.team,opponent:form.opponent||null,
        description:desc,over_under:form.ou||null,
        line:form.line?parseFloat(form.line):null,
        odds,stake,bookmaker:form.bookmaker||null,
        status:form.status,profit:calcProfit(form.status,stake,odds),
        game:form.game||null,tipster:form.tipster||null,
        ...annPayload(),
        notes:null,bet_type:"team",
        ...(dateIso?{created_at:dateIso}:{}),
      };
    }else{
      if(!form.player){alert("Sélectionne un joueur");return;}
      const desc=form.ou&&form.line&&form.stat
        ?form.ou+" "+form.line+" "+form.stat:form.stat||"";
      const dateIso=form.created_at?new Date(form.created_at).toISOString():(editBet?undefined:new Date().toISOString());
      bet={
        player:form.player,team:form.playerObj?.team||null,
        description:desc,over_under:form.ou||null,
        line:form.line?parseFloat(form.line):null,
        odds,stake,bookmaker:form.bookmaker||null,
        status:form.status,profit:calcProfit(form.status,stake,odds),
        game:form.game||form.playerObj?.game||null,
        tipster:form.tipster||null,notes:null,bet_type:"player",
        ...annPayload(),
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
          player:"",playerObj:null,stat:"",ou:"",line:"",
          odds:"",stake:"",
          bookmaker:savedBK||bookmakers[0]||"",
          status:"pending",game:"",
          tipster:savedTip||"",
          notes:"",betType:"moneyline",team:"",opponent:"",annonce:false,annoncePlayer:"",annonceSide:"teammate",annonceStatus:"out",annonceRole:"starter",annonceSearch:"",
        });
      }else{
        onClose();
      }
    }catch(e){alert("Erreur: "+e.message);}
    setSaving(false);
  }

  const tc=getTeamColor(isTeamBet?form.team:(form.playerObj?.team||""));
  const pc=tc?.p||"#EBEBEB";
  const lum=h=>{const n=parseInt((h||"#000").slice(1),16);const c=[n>>16&255,n>>8&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*c[0]+.7152*c[1]+.0722*c[2];};
  // couleur principale du club ; si elle est presque noire, on prend la secondaire
  const btnBg=!tc?C.blue:(lum(tc.p)<.03&&tc.s?tc.s:tc.p);
  const btnFg=lum(btnBg)>.35?"#0C1424":"#FFFFFF";

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
  const potential=stakeN&&oddsN?eur(stakeN*oddsN):null;
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
      <div style={{maxWidth:430,margin:"0 auto",padding:"8px 20px calc(72px + env(safe-area-inset-bottom))"}}>
        <div style={{textAlign:"center",padding:"12px 0",fontSize:16,fontWeight:600}}>{editBet?"Modifier le pari":"Nouveau pari"}</div>

        {/* ── Recherche joueur / équipe (intégrée) ── */}
        {step==="search"&&(
          <div style={{marginTop:14}}>
            <div style={{position:"relative"}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round"
                style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)"}}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
              <input autoFocus aria-label="Rechercher un joueur ou une équipe"
                placeholder="Joueur ou équipe…"
                value={search} onChange={e=>setSearch(e.target.value)}
                style={{width:"100%",height:56,padding:"0 44px 0 46px",background:C.card,border:"1px solid "+(search?C.blue:C.line),
                  borderRadius:16,color:C.text,fontSize:17,outline:"none"}}/>
              {search&&<button type="button" aria-label="Effacer" onClick={()=>setSearch("")}
                style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",width:36,height:36,
                  background:"transparent",border:"none",color:C.sub,cursor:"pointer",fontSize:20}}>×</button>}
            </div>
            {(allTeams.length>0||playerResults.length>0)&&(
              <div style={{marginTop:8,background:C.card,border:"1px solid "+C.line,borderRadius:16,overflow:"hidden"}}>
                {allTeams.map(team=>{
                  const pt=players.find(p=>p.team===team);
                  return(
                    <SRow key={"t"+team} onClick={()=>selectTeam(team)}
                      logo={<SLogo src={getTeamLogo(team,pt?.team_logo_url||null)} name={team} size={44}/>}
                      title={team} sub={["Équipe",pt?.game].filter(Boolean).join(" · ")} chevron/>
                  );
                })}
                {playerResults.map(p=>(
                  <div key={p.name} style={{borderTop:"1px solid "+C.line}}>
                    <SRow onClick={()=>selectPlayer(p)}
                      logo={<PlayerFace src={p.photo_url||p.avatar_url} name={formatName(p.name)} team={p.team} size={44}/>}
                      title={formatName(p.name)} sub={[p.role,p.team].filter(Boolean).join(" · ")} chevron/>
                  </div>
                ))}
              </div>
            )}
            {search.length>=1&&playerResults.length===0&&allTeams.length===0&&(
              <div style={{textAlign:"center",padding:"28px 0",color:C.sub,fontSize:14}}>Aucun résultat pour « {search} »</div>
            )}
            {!search&&(
              <div style={{textAlign:"center",padding:"18px 0 4px",color:C.dim,fontSize:13}}>Astuce : initiales (lj), sigle (BOS) ou nom d'équipe</div>
            )}
          </div>
        )}

        {/* ── Carte joueur ── */}
        {step!=="search"&&<div
          style={{marginTop:14,position:"relative",width:"100%",height:230,borderRadius:20,overflow:"hidden",
            border:"1px solid "+C.line,background:`linear-gradient(135deg,${pc}40 0%,${C.card} 70%)`,
            padding:0,color:C.text,textAlign:"left",display:"block"}}>
          <span style={{position:"absolute",top:14,right:14,zIndex:2,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
            <button type="button" className="press" onClick={()=>{setSearch("");setStep("search");}}
              style={{height:30,padding:"0 12px",borderRadius:15,border:"none",cursor:"pointer",fontFamily:"inherit",
                background:"rgba(0,0,0,.35)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",color:"#fff",fontSize:12.5,fontWeight:600}}>
              Changer {isTeamBet?"d'équipe":"de joueur"}
            </button>
            {!isTeamBet&&form.playerObj&&(
              <button type="button" aria-label="Réglages du joueur" className="press" onClick={openPlayerSettings}
                style={{width:30,height:30,borderRadius:15,border:"none",cursor:"pointer",background:"rgba(0,0,0,.35)",
                  backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
              </button>
            )}
          </span>
          {teamLogoHeader&&(
            <img src={teamLogoHeader} alt="" style={{position:"absolute",right:isTeamBet?22:10,top:"50%",transform:"translateY(-50%)",
              width:isTeamBet?150:170,height:isTeamBet?150:170,objectFit:"contain",opacity:isTeamBet?1:.14,pointerEvents:"none",
              filter:isTeamBet?"drop-shadow(0 8px 24px rgba(0,0,0,.45))":"none"}}/>
          )}
          {playerPhoto&&(
            <img src={playerPhoto} alt={form.player} style={{position:"absolute",right:0,bottom:0,height:"100%",
              maxWidth:"55%",objectFit:"contain",objectPosition:"50% 100%"}}/>
          )}
          <span style={{position:"absolute",left:18,top:20,bottom:18,right:"45%",display:"flex",flexDirection:"column",gap:8}}>
            <span style={{fontSize:13,color:"rgba(255,255,255,.6)"}}>
              {(editBet?.created_at?new Date(editBet.created_at):new Date()).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}
              {" · "}{(editBet?.created_at?new Date(editBet.created_at):new Date()).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}
            </span>
            <span style={{fontSize:28,fontWeight:700,letterSpacing:-.6,lineHeight:1.08}}>
              {firstLine&&<>{firstLine}<br/></>}{secondLine}
            </span>
            <span style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"rgba(255,255,255,.75)",minWidth:0}}>
              {isTeamBet&&(
                <span style={{padding:"2px 7px",borderRadius:6,background:"rgba(255,255,255,.16)",color:"#fff",fontSize:11,fontWeight:700,flexShrink:0}}>Équipe</span>
              )}
              {!isTeamBet&&form.playerObj?.role&&(
                <span style={{padding:"2px 7px",borderRadius:6,background:"rgba(255,255,255,.16)",color:"#fff",fontSize:11,fontWeight:700,flexShrink:0}}>
                  {form.playerObj.role}
                </span>
              )}
              {teamName&&!isTeamBet&&<MiniLogo src={teamLogoHeader} label={teamName} size={18}/>}
              {!isTeamBet&&<span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{teamName}</span>}
              {form.game&&(
                <span role="button" tabIndex={0} aria-label={"Ligue : "+form.game+". Changer de compétition"}
                  onClick={e=>{e.stopPropagation();e.preventDefault();setLeagueMenu(m=>!m);}}
                  onKeyDown={e=>{if(e.key==="Enter"){e.stopPropagation();e.preventDefault();setLeagueMenu(m=>!m);}}}
                  style={{display:"inline-flex",alignItems:"center",gap:3,padding:"3px 5px",margin:"-3px -2px",borderRadius:8,cursor:"pointer",
                    background:leagueMenu?"rgba(255,255,255,.18)":"rgba(255,255,255,.08)",flexShrink:0}}>
                  <MiniLogo src={leagueLogo} label={form.game} size={18} round={false}/>
                  <svg width="9" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                    style={{transform:leagueMenu?"rotate(180deg)":"none",transition:"transform .2s"}}><path d="M1 1l4 4 4-4"/></svg>
                </span>
              )}
            </span>
            {(()=>{
              const rows=[];
              if(!isTeamBet&&(form.ou||form.line||form.stat))rows.push(<span key="l" style={{color:form.ou==="Over"?C.green:form.ou==="Under"?C.red:"#fff",fontWeight:700}}>
                {[form.ou,form.line,form.stat?statFR(form.stat):""].filter(Boolean).join(" ")}</span>);
              if(form.odds)rows.push(<span key="o">Cote : <b style={{color:"#fff"}}>{form.odds}</b></span>);
              if(form.stake)rows.push(<span key="s">Mise : <b style={{color:"#fff"}}>{eur(parseFloat(String(form.stake).replace(",","."))||0)}</b></span>);
              if(form.tipster)rows.push(<span key="t">Tipster : <b style={{color:"#fff"}}>{form.tipster}</b></span>);
              return rows.length?<span style={{marginTop:"auto",display:"flex",flexDirection:"column",gap:3,fontSize:13.5,color:"rgba(255,255,255,.72)",whiteSpace:"nowrap"}}>{rows}</span>:null;
            })()}
          </span>
        </div>}
        {playerSettings&&form.playerObj&&(
          <PlayerEditModal player={form.playerObj} leagues={psLeagues} clubs={psClubs}
            onClose={()=>setPlayerSettings(false)} uploadingId={psUploading}
            onPastePhoto={async()=>{
              const p=form.playerObj;
              try{
                setPsUploading(p.id);
                const url=await pasteImageToSupabase("player_"+p.name.replace(/\s/g,"_").toLowerCase());
                if(url){await updatePlayer(p.id,{photo_url:url});const np={...p,photo_url:url};f("playerObj",np);setPlayerSettings(false);setTimeout(()=>setPlayerSettings(true),0);onPlayersChanged&&onPlayersChanged();}
              }catch(e){alert("Erreur: "+e.message);}
              setPsUploading(null);
            }}
            onSave={async(p,fields)=>{
              try{
                const extra={};
                if(fields.team&&fields.team!==p.team&&CLUB_LOGOS_MAP[fields.team])extra.team_logo_url=CLUB_LOGOS_MAP[fields.team];
                const merged={...fields,...extra};
                await updatePlayer(p.id,merged);
                f("playerObj",{...p,...merged});
                if(merged.game)f("game",parseGames(merged.game)[0]||merged.game);
                setPlayerSettings(false);
                onPlayersChanged&&onPlayersChanged();
              }catch(e){alert("Erreur: "+e.message);}
            }}/>
        )}

        <div style={{marginTop:16}}>
        {step!=="search"&&leagueMenu&&(()=>{
          const opts=[...new Set([form.game,...clubLeagues].filter(Boolean))];
          return(
            <div className="fade-in" style={{marginTop:10,padding:"12px 14px",borderRadius:16,background:C.card,border:"1px solid "+C.line}}>
              <div style={{fontSize:13,color:C.sub,marginBottom:8}}>Compétition du pari</div>
              <div className="chip-row" style={{margin:"0 -14px",padding:"0 14px 2px",flexWrap:"wrap",overflow:"visible"}}>
                {opts.map(lg=>{
                  const on=form.game===lg;
                  return(
                    <button key={lg} type="button" className={"pick-chip"+(on?" on":"")} onClick={()=>{f("game",lg);setLeagueMenu(false);}}>
                      <MiniLogo src={getLeagueLogo(lg)} label={lg} size={18} round={false}/>{lg}
                      {isCup(lg)&&<span style={{fontSize:11,color:C.sub}}>coupe</span>}
                    </button>
                  );
                })}
              </div>
              {opts.length<=1&&<div style={{fontSize:12,color:C.dim,marginTop:8}}>Ce club n'est inscrit que dans une compétition. Ajoute-le à une autre ligue ou coupe dans Réglages → Joueurs.</div>}
            </div>
          );
        })()}

        {/* ── PARI ÉQUIPE ── */}
        {isTeamBet&&(()=>{
          const types=[
            {key:"moneyline",label:"Vainqueur"},
            {key:"handicap",label:"Handicap"},
            {key:"total",label:"Total match"},
            {key:"team_total",label:"Total équipe"},
            {key:"half",label:"1re mi-temps"},
          ];
          const needsOU=["total","team_total","half"].includes(form.betType);
          const needsLine=form.betType!=="moneyline";
          const leagueTeams=[...new Set(players.filter(p=>p.team&&p.team!==form.team&&(!form.game||p.game===form.game)).map(p=>p.team))].sort();
          const oppLogo=form.opponent?getTeamLogo(form.opponent,players.find(p=>p.team===form.opponent)?.team_logo_url||null):null;
          const lineTxt=form.line||"…";
          const preview=form.betType==="moneyline"?form.team+" gagne"
            :form.betType==="handicap"?form.team+" "+(String(form.line).startsWith("-")||!form.line?"":"+")+lineTxt
            :form.betType==="total"?(form.ou||"Over")+" "+lineTxt+" pts (match)"
            :form.betType==="team_total"?form.team+" "+(form.ou||"Over")+" "+lineTxt+" pts"
            :(form.ou||"Over")+" "+lineTxt+" pts (1re mi-temps)";
          const teamBadge=(logo,name,size=40)=>(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,flex:1,minWidth:0}}>
              <div style={{width:size+16,height:size+16,borderRadius:16,background:C.chip,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {logo?<img src={logo} alt="" style={{width:size,height:size,objectFit:"contain"}}/>
                  :<span style={{color:C.sub,fontSize:13,fontWeight:700}}>{(name||"?").slice(0,3).toUpperCase()}</span>}
              </div>
              <span style={{fontSize:13,fontWeight:600,color:name?C.text:C.dim,textAlign:"center",maxWidth:"100%",
                whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{name||"Adversaire"}</span>
            </div>
          );
          return(
            <>
              {/* Affiche du match */}
              <div style={{background:C.card,border:"1px solid "+C.line,borderRadius:18,padding:"16px 14px",display:"flex",alignItems:"center",gap:8}}>
                {teamBadge(teamLogoHeader,form.team)}
                <span style={{fontSize:13,fontWeight:700,color:C.dim,letterSpacing:1}}>VS</span>
                {teamBadge(oppLogo,form.opponent||null)}
              </div>
              <select className="fld" aria-label="Adversaire (optionnel)" value={form.opponent} onChange={e=>f("opponent",e.target.value)}
                style={{marginTop:8,color:form.opponent?C.text:C.sub,fontWeight:500}}>
                <option value="">Choisir l'adversaire (optionnel)</option>
                {leagueTeams.map(tn=><option key={tn} value={tn}>{tn}</option>)}
              </select>

              <div className="pick-head"><span>Type de pari</span></div>
              <div className="chip-row">
                {types.map(ty=>(
                  <button key={ty.key} type="button" className={"pick-chip"+(form.betType===ty.key?" on":"")}
                    onClick={()=>f("betType",ty.key)}>{ty.label}</button>
                ))}
              </div>

              {needsLine&&(
                <>
                  <div className="pick-head"><span>{form.betType==="handicap"?"Handicap":"Ligne"}</span></div>
                  <div className="sentence">
                    {needsOU&&(
                      <select className="sent-sel" aria-label="Over ou Under" value={form.ou||"Over"} onChange={e=>f("ou",e.target.value)}
                        style={{color:(form.ou||"Over")==="Over"?C.green:C.red}}>
                        <option>Over</option><option>Under</option>
                      </select>
                    )}
                    <input type="number" step="0.5" inputMode="decimal" aria-label="Ligne"
                      placeholder={form.betType==="handicap"?"-5.5":form.betType==="team_total"?"112.5":"220.5"}
                      value={form.line} onChange={e=>f("line",e.target.value)}
                      style={{flex:1,minWidth:0,height:"100%",border:"none",borderLeft:needsOU?"1px solid "+C.line:"none",background:"transparent",
                        color:C.text,fontSize:17,fontWeight:600,padding:"0 14px",outline:"none",fontFamily:"inherit"}}/>
                    <span style={{padding:"0 14px",color:C.sub,fontSize:15}}>{form.betType==="handicap"?"pts":"points"}</span>
                  </div>
                </>
              )}

              {/* Aperçu du pari */}
              <div style={{marginTop:14,display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:14,
                background:pc+"1F",border:"1px solid "+pc+"55"}}>
                {teamLogoHeader&&<img src={teamLogoHeader} alt="" style={{width:28,height:28,objectFit:"contain",flexShrink:0}}/>}
                <div style={{minWidth:0}}>
                  <div style={{fontSize:16,fontWeight:600}}>{preview}</div>
                  {form.opponent&&<div style={{fontSize:13,color:C.sub,marginTop:1}}>vs {form.opponent}</div>}
                </div>
              </div>
            </>
          );
        })()}
        {/* ── PARI JOUEUR : Over/Under · Ligne · Stat ── */}
        {!isTeamBet&&(
          <div className="sentence">
            <select className="sent-sel" style={{color:form.ou==="Over"?C.green:form.ou==="Under"?C.red:C.sub}} aria-label="Over ou Under" value={form.ou} onChange={e=>f("ou",e.target.value)}>
              <option value="">Choisir</option><option>Over</option><option>Under</option>
            </select>
            <select className="sent-sel" aria-label="Ligne" value={form.line} onChange={e=>f("line",e.target.value)} style={form.line?undefined:{color:C.sub}}>
              <option value="">Ligne</option>
              {Array.from({length:45},(_,i)=>(i+0.5).toFixed(1)).map(v=><option key={v} value={v}>{v}</option>)}
            </select>
            <select className="sent-sel grow" aria-label="Type de stat" value={form.stat} onChange={e=>f("stat",e.target.value)} style={form.stat?undefined:{color:C.sub}}>
              <option value="">Choisir</option>
              {["Points","Rebonds","Assists","Points+Rebonds","Points+Assists",
                "Points+Rebonds+Assists","3 Points Made","Steals","Blocks",
                "Turnovers","Fantasy Score","Minutes"].map(s=><option key={s} value={s}>{statFR(s)}</option>)}
            </select>
          </div>
        )}
        </div>

        {/* ── Cote + Mise ── */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginTop:12}}>
          <label className="fld-box">Cote
            <input type="number" step="0.01" inputMode="decimal" placeholder="" value={form.odds}
              onChange={e=>f("odds",e.target.value)}
              onBlur={e=>{
                const n=parseFloat(e.target.value.replace(",","."));
                if(!isNaN(n)&&n>=100)f("odds",(n/100).toFixed(2));
              }}/>
          </label>
          <label className="fld-box">Mise (€)
            <input type="number" inputMode="decimal" placeholder="" value={form.stake}
              onChange={e=>f("stake",e.target.value)}/>
          </label>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,minmax(0,1fr))",gap:6,marginTop:8}}>
          {[{pct:"0.5%",val:50},{pct:"0.75%",val:75},{pct:"1%",val:100},{pct:"1.25%",val:125},{pct:"1.5%",val:150}].map(({pct,val})=>{
            const active=String(form.stake)===String(val);
            return(
              <button key={val} type="button" onClick={()=>f("stake",String(val))}
                style={{height:34,borderRadius:17,border:"none",cursor:"pointer",
                  background:active?C.blue:C.card,color:active?"#0C1424":C.sub,
                  fontSize:12,fontWeight:600,lineHeight:1.2}}>
                {pct}
              </button>
            );
          })}
        </div>

        {/* ── Bookmaker ── */}
        <div className="pick-head">
          <span>Bookmaker</span>{lockBtn(lockedBK,()=>setLockedBK(p=>!p),"Verrouiller le bookmaker")}
        </div>
        <div className="chip-row">
          {bookmakers.map(bk=>{
            const on=form.bookmaker===bk;
            return(
              <button key={bk} type="button" className={"pick-chip logo"+(on?" on":"")} aria-label={bk} title={bk}
                onClick={()=>f("bookmaker",on?"":bk)}>
                <MiniLogo src={bkPhotos[bk]} label={bk} size={26} round={false}/>
              </button>
            );
          })}
        </div>

        {/* ── Tipster ── */}
        <div className="pick-head">
          <span>Tipster</span>{lockBtn(lockedTip,()=>setLockedTip(p=>!p),"Verrouiller le tipster")}
        </div>
        {tipsters.length>0?(
          <div className="chip-row">
            {tipsters.map(tp=>{
              const on=form.tipster===tp.name;
              return(
                <button key={tp.id} type="button" className={"pick-chip"+(on?" on":"")} onClick={()=>f("tipster",on?"":tp.name)}>
                  {tp.name}
                </button>
              );
            })}
          </div>
        ):(
          <input className="form-input" placeholder="Nom du tipster (optionnel)" value={form.tipster} onChange={e=>f("tipster",e.target.value)}/>
        )}

        {/* ── Annonce (pari pris sur une absence) ── */}
        <div style={{marginTop:18,padding:"12px 14px",borderRadius:16,background:form.annonce?"rgba(245,158,11,.08)":C.card,
          border:"1px solid "+(form.annonce?"rgba(245,158,11,.35)":C.line),transition:"all .2s"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{flex:1}}>
              <div style={{fontSize:15,fontWeight:600,color:form.annonce?"#FBBF24":C.text}}>Annonce</div>
              <div style={{fontSize:12,color:C.sub,marginTop:2}}>Pari pris suite à une absence (joueur out)</div>
            </div>
            <Switch on={form.annonce} onChange={v=>f("annonce",v)} label="Pari sur annonce"/>
          </div>
          {form.annonce&&(()=>{
            const myTeam=isTeamBet?form.team:(form.playerObj?.team||"");
            const q=form.annonceSearch.toLowerCase().trim();
            const res=q.length>=2?players.filter(p=>p.name!==form.player&&(p.name.toLowerCase().includes(q)||
              p.name.toLowerCase().split(" ").map(w=>w[0]).join("").includes(q))).slice(0,5):[];
            const absent=form.annoncePlayer?players.find(p=>p.name===form.annoncePlayer):null;
            const seg=(k,opts)=>(
              <div className="segment" style={{marginTop:8}}>
                {opts.map(([v,l])=>(
                  <button key={v} type="button" className={"seg-btn"+(form[k]===v?" active":"")} onClick={()=>f(k,v)}
                    style={form[k]===v?{color:"#FBBF24"}:undefined}>{l}</button>
                ))}
              </div>
            );
            return(
              <div className="fade-in" style={{marginTop:12}}>
                <div style={{fontSize:12,color:C.sub,margin:"0 2px 6px"}}>Joueur absent</div>
                {form.annoncePlayer?(
                  <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",borderRadius:12,background:C.inner,border:"1px solid "+C.line}}>
                    <PlayerFace src={absent?.photo_url||absent?.avatar_url} name={formatName(form.annoncePlayer)} team={absent?.team} size={38}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:15,fontWeight:600}}>{formatName(form.annoncePlayer)} <span style={{color:C.red,fontSize:12,fontWeight:700}}>OUT</span></div>
                      <div style={{fontSize:12,color:C.sub}}>{[absent?.role,absent?.team].filter(Boolean).join(" · ")}</div>
                    </div>
                    <button type="button" aria-label="Changer le joueur absent" onClick={()=>{f("annoncePlayer","");f("annonceSearch","");}}
                      style={{border:"none",background:"transparent",color:C.sub,fontSize:20,cursor:"pointer",width:36,height:36}}>×</button>
                  </div>
                ):(
                  <div style={{position:"relative"}}>
                    <input className="form-input" placeholder="Rechercher le joueur out…" value={form.annonceSearch}
                      onChange={e=>f("annonceSearch",e.target.value)} style={{height:44}}/>
                    {res.length>0&&(
                      <div style={{marginTop:6,background:C.card,border:"1px solid "+C.line,borderRadius:12,overflow:"hidden"}}>
                        {res.map((p,i)=>(
                          <div key={p.name} onClick={()=>{
                              f("annoncePlayer",p.name);f("annonceSearch","");
                              f("annonceSide",myTeam&&sameTeam(p.team,myTeam)?"teammate":"opponent");
                            }}
                            style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",cursor:"pointer",borderTop:i?"1px solid "+C.line:"none"}}>
                            <PlayerFace src={p.photo_url||p.avatar_url} name={formatName(p.name)} team={p.team} size={34}/>
                            <div style={{minWidth:0}}>
                              <div style={{fontSize:14,fontWeight:600}}>{formatName(p.name)}</div>
                              <div style={{fontSize:12,color:C.sub}}>{[p.role,p.team].filter(Boolean).join(" · ")}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {seg("annonceSide",[["teammate","Coéquipier"],["opponent","Adversaire"]])}
                {seg("annonceStatus",[["out","Out confirmé"],["doubt","Incertain"]])}
                {seg("annonceRole",[["star","Star"],["starter","Titulaire"],["bench","Rotation"]])}
              </div>
            );
          })()}
        </div>

        {/* ── Statut ── */}
        <div className="pick-head"><span>Statut</span></div>
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

        {/* ── Bouton collé en bas avec le gain ── */}
        <div style={{position:"sticky",bottom:"calc(64px + env(safe-area-inset-bottom))",margin:"20px -20px 0",padding:"14px 20px 12px",
          background:"linear-gradient(to top,"+C.bg+" 70%,rgba(20,22,27,0))"}}>
          {(()=>{const why=missing();return(
          <button onClick={submit} disabled={saving||!!why} className="press"
            style={{width:"100%",height:56,borderRadius:16,border:"none",cursor:why?"default":"pointer",
              background:why?"#262B35":btnBg,color:why?C.sub:btnFg,boxShadow:why?"none":"0 6px 24px "+btnBg+"40",
              fontSize:17,fontWeight:600,opacity:saving?.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {why?why:saving?"Enregistrement…":<>
              {editBet?"Modifier le pari":"Ajouter"}
              {potential&&<span style={{fontWeight:500,opacity:.75}}>· Gain {potential}</span>}
            </>}
          </button>);})()}
        </div>
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
  const legs=bet._group||null;
  const[legEdits,setLegEdits]=useState({}); // {id:{odds,stake}}
  const[other,setOther]=useState(null); // {bookmaker,odds,stake}
  const[otherSaving,setOtherSaving]=useState(false);

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

  const hasDirty=Object.keys(dirty).length>0||Object.keys(legEdits).length>0;

  const setField=useCallback((field,value)=>{
    setLocalBet(prev=>({...prev,[field]:value}));
    setDirty(prev=>({...prev,[field]:value}));
    setDropdown(null);
  },[]);

  async function changeStatus(status){
    setSaving(true);
    if(legs){
      await Promise.all(legs.map(l=>updateBet(l.id,{status,profit:calcProfit(status,parseFloat(l.stake),parseFloat(l.odds))})));
      const profit=legs.reduce((s,l)=>s+calcProfit(status,parseFloat(l.stake),parseFloat(l.odds)),0);
      setLocalBet(prev=>({...prev,status,profit}));
      setDirty({});onUpdate();setSaving(false);return;
    }
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
    if(legs){
      const shared={...dirty};delete shared.odds;delete shared.stake;delete shared.bookmaker;
      await Promise.all(legs.map(l=>{
        const e=legEdits[l.id]||{};
        const up={...shared};
        if(e.odds!=null)up.odds=e.odds;
        if(e.stake!=null)up.stake=e.stake;
        const s=up.status||l.status;
        if((e.odds!=null||e.stake!=null)&&s!=="pending")up.profit=calcProfit(s,parseFloat(up.stake??l.stake),parseFloat(up.odds??l.odds));
        return Object.keys(up).length?updateBet(l.id,up):null;
      }));
      setDirty({});setLegEdits({});setSaveAnim(true);setTimeout(()=>setSaveAnim(false),1200);
      onUpdate();setSaving(false);onClose();return;
    }
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
    if(!window.confirm(legs?"Supprimer ce pari sur les "+legs.length+" sites ?":"Supprimer ce pari ?"))return;
    if(legs){await Promise.all(legs.map(l=>deleteBet(l.id)));onUpdate();onClose();return;}
    await deleteBet(localBet.id);
    onUpdate();
    onClose();
  }

  const st=localBet.status;
  const statusColor=st==="won"?C.green:st==="lost"?C.red:st==="void"?C.sub:C.blue;
  const statusLabel=st==="pending"?"En cours":st==="won"?"Gagné":st==="lost"?"Perdu":"Void";
  const lum=h=>{const n=parseInt((h||"#000").slice(1),16);const c=[n>>16&255,n>>8&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);});return .2126*c[0]+.7152*c[1]+.0722*c[2];};
  const accent=!tc?C.blue:(lum(tc.p)<.03&&tc.s?tc.s:tc.p);
  const accentFg=lum(accent)>.35?"#0C1424":"#FFFFFF";
  const stakeN=parseFloat(localBet.stake)||0,oddsN=parseFloat(localBet.odds)||0;
  const bigValue=st==="pending"?"→ "+eur(stakeN*oddsN):st==="void"?eur(stakeN):money(profitNum);
  const bigLabel=st==="pending"?"Gain potentiel":st==="void"?"Remboursé":"Résultat";
  const bigColor=st==="pending"?C.blue:st==="void"?C.sub:pColor(profitNum);
  const role=!isTeamBet?pData?.role:null;
  const teamName=localBet.team||pData?.team||"";
  const d=localBet.created_at?new Date(localBet.created_at):null;
  const pad=n=>String(n).padStart(2,"0");
  const localDT=d?d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes()):"";
  const row={display:"flex",alignItems:"center",gap:10,minHeight:52,padding:"0 16px",borderBottom:"1px solid "+C.line};
  const lab={fontSize:15,color:C.sub,width:92,flexShrink:0};
  const numInput=(k)=>(
    <input type="number" inputMode="decimal" className="row-select" defaultValue={localBet[k]??""} key={k+String(localBet[k])}
      onBlur={e=>{
        let v=e.target.value.trim();
        if(k==="odds"){const n=parseFloat(v.replace(",","."));if(!isNaN(n))v=(n>=100?n/100:n).toFixed(2);}
        if(v!==String(localBet[k]??""))setField(k,v);
      }}
      onKeyDown={e=>{if(e.key==="Enter")e.target.blur();}}
      style={{fontWeight:600,color:dirty[k]!==undefined?C.green:C.text}}/>
  );

  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal-sheet" style={{padding:0,borderRadius:"24px 24px 0 0",maxHeight:"92vh",display:"flex",flexDirection:"column"}}>
        {/* ── En-tête joueur ── */}
        <div style={{position:"relative",height:210,flexShrink:0,overflow:"hidden",borderRadius:"24px 24px 0 0",
          background:`linear-gradient(135deg,${pc}66 0%,${C.card} 72%)`}}>
          {resolvedTeamLogo&&<img src={resolvedTeamLogo} alt="" style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",
            width:180,height:180,objectFit:"contain",opacity:.12,pointerEvents:"none"}}/>}
          {photo&&<img src={photo} alt={rawName} style={{position:"absolute",right:0,bottom:0,height:"94%",maxWidth:"52%",
            objectFit:"contain",objectPosition:"50% 100%"}}/>}
          <div className="modal-handle" style={{position:"absolute",top:8,left:"50%",transform:"translateX(-50%)",margin:0}}/>
          <button type="button" aria-label="Fermer" onClick={onClose} className="press"
            style={{position:"absolute",top:14,right:14,width:34,height:34,borderRadius:17,border:"none",zIndex:3,
              background:"rgba(0,0,0,.35)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
          <div style={{position:"absolute",left:18,top:26,bottom:18,right:"46%",display:"flex",flexDirection:"column",gap:6,zIndex:2}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"3px 10px",borderRadius:12,
                background:statusColor+"22",color:statusColor,fontSize:12,fontWeight:600}}>
                <span style={{width:6,height:6,borderRadius:3,background:statusColor}}/>{statusLabel}
              </span>
              {d&&<span style={{fontSize:12,color:"rgba(255,255,255,.6)"}}>{d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span>}
              {localBet.annonce&&<AnnonceBadge small note={localBet.annonce_player?formatName(localBet.annonce_player):localBet.annonce_note}/>}
            </div>
            <div style={{fontSize:26,fontWeight:700,letterSpacing:-.6,lineHeight:1.08,marginTop:2}}>{nameFormatted}</div>
            <div style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:"rgba(255,255,255,.75)",minWidth:0}}>
              {role&&<span style={{padding:"2px 7px",borderRadius:6,background:"rgba(255,255,255,.16)",color:"#fff",fontSize:11,fontWeight:700}}>{role}</span>}
              {teamName&&!isTeamBet&&<MiniLogo src={resolvedTeamLogo} label={teamName} size={16}/>}
              {!isTeamBet&&<span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{teamName}</span>}
              {localBet.game&&<MiniLogo src={getLeagueLogo(localBet.game)} label={localBet.game} size={16} round={false}/>}
            </div>
            <div style={{marginTop:"auto"}}>
              <div style={{fontSize:12,color:"rgba(255,255,255,.6)"}}>{bigLabel}</div>
              <div style={{fontSize:26,fontWeight:700,letterSpacing:-.5,color:bigColor}}>{bigValue}</div>
            </div>
          </div>
        </div>

        {/* ── Corps ── */}
        <div style={{overflowY:"auto",padding:"16px 20px 0",flex:1}}>
          {(()=>{
            const pd=!isTeamBet?parseDesc(localBet.description):null;
            if(!pd)return(
              <div style={{background:C.inner,border:"1px solid "+C.line,borderRadius:14,padding:"12px 14px",fontSize:16,fontWeight:600}}>
                {descFR(localBet.description)||"—"}
              </div>
            );
            const lines=Array.from({length:45},(_,i)=>(i+0.5).toFixed(1));
            const cur=parseFloat(String(pd.line).replace(",",".")).toFixed(1);
            if(!lines.includes(cur))lines.push(cur);
            const stats=Object.keys(STAT_FR);
            if(!stats.includes(pd.stat))stats.push(pd.stat);
            const upd=ch=>{
              const n={ou:pd.ou,line:cur,stat:pd.stat,...ch};
              setField("description",n.ou+" "+n.line+" "+n.stat);
              setField("over_under",n.ou);
              setField("line",parseFloat(n.line));
            };
            const changed=dirty.description!==undefined;
            return(
              <div className="sentence" style={{borderColor:changed?C.green+"88":undefined}}>
                <select className="sent-sel" aria-label="Over ou Under" value={pd.ou} onChange={e=>upd({ou:e.target.value})}
                  style={{color:pd.ou==="Over"?C.green:C.red}}>
                  <option>Over</option><option>Under</option>
                </select>
                <select className="sent-sel" aria-label="Ligne" value={cur} onChange={e=>upd({line:e.target.value})}>
                  {lines.sort((a,b)=>a-b).map(v=><option key={v} value={v}>{v}</option>)}
                </select>
                <select className="sent-sel grow" aria-label="Type de stat" value={pd.stat} onChange={e=>upd({stat:e.target.value})}>
                  {stats.map(s=><option key={s} value={s}>{statFR(s)}</option>)}
                </select>
              </div>
            );
          })()}

          <div className="pick-head"><span>Statut</span></div>
          <div className="segment">
            {[{k:"pending",l:"En cours"},{k:"won",l:"Gagné"},{k:"lost",l:"Perdu"},{k:"void",l:"Void"}].map(({k,l})=>{
              const on=st===k;
              const col=k==="won"?C.green:k==="lost"?C.red:C.text;
              return(
                <button key={k} type="button" className={"seg-btn"+(on?" active":"")} disabled={saving}
                  onClick={()=>!on&&changeStatus(k)} style={on?{color:col}:undefined}>{l}</button>
              );
            })}
          </div>

          <div className="pick-head"><span>Détails</span>{dirty&&hasDirty&&<span style={{fontSize:12,color:C.green}}>Modifié</span>}</div>
          <div style={{background:C.card,border:"1px solid "+C.line,borderRadius:16,overflow:"hidden"}}>
            {legs?(
              <div style={{padding:"12px 16px",borderBottom:"1px solid "+C.line}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:C.sub,marginBottom:8}}>
                  <span>Répartition sur {legs.length} sites</span>
                  <span>Total {eur(legs.reduce((s,l)=>s+parseFloat(legEdits[l.id]?.stake??l.stake??0),0))}</span>
                </div>
                {legs.map((l,i)=>{
                  const e=legEdits[l.id]||{};
                  const o=parseFloat(e.odds??l.odds)||0,s=parseFloat(e.stake??l.stake)||0;
                  const g=st==="pending"?s*o:st==="void"?0:calcProfit(st,s,o);
                  const setLeg=(k,v)=>{const n=parseFloat(String(v).replace(",","."));setLegEdits(p=>({...p,[l.id]:{...p[l.id],[k]:isNaN(n)?null:n}}));};
                  return(
                    <div key={l.id} style={{display:"grid",gridTemplateColumns:"1fr 64px 70px 84px",alignItems:"center",gap:8,
                      padding:"8px 0",borderTop:i?"1px solid "+C.line:"none"}}>
                      <span style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                        <MiniLogo src={bkPhotos[l.bookmaker]} label={l.bookmaker||"?"} size={22} round={false}/>
                        <span style={{fontSize:14,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{l.bookmaker||"—"}</span>
                      </span>
                      <input type="number" inputMode="decimal" aria-label={"Cote "+l.bookmaker} defaultValue={l.odds}
                        onChange={ev=>setLeg("odds",ev.target.value)} className="leg-in"/>
                      <input type="number" inputMode="decimal" aria-label={"Mise "+l.bookmaker} defaultValue={l.stake}
                        onChange={ev=>setLeg("stake",ev.target.value)} className="leg-in"/>
                      <span style={{textAlign:"right",fontSize:14,fontWeight:600,color:st==="pending"?C.blue:pColor(g)}}>
                        {st==="pending"?"→ "+eur(g,0):money(g)}
                      </span>
                    </div>
                  );
                })}
                <div style={{display:"grid",gridTemplateColumns:"1fr 64px 70px 84px",gap:8,fontSize:11,color:C.dim,marginTop:2}}>
                  <span/><span style={{textAlign:"center"}}>cote</span><span style={{textAlign:"center"}}>mise €</span><span style={{textAlign:"right"}}>{st==="pending"?"gain pot.":"résultat"}</span>
                </div>
              </div>
            ):<>
            <div style={row}><span style={lab}>Cote</span>{numInput("odds")}</div>
            <div style={row}><span style={lab}>Mise (€)</span>{numInput("stake")}</div>
            <div style={row}>
              <span style={lab}>Bookmaker</span>
              {localBet.bookmaker&&<MiniLogo src={bkPhotos[localBet.bookmaker]} label={localBet.bookmaker} size={20} round={false}/>}
              <select className="row-select" value={localBet.bookmaker||""} onChange={e=>setField("bookmaker",e.target.value)}
                style={{color:dirty.bookmaker!==undefined?C.green:C.text}}>
                <option value="">Aucun</option>
                {bookmakerList.map(b=><option key={b.name} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            </>}
            <div style={row}>
              <span style={lab}>Tipster</span>
              <select className="row-select" value={localBet.tipster||""} onChange={e=>setField("tipster",e.target.value)}
                style={{color:dirty.tipster!==undefined?C.green:C.text}}>
                <option value="">Aucun</option>
                {tipsterList.map(tp=><option key={tp.id||tp.name} value={tp.name}>{tp.name}</option>)}
              </select>
            </div>
            <div style={row}>
              <span style={lab}>Ligue</span>
              {localBet.game&&<MiniLogo src={getLeagueLogo(localBet.game)} label={localBet.game} size={20} round={false}/>}
              <select className="row-select" value={localBet.game||""} onChange={e=>setField("game",e.target.value)}
                style={{color:dirty.game!==undefined?C.green:C.text}}>
                <option value="">—</option>
                {leagueList.map(l=><option key={l.id||l.name} value={l.name}>{l.name}</option>)}
              </select>
            </div>
            <div style={row}>
              <span style={{...lab,color:localBet.annonce?"#FBBF24":C.sub,flex:1,width:"auto"}}>Pari sur annonce</span>
              <Switch on={!!localBet.annonce} onChange={v=>{
                setField("annonce",v);
                if(!v){["annonce_player","annonce_note","annonce_side","annonce_status","annonce_role"].forEach(k=>setField(k,null));}
                else{if(!localBet.annonce_side)setField("annonce_side","teammate");if(!localBet.annonce_status)setField("annonce_status","out");if(!localBet.annonce_role)setField("annonce_role","starter");}
              }} label="Pari sur annonce"/>
            </div>
            {localBet.annonce&&<>
              <div style={row}>
                <span style={lab}>Absent</span>
                <input className="row-select" list="annonce-players" placeholder="Nom du joueur out"
                  defaultValue={localBet.annonce_player?formatName(localBet.annonce_player):(localBet.annonce_note||"")}
                  key={"ap"+(localBet.annonce_player||"")}
                  onBlur={e=>{
                    const v=e.target.value.trim();
                    const p=players.find(x=>formatName(x.name).toLowerCase()===v.toLowerCase());
                    const raw=p?p.name:(v||null);
                    if(raw!==(localBet.annonce_player||null)){
                      setField("annonce_player",raw);setField("annonce_note",v||null);
                      const my=localBet.team||pData?.team;
                      if(p&&my)setField("annonce_side",sameTeam(p.team,my)?"teammate":"opponent");
                    }
                  }}
                  style={{color:dirty.annonce_player!==undefined?C.green:"#FBBF24",fontWeight:500}}/>
                <datalist id="annonce-players">{players.map(p=><option key={p.name} value={formatName(p.name)}/>)}</datalist>
              </div>
              {[["annonce_side","Côté",[["teammate","Coéquipier"],["opponent","Adversaire"]]],
                ["annonce_status","Statut absent",[["out","Out confirmé"],["doubt","Incertain"]]],
                ["annonce_role","Importance",[["star","Star"],["starter","Titulaire"],["bench","Rotation"]]]].map(([k,l,opts])=>(
                <div key={k} style={row}>
                  <span style={lab}>{l}</span>
                  <select className="row-select" value={localBet[k]||""} onChange={e=>setField(k,e.target.value)}
                    style={{color:dirty[k]!==undefined?C.green:C.text}}>
                    <option value="">—</option>{opts.map(([v,t2])=><option key={v} value={v}>{t2}</option>)}
                  </select>
                </div>
              ))}
            </>}
            <div style={row}>
              <span style={lab}>Cote clôture</span>
              {(()=>{
                const co=parseFloat(localBet.closing_odds);const o=parseFloat(localBet.odds);
                if(!co||!o)return null;
                const clv=(o/co-1)*100;
                return <span style={{fontSize:13,fontWeight:600,color:pColor(clv),whiteSpace:"nowrap"}}>CLV {(clv>0?"+":"")+clv.toFixed(1).replace(".",",")}%</span>;
              })()}
              <input type="number" inputMode="decimal" className="row-select" placeholder="optionnel"
                defaultValue={localBet.closing_odds??""} key={"co"+String(localBet.closing_odds)}
                onBlur={e=>{
                  const n=parseFloat(e.target.value.replace(",","."));
                  const v=isNaN(n)?null:(n>=100?n/100:n);
                  if(v!==(localBet.closing_odds??null))setField("closing_odds",v);
                }}
                onKeyDown={e=>{if(e.key==="Enter")e.target.blur();}}
                style={{fontWeight:600,color:dirty.closing_odds!==undefined?C.green:C.text}}/>
            </div>
            <div style={{...row,borderBottom:"none"}}>
              <span style={lab}>Date</span>
              <input type="datetime-local" className="row-select" value={localDT} style={{colorScheme:"dark",color:dirty.created_at!==undefined?C.green:C.text}}
                onChange={e=>setField("created_at",e.target.value?new Date(e.target.value).toISOString():"")}/>
            </div>
          </div>

          {/* ── Même pari sur un autre site ── */}
          {!other?(
            <button type="button" className="press" onClick={()=>setOther({bookmaker:"",odds:String(localBet.odds||""),stake:String(localBet.stake||"")})}
              style={{width:"100%",marginTop:16,height:50,borderRadius:14,border:"1px dashed #3A404C",background:"transparent",
                color:C.blue,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
              Même pari sur un autre site
            </button>
          ):(
            <div className="fade-in" style={{marginTop:16,padding:14,borderRadius:16,background:C.card,border:"1px solid rgba(91,157,255,.35)"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:15,fontWeight:600}}>Même pari sur un autre site</span>
                <button type="button" aria-label="Annuler" onClick={()=>setOther(null)}
                  style={{border:"none",background:"transparent",color:C.sub,fontSize:20,cursor:"pointer",width:32,height:32}}>×</button>
              </div>
              <div style={{fontSize:13,color:C.sub,margin:"2px 0 10px"}}>{descFR(localBet.description)} · même statut et même date</div>
              <div className="chip-row" style={{margin:"0 -14px",padding:"0 14px 2px"}}>
                {bookmakerList.filter(bk=>legs?!legs.some(l=>l.bookmaker===bk.name):bk.name!==localBet.bookmaker).map(bk=>{
                  const on=other.bookmaker===bk.name;
                  return(
                    <button key={bk.name} type="button" className={"pick-chip"+(on?" on":"")}
                      onClick={()=>setOther(o=>({...o,bookmaker:on?"":bk.name}))}>
                      {bk.logo&&<MiniLogo src={bk.logo} label={bk.name} size={18} round={false}/>}{bk.name}
                    </button>
                  );
                })}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8,marginTop:10}}>
                <label className="fld-box">Cote sur ce site
                  <input type="number" inputMode="decimal" value={other.odds} onChange={e=>setOther(o=>({...o,odds:e.target.value}))}/>
                </label>
                <label className="fld-box">Mise (€)
                  <input type="number" inputMode="decimal" value={other.stake} onChange={e=>setOther(o=>({...o,stake:e.target.value}))}/>
                </label>
              </div>
              <button type="button" className="press" disabled={!other.bookmaker||otherSaving}
                onClick={async()=>{
                  const odds=parseFloat(String(other.odds).replace(",","."));
                  const stake=parseFloat(String(other.stake).replace(",","."));
                  if(!odds||!stake){alert("Cote et mise obligatoires");return;}
                  setOtherSaving(true);
                  try{
                    const base=legs?legs[0]:localBet;
                    const gid=base.group_id||base.id;
                    if(!base.group_id)await updateBet(base.id,{group_id:gid});
                    const{id,_group,...copy}=base;
                    await insertBet({...copy,id:uuid(),group_id:gid,bookmaker:other.bookmaker,odds,stake,
                      profit:calcProfit(localBet.status,stake,odds),created_at:base.created_at||new Date().toISOString()});
                    onUpdate();onClose();
                  }catch(e){alert("Erreur: "+e.message);setOtherSaving(false);}
                }}
                style={{width:"100%",marginTop:12,height:48,borderRadius:14,border:"none",fontSize:15,fontWeight:600,fontFamily:"inherit",
                  cursor:other.bookmaker?"pointer":"default",background:other.bookmaker?C.blue:"#262B35",color:other.bookmaker?"#0C1424":C.dim}}>
                {otherSaving?"Ajout…":other.bookmaker?"Ajouter sur "+other.bookmaker:"Choisis un bookmaker"}
              </button>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginTop:16}}>
            <button type="button" className="btn btn-secondary press" style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
              onClick={async()=>{
                const now=new Date().toISOString();
                if(legs){
                  const gid=uuid();
                  await Promise.all(legs.map(l=>{const{id,...c}=l;return insertBet({...c,id:uuid(),group_id:gid,status:"pending",profit:0,created_at:now});}));
                }else{
                  const{id,_group,...copy}=localBet;
                  await insertBet({...copy,id:uuid(),status:"pending",profit:0,created_at:now});
                }
                onUpdate();onClose();
              }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
              Dupliquer
            </button>
            <button type="button" className="btn btn-danger press" onClick={remove} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
              Supprimer
            </button>
          </div>

          {/* Enregistrer : collé en bas, visible seulement s'il y a des modifications */}
          <div style={{position:"sticky",bottom:0,margin:"0 -20px",padding:"14px 20px calc(16px + env(safe-area-inset-bottom))",
            background:"linear-gradient(to top,#1A1D23 70%,rgba(26,29,35,0))"}}>
            {hasDirty?(
              <button type="button" onClick={saveAll} disabled={saving} className="press"
                style={{width:"100%",height:54,borderRadius:16,border:"none",cursor:"pointer",background:accent,color:accentFg,
                  fontSize:17,fontWeight:600,boxShadow:"0 6px 24px "+accent+"40"}}>
                {saving?"Enregistrement…":"Enregistrer les modifications"}
              </button>
            ):saveAnim?(
              <div style={{height:54,display:"flex",alignItems:"center",justifyContent:"center",color:C.green,fontSize:15,fontWeight:600}}>✓ Enregistré</div>
            ):null}
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
const money=(v,dec=2)=>(v>0?"+":v<0?"−":"")+eur(Math.abs(v),dec);
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

// Tuile logo uniforme (bookmaker : icône pleine ; ligue : logo centré)
function LogoTile({src,label,size=22,fill=false}){
  const[err,setErr]=useState(false);
  return(
    <span title={label} style={{width:size,height:size,borderRadius:Math.round(size*.28),overflow:"hidden",flexShrink:0,
      display:"inline-flex",alignItems:"center",justifyContent:"center",background:"#262B35",
      boxShadow:"inset 0 0 0 1px rgba(255,255,255,.09)"}}>
      {src&&!err
        ?<img src={src} alt={label||""} onError={()=>setErr(true)}
            style={fill?{width:"100%",height:"100%",objectFit:"cover"}:{width:"72%",height:"72%",objectFit:"contain"}}/>
        :<span style={{fontSize:Math.round(size*.36),fontWeight:700,color:"#C4C9D4"}}>{(label||"?").slice(0,2).toUpperCase()}</span>}
    </span>
  );
}

// Photo ronde du joueur : buste entier, fond couleur du club (plus doux qu'un gros plan)
function PlayerFace({src,name,size=46,team=null}){
  const[err,setErr]=useState(false);
  const ini=(name||"").split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase();
  const tc=getTeamColor(team);
  const bg=tc?`radial-gradient(circle at 50% 35%, ${tc.p}55 0%, ${tc.p}22 60%, #262B35 100%)`:"radial-gradient(circle at 50% 35%, #353B48 0%, #262B35 70%)";
  return(
    <div style={{width:size,height:size,borderRadius:size/2,background:bg,overflow:"hidden",flexShrink:0,position:"relative",
      display:"flex",alignItems:"center",justifyContent:"center",color:"#C4C9D4",fontSize:Math.round(size*.3),fontWeight:600,
      boxShadow:"inset 0 0 0 1px rgba(255,255,255,.06)"}}>
      {src&&!err
        ?<img src={src} alt={name||""} loading="lazy" onError={()=>setErr(true)}
            style={{position:"absolute",left:"50%",bottom:0,transform:"translateX(-50%)",height:"96%",width:"auto",maxWidth:"none"}}/>
        :ini}
    </div>
  );
}

// Carte liste (Ligues, Marchés…) avec chevron
function ListCard({rows,chevron=false,onRow}){
  return(
    <div style={{background:C.card,border:"1px solid "+C.line,borderRadius:16}}>
      {rows.map((r,i)=>(
        <div key={r.key} onClick={onRow?()=>onRow(r):undefined} style={{display:"flex",alignItems:"center",gap:12,minHeight:62,padding:"8px 14px",
          borderBottom:i<rows.length-1?"1px solid "+C.line:"none",cursor:onRow?"pointer":"default"}}>
          {r.logo!==undefined&&<MiniLogo src={r.logo} label={r.name} size={32} round={false}/>}
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:16,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.name}</div>
            <div style={{fontSize:13,color:C.sub,marginTop:1}}>{r.meta}</div>
          </div>
          <span style={{fontSize:16,fontWeight:500,color:pColor(r.profit)}}>{money(r.profit)}</span>
          {chevron&&<span style={{display:"flex",marginLeft:2}}>{Ico.chevron}</span>}
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
    if(!g[k])g[k]={won:0,lost:0,void:0,count:0,profit:0,staked:0,oddsSum:0};
    g[k].profit+=parseFloat(b.profit||0);g[k].count++;
    g[k].oddsSum+=parseFloat(b.odds||0);
    if(b.status==="won"||b.status==="lost")g[k].staked+=parseFloat(b.stake||0);
    if(b.status==="won")g[k].won++;
    if(b.status==="lost")g[k].lost++;
    if(b.status==="void")g[k].void++;
  });
  return g;
}

// ── GRAPHIQUE BANKROLL (général, depuis le début) ────────────────────────────
function BankrollChart({bets,height=170,fmt=money}){
  const[hover,setHover]=useState(null);
  const ref=useRef(null);
  const W=340,H=height,PAD={top:14,right:6,bottom:6,left:6};
  const inner={w:W-PAD.left-PAD.right,h:H-PAD.top-PAD.bottom};
  const settled=[...bets]
    .filter(b=>(b.status==="won"||b.status==="lost")&&b.created_at)
    .sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  if(settled.length<2)return(
    <div style={{height:H,display:"flex",alignItems:"center",justifyContent:"center",color:C.sub,fontSize:13}}>
      La courbe apparaîtra après 2 paris réglés
    </div>
  );
  let cum=0;
  const pts=[{t:new Date(settled[0].created_at).getTime()-1,v:0,bet:null},...settled.map(b=>{
    cum+=parseFloat(b.profit||0);return{t:new Date(b.created_at).getTime(),v:cum,bet:b};
  })];
  const minV=Math.min(0,...pts.map(p=>p.v)),maxV=Math.max(0,...pts.map(p=>p.v));
  const rangeV=maxV-minV||1;
  const sy=v=>PAD.top+inner.h-((v-minV)/rangeV)*inner.h;
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
  const col=pts[pts.length-1].v>=0?C.green:C.red;
  const fmtD=t=>new Date(t).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}).replace(".","");

  function onMove(e){
    const r=ref.current.getBoundingClientRect();
    const x=((e.touches?e.touches[0].clientX:e.clientX)-r.left)/r.width*W;
    let i=Math.round((x-PAD.left)/inner.w*(pts.length-1));
    i=Math.max(1,Math.min(pts.length-1,i));
    setHover(i);
  }
  const h=hover!=null?pts[hover]:null;
  const hp=hover!=null?P[hover]:null;
  const hb=h?.bet;
  const tipLeft=hp?Math.max(0,Math.min(100,(hp[0]/W)*100)):0;

  const idx=[1,Math.round(pts.length/2),pts.length-1].filter((v,i,a)=>a.indexOf(v)===i);
  const labels=idx.map(i=>fmtD(pts[i].t)).filter((l,i,a)=>a.indexOf(l)===i);

  return(
    <div style={{position:"relative",touchAction:"pan-y"}}>
      {h&&(
        <div style={{position:"absolute",top:-6,left:tipLeft+"%",transform:`translateX(${tipLeft>60?"-100%":tipLeft<40?"0":"-50%"})`,
          zIndex:2,pointerEvents:"none",background:"rgba(14,16,20,.92)",border:"1px solid "+C.line,borderRadius:10,
          padding:"7px 10px",whiteSpace:"nowrap",boxShadow:"0 8px 24px rgba(0,0,0,.4)",backdropFilter:"blur(8px)"}}>
          <div style={{fontSize:15,fontWeight:700,color:pColor(h.v)}}>{fmt(h.v)}</div>
          <div style={{fontSize:11,color:C.sub,marginTop:1}}>
            {fmtD(h.t)}{hb?" · "+formatName(hb.player).split(" ").slice(-1)[0]+" "+(hb.status==="won"?"✓":"✗"):""}
          </div>
        </div>
      )}
      <svg ref={ref} width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:"block",overflow:"visible",cursor:"crosshair"}}
        onMouseMove={onMove} onMouseLeave={()=>setHover(null)} onTouchStart={onMove} onTouchMove={onMove} onTouchEnd={()=>setHover(null)}>
        <defs>
          <linearGradient id="bkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={col} stopOpacity=".28"/><stop offset="100%" stopColor={col} stopOpacity="0"/>
          </linearGradient>
          <filter id="bkGlow" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
        </defs>
        {[0,.5,1].map(f=>(
          <line key={f} x1={PAD.left} x2={W-PAD.right} y1={PAD.top+inner.h*f} y2={PAD.top+inner.h*f} stroke="rgba(255,255,255,.05)"/>
        ))}
        {minV<0&&maxV>0&&<line x1={PAD.left} x2={W-PAD.right} y1={sy(0)} y2={sy(0)} stroke="rgba(255,255,255,.18)" strokeDasharray="2 4"/>}
        <path d={area} fill="url(#bkFill)" className="draw-fade"/>
        <path d={d} fill="none" stroke={col} strokeWidth="5" opacity=".35" filter="url(#bkGlow)"/>
        <path d={d} fill="none" stroke={col} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" pathLength="1" className="draw-line"/>
        {hp?(
          <>
            <line x1={hp[0]} x2={hp[0]} y1={PAD.top} y2={PAD.top+inner.h} stroke="rgba(255,255,255,.25)" strokeDasharray="3 3"/>
            <circle cx={hp[0]} cy={hp[1]} r="5" fill={col} stroke="#fff" strokeWidth="2"/>
          </>
        ):(
          <circle cx={P[P.length-1][0]} cy={P[P.length-1][1]} r="4" fill={col} stroke={C.card} strokeWidth="2" className="pulse-dot"/>
        )}
      </svg>
      <div style={{display:"flex",justifyContent:labels.length===1?"center":"space-between",padding:"6px 4px 0",fontSize:11,color:C.dim}}>
        {labels.map(l=><span key={l}>{l}</span>)}
      </div>
    </div>
  );
}

function BulkEditSheet({count,bookmakers,tipsters,leagues,onClose,onApply}){
  const[status,setStatus]=useState("");
  const[game,setGame]=useState("");
  const[tipster,setTipster]=useState("");
  const[bookmaker,setBookmaker]=useState("");
  const[date,setDate]=useState("");
  const[annonce,setAnnonce]=useState("");
  const[saving,setSaving]=useState(false);
  const ch={};
  if(status)ch.status=status;
  if(game)ch.game=game;
  if(tipster)ch.tipster=tipster==="__none__"?null:tipster;
  if(bookmaker)ch.bookmaker=bookmaker;
  if(date)ch.created_at=new Date(date).toISOString();
  if(annonce)ch.annonce=annonce==="yes";
  if(annonce==="no"){ch.annonce_note=null;ch.annonce_player=null;ch.annonce_side=null;ch.annonce_status=null;ch.annonce_role=null;}
  const n=[status,game,tipster,bookmaker,date,annonce].filter(Boolean).length;
  const Section=({icon,title,value,onReset,children})=>(
    <div style={{padding:"14px 0",borderTop:"1px solid "+C.line}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <span style={{width:28,height:28,borderRadius:8,background:value?"rgba(91,157,255,.16)":C.chip,color:value?"#8BB8FF":C.sub,
          display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{icon}</span>
        <span style={{flex:1,fontSize:15,fontWeight:600,color:value?C.text:"#C4C9D4"}}>{title}</span>
        {value?<button type="button" onClick={onReset} style={{border:"none",background:"transparent",color:C.blue,fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
          :<span style={{fontSize:12,color:C.dim}}>inchangé</span>}
      </div>
      {children}
    </div>
  );
  const chip=(on,label,onClick,extra={},logo)=>(
    <button type="button" className={"pick-chip"+(on?" on":"")} onClick={onClick} style={extra}>
      {logo!==undefined&&<MiniLogo src={logo} label={label} size={18} round={false}/>}{label}
    </button>
  );
  const I={
    status:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
    league:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/></svg>,
    user:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>,
    book:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/></svg>,
    ann:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6"/></svg>,
    date:<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>,
  };
  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal-sheet" style={{display:"flex",flexDirection:"column",maxHeight:"90vh",padding:"12px 20px calc(18px + env(safe-area-inset-bottom))"}}>
        <div className="modal-handle"/>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22,fontWeight:700,letterSpacing:-.4}}>Modifier</span>
          <span style={{padding:"3px 10px",borderRadius:12,background:"rgba(91,157,255,.16)",color:"#8BB8FF",fontSize:14,fontWeight:700}}>
            {count} pari{count>1?"s":""}
          </span>
          <span style={{flex:1}}/>
          <button type="button" aria-label="Fermer" onClick={onClose} className="press"
            style={{width:32,height:32,borderRadius:16,border:"none",background:C.chip,color:C.sub,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div style={{fontSize:14,color:C.sub,margin:"6px 0 8px"}}>Touche ce que tu veux changer, le reste ne bouge pas.</div>

        <div style={{overflowY:"auto",flex:1,margin:"0 -20px",padding:"0 20px"}}>
          <Section icon={I.status} title="Statut" value={status} onReset={()=>setStatus("")}>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8}}>
              {[["won","Gagné",C.green],["lost","Perdu",C.red],["pending","En cours",C.blue],["void","Void",C.sub]].map(([k,l,col])=>{
                const on=status===k;
                return(
                  <button key={k} type="button" className="press" onClick={()=>setStatus(on?"":k)}
                    style={{height:44,borderRadius:12,cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:600,
                      border:"1px solid "+(on?col:C.line),background:on?col+"22":C.card,color:on?col:"#C4C9D4"}}>{l}</button>
                );
              })}
            </div>
          </Section>
          <Section icon={I.league} title="Ligue" value={game} onReset={()=>setGame("")}>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {leagues.map(l=>chip(game===l.name,l.name,()=>setGame(game===l.name?"":l.name),{},l.logo||getLeagueLogo(l.name)||null))}
            </div>
          </Section>
          <Section icon={I.user} title="Tipster" value={tipster} onReset={()=>setTipster("")}>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {tipsters.map(tp=>chip(tipster===tp.name,tp.name,()=>setTipster(tipster===tp.name?"":tp.name)))}
              {chip(tipster==="__none__","Aucun",()=>setTipster(tipster==="__none__"?"":"__none__"))}
            </div>
          </Section>
          <Section icon={I.book} title="Bookmaker" value={bookmaker} onReset={()=>setBookmaker("")}>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {bookmakers.filter(bk=>!bk.hidden).map(bk=>(
                <button key={bk.name} type="button" aria-label={bk.name} title={bk.name}
                  className={"pick-chip logo"+(bookmaker===bk.name?" on":"")} onClick={()=>setBookmaker(bookmaker===bk.name?"":bk.name)}>
                  <MiniLogo src={bk.logo} label={bk.name} size={26} round={false}/>
                </button>
              ))}
            </div>
          </Section>
          <Section icon={I.ann} title="Annonce" value={annonce} onReset={()=>setAnnonce("")}>
            <div style={{display:"flex",gap:8}}>
              {chip(annonce==="yes","Pari sur annonce",()=>setAnnonce(annonce==="yes"?"":"yes"),annonce==="yes"?{borderColor:"#F59E0B",background:"rgba(245,158,11,.14)",color:"#FBBF24"}:{})}
              {chip(annonce==="no","Pas d'annonce",()=>setAnnonce(annonce==="no"?"":"no"))}
            </div>
          </Section>
          <Section icon={I.date} title="Date" value={date} onReset={()=>setDate("")}>
            <input type="datetime-local" className="form-input" value={date} onChange={e=>setDate(e.target.value)} style={{colorScheme:"dark"}}/>
          </Section>
        </div>

        <button type="button" className="press" disabled={!n||saving}
          onClick={async()=>{setSaving(true);try{await onApply(ch);}catch(e){alert("Erreur: "+e.message);setSaving(false);}}}
          style={{width:"100%",marginTop:12,height:54,borderRadius:16,border:"none",cursor:n?"pointer":"default",
            background:n?C.blue:"#262B35",color:n?"#0C1424":C.dim,fontSize:17,fontWeight:600,fontFamily:"inherit",
            boxShadow:n?"0 8px 24px rgba(91,157,255,.3)":"none"}}>
          {saving?"Enregistrement…":n?"Appliquer "+n+" changement"+(n>1?"s":"")+" · "+count+" pari"+(count>1?"s":""):"Choisis au moins un changement"}
        </button>
      </div>
    </div>
  );
}

function Switch({on,onChange,label}){
  return(
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={()=>onChange(!on)}
      style={{width:50,height:30,borderRadius:15,border:"none",padding:3,cursor:"pointer",flexShrink:0,
        background:on?"#F59E0B":"#3A404C",transition:"background .2s",display:"flex",justifyContent:on?"flex-end":"flex-start"}}>
      <span style={{width:24,height:24,borderRadius:12,background:"#fff",boxShadow:"0 1px 3px rgba(0,0,0,.3)",transition:"all .2s"}}/>
    </button>
  );
}
function AnnonceBadge({note,small}){
  return(
    <span title={note?"Annonce : "+note:"Pari sur annonce"} style={{display:"inline-flex",alignItems:"center",gap:4,flexShrink:0,
      padding:small?"1px 6px":"3px 9px",borderRadius:8,fontSize:small?11:12,fontWeight:700,
      background:"rgba(245,158,11,.16)",color:"#FBBF24",whiteSpace:"nowrap"}}>
      <svg width={small?10:12} height={small?10:12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>
      Annonce
    </span>
  );
}

// Regroupe les paris liés (même pari sur plusieurs bookmakers) en une seule entrée
function mergeGroups(list){
  const out=[],byG={};
  list.forEach(b=>{
    if(!b.group_id){out.push(b);return;}
    if(!byG[b.group_id]){byG[b.group_id]=[];out.push({__gid:b.group_id});}
    byG[b.group_id].push(b);
  });
  return out.map(x=>{
    if(!x.__gid)return x;
    const legs=byG[x.__gid];
    if(legs.length===1)return legs[0];
    const stake=legs.reduce((s,b)=>s+parseFloat(b.stake||0),0);
    const profit=legs.reduce((s,b)=>s+parseFloat(b.profit||0),0);
    const odds=stake>0?legs.reduce((s,b)=>s+parseFloat(b.odds||0)*parseFloat(b.stake||0),0)/stake:parseFloat(legs[0].odds||0);
    const sts=[...new Set(legs.map(b=>b.status))];
    return{...legs[0],id:"g:"+x.__gid,_group:legs,stake,profit,odds:Math.round(odds*100)/100,
      status:sts.length===1?sts[0]:(sts.includes("pending")?"pending":legs[0].status)};
  });
}

function CupClubPicker({cup,existing,onClose,onAdd}){
  const[all,setAll]=useState(null);
  const[q,setQ]=useState("");
  const[sel,setSel]=useState({});
  const[busy,setBusy]=useState(false);
  useEffect(()=>{
    fetch(SUPA_URL+"/rest/v1/clubs?select=name,league,logo&order=name.asc&limit=5000",{headers:H})
      .then(r=>r.json()).then(rows=>setAll(Array.isArray(rows)?rows:[])).catch(()=>setAll([]));
  },[]);
  const taken=new Set(existing.map(normTeam));
  const list=(all||[]).filter(c=>c.league!==cup&&!isCup(c.league||"")&&!taken.has(normTeam(c.name))&&
    (!q||normTeam(c.name).includes(normTeam(q))));
  const byLeague={};
  list.forEach(c=>{const k=c.league||"Autre";(byLeague[k]=byLeague[k]||[]);if(!byLeague[k].some(x=>normTeam(x.name)===normTeam(c.name)))byLeague[k].push(c);});
  const chosen=Object.values(sel).filter(Boolean);
  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal-sheet" style={{display:"flex",flexDirection:"column",maxHeight:"88vh",paddingBottom:"calc(16px + env(safe-area-inset-bottom))"}}>
        <div className="modal-handle"/>
        <div className="modal-title" style={{marginBottom:4}}>Clubs de la {cup}</div>
        <div style={{fontSize:14,color:C.sub,marginBottom:12}}>Coche les clubs participants.</div>
        <SSearch value={q} onChange={setQ} placeholder="Rechercher un club…"/>
        <div style={{overflowY:"auto",flex:1,margin:"0 -4px",padding:"0 4px"}}>
          {all===null?<div style={{textAlign:"center",color:C.sub,padding:24}}>Chargement…</div>
          :Object.keys(byLeague).length===0?<div style={{textAlign:"center",color:C.sub,padding:24}}>Aucun club trouvé</div>
          :Object.entries(byLeague).map(([lg,cs])=>(
            <div key={lg} style={{marginBottom:14}}>
              <div style={{fontSize:13,fontWeight:600,color:C.sub,margin:"0 4px 6px"}}>{lg}</div>
              <SGroup>
                {cs.map(c=>{
                  const k=normTeam(c.name);const on=!!sel[k];
                  return(
                    <SRow key={k} onClick={()=>setSel(s=>({...s,[k]:on?null:c}))}
                      logo={<SLogo src={c.logo} name={c.name} size={36}/>}
                      title={c.name}
                      right={<span style={{width:24,height:24,borderRadius:12,marginRight:8,display:"flex",alignItems:"center",justifyContent:"center",
                        border:on?"none":"2px solid #4B5260",background:on?C.blue:"transparent"}}>
                        {on&&<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0C1424" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10"/></svg>}
                      </span>}/>
                  );
                })}
              </SGroup>
            </div>
          ))}
        </div>
        <button type="button" className="press" disabled={!chosen.length||busy}
          onClick={async()=>{setBusy(true);await onAdd(chosen);setBusy(false);}}
          style={{width:"100%",marginTop:12,height:52,borderRadius:16,border:"none",fontSize:16,fontWeight:600,fontFamily:"inherit",
            cursor:chosen.length?"pointer":"default",background:chosen.length?C.blue:"#262B35",color:chosen.length?"#0C1424":C.dim}}>
          {busy?"Ajout…":chosen.length?"Ajouter "+chosen.length+" club"+(chosen.length>1?"s":""):"Choisis des clubs"}
        </button>
      </div>
    </div>
  );
}

function EmptyState({title,sub,action}){
  return(
    <div className="fade-in" style={{marginTop:24,padding:"36px 24px",textAlign:"center",borderRadius:22,
      background:"radial-gradient(80% 60% at 50% 0%, rgba(91,157,255,.12) 0%, rgba(91,157,255,0) 70%), #1A1D23",
      border:"1px solid rgba(255,255,255,.06)"}}>
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" style={{marginBottom:14}}>
        <rect x="14" y="8" width="36" height="48" rx="8" fill="#262B35" stroke="#3A404C"/>
        <path d="M22 22h20M22 30h14M22 38h18" stroke="#5B9DFF" strokeWidth="3" strokeLinecap="round" opacity=".8"/>
        <circle cx="48" cy="48" r="11" fill="#5B9DFF"/><path d="M48 43v10M43 48h10" stroke="#0C1424" strokeWidth="2.6" strokeLinecap="round"/>
      </svg>
      <div style={{fontSize:18,fontWeight:600,color:C.text}}>{title}</div>
      <div style={{fontSize:14,color:C.sub,marginTop:6,lineHeight:1.45}}>{sub}</div>
      {action&&<button type="button" className="press" onClick={action.onClick}
        style={{marginTop:18,height:46,padding:"0 22px",borderRadius:14,border:"none",background:C.blue,color:"#0C1424",
          fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{action.label}</button>}
    </div>
  );
}

// Nombre qui "compte" jusqu'à sa valeur
function CountUp({value,format,duration=900}){
  const[v,setV]=useState(0);
  useEffect(()=>{
    let raf,start=null;
    const from=0,to=value;
    const step=ts=>{
      if(start===null)start=ts;
      const k=Math.min(1,(ts-start)/duration);
      const e=1-Math.pow(1-k,3);
      setV(from+(to-from)*e);
      if(k<1)raf=requestAnimationFrame(step);
    };
    raf=requestAnimationFrame(step);
    return()=>cancelAnimationFrame(raf);
  },[value,duration]);
  return <>{format(v)}</>;
}

// ── VUE ACCUEIL (Bankroll) ────────────────────────────────────────────────────
function HomeView({bets:rawBets,players,onNavigate,onAdd}){
  const bets=mergeGroups(rawBets);
  const now=new Date();
  const[cal,setCal]=useState({y:now.getFullYear(),m:now.getMonth()});
  const[calOpen,setCalOpen]=useState(false);
  const[period,setPeriod]=useState("all");
  const[pOff,setPOff]=useState(0);
  const[units,setUnits]=useState(false);
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

  if(bets.length===0)return(
    <div style={{padding:"0 20px 8px"}}>
      <EmptyState title="Bienvenue" sub="Ajoute ton premier pari : ta courbe de bankroll, ton calendrier et tes stats apparaîtront ici."
        action={onAdd?{label:"Ajouter mon premier pari",onClick:onAdd}:null}/>
    </div>
  );

  return(
    <div style={{padding:"0 20px 8px"}}>

      {(()=>{
        // ── période
        const nowD=new Date();
        let start=null,end=null,title="Depuis le début";
        if(period==="week"){
          const d=new Date(nowD.getFullYear(),nowD.getMonth(),nowD.getDate());
          d.setDate(d.getDate()-((d.getDay()+6)%7)+pOff*7);
          start=d;end=new Date(d);end.setDate(end.getDate()+7);
          const last=new Date(end);last.setDate(last.getDate()-1);
          const f=x=>x.toLocaleDateString("fr-FR",{day:"numeric",month:"short"}).replace(".","");
          title=f(start)+" – "+f(last);
        }else if(period==="month"){
          start=new Date(nowD.getFullYear(),nowD.getMonth()+pOff,1);end=new Date(start.getFullYear(),start.getMonth()+1,1);
          const l=start.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});title=l.charAt(0).toUpperCase()+l.slice(1);
        }else if(period==="year"){
          start=new Date(nowD.getFullYear()+pOff,0,1);end=new Date(start.getFullYear()+1,0,1);title=String(start.getFullYear());
        }
        const inP=b=>!start||(b.created_at&&new Date(b.created_at)>=start&&new Date(b.created_at)<end);
        const pb=bets.filter(inP);
        const ps=pb.filter(b=>b.status==="won"||b.status==="lost");
        const pw=ps.filter(b=>b.status==="won").length,pl=ps.length-pw,pv=pb.filter(b=>b.status==="void").length;
        const pp=pb.reduce((s,b)=>s+parseFloat(b.profit||0),0);
        const pst=ps.reduce((s,b)=>s+parseFloat(b.stake||0),0);
        const proi=pst>0?pp/pst*100:0;
        const UNIT=START_BANKROLL/100;
        const fmt=v=>units?(v>0?"+":v<0?"−":"")+(Math.abs(v)/UNIT).toFixed(2).replace(".",",")+"u":money(v);
        const sorted=[...settled].sort((x,y)=>new Date(y.created_at||0)-new Date(x.created_at||0));
        let streak=0;const kind=sorted[0]?.status;
        for(const s of sorted){if(s.status===kind)streak++;else break;}
        return(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",marginTop:2}}>
              <div><div style={{fontSize:13,color:C.sub}}>Profit</div>
                <div style={{fontSize:19,fontWeight:600,color:pColor(pp),marginTop:3}}><CountUp key={period+pOff+units} value={pp} format={fmt}/></div></div>
              <div style={{textAlign:"center"}}><div style={{fontSize:13,color:C.sub}}>Progression</div>
                <div style={{fontSize:19,fontWeight:600,color:pColor(pp),marginTop:3}}>{(pp>0?"+":"")+(pp/START_BANKROLL*100).toFixed(2).replace(".",",")+"\u00a0%"}</div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:13,color:C.sub}}>Bilan</div>
                <div style={{fontSize:19,fontWeight:600,marginTop:3}}>{pw}-{pl}-{pv}</div></div>
            </div>

            <div style={{marginTop:14,borderRadius:16,padding:"14px 10px 8px",background:"#181B21",border:"1px solid "+C.line,position:"relative"}}>
              <span style={{position:"absolute",right:14,top:10,fontSize:12,color:C.sub,zIndex:1}}>{fmt(pp)}</span>
              <BankrollChart key={period+pOff} bets={pb} height={160} fmt={fmt}/>
            </div>
          </div>
        );
      })()}

      <div style={{marginTop:14,background:C.card,border:"1px solid "+C.line,borderRadius:18,overflow:"hidden"}}>
      <div role="button" tabIndex={0} aria-expanded={calOpen} onClick={()=>setCalOpen(o=>!o)} onKeyDown={e=>e.key==="Enter"&&setCalOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",cursor:"pointer"}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="1.9" strokeLinecap="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>
        <span style={{flex:1,fontSize:16,fontWeight:600}}>Calendrier</span>
        {calOpen&&<span onClick={e=>e.stopPropagation()} style={{display:"flex",alignItems:"center"}}>
          <button aria-label="Mois précédent" onClick={()=>shift(-1)} style={{...navArrow,width:28}}>‹</button>
          <span style={{fontSize:13,color:C.sub,textTransform:"capitalize",minWidth:92,textAlign:"center"}}>{monthLabel}</span>
          <button aria-label="Mois suivant" onClick={()=>shift(1)} style={{...navArrow,width:28}}>›</button>
        </span>}
        <svg width="14" height="9" viewBox="0 0 14 9" fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round"
          style={{transition:"transform .2s",transform:calOpen?"rotate(180deg)":"none"}}><path d="M1 1.5l6 6 6-6"/></svg>
      </div>
      {calOpen&&<div className="fade-in" style={{padding:"0 12px 12px"}}>
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
              {has&&<span style={{fontSize:11,fontWeight:600,color:fg}}>{v===0?"–":(v>0?"+":"−")+Math.abs(v).toFixed(0)+"\u00a0€"}</span>}
            </div>
          );
        })}
      </div>
      </div>}
      </div>

      {leagueRows.length>0&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",margin:"22px 2px 10px"}}>
          <span style={{fontSize:18,fontWeight:600,letterSpacing:-.3}}>Ligues</span>
          <button onClick={()=>onNavigate("stats")} style={linkBtn}>Tout voir</button>
        </div>
        <ListCard rows={leagueRows} chevron onRow={()=>onNavigate("stats")}/>
      </>}
    </div>
  );
}
const navArrow={width:32,height:32,border:"none",background:"transparent",color:C.blue,fontSize:20,cursor:"pointer"};
const linkBtn={border:"none",background:"transparent",color:C.blue,fontSize:15,cursor:"pointer",fontFamily:"inherit"};

// ── TICKET DE PARI ────────────────────────────────────────────────────────────
function BetSlip({b,players,bkPhotos,onClick,selectMode=false,selected=false}){
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
  if(b.status==="won"){result=money(profit);resultCol=C.green;outLabel="Retour";out=eur(stake+profit);}
  else if(b.status==="lost"){result=money(profit);resultCol=C.red;outLabel="Retour";out=eur(0);}
  else if(b.status==="void"){result="Void";resultCol=C.sub;outLabel="Retour";out=eur(stake);}
  else{result="→ "+eur(stake*odds);resultCol=C.blue;outLabel="Gain potentiel";out=eur(stake*odds);}
  const name=isTeam?(b.team||b.player):formatName(b.player);
  const parts=name.split(" ").filter(Boolean);
  const lastName=isTeam||parts.length<2?name:parts[0][0]+"."+parts.slice(1).join(" ");
  return(
    <article onClick={onClick} aria-selected={selectMode?selected:undefined} style={{background:selected?"linear-gradient(180deg,#1E2A3E 0%,#1B2335 100%)":"linear-gradient(180deg,#1F232B 0%,#1B1E25 100%)",boxShadow:selected?"0 0 0 2px #5B9DFF":"inset 0 1px 0 rgba(255,255,255,.04)",border:"1px solid "+(selected?"#5B9DFF":border),borderRadius:14,
      padding:"14px 14px",display:"flex",alignItems:"center",gap:14,cursor:"pointer"}}>
      {selectMode&&(
        <span style={{width:24,height:24,borderRadius:12,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
          border:selected?"none":"2px solid #4B5260",background:selected?C.blue:"transparent",transition:"all .15s"}}>
          {selected&&<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0C1424" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10"/></svg>}
        </span>
      )}
      <div style={{position:"relative",flexShrink:0}}>
        {b.game&&(
          <span style={{position:"absolute",left:-3,bottom:-3,width:22,height:22,borderRadius:11,background:C.card,zIndex:1,
            border:"1.5px solid "+C.card,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <MiniLogo src={leagueLogo} label={b.game} size={16} round={false}/>
          </span>
        )}
        <PlayerFace src={photo} name={name} team={isTeam?null:teamName} size={54}/>
        {teamName&&!isTeam&&(
          <span style={{position:"absolute",right:-3,bottom:-3,width:22,height:22,borderRadius:11,background:C.card,
            border:"1.5px solid "+C.card,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <MiniLogo src={clubLogo} label={teamName} size={18}/>
          </span>
        )}
      </div>
      <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:4}}>
        <div style={{display:"flex",alignItems:"center",gap:10,height:22}}>
          <span style={{flex:1,minWidth:0,fontSize:15,fontWeight:600,lineHeight:"20px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
            {lastName} · {b.bet_type==="team"?b.description:descShort(b.description)}
          </span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10,height:22}}>
          <span style={{flex:1,minWidth:0,display:"flex",alignItems:"center",gap:7,fontSize:13,lineHeight:"20px",color:"#C4C9D4",overflow:"hidden"}}>
            {[
              b.annonce&&<AnnonceBadge key="a" small note={b.annonce_player?formatName(b.annonce_player):b.annonce_note}/>,
              <span key="o" style={{whiteSpace:"nowrap",color:"#DDE1E8"}}>@{String(b.odds).replace(".",",")}</span>,
              <span key="m" style={{whiteSpace:"nowrap",color:"#DDE1E8"}}>{eur(stake,0)}</span>,
              b.tipster&&<span key="t" style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:"#DDE1E8"}}>{b.tipster}</span>,
            ].filter(Boolean).map((el,i)=>i===0?el:(<React.Fragment key={"g"+i}><span style={{width:4,height:4,borderRadius:2,background:"#9AA1AE",flexShrink:0}}/>{el}</React.Fragment>))}
          </span>
        </div>
      </div>
      <span style={{flexShrink:0,alignSelf:"center",fontSize:16,fontWeight:700,color:resultCol,whiteSpace:"nowrap"}}>{result}</span>
    </article>
  );
}

// ── VUE MES PARIS ─────────────────────────────────────────────────────────────
function BetsView({bets,players,bookmakers=[],bkPhotos={},tipsters=[],leagues=[],onSelectBet,onEdit,onAdd,onRefresh,showToast}){
  const[selectMode,setSelectMode]=useState(false);
  const[sel,setSel]=useState({});
  const[bulkOpen,setBulkOpen]=useState(false);
  const selIds=Object.keys(sel).filter(k=>sel[k]);
  const toggleSel=id=>setSel(s=>({...s,[id]:!s[id]}));
  const exitSelect=()=>{setSelectMode(false);setSel({});};
  const slipClick=b=>selectMode?toggleSel(b.id):onSelectBet(b);
  const[filter,setFilter]=useState("all");
  const[bkSel,setBkSel]=useState({});
  const[openMonths,setOpenMonths]=useState({});
  const[search,setSearch]=useState("");
  const bkActive=Object.keys(bkSel).filter(k=>bkSel[k]);
  const[flt,setFlt]=useState({leagues:{},tipsters:{},annonce:{},roles:{},status:{}});
  const[fltOpen,setFltOpen]=useState(false);
  const on=o=>Object.keys(o).filter(k=>o[k]);
  const roleOf=b=>{const p=players.find(x=>x.name===b.player);return roleCode(p?.role)||"?";};
  const fltCount=on(flt.leagues).length+on(flt.tipsters).length+on(flt.annonce).length+on(flt.roles).length+on(flt.status).length+bkActive.length;
  const legOk=b=>{
    if(bkActive.length&&!bkActive.includes(b.bookmaker))return false;
    const L=on(flt.leagues);if(L.length&&!L.includes(b.game))return false;
    const T=on(flt.tipsters);if(T.length&&!T.includes(b.tipster||"__none__"))return false;
    const A=on(flt.annonce);if(A.length&&!A.includes(b.annonce?"yes":"no"))return false;
    const R=on(flt.roles);if(R.length&&(b.bet_type==="team"||!R.includes(roleOf(b))))return false;
    const S=on(flt.status);if(S.length&&!S.includes(b.status))return false;
    return true;
  };
  const legsF=fltCount?bets.filter(legOk):bets;
  // filtre au niveau de chaque site, puis regroupement : seuls les montants retenus comptent
  const filtered=mergeGroups(legsF).filter(b=>{
    if(search){
      const q=search.toLowerCase();
      if(!(b.player||"").toLowerCase().includes(q)&&!(b.description||"").toLowerCase().includes(q)&&
         !(b.tipster||"").toLowerCase().includes(q)&&!(b.annonce_player||b.annonce_note||"").toLowerCase().includes(q))return false;
    }
    return true;
  });
  const months=[];
  const idx={};
  const pendingList=filtered.filter(b=>b.status==="pending")
    .sort((x,y)=>new Date(y.created_at||0)-new Date(x.created_at||0));
  filtered.filter(b=>b.status!=="pending").forEach(b=>{
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
      <div style={{display:"flex",gap:8,alignItems:"center"}}>
      <div style={{position:"relative",flex:1}}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="2" strokeLinecap="round"
          style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)"}}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
        <input placeholder="Rechercher un joueur, un tipster…" value={search} onChange={e=>setSearch(e.target.value)}
          style={{width:"100%",height:42,padding:"0 14px 0 38px",background:C.card,border:"1px solid "+C.line,
            borderRadius:12,color:C.text,fontSize:15,outline:"none"}}/>
      </div>
      <button type="button" className="press" aria-label="Filtres" onClick={()=>setFltOpen(true)}
        style={{position:"relative",width:42,height:42,borderRadius:12,border:"1px solid "+(fltCount?C.blue:C.line),cursor:"pointer",flexShrink:0,
          background:fltCount?"rgba(91,157,255,.14)":C.card,color:fltCount?"#8BB8FF":C.text,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M7 12h10M10 18h4"/></svg>
        {fltCount>0&&<span style={{position:"absolute",top:-5,right:-5,minWidth:18,height:18,padding:"0 5px",borderRadius:9,background:C.blue,
          color:"#0C1424",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{fltCount}</span>}
      </button>
      <button type="button" className="press" onClick={()=>selectMode?exitSelect():setSelectMode(true)}
        style={{height:42,padding:"0 14px",borderRadius:12,border:"1px solid "+(selectMode?C.blue:C.line),cursor:"pointer",
          background:selectMode?"rgba(91,157,255,.14)":C.card,color:selectMode?"#8BB8FF":C.text,fontSize:14,fontWeight:600,fontFamily:"inherit",flexShrink:0}}>
        {selectMode?"Annuler":"Sélectionner"}
      </button>
      </div>
      {selectMode&&(
        <div className="fade-in" style={{display:"flex",justifyContent:"space-between",alignItems:"center",margin:"10px 4px 0",fontSize:14}}>
          <span style={{color:C.sub}}>Touche les paris à modifier</span>
          <button type="button" onClick={()=>{
              const all=selIds.length===filtered.length;
              setSel(all?{}:Object.fromEntries(filtered.map(b=>[b.id,true])));
            }}
            style={{border:"none",background:"transparent",color:C.blue,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            {selIds.length===filtered.length&&filtered.length>0?"Tout désélectionner":"Tout sélectionner"}
          </button>
        </div>
      )}

      {filtered.length===0?(
        <EmptyState
          title={search?"Aucun résultat":"Aucun pari pour l'instant"}
          sub={search?"Essaie un autre nom ou un autre tipster":"Ajoute ton premier pari pour suivre ta bankroll"}
          action={!search&&onAdd?{label:"Ajouter un pari",onClick:onAdd}:null}/>
      ):<>
      {pendingList.length>0&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",margin:"20px 4px 8px"}}>
            <span style={{display:"flex",alignItems:"center",gap:8,fontSize:14,fontWeight:600,color:C.text}}>
              <span style={{width:7,height:7,borderRadius:4,background:C.blue}}/>En cours · {pendingList.length}
            </span>
            <span style={{fontSize:14,fontWeight:600,color:C.blue}}>
              → {eur(pendingList.reduce((s,x)=>s+parseFloat(x.stake||0)*parseFloat(x.odds||0),0))}
            </span>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {pendingList.map(b=><BetSlip key={b.id} b={b} players={players} bkPhotos={bkPhotos} onClick={()=>slipClick(b)} selectMode={selectMode} selected={!!sel[b.id]}/>)}
          </div>
        </div>
      )}
      {months.map((m,mi)=>{
        const w=m.bets.filter(x=>x.status==="won").length;
        const l=m.bets.filter(x=>x.status==="lost").length;
        const v=m.bets.filter(x=>x.status==="void").length;
        const p=m.bets.reduce((s,x)=>s+parseFloat(x.profit||0),0);
        const st=m.bets.filter(x=>x.status==="won"||x.status==="lost").reduce((s,x)=>s+parseFloat(x.stake||0),0);
        const allSt=m.bets.reduce((s,x)=>s+parseFloat(x.stake||0),0);
        const roi=st>0?p/st*100:0;
        const isOpen=openMonths[m.key]??(mi===0);
        return(
          <div key={m.key}>
            <button type="button" aria-expanded={isOpen} onClick={()=>setOpenMonths(o=>({...o,[m.key]:!isOpen}))}
              style={{width:"100%",marginTop:16,background:"linear-gradient(180deg,#20242C 0%,#1B1E25 100%)",border:"1px solid "+C.line,borderRadius:18,padding:"20px 18px",
                boxShadow:"inset 0 1px 0 rgba(255,255,255,.05)",
                display:"flex",alignItems:"center",gap:12,cursor:"pointer",color:C.text,textAlign:"left",fontFamily:"inherit"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:21,fontWeight:700,letterSpacing:-.4}}>{m.label}</div>
                <div style={{fontSize:14,color:"#AEB4C0",marginTop:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  {m.bets.length} paris · {w}-{l}-{v} · <span style={{color:pColor(roi)}}>{(roi>0?"+":"")+roi.toFixed(1).replace(".",",")+"\u00a0%"}</span> · {eur(allSt,0)}
                </div>
              </div>
              <span style={{fontSize:21,fontWeight:700,color:pColor(p),flexShrink:0}}>{money(p)}</span>
              <svg width="14" height="9" viewBox="0 0 14 9" fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round"
                style={{flexShrink:0,transition:"transform .2s",transform:isOpen?"rotate(180deg)":"none"}}><path d="M1 1.5l6 6 6-6"/></svg>
            </button>
            {isOpen&&(()=>{
              const sorted=[...m.bets].sort((x,y)=>new Date(y.created_at||0)-new Date(x.created_at||0));
              const days=[];const di={};
              sorted.forEach(b=>{
                const d=b.created_at?new Date(b.created_at):null;
                const k=d?d.toDateString():"?";
                if(di[k]===undefined){
                  di[k]=days.length;
                  const lbl=d?d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}):"Sans date";
                  days.push({k,label:lbl.charAt(0).toUpperCase()+lbl.slice(1),bets:[]});
                }
                days[di[k]].bets.push(b);
              });
              return days.map(d=>{
                const dp=d.bets.reduce((s,x)=>s+parseFloat(x.profit||0),0);
                const settledDay=d.bets.some(x=>x.status==="won"||x.status==="lost");
                return(
                  <div key={d.k} className="fade-in">
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",margin:"18px 4px 8px"}}>
                      <span style={{fontSize:14,fontWeight:600,color:"#C4C9D4"}}>{d.label}</span>
                      {selectMode?(()=>{
                        const allOn=d.bets.every(x=>sel[x.id]);
                        return(
                          <button type="button" onClick={()=>setSel(s=>{const n={...s};d.bets.forEach(x=>{n[x.id]=!allOn;});return n;})}
                            style={{border:"none",background:"transparent",color:C.blue,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0}}>
                            {allOn?"Désélectionner la journée":"Sélectionner la journée"}
                          </button>
                        );
                      })():settledDay&&<span style={{fontSize:14,fontWeight:600,color:pColor(dp)}}>{money(dp)}</span>}
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {d.bets.map(b=><BetSlip key={b.id} b={b} players={players} bkPhotos={bkPhotos} onClick={()=>slipClick(b)} selectMode={selectMode} selected={!!sel[b.id]}/>)}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        );
      })}
      </>}
      {selectMode&&selIds.length>0&&(
        <div style={{position:"fixed",left:"50%",transform:"translateX(-50%)",bottom:"calc(76px + env(safe-area-inset-bottom))",
          width:"calc(100% - 32px)",maxWidth:398,zIndex:150,display:"flex",alignItems:"center",gap:10,padding:"10px 10px 10px 16px",
          borderRadius:18,background:"rgba(30,34,42,.96)",border:"1px solid "+C.line,boxShadow:"0 16px 40px rgba(0,0,0,.5)",backdropFilter:"blur(12px)"}}>
          <span style={{flex:1,fontSize:15,fontWeight:600}}>{selIds.length} pari{selIds.length>1?"s":""} sélectionné{selIds.length>1?"s":""}</span>
          {selIds.length>=2&&(
            <button type="button" className="press" onClick={async()=>{
                const legs=filtered.filter(b=>sel[b.id]).flatMap(b=>b._group||[b]);
                const gid=legs.find(b=>b.group_id)?.group_id||legs[0].id;
                try{
                  await Promise.all(legs.map(b=>updateBet(b.id,{group_id:gid})));
                  exitSelect();onRefresh&&onRefresh();
                  showToast&&showToast("Paris fusionnés ✓");
                }catch(e){alert("Erreur: "+e.message);}
              }}
              style={{height:42,padding:"0 14px",borderRadius:12,border:"1px solid "+C.line,background:"transparent",color:C.text,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              Fusionner
            </button>
          )}
          <button type="button" className="press" onClick={()=>setBulkOpen(true)}
            style={{height:42,padding:"0 18px",borderRadius:12,border:"none",background:C.blue,color:"#0C1424",fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            Modifier
          </button>
        </div>
      )}
      {bulkOpen&&(
        <BulkEditSheet count={selIds.length} bookmakers={bookmakers} tipsters={tipsters} leagues={leagues}
          onClose={()=>setBulkOpen(false)}
          onApply={async ch=>{
            const chosenIds=new Set(filtered.filter(b=>sel[b.id]).flatMap(b=>b._group?b._group.map(x=>x.id):[b.id]));
            const chosen=bets.filter(b=>chosenIds.has(b.id));
            await Promise.all(chosen.map(b=>{
              const up={...ch};
              if(ch.status)up.profit=calcProfit(ch.status,parseFloat(b.stake),parseFloat(b.odds));
              return updateBet(b.id,up);
            }));
            setBulkOpen(false);exitSelect();
            onRefresh&&onRefresh();
            showToast&&showToast(chosen.length+" pari"+(chosen.length>1?"s":"")+" modifié"+(chosen.length>1?"s":"")+" ✓");
          }}/>
      )}
      {fltOpen&&(()=>{
        const tog=(grp,k)=>setFlt(f0=>({...f0,[grp]:{...f0[grp],[k]:!f0[grp][k]}}));
        const games=[...new Set(bets.map(b=>b.game).filter(Boolean))].sort();
        const tips=[...new Set(bets.map(b=>b.tipster).filter(Boolean))].sort();
        const roleOrder=["PG","SG","SF","PF","C","G","F"];
        const roles=[...new Set(bets.filter(b=>b.bet_type!=="team").map(roleOf))].filter(r=>r!=="?").sort((a,b)=>roleOrder.indexOf(a)-roleOrder.indexOf(b));
        const Chips=({grp,items})=>(
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {items.map(([k,label,logo])=>{
              const act=grp==="bk"?!!bkSel[k]:!!flt[grp][k];
              return(
                <button key={k} type="button" className={"pick-chip"+(grp==="bk"?" logo":"")+(act?" on":"")} aria-label={label} title={label}
                  onClick={()=>grp==="bk"?setBkSel(s=>({...s,[k]:!act})):tog(grp,k)}>
                  {logo!==undefined&&<MiniLogo src={logo} label={label} size={grp==="bk"?26:18} round={false}/>}{grp==="bk"?null:label}
                </button>
              );
            })}
          </div>
        );
        const Sec=({title,children})=>(<><div className="pick-head" style={{margin:"16px 2px 8px"}}><span>{title}</span></div>{children}</>);
        return(
          <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setFltOpen(false);}}>
            <div className="modal-sheet" style={{display:"flex",flexDirection:"column",maxHeight:"88vh",paddingBottom:"calc(16px + env(safe-area-inset-bottom))"}}>
              <div className="modal-handle"/>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div className="modal-title" style={{margin:0}}>Filtres</div>
                {fltCount>0&&<button type="button" onClick={()=>{setFlt({leagues:{},tipsters:{},annonce:{},roles:{},status:{}});setBkSel({});}}
                  style={{border:"none",background:"transparent",color:C.blue,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Tout effacer</button>}
              </div>
              <div style={{overflowY:"auto",flex:1,paddingBottom:8}}>
                <Sec title="Résultat"><Chips grp="status" items={[["won","Gagné"],["lost","Perdu"],["pending","En cours"],["void","Void"]]}/></Sec>
                {games.some(g=>!isCup(g))&&<Sec title="Ligues"><Chips grp="leagues" items={games.filter(g=>!isCup(g)).map(g=>[g,g,getLeagueLogo(g)||null])}/></Sec>}
                {games.some(isCup)&&<Sec title="Coupes"><Chips grp="leagues" items={games.filter(isCup).map(g=>[g,g,getLeagueLogo(g)||null])}/></Sec>}
                <Sec title="Tipster"><Chips grp="tipsters" items={[...tips.map(x=>[x,x]),["__none__","Sans tipster"]]}/></Sec>
                <Sec title="Annonce"><Chips grp="annonce" items={[["yes","Sur annonce"],["no","Sans annonce"]]}/></Sec>
                {roles.length>0&&<Sec title="Poste du joueur"><Chips grp="roles" items={roles.map(r=>[r,r])}/></Sec>}
                {bookmakers.filter(bk=>!bk.hidden&&bets.some(b=>b.bookmaker===bk.name)).length>0&&
                  <Sec title="Bookmaker"><Chips grp="bk" items={bookmakers.filter(bk=>!bk.hidden&&bets.some(b=>b.bookmaker===bk.name)).map(bk=>[bk.name,bk.name,bk.logo||null])}/></Sec>}
              </div>
              <button type="button" className="press" onClick={()=>setFltOpen(false)}
                style={{width:"100%",marginTop:10,height:52,borderRadius:16,border:"none",background:C.blue,color:"#0C1424",
                  fontSize:16,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                Voir {mergeGroups(legsF).length} pari{mergeGroups(legsF).length>1?"s":""}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── VUE ANALYSE ───────────────────────────────────────────────────────────────
function StatsView({bets:allRaw,players=[],bkPhotos={}}){
  const[tab,setTab]=useState("overview");
  const[period,setPeriod]=useState("all");
  const cutoff=period==="all"?null:Date.now()-({"7":7,"30":30,"90":90}[period])*864e5;
  const rawBets=cutoff?allRaw.filter(b=>b.created_at&&new Date(b.created_at).getTime()>=cutoff):allRaw;
  const bets=mergeGroups(rawBets);

  const f2=v=>v.toFixed(2).replace(".",",");
  const pct=v=>(v>0?"+":"")+v.toFixed(1).replace(".",",")+" %";
  const stat=s=>{const d=s.won+s.lost;return{wr:d?s.won/d*100:null,roi:s.staked>0?s.profit/s.staked*100:null,avg:s.count?s.oddsSum/s.count:0};};
  const empty={won:0,lost:0,void:0,count:0,profit:0,staked:0,oddsSum:0};
  const total=groupBy(bets,()=>"t").t||empty;
  const T=stat(total);
  const pending=bets.filter(b=>b.status==="pending").length;

  const pOf=b=>players.find(p=>p.name===b.player);
  const playerBets=bets.filter(b=>b.bet_type!=="team");
  const POS_LABEL={PG:"Meneur",SG:"Arrière",SF:"Ailier",PF:"Ailier fort",C:"Pivot",G:"Arrière",F:"Ailier"};
  const clvOf=list=>{
    const xs=list.filter(b=>parseFloat(b.closing_odds)>0&&parseFloat(b.odds)>0).map(b=>(parseFloat(b.odds)/parseFloat(b.closing_odds)-1)*100);
    return{n:xs.length,avg:xs.length?xs.reduce((s,x)=>s+x,0)/xs.length:0};
  };
  const clvAll=clvOf(bets);
  const rowsOf=(g,opt={})=>Object.entries(g).map(([k,s])=>({key:k,name:k,s,logo:opt.logo?opt.logo(k):undefined,sub:opt.sub?opt.sub(k):undefined}))
    .sort(opt.sort||((a,b)=>b.s.profit-a.s.profit));

  // ── UI de base ──
  const Card=({children,style})=>(
    <div style={{background:C.card,border:"1px solid "+C.line,borderRadius:18,...style}}>{children}</div>
  );
  const Title=({children,right})=>(
    <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",margin:"26px 4px 10px"}}>
      <span style={{fontSize:18,fontWeight:700,letterSpacing:-.3}}>{children}</span>
      {right&&<span style={{fontSize:12,color:C.dim}}>{right}</span>}
    </div>
  );
  const Pill=({v})=>v==null?<span style={{color:C.dim}}>–</span>:(
    <span style={{display:"inline-block",minWidth:52,textAlign:"center",padding:"3px 6px",borderRadius:8,fontSize:12.5,fontWeight:600,
      color:v>=0?C.green:C.red,background:v>=0?"rgba(74,222,128,.10)":"rgba(255,138,128,.10)"}}>{(v>0?"+":"")+Math.round(v)+" %"}</span>
  );
  const COLS="minmax(0,1fr) 40px 58px 70px";
  const Table=({rows,limit=6,empty:emp="Rien à afficher"})=>{
    const[all,setAll]=useState(false);
    if(!rows.length)return <Card style={{padding:22,textAlign:"center",color:C.sub,fontSize:14}}>{emp}</Card>;
    const shown=all?rows:rows.slice(0,limit);
    const maxAbs=Math.max(1,...rows.map(r=>Math.abs(r.s.profit)));
    return(
      <Card style={{overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:COLS,gap:6,padding:"10px 14px 8px",fontSize:11,fontWeight:600,color:C.dim,letterSpacing:.3,textTransform:"uppercase"}}>
          <span/><span style={{textAlign:"center"}}>Bilan</span><span style={{textAlign:"center"}}>ROI</span><span style={{textAlign:"right"}}>Profit</span>
        </div>
        {shown.map(r=>{
          const x=stat(r.s);
          return(
            <div key={r.key} style={{display:"grid",gridTemplateColumns:COLS,gap:6,alignItems:"center",padding:"11px 14px",borderTop:"1px solid "+C.line}}>
              <span style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                {r.logo!==undefined&&<MiniLogo src={r.logo} label={r.name} size={26} round={false}/>}
                <span style={{minWidth:0,flex:1}}>
                  <span style={{display:"block",fontSize:15,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.name}</span>
                  <span style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}>
                                      </span>
                </span>
              </span>
              <span style={{textAlign:"center",fontSize:13.5,color:"#C4C9D4",fontVariantNumeric:"tabular-nums"}}>{r.s.won}-{r.s.lost}</span>
              <span style={{textAlign:"center"}}><Pill v={x.roi}/></span>
              <span style={{textAlign:"right",fontSize:15,fontWeight:700,color:pColor(r.s.profit),fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{money(r.s.profit,0)}</span>
            </div>
          );
        })}
        {rows.length>limit&&(
          <button type="button" onClick={()=>setAll(v=>!v)} style={{width:"100%",height:44,border:"none",borderTop:"1px solid "+C.line,
            background:"transparent",color:C.blue,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            {all?"Voir moins":"Voir tout ("+rows.length+")"}
          </button>
        )}
      </Card>
    );
  };
  const Mini=({label,value,color})=>(
    <div style={{flex:1,minWidth:0}}>
      <div style={{fontSize:12,color:C.sub}}>{label}</div>
      <div style={{fontSize:17,fontWeight:700,marginTop:3,color:color||C.text,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{value}</div>
    </div>
  );
  const Hero=({s,title,extra})=>{
    const x=stat(s);const dec=s.won+s.lost||1;
    return(
      <Card style={{padding:18,background:"radial-gradient(120% 90% at 0% 0%,"+(s.profit>=0?"rgba(74,222,128,.10)":"rgba(255,138,128,.10)")+" 0%,rgba(0,0,0,0) 60%),"+C.card}}>
        <div style={{fontSize:13,color:C.sub}}>{title}</div>
        <div style={{display:"flex",alignItems:"baseline",gap:10,marginTop:4}}>
          <span style={{fontSize:34,fontWeight:700,letterSpacing:-1,color:pColor(s.profit),fontVariantNumeric:"tabular-nums"}}>{money(s.profit)}</span>
          {x.roi!=null&&<Pill v={x.roi}/>}
        </div>
        <div style={{display:"flex",height:6,borderRadius:3,overflow:"hidden",background:"#262B35",margin:"16px 0 6px"}}>
          <div style={{width:s.won/dec*100+"%",background:C.green}}/><div style={{width:s.lost/dec*100+"%",background:C.red}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.sub}}>
          <span><b style={{color:C.green}}>{s.won}</b> gagnés</span>
          {s.void>0&&<span>{s.void} void</span>}
          <span><b style={{color:C.red}}>{s.lost}</b> perdus</span>
        </div>
        <div style={{display:"flex",gap:10,marginTop:16,paddingTop:14,borderTop:"1px solid "+C.line}}>
          <Mini label="Réussite" value={x.wr!=null?Math.round(x.wr)+" %":"–"}/>
          <Mini label="Cote moy." value={s.count?f2(x.avg):"–"}/>
          <Mini label="Misé" value={eur(s.staked,0)}/>
          {extra}
        </div>
      </Card>
    );
  };

  const TABS=[["overview","Aperçu"],["tipsters","Tipsters"],["players","Joueurs"],["markets","Marchés"],["annonces","Annonces"]];

  const header=(
    <>
      <div style={{display:"flex",gap:8,overflowX:"auto",margin:"0 -20px",padding:"2px 20px 4px",scrollbarWidth:"none"}}>
        {TABS.map(([k,l])=>(
          <button key={k} type="button" onClick={()=>setTab(k)} className="press"
            style={{flexShrink:0,height:34,padding:"0 13px",borderRadius:17,cursor:"pointer",fontFamily:"inherit",fontSize:13.5,fontWeight:600,
              border:"1px solid "+(tab===k?C.text:C.line),background:tab===k?C.text:"transparent",color:tab===k?C.bg:"#C4C9D4"}}>{l}</button>
        ))}
      </div>
      <div style={{display:"flex",gap:4,marginTop:12,padding:3,background:C.inner,border:"1px solid "+C.line,borderRadius:12}}>
        {[["7","7 j"],["30","30 j"],["90","3 mois"],["all","Tout"]].map(([k,l])=>(
          <button key={k} type="button" onClick={()=>setPeriod(k)}
            style={{flex:1,height:30,borderRadius:9,border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600,
              background:period===k?C.chip:"transparent",color:period===k?C.text:C.sub}}>{l}</button>
        ))}
      </div>
    </>
  );

  if(bets.length===0)return(
    <div style={{padding:"0 20px 8px"}}>{header}
      <div style={{marginTop:16}}><EmptyState title={allRaw.length?"Aucun pari sur cette période":"Pas encore de statistiques"} sub="Ajoute des paris : tes stats apparaîtront ici."/></div>
    </div>
  );

  // ── Données ──
  const byTip=groupBy(bets,b=>b.tipster||"Sans tipster");
  const byPos=groupBy(playerBets,b=>{const r=roleCode(pOf(b)?.role);return r?(POS_LABEL[r]||r):"Poste inconnu";});
  const byPlayer=groupBy(playerBets,b=>formatName(b.player));
  const byMarket=groupBy(playerBets,b=>{const p=parseDesc(b.description);return p?statFR(p.stat):"Autre";});
  const byOU=groupBy(playerBets.filter(b=>/^(Over|Under)/.test(b.description||"")),b=>(b.description||"").startsWith("Over")?"Over":"Under");
  const byLeague=groupBy(bets,b=>b.game);
  const byBook=groupBy(rawBets,b=>b.bookmaker||"Sans bookmaker");
  const oddsOrder=["< 1,60","1,60 – 1,89","1,90 – 2,19","≥ 2,20"];
  const byOdds=groupBy(bets,b=>{const o=parseFloat(b.odds||0);return o<1.6?oddsOrder[0]:o<1.9?oddsOrder[1]:o<2.2?oddsOrder[2]:oddsOrder[3];});
  const monthRows=rowsOf(groupBy(bets.filter(b=>b.created_at),b=>b.created_at.slice(0,7)),{sort:(a,b)=>b.key.localeCompare(a.key)})
    .map(r=>{const[y,mo]=r.key.split("-");const l=new Date(+y,+mo-1,1).toLocaleDateString("fr-FR",{month:"long",year:"numeric"});return{...r,name:l.charAt(0).toUpperCase()+l.slice(1)};});

  const best=g=>{const e=Object.entries(g).filter(([k,s])=>s.won+s.lost>0&&!/^(Sans|Autre|Poste inconnu)/.test(k)).sort((a,b)=>b[1].profit-a[1].profit)[0];return e?{name:e[0],s:e[1]}:null;};
  const worst=g=>{const e=Object.entries(g).filter(([k,s])=>s.won+s.lost>0&&!/^(Sans|Autre|Poste inconnu)/.test(k)).sort((a,b)=>a[1].profit-b[1].profit)[0];return e&&e[1].profit<0?{name:e[0],s:e[1]}:null;};
  const insights=[
    ["Meilleur tipster",best(byTip)],["Meilleur marché",best(byMarket)],["Meilleur joueur",best(byPlayer)],["Pire marché",worst(byMarket)],
  ].filter(x=>x[1]);

  const OU=()=>{
    const side=(k,col)=>{const s=byOU[k]||empty;const x=stat(s);return(
      <Card style={{flex:1,padding:14,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:15,fontWeight:700,color:col}}>{k}</span>
          <span style={{fontSize:12,color:C.sub}}>{s.count} paris</span>
        </div>
        <div style={{fontSize:22,fontWeight:700,marginTop:8,color:pColor(s.profit),fontVariantNumeric:"tabular-nums"}}>{money(s.profit,0)}</div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:8,fontSize:12.5,color:C.sub}}>
          <span>{s.won}-{s.lost}</span><Pill v={x.roi}/>
        </div>
      </Card>);};
    return <div style={{display:"flex",gap:10}}>{side("Over",C.green)}{side("Under",C.red)}</div>;
  };

  // Annonces
  const ann=bets.filter(b=>b.annonce);
  const annSettled=ann.filter(b=>b.status==="won"||b.status==="lost").length;
  const pObj=name=>players.find(p=>p.name===name);
  const SIDE={teammate:"Coéquipier absent",opponent:"Adversaire absent"};
  const STAT_A={out:"Out confirmé",doubt:"Incertain (anticipé)"};
  const ROLE={star:"Star",starter:"Titulaire",bench:"Rotation"};
  const posShort=r=>{const x=roleCode(r);return POS_LABEL[x]||x||"?";};

  return(
    <div style={{padding:"0 20px 8px"}}>
      {header}
      <div key={tab+period} className="fade-in" style={{marginTop:16}}>

      {tab==="overview"&&<>
        <Hero s={total} title={(period==="all"?"Depuis le début":"Sur la période")+" · "+total.count+" paris"+(pending?" ("+pending+" en cours)":"")}
          extra={clvAll.n>0?<Mini label="CLV" value={pct(clvAll.avg)} color={pColor(clvAll.avg)}/>:null}/>
        {insights.length>0&&<>
          <Title>À retenir</Title>
          <Card style={{overflow:"hidden"}}>
            {insights.map(([l,v],i)=>(
              <div key={l} style={{display:"flex",alignItems:"center",gap:12,padding:"13px 14px",borderTop:i?"1px solid "+C.line:"none"}}>
                <span style={{width:8,height:8,borderRadius:4,background:v.s.profit>=0?C.green:C.red,flexShrink:0}}/>
                <span style={{fontSize:13,color:C.sub,width:118,flexShrink:0}}>{l}</span>
                <span style={{flex:1,minWidth:0,fontSize:15,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{v.name}</span>
                <span style={{fontSize:15,fontWeight:700,color:pColor(v.s.profit),whiteSpace:"nowrap"}}>{money(v.s.profit,0)}</span>
              </div>
            ))}
          </Card>
        </>}
        {(byOU.Over||byOU.Under)&&<><Title>Over vs Under</Title><OU/></>}
        <Title>Par ligue</Title>
        <Table rows={rowsOf(byLeague,{logo:g=>getLeagueLogo(g)||null})}/>
        <Title>Par cote</Title>
        <Table rows={rowsOf(byOdds,{sort:(a,b)=>oddsOrder.indexOf(a.key)-oddsOrder.indexOf(b.key)})}/>
        <Title>Bookmakers</Title>
        <Table rows={rowsOf(byBook,{logo:n=>bkPhotos[n]||null})}/>
        <Title>Par mois</Title>
        <Table rows={monthRows}/>
      </>}

      {tab==="tipsters"&&<>
        <Table rows={rowsOf(byTip)} limit={20}/>
        <Title>Tipster × marché</Title>
        <Table rows={rowsOf(groupBy(playerBets.filter(b=>b.tipster),b=>{const p=parseDesc(b.description);return b.tipster+" · "+(p?statFR(p.stat):"Autre");}))}/>
      </>}

      {tab==="players"&&<>
        <Title>Par poste</Title>
        <Table rows={rowsOf(byPos)} limit={10}/>
        <Title>Joueurs</Title>
        <Table rows={rowsOf(byPlayer)} limit={8}/>
      </>}

      {tab==="markets"&&<>
        <Table rows={rowsOf(byMarket)} limit={12}/>
        {(byOU.Over||byOU.Under)&&<><Title>Over vs Under</Title><OU/></>}
        <Title>Détail Over / Under</Title>
        <Table rows={rowsOf(groupBy(playerBets,b=>{const p=parseDesc(b.description);return p?p.ou+" "+statFR(p.stat):null;}))} limit={10}/>
      </>}

      {tab==="annonces"&&(ann.length===0?(
        <EmptyState title="Aucun pari sur annonce" sub="Active « Annonce » quand tu paries suite à une absence : tes stats apparaîtront ici."/>
      ):<>
        <Hero s={groupBy(ann,()=>"a").a} title={"Paris sur annonce · "+ann.length}
          extra={clvOf(ann).n>0?<Mini label="CLV" value={pct(clvOf(ann).avg)} color={pColor(clvOf(ann).avg)}/>:null}/>
        <div style={{display:"flex",alignItems:"center",gap:8,margin:"10px 4px 0",fontSize:12.5,color:C.sub}}>
          <span style={{width:7,height:7,borderRadius:4,background:annSettled>=50?C.green:annSettled>=20?"#FBBF24":C.red}}/>
          {annSettled>=50?"Échantillon fiable":annSettled>=20?"Échantillon indicatif":"Échantillon faible"} · {annSettled} réglés{annSettled<50?" (fiable à 50)":""}
        </div>
        <Title>Annonce vs autres</Title>
        <Table rows={rowsOf(groupBy(bets,b=>b.annonce?"Sur annonce":"Autres paris"))}/>
        <Title>Qui est absent</Title>
        <Table rows={rowsOf(groupBy(ann,b=>SIDE[b.annonce_side]||"Non précisé"))}/>
        <Title>Statut de l'absence</Title>
        <Table rows={rowsOf(groupBy(ann,b=>STAT_A[b.annonce_status]||"Non précisé"))}/>
        <Title>Importance de l'absent</Title>
        <Table rows={rowsOf(groupBy(ann,b=>ROLE[b.annonce_role]||"Non précisé"))}/>
        <Title>Poste absent → poste joué</Title>
        <Table rows={rowsOf(groupBy(ann.filter(b=>b.bet_type!=="team"&&b.annonce_player),b=>posShort(pObj(b.annonce_player)?.role)+" → "+posShort(pObj(b.player)?.role)))}/>
        <Title>Par marché</Title>
        <Table rows={rowsOf(groupBy(ann.filter(b=>b.bet_type!=="team"),b=>{const p=parseDesc(b.description);return p?statFR(p.stat):"Autre";}))}/>
        <Title>Top des absents</Title>
        <Table rows={rowsOf(groupBy(ann.filter(b=>b.annonce_player||b.annonce_note),b=>b.annonce_player?formatName(b.annonce_player):b.annonce_note))}/>
        <Title>Par tipster</Title>
        <Table rows={rowsOf(groupBy(ann,b=>b.tipster||"Sans tipster"))}/>
      </>)}
      </div>
    </div>
  );
}

// ── VUE ÉDITION ──────────────────────────────────────────────────────────────
// ── UI RÉGLAGES (listes groupées) ─────────────────────────────────────────────
const Ico={
  edit:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>,
  trash:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>,
  paste:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/><rect x="8" y="2" width="12" height="14" rx="2"/></svg>,
  upload:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></svg>,
  chevron:<svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="#565D6B" strokeWidth="2" strokeLinecap="round"><path d="M1 1l6 6-6 6"/></svg>,
  eye:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>,
  eyeOff:<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10 10 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>,
  back:<svg width="11" height="18" viewBox="0 0 11 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2L2 9l7 7"/></svg>,
  search:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>,
  plus:<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
};

function IconBtn({icon,label,onClick,danger}){
  return(
    <button type="button" aria-label={label} title={label}
      onClick={e=>{e.stopPropagation();onClick&&onClick(e);}}
      className={"s-icon"+(danger?" danger":"")}>{icon}</button>
  );
}

function SLogo({src,name,size=40}){
  const[err,setErr]=useState(false);
  const ini=(name||"?").split(/\s+/).map(w=>w[0]||"").join("").slice(0,2).toUpperCase();
  return(
    <div style={{width:size,height:size,borderRadius:10,background:C.chip,flexShrink:0,overflow:"hidden",
      display:"flex",alignItems:"center",justifyContent:"center",color:"#C4C9D4",fontSize:Math.round(size*.34),fontWeight:600}}>
      {src&&!err?<img src={src} alt="" onError={()=>setErr(true)} style={{width:"78%",height:"78%",objectFit:"contain"}}/>:ini}
    </div>
  );
}

function SGroup({children}){
  const items=React.Children.toArray(children).filter(Boolean);
  return(
    <div style={{background:C.card,border:"1px solid "+C.line,borderRadius:16,overflow:"hidden"}}>
      {items.map((c,i)=>(
        <div key={i} style={{borderBottom:i<items.length-1?"1px solid "+C.line:"none"}}>{c}</div>
      ))}
    </div>
  );
}

function SRow({logo,title,sub,right,onClick,chevron}){
  return(
    <div onClick={onClick} style={{display:"flex",alignItems:"center",gap:12,minHeight:62,padding:"8px 8px 8px 14px",
      cursor:onClick?"pointer":"default"}}>
      {logo}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:16,fontWeight:500,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</div>
        {sub&&<div style={{fontSize:13,color:C.sub,marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sub}</div>}
      </div>
      {right}
      {chevron&&<span style={{padding:"0 8px 0 4px",display:"flex"}}>{Ico.chevron}</span>}
    </div>
  );
}

function SHeader({title,sub,action,onBack,right}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,margin:"4px 0 12px"}}>
      {onBack&&<button type="button" aria-label="Retour" onClick={onBack}
        style={{width:36,height:44,border:"none",background:"transparent",color:C.blue,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"flex-start",padding:0}}>{Ico.back}</button>}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:20,fontWeight:600,letterSpacing:-.3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{title}</div>
        {sub&&<div style={{fontSize:13,color:C.sub,marginTop:1}}>{sub}</div>}
      </div>
      {right}
      {action&&<button type="button" onClick={action.onClick} className="s-add">{Ico.plus}{action.label}</button>}
    </div>
  );
}

function SSearch({value,onChange,placeholder}){
  return(
    <div style={{position:"relative",marginBottom:14}}>
      <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",display:"flex"}}>{Ico.search}</span>
      <input placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}
        style={{width:"100%",height:42,padding:"0 36px 0 38px",background:C.card,border:"1px solid "+C.line,
          borderRadius:12,color:C.text,fontSize:15,outline:"none"}}/>
      {value&&<button type="button" aria-label="Effacer" onClick={()=>onChange("")}
        style={{position:"absolute",right:6,top:"50%",transform:"translateY(-50%)",width:32,height:32,
          background:"transparent",border:"none",color:C.sub,cursor:"pointer",fontSize:18}}>×</button>}
    </div>
  );
}

function SEmpty({title,sub}){
  return(
    <div style={{textAlign:"center",padding:"48px 20px",background:C.card,border:"1px dashed "+C.line,borderRadius:16}}>
      <div style={{fontSize:15,fontWeight:600,color:"#C4C9D4"}}>{title}</div>
      {sub&&<div style={{fontSize:13,color:C.sub,marginTop:6}}>{sub}</div>}
    </div>
  );
}

function EditView({showToast,onPlayersChanged=()=>{}}){
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
  const[pickClubs,setPickClubs]=useState(false);
  const[gIndex,setGIndex]=useState(null); // {clubs:[],players:[]}
  const navRef=useRef(null); // navigation en attente {club, player}
  useEffect(()=>{
    if(globalSearch.trim().length<2||gIndex)return;
    Promise.all([
      fetch(SUPA_URL+"/rest/v1/clubs?select=*&order=name.asc&limit=5000",{headers:H}).then(r=>r.json()).catch(()=>[]),
      fetch(SUPA_URL+"/rest/v1/players?select=*&order=name.asc&limit=10000",{headers:H}).then(r=>r.json()).catch(()=>[]),
    ]).then(([cl,pl])=>setGIndex({clubs:Array.isArray(cl)?cl:[],players:Array.isArray(pl)?pl:[]}));
  },[globalSearch,gIndex]);
  useEffect(()=>{if(!globalSearch)setGIndex(null);},[globalSearch]);
  function goTo(club,player){
    const lg=leagues.find(l=>l.name===club.league)||{id:club.league,name:club.league};
    navRef.current={club,player};
    setGlobalSearch("");
    setSelectedLeague(lg);
  }

  useEffect(()=>{
    fetchLeagues().then(rows=>{
      const ORDER=['NBA','EuroLeague','EuroCup','BCL','ACB','Betclic Elite','Lega A','BBL','NBL'];
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
          const r=await fetch(SUPA_URL+"/rest/v1/players?select=team&limit=10000",{headers:H});
          if(r.ok){
            const rows=await r.json();
            cs=cs.map(c=>{
              const mine=rows.filter(p=>p.team&&sameTeam(p.team,c.name));
              const variants=[...new Set(mine.map(p=>p.team).filter(n=>n!==c.name))];
              return{...c,player_count:mine.length,name_variants:variants};
            });
          }
        }
      }catch(_){}
      setClubs(cs);
      if(navRef.current?.club){
        const target=cs.find(c=>normTeam(c.name)===normTeam(navRef.current.club.name))||navRef.current.club;
        if(!navRef.current.player)navRef.current=null;
        setSelectedClub(target);
      }
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[selectedLeague]);

  useEffect(()=>{
    if(!selectedClub)return;
    setLoading(true);setPlayers([]);setPlayerSearch("");
    fetch(SUPA_URL+"/rest/v1/players?select=*&order=name.asc&limit=10000",{headers:H})
      .then(r=>r.json())
      .then(rows=>{
        const list=Array.isArray(rows)?rows.filter(p=>p.team&&sameTeam(p.team,selectedClub.name)):[];
        setPlayers(list);
        if(navRef.current?.player){
          const pl=list.find(p=>p.id===navRef.current.player.id)||navRef.current.player;
          navRef.current=null;
          setEditingPlayer(pl);
        }
      })
      .catch(()=>{}).finally(()=>setLoading(false));
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
      onPlayersChanged();
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
      onPlayersChanged();
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
      onPlayersChanged();
      showToast("Joueur mis à jour ✓");
    }catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
  }

  // Niveau 1 : Ligues
  if(!selectedLeague){
    const leagueMatches=globalSearch.length>=1
      ?leagues.filter(l=>l.name.toLowerCase().includes(globalSearch.toLowerCase()))
      :leagues;
    return(
      <div>
        <SHeader title="Ligues" sub="Choisis une ligue pour gérer ses clubs et joueurs"
          action={{label:"Ligue",onClick:async()=>{
            const name=(window.prompt("Nom de la nouvelle ligue :")||"").trim();
            if(!name)return;
            if(leagues.some(l=>normTeam(l.name)===normTeam(name))){showToast(name+" existe déjà","rgba(255,255,255,.6)");return;}
            try{const[lg]=await insertLeague(name);setLeagues(prev=>[...prev,lg||{id:name,name}]);showToast(name+" ajoutée ✓");}
            catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
          }}}/>
        {Object.entries(LEAGUE_PRESETS).filter(([n])=>!leagues.some(l=>normTeam(l.name)===normTeam(n))).map(([n,clubsList])=>(
          <div key={n} className="fade-in" style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",marginBottom:14,borderRadius:14,
            background:"rgba(91,157,255,.10)",border:"1px solid rgba(91,157,255,.3)"}}>
            <div style={{flex:1,fontSize:13,color:"#C4C9D4",lineHeight:1.4}}>
              <b style={{color:C.text}}>{n}</b> · saison 2026-27<br/><span style={{color:C.sub}}>{clubsList.length} clubs prêts à importer</span>
            </div>
            <button type="button" className="s-add" onClick={async()=>{
              try{
                const[lg]=await insertLeague(n);
                await insertClubs(clubsList.map(c=>({name:c,league:n})));
                setLeagues(prev=>[...prev,lg||{id:n,name:n}]);
                showToast(n+" et ses "+clubsList.length+" clubs ajoutés ✓");
              }catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
            }}>Importer</button>
          </div>
        ))}
        <SSearch value={globalSearch} onChange={setGlobalSearch} placeholder="Ligue, club ou joueur…"/>
        {globalSearch.trim().length>=2&&(()=>{
          const q=normTeam(globalSearch);
          const qi=globalSearch.toLowerCase().trim();
          if(!gIndex)return <div style={{textAlign:"center",color:C.sub,padding:"8px 0 16px",fontSize:14}}>Recherche…</div>;
          const seen=new Set();
          const clubHits=gIndex.clubs.filter(c=>normTeam(c.name).includes(q)).filter(c=>{const k=normTeam(c.name)+"|"+c.league;if(seen.has(k))return false;seen.add(k);return true;}).slice(0,8);
          const playerHits=gIndex.players.filter(p=>{
            const n=(p.name||"").toLowerCase();
            return normTeam(p.name).includes(q)||n.split(" ").map(w=>w[0]).join("")===qi;
          }).slice(0,10);
          const clubOf=p=>gIndex.clubs.find(c=>c.league===p.game&&sameTeam(c.name,p.team))||gIndex.clubs.find(c=>sameTeam(c.name,p.team));
          return(<>
            {clubHits.length>0&&<>
              <div style={{fontSize:13,fontWeight:600,color:C.sub,margin:"4px 4px 8px"}}>Clubs</div>
              <SGroup>{clubHits.map(c=>(
                <SRow key={c.name+c.league} logo={<SLogo src={c.logo||CLUB_LOGOS_MAP[c.name]} name={c.name} size={42}/>}
                  title={c.name} sub={c.league} onClick={()=>goTo(c,null)} chevron/>
              ))}</SGroup>
            </>}
            {playerHits.length>0&&<>
              <div style={{fontSize:13,fontWeight:600,color:C.sub,margin:"18px 4px 8px"}}>Joueurs</div>
              <SGroup>{playerHits.map(p=>{
                const club=clubOf(p);
                return(
                  <SRow key={p.id||p.name} logo={<PlayerFace src={p.photo_url||p.avatar_url} name={formatName(p.name)} team={p.team} size={44}/>}
                    title={formatName(p.name)} sub={[p.role,p.team,p.game].filter(Boolean).join(" · ")}
                    onClick={()=>club?goTo(club,p):showToast("Club introuvable pour ce joueur","#FF8A80")} chevron/>
                );
              })}</SGroup>
            </>}
            {(leagueMatches.length>0&&(clubHits.length>0||playerHits.length>0))&&
              <div style={{fontSize:13,fontWeight:600,color:C.sub,margin:"18px 4px 8px"}}>Ligues</div>}
            {leagueMatches.length===0&&clubHits.length===0&&playerHits.length===0&&<SEmpty title={"Aucun résultat pour « "+globalSearch+" »"}/>}
          </>);
        })()}
        {leagueMatches.length===0?(globalSearch.trim().length>=2?null:<SEmpty title="Aucune ligue trouvée"/>):(()=>{
          const row=lg=>(
            <SRow key={lg.id}
              logo={<SLogo src={lg.logo} name={lg.name} size={42}/>}
              title={lg.name}
              sub={isCup(lg.name)?"Coupe · "+(CUPS[Object.keys(CUPS).find(c=>normTeam(c)===normTeam(lg.name))]||""):null}
              onClick={()=>{setSelectedLeague(lg);setGlobalSearch("");}}
              right={<IconBtn icon={Ico.paste} label={"Coller le logo de "+lg.name} onClick={()=>pasteLeagueLogo(lg)}/>}
              chevron/>
          );
          const champ=leagueMatches.filter(l=>!isCup(l.name));
          const cups=leagueMatches.filter(l=>isCup(l.name));
          return(<>
            {champ.length>0&&<SGroup>{champ.map(row)}</SGroup>}
            {cups.length>0&&<>
              <div style={{fontSize:13,fontWeight:600,color:C.sub,margin:"24px 4px 8px"}}>Coupes</div>
              <SGroup>{cups.map(row)}</SGroup>
            </>}
          </>);
        })()}
      </div>
    );
  }

  // Niveau 2 : Clubs
  if(!selectedClub){
    const shownClubs=clubs.filter(c=>!playerSearch||c.name.toLowerCase().includes(playerSearch.toLowerCase()));
    const cup=isCup(selectedLeague.name);
    return(
      <div>
        <SHeader title={selectedLeague.name} sub={clubs.length+" clubs"}
          action={{label:"Club",onClick:async()=>{
            const name=(window.prompt("Nom du nouveau club ("+selectedLeague.name+") :")||"").trim();
            if(!name)return;
            if(clubs.some(c=>normTeam(c.name)===normTeam(name))){showToast(name+" existe déjà","rgba(255,255,255,.6)");return;}
            try{const[c]=await insertClubs([{name,league:selectedLeague.name}]);setClubs(prev=>[...prev,{...(c||{id:name,name}),player_count:0}].sort((a,b)=>a.name.localeCompare(b.name)));showToast(name+" ajouté ✓");}
            catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
          }}}
          onBack={()=>{setSelectedLeague(null);setPlayerSearch("");}}
          right={<IconBtn icon={Ico.paste} label="Coller le logo de la ligue" onClick={()=>pasteLeagueLogo(selectedLeague)}/>}/>
        <SSearch value={playerSearch} onChange={setPlayerSearch} placeholder="Rechercher un club…"/>
        {loading?<div style={{textAlign:"center",color:C.sub,padding:32}}>Chargement…</div>
        :shownClubs.length===0?(isCup(selectedLeague.name)
          ?<EmptyState title="Aucun club dans cette coupe" sub="Ajoute les clubs participants depuis tes championnats : logos et joueurs suivent automatiquement."
              action={{label:"Ajouter des clubs",onClick:()=>setPickClubs(true)}}/>
          :<SEmpty title="Aucun club"/>):(
          <SGroup>
            {shownClubs.map(club=>(
              <SRow key={club.id}
                logo={<SLogo src={club.logo} name={club.name} size={42}/>}
                title={club.name}
                sub={club.player_count>0?club.player_count+" joueur"+(club.player_count>1?"s":""):"Aucun joueur"}
                onClick={()=>setSelectedClub(club)}
                right={<div style={{display:"flex",gap:2}}>
                  <IconBtn icon={Ico.paste} label="Coller le logo" onClick={()=>pasteClubLogo(club)}/>
                  <IconBtn icon={Ico.upload} label="Choisir un fichier" onClick={()=>pickClubLogoFile(club)}/>
                </div>}
                chevron/>
            ))}
          </SGroup>
        )}
        {cup&&shownClubs.length>0&&(
          <button type="button" className="press" onClick={()=>setPickClubs(true)}
            style={{width:"100%",marginTop:12,height:48,borderRadius:14,border:"1px dashed #3A404C",background:"transparent",
              color:C.blue,fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Ajouter des clubs depuis un championnat</button>
        )}
        {pickClubs&&<CupClubPicker cup={selectedLeague.name} existing={clubs.map(c=>c.name)}
          onClose={()=>setPickClubs(false)}
          onAdd={async rows=>{
            try{
              const created=await insertClubs(rows.map(r=>({name:r.name,league:selectedLeague.name,...(r.logo?{logo:r.logo}:{})})));
              setClubs(prev=>[...prev,...(created||rows).map(c=>({...c,player_count:undefined}))].sort((a,b)=>a.name.localeCompare(b.name)));
              setPickClubs(false);
              showToast(rows.length+" club"+(rows.length>1?"s":"")+" ajouté"+(rows.length>1?"s":"")+" ✓");
              setSelectedLeague(l=>({...l}));
            }catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
          }}/>}
      </div>
    );
  }

  // Niveau 3 : Joueurs
  const searchLow2=playerSearch.toLowerCase().trim();
  const filteredPlayers=[...players]
    .filter(p=>{
      if(!searchLow2)return true;
      const n=p.name.toLowerCase();
      const initials=n.split(" ").map(w=>w[0]||"").join("");
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
    <div>
      <SHeader title={selectedClub.name} sub={players.length+" joueur"+(players.length!==1?"s":"")}
        onBack={()=>{setSelectedClub(null);setPlayerSearch("");}}
        right={<div style={{display:"flex",gap:2}}>
          <IconBtn icon={Ico.paste} label="Coller le logo du club" onClick={()=>pasteClubLogo(selectedClub)}/>
          <IconBtn icon={Ico.upload} label="Choisir le logo depuis un fichier" onClick={()=>pickClubLogoFile(selectedClub)}/>
        </div>}
        action={{label:"Joueur",onClick:()=>setCreatingPlayer(true)}}/>
      {(()=>{
        const variants=[...new Set(players.map(p=>p.team).filter(n=>n&&n!==selectedClub.name))];
        if(!variants.length)return null;
        const n=players.filter(p=>p.team!==selectedClub.name).length;
        return(
          <div className="fade-in" style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",marginBottom:14,borderRadius:14,
            background:"rgba(91,157,255,.10)",border:"1px solid rgba(91,157,255,.3)"}}>
            <div style={{flex:1,fontSize:13,color:"#C4C9D4",lineHeight:1.4}}>
              {n} joueur{n>1?"s":""} enregistré{n>1?"s":""} sous « {variants.join(" », « ")} ».
              <br/><span style={{color:C.sub}}>Harmoniser pour tout ranger sous « {selectedClub.name} ».</span>
            </div>
            <button type="button" className="s-add" onClick={async()=>{
              try{
                for(const v of variants){
                  await fetch(SUPA_URL+"/rest/v1/players?team=eq."+encodeURIComponent(v),{method:"PATCH",headers:{...H},
                    body:JSON.stringify({team:selectedClub.name,...(selectedClub.logo?{team_logo_url:selectedClub.logo}:{})})});
                }
                setPlayers(prev=>prev.map(p=>({...p,team:selectedClub.name,...(selectedClub.logo?{team_logo_url:selectedClub.logo}:{})})));
                setClubs(prev=>prev.map(c=>c.name===selectedClub.name?{...c,name_variants:[]}:c));
                onPlayersChanged();
                showToast("Club harmonisé ✓");
              }catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
            }}>Harmoniser</button>
          </div>
        );
      })()}
      <SSearch value={playerSearch} onChange={setPlayerSearch} placeholder="Rechercher un joueur…"/>

      {loading&&<div style={{textAlign:"center",color:C.sub,padding:32}}>Chargement…</div>}
      {!loading&&filteredPlayers.length===0&&!playerSearch&&(
        <button type="button" onClick={()=>setCreatingPlayer(true)}
          style={{width:"100%",padding:"22px 0",border:"1px dashed "+C.line,borderRadius:16,
            background:C.card,color:C.blue,fontSize:15,fontWeight:500,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {Ico.plus} Ajouter le premier joueur
        </button>
      )}
      {!loading&&filteredPlayers.length===0&&playerSearch&&(
        <SEmpty title={"Aucun résultat pour « "+playerSearch+" »"}/>
      )}
      {Object.entries(groups).map(([pos,pList])=>(
        <div key={pos} style={{marginBottom:18}}>
          <div style={{fontSize:13,fontWeight:600,color:C.sub,padding:"0 4px 8px"}}>{pos}</div>
          <SGroup>
            {pList.map(p=>{
              const photo=p.photo_url||p.avatar_url;
              return(
                <SRow key={p.id}
                  logo={
                    <button type="button" aria-label={"Coller la photo de "+formatName(p.name)}
                      onClick={e=>{e.stopPropagation();pastePlayerPhoto(p);}}
                      style={{border:"none",padding:0,background:"transparent",cursor:"pointer",position:"relative",opacity:uploadingId===p.id?.5:1}}>
                      <PlayerFace src={photo} name={formatName(p.name)} team={p.team} size={44}/>
                    </button>
                  }
                  title={formatName(p.name)}
                  sub={[p.role,p.game].filter(Boolean).join(" · ")||null}
                  onClick={()=>setEditingPlayer(p)}
                  right={<IconBtn icon={Ico.edit} label={"Modifier "+formatName(p.name)} onClick={()=>setEditingPlayer(p)}/>}/>
              );
            })}
          </SGroup>
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


// Ville d'un club (pour le grand texte en arrière-plan)
const NBA_CITY={"Atlanta Hawks":"Atlanta","Boston Celtics":"Boston","Brooklyn Nets":"Brooklyn","Charlotte Hornets":"Charlotte","Chicago Bulls":"Chicago","Cleveland Cavaliers":"Cleveland","Dallas Mavericks":"Dallas","Denver Nuggets":"Denver","Detroit Pistons":"Detroit","Golden State Warriors":"Golden State","Houston Rockets":"Houston","Indiana Pacers":"Indiana","LA Clippers":"Los Angeles","Los Angeles Clippers":"Los Angeles","Los Angeles Lakers":"Los Angeles","Memphis Grizzlies":"Memphis","Miami Heat":"Miami","Milwaukee Bucks":"Milwaukee","Minnesota Timberwolves":"Minnesota","New Orleans Pelicans":"New Orleans","New York Knicks":"New York","Oklahoma City Thunder":"Oklahoma City","Orlando Magic":"Orlando","Philadelphia 76ers":"Philadelphia","Phoenix Suns":"Phoenix","Portland Trail Blazers":"Portland","Sacramento Kings":"Sacramento","San Antonio Spurs":"San Antonio","Toronto Raptors":"Toronto","Utah Jazz":"Utah","Washington Wizards":"Washington"};
function cityOf(team){
  if(!team)return "";
  if(NBA_CITY[team])return NBA_CITY[team];
  const hit=Object.keys(NBA_CITY).find(k=>sameTeam(k,team));
  if(hit)return NBA_CITY[hit];
  const n=normTeam(team);
  const EU=[["panathinaikos","Athènes"],["olympiacos","Le Pirée"],["fenerbahce","Istanbul"],["efes","Istanbul"],["besiktas","Istanbul"],["galatasaray","Istanbul"],
    ["real madrid","Madrid"],["barcelona","Barcelone"],["baskonia","Vitoria"],["valencia","Valence"],["unicaja","Málaga"],["gran canaria","Las Palmas"],["tenerife","Tenerife"],["joventut","Badalone"],
    ["monaco","Monaco"],["paris","Paris"],["asvel","Villeurbanne"],["villeurbanne","Villeurbanne"],["cholet","Cholet"],["le mans","Le Mans"],["nanterre","Nanterre"],["strasbourg","Strasbourg"],["dijon","Dijon"],["bourg","Bourg"],["limoges","Limoges"],["gravelines","Gravelines"],
    ["bayern","Munich"],["munchen","Munich"],["alba","Berlin"],["ulm","Ulm"],["bonn","Bonn"],["milano","Milan"],["olimpia","Milan"],["virtus","Bologne"],["bologna","Bologne"],["venezia","Venise"],
    ["zalgiris","Kaunas"],["maccabi","Tel Aviv"],["hapoel","Tel Aviv"],["partizan","Belgrade"],["crvena","Belgrade"],["zvezda","Belgrade"],["dubai","Dubaï"],["lietkabelis","Panevėžys"],["aek","Athènes"],["promitheas","Patras"]];
  const e=EU.find(([k])=>n.includes(k));
  return e?e[1]:team;
}

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
          {(team||player.team)&&(
            <div aria-hidden="true" style={{
              position:"absolute",left:120,top:"44%",transform:"translateY(-50%)",
              fontSize:110,fontWeight:900,letterSpacing:-3,lineHeight:1,whiteSpace:"nowrap",
              textTransform:"uppercase",color:"transparent",
              WebkitTextStroke:"1.5px rgba(255,255,255,.22)",pointerEvents:"none",
            }}>{cityOf(team||player.team)}</div>
          )}
          {resolvedTeamLogo&&(
            <img src={resolvedTeamLogo} alt="" style={{
              position:"absolute",right:18,top:18,
              width:78,height:78,objectFit:"contain",pointerEvents:"none",
              filter:"drop-shadow(0 4px 14px rgba(0,0,0,.45))",
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
function SettingsView({bookmakers,onUpdateBK,tipsters,onUpdateTip,showToast,onPlayersChanged}){
  const[tab,setTab]=useState("edit");
  const[showAdd,setShowAdd]=useState(false);
  const[editBK,setEditBK]=useState(null);
  const[newTip,setNewTip]=useState("");

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

  async function addTipster(e){
    e&&e.preventDefault();
    const n=newTip.trim();
    if(!n)return;
    if(tipsters.find(t=>t.name.toLowerCase()===n.toLowerCase())){showToast(n+" existe déjà","rgba(255,255,255,.6)");return;}
    try{
      await insertTipster({id:uuid(),name:n});
      setNewTip("");
      onUpdateTip();
      showToast(n+" ajouté ✓");
    }catch(e){showToast("Erreur: "+e.message,"#FF8A80");}
  }

  return(
    <div style={{padding:"0 20px 16px"}}>
      <div className="segment" style={{marginBottom:20}}>
        {[["edit","Joueurs"],["bookmakers","Bookmakers"],["tipsters","Tipsters"]].map(([k,l])=>(
          <button key={k} className={"seg-btn"+(tab===k?" active":"")} onClick={()=>setTab(k)}>{l}</button>
        ))}
      </div>

      {tab==="bookmakers"&&(
        <>
          <SHeader title="Bookmakers" sub={bookmakers.length+" enregistré"+(bookmakers.length!==1?"s":"")}
            action={{label:"Ajouter",onClick:()=>{setEditBK(null);setShowAdd(true);}}}/>
          {bookmakers.length===0?(
            <SEmpty title="Aucun bookmaker" sub="Ajoute tes bookmakers pour les utiliser dans tes paris"/>
          ):(
            <SGroup>
              {bookmakers.map(bk=>(
                <div key={bk.id} style={{opacity:bk.hidden?.5:1}}>
                <SRow
                  logo={<SLogo src={bk.logo} name={bk.name}/>}
                  title={bk.name}
                  sub={bk.hidden?"Masqué · visible seulement ici et dans Analyse":(bk.url||null)}
                  onClick={()=>{setEditBK(bk);setShowAdd(true);}}
                  right={<div style={{display:"flex",gap:2}}>
                    <IconBtn icon={bk.hidden?Ico.eyeOff:Ico.eye} label={bk.hidden?"Afficher "+bk.name:"Masquer "+bk.name} onClick={async()=>{
                      try{await updateBookmaker(bk.id,{hidden:!bk.hidden});onUpdateBK();showToast(bk.name+(bk.hidden?" visible":" masqué"));}
                      catch(e){showToast("Erreur: "+e.message+" — as-tu ajouté la colonne hidden ?","#FF8A80");}
                    }}/>
                    <IconBtn icon={Ico.edit} label={"Modifier "+bk.name} onClick={()=>{setEditBK(bk);setShowAdd(true);}}/>
                    <IconBtn icon={Ico.trash} label={"Supprimer "+bk.name} danger onClick={()=>deleteBK(bk)}/>
                  </div>}/>
                </div>
              ))}
            </SGroup>
          )}
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
          <SHeader title="Tipsters" sub={tipsters.length+" enregistré"+(tipsters.length!==1?"s":"")}/>
          <form onSubmit={addTipster} style={{display:"flex",gap:8,marginBottom:14}}>
            <input className="form-input" placeholder="Nom du nouveau tipster" value={newTip}
              onChange={e=>setNewTip(e.target.value)} style={{flex:1}}/>
            <button type="submit" className="s-add" disabled={!newTip.trim()}
              style={{height:46,opacity:newTip.trim()?1:.5}}>{Ico.plus}Ajouter</button>
          </form>
          {tipsters.length===0?(
            <SEmpty title="Aucun tipster" sub="Ajoute tes tipsters pour les associer à tes paris"/>
          ):(
            <SGroup>
              {tipsters.map(t=>(
                <SRow key={t.id}
                  logo={<SLogo name={t.name} size={36}/>}
                  title={t.name}
                  right={<IconBtn icon={Ico.trash} label={"Supprimer "+t.name} danger onClick={()=>deleteTip(t)}/>}/>
              ))}
            </SGroup>
          )}
        </>
      )}

      {tab==="edit"&&<EditView showToast={showToast} onPlayersChanged={onPlayersChanged}/>}
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

    refreshPlayers();
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

  // Tirer vers le bas (en haut de page) pour rafraîchir
  const[pull,setPull]=useState(0);
  useEffect(()=>{
    let startY=null,dist=0;
    const start=e=>{startY=window.scrollY<=0?e.touches[0].clientY:null;dist=0;};
    const move=e=>{if(startY===null)return;dist=Math.max(0,e.touches[0].clientY-startY);setPull(Math.min(dist,90));};
    const end=()=>{if(startY!==null&&dist>70)loadBets(true);startY=null;dist=0;setPull(0);};
    window.addEventListener("touchstart",start,{passive:true});
    window.addEventListener("touchmove",move,{passive:true});
    window.addEventListener("touchend",end);
    return()=>{window.removeEventListener("touchstart",start);window.removeEventListener("touchmove",move);window.removeEventListener("touchend",end);};
  },[loadBets]);

  function refreshPlayers(){fetchPlayers().then(setPlayers).catch(()=>{});}
  function openEdit(bet){setSelectedBet(null);setEditBet(bet);}

  if(loading)return(
    <>
      <style>{CSS}</style>
      <div className="app" style={{padding:"calc(18px + env(safe-area-inset-top)) 20px 0"}}>
        <div className="skel" style={{width:170,height:34,borderRadius:10,marginBottom:18}}/>
        <div className="skel" style={{height:300,borderRadius:22,marginBottom:22}}/>
        {[0,1,2,3].map(i=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"14px",marginBottom:8,borderRadius:14,background:"#1C1F26"}}>
            <div className="skel" style={{width:54,height:54,borderRadius:27}}/>
            <div style={{flex:1}}>
              <div className="skel" style={{height:14,width:"70%",borderRadius:7,marginBottom:8}}/>
              <div className="skel" style={{height:11,width:"45%",borderRadius:6}}/>
            </div>
            <div className="skel" style={{width:64,height:16,borderRadius:8}}/>
          </div>
        ))}
      </div>
    </>
  );

  return(
    <>
      <style>{CSS}</style>
      <div className="app">
        {pull>0&&(
          <div style={{height:pull*.6,display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:6,
            color:pull>70?"#5B9DFF":"#6B7280",fontSize:13,transition:"color .15s"}}>
            {pull>70?"Relâche pour actualiser":"Tire pour actualiser"}
          </div>
        )}
        <div className="header">
          <div className="header-title">
            {view==="home"?"Bankroll":view==="bets"?"Mes paris":view==="stats"?"Analyse":"Réglages"}
          </div>
          {syncing&&<span style={{fontSize:13,color:"#8B92A0"}}>Actualisation…</span>}
        </div>

        <div key={view} className="view-in" style={{paddingTop:4}}>
          {view==="home"&&<HomeView bets={bets} players={players} onNavigate={setView} onAdd={()=>{refreshPlayers();setShowAdd(true);}}/>}
          {view==="bets"&&<BetsView bets={bets} players={players} bookmakers={bookmakers}
            bkPhotos={Object.fromEntries(bookmakers.map(bk=>[bk.name,bk.logo]).filter(([,v])=>v))}
            tipsters={tipsters} leagues={leagues} onRefresh={()=>loadBets(true)} showToast={showToast}
            onSelectBet={setSelectedBet} onEdit={openEdit} onAdd={()=>{refreshPlayers();setShowAdd(true);}}/>}
          {view==="stats"&&<StatsView bets={bets} players={players} bkPhotos={Object.fromEntries(bookmakers.map(bk=>[bk.name,bk.logo]).filter(([,v])=>v))}/>}
          {view==="settings"&&<SettingsView
            onPlayersChanged={refreshPlayers}
            bookmakers={bookmakers}
            onUpdateBK={()=>fetchBookmakers().then(setBookmakers).catch(()=>{})}
            tipsters={tipsters}
            onUpdateTip={()=>fetchTipsters().then(setTipsters).catch(()=>{})}
            showToast={showToast}
          />}
        </div>

        <nav className="nav">
          <button aria-label="Bankroll" className={"nav-btn"+(view==="home"?" active":"")} onClick={()=>{setShowAdd(false);setEditBet(null);setView("home");}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><path d="M3 20h18M6 16V10M11 16V5M16 16v-4M21 16V8"/></svg>
          </button>
          <button aria-label="Mes paris" className={"nav-btn"+(view==="bets"?" active":"")} onClick={()=>{setShowAdd(false);setEditBet(null);setView("bets");}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round"><path d="M5 3h14v18l-2.5-1.8L14 21l-2-1.8L10 21l-2.5-1.8L5 21z"/><path d="M9 8h6M9 12h6"/></svg>
          </button>
          <button aria-label="Ajouter un pari" className="nav-add" onClick={()=>{refreshPlayers();setShowAdd(true);}}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button aria-label="Analyse" className={"nav-btn"+(view==="stats"?" active":"")} onClick={()=>{setShowAdd(false);setEditBet(null);setView("stats");}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/></svg>
          </button>
          <button aria-label="Réglages" className={"nav-btn"+(view==="settings"?" active":"")} onClick={()=>{setShowAdd(false);setEditBet(null);setView("settings");}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
          </button>
        </nav>

        {(showAdd||editBet)&&(
          <AddBetModal
            players={players}
            bookmakers={bookmakers.length>0?bookmakers.filter(b=>!b.hidden||b.name===editBet?.bookmaker).map(b=>b.name):DEFAULT_BOOKMAKERS}
            bkPhotos={Object.fromEntries(bookmakers.map(bk=>[bk.name,bk.logo]).filter(([,v])=>v))}
            tipsters={tipsters}
            editBet={editBet}
            onPlayersChanged={refreshPlayers}
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

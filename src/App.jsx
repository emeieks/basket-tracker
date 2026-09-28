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

// ── Marché d'un pari : joueur (stat) ou équipe (type de pari) ──
function teamMarket(b){
  const d=String(b.description||"");
  if(/\b3\s*(pts|points)\b|3pt|3-pt|trois/i.test(d)&&/\b(Over|Under)\b/.test(d))return "3 pts équipe";
  if(/gagne/i.test(d))return "Victoire";
  if(/mi-temps/i.test(d))return "1re mi-temps";
  if(/\(match\)/i.test(d))return "Total match";
  if(/\b(Over|Under)\b/.test(d)&&/pts/i.test(d))return "Points équipe";
  return "Handicap";
}
function marketOf(b){
  if(b.bet_type==="team")return "Équipe · "+teamMarket(b);
  const p=parseDesc(b.description);return p?statFR(p.stat):"Autre";
}
// Over / Under : joueur toujours ; équipe seulement pour les totaux (match, points équipe, mi-temps, 3 pts)
function ouOf(b){
  if(b.bet_type==="team"){
    if(["Victoire","Handicap"].includes(teamMarket(b)))return null;
    const m=/\b(Over|Under)\b/.exec(b.description||"");return m?m[1]:null;
  }
  const p=parseDesc(b.description);if(p)return p.ou;
  const m=/^(Over|Under)/.exec(b.description||"");return m?m[1]:null;
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

// ── Détourage automatique : enlève le fond blanc (remplissage depuis les bords) ──
function loadImg(src){return new Promise((ok,ko)=>{const i=new Image();i.crossOrigin="anonymous";i.onload=()=>ok(i);i.onerror=()=>ko(new Error("image illisible"));i.src=src;});}
function isWhitePx(d,i){const r=d[i],g=d[i+1],b=d[i+2];return d[i+3]>200&&r>228&&g>228&&b>228&&Math.max(r,g,b)-Math.min(r,g,b)<22;}
// true si les bords de l'image sont majoritairement blancs
async function hasWhiteBg(blob){
  const u=URL.createObjectURL(blob);
  try{const im=await loadImg(u);const w=Math.min(200,im.naturalWidth),h=Math.round(im.naturalHeight*w/im.naturalWidth);
    const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.drawImage(im,0,0,w,h);
    const d=x.getImageData(0,0,w,h).data;let n=0,t=0;
    for(let X=0;X<w;X++){for(const Y of [0,1]){t++;if(isWhitePx(d,(Y*w+X)*4))n++;}}
    for(let Y=0;Y<h;Y++){for(const X of [0,w-1]){t++;if(isWhitePx(d,(Y*w+X)*4))n++;}}
    return n/t>0.55;
  }finally{URL.revokeObjectURL(u);}
}
async function removeWhiteBg(blob,all=false){
  const u=URL.createObjectURL(blob);
  try{
    const im=await loadImg(u);const w=im.naturalWidth,h=im.naturalHeight;
    const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.drawImage(im,0,0);
    const img=x.getImageData(0,0,w,h),d=img.data,seen=new Uint8Array(w*h),st=[];
    const push=p=>{if(!seen[p]&&isWhitePx(d,p*4)){seen[p]=1;st.push(p);}};
    // pas depuis le bas : un maillot blanc coupé par le bas de la photo ne doit pas disparaître
    for(let X=0;X<w;X++)push(X);
    for(let Y=0;Y<(all?h:h*0.6);Y++){push(Y*w);push(Y*w+w-1);}
    if(all)for(let X=0;X<w;X++)push((h-1)*w+X);
    while(st.length){const p=st.pop();d[p*4+3]=0;const X=p%w;
      if(X>0)push(p-1);if(X<w-1)push(p+1);if(p>=w)push(p-w);if(p<w*(h-1))push(p+w);}
    // adoucit le contour : pixels clairs voisins du fond → semi-transparents
    for(let p=0;p<w*h;p++){if(seen[p])continue;const X=p%w;
      const nb=(X>0&&seen[p-1])||(X<w-1&&seen[p+1])||(p>=w&&seen[p-w])||(p<w*(h-1)&&seen[p+w]);
      if(nb){const i=p*4,l=(d[i]+d[i+1]+d[i+2])/3;if(l>180)d[i+3]=Math.round(255*(255-l)/75);}}
    x.putImageData(img,0,0);
    return await new Promise(ok=>c.toBlob(ok,"image/png"));
  }finally{URL.revokeObjectURL(u);}
}
async function uploadAvatarBlob(blob,safe){
  const path="photos/players/"+safe+"_"+Date.now()+"_"+Math.random().toString(36).slice(2,7)+".png";
  const res=await fetch(SUPA_URL+"/storage/v1/object/avatars/"+path,{method:"POST",
    headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":"image/png","x-upsert":"true"},body:blob});
  if(!res.ok)throw new Error("Upload "+res.status);
  return SUPA_URL+"/storage/v1/object/public/avatars/"+path;
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
      try{if(await hasWhiteBg(blob))blob=await removeWhiteBg(blob);}catch(_){}
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
select option{background:#1C1F26;color:#F2F3F5;}
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
  const url=fromMap||playerTeamLogoUrl||null;
  if(url&&teamName)primeTeamColor(teamName,url);
  return url;
}

// ── Couleurs tirées automatiquement du logo (clubs absents de TEAM_COLORS) ──
const LOGO_COLORS={};          // normTeam(nom) → {p,s}
const LOGO_COLOR_PENDING={};
try{Object.assign(LOGO_COLORS,JSON.parse(localStorage.getItem("team_logo_colors")||"{}"));}catch(e){}
function primeTeamColor(team,url){
  const k=normTeam(team);
  if(!k||LOGO_COLORS[k]||LOGO_COLOR_PENDING[k]||lookupByTeam(TEAM_COLORS,team))return;
  if(typeof Image==="undefined")return;
  LOGO_COLOR_PENDING[k]=true;
  const img=new Image();img.crossOrigin="anonymous";
  img.onload=()=>{
    try{
      const N=40,cv=document.createElement("canvas");cv.width=cv.height=N;
      const x=cv.getContext("2d");x.drawImage(img,0,0,N,N);
      const d=x.getImageData(0,0,N,N).data;const bk={};
      for(let i=0;i<d.length;i+=4){
        const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];if(a<200)continue;
        const mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx<45||mn>228)continue;
        const sat=(mx-mn)/mx;if(sat<.28)continue;
        const key=(r>>5)+","+(g>>5)+","+(b>>5);
        const e=bk[key]||(bk[key]={n:0,r:0,g:0,b:0});e.n++;e.r+=r;e.g+=g;e.b+=b;
      }
      const list=Object.values(bk).filter(e=>e.n>=3).map(e=>({n:e.n,c:[e.r/e.n,e.g/e.n,e.b/e.n]})).sort((a,b)=>b.n-a.n);
      if(!list.length)return;
      const hex=c=>"#"+c.map(v=>Math.round(v).toString(16).padStart(2,"0")).join("");
      const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
      const p=list[0].c;
      const second=list.find(e=>dist(e.c,p)>110);
      LOGO_COLORS[k]={p:hex(p),s:second?hex(second.c):"#FFFFFF",auto:true};
      try{localStorage.setItem("team_logo_colors",JSON.stringify(LOGO_COLORS));}catch(e){}
      try{window.dispatchEvent(new Event("team-colors"));}catch(e){}
    }catch(e){}
  };
  img.onerror=()=>{};
  img.src=url;
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
  return lookupByTeam(TEAM_COLORS,team)||LOGO_COLORS[normTeam(team)]||null;
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
    odds:"",stake:"",bookmaker:"",
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
        description:desc,over_under:["total","team_total","half"].includes(form.betType)?(form.ou||"Over"):null,
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
          bookmaker:savedBK||"",
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
          style={{marginTop:14,position:"relative",width:"100%",height:270,borderRadius:20,overflow:"hidden",containerType:"inline-size",
            border:"1px solid "+C.line,background:`linear-gradient(135deg,${pc}40 0%,${C.card} 70%)`,
            padding:0,color:C.text,textAlign:"left",display:"block"}}>
          <span style={{position:"absolute",top:14,right:14,zIndex:2,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
            {!isTeamBet&&form.playerObj&&(
              <button type="button" aria-label="Réglages du joueur" className="press" onClick={openPlayerSettings}
                style={{width:30,height:30,borderRadius:15,border:"none",cursor:"pointer",background:"rgba(0,0,0,.35)",
                  backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
              </button>
            )}
            <button type="button" className="press" onClick={()=>{setSearch("");setStep("search");}}
              style={{height:30,padding:"0 12px",borderRadius:15,border:"none",cursor:"pointer",fontFamily:"inherit",
                background:"rgba(0,0,0,.35)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",color:"#fff",fontSize:12.5,fontWeight:600}}>
              Changer {isTeamBet?"d'équipe":"de joueur"}
            </button>
          </span>
          {teamName&&(()=>{
            const tcol=getTeamColor(teamName);
            const stroke=(tcol&&tcol.s)||"#ffffff";
            const city=bigLabel(teamName);
            const len=Math.max(4,city.length);
            // Taille calculée pour que la ville tienne sur toute la largeur, en bas de la carte
            return(
              <span aria-hidden="true" style={{position:"absolute",left:10,bottom:-12,zIndex:0,pointerEvents:"none",
                fontSize:"min(150px, calc((100cqw - 16px) / "+(len*0.6).toFixed(2)+"))",transform:"scaleY(1.5)",transformOrigin:"left bottom",fontWeight:900,lineHeight:1,letterSpacing:-1,
                textTransform:"uppercase",whiteSpace:"nowrap",color:"transparent",WebkitTextStroke:"1.5px "+stroke+"66"}}>
                {city}
              </span>
            );
          })()}
          {teamLogoHeader&&(
            <img src={teamLogoHeader} alt="" style={{position:"absolute",right:isTeamBet?22:6,top:isTeamBet?"50%":4,transform:isTeamBet?"translateY(-50%)":"none",
              width:isTeamBet?150:160,height:isTeamBet?150:160,objectFit:"contain",opacity:isTeamBet?1:.4,pointerEvents:"none",
              filter:isTeamBet?"drop-shadow(0 8px 24px rgba(0,0,0,.45))":"none"}}/>
          )}
          {playerPhoto&&(
            // Photos NBA (larges, beaucoup d'épaules) vs EuroLeague (serrées, en hauteur) : on égalise la taille de la tête
            <img src={playerPhoto} alt={form.player}
              onLoad={e=>{const im=e.currentTarget;const r=im.naturalWidth/(im.naturalHeight||1);im.style.height=r<0.95?"80%":r<1.25?"90%":"100%";}}
              style={{position:"absolute",right:0,bottom:0,height:"100%",
              maxWidth:"55%",objectFit:"contain",objectPosition:"50% 100%"}}/>
          )}
          <span style={{position:"absolute",left:18,top:20,bottom:18,right:"45%",display:"flex",flexDirection:"column",gap:8}}>
            {(()=>{
              // Toujours sur une ligne : la police rétrécit avec la longueur (max 24 caractères)
              let full=((firstLine?firstLine+" "+secondLine:secondLine)||"").replace(/(^|[\s-])(\p{L})/gu,(m,a,b)=>a+b.toUpperCase());
              if(full.length>24)full=full.slice(0,23).trimEnd()+"…";
              const n=Math.max(full.length,8);
              return(
                <span style={{position:"relative",zIndex:1,width:"calc(100cqw - 72px)",whiteSpace:"nowrap",overflow:"visible",
                  fontSize:"clamp(16px, calc((100cqw - 76px) / "+(n*0.56).toFixed(2)+"), 28px)",fontWeight:600,letterSpacing:-.5,lineHeight:1.08,
                  textShadow:"0 2px 10px rgba(0,0,0,.55)"}}>{full}</span>
              );
            })()}
            <span style={{fontSize:13,color:"rgba(255,255,255,.6)",marginTop:-4}}>
              {(editBet?.created_at?new Date(editBet.created_at):new Date()).toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}
              {" · "}{(editBet?.created_at?new Date(editBet.created_at):new Date()).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}
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
              {teamName&&!isTeamBet&&<MiniLogo src={teamLogoHeader} label={teamName} size={22}/>}

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
              if(!isTeamBet&&(form.ou||form.line||form.stat))rows.push(<span key="l" style={{color:"#fff",fontWeight:600}}>
                {[form.ou,form.line,form.stat?statFR(form.stat):""].filter(Boolean).join(" ")}</span>);
              const W=(k,l,v)=>rows.push(<span key={k}>{l} <b style={{color:"#fff",fontWeight:600}}>{v}</b></span>);
              if(form.odds)W("o","Cote",form.odds);
              if(form.stake)W("s","Mise",eur(parseFloat(String(form.stake).replace(",","."))||0));
              if(form.tipster)W("t","Tipster",form.tipster);
              if(form.bookmaker)W("b","Bookmaker",form.bookmaker);
              return rows.length?<span style={{marginTop:"auto",display:"flex",flexDirection:"column",gap:2,fontSize:13,color:"rgba(255,255,255,.72)",whiteSpace:"nowrap"}}>{rows}</span>:null;
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

        {/* ── PARI JOUEUR : Over/Under (cases) · Ligne · Stat ── */}
        {!isTeamBet&&(<>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:14}}>
            {["Over","Under"].map(v=>{const on=form.ou===v;return(
              <button key={v} type="button" className="press" onClick={()=>f("ou",on?"":v)}
                style={{height:54,borderRadius:16,cursor:"pointer",fontFamily:"inherit",fontSize:17,fontWeight:600,
                  border:on?"none":"1.5px dashed "+C.line,background:on?btnBg:C.card,color:on?btnFg:C.sub,transition:"all .15s"}}>
                {on?"✓ ":""}{v}
              </button>);})}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1.4fr)",gap:10,marginTop:10}}>
            <label className="fld-box" style={{position:"relative"}}>Ligne
              <select aria-label="Ligne" value={form.line} onChange={e=>f("line",e.target.value)}
                style={{appearance:"none",WebkitAppearance:"none",border:"none",background:"transparent",color:form.line?C.text:C.sub,
                  fontSize:17,fontWeight:600,fontFamily:"inherit",padding:0,outline:"none",width:"100%",colorScheme:"dark"}}>
                <option value="">—</option>
                {Array.from({length:45},(_,i)=>(i+0.5).toFixed(1)).map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:C.sub,pointerEvents:"none"}}>▾</span>
            </label>
            <label className="fld-box" style={{position:"relative"}}>Stat
              <select aria-label="Type de stat" value={form.stat} onChange={e=>f("stat",e.target.value)}
                style={{appearance:"none",WebkitAppearance:"none",border:"none",background:"transparent",color:form.stat?C.text:C.sub,
                  fontSize:17,fontWeight:600,fontFamily:"inherit",padding:0,outline:"none",width:"100%",colorScheme:"dark"}}>
                <option value="">Choisir</option>
                {["Points","Rebonds","Assists","Points+Rebonds","Points+Assists",
                  "Points+Rebonds+Assists","3 Points Made","Steals","Blocks",
                  "Turnovers","Fantasy Score","Minutes"].map(s=><option key={s} value={s}>{statFR(s)}</option>)}
              </select>
              <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:C.sub,pointerEvents:"none"}}>▾</span>
            </label>
          </div>
        </>)}
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
                  background:active?btnBg:C.card,color:active?btnFg:C.sub,
                  fontSize:12,fontWeight:600,lineHeight:1.2}}>
                {pct}
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
                <button key={tp.id} type="button" className="pick-chip" onClick={()=>f("tipster",on?"":tp.name)}
                  style={on?{background:btnBg,color:btnFg,borderColor:btnBg,fontWeight:600}:undefined}>{on?"✓ ":""}
                  {tp.name}
                </button>
              );
            })}
          </div>
        ):(
          <input className="form-input" placeholder="Nom du tipster (optionnel)" value={form.tipster} onChange={e=>f("tipster",e.target.value)}/>
        )}

        {/* ── Statut ── */}
        <div className="pick-head"><span>Résultat</span></div>
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

        {/* ── Bouton collé en bas avec le gain ── */}
        <div style={{position:"sticky",bottom:"calc(64px + env(safe-area-inset-bottom))",margin:"20px -20px 0",padding:"14px 20px 12px",
          background:"linear-gradient(to top,"+C.bg+" 70%,rgba(20,22,27,0))"}}>
          {(()=>{const why=missing();return(
          <button onClick={submit} disabled={saving||!!why} className="press"
            style={{width:"100%",height:56,borderRadius:16,border:"none",cursor:why?"default":"pointer",
              background:why?"#262B35":form.status==="won"?"#16A34A":form.status==="lost"?"#DC2626":btnBg,color:why?C.sub:(form.status==="won"||form.status==="lost")?"#fff":btnFg,boxShadow:why?"none":"0 6px 24px "+(form.status==="won"?"#16A34A":form.status==="lost"?"#DC2626":btnBg)+"40",
              fontSize:16,fontWeight:600,letterSpacing:.3,opacity:saving?.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {why?why:saving?"Enregistrement…":<>
{(()=>{const st=form.status;const fmt=v=>(Math.round(v*100)/100).toLocaleString("fr-FR",{maximumFractionDigits:2})+" €";
                const g=stakeN&&oddsN?stakeN*(oddsN-1):0;const base=editBet?"MODIFIER":"AJOUTER";
                if(st==="won")return base+(g?" - GAIN "+fmt(g):" - GAGNÉ");
                if(st==="lost")return base+" - PERDU"+(stakeN?" - "+fmt(stakeN):"");
                if(st==="void")return base+" - REMBOURSÉ";
                return base+(g?" - GAIN POTENTIEL "+fmt(g):"");})()}
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
              style={{width:"100%",marginTop:22,background:"transparent",border:"none",borderBottom:"1px solid #2A2F3A",borderRadius:0,padding:"6px 4px 12px",
                display:"flex",alignItems:"flex-end",gap:12,cursor:"pointer",color:C.text,textAlign:"left",fontFamily:"inherit"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:23,fontWeight:800,letterSpacing:-.5,whiteSpace:"nowrap"}}>{m.label}</div>
                <div style={{fontSize:14,color:"#8B92A0",marginTop:4,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                  {m.bets.length} paris · {w}-{l}-{v} · <span style={{color:pColor(roi)}}>{(roi>0?"+":"")+roi.toFixed(1).replace(".",",")+"\u00a0%"}</span> · {eur(allSt,0)}
                </div>
              </div>
              <span style={{fontSize:22,fontWeight:800,color:pColor(p),flexShrink:0,letterSpacing:-.4,whiteSpace:"nowrap"}}>{money(p)}</span>
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
// ── Affiche joueur (format RDS) : bilan global sur ce joueur ─────────────────
function PlayerPoster({player:player0,bets,onClose,onChanged}){
  const[player,setPlayer]=useState(player0);
  const[gear,setGear]=useState(false);const[busy,setBusy]=useState("");const[editOpen,setEditOpen]=useState(null);
  const fileRef=useRef(null);const fileKind=useRef("photo");
  const slug=v=>(v||"x").toLowerCase().replace(/[^a-z0-9]/g,"_").slice(0,30);
  const applyPhoto=async url=>{await updatePlayer(player.id,{photo_url:url,avatar_url:url});setPlayer(p=>({...p,photo_url:url,avatar_url:url}));onChanged&&onChanged();};
  const applyLogo=async url=>{if(!player.team)return;CLUB_LOGOS_MAP[player.team]=url;await syncClubLogoAllLeagues(player.team,url).catch(()=>{});
    await fetch(SUPA_URL+"/rest/v1/players?team=eq."+encodeURIComponent(player.team),{method:"PATCH",headers:{...H},body:JSON.stringify({team_logo_url:url})}).catch(()=>{});
    setPlayer(p=>({...p,team_logo_url:url}));onChanged&&onChanged();};
  const doPaste=async kind=>{setBusy(kind);try{const url=await pasteImageToSupabase((kind==="photo"?"player_":"club_")+slug(kind==="photo"?player.name:player.team));if(url)await(kind==="photo"?applyPhoto(url):applyLogo(url));setGear(false);}catch(e){alert("Erreur : "+e.message);}setBusy("");};
  const onFile=async e=>{const f=e.target.files&&e.target.files[0];e.target.value="";if(!f)return;const kind=fileKind.current;setBusy(kind);
    try{let blob=f;if(kind==="photo"){try{if(await hasWhiteBg(blob))blob=await removeWhiteBg(blob);}catch(_){}}const url=await uploadAvatarBlob(blob,(kind==="photo"?"player_":"club_")+slug(kind==="photo"?player.name:player.team));await(kind==="photo"?applyPhoto(url):applyLogo(url));setGear(false);}catch(err){alert("Erreur : "+err.message);}setBusy("");};
  const openEdit=async()=>{try{const[l,c]=await Promise.all([fetchLeagues(),fetchClubs()]);setEditOpen({l,c});setGear(false);}catch(e){alert("Erreur : "+e.message);}};
  const tc=getTeamColor(player.team)||{p:"#3B2A6B",s:"#FDB927"};
  const pc=tc.p||"#3B2A6B",sc=tc.s||"#FDB927";
  const logo=getTeamLogo(player.team,player.team_logo_url||null);
  const mine=bets.filter(b=>b.bet_type!=="team"&&b.player===player.name);
  const won=mine.filter(b=>b.status==="won").length,lost=mine.filter(b=>b.status==="lost").length;
  const settled=mine.filter(b=>b.status==="won"||b.status==="lost");
  const profit=settled.reduce((t,b)=>t+(parseFloat(b.profit)||0),0);
  const staked=settled.reduce((t,b)=>t+(parseFloat(b.stake)||0),0);
  const wr=won+lost?won/(won+lost):0;
  const roi=staked?profit/staked*100:0;
  const photo=player.photo_url||player.avatar_url;
  const big=bigLabel(player.team)||"";
  useEffect(()=>{const k=e=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k);},[onClose]);
  const Stat=({v,l,c})=>(<div style={{textAlign:"center",padding:"8px 0 9px",borderBottom:"1.5px solid rgba(255,255,255,.3)"}}>
    <div style={{fontSize:"clamp(40px,13vw,60px)",fontWeight:900,lineHeight:.95,letterSpacing:-2,color:c||"#fff",fontStretch:"condensed",whiteSpace:"nowrap",textShadow:"0 3px 14px rgba(0,0,0,.5)"}}>{v}</div>
    <div style={{fontSize:14,fontWeight:800,letterSpacing:.6,marginTop:3}}>{l}</div></div>);
  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:420,aspectRatio:"390/560",maxHeight:"86vh",position:"relative",overflow:"hidden",borderRadius:22,containerType:"inline-size",
        background:"radial-gradient(90% 70% at 72% 35%,"+pc+" 0%,"+pc+"99 40%,#0b0d14 100%)",boxShadow:"0 24px 60px rgba(0,0,0,.6)"}}>
        <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(115deg,rgba(255,255,255,.03) 0 2px,transparent 2px 22px)"}}/>
        {big&&<div aria-hidden="true" style={{position:"absolute",right:-8,top:"6%",fontSize:"min(140px, calc(90cqw / "+Math.max(3,big.length)*0.62+"))",fontWeight:900,letterSpacing:-3,
          color:"transparent",WebkitTextStroke:"1.5px "+sc+"55",textTransform:"uppercase",whiteSpace:"nowrap",lineHeight:.85}}>{big}</div>}
        {logo&&<img src={logo} alt="" style={{position:"absolute",right:14,top:14,width:54,height:54,objectFit:"contain",zIndex:3,filter:"drop-shadow(0 4px 10px rgba(0,0,0,.5))"}}/>}
        {photo?<img src={photo} alt={player.name} style={{position:"absolute",right:"-6%",bottom:62,height:"78%",maxWidth:"80%",objectFit:"contain",objectPosition:"bottom right",zIndex:1}}/>
          :<div style={{position:"absolute",right:"8%",bottom:90,width:"45%",aspectRatio:"1",borderRadius:"50%",background:"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:80,fontWeight:900,color:"rgba(255,255,255,.25)"}}>{(player.name||"?")[0]}</div>}
        <div style={{position:"absolute",left:0,top:0,bottom:0,width:"60%",background:"linear-gradient(90deg,rgba(8,8,16,.88) 0%,rgba(8,8,16,.55) 65%,transparent)",zIndex:2}}/>
        <div style={{position:"absolute",left:"5%",top:"4%",width:"40%",zIndex:3}}>
          <Stat v={mine.length} l="PARIS"/>
          <Stat v={won+"-"+lost} l="BILAN"/>
          <Stat v={(profit>=0?"+":"")+Math.round(profit)} l="PROFIT €" c={profit>=0?"#4ade80":"#f87171"}/>
          <div style={{textAlign:"center",padding:"8px 0 0"}}>
            <div style={{fontSize:"clamp(40px,13vw,60px)",fontWeight:900,lineHeight:.95,letterSpacing:-2,whiteSpace:"nowrap",textShadow:"0 3px 14px rgba(0,0,0,.5)"}}>{won+lost?(wr>=1?"1,000":","+String(Math.round(wr*1000)).padStart(3,"0")):"—"}</div>
            <div style={{fontSize:14,fontWeight:800,letterSpacing:.6,marginTop:3}}>RÉUSSITE</div>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.7)",marginTop:6}}>ROI {(roi>=0?"+":"")+roi.toFixed(1)} %</div>
          </div>
        </div>
        <div style={{position:"absolute",left:0,right:0,bottom:0,height:62,background:sc,color:pc,zIndex:4,display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"0 14px"}}>
          <span style={{fontSize:"clamp(22px,8cqw,34px)",fontWeight:900,textTransform:"uppercase",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",letterSpacing:-.5}}>{formatName(player.name)}</span>
          {roleCode(player.role)&&<span style={{fontSize:13,fontWeight:900,padding:"2px 8px",borderRadius:6,background:pc,color:sc,flexShrink:0}}>{roleCode(player.role)}</span>}
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" style={{position:"absolute",left:12,bottom:74,zIndex:5,width:32,height:32,borderRadius:16,border:"none",background:"rgba(0,0,0,.45)",color:"#fff",fontSize:18,cursor:"pointer"}}>×</button>
        {player.id&&<button type="button" onClick={()=>setGear(g=>!g)} aria-label="Modifier" style={{position:"absolute",left:50,bottom:74,zIndex:5,width:32,height:32,borderRadius:16,border:"none",background:"rgba(0,0,0,.45)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg></button>}
        {gear&&<div onClick={e=>e.stopPropagation()} style={{position:"absolute",left:12,bottom:112,zIndex:6,width:230,background:"rgba(14,16,24,.97)",border:"1px solid rgba(255,255,255,.12)",borderRadius:14,padding:6,boxShadow:"0 12px 30px rgba(0,0,0,.6)"}}>
          {[["Photo du joueur · coller",()=>doPaste("photo"),"photo"],["Photo du joueur · fichier",()=>{fileKind.current="photo";fileRef.current&&fileRef.current.click();},"photo"],
            ...(player.team?[["Logo "+player.team+" · coller",()=>doPaste("logo"),"logo"],["Logo "+player.team+" · fichier",()=>{fileKind.current="logo";fileRef.current&&fileRef.current.click();},"logo"]]:[]),
            ["Poste, club, ligue…",openEdit,"edit"]].map(([l,fn,k])=>(
            <button key={l} type="button" disabled={!!busy} onClick={fn} style={{width:"100%",textAlign:"left",padding:"10px 12px",border:"none",borderRadius:10,background:"transparent",color:"#fff",fontSize:13.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:busy&&busy!==k?.5:1}}>{busy===k?"Envoi…":l}</button>))}
        </div>}
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{display:"none"}}/>
      </div>
      {editOpen&&<PlayerEditModal player={player} leagues={editOpen.l} clubs={editOpen.c} onClose={()=>setEditOpen(null)}
        onPastePhoto={()=>doPaste("photo")} uploadingId={busy?player.id:null}
        onSave={async(p,fields)=>{try{const extra={};if(fields.team&&fields.team!==p.team&&CLUB_LOGOS_MAP[fields.team])extra.team_logo_url=CLUB_LOGOS_MAP[fields.team];
          const merged={...fields,...extra};await updatePlayer(p.id,merged);setPlayer(x=>({...x,...merged}));setEditOpen(null);onChanged&&onChanged();}catch(e){alert("Erreur : "+e.message);}}}/>}
    </div>
  );
}
const LEAGUE_BG_DEFAULT={"NBA": "data:image/jpeg;base64,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", "NBL": "data:image/jpeg;base64,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", "EUROCUP": "data:image/jpeg;base64,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", "BCL": "data:image/jpeg;base64,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", "ACB": "data:image/jpeg;base64,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", "BETCLIC": "data:image/jpeg;base64,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", "LEGA": "data:image/jpeg;base64,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", "BBL": "data:image/jpeg;base64,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", "EUROLEAGUE": "data:image/jpeg;base64,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"};
function leagueBgDefault(name){const n=String(name||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 if(n.includes("euroleague"))return LEAGUE_BG_DEFAULT.EUROLEAGUE;if(n.includes("eurocup"))return LEAGUE_BG_DEFAULT.EUROCUP;
 if(n==="nba")return LEAGUE_BG_DEFAULT.NBA;if(n==="nbl"||n.includes("nbl "))return LEAGUE_BG_DEFAULT.NBL;
 if(n==="bcl"||n.includes("champions league"))return LEAGUE_BG_DEFAULT.BCL;if(n.includes("acb")||n.includes("liga endesa"))return LEAGUE_BG_DEFAULT.ACB;
 if(n.includes("betclic")||n.includes("elite")||n.includes("lnb")||n.includes("pro a"))return LEAGUE_BG_DEFAULT.BETCLIC;
 if(n.includes("lega")||n==="lba"||n.includes("serie a"))return LEAGUE_BG_DEFAULT.LEGA;if(n==="bbl"||n.includes("bundesliga")||n.includes("easycredit"))return LEAGUE_BG_DEFAULT.BBL;return "";}
const LEAGUE_COLORS={"NBA":{p:"#1D428A",s:"#C8102E"},"NBL":{p:"#E4002B",s:"#111111"},"BCL":{p:"#F2A900",s:"#0E2C5A"},"ACB":{p:"#FF6B00",s:"#1B2A4A"},"Betclic Elite":{p:"#E4002B",s:"#0B1F3A"},"Betclic Élite":{p:"#E4002B",s:"#0B1F3A"},"Lega A":{p:"#1E5BC6",s:"#E30613"},"LBA":{p:"#1E5BC6",s:"#E30613"},"BBL":{p:"#FF6A13",s:"#111111"},"EuroLeague":{p:"#E35205",s:"#111111"},"Euroleague":{p:"#E35205",s:"#111111"},"EuroCup":{p:"#0A7A3E",s:"#F2C400"},"WNBA":{p:"#F57B20",s:"#1B1B1B"},"NCAA":{p:"#003E7E",s:"#FFFFFF"}};
function GroupPoster({kind,name,bets,onClose}){
  const isLg=kind==="league";
  const bgKey="league_bg_"+name;
  const[bgCustom,setBg]=useState(()=>{try{return localStorage.getItem(bgKey)||"";}catch(e){return "";}});
  const bg=bgCustom||(isLg?leagueBgDefault(name):"");
  const[lgLogo,setLgLogo]=useState(null);const[gear,setGear]=useState(false);const[busy,setBusy]=useState("");
  const fileRef=useRef(null);const fileKind=useRef("bg");
  const lgRow=useRef(null);
  useEffect(()=>{if(!isLg)return;fetchLeagues().then(ls=>{const r=(ls||[]).find(l=>(l.name||"").toLowerCase()===String(name).toLowerCase());lgRow.current=r||null;
    if(r&&r.bg_url){setBg(r.bg_url);try{localStorage.setItem(bgKey,r.bg_url);}catch(e){}}}).catch(()=>{});},[name]);
  const slug=(name||"x").toLowerCase().replace(/[^a-z0-9]/g,"_");
  const saveBg=async url=>{setBg(url);try{localStorage.setItem(bgKey,url);}catch(e){}
    if(lgRow.current){try{await updateLeague(lgRow.current.id,{bg_url:url});}catch(e){console.warn("bg_url",e);}}};
  const saveLogo=async url=>{LEAGUE_LOGOS_DYNAMIC[name]=url;setLgLogo(url);if(lgRow.current)await updateLeague(lgRow.current.id,{logo:url});};
  const upload=async(blob,kind)=>{if(kind==="logo"){try{blob=await removeWhiteBg(blob,true);}catch(_){}}
    const url=await uploadAvatarBlob(blob,(kind==="bg"?"leaguebg_":"league_")+slug);await(kind==="bg"?saveBg(url):saveLogo(url));};
  const doPaste=async kind=>{setBusy(kind);try{const items=await navigator.clipboard.read();let blob=null;for(const it of items){const t=it.types.find(x=>x.startsWith("image/"));if(t){blob=await it.getType(t);break;}}
    if(!blob)throw new Error("Aucune image dans le presse-papier");await upload(blob,kind);setGear(false);}catch(e){alert("Erreur : "+e.message);}setBusy("");};
  const onFile=async e=>{const f=e.target.files&&e.target.files[0];e.target.value="";if(!f)return;const k=fileKind.current;setBusy(k);try{await upload(f,k);setGear(false);}catch(err){alert("Erreur : "+err.message);}setBusy("");};
  const cleanLogo=async()=>{const cur=lgLogo||getLeagueLogo(name);if(!cur)return alert("Aucun logo");setBusy("clean");
    try{const r=await fetch(cur);if(!r.ok)throw new Error("Téléchargement impossible");const blob=await removeWhiteBg(await r.blob(),true);const url=await uploadAvatarBlob(blob,"league_"+slug);await saveLogo(url);setGear(false);}catch(e){alert("Erreur : "+e.message);}setBusy("");};
  const tc=isLg?(LEAGUE_COLORS[name]||Object.entries(LEAGUE_COLORS).find(([k])=>k.toLowerCase()===String(name).toLowerCase())?.[1]||{p:"#3B2A6B",s:"#FDB927"}):(getTeamColor(name)||{p:"#3B2A6B",s:"#FDB927"});
  const pc=tc.p||"#3B2A6B",sc=tc.s||"#FDB927";
  const logo=isLg?(lgLogo||getLeagueLogo(name)):getTeamLogo(name,null);
  const mine=isLg?bets.filter(b=>b.game===name):bets.filter(b=>b.bet_type==="team"&&sameTeam(b.team||b.player||"",name));
  const settled=mine.filter(b=>b.status==="won"||b.status==="lost");
  const won=settled.filter(b=>b.status==="won").length,lost=settled.length-won;
  const profit=settled.reduce((t,b)=>t+(parseFloat(b.profit)||0),0),staked=settled.reduce((t,b)=>t+(parseFloat(b.stake)||0),0);
  const wr=settled.length?won/settled.length:0,roi=staked?profit/staked*100:0;
  const big=isLg?String(name).toUpperCase():(bigLabel(name)||"");
  const splitP=isLg?settled.filter(b=>b.bet_type!=="team"):[],splitT=isLg?settled.filter(b=>b.bet_type==="team"):[];
  const pr=a=>a.reduce((t,b)=>t+(parseFloat(b.profit)||0),0);
  useEffect(()=>{const k=e=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k);},[onClose]);
  const txt=sc.toLowerCase()==="#ffffff"||sc.toLowerCase()==="#fff"?pc:"#fff";
  const Stat=({v,l,c})=>(<div style={{textAlign:"center",padding:"8px 0 9px",borderBottom:"1.5px solid rgba(255,255,255,.3)"}}>
    <div style={{fontSize:"clamp(40px,13vw,60px)",fontWeight:900,lineHeight:.95,letterSpacing:-2,color:c||"#fff",whiteSpace:"nowrap",textShadow:"0 3px 14px rgba(0,0,0,.5)"}}>{v}</div>
    <div style={{fontSize:14,fontWeight:800,letterSpacing:.6,marginTop:3}}>{l}</div></div>);
  return(
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:420,aspectRatio:"390/560",maxHeight:"86vh",position:"relative",overflow:"hidden",borderRadius:22,containerType:"inline-size",color:"#fff",
        background:"radial-gradient(90% 70% at 72% 40%,"+pc+" 0%,"+pc+"99 40%,#0b0d14 100%)",boxShadow:"0 24px 60px rgba(0,0,0,.6)"}}>
        {isLg&&bg?<>
          <div style={{position:"absolute",inset:0,background:"url("+JSON.stringify(bg)+") center/cover"}}/>
          <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,.15) 40%,rgba(8,6,4,.85) 100%)"}}/>
        </>:<div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(115deg,rgba(255,255,255,.03) 0 2px,transparent 2px 22px)"}}/>}
        {big&&!(isLg&&bg)&&<div aria-hidden="true" style={{position:"absolute",right:-8,top:"6%",fontSize:"min(140px, calc(90cqw / "+Math.max(3,big.length)*0.62+"))",fontWeight:900,letterSpacing:-3,
          color:"transparent",WebkitTextStroke:"1.5px "+sc+"66",whiteSpace:"nowrap",lineHeight:.85}}>{big}</div>}
        {isLg?(logo&&<img src={logo} alt={name} style={{position:"absolute",right:"5%",top:"4%",width:"30%",height:"24%",objectFit:"contain",zIndex:3,filter:"drop-shadow(0 8px 22px rgba(0,0,0,.7)) drop-shadow(0 0 16px "+pc+"66)"}}/>)
        :logo?<img src={logo} alt={name} style={{position:"absolute",right:"4%",top:"30%",width:"52%",height:"44%",objectFit:"contain",zIndex:1,filter:"drop-shadow(0 12px 30px rgba(0,0,0,.55))"}}/>
          :<div style={{position:"absolute",right:"8%",top:"30%",width:"45%",aspectRatio:"1",borderRadius:"50%",background:"rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:70,fontWeight:900,color:"rgba(255,255,255,.3)"}}>{String(name||"?").slice(0,2).toUpperCase()}</div>}
        <div style={{position:"absolute",left:0,top:0,bottom:0,width:"55%",background:"linear-gradient(90deg,rgba(8,8,16,.88) 0%,rgba(8,8,16,.55) 65%,transparent)",zIndex:2}}/>
        <div style={{position:"absolute",left:"5%",top:"4%",width:"40%",zIndex:3}}>
          <Stat v={settled.length} l="PARIS"/>
          <Stat v={won+"-"+lost} l="BILAN"/>
          <Stat v={(profit>=0?"+":"−")+Math.abs(Math.round(profit))} l="PROFIT €" c={profit>=0?"#4ade80":"#f87171"}/>
          <div style={{textAlign:"center",padding:"8px 0 0"}}>
            <div style={{fontSize:"clamp(40px,13vw,60px)",fontWeight:900,lineHeight:.95,letterSpacing:-2,whiteSpace:"nowrap",textShadow:"0 3px 14px rgba(0,0,0,.5)"}}>{settled.length?Math.round(wr*100)+"%":"—"}</div>
            <div style={{fontSize:14,fontWeight:800,letterSpacing:.6,marginTop:3}}>RÉUSSITE</div>
            <div style={{fontSize:12,fontWeight:700,color:"rgba(255,255,255,.7)",marginTop:6}}>ROI {(roi>=0?"+":"")+roi.toFixed(1)} %</div>
          </div>
        </div>
        {isLg&&(splitP.length>0||splitT.length>0)&&<div style={{position:"absolute",right:"4%",bottom:74,zIndex:3,display:"flex",gap:6}}>
          {[["Joueurs",splitP],["Équipes",splitT]].filter(x=>x[1].length).map(([l,a])=>{const p=pr(a);return(<div key={l} style={{background:"rgba(0,0,0,.45)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,padding:"5px 9px",textAlign:"center"}}>
            <div style={{fontSize:10,fontWeight:800,letterSpacing:.5,color:"rgba(255,255,255,.7)"}}>{l.toUpperCase()}</div>
            <div style={{fontSize:13,fontWeight:900,color:p>=0?"#4ade80":"#f87171"}}>{(p>=0?"+":"−")+Math.abs(Math.round(p))} €</div></div>);})}
        </div>}
        <div style={{position:"absolute",left:0,right:0,bottom:0,height:62,background:isLg?"#111":sc,color:isLg?"#fff":(txt===pc?pc:(sc.toLowerCase()==="#111111"?"#fff":pc)),zIndex:4,display:"flex",alignItems:"center",justifyContent:"center",gap:10,padding:"0 14px"}}>
          <span style={{fontSize:"clamp(22px,8cqw,34px)",fontWeight:900,textTransform:"uppercase",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",letterSpacing:-.5}}>{name}</span>
          <span style={{fontSize:12,fontWeight:900,padding:"2px 8px",borderRadius:6,background:pc,color:isLg&&(()=>{const h=pc.replace("#","");const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);return (r*.3+g*.59+b*.11)>150;})()?"#111":"#fff",flexShrink:0}}>{isLg?"LIGUE":"ÉQUIPE"}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" style={{position:"absolute",left:12,bottom:74,zIndex:5,width:32,height:32,borderRadius:16,border:"none",background:"rgba(0,0,0,.45)",color:"#fff",fontSize:18,cursor:"pointer"}}>×</button>
        {isLg&&<button type="button" onClick={()=>setGear(g=>!g)} aria-label="Modifier" style={{position:"absolute",left:50,bottom:74,zIndex:5,width:32,height:32,borderRadius:16,border:"none",background:"rgba(0,0,0,.45)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg></button>}
        {gear&&<div style={{position:"absolute",left:12,bottom:112,zIndex:6,width:240,background:"rgba(14,16,24,.97)",border:"1px solid rgba(255,255,255,.12)",borderRadius:14,padding:6,boxShadow:"0 12px 30px rgba(0,0,0,.6)"}}>
          {[["Photo de fond · coller",()=>doPaste("bg"),"bg"],["Photo de fond · fichier",()=>{fileKind.current="bg";fileRef.current&&fileRef.current.click();},"bg"],
            ["Logo · coller (fond blanc retiré)",()=>doPaste("logo"),"logo"],["Logo · fichier (fond blanc retiré)",()=>{fileKind.current="logo";fileRef.current&&fileRef.current.click();},"logo"],
            ["Retirer le fond blanc du logo actuel",cleanLogo,"clean"],...(bgCustom?[["Remettre la photo par défaut",()=>{saveBg("");setGear(false);},"x"]]:[])].map(([l,fn,k])=>(
            <button key={l} type="button" disabled={!!busy} onClick={fn} style={{width:"100%",textAlign:"left",padding:"10px 12px",border:"none",borderRadius:10,background:"transparent",color:"#fff",fontSize:13.5,fontWeight:600,cursor:"pointer",fontFamily:"inherit",opacity:busy&&busy!==k?.5:1}}>{busy===k?"Envoi…":l}</button>))}
        </div>}
        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{display:"none"}}/>
      </div>
    </div>);
}

function PlayerStatSearch({players,bets,onChanged}){
  const[q,setQ]=useState("");const[sel,setSel]=useState(null);
  const ql=q.trim().toLowerCase();
  const res=ql.length<1?[]:players.filter(p=>(p.name||"").toLowerCase().includes(ql)).map(p=>{
    const m=bets.filter(b=>b.bet_type!=="team"&&b.player===p.name);
    const w=m.filter(b=>b.status==="won").length,l=m.filter(b=>b.status==="lost").length;
    const pr=m.filter(b=>b.status==="won"||b.status==="lost").reduce((t,b)=>t+(parseFloat(b.profit)||0),0);
    return{p,n:m.length,w,l,pr};
  }).sort((a,b)=>((a.p.name||"").toLowerCase().startsWith(ql)?0:1)-((b.p.name||"").toLowerCase().startsWith(ql)?0:1)||b.n-a.n).slice(0,8);
  return(<>
    <div style={{position:"relative",marginTop:4}}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Rechercher un joueur…" aria-label="Rechercher un joueur"
        style={{width:"100%",height:46,borderRadius:14,border:"1px solid "+C.line,background:C.card,color:C.text,fontSize:15,padding:"0 40px 0 14px",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
      {q&&<button type="button" onClick={()=>setQ("")} aria-label="Effacer" style={{position:"absolute",right:8,top:8,width:30,height:30,border:"none",background:"transparent",color:C.sub,fontSize:18,cursor:"pointer"}}>×</button>}
    </div>
    {res.length>0&&<div style={{marginTop:8,background:C.card,border:"1px solid "+C.line,borderRadius:16,overflow:"hidden"}}>
      {res.map((r,i)=>(
        <button key={r.p.id||r.p.name} type="button" onClick={()=>setSel(r.p)} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"10px 14px",border:"none",borderTop:i?"1px solid "+C.line:"none",background:"transparent",color:C.text,cursor:"pointer",textAlign:"left",fontFamily:"inherit"}}>
          <PlayerFace src={r.p.photo_url||r.p.avatar_url} name={formatName(r.p.name)} team={r.p.team} size={40}/>
          <span style={{flex:1,minWidth:0}}>
            <span style={{display:"block",fontSize:15,fontWeight:600}}>{formatName(r.p.name)}</span>
            <span style={{fontSize:12.5,color:C.sub}}>{[r.p.team,roleCode(r.p.role)].filter(Boolean).join(" · ")}{r.n?" · "+r.w+"-"+r.l:" · aucun pari"}</span>
          </span>
          {r.n>0&&<span style={{fontSize:15,fontWeight:700,color:r.pr>=0?C.green:C.red}}>{(r.pr>=0?"+":"")+Math.round(r.pr)} €</span>}
        </button>))}
    </div>}
    {ql&&res.length===0&&<div style={{padding:"14px 4px",fontSize:14,color:C.sub}}>Aucun joueur pour « {q} »</div>}
    {sel&&<PlayerPoster player={sel} bets={bets} onClose={()=>setSel(null)} onChanged={onChanged}/>}
  </>);
}

function StatsView({bets:allRaw,players=[],bkPhotos={},onPlayersChanged}){
  const[tab,setTab]=useState("overview");
  const[posterP,setPosterP]=useState(null);
  const[groupP,setGroupP]=useState(null);
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
  const Table=({rows,limit=6,empty:emp="Rien à afficher",onRow})=>{
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
            <div key={r.key} onClick={onRow?()=>onRow(r):undefined} style={{display:"grid",gridTemplateColumns:COLS,gap:6,alignItems:"center",padding:"11px 14px",borderTop:"1px solid "+C.line,cursor:onRow?"pointer":"default"}}>
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
  const byMarket=groupBy(bets,marketOf);
  const byOU=groupBy(bets.filter(b=>ouOf(b)),ouOf);
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
        <Table rows={rowsOf(byLeague,{logo:g=>getLeagueLogo(g)||null})} onRow={r=>setGroupP({kind:"league",name:r.key})}/>
        {groupP&&groupP.kind==="league"&&<GroupPoster kind="league" name={groupP.name} bets={allRaw} onClose={()=>setGroupP(null)}/>}
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
        <Table rows={rowsOf(groupBy(bets.filter(b=>b.tipster),b=>b.tipster+" · "+marketOf(b)))}/>
      </>}

      {tab==="players"&&<>
        <PlayerStatSearch players={players} bets={allRaw} onChanged={onPlayersChanged}/>
        <Title>Par poste</Title>
        <Table rows={rowsOf(byPos)} limit={10}/>
        <Title>Joueurs</Title>
        <Table rows={rowsOf(byPlayer)} limit={8} onRow={r=>{const p=players.find(x=>formatName(x.name)===r.name);if(p)setPosterP(p);}}/>
        <Title>Équipes (paris équipe)</Title>
        <Table rows={rowsOf(groupBy(bets.filter(b=>b.bet_type==="team"&&(b.team||b.player)),b=>b.team||b.player),{logo:t=>getTeamLogo(t,null)||null})} limit={8} empty="Aucun pari équipe" onRow={r=>setGroupP({kind:"team",name:r.key})}/>
        {posterP&&<PlayerPoster player={posterP} bets={allRaw} onClose={()=>setPosterP(null)} onChanged={onPlayersChanged}/>}
        {groupP&&groupP.kind==="team"&&<GroupPoster kind="team" name={groupP.name} bets={allRaw} onClose={()=>setGroupP(null)}/>}
      </>}

      {tab==="markets"&&<>
        <Table rows={rowsOf(groupBy(bets,b=>b.bet_type==="team"?"Paris équipe":"Paris joueur"))}/>
        <Title>Marchés joueur</Title>
        <Table rows={rowsOf(groupBy(playerBets,marketOf))} limit={12}/>
        <Title>Marchés équipe</Title>
        <Table rows={rowsOf(groupBy(bets.filter(b=>b.bet_type==="team"),b=>teamMarket(b)))} empty="Aucun pari équipe"/>
        {(byOU.Over||byOU.Under)&&<><Title>Over vs Under</Title><OU/></>}
        <Title>Détail Over / Under</Title>
        <Table rows={rowsOf(groupBy(bets.filter(b=>ouOf(b)),b=>ouOf(b)+" · "+marketOf(b)))} limit={10}/>
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
        <Table rows={rowsOf(groupBy(ann,marketOf))}/>
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

  const[cleaning,setCleaning]=useState("");
  async function cleanAllWhiteBg(){
    if(!window.confirm("Enlever le fond blanc de toutes les photos de joueurs qui en ont un ?\n(les anciennes photos restent dans le stockage)"))return;
    let done=0,fail=0;const list=players.filter(p=>p.photo_url||p.avatar_url);
    for(let k=0;k<list.length;k++){const p=list[k];setCleaning((k+1)+"/"+list.length);
      try{
        const r=await fetch(p.photo_url||p.avatar_url);if(!r.ok)throw 0;const b=await r.blob();
        if(!(await hasWhiteBg(b)))continue;
        const url=await uploadAvatarBlob(await removeWhiteBg(b),"player_"+p.name.replace(/[^a-z0-9]/gi,"_").toLowerCase().slice(0,30)+"_nobg");
        await updatePlayer(p.id,{photo_url:url,avatar_url:url});
        setPlayers(prev=>prev.map(pl=>pl.id===p.id?{...pl,photo_url:url,avatar_url:url}:pl));done++;
      }catch(e){fail++;}
    }
    setCleaning("");onPlayersChanged();
    showToast(done+" photo(s) détourée(s)"+(fail?" · "+fail+" impossible(s) (site qui bloque)":""));
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
      <button type="button" className="press" disabled={!!cleaning} onClick={cleanAllWhiteBg}
        style={{width:"100%",height:42,margin:"4px 0 14px",borderRadius:12,border:"1px solid "+C.line,background:C.card,
          color:cleaning?C.sub:C.blue,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
        {cleaning?"Détourage en cours… "+cleaning:"Enlever les fonds blancs des photos"}
      </button>

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


// Texte des grosses lettres : ville si ≤ 9 caractères, sinon surnom / abréviation de l'équipe
const BIG_SHORT={"Philadelphia 76ers":"SIXERS","Portland Trail Blazers":"BLAZERS","Minnesota Timberwolves":"WOLVES","Oklahoma City Thunder":"OKC","Golden State Warriors":"WARRIORS","New Orleans Pelicans":"PELICANS","San Antonio Spurs":"SPURS","Los Angeles Lakers":"LAKERS","Los Angeles Clippers":"CLIPPERS","LA Clippers":"CLIPPERS","LDLC ASVEL":"ASVEL"};
function bigLabel(team){
  if(!team)return "";
  const city=cityOf(team);
  if(city.length<=7)return city;
  const hit=Object.keys(BIG_SHORT).find(k=>sameTeam(k,team));
  if(hit)return BIG_SHORT[hit];
  const words=String(team).replace(/[^\p{L}\p{N} ]/gu," ").split(/\s+/).filter(Boolean);
  const nick=[...words].reverse().find(w=>w.length>=3&&w.length<=7&&!/^(bc|fc|kk|bk|cb|basket|basketball|club|sport)$/i.test(w));
  if(nick)return nick;
  const first=words.find(w=>w.length<=9);
  return first||words.map(w=>w[0]).join("").slice(0,5);
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
            }}>{bigLabel(team||player.team)}</div>
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
  const[,setColorTick]=useState(0);
  useEffect(()=>{const h=()=>setColorTick(t=>t+1);window.addEventListener("team-colors",h);return()=>window.removeEventListener("team-colors",h);},[]);
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
          {view==="stats"&&<StatsView bets={bets} players={players} onPlayersChanged={refreshPlayers} bkPhotos={Object.fromEntries(bookmakers.map(bk=>[bk.name,bk.logo]).filter(([,v])=>v))}/>}
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

import React, { useState, useEffect, useRef, useMemo, useCallback, memo, forwardRef, useImperativeHandle } from "react";


// Normalize datetime helper 

// Media store — base64 values populated dynamically from localStorage
// Keys: _B64_PP_LOGO_B64, LOL_ROLE_TOP, etc. and league_<name> for leagues
let _B64_PP_LOGO_B64="data:image/png;base64,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";
let _B64_AMERICAS=null;
let _B64_CHINA=null;
let _B64_PACIFIC=null;
let _B64_EMEA=null;
let _B64_WAGER=null;
let _B64_EWC=null;
let _B64_PGL=null;
let _B64_THEINTERNATIONAL=null;
let _B64_CHAMPIONS=null;

function normalizeDT(dt,id){
 const p=v=>String(v).padStart(2,"0");
 const tsToStr=ts=>{
 const d=new Date(Number(ts));
 if(isNaN(d.getTime())||d.getFullYear()<2020)return null;
 return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());
 };
 if(dt&&typeof dt==="string"&&(dt.includes("NaN")||dt.includes("undefined")))dt=null;
 // Priorite absolue : si datetime est une chaine date valide, ne jamais l ecraser
 if(dt&&typeof dt==="string"&&/^\d{4}-\d{2}-\d{2}/.test(dt)){
 const base=dt.slice(0,16);
 if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(base))return base;
 return dt.slice(0,10)+"T12:00";
 }
 if(dt&&(typeof dt==="number"||/^\d{10,}$/.test(String(dt))))return tsToStr(dt)||tsToStr(id)||"";
 // Fallback sur l id SEULEMENT si datetime est absent
 if(!dt&&id)return tsToStr(id)||"";
 return dt||"";
}
function normalizeBet(b){return{...b,datetime:normalizeDT(b.datetime,b.id)};}

// Supabase — sync sans login 
const SUPA_URL = "https://mtgryzsovqiolinobbjw.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10Z3J5enNvdnFpb2xpbm9iYmp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNDc3MTgsImV4cCI6MjA5MDYyMzcxOH0.2d4Vvm55p_SHi-wGRBrbfsxiwRh-wdqP9tDsHm_Qj3k";

// Players DB functions → voir section "Players DB (Supabase only)" ci-dessous 

async function supaFetch(path, opts) { opts=opts||{};
 const res = await fetch(SUPA_URL + path, {
 method: opts.method || "GET",
 headers: {
 "apikey": SUPA_KEY,
 "Authorization": "Bearer " + SUPA_KEY,
 "Content-Type": "application/json",
 "Prefer": opts.prefer || "",
 },
 body: opts.body,
 });
 const text = await res.text();
 if (!res.ok) throw new Error(text || String(res.status));
 try { return text ? JSON.parse(text) : null; } catch { return null; }
}


// Accès direct aux tables Supabase (synchro cloud)
async function cloudDb(path,opts={}){
 const res=await fetch(SUPA_URL+"/rest/v1/"+path,{
  method:opts.method||"GET",
  headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":"application/json","Prefer":opts.prefer||""},
  body:opts.body!==undefined?JSON.stringify(opts.body):undefined,
 });
 const t=await res.text();
 if(!res.ok)throw new Error(t||String(res.status));
 try{return t?JSON.parse(t):null;}catch(e){return null;}
}

// Full pull - loads all bets before updating UI to avoid sync issues
async function supaPullBets() {
 const SELECT="id,player,description,overUnder,odds,stake,bookmaker,status,game,league,role,team,datetime,isHeadshot,isLive,mapTag,profit,tournament,splits,updatedAt,pp_map_type,pp_line,pp_edge";
 const limit=1000;
 const page=off=>supaFetch(`/rest/v1/bets?select=${SELECT}&order=id.desc&limit=${limit}&offset=${off}`);
 const conv=batch=>(batch||[]).map(b=>{
  let splits;try{splits=b.splits?JSON.parse(b.splits):undefined;}catch(e){splits=undefined;}
  return normalizeBet({...b,splits,ppMapType:b.pp_map_type||null,ppLine:b.pp_line||null,ppEdge:b.pp_edge!=null?b.pp_edge:null});
 });
 // 5 pages en parallèle (jusqu'à 5000 paris d'un coup), puis la suite si besoin
 const first=await Promise.all([0,1,2,3,4].map(i=>page(i*limit)));
 let all=[];first.forEach(p=>{all=all.concat(conv(p));});
 let off=5*limit;
 if(first[4]&&first[4].length===limit){
  while(true){const p=await page(off);all=all.concat(conv(p));if(!p||p.length<limit)break;off+=limit;}
 }
 return all.sort((x,y)=>String(y.datetime||"").localeCompare(String(x.datetime||"")));
}

async function supaPushBets(bets) {
 const safeDT=dt=>{
 if(!dt)return dt;
 const s=String(dt);
 if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s))return s.slice(0,16);
 return dt;
 };
 const now=Date.now();
 const makeRow=({id,player,description,overUnder,odds,stake,bookmaker,
 status,game,league,role,team,datetime,isHeadshot,isLive,mapTag,profit,tournament,splits,updatedAt,
 ppMapType,ppLine,ppEdge})=>
 ({id,player,description,overUnder,odds,stake,bookmaker,status,game,league,role,
 team,datetime:safeDT(datetime),isHeadshot:!!isHeadshot,isLive:!!isLive,mapTag,profit,tournament,
 splits:splits&&splits.length>0?JSON.stringify(splits):null,
 updatedAt:updatedAt||now,archived:false,
 pp_map_type:ppMapType||null,pp_line:ppLine||null,pp_edge:ppEdge!=null?ppEdge:null});
 // Split: existing bets (have numeric id) → PATCH, new bets (no id) → POST
 const existing=bets.filter(b=>b.id&&typeof b.id==="number"||typeof b.id==="string"&&/^\d+$/.test(String(b.id)));
 const newBets=bets.filter(b=>!b.id||!(typeof b.id==="number"||/^\d+$/.test(String(b.id))));
 // PATCH existing in chunks of 500 using merge-duplicates with id
 for(let i=0;i<existing.length;i+=500){
  const rows=existing.slice(i,i+500).map(makeRow);
  await supaFetch("/rest/v1/bets",{
   method:"POST",
   body:JSON.stringify(rows),
   prefer:"resolution=merge-duplicates",
  });
 }
 // POST new bets without id
 for(let i=0;i<newBets.length;i+=500){
  const rows=newBets.slice(i,i+500).map(b=>{const r=makeRow(b);delete r.id;return r;});
  await supaFetch("/rest/v1/bets",{
   method:"POST",
   body:JSON.stringify(rows),
  });
 }
}

async function supaDeleteAllBets() {
 // Supprimer tous les enregistrements (neq trick car Supabase exige un filtre)
 await supaFetch("/rest/v1/bets?id=neq.0",{method:"DELETE"});
 await supaFetch("/rest/v1/bets?id=eq.0",{method:"DELETE"});
}
async function supaDeleteOneBet(id) {
 await supaFetch("/rest/v1/bets?id=eq."+id,{method:"DELETE"});
}
async function supaDeleteManyBets(ids) {
 if(!ids||!ids.length)return;
 await supaFetch("/rest/v1/bets?id=in.("+ids.join(",")+")",{method:"DELETE"});
}


// Icônes (remplacent les emojis perdus)
const IC_PATHS={
 check:["M5 12.5l4.5 4.5L19 7.5"],x:["M6 6l12 12","M18 6L6 18"],down:["M6 9l6 6 6-6"],up:["M6 15l6-6 6 6"],
 plus:["M12 5v14","M5 12h14"],clock:["M12 7v5l3 2","C12 12 9"],trash:["M3 6h18","M8 6V4h8v2","M19 6l-1 14H6L5 6","M10 11v6","M14 11v6"],
 trophy:["M8 21h8","M12 17v4","M7 4h10v5a5 5 0 0 1-10 0z","M17 6h3v1.5A3.5 3.5 0 0 1 16.5 11","M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11"],
 ban:["C12 12 9","M5.6 5.6l12.8 12.8"],lock:["R5 11 14 10 2","M8 11V7a4 4 0 0 1 8 0v4"],unlock:["R5 11 14 10 2","M8 11V7a4 4 0 0 1 7.6-1.8"],
 warn:["M12 3.5l9.5 16.5h-19z","M12 10v4.5","M12 17.3v.2"],flask:["M9 3h6","M10 3v6.5L4.8 18.2A1.9 1.9 0 0 0 6.4 21h11.2a1.9 1.9 0 0 0 1.6-2.8L14 9.5V3","M7.5 15h9"],
 cloud:["M7 18.5h10.5a4 4 0 0 0 .4-8A6 6 0 0 0 6.3 9.6 4.5 4.5 0 0 0 7 18.5z"],calendar:["R3.5 5 17 15.5 2.5","M3.5 10h17","M8 3v4","M16 3v4"],
 target:["C12 12 8.5","C12 12 4","C12 12 .6"],trendUp:["M3 17l6-6 4 4 8-8","M16 7h5v5"],trendDown:["M3 7l6 6 4-4 8 8","M16 17h5v-5"],
 users:["C9 8 3.5","M2.5 20a6.5 6.5 0 0 1 13 0","M16 4.5a3.5 3.5 0 0 1 0 7","M18 14.5a6.5 6.5 0 0 1 3.5 5.5"],
 wallet:["R3 6 18 14 3","M3 10h18","M16 15h2"],
 swords:["M14.5 17.5L3 6V3h3l11.5 11.5","M13 19l6-6","M16 16l4 4","M19 21l2-2","M9.5 6.5L13 3h3v3l-3.5 3.5","M5 16l3 3","M7 21l-2-2"],
};
const Ic=memo(function Ic({n,s=12,c="currentColor",w=2.2}){
 const ps=IC_PATHS[n]||[];
 return(<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" style={{display:"inline-block",verticalAlign:"middle",flexShrink:0}}>
  {ps.map((d,i)=>{
   if(d[0]==="C"){const [x,y,r]=d.slice(1).trim().split(/\s+/).map(Number);return <circle key={i} cx={x} cy={y} r={r}/>;}
   if(d[0]==="R"){const [x,y,w2,h,rx]=d.slice(1).trim().split(/\s+/).map(Number);return <rect key={i} x={x} y={y} width={w2} height={h} rx={rx}/>;}
   return <path key={i} d={d}/>;
  })}
 </svg>);
});


// ── Suivi : composants de mise en page ──
const SV={card:"#0f1524",line:"rgba(255,255,255,.06)",sub:"#8b93a7",text:"#eef1f7"};
function SuiviIcon({n,img,emoji,color="#a78bfa"}){
 return(<span style={{width:34,height:34,borderRadius:10,background:color+"1f",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
  {img?<img src={img} alt="" style={{width:20,height:20,objectFit:"contain",borderRadius:4}}/>:<Ic n={n} s={17} c={color} w={2}/>}
 </span>);
}
function SuiviHead({n,img,color,title,sub,badge,open,onClick,right,flat}){
 const Tag=onClick?"button":"div";
 return(
  <Tag onClick={onClick} style={{width:"100%",display:"flex",alignItems:"center",gap:12,padding:"13px 14px",background:SV.card,border:"1px solid "+SV.line,borderRadius:open||flat?"16px 16px 0 0":16,cursor:onClick?"pointer":"default",textAlign:"left",fontFamily:"Inter,sans-serif",transition:"border-radius .15s"}}>
   <SuiviIcon n={n} img={img} color={color}/>
   <div style={{flex:1,minWidth:0}}>
    <div style={{display:"flex",alignItems:"center",gap:7}}>
     <span style={{fontSize:15,fontWeight:650,color:SV.text,letterSpacing:-.2}}>{title}</span>
     {badge}
    </div>
    {sub&&<div style={{fontSize:12,color:SV.sub,marginTop:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{sub}</div>}
   </div>
   {right}
   {onClick&&<span style={{color:"#5b6478",display:"flex",transition:"transform .2s",transform:open?"rotate(180deg)":"none"}}><Ic n="down" s={16} w={2.4}/></span>}
  </Tag>
 );
}
const SV_BODY={background:SV.card,border:"1px solid "+SV.line,borderTop:"none",borderRadius:"0 0 16px 16px",padding:"12px 14px 14px"};
function SuiviLabel({children}){return <div style={{fontSize:12,fontWeight:700,color:"#6b7489",letterSpacing:.4,margin:"22px 4px 8px"}}>{children}</div>;}

// Game Logos & GameLogo component 
const _B64_LOL="data:image/png;base64,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";
const _B64_DOTA2="data:image/png;base64,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";
const _B64_CS2="data:image/png;base64,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";
const _B64_VALORANT="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAYAAAChS3wfAAABWGlDQ1BJQ0MgUHJvZmlsZQAAeJx9kLFLw1AQxr9WpaB1EB0cHDKJQ5SSCro4tBVEcQhVweqUvqapkMZHkiIFN/+Bgv+BCs5uFoc6OjgIopPo5uSk4KLleS+JpCJ6j+N+fO+74zggOW5wbvcDqDu+W1zKK5ulLSX1jAS9IAzm8Zyur0r+rj/j/T703k7LWb///43Biukxqp+UGcZdH0ioxPqezyXvE4+5tBRxS7IV8onkcsjngWe9WCC+JlZYzagQvxCr5R7d6uG63WDRDnL7tOlsrMk5lBNYxA48cNgw0IQCHdk//LOBv4BdcjfhUp+FGnzqyZEiJ5jEy3DAMAOVWEOGUpN3ju53F91PjbWDJ2ChI4S4iLWVDnA2Rydrx9rUPDAyBFy1ueEagdRHmaxWgddTYLgEjN5Qz7ZXzWrh9uk8MPAoxNskkDoEui0hPo6E6B5T8wNw6XwBA6diE8HYWhMAAAqxSURBVHic7ZpdjF3XVcd/a+1zzv2asSdOYohKUhLSKkrzVTUlBgIRL8ALT5WKkEorHpCQkApS1YLEC4r4UJJCSqqG5oFWUEIloPQBlSJV0FR2YyexZ+zGkzT2JK6L6zj+iMczd+7XOXstHs6919fj8dw7nhmLCpa077nn3rP3Xnvt9fFfax8599GPOROSrbrXSTv+LyV3/7Ffw6bp/wUw0VMuOIaJ4zLy80i7keRXNEdW/Xr5fjyNEUBp9VECnTRBVBF3BEewVYzcGFpzTlccxxy6SUpLhas91to0RgCCu1FkCV964zXm2zlZUiOqceP3fW0SwCQiFrH6NF86vsDs8iIhzYg+XgjrCqBU9wJNEr5zcZE//d5BzmQV8JSCdGtWsEmKakSPJLUd/Pvpd3j26DyXkiphMgUYowEugGLmNOo38Z3zF3hu7gia3oQDNrS3G+dNXaxvgoKr4RE0bfBis81fzR6iXa2TxAAecJGx4403AQQXx2Mkq07xjz98g78/+X2ySgM3QT0gyIQWt3mSfgNBo1DVjFNuPPnKXn4ghoYAbphMtiUTPSUiOBDd6darfP61l9l79hz1bJroQlS5IjpsJ8lgInfcUhaTBp89fIBDzSUa1Slw2xAvG9bcmlVYocLjh/cyZ8tImhFvoD90FEPAnGKqznPHjvJvp98mmZqhiN0Nj7euAARHPZRhRowUIQpI2uB4DDx56BDng1AxpQSVhothsnVRovQ1A37KzxxBazW+8fYP+du3jpNO3YJGGXokdTAxZAIWNqQBbo65E3GqWZ29777LF+bnyLMqEp0opSDEFWFrbEL6TA4EET0nSyvsa7Z4au4weVJFh6Bg43Nel/MWETCoZDv56okT/MN/v0nRqFFE6wtA2Gqn4EAUR7KUH1iPp1/ZzxkXJChmdt36dt3Ry8VxF6w6zRePzrFv8TyVapVoBdezE+vRcDRRFpMGT83NMtvuUMkqYHFTY68PhBjY1ZVg1937LSfDuSQZTxx8mdfyLllIyMUmisETkxtqEavt5Muvz/Ott0+j9QoejaFnEAH3/pIGRjNeLzaFX1wLzA0qNV7r9nhi9iDnkmlUFPPN7cxwDkqBS6POv55a4Pljr+LTDTR638ltTtCbMAFwQun4ojGdTbPv7CU+P3+Ebq1RxmPffCQQd6RSZd/SCn89N0e3MkNiCeBE1REsen00RgB9NfKr5SwOwbRUdQGLRtLYwT+/eYyvLZwgTO3EzTARbFU8Wp3RjbYygDrijnvEJPCmKc8cOMgFU1DFXHB0JBUutQQBoQx/AojriDNe2yQmE8C1/pVSDZ1ykWI5vXqDLx49wn9duEio1vE4sMu1R14rvXWUXAUXYbFa4+m5Q7zcWSbNauRYuSEuyJr82cgMyjgTmRgKj1M0wXEiQZUzacKfvXKAuTyShSoSN2ZpJgGNAtUdPPfGPN84+zahPo25oLb+WBs1iIk5izHCup49YJIg0amGCgu9nL+cfYnT1QqoT+wPHJDYIa1nfP1HJ/i7Y8dIqtMkRSRqzrqFjhKeYBvwPWPqASUOS1y4vVIn9w4qSd+uiqsYx8u/Cjdq1Sr7z7/Ds987SK82DdbPKtUICOqXJ3eB4KEMup4TqhkvLrd5an6emNRQM0zoQ/Kr1gwYwY0ozkwS+IlqCoMNk1EgffUGrp8L9J2Jdnt8/J6HeLjeoJ03kVHfchUzAyGAT83w/Mk3+MqJN/HGLWABPKHoO84RZEHUCG6kUuNHscLjh/ZzOipJyPp7PgDFV07slFiglyYkKz0+cfcHuHfHDrqRMikYQ2OSIQE1PPa4Jwh//ME93BZ7RI8ET9YdWNxJc4FsB8++fphvLb6DVQJt72FS7uhgb5SI0yMgLNYbPD53gCPNFvVQp8D6MXekXcEjSAjkK0v8+k+9h9+66y7S1hIeSvFsSgBDrxycPF9iz00zfPKBPWSdHAvjHGMkaiTzhHNB+dzsfo53cggVCo+lSkt/Pz2gltKr7eDZ+Vf5jzOnaFSnMWK/1HI5Pqz+LqrknTY/v3OGT9//II3uEqaGaJwoHxmbDoOg7iQSiCuX+MhP38Fv/Mz78WYT7QvBZS3UlyCuFAJ1rXJ8pcufz83T1ArBofAyl3BRCoQ4Pc3Xz57h+YUFGvXdpC6k4qQEEk1INJBIeU01kEgg05RY5Nyjyp986FFu84i4oa4kUdEJ6lQTRwEBEjJoLfH79z7IY7t/knZ3EVVQE2y9CGFOpVbj2xdP8fTrh+k0dpFFITi4KZVQY987Z/nsd1+g7QV5e5l2u0m3vUK3s0Kv3Sxbp7x2Wsv02iu0W8vUuk3+4MN7uK9aoRdzdMJS2IDWN+RVFENEXdiZL/OZDz7Mhb2XmCtyKmkF7NrSdoTcnXpjF/9y4iTvvflWfue2O5HWxb6jClS6bT529/tI0gyxwMBrD84grhywtJ08Ftx9yy5+bvfNdFeWqGDECcDPKMmGDkfFUU+wGEmrNV5cavF7+1/g3UqVtChhaVRHbbWXL3lSAjhUe0s88ehj/OrMTnrtFqpCJaSEEHBzVLRvfAyvq9gefotEOr0cFUO9YCN76u4bEwBeqpcLRI9obZqvnjzNXxx5mbxWRawskA64Xl2ScndUlSJG7kiMZ37pl7lXlTzmpS269TH8lf3WU2pBylT4OmhTp8Mqgdhe4Tdvv5OP3/U+YmcRT6zc/XL4q/uo4u6kIeGtLjx56CUupoHMM8QTggSCgIpO3K538UOeNtNZNKK9C/zufQ/xK7feTtFuI5r0Ed21+7k7tUrGd88v8rlXj9Kr1wlG/7jjxtLGBCAGYgiGYigQMWa6bT794MM8UKnTtg4u5SFqH5kPuw/zgb4JSb3GPy0c5ysnTqBTM7jF/qgD2OojUHZ7aNMnWkJCL3a4K0n5ww/v4T29DrkVfUO+hhp46SiDO0w1+MKrs3zz4jkqWQM3tracNoY2KYDyGFoViqLFozt38Kn7H2Jq5RIErr1+AHFCIWSW0AzKU4de4kiREJIKNix0br8gNicA77t6MUSdotXiI3feySfefw9FcxlNwyqrHrzAUL5sUQSIBkmacbLd4onZvZzVjEAY9pBtPnPblAAUUBfUFXVFVPBOm9++7wF+bdduitYKJCmKlumvDw62bHhvYkSHSrXKS+fO8cz8LK36NGL96u6YpGuztGWn2g7kCuaRW7vOHz38GPdnFbrFCkEVVEADSAANJYTW8jaV0qUm09N87dQCXz69gO+YQWMEybeKxTVpywRQJkWGhUhuHe7IIp965Gd5b96h0zyLtZaxlSa20saaHYpmm9jsYM0O3ZUW7dYy+XKLtiX8zYEX+M9TbxGqtRFcsT20ZfrlQHBKv6BO0e3wyNRNPP2hX+StxfPkmpRIUsqc3kewcpkal1mciAIddgFtdxJRdBtfx9kyAZTg53LZyTUgvS6P3LyLX9h9K+6RIT72yzgf92HprYx+ggUoikje6217HNg2D+MeMaBd5FD0htWpErr65RqC+6ojuLIqLCKEQV7x46ABq0lk4GBK5sNoJad/qlT6jVUdfXCgMbLsbVSD7YsxZa2rf+P4FeUsGWaWl58dACQQLwudA+FspxlsY5BdDYVHy9IC/feOWPXEaP8bAYi3F2WsQ6PZ4o16wWot+j//svT/AI83JhKRucp6AAAAAElFTkSuQmCC";
const _B64_LEC="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAAAI10lEQVR4nO2by29cVx3HP79zzr1jj91EvFqKWkEDlViBKjaIFRIrJMQfADseO/YVG7rioQohISEQGx6qBBUbBO0GhfBQFdpGCW0TO3ZsjzN2Mh7bY3vsGXs8j3vOj8W9dhIXJy5zHNciX2lkyzNz7u9+7+98f69j4fbflf9jmJM24KTxiICTNuCk8YiAkzbgpPGIgJM24KRx+gjQ4hUJp4sAVYwD6wygIMMveXoIUJDUUV5aY2xhBUkdaBh62dNDQAjY0RR7ZR4/X0dKKejwe+H0EACosYQbt9DMoxLB/zllBEhQZGaRfPPHUcLTQ4A1mE4XrdTAGkCicHA6CFAFZzEbLfytNXAmyv6HSAQYVdIYCx0CUZDEYevraLuFOJcToMPrwHAEqEKakNbXGX9jChlNIUTKUu5+wqpIYpGbKwzYZfjgdwfDe4AR6PQIl6fB2jiuqeQuXyi9ohgjyFwNCEQKAECkLaBi8NOL2EGWEzIERBVxQrmxRanT219PQsDP1vIPBY2WDg9PgCrqLGF+GdPazRV6COM0BNz4GMmP/4C9cAUeKwNgt3vofB3Fgo/nBVE8QJwjLG9gGptI4hiKAWNw3S69164SXp/CGcBZ7HoLvbWKkAAhWj0UxQPECjTbuMVGrtD/qxCqQpJgVjbQWgOdqJK0u5g0RWoNwkYLcOAhSiVErDxAIAz6SGUJs1epHcRRxFEVUocsrBL6XbRSx9bW0fESzNbQ0EWIlwNAFAIEg+bJ6Vyt2Jv3Ph1RzZOXB23cItzZmRpKIGxuIlOL2JESMllFC2IlYiCM4wFaLFVZwvT9u73TGsqtLm6Q3Z8EBREhFGqvDNC3blDKAuFaFcXddb04GDIRKn4EBbH4WytIq1vkA8VnfMCOlyn96PeMXpxAxkffrRF7Lm0E08/QyhKKoDj08ixpfYMwUysICMX13i8aIHux26L1dczaOhSRQBRwBtfu0Hvldbh4HZvc28gQFEkdFvKCZ6eDVlcAB1iyySru5b/hN7YQKdbFIHqI1rxHRIgCxSux+E4bs7ACSZ4RqgZMKcHeXGawtkY2UcHtdkGKy6pinOXMbJ10tw9pgmm0CPUNBAviCOtt2t/7NRoUiVMA3oNI1WAAIwgDqNQwzuTCpyBpgrlaQenBXB3T2NonCARnHPr8L3ETVezZMUqLq2StFiqmIFEYdDNUhX1xed9owD5ywzwCM0vcnQpZEfSteRRDWNnAVOpQSpAQILXYlXX6b15FrtzAJin+xi2UHmLumCYxk/8DiNYPUFUUi87Wsb1C7UWQbg+drAAJwXfh+gIkDvUBmzrM3BJZ1iZcvoH1Hp1aRA+GuWMc4MdriKgiOEJ1GbO5k9cEicU2WujcElIoOBM3SYobksQhk4soBj+5QFJfgxuLQKSq8giISgA4fH0dqW+As0jiMDeX8Y0mWIfH4qequO5urhkhoNML+feW1xl56QK+UgfidHyPgogEFMv1t2F+CXEO4yzm+gKqPRCD4PA3l7FrbSRNMd0+WlkCHCHA1gu/JWu084LnIZ1bidoTFBGUDJleQKzFaiBcrZABefx26FoLqstQTpHmDnp7FXCgQjbIHtqT30P0pqhH0IkqVhXZ6eEnqkBRIVoD2sXM3ILREmalSVht5jFf9VjV/jDEJUAVKBGu3yTp7pI0NglztbtcWlACem0BmyZwu0HoFYlR5KHnURHZA3I39wsN3PIWMldD203E7Km6ApYwvYjJAlJbB+chdbl3mCNUjJHhYi8ozuKzLezEPGF6gUAfZCx/MyhKSqgskTa3CdNVQrYFWT7pKXJDlBSxZv87x6kL0QlAIZASfvEKodkGxtjPa1QRLH61iZtdxHzxOUZLDs0UGi10eY2w2MAvbRB8m4BgGAGbQIjZDL+D+ASEgGGEnX9dQxHkYEw3Bg278M48vW9/Bf/VLyDGIJnH9ga4VodkYQXemkPPX2Jw8RqDziYwhpgkXyPiLolPAFBUQbmdB93X5J1fvb4InS5hbQuM4EopfSv0xlLsc+eQz38a+60v42aqpL85T/+lv5LtDoh69xznbFAP2buaS6VOziMDn2eM42VGK0uMT1axqUN3dvEbLXrbHTrnnqL70+8w+qvnsQ7y/RSPhGPygPsg5ClzmLmNabZhJMWVS/Diy0i7Q/LqD+h1enlXCZBOj34IuGc+itghW+7/BQ9/OqyKSArLG9jKEnKmTKlSp//Pd+i/OU06cxtGS/veE4wBa9F+/65QGg9xBiNIEb/zQPbgq1oy34V/V3BnxrHnL+Nbm/jdNvqPd3ICDvYNi/xARBACKnG2QgQC8galKO8hickrfrk0Sckrgz9fLJqgQjh/mTQLh0y+BaMGygmqfnjTGZYAI9DLyD7+OPaz51DtFKc3HoA9HXh7nrE/XSS8OYWQoliyN6ZIb60haXKPiFox6KCHffIJ+MynoNMfehALUZqigX5icd//BqXHzkK2A87e3ztVERL6iw3a33wR3y3Cm0nwzXW4Mg0jd501ECFkHuv7pN/9Ot0nPgADHyVtjnA+wMB2l53PPUv68guUnvkYmjVBfa7k9rD8XiAovc3tot8viFiQAK9dw1rL3vbCB7RcYuTnz7P7tS+RtXaO5mlHgET5lxkBsoB5bIRyo4X52R/JfneB/voqYPPcXlzhsntk3Hm6+wMWK+hgl5FzT+Ev/IRekr8nCsYZwkiKbu9GLZjiELAH75HU4cbKlKrLmL9cgvOXyN6uElabZPT253s5EXs3Evb/JjhGHv8g/tUfsvuJJ6HbR0xOhIYQ7cnvIS4BUGSAAdIUWx7BZhmu3sRUashsDV1soI0mbGyjWQZpipwtYz50Bnn6I+gnn8Q/+zS9D4/jIxyCehDiE7AH1VzERPKRd+qwzu2P0owP+eBDBIwhFIoeMk/oZzDIjsWsgzi+VFgEbPEEBxnaH5Dp3nibfe9XFWS/HSR5UmUk6j6/Hx5OLSD33tBBl9NDfn8YOB0nRY8Rjwg4aQNOGo8IOGkDThqPCDhpA04a/wEhdj0YfE1rkgAAAABJRU5ErkJggg==";
const _B64_LPL="data:image/png;base64,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";
const _B64_LCK="data:image/png;base64,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";
const _B64_LCS="data:image/png;base64,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";

const L={
 LoL:_B64_LOL,
 Dota2:_B64_DOTA2,
 CS2:_B64_CS2,
 Valorant:_B64_VALORANT,
 LEC:_B64_LEC,
 LPL:_B64_LPL,
 LCK:_B64_LCK,
 LCS:_B64_LCS,
 Americas:_B64_AMERICAS,
 China:_B64_CHINA,
 Pacific:_B64_PACIFIC,
 EMEA:_B64_EMEA,
 "VCT EMEA":_B64_EMEA,
 Americas:_B64_AMERICAS,
 "VCT China":_B64_CHINA,
 Pacific:_B64_PACIFIC,
 EMEA:_B64_EMEA,
 "VCT EMEA":_B64_EMEA,
 Americas:_B64_AMERICAS,
 "VCT China":_B64_CHINA,
 Pacific:_B64_PACIFIC,
 EMEA:_B64_EMEA
,Wager:_B64_WAGER};
const GameLogo=memo(function GameLogo({game,size=18}){
 const src=L[game];
 if(!src) return <span style={{fontSize:size-2,display:"block",width:size,height:size}}></span>;
 return <img src={src} alt={game} style={{width:size,height:size,objectFit:"cover",display:"block",flexShrink:0}}/>;
});

// Bankroll Chart 
function BankrollChart({points,h=150}){
 if(!points||points.length<2)return(
 <div style={{height:h,display:"flex",alignItems:"center",justifyContent:"center",color:"#6B7280",fontSize:13}}>Pas assez de donnees</div>
 );
 const W=400,H=h,pad={t:10,b:22,l:44,r:42};
 const vals=points.map(p=>p.v);
 const min=Math.min(...vals),max=Math.max(...vals);
 const range=max-min||1;
 const yMin=min-range*0.04;
 const yMax=max+range*0.12;
 const yRange=yMax-yMin;
 const cx=W-pad.l-pad.r,cy=H-pad.t-pad.b;
 const px=i=>pad.l+i/(points.length-1)*cx;
 const py=v=>pad.t+cy-(v-yMin)/yRange*cy;
 const linePath="M"+points.map((p,i)=>px(i)+","+py(p.v)).join(" L");
 const fillPath="M"+px(0)+","+py(points[0].v)+" "+points.map((p,i)=>"L"+px(i)+","+py(p.v)).join(" ")+" L"+px(points.length-1)+","+(pad.t+cy)+" L"+px(0)+","+(pad.t+cy)+" Z";
 const up=points[points.length-1].v>=points[0].v;
 const color=up?"#00E676":"#EF4444";
 const glowId="glow_"+Math.abs(points[0].v|0);
 // Smart y-ticks: 5 levels with nice round numbers
 const tickStep=(()=>{const raw=range/4;const mag=Math.pow(10,Math.floor(Math.log10(Math.abs(raw))||0));const nice=[1,2,2.5,5,10];for(const n of nice){if(raw<=n*mag)return n*mag;}return nice[nice.length-1]*mag;})();
 const tickStart=Math.ceil(yMin/tickStep)*tickStep;
 const yTicks=[];for(let t=tickStart;t<=yMax+tickStep*0.1;t+=tickStep){if(yTicks.length<8)yTicks.push(Math.round(t));}
 const xSamples=[0,Math.floor((points.length-1)/3),Math.floor((points.length-1)*2/3),points.length-1];
 // ATH = max val and its position
 const athIdx=vals.indexOf(max);
 const athVal=max;
 const athX=px(athIdx);
 const athY=py(athVal);
 const currentVal=points[points.length-1].v;
 const currentX=px(points.length-1);
 const currentY=py(currentVal);
 const distFromATH=athVal-currentVal;
 const isAtATH=distFromATH<0.5;
 return(
 <svg width="100%" viewBox={"0 0 "+W+" "+H} preserveAspectRatio="none" style={{overflow:"visible"}}>
 <defs>
 <linearGradient id="cf" x1="0" y1="0" x2="0" y2="1">
 <stop offset="0%" stopColor={color} stopOpacity="0.52"/>
 <stop offset="45%" stopColor={color} stopOpacity="0.18"/>
 <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
 </linearGradient>
 <filter id={glowId} x="-20%" y="-60%" width="140%" height="220%">
 <feGaussianBlur stdDeviation="2" result="blur1"/>
 <feGaussianBlur stdDeviation="5" result="blur2"/>
 <feMerge><feMergeNode in="blur2"/><feMergeNode in="blur1"/><feMergeNode in="SourceGraphic"/></feMerge>
 </filter>
 <filter id={glowId+"pt"} x="-400%" y="-400%" width="900%" height="900%">
 <feGaussianBlur stdDeviation="7" result="blur"/>
 <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
 </filter>
 <filter id={glowId+"ath"} x="-500%" y="-500%" width="1100%" height="1100%">
 <feGaussianBlur stdDeviation="8" result="blur"/>
 <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
 </filter>
 </defs>
 {yTicks.filter(v=>py(v)>pad.t&&py(v)<pad.t+cy).map((v,i)=>(
 <g key={i}>
 <line x1={pad.l} y1={py(v)} x2={W-pad.r} y2={py(v)} stroke={v===0?"rgba(255,255,255,.12)":"rgba(255,255,255,.05)"} strokeWidth={v===0?"1":"0.8"} strokeDasharray={v===0?"none":"3,6"}/>
 <text x={pad.l-3} y={py(v)+3.5} textAnchor="end" fontSize="8.5" fill={v===0?"rgba(255,255,255,.25)":v>0?"rgba(0,230,118,.35)":"rgba(239,68,68,.35)"} fontWeight="600">{v>0?"+":""}{v.toFixed(0)}$</text>
 </g>
 ))}
 {xSamples.filter(i=>points[i]&&points[i].dt).map((i,k)=><text key={k} x={px(i)} y={H-2} textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,.18)">{points[i].dt.slice(5,10).replace("-","/")}</text>)}
 {/* Gradient fill */}
 <path d={fillPath} fill="url(#cf)"/>
 {/* Soft underline for depth */}
 <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.18"/>
 {/* Main glow line */}
 <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter={"url(#"+glowId+")"}/>
 {/* ATH dashed line */}
 <line x1={pad.l} y1={athY} x2={W-pad.r} y2={athY} stroke="rgba(255,215,80,.22)" strokeWidth="0.8" strokeDasharray="4,5"/>
 <text x={W-pad.r+3} y={athY+4} textAnchor="start" fontSize="8" fill="rgba(255,215,80,.45)" fontWeight="700">ATH</text>
 {/* ATH halo point */}
 {!isAtATH&&<>
 <circle cx={athX} cy={athY} r="14" fill="rgba(255,215,80,.04)" filter={"url(#"+glowId+"ath)"}/>
 <circle cx={athX} cy={athY} r="5" fill="rgba(255,215,80,.18)" filter={"url(#"+glowId+"ath)"}/>
 <circle cx={athX} cy={athY} r="3" fill="rgba(255,215,80,.55)"/>
 <circle cx={athX} cy={athY} r="1.2" fill="rgba(255,240,150,.9)"/>
 </>}
 {/* Current point */}
 <circle cx={currentX} cy={currentY} r="12" fill={color} opacity="0.07" filter={"url(#"+glowId+"pt)"}/>
 <circle cx={currentX} cy={currentY} r="6" fill={color} opacity="0.22" filter={"url(#"+glowId+"pt)"}/>
 <circle cx={currentX} cy={currentY} r="4" fill={color}/>
 <circle cx={currentX} cy={currentY} r="1.8" fill="#fff" opacity="0.95"/>
 {distFromATH>1&&(
 <g>
 <line x1={currentX} y1={currentY-7} x2={currentX} y2={athY+4} stroke="rgba(255,255,255,.12)" strokeWidth="1" strokeDasharray="2,3"/>
 <text x={currentX-6} y={Math.max(athY+14,(currentY+athY)/2+4)} textAnchor="end" fontSize="9" fill="rgba(255,255,255,.4)" fontWeight="700">{"-"+distFromATH.toFixed(0)+"$"}</text>
 </g>
 )}
 </svg>
 );
}

// CandleChart — graphique style bourse 
function CandleChart({points,h=155,tf="day"}){
 if(!points||points.length<2)return(
 <div style={{height:h,display:"flex",alignItems:"center",justifyContent:"center",color:"#6B7280",fontSize:13}}>Pas assez de données</div>
 );
 // Group points into candles by time frame
 function groupCandles(pts,tfKey){
 const groups={};
 pts.forEach((p,i)=>{
 const dt=p.dt||"";
 let key=dt;
 if(tfKey==="week"&&dt){const d=new Date(dt);const day=d.getDay();const diff=d.getDate()-day+(day===0?-6:1);d.setDate(diff);key=d.toISOString().slice(0,10);}
 else if(tfKey==="month"&&dt)key=dt.slice(0,7);
 else key=dt||String(i);
 if(!groups[key])groups[key]={open:p.v,high:p.v,low:p.v,close:p.v,date:key};
 else{groups[key].high=Math.max(groups[key].high,p.v);groups[key].low=Math.min(groups[key].low,p.v);groups[key].close=p.v;}
 });
 return Object.values(groups).sort((a,b)=>a.date.localeCompare(b.date));
 }
 const candles=groupCandles(points,tf);
 if(candles.length<2)return(<div style={{height:h,display:"flex",alignItems:"center",justifyContent:"center",color:"#6B7280",fontSize:13}}>Pas assez de données</div>);
 const W=400,H=h,pad={t:10,b:22,l:44,r:10};
 const allVals=candles.flatMap(c=>[c.high,c.low]);
 const vMin=Math.min(...allVals),vMax=Math.max(...allVals);
 const vRange=(vMax-vMin)||1;
 const yMin=vMin-vRange*0.06,yMax=vMax+vRange*0.1;
 const yRange=yMax-yMin;
 const cx=W-pad.l-pad.r,cy=H-pad.t-pad.b;
 const py=v=>pad.t+cy-(v-yMin)/yRange*cy;
 const cw=Math.max(2,Math.floor(cx/candles.length)-2);
 const tickStep=(()=>{const raw=vRange/4;const mag=Math.pow(10,Math.floor(Math.log10(Math.abs(raw))||0));const nice=[1,2,2.5,5,10];for(const n of nice){if(raw<=n*mag)return n*mag;}return nice[nice.length-1]*mag;})();
 const tickStart=Math.ceil(yMin/tickStep)*tickStep;
 const yTicks=[];for(let t=tickStart;t<=yMax+tickStep*0.1;t+=tickStep){if(yTicks.length<7)yTicks.push(Math.round(t));}
 return(
 <svg width="100%" viewBox={"0 0 "+W+" "+H} preserveAspectRatio="none" style={{overflow:"visible"}}>
 {/* Grid */}
 {yTicks.filter(v=>py(v)>pad.t&&py(v)<pad.t+cy).map((v,i)=>(
 <g key={i}>
 <line x1={pad.l} y1={py(v)} x2={W-pad.r} y2={py(v)} stroke={v===0?"rgba(255,255,255,.12)":"rgba(255,255,255,.05)"} strokeWidth={v===0?"1":"0.7"} strokeDasharray={v===0?"none":"3,6"}/>
 <text x={pad.l-3} y={py(v)+3.5} textAnchor="end" fontSize="8.5" fill={v===0?"rgba(255,255,255,.25)":v>0?"rgba(0,230,118,.35)":"rgba(239,68,68,.35)"} fontWeight="600">{v>0?"+":""}{v.toFixed(0)}$</text>
 </g>
 ))}
 {/* Candles */}
 {candles.map((c,i)=>{
 const up=c.close>=c.open;
 const col=up?"#00E676":"#EF4444";
 const x=pad.l+i*(cx/candles.length)+cx/candles.length/2;
 const bodyTop=py(Math.max(c.open,c.close));
 const bodyBot=py(Math.min(c.open,c.close));
 const bodyH=Math.max(1.5,bodyBot-bodyTop);
 const hw=Math.max(1.5,cw/2-1);
 return(
 <g key={i}>
 {/* Wick */}
 <line x1={x} y1={py(c.high)} x2={x} y2={bodyTop} stroke={col} strokeWidth="1.2" opacity="0.8"/>
 <line x1={x} y1={bodyBot} x2={x} y2={py(c.low)} stroke={col} strokeWidth="1.2" opacity="0.8"/>
 {/* Body */}
 <rect x={x-hw} y={bodyTop} width={hw*2} height={bodyH} fill={up?"rgba(0,230,118,.7)":"rgba(239,68,68,.7)"} stroke={col} strokeWidth="0.8" rx="0.5"/>
 </g>
 );
 })}
 {/* X date labels */}
 {[0,Math.floor(candles.length/3),Math.floor(candles.length*2/3),candles.length-1].filter(i=>candles[i]).map((i,k)=>(
 <text key={k} x={pad.l+i*(cx/candles.length)+cx/candles.length/2} y={H-2} textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,.18)">{(candles[i].date||"").slice(5,10).replace("-","/")}</text>
 ))}
 </svg>
 );
}


function ProfitChart({points,h=110}){
 if(!points||points.length<1)return(
 <div style={{height:h,display:"flex",alignItems:"center",justifyContent:"center",color:"#6B7280",fontSize:12}}>Pas assez de données</div>
 );
 const W=400,H=h,padL=38,padB=18,padT=6,padR=6;
 const vals=points.map(p=>p.v);
 const maxAbs=Math.max(...vals.map(Math.abs),1);
 const cw=W-padL-padR;
 const ch=(H-padT-padB)/2; // half height for zero line
 const zeroY=padT+ch;
 const barW=Math.max(2,Math.floor(cw/vals.length)-1);
 const xSamples=points.length<=7?points.map((_,i)=>i):[0,Math.floor(points.length/2),points.length-1];
 return(
 <svg width="100%" viewBox={"0 0 "+W+" "+H} preserveAspectRatio="none" style={{overflow:"visible"}}>
 <defs>
 <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00E676" stopOpacity=".7"/><stop offset="100%" stopColor="#00E676" stopOpacity=".15"/></linearGradient>
 <linearGradient id="pr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EF4444" stopOpacity=".15"/><stop offset="100%" stopColor="#EF4444" stopOpacity=".7"/></linearGradient>
 </defs>
 {/* zero line */}
 <line x1={padL} y1={zeroY} x2={W-padR} y2={zeroY} stroke="#374151" strokeWidth="1"/>
 <text x={padL-3} y={zeroY+4} textAnchor="end" fontSize="8" fill="#6B7280">0</text>
 <text x={padL-3} y={padT+5} textAnchor="end" fontSize="8" fill="#00E676">+{maxAbs.toFixed(0)}</text>
 <text x={padL-3} y={H-padB+4} textAnchor="end" fontSize="8" fill="#EF4444">-{maxAbs.toFixed(0)}</text>
 {/* bars */}
 {points.map((p,i)=>{
 const x=padL+i*(cw/vals.length)+1;
 const ratio=p.v/maxAbs;
 const barH=Math.abs(ratio)*ch;
 const y=p.v>=0?zeroY-barH:zeroY;
 return<rect key={i} x={x} y={y} width={barW} height={Math.max(1,barH)} fill={p.v>=0?"url(#pg)":"url(#pr)"} rx="1"/>;
 })}
 {/* x labels */}
 {xSamples.filter(i=>points[i]).map((i,k)=>(
 <text key={k} x={padL+i*(cw/vals.length)+barW/2} y={H-2} textAnchor="middle" fontSize="8" fill="#6B7280">{points[i].dt.slice(5,10).replace("-","/")}</text>
 ))}
 </svg>
 );
}

// Players DB (Supabase only) 
// Structure: { id, name, game, league, role, team, avatar_url, avatar_file }
// avatar_url → priorité 1 : URL externe
// avatar_file → priorité 2 : nom de fichier dans Supabase Storage (bucket "avatars")
// Sinon → avatar par défaut (initiales)

const AVATARS_BUCKET = SUPA_URL + "/storage/v1/object/public/avatars/";

function getAvatarSrc(player) {
 if ((player&&player.photo_url)) return player.photo_url;
 if ((player&&player.avatar_url)) return player.avatar_url;
 if ((player&&player.avatar_file)) return AVATARS_BUCKET + encodeURIComponent(player.avatar_file);
 return null; // → afficher les initiales
}

// ── Player Supabase helpers ──────────────────────────────────────

async function _playerFetch(path, opts={}) {
 const headers = {
  "apikey": SUPA_KEY,
  "Authorization": "Bearer " + SUPA_KEY,
  "Content-Type": "application/json",
  ...(opts.headers||{}),
 };
 const res = await fetch(SUPA_URL + "/rest/v1/" + path, {...opts, headers});
 if (!res.ok) {
  let err;
  try { err = await res.json(); } catch(e) { err = {message: await res.text()}; }
  throw new Error(err.message || JSON.stringify(err));
 }
 const text = await res.text();
 return text ? JSON.parse(text) : null;
}

async function supaFetchPlayers() {
 const fields = "id,name,game,league,role,team,photo_url,avatar_url,avatar_file,team_logo_url";
 const limit = 1000;
 let all = []; let offset = 0;
 while (true) {
  const batch = await _playerFetch(
   `players?select=${fields}&order=name.asc&limit=${limit}&offset=${offset}`
  ).catch(() => null);
  if (!batch || batch.length === 0) break;
  all = [...all, ...batch];
  if (batch.length < limit) break;
  offset += limit;
 }
 return all;
}

async function supaUploadFile(file, folder) {
 // Upload a File object directly to Supabase Storage
 const ext = file.name.split('.').pop().toLowerCase() || 'png';
 const fileName = folder + '/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
 const res = await fetch(SUPA_URL + '/storage/v1/object/photos/' + fileName, {
  method: 'POST',
  headers: {
   'apikey': SUPA_KEY,
   'Authorization': 'Bearer ' + SUPA_KEY,
   'Content-Type': file.type || 'image/png',
   'x-upsert': 'true',
  },
  body: file,
 });
 if (!res.ok) throw new Error('Upload failed: ' + await res.text());
 return SUPA_URL + '/storage/v1/object/public/photos/' + fileName;
}


async function supaUploadPhoto(file, folder) {
 // Upload image to Supabase Storage and return permanent public URL
 const ext = file.name.split('.').pop() || 'png';
 const fileName = folder + '/' + Date.now() + '_' + Math.random().toString(36).slice(2) + '.' + ext;
 const res = await fetch(SUPA_URL + '/storage/v1/object/photos/' + fileName, {
  method: 'POST',
  headers: {
   'apikey': SUPA_KEY,
   'Authorization': 'Bearer ' + SUPA_KEY,
   'Content-Type': file.type || 'image/png',
   'x-upsert': 'true',
  },
  body: file,
 });
 if (!res.ok) throw new Error('Upload failed: ' + await res.text());
 return SUPA_URL + '/storage/v1/object/public/photos/' + fileName;
}

async function supaUploadPhotoFromUrl(url, folder) {
 if(!url||url.includes('/storage/v1/object/public/'))return url;
 const name = Date.now()+'_'+Math.random().toString(36).slice(2);

 // Method 1: Edge Function (server-side, no CORS)
 try{
  const r = await fetch(SUPA_URL+'/functions/v1/rehost-image', {
   method:'POST',
   headers:{'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({url,name,folder})
  });
  if(r.ok){const d=await r.json();if(d.url)return d.url;}
 }catch(e){}

 // Method 2: Direct fetch with CORS
 try{
  const r = await fetch(url,{mode:'cors'});
  if(r.ok){
   const blob = await r.blob();
   const file = new File([blob],'photo.'+((blob.type||'').split('/')[1]||'png'),{type:blob.type||'image/png'});
   return await supaUploadPhoto(file,folder);
  }
 }catch(e){}

 // Method 3: Canvas crossOrigin (last resort)
 return new Promise((resolve)=>{
  const img=new Image();img.crossOrigin='anonymous';
  img.onload=async()=>{
   try{
    const c=document.createElement('canvas');c.width=img.naturalWidth||200;c.height=img.naturalHeight||200;
    c.getContext('2d').drawImage(img,0,0);
    c.toBlob(async(blob)=>{
     if(!blob)return resolve(url);
     try{resolve(await supaUploadPhoto(new File([blob],'photo.png',{type:'image/png'}),folder));}
     catch(e){resolve(url);}
    },'image/png');
   }catch(e){resolve(url);}
  };
  img.onerror=()=>resolve(url);
  img.src=url;
 });
}


async function supaUpsertPlayer(data) {
 const name = (data.name || "").trim(); // Keep original case
 const nameLower = name.toLowerCase();
 const game = data.game || "LoL";
 if (!name) throw new Error("Nom du joueur requis");

 const payload = {
  name: name, // original case preserved
  game,
  league: data.league || "",
  role:   data.role   || "",
  team:   data.team   || "",
  photo_url:   data.photo_url  || data.avatar_url || null,
  avatar_url:  data.avatar_url || null,
  avatar_file: data.avatar_file || null,
 };
 if(data.team_logo_url !== undefined) payload.team_logo_url = data.team_logo_url || null;

 if (data.id) {
  // Update existing row by id — PATCH never sends id in body
  try {
   const rows = await _playerFetch(
    `players?id=eq.${encodeURIComponent(data.id)}`,
    { method: "PATCH", headers: { "Prefer": "return=representation" }, body: JSON.stringify(payload) }
   );
   return Array.isArray(rows) ? rows[0] : rows;
  } catch(e) {
   if (e.message.includes("23505")) {
    // Duplicate (name,game) with different id → delete the duplicate, then retry
    await fetch(
     SUPA_URL + `/rest/v1/players?name=eq.${encodeURIComponent(name)}&game=eq.${encodeURIComponent(game)}&id=neq.${encodeURIComponent(data.id)}`,
     { method: "DELETE", headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY } }
    ).catch(() => {});
    const rows = await _playerFetch(
     `players?id=eq.${encodeURIComponent(data.id)}`,
     { method: "PATCH", headers: { "Prefer": "return=representation" }, body: JSON.stringify(payload) }
    );
    return Array.isArray(rows) ? rows[0] : rows;
   }
   throw e;
  }
 } else {
  // New player — POST without id
  try {
   const rows = await _playerFetch(
    "players",
    { method: "POST", headers: { "Prefer": "return=representation" }, body: JSON.stringify(payload) }
   );
   return Array.isArray(rows) ? rows[0] : rows;
  } catch(e) {
   if (e.message.includes("23505")) {
    // Already exists — update it instead
    const rows = await _playerFetch(
     `players?name=eq.${encodeURIComponent(name)}&game=eq.${encodeURIComponent(game)}`,
     { method: "PATCH", headers: { "Prefer": "return=representation" }, body: JSON.stringify(payload) }
    );
    return Array.isArray(rows) ? rows[0] : rows;
   }
   throw e;
  }
 }
}

async function supaDeletePlayer(id) {
 if (!id) return;
 await _playerFetch(
  `players?id=eq.${encodeURIComponent(id)}`,
  { method: "DELETE" }
 ).catch(e => { console.warn("supaDeletePlayer failed:", e.message); });
}

async function supaUpdateMediaRow(rowId, data) { /* remplacé par la synchro cloud */ }

async function supaGetMedia(key) {
 const res = await fetch(SUPA_URL+"/rest/v1/media_store?key=eq."+encodeURIComponent(key)+"&select=value", {
  headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY}
 }).catch(()=>null);
 if(!res||!res.ok)return null;
 const rows = await res.json();
 return rows&&rows[0]?rows[0].value:null;
}

async function supaSetMedia(key, value) { /* remplacé par la synchro cloud */ }

async function supaGetAllMedia() {
 const res = await fetch(SUPA_URL+"/rest/v1/media_store?select=key,value", {
  headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY}
 }).catch(()=>null);
 if(!res||!res.ok)return {};
 const rows = await res.json();
 const out = {};
 (rows||[]).forEach(r=>{try{out[r.key]=JSON.parse(r.value);}catch(e){}});
 return out;
}


async function supaUpdateTeamLogo(allLogos) { /* remplacé par la synchro cloud */ }




async function supaUploadAvatar(file, playerName) {
 // Upload vers Supabase Storage bucket "avatars"
 const ext = file.name.split(".").pop();
 const filename = playerName.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now() + "." + ext;
 const res = await fetch(SUPA_URL + "/storage/v1/object/avatars/" + filename, {
 method: "POST",
 headers: {
 "apikey": SUPA_KEY,
 "Authorization": "Bearer " + SUPA_KEY,
 "Content-Type": file.type,
 "x-upsert": "true",
 },
 body: file,
 });
 if (!res.ok) throw new Error(await res.text());
 return filename; // → stocker dans avatar_file
}

const DEFAULT_BK=["Stake","Roobet","Rainbet","BCGame","Duelbits","Duel","Yeet","Thunderpick","Winna","Thrill","Spartans","Gambana","Betpanda","Toshi","Shock","Qzino","Wager","LuckyFun","Betbolt"];
// Sites dont la devise est différente de USD — taux vers USD
const BK_CURRENCY={"Wager":{currency:"CAD",rate:0.7213,label:"CAD → USD"}};

const BK_LOGOS={};

const ALL_GAMES=["LoL","Dota2","CS2","Valorant"];
const LEAGUES_BY_GAME={
 LoL:["LCK","LEC","LCS","LPL"],
 Valorant:["Americas","EMEA","Pacific"],
};

// LoL Role Logos 
let LOL_ROLE_TOP=null;
let LOL_ROLE_MID=null;
let LOL_ROLE_BOT=null;
let LOL_ROLE_SUP=null;
let LOL_ROLE_JUN=null;
function getLolRoleLogo(role){
 if(!role)return null;
 const r=role.toLowerCase().replace(/[^a-z]/g,"");
 if(r==="top"||r==="toplaner")return LOL_ROLE_TOP;
 if(r==="mid"||r==="midlaner"||r==="midlane")return LOL_ROLE_MID;
 if(r==="bot"||r==="botlaner"||r==="botlane"||r==="adc")return LOL_ROLE_BOT;
 if(r==="support"||r==="sup")return LOL_ROLE_SUP;
 if(r==="jungle"||r==="jungler"||r==="jun"||r==="jgl")return LOL_ROLE_JUN;
 return null;
}
const RoleLogo=memo(function RoleLogo({role,size=16}){
 const src=getLolRoleLogo(role);
 if(!src)return null;
 return <img src={src} alt={role} style={{width:size,height:size,borderRadius:3,objectFit:"contain",flexShrink:0}}/>;
});
const FmtProfit=memo(function FmtProfit({v,fontSize=12,fontWeight=800}){
 const pos=v>=0;
 const color=pos?"#00E676":"#f87171";
 const abs=Math.abs(Math.round(v));
 return(
 <span style={{display:"inline-flex",alignItems:"baseline",fontVariantNumeric:"tabular-nums",fontFeatureSettings:'"tnum"',fontSize,fontWeight,color,justifyContent:"flex-end",letterSpacing:"-0.2px"}}>
 <span style={{display:"inline-block",width:"0.65em",textAlign:"center",flexShrink:0}}>{pos?"+":"−"}</span>
 <span style={{minWidth:"3ch",textAlign:"right"}}>{abs.toLocaleString("fr-CA")}</span>
 <span style={{opacity:.7,marginLeft:1,fontSize:fontSize*0.85}}>$</span>
 </span>
 );
});
const FR_MONTHS=["Janvier","Fevrier","Mars","Avril","Mai","Juin","Juillet","Aout","Septembre","Octobre","Novembre","Decembre"];
const FR_DAYS=["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
const MAP_TAGS=["Map 1","Map 2","Map 3","Map 4","Map 5"];
const QUICK_STAKES=[25,50,62,75,87,100];
const GAME_CFG={
 LoL:{accent:"#C89B3C",bg:"rgba(200,155,60,0.08)",border:"rgba(200,155,60,0.25)",logo:"https://mtgryzsovqiolinobbjw.supabase.co/storage/v1/object/public/players/game-logos/lol.png"},
 Dota2:{accent:"#C23C2A",bg:"rgba(194,60,42,0.08)",border:"rgba(194,60,42,0.25)",logo:"https://mtgryzsovqiolinobbjw.supabase.co/storage/v1/object/public/players/game-logos/dota2.png"},
 CS2:{accent:"#F0A500",bg:"rgba(240,165,0,0.08)",border:"rgba(240,165,0,0.25)",logo:"https://mtgryzsovqiolinobbjw.supabase.co/storage/v1/object/public/players/game-logos/cs2.webp"},
 Valorant:{accent:"#FF4655",bg:"rgba(255,70,85,0.08)",border:"rgba(255,70,85,0.25)",logo:"https://mtgryzsovqiolinobbjw.supabase.co/storage/v1/object/public/players/game-logos/valorant.jpg"},
};
const STATUS_CFG={
 pending:{label:"En attente",color:"#3B82F6",bg:"rgba(96,165,250,0.1)"},
 won:{label:"Gagné",color:"#00E676",bg:"rgba(34,197,94,0.1)"},
 lost:{label:"Perdu",color:"#EF4444",bg:"rgba(248,113,113,0.1)"},
};
const EMPTY_FORM={player:"",overUnder:"",description:"",odds:"",stake:"",bookmaker:"",status:"pending",autoInfo:null,datetime:"",isHeadshot:false,mapTag:"Map 1",isLive:false,mapLocked:false,ppMapType:"",ppDescription:"",calcBkLine:"",calcPPLine:"",calcMapType:"Map 1+2",calcOU:"Over"};
const EMPTY_MAP_ROW={odds:"",stake:"",status:"pending",enabled:true};

function toDateKey(dt){
 if(!dt)return "";
 try{const s=String(dt).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:"";}
 catch{return "";}
}
function nowDT(){
 // Toujours utiliser l'heure de Montréal (America/Toronto)
 const p=v=>String(v).padStart(2,"0");
 const now=new Date();
 const mtl=new Date(now.toLocaleString("en-CA",{timeZone:"America/Toronto"}));
 return mtl.getFullYear()+"-"+p(mtl.getMonth()+1)+"-"+p(mtl.getDate())+"T"+p(mtl.getHours())+":"+p(mtl.getMinutes());
}
function calcProfit(status,stake,odds){
 if(status==="won")return stake*(odds-1);
 if(status==="lost")return -stake;
 return 0;
}
function fmtMonthFR(d){
 if(!d||d==="?")return "?";
 try{const p=d.split("-");if(p.length<2)return d;return FR_MONTHS[parseInt(p[1])-1]+" "+p[0];}catch(e){return d;}
}
function fmtDayFR(d){
 if(!d||d==="?")return "?";
 try{
 const p=d.split("-");if(p.length<3)return d;
 const dt=new Date(d+"T12:00:00");
 if(isNaN(dt.getTime()))return d;
 return FR_DAYS[dt.getDay()]+" "+parseInt(p[2])+" "+FR_MONTHS[parseInt(p[1])-1]+" "+p[0];
 }catch(e){return d;}
}
function fmtDate(dt){
 if(!dt)return "";
 // Si c'est un timestamp numérique, convertir d'abord
 if(typeof dt==="number"||(typeof dt==="string"&&/^\d{10,}$/.test(dt))){
 const d=new Date(typeof dt==="number"?dt:parseInt(dt));
 if(isNaN(d.getTime()))return "";
 const p=v=>String(v).padStart(2,"0");
 dt=d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());
 }
 try{
 const p=String(dt).split("T");
 const dp=p[0].split("-");
 if(dp.length<3)return "";
 const day=dp[2],m=dp[1],y=dp[0];
 const tp=p[1]?p[1].slice(0,5):"";
 return day+"/"+m+"/"+y+(tp?" - "+tp:"");
 }catch(e){return "";}
}


// NumPad 
function NumPad({value,onChange,placeholder,step,id}){
 const isDecimal=step==="0.01"||step==="0.5"||step==="1"; // all fields allow decimals
 return(
 <div style={{position:"relative"}}>
 <input
 id={id}
 type="text"
 inputMode="decimal"
 placeholder={placeholder}
 value={value||""}
 onChange={e=>{
 // Accept both . and , as decimal separator
 let v=e.target.value.replace(/,/g,".");
 v=v.replace(/[^0-9.]/g,"");
 const parts=v.split(".");
 if(parts.length>2)return;
 onChange(v);
 }}
 onBlur={e=>{
 // Convert shorthand odds only (e.g. 175 → 1.75) — NOT for stake fields (step="1")
 if(step==="1")return;
 if(step!=="0.01")return;
 let v=e.target.value.replace(/,/g,".").replace(/[^0-9.]/g,"");
 if(v&&!v.includes(".")&&parseInt(v)>=100){
 onChange((parseInt(v)/100).toFixed(2));
 }
 }}
 style={{
 width:"100%",
 background:"transparent",
 WebkitAppearance:"none",
 MozAppearance:"textfield",
 border:"none",
 padding:"12px 14px",
 color:value?"#eef3ff":"#5a6478",
 fontSize:20,
 fontFamily:"'Inter',system-ui,sans-serif",
 fontWeight:value?700:400,
 outline:"none",
 boxSizing:"border-box",
 paddingRight:value?42:14,
 WebkitTextFillColor:value?"#E5E7EB":"#6B7280",
 }}
 />
 {value&&(
 <button onMouseDown={e=>{e.preventDefault();onChange("");}}
 style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,0.1)",border:"none",borderRadius:"50%",width:22,height:22,color:"rgba(255,255,255,0.5)",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Inter"}}>
 ×
 </button>
 )}
 </div>
 );
}

// PlayerAC 
// Récents: stockés dans localStorage "v7_recent_players" (max 6)
function getRecentPlayers(){try{return JSON.parse(localStorage.getItem("v7_recent_players")||"[]");}catch(e){return[];}}
function addRecentPlayer(key){
 try{
 const prev=getRecentPlayers().filter(k=>k!==key);
 localStorage.setItem("v7_recent_players",JSON.stringify([key,...prev].slice(0,6)));
 }catch(e){}
}

const PlayerAC=forwardRef(function PlayerAC({value,onChange,allPlayers,onConfirm,activeTourneys={},betFreq={}},fwdRef){
 const [open,setOpen]=useState(false);
 const [inputVal,setInputVal]=useState(value);
 const ref=useRef(null);
 const inputRef=useRef(null);
 const debounceRef=useRef(null);
 const [recents,setRecents]=useState(()=>getRecentPlayers());
 useImperativeHandle(fwdRef,()=>({focus:()=>{if(inputRef.current){inputRef.current.focus();setOpen(true);}}}));

 useEffect(()=>{setInputVal(value);},[value]);

 const isConfirmed=useMemo(()=>!!allPlayers[inputVal.toLowerCase().trim()],[allPlayers,inputVal]);

 const sugg=useMemo(function(){
 const q=inputVal.toLowerCase().trim();
 if(q.length<1){
 // Sans query → joueurs les plus betés en premier (fusion récents + fréquence)
 // Prendre top 8 par fréquence de bets
 const topByFreq=Object.entries(betFreq)
 .filter(([k])=>allPlayers[k])
 .sort((a,b)=>b[1]-a[1])
 .slice(0,8)
 .map(([k])=>k);
 // Fusionner: récents d'abord, puis top fréquence, dédupliqué
 const merged=[...recents,...topByFreq.filter(k=>!recents.includes(k))].slice(0,7);
 return merged
 .filter(k=>allPlayers[k])
 .map(k=>[k,allPlayers[k],recents.includes(k)?'recent':'freq']);
 }
 const all=Object.entries(allPlayers);
 // Priorité 1: commence par q, trié par fréquence desc (cherche aussi par nom sans préfixe)
 const starts=all
 .filter(([k,p])=>k.startsWith(q)||k.includes(":"+q)||(p.name&&p.name.toLowerCase().startsWith(q)))
 .sort((a,b)=>(betFreq[b[0]]||0)-(betFreq[a[0]]||0));
 // Priorité 2: contient q
 const contains=all
 .filter(([k,p])=>!starts.find(s=>s[0]===k)&&(k.includes(q)||(p.name&&p.name.toLowerCase().includes(q))))
 .sort((a,b)=>(betFreq[b[0]]||0)-(betFreq[a[0]]||0));
 return [...starts,...contains].slice(0,7).map(([k,p])=>[k,p,'search']);
 },[allPlayers,inputVal,recents,betFreq]);

 useEffect(()=>{
 function h(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}
 document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
 },[]);

 const handleChange=useCallback(function(e){
 const v=e.target.value;
 setInputVal(v);setOpen(true);
 clearTimeout(debounceRef.current);
 debounceRef.current=setTimeout(()=>{
 onChange(v);
 // Auto-select only if exactly 1 match and not already exact
 const q=v.toLowerCase().trim();
 if(q.length>=2){
 var matches=Object.keys(allPlayers).filter(function(k){return k.startsWith(q);});
 // Only auto-select if exactly 1 match and input is not already a complete name
 if(matches.length===1&&matches[0]!==q){
 const key=matches[0];
 setInputVal(key);onChange(key);setOpen(false);
 addRecentPlayer(key);setRecents(getRecentPlayers());
 setTimeout(()=>onConfirm&&onConfirm(),60);
 }
 }
 },300);
 },[onChange,allPlayers,onConfirm]);

 const handleSelect=useCallback(function(key){
 setInputVal(key);onChange(key);setOpen(false);
 addRecentPlayer(key);
 setRecents(getRecentPlayers());
 // Focus auto sur champ cote après sélection joueur
 setTimeout(()=>onConfirm&&onConfirm(),60);
 },[onChange,onConfirm]);

 return(
 <div ref={ref} style={{position:"relative"}}>
 <div style={{position:"relative"}}>
 <input ref={inputRef} className="add-ifield" placeholder="ex: Faker, ZywOo..." value={inputVal} autoComplete="off"
 onChange={handleChange} onFocus={()=>{setRecents(getRecentPlayers());setOpen(true);}}
 style={{paddingRight:isConfirmed?42:14,height:48,background:"transparent",border:"none",outline:"none",borderRadius:0,boxShadow:"none"}}/>
 {isConfirmed&&(
 <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",justifyContent:"center",width:24,height:24,background:"rgba(34,197,94,0.15)",borderRadius:"50%",border:"1.5px solid #00E676",pointerEvents:"none"}}>
 <span style={{color:"#00E676",fontSize:14,lineHeight:1}}><Ic n="check" s={13}/></span>
 </div>
 )}
 </div>
 {open&&sugg.length>0&&(
 <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#111827",border:"1px solid #1F2937",borderRadius:10,zIndex:500,overflow:"hidden",boxShadow:"0 8px 28px rgba(0,0,0,0.7)"}}>
 {inputVal.trim().length<1&&<div style={{padding:"6px 13px 2px",fontSize:10,color:"#6B7280",fontWeight:600,letterSpacing:1,textTransform:"uppercase"}}>Mes joueurs</div>}
 {sugg.map(([key,p,tag])=>{
 const isSelected=key===inputVal.toLowerCase().trim();
 const freq=betFreq[key]||0;
 return(
 <div key={key} onMouseDown={e=>{e.preventDefault();handleSelect(key);}}
 style={{display:"flex",alignItems:"center",gap:9,padding:"9px 13px",cursor:"pointer",borderBottom:"1px solid #1F2937",background:isSelected?"rgba(124,58,237,0.08)":"transparent"}}
 onMouseEnter={e=>e.currentTarget.style.background="rgba(124,58,237,0.1)"}
 onMouseLeave={e=>e.currentTarget.style.background=isSelected?"rgba(124,58,237,0.08)":"transparent"}>
 {tag==="recent"&&<span style={{fontSize:10,color:"#6B7280"}}><Ic n="clock" s={11}/></span>}
 {freq>0&&<span style={{fontSize:9,color:"#A78BFA",background:"rgba(124,58,237,0.1)",padding:"1px 5px",borderRadius:4,fontWeight:700,flexShrink:0}}>{freq}p</span>}
 <GameLogo game={p.game} size={16}/>
 <div style={{flex:1}}>
 <span style={{fontWeight:700,fontSize:14,color:"#E5E7EB"}}>{capName(p.name||key)}</span>
 <span style={{fontSize:11,color:"#9CA3AF",marginLeft:7}}>{p.team}</span>
 </div>
 {(()=>{
 const t=activeTourneys[p.game];
 const hasTourney=t&&(!t.end||new Date(t.end)>=new Date());
 return(
 <div style={{display:"flex",gap:4,alignItems:"center"}}>
 {p.league&&!hasTourney&&<span style={{fontSize:10,fontWeight:600,color:"#A78BFA",background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.2)",padding:"1px 5px",borderRadius:4}}>{p.league}</span>}
 {hasTourney&&<span style={{fontSize:10,fontWeight:600,color:"#F59E0B",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.25)",padding:"1px 5px",borderRadius:4,display:"inline-flex",alignItems:"center",gap:3}}>{(()=>{const tl=_GLOBAL_MEDIA_STORE&&_GLOBAL_MEDIA_STORE["tourney_"+(p.game||"")+"_"+t.name];return tl?<img src={tl.replace('__FAILED__','')} alt={t.name} style={{width:12,height:12,objectFit:"contain",borderRadius:1}} onError={e=>e.target.style.display="none"}/>:null;})()}{t.name}</span>}
 <span style={{fontSize:10,fontWeight:600,color:"#3B82F6",background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.15)",padding:"1px 5px",borderRadius:4}}>{p.role}</span>
 {isSelected&&<span style={{color:"#00E676",fontSize:14,fontWeight:700,marginLeft:2}}><Ic n="check" s={13}/></span>}
 </div>
 );
 })()}
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
});




// PlayerSearchPanel 


// EditBetModal component 
const EditBetModal=memo(function EditBetModal({bet,bookmakers,onSave,onClose,calcProfit,allPlayers,activeTourneys={},savedTourneys={}}){
 const ebGame=bet.game||"CS2";
 const ebIsHS=bet.isHeadshot;
 // Build kills options
 let ebOpts=[];
 if(ebIsHS) ebOpts=Array.from({length:16},(_,i)=>(i+2.5).toFixed(1)+" Headshots");
 else if(ebGame==="LoL") ebOpts=Array.from({length:20},(_,i)=>(i+0.5).toFixed(1)+" Kills");
 else if(ebGame==="CS2") ebOpts=Array.from({length:16},(_,i)=>(i+7.5).toFixed(1)+" Kills");
 else if(ebGame==="Dota2") ebOpts=Array.from({length:18},(_,i)=>(i+1.5).toFixed(1)+" Kills");
 else ebOpts=Array.from({length:16},(_,i)=>(i+7.5).toFixed(1)+" Kills");
 // Extract current kills line: "Over 14.5 Kills" → "14.5 Kills"
 const ebDescParts=bet.description&&bet.description.split(" ")||[];
 const initKills=ebDescParts.length>=2?ebDescParts.slice(1).join(" "):"";
 if(initKills&&!ebOpts.includes(initKills))ebOpts=[initKills,...ebOpts];

 const [ebBK,setEbBK]=useState(bet.bookmaker||"");
 const [ebPlayer,setEbPlayer]=useState(bet.player||"");
 const [ebOU,setEbOU]=useState(bet.overUnder||"Over");
 const [ebLine,setEbLine]=useState(initKills);
 const [ebOdds,setEbOdds]=useState(String(bet.odds||""));
 const [ebStake,setEbStake]=useState(String(bet.stake||""));
 const [ebMap,setEbMap]=useState(bet.mapTag||"Map 1");
 const [ebLive,setEbLive]=useState(!!bet.isLive);
 const [ebTournament,setEbTournament]=useState(bet.tournament||"");
 // Normaliser datetime pour le champ input
 const normDatetime=(dt)=>{
 if(!dt)return "";
 if(typeof dt==="number"){const d=new Date(dt);const p=v=>String(v).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());}
 if(typeof dt==="string"&&/^\d{10,}$/.test(dt)){const d=new Date(parseInt(dt));const p=v=>String(v).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());}
 return String(dt).slice(0,16);
 };
 const [ebDatetime,setEbDatetime]=useState(normDatetime(bet.datetime)||"");

 // Tournois disponibles pour ce jeu
 const ebTourneyOptions=useMemo(function(){
 const active=activeTourneys[ebGame];
 const saved=savedTourneys[ebGame]||[];
 const all=new Set(saved);
 if(active&&active.name)all.add(active.name);
 if(bet.tournament)all.add(bet.tournament);
 return [...all];
 },[ebGame,activeTourneys,savedTourneys,bet.tournament]);

 const labelStyle={fontSize:11,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:5,display:"block"};
 const fieldStyle={width:"100%",background:"#111827",border:"1px solid #1F2937",borderRadius:10,padding:"10px 12px",color:"#E5E7EB",fontSize:14,fontFamily:"'Inter',sans-serif",fontWeight:600,outline:"none",boxSizing:"border-box"};

 function save(){
 const newDesc=ebOU+" "+(ebLine||initKills||bet.description&&bet.description.split(" ").slice(1).join(" ")||"");
 const odds=parseFloat(ebOdds)||bet.odds;
 const stake=parseFloat(ebStake)||bet.stake;
 const now=Date.now();
 const saved={...bet,
 player:ebPlayer||bet.player,
 bookmaker:ebBK||bet.bookmaker,
 overUnder:ebOU,
 description:newDesc,
 odds,stake,
 mapTag:ebMap,
 isLive:ebLive,
 tournament:ebTournament||undefined,
 datetime:ebDatetime||bet.datetime,
 profit:calcProfit(bet.status,stake,odds),
 updatedAt:now, // ← crucial : marque ce pari comme plus récent que Supabase
 };
 // Sauvegarder un override pour survivre au prochain pull Supabase
 try{
 const ovRaw=localStorage.getItem("v7_overrides");
 const ov=ovRaw?JSON.parse(ovRaw):{};
 ov[String(bet.id)]={datetime:saved.datetime,settledAt:saved.settledAt,bookmaker:saved.bookmaker,updatedAt:now};
 localStorage.setItem("v7_overrides",JSON.stringify(ov));
 }catch(e){}
 onSave(saved);
 }

 return(
 <div className="moverlay" onClick={onClose}>
 <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"88vh",overflowY:"auto"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
 <div>
 <div style={{fontSize:15,fontWeight:700,color:"#E5E7EB"}}> Modifier le pari</div>
 <div style={{fontSize:10,color:"#6B7280",marginTop:2}}>{bet.player} · {ebGame}</div>
 </div>
 <button onClick={onClose} style={{background:"transparent",border:"none",color:"#6B7280",fontSize:20,cursor:"pointer",lineHeight:1,padding:"0 4px"}}>×</button>
 </div>

 {/* Bookmaker */}
 <div style={{marginBottom:12}}>
 <span style={labelStyle}>Bookmaker</span>
 <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
 {bookmakers.map(bk=>(
 <button key={bk} onClick={()=>setEbBK(bk)}
 style={{padding:"7px 12px",borderRadius:8,border:"1.5px solid "+(ebBK===bk?"#7C3AED":"#1F2937"),background:ebBK===bk?"rgba(124,58,237,0.15)":"transparent",color:ebBK===bk?"#A78BFA":"#6B7280",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
 {bk}
 </button>
 ))}
 </div>
 </div>

 {/* Joueur */}
 <div style={{marginBottom:12}}>
 <span style={labelStyle}>Joueur</span>
 <div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:10,position:"relative",zIndex:300}}>
 <PlayerAC value={ebPlayer} onChange={v=>setEbPlayer(v)} allPlayers={allPlayers} onConfirm={()=>{}}/>
 </div>
 </div>

 {/* Over / Under */}
 <div style={{marginBottom:12}}>
 <span style={labelStyle}>Over / Under</span>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
 {["Over","Under"].map(ou=>(
 <button key={ou} onClick={()=>setEbOU(ou)}
 style={{padding:"11px 0",borderRadius:10,border:"1.5px solid "+(ebOU===ou?(ou==="Over"?"#00E676":"#EF4444"):"#1F2937"),background:ebOU===ou?(ou==="Over"?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)"):"transparent",color:ebOU===ou?(ou==="Over"?"#00E676":"#EF4444"):"#6B7280",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
 {ou}
 </button>
 ))}
 </div>
 </div>

 {/* Kills */}
 <div style={{marginBottom:12}}>
 <span style={labelStyle}>Ligne ({ebIsHS?"Headshots":"Kills"})</span>
 <select value={ebLine} onChange={e=>setEbLine(e.target.value)}
 style={{...fieldStyle,appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}>
 <option value="" style={{background:"#111827"}}>Choisir une ligne...</option>
 {ebOpts.map(o=><option key={o} value={o} style={{background:"#111827"}}>{o}</option>)}
 </select>
 </div>

 {/* Cote + Mise */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
 <div>
 <span style={labelStyle}>Cote</span>
 <NumPad value={ebOdds} onChange={v=>setEbOdds(v)} placeholder="1.75" step="0.01"/>
 </div>
 <div>
 <span style={labelStyle}>Mise ($)</span>
 <NumPad value={ebStake} onChange={v=>setEbStake(v)} placeholder="50" step="1"/>
 </div>
 </div>

 {/* Gain potentiel */}
 {ebOdds&&ebStake&&(
 <div style={{textAlign:"center",marginBottom:12,padding:"8px",background:"rgba(34,197,94,0.06)",borderRadius:8,border:"1px solid rgba(34,197,94,0.15)"}}>
 <span style={{fontSize:12,color:"#6B7280"}}>Gain potentiel : </span>
 <span style={{fontSize:14,fontWeight:700,color:"#00E676"}}>+{(parseFloat(ebStake||0)*(parseFloat(ebOdds||1)-1)).toFixed(2)}$</span>
 </div>
 )}

 {/* Map */}
 <div style={{marginBottom:16}}>
 <span style={labelStyle}>Map</span>
 <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
 {["Map 1","Map 2","Map 3","Map 4","Map 5"].map(m=>(
 <button key={m} onClick={()=>setEbMap(m)}
 style={{padding:"7px 12px",borderRadius:8,border:"1.5px solid "+(ebMap===m?"#F59E0B":"#1F2937"),background:ebMap===m?"rgba(245,158,11,0.1)":"transparent",color:ebMap===m?"#F59E0B":"#6B7280",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
 {m}
 </button>
 ))}
 </div>
 </div>

 {/* Tournoi */}
 <div style={{marginBottom:12}}>
 <span style={labelStyle}>Tournoi</span>
 {ebTourneyOptions.length>0?(
 <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:ebTourneyOptions.length>0?6:0}}>
 <button onClick={()=>setEbTournament("")}
 style={{padding:"6px 11px",borderRadius:8,border:"1.5px solid "+(ebTournament===""?"#6B7280":"#1F2937"),background:ebTournament===""?"rgba(107,114,128,0.15)":"transparent",color:ebTournament===""?"#9CA3AF":"#4B5563",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
 Aucun
 </button>
 {ebTourneyOptions.map(t=>{
 const isActive=activeTourneys[ebGame]&&activeTourneys[ebGame].name===t&&(!activeTourneys[ebGame].end||new Date(activeTourneys[ebGame].end)>=new Date());
 return(
 <button key={t} onClick={()=>setEbTournament(t)}
 style={{padding:"6px 11px",borderRadius:8,border:"1.5px solid "+(ebTournament===t?"#F59E0B":"#1F2937"),background:ebTournament===t?"rgba(245,158,11,0.12)":"transparent",color:ebTournament===t?"#F59E0B":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",gap:4}}>
 {isActive&&<span style={{width:5,height:5,borderRadius:"50%",background:"#00E676",boxShadow:"0 0 4px rgba(34,197,94,0.7)",flexShrink:0}}/>}
 {t}
 </button>
 );
 })}
 </div>
 ):(
 <input value={ebTournament} onChange={e=>setEbTournament(e.target.value)}
 placeholder="ex: PGL Astana 2026"
 style={{...fieldStyle,fontSize:13}}/>
 )}
 {ebTourneyOptions.length>0&&(
 <input value={ebTournament} onChange={e=>setEbTournament(e.target.value)}
 placeholder="Ou saisir manuellement..."
 style={{...fieldStyle,fontSize:12,padding:"8px 12px",marginTop:4}}/>
 )}
 </div>

 {/* Date & Heure */}
 <div style={{marginBottom:12}}>
 <span style={labelStyle}>Date & heure</span>
 <input
 type="datetime-local"
 value={ebDatetime}
 onChange={e=>setEbDatetime(e.target.value)}
 style={{...fieldStyle,colorScheme:"dark",fontSize:13}}
 />
 </div>

 {/* Live toggle */}
 <div style={{marginBottom:16}}>
 <button onClick={()=>setEbLive(v=>!v)}
 style={{width:"100%",padding:"11px",borderRadius:10,border:"1.5px solid "+(ebLive?"#EF4444":"#1F2937"),background:ebLive?"rgba(239,68,68,0.1)":"transparent",color:ebLive?"#EF4444":"#6B7280",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
 <span style={{width:8,height:8,borderRadius:"50%",background:ebLive?"#EF4444":"#374151",boxShadow:ebLive?"0 0 6px rgba(239,68,68,0.8)":"none"}}/>
 {ebLive?" LIVE — Pari en direct":"LIVE — Pari prématch"}
 </button>
 </div>

 {/* Boutons */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
 <button onClick={onClose}
 style={{padding:"13px",background:"#1F2937",border:"none",borderRadius:10,color:"#94A3B8",fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:14}}>
 Annuler
 </button>
 <button onClick={save}
 style={{padding:"13px",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:14}}>
 Sauvegarder
 </button>
 </div>
 </div>
 </div>
 );
});

// BetRow component 
const EMPTY_OBJ={};

const APP_ICON="";
// Set PWA icon
(()=>{
 const existing=document.querySelector('link[rel="apple-touch-icon"]');
 if(existing)existing.remove();
 const link=document.createElement('link');
 link.rel='apple-touch-icon';
 link.href=APP_ICON;
 document.head.appendChild(link);
 // Also set favicon
 const fav=document.querySelector('link[rel="icon"]')||document.createElement('link');
 fav.rel='icon';fav.href=APP_ICON;
 document.head.appendChild(fav);
})();
// Normalize role to canonical short form 
function normalizeRole(r,game){
 if(!r)return r;
 var rl=r.toLowerCase().trim();
 // LoL/Valorant: normalize to short positions
 var LOL_MAP={
 "top laner":"Top","toplaner":"Top","top laners":"Top","top":"Top",
 "bot laner":"Bot","botlaner":"Bot","bot laners":"Bot","adc":"Bot","marksman":"Bot","bot":"Bot",
 "mid laner":"Mid","midlaner":"Mid","mid laners":"Mid","mid":"Mid",
 "jungler":"Jungle","jng":"Jungle","jngl":"Jungle","jungle":"Jungle",
 "sup":"Support","supp":"Support","support":"Support",
 };
 // Dota2: keep Carry, Hard Support, etc.
 var DOTA_MAP={
 "carry":"Carry","hard carry":"Carry",
 "mid":"Mid","midlaner":"Mid","mid laner":"Mid",
 "offlane":"Offlane","offlaner":"Offlane","hard support":"Hard Support",
 "soft support":"Soft Support","support":"Support",
 };
 if(game==="Dota2")return DOTA_MAP[rl]||r;
 if(game==="LoL"||game==="Valorant")return LOL_MAP[rl]||r;
 return r;
}


// effectiveTournament: league counts as tournament for LoL/Valorant 
function effectiveTournament(b,allPlayers){
 if(b.tournament)return b.tournament;
 // For LoL/Valorant: use league from bet, or from player data
 if(b.game==="LoL"||b.game==="Valorant"){
 if(b.league)return b.league;
 // Try to get league from allPlayers
 if(allPlayers&&b.player){
 var pi=allPlayers[(b.player||"").toLowerCase().trim()];
 if(pi&&pi.league)return pi.league;
 }
 }
 return null;
}


// LeagueLogo component 
const LeagueLogo=memo(function LeagueLogo({league,size=18}){
 if(!league)return null;
 // Normalize league name to key
 var KEY_MAP={
 "LCK":"LCK","LPL":"LPL","LEC":"LEC","LCS":"LCS",
 "Americas":"Americas","EMEA":"EMEA","Pacific":"Pacific",
 "VCT Americas":"Americas","VCT EMEA":"EMEA","VCT Pacific":"Pacific",
 "LCK CL":"LCK","LEC Stage":"LEC","EWC":"EWC","Esports World Cup":"EWC","esports world cup":"EWC",
 "PGL":"PGL","ESL":"ESL","IEM":"IEM","BLAST":"BLAST",
 "DreamLeague":"DreamLeague","Dream League":"DreamLeague",
 "Riyadh Masters":"Riyadh Masters","The International":"TheInternational","TI":"TheInternational",
 "XSE Pro League":"XSE Pro League","XSE":"XSE Pro League",
 "Stake Ranked":"Stake Ranked","MSI":"MSI","Mid-Season Invitational":"MSI",
 "Valorant Champions":"Valorant Champions","VCT Champions":"Valorant Champions",
 };
 var lc=league.toLowerCase();
 // Exact match first
 var key=KEY_MAP[league]||KEY_MAP[lc]||null;
 if(!key){
 // Keyword matching for tournament names
 if(lc.includes("world cup")||lc.includes("ewc"))key="EWC";
 else if(lc.includes("the international")||lc==="ti"||lc.includes("ti ")&&lc.includes("dota"))key="TheInternational";
 else if(lc.includes("riyadh"))key="Riyadh Masters";
 else if(lc.includes("dreamleague")||lc.includes("dream league"))key="DreamLeague";
 else if(lc.includes("iem")||lc.includes("intel extreme"))key="IEM";
 else if(lc.includes("pgl"))key="PGL";
 else if(lc.includes("blast"))key="BLAST";
 else if(lc.includes("esl"))key="ESL";
 else if(lc.includes("xse pro")||lc.includes("xse"))key="XSE Pro League";
 else if(lc.includes("stake ranked")||lc.includes("ranked by starladder"))key="Stake Ranked";
 else if(lc.includes("msi")||lc.includes("mid-season")||lc.includes("mid season"))key="MSI";
 else if(lc.includes("valorant champions")||lc.includes("vct champions"))key="Valorant Champions";
 else if(lc.includes("worlds")||lc.includes("world championship")||lc.includes("world 20"))key="LCK";
 else key=Object.keys(KEY_MAP).find(function(k){return league.toLowerCase().includes(k.toLowerCase());})||null;
 }
 var src=key?LEAGUE_LOGOS[key]:null;
 // Also check mediaStore for custom tournament logos: tourney_<game>_<name>
 if(!src){
  // Try all games
  const games=["CS2","LoL","Dota2","Valorant"];
  for(const g of games){
   const mkey="tourney_"+g+"_"+league;
   if(_GLOBAL_MEDIA_STORE[mkey]){src=_GLOBAL_MEDIA_STORE[mkey];break;}
  }
 }
 if(!src)return <span style={{fontSize:size*0.65,color:"#4a5a6e",fontWeight:700,lineHeight:1}}>{league.slice(0,3).toUpperCase()}</span>;
 return <img src={src.replace('__FAILED__','')} alt={league} style={{width:size,height:size,objectFit:"contain",verticalAlign:"middle",borderRadius:2}} onError={e=>e.target.style.opacity=".2"}/>;
});


// League logos 
const HEADSHOT_LOGO_B64="data:image/png;base64,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";
// Global mediaStore ref for LeagueLogo (updated by App)
let _GLOBAL_MEDIA_STORE={};
const LEAGUE_LOGOS={
 "Americas":null,
 "EMEA":null,
 "Pacific":null,
 "LCS":null,
 "LEC":null,
 "LCK":null,
 "EWC":_B64_EWC,
 "Esports World Cup":_B64_EWC,
 "PGL":_B64_PGL,
 "ESL":null,
 "BLAST":null,
 "Riyadh Masters":null,
 "DreamLeague":null,
 "TheInternational":_B64_THEINTERNATIONAL,
 "IEM":_B64_PGL,
 "The International":_B64_THEINTERNATIONAL,
 "Worlds":_B64_THEINTERNATIONAL,
 "XSE Pro League":null,
 "Stake Ranked":null,
 "MSI":null,
 "Valorant Champions":_B64_CHAMPIONS,
 "Worlds":_B64_CHAMPIONS,
 "LPL":null,
};



// Virtualized list for a single day's bets
const VirtualizedDayBets = memo(function VirtualizedDayBets({bets=[], onStatus, onDelete, onDuplicate, onEdit, onSplit, bkPhotos, onSave, allTourneys, savedTourneys}) {
 // For small lists (<20), render directly - no virtualization overhead needed
 if(!bets||bets.length === 0) return null;
 if(bets.length <= 20) {
  return bets.map(b=>(
   <BetRow key={b.id} bet={b} onStatus={onStatus} onDelete={onDelete} onDuplicate={onDuplicate} onEdit={onEdit} onSplit={onSplit} bkPhotos={bkPhotos} onSave={onSave} allTourneys={allTourneys} savedTourneys={savedTourneys}/>
  ));
 }
 // For large lists, use windowed rendering
 const [visibleEnd, setVisibleEnd] = useState(20);
 return (
  <div>
   {bets.slice(0, visibleEnd).map(b=>(
    <BetRow key={b.id} bet={b} onStatus={onStatus} onDelete={onDelete} onDuplicate={onDuplicate} onEdit={onEdit} onSplit={onSplit} bkPhotos={bkPhotos} onSave={onSave} allTourneys={allTourneys} savedTourneys={savedTourneys}/>
   ))}
   {visibleEnd < bets.length && (
    <div style={{textAlign:"center",padding:"10px 0"}}>
     <button onClick={()=>setVisibleEnd(v=>v+50)} style={{background:"rgba(124,58,237,.15)",border:"1px solid rgba(124,58,237,.3)",borderRadius:8,color:"#a78bfa",padding:"6px 18px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
      Voir {Math.min(50, bets.length-visibleEnd)} de plus ({bets.length-visibleEnd} restants)
     </button>
    </div>
   )}
  </div>
 );
});

const BetRow=memo(function BetRow({bet,onStatus,onDelete,onDuplicate,onEdit,onSplit,bkPhotos=EMPTY_OBJ,onSave,allTourneys=[],savedTourneys={}}){
 const [draftDate,setDraftDate]=useState("");
 const dateInputRef=useRef(null);
 const [open,setOpen]=useState(false);
 const [confirmDel,setConfirmDel]=useState(false);
 const sc=STATUS_CFG[bet.status]||{color:"#3B82F6",label:bet.status};
 const isPending=bet.status==="pending";
 const isWon=bet.status==="won";
 const isLost=bet.status==="lost";
 const profitColor=isPending?"#ffffff":isWon?"#00E676":"#EF4444";
 const profitTxt=isPending?"En cours":((bet.profit||0)>=0?"+":" ")+(bet.profit||0).toFixed(2)+"$";
 const borderCol=isPending?"rgba(255,255,255,0.06)":isWon?"rgba(34,197,94,0.35)":"rgba(248,113,113,0.35)";
 const bkLogo=BK_LOGOS[bet.bookmaker]||bkPhotos[bet.bookmaker]||null;
 // Fix double Over/Under : bet.description contient déjà "Over X Kills" — on affiche seulement description
 const descLine=bet.description||"";

 const hasPP=bet.ppEdge!=null&&bet.ppMapType;
 const glowStyle=!isPending&&(isWon
 ?"0 0 10px rgba(34,197,94,.18)":"0 0 8px rgba(239,68,68,.14)");
 return(
 <div style={{borderBottom:"1px solid rgba(255,255,255,.1)",WebkitTapHighlightColor:"transparent",contain:"layout style",borderLeft:"2.5px solid "+(isPending?"#60a5fa":isWon?"#00E676":"#f43f5e"),background:"transparent",position:"relative",transition:"all .15s"}}>
 <div onClick={()=>setOpen(v=>!v)} style={{padding:"11px 13px 11px 12px",cursor:"pointer",userSelect:"none",WebkitUserSelect:"none"}}>
 <div style={{display:"flex",alignItems:"center",gap:11}}>

 {/* Logo sport — légèrement plus grand */}
 <div title="Voir le profil du joueur" onClick={e=>{e.stopPropagation();openPlayerSheet(bet.player);}} style={{width:37,height:37,borderRadius:10,overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",cursor:"pointer"}}>
 <GameLogo game={bet.game} size={37}/>
 </div>

 {/* Centre — 2 lignes */}
 <div style={{flex:1,minWidth:0}}>
 {/* L1 : Joueur — Kills — Map */}
 <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:4,flexWrap:"wrap"}}>
 <span style={{fontWeight:800,fontSize:14.5,color:"#f0f4ff",textTransform:"capitalize",letterSpacing:"-.4px",lineHeight:1,flexShrink:0}}>{bet.player}</span>
 {bet.game==="LoL"&&bet.role&&<RoleLogo role={bet.role} size={14}/>}
 {bet.splits&&bet.splits.length>0&&<span style={{fontSize:8,color:"#00E676",background:"rgba(74,222,128,.1)",border:"1px solid rgba(74,222,128,.2)",borderRadius:4,padding:"1px 5px",fontWeight:700,flexShrink:0}}>{1+bet.splits.length}</span>}
 {bet.isLive&&<span style={{fontSize:8,fontWeight:800,color:"#fb7185",background:"rgba(251,113,133,.12)",padding:"1px 5px",borderRadius:4,border:"1px solid rgba(251,113,133,.25)",letterSpacing:.3,flexShrink:0}}>LIVE</span>}
 {bet.isHeadshot&&<img src={HEADSHOT_LOGO_B64} alt="HS" style={{width:13,height:13,objectFit:"contain",flexShrink:0,filter:"brightness(0) invert(1)",opacity:.7,verticalAlign:"middle"}}/>}
 {descLine&&<><span style={{color:"#2e3d50",fontSize:10,lineHeight:1,flexShrink:0,margin:"0 1px"}}>-</span><span style={{fontSize:12,color:"#8a9eb8",fontWeight:500,flexShrink:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{descLine}</span></>}
 {bet.mapTag&&<><span style={{color:"#2e3d50",fontSize:10,lineHeight:1,flexShrink:0,margin:"0 1px"}}>-</span><span style={{fontSize:9,fontWeight:700,color:"#fbbf24",background:"rgba(251,191,36,.1)",padding:"1px 5px",borderRadius:4,border:"1px solid rgba(251,191,36,.2)",flexShrink:0}}>{bet.mapTag}</span></>}
 </div>
 {/* L2 : Cote · BK · Mise · Ligue — plus visible */}
 <div style={{display:"flex",alignItems:"center",gap:0,flexWrap:"wrap"}}>
 <span style={{fontSize:12,fontWeight:700,color:"#7a9cbd",letterSpacing:"-.1px"}}>@{bet.odds}</span>
 {(bkLogo||bet.bookmaker)&&<span style={{color:"#3a4e62",margin:"0 5px",fontSize:12,lineHeight:1}}>·</span>}
 {bkLogo
 ? (<img src={bkLogo} alt={bet.bookmaker} style={{width:15,height:15,borderRadius:3,objectFit:"cover",flexShrink:0}}/>)
 : bet.bookmaker ? (<span style={{fontSize:12,fontWeight:700,color:"#7a9cbd"}}>{bet.bookmaker}</span>) : null
 }
 {(bet.splits||[]).map((sp,i)=>{
 const spLogo=BK_LOGOS[sp.bookmaker]||bkPhotos[sp.bookmaker]||null;
 if(!spLogo)return(<span key={i} style={{fontSize:12,fontWeight:700,color:"#7a9cbd",marginLeft:3}}>{sp.bookmaker}</span>);
 return(<img key={i} src={spLogo} alt={sp.bookmaker} style={{width:13,height:13,borderRadius:3,objectFit:"cover",flexShrink:0,marginLeft:3}}/>);
 })}
 {bet.stake&&<><span style={{color:"#3a4e62",margin:"0 5px",fontSize:12,lineHeight:1}}>·</span><span style={{fontSize:12,fontWeight:700,color:"#7a9cbd"}}>{bet.stake}$</span></>}
 {hasPP&&<><span style={{color:"#3a4e62",margin:"0 5px",fontSize:12,lineHeight:1}}>·</span><img src={_B64_PP_LOGO_B64} alt="PP" style={{width:12,height:12,borderRadius:2,objectFit:"cover",flexShrink:0,verticalAlign:"middle"}}/><span style={{fontSize:12,fontWeight:700,color:bet.ppEdge>=0?"rgba(167,139,250,.85)":"#f87171",marginLeft:3}}>{bet.ppEdge>0?"+":""}{bet.ppEdge}</span></>}
 {/* Tournament/League — affichage custom + select invisible */}
 {(()=>{
 const lolLeagues=["LCK","LEC","LCS","LPL"];
 const valLeagues=["Americas","EMEA","Pacific"];
 const currentVal=bet.tournament||bet.league||"";
 const tLogo=(function(){
 var lc=(currentVal).toLowerCase();
 var tkey=null;
 if(lc.includes("world cup")||lc.includes("ewc"))tkey="EWC";
 else if(lc.includes("the international")||lc.startsWith("ti "))tkey="TheInternational";
 else if(lc.includes("riyadh"))tkey="Riyadh Masters";
 else if(lc.includes("dreamleague")||lc.includes("dream league"))tkey="DreamLeague";
 else if(lc.includes("iem"))tkey="IEM";
 else if(lc.includes("pgl"))tkey="PGL";
 else if(lc.includes("blast"))tkey="BLAST";
 else if(lc.includes("esl"))tkey="ESL";
 else if(lc.includes("lck"))tkey="LCK";
 else if(lc.includes("lpl"))tkey="LPL";
 else if(lc.includes("lec"))tkey="LEC";
 else if(lc.includes("lcs"))tkey="LCS";
 else if(lc.includes("americas"))tkey="Americas";
 else if(lc.includes("emea"))tkey="EMEA";
 else if(lc.includes("pacific"))tkey="Pacific";
 else if(lc.includes("xse pro")||lc.includes("xse"))tkey="XSE Pro League";
 else if(lc.includes("stake ranked")||lc.includes("starladder"))tkey="Stake Ranked";
 else if(lc.includes("msi")||lc.includes("mid-season")||lc.includes("mid season"))tkey="MSI";
 else if(lc.includes("valorant champions")||lc.includes("vct champions"))tkey="Valorant Champions";
 else if(lc.includes("worlds")||lc.includes("world 20"))tkey="LCK";
 const fromStatic=tkey?LEAGUE_LOGOS[tkey]:null;
 if(fromStatic)return fromStatic;
 const games2=["CS2","LoL","Dota2","Valorant"];
 for(const g of games2){const mk="tourney_"+g+"_"+currentVal;if(_GLOBAL_MEDIA_STORE[mk])return _GLOBAL_MEDIA_STORE[mk];}
 return null;
 })();
 const displayLabel=currentVal?(function(){
 var lc=currentVal.toLowerCase();
 return(lc.includes("world cup")||lc.includes("ewc"))?"EWC":currentVal.split(" ")[0];
 })():null;
 const handleChange=function(e){
 e.stopPropagation();
 const val=e.target.value;
 const isLeague=lolLeagues.includes(val)||valLeagues.includes(val);
 if(isLeague){if(onSave)onSave(Object.assign({},bet,{league:val,tournament:"",updatedAt:Date.now()}));}
 else{if(onSave)onSave(Object.assign({},bet,{tournament:val,updatedAt:Date.now()}));}
 };
 return(
 <span style={{display:"inline-flex",alignItems:"center",gap:3,marginLeft:4,position:"relative",cursor:"pointer"}}
 onClick={e=>e.stopPropagation()}>
 {currentVal&&<span style={{color:"#3a4e62",margin:"0 2px",fontSize:12,lineHeight:1}}>·</span>}
 {/* Affichage custom : logo + nom */}
 <span style={{display:"inline-flex",alignItems:"center",gap:3,pointerEvents:"none"}}>
 {currentVal
 ?<>{tLogo
 ?<img src={tLogo} alt={currentVal} style={{width:13,height:13,objectFit:"contain",verticalAlign:"middle",borderRadius:2}}/>
 :<span style={{fontSize:11}}><Ic n="trophy" s={11} c="#7a9cbd"/></span>}
 <span style={{fontSize:11,fontWeight:700,color:"#7a9cbd"}}>{displayLabel}</span>
 </>
 :<span style={{fontSize:11,color:"#3a4a5e",opacity:.6}}><Ic n="plus" s={11}/></span>}
 </span>
 {/* Select invisible par-dessus */}
 <select
 value={currentVal}
 onChange={handleChange}
 style={{
 position:"absolute",inset:0,opacity:0,cursor:"pointer",
 width:"100%",height:"100%",border:"none",background:"transparent",
 fontSize:12,
 }}>
 <option value="">— Aucun —</option>
 {(bet.game==="LoL")&&<optgroup label="Ligues">
 {["LCK","LEC","LCS","LPL"].map(l=><option key={l} value={l}>{l}</option>)}
 </optgroup>}
 {(bet.game==="Valorant")&&<optgroup label="Ligues">
 {["Americas","EMEA","Pacific"].map(l=><option key={l} value={l}>{l}</option>)}
 </optgroup>}
 {((savedTourneys&&savedTourneys[bet.game]&&savedTourneys[bet.game].length>0)
 ?(savedTourneys[bet.game]):(allTourneys||[]))
 .length>0&&<optgroup label="Tournois">
 {((savedTourneys&&savedTourneys[bet.game]&&savedTourneys[bet.game].length>0)
 ?(savedTourneys[bet.game]):(allTourneys||[]))
 .map(function(t){return <option key={t} value={t}>{t}</option>;})}
 </optgroup>}
 </select>
 </span>
 );
 })()}
 </div>
 </div>

 {/* Droite : profit seul */}
 <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,minWidth:56}}>
 <div style={{fontWeight:800,fontSize:14,color:profitColor,fontFamily:"Inter,sans-serif",letterSpacing:"-.4px",lineHeight:1,textShadow:isPending?"none":glowStyle||"none"}}>{profitTxt}</div>
 <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{transition:"transform .2s",transform:open?"rotate(180deg)":"none",opacity:.25}}>
 <path d="M2 3.5L5 6.5L8 3.5" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
 </svg>
 </div>
 </div>
 </div>

 {/* Actions déployées */}
 {open&&(
 <div style={{borderTop:"1px solid rgba(255,255,255,.06)",background:"rgba(5,8,18,.6)"}}>

 {/* Date + Tournament */}
 <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px 0",flexWrap:"wrap"}}>
 {/* Date cliquable → édition */}
{(()=>{
 const cur=(bet.datetime&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(bet.datetime)))?String(bet.datetime).slice(0,16):"";
 const shown=draftDate||cur;
 const mn=["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"][parseInt(shown.slice(5,7))-1]||"";
 const label=shown?shown.slice(8,10)+" "+mn+" "+shown.slice(0,4)+" · "+shown.slice(11,16):"Date";
 const commit=()=>{
 if(draftDate&&draftDate!==cur&&onSave)onSave(Object.assign({},bet,{datetime:draftDate,updatedAt:Date.now()}));
 setDraftDate("");
 };
 const chip={display:"inline-flex",alignItems:"center",gap:6,padding:"4px 10px",borderRadius:8,border:"1px solid rgba(167,139,250,.25)",background:"rgba(124,58,237,.06)",cursor:"pointer",fontFamily:"Inter,sans-serif"};
 if(draftDate)return(
 <span onClick={e=>e.stopPropagation()} style={{display:"inline-flex",alignItems:"center",gap:6}}>
 <input ref={dateInputRef} type="datetime-local" autoFocus value={draftDate}
 onChange={e=>setDraftDate(e.target.value)}
 onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape")setDraftDate("");}}
 style={{background:"rgba(18,12,30,.98)",border:"1px solid rgba(167,139,250,.5)",borderRadius:8,padding:"4px 8px",color:"#e9d5ff",fontSize:13,fontFamily:"Inter,sans-serif",colorScheme:"dark",outline:"none"}}/>
 <button type="button" onClick={commit} style={{border:"none",borderRadius:8,padding:"5px 10px",background:"#7C3AED",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer"}}>OK</button>
 <button type="button" onClick={()=>setDraftDate("")} style={{border:"1px solid rgba(255,255,255,.12)",borderRadius:8,padding:"4px 9px",background:"transparent",color:"#94a3b8",fontSize:12,cursor:"pointer"}}>Annuler</button>
 </span>
 );
 return(
 <span role="button" tabIndex={0} onClick={e=>{e.stopPropagation();setDraftDate(cur||nowDT());}} style={chip}>
 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
 <span style={{fontSize:11,color:"#c4b5fd",fontWeight:600}}>{label}</span>
 </span>
 );
})()}
 {/* Tournament inline edit */}
 <div style={{display:"flex",alignItems:"center",gap:5,marginLeft:"auto"}}>
 <span style={{fontSize:11,color:"#fbbf24"}}><Ic n="trophy" s={12}/></span>
 <select
 value={bet.tournament||bet.league||""}
 onChange={function(e){
 const val=e.target.value;
 // Si c'est une ligue (LCK/LEC/etc), met à jour league et vide tournament
 const lolLeagues=["LCK","LEC","LCS","LPL"];
 const valLeagues=["Americas","EMEA","Pacific"];
 const isLeague=lolLeagues.includes(val)||valLeagues.includes(val);
 if(isLeague){if(onSave)onSave(Object.assign({},bet,{league:val,tournament:"",updatedAt:Date.now()}));}
 else{if(onSave)onSave(Object.assign({},bet,{tournament:val,updatedAt:Date.now()}));}
 }}
 style={{background:"rgba(18,12,30,.98)",border:"1px solid rgba(251,191,36,.3)",borderRadius:7,padding:"3px 8px",color:"#fbbf24",fontSize:11,fontFamily:"Inter,sans-serif",outline:"none",minWidth:90,maxWidth:180,cursor:"pointer"}}>
 <option value="">— Aucun —</option>
 {/* Ligues selon le jeu */}
 {(bet.game==="LoL")&&<optgroup label="Ligues">
 {["LCK","LEC","LCS","LPL"].map(l=><option key={l} value={l}>{l}</option>)}
 </optgroup>}
 {(bet.game==="Valorant")&&<optgroup label="Ligues">
 {["Americas","EMEA","Pacific"].map(l=><option key={l} value={l}>{l}</option>)}
 </optgroup>}
 {/* Tournois du suivi */}
 {((savedTourneys&&savedTourneys[bet.game]&&savedTourneys[bet.game].length>0)
 ?(savedTourneys[bet.game])
 :(allTourneys||[]))
 .length>0&&<optgroup label="Tournois">
 {((savedTourneys&&savedTourneys[bet.game]&&savedTourneys[bet.game].length>0)
 ?(savedTourneys[bet.game])
 :(allTourneys||[]))
 .map(function(t){return <option key={t} value={t}>{t}</option>;})}
 </optgroup>}
 </select>
 </div>
 </div>

 {/* Répartition BK */}
 {bet.splits&&bet.splits.length>0&&(
 <div style={{margin:"8px 14px 0",background:"rgba(8,14,28,.8)",borderRadius:10,padding:"8px 12px",border:"1px solid rgba(255,255,255,.05)"}}>
 <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Répartition</div>
 <div style={{display:"flex",flexDirection:"column",gap:3}}>
 <div style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
 <span style={{color:"#7a8a9a"}}>{bet.bookmaker}</span>
 <span style={{color:"#c8d4e8",fontWeight:600}}>{(bet.stake-(bet.splits||[]).reduce((s,x)=>s+x.stake,0)).toFixed(0)}$ @{bet.odds}</span>
 </div>
 {(bet.splits||[]).map((sp,i)=>(
 <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:11}}>
 <span style={{color:"#7a8a9a"}}>{sp.bookmaker}</span>
 <span style={{color:"#c8d4e8",fontWeight:600}}>{sp.stake}$ @{sp.odds}</span>
 </div>
 ))}
 <div style={{borderTop:"1px solid rgba(255,255,255,.05)",paddingTop:4,marginTop:2,display:"flex",justifyContent:"space-between",fontSize:11}}>
 <span style={{color:"#4a5a6e"}}>Total</span>
 <span style={{color:"#c8d4e8",fontWeight:700}}>{bet.stake}$</span>
 </div>
 </div>
 </div>
 )}

 {/* Statut */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"10px 14px 0"}}>
 <button onClick={()=>{onStatus(bet.id,"won");setOpen(false);}}
 style={{padding:"13px",borderRadius:12,border:isWon?"none":"1px solid rgba(0,230,118,.2)",background:isWon?"rgba(0,230,118,.18)":"rgba(0,230,118,.05)",color:"#00E676",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif",borderTop:isWon?"2px solid #00E676":"none"}}>
 Gagné
 </button>
 <button onClick={()=>{onStatus(bet.id,"lost");setOpen(false);}}
 style={{padding:"13px",borderRadius:12,border:isLost?"none":"1px solid rgba(239,68,68,.2)",background:isLost?"rgba(239,68,68,.15)":"rgba(239,68,68,.04)",color:"#f87171",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif",borderTop:isLost?"2px solid #f87171":"none"}}>
 Perdu
 </button>
 </div>
 {!isPending&&(
 <div style={{padding:"6px 14px 0"}}>
 <button onClick={()=>{onStatus(bet.id,"pending");setOpen(false);}}
 style={{width:"100%",padding:"9px",borderRadius:10,border:"1px solid rgba(255,255,255,.07)",background:"transparent",color:isPending?"#93c5fd":"#4a5a6e",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 ↩ Remettre en attente
 </button>
 </div>
 )}

 {/* Actions */}
 <div style={{display:"flex",gap:7,padding:"8px 14px 12px"}}>
 <button onClick={()=>{onEdit(bet);setOpen(false);}}
 style={{flex:1,padding:"11px 0",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"#9CA3AF",cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600,fontSize:13}}>
 Modifier
 </button>
 <button onClick={()=>{onDuplicate(bet);setOpen(false);}}
 style={{flex:1,padding:"11px 0",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"#9CA3AF",cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600,fontSize:13}}>
 Dupliquer
 </button>
 <button onClick={()=>{onSplit(bet);setOpen(false);}}
 style={{flex:1,padding:"11px 0",borderRadius:10,border:"1px solid rgba(167,139,250,.3)",background:"rgba(124,58,237,.08)",color:"#a78bfa",cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600,fontSize:13}}>
 + BK
 </button>
 {!confirmDel
 ?(<button onClick={()=>setConfirmDel(true)}
 style={{width:44,padding:"11px 0",borderRadius:10,border:"1px solid rgba(239,68,68,.2)",background:"transparent",color:"#5a3030",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center"}}><Ic n="trash" s={15} c="#f87171"/></button>)
 :(<button onClick={()=>{onDelete(bet.id);}}
 style={{flex:1,padding:"11px 0",borderRadius:10,border:"none",background:"linear-gradient(135deg,#dc2626,#ef4444)",color:"#fff",cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:700,fontSize:13}}>Confirmer</button>)
 }
 </div>
 </div>
 )}
 </div>
 );
});

// BetRowSelectable 
const BetRowSelectable=memo(function BetRowSelectable({bet,selected,onToggle,onEdit}){
 const sc=STATUS_CFG[bet.status]||{color:"#3B82F6",label:bet.status};
 return(
 <div className="betrow" style={{background:selected?"rgba(34,197,94,0.04)":"#111827",padding:"11px 13px",borderLeft:selected?"3px solid #00E676":"3px solid transparent"}}>
 <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
 <button onClick={onToggle} style={{width:22,height:22,borderRadius:6,border:"2px solid "+(selected?"#00E676":"#1F2937"),background:selected?"rgba(34,197,94,0.1)":"transparent",cursor:"pointer",flexShrink:0,marginTop:2}}/>
 <div style={{flex:1,minWidth:0}}>
 {/* Date */}
 <div style={{fontSize:10,color:"#9CA3AF",marginBottom:4}}>{fmtDate(bet.datetime)}{bet.bookmaker?" · "+bet.bookmaker:""}</div>
 {/* Player row */}
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
 <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
 <GameLogo game={bet.game} size={18}/>
 <div style={{minWidth:0}}>
 <div style={{fontWeight:700,fontSize:14,color:"#E5E7EB",textTransform:"capitalize"}}>{bet.player}</div>
 <div style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>{bet.description} - @{bet.odds} - {bet.stake}$</div>
 </div>
 </div>
 <div style={{textAlign:"right",flexShrink:0}}>
 <div style={{fontWeight:700,fontSize:13,color:bet.status==="pending"?"#3B82F6":bet.profit>=0?"#00E676":"#EF4444"}}>
 {bet.status==="pending"?"@"+bet.odds:((bet.profit||0)>=0?"+":" ")+(bet.profit||0).toFixed(2)+"$"}
 </div>
 <div style={{fontSize:10,color:sc.color}}>{sc.label}</div>
 </div>
 </div>
 </div>
 <button className="editbtn" onClick={onEdit} style={{flexShrink:0,marginTop:2}}> Modif.</button>
 </div>
 </div>
 );
});

// Main App 
// Nav Icons (outside App to avoid recreating on every render) 
const NavIconHome=memo(function NavIconHome({active}){
 const c=active?"#A78BFA":"#6B7280";
 return(<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
 <path d="M3 12L12 3l9 9v8a1 1 0 01-1 1H4a1 1 0 01-1-1z" fill={active?"rgba(167,139,250,0.1)":"none"}/>
 <polyline points="9,21 9,12 15,12 15,21"/>
 </svg>);
});
const NavIconParis=memo(function NavIconParis({active,count}){
 const c=active?"#A78BFA":"#6B7280";
 return(<div style={{position:"relative",display:"inline-flex"}}>
 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
 <rect x="4" y="2" width="16" height="20" rx="2" fill={active?"rgba(167,139,250,0.1)":"none"}/>
 <line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/>
 <circle cx="17" cy="17" r="3" fill={active?"#A78BFA":"#6B7280"} stroke="none" opacity={active?1:0.5}/>
 <polyline points="15.5,17 16.5,18 18.5,16" stroke="#0B1220" strokeWidth="1.5" fill="none"/>
 </svg>
 {count>0&&<span style={{position:"absolute",top:-4,right:-6,background:"#3B82F6",color:"#fff",borderRadius:8,fontSize:8,fontWeight:800,padding:"1px 4px",minWidth:14,textAlign:"center",lineHeight:"13px",border:"1.5px solid #0D1526"}}>{count}</span>}
 </div>);
});
const NavIconAnalyse=memo(function NavIconAnalyse({active}){
 const c=active?"#A78BFA":"#6B7280";
 return(<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
 <circle cx="10" cy="10" r="6" fill={active?"rgba(167,139,250,0.1)":"none"}/>
 <line x1="14.5" y1="14.5" x2="20" y2="20"/>
 <line x1="8" y1="10" x2="12" y2="10"/><line x1="10" y1="8" x2="10" y2="12"/>
 </svg>);
});

function QuickUnitsEditor({quickUnits,setQuickUnits}){
 const [open,setOpen]=useState(false);
 const [editing,setEditing]=useState(null);
 const [tempVal,setTempVal]=useState("");
 const save=(i,val)=>{
  const n=parseFloat(val);
  if(isNaN(n)||n<=0||n>10)return;
  const next=[...quickUnits];next[i]=Math.round(n*100)/100;
  setQuickUnits(next);setEditing(null);
 };
 const reset=()=>setQuickUnits([0.75,1,1.25,1.5,1.75,2]);
 return(
  <div style={{marginBottom:8}}>
   <SuiviHead n="trendUp" color="#f59e0b" title="Mises rapides" sub={quickUnits.join(" · ")+" unités"} open={open} onClick={()=>setOpen(o=>!o)}/>
   {open&&(
    <div style={SV_BODY}>
     <div style={{fontSize:10,color:"#6B7280",marginBottom:10,lineHeight:1.5}}>
      Les 6 multiplicateurs utilisés dans les boutons de mise rapide du formulaire.<br/>
      <span style={{color:"#A78BFA"}}>Le montant en $ s'adapte automatiquement à ton palier de bankroll.</span>
     </div>
     <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:12}}>
      {quickUnits.map((u,i)=>(
       <div key={i} style={{background:"#111827",border:"1px solid "+(editing===i?"rgba(139,92,246,.5)":"#1F2937"),borderRadius:10,padding:"8px 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:4,transition:"border-color .2s"}}>
        <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Bouton {i+1}</div>
        {editing===i?(
         <div style={{display:"flex",gap:4,alignItems:"center",width:"100%"}}>
          <input autoFocus type="number" value={tempVal} step="0.25" min="0.25" max="10"
           onChange={e=>setTempVal(e.target.value)}
           onKeyDown={e=>{if(e.key==="Enter")save(i,tempVal);if(e.key==="Escape")setEditing(null);}}
           style={{width:"100%",background:"#0D0F1E",border:"1px solid rgba(139,92,246,.4)",borderRadius:6,color:"#A78BFA",fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:700,padding:"3px 6px",textAlign:"center",outline:"none"}}/>
          <button onClick={()=>save(i,tempVal)} style={{background:"rgba(139,92,246,.2)",border:"none",borderRadius:5,color:"#A78BFA",cursor:"pointer",fontSize:12,padding:"3px 6px",fontFamily:"'Inter',sans-serif"}}>✓</button>
         </div>
        ):(
         <button onClick={()=>{setEditing(i);setTempVal(String(u));}}
          style={{background:"transparent",border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif",width:"100%",textAlign:"center"}}>
          <span style={{fontSize:16,fontWeight:800,color:"#c4b5fd"}}>{u}</span>
          <span style={{fontSize:11,color:"#6B7280"}}>u</span>
         </button>
        )}
       </div>
      ))}
     </div>
     <button onClick={reset}
      style={{width:"100%",padding:"7px",background:"transparent",border:"1px solid #1F2937",borderRadius:8,color:"#6B7280",fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
      Réinitialiser (0.75 · 1 · 1.25 · 1.5 · 1.75 · 2u)
     </button>
    </div>
   )}
  </div>
 );
}


const CoteTab=memo(function CoteTab({settledFiltered}){
 const [coteStep,setCoteStep]=useState(0.05);
 const steps=Array.from({length:20},(_,i)=>parseFloat((0.01*(i+1)).toFixed(2)));
 const coteRanges=useMemo(()=>{
  const ranges={};
  settledFiltered.forEach(b=>{
   const o=b.odds;if(!o||o<1)return;
   const bucket=Math.floor((o-1)/coteStep);
   const lo=(1+bucket*coteStep).toFixed(2);
   const hi=(1+(bucket+1)*coteStep-0.01).toFixed(2);
   const key=lo;
   if(!ranges[key])ranges[key]={label:lo+"-"+hi,lo:parseFloat(lo),count:0,won:0,profit:0};
   ranges[key].count++;ranges[key].profit+=b.profit;
   if(b.status==="won")ranges[key].won++;
  });
  return Object.values(ranges).map(r=>({...r,wr:r.count>0?r.won/r.count*100:0})).sort((a,b)=>a.lo-b.lo);
 },[settledFiltered,coteStep]);
 const maxC=coteRanges.length>0?Math.max(...coteRanges.map(r=>r.count)):1;
 const totCount=coteRanges.reduce((s,r)=>s+r.count,0);
 const totWon=coteRanges.reduce((s,r)=>s+r.won,0);
 const totProfit=coteRanges.reduce((s,r)=>s+r.profit,0);
 const totWR=totCount>0?(totWon/totCount*100).toFixed(0):0;
 return(
  <div style={{display:"flex",flexDirection:"column",gap:10}}>
   <div style={{background:"rgba(10,12,28,.99)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,overflow:"hidden"}}>
    <div style={{padding:"13px 16px",borderBottom:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",gap:10}}>
     <span style={{fontSize:14}}>🎯</span>
     <span style={{fontSize:13,fontWeight:800,color:"#f0f4ff"}}>Cotes par tranches</span>
     <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6}}>
      <span style={{fontSize:10,color:"#6B7280"}}>Taille :</span>
      <select value={coteStep} onChange={e=>setCoteStep(parseFloat(e.target.value))}
       style={{background:"#1a2235",border:"1px solid rgba(124,58,237,.4)",borderRadius:8,color:"#c4b5fd",fontFamily:"Inter,sans-serif",fontSize:12,fontWeight:700,padding:"4px 8px",cursor:"pointer",outline:"none"}}>
       {steps.map(s=><option key={s} value={s}>{s.toFixed(2)}</option>)}
      </select>
     </div>
    </div>
    {coteRanges.length===0?<div style={{padding:"30px",textAlign:"center",color:"#4a5a6e"}}>Aucune donnée</div>:(
     <div>
      <div style={{display:"grid",gridTemplateColumns:"90px 1fr 48px 64px",gap:"0 8px",padding:"6px 16px"}}>
       {[["Tranche","left"],["Paris","left"],["WR%","center"],["Profit","right"]].map(([l,a])=>(
        <span key={l} style={{fontSize:9,color:"#374151",fontWeight:600,textTransform:"uppercase",letterSpacing:.8,textAlign:a}}>{l}</span>
       ))}
      </div>
      {coteRanges.map(r=>{
       const barW=maxC>0?(r.count/maxC*100):0;
       const pc=r.profit>=0?"#22C55E":"#EF4444";
       const wc=r.wr>55?"#22C55E":r.wr<45?"#EF4444":"#9CA3AF";
       return(
        <div key={r.label} style={{display:"grid",gridTemplateColumns:"90px 1fr 48px 64px",gap:"0 8px",alignItems:"center",padding:"7px 16px",borderTop:"1px solid rgba(255,255,255,.03)"}}>
         <span style={{fontSize:12,fontWeight:700,color:"#c8d4e8"}}>{r.label}</span>
         <div style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{flex:1,height:5,borderRadius:3,background:"rgba(255,255,255,.06)",overflow:"hidden"}}>
           <div style={{height:"100%",width:barW+"%",background:r.profit>=0?"#22C55E":"#EF4444",borderRadius:3,opacity:.75}}/>
          </div>
          <span style={{fontSize:9,color:"#4a5a6e",minWidth:24,textAlign:"right"}}>{r.count}p</span>
         </div>
         <span style={{fontSize:12,fontWeight:700,color:wc,textAlign:"center"}}>{r.wr.toFixed(0)}%</span>
         <span style={{fontSize:12,fontWeight:700,color:pc,textAlign:"right"}}>{r.profit>=0?"+":""}{r.profit.toFixed(0)}$</span>
        </div>
       );
      })}
      <div style={{display:"grid",gridTemplateColumns:"90px 1fr 48px 64px",gap:"0 8px",padding:"8px 16px",borderTop:"2px solid rgba(124,58,237,.3)",background:"rgba(124,58,237,.05)"}}>
       <span style={{fontSize:11,fontWeight:800,color:"#E5E7EB"}}>TOTAL</span>
       <span style={{fontSize:11,color:"#6B7280"}}>{totCount}p</span>
       <span style={{fontSize:11,fontWeight:700,color:parseFloat(totWR)>55?"#22C55E":parseFloat(totWR)<45?"#EF4444":"#9CA3AF",textAlign:"center"}}>{totWR}%</span>
       <span style={{fontSize:12,fontWeight:800,textAlign:"right",color:totProfit>=0?"#22C55E":"#EF4444"}}>{totProfit>=0?"+":""}{totProfit.toFixed(0)}$</span>
      </div>
     </div>
    )}
   </div>
  </div>
 );
});

const AvanceTab=memo(function AvanceTab({settledFiltered,bets}){
 const [activeSection,setActiveSection]=useState("courbe");
 const sections=[{k:"courbe",l:"📈 Courbe"},{k:"mois",l:"📅 Mois"},{k:"calibration",l:"🎯 Calibration"},{k:"performance",l:"⚡ Performance"}];

 // ── DATA COURBE ──
 const courbeData=useMemo(()=>{
  const sorted=[...settledFiltered].sort((a,b)=>String(a.datetime||"").localeCompare(String(b.datetime||"")));
  let cum=0;const pts=[];
  sorted.forEach((b,i)=>{cum+=b.profit;pts.push({i,date:String(b.datetime||"").slice(0,10),profit:b.profit,cum:Math.round(cum*100)/100,label:b.player});});
  return pts;
 },[settledFiltered]);

 // ── DATA MOIS ──
 const moisData=useMemo(()=>{
  const m={};
  settledFiltered.forEach(b=>{
   const dk=String(b.datetime||"").slice(0,7);if(!dk||dk.length<7)return;
   if(!m[dk])m[dk]={month:dk,count:0,won:0,profit:0,staked:0};
   m[dk].count++;m[dk].profit+=b.profit;m[dk].staked+=b.stake;
   if(b.status==="won")m[dk].won++;
  });
  return Object.values(m).sort((a,b)=>a.month.localeCompare(b.month));
 },[settledFiltered]);

 // ── DATA CALIBRATION ──
 const calibData=useMemo(()=>{
  const buckets={};
  settledFiltered.forEach(b=>{
   if(!b.odds||b.odds<1)return;
   const impliedProb=Math.round((1/b.odds)*20)/20;// snap to 5%
   const key=impliedProb.toFixed(2);
   if(!buckets[key])buckets[key]={implied:impliedProb,count:0,won:0};
   buckets[key].count++;if(b.status==="won")buckets[key].won++;
  });
  return Object.values(buckets)
   .filter(b=>b.count>=3)
   .map(b=>({...b,actualWR:b.won/b.count*100,impliedWR:b.implied*100,edge:(b.won/b.count-b.implied)*100}))
   .sort((a,b2)=>a.implied-b2.implied);
 },[settledFiltered]);

 // ── DATA PERFORMANCE ──
 const perfData=useMemo(()=>{
  // Par jour de semaine
  const DAYS=["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  const dow={};DAYS.forEach(d=>{dow[d]={label:d,count:0,won:0,profit:0,staked:0};});
  // Par heure
  const hours={};for(let h=0;h<24;h++)hours[h]={label:h+"h",count:0,won:0,profit:0,staked:0};
  // Streaks
  let curStreak=0,bestWin=0,bestLose=0,curLose=0;
  const sorted=[...settledFiltered].sort((a,b)=>String(a.datetime||"").localeCompare(String(b.datetime||"")));
  sorted.forEach(b=>{
   const dt=b.datetime?String(b.datetime):"";
   if(dt){
    const d=new Date(dt);
    const day=DAYS[d.getDay()];if(dow[day]){dow[day].count++;dow[day].staked+=b.stake;dow[day].profit+=b.profit;if(b.status==="won")dow[day].won++;}
    const h=d.getHours();if(hours[h]){hours[h].count++;hours[h].staked+=b.stake;hours[h].profit+=b.profit;if(b.status==="won")hours[h].won++;}
   }
   if(b.status==="won"){curStreak=curStreak>=0?curStreak+1:1;curLose=0;bestWin=Math.max(bestWin,curStreak);}
   else if(b.status==="lost"){curLose=curLose>=0?curLose+1:1;curStreak=0;bestLose=Math.max(bestLose,curLose);}
  });
  // Max drawdown
  let peak=0,maxDD=0,cum2=0;
  sorted.forEach(b=>{cum2+=b.profit;if(cum2>peak)peak=cum2;maxDD=Math.max(maxDD,peak-cum2);});
  // Avg odds won vs lost
  const wonBets=settledFiltered.filter(b=>b.status==="won");
  const lostBets=settledFiltered.filter(b=>b.status==="lost");
  const avgOddsWon=wonBets.length>0?(wonBets.reduce((s,b)=>s+(b.odds||0),0)/wonBets.length):0;
  const avgOddsLost=lostBets.length>0?(lostBets.reduce((s,b)=>s+(b.odds||0),0)/lostBets.length):0;
  return{dow:Object.values(dow),hours:Object.values(hours).filter(h=>h.count>0),bestWin,bestLose,curStreak,maxDD,avgOddsWon,avgOddsLost};
 },[settledFiltered]);

 // ── RENDER HELPERS ──
 const Card=({title,children})=>(
  <div style={{background:"rgba(10,12,28,.99)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,overflow:"hidden",marginBottom:10}}>
   <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,.06)"}}><span style={{fontSize:13,fontWeight:800,color:"#f0f4ff"}}>{title}</span></div>
   <div style={{padding:"12px 16px"}}>{children}</div>
  </div>
 );

 const wrc=wr=>wr>55?"#22C55E":wr<45?"#EF4444":"#9CA3AF";
 const pc=p=>p>=0?"#22C55E":"#EF4444";

 return(
  <div>
   {/* Sub-nav */}
   <div style={{display:"flex",gap:6,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
    {sections.map(s=>(
     <button key={s.k} onClick={()=>setActiveSection(s.k)}
      style={{flexShrink:0,padding:"7px 14px",borderRadius:20,border:"1px solid "+(activeSection===s.k?"rgba(124,58,237,.6)":"#1F2937"),background:activeSection===s.k?"rgba(124,58,237,.2)":"transparent",color:activeSection===s.k?"#c4b5fd":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>
      {s.l}
     </button>
    ))}
   </div>

   {/* ── COURBE ── */}
   {activeSection==="courbe"&&(()=>{
    if(courbeData.length===0)return <div style={{textAlign:"center",padding:"40px 0",color:"#4a5a6e"}}>Aucune donnée</div>;
    const maxCum=Math.max(...courbeData.map(p=>p.cum));
    const minCum=Math.min(...courbeData.map(p=>p.cum));
    const range=maxCum-minCum||1;
    const W=340,H=140,PAD=8;
    const x=i=>(i/(courbeData.length-1||1))*(W-PAD*2)+PAD;
    const y=v=>H-PAD-((v-minCum)/range)*(H-PAD*2);
    const pts=courbeData.map((p,i)=>`${x(i).toFixed(1)},${y(p.cum).toFixed(1)}`).join(" ");
    const lastP=courbeData[courbeData.length-1];
    const totalProfit=lastP?lastP.cum:0;
    // Monthly breakdown for bar chart
    const maxMonthProfit=moisData.length>0?Math.max(...moisData.map(m=>Math.abs(m.profit))):1;
    return(
     <div>
      <Card title="📈 Courbe de bankroll">
       <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        {[
         {l:"Total",v:(totalProfit>=0?"+":"")+totalProfit.toFixed(0)+"$",c:pc(totalProfit)},
         {l:"Paris",v:courbeData.length,c:"#c4b5fd"},
         {l:"Pic",v:"+"+maxCum.toFixed(0)+"$",c:"#22C55E"},
         {l:"Creux",v:minCum.toFixed(0)+"$",c:minCum<0?"#EF4444":"#22C55E"},
        ].map(s=>(
         <div key={s.l} style={{flex:"1 1 auto",background:"rgba(124,58,237,.06)",border:"1px solid rgba(124,58,237,.1)",borderRadius:8,padding:"6px 10px",minWidth:65}}>
          <div style={{fontSize:13,fontWeight:900,color:s.c}}>{s.v}</div>
          <div style={{fontSize:9,color:"#4a5a6e",textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div>
         </div>
        ))}
       </div>
       <div style={{overflowX:"auto"}}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:H,display:"block"}}>
         <defs>
          <linearGradient id="gfill" x1="0" y1="0" x2="0" y2="1">
           <stop offset="0%" stopColor={totalProfit>=0?"#22C55E":"#EF4444"} stopOpacity="0.25"/>
           <stop offset="100%" stopColor={totalProfit>=0?"#22C55E":"#EF4444"} stopOpacity="0"/>
          </linearGradient>
         </defs>
         {/* Zero line */}
         <line x1={PAD} y1={y(0).toFixed(1)} x2={W-PAD} y2={y(0).toFixed(1)} stroke="rgba(255,255,255,.08)" strokeWidth="1" strokeDasharray="4,3"/>
         {/* Fill */}
         <polygon points={`${PAD},${H-PAD} ${pts} ${W-PAD},${H-PAD}`} fill="url(#gfill)"/>
         {/* Line */}
         <polyline points={pts} fill="none" stroke={totalProfit>=0?"#22C55E":"#EF4444"} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
         {/* Last point */}
         {lastP&&<circle cx={x(courbeData.length-1).toFixed(1)} cy={y(lastP.cum).toFixed(1)} r="4" fill={totalProfit>=0?"#22C55E":"#EF4444"}/>}
        </svg>
       </div>
       <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#374151",marginTop:2}}>
        <span>{courbeData[0]?.date}</span>
        <span>{lastP?.date}</span>
       </div>
      </Card>
     </div>
    );
   })()}

   {/* ── MOIS ── */}
   {activeSection==="mois"&&(()=>{
    if(moisData.length===0)return <div style={{textAlign:"center",padding:"40px 0",color:"#4a5a6e"}}>Aucune donnée</div>;
    const maxAbs=Math.max(...moisData.map(m=>Math.abs(m.profit)),1);
    const totProfit=moisData.reduce((s,m)=>s+m.profit,0);
    const totCount=moisData.reduce((s,m)=>s+m.count,0);
    const totWon=moisData.reduce((s,m)=>s+m.won,0);
    const bestMonth=moisData.reduce((a,b)=>b.profit>a.profit?b:a);
    const worstMonth=moisData.reduce((a,b)=>b.profit<a.profit?b:a);
    return(
     <Card title="📅 Performance par mois">
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
       {[
        {l:"Total",v:(totProfit>=0?"+":"")+totProfit.toFixed(0)+"$",c:pc(totProfit)},
        {l:"WR global",v:totCount>0?(totWon/totCount*100).toFixed(0)+"%":"-",c:wrc(totCount>0?totWon/totCount*100:50)},
        {l:"Meilleur mois",v:(bestMonth.profit>=0?"+":"")+bestMonth.profit.toFixed(0)+"$",c:"#22C55E"},
        {l:"Pire mois",v:worstMonth.profit.toFixed(0)+"$",c:"#EF4444"},
       ].map(s=>(
        <div key={s.l} style={{flex:"1 1 auto",background:"rgba(124,58,237,.06)",border:"1px solid rgba(124,58,237,.1)",borderRadius:8,padding:"6px 10px",minWidth:70}}>
         <div style={{fontSize:13,fontWeight:900,color:s.c}}>{s.v}</div>
         <div style={{fontSize:9,color:"#4a5a6e",textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div>
        </div>
       ))}
      </div>
      {/* Header */}
      <div style={{display:"grid",gridTemplateColumns:"60px 40px 40px 50px 60px",gap:"0 6px",marginBottom:4}}>
       {[["Mois","left"],["Paris","center"],["WR","center"],["ROI","center"],["Profit","right"]].map(([l,a])=>(
        <span key={l} style={{fontSize:9,color:"#374151",fontWeight:600,textTransform:"uppercase",letterSpacing:.7,textAlign:a}}>{l}</span>
       ))}
      </div>
      {moisData.map(m=>{
       const wr=m.count>0?m.won/m.count*100:0;
       const roi=m.staked>0?m.profit/m.staked*100:0;
       const barW=Math.abs(m.profit)/maxAbs*100;
       const label=m.month.slice(0,4)+"/"+m.month.slice(5,7);
       return(
        <div key={m.month}>
         <div style={{display:"grid",gridTemplateColumns:"60px 40px 40px 50px 60px",gap:"0 6px",alignItems:"center",padding:"6px 0",borderTop:"1px solid rgba(255,255,255,.03)"}}>
          <span style={{fontSize:11,fontWeight:700,color:"#c8d4e8"}}>{label}</span>
          <span style={{fontSize:11,color:"#6B7280",textAlign:"center"}}>{m.count}</span>
          <span style={{fontSize:11,fontWeight:700,color:wrc(wr),textAlign:"center"}}>{wr.toFixed(0)}%</span>
          <span style={{fontSize:11,fontWeight:700,color:roi>=0?"#22C55E":"#EF4444",textAlign:"center"}}>{roi>=0?"+":""}{roi.toFixed(1)}%</span>
          <span style={{fontSize:11,fontWeight:800,color:pc(m.profit),textAlign:"right"}}>{m.profit>=0?"+":""}{m.profit.toFixed(0)}$</span>
         </div>
         <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,.04)",overflow:"hidden",marginBottom:3}}>
          <div style={{height:"100%",width:barW+"%",background:m.profit>=0?"#22C55E":"#EF4444",borderRadius:2,marginLeft:m.profit<0?(100-barW)+"%":0,opacity:.7}}/>
         </div>
        </div>
       );
      })}
      <div style={{display:"grid",gridTemplateColumns:"60px 40px 40px 50px 60px",gap:"0 6px",padding:"8px 0 0",borderTop:"2px solid rgba(124,58,237,.3)"}}>
       <span style={{fontSize:11,fontWeight:800,color:"#E5E7EB"}}>TOTAL</span>
       <span style={{fontSize:11,color:"#6B7280",textAlign:"center"}}>{totCount}</span>
       <span style={{fontSize:11,fontWeight:700,color:wrc(totCount>0?totWon/totCount*100:50),textAlign:"center"}}>{totCount>0?(totWon/totCount*100).toFixed(0):0}%</span>
       <span style={{fontSize:11,fontWeight:700,color:totProfit>=0?"#22C55E":"#EF4444",textAlign:"center"}}>{totCount>0?((totProfit/moisData.reduce((s,m)=>s+m.staked,0))*100).toFixed(1):0}%</span>
       <span style={{fontSize:11,fontWeight:800,color:pc(totProfit),textAlign:"right"}}>{totProfit>=0?"+":""}{totProfit.toFixed(0)}$</span>
      </div>
     </Card>
    );
   })()}

   {/* ── CALIBRATION ── */}
   {activeSection==="calibration"&&(()=>{
    if(calibData.length===0)return <div style={{textAlign:"center",padding:"40px 0",color:"#4a5a6e"}}>Pas assez de données (min 3 paris par tranche)</div>;
    const maxDev=Math.max(...calibData.map(c=>Math.abs(c.edge)),1);
    return(
     <Card title="🎯 Calibration — Cote vs Résultat réel">
      <div style={{fontSize:10,color:"#4a5a6e",marginBottom:12,lineHeight:1.5}}>
       Compare ta <span style={{color:"#c4b5fd"}}>probabilité implicite de la cote</span> avec ton <span style={{color:"#22C55E"}}>taux de victoire réel</span>.<br/>
       Un edge positif = tu gagnes plus souvent que la cote le prédit.
      </div>
      <div style={{display:"grid",gridTemplateColumns:"52px 50px 50px 1fr 50px",gap:"0 6px",marginBottom:4}}>
       {[["Cote impl.","left"],["Réel WR","center"],["Prévu","center"],["Edge","left"],["Paris","right"]].map(([l,a])=>(
        <span key={l} style={{fontSize:9,color:"#374151",fontWeight:600,textTransform:"uppercase",letterSpacing:.6,textAlign:a}}>{l}</span>
       ))}
      </div>
      {calibData.map(r=>{
       const edgeColor=r.edge>5?"#22C55E":r.edge<-5?"#EF4444":"#9CA3AF";
       const barW=Math.abs(r.edge)/maxDev*100;
       return(
        <div key={r.implied} style={{borderTop:"1px solid rgba(255,255,255,.03)",padding:"7px 0"}}>
         <div style={{display:"grid",gridTemplateColumns:"52px 50px 50px 1fr 50px",gap:"0 6px",alignItems:"center"}}>
          <span style={{fontSize:11,fontWeight:700,color:"#c8d4e8"}}>{r.impliedWR.toFixed(0)}%</span>
          <span style={{fontSize:12,fontWeight:800,color:wrc(r.actualWR),textAlign:"center"}}>{r.actualWR.toFixed(0)}%</span>
          <span style={{fontSize:11,color:"#6B7280",textAlign:"center"}}>{r.impliedWR.toFixed(0)}%</span>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
           <div style={{width:barW*0.6+"%",height:4,background:edgeColor,borderRadius:2,opacity:.8,minWidth:r.edge!==0?3:0}}/>
           <span style={{fontSize:11,fontWeight:800,color:edgeColor}}>{r.edge>=0?"+":""}{r.edge.toFixed(1)}%</span>
          </div>
          <span style={{fontSize:10,color:"#6B7280",textAlign:"right"}}>{r.count}p</span>
         </div>
        </div>
       );
      })}
      <div style={{marginTop:10,padding:"10px 12px",background:"rgba(124,58,237,.06)",borderRadius:10,border:"1px solid rgba(124,58,237,.1)"}}>
       <div style={{fontSize:10,color:"#c4b5fd",fontWeight:700,marginBottom:4}}>Résumé calibration</div>
       {(()=>{
        const pos=calibData.filter(r=>r.edge>2);
        const neg=calibData.filter(r=>r.edge<-2);
        const bestEdge=calibData.reduce((a,b)=>b.edge>a.edge?b:a,calibData[0]);
        const worstEdge=calibData.reduce((a,b)=>b.edge<a.edge?b:a,calibData[0]);
        return(
         <div style={{display:"flex",flexDirection:"column",gap:4}}>
          <div style={{fontSize:10,color:"#E5E7EB"}}>✅ <span style={{color:"#22C55E",fontWeight:700}}>{pos.length}</span> tranches avec edge positif ({">"}+2%)</div>
          <div style={{fontSize:10,color:"#E5E7EB"}}>❌ <span style={{color:"#EF4444",fontWeight:700}}>{neg.length}</span> tranches avec edge négatif ({">"}–2%)</div>
          <div style={{fontSize:10,color:"#E5E7EB"}}>🏆 Meilleur range : <span style={{color:"#22C55E",fontWeight:700}}>{bestEdge.impliedWR.toFixed(0)}% impl.</span> → {bestEdge.actualWR.toFixed(0)}% réel (<span style={{color:"#22C55E"}}>+{bestEdge.edge.toFixed(1)}%</span>)</div>
          <div style={{fontSize:10,color:"#E5E7EB"}}>⚠️ Pire range : <span style={{color:"#EF4444",fontWeight:700}}>{worstEdge.impliedWR.toFixed(0)}% impl.</span> → {worstEdge.actualWR.toFixed(0)}% réel (<span style={{color:"#EF4444"}}>{worstEdge.edge.toFixed(1)}%</span>)</div>
         </div>
        );
       })()}
      </div>
     </Card>
    );
   })()}

   {/* ── PERFORMANCE ── */}
   {activeSection==="performance"&&(()=>{
    const {dow,hours,bestWin,bestLose,curStreak,maxDD,avgOddsWon,avgOddsLost}=perfData;
    const maxDowAbs=Math.max(...dow.map(d=>Math.abs(d.profit)),1);
    const maxHAbs=hours.length>0?Math.max(...hours.map(h=>Math.abs(h.profit)),1):1;
    return(
     <div>
      {/* Streaks */}
      <Card title="⚡ Streaks & Drawdown">
       <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {[
         {l:"Streak actuel",v:(curStreak>=0?"+":"")+curStreak,c:curStreak>0?"#22C55E":curStreak<0?"#EF4444":"#9CA3AF"},
         {l:"Meilleur win streak",v:"+"+bestWin,c:"#22C55E"},
         {l:"Pire lose streak",v:"-"+bestLose,c:"#EF4444"},
         {l:"Max Drawdown",v:"-"+maxDD.toFixed(0)+"$",c:"#F59E0B"},
         {l:"Cote moy gagnés",v:"@"+(avgOddsWon>0?avgOddsWon.toFixed(2):"?"),c:"#22C55E"},
         {l:"Cote moy perdus",v:"@"+(avgOddsLost>0?avgOddsLost.toFixed(2):"?"),c:"#EF4444"},
        ].map(s=>(
         <div key={s.l} style={{flex:"1 1 auto",background:"rgba(124,58,237,.06)",border:"1px solid rgba(124,58,237,.1)",borderRadius:8,padding:"6px 10px",minWidth:80}}>
          <div style={{fontSize:16,fontWeight:900,color:s.c}}>{s.v}</div>
          <div style={{fontSize:9,color:"#4a5a6e",textTransform:"uppercase",letterSpacing:.4,marginTop:2}}>{s.l}</div>
         </div>
        ))}
       </div>
      </Card>
      {/* Par jour */}
      <Card title="📆 Par jour de semaine">
       {dow.map(d=>{
        if(d.count===0)return null;
        const wr=d.count>0?d.won/d.count*100:0;
        const barW=Math.abs(d.profit)/maxDowAbs*80;
        return(
         <div key={d.label} style={{display:"grid",gridTemplateColumns:"32px 36px 44px 1fr 56px",gap:"0 8px",alignItems:"center",padding:"6px 0",borderTop:"1px solid rgba(255,255,255,.03)"}}>
          <span style={{fontSize:11,fontWeight:700,color:"#c8d4e8"}}>{d.label}</span>
          <span style={{fontSize:10,color:"#6B7280",textAlign:"center"}}>{d.count}p</span>
          <span style={{fontSize:11,fontWeight:700,color:wrc(wr),textAlign:"center"}}>{wr.toFixed(0)}%</span>
          <div style={{height:5,borderRadius:3,background:"rgba(255,255,255,.04)",overflow:"hidden"}}>
           <div style={{height:"100%",width:barW+"%",background:d.profit>=0?"#22C55E":"#EF4444",borderRadius:3,opacity:.75}}/>
          </div>
          <span style={{fontSize:11,fontWeight:700,color:pc(d.profit),textAlign:"right"}}>{d.profit>=0?"+":""}{d.profit.toFixed(0)}$</span>
         </div>
        );
       })}
      </Card>
      {/* Par heure */}
      {hours.length>0&&(
       <Card title="🕐 Par heure de la journée">
        {hours.map(h=>{
         const wr=h.count>0?h.won/h.count*100:0;
         const barW=Math.abs(h.profit)/maxHAbs*80;
         return(
          <div key={h.label} style={{display:"grid",gridTemplateColumns:"32px 36px 44px 1fr 56px",gap:"0 8px",alignItems:"center",padding:"5px 0",borderTop:"1px solid rgba(255,255,255,.03)"}}>
           <span style={{fontSize:10,fontWeight:700,color:"#c8d4e8"}}>{h.label}</span>
           <span style={{fontSize:10,color:"#6B7280",textAlign:"center"}}>{h.count}p</span>
           <span style={{fontSize:10,fontWeight:700,color:wrc(wr),textAlign:"center"}}>{wr.toFixed(0)}%</span>
           <div style={{height:4,borderRadius:2,background:"rgba(255,255,255,.04)",overflow:"hidden"}}>
            <div style={{height:"100%",width:barW+"%",background:h.profit>=0?"#22C55E":"#EF4444",borderRadius:2,opacity:.75}}/>
           </div>
           <span style={{fontSize:10,fontWeight:700,color:pc(h.profit),textAlign:"right"}}>{h.profit>=0?"+":""}{h.profit.toFixed(0)}$</span>
          </div>
         );
        })}
       </Card>
      )}
     </div>
    );
   })()}
  </div>
 );
});

const SpotsTab=memo(function SpotsTab({settledFiltered}){
 const ALL_GAMES=["CS2","LoL","Dota2","Valorant"];
 const [game,setGame]=useState("CS2");
 const [drill,setDrill]=useState(null); // {key, label, bets}
 const MIN_BETS=5;

 const spots=useMemo(()=>{
  const gb=settledFiltered.filter(b=>b.game===game);
  if(gb.length===0)return null;
  const mk=()=>({count:0,won:0,profit:0,staked:0,oddsSum:0,bets:[]});
  const agg=(map,key,b)=>{
   if(!map[key])map[key]=mk();
   const s=map[key];
   s.count++;s.profit+=b.profit;s.staked+=b.stake;s.oddsSum+=b.odds||0;
   if(b.status==="won")s.won++;
   s.bets.push(b);
  };
  const byPlayer={},byLine={},byOverUnder={},byOddsRange={},byIsLive={},byIsHS={},byPPEdge={},byLeague={},byMapType={},byRole={};
  gb.forEach(b=>{
   if(b.player)agg(byPlayer,b.player,b);
   if(b.description){const desc=String(b.description).replace(/^(Over|Under)\s/,"").trim();agg(byLine,desc,b);}
   if(b.overUnder)agg(byOverUnder,b.overUnder,b);
   if(b.odds){const bucket=Math.floor((b.odds-1)/0.10)*0.10+1;agg(byOddsRange,bucket.toFixed(2)+"-"+(bucket+0.09).toFixed(2),b);}
   agg(byIsLive,b.isLive?"Live":"Non-Live",b);
   if(game==="CS2"||game==="Valorant")agg(byIsHS,b.isHeadshot?"Headshot":"Kills",b);
   if(b.ppEdge!=null&&b.ppEdge!==0){const ek="+"+Math.round(Math.abs(b.ppEdge)*4)/4;agg(byPPEdge,ek,b);}
   if(b.league)agg(byLeague,b.league,b);
   if(b.ppMapType)agg(byMapType,b.ppMapType,b);
   if(game==="LoL"&&b.role)agg(byRole,b.role,b);
  });
  const rank=(map)=>Object.entries(map)
   .filter(([,s])=>s.count>=MIN_BETS)
   .map(([key,s])=>({key,wr:s.count>0?s.won/s.count*100:0,roi:s.staked>0?s.profit/s.staked*100:0,profit:s.profit,count:s.count,avgOdds:s.count>0?s.oddsSum/s.count:0,bets:s.bets}))
   .sort((a,b)=>b.profit-a.profit);
  return{player:rank(byPlayer),line:rank(byLine),overUnder:rank(byOverUnder),oddsRange:rank(byOddsRange),live:rank(byIsLive),hs:rank(byIsHS),ppEdge:rank(byPPEdge),league:rank(byLeague),mapType:rank(byMapType),role:rank(byRole),total:gb.length};
 },[settledFiltered,game]);

 // ── DRILL VIEW ──
 if(drill){
  const sorted=[...drill.bets].sort((a,b)=>String(b.datetime||"").localeCompare(String(a.datetime||"")));
  const won=drill.bets.filter(b=>b.status==="won").length;
  const lost=drill.bets.filter(b=>b.status==="lost").length;
  const totalP=drill.bets.reduce((s,b)=>s+b.profit,0);
  const wr=drill.bets.length>0?won/drill.bets.length*100:0;
  return(
   <div>
    <button onClick={()=>setDrill(null)} style={{display:"flex",alignItems:"center",gap:6,background:"transparent",border:"none",color:"#6B7280",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:12,fontWeight:600,marginBottom:12,padding:0}}>
     ← Retour aux spots
    </button>
    <div style={{background:"rgba(10,12,28,.99)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,overflow:"hidden",marginBottom:12}}>
     <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
      <div style={{fontSize:16,fontWeight:900,color:"#f0f4ff",marginBottom:6}}>{drill.key}</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
       {[
        {l:"Paris",v:drill.bets.length,c:"#c4b5fd"},
        {l:"Gagnés",v:won,c:"#22C55E"},
        {l:"Perdus",v:lost,c:"#EF4444"},
        {l:"WR",v:wr.toFixed(0)+"%",c:wr>55?"#22C55E":wr<45?"#EF4444":"#9CA3AF"},
        {l:"Profit",v:(totalP>=0?"+":"")+totalP.toFixed(0)+"$",c:totalP>=0?"#22C55E":"#EF4444"},
       ].map(s=>(
        <div key={s.l} style={{flex:"1 1 auto",background:"rgba(124,58,237,.06)",border:"1px solid rgba(124,58,237,.1)",borderRadius:8,padding:"5px 10px",minWidth:50,textAlign:"center"}}>
         <div style={{fontSize:13,fontWeight:900,color:s.c}}>{s.v}</div>
         <div style={{fontSize:9,color:"#4a5a6e",textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div>
        </div>
       ))}
      </div>
     </div>
     <div>
      {sorted.map((b,i)=>{
       const isWon=b.status==="won";
       const isLost=b.status==="lost";
       const pc=isWon?"#22C55E":isLost?"#EF4444":"#9CA3AF";
       const bg=isWon?"rgba(34,197,94,.04)":isLost?"rgba(239,68,68,.04)":"transparent";
       return(
        <div key={b.id||i} style={{padding:"10px 16px",borderTop:"1px solid rgba(255,255,255,.04)",background:bg,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
         <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:700,color:"#E5E7EB",marginBottom:2}}>{b.player} — {b.overUnder} {String(b.description||"").replace(/^(Over|Under)\s/,"").trim()}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
           <span style={{fontSize:10,color:"#6B7280"}}>@{b.odds}</span>
           <span style={{fontSize:10,color:"#6B7280"}}>{b.stake}$</span>
           {b.bookmaker&&<span style={{fontSize:10,color:"#4a5a6e"}}>{b.bookmaker}</span>}
           {b.datetime&&<span style={{fontSize:10,color:"#374151"}}>{String(b.datetime).slice(0,10)}</span>}
           {b.isLive&&<span style={{fontSize:9,fontWeight:700,color:"#F59E0B"}}>LIVE</span>}
           {b.isHeadshot&&<span style={{fontSize:9,fontWeight:700,color:"#EC4899"}}>HS</span>}
          </div>
         </div>
         <div style={{textAlign:"right",flexShrink:0,marginLeft:10}}>
          <div style={{fontSize:14,fontWeight:900,color:pc}}>{b.profit>=0?"+":""}{b.profit.toFixed(0)}$</div>
          <div style={{fontSize:10,fontWeight:700,color:pc,textTransform:"uppercase"}}>{b.status==="won"?"✓ Gagné":b.status==="lost"?"✗ Perdu":"En attente"}</div>
         </div>
        </div>
       );
      })}
     </div>
    </div>
   </div>
  );
};

 // ── SECTION ──
 const SpotSection=({title,rows,showTop=3,isPlayer})=>{
  if(!rows||rows.length===0)return null;
  const best=rows.slice(0,showTop);
  const worst=[...rows].reverse().slice(0,showTop).filter(r=>r.profit<0||rows.length<=showTop);
  const filtered=worst.filter(r=>!best.find(b=>b.key===r.key));
  if(best.length===0&&filtered.length===0)return null;
  return(
   <div style={{marginBottom:18}}>
    <div style={{fontSize:13,fontWeight:800,color:"#9CA3AF",textTransform:"uppercase",letterSpacing:1.2,marginBottom:8,paddingLeft:2}}>{title}</div>
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
     {best.map(r=><SpotRow key={r.key} r={r} type="best" isPlayer={isPlayer}/>)}
     {filtered.length>0&&<div style={{height:1,background:"rgba(239,68,68,.15)",margin:"3px 0"}}/>}
     {filtered.map(r=><SpotRow key={r.key+"_w"} r={r} type="worst" isPlayer={isPlayer}/>)}
    </div>
   </div>
  );
 };

 const SpotRow=({r,type,isPlayer})=>{
  const isBest=type==="best";
  const isLoss=r.profit<0;
  const bg=isLoss?"rgba(239,68,68,.07)":"rgba(34,197,94,.06)";
  const border=isLoss?"rgba(239,68,68,.18)":"rgba(34,197,94,.15)";
  const profitColor=isLoss?"#EF4444":"#22C55E";
  const wrc=r.wr>55?"#22C55E":r.wr<45?"#EF4444":"#9CA3AF";
  return(
   <button onClick={()=>setDrill({key:r.key,bets:r.bets})}
    style={{width:"100%",background:bg,border:"1px solid "+border,borderRadius:10,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
    <div style={{flex:1,minWidth:0}}>
     <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
      <span onClick={isPlayer?(e=>{e.stopPropagation();openPlayerSheet(r.key);}):undefined} style={{fontSize:13,fontWeight:800,color:"#E5E7EB",cursor:isPlayer?"pointer":"inherit",textDecoration:isPlayer?"underline dotted rgba(167,139,250,.6)":"none",textUnderlineOffset:3}}>{isPlayer?capName(r.key):r.key}</span>
      <span style={{fontSize:10,color:"#4a5a6e"}}>{r.count} paris</span>
     </div>
     <div style={{display:"flex",gap:10}}>
      <span style={{fontSize:10,color:"#4a5a6e"}}>WR <span style={{color:wrc,fontWeight:700}}>{r.wr.toFixed(0)}%</span></span>
      <span style={{fontSize:10,color:"#4a5a6e"}}>ROI <span style={{color:r.roi>=0?"#22C55E":"#EF4444",fontWeight:700}}>{r.roi>=0?"+":""}{r.roi.toFixed(1)}%</span></span>
      <span style={{fontSize:10,color:"#4a5a6e"}}>@<span style={{color:"#9CA3AF",fontWeight:600}}>{r.avgOdds.toFixed(2)}</span></span>
     </div>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0,marginLeft:8}}>
     <span style={{fontSize:16,fontWeight:900,color:profitColor}}>{r.profit>=0?"+":""}{r.profit.toFixed(0)}$</span>
     <span style={{color:"#374151",fontSize:14}}>›</span>
    </div>
   </button>
  );
 };

 if(!spots)return<div style={{textAlign:"center",padding:"40px 0",color:"#4a5a6e"}}>Aucun paris pour ce jeu</div>;

 const gb=settledFiltered.filter(b=>b.game===game);
 const totP=gb.reduce((s,b)=>s+b.profit,0);
 const totW=gb.filter(b=>b.status==="won").length;
 const totWR=gb.length>0?totW/gb.length*100:0;
 const totROI=gb.reduce((s,b)=>s+b.stake,0)>0?totP/gb.reduce((s,b)=>s+b.stake,0)*100:0;

 return(
  <div>
   {/* Game selector */}
   <div style={{display:"flex",gap:6,marginBottom:12}}>
    {ALL_GAMES.map(g=>(
     <button key={g} onClick={()=>{setGame(g);setDrill(null);}}
      style={{flex:1,padding:"8px 4px",borderRadius:10,border:"1.5px solid "+(game===g?"rgba(124,58,237,.6)":"#1F2937"),background:game===g?"rgba(124,58,237,.2)":"rgba(255,255,255,.02)",color:game===g?"#c4b5fd":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
      {g}
     </button>
    ))}
   </div>
   {/* Summary */}
   <div style={{background:"rgba(10,12,28,.99)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"10px 14px",marginBottom:14,display:"flex",gap:8,flexWrap:"wrap"}}>
    {[
     {l:"Paris",v:gb.length,c:"#c4b5fd"},
     {l:"WR",v:totWR.toFixed(0)+"%",c:totWR>55?"#22C55E":totWR<45?"#EF4444":"#9CA3AF"},
     {l:"ROI",v:(totROI>=0?"+":"")+totROI.toFixed(1)+"%",c:totROI>=0?"#22C55E":"#EF4444"},
     {l:"Profit",v:(totP>=0?"+":"")+totP.toFixed(0)+"$",c:totP>=0?"#22C55E":"#EF4444"},
    ].map(s=>(
     <div key={s.l} style={{flex:"1 1 auto",textAlign:"center"}}>
      <div style={{fontSize:14,fontWeight:900,color:s.c}}>{s.v}</div>
      <div style={{fontSize:9,color:"#4a5a6e",textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div>
     </div>
    ))}
   </div>
   <div style={{fontSize:9,color:"#4a5a6e",marginBottom:12,textAlign:"center"}}>Min {MIN_BETS} paris · Vert = profitable · Rouge = à éviter · Clique pour voir les paris</div>
   <SpotSection title="Par joueur" rows={spots.player} showTop={3} isPlayer/>
   <SpotSection title="Par stat" rows={spots.line} showTop={3}/>
   <SpotSection title="Over vs Under" rows={spots.overUnder} showTop={2}/>
   {(game==="CS2"||game==="Valorant")&&<SpotSection title="Headshot vs Kills" rows={spots.hs} showTop={2}/>}
   {game==="LoL"&&<SpotSection title="Par rôle" rows={spots.role} showTop={3}/>}
   <SpotSection title="Par tranche de cote" rows={spots.oddsRange} showTop={3}/>
   <SpotSection title="Live vs Non-Live" rows={spots.live} showTop={2}/>
   {spots.ppEdge.length>0&&<SpotSection title="Par PP Edge" rows={spots.ppEdge} showTop={3}/>}
   {spots.league.length>0&&<SpotSection title="Par ligue" rows={spots.league} showTop={3}/>}
   {spots.mapType.length>0&&<SpotSection title="Par type de map PP" rows={spots.mapType} showTop={3}/>}
  </div>
 );
});

function DiagEdgeTable({rows,dir,sum,MIN}){
 const wrc=wr=>wr>=60?"#22C55E":wr>=50?"#9CA3AF":"#EF4444";
 const pc=p=>p>=0?"#22C55E":"#EF4444";
 const evc=ev=>ev>=3?"#22C55E":ev>=0?"#9CA3AF":"#EF4444";
 const accent=dir==="Over"?"#60A5FA":"#A78BFA";
 const accentBg=dir==="Over"?"rgba(96,165,250,.08)":"rgba(167,139,250,.08)";
 if(!rows||rows.length===0)return(
  <div style={{padding:"10px 14px",fontSize:11,color:"#374151"}}>Pas assez de données (min {MIN} paris par edge)</div>
 );
 return(
  <div>
   <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",background:accentBg,borderBottom:"1px solid rgba(255,255,255,.05)"}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
     <span style={{fontSize:12,fontWeight:800,color:accent}}>{dir}</span>
     <span style={{fontSize:10,color:"#6B7280"}}>{sum.count} paris</span>
     <span style={{fontSize:10,fontWeight:700,color:wrc(sum.wr)}}>{sum.wr.toFixed(0)}% WR</span>
    </div>
    <span style={{fontSize:14,fontWeight:900,color:pc(sum.profit)}}>{sum.profit>=0?"+":""}{sum.profit.toFixed(0)}$</span>
   </div>
   <div style={{display:"grid",gridTemplateColumns:"52px 36px 44px 44px 44px 44px 1fr",gap:"0 4px",padding:"5px 14px",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
    {[["Edge","left"],["N","center"],["WR","center"],["Cote","center"],["BE","center"],["EV","center"],["Profit","right"]].map(([l,a])=>(
     <span key={l} style={{fontSize:8,color:"#374151",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,textAlign:a}}>{l}</span>
    ))}
   </div>
   {rows.map(r=>{
    const isGood=r.ev>=2&&r.wr>=55;
    const isBad=r.ev<-3||r.wr<45;
    const rowBg=isGood?"rgba(34,197,94,.04)":isBad?"rgba(239,68,68,.04)":"transparent";
    const indicator=isGood?"✅":isBad?"❌":"";
    return(
     <div key={r.edge} style={{display:"grid",gridTemplateColumns:"52px 36px 44px 44px 44px 44px 1fr",gap:"0 4px",alignItems:"center",padding:"7px 14px",borderTop:"1px solid rgba(255,255,255,.03)",background:rowBg}}>
      <div style={{display:"flex",alignItems:"center",gap:4}}>
       <span style={{fontSize:8}}>{indicator}</span>
       <span style={{fontSize:12,fontWeight:800,color:accent}}>+{r.edge.toFixed(2).replace(/\.?0+$/,"")}</span>
      </div>
      <span style={{fontSize:11,color:"#6B7280",textAlign:"center"}}>{r.count}</span>
      <span style={{fontSize:11,fontWeight:700,color:wrc(r.wr),textAlign:"center"}}>{r.wr.toFixed(0)}%</span>
      <span style={{fontSize:10,color:"#9CA3AF",textAlign:"center"}}>{r.avgOdds.toFixed(2)}</span>
      <span style={{fontSize:10,color:"#4a5a6e",textAlign:"center"}}>{r.breakEven.toFixed(0)}%</span>
      <span style={{fontSize:11,fontWeight:700,color:evc(r.ev),textAlign:"center"}}>{r.ev>=0?"+":""}{r.ev.toFixed(1)}%</span>
      <span style={{fontSize:11,fontWeight:800,color:pc(r.profit),textAlign:"right"}}>{r.profit>=0?"+":""}{r.profit.toFixed(0)}$</span>
     </div>
    );
   })}
   <div style={{padding:"6px 14px",borderTop:"1px solid rgba(255,255,255,.03)",display:"flex",gap:12}}>
    <span style={{fontSize:9,color:"#374151"}}>✅ EV {">="} +2% et WR {">="} 55%</span>
    <span style={{fontSize:9,color:"#374151"}}>❌ EV {"<="} -3% ou WR {"<="} 45%</span>
   </div>
  </div>
 );
}

const DiagnosticTab=memo(function DiagnosticTab({settledFiltered}){
 const GAMES=["CS2","LoL","Dota2","Valorant"];
 const MIN=5;
 const wrc=wr=>wr>=60?"#22C55E":wr>=50?"#9CA3AF":"#EF4444";
 const pc=p=>p>=0?"#22C55E":"#EF4444";
 const data=useMemo(()=>{
  const res={};
  GAMES.forEach(g=>{res[g]={Over:{},Under:{}};});
  settledFiltered.forEach(b=>{
   if(!b.ppEdge||b.ppEdge===0||!b.game||!b.overUnder)return;
   if(!res[b.game])return;
   const dir=b.overUnder==="Over"?"Over":"Under";
   const ek=Math.round(Math.abs(b.ppEdge)*4)/4;
   const key=ek.toFixed(2);
   const s=res[b.game][dir];
   if(!s[key])s[key]={edge:ek,count:0,won:0,profit:0,staked:0,oddsSum:0};
   s[key].count++;s[key].profit+=b.profit;s[key].staked+=b.stake;s[key].oddsSum+=b.odds||0;
   if(b.status==="won")s[key].won++;
  });
  const mkRows=map=>Object.values(map)
   .filter(r=>r.count>=MIN)
   .map(r=>{
    const wr=r.won/r.count*100;
    const avgOdds=r.oddsSum/r.count;
    const breakEven=100/avgOdds;
    const ev=wr-breakEven;
    return{...r,wr,avgOdds,breakEven,ev};
   })
   .sort((a,b2)=>b2.profit-a.profit);
  const mkSum=rows=>{
   const t={count:0,won:0,profit:0,staked:0};
   rows.forEach(r=>{t.count+=r.count;t.won+=r.won;t.profit+=r.profit;t.staked+=r.staked;});
   t.wr=t.count>0?t.won/t.count*100:0;
   return t;
  };
  const out={};
  GAMES.forEach(g=>{
   const ovRows=mkRows(res[g].Over);
   const unRows=mkRows(res[g].Under);
   out[g]={ovRows,unRows,ovSum:mkSum(ovRows),unSum:mkSum(unRows)};
  });
  return out;
 },[settledFiltered]);

 return(
  <div style={{display:"flex",flexDirection:"column",gap:16}}>
   <div style={{background:"rgba(10,12,28,.99)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,padding:"14px 16px"}}>
    <div style={{fontSize:13,fontWeight:800,color:"#f0f4ff",marginBottom:4}}>Diagnostic Over vs Under</div>
    <div style={{fontSize:10,color:"#4a5a6e",marginBottom:12}}>Par jeu et par direction · Min {MIN} paris · BE = break-even · EV = avantage réel vs cote</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
     {GAMES.map(g=>{
      const {ovSum,unSum}=data[g];
      if(ovSum.count+unSum.count===0)return null;
      return(
       <div key={g} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:12,padding:"10px 12px"}}>
        <div style={{fontSize:12,fontWeight:800,color:"#E5E7EB",marginBottom:8}}>{g}</div>
        {[["Over",ovSum,"#60A5FA"],["Under",unSum,"#A78BFA"]].map(([dir,s,accent])=>(
         s.count>0&&(
          <div key={dir} style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
           <div style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{fontSize:9,fontWeight:700,color:accent,background:dir==="Over"?"rgba(96,165,250,.12)":"rgba(167,139,250,.12)",padding:"2px 6px",borderRadius:4}}>{dir}</span>
            <span style={{fontSize:9,color:"#4a5a6e"}}>{s.count}p</span>
            <span style={{fontSize:9,fontWeight:700,color:wrc(s.wr)}}>{s.wr.toFixed(0)}%</span>
           </div>
           <span style={{fontSize:11,fontWeight:800,color:pc(s.profit)}}>{s.profit>=0?"+":""}{s.profit.toFixed(0)}$</span>
          </div>
         )
        ))}
       </div>
      );
     })}
    </div>
   </div>
   {GAMES.map(g=>{
    const {ovRows,unRows,ovSum,unSum}=data[g];
    if(ovRows.length===0&&unRows.length===0)return null;
    const total=(ovSum.profit||0)+(unSum.profit||0);
    return(
     <div key={g} style={{background:"rgba(10,12,28,.99)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,overflow:"hidden"}}>
      <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",gap:8}}>
       <GameLogo game={g} size={16}/>
       <span style={{fontSize:14,fontWeight:800,color:"#f0f4ff"}}>{g}</span>
       <span style={{fontSize:10,color:"#6B7280"}}>{(ovSum.count||0)+(unSum.count||0)} paris PP</span>
       <span style={{marginLeft:"auto",fontSize:13,fontWeight:900,color:pc(total)}}>{total>=0?"+":""}{total.toFixed(0)}$</span>
      </div>
      <DiagEdgeTable rows={ovRows} dir="Over" sum={ovSum} MIN={MIN}/>
      <div style={{height:1,background:"rgba(255,255,255,.06)"}}/>
      <DiagEdgeTable rows={unRows} dir="Under" sum={unSum} MIN={MIN}/>
     </div>
    );
   })}
   {settledFiltered.filter(b=>b.ppEdge&&b.ppEdge!==0).length===0&&(
    <div style={{textAlign:"center",padding:"40px 0",color:"#4a5a6e",fontSize:13}}>Aucun pari avec edge PP trouvé.</div>
   )}
  </div>
 );
});

const ROLES_BY_GAME={
  CS2:["Rifler","AWPer","Entry","Lurker","Support","IGL","Coach"],
  LoL:["Top","Jungle","Mid","ADC","Support","Coach"],
  Valorant:["Duelist","Sentinel","Controller","Initiator","IGL","Coach"],
  Dota2:["Carry","Midlaner","Offlaner","Support","Hard Support","Coach"],
 };


// Lecture robuste du presse-papiers : image directe, image dans du HTML (copie depuis un site), lien ou data:image
async function readClipboardImage(){
 let htmlSrc="",txt="";
 if(navigator.clipboard&&navigator.clipboard.read){
  let items=[];
  try{items=await navigator.clipboard.read({unsanitized:["image/svg+xml","text/html"]});}
  catch(e){try{items=await navigator.clipboard.read();}catch(e2){items=[];}}
  for(const it of items){
   const t=it.types.find(x=>/image/i.test(x));
   if(t){const blob=await it.getType(t);const type=(blob.type&&blob.type.startsWith("image/"))?blob.type:"image/png";
    return{blob:new Blob([blob],{type}),type};}
   if(!htmlSrc&&it.types.includes("text/html")){
    try{const h=await (await it.getType("text/html")).text();const m=h.match(/<img[^>]+src=["']([^"']+)["']/i);if(m)htmlSrc=m[1].replace(/&amp;/g,"&");
     else if(/<svg[\s>]/i.test(h)){const sv=h.slice(h.search(/<svg[\s>]/i),h.toLowerCase().lastIndexOf("</svg>")+6);return{blob:new Blob([sv],{type:"image/svg+xml"}),type:"image/svg+xml"};}}catch(e){}
   }
   if(!txt&&it.types.includes("text/plain")){try{txt=(await (await it.getType("text/plain")).text()).trim();}catch(e){}}
  }
 }
 if(!txt&&navigator.clipboard&&navigator.clipboard.readText){try{txt=(await navigator.clipboard.readText()).trim();}catch(e){}}
 const src=htmlSrc||(/^(https?:\/\/|data:image)/i.test(txt)?txt:"");
 if(src.startsWith("data:image")){const b=await (await fetch(src)).blob();return{blob:b,type:b.type||"image/png"};}
 if(src)return{url:src};
 // Dernier recours : le navigateur refuse de lire (ex. logo SVG copié depuis HLTV) → on attend un Ctrl+V / Coller
 return await waitPasteEvent();
}
function waitPasteEvent(){
 return new Promise((res,rej)=>{
  const tip=document.createElement("div");
  tip.textContent="Appuie maintenant sur Ctrl+V (ou ⌘+V) pour coller l'image";
  Object.assign(tip.style,{position:"fixed",left:"50%",top:"20px",transform:"translateX(-50%)",zIndex:99999,background:"#7C3AED",color:"#fff",
   padding:"12px 18px",borderRadius:"14px",fontWeight:"700",fontSize:"14px",boxShadow:"0 8px 30px rgba(0,0,0,.5)"});
  document.body.appendChild(tip);
  const done=(fn,v)=>{clearTimeout(t);window.removeEventListener("paste",on,true);tip.remove();fn(v);};
  const on=async ev=>{
   ev.preventDefault();
   const dt=ev.clipboardData;if(!dt)return done(rej,new Error("Aucune image dans le presse-papiers"));
   const f=[...dt.files].find(x=>/image/.test(x.type));
   if(f)return done(res,{blob:f,type:f.type||"image/png"});
   const h=dt.getData("text/html")||"";const m=h.match(/<img[^>]+src=["']([^"']+)["']/i);
   if(m)return done(res,{url:m[1].replace(/&amp;/g,"&")});
   const tx=(dt.getData("text/plain")||"").trim();
   if(/^https?:\/\//.test(tx))return done(res,{url:tx});
   done(rej,new Error("Aucune image dans le presse-papiers"));
  };
  window.addEventListener("paste",on,true);
  const t=setTimeout(()=>done(rej,new Error("Aucune image collée (délai dépassé)")),15000);
 });
}

// Colle une image du presse-papiers → Supabase Storage → URL publique
// SVG → PNG 512px (Supabase Storage et les <img> gèrent mieux le PNG)
async function svgToPng(blob){
 const u=URL.createObjectURL(blob);
 try{
  const img=await new Promise((ok,ko)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=ko;i.src=u;});
  const w=img.naturalWidth||512,h=img.naturalHeight||512,k=512/Math.max(w,h);
  const c=document.createElement("canvas");c.width=Math.round(w*k);c.height=Math.round(h*k);
  c.getContext("2d").drawImage(img,0,0,c.width,c.height);
  return await new Promise(ok=>c.toBlob(ok,"image/png"));
 }finally{URL.revokeObjectURL(u);}
}
async function clipboardImageToUrl(folder){
 const r=await readClipboardImage();
 if(r.blob&&/svg/.test(r.type)){try{r.blob=await svgToPng(r.blob);r.type="image/png";}catch(e){}}
 if(r.blob)return await supaUploadPhoto(new File([r.blob],"image."+((r.type.split("/")[1]||"png").replace(/\+.*/,"")),{type:r.type}),folder);
 try{return await supaUploadPhotoFromUrl(r.url,folder);}catch(e){return r.url;}
}

const RosterEditor=memo(function RosterEditor({players,setPlayers,allPlayers,bets=[],customClubs={},setCustomClubs,rosterOpen,setRosterOpen,rosterGame,setRosterGame,rosterLeague,setRosterLeague,rosterTeam,setRosterTeam,editP,setEditP,editPForm,setEditPForm,editPPhotoUrl,setEditPPhotoUrl,editPSaving,setEditPSaving,editTeam,setEditTeam,teamLogoUrl,setTeamLogoUrl,teamLogoSaving,setTeamLogoSaving,rosterHierarchy,showToast,teamLogos={},setTeamLogos,setBets,supaPushBets}){
 const GAMES_R=["CS2","LoL","Dota2","Valorant"];
 const accent="#A78BFA";
 const [searchQ,setSearchQ]=useState("");
 const [sortMode,setSortMode]=useState(""); // "asc" | "desc" | ""
 const [filterNoPhoto,setFilterNoPhoto]=useState(false);
 const [filterNoLogo,setFilterNoLogo]=useState(false);
 const [addToTeam,setAddToTeam]=useState(null); // {team, league, game}
 const [addSearch,setAddSearch]=useState("");
 const [teamSearchQ,setTeamSearchQ]=useState("");
 const [teamSuggestions,setTeamSuggestions]=useState([]);

 const openEdit=p=>{
  openPlayerEditor(p.name);return;
  setEditP(p);
  setEditPForm({name:p.name,game:p.game||"CS2",league:p.league||"",role:p.role||"",team:p.team||""});
  setEditPPhotoUrl(p.photo_url||p.avatar_url||"");
  setTeamSearchQ(p.team||"");
  setTeamSuggestions([]);
 };
 const quickTeamLogo=async(team,game)=>{
  try{
   showToast("Envoi du logo…","#A78BFA");
   const url=await clipboardImageToUrl("teams");
   setTeamLogos(prev=>({...prev,[team+"__"+game]:url}));
   await fetch(SUPA_URL+"/rest/v1/players?team=eq."+encodeURIComponent(team)+"&game=eq."+encodeURIComponent(game),{method:"PATCH",headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":"application/json"},body:JSON.stringify({team_logo_url:url})});
   setPlayers(prev=>{const n={...prev};Object.keys(n).forEach(k=>{if(n[k].team===team&&n[k].game===game)n[k]={...n[k],team_logo_url:url};});return n;});
   showToast("Logo de "+team+" remplacé","#00E676");
  }catch(e){showToast((e&&e.message)||"Collage impossible","#EF4444");}
 };
 const quickPlayerPhoto=async(p)=>{
  try{
   showToast("Envoi de la photo…","#A78BFA");
   const url=await clipboardImageToUrl("players");
   await fetch(SUPA_URL+"/rest/v1/players?id=eq."+encodeURIComponent(p.id),{method:"PATCH",headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":"application/json"},body:JSON.stringify({photo_url:url,avatar_url:url})});
   setPlayers(prev=>{const n={...prev};const k=(p.name||"").toLowerCase().trim();if(n[k])n[k]={...n[k],photo_url:url,avatar_url:url};return n;});
   showToast("Photo de "+p.name+" remplacée","#00E676");
  }catch(e){showToast((e&&e.message)||"Collage impossible","#EF4444");}
 };
 const closeEdit=()=>{setEditP(null);setEditPForm({});setEditPPhotoUrl("");setTeamSearchQ("");setTeamSuggestions([]);};

 const deletePlayer=async(p)=>{
  if(!window.confirm("Supprimer "+p.name+" ?"))return;
  try{
   if(p.id)await supaDeletePlayer(p.id);
   setPlayers(prev=>{const n={...prev};delete n[(p.name||"").toLowerCase().trim()];return n;});
   showToast(p.name+" supprimé","#EF4444");
   if(editP&&editP.id===p.id)closeEdit();
  }catch(e){showToast("Erreur suppression: "+e.message,"#EF4444");}
 };

 const deleteTeam=async(team,game,tPlayers)=>{
  if(!window.confirm("Supprimer le club "+team+" et ses "+tPlayers.length+" joueurs ?"))return;
  try{
   for(const p of tPlayers){if(p.id)await supaDeletePlayer(p.id);}
   setPlayers(prev=>{
    const n={...prev};
    tPlayers.forEach(p=>delete n[p.name.toLowerCase().trim()]);
    return n;
   });
   setRosterTeam(null);
   showToast(team+" supprimé","#EF4444");
  }catch(e){showToast("Erreur: "+e.message,"#EF4444");}
 };

 const savePlayer=async()=>{
  if(!editP)return;
  setEditPSaving(true);
  try{
   const data={...editP,...editPForm,photo_url:editPPhotoUrl||editP.photo_url||null,avatar_url:editPPhotoUrl||editP.avatar_url||null};
   // Always resolve fresh id from players state (editP may be stale after creation)
   const freshKey=(editPForm.name||editP.name||"").toLowerCase().trim();
   const freshGame=editPForm.game||editP.game||"LoL";
   const fresh=Object.values(players).find(p=>(p.name||"").toLowerCase().trim()===freshKey&&p.game===freshGame&&p.id);
   if(fresh)data.id=fresh.id;
   // Upload photo permanently to Supabase Storage
   const _rawUrl=(data.photo_url||"").replace('__FAILED__','');
   if(_rawUrl&&_rawUrl.startsWith('http')&&!_rawUrl.includes('/storage/v1/object/public/')){
    try{
     const permUrl=await supaUploadPhotoFromUrl(_rawUrl,'players');
     if(permUrl===_rawUrl){data.photo_url='__FAILED__'+_rawUrl;data.avatar_url='__FAILED__'+_rawUrl;}
     else{data.photo_url=permUrl;data.avatar_url=permUrl;}
    }catch(e){data.photo_url='__FAILED__'+_rawUrl;data.avatar_url='__FAILED__'+_rawUrl;}
   }
   const result=await supaUpsertPlayer(data);
   if(result&&result.id)data.id=result.id;
   const oldName=editP.name||"";
   const newName=editPForm.name||editP.name||"";
   setPlayers(prev=>{
    const key=newName.toLowerCase().trim();
    const n={...prev};
    const oldKey=oldName.toLowerCase().trim();
    if(oldKey!==key)delete n[oldKey];
    n[key]={...data,id:editP.id};
    return n;
   });
   // Rename player in all bets if name changed
   if(oldName&&newName&&oldName.toLowerCase().trim()!==newName.toLowerCase().trim()){
    setBets(prev=>{
     const updated=prev.map(b=>b.player===oldName?{...b,player:newName,updatedAt:Date.now()}:b);
     const changed=updated.filter(b=>b.player===newName&&prev.find(p=>p.id===b.id&&p.player===oldName));
     if(changed.length>0)setTimeout(()=>supaPushBets(changed).catch(()=>{}),0);
     return updated;
    });
    showToast("Joueur renommé: "+oldName+" → "+newName,"#22C55E");
   } else {
    showToast("Joueur mis à jour ","#22C55E");
   }
   closeEdit();
  }catch(e){showToast("Erreur: "+e.message,"#EF4444");}
  setEditPSaving(false);
 };

 const saveTeamLogo=async()=>{
  if(!editTeam)return;
  setTeamLogoSaving(true);
  try{
   const key=editTeam.team+"__"+editTeam.game;
   let url=teamLogoUrl||"";
   // 1. Save to localStorage immediately
   setTeamLogos(prev=>{
    const updated={...prev,[key]:url};
    try{localStorage.setItem("v7_team_logos",JSON.stringify(updated));}catch(e){}
    return updated;
   });
   // 2. Upload logo to Supabase Storage if external URL
   let finalUrl=url;
   if(url&&url.startsWith('http')&&!url.includes('/storage/v1/object/public/')){
    try{finalUrl=await supaUploadPhotoFromUrl(url,'teams');}catch(e){finalUrl=url;}
   }
   // 3. PATCH team_logo_url directly on all players of this team in Supabase
   const h={"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":"application/json"};
   await fetch(SUPA_URL+"/rest/v1/players?team=eq."+encodeURIComponent(editTeam.team)+"&game=eq."+encodeURIComponent(editTeam.game),
    {method:"PATCH",headers:h,body:JSON.stringify({team_logo_url:finalUrl||null})}).catch(e=>console.warn(e));
   url=finalUrl;
   // 4. Update local players state so it reflects immediately
   setPlayers(prev=>{
    const n={...prev};
    Object.keys(n).forEach(k=>{
     if(n[k].team===editTeam.team&&n[k].game===editTeam.game){
      n[k]={...n[k],team_logo_url:url};
     }
    });
    return n;
   });
   showToast("Logo mis à jour ","#22C55E");
   setEditTeam(null);
   setTeamLogoUrl("");
  }catch(e){console.error("saveTeamLogo error:",e);showToast("Erreur: "+e.message,"#EF4444");}
  setTeamLogoSaving(false);
 };

 // All unique teams for autocomplete
 const allTeams=useMemo(()=>{
  const set=new Set();
  Object.values(players).forEach(p=>{if(p.team)set.add(p.team);});
  // Ajouter les clubs créés manuellement
  Object.entries(customClubs||{}).forEach(([,clubs])=>{clubs.forEach(cl=>{if(cl.name)set.add(cl.name);});});
  return [...set].sort();
 },[players,customClubs,teamLogos]);

 const onTeamInput=useCallback(val=>{
  setTeamSearchQ(val);
  setEditPForm(f=>({...f,team:val}));
  if(val.length<1){setTeamSuggestions([]);return;}
  const q=val.toLowerCase();
  setTeamSuggestions(allTeams.filter(t=>t.toLowerCase().includes(q)).slice(0,6));
 },[allTeams]);

 // Search filter: match player name or team name
 const searchLower=searchQ.toLowerCase();
 const filteredPlayerKeys=searchQ.length>0
  ? Object.keys(players).filter(k=>{
     const p=players[k];
     return (p.name||"").toLowerCase().includes(searchLower)||(p.team||"").toLowerCase().includes(searchLower);
    })
  : null;

 const cardStyle={background:"rgba(10,12,28,.99)",border:"1px solid rgba(255,255,255,.07)",borderRadius:13,overflow:"hidden",marginBottom:8};
 const inputStyle={width:"100%",background:"#111827",border:"1px solid #374151",borderRadius:6,padding:"5px 8px",color:"#E5E7EB",fontSize:11,fontFamily:"Inter,sans-serif",boxSizing:"border-box"};

 return(
  <div style={{marginBottom:8}}>
   <SuiviHead n="users" color="#a78bfa" title="Joueurs" sub={Object.keys(allPlayers).length+" joueurs · photos, équipes, rôles"} flat/>

   <div style={SV_BODY}>

     {/* Dédoublonnage */}
     {(()=>{
      const dups={};
      Object.values(players).forEach(p=>{
       const k=(p.name||"").toLowerCase().trim()+"__"+(p.game||"");
       if(!dups[k])dups[k]=[];
       dups[k].push(p);
      });
      const dupCount=Object.values(dups).filter(arr=>arr.length>1).length;
      if(dupCount===0)return null;
      return(
       <div style={{background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:8,padding:"8px 12px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:11,color:"#EF4444",flex:1}}>⚠️ {dupCount} club(s) en double détectés — certains joueurs ne peuvent pas être déplacés</span>
        <button onClick={async()=>{
         showToast("Fusion en cours...","#F59E0B");
         let fixed=0;
         const byKey={};
         Object.values(players).forEach(p=>{
          const k=(p.name||"").toLowerCase().trim()+"__"+(p.game||"");
          if(!byKey[k])byKey[k]=[];
          byKey[k].push(p);
         });
         for(const [k,arr] of Object.entries(byKey)){
          if(arr.length<2)continue;
          // Keep the one with the most data (most fields filled)
          arr.sort((a,b)=>Object.values(b).filter(Boolean).length-Object.values(a).filter(Boolean).length);
          const keep=arr[0];
          const toDelete=arr.slice(1);
          // Delete duplicates from Supabase
          for(const p of toDelete){
           if(p.id){
            await fetch(SUPA_URL+"/rest/v1/players?id=eq."+encodeURIComponent(p.id),{method:"DELETE",headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY}}).catch(()=>{});
            fixed++;
           }
          }
          // Update local state — remove duplicates
          setPlayers(prev=>{
           const n={...prev};
           toDelete.forEach(p=>delete n[(p.name||"").toLowerCase().trim()]);
           return n;
          });
         }
         showToast(fixed+" doublon(s) supprimé(s) ✓","#22C55E");
        }}
        style={{padding:"5px 10px",background:"rgba(239,68,68,.15)",border:"1px solid rgba(239,68,68,.3)",borderRadius:6,color:"#EF4444",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0}}>
        Fusionner
        </button>
       </div>
      );
     })()}

     {/* Game selector */}
     <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
      {GAMES_R.map(g=>{
       const count=Object.values(players).filter(p=>p.game===g).length;
       const isActive=rosterGame===g;
       return(
        <button key={g} onClick={()=>{setRosterGame(isActive?null:g);setRosterLeague(null);setRosterTeam(null);setSearchQ("");}}
         style={{padding:"5px 10px",borderRadius:20,border:"1.5px solid "+(isActive?accent:"#1F2937"),background:isActive?"rgba(167,139,250,.12)":"transparent",color:isActive?accent:"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",gap:5}}>
         <GameLogo game={g} size={14}/>
         <span style={{opacity:.6,fontSize:10}}>{count}</span>
        </button>
       );
      })}
     </div>


     {/* Search bar */}
     <div style={{position:"relative",marginBottom:10}}>
      <input
       value={searchQ}
       onChange={e=>setSearchQ(e.target.value)}
       placeholder="🔍 Rechercher un joueur ou une équipe..."
       style={{...inputStyle,padding:"8px 12px",borderRadius:10,fontSize:12,background:"#111827",border:"1px solid #1F2937"}}
      />
      {searchQ&&<button onClick={()=>setSearchQ("")} style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#6B7280",cursor:"pointer",fontSize:14}}>✕</button>}
     </div>

     {/* Search results */}
     {searchQ.length>0&&(()=>{
      const results=(filteredPlayerKeys||[]).map(k=>players[k]).filter(Boolean);
      if(results.length===0)return <div style={{fontSize:11,color:"#4a5a6e",padding:"6px 0"}}>Aucun résultat pour "{searchQ}"</div>;
      return(
       <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:12}}>
        {results.map(p=>{
         const isEditing=editP&&editP.id===p.id;
         const avatar=p.photo_url||p.avatar_url||null;
         return(
          <div key={p.id||p.name} style={{...cardStyle,marginBottom:4}}>
           {!isEditing?(
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px"}}>
             {avatar?<img src={avatar} alt={p.name} style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>
              :<div style={{width:32,height:32,borderRadius:"50%",background:"rgba(167,139,250,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:13,fontWeight:800,color:accent}}>{(p.name||"?")[0].toUpperCase()}</div>}
             <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13,color:"#E5E7EB"}}>{p.name}</div>
              <div style={{fontSize:10,color:"#6B7280"}}>{[p.team,p.role,p.game].filter(Boolean).join(" · ")}</div>
             </div>
             <button onClick={()=>openEdit(p)} style={{padding:"5px 10px",background:"rgba(167,139,250,.08)",border:"1px solid rgba(167,139,250,.2)",borderRadius:6,color:accent,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Modifier</button>
             <button onClick={e=>{e.stopPropagation();quickPlayerPhoto(p);}} title="Coller une photo (remplace l'ancienne)" style={{padding:"5px 9px",background:"rgba(96,165,250,.08)",border:"1px solid rgba(96,165,250,.25)",borderRadius:6,color:"#93c5fd",fontSize:11,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/><rect x="8" y="2" width="12" height="14" rx="2"/></svg>Photo</button>
            </div>
           ):(
            <div style={{padding:"10px 12px"}}>
             <PlayerCard
              p={p} bets={bets} teamLogos={teamLogos} allPlayers={players}
              showToast={showToast} editMode={false}
              onEdit={()=>openEdit(p)} onDelete={deletePlayer}
              onFA={async(p)=>{const u={...p,team:""};await supaUpsertPlayer(u);setPlayers(prev=>{const n={...prev};n[(p.name||"").toLowerCase().trim()]={...u,id:p.id};return n;});showToast(p.name+" → FA","#F59E0B");closeEdit();}}
              editP={editP} editPForm={editPForm} setEditPForm={setEditPForm}
              editPPhotoUrl={editPPhotoUrl} setEditPPhotoUrl={setEditPPhotoUrl}
              editPSaving={editPSaving} savePlayer={savePlayer} closeEdit={closeEdit}
              inputStyle={inputStyle} accent={accent}
             />
            </div>
           )}
          </div>
         );
        })}
       </div>
      );
     })()}

     {/* Game tree (only when no search) */}
     {!searchQ&&rosterGame&&(()=>{
      const gameH=rosterHierarchy[rosterGame]||{};
      const leagues=Object.keys(gameH).sort();
      const needLeague=rosterGame==="LoL"||rosterGame==="Valorant";
      const activeLeagues=needLeague?(rosterLeague?[rosterLeague]:leagues):leagues;
      let teams=[];
      activeLeagues.forEach(lg=>{
       Object.entries(gameH[lg]||{}).forEach(([t,ps])=>teams.push({league:lg,team:t,players:ps}));
      });
      // Apply filters
      if(filterNoPhoto){
       teams=teams.map(t=>({...t,players:t.players.filter(p=>!p.photo_url&&!p.avatar_url)})).filter(t=>t.players.length>0);
      }
      if(filterNoLogo){
       teams=teams.filter(t=>!teamLogos[t.team+"__"+rosterGame]&&!t.players[0]?.team_logo_url);
      }
      // Sort
      if(sortMode==="asc")teams.sort((a,b)=>a.players.length-b.players.length);
      else if(sortMode==="desc")teams.sort((a,b)=>b.players.length-a.players.length);
      else teams.sort((a,b)=>a.team.localeCompare(b.team));
      return(
       <div>
        {needLeague&&(
         <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
          {leagues.map(l=>(
           <button key={l} onClick={()=>{setRosterLeague(rosterLeague===l?null:l);setRosterTeam(null);}}
            style={{padding:"4px 10px",borderRadius:16,border:"1px solid "+(rosterLeague===l?"#60A5FA":"#1F2937"),background:rosterLeague===l?"rgba(96,165,250,.1)":"transparent",color:rosterLeague===l?"#60A5FA":"#6B7280",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
            {l}
           </button>
          ))}
         </div>
        )}
        {teams.length===0&&<div style={{fontSize:11,color:"#4a5a6e",padding:"8px 0"}}>Aucun joueur</div>}
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
         {teams.map(({league,team,players:tPlayers})=>{
          const key=team+league;
          const isOpen=rosterTeam===key;
          const logoUrl=teamLogos[team+"__"+rosterGame]||tPlayers[0]?.team_logo_url||null;
          return(
           <div key={key} style={cardStyle}>
            <div style={{display:"flex",width:"100%",alignItems:"center"}}>
            <button onClick={()=>setRosterTeam(isOpen?null:key)}
             style={{flex:1,display:"flex",alignItems:"center",gap:10,padding:"10px 10px 10px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
             {logoUrl?<img src={logoUrl} alt={team} style={{width:28,height:28,borderRadius:6,objectFit:"cover",flexShrink:0}}/>
              :<div style={{width:28,height:28,borderRadius:6,background:"rgba(167,139,250,.12)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:12,color:accent,fontWeight:800}}>{team[0]||"?"}</div>}
             <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
               <span style={{fontWeight:700,fontSize:13,color:"#E5E7EB"}}>{team}</span>
               {rosterGame==="CS2"&&!tPlayers.some(p=>(p.role||"").toLowerCase().includes("awp"))&&(
                <span title="Aucun AWPer" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:16,height:16,borderRadius:"50%",background:"rgba(239,68,68,.2)",border:"1px solid rgba(239,68,68,.4)",color:"#EF4444",fontSize:9,fontWeight:900,flexShrink:0}}>!</span>
               )}
              </div>
              {needLeague&&<div style={{fontSize:9,color:"#4a5a6e",fontWeight:600}}>{league}</div>}
             </div>
             <span style={{fontSize:10,color:"#6B7280"}}>{tPlayers.length}p</span>
             <button onClick={e=>{e.stopPropagation();deleteTeam(team,rosterGame,tPlayers);}}
              style={{padding:"3px 7px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:5,color:"#EF4444",fontSize:10,cursor:"pointer",flexShrink:0}}>🗑️</button>
             <span style={{color:"#6B7280",fontSize:10,transform:isOpen?"rotate(180deg)":"none",display:"inline-block",transition:"transform .2s"}}>▼</span>
            </button>
            <button
             onClick={e=>{e.stopPropagation();setAddToTeam(addToTeam?.team===team&&addToTeam?.league===league?null:{team,league,game:rosterGame});setAddSearch("");}}
             style={{padding:"0 12px",height:"100%",minHeight:48,background:"transparent",border:"none",borderLeft:"1px solid rgba(255,255,255,.05)",cursor:"pointer",color:"#22C55E",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
             {addToTeam?.team===team&&addToTeam?.league===league?"✕":"+"}
            </button>
            </div>
            {/* Add player to team panel */}
            {addToTeam?.team===team&&addToTeam?.league===league&&(()=>{
             const q=addSearch.toLowerCase();
             const results=Object.values(players).filter(p=>
              p.game===rosterGame&&
              (p.team!==team||p.league!==league)&&
              (p.name||"").toLowerCase().includes(q)
             ).sort((a,b)=>a.name.localeCompare(b.name));
             return(
              <div style={{borderTop:"1px solid rgba(34,197,94,.15)",background:"rgba(34,197,94,.03)",padding:"10px 12px"}}>
               <input autoFocus value={addSearch} onChange={e=>setAddSearch(e.target.value)}
                placeholder={"Chercher un joueur "+rosterGame+"..."}
                style={{width:"100%",background:"#111827",border:"1px solid #374151",borderRadius:8,padding:"7px 12px",color:"#E5E7EB",fontSize:12,fontFamily:"Inter,sans-serif",marginBottom:8,boxSizing:"border-box"}}/>
               {addSearch.length>0&&(
                <div style={{maxHeight:200,overflowY:"auto",display:"flex",flexDirection:"column",gap:3}}>
                 {results.length===0&&<div style={{fontSize:11,color:"#4a5a6e",padding:"4px 0"}}>Aucun résultat</div>}
                 {results.map(p=>{
                  const av=p.photo_url||p.avatar_url||null;
                  return(
                   <div key={p.id||p.name} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:"rgba(255,255,255,.03)",borderRadius:6,border:"1px solid rgba(255,255,255,.05)"}}>
                    {av?<img src={av} alt={p.name} style={{width:26,height:26,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>
                     :<div style={{width:26,height:26,borderRadius:"50%",background:"rgba(167,139,250,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:11,fontWeight:800,color:accent}}>{(p.name||"?")[0].toUpperCase()}</div>}
                    <div style={{flex:1}}>
                     <div style={{fontSize:12,fontWeight:700,color:"#E5E7EB"}}>{p.name}</div>
                     <div style={{fontSize:10,color:"#6B7280"}}>{[p.team||"Free Agent",p.role].filter(Boolean).join(" · ")}</div>
                    </div>
                    <button onClick={async()=>{
                     const updated={...p,team,league};
                     await supaUpsertPlayer(updated);
                     setPlayers(prev=>{const n={...prev};n[(p.name||"").toLowerCase().trim()]={...updated,id:p.id};return n;});
                     showToast(p.name+" → "+team,"#22C55E");
                    }} style={{padding:"4px 10px",background:"rgba(34,197,94,.15)",border:"1px solid rgba(34,197,94,.3)",borderRadius:6,color:"#22C55E",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0}}>
                     + Ajouter
                    </button>
                   </div>
                  );
                 })}
                </div>
               )}
              </div>
             );
            })()}
            {isOpen&&(
             <div style={{borderTop:"1px solid #1F2937",padding:"8px 0"}}>
              {/* Logo équipe */}
              <div style={{padding:"6px 14px 10px",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
               <div style={{fontSize:10,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:6}}>Logo équipe</div>
               {editTeam?.team===team&&editTeam?.game===rosterGame?(
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                 <div onClick={e=>e.stopPropagation()} style={{flex:1}}>
                  <ImageInput value={teamLogoUrl} onChange={setTeamLogoUrl} folder="teams" size={32} placeholder="URL du logo" showToast={showToast}/>
                 </div>
                 <button onClick={e=>{e.stopPropagation();saveTeamLogo();}} disabled={teamLogoSaving} style={{padding:"6px 10px",background:"rgba(34,197,94,.15)",border:"1px solid rgba(34,197,94,.3)",borderRadius:6,color:"#22C55E",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{teamLogoSaving?"...":"✓"}</button>
                 <button onClick={e=>{e.stopPropagation();setEditTeam(null);setTeamLogoUrl("");}} style={{padding:"6px 10px",background:"transparent",border:"1px solid #1F2937",borderRadius:6,color:"#6B7280",fontSize:11,cursor:"pointer"}}>✕</button>
                </div>
               ):(
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                <button onClick={e=>{e.stopPropagation();quickTeamLogo(team,rosterGame);}} title="Coller un logo (remplace l'ancien)" style={{padding:"5px 10px",background:"rgba(96,165,250,.08)",border:"1px solid rgba(96,165,250,.25)",borderRadius:6,color:"#93c5fd",fontSize:11,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:5}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/><rect x="8" y="2" width="12" height="14" rx="2"/></svg>Coller logo</button>
                <button onClick={e=>{e.stopPropagation();setEditTeam({team,game:rosterGame});setTeamLogoUrl(logoUrl||"");}} style={{padding:"5px 10px",background:"rgba(167,139,250,.08)",border:"1px solid rgba(167,139,250,.2)",borderRadius:6,color:accent,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                 {logoUrl?"✏️ Modifier logo":"+ Ajouter logo"}
                </button>
                </div>
               )}
              </div>
              {/* Players */}
              {tPlayers.sort((a,b)=>a.name.localeCompare(b.name)).map(p=>{
               const isEditing=editP&&editP.id===p.id;
               const avatar=p.photo_url||p.avatar_url||null;
               return(
                <div key={p.id||p.name} style={{padding:"8px 14px",borderTop:"1px solid rgba(255,255,255,.03)"}}>
                 {!isEditing?(
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                   {avatar?<img src={avatar} alt={p.name} style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>
                    :<div style={{width:32,height:32,borderRadius:"50%",background:"rgba(167,139,250,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:13,fontWeight:800,color:accent}}>{(p.name||"?")[0].toUpperCase()}</div>}
                   <div style={{flex:1}}>
                    <div style={{fontWeight:700,fontSize:13,color:"#E5E7EB"}}>{p.name}</div>
                    <div style={{fontSize:10,color:"#6B7280"}}>{[p.role,p.league].filter(Boolean).join(" · ")||"—"}</div>
                   </div>
                   <button onClick={()=>openEdit(p)} style={{padding:"5px 10px",background:"rgba(167,139,250,.08)",border:"1px solid rgba(167,139,250,.2)",borderRadius:6,color:accent,fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Modifier</button>
                   {p.team&&<button onClick={async e=>{e.stopPropagation();const u={...p,team:""};await supaUpsertPlayer(u);setPlayers(prev=>{const n={...prev};n[(p.name||"").toLowerCase().trim()]={...u,id:p.id};return n;});showToast(p.name+" → Free Agent","#F59E0B");}} style={{padding:"5px 8px",background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",borderRadius:6,color:"#F59E0B",fontSize:10,fontWeight:700,cursor:"pointer"}}>FA</button>}
                   <button onClick={e=>{e.stopPropagation();quickPlayerPhoto(p);}} title="Coller une photo (remplace l'ancienne)" style={{padding:"5px 9px",background:"rgba(96,165,250,.08)",border:"1px solid rgba(96,165,250,.25)",borderRadius:6,color:"#93c5fd",fontSize:11,fontWeight:700,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/><rect x="8" y="2" width="12" height="14" rx="2"/></svg>Photo</button>
                  </div>
                 ):(
                  <div style={{padding:"10px 12px"}}>
                   <PlayerCard
                    p={p} bets={bets} teamLogos={teamLogos} allPlayers={players}
                    showToast={showToast} editMode={true}
                    onEdit={()=>openEdit(p)} onDelete={deletePlayer}
                    onFA={async(p)=>{const u={...p,team:""};await supaUpsertPlayer(u);setPlayers(prev=>{const n={...prev};n[(p.name||"").toLowerCase().trim()]={...u,id:p.id};return n;});showToast(p.name+" → FA","#F59E0B");closeEdit();}}
                    editP={editP} editPForm={editPForm} setEditPForm={setEditPForm}
                    editPPhotoUrl={editPPhotoUrl} setEditPPhotoUrl={setEditPPhotoUrl}
                    editPSaving={editPSaving} savePlayer={savePlayer} closeEdit={closeEdit}
                    inputStyle={inputStyle} accent={accent}
                   />
                  </div>
                 )}
                </div>
               );
              })}
             </div>
            )}
           </div>
          );
         })}
        </div>
       </div>
      );
     })()}
    </div>
  </div>
 );

 function renderEditForm(p){
  const roles=ROLES_BY_GAME[editPForm.game||"CS2"]||ROLES_BY_GAME.CS2;
  return(
   <div style={{display:"flex",flexDirection:"column",gap:8}}>
    <div style={{fontSize:11,fontWeight:700,color:accent,marginBottom:2}}>{p.name}</div>
    {/* Photo */}
    <div>
     <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:4}}>Photo joueur</div>
     <ImageInput value={editPPhotoUrl} onChange={setEditPPhotoUrl} folder="players" radius="50%" size={36} placeholder="https://... (photo joueur)" showToast={showToast}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
     {/* Pseudo */}
     <div>
      <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>Pseudo</div>
      <input value={editPForm.name||""} onChange={e=>setEditPForm(f=>({...f,name:e.target.value}))} style={inputStyle}/>
     </div>
     {/* Poste - dropdown */}
     <div>
      <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>Poste</div>
      <select value={editPForm.role||""} onChange={e=>setEditPForm(f=>({...f,role:e.target.value}))}
       style={{...inputStyle,appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}>
       <option value="">— Choisir —</option>
       {roles.map(r=><option key={r} value={r}>{r}</option>)}
      </select>
     </div>
     {/* Ligue */}
     <div>
      <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>Ligue</div>
      <input value={editPForm.league||""} onChange={e=>setEditPForm(f=>({...f,league:e.target.value}))} style={inputStyle}/>
     </div>
     {/* Équipe - dropdown avec compteur */}
     <div>
      <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>Équipe</div>
      {(()=>{
       // Build team list: group by team+league to avoid merging duplicates
       const gameTeams={};
       Object.values(players).forEach(p=>{
        if((p.game||"")!==(editPForm.game||editP?.game||""))return;
        const t=p.team||"";if(!t)return;
        const l=p.league||"";
        const key=t+"|||"+l;
        if(!gameTeams[key])gameTeams[key]={team:t,league:l,count:0};
        gameTeams[key].count++;
       });
       const sortedTeams=Object.values(gameTeams).sort((a,b)=>a.team.localeCompare(b.team)||a.league.localeCompare(b.league));
       const curTeam=editPForm.team||"";
       const curLeague=editPForm.league||"";
       return(
        <select
         value={curTeam+"|||"+curLeague}
         onChange={e=>{
          const [t,l]=e.target.value.split("|||");
          setEditPForm(f=>({...f,team:t,league:l}));
         }}
         style={{...inputStyle,appearance:"none",WebkitAppearance:"none",cursor:"pointer",paddingRight:24}}>
         <option value="|||">— Choisir un club —</option>
         {sortedTeams.map(({team,league,count})=>{
          const hasLogo=!!(teamLogos[team+"__"+(editPForm.game||editP?.game||"")]);
          return(
           <option key={team+"|||"+league} value={team+"|||"+league}>
            {hasLogo?"✓ ":""}{team}{league?" · "+league:""} ({count}p)
           </option>
          );
         })}
        </select>
       );
      })()}
     </div>
    </div>
    {/* Jeu */}
    <div>
     <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:4}}>Jeu</div>
     <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
      {GAMES_R.map(g=>(
       <button key={g} onClick={()=>setEditPForm(f=>({...f,game:g}))}
        style={{padding:"4px 8px",borderRadius:12,border:"1px solid "+(editPForm.game===g?accent:"#1F2937"),background:editPForm.game===g?"rgba(167,139,250,.12)":"transparent",color:editPForm.game===g?accent:"#6B7280",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",gap:4}}>
        <GameLogo game={g} size={12}/>{g}
       </button>
      ))}
     </div>
    </div>
    {/* Actions */}
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
     <button onClick={savePlayer} disabled={editPSaving}
      style={{flex:1,padding:"7px",background:"rgba(34,197,94,.15)",border:"1px solid rgba(34,197,94,.3)",borderRadius:8,color:"#22C55E",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
      {editPSaving?"Sauvegarde...":"✓ Sauvegarder"}
     </button>
     {p.team&&(
      <button onClick={async()=>{
       const updated={...p,...editPForm,team:"",photo_url:editPPhotoUrl||p.photo_url||null,avatar_url:editPPhotoUrl||p.avatar_url||null};
       try{
        await supaUpsertPlayer(updated);
        setPlayers(prev=>{const n={...prev};n[(p.name||"").toLowerCase().trim()]={...updated,id:p.id};return n;});
        showToast(p.name+" → Free Agent","#F59E0B");
        closeEdit();
       }catch(e){showToast("Erreur: "+e.message,"#EF4444");}
      }} style={{padding:"7px 10px",background:"rgba(245,158,11,.1)",border:"1px solid rgba(245,158,11,.3)",borderRadius:8,color:"#F59E0B",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
      FA
      </button>
     )}
     <button onClick={closeEdit} style={{padding:"7px 12px",background:"transparent",border:"1px solid #1F2937",borderRadius:8,color:"#6B7280",fontSize:12,cursor:"pointer"}}>✕</button>
     <button onClick={()=>deletePlayer(p)} style={{padding:"7px 10px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:8,color:"#EF4444",fontSize:12,cursor:"pointer"}}>🗑️</button>
    </div>
   </div>
  );
 }
});


function MediaManager({mediaStore,setMediaStore,bkPhotos,teamLogos,showToast}){
 const MEDIA_ITEMS=[{key:"_B64_PP_LOGO_B64",label:"Logo PrizePicks"},{key:"_B64_AMERICAS",label:"VCT Americas"},{key:"_B64_CHINA",label:"VCT China"},{key:"_B64_PACIFIC",label:"VCT Pacific"},{key:"_B64_EMEA",label:"VCT EMEA"},{key:"_B64_WAGER",label:"Wager"},{key:"_B64_EWC",label:"EWC"},{key:"_B64_PGL",label:"PGL"},{key:"_B64_THEINTERNATIONAL",label:"The International"},{key:"_B64_CHAMPIONS",label:"Champions"},{key:"LOL_ROLE_TOP",label:"LoL Top"},{key:"LOL_ROLE_MID",label:"LoL Mid"},{key:"LOL_ROLE_BOT",label:"LoL Bot"},{key:"LOL_ROLE_SUP",label:"LoL Support"},{key:"LOL_ROLE_JUN",label:"LoL Jungle"},{key:"league_Americas",label:"Ligue Americas"},{key:"league_EMEA",label:"Ligue EMEA"},{key:"league_Pacific",label:"Ligue Pacific"},{key:"league_LCS",label:"LCS"},{key:"league_LEC",label:"LEC"},{key:"league_LCK",label:"LCK"},{key:"league_ESL",label:"ESL"},{key:"league_BLAST",label:"BLAST"},{key:"league_Riyadh Masters",label:"Riyadh Masters"},{key:"league_DreamLeague",label:"DreamLeague"},{key:"league_XSE Pro League",label:"XSE Pro League"},{key:"league_Stake Ranked",label:"Stake Ranked"},{key:"league_MSI",label:"MSI"},{key:"league_LPL",label:"LPL"}];
 const [open,setOpen]=useState(false);
 const [editingKey,setEditingKey]=useState(null);
 const [urlInput,setUrlInput]=useState("");
 const missing=MEDIA_ITEMS.filter(m=>!mediaStore[m.key]).length;

 const save=async(key,url)=>{
  let finalUrl=url.trim();
  if(finalUrl&&finalUrl.startsWith('http')&&!finalUrl.includes('/storage/v1/object/public/')){
   try{finalUrl=await supaUploadPhotoFromUrl(finalUrl,'media');}catch(e){}
  }
  const s={...mediaStore,[key]:finalUrl};
  setMediaStore(s);
   applyMediaStore(s);
  supaUpdateMediaRow("__MEDIA_STORE__",s).catch(()=>{});
  setEditingKey(null);setUrlInput("");
  showToast("✓ Mis à jour","#22C55E");
 };

 return(
  <div style={{marginBottom:8}}>
   <button onClick={()=>setOpen(o=>!o)}
    style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#111827",border:"1px solid #1F2937",borderRadius:open?"13px 13px 0 0":"13px",padding:"12px 16px",cursor:"pointer",transition:"border-radius .2s"}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
     <span style={{fontSize:14}}>🖼️</span>
     <span style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>Médias</span>
     {missing>0&&<span style={{background:"rgba(239,68,68,.15)",color:"#EF4444",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20}}>{missing} manquants</span>}
     {missing===0&&<span style={{background:"rgba(34,197,94,.12)",color:"#22C55E",fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:20}}>✓ Complets</span>}
    </div>
    <span style={{color:"#6B7280",fontSize:12,transform:open?"rotate(180deg)":"none",display:"inline-block",transition:"transform .2s"}}>▼</span>
   </button>
   {open&&(
    <div style={{background:"#0D1117",border:"1px solid #1F2937",borderTop:"none",borderRadius:"0 0 13px 13px",padding:"12px"}}>
     <div style={{fontSize:10,color:"#4a5a6e",marginBottom:10}}>Colle une URL pour chaque image. Les logos s'affichent immédiatement partout dans l'app.</div>
     <div style={{display:"flex",flexDirection:"column",gap:4}}>
      {MEDIA_ITEMS.map(item=>{
       const isEdit=editingKey===item.key;
       const cur=mediaStore[item.key]||null;
       return(
        <div key={item.key} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",background:"rgba(255,255,255,.02)",borderRadius:8,border:"1px solid rgba(255,255,255,.04)"}}>
         <div style={{width:28,height:28,borderRadius:6,background:"#111827",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
          {cur?<img src={cur} alt={item.label} style={{width:28,height:28,objectFit:"cover"}} onError={e=>e.target.style.opacity=".2"}/>:<span style={{fontSize:8,color:"#374151"}}>?</span>}
         </div>
         <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,fontWeight:600,color:cur?"#E5E7EB":"#6B7280"}}>{item.label}</div>
          {!isEdit&&cur&&<div style={{fontSize:9,color:"#22C55E",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>✓ {cur.slice(0,50)}</div>}
          {!isEdit&&!cur&&<div style={{fontSize:9,color:"#EF4444"}}>Aucune image</div>}
          {isEdit&&(
           <div style={{display:"flex",gap:4,marginTop:3}}>
            <input autoFocus value={urlInput} onChange={e=>setUrlInput(e.target.value)}
             onKeyDown={e=>{if(e.key==="Enter")save(item.key,urlInput);}}
             placeholder="https://..."
             style={{flex:1,background:"#111827",border:"1px solid #374151",borderRadius:5,padding:"4px 7px",color:"#E5E7EB",fontSize:10,fontFamily:"Inter,sans-serif"}}/>
            <button onClick={()=>save(item.key,urlInput)}
             style={{padding:"4px 8px",background:"rgba(34,197,94,.15)",border:"1px solid rgba(34,197,94,.3)",borderRadius:5,color:"#22C55E",fontSize:10,fontWeight:700,cursor:"pointer"}}>✓</button>
            <button onClick={()=>{setEditingKey(null);setUrlInput("");}}
             style={{padding:"4px 8px",background:"transparent",border:"1px solid #1F2937",borderRadius:5,color:"#6B7280",fontSize:10,cursor:"pointer"}}>✕</button>
           </div>
          )}
         </div>
         {!isEdit&&(
          <button onClick={()=>{setEditingKey(item.key);setUrlInput(cur||"");}}
           style={{padding:"4px 8px",background:cur?"rgba(255,255,255,.05)":"rgba(167,139,250,.08)",border:"1px solid "+(cur?"#1F2937":"rgba(167,139,250,.2)"),borderRadius:6,color:cur?"#6B7280":"#A78BFA",fontSize:10,fontWeight:600,cursor:"pointer",flexShrink:0}}>
           {cur?"Modifier":"+ URL"}
          </button>
         )}
        </div>
       );
      })}
     </div>
     <div style={{display:"flex",gap:6,marginTop:10}}>
      <button onClick={async()=>{
       // Force push everything to Supabase
       await supaUpdateMediaRow("__MEDIA_STORE__",mediaStore).catch(()=>{});
       await supaUpdateMediaRow("__BK_PHOTOS__",bkPhotos||{}).catch(()=>{});
       await supaUpdateMediaRow("__TEAM_LOGOS__",teamLogos||{}).catch(()=>{});
       showToast("✓ Médias synchronisés vers le cloud","#22C55E");
      }}
      style={{flex:1,padding:"7px",background:"rgba(34,197,94,.08)",border:"1px solid rgba(34,197,94,.2)",borderRadius:8,color:"#22C55E",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
      ☁️ Sync vers cloud
      </button>
      <button onClick={()=>{setMediaStore({});applyMediaStore({});supaUpdateMediaRow("__MEDIA_STORE__",{}).catch(()=>{});showToast("Médias réinitialisés","#EF4444");}}
       style={{padding:"7px 10px",background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.15)",borderRadius:8,color:"#EF4444",fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
       🗑️
      </button>
     </div>
    </div>
   )}
  </div>
 );
}

const CreateSection=memo(function CreateSection({teamLogos,setTeamLogos,bkPhotos,setBkPhotos,bookmakers,setBookmakers,customClubs,setCustomClubs,showToast}){
 const [open,setOpen]=useState(false);
 const [tab,setTab]=useState("club");
 const [clubName,setClubName]=useState("");
 const [clubGame,setClubGame]=useState("CS2");
 const [clubUrl,setClubUrl]=useState("");
 const [clubSaving,setClubSaving]=useState(false);
 const [bkName,setBkName]=useState("");
 const [bkUrl,setBkUrl]=useState("");
 const [bkSaving,setBkSaving]=useState(false);

 const saveClub=async()=>{
  if(!clubName.trim())return showToast("Nom requis","#EF4444");
  setClubSaving(true);
  let logoUrl="";
  if(clubUrl.trim()){
   logoUrl=clubUrl.trim();
   if(logoUrl.startsWith('http')&&!logoUrl.includes('/storage/v1/object/public/')){
    try{logoUrl=await supaUploadPhotoFromUrl(logoUrl,'teams');}catch(e){}
   }
   const key=clubName.trim()+"__"+clubGame;
   setTeamLogos(prev=>{const m={...prev,[key]:logoUrl};localStorage.setItem("v7_team_logos",JSON.stringify(m));return m;});
   const h={"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":"application/json"};
   await fetch(SUPA_URL+"/rest/v1/players?team=eq."+encodeURIComponent(clubName.trim())+"&game=eq."+encodeURIComponent(clubGame),
    {method:"PATCH",headers:h,body:JSON.stringify({team_logo_url:logoUrl})}).catch(()=>{});
  }
  // Save club to customClubs for persistence
  if(setCustomClubs){
   setCustomClubs(prev=>{
    const g=clubGame;
    const existing=prev[g]||[];
    // Don't duplicate
    if(existing.some(cl=>cl.name.toLowerCase()===clubName.trim().toLowerCase()))return prev;
    return {...prev,[g]:[...existing,{name:clubName.trim(),league:"",logoUrl:logoUrl||""}]};
   });
  }
  showToast("Club "+clubName.trim()+" créé ✓","#22C55E");
  setClubName("");setClubUrl("");setClubSaving(false);
 };

 const saveBK=async()=>{
  if(!bkName.trim())return showToast("Nom requis","#EF4444");
  setBkSaving(true);
  let bkLogoUrl=bkUrl.trim();
  if(bkLogoUrl&&bkLogoUrl.startsWith('http')&&!bkLogoUrl.includes('/storage/v1/object/public/')){
   try{bkLogoUrl=await supaUploadPhotoFromUrl(bkLogoUrl,'bookmakers');}catch(e){}
  }
  const updated={...bkPhotos,[bkName.trim()]:bkLogoUrl||""};
  setBkPhotos(updated);
  
  if(!bookmakers.includes(bkName.trim()))setBookmakers(prev=>[...prev,bkName.trim()]);
  showToast("Bookmaker "+bkName.trim()+" ajouté ✓","#22C55E");
  setBkName("");setBkUrl("");setBkSaving(false);
 };

 const iStyle={width:"100%",background:"#111827",border:"1px solid #374151",borderRadius:6,padding:"7px 10px",color:"#E5E7EB",fontSize:12,fontFamily:"Inter,sans-serif",boxSizing:"border-box"};

 return(
  <div style={{marginBottom:8}}>
   <SuiviHead n="plus" color="#34d399" title="Créer" sub="Un club ou un bookmaker" open={open} onClick={()=>setOpen(o=>!o)}/>
   {open&&(
    <div style={SV_BODY}>
     <div style={{display:"flex",gap:6,marginBottom:12}}>
      {[["club","🏟️ Club"],["bk","📚 Bookmaker"]].map(([id,label])=>(
       <button key={id} onClick={()=>setTab(id)}
        style={{flex:1,padding:"7px",borderRadius:8,border:"1px solid "+(tab===id?"rgba(167,139,250,.3)":"#1F2937"),background:tab===id?"rgba(167,139,250,.1)":"transparent",color:tab===id?"#A78BFA":"#6B7280",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
        {label}
       </button>
      ))}
     </div>
     {tab==="club"&&(
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
       <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:6}}>
        <div>
         <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>Nom du club *</div>
         <input value={clubName} onChange={e=>setClubName(e.target.value)} placeholder="ex: Vitality" style={iStyle}/>
        </div>
        <div>
         <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>Jeu</div>
         <select value={clubGame} onChange={e=>setClubGame(e.target.value)}
          style={{background:"#111827",border:"1px solid #374151",borderRadius:6,padding:"7px 10px",color:"#E5E7EB",fontSize:12,fontFamily:"Inter,sans-serif",cursor:"pointer",appearance:"none"}}>
          {["CS2","LoL","Dota2","Valorant"].map(g=><option key={g} value={g}>{g}</option>)}
         </select>
        </div>
       </div>
       <div>
        <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>URL Logo</div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
         {clubUrl&&<img src={clubUrl} alt="" style={{width:28,height:28,borderRadius:6,objectFit:"cover",flexShrink:0}} onError={e=>e.target.style.display="none"}/>}
         <input value={clubUrl} onChange={e=>setClubUrl(e.target.value)} placeholder="https://..." style={{...iStyle,flex:1,width:"auto"}}/>
         {clubUrl&&<button onClick={()=>setClubUrl("")} style={{padding:"5px 8px",background:"transparent",border:"1px solid #1F2937",borderRadius:5,color:"#6B7280",fontSize:11,cursor:"pointer"}}>✕</button>}
        </div>
       </div>
       <button onClick={saveClub} disabled={clubSaving||!clubName.trim()}
        style={{width:"100%",padding:"8px",background:clubName.trim()?"rgba(34,197,94,.15)":"rgba(255,255,255,.03)",border:"1px solid "+(clubName.trim()?"rgba(34,197,94,.3)":"#1F2937"),borderRadius:8,color:clubName.trim()?"#22C55E":"#374151",fontSize:12,fontWeight:700,cursor:clubName.trim()?"pointer":"default",fontFamily:"Inter,sans-serif"}}>
        {clubSaving?"Création...":"✓ Créer le club"}
       </button>
      </div>
     )}
     {tab==="bk"&&(
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
       <div>
        <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>Nom du bookmaker *</div>
        <input value={bkName} onChange={e=>setBkName(e.target.value)} placeholder="ex: Stake" style={iStyle}/>
       </div>
       <div>
        <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>URL Logo</div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
         {bkUrl&&<img src={bkUrl} alt="" style={{width:28,height:28,borderRadius:8,objectFit:"cover",flexShrink:0}} onError={e=>e.target.style.display="none"}/>}
         <input value={bkUrl} onChange={e=>setBkUrl(e.target.value)} placeholder="https://..." style={{...iStyle,flex:1,width:"auto"}}/>
         {bkUrl&&<button onClick={()=>setBkUrl("")} style={{padding:"5px 8px",background:"transparent",border:"1px solid #1F2937",borderRadius:5,color:"#6B7280",fontSize:11,cursor:"pointer"}}>✕</button>}
        </div>
       </div>
       <button onClick={saveBK} disabled={bkSaving||!bkName.trim()}
        style={{width:"100%",padding:"8px",background:bkName.trim()?"rgba(34,197,94,.15)":"rgba(255,255,255,.03)",border:"1px solid "+(bkName.trim()?"rgba(34,197,94,.3)":"#1F2937"),borderRadius:8,color:bkName.trim()?"#22C55E":"#374151",fontSize:12,fontWeight:700,cursor:bkName.trim()?"pointer":"default",fontFamily:"Inter,sans-serif"}}>
        {bkSaving?"Ajout...":"✓ Ajouter le bookmaker"}
       </button>
      </div>
     )}
    </div>
   )}
  </div>
 );
});

function PhotoMigrator({allPlayers,setPlayers,showToast}){
 const [migrating,setMigrating]=useState(false);
 const [result,setResult]=useState(null);

 const migrate=async()=>{
  setMigrating(true);setResult(null);
  const toMigrate=Object.values(allPlayers).filter(p=>
   p.photo_url&&p.photo_url.startsWith('http')&&!p.photo_url.includes('/storage/v1/object/public/')
  );
  showToast("Migration de "+toMigrate.length+" photos...","#A78BFA");
  let done=0,skipped=0,failed=0;
  for(const p of toMigrate){
   try{
    const permUrl=await supaUploadPhotoFromUrl(p.photo_url,'players');
    if(permUrl!==p.photo_url){
     await supaUpsertPlayer({...p,photo_url:permUrl,avatar_url:permUrl});
     setPlayers(prev=>{const n={...prev};const k=(p.name||"").toLowerCase().trim();if(n[k])n[k]={...n[k],photo_url:permUrl,avatar_url:permUrl};return n;});
     done++;
    }else skipped++;
   }catch(e){failed++;console.warn("Migration failed for",p.name,e);}
  }
  setResult({done,skipped,failed});
  setMigrating(false);
  showToast("✓ "+done+" photos migrées","#22C55E");
 };

 return(
  <div style={{marginTop:10}}>
   <button onClick={migrate} disabled={migrating}
    style={{width:"100%",padding:"11px",background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.25)",borderRadius:10,color:"#A78BFA",fontWeight:700,fontSize:13,cursor:migrating?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",marginBottom:result?8:0}}>
    {migrating?"⏳ Migration en cours...":"☁️ Migrer toutes les photos vers Supabase Storage"}
   </button>
   {result&&(
    <div style={{background:"rgba(167,139,250,.06)",border:"1px solid rgba(167,139,250,.15)",borderRadius:10,padding:"10px 14px",fontSize:12}}>
     <div style={{color:"#22C55E",fontWeight:700}}>✓ {result.done} photos migrées</div>
     {result.skipped>0&&<div style={{color:"#6B7280"}}>↷ {result.skipped} déjà en storage</div>}
     {result.failed>0&&<div style={{color:"#EF4444"}}>✗ {result.failed} échouées</div>}
    </div>
   )}
  </div>
 );
}

const TourneyLogos=memo(function TourneyLogos({mediaStore,setMediaStore,showToast,activeTourneys={},savedTourneys={}}){
 const GAMES=["CS2","LoL","Dota2","Valorant"];
 const [open,setOpen]=useState(false);
 const [activeGame,setActiveGame]=useState("CS2");
 const [urlInput,setUrlInput]=useState({});
 const [saving,setSaving]=useState({});
 const GAME_COLORS={CS2:"#F59E0B",LoL:"#A78BFA",Dota2:"#EF4444",Valorant:"#22C55E"};

 const getKey=(game,name)=>"tourney_"+game+"_"+name;
 const getLogo=(game,name)=>mediaStore[getKey(game,name)]||null;
 const isOK=(url)=>url&&url.includes('/storage/v1/object/public/');

 // Get all tourneys per game (active + saved)
 const getTourneys=(game)=>{
  const names=[];
  if(activeTourneys[game]&&activeTourneys[game].name) names.push(activeTourneys[game].name);
  if(savedTourneys&&savedTourneys[game]) savedTourneys[game].forEach(n=>{if(!names.includes(n))names.push(n);});
  return names;
 };

 const save=async(game,name)=>{
  const k=game+"_"+name;
  const url=(urlInput[k]||"").trim();
  if(!url)return showToast("URL requise","#EF4444");
  setSaving(s=>({...s,[k]:true}));
  let finalUrl=url;
  if(finalUrl.startsWith('http')&&!finalUrl.includes('/storage/v1/object/public/')){
   try{finalUrl=await supaUploadPhotoFromUrl(finalUrl,'tourneys');}catch(e){}
  }
  const s={...mediaStore,[getKey(game,name)]:finalUrl};
  setMediaStore(s);
   applyMediaStore(s);
  supaSetMedia("mediaStore",s).catch(()=>{});
  showToast("✓ "+name,"#22C55E");
  setUrlInput(u=>({...u,[k]:""}));
  setSaving(s=>({...s,[k]:false}));
 };

 const remove=(game,name)=>{
  const key=getKey(game,name);
  const s={...mediaStore};delete s[key];
  setMediaStore(s);
  supaSetMedia("mediaStore",s).catch(()=>{});
  showToast("Logo supprimé","#EF4444");
 };

 const gamesWithTourneys=GAMES.filter(g=>getTourneys(g).length>0);
 if(gamesWithTourneys.length===0)return null;

 return(
  <div style={{marginBottom:8}}>
   <SuiviHead n="trophy" color="#fbbf24" title="Logos des tournois" sub={gamesWithTourneys.length+" jeu(x) · "+gamesWithTourneys.reduce((a,g)=>a+getTourneys(g).length,0)+" tournois"} open={open} onClick={()=>setOpen(o=>!o)}/>
   {open&&(
    <div style={SV_BODY}>
     {/* Game tabs */}
     <div style={{display:"flex",gap:6,marginBottom:12}}>
      {GAMES.map(g=>{
       const count=getTourneys(g).length;
       const isActive=activeGame===g;
       return(
        <button key={g} onClick={()=>setActiveGame(g)}
         style={{flex:1,padding:"8px 4px",borderRadius:10,border:"2px solid "+(isActive?GAME_COLORS[g]:"transparent"),background:isActive?"rgba(255,255,255,.05)":"rgba(255,255,255,.02)",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,opacity:count===0?.35:1}}>
         <GameLogo game={g} size={18}/>
         {count>0&&<span style={{fontSize:8,color:isActive?GAME_COLORS[g]:"#6B7280",fontWeight:700}}>{count}</span>}
        </button>
       );
      })}
     </div>

     {/* Tourneys for active game */}
     {(()=>{
      const tourneys=getTourneys(activeGame);
      if(tourneys.length===0)return(
       <div style={{textAlign:"center",fontSize:11,color:"#4a5a6e",padding:"20px 0"}}>
        Aucun tournoi pour {activeGame}
       </div>
      );
      return(
       <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {tourneys.map(name=>{
         const k=activeGame+"_"+name;
         const logo=getLogo(activeGame,name);
         const isActif=activeTourneys[activeGame]&&activeTourneys[activeGame].name===name;
         return(
          <div key={name} style={{background:"rgba(255,255,255,.03)",borderRadius:10,padding:"10px 12px",border:"1px solid rgba(255,255,255,.05)"}}>
           <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            {logo
             ?<img src={logo.replace('__FAILED__','')} alt={name} style={{width:32,height:32,borderRadius:6,objectFit:"contain",flexShrink:0}} onError={e=>e.target.style.opacity=".2"}/>
             :<div style={{width:32,height:32,borderRadius:6,background:"#111827",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#374151"}}>?</div>}
            <div style={{flex:1}}>
             <div style={{fontSize:12,fontWeight:700,color:"#E5E7EB"}}>{name}</div>
             <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2}}>
              {isActif&&<span style={{fontSize:9,color:"#22C55E",fontWeight:700}}>● ACTIF</span>}
              {logo&&<span style={{fontSize:9,color:isOK(logo)?"#22C55E":"#F59E0B",fontWeight:700}}>{isOK(logo)?"● Supabase":"● Externe"}</span>}
             </div>
            </div>
            {logo&&<button onClick={()=>remove(activeGame,name)} style={{padding:"4px 7px",background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.15)",borderRadius:5,color:"#EF4444",fontSize:10,cursor:"pointer"}}>✕</button>}
           </div>
           <ImageInput
            value={urlInput[k]||""}
            onChange={v=>setUrlInput(u=>({...u,[k]:v}))}
            folder="tourneys" size={26} radius="6px"
            placeholder={logo?"Changer le logo...":"URL ou 📁 fichier..."}
            showToast={showToast}
           />
           {(urlInput[k]||"").trim()&&(
            <button onClick={()=>save(activeGame,name)} disabled={saving[k]}
             style={{width:"100%",marginTop:6,padding:"7px",background:"rgba(34,197,94,.15)",border:"1px solid rgba(34,197,94,.3)",borderRadius:8,color:"#22C55E",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
             {saving[k]?"⏳ Sauvegarde...":"✓ Sauvegarder"}
            </button>
           )}
          </div>
         );
        })}
       </div>
      );
     })()}
    </div>
   )}
  </div>
 );
});


const BookmarkersSection=memo(function BookmarkersSection({bookmakers,setBookmakers,bkPhotos,setBkPhotos,showToast,hiddenBKs=new Set(),toggleHideBK}){
 const [open,setOpen]=useState(false);
 const [editingBK,setEditingBK]=useState(null); // null=none, "new"=new, bkName=editing
 const [bkNameInput,setBkNameInput]=useState("");
 const [bkUrlInput,setBkUrlInput]=useState("");
 const [saving,setSaving]=useState(false);

 const saveBK=async()=>{
  if(!bkNameInput.trim())return showToast("Nom requis","#EF4444");
  setSaving(true);
  let url=bkUrlInput.trim();
  if(url&&url.startsWith('http')&&!url.includes('/storage/v1/object/public/')){
   try{url=await supaUploadPhotoFromUrl(url,'bookmakers');}catch(e){}
  }
  const updated={...bkPhotos,[bkNameInput.trim()]:url};
  setBkPhotos(updated);
  
  supaSetMedia("bkPhotos",updated).catch(()=>{});
  if(!bookmakers.includes(bkNameInput.trim())){
   setBookmakers(prev=>[...prev,bkNameInput.trim()].sort());
  }
  showToast("✓ "+bkNameInput.trim(),"#22C55E");
  setEditingBK(null);setBkNameInput("");setBkUrlInput("");setSaving(false);
 };

 const deleteBK=(bk)=>{
  if(!window.confirm("Supprimer "+bk+" ?"))return;
  setBookmakers(prev=>prev.filter(b=>b!==bk));
  const updated={...bkPhotos};delete updated[bk];
  setBkPhotos(updated);
  
  supaSetMedia("bkPhotos",updated).catch(()=>{});
  showToast(bk+" supprimé","#EF4444");
 };

 const startEdit=(bk)=>{
  setEditingBK(bk);
  setBkNameInput(bk);
  setBkUrlInput(bkPhotos[bk]||"");
 };

 const isStoraged=(url)=>url&&url.includes('/storage/v1/object/public/');

 return(
  <div style={{marginBottom:8}}>
   <SuiviHead n="wallet" color="#60a5fa" title="Bookmakers" sub={bookmakers.length+" bookmakers · logos et visibilité"} open={open} onClick={()=>setOpen(o=>!o)}/>
   {open&&(
    <div style={SV_BODY}>
     {/* BK list */}
     <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
      {bookmakers.map(bk=>{
       const logo=bkPhotos[bk]||null;
       const isEdit=editingBK===bk;
       return(
        <div key={bk}>
         {!isEdit?(
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"8px 10px",background:"rgba(255,255,255,.03)",borderRadius:10,border:"1px solid rgba(255,255,255,.05)"}}>
           <div style={{width:32,height:32,borderRadius:8,background:"#111827",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
            {logo?<img src={logo.replace('__FAILED__','')} alt={bk} style={{width:32,height:32,objectFit:"cover"}} onError={e=>e.target.style.opacity=".2"}/>
             :<span style={{fontSize:11,fontWeight:700,color:"#374151"}}>{bk.slice(0,2).toUpperCase()}</span>}
           </div>
           <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:700,color:"#E5E7EB"}}>{bk}</div>
            {logo&&<div style={{fontSize:9,color:isStoraged(logo)?"#22C55E":"#F59E0B",fontWeight:600}}>{isStoraged(logo)?"● Supabase":"● Externe"}</div>}
           </div>
           <button onClick={()=>toggleHideBK&&toggleHideBK(bk)} title={hiddenBKs.has(bk)?"Afficher dans paris":"Masquer dans paris"}
            style={{padding:"4px 8px",background:hiddenBKs.has(bk)?"rgba(239,68,68,.08)":"rgba(34,197,94,.06)",border:"1px solid "+(hiddenBKs.has(bk)?"rgba(239,68,68,.2)":"rgba(34,197,94,.2)"),borderRadius:6,color:hiddenBKs.has(bk)?"#EF4444":"#22C55E",fontSize:10,cursor:"pointer"}}>
            {hiddenBKs.has(bk)?"🙈":"👁️"}
           </button>
           <button onClick={()=>startEdit(bk)} style={{padding:"4px 8px",background:"rgba(167,139,250,.08)",border:"1px solid rgba(167,139,250,.2)",borderRadius:6,color:"#A78BFA",fontSize:10,cursor:"pointer"}}>✏️</button>
           <button onClick={()=>deleteBK(bk)} style={{padding:"4px 8px",background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.15)",borderRadius:6,color:"#EF4444",fontSize:10,cursor:"pointer"}}>🗑️</button>
          </div>
         ):(
          <div style={{padding:"10px",background:"rgba(167,139,250,.05)",borderRadius:10,border:"1px solid rgba(167,139,250,.15)"}}>
           <div style={{fontSize:10,color:"#A78BFA",fontWeight:700,marginBottom:8}}>Modifier {bk}</div>
           <input value={bkNameInput} onChange={e=>setBkNameInput(e.target.value)} placeholder="Nom"
            style={{width:"100%",background:"#111827",border:"1px solid #374151",borderRadius:6,padding:"6px 10px",color:"#E5E7EB",fontSize:11,fontFamily:"Inter,sans-serif",marginBottom:6,boxSizing:"border-box"}}/>
           <div style={{marginBottom:8}}>
            <ImageInput value={bkUrlInput} onChange={setBkUrlInput} folder="bookmakers" size={32} placeholder="URL logo" showToast={showToast}/>
           </div>
           <div style={{display:"flex",gap:6}}>
            <button onClick={saveBK} disabled={saving} style={{flex:1,padding:"7px",background:"rgba(34,197,94,.15)",border:"1px solid rgba(34,197,94,.3)",borderRadius:8,color:"#22C55E",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{saving?"...":"✓ Sauvegarder"}</button>
            <button onClick={()=>{setEditingBK(null);setBkNameInput("");setBkUrlInput("");}} style={{padding:"7px 10px",background:"transparent",border:"1px solid #1F2937",borderRadius:8,color:"#6B7280",fontSize:11,cursor:"pointer"}}>✕</button>
           </div>
          </div>
         )}
        </div>
       );
      })}
     </div>
     {/* Add new */}
     {editingBK==="new"?(
      <div style={{padding:"10px",background:"rgba(34,197,94,.04)",borderRadius:10,border:"1px solid rgba(34,197,94,.15)"}}>
       <div style={{fontSize:10,color:"#22C55E",fontWeight:700,marginBottom:8}}>Nouveau bookmaker</div>
       <input value={bkNameInput} onChange={e=>setBkNameInput(e.target.value)} placeholder="Nom *"
        style={{width:"100%",background:"#111827",border:"1px solid #374151",borderRadius:6,padding:"6px 10px",color:"#E5E7EB",fontSize:11,fontFamily:"Inter,sans-serif",marginBottom:6,boxSizing:"border-box"}}/>
       <div style={{marginBottom:8}}>
        <ImageInput value={bkUrlInput} onChange={setBkUrlInput} folder="bookmakers" size={32} placeholder="URL logo (optionnel)" showToast={showToast}/>
       </div>
       <div style={{display:"flex",gap:6}}>
        <button onClick={saveBK} disabled={saving||!bkNameInput.trim()} style={{flex:1,padding:"7px",background:"rgba(34,197,94,.15)",border:"1px solid rgba(34,197,94,.3)",borderRadius:8,color:"#22C55E",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{saving?"...":"✓ Ajouter"}</button>
        <button onClick={()=>{setEditingBK(null);setBkNameInput("");setBkUrlInput("");}} style={{padding:"7px 10px",background:"transparent",border:"1px solid #1F2937",borderRadius:8,color:"#6B7280",fontSize:11,cursor:"pointer"}}>✕</button>
       </div>
      </div>
     ):(
      <button onClick={()=>{setEditingBK("new");setBkNameInput("");setBkUrlInput("");}}
       style={{width:"100%",padding:"8px",background:"rgba(34,197,94,.06)",border:"1px dashed rgba(34,197,94,.25)",borderRadius:10,color:"#22C55E",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
       + Ajouter un bookmaker
      </button>
     )}
    </div>
   )}
  </div>
 );
});

function ImageInput({value, onChange, folder, placeholder, size=28, radius="6px", showToast}){
 const [uploading, setUploading] = useState(false);
 const inputRef = useRef(null);
 const isOK = value && value.includes('/storage/v1/object/public/');
 const isFailed = value && value.startsWith('__FAILED__');
 const displayUrl = value ? value.replace('__FAILED__', '') : '';

 const handleFile = async(e) => {
  const file = e.target.files && e.target.files[0];
  if(!file) return;
  setUploading(true);
  try {
   const url = await supaUploadFile(file, folder);
   onChange(url);
   if(showToast) showToast("✓ Image uploadée","#22C55E");
  } catch(err) {
   if(showToast) showToast("Erreur upload: "+err.message,"#EF4444");
  }
  setUploading(false);
  e.target.value = "";
 };

 const handlePaste = async() => {
  setUploading(true);
  try{
   const url = await clipboardImageToUrl(folder);
   onChange(url);
   if(showToast) showToast("✓ Image collée et uploadée","#22C55E");
  }catch(e){
   if(showToast) showToast("Erreur: "+e.message,"#EF4444");
  }
  setUploading(false);
 };

 return(
  <div style={{display:"flex",flexDirection:"column",gap:6}}>
   {/* Preview + status */}
   {displayUrl&&(
    <div style={{display:"flex",alignItems:"center",gap:8}}>
     <img src={displayUrl} alt="" style={{width:size,height:size,borderRadius:radius,objectFit:"cover",flexShrink:0}} onError={e=>e.target.style.opacity=".2"}/>
     <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,fontWeight:700,
      background:isOK?"rgba(34,197,94,.15)":isFailed?"rgba(239,68,68,.15)":"rgba(245,158,11,.1)",
      border:"1px solid "+(isOK?"rgba(34,197,94,.3)":isFailed?"rgba(239,68,68,.3)":"rgba(245,158,11,.3)"),
      color:isOK?"#22C55E":isFailed?"#EF4444":"#F59E0B"}}>
      {isOK?"● Supabase":isFailed?"● Échec":"● Externe"}
     </span>
     <button onClick={()=>onChange("")} style={{marginLeft:"auto",padding:"2px 6px",background:"transparent",border:"1px solid #374151",borderRadius:4,color:"#6B7280",fontSize:10,cursor:"pointer"}}>✕</button>
    </div>
   )}
   {/* URL input */}
   <input value={displayUrl} onChange={e=>onChange(e.target.value)}
    placeholder={placeholder||"https://... (URL)"}
    style={{width:"100%",background:"#111827",border:"1px solid #374151",borderRadius:6,padding:"6px 10px",color:"#E5E7EB",fontSize:11,fontFamily:"Inter,sans-serif",boxSizing:"border-box"}}/>
   {/* File upload + clipboard paste */}
   <input ref={inputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>
   <div style={{display:"flex",gap:5}}>
    <button onClick={()=>inputRef.current&&inputRef.current.click()} disabled={uploading}
     style={{flex:1,padding:"6px",background:"rgba(167,139,250,.06)",border:"1px dashed rgba(167,139,250,.25)",borderRadius:6,color:uploading?"#6B7280":"#A78BFA",fontSize:11,fontWeight:600,cursor:uploading?"not-allowed":"pointer",fontFamily:"Inter,sans-serif"}}>
     {uploading?"⏳ Upload...":"📁 Fichier"}
    </button>
    <button onClick={handlePaste} disabled={uploading}
     style={{padding:"6px 10px",background:"rgba(96,165,250,.06)",border:"1px dashed rgba(96,165,250,.25)",borderRadius:6,color:uploading?"#6B7280":"#60A5FA",fontSize:11,fontWeight:600,cursor:uploading?"not-allowed":"pointer",fontFamily:"Inter,sans-serif",flexShrink:0}}>
     📋 Coller
    </button>
   </div>
  </div>
 );
}

const PlayerCard=memo(function PlayerCard({p, bets, teamLogos, allPlayers, showToast, onEdit, onClose, onDelete, onFA, editMode:editModeProp, editP, editPForm, setEditPForm, editPPhotoUrl, setEditPPhotoUrl, editPSaving, savePlayer, closeEdit, inputStyle, accent}){
 const [editMode, setEditMode] = useState(editModeProp||false);
 // Compute stats for this player
 const playerBets = bets.filter(b=>
  b.player&&b.player.toLowerCase().trim()===(p.name||"").toLowerCase().trim()&&
  (b.status==="won"||b.status==="lost")
 );
 const total=playerBets.length;
 const won=playerBets.filter(b=>b.status==="won").length;
 const profit=playerBets.reduce((s,b)=>s+(b.profit||0),0);
 const staked=playerBets.reduce((s,b)=>s+(b.stake||0),0);
 const wr=total>0?(won/total*100):0;
 const roi=staked>0?(profit/staked*100):0;
 const avgOdds=total>0?(playerBets.reduce((s,b)=>s+(b.odds||0),0)/total):0;

 // Stats by Over/Under
 const byOU={};
 playerBets.forEach(b=>{
  const k=b.overUnder||"?";
  if(!byOU[k])byOU[k]={cnt:0,won:0,profit:0,staked:0};
  byOU[k].cnt++;byOU[k].profit+=b.profit;byOU[k].staked+=b.stake;
  if(b.status==="won")byOU[k].won++;
 });

 // Stats by map
 const byMap={};
 playerBets.forEach(b=>{
  const k=b.mapTag||"Sans tag";
  if(!byMap[k])byMap[k]={cnt:0,won:0,profit:0,staked:0};
  byMap[k].cnt++;byMap[k].profit+=b.profit;byMap[k].staked+=b.stake;
  if(b.status==="won")byMap[k].won++;
 });

 // Stats by kill line
 const byKill={};
 playerBets.filter(b=>b.description).forEach(b=>{
  const parts=b.description.split(" ");
  if(parts.length>=3){
   const k=parts[1]+" "+parts[2];
   if(!byKill[k])byKill[k]={cnt:0,won:0,profit:0,staked:0};
   byKill[k].cnt++;byKill[k].profit+=b.profit;byKill[k].staked+=b.stake;
   if(b.status==="won")byKill[k].won++;
  }
 });

 const teamLogo=teamLogos[(p.team||"")+"__"+(p.game||"")]||p.team_logo_url||null;
 const photo=p.photo_url||p.avatar_url||null;
 const pc=v=>v>=0?"#00E676":"#EF4444";
 const wrc=v=>v>=55?"#00E676":v<45?"#EF4444":"#9CA3AF";

 const StatRow=({label,n,wr,profit})=>(
  <div style={{display:"flex",alignItems:"center",padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
   <div style={{flex:1,fontSize:12,fontWeight:600,color:"#E5E7EB"}}>{label}</div>
   <div style={{width:36,textAlign:"right",fontSize:11,color:"#6B7280"}}>{n}p</div>
   <div style={{width:48,textAlign:"right",fontSize:11,fontWeight:700,color:wrc(wr)}}>{wr.toFixed(0)}%</div>
   <div style={{width:64,textAlign:"right",fontSize:11,fontWeight:700,color:pc(profit)}}>{profit>=0?"+":""}{profit.toFixed(0)}$</div>
  </div>
 );

 if(editMode){
  // Edit form
  const roles=ROLES_BY_GAME[editPForm.game||"CS2"]||ROLES_BY_GAME.CS2;
  return(
   <div style={{display:"flex",flexDirection:"column",gap:10,padding:"4px 0"}}>
    <div style={{fontSize:10,color:"#A78BFA",fontWeight:700,textTransform:"uppercase",letterSpacing:.7}}>Modifier {p.name}</div>
    <div>
     <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:4}}>Photo joueur</div>
     <ImageInput value={editPPhotoUrl} onChange={setEditPPhotoUrl} folder="players" radius="50%" size={36} placeholder="https://... (photo joueur)" showToast={showToast}/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
     <div>
      <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>Pseudo</div>
      <input value={editPForm.name||""} onChange={e=>setEditPForm(f=>({...f,name:e.target.value}))} style={inputStyle}/>
     </div>
     <div>
      <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>Poste</div>
      <select value={editPForm.role||""} onChange={e=>setEditPForm(f=>({...f,role:e.target.value}))} style={{...inputStyle,cursor:"pointer",appearance:"none"}}>
       <option value="">—</option>
       {roles.map(r=><option key={r} value={r}>{r}</option>)}
      </select>
     </div>
    </div>
    <div>
     <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>Équipe</div>
     {(()=>{
      const gameTeams={};
      Object.values(allPlayers).forEach(pl=>{
       if((pl.game||"")!==(editPForm.game||p?.game||""))return;
       const t=pl.team||"";if(!t)return;
       const l=pl.league||"";
       const key=t+"|||"+l;
       if(!gameTeams[key])gameTeams[key]={team:t,league:l,count:0};
       gameTeams[key].count++;
      });
      const sorted=Object.values(gameTeams).sort((a,b)=>a.team.localeCompare(b.team)||a.league.localeCompare(b.league));
      const curTeam=editPForm.team||"";const curLeague=editPForm.league||"";
      return(
       <select value={curTeam+"|||"+curLeague} onChange={e=>{const [t,l]=e.target.value.split("|||");setEditPForm(f=>({...f,team:t,league:l}));}} style={{...inputStyle,cursor:"pointer",appearance:"none"}}>
        <option value="|||">— Club —</option>
        {sorted.map(({team,league,count})=>(
         <option key={team+"|||"+league} value={team+"|||"+league}>{team}{league?" · "+league:""} ({count}p)</option>
        ))}
       </select>
      );
     })()}
    </div>
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
     <button onClick={savePlayer} disabled={editPSaving}
      style={{flex:1,padding:"8px",background:"rgba(34,197,94,.15)",border:"1px solid rgba(34,197,94,.3)",borderRadius:8,color:"#22C55E",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
      {editPSaving?"...":"✓ Sauvegarder"}
     </button>
     <button onClick={()=>{setEditMode(false);if(closeEdit)closeEdit();}} style={{padding:"8px 12px",background:"transparent",border:"1px solid #1F2937",borderRadius:8,color:"#6B7280",fontSize:12,cursor:"pointer"}}>✕</button>
     <button onClick={()=>onDelete(p)} style={{padding:"8px 10px",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:8,color:"#EF4444",fontSize:12,cursor:"pointer"}}>🗑️</button>
    </div>
    {/* Sync role to bets history */}
    {editPForm.role&&editPForm.role!==(p.role||"")&&(
     <SyncRoleBtn playerName={p.name} newRole={editPForm.role} oldRole={p.role||""} showToast={showToast}/>
    )}
   </div>
  );
 }

 return(
  <div>
   {/* Header — photo + info + actions */}
   <div style={{display:"flex",gap:12,marginBottom:12,position:"relative"}}>
    {/* Team logo background */}
    {teamLogo&&<img src={teamLogo.replace('__FAILED__','')} alt="" style={{position:"absolute",right:0,top:0,width:80,height:80,objectFit:"contain",opacity:.08,pointerEvents:"none"}} onError={e=>e.target.style.display="none"}/>}
    {/* Player photo */}
    <div style={{width:64,height:64,borderRadius:"50%",background:"#111827",flexShrink:0,overflow:"hidden",border:"2px solid rgba(167,139,250,.2)"}}>
     {photo?<img src={photo.replace('__FAILED__','')} alt={p.name} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.opacity=".2"}/>
      :<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:800,color:accent}}>{(p.name||"?")[0].toUpperCase()}</div>}
    </div>
    <div style={{flex:1,minWidth:0}}>
     <div style={{fontSize:18,fontWeight:800,color:"#E5E7EB",letterSpacing:-.3}}>{p.name}</div>
     <div style={{display:"flex",alignItems:"center",gap:6,marginTop:3,flexWrap:"wrap"}}>
      {teamLogo&&<img src={teamLogo.replace('__FAILED__','')} alt={p.team} style={{width:16,height:16,objectFit:"contain",borderRadius:2}} onError={e=>e.target.style.display="none"}/>}
      {p.team&&<span style={{fontSize:11,color:"#c8d4e8",fontWeight:600}}>{p.team}</span>}
      {p.team&&p.role&&<span style={{color:"#4a5a6e",fontSize:10}}>·</span>}
      {p.role&&<span style={{fontSize:11,color:"#A78BFA",fontWeight:600}}>{p.role}</span>}
     </div>
     {total===0&&<div style={{fontSize:10,color:"#4a5a6e",marginTop:4}}>Aucun pari enregistré</div>}
    </div>
    {/* Action buttons */}
    <div style={{display:"flex",gap:5,flexShrink:0,alignSelf:"flex-start"}}>
     <button onClick={()=>{ setEditMode(true); if(onEdit)onEdit(); }} title="Modifier" style={{padding:"6px 10px",background:"rgba(167,139,250,.1)",border:"1px solid rgba(167,139,250,.2)",borderRadius:8,color:accent,fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>✏️</button>
     {p.team&&<button onClick={()=>onFA(p)} title="Free Agent" style={{padding:"6px 8px",background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.2)",borderRadius:8,color:"#F59E0B",fontSize:10,fontWeight:700,cursor:"pointer"}}>FA</button>}
    </div>
   </div>

   {total>0&&(
    <>
    {/* Global stats */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
     {[["PARIS",total+"p","#E5E7EB"],["ROI",(roi>=0?"+":"")+roi.toFixed(1)+"%",pc(roi)],["PROFIT",(profit>=0?"+":"")+profit.toFixed(0)+"$",pc(profit)],["COT. MOY.","@"+avgOdds.toFixed(2),"#9CA3AF"]].map(([l,v,c])=>(
      <div key={l} style={{background:"rgba(255,255,255,.03)",borderRadius:8,padding:"8px 6px",textAlign:"center",border:"1px solid rgba(255,255,255,.05)"}}>
       <div style={{fontSize:8,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,marginBottom:3}}>{l}</div>
       <div style={{fontSize:14,fontWeight:800,color:c}}>{v}</div>
      </div>
     ))}
    </div>

    {/* Over/Under */}
    {Object.keys(byOU).length>0&&(
     <div style={{background:"rgba(10,12,28,.8)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)",marginBottom:8,overflow:"hidden"}}>
      <div style={{padding:"8px 12px",background:"rgba(167,139,250,.06)",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
       <span style={{fontSize:10,fontWeight:700,color:"#A78BFA",textTransform:"uppercase",letterSpacing:.7}}>Over / Under</span>
      </div>
      {Object.entries(byOU).sort((a,b)=>b[1].profit-a[1].profit).map(([k,v])=>(
       <StatRow key={k} label={k} n={v.cnt} wr={v.won/v.cnt*100} profit={v.profit} roi={v.staked>0?v.profit/v.staked*100:0}/>
      ))}
     </div>
    )}

    {/* By Map */}
    {Object.keys(byMap).length>1&&(
     <div style={{background:"rgba(10,12,28,.8)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)",marginBottom:8,overflow:"hidden"}}>
      <div style={{padding:"8px 12px",background:"rgba(167,139,250,.06)",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
       <span style={{fontSize:10,fontWeight:700,color:"#A78BFA",textTransform:"uppercase",letterSpacing:.7}}>Maps</span>
      </div>
      {Object.entries(byMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>(
       <StatRow key={k} label={k} n={v.cnt} wr={v.won/v.cnt*100} profit={v.profit} roi={v.staked>0?v.profit/v.staked*100:0}/>
      ))}
     </div>
    )}

    {/* Kill lines — exclude headshot */}
    {(()=>{
     const killEntries=Object.entries(byKill).filter(([k])=>!k.toLowerCase().includes("hs")&&!k.toLowerCase().includes("headshot"));
     if(killEntries.length===0)return null;
     return(
      <div style={{background:"rgba(10,12,28,.8)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)",marginBottom:8,overflow:"hidden"}}>
       <div style={{padding:"8px 12px",background:"rgba(167,139,250,.06)",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
        <span style={{fontSize:10,fontWeight:700,color:"#A78BFA",textTransform:"uppercase",letterSpacing:.7}}>Lignes Kills</span>
       </div>
       {killEntries.sort((a,b)=>a[0].localeCompare(b[0])).slice(0,10).map(([k,v])=>(
        <StatRow key={k} label={k} n={v.cnt} wr={v.won/v.cnt*100} profit={v.profit}/>
       ))}
      </div>
     );
    })()}
    {/* CS2 only: Headshot section */}
    {p.game==="CS2"&&(()=>{
     const hsEntries=Object.entries(byKill).filter(([k])=>k.toLowerCase().includes("hs")||k.toLowerCase().includes("headshot"));
     // Also check isHeadshot bets
     const hsBets=playerBets.filter(b=>b.isHeadshot);
     const hsByOU={};
     hsBets.forEach(b=>{
      const k=b.overUnder||"?";
      if(!hsByOU[k])hsByOU[k]={cnt:0,won:0,profit:0};
      hsByOU[k].cnt++;hsByOU[k].profit+=b.profit;
      if(b.status==="won")hsByOU[k].won++;
     });
     if(hsEntries.length===0&&hsBets.length===0)return null;
     return(
      <div style={{background:"rgba(10,12,28,.8)",borderRadius:10,border:"1px solid rgba(255,255,255,.06)",marginBottom:8,overflow:"hidden"}}>
       <div style={{padding:"8px 12px",background:"rgba(239,68,68,.06)",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
        <span style={{fontSize:10,fontWeight:700,color:"#EF4444",textTransform:"uppercase",letterSpacing:.7}}>🎯 Headshots</span>
       </div>
       {hsBets.length>0&&Object.entries(hsByOU).map(([k,v])=>(
        <StatRow key={"hs_"+k} label={"HS "+k} n={v.cnt} wr={v.won/v.cnt*100} profit={v.profit}/>
       ))}
       {hsEntries.sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>(
        <StatRow key={k} label={k} n={v.cnt} wr={v.won/v.cnt*100} profit={v.profit}/>
       ))}
      </div>
     );
    })()}
    </>
   )}
  </div>
 );
});

function SyncRoleBtn({playerName, newRole, oldRole, showToast}){
 const [syncing,setSyncing]=useState(false);
 const [done,setDone]=useState(false);

 const sync=async()=>{
  setSyncing(true);
  try{
   // PATCH all bets where player=name to update role
   const h={"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":"application/json"};
   const res=await fetch(
    SUPA_URL+"/rest/v1/bets?player=ilike."+encodeURIComponent(playerName)+"&role=eq."+encodeURIComponent(oldRole),
    {method:"PATCH",headers:{...h,"Prefer":"return=representation"},body:JSON.stringify({role:newRole})}
   );
   if(!res.ok)throw new Error(await res.text());
   const rows=await res.json();
   setDone(true);
   showToast("✓ "+rows.length+" paris mis à jour → "+newRole,"#22C55E");
  }catch(e){
   showToast("Erreur: "+e.message,"#EF4444");
  }
  setSyncing(false);
 };

 if(done)return(
  <div style={{padding:"8px 12px",background:"rgba(34,197,94,.06)",borderRadius:8,border:"1px solid rgba(34,197,94,.15)",fontSize:11,color:"#22C55E",textAlign:"center"}}>
   ✓ Historique mis à jour
  </div>
 );

 return(
  <button onClick={sync} disabled={syncing}
   style={{width:"100%",padding:"8px",background:"rgba(245,158,11,.08)",border:"1px solid rgba(245,158,11,.25)",borderRadius:8,color:"#F59E0B",fontSize:11,fontWeight:700,cursor:syncing?"not-allowed":"pointer",fontFamily:"Inter,sans-serif"}}>
   {syncing?"⏳ Mise à jour...":"🔄 Appliquer "+newRole+" sur tout l'historique (remplace "+oldRole+")"}
  </button>
 );
}

const NavIconSuivi=memo(function NavIconSuivi({active}){
 const c=active?"#A78BFA":"#6B7280";
 return(<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
 <circle cx="12" cy="8" r="3" fill={active?"rgba(167,139,250,0.1)":"none"}/>
 <circle cx="5" cy="17" r="2.2" fill={active?"rgba(167,139,250,0.08)":"none"}/>
 <circle cx="19" cy="17" r="2.2" fill={active?"rgba(167,139,250,0.08)":"none"}/>
 <path d="M12 11c-4 0-6 2-6 4"/><path d="M12 11c4 0 6 2 6 4"/>
 </svg>);
});

// SelectionModal — sélection multiple + date + tournoi 
function SelectionModal({bets,onClose,setBets,supaPushBets,showToast,fmtDay,byDay,monthKeys,byMonth,allByDay,allByMonth,allMonthKeys,bookmakers=[],BK_LOGOS={},bkPhotos={},savedTourneys={},onAfterPush,allPlayers={},hiddenBKs=new Set()}){
 const [selected,setSelected]=useState(new Set());
 const [newDate,setNewDate]=useState("");
 const [newTournament,setNewTournament]=useState("");
 const [newBK,setNewBK]=useState("");
 const [filterGame,setFilterGame]=useState("all");
 const [saving,setSaving]=useState(false);
 const [searchTournament,setSearchTournament]=useState("");
 const [tourneyOpen,setTourneyOpen]=useState(false);
 const [searchBK,setSearchBK]=useState("");
 const [searchStatus,setSearchStatus]=useState("");
 const [searchDate,setSearchDate]=useState("");
 const [searchLive,setSearchLive]=useState(false);
 const [searchHasPP,setSearchHasPP]=useState(false);
 const [searchHeadshot,setSearchHeadshot]=useState(false);
 const [searchMap,setSearchMap]=useState("");

 const allGames=useMemo(function(){
 const gs=new Set();
 Object.values(byDay).flat().forEach(b=>{if(b.game)gs.add(b.game);});
 return["all",...gs];
 },[byDay]);

 const sortedByDay=useMemo(function(){
 const result={};
 Object.entries(allByDay).forEach(([dk,dayBets])=>{
 var filtered=filterGame==="all"?dayBets:dayBets.filter(b=>b.game===filterGame);
 if(searchTournament){
 if(searchTournament==="__NONE__")filtered=filtered.filter(function(b){return !b.tournament;});
 else filtered=filtered.filter(function(b){return b.tournament===searchTournament;});
 }
 if(searchBK)filtered=filtered.filter(function(b){return b.bookmaker===searchBK;});
 if(searchStatus)filtered=filtered.filter(function(b){return b.status===searchStatus;});
 if(searchDate)filtered=filtered.filter(function(b){return b.datetime&&String(b.datetime).slice(0,10)===searchDate;});
 if(searchLive)filtered=filtered.filter(function(b){return b.isLive;});
 if(searchHasPP)filtered=filtered.filter(function(b){return b.ppEdge!=null&&b.ppEdge!==0;});
 if(searchHeadshot)filtered=filtered.filter(function(b){return b.isHeadshot;});
 if(searchMap)filtered=filtered.filter(function(b){return b.mapTag===searchMap;});
 if(filtered.length>0)
 result[dk]=[...filtered].sort((a,b)=>String(b.datetime||"").localeCompare(String(a.datetime||"")));
 });
 return result;
 },[allByDay,filterGame,searchTournament,searchBK,searchStatus,searchDate,searchLive,searchHasPP,searchHeadshot,searchMap]);

 const removePP=function(){
 setSaving(true);
 var toSync=[];
 var updated=bets.map(function(b){
 if(!selected.has(b.id))return b;
 var nb=Object.assign({},b,{ppEdge:null,ppLine:null,ppMapType:null,updatedAt:Date.now()});
 toSync.push(nb);
 return nb;
 });
 setBets(updated);
 if(supaPushBets&&toSync.length){supaPushBets(toSync).catch(function(){});if(onAfterPush)onAfterPush();}
 try{var stored=JSON.parse(localStorage.getItem("v7_bets")||"[]");var ids=new Set(toSync.map(function(b){return b.id;}));var merged=stored.map(function(b){return ids.has(b.id)?toSync.find(function(n){return n.id===b.id;})||b:b;});localStorage.setItem("v7_bets",JSON.stringify(merged));}catch(e){}
 setSaving(false);
 setSelected(new Set());
 onClose();
 };

 // One-click: remove PP from ALL live bets 
 const removeAllLivePP=function(){
 var livePPbets=bets.filter(function(b){return b.isLive&&(b.ppEdge!=null||b.ppMapType);});
 if(livePPbets.length===0){alert("Aucun pari live avec PP Edge trouvé.");return;}
 if(!window.confirm("Supprimer le PP edge sur "+livePPbets.length+" paris live ?"))return;
 setSaving(true);
 var toSync=livePPbets.map(function(b){return Object.assign({},b,{ppEdge:null,ppLine:null,ppMapType:null,updatedAt:Date.now()});});
 var ids=new Set(toSync.map(function(b){return b.id;}));
 setBets(function(prev){return prev.map(function(b){return ids.has(b.id)?toSync.find(function(n){return n.id===b.id;})||b:b;});});
 if(supaPushBets&&toSync.length)supaPushBets(toSync).catch(function(){});
 try{var stored=JSON.parse(localStorage.getItem("v7_bets")||"[]");var merged=stored.map(function(b){return ids.has(b.id)?toSync.find(function(n){return n.id===b.id;})||b:b;});localStorage.setItem("v7_bets",JSON.stringify(merged));}catch(e){}
 setSaving(false);
 onClose();
 };

 const toggle=id=>setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});

 const toggleDay=dk=>{
 const ids=(sortedByDay[dk]||[]).map(b=>b.id);
 const allSel=ids.every(id=>selected.has(id));
 setSelected(prev=>{const n=new Set(prev);if(allSel){ids.forEach(id=>n.delete(id));}else{ids.forEach(id=>n.add(id));}return n;});
 };

 const canApply=selected.size>0&&(newDate||newTournament||newBK);

 const apply=function(){
 if(!canApply)return;
 setSaving(true);
 const toSync=[];
 const updated=bets.map(b=>{
 if(!selected.has(b.id))return b;
 const time=b.datetime?String(b.datetime).slice(11,16):"12:00";
 const newDatetime=newDate?newDate+"T"+time:b.datetime;
 const newSettledAt=b.status!=="pending"&&newDate?new Date(newDatetime).getTime():(b.settledAt||null);
 const nt=newTournament==="__AUCUN__"?"":newTournament;
 const nb={...b,datetime:newDatetime,settledAt:newSettledAt,...(newTournament?{tournament:nt}:{}),...(newBK?{bookmaker:newBK}:{})};
 toSync.push(nb);
 return nb;
 });
 setBets(updated);
 // Sauvegarder immédiatement en localStorage
 // Stocker les overrides séparément pour survivre au pull Supabase
 try{
 const ovRaw=localStorage.getItem("v7_overrides");
 const overrides=ovRaw?JSON.parse(ovRaw):{};
 toSync.forEach(b=>{
 overrides[b.id]={};
 if(newDate)overrides[b.id].datetime=b.datetime;
 if(newDate)overrides[b.id].settledAt=b.settledAt;
 if(newBK)overrides[b.id].bookmaker=b.bookmaker;
 });
 localStorage.setItem("v7_overrides",JSON.stringify(overrides));
 }catch(e){}
 // Push immédiat vers Supabase
 setTimeout(()=>{supaPushBets(toSync).catch(function(){});setSaving(false);},0);
 const parts=[];
 if(newDate)parts.push("date → "+newDate);
 if(newTournament)parts.push("tournoi → "+newTournament);
 if(newBK)parts.push("bookmaker → "+newBK);
 showToast(selected.size+" paris : "+parts.join(", ")+" ");
 onClose();
 };

 return(
 <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"#0B1220",zIndex:200,display:"flex",flexDirection:"column",fontFamily:"Inter,sans-serif",overflow:"hidden",height:"100%",maxHeight:"-webkit-fill-available"}}>
 <div style={{background:"#0B1220",borderBottom:"1px solid #1F2937",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
 <button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:8,width:34,height:34,color:"#9CA3AF",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>←</button>
 <div style={{flex:1,fontSize:15,fontWeight:700,color:"#E5E7EB"}}>{selected.size>0?selected.size+" sélectionné"+(selected.size>1?"s":""):"Sélectionner des paris"}</div>
 {selected.size>0&&<button onClick={()=>setSelected(new Set())} style={{fontSize:11,color:"#6B7280",background:"none",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Tout désélect.</button>}
 </div>
 <div style={{padding:"10px 14px",borderBottom:"1px solid #1F2937",flexShrink:0,flexGrow:0,background:"#0F1829",display:"flex",flexDirection:"column",gap:8,maxHeight:"38vh",overflowY:"auto",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain"}}>
 {/* Game filter */}
 <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
 {allGames.map(function(g){
 var on=filterGame===g;
 return(
 <button key={g} onClick={function(){setFilterGame(g);}}
 style={{padding:"4px 10px",borderRadius:7,border:"1px solid "+(on?"rgba(167,139,250,.5)":"rgba(255,255,255,.08)"),background:on?"rgba(124,58,237,.15)":"transparent",color:on?"#c4b5fd":"#6B7280",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",gap:5}}>
 {g!=="all"&&<GameLogo game={g} size={13}/>}
 {g==="all"?"Tous":g}
 </button>
 );
 })}
 </div>
 <div>
 <div style={{fontSize:11,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Nouvelle date</div>
 <input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} style={{width:"100%",background:"#0B1220",border:"1px solid #1F2937",borderRadius:10,padding:"10px 14px",color:"#E5E7EB",fontSize:14,fontFamily:"Inter,sans-serif",outline:"none",colorScheme:"dark",boxSizing:"border-box"}}/>
 </div>
 <div>
 <div style={{fontSize:11,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Tournoi</div>
 {(()=>{
 // Build list of tournaments from selected bets grouped by game
 const selBets=[...selected].map(id=>bets.find(b=>b.id===id)).filter(Boolean);
 const games=[...new Set(selBets.map(b=>b.game).filter(Boolean))];
 // All tournaments: from bets + from savedTourneys
 const byGame={};
 bets.forEach(function(b){if(!b.tournament)return;if(!byGame[b.game])byGame[b.game]=new Set();byGame[b.game].add(b.tournament);});
 // Also add savedTourneys
 Object.entries(savedTourneys||{}).forEach(function(e){
 var g=e[0],ts=e[1];
 if(!byGame[g])byGame[g]=new Set();
 (ts||[]).forEach(function(t){byGame[g].add(t);});
 });
 // Add leagues as tournament options for LoL/Valorant
 bets.forEach(function(b){
 var effT=effectiveTournament(b);
 if((b.game==="LoL"||b.game==="Valorant")&&effT&&!b.tournament){
 if(!byGame[b.game])byGame[b.game]=new Set();
 byGame[b.game].add(effT);
 }
 });
 const options=[];
 (games.length>0?games:Object.keys(byGame)).forEach(function(g){(byGame[g]||new Set()).forEach(function(t){options.push({game:g,tournament:t});});});
 const GAME_ICONS={"CS2":"[CS2]","LoL":"[LoL]","Dota2":"[Dota2]","Valorant":"[Val]"};
 var allOpts=[{game:"",tournament:"__AUCUN__",label:" Sans tournoi",val:"__AUCUN__"}].concat(options.map(function(o){return{game:o.game,tournament:o.tournament,label:o.tournament,val:o.tournament};}));
 var selected_opt=allOpts.find(function(o){return o.val===newTournament;})||null;
 return(
 <div style={{position:"relative"}}>
 {/* Trigger button */}
 <button onClick={function(){setTourneyOpen(function(v){return !v;});}}
 style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderRadius:10,border:"1px solid "+(newTournament?"rgba(167,139,250,.5)":"#1F2937"),background:"#0B1220",color:newTournament?"#c4b5fd":"#6B7280",fontSize:13,fontWeight:newTournament?700:400,cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
 {selected_opt&&selected_opt.game?<GameLogo game={selected_opt.game} size={16}/>:selected_opt&&selected_opt.val==="__AUCUN__"?<Ic n="ban" s={14}/>:null}
 <span style={{flex:1}}>{selected_opt?selected_opt.label:"— Choisir un tournoi —"}</span>
 <span style={{fontSize:10,color:"#4a5a6e"}}><Ic n={tourneyOpen?"up":"down"} s={11}/></span>
 </button>
 {/* Dropdown list */}
 {tourneyOpen&&(
 <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#0d1528",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,zIndex:999,maxHeight:200,overflowY:"auto",boxShadow:"0 8px 32px rgba(0,0,0,.5)"}}>
 <button onClick={function(){setNewTournament("");setTourneyOpen(false);}}
 style={{width:"100%",padding:"9px 12px",display:"flex",alignItems:"center",gap:8,border:"none",borderBottom:"1px solid rgba(255,255,255,.05)",background:"transparent",color:"#4a5a6e",fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
 — Aucun —
 </button>
 {allOpts.map(function(o,i){
 var isOn=newTournament===o.val;
 return(
 <button key={i} onClick={function(){setNewTournament(o.val);setTourneyOpen(false);}}
 style={{width:"100%",padding:"9px 12px",display:"flex",alignItems:"center",gap:8,border:"none",borderBottom:i<allOpts.length-1?"1px solid rgba(255,255,255,.04)":"none",background:isOn?"rgba(124,58,237,.15)":"transparent",color:isOn?"#c4b5fd":"#E5E7EB",fontSize:12,fontWeight:isOn?700:400,cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
 {o.game?<GameLogo game={o.game} size={15}/>:<span style={{fontSize:13}}>{o.val==="__AUCUN__"?<Ic n="ban" s={13}/>:<Ic n="trophy" s={13}/>}</span>}
 <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{o.label}</span>
 {isOn&&<span style={{color:"#a78bfa",fontSize:11}}><Ic n="check" s={12}/></span>}
 </button>
 );
 })}
 </div>
 )}
 </div>
 );
 })()}
 </div>
 {bookmakers.length>0&&(
 <div>
 <div style={{fontSize:11,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Bookmaker</div>
 <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
 {bookmakers.filter(bk=>!(hiddenBKs instanceof Set?hiddenBKs.has(bk):false)).map(bk=>{
 const logo=BK_LOGOS[bk]||bkPhotos[bk]||null;
 const isOn=newBK===bk;
 return(
 <button key={bk} onClick={()=>setNewBK(isOn?"":bk)} title={bk} style={{minWidth:logo?40:"auto",height:40,borderRadius:10,border:"2px solid "+(isOn?"#A78BFA":"rgba(255,255,255,0.08)"),background:isOn?"rgba(124,58,237,0.18)":"rgba(255,255,255,0.03)",cursor:"pointer",padding:logo?"0":"0 10px",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",boxShadow:isOn?"0 0 10px rgba(124,58,237,0.35)":"none"}}>
 {logo?(<img src={logo} alt={bk} style={{width:26,height:26,borderRadius:6,objectFit:"cover"}}/>):(<span style={{fontSize:10,fontWeight:700,color:isOn?"#A78BFA":"#6B7280",whiteSpace:"nowrap"}}>{bk}</span>)}
 </button>
 );
 })}
 </div>
 {newBK&&<div style={{fontSize:11,color:"#A78BFA",fontWeight:600,marginTop:6}}> {newBK}</div>}
 </div>
 )}
 {/* Action rapide: supprimer PP de tous les bets live */}
 {(function(){
 var livePPcount=bets.filter(function(b){return b.isLive&&(b.ppEdge!=null||b.ppMapType);}).length;
 if(livePPcount===0)return null;
 return(
 <div style={{marginBottom:10,padding:"10px 12px",background:"rgba(251,113,133,.08)",border:"1px solid rgba(251,113,133,.25)",borderRadius:12,display:"flex",alignItems:"center",gap:10}}>
 <div style={{flex:1}}>
 <div style={{fontSize:12,fontWeight:700,color:"#fb7185"}}> {livePPcount} paris live avec PP Edge</div>
 <div style={{fontSize:10,color:"#6B7280",marginTop:2}}>Supprimer le PP edge en 1 clic</div>
 </div>
 <button onClick={removeAllLivePP} disabled={saving}
 style={{padding:"8px 14px",borderRadius:9,border:"none",background:"linear-gradient(135deg,#fb7185,#f87171)",color:"#fff",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0,whiteSpace:"nowrap"}}>
 Tout supprimer
 </button>
 </div>
 );
 })()}
 <div style={{display:"flex",gap:5,marginBottom:6}}>
 {[
 {k:"live",l:"Live",icon:<span style={{width:8,height:8,borderRadius:"50%",background:"#fb7185",display:"inline-block",marginRight:4}}/>,active:searchLive,col:"#fb7185",border:"rgba(251,113,133,.4)",bg:"rgba(251,113,133,.1)",toggle:function(){setSearchLive(function(v){return !v;});}},
 {k:"pp",icon:<img src={_B64_PP_LOGO_B64} style={{width:13,height:13,objectFit:"contain",verticalAlign:"middle"}}/>,l:"PP Edge",active:searchHasPP,col:"#c4b5fd",border:"rgba(167,139,250,.4)",bg:"rgba(124,58,237,.1)",toggle:function(){setSearchHasPP(function(v){return !v;});}},
 {k:"hs",icon:<img src={HEADSHOT_LOGO_B64} style={{width:13,height:13,objectFit:"contain",verticalAlign:"middle",filter:"brightness(0) invert(1)"}}/>,l:"Headshot",active:searchHeadshot,col:"#fbbf24",border:"rgba(251,191,36,.4)",bg:"rgba(251,191,36,.1)",toggle:function(){setSearchHeadshot(function(v){return !v;});}},
 ].map(function(f){return(
 <button key={f.k} onClick={f.toggle}
 style={{flex:1,padding:"7px 4px",borderRadius:8,border:"1px solid "+(f.active?f.border:"rgba(255,255,255,.07)"),background:f.active?f.bg:"transparent",color:f.active?f.col:"#6B7280",fontSize:10,fontWeight:f.active?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
 {f.icon}{f.l}
 </button>
 );})}</div>
 {/* Map filter */}
 <div style={{display:"flex",gap:4,marginBottom:6,flexWrap:"wrap"}}>
 {["","Map 1","Map 2","Map 3","Map 4","Map 5"].map(function(m){
 var on=searchMap===m;
 return <button key={m||"all"} onClick={function(){setSearchMap(on?"":m);}}
 style={{padding:"4px 10px",borderRadius:7,border:"1px solid "+(on?"rgba(167,139,250,.4)":"rgba(255,255,255,.06)"),background:on?"rgba(124,58,237,.12)":"transparent",color:on?"#c4b5fd":"#6B7280",fontSize:10,fontWeight:on?700:400,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 {m||"Toutes maps"}
 </button>;
 })}
 </div>
 {/* Status filter */}
 <div>
 <div style={{fontSize:11,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Résultat</div>
 <div style={{display:"flex",gap:6}}>
 {[{k:"",l:"Tous"},{k:"won",l:" Gagnés"},{k:"lost",l:" Perdus"},{k:"pending",l:"⏳ En attente"}].map(function(s){
 var on=searchStatus===s.k;
 return(
 <button key={s.k} onClick={function(){setSearchStatus(on?"":s.k);}}
 style={{flex:1,padding:"7px 4px",borderRadius:8,border:"1px solid "+(on?(s.k==="won"?"rgba(0,230,118,.4)":s.k==="lost"?"rgba(239,68,68,.4)":"rgba(96,165,250,.4)"):"rgba(255,255,255,.07)"),background:on?(s.k==="won"?"rgba(0,230,118,.1)":s.k==="lost"?"rgba(239,68,68,.1)":"rgba(96,165,250,.1)"):"transparent",color:on?(s.k==="won"?"#00E676":s.k==="lost"?"#f87171":"#93c5fd"):"#6B7280",fontSize:10,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 {s.l}
 </button>
 );
 })}
 </div>
 </div>
 {/* Rechercher: filtre la liste */}
 <div style={{marginTop:8}}>
 <button onClick={function(){
 var t=newTournament==="__AUCUN__"?"__NONE__":newTournament;
 setSearchTournament(t);
 setSearchBK(newBK||"");
 setSearchDate(newDate||"");
 }}
 style={{width:"100%",padding:"11px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
 "Rechercher"
 </button>
 {(searchTournament||searchBK||searchDate||searchLive||searchHasPP||searchHeadshot||searchMap)&&(
 <div style={{fontSize:11,color:"#fbbf24",marginTop:5,textAlign:"center"}}>
 {Object.values(sortedByDay).flat().length} paris trouvés
 {searchTournament==="__NONE__"?" · sans tournoi":searchTournament?" · "+searchTournament:""}
 {searchBK?" · "+searchBK:""}
 {searchDate?" · "+searchDate:""}
 {searchLive?" · Live":""}{searchHasPP?" · PP":""}{searchHeadshot?" · HS":""}{searchMap?" · "+searchMap:""}
 <button onClick={function(){setSearchTournament("");setSearchBK("");setSearchDate("");setSearchStatus("");setSearchLive(false);setSearchHasPP(false);setSearchHeadshot(false);setSearchMap("");}}
 style={{marginLeft:8,fontSize:10,color:"#f87171",background:"none",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif"}}> Effacer</button>
 </div>
 )}
 </div>
 </div>
 {selected.size>0&&<div style={{padding:"8px 14px",flexShrink:0,borderBottom:"1px solid #1F2937"}}>
 {!canApply&&<div style={{fontSize:11,color:"#fbbf24",marginBottom:6,textAlign:"center"}}>Choisis une date, un tournoi ou un bookmaker ci-dessus</div>}
 <button onClick={apply} disabled={!canApply||saving} style={{width:"100%",padding:"12px",background:canApply?"linear-gradient(135deg,#F97316,#EA580C)":"rgba(255,255,255,.05)",border:canApply?"none":"1px solid rgba(255,255,255,.1)",borderRadius:12,color:canApply?"#fff":"#4a5a6e",fontWeight:800,fontSize:14,cursor:canApply?"pointer":"default",fontFamily:"Inter,sans-serif",opacity:saving?0.6:1,boxShadow:canApply?"0 4px 16px rgba(249,115,22,.3)":"none"}}>{saving?"Enregistrement...":" Appliquer aux "+selected.size+" paris"}</button>
 </div>}
 <div style={{flex:"1 1 auto",overflowY:"auto",WebkitOverflowScrolling:"touch",overscrollBehavior:"contain",padding:"8px 14px 120px",minHeight:"30vh"}}>
 {allMonthKeys.map(mk=>{
 const days=allByMonth[mk]||[];
 return(
 <div key={mk} style={{marginBottom:14}}>
 <div style={{fontSize:13,fontWeight:800,color:"#6B7280",textTransform:"uppercase",letterSpacing:.8,padding:"8px 0 6px"}}>{mk}</div>
 {days.map(dk=>{
 const dayBets=sortedByDay[dk]||[];
 const allDaySel=dayBets.length>0&&dayBets.every(b=>selected.has(b.id));
 return(
 <div key={dk} style={{marginBottom:8,borderRadius:10,overflow:"hidden",border:"1px solid #1F2937"}}>
 <div style={{padding:"8px 12px",background:"#111827",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <span style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>{fmtDay(dk)}</span>
 <button onClick={()=>toggleDay(dk)} style={{fontSize:11,fontWeight:700,color:allDaySel?"#A78BFA":"#6B7280",background:allDaySel?"rgba(124,58,237,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(allDaySel?"rgba(124,58,237,0.4)":"#1F2937"),borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 {allDaySel?" Tous":"Tout sélect."}
 </button>
 </div>
 {dayBets.map(b=>{
 const isSel=selected.has(b.id);
 return(
 <div key={b.id} onClick={()=>toggle(b.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:isSel?"rgba(124,58,237,0.08)":"transparent",borderTop:"1px solid #1F2937",cursor:"pointer",userSelect:"none",WebkitUserSelect:"none"}}>
 <div style={{width:20,height:20,borderRadius:5,border:"2px solid "+(isSel?"#7C3AED":"#374151"),background:isSel?"rgba(124,58,237,0.25)":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
 {isSel&&<span style={{fontSize:11,color:"#A78BFA",fontWeight:900}}><Ic n="check" s={12}/></span>}
 </div>
 <div style={{flex:1,minWidth:0}}>
 <div style={{display:"flex",alignItems:"center",gap:6,overflow:"hidden"}}>
 <GameLogo game={b.game} size={16}/>
 <span style={{fontSize:13,fontWeight:700,color:"#E5E7EB",textTransform:"capitalize",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.player} <span style={{color:"#6B7280",fontWeight:400,fontSize:12}}>— {b.description}</span></span>
 </div>
 <div style={{fontSize:11,color:"#6B7280",marginTop:2}}>@{b.odds} · {b.stake}$ · {b.datetime?String(b.datetime).slice(0,10):""}</div>
 </div>
 <div style={{fontSize:13,fontWeight:700,color:b.status==="won"?"#00E676":b.status==="lost"?"#EF4444":"#3B82F6",flexShrink:0}}>
 {b.status==="pending"?"@"+b.odds:((b.profit||0)>=0?"+":"")+(b.profit||0).toFixed(0)+"$"}
 </div>
 </div>
 );
 })}
 </div>
 );
 })}
 </div>
 );
 })}
 </div>
 </div>
 );
}

// MesParisView 
const MesParisView=memo(function MesParisView({
 bets,setBets,bookmakers,bkPhotos,hiddenBKs=new Set(),updateStatus,deleteBet,duplicateBet,openEdit,splitBet,showToast,
 fBKs,setFBKs,setView,supaPushBets,supaDeleteManyBets,supaDeleteOneBet,setDeletedBets,BK_LOGOS,
 fGames,setFGames,fStatus,setFStatus,fOverUnder,setFOverUnder,
 fMinOdds,setFMinOdds,fMaxOdds,setFMaxOdds,fMinStake,setFMinStake,fMaxStake,setFMaxStake,
 fMinPP,setFMinPP,fMaxPP,setFMaxPP,
 fMapFilter,setFMapFilter,fDuel,setFDuel,fLive,setFLive,fHeadshot,setFHeadshot,
 fRole,setFRole,fLeague,setFLeague,fTourneys,setFTourneys,fDateFrom,setFDateFrom,fDateTo,setFDateTo,
 calcProfit,
 fPlayer,setFPlayer,
 sortByMap,setSortByMap,
 savedTourneys={},
 onMarkPush,
 allPlayers={},
}){
 const [collapsedMonths,setCollapsedMonths]=useState(new Set());
 const [selectOpen,setSelectOpen]=useState(false); // separate overlay
 const [globalSearch,setGlobalSearch]=useState("");
 const [searchOpen,setSearchOpen]=useState(false);
 const toggleMonth=mk=>setCollapsedMonths(prev=>{const n=new Set(prev);n.has(mk)?n.delete(mk):n.add(mk);return n;});


 const p=v=>String(v).padStart(2,"0");
 const idToDateStr=id=>{const d=new Date(Number(id));if(isNaN(d.getTime())||d.getFullYear()<2020)return null;return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())+"T"+p(d.getHours())+":"+p(d.getMinutes());};
 const getDateKey=b=>{let dt=b.datetime;if(!dt||!/^\d{4}-\d{2}-\d{2}/.test(String(dt))){dt=idToDateStr(b.id);}return dt?String(dt).slice(0,10):"?";};
 const FR_DAYS=["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
 const FR_MONTHS=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
 const FR_MONTHS_SHORT=["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];
 const fmtDay=dk=>{if(!dk||dk==="?")return "Date inconnue";try{const [y,m,d]=dk.split("-").map(Number);const wd=new Date(y,m-1,d).getDay();return FR_DAYS[wd]+" "+d+" "+FR_MONTHS_SHORT[m-1];}catch(e){return dk;}};
 const fmtMonth=mk=>{if(!mk||mk==="?")return "?";try{const [y,m]=mk.split("-").map(Number);return FR_MONTHS[m-1]+" "+y;}catch(e){return mk;}};
 const {allByDay,allByMonth,allMonthKeys}=useMemo(function(){
 var abd={};
 bets.forEach(function(b){var dk=getDateKey(b);if(!abd[dk])abd[dk]=[];abd[dk].push(b);});
 var adk=Object.keys(abd).sort(function(a,z){return z.localeCompare(a);});
 var abm={};
 adk.forEach(function(dk){var mk2=dk==="?"?"?":dk.slice(0,7);if(!abm[mk2])abm[mk2]=[];abm[mk2].push(dk);});
 var amk=Object.keys(abm).sort(function(a,z){return z.localeCompare(a);});
 return{allByDay:abd,allByMonth:abm,allMonthKeys:amk};
 },[bets]);

 const activeFilters=fGames.length+fBKs.length+(fMinOdds?1:0)+(fMaxOdds?1:0)+(fMinStake?1:0)+(fMaxStake?1:0)+(fMapFilter&&fMapFilter!=="all"?1:0)+(fDuel?1:0)+(fLive?1:0)+(fHeadshot?1:0)+(fStatus&&fStatus!=="All"?1:0)+(fOverUnder&&fOverUnder!=="All"?1:0)+(fRole&&fRole!=="All"?1:0)+(fLeague&&fLeague!=="All"?1:0)+(fTourneys&&fTourneys.size>0?1:0)+(fDateFrom?1:0)+(fDateTo?1:0);
 const clearFilters=()=>{setFGames([]);setFBKs([]);setFMinOdds("");setFMaxOdds("");setFMinStake("");setFMaxStake("");setFMapFilter("all");setFDuel(false);setFLive(false);setFHeadshot(false);setFStatus("All");setFOverUnder("All");setFRole("All");setFLeague("All");if(setFTourneys)setFTourneys(new Set());setFDateFrom("");setFDateTo("");};

 const filtered=useMemo(()=>bets.filter(b=>{
 if(fStatus&&fStatus!=="All"&&b.status!==fStatus)return false;
 if(fGames&&fGames.length>0&&!fGames.includes(b.game))return false;
 if(fBKs&&fBKs.length>0&&!fBKs.includes(b.bookmaker||"")&&!(b.splits||[]).some(sp=>fBKs.includes(sp.bookmaker)))return false;
 if(fOverUnder&&fOverUnder!=="All"&&b.overUnder!==fOverUnder)return false;
 if(fRole&&fRole!=="All"&&normalizeRole(b.role||"",b.game)!==normalizeRole(fRole,b.game))return false;
 if(fLeague&&fLeague!=="All"&&b.league!==fLeague)return false;
 if(fMinOdds&&b.odds<parseFloat(fMinOdds))return false;
 if(fMaxOdds&&b.odds>parseFloat(fMaxOdds))return false;
 if(fMinStake&&b.stake<parseFloat(fMinStake))return false;
 if(fMaxStake&&b.stake>parseFloat(fMaxStake))return false;
 if(fDuel&&!(b.description&&b.description.includes("Duel")))return false;
 if(fLive&&!b.isLive)return false;
 if(fHeadshot&&!b.isHeadshot)return false;
 if(fTourneys&&fTourneys.size>0&&!fTourneys.has(effectiveTournament(b,allPlayers)||"Hors tournoi"))return false;
 if(fPlayer&&!(b.player||"").toLowerCase().includes(fPlayer.toLowerCase()))return false;
 if(fMinPP!==""&&(b.ppEdge==null||b.ppEdge<parseFloat(fMinPP)))return false;
 if(fMaxPP!==""&&(b.ppEdge==null||b.ppEdge>parseFloat(fMaxPP)))return false;
 return true;
 }),[bets,fStatus,fGames,fBKs,fOverUnder,fRole,fLeague,fMinOdds,fMaxOdds,fMinStake,fMaxStake,fDuel,fLive,fHeadshot,fTourneys,fPlayer,fMinPP,fMaxPP]);

 const allTourneys=useMemo(()=>[...new Set(bets.map(b=>b.tournament).filter(Boolean))].sort(),[bets]);
 const onSave=useCallback(function(b){
 setBets(function(prev){return prev.map(function(p){return p.id===b.id?b:p;});});
 if(supaPushBets)supaPushBets([b]).catch(function(){});
 try{const ov=JSON.parse(localStorage.getItem("v7_overrides")||"{}");ov[b.id]={tournament:b.tournament};localStorage.setItem("v7_overrides",JSON.stringify(ov));}catch(e){}
 },[setBets,supaPushBets]);

 const pending=useMemo(function(){
 const mapN=m=>{if(!m)return 0;const nums=(m||"").match(/\d+/g);return nums?Math.max(...nums.map(Number)):0;};
 return filtered.filter(b=>b.status==="pending").sort((a,b2)=>{
 if(sortByMap){const md=mapN(b2.mapTag)-mapN(a.mapTag);if(md!==0)return md;}
 return String(b2.datetime||"").localeCompare(String(a.datetime||""));
 });
 },[filtered,sortByMap]);
 const settled=useMemo(()=>filtered.filter(b=>b.status!=="pending").sort((a,b2)=>(b2.updatedAt||0)-(a.updatedAt||0)),[filtered]);

 const {dayKeys,byDay,monthKeys,byMonth}=useMemo(function(){
 const byDay={};
 settled.forEach(b=>{const dk=getDateKey(b);if(!byDay[dk])byDay[dk]=[];byDay[dk].push(b);});
 const dayKeys=Object.keys(byDay).sort((a,z)=>z.localeCompare(a));
 const byMonth={};
 dayKeys.forEach(dk=>{const mk=dk==="?"?"?":dk.slice(0,7);if(!byMonth[mk])byMonth[mk]=[];byMonth[mk].push(dk);});
 const monthKeys=Object.keys(byMonth).sort((a,z)=>z.localeCompare(a));
 return{dayKeys,byDay,monthKeys,byMonth};
 },[settled]);

 useEffect(()=>{
 if(!monthKeys||monthKeys.length<=2)return;
 setCollapsedMonths(prev=>{if(prev.size>0)return prev;return new Set(monthKeys.slice(1));});
 },[monthKeys]);

 return(
 <div className="view-enter" style={{position:"relative"}}>
 {/* Fond profondeur subtil */}
 <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
 <div style={{position:"absolute",top:"-10%",left:"50%",transform:"translateX(-50%)",width:"100%",height:"45%",background:"radial-gradient(ellipse at 50% 0%,rgba(124,58,237,.04),transparent 70%)"}}/>
 <div style={{position:"absolute",bottom:0,left:0,right:0,height:"25%",background:"linear-gradient(to top,rgba(7,10,20,.4),transparent)"}}/>
 </div>
 {/* TOP BAR */}
 <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center"}}>
 <button onClick={()=>setView("filtres")}
 style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:10,border:"1px solid "+(activeFilters>0?"rgba(124,58,237,.4)":"rgba(255,255,255,.06)"),background:activeFilters>0?"rgba(124,58,237,.1)":"rgba(255,255,255,.02)",color:activeFilters>0?"#a78bfa":"#6a7a8a",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>
 <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
 Filtres{activeFilters>0&&<span style={{background:"#7C3AED",color:"#fff",borderRadius:8,fontSize:9,fontWeight:800,padding:"1px 6px",marginLeft:2}}>{activeFilters}</span>}
 </button>
 <button onClick={()=>setView("statistiques")}
 style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,.06)",background:"rgba(255,255,255,.02)",color:"#6a7a8a",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>
 <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
 Stats
 </button>
 {/* SEARCH BAR */}
 {searchOpen?(
 <div style={{flex:1,display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.04)",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",padding:"0 10px",height:36}}>
 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6a7a8a" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
 <input autoFocus value={globalSearch} onChange={e=>{setGlobalSearch(e.target.value);setFPlayer(e.target.value);}}
 placeholder="Joueur, tournoi..."
 style={{flex:1,background:"none",border:"none",outline:"none",color:"#e0e8f0",fontSize:13,fontFamily:"Inter,sans-serif",fontWeight:500}}/>
 {globalSearch&&<button onClick={()=>{setGlobalSearch("");setFPlayer("");}} style={{background:"none",border:"none",color:"#6a7a8a",cursor:"pointer",fontSize:14,padding:0,display:"flex"}}><Ic n="x" s={13}/></button>}
 <button onClick={()=>{setSearchOpen(false);setGlobalSearch("");setFPlayer("");}} style={{background:"none",border:"none",color:"#6a7a8a",cursor:"pointer",fontSize:11,padding:0,fontFamily:"Inter,sans-serif"}}>Annuler</button>
 </div>
 ):(
 <button onClick={()=>setSearchOpen(true)}
 style={{width:34,height:34,borderRadius:10,border:"1px solid rgba(255,255,255,.06)",background:"rgba(255,255,255,.02)",color:"#6a7a8a",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
 <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
 </button>
 )}
 <div style={{flex:searchOpen?0:1}}/>
 {!searchOpen&&activeFilters>0&&<button onClick={clearFilters} style={{padding:"7px 11px",borderRadius:10,border:"1px solid rgba(239,68,68,.25)",background:"rgba(239,68,68,.05)",color:"#f87171",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}> Effacer</button>}
 {!searchOpen&&<button onClick={()=>setSelectOpen(true)}
 style={{padding:"8px 14px",borderRadius:10,border:"1.5px solid rgba(255,255,255,.07)",background:"rgba(255,255,255,.03)",color:"#7a8a9a",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>
 Sélectionner
 </button>}
 </div>

 {/* MAP SORT + BK LOGO FILTERS */}
 {bookmakers.length>0&&(
 <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
 <button onClick={()=>setSortByMap(v=>!v)}
 style={{padding:"5px 10px",borderRadius:9,border:"1px solid "+(sortByMap?"rgba(251,191,36,.5)":"rgba(255,255,255,.07)"),background:sortByMap?"rgba(251,191,36,.1)":"transparent",color:sortByMap?"#fbbf24":"#4a5a6e",fontSize:10,fontWeight:sortByMap?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0}}>
 Map {sortByMap?"↓":"↑"}
 </button>
 {bookmakers.filter(bk=>!(hiddenBKs instanceof Set?hiddenBKs.has(bk):false)).map(bk=>{
 const on=fBKs.includes(bk);
 const logo=BK_LOGOS[bk]||bkPhotos[bk]||null;
 return(
 <button key={bk} onClick={()=>setFBKs(prev=>on?prev.filter(x=>x!==bk):[...prev,bk])} title={bk}
 style={{width:36,height:36,borderRadius:9,border:"1px solid "+(on?"rgba(34,197,94,.4)":"rgba(255,255,255,.06)"),background:on?"rgba(34,197,94,.08)":"rgba(255,255,255,.02)",cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",flexShrink:0}}>
 {logo?(<img src={logo} alt={bk} style={{width:22,height:22,borderRadius:4,objectFit:"cover"}}/>):(<span style={{fontSize:8,color:on?"#00E676":"#6B7280",fontWeight:700}}>{bk.slice(0,4)}</span>)}
 {on&&<div style={{position:"absolute",top:-3,right:-3,background:"#00E676",borderRadius:"50%",width:10,height:10,display:"flex",alignItems:"center",justifyContent:"center",border:"1.5px solid #0B1220"}}><span style={{fontSize:6,color:"#000",fontWeight:900}}><Ic n="check" s={7} c="#000" w={4}/></span></div>}
 </button>
 );
 })}
 </div>
 )}

 {/* W/L quick filter shown when BK is active */}
 {fBKs.length>0&&(
 <div style={{display:"flex",gap:6,marginBottom:10,marginTop:-4}}>
 {[{s:"won",label:" Gagnés",col:"#00E676",bg:"rgba(0,230,118,.1)",border:"rgba(0,230,118,.35)"},{s:"lost",label:" Perdus",col:"#f87171",bg:"rgba(248,113,113,.1)",border:"rgba(248,113,113,.35)"}].map(({s,label,col,bg,border})=>{
 const active=fStatus===s;
 return(
 <button key={s} onClick={()=>setFStatus(active?"All":s)}
 style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:8,border:"1px solid "+(active?border:"rgba(255,255,255,.07)"),background:active?bg:"transparent",color:active?col:"#4a5a6e",fontSize:12,fontWeight:active?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s"}}>
 {label}
 </button>
 );
 })}
 {fStatus!=="All"&&<button onClick={()=>setFStatus("All")} style={{padding:"5px 8px",borderRadius:8,border:"1px solid rgba(255,255,255,.07)",background:"transparent",color:"#4a5a6e",fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif"}}><Ic n="x" s={11}/></button>}
 </div>
 )}

 {bets.length===0&&<div style={{color:"#6B7280",fontSize:14,padding:30,textAlign:"center"}}>Aucun pari enregistré</div>}
 {globalSearch&&filtered.length===0&&bets.length>0&&<div style={{color:"#6B7280",fontSize:13,padding:"20px",textAlign:"center"}}>Aucun résultat pour « {globalSearch} »</div>}
 {globalSearch&&filtered.length>0&&<div style={{fontSize:11,color:"#4a5a6e",marginBottom:8,fontWeight:600}}>{filtered.length} paris trouvé{filtered.length>1?"s":""} pour « {globalSearch} »</div>}

 {/* PENDING */}
 {pending.length>0&&(
 <div style={{marginBottom:16}}>
 <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"4px 2px"}}>
 <div style={{width:3,height:14,borderRadius:2,background:"#60a5fa",flexShrink:0}}/>
 <span style={{fontSize:11,fontWeight:800,color:"#60A5FA",textTransform:"uppercase",letterSpacing:1.5}}>En attente</span>
 <span style={{background:"rgba(96,165,250,.18)",color:"#93c5fd",fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:6}}>{pending.length}</span>
 <span style={{fontSize:11,color:"#7a9cbd",marginLeft:"auto",fontWeight:600}}>{pending.reduce((s,b)=>s+(b.stake||0),0).toFixed(0)}$ en jeu</span>
 </div>
 <div style={{display:"flex",flexDirection:"column",gap:2}}>
 {pending.map(b=>(
 <BetRow key={b.id} bet={b} onStatus={updateStatus} onDelete={deleteBet} onDuplicate={duplicateBet} onEdit={openEdit} onSplit={splitBet} bkPhotos={bkPhotos} onSave={onSave} allTourneys={allTourneys} savedTourneys={savedTourneys}/>
 ))}
 </div>
 </div>
 )}

 {/* SETTLED */}
 {settled.length>0&&(
 <div>
 {monthKeys.map(mk=>{
 const days=byMonth[mk]||[];
 const allBets=days.flatMap(dk=>byDay[dk]||[]);
 const profit=allBets.reduce((s,b)=>s+(b.profit||0),0);
 const staked=allBets.reduce((s,b)=>s+(b.stake||0),0);
 const won=allBets.filter(b=>b.status==="won").length;
 const total=allBets.length;
 const roi=staked>0?profit/staked*100:0;
 const wr=total>0?won/total*100:0;
 return(
 <div key={mk} style={{marginBottom:14}}>
 <div onClick={()=>toggleMonth(mk)} style={{background:"linear-gradient(135deg,rgba(10,18,38,.99),rgba(7,14,30,.99))",border:"1px solid rgba(99,130,200,.22)",borderRadius:collapsedMonths.has(mk)?"14px":"14px 14px 0 0",padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",userSelect:"none",boxShadow:"0 6px 24px rgba(0,0,0,.4),0 0 0 1px rgba(124,58,237,.04)",position:"relative",overflow:"hidden"}}>
 <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(124,58,237,.4),rgba(59,130,246,.3),transparent)",pointerEvents:"none"}}/>
 <div style={{position:"absolute",top:"-50%",right:"-10%",width:"40%",height:"150%",background:"radial-gradient(ellipse,rgba(124,58,237,.06),transparent 70%)",pointerEvents:"none"}}/>
 <div>
 <div style={{fontSize:16,fontWeight:800,color:"#dce8ff",textTransform:"uppercase",letterSpacing:.8}}>{fmtMonth(mk)}</div>
 <div style={{display:"flex",alignItems:"center",gap:8,marginTop:3}}>
 <span style={{fontSize:11,color:"#4B6080",fontWeight:500}}>{allBets.length} paris</span>
 <span style={{fontSize:10,color:"#3a5070"}}>·</span>
 <span style={{fontSize:11,color:wr>=55?"#00E676":wr>=45?"#f59e0b":"#ef4444",fontWeight:700}}>{wr.toFixed(0)}% WR</span>
 <span style={{fontSize:10,color:"#3a5070"}}>·</span>
 <span style={{fontSize:11,color:staked>0?"#7a9cc4":"#3a5070",fontWeight:500}}>{staked.toFixed(0)}$ misés</span>
 </div>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <div style={{textAlign:"right"}}>
 <div style={{fontSize:19,fontWeight:800,color:profit>=0?"#00E676":"#f87171",letterSpacing:-.3}}>{profit>=0?"+":""}{profit.toFixed(0)}$</div>
 <div style={{fontSize:11,color:roi>=0?"#22a55a":"#c04040",fontWeight:600}}>{roi>=0?"+":""}{roi.toFixed(1)}% ROI</div>
 </div>
 <span style={{fontSize:11,color:"#4B6080",transition:"transform .2s",display:"inline-block",transform:collapsedMonths.has(mk)?"none":"rotate(180deg)"}}><Ic n="down" s={12}/></span>
 </div>
 </div>
 {!collapsedMonths.has(mk)&&(
 <div style={{borderRadius:"0 0 12px 12px",overflow:"hidden",border:"1px solid rgba(99,130,200,.14)",borderTop:"none",marginBottom:6,background:"rgba(8,12,24,.6)"}}>
 {days.map((dk,di)=>{
 const dayBets=byDay[dk]||[];
 const dayProfit=dayBets.reduce((s,b)=>s+(b.profit||0),0);
 return(
 <div key={dk} style={{borderTop:di>0?"1px solid #1F2937":"none"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",background:"rgba(10,16,32,.97)",borderTop:"1px solid rgba(255,255,255,.03)"}}>
 <span style={{fontSize:13,fontWeight:700,color:"#b8c8de"}}>{fmtDay(dk)}</span>
 <span style={{fontSize:13,fontWeight:700,color:dayProfit>=0?"#00E676":"#EF4444"}}>{dayProfit>=0?"+":""}{dayProfit.toFixed(0)}$</span>
 </div>
   <VirtualizedDayBets bets={dayBets||[]} onStatus={updateStatus} onDelete={deleteBet} onDuplicate={duplicateBet} onEdit={openEdit} onSplit={splitBet} bkPhotos={bkPhotos} onSave={onSave} allTourneys={allTourneys} savedTourneys={savedTourneys}/>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}



 {selectOpen&&(
 <SelectionModal
 bets={bets}
 allByDay={allByDay} allByMonth={allByMonth} allMonthKeys={allMonthKeys}
 onClose={()=>setSelectOpen(false)}
 setBets={setBets}
 supaPushBets={supaPushBets}
 showToast={showToast}
 fmtDay={fmtDay}
 byDay={allByDay}
 monthKeys={allMonthKeys}
 byMonth={allByMonth}
 hiddenBKs={hiddenBKs}
 bookmakers={bookmakers}
 BK_LOGOS={BK_LOGOS}
 bkPhotos={bkPhotos}
 savedTourneys={savedTourneys}
 onAfterPush={function(){if(onMarkPush)onMarkPush();}}
 allPlayers={allPlayers||{}}
 />
 )}
 </div>
 );
});


// Apply media store to module-level vars
function applyMediaStore(store){
 if(!store)return;
 if(store._B64_PP_LOGO_B64)_B64_PP_LOGO_B64=store._B64_PP_LOGO_B64;
 if(store._B64_AMERICAS)_B64_AMERICAS=store._B64_AMERICAS;
 if(store._B64_CHINA)_B64_CHINA=store._B64_CHINA;
 if(store._B64_PACIFIC)_B64_PACIFIC=store._B64_PACIFIC;
 if(store._B64_EMEA)_B64_EMEA=store._B64_EMEA;
 if(store._B64_WAGER)_B64_WAGER=store._B64_WAGER;
 if(store._B64_EWC)_B64_EWC=store._B64_EWC;
 if(store._B64_PGL)_B64_PGL=store._B64_PGL;
 if(store._B64_THEINTERNATIONAL)_B64_THEINTERNATIONAL=store._B64_THEINTERNATIONAL;
 if(store._B64_CHAMPIONS)_B64_CHAMPIONS=store._B64_CHAMPIONS;
 if(store.LOL_ROLE_TOP)LOL_ROLE_TOP=store.LOL_ROLE_TOP;
 if(store.LOL_ROLE_MID)LOL_ROLE_MID=store.LOL_ROLE_MID;
 if(store.LOL_ROLE_BOT)LOL_ROLE_BOT=store.LOL_ROLE_BOT;
 if(store.LOL_ROLE_SUP)LOL_ROLE_SUP=store.LOL_ROLE_SUP;
 if(store.LOL_ROLE_JUN)LOL_ROLE_JUN=store.LOL_ROLE_JUN;
 // League logos
 const LL=LEAGUE_LOGOS;
 if(store.league_Americas)LL.Americas=store.league_Americas;
 if(store.league_EMEA)LL.EMEA=store.league_EMEA;
 if(store.league_Pacific)LL.Pacific=store.league_Pacific;
 if(store.league_LCS)LL.LCS=store.league_LCS;
 if(store.league_LEC)LL.LEC=store.league_LEC;
 if(store.league_LCK)LL.LCK=store.league_LCK;
 if(store.league_ESL)LL.ESL=store.league_ESL;
 if(store.league_BLAST)LL.BLAST=store.league_BLAST;
 if(store["league_Riyadh Masters"])LL["Riyadh Masters"]=store["league_Riyadh Masters"];
 if(store.league_DreamLeague)LL.DreamLeague=store.league_DreamLeague;
 if(store["league_XSE Pro League"])LL["XSE Pro League"]=store["league_XSE Pro League"];
 if(store["league_Stake Ranked"])LL["Stake Ranked"]=store["league_Stake Ranked"];
 if(store.league_MSI)LL.MSI=store.league_MSI;
 if(store.league_LPL)LL.LPL=store.league_LPL;
}
// Apply on page load
try{applyMediaStore(JSON.parse(localStorage.getItem("v7_media_store")||"{}"));}catch(e){}




// ════════════════════════════════════════════════════════════
//  FICHE JOUEUR (style NHL) — s'ouvre en touchant un nom de joueur
// ════════════════════════════════════════════════════════════
const capName=v=>{const x=String(v||"");return x?x.charAt(0).toUpperCase()+x.slice(1):x;};
function openPlayerSheet(name){try{window.dispatchEvent(new CustomEvent("emeieks-open-player",{detail:name}));}catch(e){}}

function PSStat({label,value,color,sub}){
 return(
  <div style={{flex:"1 1 0",minWidth:0,textAlign:"center",padding:"4px 2px"}}>
   <div style={{fontSize:11,fontWeight:700,color:"#8b93a7",letterSpacing:.6,textTransform:"uppercase"}}>{label}</div>
   <div style={{fontSize:22,fontWeight:800,color:color||"#f4f6fb",letterSpacing:-.6,marginTop:4,fontVariantNumeric:"tabular-nums",whiteSpace:"nowrap"}}>{value}</div>
   {sub&&<div style={{fontSize:11,color:"#6b7489",marginTop:2}}>{sub}</div>}
  </div>
 );
}

function psAgg(list){
 const s=list.filter(b=>b.status==="won"||b.status==="lost");
 const won=s.filter(b=>b.status==="won").length;
 const profit=s.reduce((a,b)=>a+(b.profit||0),0);
 const staked=s.reduce((a,b)=>a+(b.stake||0),0);
 const odds=s.length?s.reduce((a,b)=>a+(parseFloat(b.odds)||0),0)/s.length:0;
 return{n:s.length,won,lost:s.length-won,profit,staked,wr:s.length?won/s.length*100:0,roi:staked?profit/staked*100:0,odds,avgStake:s.length?staked/s.length:0};
}

function PlayerSheet({name,player,bets,teamLogos,allPlayers={},activeTourneys={},onClose,onSaved,showToast}){
 const [edit,setEdit]=useState(false);
 const [period,setPeriod]=useState("all");
 const key=(name||"").toLowerCase().trim();
 const p=player||{name};
 const game=p.game||(bets.find(b=>(b.player||"").toLowerCase().trim()===key)||{}).game||"";
 const cfg=GAME_CFG[game]||{accent:"#A78BFA"};
 const acc=cfg.accent||"#A78BFA";
 const teamLogo=(p.team&&teamLogos[p.team+"__"+game])||p.team_logo_url||null;
 const photo=p.photo_url||p.avatar_url||(p.avatar_file?AVATARS_BUCKET+encodeURIComponent(p.avatar_file):null);
 const mine=useMemo(()=>bets.filter(b=>(b.player||"").toLowerCase().trim()===key).sort((a,b)=>String(b.datetime||"").localeCompare(String(a.datetime||""))),[bets,key]);
 const all=psAgg(mine);
 const cutoff=(()=>{const d=new Date();d.setDate(d.getDate()-30);return d.toISOString().slice(0,10);})();
 const last30=psAgg(mine.filter(b=>String(b.datetime||"").slice(0,10)>=cutoff));
 const pending=mine.filter(b=>b.status==="pending");
 const over=psAgg(mine.filter(b=>b.overUnder==="Over"));
 const under=psAgg(mine.filter(b=>b.overUnder==="Under"));
 const byMap={};mine.forEach(b=>{const k=b.mapTag||"Sans map";(byMap[k]=byMap[k]||[]).push(b);});
 const byLine={};mine.forEach(b=>{const m=/(\d+(?:\.\d+)?)\s+(Kills|Headshots)/.exec(b.description||"");if(!m)return;const k=(b.overUnder||"")+" "+m[1]+" "+m[2];(byLine[k]=byLine[k]||[]).push(b);});
 // Courbe du profit cumulé
 const pts=(()=>{let r=0;return [...mine].filter(b=>b.status!=="pending").reverse().map(b=>(r+=b.profit||0));})();
 const money=v=>(v>=0?"+":"")+v.toFixed(0)+"$";
 const pc=v=>v>0?"#00E676":v<0?"#f87171":"#9CA3AF";
 const displayName=p.name||name;

 useEffect(()=>{const k=e=>{if(e.key==="Escape")onClose();};window.addEventListener("keydown",k);return()=>window.removeEventListener("keydown",k);},[onClose]);

 const Spark=()=>{
  if(pts.length<2)return null;
  const W=300,H=56,min=Math.min(0,...pts),max=Math.max(0,...pts),rg=max-min||1;
  const x=i=>i/(pts.length-1)*W,y=v=>H-4-(v-min)/rg*(H-8);
  const d="M"+pts.map((v,i)=>x(i).toFixed(1)+","+y(v).toFixed(1)).join(" L");
  const col=pts[pts.length-1]>=0?"#00E676":"#f87171";
  return(<svg viewBox={"0 0 "+W+" "+H} width="100%" height={H} preserveAspectRatio="none" style={{display:"block"}}>
   <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,.12)" strokeDasharray="3,5"/>
   <path d={d} fill="none" stroke={col} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
  </svg>);
 };

 const Table=({title,groups})=>{
  const rows=Object.entries(groups).map(([k,l])=>[k,psAgg(l)]).filter(([,s])=>s.n>0).sort((a,b)=>b[1].n-a[1].n);
  if(!rows.length)return null;
  return(
   <div style={{background:"#0f1524",border:"1px solid rgba(255,255,255,.06)",borderRadius:16,overflow:"hidden",marginBottom:10}}>
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 44px 54px 54px 70px",gap:6,padding:"11px 14px 8px",fontSize:11,fontWeight:700,color:"#6b7489",letterSpacing:.4}}>
     <span>{title}</span><span style={{textAlign:"right"}}>PARIS</span><span style={{textAlign:"right"}}>RÉUS.</span><span style={{textAlign:"right"}}>ROI</span><span style={{textAlign:"right"}}>PROFIT</span>
    </div>
    {rows.map(([k,s])=>(
     <div key={k} style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 44px 54px 54px 70px",gap:6,padding:"10px 14px",borderTop:"1px solid rgba(255,255,255,.05)",fontSize:13,alignItems:"center"}}>
      <span style={{color:"#e5e7eb",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{k}</span>
      <span style={{textAlign:"right",color:"#9ca3af"}}>{s.n}</span>
      <span style={{textAlign:"right",color:s.wr>=55?"#00E676":s.wr<45?"#f87171":"#cbd5e1",fontWeight:700}}>{s.wr.toFixed(0)}%</span>
      <span style={{textAlign:"right",color:pc(s.roi),fontWeight:600}}>{(s.roi>=0?"+":"")+s.roi.toFixed(0)}%</span>
      <span style={{textAlign:"right",color:pc(s.profit),fontWeight:800}}>{money(s.profit)}</span>
     </div>
    ))}
   </div>
  );
 };

 return(
  <div onClick={onClose} style={{position:"fixed",inset:0,zIndex:450,background:"rgba(0,0,0,.72)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",overflowY:"auto",animation:"overlayIn .2s ease"}}>
   <div onClick={e=>e.stopPropagation()} style={{maxWidth:760,margin:"0 auto",minHeight:"100%",background:"#0B1220",boxShadow:"0 0 60px rgba(0,0,0,.6)"}}>

    {/* ── BANNIÈRE ── */}
    <PlayerBanner name={displayName} photo={photo} role={p.role} game={game} team={p.team} league={p.league} logo={teamLogo}>
     <div style={{position:"absolute",top:12,left:12,right:12,display:"flex",justifyContent:"space-between",zIndex:3}}>
      <button onClick={onClose} aria-label="Fermer" style={{width:36,height:36,borderRadius:18,border:"none",background:"rgba(0,0,0,.4)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic n="x" s={16} w={2.6}/></button>
      <button onClick={()=>setEdit(true)} aria-label="Modifier le joueur" title="Modifier club, position, photos" style={{height:36,padding:"0 14px",borderRadius:18,border:"none",background:"rgba(0,0,0,.4)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:7,fontSize:13,fontWeight:700,fontFamily:"Inter,sans-serif"}}>
       <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
       Modifier
      </button>
     </div>
    </PlayerBanner>

    {/* ── STATS ── */}
    <div style={{padding:"14px 14px 30px"}}>
     {!player&&<div style={{fontSize:12,color:"#fbbf24",background:"rgba(251,191,36,.08)",border:"1px solid rgba(251,191,36,.2)",borderRadius:10,padding:"8px 12px",marginBottom:10}}>Joueur absent de ta liste : l'engrenage permet de le créer.</div>}
     {(()=>{
      const tourOf=b=>b.tournament||b.league||"";
      const actT=activeTourneys[game]&&activeTourneys[game].name&&!(activeTourneys[game].end&&new Date(activeTourneys[game].end)<new Date())?activeTourneys[game].name:"";
      const lastT=(mine.find(b=>tourOf(b))||{});
      const curT=actT||tourOf(lastT);
      const selT=period.startsWith("t:")?period.slice(2):"";
      const opts=[["all","Tout"],["30","30 jours"]].concat(curT?[["t:"+curT,curT]]:[]).concat(selT&&selT!==curT?[["t:"+selT,selT]]:[]);
      const pick=period==="30"?mine.filter(b=>String(b.datetime||"").slice(0,10)>=cutoff):selT?mine.filter(b=>(tourOf(b)||"Hors tournoi")===selT):mine;
      const s=psAgg(pick);
      const verdict=!s.n?"Aucun pari réglé sur cette période.":s.profit>=0?"Tu es gagnant sur "+capName(displayName)+" : "+money(s.profit)+" en "+s.n+" paris.":"Tu perds de l'argent sur "+capName(displayName)+" : "+money(s.profit)+" en "+s.n+" paris.";
      return(<>
       <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto"}}>
        {opts.map(([k,l])=>{const on=period===k;return(
         <button key={k} onClick={()=>setPeriod(k)} style={{flexShrink:0,display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:20,border:"1px solid "+(on?"rgba(167,139,250,.5)":"rgba(255,255,255,.08)"),background:on?"rgba(124,58,237,.18)":"transparent",color:on?"#e9e3ff":"#8b93a7",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>
          {k.startsWith("t:")&&<Ic n="trophy" s={13} c={on?"#fbbf24":"#8b93a7"}/>}{l}
         </button>);})}
       </div>
       <div style={{background:"#0f1524",border:"1px solid rgba(255,255,255,.06)",borderRadius:16,padding:"14px 12px",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,margin:"0 4px 12px",fontSize:13,color:s.n?pc(s.profit):"#8b93a7",fontWeight:600}}>
         <span style={{width:8,height:8,borderRadius:4,background:s.n?pc(s.profit):"#4b5366",flexShrink:0}}/>{verdict}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(96px,1fr))",rowGap:14}}>
         <PSStat label="Paris" value={s.n} sub={s.won+" gagnés · "+s.lost+" perdus"}/>
         <PSStat label="Réussite" value={s.n?s.wr.toFixed(0)+"%":"–"} color={s.n?(s.wr>=55?"#00E676":s.wr<45?"#f87171":undefined):undefined}/>
         <PSStat label="Profit" value={s.n?money(s.profit):"–"} color={s.n?pc(s.profit):undefined}/>
         <PSStat label="ROI" value={s.n?(s.roi>=0?"+":"")+s.roi.toFixed(1)+"%":"–"} color={s.n?pc(s.roi):undefined} sub="gain / mise"/>
         <PSStat label="Cote moy." value={s.n?s.odds.toFixed(2):"–"}/>
         <PSStat label="Mise moy." value={s.n?s.avgStake.toFixed(0)+"$":"–"}/>
        </div>
       </div>
       {/* Tournois */}
       {(()=>{
        const g={};mine.forEach(b=>{const k=tourOf(b)||"Hors tournoi";(g[k]=g[k]||[]).push(b);});
        const rows=Object.entries(g).map(([k,l])=>[k,psAgg(l),l]).filter(([,st])=>st.n>0).sort((x,y)=>(y[0]===curT)-(x[0]===curT)||String((y[2][0]||{}).datetime||"").localeCompare(String((x[2][0]||{}).datetime||"")));
        if(!rows.length)return null;
        return(
         <div style={{background:"#0f1524",border:"1px solid rgba(255,255,255,.06)",borderRadius:16,overflow:"hidden",marginBottom:10}}>
          <div style={{padding:"12px 14px 4px",display:"flex",alignItems:"center",gap:8}}>
           <Ic n="trophy" s={15} c="#fbbf24"/><span style={{fontSize:14,fontWeight:700,color:"#e5e7eb"}}>Par tournoi</span>
          </div>
          {rows.map(([k,st])=>{const cur=k===curT;const sel=selT===k;return(
           <div key={k} onClick={()=>setPeriod(sel?"all":"t:"+k)} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderTop:"1px solid rgba(255,255,255,.05)",background:sel?"rgba(124,58,237,.12)":cur?"rgba(251,191,36,.05)":"transparent",cursor:"pointer"}}>
            <div style={{flex:1,minWidth:0}}>
             <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:14,fontWeight:700,color:"#e5e7eb",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{k}</span>
              {cur&&actT&&<span style={{fontSize:10,fontWeight:800,color:"#34d399",background:"rgba(52,211,153,.12)",padding:"2px 6px",borderRadius:5,flexShrink:0}}>EN COURS</span>}
             </div>
             <div style={{fontSize:12,color:"#8b93a7",marginTop:2}}>{st.n} paris · {st.won}G-{st.lost}P · {st.wr.toFixed(0)}% réussite</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
             <div style={{fontSize:15,fontWeight:800,color:pc(st.profit)}}>{money(st.profit)}</div>
             <div style={{fontSize:11,color:pc(st.roi),fontWeight:600}}>ROI {(st.roi>=0?"+":"")+st.roi.toFixed(0)}%</div>
            </div>
           </div>);})}
         </div>);
       })()}
      </>);
     })()}
     {pts.length>1&&<div style={{background:"#0f1524",border:"1px solid rgba(255,255,255,.06)",borderRadius:16,padding:"12px 14px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#8b93a7",fontWeight:600,marginBottom:6}}><span>Évolution du profit (tous les paris)</span><span style={{color:pc(all.profit),fontWeight:800}}>{money(all.profit)}</span></div>
      <Spark/>
     </div>}
     <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
      {[["Over",over,"#00E676"],["Under",under,"#60a5fa"]].map(([l,s,c])=>(
       <div key={l} style={{background:"#0f1524",border:"1px solid rgba(255,255,255,.06)",borderRadius:16,padding:"12px 14px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}><span style={{fontSize:14,fontWeight:800,color:c}}>{l}</span><span style={{fontSize:12,color:"#6b7489"}}>{s.n} paris</span></div>
        <div style={{fontSize:22,fontWeight:800,color:s.n?pc(s.profit):"#4b5366",marginTop:6}}>{s.n?money(s.profit):"–"}</div>
        <div style={{fontSize:12,color:"#8b93a7",marginTop:2}}>{s.n?s.wr.toFixed(0)+"% · ROI "+(s.roi>=0?"+":"")+s.roi.toFixed(0)+"%":"Aucun pari"}</div>
       </div>
      ))}
     </div>
     {(()=>{
      const isHS=b=>!!b.isHeadshot||/Headshot/i.test(b.description||"");
      const hasHS=game==="CS2"||mine.some(isHS);
      const hasLive=game==="LoL"||mine.some(b=>b.isLive);
      const pairs=[].concat(
       hasHS?[["Paris kills",mine.filter(b=>!isHS(b)),"#fbbf24"],["Paris headshots",mine.filter(isHS),"#818cf8"]]:[],
       hasLive?[["Live",mine.filter(b=>b.isLive),"#fb7185"],["Non-live",mine.filter(b=>!b.isLive),"#60a5fa"]]:[]);
      if(!pairs.length)return null;
      return(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
       {pairs.map(([l,list,c])=>{const st=psAgg(list);return(
        <div key={l} style={{background:"#0f1524",border:"1px solid rgba(255,255,255,.06)",borderRadius:16,padding:"12px 14px"}}>
         <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}><span style={{fontSize:14,fontWeight:800,color:c}}>{l}</span><span style={{fontSize:12,color:"#6b7489"}}>{st.n} paris</span></div>
         <div style={{fontSize:24,fontWeight:800,color:st.n?pc(st.profit):"#4b5366",marginTop:6}}>{st.n?money(st.profit):"–"}</div>
         {st.n?<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 10px",marginTop:10,fontSize:12}}>
          <span style={{color:"#8b93a7"}}>Réussite <b style={{color:st.wr>=55?"#00E676":st.wr<45?"#f87171":"#e5e7eb"}}>{st.wr.toFixed(0)}%</b></span>
          <span style={{color:"#8b93a7"}}>ROI <b style={{color:pc(st.roi)}}>{(st.roi>=0?"+":"")+st.roi.toFixed(1)}%</b></span>
          <span style={{color:"#8b93a7"}}>Bilan <b style={{color:"#e5e7eb"}}>{st.won}G-{st.lost}P</b></span>
          <span style={{color:"#8b93a7"}}>Misé <b style={{color:"#e5e7eb"}}>{st.staked.toFixed(0)}$</b></span>
         </div>:<div style={{fontSize:12,color:"#8b93a7",marginTop:2}}>Aucun pari</div>}
        </div>);})}
      </div>);
     })()}
     <Table title="PAR LIGNE DE KILLS" groups={byLine}/>
     <Table title="PAR MAP" groups={byMap}/>
     {/* Derniers paris */}
     <div style={{background:"#0f1524",border:"1px solid rgba(255,255,255,.06)",borderRadius:16,overflow:"hidden"}}>
      <div style={{padding:"12px 14px 6px",fontSize:14,fontWeight:700,color:"#e5e7eb"}}>Derniers paris {pending.length>0&&<span style={{fontSize:12,color:"#60a5fa",fontWeight:600}}>· {pending.length} en cours</span>}</div>
      {mine.length===0&&<div style={{padding:"14px",fontSize:13,color:"#6b7489"}}>Aucun pari sur ce joueur.</div>}
      {mine.slice(0,15).map(b=>{
       const st=b.status;const col=st==="won"?"#00E676":st==="lost"?"#f87171":"#60a5fa";
       return(
        <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderTop:"1px solid rgba(255,255,255,.05)",borderLeft:"3px solid "+col}}>
         <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:600,color:"#e5e7eb"}}>{b.description} {b.mapTag&&<span style={{fontSize:11,color:"#fbbf24",marginLeft:4}}>{b.mapTag}</span>}</div>
          <div style={{fontSize:12,color:"#6b7489",marginTop:2}}>{String(b.datetime||"").slice(0,10)} · @{b.odds} · {b.stake}$ · {b.bookmaker}</div>
         </div>
         <div style={{fontSize:14,fontWeight:800,color:col}}>{st==="pending"?"En cours":money(b.profit||0)}</div>
        </div>
       );
      })}
     </div>
    </div>
   </div>

   {edit&&<PlayerEditSheet p={p} name={displayName} game={game} teamLogo={teamLogo} photo={photo} teamLogos={teamLogos} allPlayers={allPlayers} onClose={()=>setEdit(false)}
     onSaved={(np,logo)=>{setEdit(false);onSaved&&onSaved(np,logo);}} showToast={showToast}/>}
  </div>
 );
}


// ── Couleur dominante d'un logo (pour teinter la bannière) ──
function useLogoColor(src,fallback){
 const [c,setC]=useState(fallback);
 useEffect(()=>{
  let dead=false;
  if(!src){setC(fallback);return;}
  const img=new Image();img.crossOrigin="anonymous";
  img.onload=()=>{
   try{
    const N=32,cv=document.createElement("canvas");cv.width=cv.height=N;
    const x=cv.getContext("2d");x.drawImage(img,0,0,N,N);
    const d=x.getImageData(0,0,N,N).data;const buckets={};
    for(let i=0;i<d.length;i+=4){
     const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3];if(a<200)continue;
     const mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx<50||mn>225)continue;
     const sat=(mx-mn)/mx;if(sat<.3)continue;
     const k=(r>>5)+","+(g>>5)+","+(b>>5);
     const e=buckets[k]||(buckets[k]={n:0,r:0,g:0,b:0,s:0});e.n++;e.r+=r;e.g+=g;e.b+=b;e.s+=sat;
    }
    const best=Object.values(buckets).sort((p,q)=>(q.n*q.s/q.n*Math.sqrt(q.n))-(p.n*p.s/p.n*Math.sqrt(p.n)))[0];
    if(!dead)setC(best?"#"+[best.r,best.g,best.b].map(v=>Math.round(v/best.n).toString(16).padStart(2,"0")).join(""):fallback);
   }catch(e){if(!dead)setC(fallback);}
  };
  img.onerror=()=>{if(!dead)setC(fallback);};
  img.src=src;
  return()=>{dead=true;};
 },[src,fallback]);
 return c;
}

// ── Bannière joueur (fiche + éditeur) ──
function PlayerBanner({name,photo,role,game,team,league,logo,children}){
 const acc=(GAME_CFG[game]||{}).accent||"#A78BFA";
 const col=useLogoColor(logo,acc);
 return(
  <div style={{position:"relative",overflow:"hidden",containerType:"inline-size",background:"radial-gradient(120% 150% at 88% 30%,"+col+"55 0%,rgba(11,18,32,0) 58%),linear-gradient(180deg,#0d1830 0%,#09101f 100%)",borderBottom:"3px solid "+col,transition:"background .4s"}}>
   {team&&<div style={{position:"absolute",left:"2%",top:"50%",transform:"translateY(-50%)",fontSize:"min(150px, calc(96cqw / "+(Math.max(4,String(team).length)*0.66).toFixed(2)+"))",fontWeight:900,letterSpacing:-2,whiteSpace:"nowrap",color:"transparent",WebkitTextStroke:"1.5px "+col+"66",pointerEvents:"none",textTransform:"uppercase",lineHeight:1,transition:"all .4s"}}>{team}</div>}
   {children}
   <div style={{position:"relative",zIndex:2,display:"flex",alignItems:"flex-end",gap:12,padding:"58px 14px 0",minHeight:190,maxWidth:900,margin:"0 auto"}}>
    <div style={{width:"clamp(92px,26vw,150px)",height:"clamp(120px,32vw,170px)",flexShrink:0,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
     {photo
      ?<img key={photo} src={photo} alt={name} style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",objectPosition:"50% 100%",filter:"drop-shadow(0 6px 18px rgba(0,0,0,.5))"}}/>
      :<div style={{width:"clamp(72px,20vw,110px)",height:"clamp(72px,20vw,110px)",marginBottom:24,borderRadius:"50%",background:"linear-gradient(135deg,"+col+",#3B82F6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:44,fontWeight:900,color:"#fff"}}>{(name||"?").charAt(0).toUpperCase()}</div>}
    </div>
    <div style={{flex:1,minWidth:0,paddingBottom:20}}>
     {role&&<span style={{display:"inline-block",padding:"3px 9px",borderRadius:6,background:"rgba(255,255,255,.1)",border:"1px solid rgba(255,255,255,.16)",fontSize:12,fontWeight:700,color:"#fff",marginBottom:8}}>{role}</span>}
     <div style={{fontSize:"clamp(26px,7.5vw,40px)",fontWeight:900,color:"#fff",letterSpacing:-1,lineHeight:1.05,overflowWrap:"anywhere"}}>{capName(name)||"Nouveau joueur"}</div>
     <div style={{display:"flex",alignItems:"center",gap:7,marginTop:10,flexWrap:"wrap",fontSize:14,color:"#cbd5e1",fontWeight:600}}>
      {game&&<><GameLogo game={game} size={18}/><span style={{color:acc}}>{game}</span></>}
      <span style={{color:"#5b6478"}}>•</span><span>{team||"Agent libre"}</span>
      {league&&<><span style={{color:"#5b6478"}}>•</span><span>{league}</span></>}
     </div>
    </div>
    {logo&&<img key={logo} src={logo} alt={team||""} style={{width:"clamp(48px,14vw,92px)",height:"clamp(48px,14vw,92px)",objectFit:"contain",flexShrink:0,marginBottom:22,filter:"drop-shadow(0 4px 14px rgba(0,0,0,.5))"}}/>}
   </div>
  </div>
 );
}

// ── Éditeur de joueur : aperçu en direct en haut, modifications en dessous ──
function PlayerEditSheet({p,name,game:game0,teamLogo,photo,onClose,onSaved,showToast,teamLogos={},allPlayers={},onDelete,isNew}){
 const [f,setF]=useState({name:p.name||name||"",game:game0||p.game||"CS2",team:p.team||"",role:p.role||"",league:p.league||"",photo:photo||"",logo:teamLogo||""});
 const [busy,setBusy]=useState("");
 const [clubQ,setClubQ]=useState("");
 const [clubOpen,setClubOpen]=useState(false);
 const set=(k,v)=>setF(x=>({...x,[k]:v}));
 const roles=ROLES_BY_GAME[f.game]||[];
 // Clubs connus pour ce jeu (avec leur logo)
 const clubs=useMemo(()=>{
  const m={};
  Object.values(allPlayers).forEach(x=>{if(x&&x.team&&x.game===f.game){const k=x.team;if(!m[k])m[k]={name:k,logo:null,league:x.league||"",n:0};m[k].n++;if(!m[k].logo&&x.team_logo_url)m[k].logo=x.team_logo_url;}});
  Object.entries(teamLogos).forEach(([k,v])=>{const i=k.lastIndexOf("__");if(i<1)return;const t=k.slice(0,i),g=k.slice(i+2);if(g!==f.game)return;if(!m[t])m[t]={name:t,logo:null,league:"",n:0};if(v)m[t].logo=v;});
  return Object.values(m).sort((a,b)=>b.n-a.n||a.name.localeCompare(b.name));
 },[allPlayers,teamLogos,f.game]);
 const shownClubs=clubs.filter(c=>!clubQ||c.name.toLowerCase().includes(clubQ.toLowerCase())).slice(0,40);
 const pickClub=c=>{setF(x=>({...x,team:c.name,logo:c.logo||"",league:x.league||c.league||""}));setClubOpen(false);setClubQ("");};
 const upload=async(file,folder,k)=>{
  if(!file)return;setBusy(k);
  try{const url=await supaUploadPhoto(file,folder);set(k,url);}catch(e){showToast&&showToast("Envoi impossible : "+((e&&e.message)||e),"#EF4444");}
  setBusy("");
 };
 const pasteImg=async(folder,k)=>{
  try{
   const r=await readClipboardImage();
   if(r.blob&&/svg/.test(r.type)){try{r.blob=await svgToPng(r.blob);r.type="image/png";}catch(e){}}
   if(r.blob){await upload(new File([r.blob],"image."+((r.type.split("/")[1]||"png").replace(/\+.*/,"")),{type:r.type}),folder,k);return;}
   set(k,r.url);
  }catch(e){showToast&&showToast((e&&e.message)||"Collage impossible ici : utilise « Fichier »","#F59E0B");}
 };
 const C={background:"#0f1524",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,padding:"14px",marginBottom:10};
 const T={fontSize:14,fontWeight:700,color:"#eef1f7",marginBottom:10,display:"flex",alignItems:"center",gap:8};
 const L={fontSize:12,fontWeight:700,color:"#8b93a7",margin:"12px 2px 6px"};
 const I={width:"100%",background:"rgba(8,14,28,.95)",border:"1px solid rgba(255,255,255,.1)",borderRadius:11,padding:"11px 12px",color:"#E5E7EB",fontSize:14,fontFamily:"Inter,sans-serif",outline:"none"};
 const smallBtn={padding:"9px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.03)",color:"#cbd5e1",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap"};
 const imgField=(k,folder,round)=>(
  <div style={{display:"flex",gap:12,alignItems:"center"}}>
   <div style={{width:64,height:64,borderRadius:round?32:14,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
    {f[k]?<img src={f[k]} alt="" style={{width:"100%",height:"100%",objectFit:round?"cover":"contain",objectPosition:"50% 15%"}}/>:<Ic n="plus" s={18} c="#5b6478"/>}
   </div>
   <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:7}}>
    <input style={I} placeholder="Lien de l'image (https://…)" value={f[k]} onChange={e=>set(k,e.target.value.trim())}/>
    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
     <label style={smallBtn}>{busy===k?"Envoi…":"Fichier"}<input type="file" accept="image/*" style={{display:"none"}} onChange={e=>upload(e.target.files&&e.target.files[0],folder,k)}/></label>
     <button type="button" style={smallBtn} onClick={()=>pasteImg(folder,k)}>Coller</button>
     {f[k]&&<button type="button" style={{...smallBtn,color:"#f87171"}} onClick={()=>set(k,"")}>Retirer</button>}
    </div>
   </div>
  </div>
 );
 const save=async()=>{
  setBusy("save");
  try{
   let ph=f.photo, lg=f.logo;
   if(ph&&/^https?:/.test(ph)&&!ph.includes("/storage/v1/object/public/")){try{ph=await supaUploadPhotoFromUrl(ph,"players");}catch(e){}}
   if(lg&&/^https?:/.test(lg)&&!lg.includes("/storage/v1/object/public/")){try{lg=await supaUploadPhotoFromUrl(lg,"teams");}catch(e){}}
   const row={name:f.name.trim(),game:f.game,team:f.team.trim(),role:f.role,league:f.league.trim(),photo_url:ph||null,avatar_url:ph||null,team_logo_url:f.team.trim()?(lg||null):null};
   let saved=null;
   if(p.id){const r=await cloudDb("players?id=eq."+encodeURIComponent(p.id),{method:"PATCH",body:row,prefer:"return=representation"});saved=r&&r[0];}
   else{const r=await cloudDb("players",{method:"POST",body:row,prefer:"return=representation"});saved=r&&r[0];}
   if(lg&&row.team){await cloudDb("players?team=eq."+encodeURIComponent(row.team)+"&game=eq."+encodeURIComponent(row.game),{method:"PATCH",body:{team_logo_url:lg}}).catch(()=>{});}
   showToast&&showToast(capName(row.name)+" enregistré","#00E676");
   onSaved({...p,...row,...(saved||{})},row.team?lg:null);
  }catch(e){showToast&&showToast("Erreur : "+((e&&e.message)||e).slice(0,80),"#EF4444");}
  setBusy("");
 };
 const dirty=JSON.stringify(f)!==JSON.stringify({name:p.name||name||"",game:game0||p.game||"CS2",team:p.team||"",role:p.role||"",league:p.league||"",photo:photo||"",logo:teamLogo||""});
 return(
  <div onClick={e=>{e.stopPropagation();onClose();}} style={{position:"fixed",inset:0,zIndex:470,background:"rgba(0,0,0,.75)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",overflowY:"auto",animation:"overlayIn .2s ease"}}>
   <div onClick={e=>e.stopPropagation()} style={{maxWidth:760,margin:"0 auto",minHeight:"100%",background:"#0B1220",display:"flex",flexDirection:"column"}}>
    <PlayerBanner name={f.name} photo={f.photo} role={f.role} game={f.game} team={f.team} league={f.league} logo={f.logo}>
     <div style={{position:"absolute",top:12,left:12,right:12,display:"flex",justifyContent:"space-between",alignItems:"center",zIndex:3}}>
      <button onClick={onClose} aria-label="Fermer" style={{width:36,height:36,borderRadius:18,border:"none",background:"rgba(0,0,0,.4)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Ic n="x" s={16} w={2.6}/></button>
      <span style={{fontSize:12,fontWeight:700,color:"#e9e3ff",background:"rgba(0,0,0,.4)",padding:"6px 12px",borderRadius:20}}>{isNew?"Nouveau joueur · aperçu en direct":"Aperçu en direct"}</span>
     </div>
    </PlayerBanner>

    <div style={{padding:"14px 14px 0",flex:1}}>
     {/* Identité */}
     <div style={C}>
      <div style={T}><Ic n="users" s={16} c="#a78bfa"/>Joueur</div>
      <div style={{...L,marginTop:0}}>Pseudo</div>
      <input style={I} value={f.name} onChange={e=>set("name",e.target.value)} placeholder="Ex : ZywOo"/>
      <div style={L}>Jeu</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
       {["CS2","LoL","Dota2","Valorant"].map(g=>{const on=f.game===g;const a=(GAME_CFG[g]||{}).accent||"#A78BFA";return(
        <button key={g} onClick={()=>set("game",g)} style={{padding:"9px 4px",borderRadius:11,border:"1.5px solid "+(on?a:"rgba(255,255,255,.08)"),background:on?a+"1f":"transparent",color:on?a:"#9ca3af",fontSize:12,fontWeight:700,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4,fontFamily:"Inter,sans-serif"}}>
         <GameLogo game={g} size={20}/>{g}</button>);})}
      </div>
      <div style={L}>Position</div>
      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
       {[...new Set([...roles,...(f.role&&!roles.includes(f.role)?[f.role]:[])])].map(r=>{const on=f.role===r;return(
        <button key={r} onClick={()=>set("role",on?"":r)} style={{padding:"8px 13px",borderRadius:20,border:"1.5px solid "+(on?"#7C3AED":"rgba(255,255,255,.08)"),background:on?"rgba(124,58,237,.18)":"transparent",color:on?"#e9e3ff":"#9ca3af",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{r}</button>);})}
      </div>
      <div style={L}>Photo du joueur</div>
      {imgField("photo","players",true)}
     </div>

     {/* Club */}
     <div style={C}>
      <div style={T}><Ic n="trophy" s={16} c="#fbbf24"/>Club</div>
      <div style={{position:"relative"}}>
       <button type="button" onClick={()=>setClubOpen(o=>!o)} style={{...I,display:"flex",alignItems:"center",gap:10,cursor:"pointer",textAlign:"left"}}>
        {f.logo?<img src={f.logo} alt="" style={{width:26,height:26,objectFit:"contain"}}/>:<span style={{width:26,height:26,borderRadius:7,background:"rgba(255,255,255,.05)"}}/>}
        <span style={{flex:1,fontWeight:700,color:f.team?"#eef1f7":"#8b93a7"}}>{f.team||"Agent libre"}</span>
        <Ic n={clubOpen?"up":"down"} s={14} c="#8b93a7"/>
       </button>
       {clubOpen&&(
        <div style={{marginTop:6,background:"#0b1120",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,overflow:"hidden"}}>
         <div style={{padding:8,borderBottom:"1px solid rgba(255,255,255,.06)"}}>
          <input autoFocus style={{...I,padding:"9px 11px"}} placeholder={"Chercher un club "+f.game+"… ou taper un nouveau nom"} value={clubQ} onChange={e=>setClubQ(e.target.value)}/>
         </div>
         <div style={{maxHeight:260,overflowY:"auto"}}>
          <button type="button" onClick={()=>{setF(x=>({...x,team:"",logo:""}));setClubOpen(false);}} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:"none",borderBottom:"1px solid rgba(255,255,255,.05)",background:"transparent",color:"#fbbf24",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
           <Ic n="ban" s={18} c="#fbbf24"/>Agent libre (sans club)
          </button>
          {clubQ.trim()&&!clubs.some(c=>c.name.toLowerCase()===clubQ.trim().toLowerCase())&&(
           <button type="button" onClick={()=>pickClub({name:clubQ.trim(),logo:"",league:""})} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"10px 12px",border:"none",borderBottom:"1px solid rgba(255,255,255,.05)",background:"rgba(124,58,237,.08)",color:"#c4b5fd",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
            <Ic n="plus" s={18} c="#c4b5fd"/>Nouveau club « {clubQ.trim()} »
           </button>
          )}
          {shownClubs.map(c=>{const on=c.name===f.team;return(
           <button type="button" key={c.name} onClick={()=>pickClub(c)} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",border:"none",borderBottom:"1px solid rgba(255,255,255,.05)",background:on?"rgba(124,58,237,.12)":"transparent",color:"#e5e7eb",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
            {c.logo?<img src={c.logo} alt="" style={{width:24,height:24,objectFit:"contain"}}/>:<span style={{width:24,height:24,borderRadius:6,background:"rgba(255,255,255,.05)"}}/>}
            <span style={{flex:1}}>{c.name}</span>
            <span style={{fontSize:11,color:"#6b7489"}}>{c.league?c.league+" · ":""}{c.n} joueur(s)</span>
            {on&&<Ic n="check" s={14} c="#a78bfa"/>}
           </button>);})}
          {shownClubs.length===0&&!clubQ&&<div style={{padding:12,fontSize:12,color:"#6b7489"}}>Aucun club enregistré pour {f.game}.</div>}
         </div>
        </div>
       )}
      </div>
      <div style={L}>Ligue</div>
      <input style={I} list="pe-leagues" placeholder="Ex : LCK, EMEA, Pacific, Europe…" value={f.league} onChange={e=>set("league",e.target.value)}/>
      <datalist id="pe-leagues">{(LEAGUES_BY_GAME[f.game]||[]).map(l=><option key={l} value={l}/>)}</datalist>
      {f.team&&<>
       <div style={L}>Logo du club <span style={{fontWeight:500,color:"#6b7489"}}>· appliqué à tous les joueurs de {f.team}</span></div>
       {imgField("logo","teams",false)}
      </>}
     </div>

     {onDelete&&p.id&&(
      <button onClick={()=>{if(window.confirm("Supprimer "+capName(f.name)+" de ta liste de joueurs ?"))onDelete(p);}}
       style={{width:"100%",padding:"12px",borderRadius:12,border:"1px solid rgba(239,68,68,.25)",background:"rgba(239,68,68,.06)",color:"#f87171",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
       <Ic n="trash" s={14}/>Supprimer ce joueur
      </button>
     )}
    </div>

    {/* Barre d'enregistrement */}
    <div style={{position:"sticky",bottom:0,zIndex:5,marginTop:14,background:"rgba(9,14,28,.97)",borderTop:"1px solid rgba(255,255,255,.07)",padding:"12px 14px calc(12px + env(safe-area-inset-bottom))"}}>
     <div style={{maxWidth:732,margin:"0 auto",display:"flex",gap:8}}>
      <button onClick={onClose} style={{flex:1,padding:"14px",borderRadius:14,border:"1px solid rgba(255,255,255,.1)",background:"transparent",color:"#cbd5e1",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Annuler</button>
      <button onClick={save} disabled={!!busy||!f.name.trim()||(!dirty&&!isNew)}
       style={{flex:2,padding:"14px",borderRadius:14,border:"none",background:(dirty||isNew)&&f.name.trim()?"linear-gradient(135deg,#7C3AED,#3B82F6)":"rgba(255,255,255,.06)",color:(dirty||isNew)&&f.name.trim()?"#fff":"#6b7489",fontWeight:800,fontSize:15,cursor:(dirty||isNew)?"pointer":"default",fontFamily:"Inter,sans-serif",opacity:busy?.6:1}}>
       {busy==="save"?"Enregistrement…":isNew?(f.name.trim()?"Ajouter le joueur":"Entre un pseudo"):dirty?"Enregistrer les modifications":"Aucune modification"}
      </button>
     </div>
    </div>
   </div>
  </div>
 );
}
function openPlayerEditor(name){try{window.dispatchEvent(new CustomEvent("emeieks-edit-player",{detail:name}));}catch(e){}}

export default function App(){
 // Register Service Worker for image caching
 useEffect(()=>{
  if('serviceWorker' in navigator){
   navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }
 },[]);

 const [bets,setBets]=useState([]);
 const [bankroll,setBankroll]=useState(5000);
 const [manualTier,setManualTier]=useState(()=>{try{const s=localStorage.getItem("v7_manual_tier");return s?parseInt(s):null;}catch(e){return null;}});
 const [quickUnits,setQuickUnits]=useState(()=>{try{const s=localStorage.getItem("v7_quick_units");if(s){const a=JSON.parse(s);if(Array.isArray(a)&&a.length===6)return a;}}catch(e){}return[0.75,1,1.25,1.5,1.75,2];});
 const [players,setPlayers]=useState({}); // { name_lowercase: {id,name,game,league,role,team,avatar_url,avatar_file} }

 const [bookmakers,setBookmakers]=useState(DEFAULT_BK);
 const [form,setForm]=useState({...EMPTY_FORM,datetime:nowDT()});
 const [stickyBK,setStickyBK]=useState(false);
 const [lockedStatus,setLockedStatus]=useState(null);
 const [view,setViewRaw]=useState("home");
 const [playerSheet,setPlayerSheet]=useState(null);
 const [addEditOpen,setAddEditOpen]=useState(false);
 const [playerEditor,setPlayerEditor]=useState(null);
 useEffect(()=>{const h=e=>setPlayerEditor(e.detail||null);window.addEventListener("emeieks-edit-player",h);return()=>window.removeEventListener("emeieks-edit-player",h);},[]);
 // Applique une fiche joueur modifiée partout (liste des joueurs + logos d'équipe)
 const applyPlayerSaved=(oldKey,np,logo)=>{
  const newKey=(np.name||"").toLowerCase().trim();
  setPlayers(prev=>{const n={...prev};if(oldKey&&oldKey!==newKey)delete n[oldKey];n[newKey]={...(prev[oldKey]||{}),...np};
   if(logo&&np.team)Object.keys(n).forEach(k=>{if(n[k].team===np.team&&n[k].game===np.game)n[k]={...n[k],team_logo_url:logo};});return n;});
  if(logo&&np.team)setTeamLogos(prev=>({...prev,[np.team+"__"+np.game]:logo}));
  return newKey;
 };
 useEffect(()=>{const h=e=>setPlayerSheet(e.detail||null);window.addEventListener("emeieks-open-player",h);return()=>window.removeEventListener("emeieks-open-player",h);},[]);
 const [viewPending,setViewPending]=useState(false);
 const setView=useCallback(v=>{
 try{window.scrollTo({top:0,behavior:"instant"});}catch(e){}
 setViewRaw(v);
 },[]);
 const [loaded,setLoaded]=useState(false);
 // Les joueurs viennent uniquement de Supabase — pas de localStorage
 const [toast,setToast]=useState(null);
 // betConfirm removed
 const [showCal,setShowCal]=useState(false);
 const [calMonth,setCalMonth]=useState(new Date().getMonth());
 const [calYear,setCalYear]=useState(new Date().getFullYear());
 const [calSelected,setCalSelected]=useState(null);
 const [calGames,setCalGames]=useState([]);
 const [visibleMonths,setVisibleMonths]=useState(1);
 const [selectMode,setSelectMode]=useState(false);
 const [selectedIds,setSelectedIds]=useState([]);
 const [bulkModal,setBulkModal]=useState(false);
 
 const [bulkBK,setBulkBK]=useState("");
 const [bulkDatetime,setBulkDatetime]=useState("");
 const [bulkTourney,setBulkTourney]=useState("");
 const [bulkMap,setBulkMap]=useState("");
 const [editingBet,setEditingBet]=useState(null); // null or bet object being edited
 const [sessionMode,setSessionMode]=useState(false);
 const [duelMode,setDuelMode]=useState(false);
 const [casinoMode,setCasinoMode]=useState(false);
 const [duelForm,setDuelForm]=useState({player1:"",player2:"",odds:"",stake:"",winner:"",bookmaker:"",mapTag:"Map 1",isLive:false,datetime:"",ppMapType:"",ppLine_player1:"",ppLine_player2:""});
 const [sessionMaps,setSessionMaps]=useState([{...EMPTY_MAP_ROW},{...EMPTY_MAP_ROW},{...EMPTY_MAP_ROW}]);
 const [fGames,setFGames]=useState([]);
 const [fBKs,setFBKs]=useState([]);
 const [sortByMap,setSortByMap]=useState(false);
 const [fPlayer,setFPlayer]=useState("");

 const [fStatus,setFStatus]=useState("All");
 const [fTourneys,setFTourneys]=useState(new Set()); // Set vide = tous
 const [fOverUnder,setFOverUnder]=useState("All");
 const [filtresPage,setFiltresPage]=useState(1);
 const [fLive,setFLive]=useState(false);
 const [fHeadshot,setFHeadshot]=useState(false);
 const [fDuel,setFDuel]=useState(false);
 const [fDateFrom,setFDateFrom]=useState("");
 const [fDateTo,setFDateTo]=useState("");
 const [fMinOdds,setFMinOdds]=useState("");
 const [fMaxOdds,setFMaxOdds]=useState("");
 const [fMinStake,setFMinStake]=useState("");
 const [fMaxStake,setFMaxStake]=useState("");
 const [fMinPP,setFMinPP]=useState("");
 const [fMaxPP,setFMaxPP]=useState("");
 const [fMapFilter,setFMapFilter]=useState("all");
 const [deletedBets,setDeletedBets]=useState([]);
 const [showCorbeille,setShowCorbeille]=useState(false);
 const [showFullReset,setShowFullReset]=useState(false);
 const [settledOrder,setSettledOrder]=useState({});
 const [fRole,setFRole]=useState("All");
 const [fLeague,setFLeague]=useState("All");
 const FILTRES_PER_PAGE=30;
 const [modalBK,setModalBK]=useState(false);
 const [splitModal,setSplitModal]=useState(null); // bet to split
 const [splitForm,setSplitForm]=useState({bookmaker:"",stake:"",odds:""});
 const [newBK,setNewBK]=useState("");
 const [newBKPhoto,setNewBKPhoto]=useState("");
 const [bkPhotos,setBkPhotos]=useState({});
 const [customClubs,setCustomClubs]=useState({}); // {game: [{name, league, logoUrl}]}
 const [mediaStore,setMediaStore]=useState({});
 const mediaLoadedRef=useRef(false); // true after initial Supabase load
 const [teamLogos,setTeamLogos]=useState(()=>{try{return JSON.parse(localStorage.getItem("v7_team_logos")||"{}");}catch(e){return {};}});
 const DEFAULT_HIDDEN_BKS=[];
 const [hiddenBKs,setHiddenBKs]=useState(()=>{try{const saved=JSON.parse(localStorage.getItem("v7_hidden_bks")||"null");if(saved!==null)return new Set(saved);return new Set(DEFAULT_HIDDEN_BKS);}catch(e){return new Set(DEFAULT_HIDDEN_BKS);}});
 const toggleHideBK=useCallback(bk=>setHiddenBKs(prev=>{const n=new Set(prev);n.has(bk)?n.delete(bk):n.add(bk);const arr=[...n];localStorage.setItem("v7_hidden_bks",JSON.stringify(arr));return n;}),[]);
 const visibleBKs=bookmakers.filter(bk=>!hiddenBKs.has(bk));
 const [modalPlayer,setModalPlayer]=useState(false);
 const [pform,setPform]=useState({name:"",game:"LoL",league:"",role:"",team:""});
 const [editingPlayer,setEditingPlayer]=useState(null); // {key, data}
 // Tournois actifs par jeu: {CS2: {name:"PGL Astana 2026", end:"2026-04-10"}, ...}
 const [activeTourneys,setActiveTourneys]=useState({});
 // Tous les tournois sauvegardés (historique + réactivation)
 const [savedTourneys,setSavedTourneys]=useState({
 CS2:["PGL Astana 2026","IEM Rio 2026","BLAST Rivals 2026","PGL Bucharest 2026","ESL Pro League S24","BLAST Open Fall 2026","IEM Cologne Major 2026","Esports World Cup 2026"],
 Dota2:["ESL One 2026","PGL Wallachia S3","Riyadh Masters 2026","The International 2026","BetBoom Dacha 2026"],
 LoL:["Worlds 2026","MSI 2026","LEC Spring 2026","LCK Summer 2026","Esports World Cup"],
 Valorant:["VCT Masters 2026","Champions 2026","VCT Americas 2026","VCT EMEA 2026"],
 });
 const [confirmDelete,setConfirmDelete]=useState(false);
 const [modalTourney,setModalTourney]=useState(false); // game string ou false
 const [suiviOpen,setSuiviOpen]=useState({tournois:true,bookmakers:false,prizepicks:false});
 const [rosterOpen,setRosterOpen]=useState(false);
 const [rosterGame,setRosterGame]=useState(null);
 const [rosterLeague,setRosterLeague]=useState(null);
 const [rosterTeam,setRosterTeam]=useState(null);
 const [editP,setEditP]=useState(null);
 const [editPForm,setEditPForm]=useState({});
 const [editPPhotoUrl,setEditPPhotoUrl]=useState("");
 const [editPSaving,setEditPSaving]=useState(false);
 const [editTeam,setEditTeam]=useState(null);
 const [teamLogoUrl,setTeamLogoUrl]=useState("");
 const [teamLogoSaving,setTeamLogoSaving]=useState(false);
 const [tourneyCal,setTourneyCal]=useState(()=>{try{return JSON.parse(localStorage.getItem("v7_tourney_cal")||"[]");}catch(e){return[];}});
 const [tourneyCalForm,setTourneyCalForm]=useState({name:"",game:"LoL",start:"",end:""});
 const [showTourneyCalForm,setShowTourneyCalForm]=useState(false);
 const [ppData,setPpData]=useState(()=>{try{const s=localStorage.getItem("v7_pp_data");return s?JSON.parse(s):[];}catch(e){return[];}});
 const [ppActiveLeague,setPpActiveLeague]=useState("all");
 const [ppActiveTiers,setPpActiveTiers]=useState(new Set(["standard","demon","goblin"]));
 const [ppSearch,setPpSearch]=useState("");
 const [ppFullscreen,setPpFullscreen]=useState(false);
 const [ppCalcBk,setPpCalcBk]=useState("");
 const [ppCalcPp,setPpCalcPp]=useState("");
 const [ppCalcMt,setPpCalcMt]=useState("Map 1+2");
 const [ppCalcOu,setPpCalcOu]=useState("Over");
 const [statsGameOpen,setStatsGameOpen]=useState({});
 const [lolLiveMode,setLolLiveMode]=useState("live");
 const [bkDrillOpen,setBkDrillOpen]=useState(null); // selected bookmaker name
 const [bkDrillGame,setBkDrillGame]=useState(null); // selected game within bookmaker
 const [ouDrill,setOuDrill]=useState(null);
 const [statsTab,setStatsTab]=useState("apercu");
 const [dowMetric,setDowMetric]=useState("roi");
 const [analyseView,setAnalyseView]=useState("global");
 const [calibDrill,setCalibDrill]=useState(null);
 const [hideLolLive,setHideLolLive]=useState(false); // masque les bets live LoL dans cote idéale
 const [coteSort,setCoteSort]=useState({key:"edge",dir:1});
 const [signalSort,setSignalSort]=useState({key:"profit",dir:-1});
 const [calibSort,setCalibSort]=useState({key:"edge",dir:1});
 const [breakevenSort,setBreakevenSort]=useState({key:"label",dir:1});
 // MODE NOUVEAU DÉPART (Men in Black) 
 const [statsPeriod,setStatsPeriod]=useState(null);
 const [statsChartMode,setStatsChartMode]=useState("line");
 const [playersExpanded,setPlayersExpanded]=useState(null);
 const [playerSortKey,setPlayerSortKey]=useState("profit");
 const [playerMinBets,setPlayerMinBets]=useState(1);
 const [testingOpen,setTestingOpen]=useState(false);
 const DEFAULT_TEST_FILTER={games:new Set(["CS2","LoL","Dota2","Valorant"]),headshot:"all",live:"all",oddsMin:"",oddsMax:"",hideTourneys:new Set(),hideLeagues:new Set(),hideRoles:new Set(),ppEdgeMin:"",ppEdgeMax:"",overUnder:"all"};
 const [testFilterDraft,setTestFilterDraft]=useState(DEFAULT_TEST_FILTER); // what user edits
 const [testFilter,setTestFilter]=useState(DEFAULT_TEST_FILTER); // what actually drives stats
 const [candleTF,setCandleTF]=useState("day");
 const [betGroupMode,setBetGroupMode]=useState("jour"); // jour | semaine
 const [homePeriod,setHomePeriod]=useState(null);
 const [homeChartModal,setHomeChartModal]=useState(false);
 const [homeChartFilters,setHomeChartFilters]=useState({games:[],overUnder:"All",live:"All",bookmakers:[],dateFrom:"",dateTo:""});
 const [statsDrill,setStatsDrill]=useState(null);
 const [ppEdgeDrill,setPpEdgeDrill]=useState(null); // {edge, mapType} or null // {game, league} or null
 const [ppStatsDrill,setPpStatsDrill]=useState(null); // {game, stat, ppLine} navigation state
 const [ppBetsDrill,setPpBetsDrill]=useState(null); // list of bets to show in drill view
 const [ppStatsTab,setPpStatsTab]=useState("edge");
 const [ppOU,setPpOU]=useState("");
 const [ppMapFilter,setPpMapFilter]=useState("");
 const [ppSortByCount,setPpSortByCount]=useState(false);
 const [ppFilterOpen,setPpFilterOpen]=useState(false);
 const [ppOUApplied,setPpOUApplied]=useState("");
 const [ppMapFilterApplied,setPpMapFilterApplied]=useState("");
 const [ppKillMetric,setPpKillMetric]=useState("roi");
 const [drillPeriod,setDrillPeriod]=useState(null); // 3/7/14/30 days
 const [collapsedMonths,setCollapsedMonths]=useState(new Set());
 function toggleMonth(mk){setCollapsedMonths(prev=>{const n=new Set(prev);if(n.has(mk))n.delete(mk);else n.add(mk);return n;});}


 // Supabase sync (sans login) 
 const [syncing,setSyncing]=useState(false);
 const [supaOk,setSupaOk]=useState(false);
 const [supaModal,setSupaModal]=useState(false);
 const [supaError,setSupaError]=useState("");
 const [integrityChecking,setIntegrityChecking]=useState(false);
 const [integrityReport,setIntegrityReport]=useState(null);

 // ════════════════════════════════════════════════════════════
 //  SYNCHRO CLOUD — Supabase est la seule source de vérité.
 //  Plus de copie des paris dans le navigateur : tout est lu et
 //  écrit dans Supabase, et le temps réel pousse les changements
 //  faits sur un autre appareil (ordi ↔ iPhone) instantanément.
 // ════════════════════════════════════════════════════════════
 const showToast=useCallback(function(msg,color){
 color=color||"#00E676";
 setToast({msg,color});setTimeout(()=>setToast(null),2200);
 },[]);
 const showBetConfirm=useCallback(function(){},[]);
 const lastPushRef=useRef(0);
 const hydratedRef=useRef(false);
 const [syncErr,setSyncErr]=useState("");
 const [liveState,setLiveState]=useState("…");
 const [diag,setDiag]=useState(null);
 const errsRef=useRef({});
 const refreshErr=()=>{const v=Object.values(errsRef.current);setSyncErr(v[0]||"");setSupaOk(v.length===0);};
 const keyOf=w=>{const m=/(bets|paris|bookmakers|tournaments|settings|media_store|media|teams|players)/i.exec(w);return m?m[1].toLowerCase().replace("paris","bets").replace(/^media$/,"media_store"):w;};
 const fail=(where,e)=>{const m=where+" : "+((e&&e.message)||String(e)).slice(0,220);errsRef.current[keyOf(where)]=m;refreshErr();console.error("[SYNC]",m);};
 const good=where=>{if(errsRef.current[keyOf(where)]){delete errsRef.current[keyOf(where)];}refreshErr();};
 const [hydrated,setHydrated]=useState(false);
 const cloudSnap=useRef({});      // dernier état connu côté Supabase, par canal
 const cloudSkip=useRef({});      // canal mis à jour depuis Supabase → ne pas renvoyer
 const cloudTimers=useRef({});
 const betSnap=useRef(new Map()); // id → JSON du pari tel qu'il est dans Supabase
 const betsRef=useRef(bets);betsRef.current=bets;

 // Joueurs (table players)
 const loadPlayers=useCallback(function(){
 return supaFetchPlayers().then(rows=>{
 if(!rows)return;
 const obj={};
 const RMIG={"Top Laner":"Top","Toplaner":"Top","Bot Laner":"Bot","Botlaner":"Bot","Mid Laner":"Mid","Midlaner":"Mid","Jungler":"Jungle","jungler":"Jungle","Jngl":"Jungle","Jng":"Jungle"};
 rows.forEach(p=>{
 obj[(p.name||"").toLowerCase()]={id:p.id,name:p.name,game:p.game,league:p.league,role:p.role&&RMIG[p.role]?RMIG[p.role]:p.role,team:p.team,
 photo_url:p.photo_url||null,team_logo_url:p.team_logo_url||null,avatar_url:p.avatar_url||null,avatar_file:p.avatar_file||null};
 });
 setPlayers(obj);
 return obj;
 }).catch(function(){return null;});
 },[]);

 // ── Conversion état ↔ tables ──
 const bkPayload=()=>bookmakers.map((n,i)=>({name:n,logo:bkPhotos[n]||null,hidden:hiddenBKs.has(n),position:i}));
 const applyBk=rows=>{
 const sorted=[...rows].sort((a,b)=>(a.position||0)-(b.position||0));
 setBookmakers(sorted.map(r=>r.name));
 const ph={};sorted.forEach(r=>{if(r.logo)ph[r.name]=r.logo;});
 setBkPhotos(ph);
 setHiddenBKs(new Set(sorted.filter(r=>r.hidden).map(r=>r.name)));
 };
 const tourPayload=()=>{
 const rows={};const pos={};
 const get=(game,name)=>{
 const k=game+"||"+name;
 if(!rows[k]){pos[game]=(pos[game]||0);rows[k]={game,name,position:pos[game]++,saved:false,active:false,active_end:null,cal_id:null,cal_start:null,cal_end:null};}
 return rows[k];
 };
 Object.entries(savedTourneys||{}).forEach(([g,list])=>(list||[]).forEach(n=>{if(n)get(g,n).saved=true;}));
 Object.entries(activeTourneys||{}).forEach(([g,t])=>{if(t&&t.name){const r=get(g,t.name);r.active=true;r.active_end=t.end||null;}});
 (tourneyCal||[]).forEach(c=>{if(c&&c.name&&c.game){const r=get(c.game,c.name);r.cal_id=c.id!=null?String(c.id):null;r.cal_start=c.start||null;r.cal_end=c.end||null;}});
 return Object.values(rows);
 };
 const applyTour=rows=>{
 const sorted=[...rows].sort((a,b)=>a.game.localeCompare(b.game)||(a.position||0)-(b.position||0));
 const saved={},active={},cal=[];
 sorted.forEach(r=>{
 if(r.saved){(saved[r.game]=saved[r.game]||[]).push(r.name);}
 if(r.active)active[r.game]={name:r.name,end:r.active_end||""};
 if(r.cal_id!=null&&r.cal_id!=="")cal.push({id:/^\d+$/.test(r.cal_id)?Number(r.cal_id):r.cal_id,name:r.name,game:r.game,start:r.cal_start||"",end:r.cal_end||""});
 });
 setSavedTourneys(saved);setActiveTourneys(active);
 setTourneyCal(cal.sort((a,b)=>String(a.start).localeCompare(String(b.start))));
 };
 const setPayload=()=>({
 bankroll,manual_tier:manualTier,quick_units:quickUnits,
 sticky_bk:{active:stickyBK,bk:stickyBK?form.bookmaker:""},
 locked_status:lockedStatus,pp_data:ppData,
 });
 const applySettings=s=>{
 if(s.bankroll!=null)setBankroll(Number(s.bankroll)||5000);
 if("manual_tier" in s)setManualTier(s.manual_tier||null);
 if(Array.isArray(s.quick_units)&&s.quick_units.length===6)setQuickUnits(s.quick_units);
 if(s.sticky_bk){setStickyBK(!!s.sticky_bk.active);if(s.sticky_bk.active&&s.sticky_bk.bk)setForm(f=>({...f,bookmaker:s.sticky_bk.bk}));}
 if("locked_status" in s)setLockedStatus(s.locked_status||null);
 if(Array.isArray(s.pp_data))setPpData(s.pp_data);
 };
 const mediaPayload=()=>({mediaStore,customClubs});
 const applyMedia=m=>{
 if(m.mediaStore&&typeof m.mediaStore==="object"){setMediaStore(m.mediaStore);applyMediaStore(m.mediaStore);_GLOBAL_MEDIA_STORE=m.mediaStore;}
 if(m.customClubs&&typeof m.customClubs==="object")setCustomClubs(m.customClubs);
 };
 const teamPayload=()=>teamLogos;

 // ── Écriture vers Supabase ──
 const writers={
 bookmakers:async(rows,prev)=>{
 if(rows.length)await cloudDb("bookmakers",{method:"POST",body:rows,prefer:"resolution=merge-duplicates"});
 const keep=new Set(rows.map(r=>r.name));
 const gone=(prev||[]).map(r=>r.name).filter(n=>!keep.has(n));
 for(const n of gone)await cloudDb("bookmakers?name=eq."+encodeURIComponent(n),{method:"DELETE"});
 },
 tournaments:async(rows,prev)=>{
 if(rows.length)await cloudDb("tournaments?on_conflict=game,name",{method:"POST",body:rows,prefer:"resolution=merge-duplicates"});
 const keep=new Set(rows.map(r=>r.game+"||"+r.name));
 const gone=(prev||[]).filter(r=>!keep.has(r.game+"||"+r.name));
 for(const r of gone)await cloudDb("tournaments?game=eq."+encodeURIComponent(r.game)+"&name=eq."+encodeURIComponent(r.name),{method:"DELETE"});
 },
 settings:async(obj,prev)=>{
 const rows=Object.entries(obj).filter(([k,v])=>!prev||JSON.stringify(prev[k])!==JSON.stringify(v)).map(([key,value])=>({key,value:value===undefined?null:value}));
 if(rows.length)await cloudDb("settings",{method:"POST",body:rows,prefer:"resolution=merge-duplicates"});
 },
 media:async(obj,prev)=>{
 const rows=Object.entries(obj).filter(([k,v])=>!prev||JSON.stringify(prev[k])!==JSON.stringify(v)).map(([key,value])=>({key,value:JSON.stringify(value||{}),updated_at:Date.now()}));
 if(rows.length)await cloudDb("media_store",{method:"POST",body:rows,prefer:"resolution=merge-duplicates"});
 },
 teams:async(map,prev)=>{
 const changed=Object.entries(map).filter(([k,v])=>v&&(!prev||prev[k]!==v));
 for(const [k,url] of changed){
 const i=k.lastIndexOf("__");if(i<1)continue;
 const name=k.slice(0,i),game=k.slice(i+2);
 const upd=await cloudDb("teams?name=eq."+encodeURIComponent(name)+"&game=eq."+encodeURIComponent(game),{method:"PATCH",body:{logo_url:url},prefer:"return=representation"});
 if(!upd||!upd.length)await cloudDb("teams",{method:"POST",body:{name,game,logo_url:url}});
 }
 },
 };
 const channelState={
 bookmakers:[bookmakers,bkPhotos,hiddenBKs],
 tournaments:[savedTourneys,activeTourneys,tourneyCal],
 settings:[bankroll,manualTier,quickUnits,stickyBK,form.bookmaker,lockedStatus,ppData],
 media:[mediaStore,customClubs],
 teams:[teamLogos],
 };
 const builders={bookmakers:bkPayload,tournaments:tourPayload,settings:setPayload,media:mediaPayload,teams:teamPayload};
 const buildersRef=useRef(builders);buildersRef.current=builders;
 // Un effet par canal : dès qu'un réglage change ici, il part dans Supabase
 Object.keys(channelState).forEach(ch=>{
 useEffect(()=>{
 if(!hydratedRef.current)return;
 const payload=buildersRef.current[ch]();
 const json=JSON.stringify(payload);
 if(cloudSkip.current[ch]){cloudSkip.current[ch]=false;cloudSnap.current[ch]={json,payload};return;}
 const prev=cloudSnap.current[ch];
 if(prev&&prev.json===json)return;
 clearTimeout(cloudTimers.current[ch]);
 cloudTimers.current[ch]=setTimeout(()=>{
 const p=buildersRef.current[ch]();const j=JSON.stringify(p);
 const before=cloudSnap.current[ch];
 if(before&&before.json===j)return;
 cloudSnap.current[ch]={json:j,payload:p};
 writers[ch](p,before&&before.payload).then(()=>good(ch)).catch(e=>{fail("Écriture "+ch,e);showToast("Synchro "+ch+" : "+(e.message||e).slice(0,60),"#EF4444");});
 },500);
 },[hydrated,...channelState[ch]]);
 });

 // ── Paris : on envoie tout pari ajouté / modifié / supprimé ──
 const betJson=b=>JSON.stringify([b.player,b.description,b.overUnder,b.odds,b.stake,b.bookmaker,b.status,b.game,b.league,b.role,b.team,b.datetime,!!b.isHeadshot,!!b.isLive,b.mapTag||"",b.profit,b.tournament||"",b.splits&&b.splits.length?b.splits:null,b.ppMapType||null,b.ppLine||null,b.ppEdge!=null?b.ppEdge:null]);
 const betTimer=useRef(null);
 useEffect(()=>{
 if(!hydratedRef.current)return;
 clearTimeout(betTimer.current);
 betTimer.current=setTimeout(()=>{
 const snap=betSnap.current;
 const cur=betsRef.current;
 const changed=[];const seen=new Set();
 cur.forEach(b=>{
 if(b==null||b.id==null)return;
 seen.add(String(b.id));
 const j=betJson(b);
 if(snap.get(String(b.id))!==j){changed.push(b);snap.set(String(b.id),j);}
 });
 const removed=[];
 snap.forEach((j,id)=>{if(!seen.has(id))removed.push(id);});
 removed.forEach(id=>snap.delete(id));
 if(changed.length){lastPushRef.current=Date.now();supaPushBets(changed.map(b=>({...b,updatedAt:Date.now()}))).then(()=>good("bets")).catch(e=>{fail("Envoi des paris",e);changed.forEach(b=>snap.delete(String(b.id)));showToast("Pari non enregistré : "+(e.message||e).slice(0,60),"#EF4444");});}
 if(removed.length)supaDeleteManyBets(removed).catch(()=>{});
 },400);
 },[bets,hydrated]);

 // Cache d'affichage pour une ouverture instantanée (Supabase reste la référence)
 useEffect(()=>{
 if(!hydratedRef.current)return;
 const t=setTimeout(()=>{try{localStorage.setItem("emeieks_cache_bets",JSON.stringify(betsRef.current));}catch(e){try{localStorage.removeItem("emeieks_cache_bets");}catch(e2){}}},2500);
 return()=>clearTimeout(t);
 },[bets,hydrated]);

 // Relecture complète des paris (au retour sur l'app / bouton Sync)
 const pullFromSupa=useCallback(async function(){
 setSyncing(true);
 try{
 const remote=(await supaPullBets()).filter(b=>!["__SETTINGS__","__TEAM_LOGOS__","__BK_PHOTOS__","__MEDIA_STORE__"].includes(b.player));
 const snap=betSnap.current;
 const local=new Map(betsRef.current.map(b=>[String(b.id),b]));
 const next=remote.map(r=>{
 const l=local.get(String(r.id));
 // un pari modifié ici mais pas encore envoyé reste prioritaire
 if(l&&snap.get(String(r.id))!==betJson(l))return l;
 return r;
 });
 betsRef.current.forEach(l=>{if(!remote.some(r=>String(r.id)===String(l.id))&&!snap.has(String(l.id)))next.unshift(l);});
 const ns=new Map();remote.forEach(r=>ns.set(String(r.id),betJson(r)));
 betSnap.current=ns;
 setBets(next);
 good("bets");
 }catch(e){fail("Lecture des paris",e);}
 setSyncing(false);
 },[]);



 // Sauvegarde complète téléchargeable (toutes les tables)
 const [backingUp,setBackingUp]=useState(false);
 const downloadBackup=async function(){
 setBackingUp(true);
 try{
 const all=async t=>{let out=[];for(let off=0;;off+=1000){const r=await cloudDb(t+"?select=*&limit=1000&offset="+off);out=out.concat(r||[]);if(!r||r.length<1000)break;}return out;};
 const data={app:"EMEIEKS",version:2,exportedAt:new Date().toISOString()};
 for(const t of ["bets","players","teams","bookmakers","tournaments","settings","media_store"]){
 try{data[t]=await all(t);}catch(e){data[t]={erreur:(e&&e.message)||String(e)};}
 }
 const nb=Array.isArray(data.bets)?data.bets.filter(b=>!String(b.player||"").startsWith("__")).length:0;
 const blob=new Blob([JSON.stringify(data)],{type:"application/json"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");
 a.href=url;a.download="emeieks-sauvegarde-"+new Date().toISOString().slice(0,10)+".json";
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
 showToast("Sauvegarde téléchargée · "+nb+" paris","#00E676");
 }catch(e){showToast("Sauvegarde impossible : "+((e&&e.message)||e),"#EF4444");}
 setBackingUp(false);
 };
 // Test de connexion table par table (fenêtre Cloud)
 const runDiag=async function(){
 setDiag([{t:"Test en cours…",ok:null}]);
 const out=[];
 const test=async(label,fn)=>{try{const r=await fn();out.push({t:label,ok:true,m:r});}catch(e){out.push({t:label,ok:false,m:((e&&e.message)||String(e)).slice(0,200)});}setDiag([...out]);};
 await test("Lecture bets",async()=>{const r=await cloudDb("bets?select=id&limit=1");return (r||[]).length+" ligne(s)";});
 await test("Lecture players",async()=>{const r=await cloudDb("players?select=id&limit=1");return "ok";});
 for(const t of ["bookmakers","tournaments","settings","media_store","teams"])await test("Lecture "+t,async()=>{const r=await cloudDb(t+"?select=*&limit=500");return (r||[]).length+" ligne(s)";});
 await test("Écriture settings",async()=>{await cloudDb("settings",{method:"POST",body:[{key:"_test",value:Date.now()}],prefer:"resolution=merge-duplicates"});await cloudDb("settings?key=eq._test",{method:"DELETE"});return "ok";});
 await test("Temps réel",async()=>liveState);
 };

 // ── Chargement initial (+ récupération des anciens réglages une seule fois) ──
 useEffect(()=>{
 let alive=true;
 (async()=>{
 setSyncing(true);
 const ls=k=>{try{const v=localStorage.getItem(k);if(v==null)return undefined;try{return JSON.parse(v);}catch(e){return v;}}catch(e){return undefined;}};
 let loadFailed=false;
 const safe=(p,w)=>p.catch(e=>{loadFailed=true;fail(w||"Chargement",e);return null;});
try{localStorage.removeItem("v7_bets");localStorage.removeItem("v7_overrides");}catch(e){}
 // Affichage immédiat : dernière copie connue (simple cache d'affichage, remplacé par Supabase en quelques secondes)
 try{const c=JSON.parse(localStorage.getItem("emeieks_cache_bets")||"null");if(Array.isArray(c)&&c.length&&betsRef.current.length===0)setBets(c);}catch(e){}
 const SPECIAL=["__SETTINGS__","__TEAM_LOGOS__","__BK_PHOTOS__","__MEDIA_STORE__"];
 // Les paris s'affichent dès qu'ils arrivent, sans attendre le reste
 const betsP=safe(supaPullBets(),"Lecture des paris").then(rb=>{
  if(rb&&alive){
   const real=rb.filter(b=>!SPECIAL.includes(b.player));
   const snap=new Map();real.forEach(b=>snap.set(String(b.id),betJson(b)));
   betSnap.current=snap;
   setBets(real);
   good("bets");
  }
  return rb;
 });
 const [bkRows,tourRows,setRows,mediaRows,teamRows,playersObj]=await Promise.all([
 safe(cloudDb("bookmakers?select=*"),"Table bookmakers"),
 safe(cloudDb("tournaments?select=*"),"Table tournaments"),
 safe(cloudDb("settings?select=key,value"),"Table settings"),
 safe(cloudDb("media_store?select=key,value"),"Table media_store"),
 safe(cloudDb("teams?select=name,game,logo_url"),"Table teams"),
 loadPlayers(),
 ]);
 const remoteBets=await betsP;
 if(!alive)return;
 const media={};(mediaRows||[]).forEach(r=>{try{media[r.key]=JSON.parse(r.value);}catch(e){}});
 const setKeys=new Set((setRows||[]).map(r=>r.key));
 // Anciennes lignes techniques : lues seulement si une migration est encore nécessaire
 const needLegacy=!(bkRows&&bkRows.length)||!(tourRows&&tourRows.length)||!setKeys.has("bankroll")||!media.mediaStore;
 const legacyRows=needLegacy?await safe(cloudDb("bets?select=player,description&player=in.(__SETTINGS__,__TEAM_LOGOS__,__BK_PHOTOS__,__MEDIA_STORE__)")):[];
 if(!alive)return;
 const legacy={};(legacyRows||[]).forEach(r=>{try{legacy[r.player]=JSON.parse(r.description||"{}");}catch(e){}});
 const oldSet=media.settings||legacy.__SETTINGS__||{};
 const seeded={};


 // Bookmakers
 if(bkRows&&bkRows.length){applyBk(bkRows);cloudSkip.current.bookmakers=true;}
 else{
 const list=[...new Set([...(ls("v7_bmakers")||oldSet.bookmakers||[]),...DEFAULT_BK])];
 setBookmakers(list);
 setBkPhotos({...(legacy.__BK_PHOTOS__||{}),...(media.bkPhotos||{}),...(ls("v7_bkphotos")||{})});
 setHiddenBKs(new Set(ls("v7_hidden_bks")||[]));
 seeded.bookmakers=true;
 }

 // Tournois
 if(tourRows&&tourRows.length){applyTour(tourRows);cloudSkip.current.tournaments=true;}
 else{
 const at=(oldSet.activeTourneys&&Object.keys(oldSet.activeTourneys).length?oldSet.activeTourneys:ls("v7_tourneys"))||{};
 const st=(oldSet.savedTourneys&&Object.keys(oldSet.savedTourneys).length?oldSet.savedTourneys:ls("v7_saved_tourneys"))||null;
 const tc=(Array.isArray(oldSet.tourneyCal)&&oldSet.tourneyCal.length?oldSet.tourneyCal:ls("v7_tourney_cal"))||[];
 setActiveTourneys(at);if(st)setSavedTourneys(st);setTourneyCal(Array.isArray(tc)?tc:[]);
 seeded.tournaments=true;
 }

 // Réglages
 const sObj={};(setRows||[]).forEach(r=>{sObj[r.key]=r.value;});
 const need=["bankroll","manual_tier","quick_units","sticky_bk","locked_status","pp_data"].filter(k=>!(k in sObj));
 if(need.length){
 const old={
 bankroll:ls("v7_bankroll")!=null?parseFloat(ls("v7_bankroll")):undefined,
 manual_tier:ls("v7_manual_tier")!=null?parseInt(ls("v7_manual_tier")):undefined,
 quick_units:ls("v7_quick_units"),sticky_bk:ls("v7_sticky_bk"),
 locked_status:ls("v7_locked_status")||undefined,pp_data:ls("v7_pp_data"),
 };
 need.forEach(k=>{if(old[k]!==undefined&&old[k]!==null&&!(typeof old[k]==="number"&&isNaN(old[k])))sObj[k]=old[k];});
 applySettings(sObj);
 seeded.settings=true;
 }else{applySettings(sObj);cloudSkip.current.settings=true;}

 // Médias (logos) + clubs perso
 if(media.mediaStore||media.customClubs){applyMedia(media);cloudSkip.current.media=!(legacy.__MEDIA_STORE__&&!media.mediaStore);}
 const ms={...(legacy.__MEDIA_STORE__||{}),...(ls("v7_media_store")||{}),...(media.mediaStore||{})};
 if(Object.keys(ms).length&&!media.mediaStore){applyMedia({mediaStore:ms});seeded.media=true;}

 // Logos d'équipes : table teams + anciens logos
 const tl={};
 Object.values(playersObj||{}).forEach(p=>{if(p.team&&p.game&&p.team_logo_url)tl[p.team+"__"+p.game]=p.team_logo_url;});
 Object.assign(tl,legacy.__TEAM_LOGOS__||{},ls("v7_team_logos")||{});
 (teamRows||[]).forEach(t=>{if(t.logo_url&&t.name&&t.game)tl[t.name+"__"+t.game]=t.logo_url;});
 setTeamLogos(tl);cloudSkip.current.teams=true;

 // Les canaux récupérés de l'ancien site partent dans Supabase au 1er rendu
 Object.keys(seeded).forEach(ch=>{cloudSkip.current[ch]=false;});
 mediaLoadedRef.current=true;
 hydratedRef.current=true;
 setHydrated(true);
 setLoaded(true);
 setSyncing(false);
 })();
 return()=>{alive=false;};
 },[]);

 // ── Temps réel : les changements des autres appareils arrivent ici ──
 const applyRemote=useRef({});
 applyRemote.current={applyBk,applyTour,applySettings,applyMedia,loadPlayers};
 useEffect(()=>{
 if(!hydrated)return;
 let stop=null;const timers={};
 const later=(k,fn)=>{clearTimeout(timers[k]);timers[k]=setTimeout(fn,300);};
 const refetch={
 bookmakers:()=>cloudDb("bookmakers?select=*").then(r=>{if(r){good("bookmakers");cloudSkip.current.bookmakers=true;applyRemote.current.applyBk(r);}}).catch(e=>fail("Relecture bookmakers",e)),
 tournaments:()=>cloudDb("tournaments?select=*").then(r=>{if(r){good("tournaments");cloudSkip.current.tournaments=true;applyRemote.current.applyTour(r);}}),
 settings:()=>cloudDb("settings?select=key,value").then(r=>{if(r){good("settings");const o={};r.forEach(x=>{o[x.key]=x.value;});cloudSkip.current.settings=true;applyRemote.current.applySettings(o);}}).catch(e=>fail("Relecture settings",e)),
 media_store:()=>cloudDb("media_store?select=key,value").then(r=>{if(r){good("media_store");const o={};r.forEach(x=>{try{o[x.key]=JSON.parse(x.value);}catch(e){}});cloudSkip.current.media=true;applyRemote.current.applyMedia(o);}}),
 teams:()=>cloudDb("teams?select=name,game,logo_url").then(r=>{if(r){good("teams");cloudSkip.current.teams=true;setTeamLogos(prev=>{const m={...prev};r.forEach(t=>{if(t.logo_url)m[t.name+"__"+t.game]=t.logo_url;});return m;});}}).catch(e=>fail("Relecture teams",e)),
 players:()=>applyRemote.current.loadPlayers(),
 };
 const onBet=(evt,row,old)=>{
 if(evt==="DELETE"){const id=String(old&&old.id);betSnap.current.delete(id);setBets(prev=>prev.filter(b=>String(b.id)!==id));return;}
 if(!row||["__SETTINGS__","__TEAM_LOGOS__","__BK_PHOTOS__","__MEDIA_STORE__"].includes(row.player))return;
 let splits;try{splits=row.splits?(typeof row.splits==="string"?JSON.parse(row.splits):row.splits):undefined;}catch(e){}
 const b=normalizeBet({...row,id:Number(row.id),odds:Number(row.odds),stake:Number(row.stake),profit:Number(row.profit)||0,splits,ppMapType:row.pp_map_type||null,ppLine:row.pp_line||null,ppEdge:row.pp_edge!=null?Number(row.pp_edge):null});
 betSnap.current.set(String(b.id),betJson(b));
 setBets(prev=>{
 const i=prev.findIndex(x=>String(x.id)===String(b.id));
 if(i===-1)return [b,...prev];
 const n=prev.slice();n[i]={...prev[i],...b};return n;
 });
 };
 (async()=>{
 try{
 const mod=await import(/* @vite-ignore */ "https://esm.sh/@supabase/supabase-js@2");
 const client=mod.createClient(SUPA_URL,SUPA_KEY,{auth:{persistSession:false}});
 const ch=client.channel("emeieks-live");
 ch.on("postgres_changes",{event:"*",schema:"public",table:"bets"},p=>onBet(p.eventType,p.new,p.old));
 ["bookmakers","tournaments","settings","media_store","teams","players"].forEach(t=>{
 ch.on("postgres_changes",{event:"*",schema:"public",table:t},()=>later(t,refetch[t]));
 });
 ch.subscribe(s=>{setLiveState(s);});
 stop=()=>client.removeChannel(ch);
 }catch(e){
 setLiveState("indisponible ("+((e&&e.message)||e).toString().slice(0,60)+")");
 // Pas de temps réel (réseau) → relecture toutes les 20 s
 const iv=setInterval(()=>{if(document.visibilityState==="visible"){pullFromSupa();Object.values(refetch).forEach(f=>f());}},20000);
 stop=()=>clearInterval(iv);
 }
 })();
 // Au retour sur l'app (iPhone en arrière-plan) : on relit tout
 const onVisible=()=>{if(document.visibilityState==="visible"){pullFromSupa();Object.values(refetch).forEach(f=>f());}};
 document.addEventListener("visibilitychange",onVisible);
 return()=>{stop&&stop();document.removeEventListener("visibilitychange",onVisible);Object.values(timers).forEach(clearTimeout);};
 },[hydrated,pullFromSupa]);

 // Ref pour LeagueLogo
 useEffect(()=>{_GLOBAL_MEDIA_STORE=mediaStore;},[mediaStore]);

 // Reouvrir clavier iPhone au retour sur l'app 
 const lastFocusedRef = useRef(null);
 const playerACRef = useRef(null);
 useEffect(()=>{
 function onFocusIn(e){
 if(e.target&&(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.tagName==="SELECT")){
 lastFocusedRef.current = e.target;
 }
 }
 function onVisibilityChange(){
 if(document.visibilityState==="visible" && lastFocusedRef.current){
 setTimeout(()=>{
 try{ lastFocusedRef.current.focus(); }catch(e){}
 }, 300);
 }
 }
 document.addEventListener("focusin", onFocusIn);
 document.addEventListener("visibilitychange", onVisibilityChange);
 return ()=>{
 document.removeEventListener("focusin", onFocusIn);
 document.removeEventListener("visibilitychange", onVisibilityChange);
 };
 },[]);

 // allPlayers : uniquement depuis Supabase (table "players")
 const allPlayers=useMemo(function(){
 const merged={};
 Object.entries(players).forEach(([k,v])=>{
 merged[k]=v;
 });
 return merged;
 },[players]);

 // Fréquence de bets par joueur — pour trier les suggestions PlayerAC
 const allBetsByPlayer=useMemo(function(){
 const m={};
 bets.forEach(b=>{const k=(b.player||"").toLowerCase().trim();if(k){if(!m[k])m[k]=[];m[k].push(b);}});
 return m;
 },[bets]);
 const betFreq=useMemo(function(){
 const freq={};
 bets.forEach(b=>{
 if(b.player){
 const k=b.player.toLowerCase().trim();
 freq[k]=(freq[k]||0)+1;
 }
 });
 return freq;
 },[bets]);

 const findPlayer=useCallback(function(name,game){
 const key=name.toLowerCase().trim();
 // 1. Correspondance exacte
 if(allPlayers[key])return{name:key,...allPlayers[key]};
 // 2. Clé préfixée par le jeu (ex: "dota2:bach")
 if(game){
 const gKey=game.toLowerCase()+":"+key;
 if(allPlayers[gKey])return{name:gKey,...allPlayers[gKey]};
 }
 // 3. Chercher n'importe quelle clé se terminant par :name (tous les jeux)
 const suffixKey=":"+key;
 const match=Object.keys(allPlayers).find(k=>k.endsWith(suffixKey));
 if(match)return{name:match,...allPlayers[match]};
 return null;
 },[allPlayers]);

 const settled=useMemo(()=>bets.filter(b=>b.status!=="pending"),[bets]);

 

 // Filtre Test + MIB 
 const isTestActive=useMemo(()=>{
 const f=testFilter;
 return f.games.size<4||f.headshot!=="all"||f.live!=="all"||f.overUnder!=="all"||!!f.oddsMin||!!f.oddsMax||f.hideTourneys.size>0||f.hideLeagues.size>0||f.hideRoles.size>0||!!f.ppEdgeMin||!!f.ppEdgeMax;
 },[testFilter]);

 // Filtre pur hors composant — pas de capture de closure React
 const filteredByTest=useCallback((base)=>{
 let r=base;
 // MIB filter
 // Test filters
 if(testFilter.games.size<4)r=r.filter(b=>testFilter.games.has(b.game));
 if(testFilter.headshot==="yes")r=r.filter(b=>b.isHeadshot);
 if(testFilter.headshot==="no")r=r.filter(b=>!b.isHeadshot);
 if(testFilter.live==="yes")r=r.filter(b=>b.isLive);
 if(testFilter.live==="no")r=r.filter(b=>!b.isLive);
 if(testFilter.overUnder==="over")r=r.filter(b=>b.overUnder==="Over");
 if(testFilter.overUnder==="under")r=r.filter(b=>b.overUnder==="Under");
 if(testFilter.oddsMin)r=r.filter(b=>(b.odds||0)>=parseFloat(testFilter.oddsMin));
 if(testFilter.oddsMax)r=r.filter(b=>(b.odds||0)<=parseFloat(testFilter.oddsMax));
 if(testFilter.hideTourneys.size>0)r=r.filter(b=>!testFilter.hideTourneys.has(b.tournament||"Hors tournoi"));
 if(testFilter.hideLeagues.size>0)r=r.filter(b=>!testFilter.hideLeagues.has(b.league||""));
 if(testFilter.hideRoles.size>0)r=r.filter(b=>!testFilter.hideRoles.has(b.role||""));
 if(testFilter.ppEdgeMin)r=r.filter(b=>!b.ppEdge||Math.abs(b.ppEdge)>=parseFloat(testFilter.ppEdgeMin));
 if(testFilter.ppEdgeMax)r=r.filter(b=>!b.ppEdge||Math.abs(b.ppEdge)<=parseFloat(testFilter.ppEdgeMax));
 return r;
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[isTestActive,testFilter]);

 const betsForDisplay=useMemo(()=>isTestActive?filteredByTest(bets):bets,[bets,isTestActive,filteredByTest]);

 const settledFiltered=useMemo(function(){
 let base=settled;
 if(statsPeriod){const cutoff=new Date();cutoff.setDate(cutoff.getDate()-statsPeriod);const cutStr=cutoff.toISOString().slice(0,10);base=base.filter(b=>b.datetime&&String(b.datetime).slice(0,10)>=cutStr);}
 return isTestActive?filteredByTest(base):base;
 },[settled,statsPeriod,isTestActive,filteredByTest]);

 // ANALYSE AVANCÉE 
 const advancedStats=useMemo(function(){
 if(!settledFiltered.length)return null;
 const DAYS=["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
 // Snap edge to nearest 0.25 (PP standard values: 0.5, 0.75, 1, 1.25, 1.5...)
 const snapEdge=e=>Math.round(Math.abs(e)*4)/4;

 // 1. Performance par jour de la semaine
 const dow={};DAYS.forEach(d=>{dow[d]={cnt:0,won:0,profit:0,staked:0};});
 settledFiltered.forEach(b=>{
 const dt=b.datetime?String(b.datetime):"";if(!dt||!/^\d{4}-\d{2}-\d{2}/.test(dt))return;
 const d=new Date(dt);const day=DAYS[d.getDay()];
 if(!dow[day])return;
 dow[day].cnt++;dow[day].profit+=b.profit;dow[day].staked+=b.stake;if(b.status==="won")dow[day].won++;
 });

 // 1b. Performance par semaine (ISO week)
 const weeks={};
 settledFiltered.forEach(b=>{
 const dt=b.datetime?String(b.datetime):"";if(!dt||!/^\d{4}-\d{2}-\d{2}/.test(dt))return;
 const d=new Date(dt.slice(0,10));
 // ISO week: Monday=start
 const jan1=new Date(d.getFullYear(),0,1);
 const wk=Math.ceil(((d-jan1)/86400000+jan1.getDay()+1)/7);
 const key=d.getFullYear()+"-S"+String(wk).padStart(2,"0");
 // Get week start date (Monday)
 const day=d.getDay()||7;const mon=new Date(d);mon.setDate(d.getDate()-day+1);
 const label=mon.toLocaleDateString("fr-CA",{month:"short",day:"numeric"});
 if(!weeks[key])weeks[key]={key,label,cnt:0,won:0,profit:0,staked:0};
 const w=weeks[key];w.cnt++;w.profit+=b.profit;w.staked+=b.stake;if(b.status==="won")w.won++;
 });
 const weekList=Object.values(weeks).sort((a,b)=>a.key.localeCompare(b.key));

 // 2. Séries (streaks)
 const chron=[...settledFiltered].sort((a,b)=>(String(a.datetime)||"").localeCompare(String(b.datetime)||""));
 let curStreak=0,curType="",bestWin=0,bestLoss=0,tmpW=0,tmpL=0;
 chron.forEach(b=>{
 if(b.status==="won"){tmpW++;tmpL=0;if(tmpW>bestWin)bestWin=tmpW;}
 else{tmpL++;tmpW=0;if(tmpL>bestLoss)bestLoss=tmpL;}
 });
 if(chron.length>0){
 const last=chron[chron.length-1].status;curType=last;curStreak=1;
 for(let i=chron.length-2;i>=0;i--){if(chron[i].status===last)curStreak++;else break;}
 }

 // 3. Calibration PP Edge — chiffres ronds (0.5, 0.75, 1.0, etc.)
 const edgeBuckets={};
 settledFiltered.filter(b=>b.ppEdge!=null).forEach(b=>{
 const key=snapEdge(b.ppEdge).toFixed(2);
 if(!edgeBuckets[key])edgeBuckets[key]={cnt:0,won:0,profit:0,staked:0};
 const bk=edgeBuckets[key];bk.cnt++;bk.profit+=b.profit;bk.staked+=b.stake;
 if(b.status==="won")bk.won++;
 });
 const calibration=Object.entries(edgeBuckets)
 .filter(([,v])=>v.cnt>=3)
 .sort((a,b)=>parseFloat(a[0])-parseFloat(b[0]))
 .map(([k,v])=>({
 label:"+"+parseFloat(k).toFixed(2).replace(/\.?0+$/,"").replace(/(\.\d)$/,"$10"),
 edge:parseFloat(k),cnt:v.cnt,
 wr:Math.round(v.won*100/v.cnt),
 roi:v.staked>0?Math.round(v.profit/v.staked*1000)/10:0,
 profit:v.profit
 }));

 // 4. DÉTECTEUR DE PERTES ce qui coûte le plus
 const LOSS_THRESHOLD=200; // montant minimum pour apparaître
 const lossFactors=[];
 // Helper: agréger par dimension
 const agg=(key,label,val,arr)=>{
 if(!val)return;
 const k=`${key}:${val}`;
 let e=arr.find(x=>x.k===k);
 if(!e){e={k,label,val,cnt:0,won:0,profit:0,staked:0};arr.push(e);}
 return e;
 };

 // Dimensions simples
 const dimMap={};
 settledFiltered.forEach(b=>{
 const dims=[
 b.game&&{key:"game",label:"Jeu",val:b.game},
 b.overUnder&&{key:"ou",label:"Direction",val:b.overUnder},
 b.role&&{key:"role",label:"Position",val:b.role},
 b.ppLine&&{key:"line",label:"Ligne PP",val:String(b.ppLine)},
 b.league&&{key:"league",label:"Ligue",val:b.league},
 b.bookmaker&&{key:"bk",label:"Casino",val:b.bookmaker},
 ].filter(Boolean);
 dims.forEach(d=>{
 const k=`${d.key}:${d.val}`;
 if(!dimMap[k])dimMap[k]={...d,cnt:0,won:0,profit:0,staked:0};
 const e=dimMap[k];e.cnt++;e.profit+=b.profit;e.staked+=b.stake;if(b.status==="won")e.won++;
 });
 });

 // Combos 2 dimensions (game+ou, game+role, ou+line, game+line, ou+role)
 const comboMap={};
 settledFiltered.filter(b=>b.overUnder).forEach(b=>{
 const combos=[
 b.game&&b.overUnder&&{key:`${b.game}+${b.overUnder}`,label:`${b.game} ${b.overUnder}`},
 b.role&&b.overUnder&&{key:`${b.overUnder}+${b.role}`,label:`${b.overUnder} · ${b.role}`},
 b.ppLine&&b.overUnder&&{key:`${b.overUnder}+${b.ppLine}`,label:`${b.overUnder} · Ligne ${b.ppLine}`},
 b.game&&b.role&&b.overUnder&&{key:`${b.game}+${b.overUnder}+${b.role}`,label:`${b.game} ${b.overUnder} · ${b.role}`},
 b.game&&b.ppLine&&b.overUnder&&{key:`${b.game}+${b.overUnder}+${b.ppLine}`,label:`${b.game} ${b.overUnder} · Ligne ${b.ppLine}`},
 ].filter(Boolean);
 combos.forEach(c=>{
 if(!comboMap[c.key])comboMap[c.key]={...c,cnt:0,won:0,profit:0,staked:0};
 const e=comboMap[c.key];e.cnt++;e.profit+=b.profit;e.staked+=b.stake;if(b.status==="won")e.won++;
 });
 });

 const toSig=e=>({...e,wr:e.cnt>0?Math.round(e.won/e.cnt*100):0,roi:e.staked>0?Math.round(e.profit/e.staked*1000)/10:0});
 const signalList=Object.values(dimMap).filter(e=>e.cnt>=5).map(toSig).sort((a,b)=>a.profit-b.profit);
 const comboList=Object.values(comboMap).filter(e=>e.cnt>=4&&e.profit<=-LOSS_THRESHOLD).map(toSig).sort((a,b)=>a.profit-b.profit).slice(0,12);

 // 5. Seuil de rentabilité par tranche de cote — simplifié
 // Tranches de cotes fines (0.05)
 const oddsBuckets={};
 const getBucket=o=>{
 if(o<1.50)return{k:"<1.50",minWR:67};
 if(o<1.55)return{k:"1.50–1.54",minWR:65};
 if(o<1.60)return{k:"1.55–1.59",minWR:63};
 if(o<1.65)return{k:"1.60–1.64",minWR:61};
 if(o<1.70)return{k:"1.65–1.69",minWR:59};
 if(o<1.75)return{k:"1.70–1.74",minWR:57};
 if(o<1.80)return{k:"1.75–1.79",minWR:56};
 if(o<1.85)return{k:"1.80–1.84",minWR:54};
 if(o<1.90)return{k:"1.85–1.89",minWR:53};
 if(o<1.95)return{k:"1.90–1.94",minWR:52};
 if(o<2.00)return{k:"1.95–1.99",minWR:51};
 if(o<2.10)return{k:"2.00–2.09",minWR:48};
 if(o<2.25)return{k:"2.10–2.24",minWR:45};
 if(o<2.50)return{k:"2.25–2.49",minWR:41};
 return{k:"≥2.50",minWR:40};
 };
 settledFiltered.forEach(b=>{
 const o=b.odds||0;
 const {k,minWR}=getBucket(o);
 if(!oddsBuckets[k])oddsBuckets[k]={cnt:0,won:0,profit:0,staked:0,minWR,sortKey:o<1.50?0:o};
 const bk=oddsBuckets[k];bk.cnt++;bk.profit+=b.profit;bk.staked+=b.stake;if(b.status==="won")bk.won++;
 });
 const breakevenData=Object.entries(oddsBuckets)
 .map(([k,v])=>({label:k,cnt:v.cnt,wr:Math.round(v.won*100/v.cnt),minWR:v.minWR,roi:v.staked>0?Math.round(v.profit/v.staked*1000)/10:0,profit:v.profit,sortKey:v.sortKey}))
 .filter(r=>r.cnt>=5)
 .sort((a,b)=>a.sortKey-b.sortKey);

 // 6. COTE IDÉALE Map 1+2 et Map 3 seulement, edges ronds, Over/Under séparés
 const coteGroups={};
 settledFiltered.filter(b=>b.ppEdge!=null&&b.overUnder&&b.game&&(b.ppMapType==="Map 1+2"||b.ppMapType==="Map 3")&&!(hideLolLive&&b.game==="LoL"&&b.isLive)).forEach(b=>{
 const edgeKey=snapEdge(b.ppEdge).toFixed(2);
 const k=`${b.game}|${b.ppMapType}|${b.overUnder}|${edgeKey}`;
 if(!coteGroups[k])coteGroups[k]={game:b.game,mt:b.ppMapType,ou:b.overUnder,edge:parseFloat(edgeKey),cnt:0,won:0,oddsSum:0,profit:0,staked:0};
 const g=coteGroups[k];
 g.cnt++;g.oddsSum+=(b.odds||0);g.profit+=b.profit;g.staked+=b.stake;
 if(b.status==="won")g.won++;
 });
 const coteIdéale=Object.values(coteGroups)
 .filter(g=>g.cnt>=5)
 .map(g=>{
 const wr=g.won/g.cnt;
 const avgOdds=g.oddsSum/g.cnt;
 const idealOdds=wr>0?1/wr:99;
 const safeOdds=wr>0?1/(wr*0.95):99;
 const gap=avgOdds-idealOdds;
 return{
 game:g.game,mt:g.mt,ou:g.ou,edge:g.edge,cnt:g.cnt,
 wr:Math.round(wr*1000)/10,
 avgOdds:Math.round(avgOdds*100)/100,
 idealOdds:Math.round(idealOdds*100)/100,
 safeOdds:Math.round(safeOdds*100)/100,
 gap:Math.round(gap*100)/100,
 roi:Math.round((g.staked>0?g.profit/g.staked*100:0)*10)/10,
 profit:g.profit,
 };
 })
 .sort((a,b)=>a.edge-b.edge);

 return{dow,DAYS,curStreak,curType,bestWin,bestLoss,calibration,signalList,comboList,breakevenData,coteIdéale,weekList};
 },[settledFiltered,hideLolLive]);

 const globalOverUnderStats=useMemo(function(){
 const mk=()=>({cnt:0,won:0,profit:0,staked:0});
 const over=mk(),under=mk();
 const overLive=mk(),underLive=mk(),overNonLive=mk(),underNonLive=mk();
 const overHS=mk(),underHS=mk();
 const overByMap={},underByMap={};
 const overByOdds={};
 const overByBK={},underByBK={};
 const overByGame={},underByGame={};
 settledFiltered.forEach(b=>{
 const isOver=b.overUnder==="Over",isUnder=b.overUnder==="Under";
 if(!isOver&&!isUnder)return;
 const t=isOver?over:under;
 t.cnt++;t.profit+=b.profit;t.staked+=b.stake;if(b.status==="won")t.won++;
 // Per-game
 const g=b.game||"?";
 if(isOver){if(!overByGame[g])overByGame[g]=mk();const og=overByGame[g];og.cnt++;og.profit+=b.profit;og.staked+=b.stake;if(b.status==="won")og.won++;}
 if(isUnder){if(!underByGame[g])underByGame[g]=mk();const ug=underByGame[g];ug.cnt++;ug.profit+=b.profit;ug.staked+=b.stake;if(b.status==="won")ug.won++;}
 if(b.isLive){
 const tl=isOver?overLive:underLive;
 tl.cnt++;tl.profit+=b.profit;tl.staked+=b.stake;if(b.status==="won")tl.won++;
 } else {
 const tn=isOver?overNonLive:underNonLive;
 tn.cnt++;tn.profit+=b.profit;tn.staked+=b.stake;if(b.status==="won")tn.won++;
 }
 if(b.isHeadshot){
 const th=isOver?overHS:underHS;
 th.cnt++;th.profit+=b.profit;th.staked+=b.stake;if(b.status==="won")th.won++;
 }
 const mapKey=b.mapTag||"Sans tag";
 if(isOver){if(!overByMap[mapKey])overByMap[mapKey]=mk();const m=overByMap[mapKey];m.cnt++;m.profit+=b.profit;m.staked+=b.stake;if(b.status==="won")m.won++;}
 if(isUnder){if(!underByMap[mapKey])underByMap[mapKey]=mk();const m=underByMap[mapKey];m.cnt++;m.profit+=b.profit;m.staked+=b.stake;if(b.status==="won")m.won++;}
 if(isOver){
 const o=b.odds||1;
 const bucket=o<1.5?"<1.50":o<1.75?"1.50-1.74":o<2.0?"1.75-1.99":o<2.5?"2.00-2.49":"≥2.50";
 if(!overByOdds[bucket])overByOdds[bucket]={...mk()};
 const ob=overByOdds[bucket];ob.cnt++;ob.profit+=b.profit;ob.staked+=b.stake;if(b.status==="won")ob.won++;
 }
 const bk=b.bookmaker||"Autre";
 if(isOver){if(!overByBK[bk])overByBK[bk]={...mk()};const ob=overByBK[bk];ob.cnt++;ob.profit+=b.profit;ob.staked+=b.stake;if(b.status==="won")ob.won++;}
 if(isUnder){if(!underByBK[bk])underByBK[bk]={...mk()};const ob=underByBK[bk];ob.cnt++;ob.profit+=b.profit;ob.staked+=b.stake;if(b.status==="won")ob.won++;}
 });
 const toS=t=>t.cnt>0?{count:t.cnt,won:t.won,profit:t.profit,staked:t.staked,wr:t.won/t.cnt*100,roi:t.staked>0?t.profit/t.staked*100:0}:null;
 const oddsOrder=["<1.50","1.50-1.74","1.75-1.99","2.00-2.49","≥2.50"];
 return{
 overS:toS(over),underS:toS(under),
 overLiveS:toS(overLive),underLiveS:toS(underLive),
 overNonLiveS:toS(overNonLive),underNonLiveS:toS(underNonLive),
 overHSS:toS(overHS),underHSS:toS(underHS),
 overByGame:Object.entries(overByGame).map(([k,v])=>({game:k,...toS(v)})).sort((a,b)=>b.profit-a.profit),
 underByGame:Object.entries(underByGame).map(([k,v])=>({game:k,...toS(v)})).sort((a,b)=>b.profit-a.profit),
 overByMap:Object.entries(overByMap).map(([k,v])=>({map:k,...toS(v)})).sort((a,b)=>a.map.localeCompare(b.map)),
 overByOdds:oddsOrder.map(k=>overByOdds[k]?{label:k,...toS(overByOdds[k])}:null).filter(Boolean),
 overByBK:Object.entries(overByBK).map(([k,v])=>({label:k,...toS(v)})).sort((a,b)=>a.profit-b.profit),
 };
 },[settledFiltered]);

 // Stats
 const bkStats=useMemo(function(){
 const bk={};
 const add=(k,stake,profit,odds,won)=>{
 if(!bk[k])bk[k]={profit:0,count:0,staked:0,won:0,oddsSum:0};
 bk[k].profit+=profit;bk[k].count++;bk[k].staked+=stake;
 bk[k].oddsSum+=odds;
 if(won)bk[k].won++;
 };
 settledFiltered.forEach(b=>{
 const totalStake=b.stake;
 const splits=b.splits||[];
 if(splits.length===0){
 // No split — all goes to main bookmaker
 add(b.bookmaker||"Autre",totalStake,b.profit,b.odds,b.status==="won");
 } else {
 // Split — distribute proportionally by stake
 const splitStakeTotal=splits.reduce((s,sp)=>s+sp.stake,0);
 const mainStake=totalStake-splitStakeTotal;
 // Main bookmaker share
 const ratio=mainStake/totalStake;
 add(b.bookmaker||"Autre",mainStake,b.profit*ratio,b.odds,b.status==="won");
 // Each split bookmaker share
 splits.forEach(sp=>{
 const spRatio=sp.stake/totalStake;
 add(sp.bookmaker||"Autre",sp.stake,b.profit*spRatio,b.odds,b.status==="won");
 });
 }
 });
 return bk;
 },[settledFiltered]);

 const bkStatsSorted=useMemo(()=>Object.entries(bkStats).sort((a,z)=>z[1].profit-a[1].profit),[bkStats]);

 // Per-bookmaker detailed stats: bkDrillStats[bk][game] = {count,won,profit,staked,oddsSum,over,under,live,hs,nonHs,ppEdges,oddsRanges}
 const bkDrillStats=useMemo(function(){
  const res={};
  const mk=(bk,game)=>{
   if(!res[bk])res[bk]={};
   if(!res[bk][game])res[bk][game]={count:0,won:0,profit:0,staked:0,oddsSum:0,
    over:{c:0,w:0,p:0},under:{c:0,w:0,p:0},
    live:{c:0,w:0,p:0},hs:{c:0,w:0,p:0},nonHs:{c:0,w:0,p:0},
    ppEdges:{},oddsRanges:{}};
   return res[bk][game];
  };
  const addOdds=(s,odds,profit,won)=>{
   const bucket=Math.floor((odds-1)/0.05);
   const lo=(1+bucket*0.05).toFixed(2);
   const hi=(1+(bucket+1)*0.05-0.01).toFixed(2);
   const key=lo+"-"+hi;
   if(!s.oddsRanges[key])s.oddsRanges[key]={label:key,lo:parseFloat(lo),count:0,won:0,profit:0};
   s.oddsRanges[key].count++;s.oddsRanges[key].profit+=profit;
   if(won)s.oddsRanges[key].won++;
  };
  const addBet=(bk,b,stake,profit)=>{
   const game=b.game||"Autre";
   const s=mk(bk,game);
   const won=b.status==="won";
   s.count++;s.won+=(won?1:0);s.profit+=profit;s.staked+=stake;s.oddsSum+=b.odds||0;
   if(b.overUnder==="Over")s.over.c++,s.over.p+=profit,won&&s.over.w++;
   else if(b.overUnder==="Under")s.under.c++,s.under.p+=profit,won&&s.under.w++;
   if(b.isLive)s.live.c++,s.live.p+=profit,won&&s.live.w++;
   if(b.isHeadshot)s.hs.c++,s.hs.p+=profit,won&&s.hs.w++;
   else s.nonHs.c++,s.nonHs.p+=profit,won&&s.nonHs.w++;
   if(b.ppEdge!=null&&b.ppEdge!==0){
    const ek=Math.round(Math.abs(b.ppEdge)*4)/4;
    if(!s.ppEdges[ek])s.ppEdges[ek]={edge:ek,count:0,won:0,profit:0};
    s.ppEdges[ek].count++;s.ppEdges[ek].profit+=profit;if(won)s.ppEdges[ek].won++;
   }
   if(b.odds&&b.odds>=1)addOdds(s,b.odds,profit,won);
  };
  settledFiltered.forEach(b=>{
   const splits=b.splits||[];
   const totalStake=b.stake;
   if(splits.length===0){addBet(b.bookmaker||"Autre",b,totalStake,b.profit);}
   else{
    const splitTotal=splits.reduce((s,sp)=>s+sp.stake,0);
    const mainStake=totalStake-splitTotal;
    const ratio=mainStake/totalStake;
    addBet(b.bookmaker||"Autre",b,mainStake,b.profit*ratio);
    splits.forEach(sp=>{const r=sp.stake/totalStake;addBet(sp.bookmaker||"Autre",b,sp.stake,b.profit*r);});
   }
  });
  return res;
 },[settledFiltered]);


 const oddsRangeStats=useMemo(function(){
 const step=0.05;
 const start=1.00;
 const ranges={};
 settledFiltered.forEach(b=>{
 const o=b.odds;if(!o||o<start)return;
 const bucket=Math.floor((o-start)/step);
 const lo=(start+bucket*step).toFixed(2);
 const hi=(start+(bucket+1)*step-0.01).toFixed(2);
 const key=lo+"-"+hi;
 if(!ranges[key])ranges[key]={label:key,lo:parseFloat(lo),hi:parseFloat(hi),count:0,won:0,profit:0,staked:0};
 ranges[key].count++;ranges[key].profit+=b.profit;ranges[key].staked+=b.stake;
 if(b.status==="won")ranges[key].won++;
 });
 return Object.values(ranges)
 .filter(r=>r.count>=1)
 .map(r=>({...r,wr:r.count>0?r.won/r.count*100:0,roi:r.staked>0?r.profit/r.staked*100:0}))
 .sort((a,b)=>a.lo-b.lo);
 },[settled]);


 const {currentStreak,streakType}=useMemo(function(){
 const resolved=[...bets].filter(b=>b.status!=="pending"&&b.datetime)
 .sort((a,b2)=>String(b2.datetime||"").localeCompare(String(a.datetime||"")));
 if(!resolved.length)return{currentStreak:0,streakType:"none"};
 const first=resolved[0].status;
 let count=0;
 for(const b of resolved){if(b.status===first)count++;else break;}
 return{currentStreak:count,streakType:first};
 },[bets]);




 // Stats par jeu regroupées 
 const perGameStats=useMemo(function(){
 // Single pass: group by game first to avoid 4x full-array scans
 const byGame={};
 settledFiltered.forEach(b=>{if(!byGame[b.game])byGame[b.game]=[];byGame[b.game].push(b);});
 const result={};
 ALL_GAMES.forEach(game=>{
 const gb=byGame[game]||[];
 if(gb.length===0){result[game]=null;return;}
 // Global - computed inline in single forEach
 let won=0,profit=0,staked=0,oddsSum=0;
 let liveCnt=0,liveWon=0,liveProfit=0,liveStaked=0;
 let nonLiveCnt=0,nonLiveWon=0,nonLiveProfit=0,nonLiveStaked=0;
 let hsCnt=0,hsWon=0,hsProfit=0,hsStaked=0;
 let hsNonCnt=0,hsNonWon=0,hsNonProfit=0,hsNonStaked=0;
 const isCS2=(game==="CS2");
 // Top joueurs
 const pm={};
 gb.forEach(b=>{
 if(!pm[b.player])pm[b.player]={player:b.player,count:0,won:0,profit:0,role:b.role||""};
 pm[b.player].count++;pm[b.player].profit+=b.profit;
 if(b.status==="won")pm[b.player].won++;
 });
 const allPSorted=Object.values(pm).filter(p=>p.count>=1).sort((a,b)=>b.profit-a.profit);
 const topP=allPSorted.slice(0,5);
 const worstP=allPSorted.slice(-5).reverse();
 // Positions
 const rm={};
 gb.forEach(b=>{
 const k=normalizeRole(b.role||"",b.game)||"Inconnu";
 if(!rm[k])rm[k]={role:k,count:0,won:0,profit:0,staked:0};
 rm[k].count++;rm[k].profit+=b.profit;rm[k].staked+=b.stake;
 if(b.status==="won")rm[k].won++;
 });
 const roles=Object.values(rm).sort((a,b)=>b.profit-a.profit);
 // Ligues
 const lm={};
 gb.forEach(b=>{
 const k=b.league||"";if(!k)return;
 if(!lm[k])lm[k]={league:k,count:0,won:0,profit:0,staked:0};
 lm[k].count++;lm[k].profit+=b.profit;lm[k].staked+=b.stake;
 if(b.status==="won")lm[k].won++;
 });
 const leagues=Object.values(lm).sort((a,b)=>b.profit-a.profit);
 // Maps par jeu
 const mm={};
 gb.forEach(b=>{
 const k=b.mapTag||"Sans tag";
 if(!mm[k])mm[k]={tag:k,count:0,won:0,profit:0,staked:0};
 mm[k].count++;mm[k].profit+=b.profit;mm[k].staked+=b.stake;
 if(b.status==="won")mm[k].won++;
 });
 const maps=Object.values(mm).sort((a,b)=>{
 const na=parseInt(a.tag.replace("Map ",""))||99;
 const nb=parseInt(b.tag.replace("Map ",""))||99;
 return na-nb;
 });
 // Tournois pour ce jeu
 const tm={};
 gb.forEach(b=>{
 var effT=b.tournament;
 if(!effT&&(b.game==="LoL"||b.game==="Valorant")){
 effT=b.league;
 if(!effT&&allPlayers){var pi=allPlayers[(b.player||"").toLowerCase().trim()];if(pi&&pi.league)effT=pi.league;}
 }
 const k=effT||"Hors tournoi";
 if(!tm[k])tm[k]={name:k,count:0,won:0,profit:0,staked:0};
 tm[k].count++;tm[k].profit+=b.profit;tm[k].staked+=b.stake;
 if(b.status==="won")tm[k].won++;
 });
 const tourneys=Object.values(tm).sort((a,b)=>b.profit-a.profit);
 // Kills & HS
 const kills={};const hs={};const duels={};
 gb.forEach(b=>{
 if(!b.description)return;
 // Fast string split instead of regex: "Over 14.5 Kills" -> parts[1]="14.5", parts[2]="Kills"
 const parts=b.description.split(" ");
 const isKills=parts.length>=3&&parts[2]==="Kills";
 const isHS=parts.length>=3&&parts[2]==="Headshots";
 if(isHS){const k=parts[1]+" HS";if(!hs[k])hs[k]={line:k,count:0,won:0,profit:0,staked:0};hs[k].count++;hs[k].profit+=b.profit;hs[k].staked+=b.stake;if(b.status==="won")hs[k].won++;}
 else if(isKills){const k=parts[1]+" K";if(!kills[k])kills[k]={line:k,count:0,won:0,profit:0,staked:0};kills[k].count++;kills[k].profit+=b.profit;kills[k].staked+=b.stake;if(b.status==="won")kills[k].won++;}
 // Duel bets
 const isDuel=b.description&&b.description.includes("Duel vs");
 if(isDuel){const dk="Duel";if(!duels[dk])duels[dk]={line:"Duel",count:0,won:0,profit:0,staked:0};duels[dk].count++;duels[dk].profit+=b.profit;duels[dk].staked+=b.stake;if(b.status==="won")duels[dk].won++;}
 // Live & HS inline
 if(b.isLive){liveCnt++;liveProfit+=b.profit;liveStaked+=b.stake;if(b.status==="won")liveWon++;}
 else{nonLiveCnt++;nonLiveProfit+=b.profit;nonLiveStaked+=b.stake;if(b.status==="won")nonLiveWon++;}
 if(isCS2&&b.isHeadshot){hsCnt++;hsProfit+=b.profit;hsStaked+=b.stake;if(b.status==="won")hsWon++;}
 if(isCS2&&!b.isHeadshot){hsNonCnt++;hsNonProfit+=b.profit;hsNonStaked+=b.stake;if(b.status==="won")hsNonWon++;}
 // Global totals
 if(b.status==="won")won++;
 profit+=b.profit;staked+=b.stake;oddsSum+=b.odds;
 });
 const killsArr=Object.values(kills).map(x=>({...x,wr:x.count>0?x.won/x.count*100:0})).sort((a,b)=>b.profit-a.profit).slice(0,10);
 const duelsArr=Object.values(duels).map(x=>({...x,wr:x.count>0?x.won/x.count*100:0}));
 const hsArr=Object.values(hs).map(x=>({...x,wr:x.count>0?x.won/x.count*100:0})).sort((a,b)=>b.profit-a.profit).slice(0,10);
 // Live & HS counted inline above during main forEach loop
 const liveS=liveCnt>0?{count:liveCnt,won:liveWon,profit:liveProfit,staked:liveStaked,wr:liveWon/liveCnt*100,roi:liveStaked>0?liveProfit/liveStaked*100:0}:null;
 const nonLiveS=nonLiveCnt>0?{count:nonLiveCnt,won:nonLiveWon,profit:nonLiveProfit,staked:nonLiveStaked,wr:nonLiveWon/nonLiveCnt*100,roi:nonLiveStaked>0?nonLiveProfit/nonLiveStaked*100:0}:null;
 const hsS=hsCnt>0?{count:hsCnt,won:hsWon,profit:hsProfit,staked:hsStaked,wr:hsWon/hsCnt*100,roi:hsStaked>0?hsProfit/hsStaked*100:0}:null;
 const hsNonS=hsNonCnt>0?{count:hsNonCnt,won:hsNonWon,profit:hsNonProfit,staked:hsNonStaked,wr:hsNonWon/hsNonCnt*100,roi:hsNonStaked>0?hsNonProfit/hsNonStaked*100:0}:null;
 // Over/Under stats
 let overCnt=0,overWon=0,overProfit=0,overStaked=0;
 let underCnt=0,underWon=0,underProfit=0,underStaked=0;
 gb.forEach(b=>{
 if(b.overUnder==="Over"){overCnt++;overProfit+=b.profit;overStaked+=b.stake;if(b.status==="won")overWon++;}
 else if(b.overUnder==="Under"){underCnt++;underProfit+=b.profit;underStaked+=b.stake;if(b.status==="won")underWon++;}
 });
 const overS=overCnt>0?{count:overCnt,won:overWon,profit:overProfit,staked:overStaked,wr:overWon/overCnt*100,roi:overStaked>0?overProfit/overStaked*100:0}:null;
 const underS=underCnt>0?{count:underCnt,won:underWon,profit:underProfit,staked:underStaked,wr:underWon/underCnt*100,roi:underStaked>0?underProfit/underStaked*100:0}:null;
 result[game]={count:gb.length,won,profit,staked,oddsSum,wr:gb.length>0?won/gb.length*100:0,roi:staked>0?profit/staked*100:0,avgOdds:gb.length>0?oddsSum/gb.length:0,topP,worstP,allPlayers:allPSorted,roles,leagues,maps,tourneys,kills:killsArr,hs:hsArr,liveS,nonLiveS,hsS,hsNonS,duels:duelsArr,overS,underS};
 });
 return result;
 },[settledFiltered,allPlayers]);

 const rosterHierarchy=useMemo(()=>{
  const GAMES_R=["CS2","LoL","Dota2","Valorant"];
  const h={};GAMES_R.forEach(g=>{h[g]={};});
  Object.values(players).forEach(p=>{
   if(!p||!p.game||!p.team)return; // Skip free agents — shown in FA club
   const g=p.game;if(!h[g])h[g]={};
   const league=p.league||"(Sans ligue)";
   if(!h[g][league])h[g][league]={};
   const team=p.team;
   if(!h[g][league][team])h[g][league][team]=[];
   h[g][league][team].push(p);
  });
  // Add custom clubs (may have 0 players)
  Object.entries(customClubs||{}).forEach(([game,clubs])=>{
   if(!h[game])h[game]={};
   clubs.forEach(cl=>{
    const league=cl.league||"(Sans ligue)";
    if(!h[game][league])h[game][league]={};
    if(!h[game][league][cl.name])h[game][league][cl.name]=[];
    // Save logo if provided
    if(cl.logoUrl&&!teamLogos[cl.name+"__"+game]){
     // logo will be in teamLogos already from CreateSection
    }
   });
  });
  return h;
 },[players]);

  const {bestMonth,worstMonth}=useMemo(function(){
 const byMo={};
 settledFiltered.forEach(b=>{
 const mo=b.datetime?String(b.datetime).slice(0,7):"?";
 if(mo==="?")return;
 byMo[mo]=(byMo[mo]||0)+b.profit;
 });
 const entries=Object.entries(byMo);
 if(!entries.length)return{bestMonth:null,worstMonth:null};
 entries.sort((a,b)=>b[1]-a[1]);
 return{bestMonth:entries[0],worstMonth:entries[entries.length-1]};
 },[settled]);

 const exportCSV=useCallback(function(){
 const hdr="Date,Joueur,Jeu,Equipe,Role,Over/Under,Description,Cote,Mise,Bookmaker,Statut,Profit,Live,Headshot";
 const sorted=[...bets].sort((a,b2)=>(String(b2.datetime||"")).localeCompare(String(a.datetime||"")));
 const rows=sorted.map(b=>[
 b.datetime?String(b.datetime).slice(0,16):"",b.player,b.game,b.team||"",b.role||"",
 b.overUnder,b.description||"",b.odds,b.stake,b.bookmaker||"",b.status,(b.profit||0).toFixed(2),
 b.isLive?"Oui":"Non",b.isHeadshot?"Oui":"Non"
 ].map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(","));
 const csv=[hdr,...rows].join("\n");
 const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");
 a.href=url;a.download="emeieks_bankroll_"+new Date().toISOString().slice(0,10)+".csv";
 a.click();URL.revokeObjectURL(url);
 showToast("CSV exporté ");
 },[bets,showToast]);

 const exportJSON=useCallback(function(){
 const data={version:7,exportedAt:new Date().toISOString(),bankroll,bets,bookmakers};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");
 a.href=url;a.download="emeieks_backup_"+new Date().toISOString().slice(0,10)+".json";
 a.click();URL.revokeObjectURL(url);
 showToast("Sauvegarde JSON ");
 },[bets,bankroll,bookmakers,showToast]);

 const importJSON=useCallback(function(file){
 const reader=new FileReader();
 reader.onload=e=>{
 try{
 const data=JSON.parse(e.target.result);
 if(data.bets){setBets(data.bets);showToast(data.bets.length+" paris importés ");}
 if(data.bankroll)setBankroll(data.bankroll);
 if(data.bookmakers)setBookmakers(data.bookmakers);
 }catch(e){showToast("Fichier invalide ","#EF4444");}
 };
 reader.readAsText(file);
 },[showToast]);

 const {dailyProfit,dailyPending,dailyCount}=useMemo(function(){
 const dp={},dpd={},dc={};
 // Utiliser fGames pour être cohérent avec MesParisView
 const gameFilter=calGames.length>0?calGames:fGames;
 bets.forEach(b=>{
 if(gameFilter.length>0&&!gameFilter.includes(b.game))return;
 const dk=toDateKey(b.datetime);
 if(!dk)return;
 if(b.status!=="pending"){
 dp[dk]=(dp[dk]||0)+(b.profit||0);
 dc[dk]=(dc[dk]||0)+1;
 }
 else{dpd[dk]=(dpd[dk]||0)+1;}
 });
 return{dailyProfit:dp,dailyPending:dpd,dailyCount:dc};
 },[bets,calGames,fGames]);

 const monthProfit=useMemo(function(){
 const mo=String(calMonth+1).padStart(2,"0");
 return Object.entries(dailyProfit)
 .filter(([d])=>d.startsWith(calYear+"-"+mo))
 .reduce((s,[,v])=>s+v,0);
 },[dailyProfit,calYear,calMonth]);

 const filteredBets=useMemo(function(){
 // Fast path: no active filters
 const noFilters=fGames.length===0&&fBKs.length===0&&!fPlayer&&fStatus==="All"&&fOverUnder==="All"&&!fLive&&!fHeadshot&&!fDuel&&!fMinOdds&&!fMaxOdds&&!fMinStake&&!fMaxStake&&fMapFilter==="all"&&fRole==="All"&&fLeague==="All"&&fTourneys.size===0&&!fDateFrom&&!fDateTo;
 if(noFilters)return bets;
 return bets.filter(b=>{
 if(fGames.length>0&&!fGames.includes(b.game))return false;
 if(fBKs.length>0&&!fBKs.includes(b.bookmaker||"Autre")&&!(b.splits||[]).some(sp=>fBKs.includes(sp.bookmaker)))return false;
 if(fPlayer&&!b.player.toLowerCase().includes(fPlayer.toLowerCase()))return false;
 if(fStatus!=="All"&&b.status!==fStatus)return false;
 if(fOverUnder!=="All"&&b.overUnder!==fOverUnder)return false;
 if(fLive&&!b.isLive)return false;
 if(fHeadshot&&!b.isHeadshot)return false;
 if(fDuel&&!(b.description&&b.description.includes("Duel vs")))return false;
 if(fDateFrom&&b.datetime&&b.datetime<fDateFrom)return false;
 if(fDateTo&&b.datetime&&b.datetime>fDateTo+"T23:59:59")return false;
 if(fMinOdds&&b.odds<parseFloat(fMinOdds))return false;
 if(fMaxOdds&&b.odds>parseFloat(fMaxOdds))return false;
 if(fMinStake&&b.stake<parseFloat(fMinStake))return false;
 if(fMaxStake&&b.stake>parseFloat(fMaxStake))return false;
 if(fMapFilter&&fMapFilter!=="all"&&(b.mapTag||"none")!==fMapFilter)return false;
 if(fRole!=="All"&&normalizeRole(b.role||"")!==normalizeRole(fRole,b.game))return false;
 if(fLeague!=="All"&&b.league!==fLeague)return false;
 if(fTourneys.size>0&&!fTourneys.has(effectiveTournament(b,allPlayers)||"Hors tournoi"))return false;
 return true;
 }).sort((a,b2)=>{
 if(a.status==="pending"&&b2.status!=="pending")return -1;
 if(b2.status==="pending"&&a.status!=="pending")return 1;
 // Sort by datetime (when bet was placed), not updatedAt
 return (String(b2.datetime||"")).localeCompare(String(a.datetime||""));
 });
 },[bets,fGames,fBKs,fPlayer,fStatus,fOverUnder,fLive,fHeadshot,fDuel,fMinOdds,fMaxOdds,fMinStake,fMaxStake,fMapFilter,fRole,fLeague,fTourneys,fDateFrom,fDateTo]);

 const calFilteredBets=useMemo(function(){const gf=calGames.length>0?calGames:fGames;return gf.length>0?bets.filter(b=>gf.includes(b.game)):bets;},[bets,calGames,fGames]);

 const {allSortedBets,byDay,byMonth,monthKeys}=useMemo(function(){
 const src=isTestActive?betsForDisplay:bets;
 const now=Date.now();
 function mapNum(b){const m=b.mapTag?parseInt(b.mapTag.replace(/\D/g,""))||1:1;return m;}
 const sorted=[...src].sort((a,b2)=>{
 // Pending toujours en premier
 if(a.status==="pending"&&b2.status!=="pending")return -1;
 if(b2.status==="pending"&&a.status!=="pending")return 1;
 // Pending entre eux: map d'abord (Map 2 en haut, Map 1 en bas), puis date desc
 if(a.status==="pending"&&b2.status==="pending"){
 const mapCmp=mapNum(b2)-mapNum(a); // Map 2 avant Map 1
 if(mapCmp!==0)return mapCmp;
 return (String(b2.datetime||"")).localeCompare(String(a.datetime||"")); // à map égale, plus récent en haut
 }
 // Settled entre eux: trier par settledAt desc
 const sa=a.settledAt||0;
 const sb=b2.settledAt||0;
 if(sa!==sb)return sb-sa;
 return (String(b2.datetime||"")).localeCompare(String(a.datetime||""));
 });
 const bd={};
 sorted.forEach(b=>{
 const dk=toDateKey(b.datetime)||"?";
 if(!bd[dk])bd[dk]=[];
 bd[dk].push(b);
 });
 const dk=Object.keys(bd).sort((a,z)=>z.localeCompare(a));
 const bm={};
 dk.forEach(d=>{
 const mk=d.slice(0,7);
 if(!bm[mk])bm[mk]=[];
 bm[mk].push(d);
 });
 return{allSortedBets:sorted,byDay:bd,dayKeys:dk,byMonth:bm,monthKeys:Object.keys(bm).sort((a,z)=>z.localeCompare(a))};
 },[bets,betsForDisplay,isTestActive]);

 // Auto-collapse months older than 2 months to avoid rendering thousands of BetRows
 useEffect(()=>{
  if(!monthKeys||monthKeys.length<=2)return;
  const now=new Date();
  const keep=new Set();
  for(let i=0;i<2;i++){const d=new Date(now.getFullYear(),now.getMonth()-i,1);keep.add(d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"));}
  setCollapsedMonths(prev=>{
   const next=new Set(prev);
   monthKeys.forEach(mk=>{if(!keep.has(mk))next.add(mk);});
   return next.size===prev.size&&[...next].every(v=>prev.has(v))?prev:next;
  });
 },[monthKeys]);

 const homeSettled=useMemo(function(){
 let s=isTestActive?filteredByTest(settled):settled;
 // Period filter
 if(homePeriod){
 const cutoff=new Date();cutoff.setDate(cutoff.getDate()-homePeriod);
 const cutStr=cutoff.toISOString().slice(0,10);
 s=s.filter(b=>b.datetime&&String(b.datetime).slice(0,10)>=cutStr);
 }
 // Chart filters
 const {games,overUnder,live,bookmakers}=homeChartFilters;
 if(games.length>0)s=s.filter(b=>games.includes(b.game));
 if(overUnder!=="All")s=s.filter(b=>b.overUnder===overUnder);
 if(live==="Live")s=s.filter(b=>b.isLive);
 if(live==="Non-live")s=s.filter(b=>!b.isLive);
 if(live==="Headshot")s=s.filter(b=>b.isHeadshot);
 if(live==="Duel")s=s.filter(b=>b.description&&b.description.toLowerCase().includes("duel"));
 if(bookmakers.length>0)s=s.filter(b=>bookmakers.includes(b.bookmaker)||(b.splits||[]).some(sp=>bookmakers.includes(sp.bookmaker)));
 if(homeChartFilters.dateFrom)s=s.filter(b=>b.datetime&&String(b.datetime).slice(0,10)>=homeChartFilters.dateFrom);
 if(homeChartFilters.dateTo)s=s.filter(b=>b.datetime&&String(b.datetime).slice(0,10)<=homeChartFilters.dateTo);
 return s;
 },[settled,homePeriod,homeChartFilters,isTestActive,filteredByTest]);

 // betsForDisplay: bets filtrés par testFilter pour Mes Paris
 const totalProfit=useMemo(()=>homeSettled.reduce((s,b)=>s+(b.profit||0),0),[homeSettled]);
 const totalStaked=useMemo(()=>homeSettled.reduce((s,b)=>s+(b.stake||0),0),[homeSettled]);
 const roi=useMemo(()=>totalStaked>0?(totalProfit/totalStaked)*100:0,[totalProfit,totalStaked]);
 const progression=useMemo(()=>bankroll>0?(totalProfit/bankroll)*100:0,[totalProfit,bankroll]);
 // Compound bankroll system: tier = floor(liveBK/2500)*2500 (min 5000), 1u = 1% of tier 
 const pendingCount=useMemo(()=>bets.filter(b=>b.status==="pending").length,[bets]);
 const settledCount=useMemo(()=>bets.filter(b=>b.status!=="pending").length,[bets]);
 const liveBankroll=useMemo(()=>bankroll+totalProfit,[bankroll,totalProfit]);
 const bkTier=useMemo(()=>manualTier||Math.max(5000,Math.floor(liveBankroll/2500)*2500),[liveBankroll,manualTier]);
 const unitValue=useMemo(()=>bkTier*0.01,[bkTier]);
 const chartPoints=useMemo(function(){
 const pts=[{v:0,dt:""}];
 const sorted=[...settled].sort((a,b2)=>String(a.datetime||"").localeCompare(String(b2.datetime||"")));
 let running=0;
 sorted.forEach(b=>{running+=b.profit;pts.push({v:running,dt:toDateKey(b.datetime)});});
 return pts;
 },[settled]);
 const chartPointsFiltered=useMemo(function(){
 // Rebuild chart from homeSettled (already filtered by period + filters)
 const sorted=[...homeSettled].sort((a,b2)=>String(a.datetime||"").localeCompare(String(b2.datetime||"")));
 if(!sorted.length)return [{v:0,dt:""}];
 const pts=[{v:0,dt:""}];
 let running=0;
 sorted.forEach(b=>{running+=b.profit;pts.push({v:running,dt:toDateKey(b.datetime)});});
 return pts;
 },[homeSettled]);

 const formGame=useMemo(function(){
 if(form.autoInfo&&form.autoInfo.game)return form.autoInfo.game;
 return "LoL";
 },[form.autoInfo]);

 function addBet(){
 if(!form.player||!form.odds||!form.stake||!form.bookmaker||!form.description||!form.mapTag)return;
 const info=findPlayer(form.player)||{game:"?",league:"?",role:"?",team:"?"};
 // Conversion devise si le casino a une devise différente de USD
 // CAD conversion removed
 
 const stake=parseFloat(form.stake);
 const odds=parseFloat(form.odds);
 const desc=form.description?form.overUnder+" "+form.description:form.overUnder;
 const tname=(()=>{const t=activeTourneys[info.game];return(t&&(!t.end||new Date(t.end)>=new Date()))?t.name:"";})();
 if(editingBet){
 // Mode édition — remplace le pari existant avec tous les champs
 const newDatetime=form.datetime||nowDT();
 const ppFinalLineEdit=form.ppDescription||(()=>{
 const bk=parseFloat(form.description);
 if(!bk||isNaN(bk)||!form.overUnder||!form.ppMapType)return null;
 const edge=form.overUnder==="Over"?2.0:2.5;
 if(form.ppMapType==="Map 1+2") return(Math.round((bk*2-edge)*2)/2).toFixed(1)+(form.isHeadshot?" Headshots":" Kills");
 if(form.ppMapType==="Map 3") return(Math.round((bk-1.5)*2)/2).toFixed(1)+(form.isHeadshot?" Headshots":" Kills");
 return null;
 })();
 const ppEdgeEdit=(()=>{
 if(!ppFinalLineEdit||!form.description)return null;
 const bk=parseFloat(form.description);
 const pp=parseFloat(ppFinalLineEdit);
 if(isNaN(bk)||isNaN(pp))return null;
 const ppPerMapE=form.ppMapType==="Map 1+2"?pp/2:form.ppMapType==="Map 1+2+3"?pp/3:pp;
 return parseFloat((form.overUnder==="Over"?ppPerMapE-bk:bk-ppPerMapE).toFixed(2));
 })();
 const updatedBet={
 ...editingBet,
 player:form.player,description:desc,overUnder:form.overUnder,
 odds,stake,bookmaker:form.bookmaker,
 game:info.game,league:info.league,role:info.role,team:info.team,
 datetime:newDatetime,isHeadshot:form.isHeadshot||false,isLive:form.isLive||false,
 mapTag:form.mapTag||"",
 profit:calcProfit(editingBet.status,stake,odds),
 tournament:form.tournament||tname,
 settledAt:editingBet.status!=="pending"?new Date(newDatetime).getTime():(editingBet.settledAt||null),
 ppMapType:form.ppMapType||null,
 ppLine:ppFinalLineEdit||null,
 ppEdge:ppEdgeEdit,
 };
 const editedBK=form.bookmaker;
 setBets(b=>{
 const updated=b.map(bet=>bet.id===editingBet.id?updatedBet:bet);
 // Override persistant pour survivre au pull Supabase
 try{
 const ovRaw=localStorage.getItem("v7_overrides");
 const ov=ovRaw?JSON.parse(ovRaw):{};
 ov[updatedBet.id]={datetime:updatedBet.datetime,settledAt:updatedBet.settledAt,bookmaker:updatedBet.bookmaker};
 localStorage.setItem("v7_overrides",JSON.stringify(ov));
 }catch(e){}
 setTimeout(()=>supaPushBets([updatedBet]).catch(function(){}),0);
 return updated;
 });
 setEditingBet(null);
 setForm(f=>({...EMPTY_FORM,datetime:nowDT(),bookmaker:stickyBK?f.bookmaker:"",mapTag:f.mapLocked?f.mapTag:"Map 1",mapLocked:f.mapLocked,status:lockedStatus||"pending"}));
 showToast("Pari modifié ");
 if(editedBK){setFBKs(prev=>prev.includes(editedBK)?prev:[...prev,editedBK]);}
 setView("mesparis");
 return;
 }
 // Calcul edge PP
 const ppFinalLine=form.ppDescription||(()=>{
 const bk=parseFloat(form.description);
 if(!bk||isNaN(bk)||!form.overUnder||!form.ppMapType)return null;
 const edge=form.overUnder==="Over"?2.0:2.5;
 if(form.ppMapType==="Map 1+2") return(Math.round((bk*2-edge)*2)/2).toFixed(1)+(form.isHeadshot?" Headshots":" Kills");
 if(form.ppMapType==="Map 3") return(Math.round((bk-1.5)*2)/2).toFixed(1)+(form.isHeadshot?" Headshots":" Kills");
 if(form.ppMapType==="Map 1+2+3") return(Math.round((bk*3-(form.overUnder==="Over"?3.0:4.0))*2)/2).toFixed(1)+(form.isHeadshot?" Headshots":" Kills");
 return null;
 })();
 const ppEdge=(()=>{
 if(!ppFinalLine||!form.description)return null;
 const bk=parseFloat(form.description);
 const pp=parseFloat(ppFinalLine);
 if(isNaN(bk)||isNaN(pp))return null;
 const ppPerMap=form.ppMapType==="Map 1+2"?pp/2:form.ppMapType==="Map 1+2+3"?pp/3:pp;
 // Over: edge = ppPerMap - bk (positive when PP line > bk line)
 // Under: edge = bk - ppPerMap (positive when bk line > PP line)
 return parseFloat((form.overUnder==="Over"?ppPerMap-bk:bk-ppPerMap).toFixed(2));
 return null;
 })();
 const newBet={
 id:Date.now(),updatedAt:Date.now(),player:form.player,description:desc,overUnder:form.overUnder,
 odds,stake,bookmaker:form.bookmaker,status:form.status,
 game:info.game,league:info.league,role:info.role,team:info.team,
 datetime:form.datetime||nowDT(),isHeadshot:form.isHeadshot||false,isLive:form.isLive||false,
 mapTag:form.mapTag||"",profit:calcProfit(form.status,stake,odds),
 tournament:tname,
 ppMapType:form.ppMapType||null,
 ppLine:ppFinalLine||null,
 ppEdge:ppEdge,
 };
 setBets(b=>{
 const updated=[newBet,...b];
 // Write to localStorage immediately to prevent stale reads
 return updated;
 });
 // Mark push time to block auto-pull for 15s
 lastPushRef.current=Date.now();
 // Push immédiat vers Supabase (pas d'attente du debounce)
 supaPushBets([newBet]).catch(function(){});
 const addedBK=form.bookmaker;
 setForm(f=>({...EMPTY_FORM,datetime:nowDT(),bookmaker:stickyBK?f.bookmaker:"",mapTag:f.mapLocked?f.mapTag:"Map 1",mapLocked:f.mapLocked,status:lockedStatus||"pending"}));
 showToast("Pari enregistré ");
 showBetConfirm(form.status);
 // Filtrer automatiquement par le bookmaker du pari ajouté
 if(addedBK){setFBKs(prev=>prev.includes(addedBK)?prev:[...prev,addedBK]);}
 setView("mesparis");
 }

 function addSession(){
 const info=findPlayer(form.player)||{game:"?",league:"?",role:"?",team:"?"};
 const desc=form.description?form.overUnder+" "+form.description:form.overUnder;
 const enabled=sessionMaps.filter(m=>m.enabled&&m.odds);
 if(!form.player||enabled.length===0)return;
 const now=Date.now();
 const tname=(()=>{const t=activeTourneys[info.game];return(t&&(!t.end||new Date(t.end)>=new Date()))?t.name:"";})();
 const newBets=enabled.map((m,i)=>({
 id:now+i,player:form.player,description:desc,overUnder:form.overUnder,
 odds:parseFloat(m.odds),stake:parseFloat(m.stake||form.stake||0),
 bookmaker:form.bookmaker,status:m.status,
 game:info.game,league:info.league,role:info.role,team:info.team,
 datetime:form.datetime||nowDT(),isHeadshot:form.isHeadshot||false,isLive:form.isLive||false,
 mapTag:"Map "+(i+1),
 profit:calcProfit(m.status,parseFloat(m.stake||form.stake||0),parseFloat(m.odds)),
 tournament:tname,
 ppMapType:"Map "+(i+1),
 ppLine:form.ppDescription||null,
 ppEdge:form.ppEdge||null,
 updatedAt:now+i,
 }));
 const sessionBK=form.bookmaker;
 setBets(b=>{
 const updated=[...newBets,...b];
 return updated;
 });
 lastPushRef.current=Date.now();
 // Push immédiat vers Supabase
 supaPushBets(newBets).catch(function(){});
 setForm(f=>({...EMPTY_FORM,datetime:nowDT(),bookmaker:stickyBK?f.bookmaker:"",mapTag:f.mapLocked?f.mapTag:"Map 1",mapLocked:f.mapLocked,status:lockedStatus||"pending"}));
 setSessionMaps([{...EMPTY_MAP_ROW},{...EMPTY_MAP_ROW},{...EMPTY_MAP_ROW}]);
 showToast(newBets.length+" paris enregistres");
 if(sessionBK){setFBKs(prev=>prev.includes(sessionBK)?prev:[...prev,sessionBK]);}
 setView("mesparis");
 }

 function addDuel(){
 if(!duelForm.player1||!duelForm.player2||!duelForm.odds||!duelForm.stake||!duelForm.bookmaker||!duelForm.winner)return;
 const winner=duelForm.winner; // "player1" or "player2"
 const winnerName=winner==="player1"?duelForm.player1:duelForm.player2;
 const loserName=winner==="player1"?duelForm.player2:duelForm.player1;
 const infoW=findPlayer(winnerName)||{game:"CS2",league:"",role:"",team:""};
 const now=Date.now();
 const stake=parseFloat(duelForm.stake);
 const odds=parseFloat(duelForm.odds);
 const tname=(()=>{const t=activeTourneys[infoW.game];return(t&&(!t.end||new Date(t.end)>=new Date()))?t.name:"";})();
 const bet={
 id:now,player:winnerName,
 description:"Duel vs "+loserName+" — Plus de kills",
 overUnder:"Over",odds,stake,
 bookmaker:duelForm.bookmaker,status:"pending",
 game:infoW.game,league:infoW.league,role:infoW.role,team:infoW.team,
 datetime:duelForm.datetime||nowDT(),isHeadshot:false,isLive:duelForm.isLive,
 mapTag:duelForm.mapTag,profit:0,tournament:tname,
 };
 const duelBK=duelForm.bookmaker;
 setBets(b=>[bet,...b]);
 supaPushBets([bet]).catch(function(){});
 setDuelForm({player1:"",player2:"",odds:"",stake:"",winner:"",bookmaker:duelForm.bookmaker,mapTag:"Map 1",isLive:false,datetime:"",ppMapType:"",ppLine_player1:"",ppLine_player2:""});
 showToast("Duel enregistré ");
 if(duelBK){setFBKs(prev=>prev.includes(duelBK)?prev:[...prev,duelBK]);}
 setView("mesparis");
 }

 const updateStatus=useCallback(function(id,status){
 const now=Date.now();
 let betToSync=null;
 setBets(b=>{
 const updated=b.map(bet=>{
 if(bet.id!==id)return bet;
 const newBet={...bet,status,profit:calcProfit(status,bet.stake,bet.odds),settledAt:status!=="pending"?now:null,updatedAt:now};
 betToSync=newBet;
 return newBet;
 });
 return updated;
 });
 setTimeout(()=>{if(betToSync)supaPushBets([betToSync]).catch(function(){});},0);
 if(status!=="pending"){setSettledOrder(prev=>({...prev,[id]:now}));}
 },[]);

 const openEdit=useCallback(function(b){
 setEditingBet({...b});
 setForm(f=>({
 ...f,
 player:b.player||"",
 overUnder:b.overUnder||"Over",
 description:(b.description||"").replace(/^(Over|Under)\s/,""),
 odds:String(b.odds||""),
 stake:String(b.stake||""),
 bookmaker:b.bookmaker||"",
 datetime:b.datetime||f.datetime,
 isHeadshot:b.isHeadshot||false,
 isLive:b.isLive||false,
 mapTag:b.mapTag||"Map 1",
 tournament:b.tournament||"",
 autoInfo:findPlayer(b.player)||null,
 ppMapType:b.ppMapType||"",
 ppDescription:b.ppLine||"",
 }));
 setView("add");
 },[findPlayer]);

 const deleteBet=useCallback(function(id){
 let found=null;
 setBets(prev=>{
 found=prev.find(b=>b.id===id)||null;
 return prev.filter(bet=>bet.id!==id);
 });
 setTimeout(()=>{
 if(found)setDeletedBets(p=>[{...found,deletedAt:Date.now()},...p].slice(0,50));
 supaDeleteOneBet(id).catch(function(){});
 },0);
 },[]);

 const duplicateBet=useCallback(function(bet){
 const newBet={...bet,id:Date.now(),datetime:nowDT(),status:"pending",profit:0,mapTag:""};
 setBets(b=>[newBet,...b]);
 showToast("Pari duplique");
 },[showToast]);

 const splitBet=useCallback(function(bet){
 setSplitForm({bookmaker:"",stake:"",odds:String(bet.odds||"")});
 setSplitModal(bet);
 },[]);







 async function savePlayer(){
 if(!pform.name.trim())return;
 const rawName=pform.name.trim();
 const data={game:pform.game,league:pform.league,role:pform.role,team:pform.team,name:rawName};
 try{
  // Upload photo permanently to Supabase Storage if URL is external
  if(data.photo_url&&data.photo_url.startsWith('http')&&!data.photo_url.includes('/storage/v1/object/public/')){
   try{
    const permUrl=await supaUploadPhotoFromUrl(data.photo_url,'players');
    data.photo_url=permUrl;
    data.avatar_url=permUrl;
   }catch(e){console.warn('Photo upload failed:',e);}
  }
  const result=await supaUpsertPlayer(data);
  const id=result&&result.id;
  setPlayers(p=>({...p,[rawName]:{...data,id:id||undefined}}));
  showToast(pform.name+" ajouté ","#22C55E");
 }catch(e){
  showToast("Erreur: "+e.message,"#EF4444");
  return;
 }
 setPform({name:"",game:"LoL",league:"",role:"",team:""});
 setModalPlayer(false);
 }
 function saveBookmaker(){
 if(!newBK.trim())return;
 setBookmakers(b=>[...b,newBK.trim()]);
 if(newBKPhoto){
 const updated={...bkPhotos,[newBK.trim()]:newBKPhoto};
 setBkPhotos(updated);
 
 supaUpdateMediaRow("__BK_PHOTOS__",updated).catch(()=>{});
 }
 setNewBK("");setNewBKPhoto("");setModalBK(false);
 showToast(newBK+" ajouté");
 }

 function toggleArr(arr,setter,val){
 setter(a=>a.includes(val)?a.filter(x=>x!==val):[...a,val]);
 }

 // SVG icons for nav 


 const NAV=[
 {id:"home",label:"Accueil"},
 {id:"mesparis",label:"Mes Paris"},
 {id:"add",label:"Pari"},
 {id:"statistiques",label:"Stats"},
 {id:"players",label:"Suivi"},
 ];

 
 const customEntries=useMemo(()=>Object.entries(players),[players]);
 const customCount=useMemo(()=>Object.keys(players).length,[players]);
 const todayKey=useMemo(()=>toDateKey(nowDT()),[]);

 // Rafraîchir datetime Montréal à chaque ouverture du formulaire d'ajout 
 useEffect(()=>{
 if(view==="add"){
 setForm(f=>({...f,datetime:nowDT()}));
 }
 },[view]);


 return(
 <div style={{minHeight:"100vh",background:"#0B1220",fontFamily:"Inter,system-ui,-apple-system,sans-serif",color:"#E5E7EB",paddingBottom:84}}>
 
 <style>{`
 @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
 *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
 input,textarea,select{background:transparent!important;-webkit-appearance:none;appearance:none;color-scheme:dark;}
 .bet-row-tap:active{background:rgba(255,255,255,.02)!important;transition:background .1s;}
 button:active{opacity:.8;transform:scale(.98);transition:all .1s;}
 input:-webkit-autofill,input:-webkit-autofill:hover,input:-webkit-autofill:focus{-webkit-box-shadow:0 0 0 1000px rgba(8,14,28,.9) inset!important;-webkit-text-fill-color:#E5E7EB!important;}
 body{background:#0B1220;margin:0;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}
 .card{background:#111827;border:1px solid #1F2937;border-radius:14px;padding:14px;transition:border-color .2s ease;}
 .tag{display:inline-flex;align-items:center;padding:2px 7px;border-radius:5px;font-size:11px;font-weight:600;}
 .ifield{width:100%;background:#111827;border:1px solid #1F2937;border-radius:10px;padding:11px 14px;color:#E5E7EB;font-size:14px;font-family:'Inter',sans-serif;outline:none;transition:border-color .2s ease,box-shadow .2s ease;}
 .ifield:focus{border-color:#7C3AED;box-shadow:0 0 0 3px rgba(124,58,237,0.12);}
 .add-card{background:#111827;border:1px solid #1F2937;border-radius:14px;padding:8px 12px;margin-bottom:8px;transition:border-color .2s ease;}
 .add-label{font-size:11px;color:#9CA3AF;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;display:block;font-weight:600;}
 .add-ifield{width:100%;background:rgba(255,255,255,0.04);border:1.5px solid #1F2937;border-radius:12px;padding:12px 16px;color:#E5E7EB;font-size:15px;font-family:'Inter',sans-serif;outline:none;transition:border-color .25s ease,box-shadow .25s ease;}
 .add-ifield:focus{border-color:rgba(124,58,237,0.6);box-shadow:0 0 0 3px rgba(124,58,237,0.12);}
 .ou-btn{padding:13px 0;border-radius:12px;border:1.5px solid #1F2937;background:rgba(255,255,255,0.03);color:#9CA3AF;font-size:14px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:all .25s ease;will-change:border-color,background,color,box-shadow;}
 .ou-btn:active{transform:scale(.97);}
 .ou-btn.over.on{border-color:#00E676;background:rgba(34,197,94,0.1);color:#00E676;box-shadow:0 0 16px rgba(74,222,128,0.15);}
 .ou-btn.under.on{border-color:#EF4444;background:rgba(239,68,68,0.1);color:#EF4444;box-shadow:0 0 16px rgba(239,68,68,0.12);}
 .navitem{display:flex;flex-direction:column;align-items:center;gap:3px;background:none;border:none;cursor:pointer;padding:8px 8px 4px;border-radius:12px;transition:color .2s ease,transform .15s ease;font-family:'Inter',sans-serif;color:#4a5a6e;min-width:56px;will-change:transform,color;}
 .navitem:active{transform:scale(.90);}
 .navitem.on{color:#c4b5fd;}
 .navitem.on svg{filter:drop-shadow(0 0 8px rgba(167,139,250,0.55));}
 .navitem .lbl{font-size:9px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;transition:color .2s ease;}
 .stat-bloc{background:#111827;border:1px solid #1F2937;border-radius:14px;overflow:hidden;}
 .stat-row{display:flex;justify-content:space-between;align-items:center;padding:12px 14px;border-bottom:1px solid #1F2937;transition:background .15s ease;}
 .stat-row:last-child{border-bottom:none;}
 .fchip{padding:7px 14px;border-radius:20px;border:1.5px solid #1F2937;background:#111827;color:#9CA3AF;font-size:12px;font-weight:600;cursor:pointer;font-family:'Inter',sans-serif;transition:border-color .2s ease,color .2s ease,background .2s ease;will-change:border-color,color,background;}
 .fchip:active{transform:scale(.95);}
 .fchip.on{border-color:#7C3AED;color:#A78BFA;background:rgba(124,58,237,0.1);}
 .editbtn{background:rgba(255,255,255,0.04);border:1px solid #1F2937;border-radius:8px;padding:5px 9px;color:#9CA3AF;cursor:pointer;font-family:'Inter',sans-serif;font-size:11px;font-weight:500;transition:all .2s ease;}
 .editbtn:active{transform:scale(.93);opacity:.75;}
 .bkchip{padding:9px 12px;border-radius:10px;border:2px solid #1F2937;cursor:pointer;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;color:#9CA3AF;transition:all .2s ease;}
 .bkchip:active{transform:scale(.96);}
 .bkchip.on{border-color:#7C3AED;color:#A78BFA;background:rgba(124,58,237,0.08);}
 .moverlay{position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:400;display:flex;align-items:flex-end;justify-content:center;animation:overlayIn .2s ease;}
 @keyframes overlayIn{from{opacity:0;}to{opacity:1;}}
 .modal{background:#111827;border:1px solid #1F2937;border-top:1px solid #374151;border-radius:24px 24px 0 0;padding:24px 18px 36px;width:100%;max-width:500px;max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;animation:slideUp .25s cubic-bezier(.32,.72,0,1);}
 @keyframes slideUp{from{transform:translateY(100%);}to{transform:translateY(0);}}
 .betrow{border-bottom:1px solid #1F2937;transition:background .15s ease;contain:layout style;}
 .betrow:active{background:rgba(255,255,255,0.02);}
 .toggle-wrap{display:flex;align-items:center;gap:10px;padding:12px 14px;background:rgba(255,255,255,0.03);border:1.5px solid #1F2937;border-radius:12px;cursor:pointer;transition:all .2s ease;}
 .toggle-wrap.hs-on{border-color:rgba(124,58,237,0.4);background:rgba(124,58,237,0.05);}
 .toggle-track{width:36px;height:20px;border-radius:10px;background:#374151;position:relative;transition:background .25s ease;flex-shrink:0;}
 .toggle-track.on{background:linear-gradient(135deg,#7C3AED,#3B82F6);}
 .toggle-thumb{width:16px;height:16px;border-radius:50%;background:#fff;position:absolute;top:2px;left:2px;transition:left .25s cubic-bezier(.32,.72,0,1);box-shadow:0 1px 4px rgba(0,0,0,0.3);will-change:left;}
 .toggle-thumb.on{left:18px;}
 .cal-cell{border:1px solid #1F2937;border-radius:8px;padding:6px 4px;text-align:center;cursor:pointer;transition:all .2s ease;min-height:40px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;}
 .cal-cell:active{transform:scale(.94);}
 .cal-cell.today{border-color:rgba(124,58,237,.5);}
 .cal-cell.selected{background:rgba(124,58,237,.12);border-color:#7C3AED;}
 .view-enter{animation:fadeUp .12s cubic-bezier(.32,.72,0,1);will-change:opacity,transform;}
 @keyframes fadeUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
 .month-header{font-size:13px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:1px;padding:14px 4px 6px;}
 .day-header{font-size:12px;color:#6B7280;font-weight:600;padding:8px 0 5px;display:flex;justify-content:space-between;align-items:center;}
 select option{background:#1F2937;color:#E5E7EB;}
 input::placeholder,textarea::placeholder{color:#6B7280;}
 *{-webkit-tap-highlight-color:transparent;}
 ::-webkit-scrollbar{width:0;background:transparent;}
 @keyframes betFlash{0%{opacity:0;transform:scale(.92);}15%{opacity:1;transform:scale(1.02);}70%{opacity:1;transform:scale(1);}100%{opacity:0;transform:scale(.96);}}
 .bet-confirm-overlay{position:fixed;inset:0;z-index:600;display:flex;align-items:center;justify-content:center;pointer-events:none;animation:betFlash .9s ease forwards;}
 .bet-confirm-inner{display:flex;flex-direction:column;align-items:center;gap:14px;padding:36px 48px;border-radius:28px;backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);}
 button{-webkit-tap-highlight-color:transparent;}
 button:focus{outline:none;}
 input:focus{outline:none;}
 `}</style>

 <div style={{maxWidth:500,margin:"0 auto",padding:"16px 14px",WebkitOverflowScrolling:"touch"}}>

 {/* Toast */}
 {toast&&<div style={{position:"fixed",top:18,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",color:"#fff",padding:"10px 20px",borderRadius:12,fontWeight:700,fontSize:13,zIndex:500,boxShadow:"0 8px 24px rgba(124,58,237,0.4)",whiteSpace:"nowrap",fontFamily:"'Inter',sans-serif",animation:"fadeUp .2s ease"}}>{toast.msg}</div>}

 {/* CONFIRMATION VISUELLE BET */}

 {/* Syncing indicator */}
 {syncing&&<div style={{position:"fixed",top:18,right:14,background:"rgba(124,58,237,0.15)",border:"1px solid rgba(124,58,237,0.3)",borderRadius:8,padding:"4px 10px",fontSize:10,fontWeight:700,color:"#A78BFA",zIndex:499,fontFamily:"'Inter',sans-serif"}}> Sync…</div>}

 {/* BANNIÈRE MODE TEST GLOBAL */}
 {isTestActive&&(
 <div style={{position:"fixed",top:0,left:0,right:0,zIndex:600,background:"linear-gradient(90deg,rgba(234,179,8,.95),rgba(202,138,4,.95))",padding:"5px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 2px 12px rgba(234,179,8,.4)"}}>
 <div style={{display:"flex",alignItems:"center",gap:6}}>
 <span style={{fontSize:13}}><Ic n="flask" s={13}/></span>
 <span style={{fontSize:11,fontWeight:800,color:"#1a1000",letterSpacing:.3}}>MODE TEST ACTIF — simulation en cours</span>
 <span style={{fontSize:10,color:"rgba(0,0,0,.5)",marginLeft:2}}>
 {[testFilter.games.size<4&&`${testFilter.games.size} jeux`,testFilter.headshot!=="all"&&(testFilter.headshot==="yes"?"HS only":"sans HS"),testFilter.live!=="all"&&(testFilter.live==="yes"?"Live only":"sans Live"),testFilter.overUnder!=="all"&&testFilter.overUnder,testFilter.hideRoles.size>0&&`${testFilter.hideRoles.size} pos. masquées`,testFilter.hideTourneys.size>0&&`${testFilter.hideTourneys.size} tournois masqués`].filter(Boolean).join(" · ")}
 </span>
 </div>
 <button onClick={()=>{setTestFilter(DEFAULT_TEST_FILTER);setTestFilterDraft(DEFAULT_TEST_FILTER);}}
 style={{background:"rgba(0,0,0,.15)",border:"none",borderRadius:5,padding:"2px 8px",color:"#1a1000",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0}}>
 Reset
 </button>
 </div>
 )}

 {/* VUE EN CHARGEMENT */}

 {/* HOME */}
 {view==="home"&&(
 <div className="view-enter" style={{paddingBottom:8,paddingTop:isTestActive?34:0}}>

 {/* TOP BAR */}
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,paddingTop:2}}>
 {/* Logo + nom */}
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <div style={{width:38,height:38,borderRadius:11,background:"linear-gradient(135deg,#7c3aed,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 16px rgba(124,58,237,.4)"}}>
 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M17 7h4v4"/></svg>
 </div>
 <div>
 <div style={{fontSize:19,fontWeight:900,letterSpacing:".5px",color:"#f0f4ff",lineHeight:1}}>EMEIEKS</div>
 <div style={{fontSize:9,color:"#4a5a6e",letterSpacing:"3px",fontWeight:700,marginTop:2}}>BANKROLL</div>
 </div>
 </div>
 {/* Sync */}
 <button onClick={()=>setSupaModal(true)}
 style={{display:"flex",alignItems:"center",gap:5,background:supaOk?"rgba(0,230,118,.1)":"rgba(124,58,237,.1)",border:"1px solid "+(supaOk?"rgba(0,230,118,.25)":"rgba(124,58,237,.25)"),borderRadius:10,padding:"7px 13px",cursor:"pointer",fontFamily:"Inter,sans-serif",color:supaOk?"#00E676":"#a78bfa",fontSize:11,fontWeight:700}}>
 <span style={{display:"flex"}}><Ic n="cloud" s={13}/></span><span>{syncing?"Sync…":supaOk?"Sync":"Cloud"}</span>
 {supaOk&&!syncing&&<span style={{width:5,height:5,borderRadius:"50%",background:"#00E676",boxShadow:"0 0 6px rgba(0,230,118,.9)"}}/>}
 </button>
 </div>

 {/* HERO PROFIT + GRAPHIQUE */}
 <div style={{background:"linear-gradient(160deg,rgba(13,18,38,.99),rgba(8,12,26,.99))",border:"1px solid rgba(99,130,200,.12)",borderRadius:20,padding:"18px 16px 12px",marginBottom:12,boxShadow:"0 8px 30px rgba(0,0,0,.35)"}}>
 <div style={{marginBottom:14}}>
 <div style={{fontSize:10,color:"#5a6a7e",fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",marginBottom:4}}>Profit Net</div>
 <div style={{display:"flex",alignItems:"baseline",gap:10}}>
 <div style={{fontSize:34,fontWeight:900,color:totalProfit>=0?"#00E676":"#ef4444",letterSpacing:"-1.2px",lineHeight:1,textShadow:totalProfit>=0?"0 0 24px rgba(0,230,118,.35)":"0 0 24px rgba(239,68,68,.35)"}}>{totalProfit>=0?"+":""}{totalProfit.toFixed(0)}$</div>
 <div style={{fontSize:12,color:"#4a5a6e",fontWeight:600}}>Bankroll {bankroll.toFixed(0)}$</div>
 </div>

 </div>
 <BankrollChart points={chartPointsFiltered} h={190}/>
 <div style={{display:"flex",gap:5,marginTop:8,alignItems:"center"}}>
 {[{k:null,l:"Tout"},{k:3,l:"3j"},{k:7,l:"7j"},{k:14,l:"14j"},{k:30,l:"30j"}].map(({k,l})=>{
 const on=homePeriod===k;
 return(
 <button key={l} onClick={()=>setHomePeriod(k)}
 style={{padding:"5px 11px",borderRadius:8,border:"1px solid "+(on?"rgba(167,139,250,.4)":"rgba(255,255,255,.06)"),background:on?"rgba(124,58,237,.15)":"transparent",color:on?"#c4b5fd":"#4a5a6e",fontSize:12,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 {l}
 </button>
 );
 })}
 <button onClick={()=>setHomeChartModal(true)}
 style={{marginLeft:"auto",padding:"5px 8px",borderRadius:8,border:"1px solid rgba(255,255,255,.06)",background:"transparent",color:"#4a5a6e",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
 </button>
 </div>
 </div>

 {/* 3 KPI CARDS */}
 {(()=>{
 const settled2=homeSettled;
 const pending2=bets.filter(b=>b.status==="pending").length;
 const won2=settled2.filter(b=>b.status==="won").length;
 const lost2=settled2.filter(b=>b.status==="lost").length;
 const roi2=settled2.length>0&&settled2.reduce((s,b)=>s+(b.stake||0),0)>0
 ?(settled2.reduce((s,b)=>s+(b.profit||0),0)/settled2.reduce((s,b)=>s+(b.stake||0),0)*100):0;
 return(
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
 <div style={{background:"rgba(10,16,34,.98)",border:"1px solid rgba(59,130,246,.18)",borderRadius:14,padding:"13px 12px",position:"relative",overflow:"hidden"}}>
 <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#3b82f6,#60a5fa)"}}/>
 <div style={{fontSize:9,color:"#5a6a7e",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:7}}>PARIS</div>
 <div style={{fontSize:22,fontWeight:900,color:"#60a5fa",letterSpacing:"-1px",lineHeight:1,marginBottom:4}}>{settled2.length+pending2}</div>
 <div style={{fontSize:10,color:"#3a4a5a"}}>{pending2>0?pending2+" en cours":won2+"W · "+lost2+"L"}</div>
 </div>
 <div style={{background:"rgba(10,16,34,.98)",border:"1px solid "+(progression>=0?"rgba(0,230,118,.18)":"rgba(239,68,68,.18)"),borderRadius:14,padding:"13px 12px",position:"relative",overflow:"hidden"}}>
 <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:progression>=0?"linear-gradient(90deg,#059669,#00E676)":"linear-gradient(90deg,#dc2626,#ef4444)"}}/>
 <div style={{fontSize:9,color:"#5a6a7e",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:7}}>PROGRESSION</div>
 <div style={{fontSize:22,fontWeight:900,color:progression>=0?"#00E676":"#ef4444",letterSpacing:"-1px",lineHeight:1,marginBottom:4}}>{progression>=0?"+":""}{progression.toFixed(1)}%</div>
 <div style={{fontSize:10,color:"#3a4a5a"}}>BK: {bankroll.toFixed(0)}$</div>
 </div>
 <div style={{background:"rgba(10,16,34,.98)",border:"1px solid "+(totalProfit>=0?"rgba(0,230,118,.18)":"rgba(239,68,68,.18)"),borderRadius:14,padding:"13px 12px",position:"relative",overflow:"hidden"}}>
 <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:totalProfit>=0?"linear-gradient(90deg,#059669,#00E676)":"linear-gradient(90deg,#dc2626,#ef4444)"}}/>
 <div style={{fontSize:9,color:"#5a6a7e",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:7}}>PROFIT NET</div>
 <div style={{fontSize:22,fontWeight:900,color:totalProfit>=0?"#00E676":"#ef4444",letterSpacing:"-1px",lineHeight:1,marginBottom:4}}>{totalProfit>=0?"+":""}{totalProfit.toFixed(0)}$</div>
 <div style={{fontSize:10,color:"#3a4a5a"}}>ROI {roi2>=0?"+":""}{roi2.toFixed(1)}%</div>
 </div>
 </div>
 );
 })()}

 {/* BOUTONS ACTIONS */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
 <button onClick={()=>setView("calendrier")}
 style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"14px",background:"linear-gradient(135deg,rgba(124,58,237,.14),rgba(99,102,241,.08))",border:"1px solid rgba(167,139,250,.25)",borderRadius:14,color:"#c4b5fd",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
 Calendrier
 </button>
 <button onClick={()=>setView("statistiques")}
 style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"14px",background:"linear-gradient(135deg,rgba(59,130,246,.14),rgba(14,165,233,.08))",border:"1px solid rgba(96,165,250,.25)",borderRadius:14,color:"#93c5fd",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
 Stats
 </button>
 </div>

 {/* PARIS RÉCENTS */}
 {settledCount>0&&(
 <div>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
 <span style={{fontSize:10,color:"#4a5a6e",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>Paris récents</span>
 <button onClick={()=>setView("mesparis")} style={{fontSize:11,color:"#a78bfa",fontWeight:700,background:"none",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",padding:0}}>
 Voir tous ({settledCount}) →
 </button>
 </div>
 <div style={{background:"rgba(10,16,32,.99)",borderRadius:14,border:"1px solid rgba(99,130,200,.1)",overflow:"hidden"}}>
 {[...bets].filter(b=>b.status!=="pending").sort(function(a,b2){return String(b2.datetime||b2.updatedAt||0).localeCompare(String(a.datetime||a.updatedAt||0));}).slice(0,6).map(function(b,i){
 const isWon=b.status==="won";
 const profitVal=b.profit!=null?b.profit:(isWon?(b.stake||0)*(b.odds-1):-(b.stake||0));
 const bkLogo=BK_LOGOS[b.bookmaker]||bkPhotos[b.bookmaker]||null;
 const hasPPh=b.ppEdge!=null&&b.ppMapType;
 const descLine=b.description||"";
 return(
 <div key={b.id} onClick={()=>setView("mesparis")} style={{marginTop:i>0?4:0,borderRadius:i>0?10:0,cursor:"pointer",borderLeft:"2.5px solid "+(isWon?"#00E676":"#f43f5e"),borderBottom:i<5?"none":"none"}}>
 <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px"}}>
 <div title="Voir le profil du joueur" onClick={e=>{e.stopPropagation();openPlayerSheet(b.player);}} style={{width:34,height:34,borderRadius:8,overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,.04)",cursor:"pointer"}}>
 <GameLogo game={b.game} size={34}/>
 </div>
 <div style={{flex:1,minWidth:0}}>
 <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:3,flexWrap:"wrap"}}>
 <span style={{fontWeight:800,fontSize:14,color:"#f0f4ff",textTransform:"capitalize",flexShrink:0}}>{b.player}</span>
 {descLine&&<><span style={{color:"#2e3d50",fontSize:10,margin:"0 1px"}}>-</span><span style={{fontSize:11,color:"#8a9eb8",flexShrink:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{descLine}</span></>}
 {b.mapTag&&<><span style={{color:"#2e3d50",fontSize:10,margin:"0 1px"}}>-</span><span style={{fontSize:9,fontWeight:700,color:"#fbbf24",background:"rgba(251,191,36,.1)",padding:"1px 4px",borderRadius:3,border:"1px solid rgba(251,191,36,.2)",flexShrink:0}}>{b.mapTag}</span></>}
 </div>
 <div style={{display:"flex",alignItems:"center",gap:0,flexWrap:"wrap"}}>
 <span style={{fontSize:11,fontWeight:700,color:"#7a9cbd"}}>@{b.odds}</span>
 {(bkLogo||b.bookmaker)&&<span style={{color:"#3a4e62",margin:"0 4px",fontSize:11}}>·</span>}
 {bkLogo?(<img src={bkLogo} alt={b.bookmaker} style={{width:13,height:13,borderRadius:3,objectFit:"cover"}}/>):<span style={{fontSize:11,color:"#7a9cbd"}}>{b.bookmaker}</span>}
 {b.stake&&<><span style={{color:"#3a4e62",margin:"0 4px",fontSize:11}}>·</span><span style={{fontSize:11,color:"#7a9cbd"}}>{b.stake}$</span></>}
 {hasPPh&&<><span style={{color:"#3a4e62",margin:"0 4px",fontSize:11}}>·</span><img src={_B64_PP_LOGO_B64} alt="PP" style={{width:11,height:11,borderRadius:2,objectFit:"cover",verticalAlign:"middle"}}/><span style={{fontSize:11,color:b.ppEdge>=0?"rgba(167,139,250,.85)":"#f87171",marginLeft:2}}></span></>}
 </div>
 </div>
 <div style={{flexShrink:0,textAlign:"right"}}>
 <div style={{fontWeight:800,fontSize:14,color:isWon?"#00E676":"#f87171"}}>{profitVal>=0?"+":""}{profitVal.toFixed(2)}$</div>
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 )}

 </div>
 )}
 {/* HOME CHART FILTER MODAL */}
 {homeChartModal&&(
 <div className="moverlay" onClick={()=>setHomeChartModal(false)}>
 <div className="modal" style={{padding:0,overflow:"hidden",borderRadius:24,display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>

 {/* Header */}
 <div style={{padding:"16px 20px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div style={{fontSize:18,fontWeight:800,color:"#E5E7EB",letterSpacing:"-0.5px"}}>Filtres</div>
 <button onClick={()=>setHomeChartModal(false)}
 style={{background:"rgba(255,255,255,0.07)",border:"none",borderRadius:8,width:28,height:28,cursor:"pointer",color:"#9CA3AF",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}><Ic n="x" s={13}/></button>
 </div>

 <div style={{padding:"0 16px 18px",display:"flex",flexDirection:"column",gap:14}}>

 {/* Jeux */}
 <div>
 <div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Jeux</div>
 <div style={{display:"flex",gap:6}}>
 {["LoL","CS2","Dota2","Valorant"].map(g=>{
 const on=homeChartFilters.games.includes(g);
 const cfg=GAME_CFG[g]||{accent:"#A78BFA"};
 const acc=cfg.accent||"#A78BFA";
 return(
 <button key={g} onClick={()=>setHomeChartFilters(f=>({...f,games:on?f.games.filter(x=>x!==g):[...f.games,g]}))}
 style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"8px 4px",borderRadius:12,border:"1.5px solid "+(on?acc:"#1F2937"),background:on?`rgba(${acc==="#F1B700"?"241,183,0":acc==="#E84057"?"232,64,87":acc==="#7B8CDE"?"123,140,222":"124,58,237"},0.12)`:"rgba(255,255,255,0.02)",cursor:"pointer",transition:"all .15s"}}>
 <GameLogo game={g} size={18}/>
 <span style={{fontSize:10,fontWeight:600,color:on?acc:"#6B7280",fontFamily:"Inter,sans-serif"}}>{g}</span>
 </button>
 );
 })}
 </div>
 </div>

 {/* Séparateur */}
 <div style={{height:"1px",background:"#1F2937"}}/>

 {/* Type */}
 <div>
 <div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Type</div>
 <div style={{display:"flex",gap:6}}>
 {[{v:"All",l:"Tous"},{v:"Over",l:" Over"},{v:"Under",l:" Under"}].map(({v,l})=>{
 const on=homeChartFilters.overUnder===v;
 return(
 <button key={v} onClick={()=>setHomeChartFilters(f=>({...f,overUnder:v}))}
 style={{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid "+(on?"#60A5FA":"#1F2937"),background:on?"rgba(96,165,250,0.12)":"rgba(255,255,255,0.02)",color:on?"#60A5FA":"#9CA3AF",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s"}}>
 {l}
 </button>
 );
 })}
 </div>
 </div>

 {/* Mode */}
 {(()=>{
 const games=homeChartFilters.games;
 const hasLoL=games.length===0||games.includes("LoL");
 const hasCS2=games.length===0||games.includes("CS2");
 const hasDota=games.length===0||games.includes("Dota2");
 const modes=[];
 modes.push({v:"All",l:"Tous",col:"#9CA3AF"});
 if(hasLoL||hasDota)modes.push({v:"Live",l:" Live",col:"#EF4444"});
 modes.push({v:"Non-live",l:"Non-live",col:"#60A5FA"});
 if(hasCS2)modes.push({v:"Headshot",l:" HS",col:"#818CF8"});
 modes.push({v:"Duel",l:" Duel",col:"#F59E0B"});
 return(
 <div>
 <div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Mode</div>
 <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
 {modes.map(({v,l,col})=>{
 const on=homeChartFilters.live===v;
 const rgba={
 "#EF4444":"248,113,113","#60A5FA":"96,165,250",
 "#818CF8":"129,140,248","#F59E0B":"245,158,11","#9CA3AF":"156,163,175"
 }[col]||"156,163,175";
 return(
 <button key={v} onClick={()=>setHomeChartFilters(f=>({...f,live:v}))}
 style={{padding:"7px 14px",borderRadius:20,border:"1.5px solid "+(on?col:"#1F2937"),background:on?`rgba(${rgba},0.15)`:"rgba(255,255,255,0.02)",color:on?col:"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap",transition:"all .15s"}}>
 {l}
 </button>
 );
 })}
 </div>
 </div>
 );
 })()}

 {/* Séparateur */}
 <div style={{height:"1px",background:"#1F2937"}}/>

 {/* Période */}
 <div>
 <div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Période</div>
 <div style={{display:"flex",gap:5,marginBottom:7}}>
 {[{l:"Cette sem.",fn:()=>{const d=new Date();const mon=new Date(d);mon.setDate(d.getDate()-d.getDay()+1);setHomeChartFilters(f=>({...f,dateFrom:mon.toISOString().slice(0,10),dateTo:d.toISOString().slice(0,10)}));}},{l:"Ce mois",fn:()=>{const d=new Date();setHomeChartFilters(f=>({...f,dateFrom:d.getFullYear()+"-"+(d.getMonth()+1).toString().padStart(2,"0")+"-01",dateTo:d.toISOString().slice(0,10)}));}},{l:"Mois passé",fn:()=>{const d=new Date();const pm=new Date(d.getFullYear(),d.getMonth()-1,1);const pme=new Date(d.getFullYear(),d.getMonth(),0);setHomeChartFilters(f=>({...f,dateFrom:pm.toISOString().slice(0,10),dateTo:pme.toISOString().slice(0,10)}));}}].map(({l,fn})=>(
 <button key={l} onClick={fn}
 style={{flex:1,padding:"7px 0",borderRadius:8,border:"1px solid #1F2937",background:"rgba(255,255,255,0.03)",color:"#9CA3AF",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 {l}
 </button>
 ))}
 </div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
 {[{label:"Du",key:"dateFrom"},{label:"Au",key:"dateTo"}].map(({label,key})=>(
 <div key={key} style={{background:"rgba(255,255,255,0.03)",border:"1px solid "+(homeChartFilters[key]?"rgba(96,165,250,0.3)":"#1F2937"),borderRadius:10,padding:"8px 12px",transition:"border .15s"}}>
 <div style={{fontSize:9,color:homeChartFilters[key]?"#60A5FA":"#4B5563",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{label}</div>
 <input type="date" value={homeChartFilters[key]||""}
 onChange={e=>setHomeChartFilters(f=>({...f,[key]:e.target.value}))}
 style={{width:"100%",background:"transparent",border:"none",color:homeChartFilters[key]?"#E5E7EB":"#4B5563",fontSize:12,fontFamily:"Inter,sans-serif",outline:"none",padding:0}}/>
 </div>
 ))}
 </div>
 </div>

 {/* Séparateur */}
 <div style={{height:"1px",background:"#1F2937"}}/>

 {/* Bookmakers */}
 <div>
 <div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Bookmakers</div>
 <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
 {visibleBKs.map(bk=>{
 const on=homeChartFilters.bookmakers.includes(bk);
 const logo=BK_LOGOS[bk]||bkPhotos[bk]||null;
 return(
 <button key={bk} onClick={()=>setHomeChartFilters(f=>({...f,bookmakers:on?f.bookmakers.filter(x=>x!==bk):[...f.bookmakers,bk]}))}
 title={bk}
 style={{width:42,height:42,borderRadius:11,border:"1.5px solid "+(on?"#00E676":"#1F2937"),background:on?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.02)",cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",transition:"all .15s"}}>
 {logo?(<img src={logo} alt={bk} style={{width:26,height:26,borderRadius:6,objectFit:"cover"}}/>):(<span style={{fontSize:9,color:on?"#00E676":"#6B7280",fontWeight:700}}>{bk.slice(0,3)}</span>)}
 {on&&<div style={{position:"absolute",top:-3,right:-3,background:"#00E676",borderRadius:"50%",width:12,height:12,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #0B1220"}}><span style={{fontSize:6,color:"#000",fontWeight:900}}><Ic n="check" s={7} c="#000" w={4}/></span></div>}
 </button>
 );
 })}
 </div>
 </div>

 {/* Boutons action */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:8,paddingTop:2}}>
 <button onClick={()=>{setHomeChartFilters({games:[],overUnder:"All",live:"All",bookmakers:[],dateFrom:"",dateTo:""});setHomePeriod(null);}}
 style={{padding:"13px",background:"rgba(255,255,255,0.05)",border:"1px solid #1F2937",borderRadius:12,color:"#6B7280",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:12}}>
 Réinit.
 </button>
 <button onClick={()=>setHomeChartModal(false)}
 style={{padding:"13px",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:12,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13,letterSpacing:"0.2px",boxShadow:"0 4px 20px rgba(124,58,237,0.35)"}}>
 Appliquer
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* MES PARIS */}
 {view==="mesparis"&&(
 <MesParisView
 bets={betsForDisplay}
 setBets={setBets}
 bookmakers={bookmakers}
 bkPhotos={bkPhotos}
 hiddenBKs={hiddenBKs}
 updateStatus={updateStatus}
 deleteBet={deleteBet}
 duplicateBet={duplicateBet}
 openEdit={openEdit}
 splitBet={splitBet}
 showToast={showToast}
 fGames={fGames} setFGames={setFGames}
 fBKs={fBKs} setFBKs={setFBKs}
 fStatus={fStatus} setFStatus={setFStatus}
 fOverUnder={fOverUnder} setFOverUnder={setFOverUnder}
 fMinOdds={fMinOdds} setFMinOdds={setFMinOdds}
 fMaxOdds={fMaxOdds} setFMaxOdds={setFMaxOdds}
 fMinStake={fMinStake} setFMinStake={setFMinStake}
 fMaxStake={fMaxStake} setFMaxStake={setFMaxStake}
 fMinPP={fMinPP} setFMinPP={setFMinPP}
 fMaxPP={fMaxPP} setFMaxPP={setFMaxPP}
 fTourneys={fTourneys} setFTourneys={setFTourneys}
 fPlayer={fPlayer} setFPlayer={setFPlayer}
 fMapFilter={fMapFilter} setFMapFilter={setFMapFilter}
 fDuel={fDuel} setFDuel={setFDuel}
 fLive={fLive} setFLive={setFLive}
 fHeadshot={fHeadshot} setFHeadshot={setFHeadshot}
 fRole={fRole} setFRole={setFRole}
 fLeague={fLeague} setFLeague={setFLeague}
 fTourneys={fTourneys} setFTourneys={setFTourneys}
 fDateFrom={fDateFrom} setFDateFrom={setFDateFrom}
 fDateTo={fDateTo} setFDateTo={setFDateTo}
 setView={setView}
 supaPushBets={supaPushBets}
 supaDeleteManyBets={supaDeleteManyBets}
 supaDeleteOneBet={supaDeleteOneBet}
 setDeletedBets={setDeletedBets}
 BK_LOGOS={BK_LOGOS}
 calcProfit={calcProfit}
 fPlayer={fPlayer} setFPlayer={setFPlayer}
 sortByMap={sortByMap} setSortByMap={setSortByMap}
 savedTourneys={savedTourneys}
 onMarkPush={function(){lastPushRef.current=Date.now();}}
 allPlayers={allPlayers}
 />
 )}
 {view==="calendrier"&&(
 <div className="view-enter">
 {/* Header */}
 <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
 <button onClick={()=>setView("home")} style={{background:"rgba(124,58,237,0.15)",border:"1px solid rgba(124,58,237,0.3)",borderRadius:10,padding:"8px 12px",color:"#A78BFA",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:700}}>←</button>
 <div style={{fontSize:16,fontWeight:700,color:"#E5E7EB"}}>Calendrier des bénéfices</div>
 </div>

 {/* Nav mois */}
 <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
 <button onClick={()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--;}setCalMonth(m);setCalYear(y);setCalSelected(null);}}
 style={{background:"#111827",border:"1px solid #1F2937",borderRadius:10,padding:"9px 14px",color:"#94A3B8",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:16,fontWeight:700}}>‹</button>
 <div style={{flex:1,background:"#111827",border:"1px solid #1F2937",borderRadius:10,padding:"10px",textAlign:"center",fontSize:15,fontWeight:700,color:"#E5E7EB"}}>{FR_MONTHS[calMonth]} {calYear}</div>
 <button onClick={()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++;}setCalMonth(m);setCalYear(y);setCalSelected(null);}}
 style={{background:"#111827",border:"1px solid #1F2937",borderRadius:10,padding:"9px 14px",color:"#94A3B8",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:16,fontWeight:700}}>›</button>
 <button onClick={()=>{setCalMonth(new Date().getMonth());setCalYear(new Date().getFullYear());setCalSelected(null);}}
 style={{background:"#111827",border:"1px solid #1F2937",borderRadius:10,padding:"9px 12px",color:"#A78BFA",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>Auj.</button>
 </div>

 {/* Filtre jeu */}
 <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
 {ALL_GAMES.map(g=>(
 <button key={g} onClick={()=>setCalGames(prev=>prev.includes(g)?prev.filter(x=>x!==g):[...prev,g])}
 style={{display:"flex",alignItems:"center",gap:4,padding:"5px 11px",borderRadius:8,border:"1.5px solid "+(calGames.includes(g)?"#7C3AED":"#1F2937"),background:calGames.includes(g)?"rgba(124,58,237,0.15)":"transparent",color:calGames.includes(g)?"#A78BFA":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 <GameLogo game={g} size={12}/>{g}
 </button>
 ))}
 {calGames.length>0&&<button onClick={()=>setCalGames([])} style={{padding:"5px 10px",borderRadius:8,border:"1px solid rgba(239,68,68,0.2)",background:"rgba(239,68,68,0.06)",color:"#EF4444",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Tous</button>}
 </div>

 {/* Calendrier grand format */}
 <div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:16,padding:"12px",marginBottom:14}}>
 {/* Jours de la semaine — commence Lundi */}
 <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:6}}>
 {["L","M","M","J","V","S","D"].map((d,i)=>(
 <div key={i} style={{textAlign:"center",fontSize:11,color:"#6B7280",fontWeight:700,padding:"4px 0",textTransform:"uppercase"}}>{d}</div>
 ))}
 </div>
 {/* Cellules */}
 <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
 {(()=>{
 // Lundi = 0, ..., Dimanche = 6 (format Bet Analytix)
 const firstDayJS = new Date(calYear,calMonth,1).getDay(); // 0=dim
 const firstDayMon = (firstDayJS===0?6:firstDayJS-1); // convertir: lun=0
 const daysInMonth = new Date(calYear,calMonth+1,0).getDate();
 // Jours du mois précédent
 const prevMonthDays = new Date(calYear,calMonth,0).getDate();
 const cells=[];
 // Cases mois précédent
 for(let i=0;i<firstDayMon;i++){
 const d=prevMonthDays-firstDayMon+1+i;
 cells.push(
 <div key={"prev"+i} style={{borderRadius:10,padding:"8px 4px",textAlign:"center",minHeight:52,opacity:.25}}>
 <div style={{fontSize:14,fontWeight:600,color:"#6B7280"}}>{d}</div>
 </div>
 );
 }
 // Cases du mois courant
 // Find max abs profit for intensity scaling
 const maxAbsProfit=Math.max(1,...Object.values(dailyProfit).map(function(v){return Math.abs(v);}));
 for(let d=1;d<=daysInMonth;d++){
 const dk=calYear+"-"+String(calMonth+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
 const profit=dailyProfit[dk];
 const pending=dailyPending[dk];
 const isToday=dk===todayKey;
 const isSel=calSelected===dk;
 const hasProfit=profit!==undefined&&profit!==0;
 const hasPending=pending>0;
 const isPositive=hasProfit&&profit>0;
 const isNegative=hasProfit&&profit<0;
 // Intensity 0→1 based on profit relative to max
 const intensity=hasProfit?Math.min(1,Math.abs(profit)/maxAbsProfit):0;
 // Color: green shades for profit, red shades for loss
 var bg,border,textColor;
 if(isSel){bg="rgba(124,58,237,0.3)";border="#7C3AED";textColor="#c4b5fd";}
 else if(isPositive){
 // Low: rgba(34,197,94,0.08) → High: rgba(0,160,60,0.85)
 var a=0.08+intensity*0.77;
 bg="rgba("+(intensity>0.6?"0,140,50":"22,163,74")+","+a.toFixed(2)+")";
 border=intensity>0.5?"rgba(0,200,80,0.6)":"rgba(34,197,94,0.25)";
 textColor=intensity>0.7?"#fff":"#E5E7EB";
 }else if(isNegative){
 var a=0.08+intensity*0.77;
 bg="rgba("+(intensity>0.6?"180,20,20":"239,68,68")+","+a.toFixed(2)+")";
 border=intensity>0.5?"rgba(220,30,30,0.6)":"rgba(248,113,113,0.25)";
 textColor=intensity>0.7?"#fff":"#E5E7EB";
 }else if(hasPending){
 bg="rgba(59,130,246,0.08)";border="transparent";textColor="#E5E7EB";
 }else{
 bg="transparent";border="transparent";textColor="#E5E7EB";
 }
 cells.push(
 <div key={dk} onClick={()=>setCalSelected(isSel?null:dk)}
 style={{
 borderRadius:10,padding:"8px 4px",textAlign:"center",minHeight:52,
 cursor:"pointer",background:bg,
 border:"1px solid "+border,
 transition:"all .15s ease",
 boxShadow:intensity>0.7&&hasProfit?"0 2px 8px rgba("+(isPositive?"0,180,80":"220,30,30")+","+(intensity*0.4).toFixed(2)+")":"none",
 }}>
 <div style={{fontSize:14,fontWeight:isToday?800:600,color:isToday?"#00E676":textColor,marginBottom:hasProfit?2:0}}>{d}</div>
 {hasProfit&&(
 <div style={{fontSize:9,fontWeight:700,color:isPositive?(intensity>0.6?"#fff":"#00E676"):(intensity>0.6?"#fff":"#EF4444"),lineHeight:1.1}}>
 {isPositive?"+":""}{Math.abs(profit)>=1000?(profit/1000).toFixed(1)+"K":profit.toFixed(0)}$
 </div>
 )}
 {hasPending&&!hasProfit&&<div style={{width:5,height:5,borderRadius:"50%",background:"#3B82F6",margin:"4px auto 0"}}/>}
 </div>
 );
 }
 // Compléter la grille avec cases suivant
 const totalCells=cells.length;
 const remaining=(7-totalCells%7)%7;
 for(let i=1;i<=remaining;i++){
 cells.push(
 <div key={"next"+i} style={{borderRadius:10,padding:"8px 4px",textAlign:"center",minHeight:52,opacity:.25}}>
 <div style={{fontSize:14,fontWeight:600,color:"#6B7280"}}>{i}</div>
 </div>
 );
 }
 return cells;
 })()}
 </div>
 </div>

 {/* Détail jour sélectionné */}
 {calSelected&&(()=>{
 const selectedDayBets=(calGames.length>0?calFilteredBets.filter(b=>toDateKey(b.datetime)===calSelected):byDay[calSelected])||[];
 const dp=dailyProfit[calSelected];
 return(
 <div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:14,padding:"12px 14px",marginBottom:14}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
 <div style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>{calSelected.split("-").reverse().join("/")} — {selectedDayBets.length} paris</div>
 {dp!==undefined&&<span style={{fontWeight:800,fontSize:14,color:dp>=0?"#00E676":"#EF4444"}}>{dp>=0?"+":""}{dp.toFixed(2)}$</span>}
 </div>
 <div style={{background:"#0B1220",borderRadius:10,overflow:"hidden",border:"1px solid #1F2937"}}>
 {selectedDayBets.map(b=>(
 <div key={b.id} style={{padding:"10px 12px",borderBottom:"1px solid #1F2937",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <GameLogo game={b.game} size={16}/>
 <div>
 <div style={{fontWeight:600,fontSize:13,textTransform:"capitalize",color:"#E5E7EB"}}>{b.player}</div>
 <div style={{fontSize:10,color:"#9CA3AF"}}>{b.description}</div>
 </div>
 </div>
 <div style={{textAlign:"right"}}>
 <div style={{fontWeight:700,fontSize:13,color:b.status==="won"?"#00E676":b.status==="lost"?"#EF4444":"#3B82F6"}}>
 {b.status==="pending"?"@"+b.odds:(b.profit>=0?"+":"")+(b.profit||0).toFixed(2)+"$"}
 </div>
 <div style={{fontSize:10,color:STATUS_CFG[b.status]?STATUS_CFG[b.status].color:"#9CA3AF"}}>{STATUS_CFG[b.status]?STATUS_CFG[b.status].label:b.status}</div>
 </div>
 </div>
 ))}
 {selectedDayBets.length===0&&<div style={{padding:"14px",fontSize:12,color:"#6B7280",textAlign:"center"}}>Aucun pari ce jour</div>}
 </div>
 </div>
 );
 })()}

 {/* Stats du mois */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
 <div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:14,padding:"14px 16px"}}>
 <div style={{fontSize:11,color:"#9CA3AF",marginBottom:4}}>Bénéfice du mois</div>
 <div style={{fontSize:22,fontWeight:800,color:monthProfit>=0?"#00E676":"#EF4444"}}>{monthProfit>=0?"+":""}{monthProfit.toFixed(0)}$</div>
 </div>
 <div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:14,padding:"14px 16px"}}>
 <div style={{fontSize:11,color:"#9CA3AF",marginBottom:4}}>Paris du mois</div>
 <div style={{fontSize:22,fontWeight:800,color:"#60A5FA"}}>
 {(()=>{
 const mo=String(calMonth+1).padStart(2,"0");
 const prefix=calYear+"-"+mo;
 return Object.entries(dailyCount).filter(([d])=>d.startsWith(prefix)).reduce((s,[,v])=>s+v,0);
 })()}
 </div>
 </div>
 </div>
 </div>
 )}

 {/* VUE DÉPÔTS PAR BOOKMAKER */}

 {/* FILTRES */}
 {view==="filtres"&&(
 <div className="view-enter">
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
 <div style={{fontSize:15,fontWeight:700,textTransform:"uppercase",letterSpacing:1,display:"flex",alignItems:"center",gap:7}}>
 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="4,4 20,4 14,12 14,20 10,20 10,12" fill="rgba(167,139,250,0.15)"/></svg>
 Filtres
 </div>
 <div style={{display:"flex",gap:8}}>
 <button onClick={()=>{setFGames([]);setFBKs([]);setFPlayer("");setFStatus("All");setFOverUnder("All");setFLive(false);setFHeadshot(false);setFDuel(false);setFMinOdds("");setFMaxOdds("");setFMinStake("");setFMaxStake("");setFMapFilter("all");setFRole("All");setFLeague("All");setFTourneys(new Set());setFiltresPage(1);}}
 style={{padding:"7px 14px",background:"rgba(255,255,255,0.05)",border:"1px solid #1F2937",borderRadius:9,color:"#6B7280",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
 Réinit.
 </button>
 <button onClick={()=>setView("mesparis")}
 style={{padding:"7px 16px",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:9,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
 Appliquer →
 </button>
 </div>
 </div>

 {/* Période */}
 <div className="add-card">
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
 <span className="add-label" style={{marginBottom:0}}> Période</span>
 {(fDateFrom||fDateTo)&&(
 <button onClick={()=>{setFDateFrom("");setFDateTo("");}}
 style={{padding:"3px 10px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:6,color:"#EF4444",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 Effacer
 </button>
 )}
 </div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
 <div style={{display:"flex",flexDirection:"column",gap:4}}>
 <span style={{fontSize:10,color:"#6B7280",fontWeight:600}}>Du</span>
 <input type="date" className="ifield" value={fDateFrom} onChange={e=>setFDateFrom(e.target.value)} style={{height:36,fontSize:13,padding:"0 10px"}}/>
 </div>
 <div style={{display:"flex",flexDirection:"column",gap:4}}>
 <span style={{fontSize:10,color:"#6B7280",fontWeight:600}}>Au</span>
 <input type="date" className="ifield" value={fDateTo} onChange={e=>setFDateTo(e.target.value)} style={{height:36,fontSize:13,padding:"0 10px"}}/>
 </div>
 </div>
 </div>

 {/* Statut */}
 <div className="add-card">
 <span className="add-label">Statut</span>
 <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
 {[{k:"All",label:"Tous"},{k:"pending",label:"⏳ Attente"},{k:"won",label:" Gagnés"},{k:"lost",label:" Perdus"}].map(t=>(
 <button key={t.k} className={"fchip "+(fStatus===t.k?"on":"")} onClick={()=>setFStatus(t.k)}>{t.label}</button>
 ))}
 </div>
 </div>

 <div className="add-card">
 <span className="add-label">Jeu</span>
 <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
 {ALL_GAMES.map(g=>(
 <button key={g} className={"fchip "+(fGames.includes(g)?"on":"")} onClick={()=>toggleArr(fGames,setFGames,g)} style={{display:"flex",alignItems:"center",gap:5}}>
 <GameLogo game={g} size={14}/> {g}
 </button>
 ))}
 </div>
 </div>
 <div className="add-card">
 <span className="add-label">Bookmaker</span>
 <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
 {visibleBKs.map(bk=>{
 const logo=BK_LOGOS[bk]||bkPhotos[bk]||null;
 const isOn=fBKs.includes(bk);
 return(
 <button key={bk} onClick={()=>toggleArr(fBKs,setFBKs,bk)}
 title={bk}
 style={{width:40,height:40,borderRadius:10,border:"1.5px solid "+(isOn?"#A78BFA":"#1F2937"),background:isOn?"rgba(124,58,237,0.15)":"rgba(255,255,255,0.03)",cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .15s",position:"relative"}}>
 {logo
 ? (<img src={logo} alt={bk} style={{width:26,height:26,borderRadius:6,objectFit:"cover"}}/>)
 : (<span style={{fontSize:9,fontWeight:700,color:isOn?"#A78BFA":"#6B7280"}}>{bk.slice(0,3)}</span>)
 }
 {isOn&&<div style={{position:"absolute",top:-3,right:-3,background:"#A78BFA",borderRadius:"50%",width:10,height:10,border:"2px solid #0B1220"}}/>}
 </button>
 );
 })}
 </div>
 </div>
 <div className="add-card">
 <span className="add-label">Over / Under</span>
 <div style={{display:"flex",gap:7}}>
 {[{val:"All",label:"Tous"},{val:"Over",label:"Over"},{val:"Under",label:"Under"}].map(opt=>(
 <button key={opt.val} className={"fchip "+(fOverUnder===opt.val?"on":"")} onClick={()=>setFOverUnder(opt.val)}>{opt.label}</button>
 ))}
 </div>
 </div>
 <div className="add-card" style={{position:"relative"}}>
 <span className="add-label">Joueur</span>
 <input className="ifield" placeholder="Rechercher..." value={fPlayer} onChange={e=>setFPlayer(e.target.value)}/>
 {fPlayer&&<button onClick={()=>setFPlayer("")} style={{position:"absolute",right:24,bottom:22,background:"none",border:"none",color:"#9CA3AF",cursor:"pointer",fontSize:16}}>x</button>}
 </div>
 <div className="add-card">
 <span className="add-label">Position / Rôle</span>
 {(()=>{
 // Rôles disponibles selon jeux sélectionnés
 const ROLES_BY_GAME={
 LoL:["Top Laner","Jungler","Mid Laner","Bot Laner","Support"],
 CS2:["AWPer","Rifler","IGL"],
 Dota2:["Carry","Mid","Offlane","Soft Support","Hard Support"],
 Valorant:["Duelist","Initiator","Controller","Sentinel","Flex"],
 };
 // Si un jeu est sélectionné → montre ses rôles, sinon tous
 let roles=[];
 if(fGames.length>0){
 fGames.forEach(g=>{if(ROLES_BY_GAME[g])roles=[...new Set([...roles,...ROLES_BY_GAME[g]])]});
 } else {
 Object.values(ROLES_BY_GAME).forEach(r=>roles=[...new Set([...roles,...r])]);
 }
 return(
 <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
 <button className={"fchip "+(fRole==="All"?"on":"")} onClick={()=>setFRole("All")}>Tous</button>
 {roles.map(r=>(
 <button key={r} className={"fchip "+(fRole===r?"on":"")} onClick={()=>setFRole(fRole===r?"All":r)}>{r}</button>
 ))}
 </div>
 );
 })()}
 </div>
 <div className="add-card">
 <span className="add-label">Ligue</span>
 {(()=>{
 let leagues=[];
 if(fGames.length>0){
 fGames.forEach(g=>{if(LEAGUES_BY_GAME[g])leagues=[...new Set([...leagues,...LEAGUES_BY_GAME[g]])]});
 } else {
 Object.values(LEAGUES_BY_GAME).forEach(l=>leagues=[...new Set([...leagues,...l])]);
 }
 if(leagues.length===0)return <div style={{fontSize:11,color:"#6B7280"}}>Sélectionne LoL ou Valorant pour filtrer par ligue</div>;
 return(
 <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
 <button className={"fchip "+(fLeague==="All"?"on":"")} onClick={()=>setFLeague("All")}>Toutes</button>
 {leagues.map(l=>(
 <button key={l} className={"fchip "+(fLeague===l?"on":"")} onClick={()=>setFLeague(fLeague===l?"All":l)} style={{display:"flex",alignItems:"center",gap:5}}>
 <LeagueLogo league={l} size={14}/>{l}
 </button>
 ))}
 </div>
 );
 })()}
 </div>
 <div className="add-card">
 <span className="add-label">Type de pari</span>
 <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
 <button className={"fchip "+(fDuel?"on":"")} onClick={()=>setFDuel(v=>!v)}> Duel</button>
 <button className={"fchip "+(fLive?"on":"")} onClick={()=>setFLive(v=>!v)} style={{display:"flex",alignItems:"center",gap:5}}>
 Live
 </button>
 <button className={"fchip "+(fHeadshot?"on":"")} onClick={()=>setFHeadshot(v=>!v)} style={{display:"flex",alignItems:"center",gap:5}}>
 <img src={HEADSHOT_LOGO_B64} alt="HS" style={{width:13,height:13,objectFit:"contain",filter:"brightness(0) invert(1)",opacity:.8}}/> Headshot
 </button>
 </div>
 </div>

 {/* Filtre cote min/max */}
 <div className="add-card">
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
 <span className="add-label">Cote</span>
 {(fMinOdds||fMaxOdds)&&(
 <button onClick={()=>{setFMinOdds("");setFMaxOdds("");}}
 style={{fontSize:10,color:"#EF4444",background:"transparent",border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
 × Effacer
 </button>
 )}
 </div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
 <div>
 <div style={{fontSize:10,color:"#6B7280",marginBottom:4}}>Min</div>
 <input type="number" step="0.01" min="1" placeholder="ex: 1.60"
 value={fMinOdds} onChange={e=>setFMinOdds(e.target.value)}
 className="ifield" style={{marginBottom:0,fontSize:14}}/>
 </div>
 <div>
 <div style={{fontSize:10,color:"#6B7280",marginBottom:4}}>Max</div>
 <input type="number" step="0.01" min="1" placeholder="ex: 2.00"
 value={fMaxOdds} onChange={e=>setFMaxOdds(e.target.value)}
 className="ifield" style={{marginBottom:0,fontSize:14}}/>
 </div>
 </div>
 {/* Stats live pour la plage sélectionnée */}
 {(fMinOdds||fMaxOdds)&&(()=>{
 const inRange=filteredBets.filter(b=>b.status!=="pending");
 const profit=inRange.reduce((s,b)=>s+(b.profit||0),0);
 const staked=inRange.reduce((s,b)=>s+(b.stake||0),0);
 const won=inRange.filter(b=>b.status==="won").length;
 const wr=inRange.length>0?(won/inRange.length*100).toFixed(0):0;
 const roi=staked>0?(profit/staked*100).toFixed(1):0;
 if(inRange.length===0)return null;
 return(
 <div style={{background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.15)",borderRadius:8,padding:"8px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div>
 <div style={{fontSize:10,color:"#9CA3AF"}}>{inRange.length} paris · {wr}% WR</div>
 <div style={{fontSize:10,color:parseFloat(roi)>=0?"#00E676":"#EF4444"}}>{parseFloat(roi)>=0?"+":""}{roi}% ROI</div>
 </div>
 <div style={{fontSize:16,fontWeight:700,color:profit>=0?"#00E676":"#EF4444"}}>
 {profit>=0?"+":""}{profit.toFixed(0)}$
 </div>
 </div>
 );
 })()}
 </div>
 {/* Filtre Map */}
 <div className="add-card">
 <span className="add-label">Map</span>
 <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
 {[{v:"all",l:"Toutes"},{v:"none",l:"Sans tag"},{v:"Map 1",l:"Map 1"},{v:"Map 2",l:"Map 2"},{v:"Map 3",l:"Map 3"},{v:"Map 4",l:"Map 4"},{v:"Map 5",l:"Map 5"}].map(({v,l})=>(
 <button key={v} className={"fchip "+(fMapFilter===v?"on":"")} onClick={()=>setFMapFilter(v)}>{l}</button>
 ))}
 </div>
 </div>

 {/* Filtre Mise min/max */}
 <div className="add-card">
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
 <span className="add-label">Mise ($)</span>
 {(fMinStake||fMaxStake)&&(
 <button onClick={()=>{setFMinStake("");setFMaxStake("");}}
 style={{fontSize:10,color:"#EF4444",background:"transparent",border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>× Effacer</button>
 )}
 </div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
 <div>
 <div style={{fontSize:10,color:"#6B7280",marginBottom:4}}>Min</div>
 <input type="number" step="1" min="0" placeholder="ex: 10"
 value={fMinStake} onChange={e=>setFMinStake(e.target.value)}
 className="ifield" style={{marginBottom:0,fontSize:14}}/>
 </div>
 <div>
 <div style={{fontSize:10,color:"#6B7280",marginBottom:4}}>Max</div>
 <input type="number" step="1" min="0" placeholder="ex: 100"
 value={fMaxStake} onChange={e=>setFMaxStake(e.target.value)}
 className="ifield" style={{marginBottom:0,fontSize:14}}/>
 </div>
 </div>
 </div>


 {/* PP Edge filter */}
 <div className="add-card">
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
 <span style={{display:"flex",alignItems:"center",gap:6}}>
 <img src={_B64_PP_LOGO_B64} style={{width:14,height:14,objectFit:"contain",verticalAlign:"middle"}}/>
 <span className="add-label" style={{marginBottom:0}}>PP Edge</span>
 </span>
 {(fMinPP!==""||fMaxPP!=="")&&(
 <button onClick={()=>{setFMinPP("");setFMaxPP("");}}
 style={{fontSize:10,color:"#EF4444",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:6,padding:"2px 8px",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>× Effacer</button>
 )}
 </div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
 <div>
 <div style={{fontSize:10,color:"#6B7280",marginBottom:4}}>Min (ex: 0)</div>
 <input type="number" step="0.01" placeholder="ex: 0"
 value={fMinPP} onChange={e=>setFMinPP(e.target.value)}
 className="ifield" style={{marginBottom:0,fontSize:14}}/>
 </div>
 <div>
 <div style={{fontSize:10,color:"#6B7280",marginBottom:4}}>Max (ex: 1)</div>
 <input type="number" step="0.01" placeholder="ex: 1"
 value={fMaxPP} onChange={e=>setFMaxPP(e.target.value)}
 className="ifield" style={{marginBottom:0,fontSize:14}}/>
 </div>
 </div>
 {(fMinPP!==""||fMaxPP!=="")&&(()=>{
 const inR=filteredBets.filter(b=>b.status!=="pending"&&b.ppEdge!=null);
 if(inR.length===0)return <div style={{fontSize:11,color:"#6B7280",marginTop:6}}>Aucun bet PP dans cette plage</div>;
 const profit=inR.reduce((s,b)=>s+(b.profit||0),0);
 const wr=inR.length>0?((inR.filter(b=>b.status==="won").length/inR.length)*100).toFixed(0):0;
 return(
 <div style={{background:"rgba(167,139,250,.08)",border:"1px solid rgba(167,139,250,.15)",borderRadius:8,padding:"7px 10px",marginTop:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div style={{fontSize:11,color:"#9CA3AF"}}>{inR.length} paris PP · {wr}% WR</div>
 <div style={{fontSize:14,fontWeight:700,color:profit>=0?"#00E676":"#EF4444"}}>{profit>=0?"+":""}{profit.toFixed(0)}$</div>
 </div>
 );
 })()}
 </div>
 
 {/* Tournoi — apparaît si un jeu est sélectionné */}
 {(()=>{
 const tourneysForGame=[...new Set(
 bets
 .filter(b=>(fGames.length===0||fGames.includes(b.game))&&effectiveTournament(b,allPlayers))
 .map(b=>effectiveTournament(b,allPlayers))
 )];
 // Add "Hors tournoi" if any bets have no effective tournament
 const hasHors=bets.filter(b=>(fGames.length===0||fGames.includes(b.game))&&!effectiveTournament(b,allPlayers)).length>0;
 const allOptions=[...(hasHors?["Hors tournoi"]:[]),...tourneysForGame];
 if(allOptions.length===0)return null;
 const toggleT=(t)=>setFTourneys(prev=>{
 const n=new Set(prev);
 if(n.has(t))n.delete(t); else n.add(t);
 return n;
 });
 return(
 <div className="add-card">
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
 <span className="add-label" style={{marginBottom:0}}>Tournoi</span>
 {fTourneys.size>0&&(
 <button onClick={()=>setFTourneys(new Set())}
 style={{fontSize:10,color:"#EF4444",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:6,padding:"2px 8px",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
 × Effacer ({fTourneys.size})
 </button>
 )}
 </div>
 <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
 {allOptions.map(t=>{
 const isOn=fTourneys.has(t);
 const isHors=t==="Hors tournoi";
 return(
 <button key={t} onClick={()=>toggleT(t)}
 style={{padding:"5px 11px",borderRadius:8,border:"1.5px solid "+(isOn?(isHors?"#6B7280":"#7C3AED"):"#1F2937"),
 background:isOn?(isHors?"rgba(107,114,128,0.12)":"rgba(124,58,237,0.12)"):"transparent",
 color:isOn?(isHors?"#9CA3AF":"#A78BFA"):"#6B7280",
 fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",
 transition:"all .15s ease"}}>
 {isHors?<Ic n="ban" s={11}/>:<Ic n="trophy" s={11}/>} {t}
 </button>
 );
 })}
 </div>
 {fTourneys.size>0&&(
 <div style={{fontSize:10,color:"#6B7280",marginTop:6}}>
 {fTourneys.size} sélectionné{fTourneys.size>1?"s":""} — résultats combinés
 </div>
 )}
 </div>
 );
 })()}
 <div style={{display:"flex",gap:9,marginBottom:8}}>
 <button onClick={()=>{setFGames([]);setFBKs([]);setFPlayer("");setFStatus("All");setFOverUnder("All");setFLive(false);setFHeadshot(false);setFDuel(false);setFMinOdds("");setFMaxOdds("");setFMinStake("");setFMaxStake("");setFMapFilter("all");setFRole("All");setFLeague("All");setFTourneys(new Set());setFiltresPage(1);}} style={{flex:1,padding:"11px",background:"#111827",border:"1px solid #1F2937",borderRadius:10,color:"#9CA3AF",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600,fontSize:13}}>
 Réinitialiser
 </button>
 <button onClick={()=>setView("mesparis")} style={{flex:1,padding:"11px",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:10,color:"#fff",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13}}>
 Appliquer →
 </button>
 </div>
 {(()=>{
 const fs=filteredBets;
 const fw=fs.filter(b=>b.status==="won").length;
 const fp=fs.filter(b=>b.status!=="pending").reduce((s,b)=>s+(b.profit||0),0);
 return(
 <div style={{display:"flex",gap:9,marginBottom:14}}>
 <div className="card" style={{flex:1,padding:"10px 12px"}}>
 <div style={{fontSize:11,color:"#9CA3AF",marginBottom:2}}>{fs.length} paris</div>
 <div style={{fontSize:15,fontWeight:700,color:fp>=0?"#00E676":"#EF4444"}}>{fp>=0?"+":""}{fp.toFixed(0)}$</div>
 </div>
 <div className="card" style={{flex:1,padding:"10px 12px"}}>
 <div style={{fontSize:11,color:"#9CA3AF",marginBottom:2}}>Win Rate</div>
 <div style={{fontSize:15,fontWeight:700,color:"#E5E7EB"}}>{fs.length>0?(fw/fs.length*100).toFixed(0):0}%</div>
 </div>
 </div>
 );
 })()}
 <div className="stat-bloc">
 {filteredBets.length===0&&<div style={{padding:"18px 15px",color:"#6B7280",fontSize:13}}>Aucun pari</div>}
 {filteredBets.slice(0,(filtresPage)*FILTRES_PER_PAGE).map(b=>(
 <BetRow key={b.id} bet={b} onStatus={updateStatus} onDelete={deleteBet} onDuplicate={duplicateBet} onEdit={openEdit} onSplit={splitBet} bkPhotos={bkPhotos}/>
 ))}
 </div>
 {filteredBets.length>filtresPage*FILTRES_PER_PAGE&&(
 <button onClick={()=>setFiltresPage(p=>p+1)} style={{width:"100%",padding:"13px",background:"#111827",border:"1px solid #1F2937",borderRadius:12,color:"#9CA3AF",cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600,fontSize:13,marginTop:8}}>
 Voir {filteredBets.length-filtresPage*FILTRES_PER_PAGE} paris de plus
 </button>
 )}
 </div>
 )}


 {/* ADD BET */}
 {view==="add"&&(
 <div className="view-enter" style={{margin:"-16px -14px",padding:"0",minHeight:"calc(100vh - 84px)",background:"radial-gradient(circle at 50% -12%,rgba(42,73,145,.35),transparent 35%),linear-gradient(180deg,#080e1c,#050916 72%)"}}>

 {/* Top bar */}
 <div style={{padding:"14px 16px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
 <div style={{display:"flex",alignItems:"center",gap:12}}>
 <button onClick={()=>setView("home")} style={{background:"none",border:"none",color:"#fff",fontSize:28,cursor:"pointer",lineHeight:1,padding:0,fontFamily:"Inter,sans-serif"}}>‹</button>
 <div>
 <div style={{fontSize:22,fontWeight:900,letterSpacing:-.5,color:"#eef3ff"}}>
 {editingBet?"Modifier pari":duelMode?"Duel ":sessionMode?"Session multi-map":"Ajouter un pari"}
 </div>
 <div style={{fontSize:13,fontWeight:500,color:"#9aa4bb",marginTop:2}}>Configure ton pari esport</div>
 </div>
 </div>
 <div style={{display:"flex",gap:6,alignItems:"center"}}>
 {editingBet&&(
 <button onClick={()=>{setEditingBet(null);setForm({...EMPTY_FORM,datetime:nowDT(),bookmaker:stickyBK?form.bookmaker:""});}}
 style={{fontSize:11,color:"#6B7280",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"6px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600}}>
 × Annuler
 </button>
 )}
 <button onClick={()=>setForm(f=>({...f,isLive:!f.isLive}))}
 style={{padding:"7px 13px",borderRadius:12,border:"1.5px solid "+(form.isLive?"#EF4444":"rgba(255,255,255,0.1)"),background:form.isLive?"#EF4444":"rgba(255,255,255,0.04)",color:form.isLive?"#fff":"#9CA3AF",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 {form.isLive?" LIVE":"LIVE"}
 </button>
 <button onClick={()=>{setDuelMode(v=>!v);setSessionMode(false);}}
 style={{padding:"7px 13px",borderRadius:12,border:"1.5px solid "+(duelMode?"#F59E0B":"rgba(255,255,255,0.1)"),background:duelMode?"rgba(245,158,11,0.12)":"rgba(255,255,255,0.04)",color:duelMode?"#F59E0B":"#9CA3AF",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 <span style={{display:"inline-flex",alignItems:"center",gap:5}}><Ic n="swords" s={13}/>Duel</span>
 </button>
 <button onClick={()=>{setSessionMode(v=>!v);setDuelMode(false);setCasinoMode(false);}}
 style={{padding:"7px 13px",borderRadius:12,border:"1.5px solid "+(sessionMode?"#7C3AED":"rgba(255,255,255,0.1)"),background:sessionMode?"rgba(124,58,237,0.12)":"rgba(255,255,255,0.04)",color:sessionMode?"#A78BFA":"#9CA3AF",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 Multi
 </button>

 </div>
 </div>

 <div style={{padding:"10px 14px 20px"}}>


 {/* DUEL MODE */}
 {duelMode&&(
 <>
 {/* Bookmaker */}
 <div style={{background:"#131525",borderRadius:16,border:"1px solid rgba(245,158,11,0.2)",padding:"14px 16px",marginBottom:10}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
 <span style={{fontSize:12,color:"#9CA3AF",fontWeight:500}}>Bookmaker</span>
 <button onClick={()=>setModalBK(true)} style={{padding:"3px 10px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"#6B7280",fontSize:10,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
 + Nouveau
 </button>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:10,background:"#0D0F1E",borderRadius:12,padding:"12px 14px",border:"1px solid rgba(255,255,255,0.06)"}}>
 {(BK_LOGOS[duelForm.bookmaker]||bkPhotos[duelForm.bookmaker])&&<img src={BK_LOGOS[duelForm.bookmaker]||bkPhotos[duelForm.bookmaker]} alt="" style={{width:28,height:28,borderRadius:7,objectFit:"cover",flexShrink:0}}/>}
 <select value={duelForm.bookmaker} onChange={e=>setDuelForm(f=>({...f,bookmaker:e.target.value}))}
 style={{flex:1,background:"transparent",border:"none",color:duelForm.bookmaker?"#E5E7EB":"#6B7280",fontSize:16,fontFamily:"'Inter',sans-serif",fontWeight:duelForm.bookmaker?600:400,outline:"none",appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}>
 <option value="">Sélectionner...</option>
 {visibleBKs.map(bk=><option key={bk} value={bk} style={{background:"#131525"}}>{bk}</option>)}
 </select>
 <span style={{color:"#6B7280",fontSize:16}}>⌄</span>
 </div>
 </div>

 {/* Joueur 1 vs Joueur 2 */}
 <div style={{background:"#131525",borderRadius:16,border:"1px solid rgba(245,158,11,0.2)",padding:"14px 16px",marginBottom:10}}>
 <div style={{fontSize:12,color:"#F59E0B",fontWeight:700,marginBottom:12,letterSpacing:.5}}> Duel — Plus de kills sur cette map</div>

 {/* Joueurs */}
 <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"start",marginBottom:14}}>
 <div>
 <div style={{fontSize:10,color:"#9CA3AF",marginBottom:6,fontWeight:600}}>Joueur 1</div>
 <PlayerAC value={duelForm.player1} onChange={v=>setDuelForm(f=>({...f,player1:v,winner:""}))} allPlayers={allPlayers} activeTourneys={activeTourneys} betFreq={betFreq} onConfirm={()=>{}}/>
 {duelForm.player1&&findPlayer(duelForm.player1)&&(
 <div style={{marginTop:4,fontSize:10,color:(GAME_CFG[findPlayer(duelForm.player1).game]&&GAME_CFG[findPlayer(duelForm.player1).game].accent)||"#A78BFA",fontWeight:600}}>
 {findPlayer(duelForm.player1).team}
 </div>
 )}
 </div>
 <div style={{fontSize:16,fontWeight:800,color:"#F59E0B",textAlign:"center",paddingTop:22}}>VS</div>
 <div>
 <div style={{fontSize:10,color:"#9CA3AF",marginBottom:6,fontWeight:600}}>Joueur 2</div>
 <PlayerAC value={duelForm.player2} onChange={v=>setDuelForm(f=>({...f,player2:v,winner:""}))} allPlayers={allPlayers} activeTourneys={activeTourneys} betFreq={betFreq} onConfirm={()=>{}}/>
 {duelForm.player2&&findPlayer(duelForm.player2)&&(
 <div style={{marginTop:4,fontSize:10,color:(GAME_CFG[findPlayer(duelForm.player2).game]&&GAME_CFG[findPlayer(duelForm.player2).game].accent)||"#A78BFA",fontWeight:600}}>
 {findPlayer(duelForm.player2).team}
 </div>
 )}
 </div>
 </div>

 {/* Sélection du gagnant — apparaît quand les 2 joueurs sont choisis */}
 {duelForm.player1&&duelForm.player2&&(
 <div style={{marginBottom:14}}>
 <div style={{fontSize:10,color:"#9CA3AF",marginBottom:6,fontWeight:600}}>Qui va avoir le plus de kills ?</div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
 <button onClick={()=>setDuelForm(f=>({...f,winner:"player1"}))}
 style={{padding:"12px 8px",borderRadius:12,border:"2px solid "+(duelForm.winner==="player1"?"#F59E0B":"#1F2937"),background:duelForm.winner==="player1"?"rgba(245,158,11,0.12)":"#111827",color:duelForm.winner==="player1"?"#F59E0B":"#9CA3AF",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all .2s",textTransform:"capitalize"}}>
 {duelForm.player1||"J1"}
 {duelForm.winner==="player1"&&<div style={{fontSize:9,color:"#F59E0B",marginTop:2}}> SÉLECTIONNÉ</div>}
 </button>
 <button onClick={()=>setDuelForm(f=>({...f,winner:"player2"}))}
 style={{padding:"12px 8px",borderRadius:12,border:"2px solid "+(duelForm.winner==="player2"?"#F59E0B":"#1F2937"),background:duelForm.winner==="player2"?"rgba(245,158,11,0.12)":"#111827",color:duelForm.winner==="player2"?"#F59E0B":"#9CA3AF",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all .2s",textTransform:"capitalize"}}>
 {duelForm.player2||"J2"}
 {duelForm.winner==="player2"&&<div style={{fontSize:9,color:"#F59E0B",marginTop:2}}> SÉLECTIONNÉ</div>}
 </button>
 </div>
 </div>
 )}

 {/* Cote unique */}
 <div style={{marginBottom:12}}>
 <div style={{fontSize:10,color:"#9CA3AF",marginBottom:4,fontWeight:600}}>Cote</div>
 <div style={{background:"#0D0F1E",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
 <NumPad value={duelForm.odds} onChange={v=>setDuelForm(f=>({...f,odds:v}))} placeholder="1.50" step="0.01"/>
 </div>
 </div>

 {/* Mise */}
 <div style={{marginBottom:12}}>
 <div style={{fontSize:10,color:"#9CA3AF",marginBottom:4,fontWeight:600}}>Mise ($)</div>
 <div style={{background:"#0D0F1E",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}>
 <NumPad value={duelForm.stake} onChange={v=>setDuelForm(f=>({...f,stake:v}))} placeholder="50" step="1"/>
 </div>
 <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
 {QUICK_STAKES.map(s=>(
 <button key={s} onClick={()=>setDuelForm(f=>({...f,stake:String(s)}))}
 style={{padding:"6px 12px",borderRadius:8,border:"1px solid "+(duelForm.stake===String(s)?"#F59E0B":"#1F2937"),background:duelForm.stake===String(s)?"rgba(245,158,11,0.12)":"#111827",color:duelForm.stake===String(s)?"#F59E0B":"#6B7280",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
 {s}$
 </button>
 ))}
 </div>
 </div>

 {/* Map + Live */}
 <div>
 <div style={{fontSize:10,color:"#9CA3AF",marginBottom:6,fontWeight:600}}>Map</div>
 <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
 {["Map 1","Map 2","Map 3","Map 4","Map 5"].map(m=>(
 <button key={m} onClick={()=>setDuelForm(f=>({...f,mapTag:m}))}
 style={{padding:"7px 14px",borderRadius:20,border:"1.5px solid "+(duelForm.mapTag===m?"#F59E0B":"#1F2937"),background:duelForm.mapTag===m?"rgba(245,158,11,0.1)":"transparent",color:duelForm.mapTag===m?"#F59E0B":"#6B7280",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
 {m}
 </button>
 ))}
 </div>
 <button onClick={()=>setDuelForm(f=>({...f,isLive:!f.isLive}))}
 style={{width:"100%",padding:"9px",borderRadius:10,border:"1.5px solid "+(duelForm.isLive?"#fb7185":"#1F2937"),background:duelForm.isLive?"rgba(251,113,133,0.12)":"transparent",color:duelForm.isLive?"#fb7185":"#6B7280",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
 {duelForm.isLive?<><span style={{width:8,height:8,borderRadius:"50%",background:"#fb7185",display:"inline-block"}}/>LIVE — En cours</> : " Marquer comme Live"}
 </button>
 </div>

 {/* PP kills Duel */}
 <div style={{marginTop:10,background:"rgba(139,92,246,.06)",border:"1px solid rgba(139,92,246,.15)",borderRadius:10,padding:"10px 12px"}}>
 <div style={{fontSize:9,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>PrizePicks — Lignes kills</div>
 <div style={{display:"flex",gap:5,marginBottom:8}}>
 {["Map 1+2","Map 3","Map 1+2+3"].map(function(mt){
 var on=duelForm.ppMapType===mt;
 return <button key={mt} onClick={function(){setDuelForm(function(f){return Object.assign({},f,{ppMapType:on?"":mt,ppLine_player1:"",ppLine_player2:""});});}}
 style={{flex:1,padding:"5px 0",borderRadius:7,border:"1px solid "+(on?"rgba(139,92,246,.4)":"rgba(255,255,255,.07)"),background:on?"rgba(124,58,237,.15)":"transparent",color:on?"#c4b5fd":"#4a5a6e",fontSize:10,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{mt}</button>;
 })}
 </div>
 {duelForm.ppMapType&&(function(){
 // Build options based on map type
 var ranges={"Map 1+2":[0.5,42.5],"Map 3":[0.5,24.0],"Map 1+2+3":[0.5,60.5]};
 var r=ranges[duelForm.ppMapType]||[0.5,42.5];
 var opts=[];
 for(var v=r[0];v<=r[1];v=Math.round((v+0.5)*10)/10)opts.push(v);
 return(
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
 {["player1","player2"].map(function(p){
 var ppLine=parseFloat(duelForm["ppLine_"+p])||null;
 var kills=parseFloat(duelForm[p])||null;
 var edge=kills!==null&&ppLine!==null?ppLine-kills:null;
 var col=edge>=1?"#00E676":edge>=0?"#fbbf24":"#f87171";
 return(
 <div key={p}>
 <div style={{fontSize:9,color:"#4a5a6e",marginBottom:4}}>{p==="player1"?duelForm.player1||"P1":duelForm.player2||"P2"}</div>
 <select value={duelForm["ppLine_"+p]||""}
 onChange={function(e){var v=e.target.value;setDuelForm(function(f){var u={};u["ppLine_"+p]=v;return Object.assign({},f,u);});}}
 style={{width:"100%",background:"rgba(18,12,30,.98)",border:"1px solid rgba(139,92,246,.3)",borderRadius:8,padding:"7px 8px",color:"#c4b5fd",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",cursor:"pointer",boxSizing:"border-box"}}>
 <option value="">Ligne…</option>
 {opts.map(function(v){return <option key={v} value={v}>{v.toFixed(1)}</option>;})}
 </select>
 {edge!==null&&<div style={{fontSize:11,fontWeight:700,color:col,marginTop:4}}>Edge: {edge>=0?"+":""}{edge.toFixed(2)}</div>}
 </div>
 );
 })}
 </div>
 );
 })()}
 </div>
 </div>

 {/* CTA Duel */}
 {(()=>{
 const disabled=!duelForm.player1||!duelForm.player2||!duelForm.odds||!duelForm.stake||!duelForm.bookmaker||!duelForm.winner;
 const missing=[];
 if(!duelForm.bookmaker)missing.push("Bookmaker");
 if(!duelForm.player1)missing.push("Joueur 1");
 if(!duelForm.player2)missing.push("Joueur 2");
 if(!duelForm.winner)missing.push("Gagnant");
 if(!duelForm.odds)missing.push("Cote");
 if(!duelForm.stake)missing.push("Mise");
 return(
 <>
 <button onClick={addDuel} disabled={disabled}
 style={{width:"100%",padding:"17px",background:disabled?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#F59E0B,#EF4444)",border:"none",borderRadius:16,color:disabled?"rgba(255,255,255,0.18)":"#fff",fontSize:16,fontWeight:700,cursor:disabled?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:.3,boxShadow:disabled?"none":"0 8px 28px rgba(245,158,11,0.35)",transition:"all .25s",marginBottom:4}}>
 Enregistrer le duel
 </button>
 {missing.length>0&&(
 <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8,justifyContent:"center"}}>
 {missing.map(f=>(
 <span key={f} style={{fontSize:10,fontWeight:700,color:"#F59E0B",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:5,padding:"2px 7px"}}> {f}</span>
 ))}
 </div>
 )}
 </>
 );
 })()}
 </>
 )}

 {/* Floating label input style helper */}
 {/* Each card: dark rounded box with subtle border + label top-left */}

 {/* 1. BOOKMAKER */}
 {!duelMode&&(()=>{
 return(
 <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
 <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4",letterSpacing:.2}}>
 
 Bookmaker
 </div>
 <div style={{display:"flex",gap:5}}>
 <button onClick={()=>setStickyBK(v=>!v)} style={{padding:"3px 9px",borderRadius:7,border:"1px solid "+(stickyBK?"#7C3AED":"rgba(255,255,255,0.07)"),background:stickyBK?"rgba(124,58,237,0.1)":"transparent",color:stickyBK?"#A78BFA":"#555e72",fontSize:10,cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600}}>
 {stickyBK?" Fixé":" Garder"}
 </button>
 <button onClick={()=>setModalBK(true)} style={{padding:"3px 9px",borderRadius:7,border:"1px solid rgba(255,255,255,0.06)",background:"transparent",color:"#555e72",fontSize:10,cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600}}>+</button>
 </div>
 </div>
 <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:1}}>
 {visibleBKs.map(bk=>{
 const bkLogo=BK_LOGOS[bk]||bkPhotos[bk]||null;
 const isOn=form.bookmaker===bk;
 return(
 <button key={bk} onClick={()=>setForm(f=>({...f,bookmaker:bk}))}
 title={bk}
 style={{minWidth:52,height:52,borderRadius:13,border:"1.5px solid "+(isOn?"#8b5cf6":"rgba(255,255,255,0.07)"),background:isOn?"rgba(139,92,246,0.1)":"rgba(10,18,34,0.9)",cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative",transition:"all .15s",boxShadow:isOn?"0 0 0 1px rgba(139,92,246,.3),0 0 16px rgba(139,92,246,.25),inset 0 0 12px rgba(139,92,246,.06)":"inset 0 1px 0 rgba(255,255,255,.03)"}}>
 {isOn&&<span style={{position:"absolute",top:-7,right:-5,width:18,height:18,borderRadius:"50%",background:"linear-gradient(135deg,#a78bfa,#7c3aed)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:"#fff",boxShadow:"0 2px 8px rgba(139,92,246,.5)"}}><Ic n="check" s={10} c="#fff" w={3.5}/></span>}
 {bkLogo
 ?(<img src={bkLogo} alt={bk} style={{width:30,height:30,borderRadius:7,objectFit:"contain"}}/>)
 :(<span style={{fontSize:10,fontWeight:600,color:isOn?"#c4b5fd":"#5a6478",letterSpacing:.3}}>{bk.slice(0,4)}</span>)}
 </button>
 );
 })}
 </div>
 </div>
 );
 })()}

 {!duelMode&&<>
 {/* 2. JOUEUR */}
 <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:10}}>
 <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4",letterSpacing:.2}}>
 
 Joueur
 </div>
 <button onClick={()=>{setPform({name:"",game:"LoL",league:"",role:"",team:""});setModalPlayer(true);}}
 style={{padding:"3px 9px",borderRadius:7,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"#6B7280",fontSize:10,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
 + Ajouter un joueur
 </button>
 </div>
 {!form.autoInfo&&(
 <div style={{background:"rgba(8,14,28,0.9)",borderRadius:12,border:"1px solid rgba(255,255,255,0.06)",padding:"2px 10px"}}>
 <PlayerAC ref={playerACRef} value={form.player} onChange={v=>{
 const pi=findPlayer(v);
 setForm(f=>({
 ...f,
 player:v,
 autoInfo:pi,
 }));
 }} allPlayers={allPlayers} activeTourneys={activeTourneys} betFreq={betFreq} onConfirm={()=>{setTimeout(()=>{const el=document.getElementById("kills-select");if(el){el.focus();el.click();}else{const odds=document.getElementById("odds-input-field");if(odds)odds.focus();}},80);}}/>
 </div>
 )}
 {form.autoInfo&&(
 <div style={{position:"relative",borderRadius:16,border:"1px solid rgba(139,92,246,.18)",background:"linear-gradient(105deg,rgba(12,18,38,.99) 55%,rgba(20,14,42,.97))",display:"flex",alignItems:"stretch",overflow:"hidden",minHeight:118}}>

 {/* Zone photo (38% de la carte) */}
 <div style={{width:"38%",flexShrink:0,position:"relative",display:"flex",alignItems:"flex-end",justifyContent:"center",overflow:"hidden"}}>
 {/* Logo équipe en filigrane */}
 {(()=>{const tl=teamLogos[(form.autoInfo.team||"")+"__"+(form.autoInfo.game||"")]||form.autoInfo.team_logo_url;return tl?<img src={tl} alt="" onError={e=>e.target.style.display='none'} style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"120%",height:"120%",objectFit:"contain",opacity:.42,zIndex:0,pointerEvents:"none"}}/>:null;})()}
 {/* Glow violet derrière la photo */}
 <div style={{position:"absolute",bottom:"-10%",left:"50%",transform:"translateX(-50%)",width:"80%",height:"90%",background:"radial-gradient(ellipse at 50% 80%,rgba(124,58,237,.35),transparent 70%)",pointerEvents:"none",zIndex:0}}/>
 {(()=>{
 const src=getAvatarSrc(form.autoInfo);
 if(src)return(
 <img
 src={src}
 alt={form.autoInfo.name||form.player}
 style={{
 position:"relative",zIndex:1,
 width:"100%",height:"118px",
 objectFit:"contain",
 objectPosition:"bottom center",
 display:"block",
 filter:"drop-shadow(0 0 12px rgba(124,58,237,.4))",
 }}
 />
 );
 // Avatar par défaut — initiale avec glow
 return(
 <div style={{position:"relative",zIndex:1,width:64,height:64,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:800,color:"#fff",textTransform:"uppercase",marginBottom:16,boxShadow:"0 0 24px rgba(124,58,237,.5)"}}>
 {(form.autoInfo.name||form.player).charAt(0)}
 </div>
 );
 })()}
 {/* Fondu droit pour transition douce vers le texte */}
 <div style={{position:"absolute",top:0,right:0,bottom:0,width:32,background:"linear-gradient(to right,transparent,rgba(12,18,38,.99))",zIndex:2,pointerEvents:"none"}}/>
 </div>

 {/* Infos joueur (droite) */}
 <div style={{flex:1,padding:"14px 12px 12px 6px",display:"flex",flexDirection:"column",justifyContent:"center",gap:6,minWidth:0}}>
 <div style={{fontSize:19,fontWeight:700,letterSpacing:-.3,color:"#f0f4ff",lineHeight:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
 {capName(form.autoInfo.name||form.player)}
 </div>
 <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
 <GameLogo game={form.autoInfo.game} size={16}/>
 {form.autoInfo.team&&(
 <>
 <span style={{color:"#4a5a6e",fontSize:12,fontWeight:300}}>·</span>
 {(()=>{const tl=teamLogos[(form.autoInfo.team||"")+"__"+(form.autoInfo.game||"")]||form.autoInfo.team_logo_url;return tl?<img src={tl} alt={form.autoInfo.team} style={{width:16,height:16,objectFit:"contain",verticalAlign:"middle",marginRight:3,borderRadius:3}} onError={e=>e.target.style.display='none'}/>:null;})()}
 <span style={{fontSize:12,fontWeight:700,color:"#c8d4e8"}}>{form.autoInfo.team}</span>
 </>
 )}
 {form.autoInfo.role&&(
 <>
 <span style={{color:"#4a5a6e",fontSize:12,fontWeight:300}}>·</span>
 <span style={{fontSize:11,color:"#7a8fa8",fontWeight:600}}>{form.autoInfo.role}</span>
 </>
 )}
 </div>
 {(()=>{const t=activeTourneys[form.autoInfo.game];const isExpired=t&&t.end&&new Date(t.end)<new Date();if(!t||isExpired)return null;return <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 7px",borderRadius:5,background:"rgba(124,58,237,.1)",color:"#a78bfa",fontWeight:600,fontSize:10,border:"1px solid rgba(124,58,237,.2)",alignSelf:"flex-start"}}> {t.name}</span>})()}
 </div>

 {/* Bouton Changer */}
 <div style={{padding:"12px 12px 12px 0",display:"flex",alignItems:"flex-start",gap:6,flexShrink:0}}>
 <button onClick={()=>{setForm(f=>({...f,player:"",autoInfo:null}));setTimeout(()=>playerACRef.current&&playerACRef.current.focus(),50);}}
 style={{padding:"6px 10px",borderRadius:9,border:"1px solid rgba(139,92,246,.3)",color:"#9d7bef",fontWeight:500,fontSize:11,background:"rgba(139,92,246,.05)",cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>
 Changer
 </button>
 <button onClick={()=>setAddEditOpen(true)} title="Modifier le joueur" aria-label="Modifier le joueur"
 style={{width:30,height:30,borderRadius:9,border:"1px solid rgba(139,92,246,.3)",background:"rgba(139,92,246,.08)",color:"#c4b5fd",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0}}>
 <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>
 </button>
 </div>
 </div>
 )}
 {form.player&&!form.autoInfo&&<div style={{marginTop:7,fontSize:11,color:"#F59E0B",fontWeight:600}}> Joueur non reconnu — tu peux quand même enregistrer.</div>}
 </div>



 {/* 3. SÉLECTION */}
 <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}>
 <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4",letterSpacing:.2,marginBottom:9}}>
 
 Sélection
 </div>
 {form.autoInfo&&(()=>{
 const game=form.autoInfo.game;
 let opts=[];
 if(game==="CS2"){const kills=Array.from({length:18},(_,i)=>(i+7.5).toFixed(1)+" Kills");const hs=Array.from({length:16},(_,i)=>(i+2.5).toFixed(1)+" Headshots");opts=[...kills,...hs];}
 else if(game==="LoL") opts=Array.from({length:20},(_,i)=>(i+0.5).toFixed(1)+" Kills");
 else if(game==="Dota2") opts=Array.from({length:18},(_,i)=>(i+1.5).toFixed(1)+" Kills");
 else if(game==="Valorant") opts=Array.from({length:18},(_,i)=>(i+7.5).toFixed(1)+" Kills");
 if(form.description&&!opts.includes(form.description)){opts=[form.description,...opts];}
 if(opts.length===0)return null;
 return(
 <div style={{display:"flex",alignItems:"center",gap:8,borderRadius:13,border:"1px solid rgba(255,255,255,.06)",background:"rgba(8,14,28,.9)",overflow:"hidden",height:50}}>
 <div style={{height:"100%",width:46,borderRight:"1px solid rgba(255,255,255,.05)",background:"rgba(255,255,255,.03)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
 <GameLogo game={form.autoInfo.game} size={22}/>
 </div>
 <select id="kills-select" value={form.description} onChange={e=>{const val=e.target.value;const isHS=val.includes("Headshot");setForm(f=>({...f,description:val,isHeadshot:isHS}));if(e.target.value){setTimeout(()=>{const el=document.getElementById("odds-input-field");if(el)el.focus();},80);}}}
 style={{flex:1,height:"100%",background:"transparent",border:"none",padding:"0 12px 0 4px",color:form.description?"#a8c4ff":"#5a6880",fontSize:14,fontFamily:"Inter,sans-serif",fontWeight:500,outline:"none",appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}>
 <option value="" style={{color:"#6B7280",background:"#0d1428"}}>Choisir une ligne...</option>
 {opts.map(o=><option key={o} value={o} style={{color:"#E5E7EB",background:"#0d1428"}}>{o}</option>)}
 </select>
 <span style={{color:"#4b5568",paddingRight:12,fontSize:13,flexShrink:0}}>⌄</span>
 </div>
 );
 })()}
 {!form.autoInfo&&(
 <div style={{height:50,background:"rgba(8,14,28,.6)",borderRadius:13,border:"1px solid rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"center",color:"#4e5a6e",fontSize:13,fontWeight:500}}>
 Sélectionnez d'abord un joueur
 </div>
 )}
 </div>

 {/* 4. TYPE DE PARI */}
 {!sessionMode&&(
 <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}>
 <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4",letterSpacing:.2,marginBottom:9}}>
 
 Type de pari
 </div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
 <button onClick={()=>setForm(f=>({...f,overUnder:"Over"}))}
 style={{height:54,borderRadius:13,border:"1.5px solid "+(form.overUnder==="Over"?"#00E676":"rgba(34,197,94,.2)"),background:form.overUnder==="Over"?"rgba(34,197,94,.14)":"rgba(34,197,94,.03)",color:form.overUnder==="Over"?"#22e875":"#4e7060",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"Inter,sans-serif",letterSpacing:.5,boxShadow:form.overUnder==="Over"?"0 0 28px rgba(34,197,94,.2),inset 0 1px 0 rgba(34,197,94,.15)":"none",transition:"all .15s"}}>
 OVER
 </button>
 <button onClick={()=>setForm(f=>({...f,overUnder:"Under"}))}
 style={{height:54,borderRadius:13,border:"1.5px solid "+(form.overUnder==="Under"?"#3b82f6":"rgba(59,130,246,.2)"),background:form.overUnder==="Under"?"rgba(59,130,246,.14)":"rgba(59,130,246,.03)",color:form.overUnder==="Under"?"#60a5fa":"#3d5270",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"Inter,sans-serif",letterSpacing:.5,boxShadow:form.overUnder==="Under"?"0 0 28px rgba(59,130,246,.2),inset 0 1px 0 rgba(59,130,246,.15)":"none",transition:"all .15s"}}>
 UNDER
 </button>
 </div>
 </div>
 )}
 {/* 5. COTE & MISE */}
 {!sessionMode&&(
 <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}>
 <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4",letterSpacing:.2,marginBottom:9}}>
 
 Cote & Mise
 </div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:9}}>
 <div>
 <div style={{fontSize:9,color:"#4a5468",fontWeight:700,marginBottom:4,letterSpacing:.8,textTransform:"uppercase"}}>Cote</div>
 <div style={{height:48,borderRadius:12,border:"1px solid rgba(255,255,255,.09)",background:"rgba(8,14,28,.95)",display:"flex",alignItems:"center",padding:"0 10px",overflow:"hidden",gap:3}}>
 <span style={{color:"#4a5468",fontSize:13,fontWeight:500,flexShrink:0}}>@</span>
 <NumPad id="odds-input-field" value={form.odds} onChange={v=>setForm(f=>({...f,odds:v}))} placeholder="1.85" step="0.01"/>
 </div>
 </div>
 <div>
 <div style={{fontSize:9,color:"#4a5468",fontWeight:700,marginBottom:4,letterSpacing:.8,textTransform:"uppercase"}}>Mise</div>
 <div style={{height:48,borderRadius:12,border:"1px solid rgba(255,255,255,.09)",background:"rgba(8,14,28,.95)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 10px",overflow:"hidden"}}>
 <NumPad value={form.stake} onChange={v=>setForm(f=>({...f,stake:v}))} placeholder="75" step="1"/>
 <span style={{color:"#4a5468",fontSize:13,fontWeight:500,flexShrink:0,marginLeft:3}}>$</span>
 </div>
 </div>
 </div>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
 <span style={{fontSize:9,color:"#4a5468",fontWeight:700,letterSpacing:.8,textTransform:"uppercase"}}>Mise rapide</span>
 <span style={{fontSize:10,color:"#7a6aae",fontWeight:600}}>1u = {unitValue.toFixed(0)}$ · Palier {bkTier.toFixed(0)}$</span>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:form.odds&&form.stake?9:0}}>
 {quickUnits.map(u=>{
 const s=unitValue*u;
 const sStr=Number.isInteger(s)?String(s):s.toFixed(1);
 const isActive=parseFloat(form.stake)===s;
 return(
 <button key={u} onClick={()=>setForm(f=>({...f,stake:sStr}))}
 style={{height:52,borderRadius:12,border:"1px solid "+(isActive?"rgba(139,92,246,.65)":"rgba(255,255,255,.09)"),background:isActive?"rgba(139,92,246,.2)":"rgba(255,255,255,.03)",color:isActive?"#d4c5ff":"#8892a4",cursor:"pointer",fontFamily:"Inter,sans-serif",boxShadow:isActive?"0 0 16px rgba(139,92,246,.25)":"none",transition:"all .15s",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
 <span style={{fontSize:13,fontWeight:isActive?800:600,letterSpacing:"-.3px"}}>{u}u</span>
 <span style={{fontSize:11,fontWeight:500,color:isActive?"#c4b5fd":"#5a6478"}}>{sStr}$</span>
 </button>
 );
 })}
 </div>
 {form.odds&&form.stake&&(
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:9,borderTop:"1px solid rgba(255,255,255,0.04)"}}>
 <span style={{fontSize:11,color:"#5a6478",fontWeight:500}}>Gain potentiel</span>
 <span style={{fontSize:16,fontWeight:700,color:"#00E676"}}>+{(parseFloat(form.stake||0)*(parseFloat(form.odds||1)-1)).toFixed(2)}$</span>
 </div>
 )}
 </div>
 )}

 {/* SESSION MAPS */}
 {sessionMode&&(
 <div style={{background:"#131525",borderRadius:12,border:"1px solid rgba(124,58,237,0.12)",padding:"8px 12px",marginBottom:6}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
 <span style={{fontSize:12,color:"#9CA3AF",fontWeight:500}}>Maps · Mise défaut</span>
 <div style={{display:"flex",gap:5}}>
 {QUICK_STAKES.map(s=>(
 <button key={s} onClick={()=>setForm(f=>({...f,stake:String(s)}))}
 style={{padding:"3px 8px",borderRadius:8,border:"1px solid "+(parseFloat(form.stake)===s?"#7C3AED":"rgba(255,255,255,0.08)"),background:parseFloat(form.stake)===s?"rgba(124,58,237,0.12)":"transparent",color:parseFloat(form.stake)===s?"#A78BFA":"#6B7280",fontSize:10,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
 {s}$
 </button>
 ))}
 </div>
 </div>
 {sessionMaps.map((m,i)=>(
 <div key={i} style={{padding:"10px 12px",borderRadius:12,border:"1px solid "+(m.enabled?"rgba(124,58,237,0.2)":"rgba(255,255,255,0.04)"),background:m.enabled?"rgba(124,58,237,0.04)":"transparent",marginBottom:7,opacity:m.enabled?1:0.4}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:m.enabled?8:0}}>
 <span style={{fontWeight:600,fontSize:13,color:m.enabled?"#A78BFA":"#4B5563"}}>Map {i+1}</span>
 <div style={{display:"flex",gap:6,alignItems:"center"}}>
 {m.enabled&&(
 <button onClick={()=>setSessionMaps(ms=>ms.map((x,j)=>j===i?{...x,locked:!x.locked}:x))}
 title={m.locked?"Déverrouiller":"Verrouiller cote"}
 style={{background:m.locked?"rgba(245,158,11,0.15)":"transparent",border:"1px solid "+(m.locked?"rgba(245,158,11,0.4)":"rgba(255,255,255,0.08)"),borderRadius:7,padding:"3px 8px",color:m.locked?"#F59E0B":"#4B5563",cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif"}}>
 <Ic n={m.locked?"lock":"unlock"} s={11}/>
 </button>
 )}
 <button onClick={()=>setSessionMaps(ms=>ms.map((x,j)=>j===i?{...x,enabled:!x.enabled,locked:false}:x))}
 style={{background:"none",border:"none",color:m.enabled?"#7C3AED":"#4B5563",fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:700}}>
 {m.enabled?"ON":"OFF"}
 </button>
 </div>
 </div>
 {m.enabled&&(
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
 <NumPad value={m.odds} onChange={v=>setSessionMaps(ms=>ms.map((x,j)=>j===i?{...x,odds:v}:x))} placeholder="Cote" step="0.01"/>
 <NumPad value={m.stake} onChange={v=>setSessionMaps(ms=>ms.map((x,j)=>j===i?{...x,stake:v}:x))} placeholder={form.stake||"Mise"} step="1"/>
 </div>
 )}
 </div>
 ))}
 <button onClick={()=>setSessionMaps(ms=>[...ms,{...EMPTY_MAP_ROW}])} style={{width:"100%",background:"transparent",border:"1px dashed rgba(124,58,237,0.2)",borderRadius:10,padding:"9px",color:"#6B7280",cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif"}}>
 + Ajouter map
 </button>
 </div>
 )}

 {/* 6. MAP TAG */}
 <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}>
 <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4",letterSpacing:.2}}>
 
 Map
 </div>
 {form.mapTag&&(
 <button onClick={()=>setForm(f=>({...f,mapLocked:!f.mapLocked}))}
 style={{background:form.mapLocked?"rgba(245,158,11,0.1)":"transparent",border:"1px solid "+(form.mapLocked?"rgba(245,158,11,.3)":"rgba(255,255,255,0.06)"),borderRadius:7,padding:"3px 9px",color:form.mapLocked?"#F59E0B":"#4B5563",cursor:"pointer",fontSize:11,fontFamily:"Inter,sans-serif",fontWeight:700}}>
 {form.mapLocked?" Locked":" Lock"}
 </button>
 )}
 </div>
 <div style={{display:"flex",gap:7}}>
 {MAP_TAGS.map(t=>(
 <button key={t} onClick={()=>!form.mapLocked&&setForm(f=>({...f,mapTag:f.mapTag===t?"":t}))}
 style={{flex:1,height:40,borderRadius:10,border:"1.5px solid "+(form.mapTag===t?"rgba(245,166,35,.6)":"rgba(255,255,255,.06)"),background:form.mapTag===t?"rgba(245,166,35,.08)":"rgba(255,255,255,.02)",color:form.mapTag===t?"#f5a623":"#5a6478",fontSize:12,cursor:form.mapLocked?"not-allowed":"pointer",fontFamily:"Inter,sans-serif",fontWeight:500,opacity:form.mapLocked&&form.mapTag!==t?0.35:1,transition:"all .12s"}}>
 {t}
 </button>
 ))}
 </div>
 {form.mapLocked&&<div style={{fontSize:10,color:"#F59E0B",marginTop:6,fontWeight:600}}> Map verrouillée pour le prochain pari</div>}
 </div>



 {/* 6b. PRIZEPICKS */}
 {!duelMode&&!form.isLive&&(()=>{
 const game=form.autoInfo&&form.autoInfo.game;
 // PP type = type de ligne PP uniquement, sans lien avec mapTag du pari
 // Map 1+2 : stats cumulées 2 maps → ligne × 2 avec edge
 // Map 3 : stats map unitaire → ligne directe avec edge réduit
 function calcPPLine(baseVal, overUnder, ppType){
 if(!baseVal||!overUnder||!ppType)return null;
 if(ppType==="Map 1+2"){
 const edge = overUnder==="Over" ? 2.0 : 2.5;
 const raw = baseVal * 2 - edge;
 return Math.round(raw * 2) / 2;
 }
 if(ppType==="Map 3"){
 const edge = 1.5;
 const raw = baseVal - edge;
 return Math.round(raw * 2) / 2;
 }
 if(ppType==="Map 1+2+3"){
 // Série complète = base × 3 − edge
 const edge = overUnder==="Over" ? 3.0 : 4.0;
 const raw = baseVal * 3 - edge;
 return Math.round(raw * 2) / 2;
 }
 return null;
 }
 function genOpts(ppType){
 if(!game||!ppType)return[];
 const range=(start,end)=>{
 const r=[];
 for(let v=start;v<=end+0.001;v+=0.5) r.push(parseFloat(v.toFixed(1)));
 return r;
 };
 const isHS=form.isHeadshot;
 if(ppType==="Map 1+2"){
 if(isHS&&(game==="CS2"||game==="Valorant")) return range(4.5,30.5);
 if(game==="CS2"||game==="Valorant") return range(18.5,42.5);
 if(game==="Dota2") return range(1.5,30.5);
 if(game==="LoL") return range(0.5,15.5);
 }
 if(ppType==="Map 3"){
 if(isHS&&(game==="CS2"||game==="Valorant")) return range(2.5,15);
 if(game==="CS2"||game==="Valorant") return range(8.5,26.5);
 if(game==="Dota2") return range(2,13);
 if(game==="LoL") return range(0.5,10.5);
 }
 if(ppType==="Map 1+2+3"){
 if(isHS&&(game==="CS2"||game==="Valorant")) return range(6.5,40);
 if(game==="CS2"||game==="Valorant") return range(28.5,65.0);
 if(game==="Dota2") return range(4,37);
 if(game==="LoL") return range(1,24);
 }
 return[];
 }
 const opts=genOpts(form.ppMapType);
 const baseKills=form.description?parseFloat(form.description):null;
 const autoLine=(baseKills&&!isNaN(baseKills)&&form.overUnder&&form.ppMapType)
 ?calcPPLine(baseKills,form.overUnder,form.ppMapType):null;
 // Valeur courante PP (override manuel ou auto)
 const currentPP=form.ppDescription||(autoLine!==null?autoLine.toFixed(1)+(form.isHeadshot?" Headshots":" Kills"):"" );
 const currentPPVal=currentPP?parseFloat(currentPP):null;
 // Index de la valeur courante dans opts (pour le picker centré)
 const currentIdx=currentPPVal!==null?opts.findIndex(o=>Math.abs(o-currentPPVal)<0.01):-1;
 // Quick PP EV+ difference per game — used as edge in calcPPLine
 const quickPPDiff={CS2:1.5,Dota2:1.75,Valorant:1.75,LoL:1.0};
 const qDiff=quickPPDiff[game]||1.0;
 function quickPP(){
 if(!baseKills||!form.overUnder||!form.ppMapType)return;
 // Use calcPPLine with a base adjusted by the game edge
 // For Over: we want PP line where BK line - PP/2 = diff (Map 1+2) or BK - PP = diff (Map 3)
 // Simplest: just call calcPPLine with baseKills and override the edge
 const ppType=form.ppMapType;
 let ppV;
 if(ppType==="Map 1+2"){
 const edge=form.overUnder==="Over"?qDiff*2:qDiff*2;
 ppV=Math.round((baseKills*2-edge)*2)/2;
 } else if(ppType==="Map 3"){
 ppV=Math.round((baseKills-qDiff)*2)/2;
 } else if(ppType==="Map 1+2+3"){
 ppV=Math.round((baseKills*3-qDiff*3)*2)/2;
 } else {
 ppV=Math.round((baseKills-qDiff)*2)/2;
 }
 const suffix=form.isHeadshot?" Headshots":" Kills";
 setForm(f=>({...f,ppDescription:ppV.toFixed(1)+suffix}));
 }
 return(
 <div style={{background:"linear-gradient(180deg,rgba(14,8,28,.98),rgba(8,4,20,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.35)",padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(107,33,245,.15)"}}>
 {/* Header */}
 <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
 <span style={{fontSize:13,fontWeight:700,color:"#c4b5fd",letterSpacing:.2}}>PrizePicks</span>
 <button onClick={()=>setForm(f=>({...f,ppMapType:f.ppMapType==="HIDE"?"":"HIDE"}))}
 style={{marginLeft:4,padding:"2px 9px",borderRadius:7,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"#4a5a6e",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 Ignorer
 </button>
 {/* Quick PP button */}
 {baseKills&&form.overUnder&&form.ppMapType&&(
 <button onClick={quickPP}
 style={{padding:"3px 10px",borderRadius:7,border:"1px solid rgba(167,139,250,.4)",background:"rgba(124,58,237,.15)",color:"#c4b5fd",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 Quick PP ({form.overUnder==="Over"?"-":"+"}{""+qDiff})
 </button>
 )}
 {(()=>{
 const bk=parseFloat(form.description);
 const line=form.ppDescription?parseFloat(form.ppDescription):autoLine;
 if(!line||isNaN(bk)||!form.ppMapType)return null;
 const ppPerMapB=form.ppMapType==="Map 1+2"?line/2:form.ppMapType==="Map 1+2+3"?line/3:line;
 const edge=(form.overUnder==="Over"?ppPerMapB-bk:bk-ppPerMapB).toFixed(2);
 return(
 <span style={{marginLeft:"auto",fontSize:10,color:"rgba(167,139,250,.7)",fontWeight:600,background:"rgba(139,92,246,.12)",padding:"2px 7px",borderRadius:5,border:"1px solid rgba(139,92,246,.25)"}}>
 Edge {edge>0?"+":""}{edge}
 </span>
 );
 })()}
 </div>

 {/* PP type — Map 1+2 / Map 3 / Map 1+2+3 */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:9}}>
 {["Map 1+2","Map 3","Map 1+2+3"].map(mt=>{
 const isOn=form.ppMapType===mt;
 return(
 <button key={mt} onClick={()=>setForm(f=>({...f,ppMapType:mt,ppDescription:""}))}
 style={{height:52,borderRadius:13,border:"2px solid "+(isOn?"rgba(139,92,246,.8)":"rgba(139,92,246,.15)"),background:isOn?"rgba(139,92,246,0.15)":"rgba(139,92,246,0.03)",cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,boxShadow:isOn?"0 0 20px rgba(139,92,246,.25)":"none"}}>
 <span style={{fontSize:15,fontWeight:800,color:isOn?"#c4b5fd":"#6b5a8a"}}>{mt}</span>
 <span style={{fontSize:9,color:isOn?"rgba(196,181,253,.5)":"#3d2e52",fontWeight:600,letterSpacing:.5,textTransform:"uppercase"}}>{mt==="Map 1+2"?"Combiné":mt==="Map 3"?"Unitaire":"Série"}</span>
 </button>
 );
 })}
 </div>

 {/* Ligne PP */}
 {form.ppMapType&&opts.length>0&&(
 <div>
 {/* Picker centré sur la valeur auto — ±2 valeurs visibles */}
 {(()=>{
 const refIdx=currentIdx>=0?currentIdx:Math.floor(opts.length/2);
 // Afficher 5 valeurs : -2 / -1 / [current] / +1 / +2
 const visible=[-2,-1,0,1,2].map(d=>{
 const idx=refIdx+d;
 if(idx<0||idx>=opts.length)return null;
 return{val:opts[idx],delta:d};
 });
 return(
 <div style={{display:"flex",alignItems:"center",gap:0,borderRadius:13,border:"1px solid rgba(139,92,246,.3)",background:"rgba(139,92,246,.06)",overflow:"hidden",height:56}}>
 <img src={_B64_PP_LOGO_B64}
 onError={e=>{e.target.style.display="none";}}
 alt="PP" style={{width:20,height:20,borderRadius:4,objectFit:"cover",flexShrink:0,margin:"0 10px"}}/>
 <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:0,overflow:"hidden"}}>
 {visible.map((item,i)=>{
 if(!item)return<div key={i} style={{flex:1}}/>;
 const isCurrent=item.delta===0;
 return(
 <button key={item.val} onClick={()=>setForm(f=>({...f,ppDescription:item.val.toFixed(1)+(form.isHeadshot?" Headshots":" Kills")}))}
 style={{flex:isCurrent?2:1,height:"100%",background:isCurrent?"rgba(139,92,246,.2)":"transparent",border:"none",borderLeft:i>0?"1px solid rgba(139,92,246,.1)":"none",cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:0,transition:"all .1s"}}>
 <span style={{fontSize:isCurrent?17:12,fontWeight:isCurrent?800:500,color:isCurrent?"#c4b5fd":"rgba(139,92,246,.4)",lineHeight:1}}>
 {item.val.toFixed(1)}
 </span>
 {isCurrent&&<span style={{fontSize:8,color:"rgba(196,181,253,.4)",marginTop:2,fontWeight:600}}>KILLS</span>}
 </button>
 );
 })}
 </div>
 {/* Override select invisible pour mobile */}
 <div style={{position:"relative",width:36,height:"100%",borderLeft:"1px solid rgba(139,92,246,.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
 <span style={{color:"rgba(139,92,246,.5)",fontSize:14,pointerEvents:"none"}}>⋯</span>
 <select value={form.ppDescription} onChange={e=>setForm(f=>({...f,ppDescription:e.target.value}))}
 style={{position:"absolute",inset:0,opacity:0,width:"100%",height:"100%",cursor:"pointer",fontSize:16}}>
 <option value="">{autoLine!==null?`Auto: ${autoLine.toFixed(1)}`:"Choisir..."}</option>
 {opts.map(o=><option key={o} value={o.toFixed(1)+" Kills"}>{o.toFixed(1)} Kills</option>)}
 </select>
 </div>
 </div>
 );
 })()}
 {/* Reset auto */}
 {form.ppDescription&&autoLine!==null&&(
 <button onClick={()=>setForm(f=>({...f,ppDescription:""}))}
 style={{marginTop:5,width:"100%",background:"none",border:"none",color:"rgba(167,139,250,.35)",fontSize:10,cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600}}>
 ↺ Auto ({autoLine.toFixed(1)} Kills)
 </button>
 )}
 </div>
 )}
 {form.ppMapType&&opts.length===0&&(
 <div style={{height:40,display:"flex",alignItems:"center",justifyContent:"center",color:"#3d2e52",fontSize:12}}>
 {!game?"Sélectionnez d'abord un joueur":"Jeu non supporté"}
 </div>
 )}
 {!form.ppMapType&&(
 <div style={{height:40,display:"flex",alignItems:"center",justifyContent:"center",color:"#3d2e52",fontSize:12,fontWeight:500}}>
 Choisir Map 1+2 ou Map 3
 </div>
 )}
 </div>
 );
 })()}

 {/* 7. STATUT */}
 <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid "+(lockedStatus?"rgba(245,158,11,.25)":"rgba(139,92,246,.2)"),padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}>
 <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4",letterSpacing:.2}}>
 
 État
 </div>
 <button onClick={()=>setLockedStatus(lockedStatus?null:form.status)}
 style={{padding:"3px 9px",background:lockedStatus?"rgba(245,158,11,0.1)":"rgba(255,255,255,0.03)",border:"1px solid "+(lockedStatus?"rgba(245,158,11,.3)":"rgba(255,255,255,0.06)"),borderRadius:7,color:lockedStatus?"#F59E0B":"#555e72",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 {lockedStatus?" Locké":" Locker"}
 </button>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>
 {["pending","won","lost"].map(s=>(
 <button key={s} onClick={()=>{setForm(f=>({...f,status:s}));if(lockedStatus)setLockedStatus(s);}}
 style={{padding:"9px 0",borderRadius:10,border:"1.5px solid "+(form.status===s?STATUS_CFG[s].color+"66":"rgba(255,255,255,0.06)"),background:form.status===s?STATUS_CFG[s].bg:"rgba(255,255,255,0.02)",color:form.status===s?STATUS_CFG[s].color:"#5a6478",fontWeight:500,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 {STATUS_CFG[s].label}{lockedStatus===s?" ":""}
 </button>
 ))}
 </div>
 {lockedStatus&&<div style={{fontSize:10,color:"#F59E0B",marginTop:6,fontWeight:600}}> "{STATUS_CFG[lockedStatus]&&STATUS_CFG[lockedStatus].label}" verrouillé</div>}
 </div>

 {/* CTA */}
 {(()=>{
 const missing=[];
 if(!form.bookmaker) missing.push("Bookmaker");
 if(!form.player) missing.push("Joueur");
 if(!form.overUnder) missing.push("Over/Under");
 if(!form.description) missing.push("Kills");
 if(!form.odds) missing.push("Cote");
 if(!form.stake) missing.push("Mise");
 if(!form.mapTag) missing.push("Map");
 const canAdd=sessionMode?(!form.player||!sessionMaps.some(m=>m.enabled&&m.odds)):missing.length===0;
 const isDisabled=sessionMode?(!form.player||!sessionMaps.some(m=>m.enabled&&m.odds)):missing.length>0;
 const gain=form.odds&&form.stake?(parseFloat(form.stake||0)*(parseFloat(form.odds||1)-1)).toFixed(2):null;
 const ticketReady=!sessionMode&&form.player&&form.description&&form.odds&&form.stake;
 return(
 <>
 {!sessionMode&&missing.length>0&&(
 <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10,padding:"8px 12px",background:"rgba(245,158,11,0.04)",border:"1px solid rgba(245,158,11,0.12)",borderRadius:12,alignItems:"center"}}>
 <span style={{fontSize:10,color:"#6B7280",flexShrink:0}}>Manque :</span>
 {missing.map(f=>(
 <span key={f} style={{fontSize:10,fontWeight:700,color:"#F59E0B",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:6,padding:"2px 8px"}}>
 {f}
 </span>
 ))}
 </div>
 )}

 {/* Mini ticket récap */}
 {ticketReady&&(
 <div style={{marginTop:14,marginBottom:8,borderRadius:14,overflow:"hidden",border:"1px solid rgba(96,165,250,.2)",background:"linear-gradient(135deg,rgba(14,20,38,.98),rgba(8,14,26,.99))"}}>
 {/* Bande top bleue */}
 <div style={{height:2,background:"linear-gradient(90deg,#3b82f6,#7c3aed)"}}/>
 <div style={{padding:"11px 14px",display:"flex",alignItems:"center",gap:12}}>
 {/* Photo miniature + logo équipe */}
 {(()=>{
 const src=getAvatarSrc(form.autoInfo);
 return(
 <div style={{width:90,height:90,flexShrink:0,position:"relative",display:"flex",alignItems:"flex-end",justifyContent:"center",overflow:"hidden",borderRadius:10}}>
 {/* Logo équipe en filigrane */}
 {(form.autoInfo&&form.autoInfo.team_logo_url)&&(
 <img src={form.autoInfo.team_logo_url} alt="" onError={e=>e.target.style.display="none"} style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"75%",height:"75%",objectFit:"contain",opacity:.1,zIndex:0,pointerEvents:"none"}}/>
 )}
 <div style={{position:"absolute",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",height:"80%",background:"radial-gradient(ellipse at 50% 100%,rgba(124,58,237,.3),transparent 70%)",zIndex:0,pointerEvents:"none"}}/>
 {src?(
 <img src={src} alt={(form.autoInfo&&form.autoInfo.name)||form.player} style={{position:"relative",zIndex:1,width:"100%",height:"100%",objectFit:"contain",objectPosition:"bottom center",filter:"drop-shadow(0 0 8px rgba(124,58,237,.35))"}}/>
 ):(
 <div style={{position:"relative",zIndex:1,width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,fontWeight:700,color:"#a78bfa",textTransform:"uppercase"}}>
 {((form.autoInfo&&form.autoInfo.name)||form.player).charAt(0)}
 </div>
 )}
 {/* Badge logo équipe en bas à droite */}
 {(form.autoInfo&&form.autoInfo.team_logo_url)&&(
 <img src={form.autoInfo.team_logo_url} alt="" onError={e=>e.target.style.display="none"} style={{position:"absolute",bottom:2,right:2,width:18,height:18,objectFit:"contain",zIndex:3,filter:"drop-shadow(0 1px 3px rgba(0,0,0,.8))"}}/>
 )}
 </div>
 );
 })()}
 {/* Contenu */}
 <div style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",gap:5}}>
 {/* Ligne 1 : nom joueur (principal) */}
 <div style={{display:"flex",alignItems:"center",gap:6}}>
 <span style={{fontSize:18,fontWeight:800,color:"#f0f4ff",letterSpacing:-.4,lineHeight:1}}>{(form.autoInfo&&form.autoInfo.name)||form.player}</span>
 {(form.autoInfo&&form.autoInfo.team_logo_url)&&(
 <img src={form.autoInfo.team_logo_url} alt="" onError={e=>e.target.style.display="none"} style={{width:14,height:14,objectFit:"contain",opacity:.7,flexShrink:0}}/>
 )}
 </div>
 {/* Ligne 2 : sélection + PP edge */}
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
 <span style={{fontSize:12,fontWeight:500,color:"#7a9cc4",lineHeight:1.3}}>{form.overUnder&&form.description?form.overUnder+" "+form.description.replace(/^(Over|Under)\s/,""):form.description}</span>
 {(()=>{
 const bk=parseFloat(form.description);
 const ppLine=form.ppDescription||(()=>{
 if(!bk||isNaN(bk)||!form.overUnder||!form.ppMapType)return null;
 const edge=form.overUnder==="Over"?2.0:2.5;
 if(form.ppMapType==="Map 1+2") return(Math.round((bk*2-edge)*2)/2).toFixed(1)+(form.isHeadshot?" Headshots":" Kills");
 if(form.ppMapType==="Map 3") return(Math.round((bk-1.5)*2)/2).toFixed(1)+(form.isHeadshot?" Headshots":" Kills");
 return null;
 })();
 if(!ppLine||isNaN(bk)||!form.ppMapType)return null;
 const pp=parseFloat(ppLine);
 const ppPerMapT=form.ppMapType==="Map 1+2"?pp/2:form.ppMapType==="Map 1+2+3"?pp/3:pp;
 const edge=(form.overUnder==="Over"?ppPerMapT-bk:bk-ppPerMapT).toFixed(2);
 return(
 <span style={{fontSize:12,fontWeight:700,color:"#c4b5fd"}}>PP {edge>0?"+":""}{edge}</span>
 );
 })()}
 </div>
 {/* Ligne 3 : cote · mise · bookmaker · gain potentiel */}
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:3,borderTop:"1px solid rgba(255,255,255,.04)"}}>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <div style={{display:"flex",flexDirection:"column",gap:2}}>
 <span style={{fontSize:8,color:"#3d4d62",fontWeight:600,letterSpacing:.5}}>COTE</span>
 <span style={{fontSize:14,fontWeight:700,color:"#e4eaf6"}}>@{form.odds}</span>
 </div>
 <span style={{width:1,height:26,background:"rgba(255,255,255,.06)",flexShrink:0}}/>
 <div style={{display:"flex",flexDirection:"column",gap:2}}>
 <span style={{fontSize:8,color:"#3d4d62",fontWeight:600,letterSpacing:.5}}>MISE</span>
 <span style={{fontSize:14,fontWeight:700,color:"#e4eaf6"}}>{form.stake}$</span>
 </div>
 {form.bookmaker&&BK_LOGOS[form.bookmaker]&&(
 <><span style={{width:1,height:26,background:"rgba(255,255,255,.06)",flexShrink:0}}/>
 <img src={BK_LOGOS[form.bookmaker]} alt={form.bookmaker} style={{width:22,height:22,objectFit:"contain",borderRadius:5,opacity:.9}}/></>
 )}
 {form.bookmaker&&!BK_LOGOS[form.bookmaker]&&(
 <><span style={{width:1,height:26,background:"rgba(255,255,255,.06)",flexShrink:0}}/>
 <span style={{fontSize:10,color:"#5a6478",fontWeight:600}}>{form.bookmaker}</span></>
 )}
 </div>
 {gain&&(
 <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}>
 <span style={{fontSize:8,color:"#3d4d62",fontWeight:600,letterSpacing:.5}}>GAIN POTENTIEL</span>
 <span style={{fontSize:17,fontWeight:800,color:"#22e875",textShadow:"0 0 12px rgba(34,232,117,.3)"}}>+{gain}$</span>
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 )}

 {/* PP edge alert */}
 {(()=>{
 const ppEdge=form.ppEdge;
 if(ppEdge==null||ppEdge>=0||form.ppMapType==="HIDE")return null;
 return(
 <div style={{marginBottom:8,padding:"8px 12px",borderRadius:10,background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.3)",display:"flex",alignItems:"center",gap:8}}>
 <span><Ic n="warn" s={14} c="#f87171"/></span>
 <span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>Edge PP négatif ({ppEdge>0?"+":""}{ppEdge.toFixed(2)}) — EV-</span>
 </div>
 );
 })()}

 {(function(){
 var ppEdge=form.ppEdge;
 if(ppEdge==null||ppEdge>=0||form.ppMapType==="HIDE")return null;
 return(<div style={{marginBottom:8,padding:"8px 12px",borderRadius:10,background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.3)",display:"flex",alignItems:"center",gap:8}}>
 <span><Ic n="warn" s={14} c="#f87171"/></span>
 <span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>Edge PP négatif ({ppEdge>0?"+":""}{ppEdge.toFixed(2)}) — EV-</span>
 </div>);
 })()}
 {(function(){
 var odds=parseFloat(form.odds)||0;
 var k=(form.player||"").toLowerCase().trim();
 var playerBets=(allBetsByPlayer&&allBetsByPlayer[k])||[];
 if(playerBets.length>=5&&odds>1){
 var wr=playerBets.filter(function(b){return b.status==="won";}).length/playerBets.length;
 var ev=wr*odds-1;
 if(ev<0)return(<div style={{marginBottom:8,padding:"8px 12px",borderRadius:10,background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.3)",display:"flex",alignItems:"center",gap:8}}>
 <span><Ic n="warn" s={14} c="#f87171"/></span><span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>EV négatif {(ev*100).toFixed(1)}% sur {k}</span>
 </div>);
 }
 return null;
 })()}
 <button onClick={sessionMode?addSession:addBet} disabled={isDisabled}
 style={{
 width:"100%",height:60,
 border:0,borderRadius:17,
 marginTop:4,marginBottom:8,
 color:"#fff",
 background:isDisabled?"rgba(255,255,255,0.04)":"linear-gradient(135deg,#7c3aed,#6d5dfc)",
 fontSize:16,fontWeight:700,
 cursor:isDisabled?"not-allowed":"pointer",
 fontFamily:"Inter,sans-serif",
 boxShadow:isDisabled?"none":"0 18px 45px rgba(124,58,237,.35)",
 }}>
 {isDisabled?"Complète le formulaire ↑":sessionMode?"Enregistrer session ("+sessionMaps.filter(m=>m.enabled&&m.odds).length+" maps)":editingBet?" Sauvegarder":"⊕ Ajouter le pari"}
 </button>
 {editingBet&&(
 <button onClick={()=>{setEditingBet(null);setForm({...EMPTY_FORM,datetime:nowDT(),bookmaker:stickyBK?form.bookmaker:"",});}}
 style={{width:"100%",padding:"12px",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,color:"#6B7280",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif",marginBottom:8}}>
 × Annuler modification
 </button>
 )}
 </>
 );
 })()}


 </>
 }

 </div>{/* end padding wrapper */}
 </div>
 )}


 {/* STATS */}
 {view==="statistiques"&&(
 <div className="view-enter" style={{display:statsDrill?"none":"block"}}>
 <div style={{fontSize:16,fontWeight:800,textTransform:"uppercase",letterSpacing:1.5,color:"#dce8ff",marginBottom:14}}>Statistiques</div>

 {/* TAB BAR : APERÇU / JEUX / JOUEURS / TOURNOIS / PLUS */}
 <div style={{display:"flex",gap:18,marginBottom:16,borderBottom:"1px solid rgba(255,255,255,.07)",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
 {[{k:"apercu",l:"Aperçu"},{k:"jeux",l:"Jeux"},{k:"tournois",l:"Tournois"},{k:"cote_bk",l:"Cotes & BK"},{k:"diagnostic",l:"Diagnostic"},{k:"spots",l:"Spots"},{k:"analyse",l:"Analyse"},{k:"plus",l:"Plus"}].map(t=>{
 const on=statsTab===t.k;
 return(
 <button key={t.k} onClick={()=>setStatsTab(t.k)}
 style={{background:"none",border:"none",padding:"0 0 10px",color:on?"#A78BFA":"#6B7280",fontSize:12,fontWeight:800,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap",borderBottom:"2px solid "+(on?"#A78BFA":"transparent"),transition:"all .15s"}}>
 {t.l}
 </button>
 );
 })}
 </div>

 {/* TESTING PANEL */}
 {statsTab==="plus"&&testingOpen&&(()=>{
       const allTourneys=useMemo(()=>[...new Set(settled.map(b=>b.tournament||"Hors tournoi"))].sort(),[settled]);
       const allLeagues=useMemo(()=>[...new Set(settled.map(b=>b.league).filter(Boolean))].sort(),[settled]);
 const f=testFilterDraft;

 // Check if draft differs from applied
 const setsEqual=(a,b)=>a.size===b.size&&[...a].every(v=>b.has(v));
 const isDirty=(
 !setsEqual(f.games,testFilter.games)||
 f.headshot!==testFilter.headshot||
 f.live!==testFilter.live||
 f.overUnder!==testFilter.overUnder||
 f.oddsMin!==testFilter.oddsMin||
 f.oddsMax!==testFilter.oddsMax||
 f.ppEdgeMin!==testFilter.ppEdgeMin||
 f.ppEdgeMax!==testFilter.ppEdgeMax||
 !setsEqual(f.hideTourneys,testFilter.hideTourneys)||
 !setsEqual(f.hideLeagues,testFilter.hideLeagues)||
 !setsEqual(f.hideRoles,testFilter.hideRoles)
 );

 // Count applied filters
 const appliedCount=[
 testFilter.games.size<4,
 testFilter.headshot!=="all",
 testFilter.live!=="all",
 testFilter.overUnder!=="all",
 testFilter.oddsMin||testFilter.oddsMax,
 testFilter.hideTourneys.size>0,
 testFilter.hideLeagues.size>0,
 testFilter.hideRoles.size>0,
 testFilter.ppEdgeMin||testFilter.ppEdgeMax,
 ].filter(Boolean).length;

 const Sec=({label,children})=>(
 <div style={{marginBottom:12}}>
 <div style={{fontSize:9,color:"#8a7a5e",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{label}</div>
 {children}
 </div>
 );
 const chip=(on)=>({padding:"5px 12px",borderRadius:8,border:"1px solid "+(on?"rgba(251,191,36,.5)":"rgba(255,255,255,.08)"),background:on?"rgba(251,191,36,.15)":"rgba(255,255,255,.02)",color:on?"#fbbf24":"#6B7280",fontSize:11,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"});
 const redChip=(on)=>({padding:"5px 12px",borderRadius:8,border:"1px solid "+(on?"rgba(239,68,68,.5)":"rgba(255,255,255,.08)"),background:on?"rgba(239,68,68,.12)":"rgba(255,255,255,.02)",color:on?"#f87171":"#6B7280",fontSize:11,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"});
 const inp={background:"rgba(0,0,0,.4)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"6px 10px",color:"#fbbf24",fontSize:12,fontFamily:"Inter,sans-serif",outline:"none",width:"100%",boxSizing:"border-box"};
 const set=(key,val)=>setTestFilterDraft(prev=>({...prev,[key]:val}));
 const toggleSet=(key,val)=>setTestFilterDraft(prev=>{const s=new Set(prev[key]);s.has(val)?s.delete(val):s.add(val);return{...prev,[key]:s};});

 return(
 <div style={{marginBottom:14,padding:14,background:"rgba(16,14,8,.97)",border:"1px solid rgba(251,191,36,.25)",borderRadius:16}}>

 {/* Header */}
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,paddingBottom:10,borderBottom:"1px solid rgba(251,191,36,.1)"}}>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <span style={{fontSize:18}}><Ic n="flask" s={18} c="#fbbf24"/></span>
 <div>
 <div style={{fontSize:13,color:"#fbbf24",fontWeight:800}}>MODE TEST</div>
 <div style={{fontSize:10,color:"#6a5a3e"}}>Configure puis applique</div>
 </div>
 </div>
 {appliedCount>0&&(
 <div style={{display:"flex",alignItems:"center",gap:5}}>
 <div style={{width:7,height:7,borderRadius:"50%",background:"#22C55E",boxShadow:"0 0 6px #22C55E"}}/>
 <span style={{fontSize:10,color:"#22C55E",fontWeight:700}}>{appliedCount} filtre{appliedCount>1?"s":""} actif{appliedCount>1?"s":""}</span>
 </div>
 )}
 </div>

 {/* JEUX */}
 <Sec label="Jeux inclus">
 <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
 {["CS2","LoL","Dota2","Valorant"].map(g=>{
 const on=f.games.has(g);
 return(
 <button key={g} onClick={()=>{const ng=new Set(f.games);on?ng.delete(g):ng.add(g);set("games",ng);}}
 style={{...chip(on),display:"flex",alignItems:"center",gap:4}}>
 <GameLogo game={g} size={11}/>{on?" ":""} {g}
 </button>
 );
 })}
 </div>
 </Sec>

 {/* DIRECTION */}
 <Sec label="Direction">
 <div style={{display:"flex",gap:5}}>
 {[["all","Tous"],["over"," Over"],["under"," Under"]].map(([v,l])=>(
 <button key={v} onClick={()=>set("overUnder",v)} style={chip(f.overUnder===v)}>{l}</button>
 ))}
 </div>
 </Sec>

 {/* HEADSHOT + LIVE */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
 <Sec label="Headshots">
 <div style={{display:"flex",gap:4}}>
 {[["all","Tous"],["yes"," HS"],["no"," HS"]].map(([v,l])=>(
 <button key={v} onClick={()=>set("headshot",v)} style={{...chip(f.headshot===v),flex:1,textAlign:"center",padding:"4px 0"}}>{l}</button>
 ))}
 </div>
 </Sec>
 <Sec label="Live">
 <div style={{display:"flex",gap:4}}>
 {[["all","Tous"],["yes",""],["no",""]].map(([v,l])=>(
 <button key={v} onClick={()=>set("live",v)} style={{...chip(f.live===v),flex:1,textAlign:"center",padding:"4px 0"}}>{l===""?" Live":l===""?" Live":l}</button>
 ))}
 </div>
 </Sec>
 </div>

 {/* COTES */}
 <Sec label="Cote (min → max)">
 <div style={{display:"flex",gap:6,alignItems:"center"}}>
 <input type="number" inputMode="decimal" step="0.01" placeholder="Min 1.5" value={f.oddsMin} onChange={e=>set("oddsMin",e.target.value)} style={{...inp,flex:1}}/>
 <span style={{color:"#4a5a6e",flexShrink:0}}>→</span>
 <input type="number" inputMode="decimal" step="0.01" placeholder="Max 2.0" value={f.oddsMax} onChange={e=>set("oddsMax",e.target.value)} style={{...inp,flex:1}}/>
 </div>
 </Sec>

 {/* PP EDGE */}
 <Sec label="Edge PP (valeur abs. min → max)">
 <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
 <input type="number" inputMode="decimal" step="0.1" placeholder="Min 0.5" value={f.ppEdgeMin} onChange={e=>set("ppEdgeMin",e.target.value)} style={{...inp,flex:1}}/>
 <span style={{color:"#4a5a6e",flexShrink:0}}>→</span>
 <input type="number" inputMode="decimal" step="0.1" placeholder="Max 3.0" value={f.ppEdgeMax} onChange={e=>set("ppEdgeMax",e.target.value)} style={{...inp,flex:1}}/>
 </div>
 <div style={{fontSize:9,color:"#5a4a30"}}>Paris sans edge PP toujours inclus si vide</div>
 </Sec>

 {/* POSITIONS */}
 {(()=>{
 const PRESET=["Top Laner","Jungler","Mid Laner","Bot Laner","Support","Carry","Offlane","Hard Support","AWPer","Rifler","IGL","Duelist","Initiator","Sentinel","Entry"];
 const extra=[...new Set(settled.map(b=>b.role).filter(Boolean))];
 const merged=[...new Set([...PRESET,...extra])].sort();
 return(
 <Sec label={`Masquer positions${f.hideRoles.size>0?` · ${f.hideRoles.size} `:""}`}>
 <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
 {merged.map(r=>{
 const on=f.hideRoles.has(r);
 return <button key={r} onClick={()=>toggleSet("hideRoles",r)} style={redChip(on)}>{on?" ":""}{r}</button>;
 })}
 </div>
 </Sec>
 );
 })()}

 {/* LIGUES */}
 {allLeagues.length>0&&(
 <Sec label={`Masquer ligues${f.hideLeagues.size>0?` · ${f.hideLeagues.size} `:""}`}>
 <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
 {allLeagues.map(l=>{
 const on=f.hideLeagues.has(l);
 return <button key={l} onClick={()=>toggleSet("hideLeagues",l)} style={redChip(on)}>{on?" ":""}{l}</button>;
 })}
 </div>
 </Sec>
 )}

 {/* TOURNOIS */}
 {allTourneys.length>0&&(
 <Sec label={`Masquer tournois${f.hideTourneys.size>0?` · ${f.hideTourneys.size} `:""}`}>
 <div style={{display:"flex",gap:5,flexWrap:"wrap",maxHeight:130,overflowY:"auto"}}>
 {allTourneys.map(t=>{
 const on=f.hideTourneys.has(t);
 return <button key={t} onClick={()=>toggleSet("hideTourneys",t)} style={redChip(on)}>{on?" ":""}{t}</button>;
 })}
 </div>
 </Sec>
 )}

 {/* BOUTONS APPLY + RESET */}
 <div style={{display:"flex",gap:8,marginTop:8}}>
 <button onClick={()=>{setTestFilter({...testFilterDraft,games:new Set(testFilterDraft.games),hideTourneys:new Set(testFilterDraft.hideTourneys),hideLeagues:new Set(testFilterDraft.hideLeagues),hideRoles:new Set(testFilterDraft.hideRoles)});}}
 style={{flex:1,padding:"11px",borderRadius:10,border:"none",background:isDirty?"linear-gradient(135deg,#d4a017,#f5c842)":"rgba(251,191,36,.15)",color:isDirty?"#1a1000":"#6a5a3e",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"Inter,sans-serif",letterSpacing:.3,boxShadow:isDirty?"0 2px 12px rgba(212,160,23,.4)":"none",transition:"all .2s"}}>
 {isDirty?" Appliquer le test":" Déjà appliqué"}
 </button>
 <button onClick={()=>{setTestFilterDraft(DEFAULT_TEST_FILTER);setTestFilter(DEFAULT_TEST_FILTER);}}
 style={{padding:"11px 14px",borderRadius:10,border:"1px solid rgba(251,191,36,.15)",background:"transparent",color:"#6a5a3e",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 ↺ Reset
 </button>
 </div>

 {isDirty&&<div style={{marginTop:8,fontSize:10,color:"#f59e0b",textAlign:"center",opacity:.7}}>Changements non appliqués — clique sur Appliquer</div>}
 </div>
 );
 })()}

 {statsTab==="plus"&&(
 <div style={{marginBottom:16,display:"flex",flexDirection:"column",gap:8}}>


 <button onClick={()=>setTestingOpen(v=>!v)}
 style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:testingOpen?"rgba(251,191,36,.1)":"#111827",border:"1px solid "+(testingOpen?"rgba(251,191,36,.4)":"#1F2937"),borderRadius:12,padding:"12px 14px",color:testingOpen?"#fbbf24":"#dce8ff",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:700}}>
 Mode Test
 <span style={{fontSize:11,opacity:.6}}><Ic n={testingOpen?"up":"down"} s={12}/></span>
 </button>
 <button onClick={exportCSV} style={{display:"flex",alignItems:"center",gap:8,background:"#111827",border:"1px solid #1F2937",borderRadius:12,padding:"12px 14px",color:"#dce8ff",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:700,textAlign:"left"}}> Exporter en CSV</button>
 <button onClick={exportJSON} style={{display:"flex",alignItems:"center",gap:8,background:"#111827",border:"1px solid #1F2937",borderRadius:12,padding:"12px 14px",color:"#dce8ff",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:700,textAlign:"left"}}> Exporter en JSON</button>
 <button onClick={downloadBackup} disabled={backingUp} style={{display:"flex",alignItems:"center",gap:8,background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:12,padding:"12px 14px",color:"#00E676",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:600}}>
 <Ic n="down" s={14} w={2.6}/>{backingUp?"Sauvegarde en cours…":"Télécharger une sauvegarde complète (toutes les données)"}
 </button>
 <label style={{display:"flex",alignItems:"center",gap:8,background:"#111827",border:"1px solid #1F2937",borderRadius:12,padding:"12px 14px",color:"#dce8ff",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:700}}>
 Importer un JSON
 <input type="file" accept=".json" style={{display:"none"}} onChange={e=>{if(e.target.files[0])importJSON(e.target.files[0]);e.target.value="";}}/>
 </label>
 </div>
 )}

 {statsTab==="apercu"&&<>
 {settled.length>0&&(()=>{
 const totalStaked=settledFiltered.reduce((s,b)=>s+(b.stake||0),0);
 const globalROI=totalStaked>0?(totalProfit/totalStaked*100):0;
 const globalWR=settledFiltered.length>0?(settledFiltered.filter(b=>b.status==="won").length/settledFiltered.length*100):0;
 return(
 <div style={{marginBottom:14}}>
 {/* Ligne 1 — Profit + ROI */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
 <div style={{background:"linear-gradient(135deg,rgba(34,197,94,.08),rgba(16,185,129,.04))",border:"1px solid rgba(34,197,94,.15)",borderRadius:14,padding:"14px",position:"relative",overflow:"hidden"}}>
 <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#00E676,#16a34a)"}}/>
 <div style={{fontSize:8,color:"#4a6a50",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,fontWeight:700}}>Profit net</div>
 <div style={{fontSize:24,fontWeight:800,color:totalProfit>=0?"#22C55E":"#EF4444",letterSpacing:-.5,lineHeight:1}}>{totalProfit>=0?"+":""}{totalProfit.toFixed(0)}$</div>
 <div style={{fontSize:10,color:"#4a6a50",marginTop:4,fontWeight:500}}>{settledFiltered.length} paris résolus</div>
 </div>
 <div style={{background:"linear-gradient(135deg,rgba(59,130,246,.08),rgba(99,102,241,.04))",border:"1px solid rgba(59,130,246,.15)",borderRadius:14,padding:"14px",position:"relative",overflow:"hidden"}}>
 <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#3b82f6,#6366f1)"}}/>
 <div style={{fontSize:8,color:"#3a5270",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,fontWeight:700}}>ROI global</div>
 <div style={{fontSize:24,fontWeight:800,color:globalROI>=0?"#60a5fa":"#EF4444",letterSpacing:-.5,lineHeight:1}}>{globalROI>=0?"+":""}{globalROI.toFixed(1)}%</div>
 <div style={{fontSize:10,color:"#3a5270",marginTop:4,fontWeight:500}}>{totalStaked.toFixed(0)}$ misés</div>
 </div>
 </div>
 {/* Ligne 2 — WR + Série/Meilleur mois */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
 <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"12px 14px"}}>
 <div style={{fontSize:8,color:"#5a6880",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,fontWeight:700}}>Win Rate</div>
 <div style={{fontSize:24,fontWeight:800,color:globalWR>=55?"#22C55E":globalWR<45?"#EF4444":"#9CA3AF",letterSpacing:-.5,lineHeight:1}}>{globalWR.toFixed(1)}%</div>
 <div style={{fontSize:10,color:"#4a5a6e",marginTop:4,fontWeight:500}}>{settledFiltered.filter(b=>b.status==="won").length}W · {settledFiltered.filter(b=>b.status==="lost").length}L</div>
 </div>
 <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"12px 14px"}}>
 <div style={{fontSize:8,color:"#5a6880",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,fontWeight:700}}>{currentStreak>1?"Série en cours":"Meilleur mois"}</div>
 {currentStreak>1
 ? <><div style={{fontSize:24,fontWeight:800,color:streakType==="won"?"#22C55E":"#EF4444",letterSpacing:-.5,lineHeight:1}}>{currentStreak}</div><div style={{fontSize:10,color:"#4a5a6e",marginTop:4,fontWeight:500}}>{streakType==="won"?"victoires":"défaites"} consécutives</div></>
 : bestMonth
 ? <><div style={{fontSize:20,fontWeight:800,color:"#22C55E",letterSpacing:-.3,lineHeight:1}}>+{bestMonth[1].toFixed(0)}$</div><div style={{fontSize:10,color:"#4a6a50",marginTop:4,fontWeight:500}}>{bestMonth[0]}</div></>
 : <div style={{fontSize:20,fontWeight:800,color:"#3a4a5e"}}>—</div>
 }
 </div>
 </div>
 </div>
 );
 })()}




 {/* GRAPHIQUES BANKROLL */}
 {settled.length>=2&&(
 <div style={{marginBottom:16}}>
 <div style={{background:"linear-gradient(180deg,rgba(10,18,34,.98),rgba(6,12,24,.99))",border:"1px solid rgba(99,130,200,.15)",borderRadius:16,padding:"14px 16px",boxShadow:"0 8px 32px rgba(0,0,0,.3)"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
 <div>
 <div style={{fontSize:9,color:"#4a5a6e",textTransform:"uppercase",letterSpacing:1.2,fontWeight:700,marginBottom:2}}>Bankroll cumulative</div>
 <div style={{fontSize:22,fontWeight:800,color:totalProfit>=0?"#22C55E":"#EF4444",letterSpacing:-.5}}>{totalProfit>=0?"+":""}{totalProfit.toFixed(0)}$</div>
 </div>
 <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}>
 <div style={{textAlign:"right"}}>
 <div style={{fontSize:9,color:"#4a5a6e",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:2}}>Paris</div>
 <div style={{fontSize:14,fontWeight:700,color:"#7a9cc4"}}>{settledFiltered.length}</div>
 </div>
 {/* Chart mode toggle */}
 <div style={{display:"flex",gap:4,background:"rgba(0,0,0,.3)",borderRadius:8,padding:3}}>
 {[{k:"line",l:""},{k:"candle",l:""} ].map(({k,l})=>(
 <button key={k} onClick={()=>setStatsChartMode(k)}
 style={{padding:"4px 10px",borderRadius:6,border:"none",background:statsChartMode===k?"rgba(96,165,250,.2)":"transparent",color:statsChartMode===k?"#60a5fa":"#4a5a6e",fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:statsChartMode===k?700:400}}>
 {l}
 </button>
 ))}
 </div>
 </div>
 </div>
 {statsChartMode==="line"?(
 <BankrollChart points={chartPoints} h={155}/>
 ):(
 <div>
 <div style={{display:"flex",gap:4,marginBottom:8}}>
 {[{k:"day",l:"1J"},{k:"week",l:"1S"},{k:"month",l:"1M"}].map(({k,l})=>(
 <button key={k} onClick={()=>setCandleTF(k)}
 style={{padding:"3px 9px",borderRadius:6,border:"1px solid "+(candleTF===k?"rgba(167,139,250,.4)":"rgba(255,255,255,.07)"),background:candleTF===k?"rgba(124,58,237,.15)":"transparent",color:candleTF===k?"#c4b5fd":"#4a5a6e",fontSize:10,fontWeight:candleTF===k?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 {l}
 </button>
 ))}
 <span style={{fontSize:9,color:"#3a4a5e",alignSelf:"center",marginLeft:4}}>Vert = haussier · Rouge = baissier</span>
 </div>
 <CandleChart points={chartPoints} h={155} tf={candleTF}/>
 </div>
 )}
 </div>
 </div>
 )}

 {/* Période filter */}
 <div style={{display:"flex",gap:6,marginBottom:14}}>
 {[{d:null,l:"Tout"},{d:3,l:"3j"},{d:7,l:"7j"},{d:14,l:"14j"},{d:30,l:"30j"}].map(({d,l})=>(
 <button key={l} onClick={()=>setStatsPeriod(d)}
 style={{flex:1,padding:"7px 0",borderRadius:8,border:"1.5px solid "+(statsPeriod===d?"#60A5FA":"#1F2937"),background:statsPeriod===d?"rgba(96,165,250,0.12)":"#111827",color:statsPeriod===d?"#60A5FA":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all .15s"}}>
 {l}
 </button>
 ))}
 </div>


 {/* COMPARATEUR GLOBAL OVER/UNDER */}
 {(globalOverUnderStats.overS||globalOverUnderStats.underS)&&(
 <div style={{background:"linear-gradient(135deg,rgba(10,16,30,.98),rgba(8,14,24,.99))",border:"1px solid rgba(99,130,200,.12)",borderRadius:16,padding:"12px 14px",marginBottom:16}}>
 <div style={{fontSize:10,color:"#4a5a6e",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>Over / Under — Tous jeux</div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
 {[{key:"over",label:" Over",s:globalOverUnderStats.overS,color:"#22C55E",bg:"rgba(34,197,94,0.05)",border:"rgba(34,197,94,0.12)",activeBorder:"rgba(34,197,94,0.45)"},{key:"under",label:" Under",s:globalOverUnderStats.underS,color:"#60a5fa",bg:"rgba(59,130,246,0.05)",border:"rgba(59,130,246,0.12)",activeBorder:"rgba(96,165,250,0.45)"}].map(({key,label,s,color,bg,border,activeBorder})=>{
 if(!s)return null;
 const active=ouDrill===key;
 return(
 <div key={key} onClick={()=>setOuDrill(active?null:key)}
 style={{background:active?bg:"rgba(255,255,255,.02)",borderRadius:11,padding:"9px 11px",border:"1px solid "+(active?activeBorder:border),cursor:"pointer",transition:"all .15s",position:"relative"}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
 <span style={{fontSize:11,fontWeight:800,color,letterSpacing:.3}}>{label}</span>
 <span style={{fontSize:9,color:active?color:"#4a5a6e",opacity:.8}}>{active?" Fermer":" Détail"}</span>
 </div>
 <div style={{display:"flex",flexDirection:"column",gap:3}}>
 <div style={{display:"flex",justifyContent:"space-between"}}>
 <span style={{fontSize:10,color:"#5a6a7e"}}>Paris</span>
 <span style={{fontSize:10,fontWeight:700,color:"#c8d4e8"}}>{s.count}</span>
 </div>
 <div style={{display:"flex",justifyContent:"space-between"}}>
 <span style={{fontSize:10,color:"#5a6a7e"}}>Win Rate</span>
 <span style={{fontSize:10,fontWeight:700,color:s.wr>=55?"#22C55E":s.wr<45?"#EF4444":"#9CA3AF"}}>{s.wr.toFixed(1)}%</span>
 </div>
 <div style={{display:"flex",justifyContent:"space-between"}}>
 <span style={{fontSize:11,color:"#9CA3AF"}}>ROI</span>
 <span style={{fontSize:11,fontWeight:700,color:s.roi>=0?"#22C55E":"#EF4444"}}>{s.roi>=0?"+":""}{s.roi.toFixed(1)}%</span>
 </div>
 <div style={{display:"flex",justifyContent:"space-between"}}>
 <span style={{fontSize:11,color:"#9CA3AF"}}>Profit</span>
 <FmtProfit v={s.profit} fontSize={13}/>
 </div>
 </div>
 <div style={{marginTop:8,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden"}}>
 <div style={{height:"100%",width:s.wr+"%",background:s.wr>=55?"linear-gradient(90deg,#22C55E,#22C55E)":s.wr<45?"linear-gradient(90deg,#EF4444,#EF4444)":"linear-gradient(90deg,#9CA3AF,#6B7280)",borderRadius:2,transition:"width .5s ease"}}/>
 </div>
 </div>
 );
 })}
 </div>

 {/* DRILL-DOWN PAR JEU */}
 {ouDrill&&(()=>{
 const byGame=ouDrill==="over"?globalOverUnderStats.overByGame:globalOverUnderStats.underByGame;
 if(!byGame||byGame.length===0)return null;
 const color=ouDrill==="over"?"#22C55E":"#60a5fa";
 const maxAbs=Math.max(...byGame.map(g=>Math.abs(g.profit)));
 return(
 <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,.06)"}}>
 <div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",marginBottom:8}}>
 Résultats par jeu — {ouDrill==="over"?"Over":"Under"}
 </div>
 <div style={{display:"flex",flexDirection:"column",gap:6}}>
 {byGame.map(g=>{
 const barW=maxAbs>0?Math.abs(g.profit)/maxAbs*100:0;
 const pos=g.profit>=0;
 return(
 <div key={g.game} style={{background:"rgba(255,255,255,.02)",borderRadius:10,padding:"8px 10px",border:"1px solid rgba(255,255,255,.04)"}}>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}>
 <div style={{display:"flex",alignItems:"center",gap:6}}>
 <GameLogo game={g.game} size={14}/>
 <span style={{fontSize:12,fontWeight:700,color:"#E5E7EB"}}>{g.game}</span>
 <span style={{fontSize:10,color:"#4a5a6e"}}>{g.count}p · {g.wr.toFixed(0)}% WR</span>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <span style={{fontSize:10,fontWeight:700,color:pos?"#22C55E":"#EF4444"}}>{pos?"+":""}{g.roi.toFixed(1)}% ROI</span>
 <FmtProfit v={g.profit} fontSize={12}/>
 </div>
 </div>
 {/* Barre de profit */}
 <div style={{height:3,background:"rgba(255,255,255,.05)",borderRadius:2,overflow:"hidden"}}>
 <div style={{height:"100%",width:barW+"%",background:pos?"#22C55E":"#EF4444",borderRadius:2,opacity:.7}}/>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
 })()}
 </div>
 )}






 {/* PP ANALYTICS HUB */}
 {(()=>{
 const ppBets=settledFiltered.filter(b=>b.ppLine&&b.ppMapType&&b.status!=="pending");
 if(ppBets.length===0)return null;

 const mkS=()=>({cnt:0,won:0,profit:0,staked:0,oddsSum:0});
 const addS=(t,b)=>{t.cnt++;t.profit+=b.profit;t.staked+=b.stake;t.oddsSum+=(b.odds||0);if(b.status==="won")t.won++;};
 const calc=(t)=>{
 if(!t||t.cnt===0)return null;
 const wr=Math.round(t.won*100/t.cnt);
 const roi=t.staked>0?Math.round(t.profit*1000/t.staked)/10:0;
 const avgOdds=t.cnt>0?Math.round(t.oddsSum*100/t.cnt)/100:0;
 const avgStake=t.cnt>0?Math.round(t.staked/t.cnt):0;
 const ev=Math.round(((wr/100)*avgOdds-1)*1000)/10;
 return{cnt:t.cnt,wr,roi,profit:t.profit,staked:t.staked,avgOdds,avgStake,ev};
 };
 const roiColor=r=>r>=15?"#00E676":r>=5?"#4ade80":r>=-5?"#fbbf24":r>=-15?"#f97316":"#f87171";
 const roiBg=r=>r>=15?"rgba(0,230,118,.18)":r>=5?"rgba(74,222,128,.1)":r>=-5?"rgba(251,191,36,.08)":r>=-15?"rgba(249,115,22,.12)":"rgba(248,113,113,.14)";
 function snapE(e){return Math.round(e*4)/4;}
 function snapE6(e){return Math.round(e*6)/6;}
 const fmt=(v,unit)=>(v>=0?"+":"-")+Math.abs(unit==="$"?Math.round(v):unit==="%"?Math.abs(v).toFixed(1):Math.abs(v).toFixed(2))+(unit||"");

 const GAMES=["CS2","Dota2","LoL","Valorant"].filter(g=>ppBets.some(b=>b.game===g));
 const MAP_TYPES=["Map 1+2","Map 3","Map 1+2+3"];

 // Apply filters to ppBets for matrix
 const ppBetsFiltered=ppBets.filter(function(b){
 if(ppOUApplied&&b.overUnder!==ppOUApplied)return false;
 if(ppMapFilterApplied&&b.mapTag!==ppMapFilterApplied)return false;
 return true;
 });
 // matrix[mt][game][edgeKey] = stats
 const matrix={};
 MAP_TYPES.forEach(mt=>{matrix[mt]={};GAMES.forEach(g=>{matrix[mt][g]={};});});
 ppBetsFiltered.forEach(b=>{
 const mt=b.ppMapType;if(!matrix[mt])return;
 const g=b.game||"?";if(!matrix[mt][g])return;
 const rawE=b.ppEdge!=null?b.ppEdge:0;
 const e=mt==="Map 1+2+3"?snapE6(rawE):snapE(rawE);
 if(e<0)return;
 const key=e.toFixed(2);
 if(!matrix[mt][g][key])matrix[mt][g][key]=mkS();
 addS(matrix[mt][g][key],b);
 });
 const ppBetsForDisplay=ppBetsFiltered;

 // edgeDrill state: {mt, game, edge} or null
 const edgeDrill=(ppStatsDrill&&ppStatsDrill.edgeDrill)||null;
 const setEdgeDrill=v=>setPpStatsDrill(prev=>({...(prev||{}),edgeDrill:v,heatDrill:null}));

 const tabStyle=(active)=>({padding:"7px 14px",borderRadius:8,border:"1px solid "+(active?"rgba(139,92,246,.6)":"rgba(255,255,255,.07)"),background:active?"rgba(139,92,246,.15)":"transparent",color:active?"#c4b5fd":"#4a5a6e",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0});

 const COLHDR=["Edge","N","Cote","WR","ROI","EV","Mise","Profit"];
 const GRIDCOLS="58px 32px 42px 42px 50px 50px 44px 56px";

 const ColHeaders=()=>(
 <div style={{display:"grid",gridTemplateColumns:GRIDCOLS,padding:"5px 14px",borderBottom:"1px solid #0d1628",background:"rgba(0,0,0,.3)"}}>
 {COLHDR.map(h=>(<span key={h} style={{fontSize:8,color:"#3a4a5e",fontWeight:700,textTransform:"uppercase",letterSpacing:.4,textAlign:h==="Edge"?"left":"center"}}>{h}</span>))}
 </div>
 );

 // Profit formaté : signe fixe + chiffres tabulaires + $ aligné 

 const StatRow=({s,label,isEdge,onClick,noLine})=>{
 if(!s)return null;
 return(
 <div onClick={onClick} style={{display:"grid",gridTemplateColumns:GRIDCOLS,padding:"9px 14px",borderBottom:noLine?"none":"1px solid #0d1628",alignItems:"center",background:roiBg(s.roi),cursor:onClick?"pointer":"default"}}>
 <span style={{fontSize:isEdge?15:13,fontWeight:900,color:"#FFFFFF"}}>{label}</span>
 <span style={{fontSize:11,color:"#5a6a7e",textAlign:"center"}}>{s.cnt}</span>
 <span style={{fontSize:11,color:"#7a9cbd",textAlign:"center"}}>{s.avgOdds.toFixed(2)}</span>
 <span style={{fontSize:11,fontWeight:700,color:s.wr>=55?"#00E676":s.wr<45?"#f87171":"#9CA3AF",textAlign:"center"}}>{s.wr}%</span>
 <span style={{fontSize:11,fontWeight:700,color:roiColor(s.roi),textAlign:"center"}}>{fmt(s.roi,"%")}</span>
 <span style={{fontSize:11,fontWeight:800,color:s.ev>=0?"#00E676":"#f87171",textAlign:"center"}}>{fmt(s.ev,"%")}</span>
 <span style={{fontSize:11,color:"#7a9cbd",textAlign:"center"}}>{s.avgStake}$</span>
 <div style={{display:"flex",justifyContent:"flex-end"}}><FmtProfit v={s.profit}/></div>
 </div>
 );
 };

 // EDGE DRILL VIEW 
 if(edgeDrill){
 const {mt,game,edge}=edgeDrill;
 // Get all bets with this exact edge+mt+game
 const drillBets=ppBets.filter(b=>{
 const rawE2=b.ppEdge!=null?b.ppEdge:0;
 const e=mt==="Map 1+2+3"?snapE6(rawE2):snapE(rawE2);
 return b.ppMapType===mt&&b.game===game&&Math.abs(e-edge)<0.02;
 });
 // Over/Under summary
 const overS=mkS(),underS=mkS();
 drillBets.forEach(b=>{if(b.overUnder==="Over")addS(overS,b);else addS(underS,b);});
 // Group by bkLine (from description) + ppLine
 const lineGroups={};
 drillBets.forEach(b=>{
 // description = "Over 14.5 Kills" → extract number
 const descParts=(b.description||"").split(" ");
 const bkLine=parseFloat(descParts.find(p=>!isNaN(parseFloat(p)))||"");
 const ppLine=parseFloat(b.ppLine);
 const ou=b.overUnder||"?";
 if(isNaN(bkLine)||isNaN(ppLine))return;
 const key=ou+"||"+bkLine.toFixed(1)+"||"+ppLine.toFixed(1);
 if(!lineGroups[key])lineGroups[key]={ou,bkLine,ppLine,data:mkS()};
 addS(lineGroups[key].data,b);
 });
 const sortedLines=Object.values(lineGroups).sort((a,b)=>a.ou.localeCompare(b.ou)||a.bkLine-b.bkLine);
 const soS=calc(overS),suS=calc(underS);

 return(
 <div style={{marginBottom:16}}>
 {/* Back button */}
 <button onClick={()=>setEdgeDrill(null)}
 style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#c4b5fd",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",marginBottom:12,padding:0}}>
 ← {mt} · {game} · Edge +{edge.toFixed(2)}
 </button>

 {/* Over / Under summary */}
 <div style={{background:"rgba(6,10,20,.99)",border:"1px solid rgba(139,92,246,.25)",borderRadius:14,overflow:"hidden",marginBottom:10}}>
 <div style={{padding:"9px 14px",background:"rgba(139,92,246,.07)",borderBottom:"1px solid rgba(139,92,246,.15)"}}>
 <span style={{fontSize:11,fontWeight:800,color:"#c4b5fd",textTransform:"uppercase",letterSpacing:1}}>Over / Under — Edge +{edge.toFixed(2)}</span>
 </div>
 <ColHeaders/>
 {soS&&<StatRow s={soS} label="Over" isEdge={false} noLine={!suS}/>}
 {suS&&<StatRow s={suS} label="Under" isEdge={false} noLine={true}/>}
 </div>

 {/* All lines played at this edge */}
 <div style={{background:"rgba(6,10,20,.99)",border:"1px solid rgba(139,92,246,.2)",borderRadius:14,overflow:"hidden"}}>
 <div style={{padding:"9px 14px",background:"rgba(0,0,0,.3)",borderBottom:"1px solid #0d1628"}}>
 <span style={{fontSize:11,fontWeight:700,color:"#7a9cbd",textTransform:"uppercase",letterSpacing:.8}}>Lignes jouées</span>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"40px 44px 44px 28px 38px 38px 44px 44px 40px 54px",padding:"5px 14px",borderBottom:"1px solid #0d1628",background:"rgba(0,0,0,.3)"}}>
 {["O/U","BK","PP","N","Cote","WR","ROI","EV","Mise","Profit"].map(h=>(<span key={h} style={{fontSize:8,color:"#3a4a5e",fontWeight:700,textTransform:"uppercase",letterSpacing:.4,textAlign:"center"}}>{h}</span>))}
 </div>
 {sortedLines.length===0&&(<div style={{padding:"16px",textAlign:"center",color:"#3a4a5e",fontSize:12}}>Aucune ligne trouvée</div>)}
 {sortedLines.map((l,i)=>{
 const s=calc(l.data);if(!s)return null;
 const isLast=i===sortedLines.length-1;
 // Get the actual bet objects for this line
 const matchBets=drillBets.filter(b=>{
 const descParts2=(b.description||"").split(" ");
 const bkL=parseFloat(descParts2.find(p=>!isNaN(parseFloat(p)))||"");
 const ppL=parseFloat(b.ppLine);
 return b.overUnder===l.ou&&Math.abs(bkL-l.bkLine)<0.05&&Math.abs(ppL-l.ppLine)<0.05;
 });
 return(
 <div key={l.ou+l.bkLine+l.ppLine}>
 <div onClick={()=>setPpBetsDrill(ppBetsDrill&&ppBetsDrill.key===l.ou+l.bkLine+l.ppLine?null:{key:l.ou+l.bkLine+l.ppLine,bets:matchBets,label:l.ou+" "+l.bkLine.toFixed(1)+" → PP "+l.ppLine.toFixed(1)})}
 style={{display:"grid",gridTemplateColumns:"40px 44px 44px 28px 38px 38px 44px 44px 40px 44px 20px",padding:"9px 14px",borderBottom:"none",alignItems:"center",background:roiBg(s.roi),cursor:"pointer"}}>
 <span style={{fontSize:10,fontWeight:700,color:l.ou==="Over"?"#00E676":"#60a5fa",textAlign:"center"}}>{l.ou}</span>
 <span style={{fontSize:12,fontWeight:800,color:"#e0e8f0",textAlign:"center"}}>{l.bkLine.toFixed(1)}</span>
 <span style={{fontSize:12,fontWeight:800,color:"#c4b5fd",textAlign:"center"}}>{l.ppLine.toFixed(1)}</span>
 <span style={{fontSize:11,color:"#5a6a7e",textAlign:"center"}}>{s.cnt}</span>
 <span style={{fontSize:11,color:"#7a9cbd",textAlign:"center"}}>{s.avgOdds.toFixed(2)}</span>
 <span style={{fontSize:11,fontWeight:700,color:s.wr>=55?"#00E676":s.wr<45?"#f87171":"#9CA3AF",textAlign:"center"}}>{s.wr}%</span>
 <span style={{fontSize:11,fontWeight:700,color:roiColor(s.roi),textAlign:"center"}}>{fmt(s.roi,"%")}</span>
 <span style={{fontSize:11,fontWeight:800,color:s.ev>=0?"#00E676":"#f87171",textAlign:"center"}}>{fmt(s.ev,"%")}</span>
 <span style={{fontSize:11,color:"#7a9cbd",textAlign:"center"}}>{s.avgStake}$</span>
 <div style={{display:"flex",justifyContent:"flex-end"}}><FmtProfit v={s.profit} fontSize={12}/></div>
 <span style={{fontSize:10,color:"#4a5a6e",textAlign:"center"}}>{(ppBetsDrill&&ppBetsDrill.key)===l.ou+l.bkLine+l.ppLine?<Ic n="up" s={10}/>:<Ic n="down" s={10}/>}</span>
 </div>
 {/* Inline bets view */}
 {(ppBetsDrill&&ppBetsDrill.key)===l.ou+l.bkLine+l.ppLine&&matchBets.length>0&&(
 <div style={{background:"rgba(0,0,0,.4)",borderTop:"1px solid #0d1628",borderBottom:isLast?"none":"1px solid #0d1628"}}>
 {matchBets.map((b,bi)=>{
 const isWon=b.status==="won";
 const bkLogo=BK_LOGOS[b.bookmaker]||bkPhotos[b.bookmaker]||null;
 const profitVal=b.profit!=null?b.profit:(isWon?(b.stake||0)*(b.odds-1):-(b.stake||0));
 return(
 <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderTop:bi>0?"1px solid rgba(255,255,255,.04)":"none",borderLeft:"2.5px solid "+(isWon?"#00E676":"#f43f5e")}}>
 <div style={{width:32,height:32,borderRadius:8,overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,.04)"}}>
 <GameLogo game={b.game} size={32}/>
 </div>
 <div style={{flex:1,minWidth:0}}>
 <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:3,flexWrap:"wrap"}}>
 <span style={{fontWeight:800,fontSize:13,color:"#f0f4ff",textTransform:"capitalize",flexShrink:0}}>{b.player}</span>
 <span style={{color:"#2e3d50",fontSize:10,margin:"0 1px"}}>-</span>
 <span style={{fontSize:11,color:"#8a9eb8",fontWeight:500}}>{(b.description||"").replace(/^(Over|Under)\s/,"")}</span>
 {b.mapTag&&<><span style={{color:"#2e3d50",fontSize:10}}>-</span><span style={{fontSize:9,fontWeight:700,color:"#fbbf24",background:"rgba(251,191,36,.1)",padding:"1px 4px",borderRadius:3,border:"1px solid rgba(251,191,36,.2)"}}>{b.mapTag}</span></>}
 </div>
 <div style={{display:"flex",alignItems:"center",gap:0,flexWrap:"wrap"}}>
 <span style={{fontSize:11,fontWeight:700,color:"#7a9cbd"}}>@{b.odds}</span>
 {(bkLogo||b.bookmaker)&&<span style={{color:"#3a4e62",margin:"0 5px",fontSize:11}}>·</span>}
 {bkLogo?<img src={bkLogo} alt={b.bookmaker} style={{width:14,height:14,borderRadius:3,objectFit:"cover"}}/>:<span style={{fontSize:11,color:"#7a9cbd"}}>{b.bookmaker}</span>}
 {b.stake&&<><span style={{color:"#3a4e62",margin:"0 5px",fontSize:11}}>·</span><span style={{fontSize:11,color:"#7a9cbd"}}>{b.stake}$</span></>}
 {b.tournament&&(()=>{const tl=_GLOBAL_MEDIA_STORE&&_GLOBAL_MEDIA_STORE["tourney_"+(b.game||"")+"_"+b.tournament];return <><span style={{color:"#3a4e62",margin:"0 5px",fontSize:11}}>·</span>{tl?<img src={tl.replace('__FAILED__','')} alt={b.tournament} style={{width:14,height:14,objectFit:"contain",borderRadius:2,verticalAlign:"middle"}} onError={e=>e.target.style.display="none"}/>:null}<span style={{fontSize:10,color:"#7a9cbd",marginLeft:tl?3:0}}>{b.tournament.split(" ")[0]}</span></>;})()}
 </div>
 </div>
 <div style={{flexShrink:0,textAlign:"right"}}>
 <FmtProfit v={profitVal} fontSize={13}/>
 <div style={{fontSize:9,color:isWon?"rgba(110,231,160,.5)":"rgba(248,113,113,.5)",fontWeight:700}}>{isWon?" WIN":" LOSS"}</div>
 </div>
 </div>
 );
 })}
 </div>
 )}
 {!isLast&&<div style={{height:1,background:"#0d1628"}}/>}
 </div>
 );
 })}
 </div>
 </div>
 );
 }

 // MAP TAB 
 const MapTab=({mt})=>{
 const gamesInMt=GAMES.filter(g=>ppBets.some(b=>b.ppMapType===mt&&b.game===g));
 if(gamesInMt.length===0)return(<div style={{padding:24,textAlign:"center",color:"#3a4a5e",fontSize:13}}>Aucun pari {mt}</div>);
 return(
 <div style={{display:"flex",flexDirection:"column",gap:10}}>
 {gamesInMt.map(game=>{
 const gameEdges=Object.keys(matrix[mt][game]).map(Number).sort(function(a,b){
 const cntA=matrix[mt][game][a.toFixed(2)]?matrix[mt][game][a.toFixed(2)].cnt:0;
 const cntB=matrix[mt][game][b.toFixed(2)]?matrix[mt][game][b.toFixed(2)].cnt:0;
 return cntB-cntA;
 });
 if(gameEdges.length===0)return null;
 const tot=mkS();
 gameEdges.forEach(e=>{const d=matrix[mt][game][e.toFixed(2)];if(d){tot.cnt+=d.cnt;tot.won+=d.won;tot.profit+=d.profit;tot.staked+=d.staked;tot.oddsSum+=d.oddsSum;}});
 const gT=calc(tot);
 return(
 <div key={game} style={{background:"rgba(6,10,20,.99)",border:"1px solid rgba(139,92,246,.2)",borderRadius:16,overflow:"hidden"}}>
 <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",background:"rgba(139,92,246,.06)",borderBottom:"1px solid rgba(139,92,246,.15)"}}>
 <GameLogo game={game} size={20}/>
 <span style={{fontSize:14,fontWeight:800,color:"#e0e8f0"}}>{game}</span>
 {gT&&<>
 <span style={{marginLeft:"auto",fontSize:11,color:"#5a6a7e"}}>{gT.cnt}p</span>
 <span style={{fontSize:12,fontWeight:700,color:roiColor(gT.roi),marginLeft:6}}>{fmt(gT.roi,"%")} ROI</span>
 <span style={{fontSize:12,fontWeight:800,color:gT.ev>=0?"#00E676":"#f87171",marginLeft:6}}>{fmt(gT.ev,"%")} EV</span>
 <FmtProfit v={gT.profit} fontSize={12}/>
 </>}
 </div>
 <ColHeaders/>
 {gameEdges.map((e,i)=>{
 const s=calc(matrix[mt][game][e.toFixed(2)]);
 if(!s)return null;
 const isExpanded=edgeDrill&&edgeDrill.mt===mt&&edgeDrill.game===game&&Math.abs(edgeDrill.edge-e)<0.01&&!edgeDrill.fromHeat;
 // Get ppLines for this edge
 const edgeBets=ppBets.filter(function(b){
 var rawE=b.ppEdge!=null?b.ppEdge:0;
 var snap=mt==="Map 1+2+3"?snapE6(rawE):snapE(rawE);
 return b.ppMapType===mt&&b.game===game&&Math.abs(snap-e)<0.02;
 });
 const ppLineGroups={};
 edgeBets.forEach(function(b){
 var pl=b.ppLine!=null?parseFloat(b.ppLine):null;
 if(pl===null||isNaN(pl))return;
 var k=pl.toFixed(1);
 if(!ppLineGroups[k])ppLineGroups[k]={ppLine:pl,bets:[],data:mkS()};
 ppLineGroups[k].bets.push(b);
 addS(ppLineGroups[k].data,b);
 });
 const sortedPPLines=Object.values(ppLineGroups).sort(function(a,b){return a.ppLine-b.ppLine;});
 return(
 <div key={e}>
 <StatRow key={e} s={s} label={"+"+e.toFixed(2)} isEdge={true} noLine={false} onClick={function(){setEdgeDrill(isExpanded?null:{mt,game,edge:e,fromHeat:false});}}/>
 {/* PP Lines breakdown when expanded */}
 {isExpanded&&sortedPPLines.length>0&&(
 <div style={{background:"rgba(0,0,0,.3)",borderBottom:"1px solid rgba(139,92,246,.1)"}}>
 <div style={{padding:"6px 14px 4px",display:"flex",alignItems:"center",gap:6}}>
 <img src={_B64_PP_LOGO_B64} style={{width:12,height:12,objectFit:"contain"}}/>
 <span style={{fontSize:9,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>Lignes PP — clique pour voir les paris</span>
 </div>
 {sortedPPLines.map(function(lg){
 var ls=calc(lg.data);
 if(!ls)return null;
 var isLineDrill=ppBetsDrill&&ppBetsDrill.key==="ppline_"+mt+"_"+game+"_"+e.toFixed(2)+"_"+lg.ppLine.toFixed(1);
 return(
 <div key={lg.ppLine}>
 <div onClick={function(){setPpBetsDrill(isLineDrill?null:{key:"ppline_"+mt+"_"+game+"_"+e.toFixed(2)+"_"+lg.ppLine.toFixed(1),bets:lg.bets,label:game+" "+mt+" PP "+lg.ppLine.toFixed(1)});}}
 style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",cursor:"pointer",background:isLineDrill?"rgba(124,58,237,.12)":"transparent",borderTop:"1px solid rgba(255,255,255,.03)"}}>
 <img src={_B64_PP_LOGO_B64} style={{width:13,height:13,objectFit:"contain",flexShrink:0}}/>
 <span style={{fontSize:13,fontWeight:800,color:"#c4b5fd",minWidth:40}}>{lg.ppLine.toFixed(1)}</span>
 <span style={{fontSize:10,color:"#4a5a6e"}}>{ls.cnt} paris</span>
 <span style={{fontSize:11,fontWeight:700,color:roiColor(ls.roi),marginLeft:"auto"}}>{fmt(ls.roi,"%")}</span>
 <span style={{fontSize:11,fontWeight:700,color:ls.wr>=55?"#00E676":ls.wr<45?"#f87171":"#9CA3AF"}}>{ls.wr}%</span>
 <FmtProfit v={ls.profit} fontSize={12}/>
 <span style={{fontSize:10,color:"#4a5a6e"}}><Ic n={isLineDrill?"up":"down"} s={10}/></span>
 </div>
 {isLineDrill&&lg.bets.length>0&&(
 <div style={{background:"rgba(0,0,0,.5)",borderTop:"1px solid #0d1628"}}>
 {lg.bets.map(function(b,bi){
 var isWon=b.status==="won";
 var bkLogo=BK_LOGOS[b.bookmaker]||bkPhotos[b.bookmaker]||null;
 var profitVal=b.profit!=null?b.profit:(isWon?(b.stake||0)*(b.odds-1):-(b.stake||0));
 return(
 <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderTop:bi>0?"1px solid rgba(255,255,255,.03)":"none",borderLeft:"2.5px solid "+(isWon?"#00E676":"#f43f5e")}}>
 <div style={{width:28,height:28,borderRadius:7,overflow:"hidden",flexShrink:0}}>
 <GameLogo game={b.game} size={28}/>
 </div>
 <div style={{flex:1,minWidth:0}}>
 <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2,flexWrap:"wrap"}}>
 <span style={{fontWeight:800,fontSize:12,color:"#f0f4ff",textTransform:"capitalize"}}>{b.player}</span>
 <span style={{fontSize:10,color:"#8a9eb8"}}>{(b.description||"").replace(/^(Over|Under)\s/,"")}</span>
 {b.mapTag&&<span style={{fontSize:9,fontWeight:700,color:"#fbbf24",background:"rgba(251,191,36,.1)",padding:"1px 4px",borderRadius:3}}>{b.mapTag}</span>}
 {b.overUnder&&<span style={{fontSize:9,fontWeight:700,color:b.overUnder==="Over"?"#00E676":"#60a5fa",background:b.overUnder==="Over"?"rgba(0,230,118,.1)":"rgba(96,165,250,.1)",padding:"1px 5px",borderRadius:3}}>{b.overUnder}</span>}
 </div>
 <div style={{display:"flex",alignItems:"center",gap:0}}>
 <span style={{fontSize:10,color:"#7a9cbd"}}>@{b.odds}</span>
 {bkLogo?<><span style={{color:"#3a4e62",margin:"0 4px",fontSize:10}}>·</span><img src={bkLogo} alt={b.bookmaker} style={{width:12,height:12,borderRadius:3,objectFit:"cover"}}/></>:b.bookmaker?<span style={{color:"#3a4e62",margin:"0 4px",fontSize:10}}>·</span>:null}
 {b.stake&&<><span style={{color:"#3a4e62",margin:"0 4px",fontSize:10}}>·</span><span style={{fontSize:10,color:"#7a9cbd"}}>{b.stake}$</span></>}
 {b.datetime&&<><span style={{color:"#3a4e62",margin:"0 4px",fontSize:10}}>·</span><span style={{fontSize:9,color:"#3a4a5e"}}>{String(b.datetime).slice(5,10)}</span></>}
 </div>
 </div>
 <div style={{flexShrink:0,textAlign:"right"}}>
 <FmtProfit v={profitVal} fontSize={12}/>
 <div style={{fontSize:8,color:isWon?"rgba(110,231,160,.5)":"rgba(248,113,113,.5)",fontWeight:700}}>{isWon?" WIN":" LOSS"}</div>
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 {i<gameEdges.length-1&&<div style={{height:1,background:"#0d1628"}}/>}
 </div>
 );
 })}
 </div>
 );
 })}
 </div>
 );
 };

 // HEATMAP TAB 
 const HEAT_METRICS=[
 {k:"roi",l:"ROI",fmt:(s)=>fmt(s.roi,"%"),color:(s)=>roiColor(s.roi),bg:(s)=>roiBg(s.roi)},
 {k:"prog",l:"% Prog",fmt:(s)=>fmt(s.roi,"%"),color:(s)=>roiColor(s.roi),bg:(s)=>roiBg(s.roi)},
 {k:"profit",l:"Profit",fmt:(s)=>fmt(s.profit,"$"),color:(s)=>s.profit>=0?"#00E676":"#f87171",bg:(s)=>s.profit>=0?"rgba(110,231,160,.07)":"rgba(248,113,113,.08)"},
 {k:"ev",l:"EV",fmt:(s)=>fmt(s.ev,"%"),color:(s)=>s.ev>=0?"#00E676":"#f87171",bg:(s)=>s.ev>=0?"rgba(110,231,160,.07)":"rgba(248,113,113,.08)"},
 {k:"wr",l:"WR",fmt:(s)=>s.wr+"%",color:(s)=>s.wr>=55?"#00E676":s.wr<45?"#f87171":"#fbbf24",bg:(s)=>s.wr>=55?"rgba(110,231,160,.07)":s.wr<45?"rgba(248,113,113,.08)":"rgba(251,191,36,.05)"},
 {k:"cnt",l:"Paris",fmt:(s)=>String(s.cnt),color:(s)=>"#c4b5fd",bg:(s)=>"rgba(139,92,246,.05)"},
 ];
 const heatMetric=(ppStatsDrill&&ppStatsDrill.heatMetric)||"roi";
 const setHeatMetric=v=>setPpStatsDrill(prev=>({...(prev||{}),heatMetric:v}));
 const HeatTab=()=>{
 const heatDrill=(ppStatsDrill&&ppStatsDrill.heatDrill)||null;
 const metric=HEAT_METRICS.find(m=>m.k===heatMetric)||HEAT_METRICS[0];
 if(heatDrill){
 const {mt,game}=heatDrill;
 const gameEdges=Object.keys(((matrix[mt]&&matrix[mt][game])||{})).map(Number).sort(ppSortByCount?function(a,b){var m=(matrix[mt]&&matrix[mt][game])||{};return (m[b]&&m[b].count||0)-(m[a]&&m[a].count||0);}:function(a,b){return b-a;});
 return(
 <div>
 <button onClick={()=>setPpStatsDrill(prev=>({...(prev||{}),heatDrill:null}))}
 style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#c4b5fd",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",marginBottom:10,padding:0}}>
 ← {mt} — {game}
 </button>
 <div style={{background:"rgba(6,10,20,.99)",border:"1px solid rgba(139,92,246,.2)",borderRadius:14,overflow:"hidden"}}>
 <ColHeaders/>
 {gameEdges.map((e,i)=>{
 const s=calc(matrix[mt][game][e.toFixed(2)]);if(!s)return null;
 return(<StatRow key={e} s={s} label={"+"+e.toFixed(2)} isEdge={true} noLine={i===gameEdges.length-1} onClick={()=>setEdgeDrill({mt,game,edge:e})}/>);
 })}
 </div>
 </div>
 );
 }
 // 4 separate tables by game
 return(
 <div>
 {/* Metric selector dropdown */}
 <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
 <div style={{position:"relative",display:"inline-block"}}>
 <select value={heatMetric} onChange={e=>setHeatMetric(e.target.value)}
 style={{appearance:"none",WebkitAppearance:"none",background:"rgba(139,92,246,.15)",border:"1px solid rgba(139,92,246,.4)",borderRadius:8,color:"#c4b5fd",fontSize:11,fontWeight:700,padding:"5px 28px 5px 10px",cursor:"pointer",fontFamily:"Inter,sans-serif",outline:"none"}}>
 {HEAT_METRICS.map(m=>(<option key={m.k} value={m.k}>{m.l}</option>))}
 </select>
 <span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#c4b5fd",fontSize:10}}><Ic n="down" s={10}/></span>
 </div>
 </div>
 {/* One table per game */}
 <div style={{display:"flex",flexDirection:"column",gap:12}}>
 {GAMES.filter(game=>ppBets.some(b=>b.game===game)).map(game=>{
 // Collect all edges for this game across all map types
 const gameAllEdges=new Set();
 MAP_TYPES.forEach(mt=>Object.keys(((matrix[mt]&&matrix[mt][game])||{})).forEach(e=>gameAllEdges.add(parseFloat(e))));
 const edgeCols=[...gameAllEdges].sort((a,b)=>a-b);
 if(edgeCols.length===0)return null;
 return(
 <div key={game} style={{borderRadius:14,overflow:"hidden",border:"1px solid rgba(139,92,246,.2)"}}>
 {/* Game header */}
 {(()=>{
 const gTot=mkS();
 MAP_TYPES.forEach(mt2=>Object.values((matrix[mt2]&&matrix[mt2][game])||{}).forEach(d=>{gTot.cnt+=d.cnt;gTot.won+=d.won;gTot.profit+=d.profit;gTot.staked+=d.staked;gTot.oddsSum+=d.oddsSum;}));
 const gS=calc(gTot);
 return(
 <div style={{display:"flex",alignItems:"center",gap:6,padding:"9px 12px",background:"rgba(139,92,246,.07)",borderBottom:"1px solid rgba(139,92,246,.15)",flexWrap:"wrap"}}>
 <GameLogo game={game} size={16}/>
 <span style={{fontSize:13,fontWeight:800,color:"#e0e8f0"}}>{game}</span>
 {gS&&<>
 <span style={{fontSize:10,color:"#5a6a7e",marginLeft:4}}>{gS.cnt}p</span>
 <span style={{fontSize:11,fontWeight:700,color:roiColor(gS.roi)}}>{fmt(gS.roi,"%")} ROI</span>
 <span style={{fontSize:11,fontWeight:700,color:gS.ev>=0?"#00E676":"#f87171"}}>{fmt(gS.ev,"%")} EV</span>
 <span style={{fontSize:11,fontWeight:800,color:gS.profit>=0?"#00E676":"#f87171",marginLeft:"auto"}}>{fmt(gS.profit,"$")}</span>
 </>}
 {!gS&&<span style={{fontSize:9,color:"#4a5a6e",marginLeft:"auto"}}>{metric.l}</span>}
 </div>
 );
 })()}
 <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
 <table style={{borderCollapse:"collapse",tableLayout:"fixed",width:"max-content",minWidth:"100%"}}>
 <thead>
 <tr>
 <th style={{position:"sticky",left:0,zIndex:2,background:"rgba(8,10,20,.98)",width:82,padding:"5px 10px",borderBottom:"1px solid #0d1628",borderRight:"1px solid #0d1628",fontSize:9,color:"#3a4a5e",fontWeight:700,textAlign:"left"}}>Map</th>
 {edgeCols.map(e=>(<th key={e} style={{minWidth:44,padding:"5px 4px",borderBottom:"1px solid #0d1628",borderRight:"1px solid #0d1628",fontSize:8,color:"#3a4a5e",fontWeight:700,textAlign:"center",background:"rgba(0,0,0,.3)"}}>+{e.toFixed(2)}</th>))}
 </tr>
 </thead>
 <tbody>
 {MAP_TYPES.filter(mt=>ppBets.some(b=>b.ppMapType===mt&&b.game===game)).map((mt,ri,arr)=>(
 <tr key={mt}>
 <td style={{position:"sticky",left:0,zIndex:2,background:"rgba(8,10,20,.98)",padding:"7px 10px",borderBottom:ri<arr.length-1?"1px solid #0d1628":"none",borderRight:"1px solid #0d1628"}}>
 <span style={{fontSize:9,color:"#7a9cbd",fontWeight:700,whiteSpace:"nowrap"}}>{mt}</span>
 </td>
 {edgeCols.map(e=>{
 const d=matrix[mt]&&matrix[mt][game]&&matrix[mt][game][e.toFixed(2)];
 const s=d?calc(d):null;
 const cellBg=s?metric.bg(s):"transparent";
 const cellColor=s?metric.color(s):"#151e2c";
 const cellVal=s?metric.fmt(s):"—";
 return(
 <td key={e} onClick={()=>s&&setEdgeDrill({mt,game,edge:e})}
 style={{background:cellBg,borderRight:"1px solid #0d1628",borderBottom:ri<arr.length-1?"1px solid #0d1628":"none",padding:"5px 3px",cursor:s?"pointer":"default",textAlign:"center",verticalAlign:"middle",minWidth:44}}>
 <div style={{fontSize:11,fontWeight:800,color:cellColor}}>{cellVal}</div>
 {s&&<div style={{fontSize:8,color:"#3a4a5e"}}>{s.cnt}p</div>}
 </td>
 );
 })}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 );
 })}
 </div>
 {/* Legend */}
 <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap",alignItems:"center"}}>
 {heatMetric==="roi"||heatMetric==="prog"||heatMetric==="ev"?[["#00E676","≥+15%"],["rgba(163,228,188,.8)","+5-15%"],["rgba(251,191,36,.8)","±5%"],["rgba(249,115,22,.8)","-5-15%"],["#f87171","≤-15%"]].map(([col,lbl])=>(
 <div key={lbl} style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:10,height:10,borderRadius:2,background:col}}/><span style={{fontSize:9,color:"#4a5a6e"}}>{lbl}</span></div>
 )):null}
 <span style={{fontSize:9,color:"#3a4a5e",marginLeft:4}}>· Clique → détail</span>
 </div>
 </div>
 );
 };

 return(
 <div style={{marginBottom:16}}>
 <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
 <img src={_B64_PP_LOGO_B64} alt="PP" style={{width:20,height:20,borderRadius:5,objectFit:"cover",flexShrink:0}}/>
 <span style={{fontSize:13,fontWeight:700,color:"#c4b5fd",flex:1}}>Analyse PrizePicks</span>
 <span style={{fontSize:9,color:"#4a3a6e"}}>{ppBetsFiltered?ppBetsFiltered.length:ppBets.length} paris PP{(ppOUApplied||ppMapFilterApplied)?" (filtré)":""}</span>
 </div>
 {/* PP filters dropdown */}
 {(function(){
 var activeCount=(ppOUApplied?1:0)+(ppMapFilterApplied?1:0)+(ppSortByCount?1:0);
 return(
 <div style={{marginBottom:8}}>
 <button onClick={function(){setPpFilterOpen(function(v){return !v;});}}
 style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",borderRadius:9,border:"1px solid "+(ppFilterOpen||activeCount>0?"rgba(167,139,250,.4)":"rgba(255,255,255,.08)"),background:ppFilterOpen||activeCount>0?"rgba(124,58,237,.12)":"transparent",color:activeCount>0?"#c4b5fd":"#6B7280",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",width:"100%",justifyContent:"space-between"}}>
 <span style={{display:"flex",alignItems:"center",gap:6}}>
 Filtres PP
 {ppOUApplied&&<span style={{fontSize:9,background:"rgba(167,139,250,.3)",color:"#c4b5fd",padding:"1px 6px",borderRadius:4,fontWeight:700}}>{ppOUApplied}</span>}
 {ppMapFilterApplied&&<span style={{fontSize:9,background:"rgba(96,165,250,.3)",color:"#93c5fd",padding:"1px 6px",borderRadius:4,fontWeight:700}}>{ppMapFilterApplied}</span>}
 {ppSortByCount&&<span style={{fontSize:9,background:"rgba(251,191,36,.2)",color:"#fbbf24",padding:"1px 6px",borderRadius:4,fontWeight:700}}>N↓</span>}
 </span>
 <span style={{fontSize:10,opacity:.5}}><Ic n={ppFilterOpen?"up":"down"} s={11}/></span>
 </button>
 {ppFilterOpen&&(
 <div style={{marginTop:6,padding:"12px",background:"rgba(124,58,237,.06)",border:"1px solid rgba(124,58,237,.2)",borderRadius:10}}>
 {/* Over / Under */}
 <div style={{marginBottom:10}}>
 <div style={{fontSize:9,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Direction</div>
 <div style={{display:"flex",gap:5}}>
 {[{k:"",l:"Tous"},{k:"Over",l:"Over"},{k:"Under",l:"Under"}].map(function(o){
 var on=ppOU===o.k;
 return <button key={o.k} onClick={function(){setPpOU(o.k);}}
 style={{flex:1,padding:"6px 0",borderRadius:7,border:"1px solid "+(on?"rgba(167,139,250,.5)":"rgba(255,255,255,.08)"),background:on?"rgba(124,58,237,.2)":"transparent",color:on?"#c4b5fd":"#6B7280",fontSize:11,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{o.l}</button>;
 })}
 </div>
 </div>
 {/* Map filter */}
 <div style={{marginBottom:10}}>
 <div style={{fontSize:9,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Map jouée</div>
 <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
 {["","Map 1","Map 2","Map 3","Map 4","Map 5"].map(function(m){
 var on=ppMapFilter===m;
 return <button key={m||"all"} onClick={function(){setPpMapFilter(on?"":m);}}
 style={{padding:"5px 10px",borderRadius:7,border:"1px solid "+(on?"rgba(96,165,250,.5)":"rgba(255,255,255,.08)"),background:on?"rgba(59,130,246,.2)":"transparent",color:on?"#93c5fd":"#6B7280",fontSize:11,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{m||"Toutes"}</button>;
 })}
 </div>
 </div>
 {/* Sort */}
 <div>
 <div style={{fontSize:9,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Tri des lignes</div>
 <div style={{display:"flex",gap:5}}>
 {[{k:false,l:"Edge ↓"},{k:true,l:"N ↓ (plus de paris en haut)"}].map(function(s){
 var on=ppSortByCount===s.k;
 return <button key={s.l} onClick={function(){setPpSortByCount(s.k);}}
 style={{flex:1,padding:"6px 0",borderRadius:7,border:"1px solid "+(on?"rgba(251,191,36,.5)":"rgba(255,255,255,.08)"),background:on?"rgba(251,191,36,.12)":"transparent",color:on?"#fbbf24":"#6B7280",fontSize:10,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{s.l}</button>;
 })}
 </div>
 </div>
 <div style={{display:"flex",gap:6,marginTop:10}}>
 {(ppOUApplied||ppMapFilterApplied)&&<button onClick={function(){setPpOU("");setPpMapFilter("");setPpOUApplied("");setPpMapFilterApplied("");setPpSortByCount(false);}}
 style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid rgba(239,68,68,.2)",background:"transparent",color:"#f87171",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 Réinitialiser
 </button>}
 <button onClick={function(){setPpOUApplied(ppOU);setPpMapFilterApplied(ppMapFilter);setPpFilterOpen(false);}}
 style={{flex:1,padding:"8px",borderRadius:7,border:"none",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 Appliquer
 </button>
 </div>
 </div>
 )}
 </div>
 );
 })()}
 <div style={{display:"flex",gap:5,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
 {[{k:"combiner",l:" Combiner"},{k:"Map 1+2",l:"Map 1+2"},{k:"Map 3",l:"Map 3"},{k:"Map 1+2+3",l:"Map 1+2+3"},{k:"heat",l:" Heatmap"}].map(t=>(
 <button key={t.k} onClick={()=>{setPpStatsTab(t.k);setPpStatsDrill(null);}} style={tabStyle(ppStatsTab===t.k)}>{t.l}</button>
 ))}
 </div>
 {ppStatsTab==="combiner"&&(()=>{
 // Combine Map 1+2 + Map 3 stats per game per edge
 const combined={};
 GAMES.forEach(game=>{
 combined[game]={};
 ["Map 1+2","Map 3"].forEach(mt=>{
 if(!matrix[mt]||!matrix[mt][game])return;
 Object.entries(matrix[mt][game]).forEach(([eKey,d])=>{
 if(!combined[game][eKey])combined[game][eKey]=mkS();
 if(d){combined[game][eKey].cnt+=d.cnt;combined[game][eKey].won+=d.won;combined[game][eKey].profit+=d.profit;combined[game][eKey].staked+=d.staked;combined[game][eKey].oddsSum+=d.oddsSum;}
 });
 });
 });
 const gamesWithData=GAMES.filter(g=>Object.keys(combined[g]||{}).length>0);
 if(gamesWithData.length===0)return <div style={{padding:24,textAlign:"center",color:"#3a4a5e",fontSize:13}}>Aucun pari Map 1+2 ou Map 3</div>;
 return(
 <div style={{display:"flex",flexDirection:"column",gap:10}}>
 {gamesWithData.map(game=>{
 const gameEdges=Object.keys(combined[game]).map(Number).sort((a,b)=>combined[game][b.toFixed(2)].cnt-combined[game][a.toFixed(2)].cnt);
 const tot=mkS();
 gameEdges.forEach(e=>{const d=combined[game][e.toFixed(2)];if(d){tot.cnt+=d.cnt;tot.won+=d.won;tot.profit+=d.profit;tot.staked+=d.staked;tot.oddsSum+=d.oddsSum;}});
 const gT=calc(tot);
 return(
 <div key={game} style={{background:"rgba(6,10,20,.99)",border:"1px solid rgba(139,92,246,.2)",borderRadius:16,overflow:"hidden"}}>
 <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",background:"rgba(139,92,246,.06)",borderBottom:"1px solid rgba(139,92,246,.15)"}}>
 <GameLogo game={game} size={20}/>
 <span style={{fontSize:14,fontWeight:800,color:"#e0e8f0"}}>{game}</span>
 <span style={{fontSize:10,color:"#5a6a7e",marginLeft:4}}>Map 1+2 + Map 3</span>
 {gT&&<>
 <span style={{marginLeft:"auto",fontSize:11,color:"#5a6a7e"}}>{gT.cnt}p</span>
 <span style={{fontSize:12,fontWeight:700,color:roiColor(gT.roi),marginLeft:6}}>{fmt(gT.roi,"%")} ROI</span>
 <span style={{fontSize:12,fontWeight:800,color:gT.profit>=0?"#00E676":"#f87171",marginLeft:6}}>{fmt(gT.profit,"$")}</span>
 </>}
 </div>
 <ColHeaders/>
 {gameEdges.map((e,i)=>{
 const s=calc(combined[game][e.toFixed(2)]);
 if(!s)return null;
 return(
 <div key={e}>
 <StatRow s={s} label={"+"+e.toFixed(2)} isEdge={true} noLine={i===gameEdges.length-1}/>
 {i<gameEdges.length-1&&<div style={{height:1,background:"#0d1628"}}/>}
 </div>
 );
 })}
 </div>
 );
 })}
 </div>
 );
 })()}
 {ppStatsTab==="Map 1+2"&&(<MapTab mt="Map 1+2"/>)}
 {ppStatsTab==="Map 3"&&(<MapTab mt="Map 3"/>)}
 {ppStatsTab==="Map 1+2+3"&&(<MapTab mt="Map 1+2+3"/>)}
 {ppStatsTab==="heat"&&(<HeatTab/>)}
 </div>
 );
 })()}
 </>}

 {/* ONGLET ANALYSE */}
 {statsTab==="diagnostic"&&<DiagnosticTab settledFiltered={settledFiltered}/>}
 {statsTab==="spots"&&<SpotsTab settledFiltered={settledFiltered}/>}

 {statsTab==="analyse"&&(
 <div style={{display:"flex",flexDirection:"column",gap:12}}>

 {/* HELPER: SortHeader */}
 {(()=>{
 const accent="#6366f1";
 const cardStyle={background:"rgba(10,12,28,.99)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,overflow:"hidden"};
 const secTitle=(emoji,title,sub)=>(
 <div style={{display:"flex",alignItems:"center",gap:9,padding:"12px 14px 10px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
 <span style={{fontSize:18,lineHeight:1}}>{emoji}</span>
 <div>
 <div style={{fontSize:13,fontWeight:800,color:"#f0f4ff",letterSpacing:.2}}>{title}</div>
 {sub&&<div style={{fontSize:9,color:"#4a5a6e",marginTop:1}}>{sub}</div>}
 </div>
 </div>
 );
 const SortHdr=({label,k,sort,setSort,align="right"})=>{
 const active=sort.key===k;
 return(
 <span onClick={()=>setSort(s=>({key:k,dir:s.key===k?-s.dir:-1}))}
 style={{fontSize:8,color:active?"#a5b4fc":"#3a4a5e",fontWeight:active?800:700,textTransform:"uppercase",letterSpacing:.5,cursor:"pointer",textAlign:align,userSelect:"none",display:"flex",alignItems:"center",gap:2,justifyContent:align==="right"?"flex-end":align==="center"?"center":"flex-start"}}>
 {label}
 <span style={{fontSize:9,opacity:active?1:.3}}>{active&&sort.dir>0?"↑":"↓"}</span>
 </span>
 );
 };

 const sortFn=(arr,sort,keys)=>{
 return [...arr].sort((a,b)=>{
 const va=a[sort.key]??0,vb=b[sort.key]??0;
 return sort.dir*(vb-va);
 });
 };

 return(<>

 {/* COTE IDÉALE */}
 {advancedStats&&advancedStats.coteIdéale&&advancedStats.coteIdéale.length>0&&(()=>{
 const byGame={};
 advancedStats.coteIdéale.forEach(r=>{if(!byGame[r.game])byGame[r.game]=[];byGame[r.game].push(r);});
 return(
 <div style={cardStyle}>
 {secTitle("","Cote idéale par pari","Map 1+2 et Map 3 · formule : cote min = 1 ÷ WR")}
 {Object.entries(byGame).map(([game,rows])=>{
 const over=rows.filter(r=>r.ou==="Over");
 const under=rows.filter(r=>r.ou==="Under");
 const over12=sortFn(rows.filter(r=>r.ou==="Over"&&r.mt==="Map 1+2"),coteSort);
 const over3=sortFn(rows.filter(r=>r.ou==="Over"&&r.mt==="Map 3"),coteSort);
 const under12=sortFn(rows.filter(r=>r.ou==="Under"&&r.mt==="Map 1+2"),coteSort);
 const under3=sortFn(rows.filter(r=>r.ou==="Under"&&r.mt==="Map 3"),coteSort);
 if(!over12.length&&!over3.length&&!under12.length&&!under3.length)return null;
 const SubTable=({label,color,rows:rws,bg})=>{
 if(!rws.length)return null;
 return(<>
 <div style={{padding:"4px 14px 2px",background:bg,display:"flex",alignItems:"center",gap:6}}>
 <span style={{fontSize:9,color,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>{label}</span>
 <span style={{fontSize:8,color:"#2a3a4e"}}>{rws.length} lignes</span>
 </div>
 <HDR/>
 {rws.map((r,i)=><Row key={r.mt+r.edge+r.ou} r={{...r,prog:r.profit/5000*100}} last={i===rws.length-1}/>)}
 </>);
 };
 const COLS="46px 28px 40px 48px 48px 60px 54px";
 const HDR=()=>(
 <div style={{display:"grid",gridTemplateColumns:COLS,gap:4,padding:"5px 14px",background:"rgba(0,0,0,.3)"}}>
 {[["edge","Edge","left"],["cnt","N","center"],["wr","WR%","center"],["avgOdds","Réelle","center"],["idealOdds","Min","center"],["profit","Profit","right"],["prog","5k$","right"]].map(([k,l,a])=>(
 <SortHdr key={k} label={l} k={k} sort={coteSort} setSort={setCoteSort} align={a}/>
 ))}
 </div>
 );
 const Row=({r,last})=>{
 const ok=r.gap>=0;const good=r.gap>=0.1;const bad=r.gap<-0.05;
 const bg=good?"rgba(34,197,94,.06)":bad?"rgba(239,68,68,.06)":"transparent";
 const prog=r.profit/5000*100;
 const progC=prog>=0?"#22C55E":"#EF4444";
 return(
 <div style={{display:"grid",gridTemplateColumns:COLS,gap:4,alignItems:"center",padding:"8px 14px",borderBottom:last?"none":"1px solid rgba(255,255,255,.03)",background:bg}}>
 <span style={{fontSize:13,fontWeight:900,color:"#fff",fontVariantNumeric:"tabular-nums"}}>+{r.edge%1===0?r.edge.toFixed(0):r.edge}</span>
 <span style={{fontSize:10,color:"#4a5a6e",textAlign:"center"}}>{r.cnt}</span>
 <span style={{fontSize:11,fontWeight:700,color:r.wr>=55?"#22C55E":r.wr<45?"#EF4444":"#F59E0B",textAlign:"center"}}>{r.wr}%</span>
 <span style={{fontSize:12,fontWeight:600,color:"#c8d4e8",textAlign:"center",fontVariantNumeric:"tabular-nums"}}>{r.avgOdds.toFixed(2)}</span>
 <span style={{fontSize:12,fontWeight:800,color:ok?"#22C55E":"#EF4444",textAlign:"center",fontVariantNumeric:"tabular-nums"}}>{r.idealOdds.toFixed(2)}</span>
 <div style={{display:"flex",justifyContent:"flex-end"}}><FmtProfit v={r.profit} fontSize={11}/></div>
 <span style={{fontSize:10,fontWeight:700,color:progC,textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{prog>=0?"+":""}{prog.toFixed(1)}%</span>
 </div>
 );
 };
 return(
 <div key={game} style={{borderTop:"1px solid rgba(255,255,255,.06)"}}>
 <div style={{display:"flex",alignItems:"center",gap:7,padding:"8px 14px 4px",background:"rgba(255,255,255,.015)"}}>
 <GameLogo game={game} size={14}/>
 <span style={{fontSize:11,fontWeight:800,color:"#c8d4e8",textTransform:"uppercase",letterSpacing:1}}>{game}</span>
 {game==="LoL"&&(
 <button onClick={()=>setHideLolLive(v=>!v)}
 style={{marginLeft:"auto",padding:"3px 10px",borderRadius:7,border:"1px solid "+(hideLolLive?"rgba(251,191,36,.5)":"rgba(255,255,255,.1)"),background:hideLolLive?"rgba(251,191,36,.15)":"transparent",color:hideLolLive?"#fbbf24":"#4a5a6e",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>
 {hideLolLive?" Sans Live":" Live inclus"}
 </button>
 )}
 </div>
 <SubTable label=" Over · Map 1+2" color="#22C55E" rows={over12} bg="rgba(34,197,94,.04)"/>
 {over12.length>0&&over3.length>0&&<div style={{height:1,background:"rgba(255,255,255,.06)",margin:"0 14px"}}/>}
 <SubTable label=" Over · Map 3" color="#4ade80" rows={over3} bg="rgba(74,222,128,.03)"/>
 {(over12.length||over3.length)>0&&(under12.length||under3.length)>0&&<div style={{height:2,background:"rgba(255,255,255,.1)",margin:"0 14px"}}/>}
 <SubTable label=" Under · Map 1+2" color="#60a5fa" rows={under12} bg="rgba(96,165,250,.04)"/>
 {under12.length>0&&under3.length>0&&<div style={{height:1,background:"rgba(255,255,255,.06)",margin:"0 14px"}}/>}
 <SubTable label=" Under · Map 3" color="#93c5fd" rows={under3} bg="rgba(147,197,253,.03)"/>
 </div>
 );
 })}
 <div style={{padding:"7px 14px",background:"rgba(0,0,0,.2)",borderTop:"1px solid rgba(255,255,255,.04)"}}>
 <span style={{fontSize:9,color:"#3a4a5e"}}>Min = 1÷WR (seuil zéro) · 5k$ = profit si bankroll de 5 000$</span>
 </div>
 </div>
 );
 })()}

 {/* DÉTECTEUR DE PERTES */}
 {advancedStats&&(advancedStats.signalList.length>0||advancedStats.comboList.length>0)&&(()=>{
 const losses=advancedStats.signalList.filter(s=>s.profit<=-200).slice(0,10);
 const gains=advancedStats.signalList.filter(s=>s.profit>=200).slice(0,5);
 const combos=advancedStats.comboList||[];
 const DIM_ICONS={game:"",ou:"↕",role:"",line:"",league:"",bk:""};
 const LossRow=({s,i})=>(
 <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",borderTop:"1px solid rgba(255,255,255,.04)",background:i%2===0?"rgba(239,68,68,.025)":"transparent"}}>
 <span style={{fontSize:13,flexShrink:0}}>{DIM_ICONS[s.key?.split(":")[0]]||"•"}</span>
 <div style={{flex:1,minWidth:0}}>
 <div style={{fontSize:12,fontWeight:700,color:"#E5E7EB",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.val||s.label}</div>
 <div style={{fontSize:9,color:"#4a5a6e"}}>{s.label} · {s.cnt}p · {s.wr}% WR</div>
 </div>
 <div style={{textAlign:"right",flexShrink:0}}>
 <FmtProfit v={s.profit} fontSize={13}/>
 <div style={{fontSize:9,color:"#EF4444"}}>{s.roi.toFixed(1)}% ROI</div>
 </div>
 </div>
 );
 return(
 <div style={{background:"rgba(8,12,22,.98)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,overflow:"hidden"}}>
 <div style={{padding:"12px 14px 10px",borderBottom:"1px solid rgba(255,255,255,.06)",background:"rgba(239,68,68,.04)"}}>
 <div style={{display:"flex",alignItems:"center",gap:9}}>
 <span style={{fontSize:18}}><Ic n="warn" s={18} c="#f87171"/></span>
 <div>
 <div style={{fontSize:13,fontWeight:800,color:"#f0f4ff"}}>Où tu perds ton argent</div>
 <div style={{fontSize:9,color:"#4a5a6e"}}>Facteurs individuels + combinaisons · min 4-5 paris</div>
 </div>
 </div>
 </div>

 {/* Pertes individuelles */}
 {losses.length>0&&<>
 <div style={{padding:"7px 14px 4px",background:"rgba(239,68,68,.06)"}}>
 <span style={{fontSize:9,color:"#EF4444",fontWeight:800,textTransform:"uppercase",letterSpacing:.8}}> Facteurs les plus coûteux</span>
 </div>
 {losses.map((s,i)=><LossRow key={s.k||s.key+s.val} s={s} i={i}/>)}
 </>}

 {/* Combos perdants */}
 {combos.length>0&&<>
 <div style={{height:1,background:"rgba(255,255,255,.06)"}}/>
 <div style={{padding:"7px 14px 4px",background:"rgba(249,115,22,.05)"}}>
 <span style={{fontSize:9,color:"#f97316",fontWeight:800,textTransform:"uppercase",letterSpacing:.8}}> Combinaisons à éviter</span>
 </div>
 {combos.map((s,i)=>(
 <div key={s.key} style={{display:"flex",alignItems:"center",gap:8,padding:"9px 14px",borderTop:"1px solid rgba(255,255,255,.04)",background:i%2===0?"rgba(249,115,22,.025)":"transparent"}}>
 <div style={{flex:1,minWidth:0}}>
 <div style={{fontSize:12,fontWeight:700,color:"#E5E7EB"}}>{s.label}</div>
 <div style={{fontSize:9,color:"#4a5a6e"}}>{s.cnt}p · {s.wr}% WR · {s.roi.toFixed(1)}% ROI</div>
 </div>
 <FmtProfit v={s.profit} fontSize={13}/>
 </div>
 ))}
 </>}

 {/* Ce qui fonctionne */}
 {gains.length>0&&<>
 <div style={{height:1,background:"rgba(255,255,255,.06)"}}/>
 <div style={{padding:"7px 14px 4px",background:"rgba(34,197,94,.04)"}}>
 <span style={{fontSize:9,color:"#22C55E",fontWeight:800,textTransform:"uppercase",letterSpacing:.8}}> Ce qui fonctionne</span>
 </div>
 {gains.map((s,i)=><LossRow key={s.k||s.key+s.val} s={s} i={i}/>)}
 </>}
 </div>
 );
 })()}

 {/* PERFORMANCE TEMPORELLE */}
 {advancedStats&&(()=>{
 const metricFn=(s)=>{
 if(dowMetric==="roi")return s.staked>0?s.profit/s.staked*100:0;
 if(dowMetric==="wr")return s.cnt>0?s.won/s.cnt*100:0;
 if(dowMetric==="profit")return s.profit;
 return s.cnt;
 };
 const metricFmt=(v)=>{
 if(dowMetric==="roi")return(v>=0?"+":"")+v.toFixed(1)+"%";
 if(dowMetric==="wr")return v.toFixed(0)+"%";
 if(dowMetric==="profit")return(v>=0?"+":"")+v.toFixed(0)+"$";
 return v+"p";
 };
 return(
 <div style={cardStyle}>
 <div style={{padding:"12px 14px 10px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
 <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
 <div style={{display:"flex",alignItems:"center",gap:9}}>
 <span style={{fontSize:18}}><Ic n="calendar" s={18} c="#93c5fd"/></span>
 <div>
 <div style={{fontSize:13,fontWeight:800,color:"#f0f4ff"}}>Performance temporelle</div>
 <div style={{fontSize:9,color:"#4a5a6e",marginTop:1}}>Par jour · par semaine</div>
 </div>
 </div>
 <select value={dowMetric} onChange={e=>setDowMetric(e.target.value)}
 style={{background:"rgba(99,102,241,.15)",border:"1px solid rgba(99,102,241,.3)",borderRadius:8,padding:"4px 10px",color:"#a5b4fc",fontSize:11,fontFamily:"Inter,sans-serif",outline:"none",cursor:"pointer",fontWeight:600}}>
 <option value="roi">ROI %</option>
 <option value="wr">Win Rate</option>
 <option value="profit">Profit $</option>
 <option value="cnt">Nb Paris</option>
 </select>
 </div>
 <div style={{display:"flex",gap:4,marginTop:10}}>
 {[["global","Par jour"],["week","Par semaine"]].map(([v,l])=>(
 <button key={v} onClick={()=>setAnalyseView(v)}
 style={{padding:"5px 14px",borderRadius:8,border:"1.5px solid "+(analyseView===v?"rgba(99,102,241,.5)":"rgba(255,255,255,.08)"),background:analyseView===v?"rgba(99,102,241,.15)":"transparent",color:analyseView===v?"#a5b4fc":"#4a5a6e",fontSize:11,fontWeight:analyseView===v?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 {l}
 </button>
 ))}
 </div>
 </div>
 {analyseView==="week"?(()=>{
 const wl=advancedStats.weekList;
 const vals=wl.map(w=>metricFn(w));
 const maxAbs=Math.max(...vals.map(Math.abs),1);
 return(
 <div style={{padding:"12px 14px",overflowX:"auto"}}>
 <div style={{display:"flex",gap:4,minWidth:Math.max(wl.length*52,280)+"px",alignItems:"flex-end",height:90,marginBottom:8}}>
 {wl.map((w,i)=>{
 const v=metricFn(w);const pos=v>=0;
 const barH=Math.max(4,Math.abs(v)/maxAbs*82);
 const color=pos?"#22C55E":"#EF4444";
 return(
 <div key={w.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",minWidth:44}}>
 <div style={{fontSize:8,fontWeight:700,color,marginBottom:2,whiteSpace:"nowrap"}}>{metricFmt(v)}</div>
 <div style={{width:"75%",height:barH+"px",background:color,borderRadius:"3px 3px 0 0",opacity:.7}}/>
 </div>
 );
 })}
 </div>
 <div style={{display:"flex",gap:4,minWidth:Math.max(wl.length*52,280)+"px",borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:4}}>
 {wl.map(w=>(
 <div key={w.key} style={{flex:1,textAlign:"center",minWidth:44}}>
 <div style={{fontSize:8,color:"#4a5a6e",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{w.label}</div>
 <div style={{fontSize:7,color:"#3a4a5e"}}>{w.cnt}p</div>
 </div>
 ))}
 </div>
 </div>
 );
 })():(()=>{
 const vals=advancedStats.DAYS.map(d=>metricFn(advancedStats.dow[d]));
 const maxAbs=Math.max(...vals.map(Math.abs),1);
 return(
 <div style={{padding:"12px 14px"}}>
 <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
 {advancedStats.DAYS.map((d,i)=>{
 const s=advancedStats.dow[d];const v=metricFn(s);
 const pos=v>=0;const barH=s.cnt>0?Math.min(100,Math.abs(v)/maxAbs*100):0;
 const color=pos?"#22C55E":"#EF4444";
 return(
 <div key={d} style={{textAlign:"center"}}>
 <div style={{fontSize:9,color:"#5a6a7e",fontWeight:600,marginBottom:5}}>{d}</div>
 <div style={{height:52,display:"flex",alignItems:"flex-end",justifyContent:"center",marginBottom:4}}>
 {s.cnt>0
 ?<div style={{width:"72%",height:barH+"%",background:color,borderRadius:"3px 3px 0 0",opacity:.8,minHeight:4,boxShadow:pos?"0 0 8px rgba(34,197,94,.3)":"0 0 8px rgba(239,68,68,.3)"}}/>
 :<div style={{width:"72%",height:4,background:"rgba(255,255,255,.04)",borderRadius:2}}/>}
 </div>
 <div style={{fontSize:10,fontWeight:800,color:s.cnt>0?(pos?color:"#EF4444"):"#3a4a5e"}}>{s.cnt>0?metricFmt(v):"—"}</div>
 <div style={{fontSize:8,color:"#3a4a5e",marginTop:2}}>{s.cnt}p</div>
 </div>
 );
 })}
 </div>
 </div>
 );
 })()}
 </div>
 );
 })()}

 {/* SEUIL DE RENTABILITÉ */}
 {advancedStats&&advancedStats.breakevenData.length>0&&(()=>{
 const sorted=sortFn(advancedStats.breakevenData.filter(r=>r.cnt>=5),breakevenSort);
 return(
 <div style={cardStyle}>
 {secTitle("","Rentabilité par tranche de cote",`Pour être profitable à une cote donnée, tu dois avoir un WR minimum. Vert = tu es au-dessus, Rouge = tu perds.`)}
 <div style={{display:"grid",gridTemplateColumns:"88px 36px 1fr 36px 44px 56px",gap:4,padding:"5px 14px",background:"rgba(0,0,0,.3)"}}>
 {[["label","Cote","left"],["minWR","Requis","center"],["wr","Ton WR","left"],["cnt","N","center"],["roi","ROI","right"],["profit","Profit","right"]].map(([k,l,a])=>(
 <SortHdr key={k} label={l} k={k} sort={breakevenSort} setSort={setBreakevenSort} align={a}/>
 ))}
 </div>
 {sorted.map((r,i)=>{
 const gap=r.wr-r.minWR;const isOk=gap>=0;
 const barW=Math.min(100,r.wr);const threshW=Math.min(100,r.minWR);
 return(
 <div key={r.label} style={{borderTop:"1px solid rgba(255,255,255,.04)",background:isOk?"rgba(34,197,94,.04)":"rgba(239,68,68,.04)"}}>
 <div style={{display:"grid",gridTemplateColumns:"88px 36px 1fr 36px 44px 56px",gap:4,alignItems:"center",padding:"8px 14px"}}>
 <span style={{fontSize:12,fontWeight:800,color:"#c8d4e8",fontVariantNumeric:"tabular-nums"}}>{r.label}</span>
 <span style={{fontSize:10,color:"#4a5a6e",textAlign:"center",fontVariantNumeric:"tabular-nums"}}>{r.minWR}%</span>
 {/* Barre WR avec seuil */}
 <div style={{position:"relative"}}>
 <div style={{height:7,background:"rgba(255,255,255,.05)",borderRadius:4,overflow:"visible",position:"relative"}}>
 <div style={{height:"100%",width:barW+"%",background:isOk?"rgba(34,197,94,.7)":"rgba(239,68,68,.7)",borderRadius:4}}/>
 <div style={{position:"absolute",left:threshW+"%",top:-3,bottom:-3,width:2,background:"rgba(255,255,255,.6)",borderRadius:1}}/>
 </div>
 <div style={{fontSize:9,fontWeight:700,color:isOk?"#22C55E":"#EF4444",marginTop:2}}>{isOk?<Ic n="check" s={9}/>:<Ic n="x" s={9}/>} {r.wr}% {isOk?`(+${gap}% au-dessus)`:`(${Math.abs(gap)}% sous le seuil)`}</div>
 </div>
 <span style={{fontSize:10,color:"#4a5a6e",textAlign:"center"}}>{r.cnt}</span>
 <span style={{fontSize:11,fontWeight:700,color:r.roi>=0?"#22C55E":"#EF4444",textAlign:"right"}}>{r.roi>=0?"+":""}{r.roi.toFixed(1)}%</span>
 <div style={{display:"flex",justifyContent:"flex-end"}}><FmtProfit v={r.profit} fontSize={11}/></div>
 </div>
 </div>
 );
 })}
 <div style={{padding:"6px 14px",background:"rgba(0,0,0,.2)",borderTop:"1px solid rgba(255,255,255,.04)"}}>
 <span style={{fontSize:9,color:"#3a4a5e"}}>Requis = WR minimum pour être profitable à cette cote · trait blanc = seuil</span>
 </div>
 </div>
 );
 })()}

 {/* CALIBRATION EDGE */}
 {advancedStats&&advancedStats.calibration.length>1&&(()=>{
 const snapE=e=>Math.round(Math.abs(e)*4)/4;
 // Séparer over et under
 const calcOU=(edgeVal,ou)=>{
 const s={cnt:0,won:0,profit:0,staked:0};
 settledFiltered.filter(b=>b.ppEdge!=null&&Math.abs(snapE(b.ppEdge)-edgeVal)<0.01&&b.overUnder===ou).forEach(b=>{
 s.cnt++;s.profit+=b.profit;s.staked+=b.stake;if(b.status==="won")s.won++;
 });
 return s;
 };
 const calcByGame=(edgeVal,ou)=>{
 const byGame={};
 settledFiltered.filter(b=>b.ppEdge!=null&&Math.abs(snapE(b.ppEdge)-edgeVal)<0.01&&b.overUnder===ou).forEach(b=>{
 const g=b.game||"?";
 if(!byGame[g])byGame[g]={cnt:0,won:0,profit:0,staked:0};
 const s=byGame[g];s.cnt++;s.profit+=b.profit;s.staked+=b.stake;if(b.status==="won")s.won++;
 });
 return byGame;
 };
 const Row=({c,ou,color,accentBg})=>{
 const s=calcOU(c.edge,ou);
 if(s.cnt<3)return null;
 const wr=Math.round(s.won/s.cnt*100);
 const roi=s.staked>0?s.profit/s.staked*100:0;
 const isGood=roi>0;
 const drillKey=`${c.edge}:${ou}`;
 const isOpen=calibDrill===drillKey;
 const byGame=isOpen?calcByGame(c.edge,ou):{};
 return(
 <div style={{borderTop:"1px solid rgba(255,255,255,.04)"}}>
 <div onClick={()=>setCalibDrill(isOpen?null:drillKey)}
 style={{display:"grid",gridTemplateColumns:"52px 30px 1fr 42px 54px 24px",gap:4,alignItems:"center",padding:"8px 14px",cursor:"pointer",background:isOpen?"rgba(99,102,241,.08)":isGood?"rgba(34,197,94,.025)":"rgba(239,68,68,.025)"}}>
 <span style={{fontSize:13,fontWeight:900,color:isOpen?"#a5b4fc":"#fff",fontVariantNumeric:"tabular-nums"}}>+{c.label}</span>
 <span style={{fontSize:10,color:"#4a5a6e",textAlign:"center"}}>{s.cnt}</span>
 <div style={{display:"flex",alignItems:"center",gap:4}}>
 <div style={{flex:1,height:5,background:"rgba(255,255,255,.05)",borderRadius:3,overflow:"hidden"}}>
 <div style={{height:"100%",width:wr+"%",background:isGood?"#22C55E":"#EF4444",borderRadius:3}}/>
 </div>
 <span style={{fontSize:10,fontWeight:700,color:wr>=55?"#22C55E":wr<45?"#EF4444":"#F59E0B",minWidth:26}}>{wr}%</span>
 </div>
 <span style={{fontSize:11,fontWeight:700,color:isGood?"#22C55E":"#EF4444",textAlign:"right"}}>{roi>=0?"+":""}{roi.toFixed(1)}%</span>
 <div style={{display:"flex",justifyContent:"flex-end"}}><FmtProfit v={s.profit} fontSize={11}/></div>
 <span style={{fontSize:11,color:isOpen?"#a5b4fc":"#3a4a5e",textAlign:"right"}}><Ic n={isOpen?"up":"down"} s={11}/></span>
 </div>
 {isOpen&&Object.keys(byGame).length>0&&(
 <div style={{margin:"0 10px 8px",background:"rgba(99,102,241,.05)",borderRadius:10,padding:"10px 12px",border:"1px solid rgba(99,102,241,.18)"}}>
 <div style={{fontSize:9,color:"#6366f1",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Par jeu — {ou} +{c.label}</div>
 {Object.entries(byGame).filter(([,v])=>v.cnt>0).sort((a,b)=>b[1].profit-a[1].profit).map(([game,v])=>{
 const gwr=Math.round(v.won/v.cnt*100);
 const groi=v.staked>0?v.profit/v.staked*100:0;
 return(
 <div key={game} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
 <GameLogo game={game} size={13}/>
 <span style={{fontSize:12,fontWeight:600,color:"#c8d4e8",width:56}}>{game}</span>
 <span style={{fontSize:10,color:"#4a5a6e"}}>{v.cnt}p</span>
 <span style={{fontSize:10,fontWeight:700,color:gwr>=55?"#22C55E":gwr<45?"#EF4444":"#F59E0B"}}>{gwr}%</span>
 <span style={{fontSize:10,fontWeight:700,color:groi>=0?"#22C55E":"#EF4444",marginLeft:"auto"}}>{groi>=0?"+":""}{groi.toFixed(1)}%</span>
 <FmtProfit v={v.profit} fontSize={11}/>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
 };
 const sorted=sortFn(advancedStats.calibration,calibSort);
 const HDR=()=>(
 <div style={{display:"grid",gridTemplateColumns:"52px 30px 1fr 42px 54px 24px",gap:4,padding:"4px 14px",background:"rgba(0,0,0,.3)"}}>
 {[["edge","Edge","left"],["cnt","N","center"],["wr","WR","left"],["roi","ROI","right"],["profit","Profit","right"],["","","right"]].map(([k,l,a],idx)=>(
 k?<SortHdr key={k} label={l} k={k} sort={calibSort} setSort={setCalibSort} align={a}/>:<span key={idx}/>
 ))}
 </div>
 );
 return(
 <div style={cardStyle}>
 {secTitle("","Calibration Edge PrizePicks","Clique → stats par jeu · séparé Over / Under")}
 {/* OVER */}
 <div style={{borderTop:"1px solid rgba(255,255,255,.06)",background:"rgba(34,197,94,.04)",padding:"5px 14px 3px"}}>
 <span style={{fontSize:9,color:"#22C55E",fontWeight:800,textTransform:"uppercase",letterSpacing:.8}}> Over</span>
 </div>
 <HDR/>
 {sorted.map(c=><Row key={`${c.edge}:over`} c={c} ou="Over" color="#22C55E" accentBg="rgba(34,197,94,.04)"/>)}
 {/* UNDER */}
 <div style={{borderTop:"2px solid rgba(255,255,255,.1)",background:"rgba(96,165,250,.04)",padding:"5px 14px 3px"}}>
 <span style={{fontSize:9,color:"#60a5fa",fontWeight:800,textTransform:"uppercase",letterSpacing:.8}}> Under</span>
 </div>
 <HDR/>
 {sorted.map(c=><Row key={`${c.edge}:under`} c={c} ou="Under" color="#60a5fa" accentBg="rgba(96,165,250,.04)"/>)}
 </div>
 );
 })()}
 {/* TOP / BAS JOUEURS */}
 {(()=>{
 const pm={};
 settledFiltered.forEach(b=>{
 const k=(b.player||"?").toLowerCase();
 if(!pm[k])pm[k]={player:b.player||"?",game:b.game,cnt:0,won:0,profit:0,staked:0};
 const p=pm[k];p.cnt++;p.profit+=b.profit;p.staked+=b.stake;if(b.status==="won")p.won++;
 });
 const list=Object.values(pm).filter(p=>p.cnt>=3).map(p=>({...p,roi:p.staked>0?p.profit/p.staked*100:0,wr:Math.round(p.won/p.cnt*100)}));
 const top5=list.filter(p=>p.profit>=0).sort((a,b)=>b.profit-a.profit).slice(0,5);
 const bot5=list.filter(p=>p.profit<0).sort((a,b)=>a.profit-b.profit).slice(0,5);
 if(!top5.length&&!bot5.length)return null;
 const PRow=({p,good,last})=>(
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:last?"none":"1px solid rgba(255,255,255,.04)"}}>
 <div style={{display:"flex",alignItems:"center",gap:5}}>
 <GameLogo game={p.game} size={11}/>
 <span style={{fontSize:12,color:"#c8d4e8",fontWeight:600,textTransform:"capitalize"}}>{p.player}</span>
 <span style={{fontSize:9,color:"#3a4a5e"}}>{p.wr}%WR</span>
 </div>
 <FmtProfit v={p.profit} fontSize={12}/>
 </div>
 );
 return(
 <div style={cardStyle}>
 {secTitle("","Top joueurs · À éviter","Min 3 paris")}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}>
 <div style={{padding:"10px 14px",borderRight:"1px solid rgba(255,255,255,.06)"}}>
 <div style={{fontSize:9,color:"#22C55E",fontWeight:800,textTransform:"uppercase",letterSpacing:.8,marginBottom:8,display:"flex",alignItems:"center",gap:4}}>
 <span style={{width:6,height:6,borderRadius:"50%",background:"#22C55E",display:"inline-block"}}/> Top 5
 </div>
 {top5.map((p,i)=><PRow key={p.player} p={p} good last={i===top5.length-1}/>)}
 </div>
 <div style={{padding:"10px 14px"}}>
 <div style={{fontSize:9,color:"#EF4444",fontWeight:800,textTransform:"uppercase",letterSpacing:.8,marginBottom:8,display:"flex",alignItems:"center",gap:4}}>
 <span style={{width:6,height:6,borderRadius:"50%",background:"#EF4444",display:"inline-block"}}/> À couper
 </div>
 {bot5.map((p,i)=><PRow key={p.player} p={p} last={i===bot5.length-1}/>)}
 </div>
 </div>
 </div>
 );
 })()}

 </>);
 })()}
 {/* Meilleur jour de semaine */}
 {(()=>{
  const DAYS=["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  const dow={};DAYS.forEach(d=>{dow[d]={label:d,count:0,won:0,profit:0};});
  settledFiltered.forEach(b=>{
   const dt=b.datetime?String(b.datetime):"";
   if(!dt||dt.length<10)return;
   try{const d=new Date(dt);const day=DAYS[d.getDay()];
   if(!dow[day])return;
   dow[day].count++;dow[day].profit+=b.profit;
   if(b.status==="won")dow[day].won++;}catch(e){}
  });
  const rows=Object.values(dow).filter(d=>d.count>0).sort((a,b)=>b.profit-a.profit);
  const maxAbs=Math.max(...rows.map(d=>Math.abs(d.profit)),1);
  const wrc=wr=>wr>=60?"#22C55E":wr>=50?"#9CA3AF":"#EF4444";
  const pc=p=>p>=0?"#22C55E":"#EF4444";
  if(rows.length===0)return null;
  return(
   <div style={{background:"rgba(10,12,28,.99)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,overflow:"hidden",marginBottom:10}}>
    <div style={{padding:"12px 14px",borderBottom:"1px solid rgba(255,255,255,.06)"}}>
     <span style={{fontSize:13,fontWeight:800,color:"#f0f4ff"}}>📆 Meilleur jour de semaine</span>
    </div>
    <div style={{padding:"4px 0"}}>
     <div style={{display:"grid",gridTemplateColumns:"36px 40px 44px 1fr 60px",gap:"0 8px",padding:"4px 14px",marginBottom:2}}>
      {[["Jour","left"],["Paris","center"],["WR","center"],["","left"],["Profit","right"]].map(([l,a])=>(
       <span key={l} style={{fontSize:9,color:"#374151",fontWeight:700,textTransform:"uppercase",letterSpacing:.7,textAlign:a}}>{l}</span>
      ))}
     </div>
     {rows.map(d=>{
      const wr=d.count>0?d.won/d.count*100:0;
      const barW=Math.abs(d.profit)/maxAbs*100;
      return(
       <div key={d.label} style={{display:"grid",gridTemplateColumns:"36px 40px 44px 1fr 60px",gap:"0 8px",alignItems:"center",padding:"7px 14px",borderTop:"1px solid rgba(255,255,255,.03)"}}>
        <span style={{fontSize:12,fontWeight:800,color:"#c8d4e8"}}>{d.label}</span>
        <span style={{fontSize:10,color:"#6B7280",textAlign:"center"}}>{d.count}p</span>
        <span style={{fontSize:11,fontWeight:700,color:wrc(wr),textAlign:"center"}}>{wr.toFixed(0)}%</span>
        <div style={{height:5,borderRadius:3,background:"rgba(255,255,255,.04)",overflow:"hidden"}}>
         <div style={{height:"100%",width:barW+"%",background:d.profit>=0?"#22C55E":"#EF4444",borderRadius:3,opacity:.75}}/>
        </div>
        <span style={{fontSize:11,fontWeight:700,color:pc(d.profit),textAlign:"right"}}>{d.profit>=0?"+":""}{d.profit.toFixed(0)}$</span>
       </div>
      );
     })}
    </div>
   </div>
  );
 })()}
 </div>
 )}


 {statsTab==="jeux"&&<>
 {/* PAR JEU — accordéons regroupés */}
 {ALL_GAMES.map(game=>{
 const gs=perGameStats[game];
 if(!gs)return null;
 const cfg=GAME_CFG[game]||{accent:"#9CA3AF"};
 const isOpen=!!statsGameOpen[game];
 const toggle=()=>setStatsGameOpen(s=>({...s,[game]:!s[game]}));
 const drillGame=()=>setStatsDrill({game,league:null});
 return(
 <div key={game} style={{marginBottom:10}}>
 {/* Accordéon header */}
 <button onClick={toggle} style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"stretch",background:"#111827",border:"1px solid "+(isOpen?cfg.accent+"55":"#1F2937"),borderRadius:isOpen?"14px 14px 0 0":"14px",padding:"12px 14px",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all .2s ease",textAlign:"left"}}>
 {/* Top row */}
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <GameLogo game={game} size={18}/>
 <span style={{fontSize:14,fontWeight:700,color:cfg.accent}}>{game}</span>
 <span style={{fontSize:10,color:"#6B7280"}}>{gs.count} paris</span>
 </div>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <span style={{padding:"2px 8px",borderRadius:6,background:gs.profit>=0?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)",fontSize:11,fontWeight:700,color:gs.profit>=0?"#22C55E":"#EF4444"}}>{gs.profit>=0?"+":""}{gs.profit.toFixed(0)}$</span>
 <span style={{fontSize:11,color:"#6B7280",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}><Ic n="down" s={12}/></span>
 </div>
 </div>
 {/* Stats row */}
 <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
 <span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>{gs.wr.toFixed(0)}% WR</span>
 <span style={{fontSize:11,color:"#6B7280"}}>·</span>
 <span style={{fontSize:11,fontWeight:700,color:gs.roi>=0?"#22C55E":"#EF4444"}}>{gs.roi>=0?"+":""}{gs.roi.toFixed(1)}% ROI</span>
 <span style={{fontSize:11,color:"#6B7280"}}>·</span>
 <span style={{fontSize:11,color:"#9CA3AF"}}>@{gs.avgOdds.toFixed(2)} moy.</span>
 <span style={{fontSize:11,color:"#6B7280"}}>·</span>
 <span style={{fontSize:11,fontWeight:700,color:gs.profit>=0?"#22C55E":"#EF4444",background:gs.profit>=0?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)",padding:"1px 6px",borderRadius:5}}>{gs.profit>=0?"+":""}{bankroll>0?(gs.profit/bankroll*100).toFixed(1):0}% BK</span>
 </div>
 {/* Progress bar: WR */}
 {(()=>{
 const wr=gs.wr;
 const roiAbs=Math.min(Math.abs(gs.roi),50); // cap à 50%
 return(
 <div style={{display:"flex",gap:4,alignItems:"center"}}>
 {/* WR bar */}
 <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden"}}>
 <div style={{height:"100%",width:wr+"%",background:wr>55?"linear-gradient(90deg,#22C55E,#22C55E)":wr<45?"linear-gradient(90deg,#EF4444,#EF4444)":"linear-gradient(90deg,#9CA3AF,#6B7280)",borderRadius:2,transition:"width .5s ease"}}/>
 </div>
 {/* ROI bar */}
 <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden",position:"relative"}}>
 <div style={{position:"absolute",top:0,left:gs.roi>=0?"50%":"calc(50% - "+(roiAbs/100*100/2)+"%)",height:"100%",width:(roiAbs/50*50)+"%",background:gs.roi>=0?"linear-gradient(90deg,#3B82F6,#06B6D4)":"linear-gradient(90deg,#EF4444,#EF4444)",borderRadius:2,transition:"all .5s ease"}}/>
 </div>
 </div>
 );
 })()}
 </button>

 {isOpen&&(
 <div style={{background:"#111827",border:"1px solid #1F2937",borderTop:"none",borderRadius:"0 0 14px 14px",overflow:"hidden"}}>

 {(gs.overS||gs.underS)&&(
 <>
 <div style={{fontSize:11,color:"#60A5FA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderBottom:"1px solid rgba(96,165,250,0.2)",fontFamily:"'Inter',sans-serif",borderTop:"1px solid #1F2937"}}> Over / Under</div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 40px 48px 64px 16px",gap:2,padding:"4px 14px 6px"}}>
 <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textTransform:"uppercase"}}>Type</span>
 <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"center"}}>N</span>
 <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"center"}}>WR%</span>
 <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"right"}}>Profit</span>
 <span/>
 </div>
 {[{label:" Over",s:gs.overS},{label:" Under",s:gs.underS}].filter(x=>x.s).map(({label,s})=>(
 <div key={label} style={{display:"grid",gridTemplateColumns:"1fr 40px 48px 64px 16px",gap:2,padding:"6px 14px",borderTop:"1px solid #1F2937",alignItems:"center"}}>
 <span style={{fontSize:12,fontWeight:600,color:"#60A5FA"}}>{label}</span>
 <span style={{fontSize:11,color:"#9CA3AF",textAlign:"center"}}>{s.count}</span>
 <span style={{fontSize:11,fontWeight:700,color:s.wr>55?"#22C55E":s.wr<45?"#EF4444":"#9CA3AF",textAlign:"center"}}>{s.wr.toFixed(0)}%</span>
 <span style={{fontSize:11,fontWeight:700,color:s.profit>=0?"#22C55E":"#EF4444",textAlign:"right"}}>{s.profit>=0?"+":""}{(s.profit||0).toFixed(0)}$</span>
 <span style={{fontSize:10}}>{s.wr>55?<Ic n="trendUp" s={11} c="#22C55E"/>:s.wr<45?<Ic n="trendDown" s={11} c="#EF4444"/>:null}</span>
 </div>
 ))}
 </>
 )}

 {/* Kills */}
 {gs.kills.length>0&&(
 <>
 <div style={{fontSize:11,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderBottom:"1px solid rgba(124,58,237,0.2)",fontFamily:"'Inter',sans-serif",borderTop:"1px solid #1F2937"}}>Lignes Kills</div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 40px 48px 64px 16px",gap:2,padding:"4px 14px 6px"}}>
 <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textTransform:"uppercase"}}>Ligne</span>
 <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"center"}}>N</span>
 <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"center"}}>WR%</span>
 <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"right"}}>Profit</span>
 <span/>
 </div>
 {gs.kills.map((r,i)=>(
 <div key={r.line} onClick={()=>setStatsDrill({game,league:null,filterType:"kill",filterValue:r.line.replace(" K"," Kills").replace(" HS"," Headshots")})} style={{display:"grid",gridTemplateColumns:"1fr 40px 48px 64px 16px",gap:2,padding:"6px 14px",borderTop:"1px solid #1F2937",alignItems:"center",cursor:"pointer"}}>
 <span style={{fontSize:12,fontWeight:600,color:"#818CF8",display:"flex",alignItems:"center",gap:4}}>{r.line} <span style={{fontSize:9,color:"#4B5563"}}>›</span></span>
 <span style={{fontSize:11,color:"#9CA3AF",textAlign:"center"}}>{r.count}</span>
 <span style={{fontSize:11,fontWeight:700,color:r.wr>55?"#22C55E":r.wr<45?"#EF4444":"#9CA3AF",textAlign:"center"}}>{r.wr.toFixed(0)}%</span>
 <span style={{fontSize:11,fontWeight:700,color:r.profit>=0?"#22C55E":"#EF4444",textAlign:"right"}}>{r.profit>=0?"+":""}{(r.profit||0).toFixed(0)}$</span>
 <span style={{fontSize:10}}>{r.wr>55?<Ic n="trendUp" s={11} c="#22C55E"/>:r.wr<45?<Ic n="trendDown" s={11} c="#EF4444"/>:null}</span>
 </div>
 ))}
 </>
 )}

 {/* Top 5 + Worst 5 joueurs */}
 {gs.topP.length>0&&(()=>{
 var showAll=playersExpanded===game;
 var allP=gs.allPlayers||[];
 var sortKey=playerSortKey||"profit";
 var sorted=[...allP].filter(function(p){return p.count>=playerMinBets;}).sort(function(a,b){
 if(sortKey==="profit")return b.profit-a.profit;
 if(sortKey==="count")return b.count-a.count;
 if(sortKey==="wr")return (b.count>0?b.won/b.count:0)-(a.count>0?a.won/a.count:0);
 return b.profit-a.profit;
 });
 var displayList=showAll?sorted.slice(0,50):sorted.slice(0,5);
 return(<>
 <div onClick={function(){setPlayersExpanded(showAll?null:game);}}
 style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,color:"#00E676",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderBottom:"1px solid rgba(74,222,128,.15)",fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
 <span> {showAll?"Top 50":"Top 5"} joueurs</span>
 <span style={{fontSize:10,color:"#4a5a6e"}}>{showAll?" Réduire":"Voir 50 →"}</span>
 </div>
 {showAll&&<div style={{display:"flex",gap:5,padding:"8px 14px",borderBottom:"1px solid #1F2937",flexWrap:"wrap",alignItems:"center"}}>
 {[{k:"profit",l:"Profit"},{k:"count",l:"Paris"},{k:"wr",l:"WR%"}].map(function(s){
 var on=sortKey===s.k;
 return <button key={s.k} onClick={function(e){e.stopPropagation();setPlayerSortKey(s.k);}}
 style={{padding:"3px 10px",borderRadius:6,border:"1px solid "+(on?"rgba(0,230,118,.4)":"rgba(255,255,255,.07)"),background:on?"rgba(0,230,118,.1)":"transparent",color:on?"#00E676":"#6B7280",fontSize:10,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{s.l}</button>;
 })}
 <div style={{width:1,height:14,background:"rgba(255,255,255,.08)",margin:"0 2px"}}/>
 <span style={{fontSize:9,color:"#4a5a6e",fontWeight:600}}>Min paris:</span>
 {[1,3,5,10,20].map(function(n){
 var on=playerMinBets===n;
 return <button key={n} onClick={function(e){e.stopPropagation();setPlayerMinBets(n);}}
 style={{padding:"3px 9px",borderRadius:6,border:"1px solid "+(on?"rgba(167,139,250,.4)":"rgba(255,255,255,.07)"),background:on?"rgba(124,58,237,.12)":"transparent",color:on?"#c4b5fd":"#6B7280",fontSize:10,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{n}+</button>;
 })}
 <span style={{fontSize:10,color:"#4a5a6e",marginLeft:4}}>{sorted.length} joueurs</span>
 </div>}
 {displayList.map(function(p,i){
 var wr=p.count>0?(p.won/p.count*100).toFixed(0):0;
 return(
 <div key={p.player} className="stat-row" onClick={function(){setStatsDrill({game,league:null,filterType:"player",filterValue:p.player});}} style={{cursor:"pointer"}}>
 <div style={{display:"flex",alignItems:"center",gap:9}}>
 <span style={{fontSize:11,color:i<3?"#fbbf24":"#6B7280",fontWeight:700,width:20,textAlign:"center"}}>{i+1}</span>
 <div>
 <div style={{display:"flex",alignItems:"center",gap:5}}>
 <div onClick={function(e){e.stopPropagation();openPlayerSheet(p.player);}} style={{fontWeight:700,fontSize:13,color:"#E5E7EB",textTransform:"capitalize",cursor:"pointer",textDecoration:"underline dotted rgba(167,139,250,.6)",textUnderlineOffset:3}}>{p.player}</div>
 <span style={{fontSize:10,color:"#4B5563"}}>›</span>
 </div>
 <div style={{fontSize:10,color:"#6B7280"}}>{p.count} paris · {wr}% WR</div>
 </div>
 </div>
 <span style={{fontWeight:700,fontSize:13,color:p.profit>=0?"#22C55E":"#EF4444"}}>{p.profit>=0?"+":""}{(p.profit||0).toFixed(0)}$</span>
 </div>
 );
 })}
 </>);
 })()}

 {/* Maps */}
 {gs.maps.length>0&&(
 <>
 <div style={{fontSize:11,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderBottom:"1px solid rgba(124,58,237,0.2)",fontFamily:"'Inter',sans-serif",borderTop:"1px solid #1F2937"}}>Maps</div>
 {gs.maps.map(m=>{
 const wr=m.count>0?(m.won/m.count*100):0;
 const roi=m.staked>0?(m.profit/m.staked*100):0;
 return(
 <div key={m.tag} className="stat-row" onClick={()=>setStatsDrill({game,league:null,filterType:"map",filterValue:m.tag})} style={{cursor:"pointer"}}>
 <div>
 <div style={{display:"flex",alignItems:"center",gap:5}}>
 <div style={{fontWeight:600,fontSize:13,color:"#F59E0B"}}>{m.tag}</div>
 <span style={{fontSize:10,color:"#4B5563"}}>›</span>
 </div>
 <div style={{fontSize:10,color:"#6B7280"}}>{m.count} paris · {wr.toFixed(0)}% WR</div>
 </div>
 <div style={{textAlign:"right"}}>
 <div style={{fontWeight:700,fontSize:13,color:m.profit>=0?"#22C55E":"#EF4444"}}>{m.profit>=0?"+":""}{(m.profit||0).toFixed(0)}$</div>
 <div style={{fontSize:10,color:roi>=0?"#22C55E":"#EF4444"}}>{roi>=0?"+":""}{roi.toFixed(1)}%</div>
 </div>
 </div>
 );
 })}
 </>
 )}

 {/* Positions */}
 {gs.roles.length>0&&(
 <>
 <div style={{fontSize:11,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderBottom:"1px solid rgba(124,58,237,0.2)",fontFamily:"'Inter',sans-serif",borderTop:"1px solid #1F2937"}}>Positions</div>
 {gs.roles.map(r=>{
 const wr=r.count>0?(r.won/r.count*100):0;
 const roi=r.staked>0?(r.profit/r.staked*100):0;
 return(
 <div key={r.role} className="stat-row" onClick={()=>setStatsDrill({game,league:null,filterType:"role",filterValue:r.role})} style={{cursor:"pointer"}}>
 <div>
 <div style={{display:"flex",alignItems:"center",gap:5}}>
 {game==="LoL"&&<RoleLogo role={r.role} size={16}/>}
 <div style={{fontWeight:600,fontSize:13,color:"#E5E7EB"}}>{r.role}</div>
 <span style={{fontSize:10,color:"#4B5563"}}>›</span>
 </div>
 <div style={{fontSize:10,color:"#6B7280"}}>{r.count} paris · {wr.toFixed(0)}% WR</div>
 </div>
 <div style={{textAlign:"right"}}>
 <div style={{fontWeight:700,fontSize:13,color:r.profit>=0?"#22C55E":"#EF4444"}}>{r.profit>=0?"+":""}{(r.profit||0).toFixed(0)}$</div>
 <div style={{fontSize:10,color:roi>=0?"#22C55E":"#EF4444"}}>{roi>=0?"+":""}{roi.toFixed(1)}%</div>
 </div>
 </div>
 );
 })}
 </>
 )}

 {/* Ligues */}
 {gs.leagues.length>0&&game!=="CS2"&&game!=="Dota2"&&game!=="LoL"&&game!=="Valorant"&&(
 <>
 <div style={{fontSize:11,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderBottom:"1px solid rgba(124,58,237,0.2)",fontFamily:"'Inter',sans-serif",borderTop:"1px solid #1F2937"}}>Ligues</div>
 {gs.leagues.map(l=>{
 const wr=l.count>0?(l.won/l.count*100):0;
 const roi=l.staked>0?(l.profit/l.staked*100):0;
 return(
 <div key={l.league} className="stat-row" onClick={()=>setStatsDrill({game,league:l.league})} style={{cursor:"pointer"}}>
 <div>
 <div style={{fontWeight:600,fontSize:13,color:"#E5E7EB"}}>{l.league}</div>
 <div style={{fontSize:10,color:"#6B7280"}}>{l.count} paris · {wr.toFixed(0)}% WR</div>
 </div>
 <div style={{textAlign:"right"}}>
 <div style={{fontWeight:700,fontSize:13,color:l.profit>=0?"#22C55E":"#EF4444"}}>{l.profit>=0?"+":""}{(l.profit||0).toFixed(0)}$</div>
 <div style={{fontSize:10,color:roi>=0?"#22C55E":"#EF4444"}}>{roi>=0?"+":""}{roi.toFixed(1)}%</div>
 </div>
 </div>
 );
 })}
 </>
 )}

 {/* Tournois */}
 {gs.tourneys.length>0&&(
 <>
 <div style={{fontSize:11,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderBottom:"1px solid rgba(124,58,237,0.2)",fontFamily:"'Inter',sans-serif",borderTop:"1px solid #1F2937"}}>Tournois</div>
 {gs.tourneys.map(t=>{
 const wr=t.count>0?(t.won/t.count*100):0;
 const roi=t.staked>0?(t.profit/t.staked*100):0;
 return(
 <div key={t.name} className="stat-row" onClick={()=>setStatsDrill({game,league:null,filterType:"tourney",filterValue:t.name})} style={{cursor:"pointer"}}>
 <div style={{display:"flex",alignItems:"center",gap:7}}>
 {t.name==="Hors tournoi"
 ?<span style={{fontSize:12}}><Ic n="ban" s={12} c="#6B7280"/></span>
 :<LeagueLogo league={t.name} size={18}/>}
 <div>
 <div style={{display:"flex",alignItems:"center",gap:5}}>
 <div style={{fontWeight:600,fontSize:13,color:t.name==="Hors tournoi"?"#9CA3AF":"#E5E7EB"}}>{t.name}</div>
 <span style={{fontSize:10,color:"#4B5563"}}>›</span>
 </div>
 <div style={{fontSize:10,color:"#6B7280"}}>{t.count} paris · {wr.toFixed(0)}% WR</div>
 </div>
 </div>
 <div style={{textAlign:"right"}}>
 <div style={{fontWeight:700,fontSize:13,color:t.profit>=0?"#22C55E":"#EF4444"}}>{t.profit>=0?"+":""}{(t.profit||0).toFixed(0)}$</div>
 <div style={{fontSize:10,color:roi>=0?"#22C55E":"#EF4444"}}>{roi>=0?"+":""}{roi.toFixed(1)}%</div>
 </div>
 </div>
 );
 })}
 </>
 )}

 {/* Headshots */}
 {gs.hs.length>0&&(
 <>
 <div style={{fontSize:11,color:"#818CF8",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderTop:"1px solid #1F2937",borderBottom:"1px solid rgba(129,140,248,0.2)",fontFamily:"'Inter',sans-serif"}}> Headshots</div>
 {gs.hs.map((r,i)=>(
 <div key={r.line} style={{display:"grid",gridTemplateColumns:"1fr 40px 48px 64px 16px",gap:2,padding:"6px 14px",borderTop:"1px solid #1F2937",alignItems:"center"}}>
 <span style={{fontSize:12,fontWeight:600,color:"#818CF8"}}>{r.line}</span>
 <span style={{fontSize:11,color:"#9CA3AF",textAlign:"center"}}>{r.count}</span>
 <span style={{fontSize:11,fontWeight:700,color:r.wr>55?"#22C55E":r.wr<45?"#EF4444":"#9CA3AF",textAlign:"center"}}>{r.wr.toFixed(0)}%</span>
 <span style={{fontSize:11,fontWeight:700,color:r.profit>=0?"#22C55E":"#EF4444",textAlign:"right"}}>{r.profit>=0?"+":""}{(r.profit||0).toFixed(0)}$</span>
 <span style={{fontSize:10}}>{r.wr>55?<Ic n="trendUp" s={11} c="#22C55E"/>:r.wr<45?<Ic n="trendDown" s={11} c="#EF4444"/>:null}</span>
 </div>
 ))}
 </>
 )}

 {/* Live & HS globaux */}
 {(gs.liveS||gs.hsS)&&(
  <>
  <div style={{fontSize:11,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderTop:"1px solid #1F2937",borderBottom:"1px solid rgba(124,58,237,0.2)",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
   <span>Live{game!=="CS2"?" & Headshot":""}</span>
   {game==="LoL"&&gs.liveS&&gs.nonLiveS&&(
    <div style={{display:"flex",gap:4}}>
     <button onClick={()=>setLolLiveMode("live")}
      style={{padding:"3px 10px",borderRadius:20,border:"1px solid "+(lolLiveMode==="live"?"#FF4757":"rgba(255,71,87,.25)"),background:lolLiveMode==="live"?"rgba(255,71,87,.15)":"transparent",color:lolLiveMode==="live"?"#FF4757":"#6B7280",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
      🔴 Live
     </button>
     <button onClick={()=>setLolLiveMode("nonlive")}
      style={{padding:"3px 10px",borderRadius:20,border:"1px solid "+(lolLiveMode==="nonlive"?"#9CA3AF":"rgba(156,163,175,.25)"),background:lolLiveMode==="nonlive"?"rgba(156,163,175,.12)":"transparent",color:lolLiveMode==="nonlive"?"#E5E7EB":"#6B7280",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
      Non-Live
     </button>
    </div>
   )}
  </div>
  {/* LoL avec filtres Live/Non-Live */}
  {game==="LoL"&&lolLiveMode==="live"&&gs.liveS&&(
   <div className="stat-row">
    <div style={{display:"flex",alignItems:"center",gap:9}}>
     <span style={{fontSize:14}}>🔴</span>
     <div>
      <div style={{fontWeight:700,fontSize:13,color:"#FF4757"}}>Paris Live</div>
      <div style={{fontSize:10,color:"#6B7280"}}>{gs.liveS.count} paris · {gs.liveS.wr.toFixed(0)}% WR</div>
     </div>
    </div>
    <div style={{textAlign:"right"}}>
     <div style={{fontWeight:700,fontSize:13,color:gs.liveS.profit>=0?"#22C55E":"#EF4444"}}>{gs.liveS.profit>=0?"+":""}{gs.liveS.profit.toFixed(0)}$</div>
     <div style={{fontSize:10,color:gs.liveS.roi>=0?"#22C55E":"#EF4444"}}>{gs.liveS.roi>=0?"+":""}{gs.liveS.roi.toFixed(1)}% ROI</div>
    </div>
   </div>
  )}
  {game==="LoL"&&lolLiveMode==="nonlive"&&gs.nonLiveS&&(
   <div className="stat-row">
    <div style={{display:"flex",alignItems:"center",gap:9}}>
     <span style={{fontSize:14}}>📊</span>
     <div>
      <div style={{fontWeight:700,fontSize:13,color:"#9CA3AF"}}>Non-Live</div>
      <div style={{fontSize:10,color:"#6B7280"}}>{gs.nonLiveS.count} paris · {gs.nonLiveS.wr.toFixed(0)}% WR</div>
     </div>
    </div>
    <div style={{textAlign:"right"}}>
     <div style={{fontWeight:700,fontSize:13,color:gs.nonLiveS.profit>=0?"#22C55E":"#EF4444"}}>{gs.nonLiveS.profit>=0?"+":""}{gs.nonLiveS.profit.toFixed(0)}$</div>
     <div style={{fontSize:10,color:gs.nonLiveS.roi>=0?"#22C55E":"#EF4444"}}>{gs.nonLiveS.roi>=0?"+":""}{gs.nonLiveS.roi.toFixed(1)}% ROI</div>
    </div>
   </div>
  )}
  {/* Tous les autres jeux sauf LoL — Live seulement (pas nonLive) */}
  {game!=="LoL"&&gs.liveS&&(
   <div className="stat-row">
    <div style={{display:"flex",alignItems:"center",gap:9}}>
     <span style={{fontSize:14}}>🔴</span>
     <div>
      <div style={{fontWeight:700,fontSize:13,color:"#FF4757"}}>Paris Live</div>
      <div style={{fontSize:10,color:"#6B7280"}}>{gs.liveS.count} paris · {gs.liveS.wr.toFixed(0)}% WR</div>
     </div>
    </div>
    <div style={{textAlign:"right"}}>
     <div style={{fontWeight:700,fontSize:13,color:gs.liveS.profit>=0?"#22C55E":"#EF4444"}}>{gs.liveS.profit>=0?"+":""}{gs.liveS.profit.toFixed(0)}$</div>
     <div style={{fontSize:10,color:gs.liveS.roi>=0?"#22C55E":"#EF4444"}}>{gs.liveS.roi>=0?"+":""}{gs.liveS.roi.toFixed(1)}% ROI</div>
    </div>
   </div>
  )}
 {gs.hsS&&(
 <div className="stat-row">
 <div style={{display:"flex",alignItems:"center",gap:9}}>
 <span style={{fontSize:14}}><Ic n="target" s={14} c="#818CF8"/></span>
 <div>
 <div style={{fontWeight:700,fontSize:13,color:"#818CF8"}}>Paris HS</div>
 <div style={{fontSize:10,color:"#6B7280"}}>{gs.hsS.count} paris · {gs.hsS.wr.toFixed(0)}% WR</div>
 </div>
 </div>
 <div style={{textAlign:"right"}}>
 <div style={{fontWeight:700,fontSize:13,color:gs.hsS.profit>=0?"#22C55E":"#EF4444"}}>{gs.hsS.profit>=0?"+":""}{gs.hsS.profit.toFixed(0)}$</div>
 <div style={{fontSize:10,color:gs.hsS.roi>=0?"#22C55E":"#EF4444"}}>{gs.hsS.roi>=0?"+":""}{gs.hsS.roi.toFixed(1)}% ROI</div>
 </div>
 </div>
 )}
 {gs.hsNonS&&(
 <div className="stat-row">
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <img src={HEADSHOT_LOGO_B64} alt="HS" style={{width:16,height:16,objectFit:"contain",filter:"brightness(0) invert(1)",opacity:.8,verticalAlign:"middle"}}/>
 <div>
 <div style={{fontWeight:700,fontSize:13,color:"#9CA3AF"}}>Non-Headshot</div>
 <div style={{fontSize:10,color:"#6B7280"}}>{gs.hsNonS.count} paris · {gs.hsNonS.wr.toFixed(0)}% WR</div>
 </div>
 </div>
 <div style={{textAlign:"right"}}>
 <div style={{fontWeight:700,fontSize:13,color:gs.hsNonS.profit>=0?"#22C55E":"#EF4444"}}>{gs.hsNonS.profit>=0?"+":""}{gs.hsNonS.profit.toFixed(0)}$</div>
 <div style={{fontSize:10,color:gs.hsNonS.roi>=0?"#22C55E":"#EF4444"}}>{gs.hsNonS.roi>=0?"+":""}{gs.hsNonS.roi.toFixed(1)}% ROI</div>
 </div>
 </div>
 )}
 </>
 )}


 {/* PP Lignes par jeu */}
 {(()=>{
 const gamePPBets=settledFiltered.filter(b=>
 b.game===game&&b.ppLine&&b.ppMapType==="Map 1+2"&&b.status!=="pending"
 );
 if(gamePPBets.length===0)return null;
 const byLine={};
 gamePPBets.forEach(b=>{
 const pp=parseFloat(b.ppLine);
 if(isNaN(pp))return;
 const key=pp.toFixed(1);
 if(!byLine[key])byLine[key]={line:pp,over:{cnt:0,won:0,profit:0,staked:0},under:{cnt:0,won:0,profit:0,staked:0}};
 const t=b.overUnder==="Over"?byLine[key].over:byLine[key].under;
 t.cnt++;t.profit+=b.profit;t.staked+=b.stake;
 if(b.status==="won")t.won++;
 });
 const lines=Object.values(byLine).sort((a,b)=>{
 return(b.over.profit+b.under.profit)-(a.over.profit+a.under.profit);
 });
 if(lines.length===0)return null;
 const sRow=(t,ou)=>{
 if(t.cnt===0)return null;
 const wr=Math.round(t.won*100/t.cnt);
 const roi=t.staked>0?Math.round(t.profit*1000/t.staked)/10:0;
 return(
 <div style={{display:"flex",gap:6,alignItems:"center",marginTop:2}}>
 <span style={{fontSize:9,fontWeight:700,color:ou==="Over"?"#00E676":"#60a5fa",minWidth:36}}>{ou}:</span>
 <span style={{fontSize:10,color:"#6a5a8e"}}>{t.cnt}p</span>
 <span style={{fontSize:10,fontWeight:700,color:wr>=55?"#00E676":wr<45?"#f87171":"#9CA3AF"}}>{wr}% WR</span>
 <span style={{fontSize:10,fontWeight:600,color:roi>=0?"#00E676":"#f87171"}}>{roi>=0?"+":""}{roi.toFixed(1)}% ROI</span>
 <span style={{fontSize:10,fontWeight:800,color:t.profit>=0?"#00E676":"#f87171",marginLeft:"auto"}}>{t.profit>=0?"+":""}{t.profit.toFixed(0)}$</span>
 </div>
 );
 };
 return(
 <>
 <div style={{fontSize:11,color:"#a78bfa",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderTop:"1px solid #1F2937",borderBottom:"1px solid rgba(139,92,246,.2)",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",gap:7}}>
 <img src={_B64_PP_LOGO_B64} alt="PP" style={{width:14,height:14,borderRadius:3,objectFit:"cover"}}/>
 Lignes PrizePicks
 </div>
 {lines.map(l=>(
 <div key={l.line} style={{padding:"8px 14px",borderTop:"1px solid #1F2937"}}>
 <div style={{fontSize:13,fontWeight:800,color:"#c4b5fd",marginBottom:3}}>Ligne {l.line.toFixed(1)}</div>
 {sRow(l.over,"Over")}
 {sRow(l.under,"Under")}
 </div>
 ))}
 </>
 );
 })()}


 {/* Duels */}
 {gs.duels&&gs.duels.length>0&&(
 <>
 <div style={{fontSize:11,color:"#F59E0B",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderBottom:"1px solid rgba(245,158,11,0.2)",fontFamily:"'Inter',sans-serif",borderTop:"1px solid #1F2937"}}> Duels</div>
 {gs.duels.map((r,i)=>(
 <div key={r.line} style={{display:"grid",gridTemplateColumns:"1fr 40px 48px 64px 16px",gap:2,padding:"6px 14px",borderTop:"1px solid #1F2937",alignItems:"center"}}>
 <span style={{fontSize:12,fontWeight:600,color:"#F59E0B"}}>Duels</span>
 <span style={{fontSize:11,color:"#9CA3AF",textAlign:"center"}}>{r.count}</span>
 <span style={{fontSize:11,fontWeight:700,color:r.wr>55?"#22C55E":r.wr<45?"#EF4444":"#9CA3AF",textAlign:"center"}}>{r.wr.toFixed(0)}%</span>
 <span style={{fontSize:11,fontWeight:700,color:r.profit>=0?"#22C55E":"#EF4444",textAlign:"right"}}>{r.profit>=0?"+":""}{(r.profit||0).toFixed(0)}$</span>
 <span style={{fontSize:10}}>{r.wr>55?<Ic n="trendUp" s={11} c="#22C55E"/>:r.wr<45?<Ic n="trendDown" s={11} c="#EF4444"/>:null}</span>
 </div>
 ))}
 </>
 )}
 </div>
 )}
 </div>
 );
 })}

 </>}

 {/* Over / Under */}
  {statsTab==="cote_bk"&&(
  <div style={{display:"flex",flexDirection:"column",gap:12}}>
   <CoteTab settledFiltered={settledFiltered}/>
  <div style={{background:"rgba(10,12,28,.99)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,overflow:"hidden"}}>
   <div style={{padding:"13px 16px",borderBottom:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",gap:8}}>
    <span style={{fontSize:14}}>📚</span>
    <span style={{fontSize:13,fontWeight:800,color:"#f0f4ff"}}>
     {bkDrillGame?bkDrillOpen+" → "+bkDrillGame:bkDrillOpen||"Bookmakers"}
    </span>
    {bkDrillOpen&&(
     <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
      {bkDrillGame&&<button onClick={()=>setBkDrillGame(null)} style={{fontSize:10,color:"#6B7280",background:"rgba(255,255,255,.06)",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>← {bkDrillOpen}</button>}
      <button onClick={()=>{setBkDrillOpen(null);setBkDrillGame(null);}} style={{fontSize:10,color:"#f87171",background:"rgba(239,68,68,.1)",border:"none",borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>✕</button>
     </div>
    )}
   </div>
   {/* Niveau 1 — liste bookmakers */}
   {!bkDrillOpen&&(
    <div>
     {bkStatsSorted.map(([bk,s])=>{
      const wr=s.count>0?(s.won/s.count*100).toFixed(0):0;
      const roi=s.staked>0?(s.profit/s.staked*100):0;
      const avgOdds=s.count>0?(s.oddsSum/s.count).toFixed(2):0;
      const logo=BK_LOGOS[bk]||bkPhotos[bk];
      return(
       <button key={bk} onClick={()=>{setBkDrillOpen(bk);setBkDrillGame(null);}} style={{width:"100%",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"transparent",border:"none",borderBottom:"1px solid #1F2937",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
        <div style={{display:"flex",alignItems:"center",gap:9}}>
         {logo&&<img src={logo} alt={bk} style={{width:28,height:28,borderRadius:7,objectFit:"cover",flexShrink:0}}/>}
         <div>
          <div style={{fontWeight:700,fontSize:14,color:"#E5E7EB"}}>{bk}</div>
          <div style={{fontSize:10,color:"#6B7280"}}>{s.count} paris · {wr}% WR · @{avgOdds}</div>
         </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
         <div style={{textAlign:"right"}}>
          <div style={{fontWeight:700,fontSize:14,color:s.profit>=0?"#22C55E":"#EF4444"}}>{s.profit>=0?"+":""}{s.profit.toFixed(0)}$</div>
          <div style={{fontSize:10,color:roi>=0?"#22C55E":"#EF4444"}}>{roi>=0?"+":""}{roi.toFixed(1)}% ROI</div>
         </div>
         <span style={{color:"#4a5a6e",fontSize:18}}>›</span>
        </div>
       </button>
      );
     })}
    </div>
   )}
   {/* Niveau 2 — bookmaker → jeux */}
   {bkDrillOpen&&!bkDrillGame&&(()=>{
    const bkData=bkDrillStats[bkDrillOpen]||{};
    const games=ALL_GAMES.filter(g=>bkData[g]&&bkData[g].count>0);
    if(games.length===0)return <div style={{padding:"30px",textAlign:"center",color:"#4a5a6e"}}>Aucun paris</div>;
    return(
     <div>
      <div style={{padding:"10px 16px 4px",fontSize:11,color:"#6B7280"}}>Clique sur un jeu pour voir le détail complet</div>
      {games.map(g=>{
       const s=bkData[g];
       const cfg=GAME_CFG[g]||{accent:"#9CA3AF"};
       const wr=s.count>0?(s.won/s.count*100).toFixed(0):0;
       const roi=s.staked>0?(s.profit/s.staked*100):0;
       return(
        <button key={g} onClick={()=>setBkDrillGame(g)} style={{width:"100%",padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",background:"transparent",border:"none",borderBottom:"1px solid #1F2937",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
         <div>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
           <GameLogo game={g} size={16}/>
           <span style={{fontWeight:700,fontSize:13,color:cfg.accent}}>{g}</span>
           <span style={{fontSize:10,color:"#6B7280"}}>{s.count} paris</span>
          </div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
           {[["WR",wr+"%",parseFloat(wr)>55?"#22C55E":parseFloat(wr)<45?"#EF4444":"#9CA3AF"],["ROI",(roi>=0?"+":"")+roi.toFixed(1)+"%",roi>=0?"#22C55E":"#EF4444"],["@"+(s.count>0?(s.oddsSum/s.count).toFixed(2):"?"),"cote moy","#9CA3AF"],["Over",s.over.c+"p","#60A5FA"],["Under",s.under.c+"p","#818CF8"],["Live",s.live.c+"p","#F59E0B"],["HS",s.hs.c+"p","#EC4899"]].map(([v,l,c])=>(
            <span key={l} style={{fontSize:10,color:"#4a5a6e"}}><span style={{color:c,fontWeight:700}}>{v}</span> {l}</span>
           ))}
          </div>
         </div>
         <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontWeight:700,fontSize:14,color:s.profit>=0?"#22C55E":"#EF4444"}}>{s.profit>=0?"+":""}{s.profit.toFixed(0)}$</span>
          <span style={{color:"#4a5a6e",fontSize:18}}>›</span>
         </div>
        </button>
       );
      })}
     </div>
    );
   })()}
   {/* Niveau 3 — bookmaker + jeu → détail complet */}
   {bkDrillOpen&&bkDrillGame&&(()=>{
    const s=(bkDrillStats[bkDrillOpen]||{})[bkDrillGame];
    if(!s)return null;
    const wr=s.count>0?(s.won/s.count*100):0;
    const roi=s.staked>0?(s.profit/s.staked*100):0;
    const statRow=(label,data,color)=>{
     if(!data||data.c===0)return null;
     const w2=data.c>0?(data.w/data.c*100).toFixed(0):0;
     const wc=parseFloat(w2)>55?"#22C55E":parseFloat(w2)<45?"#EF4444":"#9CA3AF";
     return(
      <div key={label} style={{display:"grid",gridTemplateColumns:"90px 44px 44px 1fr",gap:"0 8px",padding:"7px 16px",borderTop:"1px solid rgba(255,255,255,.03)",alignItems:"center"}}>
       <span style={{fontSize:11,fontWeight:700,color:color||"#9CA3AF"}}>{label}</span>
       <span style={{fontSize:11,color:"#6B7280",textAlign:"center"}}>{data.c}p</span>
       <span style={{fontSize:11,fontWeight:700,color:wc,textAlign:"center"}}>{w2}%</span>
       <span style={{fontSize:11,fontWeight:700,color:data.p>=0?"#22C55E":"#EF4444",textAlign:"right"}}>{data.p>=0?"+":""}{data.p.toFixed(0)}$</span>
      </div>
     );
    };
    const ppRows=Object.values(s.ppEdges).sort((a,b)=>a.edge-b.edge);
    const oddsRows=Object.values(s.oddsRanges).sort((a,b)=>a.lo-b.lo).filter(r=>r.count>0);
    return(
     <div>
      <div style={{padding:"12px 16px",borderBottom:"1px solid rgba(255,255,255,.06)",display:"flex",gap:8,flexWrap:"wrap"}}>
       {[
        {l:"Paris",v:s.count,c:"#c4b5fd"},
        {l:"WR",v:wr.toFixed(0)+"%",c:wr>55?"#22C55E":wr<45?"#EF4444":"#9CA3AF"},
        {l:"ROI",v:(roi>=0?"+":"")+roi.toFixed(1)+"%",c:roi>=0?"#22C55E":"#EF4444"},
        {l:"Profit",v:(s.profit>=0?"+":"")+s.profit.toFixed(0)+"$",c:s.profit>=0?"#22C55E":"#EF4444"},
        {l:"Cote moy",v:"@"+(s.count>0?(s.oddsSum/s.count).toFixed(2):"?"),c:"#9CA3AF"},
       ].map(x=>(
        <div key={x.l} style={{flex:"1 1 auto",background:"rgba(124,58,237,.06)",border:"1px solid rgba(124,58,237,.1)",borderRadius:8,padding:"6px 10px",minWidth:60}}>
         <div style={{fontSize:14,fontWeight:900,color:x.c}}>{x.v}</div>
         <div style={{fontSize:9,color:"#4a5a6e",textTransform:"uppercase",letterSpacing:.5}}>{x.l}</div>
        </div>
       ))}
      </div>
      <div style={{padding:"4px 0"}}>
       <div style={{display:"grid",gridTemplateColumns:"90px 44px 44px 1fr",gap:"0 8px",padding:"5px 16px"}}>
        {[["Catégorie","left"],["Paris","center"],["WR%","center"],["Profit","right"]].map(([l,a])=>(
         <span key={l} style={{fontSize:9,color:"#374151",fontWeight:600,textTransform:"uppercase",letterSpacing:.7,textAlign:a}}>{l}</span>
        ))}
       </div>
       {statRow("Over",s.over,"#60A5FA")}
       {statRow("Under",s.under,"#818CF8")}
       {statRow("Live",s.live,"#F59E0B")}
       {statRow("Headshot",s.hs,"#EC4899")}
       {statRow("Non-HS",s.nonHs,"#9CA3AF")}
      </div>
      {ppRows.length>0&&(
       <div style={{borderTop:"1px solid rgba(255,255,255,.06)",padding:"10px 16px 6px"}}>
        <div style={{fontSize:10,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>PP Edge</div>
        <div style={{display:"grid",gridTemplateColumns:"90px 44px 44px 1fr",gap:"0 8px",padding:"3px 0",marginBottom:2}}>
         {[["Edge","left"],["Paris","center"],["WR%","center"],["Profit","right"]].map(([l,a])=>(
          <span key={l} style={{fontSize:9,color:"#374151",fontWeight:600,textTransform:"uppercase",letterSpacing:.7,textAlign:a}}>{l}</span>
         ))}
        </div>
        {ppRows.map(r=>{
         const w3=r.count>0?(r.won/r.count*100).toFixed(0):0;
         return(
          <div key={r.edge} style={{display:"grid",gridTemplateColumns:"90px 44px 44px 1fr",gap:"0 8px",padding:"5px 0",borderTop:"1px solid rgba(255,255,255,.03)",alignItems:"center"}}>
           <span style={{fontSize:12,fontWeight:800,color:"#c4b5fd"}}>+{r.edge}</span>
           <span style={{fontSize:11,color:"#6B7280",textAlign:"center"}}>{r.count}p</span>
           <span style={{fontSize:11,fontWeight:700,color:parseFloat(w3)>55?"#22C55E":parseFloat(w3)<45?"#EF4444":"#9CA3AF",textAlign:"center"}}>{w3}%</span>
           <span style={{fontSize:11,fontWeight:700,color:r.profit>=0?"#22C55E":"#EF4444",textAlign:"right"}}>{r.profit>=0?"+":""}{r.profit.toFixed(0)}$</span>
          </div>
         );
        })}
       </div>
      )}
      {oddsRows.length>0&&(
       <div style={{borderTop:"1px solid rgba(255,255,255,.06)",padding:"10px 16px 6px"}}>
        <div style={{fontSize:10,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Cotes par tranches</div>
        <div style={{display:"grid",gridTemplateColumns:"90px 44px 44px 1fr",gap:"0 8px",padding:"3px 0",marginBottom:2}}>
         {[["Tranche","left"],["Paris","center"],["WR%","center"],["Profit","right"]].map(([l,a])=>(
          <span key={l} style={{fontSize:9,color:"#374151",fontWeight:600,textTransform:"uppercase",letterSpacing:.7,textAlign:a}}>{l}</span>
         ))}
        </div>
        {oddsRows.map(r=>{
         const w4=r.count>0?(r.won/r.count*100).toFixed(0):0;
         return(
          <div key={r.label} style={{display:"grid",gridTemplateColumns:"90px 44px 44px 1fr",gap:"0 8px",padding:"5px 0",borderTop:"1px solid rgba(255,255,255,.03)",alignItems:"center"}}>
           <span style={{fontSize:11,color:"#c8d4e8",fontWeight:700}}>{r.label}</span>
           <span style={{fontSize:11,color:"#6B7280",textAlign:"center"}}>{r.count}p</span>
           <span style={{fontSize:11,fontWeight:700,color:parseFloat(w4)>55?"#22C55E":parseFloat(w4)<45?"#EF4444":"#9CA3AF",textAlign:"center"}}>{w4}%</span>
           <span style={{fontSize:11,fontWeight:700,color:r.profit>=0?"#22C55E":"#EF4444",textAlign:"right"}}>{r.profit>=0?"+":""}{r.profit.toFixed(0)}$</span>
          </div>
         );
        })}
       </div>
      )}
     </div>
    );
   })()}
  </div>
 </div>
 )}

 {statsTab==="tournois"&&(()=>{
 const byGame={};
 ALL_GAMES.forEach(game=>{
 const gs=perGameStats[game];
 if(!gs)return;
 const list=(gs.tourneys||[]).map(t=>({...t,game}));
 if(list.length>0)byGame[game]=list.sort((a,b)=>b.profit-a.profit);
 });
 const hasAny=Object.keys(byGame).length>0;
 if(!hasAny)return <div style={{fontSize:12,color:"#4a5a6e",textAlign:"center",padding:"30px 0"}}>Aucun tournoi pour l'instant</div>;
 const GAME_ACCENT={CS2:"#F97316",Dota2:"#EF4444",LoL:"#A78BFA",Valorant:"#EF4444"};
 return(
 <div style={{display:"flex",flexDirection:"column",gap:16}}>
 {ALL_GAMES.filter(g=>byGame[g]).map(game=>{
 const list=byGame[game];
 const accent=GAME_ACCENT[game]||"#A78BFA";
 return(
 <div key={game}>
 {/* Header jeu */}
 <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8,paddingBottom:6,borderBottom:`1.5px solid ${accent}33`}}>
 <GameLogo game={game} size={16}/>
 <span style={{fontSize:12,fontWeight:800,color:accent,textTransform:"uppercase",letterSpacing:1}}>{game}</span>
 <span style={{fontSize:10,color:"#4a5a6e",marginLeft:"auto"}}>{list.reduce((s,t)=>s+t.count,0)} paris</span>
 </div>
 <div className="stat-bloc">
 {list.map(t=>{
 const wr=t.count>0?(t.won/t.count*100):0;
 const roi=t.staked>0?(t.profit/t.staked*100):0;
 return(
 <div key={t.name} className="stat-row">
 <div style={{display:"flex",alignItems:"center",gap:9}}>
 {t.name==="Hors tournoi"?<span style={{fontSize:14}}><Ic n="ban" s={14} c="#6B7280"/></span>:<LeagueLogo league={t.name} size={20}/>}
 <div>
 <div style={{fontWeight:700,fontSize:13,color:t.name==="Hors tournoi"?"#9CA3AF":"#E5E7EB"}}>{t.name}</div>
 <div style={{fontSize:10,color:"#6B7280"}}>{t.count} paris · {wr.toFixed(0)}% WR</div>
 </div>
 </div>
 <div style={{textAlign:"right"}}>
 <div style={{fontWeight:700,fontSize:13,color:t.profit>=0?"#22C55E":"#EF4444"}}>{t.profit>=0?"+":""}{t.profit.toFixed(0)}$</div>
 <div style={{fontSize:10,color:roi>=0?"#22C55E":"#EF4444"}}>{roi>=0?"+":""}{roi.toFixed(1)}%</div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
 })}
 </div>
 );
 })()}
 </div>
 )}


 {/* STATS DRILL-DOWN */}
 {statsDrill&&view==="statistiques"&&(()=>{
 const {game,league,filterType,filterValue}=statsDrill;
 const mk=()=>({cnt:0,won:0,profit:0,staked:0,oddsSum:0});
 const add=(t,b)=>{t.cnt++;t.profit+=b.profit;t.staked+=b.stake;t.oddsSum+=b.odds;if(b.status==="won")t.won++;};
 const toS=t=>(!t||!t.cnt)?null:{n:t.cnt,wr:t.won/t.cnt*100,profit:t.profit,roi:t.staked>0?t.profit/t.staked*100:0,avg:t.oddsSum/t.cnt};
 let betsF=settled.filter(b=>(!game||b.game===game)&&(!league||b.league===league));
 if(filterType==="role")betsF=betsF.filter(b=>(b.role||"Inconnu")===filterValue);
 if(filterType==="map")betsF=betsF.filter(b=>(b.mapTag||"Sans tag")===filterValue);
 if(filterType==="tourney")betsF=betsF.filter(b=>(effectiveTournament(b,allPlayers)||"Hors tournoi")===filterValue);
 if(filterType==="bk")betsF=betsF.filter(b=>(b.bookmaker||"Autre")===filterValue);
 if(filterType==="kill")betsF=betsF.filter(b=>b.description&&b.description.includes(filterValue));
 if(filterType==="player")betsF=betsF.filter(b=>b.player&&b.player.toLowerCase()===filterValue.toLowerCase());
 if(!betsF.length)return null;

 const cfg=GAME_CFG[game]||{accent:"#A78BFA"};
 const isCS2=game==="CS2",isLoL=game==="LoL";
 const over=mk(),under=mk(),overLive=mk(),overNL=mk(),underLive=mk(),underNL=mk();
 const overHS=mk(),underHS=mk();
 const byMap={},byBK={},byOdds={},byMonth={};
 // Live/NonLive full breakdowns
 const liveOver=mk(),liveUnder=mk(),nlOver=mk(),nlUnder=mk();
 const liveByMap={},liveByRole={},liveByKill={};
 const nlByMap={},nlByRole={},nlByKill={};
 const oddsOrder=["<1.50","1.50-1.74","1.75-1.99","2.00-2.49","≥2.50"];
 const bk2=o=>o<1.5?"<1.50":o<1.75?"1.50-1.74":o<2.0?"1.75-1.99":o<2.5?"2.00-2.49":"≥2.50";

 betsF.forEach(b=>{
 const isO=b.overUnder==="Over",isU=b.overUnder==="Under";
 const map=b.mapTag||"Sans tag",bk=b.bookmaker||"Autre";
 const rawRole=normalizeRole(b.role||"");const roleKey=rawRole||"Inconnu";
 // Normalize LoL roles to 5 standard positions
 const LOL_ROLE_MAP={"Top":"Top Laner","Toplaner":"Top Laner","Top laner":"Top Laner","Top Laner":"Top Laner","Jungle":"Jungler","Jng":"Jungler","Jngl":"Jungler","Jungler":"Jungler","Mid":"Mid Laner","Midlaner":"Mid Laner","Mid laner":"Mid Laner","Mid Laner":"Mid Laner","Adc":"Bot Laner","Bot":"Bot Laner","Carry":"Bot Laner","Botlaner":"Bot Laner","Bot laner":"Bot Laner","Bot Laner":"Bot Laner","Support":"Support","Sup":"Support","Supp":"Support","Bot Support":"Support","Marksman":"Bot Laner","Roamer":"Support"};
 const role=(b.game==="LoL"||b.game==="Valorant")?
 (LOL_ROLE_MAP[rawRole]||LOL_ROLE_MAP[rawRole.charAt(0).toUpperCase()+rawRole.slice(1).toLowerCase()]||rawRole):rawRole;
 const mo=b.datetime?String(b.datetime).slice(0,7):"?";
 const bkt=bk2(b.odds||1);
 if(!byMap[map])byMap[map]=mk(); add(byMap[map],b);
 if(!byBK[bk])byBK[bk]=mk(); add(byBK[bk],b);
 if(!byOdds[bkt])byOdds[bkt]=mk(); add(byOdds[bkt],b);
 if(!byMonth[mo])byMonth[mo]=mk(); add(byMonth[mo],b);
 if(isO){add(over,b);b.isLive?add(overLive,b):add(overNL,b);}
 if(isU){add(under,b);b.isLive?add(underLive,b):add(underNL,b);}
 if(isCS2&&b.isHeadshot){isO?add(overHS,b):isU?add(underHS,b):null;}
 // Live full breakdown
 if(b.isLive){
 isO?add(liveOver,b):isU?add(liveUnder,b):null;
 if(!liveByMap[map])liveByMap[map]=mk(); add(liveByMap[map],b);
 if(!liveByRole[role])liveByRole[role]=mk(); add(liveByRole[role],b);
 if(b.description){const p=b.description.split(" ");if(p.length>=3){const k=p[1]+" "+p[2];if(!liveByKill[k])liveByKill[k]=mk();add(liveByKill[k],b);}}
 } else {
 isO?add(nlOver,b):isU?add(nlUnder,b):null;
 if(!nlByMap[map])nlByMap[map]=mk(); add(nlByMap[map],b);
 if(!nlByRole[role])nlByRole[role]=mk(); add(nlByRole[role],b);
 if(b.description){const p=b.description.split(" ");if(p.length>=3){const k=p[1]+" "+p[2];if(!nlByKill[k])nlByKill[k]=mk();add(nlByKill[k],b);}}
 }
 });
 const sortP=obj=>Object.entries(obj).map(([k,v])=>({key:k,s:toS(v)})).filter(x=>x.s).sort((a,b)=>b.s.profit-a.s.profit);
 const liveByMapArr=Object.entries(liveByMap).map(([k,v])=>({key:k,s:toS(v)})).filter(x=>x.s).sort((a,b)=>a.key.localeCompare(b.key));
 const nlByMapArr=Object.entries(nlByMap).map(([k,v])=>({key:k,s:toS(v)})).filter(x=>x.s).sort((a,b)=>a.key.localeCompare(b.key));

 const mapsArr=Object.entries(byMap).map(([k,v])=>({key:k,s:toS(v)})).filter(x=>x.s).sort((a,b)=>a.key.localeCompare(b.key));
 const bkArr=Object.entries(byBK).map(([k,v])=>({key:k,s:toS(v)})).filter(x=>x.s).sort((a,b)=>b.s.profit-a.s.profit);
 const oddsArr=oddsOrder.map(k=>byOdds[k]?{key:k,s:toS(byOdds[k])}:null).filter(Boolean);
 // Positions breakdown for kills drill
 const byKillRole={};
 if(filterType==="kill"){
 betsF.forEach(b=>{
 const r=b.role||"Inconnu";
 if(!byKillRole[r])byKillRole[r]=mk();
 add(byKillRole[r],b);
 });
 }
 const killRoleArr=Object.entries(byKillRole).map(([k,v])=>({key:k,s:toS(v)})).filter(x=>x.s).sort((a,b)=>a.s.profit-b.s.profit);
 const monthArr=Object.entries(byMonth).map(([k,v])=>({key:k,s:toS(v)})).filter(x=>x.s).sort((a,b)=>b.key.localeCompare(a.key)).slice(0,4);

 const totalP=betsF.reduce((s,b)=>s+(b.profit||0),0);
 const totalStk=betsF.reduce((s,b)=>s+(b.stake||0),0);
 const gWR=betsF.length>0?(betsF.filter(b=>b.status==="won").length/betsF.length*100):0;
 const gROI=totalStk>0?(totalP/totalStk*100):0;
 const pageTitle=filterType?({role:"Position",map:"Map",tourney:"Tournoi",bk:"Bookmaker",kill:"Kills",player:"Joueur"}[filterType]||filterType)+" — "+filterValue:(league?game+" · "+league:game);

 const pc=v=>(v||0)>=0?"#00E676":"#EF4444";
 const wrc=v=>(v||0)>=55?"#00E676":(v||0)<45?"#EF4444":"#9CA3AF";

 // Simple table row — label | N paris | WR% | Profit
 // Composants drill-down 
 const TRow=({label,s,indent=false})=>!s?null:(
 <div style={{display:"flex",alignItems:"center",padding:indent?"7px 12px 7px 24px":"9px 12px",borderBottom:"1px solid #1A2235",background:indent?"rgba(255,255,255,0.01)":"transparent"}}>
 <div style={{flex:1,minWidth:0}}>
 <div style={{fontSize:indent?11:13,fontWeight:indent?500:600,color:indent?"#9CA3AF":"#E5E7EB"}}>{label}</div>
 </div>
 <span style={{fontSize:11,color:"#6B7280",minWidth:36,textAlign:"right"}}>{s.n}p</span>
 <span style={{fontSize:12,fontWeight:700,color:wrc(s.wr),minWidth:44,textAlign:"right"}}>{s.wr.toFixed(0)}%</span>
 <span style={{fontSize:13,fontWeight:800,color:pc(s.profit),minWidth:66,textAlign:"right"}}>{s.profit>=0?"+":""}{(s.profit||0).toFixed(0)}$</span>
 </div>
 );

 const Header=()=>(
 <div style={{display:"flex",padding:"5px 12px",background:"#0A1020",borderBottom:"1px solid #1A2235"}}>
 <div style={{flex:1}}/>
 <span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,minWidth:36,textAlign:"right",textTransform:"uppercase",letterSpacing:.5}}>N</span>
 <span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,minWidth:44,textAlign:"right",textTransform:"uppercase",letterSpacing:.5}}>WR</span>
 <span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,minWidth:66,textAlign:"right",textTransform:"uppercase",letterSpacing:.5}}>Profit</span>
 </div>
 );

 const SubHeader=({label})=>(
 <div style={{padding:"6px 12px 3px",background:"#0A1020",borderBottom:"1px solid #1A2235"}}>
 <span style={{fontSize:9,color:"#4B5563",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{label}</span>
 </div>
 );

 const Sec=({title,children})=>(
 <div style={{marginBottom:12,borderRadius:12,overflow:"hidden",border:"1px solid #1A2235"}}>
 <div style={{fontSize:9,color:"#9CA3AF",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"9px 12px",background:"#0D1626",borderBottom:"1px solid #1A2235"}}>{title}</div>
 <Header/>
 {children}
 </div>
 );

 // Top 5 pertes par position+kills (LoL only)
 let top5Losses=[];
 if(isLoL){
 const byPosKill={};
 betsF.forEach(b=>{
 if(!b.role||!b.description)return;
 const parts=b.description.split(" ");
 if(parts.length<3)return;
 const k=b.role+" · "+parts[1]+" "+parts[2];
 if(!byPosKill[k])byPosKill[k]={key:k,...mk()};
 add(byPosKill[k],b);
 });
 top5Losses=Object.values(byPosKill)
 .map(v=>({...v,...toS(v)}))
 .filter(v=>v&&v.n>=3)
 .sort((a,b)=>a.profit-b.profit)
 .slice(0,5);
 }

 return(
 <div style={{position:"fixed",inset:0,background:"#0B1220",zIndex:450,overflowY:"auto",fontFamily:"'Inter',sans-serif"}}>
 <div style={{padding:"16px 16px 40px",maxWidth:500,margin:"0 auto"}}>

 {/* Header */}
 <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
 <button onClick={()=>filterType?(setStatsDrill({game,league}),setDrillPeriod(null)):(setStatsDrill(null),setDrillPeriod(null))}
 style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:9,padding:"8px 14px",color:"#E5E7EB",cursor:"pointer",fontSize:15,fontWeight:700,flexShrink:0}}>←</button>
 <div>
 <div style={{display:"flex",alignItems:"center",gap:7}}>
 {game&&<GameLogo game={game} size={16}/>}
 <span style={{fontSize:16,fontWeight:700,color:"#E5E7EB"}}>{pageTitle}</span>
 </div>
 <div style={{fontSize:10,color:"#6B7280",marginTop:2}}>{betsF.length} paris</div>
 </div>
 </div>

 {/* Global */}
 <div style={{marginBottom:12,borderRadius:12,overflow:"hidden",border:"1px solid #1A2235"}}>
 <div style={{fontSize:9,color:"#9CA3AF",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"9px 12px",background:"#0D1626",borderBottom:"1px solid #1A2235"}}>Global</div>
 <div style={{display:"flex",justifyContent:"space-around",padding:"14px 12px"}}>
 {[{l:"WR",v:gWR.toFixed(0)+"%",c:wrc(gWR)},{l:"ROI",v:(gROI>=0?"+":"")+gROI.toFixed(1)+"%",c:pc(gROI)},{l:"Profit",v:(totalP>=0?"+":"")+totalP.toFixed(0)+"$",c:pc(totalP)},{l:"Cote moy.",v:"@"+(betsF.reduce((s,b)=>s+(b.odds||0),0)/betsF.length).toFixed(2),c:"#9CA3AF"}].map(x=>(
 <div key={x.l} style={{textAlign:"center"}}>
 <div style={{fontSize:9,color:"#6B7280",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{x.l}</div>
 <div style={{fontSize:17,fontWeight:800,color:x.c}}>{x.v}</div>
 </div>
 ))}
 </div>
 </div>

 {(toS(nlOver)||toS(nlUnder))&&(
 <div style={{marginBottom:12,background:"#111827",border:"1px solid #1F2937",borderRadius:14,overflow:"hidden"}}>
 {/* Title */}
 <div style={{padding:"12px 14px",borderBottom:"1px solid #1F2937"}}>
 <span style={{fontSize:15,fontWeight:700,color:"#FFFFFF"}}>Non-live</span>
 </div>
 {/* Over/Under */}
 <Header/>
 {toS(nlOver)&&<TRow label=" Over" s={toS(nlOver)}/>}
 {toS(nlUnder)&&<TRow label=" Under" s={toS(nlUnder)}/>}
 {isCS2&&(toS(overHS)||toS(underHS))&&<>
 <TRow label=" Over HS" s={toS(overHS)}/>
 <TRow label=" Under HS" s={toS(underHS)}/>
 </>}
 {/* POSITIONS */}
 {sortP(nlByRole).length>0&&<>
 <div style={{padding:"8px 14px 4px",borderTop:"1px solid #1F2937",background:"#0A1020"}}>
 <span style={{fontSize:9,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>Positions</span>
 </div>
 <Header/>
 {sortP(nlByRole).map(({key,s})=><TRow key={key} label={key} s={s}/>)}
 </>}
 {/* MAPS */}
 {nlByMapArr.length>0&&<>
 <div style={{padding:"8px 14px 4px",borderTop:"1px solid #1F2937",background:"#0A1020"}}>
 <span style={{fontSize:9,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>Maps</span>
 </div>
 <Header/>
 {nlByMapArr.map(({key,s})=><TRow key={key} label={key} s={s}/>)}
 </>}
 {/* LIGNES KILLS */}
 {sortP(nlByKill).length>0&&<>
 <div style={{padding:"8px 14px 4px",borderTop:"1px solid #1F2937",background:"#0A1020"}}>
 <span style={{fontSize:9,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>Lignes Kills</span>
 </div>
 <Header/>
 {sortP(nlByKill).map(({key,s})=><TRow key={key} label={key} s={s}/>)}
 </>}
 </div>
 )}
 {(toS(liveOver)||toS(liveUnder))&&(
 <div style={{marginBottom:12,background:"#111827",border:"1px solid #1F2937",borderRadius:14,overflow:"hidden"}}>
 {/* Title */}
 <div style={{padding:"12px 14px",borderBottom:"1px solid #1F2937"}}>
 <span style={{fontSize:15,fontWeight:700,color:"#FFFFFF"}}> Live</span>
 </div>
 {/* Over/Under */}
 <Header/>
 {toS(liveOver)&&<TRow label=" Over" s={toS(liveOver)}/>}
 {toS(liveUnder)&&<TRow label=" Under" s={toS(liveUnder)}/>}
 
 {/* POSITIONS */}
 {sortP(liveByRole).length>0&&<>
 <div style={{padding:"8px 14px 4px",borderTop:"1px solid #1F2937",background:"#0A1020"}}>
 <span style={{fontSize:9,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>Positions</span>
 </div>
 <Header/>
 {sortP(liveByRole).map(({key,s})=><TRow key={key} label={key} s={s}/>)}
 </>}
 {/* MAPS */}
 {liveByMapArr.length>0&&<>
 <div style={{padding:"8px 14px 4px",borderTop:"1px solid #1F2937",background:"#0A1020"}}>
 <span style={{fontSize:9,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>Maps</span>
 </div>
 <Header/>
 {liveByMapArr.map(({key,s})=><TRow key={key} label={key} s={s}/>)}
 </>}
 {/* LIGNES KILLS */}
 {sortP(liveByKill).length>0&&<>
 <div style={{padding:"8px 14px 4px",borderTop:"1px solid #1F2937",background:"#0A1020"}}>
 <span style={{fontSize:9,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>Lignes Kills</span>
 </div>
 <Header/>
 {sortP(liveByKill).map(({key,s})=><TRow key={key} label={key} s={s}/>)}
 </>}
 </div>
 )}


 {/* Top 5 pertes position+kills — LoL uniquement */}
 {isLoL&&top5Losses.length>0&&(
 <div style={{marginBottom:12,borderRadius:12,overflow:"hidden",border:"1px solid rgba(239,68,68,0.2)"}}>
 <div style={{fontSize:9,color:"#EF4444",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"9px 12px",background:"rgba(239,68,68,0.06)",borderBottom:"1px solid rgba(239,68,68,0.15)"}}> Top 5 pertes — Position · Ligne</div>
 <Header/>
 {top5Losses.map((r,i)=>(
 <div key={r.key} style={{display:"flex",alignItems:"center",padding:"9px 12px",borderBottom:"1px solid #1A2235",background:i===0?"rgba(239,68,68,0.04)":"transparent"}}>
 <div style={{flex:1,minWidth:0}}>
 <div style={{fontSize:12,fontWeight:600,color:"#E5E7EB"}}>{r.key}</div>
 </div>
 <span style={{fontSize:11,color:"#6B7280",minWidth:36,textAlign:"right"}}>{r.n}p</span>
 <span style={{fontSize:12,fontWeight:700,color:wrc(r.wr),minWidth:44,textAlign:"right"}}>{r.wr.toFixed(0)}%</span>
 <span style={{fontSize:13,fontWeight:800,color:"#EF4444",minWidth:66,textAlign:"right"}}>{(r.profit||0).toFixed(0)}$</span>
 </div>
 ))}
 </div>
 )}

 {/* Positions par ligne kills */}
 {filterType==="kill"&&killRoleArr.length>0&&(
 <div style={{marginBottom:12,borderRadius:12,overflow:"hidden",border:"1px solid #1A2235"}}>
 <div style={{fontSize:9,color:"#818CF8",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"9px 12px",background:"#0D1626",borderBottom:"1px solid #1A2235"}}>Positions</div>
 <Header/>
 {killRoleArr.map(({key,s})=>(
 <div key={key} style={{display:"flex",alignItems:"center",padding:"9px 12px",borderBottom:"1px solid #1A2235"}}>
 <div style={{flex:1}}>
 <div style={{fontSize:13,fontWeight:600,color:"#E5E7EB"}}>{key}</div>
 </div>
 <span style={{fontSize:11,color:"#6B7280",minWidth:36,textAlign:"right"}}>{s.n}p</span>
 <span style={{fontSize:12,fontWeight:700,color:wrc(s.wr),minWidth:44,textAlign:"right"}}>{s.wr.toFixed(0)}%</span>
 <span style={{fontSize:13,fontWeight:800,color:pc(s.profit),minWidth:66,textAlign:"right"}}>{s.profit>=0?"+":""}{(s.profit||0).toFixed(0)}$</span>
 </div>
 ))}
 </div>
 )}

 {/* Maps */}
 {mapsArr.length>0&&<Sec title="Maps">{mapsArr.map(({key,s})=><TRow key={key} label={key} s={s}/>)}</Sec>}

 {/* Bookmakers */}
 {bkArr.length>0&&<Sec title="Bookmakers">{bkArr.map(({key,s})=><TRow key={key} label={key} s={s}/>)}</Sec>}

 {/* Tranches de cote */}
 {oddsArr.length>0&&<Sec title="Tranches de cote">{oddsArr.map(({key,s})=><TRow key={key} label={key} s={s}/>)}</Sec>}

 {/* Période */}
 {(()=>{
 const PERIODS=[{d:3,l:"3j"},{d:7,l:"7j"},{d:14,l:"2 sem."},{d:30,l:"1 mois"}];
 const activePeriod=drillPeriod;
 const now=new Date();
 const periodBets=activePeriod?betsF.filter(b=>{
 if(!b.datetime)return false;
 const diff=(now-new Date(b.datetime))/(1000*60*60*24);
 return diff<=activePeriod;
 }):null;
 const ps=periodBets&&periodBets.length>0?{
 n:periodBets.length,
 wr:periodBets.length>0?(periodBets.filter(b=>b.status==="won").length/periodBets.length*100):0,
 profit:periodBets.reduce((s,b)=>s+(b.profit||0),0),
 roi:periodBets.reduce((s,b)=>s+(b.stake||0),0)>0?(periodBets.reduce((s,b)=>s+(b.profit||0),0)/periodBets.reduce((s,b)=>s+(b.stake||0),0)*100):0,
 avg:periodBets.length>0?(periodBets.reduce((s,b)=>s+(b.odds||0),0)/periodBets.length):0,
 }:null;
 return(
 <div style={{marginBottom:12,borderRadius:12,overflow:"hidden",border:"1px solid #1A2235"}}>
 <div style={{fontSize:9,color:"#9CA3AF",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"9px 12px",background:"#0D1626",borderBottom:"1px solid #1A2235"}}>Période</div>
 <div style={{display:"flex",gap:6,padding:"10px 12px",borderBottom:"1px solid #1A2235",background:"#0A1020"}}>
 {PERIODS.map(({d,l})=>(
 <button key={d} onClick={()=>setDrillPeriod(drillPeriod===d?null:d)}
 style={{flex:1,padding:"7px 0",borderRadius:8,border:"1.5px solid "+(drillPeriod===d?"#60A5FA":"#1A2235"),background:drillPeriod===d?"rgba(96,165,250,0.12)":"rgba(255,255,255,0.02)",color:drillPeriod===d?"#60A5FA":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all .15s"}}>
 {l}
 </button>
 ))}
 </div>
 {ps?(
 <div>
 <div style={{display:"flex",justifyContent:"space-around",padding:"14px 12px",borderBottom:"1px solid #1A2235"}}>
 {[{l:"Paris",v:ps.n,c:"#E5E7EB"},{l:"WR",v:ps.wr.toFixed(0)+"%",c:ps.wr>=55?"#00E676":ps.wr<45?"#EF4444":"#9CA3AF"},{l:"ROI",v:(ps.roi>=0?"+":"")+ps.roi.toFixed(1)+"%",c:ps.roi>=0?"#00E676":"#EF4444"},{l:"Profit",v:(ps.profit>=0?"+":"")+(ps.profit||0).toFixed(0)+"$",c:ps.profit>=0?"#00E676":"#EF4444"}].map(x=>(
 <div key={x.l} style={{textAlign:"center"}}>
 <div style={{fontSize:9,color:"#6B7280",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{x.l}</div>
 <div style={{fontSize:16,fontWeight:800,color:x.c}}>{x.v}</div>
 </div>
 ))}
 </div>
 <Header/>
 {(()=>{
 const mk2=()=>({n:0,won:0,profit:0,staked:0,oddsSum:0});
 const add2=(t,b)=>{t.n++;t.profit+=b.profit;t.staked+=b.stake;t.oddsSum+=b.odds;if(b.status==="won")t.won++;};
 const toS2=t=>t.n>0?{n:t.n,wr:Math.round(t.won*100/t.n),profit:t.profit,roi:t.staked>0?Math.round(t.profit*1000/t.staked)/10:0,avg:t.n>0?Math.round(t.oddsSum*100/t.n)/100:0}:null;
 const over=mk2(),under=mk2(),live=mk2(),nonLive=mk2();
 const byRoleP={},byMapP={};
 periodBets.forEach(b=>{
 if(b.overUnder==="Over")add2(over,b);
 if(b.overUnder==="Under")add2(under,b);
 if(b.isLive)add2(live,b); else add2(nonLive,b);
 const r=b.role||"Inconnu";
 if(!byRoleP[r])byRoleP[r]=mk2(); add2(byRoleP[r],b);
 const m=b.mapTag||"Sans tag";
 if(!byMapP[m])byMapP[m]=mk2(); add2(byMapP[m],b);
 });
 const rolesP=Object.entries(byRoleP).map(([k,v])=>({key:k,s:toS2(v)})).filter(x=>x.s).sort((a,b)=>b.s.profit-a.s.profit);
 const mapsP=Object.entries(byMapP).map(([k,v])=>({key:k,s:toS2(v)})).filter(x=>x.s).sort((a,b)=>a.key.localeCompare(b.key));
 return(<>
 <TRow label=" Over" s={toS2(over)}/>
 <TRow label=" Under" s={toS2(under)}/>
 <TRow label=" Live" s={toS2(live)}/>
 <TRow label="Non-live" s={toS2(nonLive)}/>
 {rolesP.length>0&&rolesP.map(({key,s})=><TRow key={key} label={key} s={s}/>)}
 {mapsP.length>1&&mapsP.map(({key,s})=><TRow key={key} label={key} s={s}/>)}
 </>);
 })()}
 </div>
 ):(
 <div style={{padding:"14px 12px",fontSize:11,color:"#4B5563",textAlign:"center"}}>Sélectionne une période</div>
 )}
 </div>
 );
 })()}

 </div>

 {/* PP KILLS ANALYSIS */}
 {filterType==="kill"&&(()=>{
 // killVal2 = numeric value for display (e.g. 17.5)
 const killVal2=parseFloat(filterValue.replace(" Kills","").replace(" Headshots",""));
 if(isNaN(killVal2))return null;
 const metric2=ppKillMetric;
 const METRICS2=[{k:"roi",label:"ROI"},{k:"profit",label:"Profit"},{k:"wr",label:"WR"},{k:"n",label:"Paris"}];
 // Collect PP bets for this game + kill value
 const ppBets2=settled.filter(b=>
 b.ppMapType==="Map 1+2"&&
 b.ppLine&&
 b.description&&
 (!game||b.game===game)&&
 b.status!=="pending"
 );
 // filterValue = "17.5 Kills", b.description = "Over 17.5 Kills"
 // Use same logic as betsF filter: description.includes(filterValue)
 const matchedBets=ppBets2.filter(b=>
 b.description&&b.description.includes(filterValue)
 );
 if(matchedBets.length===0)return null;
 // Group by overUnder -> ppLine (only lines actually played)
 const overByLine={},underByLine={};
 matchedBets.forEach(b=>{
 const pp=parseFloat(b.ppLine);
 if(isNaN(pp))return;
 const key=pp.toFixed(1);
 const target=b.overUnder==="Over"?overByLine:underByLine;
 if(!target[key])target[key]={cnt:0,won:0,profit:0,staked:0};
 target[key].cnt++;
 target[key].profit+=b.profit;
 target[key].staked+=b.stake;
 if(b.status==="won")target[key].won++;
 });
 const sortedLines=(obj)=>Object.keys(obj).map(Number).sort((a,b)=>a-b);
 const mv2=(d,m)=>{
 if(!d||d.cnt===0)return{txt:"—",color:"#3a4a5e"};
 const wr=Math.round(d.won*100/d.cnt);
 const roi=d.staked>0?Math.round(d.profit*1000/d.staked)/10:0;
 if(m==="roi")return{txt:(roi>=0?"+":"")+roi.toFixed(1)+"%",color:roi>=0?"#00E676":"#f87171"};
 if(m==="profit")return{txt:(d.profit>=0?"+":"")+d.profit.toFixed(0)+"$",color:d.profit>=0?"#00E676":"#f87171"};
 if(m==="wr")return{txt:wr+"%",color:wr>=55?"#00E676":wr<45?"#f87171":"#9CA3AF"};
 if(m==="n")return{txt:String(d.cnt),color:"#7a9cbd"};
 return{txt:"—",color:"#3a4a5e"};
 };
 const colLabel=METRICS2.find(function(mx){return mx.k===metric2;})?METRICS2.find(function(mx){return mx.k===metric2;}).label:"ROI";
 const hasOver=sortedLines(overByLine).length>0;
 const hasUnder=sortedLines(underByLine).length>0;
 if(!hasOver&&!hasUnder)return null;
 return(
 <div style={{marginTop:16}}>
 {/* Metric selector */}
 <div style={{display:"flex",gap:6,marginBottom:10,overflowX:"auto"}}>
 {METRICS2.map(m=>(
 <button key={m.k} onClick={()=>setPpKillMetric(m.k)}
 style={{padding:"5px 12px",borderRadius:7,border:"1px solid "+(metric2===m.k?"rgba(139,92,246,.6)":"rgba(255,255,255,.07)"),background:metric2===m.k?"rgba(139,92,246,.15)":"transparent",color:metric2===m.k?"#c4b5fd":"#4a5a6e",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0}}>
 {m.label}
 </button>
 ))}
 </div>
 {/* OVER table */}
 {hasOver&&(
 <div style={{marginBottom:10,borderRadius:12,overflow:"hidden",border:"1px solid rgba(139,92,246,.25)"}}>
 <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:"rgba(107,33,245,.1)",borderBottom:"1px solid rgba(139,92,246,.2)"}}>
 <img src={_B64_PP_LOGO_B64} alt="PP" style={{width:16,height:16,borderRadius:3,objectFit:"cover",flexShrink:0}}/>
 <span style={{fontSize:10,color:"#c4b5fd",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>OVER {killVal2.toFixed(1)} — Lignes PP jouées</span>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"70px 1fr 40px 80px",padding:"5px 12px",background:"#0A1020",borderBottom:"1px solid #1A2235"}}>
 <span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Ligne PP</span>
 <span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"center"}}>Paris</span>
 <span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"center"}}>WR</span>
 <span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"right"}}>{colLabel}</span>
 </div>
 {sortedLines(overByLine).map((ppLine,i)=>{
 const key=ppLine.toFixed(1);
 const d=overByLine[key];
 const wr=d.cnt>0?Math.round(d.won*100/d.cnt):0;
 const mv=mv2(d,metric2);
 return(
 <div key={key} style={{display:"grid",gridTemplateColumns:"70px 1fr 40px 80px",padding:"9px 12px",borderBottom:i<sortedLines(overByLine).length-1?"1px solid #111827":"none",alignItems:"center"}}>
 <span style={{fontSize:14,fontWeight:800,color:"#c4b5fd"}}>{key}</span>
 <span style={{fontSize:11,color:"#7a9cbd",textAlign:"center"}}>{d.cnt}</span>
 <span style={{fontSize:11,fontWeight:600,color:wr>=55?"#00E676":wr<45?"#f87171":"#9CA3AF",textAlign:"center"}}>{wr}%</span>
 <span style={{fontSize:12,fontWeight:800,color:mv.color,textAlign:"right"}}>{mv.txt}</span>
 </div>
 );
 })}
 </div>
 )}
 {/* UNDER table */}
 {hasUnder&&(
 <div style={{marginBottom:10,borderRadius:12,overflow:"hidden",border:"1px solid rgba(139,92,246,.25)"}}>
 <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:"rgba(107,33,245,.1)",borderBottom:"1px solid rgba(139,92,246,.2)"}}>
 <img src={_B64_PP_LOGO_B64} alt="PP" style={{width:16,height:16,borderRadius:3,objectFit:"cover",flexShrink:0}}/>
 <span style={{fontSize:10,color:"#c4b5fd",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>UNDER {killVal2.toFixed(1)} — Lignes PP jouées</span>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"70px 1fr 40px 80px",padding:"5px 12px",background:"#0A1020",borderBottom:"1px solid #1A2235"}}>
 <span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Ligne PP</span>
 <span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"center"}}>Paris</span>
 <span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"center"}}>WR</span>
 <span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"right"}}>{colLabel}</span>
 </div>
 {sortedLines(underByLine).map((ppLine,i)=>{
 const key=ppLine.toFixed(1);
 const d=underByLine[key];
 const wr=d.cnt>0?Math.round(d.won*100/d.cnt):0;
 const mv=mv2(d,metric2);
 return(
 <div key={key} style={{display:"grid",gridTemplateColumns:"70px 1fr 40px 80px",padding:"9px 12px",borderBottom:i<sortedLines(underByLine).length-1?"1px solid #111827":"none",alignItems:"center"}}>
 <span style={{fontSize:14,fontWeight:800,color:"#c4b5fd"}}>{key}</span>
 <span style={{fontSize:11,color:"#7a9cbd",textAlign:"center"}}>{d.cnt}</span>
 <span style={{fontSize:11,fontWeight:600,color:wr>=55?"#00E676":wr<45?"#f87171":"#9CA3AF",textAlign:"center"}}>{wr}%</span>
 <span style={{fontSize:12,fontWeight:800,color:mv.color,textAlign:"right"}}>{mv.txt}</span>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
 })()}

 </div>
 );
 })()}

 {/* JOUEURS */}

 {view==="players"&&(
 <div className="view-enter" style={{paddingBottom:20}}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",margin:"4px 2px 4px"}}>
 <div>
 <div style={{fontSize:28,fontWeight:800,color:"#f4f6fb",letterSpacing:-.8,lineHeight:1.05}}>Suivi</div>
 <div style={{fontSize:13,color:"#8b93a7",marginTop:5}}>{Object.keys(allPlayers).length} joueurs · {Object.values(activeTourneys).filter(t=>t&&t.name&&!(t.end&&new Date(t.end)<new Date())).length} tournoi(s) actif(s)</div>
 </div>
 <button onClick={()=>{setPform({name:"",game:"LoL",league:"",role:"",team:""});setModalPlayer(true);}}
 style={{display:"flex",alignItems:"center",gap:6,background:"#7c3aed",border:"none",borderRadius:12,padding:"10px 14px",color:"#fff",fontWeight:700,fontSize:13,fontFamily:"Inter,sans-serif",cursor:"pointer"}}>
 <Ic n="plus" s={14} w={2.6}/>Joueur
 </button>
 </div>

 <SuiviLabel>COMPÉTITIONS</SuiviLabel>
 {/* TOURNOIS ACTIFS */}
 <div style={{marginBottom:8}}>
 <SuiviHead n="trophy" color="#fbbf24" title="Tournois actifs" open={suiviOpen.tournois} onClick={()=>setSuiviOpen(s=>({...s,tournois:!s.tournois}))}
  sub={(()=>{const act=["CS2","Dota2","LoL","Valorant"].map(g=>activeTourneys[g]).filter(t=>t&&t.name&&!(t.end&&new Date(t.end)<new Date()));return act.length?act.map(t=>t.name).join(" · "):"Aucun tournoi actif";})()}/>
 {suiviOpen.tournois&&<div style={{...SV_BODY,padding:"4px 0"}}>
 {["CS2","Dota2","LoL","Valorant"].map((game,gi)=>{
 const t=activeTourneys[game];
 const cfg=GAME_CFG[game]||{};
 const isExpired=t&&t.end&&new Date(t.end)<new Date();
 const saved=savedTourneys[game]||[];
 const hasActive=t&&t.name&&!isExpired;
 return(
 <div key={game} style={{padding:"10px 14px",borderTop:gi?"1px solid "+SV.line:"none"}}>
 <div style={{display:"flex",alignItems:"center",gap:10}}>
 <span style={{width:28,height:28,borderRadius:8,overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,.04)"}}><GameLogo game={game} size={28}/></span>
 <div style={{flex:1,minWidth:0,position:"relative"}}>
 <div style={{fontSize:11,fontWeight:700,color:cfg.accent||"#A78BFA",marginBottom:2}}>{game}</div>
 <select value={hasActive?t.name:""}
 onChange={e=>{const val=e.target.value;if(!val){setActiveTourneys(prev=>{const n={...prev};delete n[game];return n;});}else{setActiveTourneys(prev=>({...prev,[game]:{name:val,end:""}}));}}}
 style={{width:"100%",background:"transparent",border:"none",padding:0,color:hasActive?"#eef1f7":"#5b6478",fontWeight:hasActive?600:500,fontSize:14,fontFamily:"Inter,sans-serif",outline:"none",cursor:"pointer",textOverflow:"ellipsis"}}>
 <option value="">Aucun tournoi actif</option>
 {[...new Set([...(t&&t.name?[t.name]:[]),...saved])].map(x=><option key={x} value={x}>{x}</option>)}
 </select>
 </div>
 {hasActive&&<span style={{display:"flex",alignItems:"center",gap:5,fontSize:11,fontWeight:700,color:"#34d399",background:"rgba(52,211,153,.1)",padding:"3px 8px",borderRadius:20,flexShrink:0}}><span style={{width:6,height:6,borderRadius:3,background:"#34d399"}}/>Actif{t.end?" · "+new Date(t.end).toLocaleDateString("fr-CA",{day:"numeric",month:"short"}):""}</span>}
 {isExpired&&<span style={{fontSize:11,fontWeight:700,color:"#f87171",background:"rgba(248,113,113,.1)",padding:"3px 8px",borderRadius:20,flexShrink:0}}>Expiré</span>}
 {hasActive&&<button title="Retirer" onClick={()=>setActiveTourneys(prev=>{const n={...prev};delete n[game];return n;})}
 style={{width:30,height:30,borderRadius:9,border:"1px solid "+SV.line,background:"transparent",color:"#8b93a7",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic n="x" s={13}/></button>}
 <button title="Ajouter un tournoi" onClick={()=>setModalTourney(game)}
 style={{width:30,height:30,borderRadius:9,border:"none",background:"rgba(124,58,237,.15)",color:"#c4b5fd",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><Ic n="plus" s={14} w={2.6}/></button>
 </div>
 </div>
 );
 })}
 </div>}
 </div>

 <SuiviLabel>JOUEURS & LOGOS</SuiviLabel>
 {/* ── Edit roster ── */}
 <RosterEditor
  players={players} setPlayers={setPlayers} allPlayers={allPlayers}
  bets={settledFiltered}
  rosterOpen={rosterOpen} setRosterOpen={setRosterOpen}
  rosterGame={rosterGame} setRosterGame={setRosterGame}
  rosterLeague={rosterLeague} setRosterLeague={setRosterLeague}
  rosterTeam={rosterTeam} setRosterTeam={setRosterTeam}
  editP={editP} setEditP={setEditP}
  editPForm={editPForm} setEditPForm={setEditPForm}
  editPPhotoUrl={editPPhotoUrl} setEditPPhotoUrl={setEditPPhotoUrl}
  editPSaving={editPSaving} setEditPSaving={setEditPSaving}
  editTeam={editTeam} setEditTeam={setEditTeam}
  teamLogoUrl={teamLogoUrl} setTeamLogoUrl={setTeamLogoUrl}
  teamLogoSaving={teamLogoSaving} setTeamLogoSaving={setTeamLogoSaving}
  rosterHierarchy={rosterHierarchy} showToast={showToast}
  teamLogos={teamLogos} setTeamLogos={setTeamLogos}
  customClubs={customClubs} setCustomClubs={setCustomClubs}
  setBets={setBets} supaPushBets={supaPushBets}
 />

 <TourneyLogos
  mediaStore={mediaStore} setMediaStore={setMediaStore}
  showToast={showToast} activeTourneys={activeTourneys}
  savedTourneys={savedTourneys}
 />


 <SuiviLabel>BOOKMAKERS & MISES</SuiviLabel>
 {/* ── Bookmakers ── */}
 <BookmarkersSection
  bookmakers={bookmakers} setBookmakers={setBookmakers}
  bkPhotos={bkPhotos} setBkPhotos={setBkPhotos}
  showToast={showToast}
  hiddenBKs={hiddenBKs} toggleHideBK={toggleHideBK}
 />


 {/* ── Palier bankroll ── */}
 {(()=>{ const PALIERS=[2500,5000,7500,10000,12500,15000,20000,25000,30000];
  const autoTier=Math.max(5000,Math.floor((bankroll+totalProfit)/2500)*2500);
  const isAuto=!manualTier;
  const activeTier=manualTier||autoTier;
  return(
   <div style={{marginBottom:8}}>
    <SuiviHead n="target" color="#34d399" title="Palier bankroll" flat
     sub={(isAuto?"Automatique":"Manuel")+" · 1u = "+(activeTier*0.01).toFixed(0)+"$"}
     right={<span style={{fontSize:17,fontWeight:800,color:"#eef1f7",letterSpacing:-.3}}>{activeTier.toLocaleString("fr-FR")}$</span>}/>
    <div style={SV_BODY}>
     <div style={{display:"grid",gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:6}}>
      {PALIERS.map(p=>{const on=p===activeTier;return(
       <button key={p} onClick={()=>{setManualTier(on&&!isAuto?null:p);}}
        style={{height:40,borderRadius:11,border:"1px solid "+(on?"rgba(52,211,153,.55)":SV.line),background:on?"rgba(52,211,153,.12)":"rgba(255,255,255,.02)",color:on?"#34d399":"#aab1c2",fontSize:14,fontWeight:on?800:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
        {(p/1000).toFixed(p%1000===0?0:1)}k
       </button>);})}
     </div>
     <button onClick={()=>{setManualTier(null);}} disabled={isAuto}
      style={{width:"100%",marginTop:10,padding:"10px",background:"transparent",border:"1px solid "+SV.line,borderRadius:11,color:isAuto?"#4b5366":"#aab1c2",fontSize:12,fontWeight:600,cursor:isAuto?"default":"pointer",fontFamily:"Inter,sans-serif"}}>
      {isAuto?"Mode automatique activé ("+autoTier.toLocaleString("fr-FR")+"$)":"↺ Repasser en automatique ("+autoTier.toLocaleString("fr-FR")+"$)"}
     </button>
    </div>
   </div>
  );
 })()}


 <QuickUnitsEditor quickUnits={quickUnits} setQuickUnits={su=>setQuickUnits(su)}/>

 <SuiviLabel>OUTILS</SuiviLabel>
 <CreateSection
  teamLogos={teamLogos} setTeamLogos={setTeamLogos}
  bkPhotos={bkPhotos} setBkPhotos={setBkPhotos}
  bookmakers={bookmakers} setBookmakers={setBookmakers}
  customClubs={customClubs} setCustomClubs={setCustomClubs}
  showToast={showToast}
 />


 <div style={{marginBottom:8}}>
 <SuiviHead n="trash" color="#f87171" title="Corbeille" sub={deletedBets.length+" pari(s) supprimé(s) récemment"} open={showCorbeille} onClick={()=>setShowCorbeille(v=>!v)}
  right={deletedBets.length>0?<span role="button" onClick={e=>{e.stopPropagation();setDeletedBets([]);}} style={{fontSize:12,color:"#f87171",fontWeight:600,padding:"4px 8px"}}>Vider</span>:null}/>
 {showCorbeille&&(
 <div style={{...SV_BODY,display:"flex",flexDirection:"column",gap:6}}>
 {deletedBets.length===0&&(
 <div style={{textAlign:"center",color:"#4B5563",fontSize:12,padding:"16px 0"}}>Aucun pari supprimé récemment</div>
 )}
 {deletedBets.map((b,i)=>(
 <div key={b.id+"_"+i} style={{background:"#111827",border:"1px solid #1F2937",borderRadius:10,padding:"10px 13px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
 <div style={{flex:1,minWidth:0}}>
 <div style={{display:"flex",alignItems:"center",gap:6}}>
 <GameLogo game={b.game} size={13}/>
 <span style={{fontSize:13,fontWeight:700,color:"#9CA3AF",textTransform:"capitalize"}}>{b.player}</span>
 <span style={{fontSize:11,color:"#6B7280"}}>— {b.description}</span>
 </div>
 <div style={{fontSize:10,color:"#4B5563",marginTop:2}}>@{b.odds} · {b.stake}$ · {b.bookmaker||"—"}</div>
 <div style={{fontSize:9,color:"#374151",marginTop:1}}>Supprimé {b.deletedAt?new Date(b.deletedAt).toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit"}):""}</div>
 </div>
 <button onClick={()=>{
 const restored={...b};delete restored.deletedAt;
 setBets(prev=>[restored,...prev]);
 setDeletedBets(prev=>prev.filter((_,idx)=>idx!==i));
 showToast("Pari restauré ");
 }} style={{padding:"6px 12px",background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:7,color:"#00E676",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>
 ↩ Restaurer
 </button>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* PP BOARD ANALYZER */}
 <PPReferenceTable/>


 </div>
 )}

 {modalTourney&&(()=>{
 const game=modalTourney;
 const cfg=GAME_CFG[game]||{};
 return(
 <div className="moverlay" onClick={()=>setModalTourney(false)}>
 <div className="modal" onClick={e=>e.stopPropagation()}>
 <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
 <div style={{fontSize:15,fontWeight:700}}>Ajouter un tournoi — {game}</div>
 </div>
 <div style={{fontSize:11,color:"#6B7280",marginBottom:16}}>Le tournoi sera disponible dans le menu déroulant. Tu pourras l'activer quand tu veux.</div>

 {/* Champ nom */}
 <div style={{marginBottom:10}}>
 <div style={{fontSize:11,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Nom du tournoi</div>
 <input id={"tourney-name-"+game} className="ifield" placeholder="ex: PGL Astana 2026" style={{marginBottom:0}}/>
 </div>

 {/* Date de fin optionnelle */}
 <div style={{marginBottom:16}}>
 <div style={{fontSize:11,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Date de fin (optionnel)</div>
 <input id={"tourney-end-"+game} className="ifield" type="date" style={{marginBottom:0}}/>
 <div style={{fontSize:10,color:"#6B7280",marginTop:4}}>Si définie, le tournoi se retire automatiquement après cette date</div>
 </div>

 {/* Liste des tournois existants pour ce jeu */}
 {(savedTourneys[game]||[]).length>0&&(
 <div style={{marginBottom:16}}>
 <div style={{fontSize:11,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Tournois enregistrés</div>
 <div style={{background:"#0B1220",borderRadius:10,overflow:"hidden",border:"1px solid #1F2937"}}>
 {(savedTourneys[game]||[]).map((s,i)=>(
 <div key={s} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",borderBottom:i<(savedTourneys[game]||[]).length-1?"1px solid #1F2937":"none"}}>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 {activeTourneys[game]&&activeTourneys[game].name===s&&<span style={{width:6,height:6,borderRadius:"50%",background:"#00E676",boxShadow:"0 0 5px rgba(34,197,94,0.5)"}}/>}
 <span style={{fontSize:12,color:activeTourneys[game]&&activeTourneys[game].name===s?"#00E676":"#E5E7EB",fontWeight:activeTourneys[game]&&activeTourneys[game].name===s?700:400}}>{s}</span>
 </div>
 <div style={{display:"flex",gap:6}}>
 <button onClick={()=>{
 setActiveTourneys(prev=>({...prev,[game]:{name:s,end:""}}));
 setModalTourney(false);showToast(" "+s+" activé");
 }} style={{padding:"3px 9px",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:6,color:"#00E676",cursor:"pointer",fontSize:10,fontFamily:"'Inter',sans-serif",fontWeight:600}}>
 Activer
 </button>
 <button onClick={()=>setSavedTourneys(prev=>({...prev,[game]:(prev[game]||[]).filter(x=>x!==s)}))}
 style={{padding:"3px 8px",background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:6,color:"#EF4444",cursor:"pointer",fontSize:10,fontFamily:"'Inter',sans-serif"}}>
 ×
 </button>
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
 <button onClick={()=>setModalTourney(false)}
 style={{padding:"11px",background:"#1F2937",border:"none",borderRadius:10,color:"#9CA3AF",fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
 Fermer
 </button>
 <button onClick={()=>{
 const name=document.getElementById("tourney-name-"+game).value.trim();
 const end=document.getElementById("tourney-end-"+game).value;
 if(!name)return;
 // Ajouter à la liste sauvegardée si pas déjà présent
 setSavedTourneys(prev=>{
 const list=prev[game]||[];
 if(list.includes(name))return prev;
 return{...prev,[game]:[...list,name]};
 });
 // Activer directement
 setActiveTourneys(prev=>({...prev,[game]:{name,end}}));
 setModalTourney(false);
 showToast(" "+name+" ajouté & activé");
 }} style={{padding:"11px",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:13}}>
 Ajouter & activer
 </button>
 </div>
 </div>
 </div>
 );
 })()}

 {playerEditor&&(()=>{
 const fp=findPlayer(playerEditor)||{name:playerEditor};
 const tl=teamLogos[(fp.team||"")+"__"+(fp.game||"")]||fp.team_logo_url||"";
 return <PlayerEditSheet p={fp} name={fp.name||playerEditor} game={fp.game} teamLogo={tl} photo={getAvatarSrc(fp)||""} teamLogos={teamLogos} allPlayers={allPlayers} showToast={showToast}
  onClose={()=>setPlayerEditor(null)}
  onDelete={async pl=>{try{await supaDeletePlayer(pl.id);setPlayers(prev=>{const n={...prev};delete n[(pl.name||"").toLowerCase().trim()];return n;});showToast(capName(pl.name)+" supprimé","#EF4444");}catch(e){showToast("Erreur : "+e.message,"#EF4444");}setPlayerEditor(null);}}
  onSaved={(np,logo)=>{applyPlayerSaved((playerEditor||"").toLowerCase().trim(),np,logo);setPlayerEditor(null);}}/>;
 })()}
 {addEditOpen&&form.autoInfo&&(()=>{
 const ai=form.autoInfo;
 const tl=teamLogos[(ai.team||"")+"__"+(ai.game||"")]||ai.team_logo_url||"";
 return <PlayerEditSheet p={ai} name={ai.name||form.player} game={ai.game} teamLogo={tl} photo={getAvatarSrc(ai)||""} teamLogos={teamLogos} allPlayers={allPlayers} showToast={showToast}
  onClose={()=>setAddEditOpen(false)}
  onSaved={(np,logo)=>{
   applyPlayerSaved((form.player||"").toLowerCase().trim(),np,logo);
   setAddEditOpen(false);
   setForm(f=>({...f,player:np.name||f.player,autoInfo:{...f.autoInfo,...np,team_logo_url:logo||np.team_logo_url||f.autoInfo.team_logo_url}}));
  }}/>;
 })()}
 {playerSheet&&(()=>{
 const fp=findPlayer(playerSheet);
 return <PlayerSheet name={playerSheet} player={fp} bets={bets} teamLogos={teamLogos} allPlayers={allPlayers} activeTourneys={activeTourneys} showToast={showToast}
  onClose={()=>setPlayerSheet(null)}
  onSaved={(np,logo)=>{
   applyPlayerSaved((playerSheet||"").toLowerCase().trim(),np,logo);
   if(np.name)setPlayerSheet(np.name);
  }}/>;
 })()}
 {/* BOTTOM NAV */}
 {(()=>{
 return(
 <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(9,14,28,.95)",borderTop:"1px solid rgba(255,255,255,.06)",zIndex:50,backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",boxShadow:"0 -4px 24px rgba(0,0,0,.4)",padding:"8px 4px calc(14px + env(safe-area-inset-bottom))"}}>
 <div style={{maxWidth:500,margin:"0 auto",display:"flex",justifyContent:"space-around",alignItems:"center"}}>
 {(()=>{
 const navItems=NAV.filter(n=>n.id!=="add");
 const mid=Math.floor(navItems.length/2);
 const items=[];
 navItems.forEach((n,idx)=>{
 if(idx===mid){
 items.push(<button key="add-fab" onClick={()=>{setView("add");setTimeout(()=>playerACRef.current&&playerACRef.current.focus(),80);}}
 style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 4px 16px rgba(124,58,237,0.45)",flexShrink:0,transform:view==="add"?"scale(0.93)":"scale(1)",transition:"transform .15s ease",marginBottom:4}}>
 <span style={{fontSize:30,color:"#fff",lineHeight:1,marginTop:-1}}>+</span>
 </button>);
 }
 const active=view===n.id;
 items.push(<button key={n.id} className={"navitem "+(active?"on":"")} onClick={()=>setView(n.id)} style={{position:"relative"}}>
 {n.id==="home"&&<NavIconHome active={active}/>}
 {n.id==="mesparis"&&<NavIconParis active={active} count={pendingCount}/>}
 {n.id==="statistiques"&&<NavIconAnalyse active={active}/>}
 {n.id==="players"&&<NavIconSuivi active={active}/>}
 <span className="lbl">{n.label}</span>
 </button>);
 });
 return items;
 })()}
 </div>
 </div>
 );
 })()}

 {/* CALENDRIER MODAL */}
 {showCal&&(
 <div className="moverlay" onClick={()=>{setShowCal(false);setCalSelected(null);}}>
 <div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
 <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
 <button onClick={()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--;}setCalMonth(m);setCalYear(y);setCalSelected(null);}} style={{background:"none",border:"1px solid #1F2937",borderRadius:7,padding:"6px 12px",color:"#94A3B8",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:14,fontWeight:700}}>Prev</button>
 <div style={{textAlign:"center"}}>
 <div style={{fontSize:15,fontWeight:700}}>{FR_MONTHS[calMonth]} {calYear}</div>
 <div style={{fontSize:11,color:monthProfit>=0?"#00E676":"#EF4444",fontWeight:600}}>{monthProfit>=0?"+":""}{monthProfit.toFixed(2)}$</div>
 </div>
 <button onClick={()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++;}setCalMonth(m);setCalYear(y);setCalSelected(null);}} style={{background:"none",border:"1px solid #1F2937",borderRadius:7,padding:"6px 12px",color:"#94A3B8",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:14,fontWeight:700}}>Suiv</button>
 </div>
 {/* Filtre jeu calendrier */}
 <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
 {ALL_GAMES.map(g=>(
 <button key={g} onClick={()=>setCalGames(prev=>prev.includes(g)?prev.filter(x=>x!==g):[...prev,g])}
 style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:8,border:"1.5px solid "+(calGames.includes(g)?"#7C3AED":"#1F2937"),background:calGames.includes(g)?"rgba(124,58,237,0.15)":"transparent",color:calGames.includes(g)?"#A78BFA":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
 <GameLogo game={g} size={12}/>{g}
 </button>
 ))}
 {calGames.length>0&&<button onClick={()=>setCalGames([])} style={{padding:"4px 8px",borderRadius:8,border:"1px solid rgba(239,68,68,0.2)",background:"rgba(239,68,68,0.06)",color:"#EF4444",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Tous</button>}
 </div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:2}}>
 {FR_DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:9,color:"#9CA3AF",fontWeight:600,padding:"3px 0",textTransform:"uppercase"}}>{d}</div>)}
 </div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:14}}>
 {(()=>{
 const firstDay=new Date(calYear,calMonth,1).getDay();
 const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
 const cells=[];
 for(let i=0;i<firstDay;i++)cells.push(<div key={"e"+i}/>);
 for(let d=1;d<=daysInMonth;d++){
 const dk=calYear+"-"+String(calMonth+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
 const profit=dailyProfit[dk];
 const pending=dailyPending[dk];
 const isToday=dk===todayKey;
 const isSel=calSelected===dk;
 const hasSettled=profit!==undefined;
 cells.push(
 <div key={dk} className={"cal-cell"+(isToday?" today":"")+(isSel?" selected":"")} onClick={()=>setCalSelected(isSel?null:dk)}>
 <div style={{fontSize:16,fontWeight:isToday?800:600,color:isToday?"#00E676":(hasSettled||pending)?"#E5E7EB":"#6B7280"}}>{d}</div>
 {hasSettled&&<div style={{fontSize:9,fontWeight:700,color:profit>=0?"#00E676":"#EF4444",lineHeight:1,marginTop:1}}>{profit>=0?"+":""}{profit>=1000?(profit/1000).toFixed(1)+"k":profit.toFixed(0)}$</div>}
 {pending>0&&!hasSettled&&<div style={{width:4,height:4,borderRadius:"50%",background:"#3B82F6",marginTop:1}}/>}
 </div>
 );
 }
 return cells;
 })()}
 </div>
 {calSelected&&(()=>{
 const selectedDayBets=(calGames.length>0?calFilteredBets.filter(b=>toDateKey(b.datetime)===calSelected):byDay[calSelected])||[];
 const dp=dailyProfit[calSelected];
 return(
 <div>
 <div style={{fontSize:12,color:"#9CA3AF",marginBottom:8}}>
 {calSelected.split("-").reverse().join("/")} - {selectedDayBets.length} pari{selectedDayBets.length!==1?"s":""}
 {dp!==undefined&&<span style={{marginLeft:8,fontWeight:700,color:dp>=0?"#00E676":"#EF4444"}}>{dp>=0?"+":""}{dp.toFixed(2)}$</span>}
 </div>
 <div className="stat-bloc">
 {selectedDayBets.map(b=>(
 <div key={b.id} style={{padding:"10px 12px",borderBottom:"1px solid #1F2937",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
 <div style={{display:"flex",alignItems:"center",gap:8}}>
 <GameLogo game={b.game} size={16}/>
 <div>
 <div style={{fontWeight:600,fontSize:13,textTransform:"capitalize"}}>{b.player}</div>
 <div style={{fontSize:10,color:"#9CA3AF"}}>{b.description}</div>
 </div>
 </div>
 <div style={{textAlign:"right"}}>
 <div style={{fontWeight:700,fontSize:13,color:b.status==="won"?"#00E676":b.status==="lost"?"#EF4444":"#3B82F6"}}>
 {b.status==="pending"?"@"+b.odds:(b.profit>=0?"+":"")+(b.profit||0).toFixed(2)+"$"}
 </div>
 <div style={{fontSize:10,color:STATUS_CFG[b.status]?STATUS_CFG[b.status].color:"#9CA3AF"}}>{STATUS_CFG[b.status]?STATUS_CFG[b.status].label:b.status}</div>
 </div>
 </div>
 ))}
 </div>
 </div>
 );
 })()}
 <button onClick={()=>{setShowCal(false);setCalSelected(null);}} style={{width:"100%",marginTop:14,padding:"12px",background:"#1F2937",border:"none",borderRadius:10,color:"#94A3B8",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:14}}>Fermer</button>
 </div>
 </div>
 )}

 {/* BULK MODAL */}






 {/* MODAL ADD BOOKMAKER */}
 {modalBK&&(
 <div className="moverlay" onClick={()=>{setModalBK(false);setNewBK("");setNewBKPhoto("");}}>
 <div className="modal" onClick={e=>e.stopPropagation()}>
 <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>Nouveau bookmaker</div>
 <input className="ifield" placeholder="Nom du bookmaker..." value={newBK} onChange={e=>setNewBK(e.target.value)} style={{marginBottom:10}}/>
  <div style={{marginBottom:12}}>
  <div style={{fontSize:11,color:"#9CA3AF",marginBottom:7}}>Logo — URL (optionnel)</div>
  <div style={{display:"flex",alignItems:"center",gap:8}}>
   {newBKPhoto&&<img src={newBKPhoto} alt="preview" style={{width:36,height:36,borderRadius:8,objectFit:"cover",border:"1px solid #1F2937"}} onError={e=>e.target.style.display="none"}/>}
   <input className="ifield" placeholder="https://... (URL du logo)" value={newBKPhoto} onChange={e=>setNewBKPhoto(e.target.value)} style={{flex:1,marginBottom:0}}/>
  </div>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
 <button onClick={()=>{setModalBK(false);setNewBK("");setNewBKPhoto("");}} style={{padding:"12px",background:"#1F2937",border:"none",borderRadius:10,color:"#94A3B8",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Annuler</button>
 <button onClick={saveBookmaker} disabled={!newBK.trim()} style={{padding:"12px",background:newBK.trim()?"linear-gradient(135deg,#00E676,#0EA5E9)":"#1F2937",border:"none",borderRadius:10,color:newBK.trim()?"#0B1220":"#9CA3AF",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Ajouter</button>
 </div>
 </div>
 </div>
 )}

 {/* MODAL ADD PLAYER */}
 {modalPlayer&&(
 <PlayerEditSheet p={{name:pform.name||"",game:pform.game||"CS2",team:pform.team||"",league:pform.league||"",role:pform.role||""}}
  name={pform.name||""} game={pform.game||"CS2"} teamLogo={pform.team?(teamLogos[pform.team+"__"+(pform.game||"")]||""):""} photo="" isNew
  teamLogos={teamLogos} allPlayers={allPlayers} showToast={showToast}
  onClose={()=>setModalPlayer(false)}
  onSaved={(np,logo)=>{
   applyPlayerSaved("",np,logo);
   setModalPlayer(false);
   setPform({name:"",game:"LoL",league:"",role:"",team:""});
   if(view==="add")setForm(f=>({...f,player:np.name,autoInfo:{...np,name:np.name}}));
  }}/>
 )}

 {/* MODAL EDIT PLAYER */}
 {editingPlayer&&(
 <div className="moverlay" onClick={()=>setEditingPlayer(null)}>
 <div className="modal" onClick={e=>e.stopPropagation()}>
 <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>Modifier le joueur</div>
 <div style={{fontSize:11,color:"#6B7280",marginBottom:12,fontWeight:500}}>
 Pseudo d'origine : <span style={{color:"#A78BFA",textTransform:"capitalize"}}>{editingPlayer.key}</span>
 </div>

 {/* Champ nom/pseudo */}
 <div style={{marginBottom:8}}>
 <div style={{fontSize:11,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Pseudo</div>
 <input className="ifield" placeholder="Pseudo du joueur..." value={editingPlayer.data.displayName!==undefined?editingPlayer.data.displayName:editingPlayer.key}
 onChange={e=>setEditingPlayer(ep=>({...ep,data:{...ep.data,displayName:e.target.value}}))}/>
 <div style={{fontSize:10,color:"#6B7280",marginTop:4}}>Renomme le joueur (ex: corriger une faute de frappe)</div>
 </div>

 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
 <select className="ifield" value={editingPlayer.data.game}
 onChange={e=>setEditingPlayer(ep=>({...ep,data:{...ep.data,game:e.target.value,role:"",league:""}}))}>{ALL_GAMES.map(g=><option key={g} value={g}>{g}</option>)}</select>
 {LEAGUES_BY_GAME[editingPlayer.data.game]?(
 <select className="ifield" value={editingPlayer.data.league||""}
 onChange={e=>setEditingPlayer(ep=>({...ep,data:{...ep.data,league:e.target.value}}))}>
 <option value="">Ligue...</option>
 {LEAGUES_BY_GAME[editingPlayer.data.game].map(l=><option key={l} value={l}>{l}</option>)}
 </select>
 ):(
 <input className="ifield" placeholder="Ligue (opt.)" value={editingPlayer.data.league||""}
 onChange={e=>setEditingPlayer(ep=>({...ep,data:{...ep.data,league:e.target.value}}))}/>
 )}
 </div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
 <select className="ifield" value={editingPlayer.data.role||""}
 onChange={e=>setEditingPlayer(ep=>({...ep,data:{...ep.data,role:e.target.value}}))}>
 <option value="">Rôle...</option>
 {(editingPlayer.data.game==="LoL"
 ?["Top Laner","Jungler","Mid Laner","Bot Laner","Support"]
 :editingPlayer.data.game==="CS2"
 ?["Rifler","AWPer","IGL","Entry Fragger","Support"]
 :editingPlayer.data.game==="Dota2"
 ?["Carry","Mid","Offlane","Soft Support","Hard Support"]
 :["Duelist","Initiator","Controller","Sentinel","IGL"]
 ).map(r=><option key={r} value={r}>{r}</option>)}
 </select>
 <input className="ifield" placeholder="Équipe *" value={editingPlayer.data.team||""}
 onChange={e=>setEditingPlayer(ep=>({...ep,data:{...ep.data,team:e.target.value}}))}/>
 </div>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
 <button onClick={()=>setEditingPlayer(null)}
 style={{padding:"12px",background:"#1F2937",border:"none",borderRadius:10,color:"#94A3B8",fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
 Annuler
 </button>
 <button onClick={()=>{
 const {key,data}=editingPlayer;
 const newKey=(data.displayName||key).toLowerCase().trim()||key;
 const playerData={game:data.game,league:data.league||"",role:data.role||"",team:data.team||""};
 supaUpsertPlayer({name:newKey,...playerData}).catch(function(){});
 setPlayers(p=>{
 const n={...p};
 if(newKey!==key) delete n[key];
 n[newKey]=playerData;
 return n;
 });
 setEditingPlayer(null);
 showToast((newKey!==key?key+" → "+newKey+" ":newKey+" ")+"mis à jour ");
 }} style={{padding:"12px",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
 Sauvegarder
 </button>
 </div>
 </div>
 </div>
 )}

 {/* MODAL SPLIT BET */}
 {splitModal&&(
 <div className="moverlay" onClick={()=>setSplitModal(null)}>
 <div className="modal" style={{padding:0,overflow:"hidden",borderRadius:24}} onClick={e=>e.stopPropagation()}>

 {/* Header */}
 <div style={{padding:"18px 20px 14px",background:"linear-gradient(135deg,#111827,#0D1626)",borderBottom:"1px solid #1F2937"}}>
 <div style={{fontSize:18,fontWeight:800,color:"#E5E7EB",letterSpacing:"-0.3px"}}>+ Bookmaker</div>
 <div style={{fontSize:11,color:"#4B5563",marginTop:2}}>La mise s'additionne au pari existant</div>
 </div>

 <div style={{padding:"16px 20px 20px",display:"flex",flexDirection:"column",gap:14}}>

 {/* Pari source — compact card */}
 <div style={{background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"12px 14px",border:"1px solid #1F2937"}}>
 <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
 <GameLogo game={splitModal.game} size={16}/>
 <span style={{fontSize:14,fontWeight:700,color:"#E5E7EB",textTransform:"capitalize"}}>{splitModal.player}</span>
 <span style={{fontSize:12,color:"#6B7280"}}>{splitModal.description}</span>
 </div>
 <div style={{display:"flex",flexDirection:"column",gap:4}}>
 <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
 <span style={{color:"#9CA3AF"}}>{splitModal.bookmaker}</span>
 <span style={{color:"#E5E7EB",fontWeight:600}}>{(splitModal.stake-(splitModal.splits||[]).reduce((s,x)=>s+x.stake,0)).toFixed(0)}$ <span style={{color:"#6B7280"}}>@{splitModal.odds}</span></span>
 </div>
 {(splitModal.splits||[]).map((sp,i)=>(
 <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
 <span style={{color:"#9CA3AF"}}>{sp.bookmaker}</span>
 <span style={{color:"#E5E7EB",fontWeight:600}}>{sp.stake}$ <span style={{color:"#6B7280"}}>@{sp.odds}</span></span>
 </div>
 ))}
 <div style={{borderTop:"1px solid #1F2937",paddingTop:6,marginTop:2,display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:700}}>
 <span style={{color:"#6B7280"}}>Total</span>
 <span style={{color:"#A78BFA"}}>{splitModal.stake}$</span>
 </div>
 </div>
 </div>

 {/* Bookmakers */}
 <div>
 <div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>Bookmaker</div>
 <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
 {visibleBKs.filter(bk=>bk!==splitModal.bookmaker).map(bk=>{
 const logo=BK_LOGOS[bk]||bkPhotos[bk]||null;
 const isOn=splitForm.bookmaker===bk;
 const alreadySplit=(splitModal.splits||[]).find(s=>s.bookmaker===bk);
 return(
 <div key={bk} style={{position:"relative"}}>
 <button onClick={()=>setSplitForm(f=>({...f,bookmaker:bk,stake:alreadySplit?String(alreadySplit.stake):f.stake,odds:alreadySplit?String(alreadySplit.odds):f.odds}))}
 style={{width:48,height:48,borderRadius:12,border:"2px solid "+(isOn?"#A78BFA":alreadySplit?"rgba(251,191,36,0.4)":"#1F2937"),background:isOn?"rgba(124,58,237,0.15)":alreadySplit?"rgba(251,191,36,0.06)":"rgba(255,255,255,0.03)",cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",boxShadow:isOn?"0 0 12px rgba(124,58,237,0.3)":"none"}}>
 {logo?(<img src={logo} alt={bk} style={{width:30,height:30,borderRadius:7,objectFit:"cover"}}/>):(<span style={{fontSize:11,fontWeight:700,color:isOn?"#A78BFA":alreadySplit?"#F59E0B":"#6B7280"}}>{bk.slice(0,3)}</span>)}
 </button>
 {alreadySplit&&<div style={{position:"absolute",top:-3,right:-3,background:"#F59E0B",borderRadius:"50%",width:12,height:12,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #0B1220"}}><Ic n="check" s={7} c="#000" w={4}/></div>}
 {isOn&&<div style={{position:"absolute",top:-3,right:-3,background:"#A78BFA",borderRadius:"50%",width:12,height:12,border:"2px solid #0B1220"}}/>}
 </div>
 );
 })}
 </div>
 {splitForm.bookmaker&&<div style={{fontSize:11,color:"#A78BFA",fontWeight:600,marginTop:8}}> {splitForm.bookmaker}{(splitModal.splits||[]).find(s=>s.bookmaker===splitForm.bookmaker)?" — modifier le split":""}</div>}
 </div>

 {/* Cote + Mise côte à côte */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
 <div>
 <div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Cote</div>
 <input className="ifield" type="number" step="0.01" placeholder={"@"+splitModal.odds}
 value={splitForm.odds} onChange={e=>setSplitForm(f=>({...f,odds:e.target.value}))}
 style={{marginBottom:0}}/>
 </div>
 <div>
 <div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Mise ($)</div>
 <input className="ifield" type="number" step="1" placeholder="Ex: 30"
 value={splitForm.stake} onChange={e=>setSplitForm(f=>({...f,stake:e.target.value}))}
 style={{marginBottom:0}}/>
 </div>
 </div>

 {/* Raccourcis mise intelligents */}
 {(()=>{
 const UNITS=[50,62,75,87,100];
 const valid=UNITS.map(u=>({unit:u,add:Math.round(u-splitModal.stake)})).filter(x=>x.add>0);
 if(!valid.length)return null;
 return(
 <div style={{display:"flex",gap:6}}>
 {valid.map(({unit,add})=>(
 <button key={unit} onClick={()=>setSplitForm(f=>({...f,stake:String(add)}))}
 style={{flex:"1 1 auto",padding:"8px 4px",borderRadius:10,border:"1.5px solid "+(splitForm.stake===String(add)?"#A78BFA":"#1F2937"),background:splitForm.stake===String(add)?"rgba(124,58,237,0.12)":"rgba(255,255,255,0.03)",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"center",transition:"all .15s"}}>
 <div style={{fontSize:12,fontWeight:700,color:splitForm.stake===String(add)?"#A78BFA":"#E5E7EB"}}>{add}$</div>
 <div style={{fontSize:9,color:"#6B7280",marginTop:1}}>→{unit}$</div>
 </button>
 ))}
 </div>
 );
 })()}

 {splitForm.stake&&<div style={{fontSize:12,color:"#6B7280",textAlign:"center"}}>
 Total → <span style={{color:"#A78BFA",fontWeight:800,fontSize:14}}>{(splitModal.stake+parseFloat(splitForm.stake||0)).toFixed(0)}$</span>
 </div>}

 {/* Boutons */}
 <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:8}}>
 <button onClick={()=>setSplitModal(null)}
 style={{padding:"13px",background:"rgba(255,255,255,0.05)",border:"1px solid #1F2937",borderRadius:12,color:"#6B7280",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13}}>
 Annuler
 </button>
 <button disabled={!splitForm.bookmaker||!splitForm.stake}
 onClick={()=>{
 if(!splitForm.bookmaker||!splitForm.stake)return;
 const addStake=parseFloat(splitForm.stake);
 const addOdds=parseFloat(splitForm.odds)||splitModal.odds;
 const newSplit={bookmaker:splitForm.bookmaker,stake:addStake,odds:addOdds};
 const existingIdx=(splitModal.splits||[]).findIndex(s=>s.bookmaker===splitForm.bookmaker);
 let newSplits,newTotalStake;
 if(existingIdx>=0){
 const oldStake=(splitModal.splits||[])[existingIdx].stake;
 newSplits=(splitModal.splits||[]).map((s,i)=>i===existingIdx?newSplit:s);
 newTotalStake=splitModal.stake-oldStake+addStake;
 } else {
 newSplits=[...(splitModal.splits||[]),newSplit];
 newTotalStake=splitModal.stake+addStake;
 }
 const newProfit=calcProfit(splitModal.status,newTotalStake,splitModal.odds);
 setBets(b=>b.map(bet=>bet.id===splitModal.id?{...bet,stake:newTotalStake,splits:newSplits,profit:newProfit,updatedAt:Date.now()}:bet));
 showToast(splitForm.bookmaker+" "+addStake+"$ · Total "+newTotalStake.toFixed(0)+"$","#A78BFA");
 setSplitModal(null);
 }}
 style={{padding:"13px",background:splitForm.bookmaker&&splitForm.stake?"linear-gradient(135deg,#7C3AED,#3B82F6)":"#1F2937",border:"none",borderRadius:12,color:splitForm.bookmaker&&splitForm.stake?"#fff":"#9CA3AF",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13,boxShadow:splitForm.bookmaker&&splitForm.stake?"0 4px 20px rgba(124,58,237,0.35)":"none",transition:"all .15s"}}>
 + Ajouter
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* MODAL SUPABASE / CLOUD */}
 {supaModal&&(
 <div className="moverlay" onClick={()=>{setSupaModal(false);setSupaError("");}}>
 <div className="modal" onClick={e=>e.stopPropagation()}>
 <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
 <span style={{fontSize:22}}><Ic n="cloud" s={22} c="#A78BFA"/></span>
 <div>
 <div style={{fontSize:15,fontWeight:700,color:"#E5E7EB"}}>Cloud Sync</div>
 <div style={{fontSize:11,color:"#6B7280"}}>Sync automatique entre tous tes appareils</div>
 </div>
 </div>

 {/* Status */}
 <div style={{background:supaOk?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.06)",border:"1px solid "+(supaOk?"rgba(34,197,94,0.2)":"rgba(239,68,68,0.15)"),borderRadius:10,padding:"12px 14px",marginBottom:14}}>
 <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
 <span style={{width:7,height:7,borderRadius:"50%",background:supaOk?"#00E676":"#EF4444",boxShadow:"0 0 6px "+(supaOk?"rgba(34,197,94,0.8)":"rgba(239,68,68,0.6)")}}/>
 <span style={{fontSize:12,fontWeight:700,color:supaOk?"#00E676":"#EF4444"}}>{syncing?"Synchronisation…":supaOk?"Connecté à Supabase":"Hors ligne — vérifie ta connexion"}</span>
 </div>
 <div style={{fontSize:11,color:"#6B7280"}}>{bets.length} paris · temps réel : {liveState==="SUBSCRIBED"?"actif":liveState}</div>
 {syncErr&&<div style={{fontSize:11,color:"#fca5a5",marginTop:6,wordBreak:"break-word"}}>Dernière erreur — {syncErr}</div>}
 </div>
 <button onClick={downloadBackup} disabled={backingUp} style={{width:"100%",padding:"11px",marginBottom:10,background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:10,color:"#00E676",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center",gap:7}}><Ic n="down" s={14} w={2.6}/>{backingUp?"Sauvegarde en cours…":"Télécharger une sauvegarde complète"}</button>
 <button onClick={runDiag} style={{width:"100%",padding:"11px",marginBottom:10,background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:10,color:"#93c5fd",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13}}>Tester la connexion</button>
 {diag&&<div style={{background:"#0B1220",border:"1px solid #1F2937",borderRadius:10,padding:"8px 12px",marginBottom:12}}>
 {diag.map((d,i)=><div key={i} style={{display:"flex",gap:8,fontSize:11,padding:"4px 0",borderBottom:i<diag.length-1?"1px solid #1F2937":"none"}}>
 <span style={{color:d.ok===null?"#9CA3AF":d.ok?"#00E676":"#EF4444",fontWeight:700,flexShrink:0}}>{d.ok===null?"…":d.ok?"OK":"ERREUR"}</span>
 <span style={{color:"#E5E7EB",flexShrink:0}}>{d.t}</span>
 <span style={{color:"#9CA3AF",marginLeft:"auto",textAlign:"right",wordBreak:"break-word"}}>{d.m}</span>
 </div>)}
 </div>}

 {/* Integrity check */}
 <div style={{marginBottom:14}}>
 <button onClick={async()=>{
 setIntegrityChecking(true);setIntegrityReport(null);
 try{
 const remote=await supaPullBets();
 if(!remote||!remote.length){showToast("Erreur sync","#EF4444");setSyncing(false);return;}
 const localIds=new Set(bets.map(b=>String(b.id)));
 const remoteIds=new Set(remote.filter(b=>b.player!=="__SETTINGS__"&&b.player!=="__TEAM_LOGOS__").map(b=>String(b.id)));
 const onlyLocal=bets.filter(b=>!remoteIds.has(String(b.id))&&b.player!=="__SETTINGS__"&&b.player!=="__TEAM_LOGOS__"&&b.player!=="__BK_PHOTOS__"&&b.player!=="__MEDIA_STORE__");
 const onlyRemote=remote.filter(b=>!localIds.has(String(b.id))&&b.player!=="__SETTINGS__"&&b.player!=="__TEAM_LOGOS__");
 // Orphan bets: bets whose player name doesn't exist in allPlayers
 const playerNames=new Set(Object.values(allPlayers).map(p=>(p.name||"").toLowerCase().trim()));
 const orphans=bets.filter(b=>{
  if(!b.player)return false;
  const n=(b.player||"").toLowerCase().trim();
  return n&&!playerNames.has(n);
 });
 setIntegrityReport({local:bets.length,remote:remoteIds.size,onlyLocal,onlyRemote,orphans});
 }catch(e){setIntegrityReport({error:e.message});}
 setIntegrityChecking(false);
 }} disabled={integrityChecking}
 style={{width:"100%",padding:"11px",background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.25)",borderRadius:10,color:"#60A5FA",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:integrityReport?8:0}}>
 {integrityChecking?" Vérification…":" Vérifier l'intégrité des données"}
 </button>
 {integrityReport&&(
 <div style={{background:"#0B1220",border:"1px solid #1F2937",borderRadius:10,padding:"12px 14px"}}>
 {integrityReport.error?(
 <div style={{color:"#EF4444",fontSize:12}}>Erreur : {integrityReport.error}</div>
 ):(
 <>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
 <div style={{background:"rgba(124,58,237,0.08)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
 <div style={{fontSize:20,fontWeight:800,color:"#A78BFA"}}>{integrityReport.local}</div>
 <div style={{fontSize:10,color:"#6B7280",marginTop:2}}>Local (iPhone)</div>
 </div>
 <div style={{background:"rgba(34,197,94,0.08)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}>
 <div style={{fontSize:20,fontWeight:800,color:"#00E676"}}>{integrityReport.remote}</div>
 <div style={{fontSize:10,color:"#6B7280",marginTop:2}}>Supabase (Cloud)</div>
 </div>
 </div>
 {integrityReport.onlyLocal.length===0&&integrityReport.onlyRemote.length===0?(
 <div style={{display:"flex",alignItems:"center",gap:6,color:"#00E676",fontSize:12,fontWeight:700}}>
 Parfait — local et cloud sont identiques
 </div>
 ):(
 <>
 {integrityReport.onlyLocal.length>0&&(
                <div style={{marginBottom:8}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <div style={{fontSize:11,fontWeight:700,color:"#F59E0B"}}>⚠️ {integrityReport.onlyLocal.length} paris en local mais PAS dans le cloud</div>
                </div>
                <div style={{maxHeight:200,overflowY:"auto",fontSize:10,color:"#6B7280",marginBottom:6,border:"1px solid rgba(245,158,11,0.15)",borderRadius:6,padding:"4px 0"}}>
                {integrityReport.onlyLocal.map((b,i)=><div key={b.id} style={{display:"flex",flexDirection:"column",padding:"5px 8px",borderBottom:"1px solid #1F2937",background:i%2===0?"rgba(0,0,0,0.15)":"transparent"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:4}}>
                <span style={{color:"#E5E7EB",fontWeight:700,fontSize:11}}>{b.player}</span>
                <span style={{color:b.status==="won"?"#00E676":b.status==="lost"?"#EF4444":"#9CA3AF",fontWeight:700,fontSize:10,textTransform:"uppercase"}}>{b.status}</span>
                </div>
                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:2}}>
                <span style={{color:"#c4b5fd",fontWeight:600}}>{b.overUnder} {String(b.description||"").replace(/^(Over|Under)\s/,"")}</span>
                <span style={{color:"#6B7280"}}>@{b.odds}</span>
                <span style={{color:"#6B7280"}}>{b.stake}$</span>
                <span style={{color:"#4a5a6e"}}>{b.bookmaker}</span>
                <span style={{color:"#3a4a5e",marginLeft:"auto"}}>{b.datetime?String(b.datetime).slice(0,16):""}</span>
                </div>
                </div>)}
                </div>
                <button onClick={function(){supaPushBets(integrityReport.onlyLocal).then(function(){showToast(integrityReport.onlyLocal.length+" paris envoyés ","#00E676");setIntegrityReport(null);}).catch(function(){showToast("Erreur envoi","#EF4444");});}}
                style={{width:"100%",padding:"8px",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:8,color:"#F59E0B",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                ↑ Envoyer ces {integrityReport.onlyLocal.length} paris vers le cloud
                </button>
                </div>
                )}
                {integrityReport.onlyRemote.length>0&&(
                <div style={{marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"8px 10px",background:"rgba(96,165,250,0.08)",borderRadius:8,border:"1px solid rgba(96,165,250,0.2)"}}>
                <span style={{fontSize:16}}>☁️</span>
                <div>
                <div style={{fontSize:12,fontWeight:800,color:"#60A5FA"}}>{integrityReport.onlyRemote.length} pari{integrityReport.onlyRemote.length>1?"s":""} dans le cloud mais PAS en local</div>
                <div style={{fontSize:10,color:"#4a5a6e"}}>Ces paris existent sur Supabase mais sont absents de ton iPhone</div>
                </div>
                </div>
                <div style={{maxHeight:300,overflowY:"auto",borderRadius:10,overflow:"hidden",border:"1px solid rgba(96,165,250,0.15)"}}>
                {integrityReport.onlyRemote.map((b,i)=>(
                <div key={b.id} style={{padding:"10px 12px",borderBottom:"1px solid #1F2937",background:i%2===0?"rgba(0,0,0,0.2)":"rgba(96,165,250,0.03)"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:13,fontWeight:800,color:"#E5E7EB"}}>{b.player||"?"}</span>
                <span style={{fontSize:9,fontWeight:700,padding:"2px 6px",borderRadius:4,background:b.status==="won"?"rgba(0,230,118,0.15)":b.status==="lost"?"rgba(239,68,68,0.15)":"rgba(156,163,175,0.15)",color:b.status==="won"?"#00E676":b.status==="lost"?"#EF4444":"#9CA3AF",textTransform:"uppercase"}}>{b.status}</span>
                </div>
                <span style={{fontSize:12,fontWeight:700,color:b.profit>=0?"#00E676":"#EF4444"}}>{b.profit!=null?(b.profit>=0?"+":"")+b.profit.toFixed(0)+"$":""}</span>
                </div>
                <div style={{fontSize:11,color:"#c4b5fd",fontWeight:600,marginBottom:3}}>{b.overUnder} {String(b.description||"").replace(/^(Over|Under)\s/,"")}</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:10,color:"#6B7280"}}>@{b.odds}</span>
                <span style={{fontSize:10,color:"#6B7280"}}>{b.stake}$</span>
                <span style={{fontSize:10,color:"#6B7280"}}>{b.game}</span>
                <span style={{fontSize:10,color:"#4a5a6e"}}>{b.bookmaker}</span>
                <span style={{fontSize:10,color:"#374151",marginLeft:"auto"}}>{b.datetime?String(b.datetime).slice(0,16):""}</span>
                </div>
                <div style={{marginTop:4,fontSize:9,color:"#374151"}}>ID: {b.id}</div>
                </div>
                ))}
                </div>
                <div style={{display:"flex",gap:6,marginTop:8}}>
                <button onClick={()=>{const merged=[...bets,...integrityReport.onlyRemote];setBets(merged);localStorage.setItem("v7_bets",JSON.stringify(merged));showToast(integrityReport.onlyRemote.length+" paris récupérés ","#00E676");setIntegrityReport(null);}}
                style={{flex:1,padding:"9px",background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:8,color:"#60A5FA",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                ↓ Récupérer en local
                </button>
                <button onClick={()=>{const ids=integrityReport.onlyRemote.map(b=>String(b.id));navigator.clipboard&&navigator.clipboard.writeText(JSON.stringify(integrityReport.onlyRemote,null,2)).then(()=>showToast("Copié ","#00E676")).catch(()=>{});}}
                style={{padding:"9px 12px",background:"rgba(255,255,255,0.05)",border:"1px solid #1F2937",borderRadius:8,color:"#6B7280",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                📋 Copier
                </button>
                </div>
                </div>
                )}
 </>
 )}

 {/* Orphan bets — paris sans joueur lié */}
 {integrityReport.orphans&&integrityReport.orphans.length>0&&(
  <div style={{marginTop:10}}>
   <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8,padding:"8px 10px",background:"rgba(245,158,11,.08)",borderRadius:8,border:"1px solid rgba(245,158,11,.2)"}}>
    <span style={{fontSize:14}}>⚠️</span>
    <div>
     <div style={{fontSize:12,fontWeight:800,color:"#F59E0B"}}>{integrityReport.orphans.length} pari(s) sans joueur lié</div>
     <div style={{fontSize:10,color:"#92400e"}}>Ces paris référencent un joueur supprimé de la base</div>
    </div>
   </div>
   <div style={{maxHeight:260,overflowY:"auto",borderRadius:8,border:"1px solid rgba(245,158,11,.15)"}}>
    {integrityReport.orphans.map((b,i)=>(
     <div key={b.id} style={{padding:"9px 12px",borderBottom:"1px solid #1F2937",background:i%2===0?"rgba(0,0,0,.2)":"rgba(245,158,11,.02)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
       <span style={{fontSize:13,fontWeight:800,color:"#F59E0B"}}>{b.player||"?"}</span>
       <span style={{fontSize:10,color:"#6B7280"}}>{b.game}</span>
       <span style={{fontSize:11,fontWeight:700,color:b.profit>=0?"#22C55E":"#EF4444"}}>{b.profit>=0?"+":""}{(b.profit||0).toFixed(0)}$</span>
      </div>
      <div style={{fontSize:11,color:"#c4b5fd",marginBottom:2}}>{b.overUnder} {(b.description||"").replace(/^(Over|Under) /,"")}</div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
       <span style={{fontSize:10,color:"#6B7280"}}>@{b.odds}</span>
       <span style={{fontSize:10,color:"#6B7280"}}>{b.stake}$</span>
       <span style={{fontSize:10,color:"#4a5a6e"}}>{b.bookmaker}</span>
       <span style={{fontSize:10,color:"#374151",marginLeft:"auto"}}>{b.datetime?String(b.datetime).slice(0,10):""}</span>
      </div>
     </div>
    ))}
   </div>
   <button onClick={async()=>{
    const byKey={};
    integrityReport.orphans.forEach(b=>{
     if(!b.player||!b.game)return;
     const k=(b.player||"").toLowerCase().trim()+"__"+b.game;
     if(!byKey[k])byKey[k]={name:b.player.trim(),game:b.game};
    });
    const created=[];
    for(const {name,game} of Object.values(byKey)){
     try{
      const result=await supaUpsertPlayer({name,game,league:"",role:"",team:""});
      const id=result&&result.id;
      setPlayers(prev=>({...prev,[name.toLowerCase().trim()]:{name,game,league:"",role:"",team:"",id}}));
      created.push(name);
     }catch(e){}
    }
    if(created.length>0)showToast(created.length+" joueur(s) recréé(s)","#F59E0B");
    setIntegrityReport(r=>({...r,orphans:[]}));
   }} style={{width:"100%",marginTop:8,padding:"8px",background:"rgba(245,158,11,.1)",border:"1px solid rgba(245,158,11,.3)",borderRadius:8,color:"#F59E0B",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
    🔧 Recréer les joueurs manquants
   </button>
  </div>
 )} </>

 )}
 </div>
 )}
 </div>


 <PhotoMigrator allPlayers={allPlayers} setPlayers={setPlayers} showToast={showToast}/>
 {/* Actions manuelles */}
 <button onClick={()=>{
 setSyncing(true);
 supaPullBets().then(remote=>{
 if(remote&&remote.length>0){
 setBets(remote);
 localStorage.setItem("v7_bets",JSON.stringify(remote));
 showToast(" "+remote.length+" paris rechargés","#7C3AED");
 setSupaOk(true);
 }
 setSyncing(false);setSupaModal(false);
 }).catch(e=>{setSyncing(false);setSupaOk(false);showToast("Erreur: "+e.message,"#EF4444");});
 }} style={{width:"100%",padding:"11px",background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.3)",borderRadius:10,color:"#A78BFA",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:8}}>
 ↓ Forcer le rechargement depuis le cloud
 </button>

 <button onClick={()=>{
 setSyncing(true);
 supaPushBets(bets).then(()=>{
 setSupaOk(true);
 showToast(" "+bets.length+" paris envoyés","#00E676");
 setSyncing(false);setSupaModal(false);
 }).catch(e=>{setSyncing(false);setSupaOk(false);showToast("Erreur: "+e.message,"#EF4444");});
 }} style={{width:"100%",padding:"11px",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:10,color:"#00E676",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:14}}>
 ↑ Forcer l'envoi vers le cloud
 </button>

 {/* Reset total — protégé */}
 <button onClick={()=>{
 if(!confirmDelete){setConfirmDelete(true);return;}
 const txt=window.prompt("Cette action efface TOUS tes paris sur tous tes appareils.\nTélécharge d'abord une sauvegarde.\n\nTape SUPPRIMER pour confirmer :");
 if(txt!=="SUPPRIMER"){setConfirmDelete(false);showToast("Suppression annulée","#9CA3AF");return;}
 setSyncing(true);
 setBets([]);
 supaDeleteAllBets().catch(function(){}).finally(()=>{setSyncing(false);});
 setConfirmDelete(false);setSupaModal(false);
 showToast("Tous les paris supprimés","#EF4444");
 }}
 style={{width:"100%",padding:"11px",background:confirmDelete?"#EF4444":"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:10,color:confirmDelete?"#fff":"#EF4444",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:8}}>
 {confirmDelete?" Confirmer la suppression de TOUS les paris":" Remettre à zéro"}
 </button>

 <button onClick={()=>{setSupaModal(false);setConfirmDelete(false);}}
 style={{width:"100%",padding:"11px",background:"#1F2937",border:"none",borderRadius:10,color:"#6B7280",fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:13}}>
 Fermer
 </button>
 </div>
 </div>
 )}

 </div>
 </div>
 );






// ErrorBoundary — prevents full black screen on JS crash 
class ErrorBoundary extends React.Component{
 constructor(props){super(props);this.state={hasError:false,error:null};}
 static getDerivedStateFromError(e){return{hasError:true,error:e};}
 componentDidCatch(e,info){console.error("BettingTracker crash:",e,info);}
 render(){
 if(this.state.hasError){
 return React.createElement("div",{style:{padding:24,color:"#f87171",fontFamily:"Inter,sans-serif",background:"#0a0f1e",minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}},
 React.createElement("div",{style:{fontSize:24}},""),
 React.createElement("div",{style:{fontSize:16,fontWeight:700}},"Erreur de rendu"),
 React.createElement("div",{style:{fontSize:12,color:"#6B7280",maxWidth:300,textAlign:"center"}},(this.state.error&&this.state.error.message)||"Erreur inconnue"),
 React.createElement("button",{onClick:()=>this.setState({hasError:false,error:null}),style:{padding:"10px 20px",background:"#7C3AED",border:"none",borderRadius:10,color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}},"Réessayer")
 );
 }
 return this.props.children;
 }
}


// PP Board Analyzer 
function PPReferenceTable(){
 const [open,setOpen]=useState(false);
 const [game,setGame]=useState("LoL");

 const DATA={
 "LoL":[
 {pp12:"3.5 – 4.5",map3:"1.5",under:"Under 2.5"},
 {pp12:"5 – 5.5",map3:"2.5",under:"Under 3.5"},
 {pp12:"6 – 7.5",map3:"3.5",under:"Under 4.5"},
 {pp12:"8 – 9.5",map3:"4.5",under:"Under 5.5"},
 {pp12:"10 – 11.5",map3:"5.5",under:"Under 6.5"},
 {pp12:"12 – 12.5",map3:"6.5",under:"Under 7.5"},
 ],
 "Dota2":[
 {pp12:"10 – 10.5",map3:"5",under:"Under 6.5"},
 {pp12:"11 – 13",map3:"5.5 – 6",under:"Under 7.5"},
 {pp12:"13.5 – 14.5",map3:"6.5 – 7",under:"Under 8.5"},
 {pp12:"15 – 16.5",map3:"7.5 – 8",under:"Under 9.5"},
 {pp12:"17 – 18.5",map3:"8.5 – 9",under:"Under 10.5"},
 ],
 "CS2/Valorant":[
 {pp12:"23 – 24.5",map3:"11.5 – 12",under:"Under 13.5"},
 {pp12:"25 – 26.5",map3:"12.5 – 13",under:"Under 14.5"},
 {pp12:"27 – 28.5",map3:"13.5 – 14",under:"Under 15.5"},
 {pp12:"29 – 30.5",map3:"14.5 – 15",under:"Under 16.5"},
 {pp12:"31 – 32.5",map3:"15.5 – 16",under:"Under 17.5"},
 {pp12:"33 – 34.5",map3:"16.5 – 17",under:"Under 18.5"},
 {pp12:"35 – 36.5",map3:"17.5 – 18",under:"Under 19.5"},
 ],
 };

 const games=Object.keys(DATA);
 var rows=DATA[game]||[];

 var gameColors={"LoL":"#6366f1","Dota2":"#ef4444","CS2/Valorant":"#f97316"};
 var col=gameColors[game]||"#c4b5fd";

 return(
 <div style={{margin:"0 0 16px"}}>
 <SuiviHead img={_B64_PP_LOGO_B64} color="#a78bfa" title="Table de référence PP" sub="Map 1+2 → Map 3" open={open} onClick={function(){setOpen(function(v){return !v;});}}/>

 {open&&<div style={SV_BODY}>
 {/* Game selector */}
 <div style={{display:"flex",gap:5,marginBottom:12}}>
 {games.map(function(g){
 var on=game===g;
 var gc=gameColors[g]||"#c4b5fd";
 return <button key={g} onClick={function(){setGame(g);}}
 style={{flex:1,padding:"7px 6px",borderRadius:8,border:"1px solid "+(on?"rgba("+( g==="LoL"?"99,102,241":g==="Dota2"?"239,68,68":"249,115,22")+",.4)":"rgba(255,255,255,.07)"),background:on?"rgba("+(g==="LoL"?"99,102,241":g==="Dota2"?"239,68,68":"249,115,22")+",.12)":"transparent",color:on?gc:"#6B7280",fontSize:10,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
 {g==="LoL"&&<GameLogo game="LoL" size={13}/>}
 {g==="Dota2"&&<GameLogo game="Dota2" size={13}/>}
 {g==="CS2/Valorant"&&<><GameLogo game="CS2" size={11}/><span style={{color:"#4a5a6e",fontSize:9}}>|</span><GameLogo game="Valorant" size={11}/></>}
 {g}
 </button>;
 })}
 </div>

 {/* Table */}
 <div style={{borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,.06)"}}>
 <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",background:"rgba(0,0,0,.4)"}}>
 {["PP Map 1+2","Map 3 estimée","Under intéressant"].map(function(h){
 return <div key={h} style={{padding:"8px 10px",fontSize:9,fontWeight:700,color:col,textTransform:"uppercase",letterSpacing:.6,textAlign:"center",borderRight:"1px solid rgba(255,255,255,.04)"}}>{h}</div>;
 })}
 </div>
 {rows.map(function(r,i){
 return <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderTop:"1px solid rgba(255,255,255,.04)",background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}>
 <div style={{padding:"10px 10px",textAlign:"center",fontSize:13,fontWeight:700,color:"#fbbf24",borderRight:"1px solid rgba(255,255,255,.04)"}}>{r.pp12}</div>
 <div style={{padding:"10px 10px",textAlign:"center",fontSize:13,fontWeight:600,color:"#9CA3AF",borderRight:"1px solid rgba(255,255,255,.04)"}}>{r.map3}</div>
 <div style={{padding:"10px 10px",textAlign:"center",fontSize:13,fontWeight:700,color:"#60a5fa"}}>{r.under}</div>
 </div>;
 })}
 </div>

 <div style={{marginTop:8,fontSize:10,color:"#3a4a5e",textAlign:"center"}}>
 Source: analyse PP historique · Under = ligne Map3 PP − 1 kill
 </div>
 </div>}
 </div>
 );
}







}

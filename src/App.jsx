import React, { useState, useEffect, useRef, useMemo, useCallback, memo, forwardRef, useImperativeHandle } from "react";

// ── Service Worker — cache images permanent ───────────────────────────────────
if(typeof window!=="undefined"&&"serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("/sw.js").then(reg=>{
      console.log("SW enregistré:",reg.scope);
    }).catch(err=>{
      console.log("SW échec:",err);
    });
  });
}

// ── Cache images en mémoire (affichage instantané au 2e affichage) ──────────
const IMG_CACHE=new Map();
function CachedImg({src,style,alt="",onError,width,height,...rest}){
  if(!src) return null;
  const cached=IMG_CACHE.has(src);
  const ref=React.useRef(null);
  React.useEffect(()=>{
    if(cached||!src||!ref.current) return;
    // IntersectionObserver — charger seulement quand visible
    const obs=new IntersectionObserver(([entry])=>{
      if(entry.isIntersecting){
        obs.disconnect();
        const img=new Image();
        img.decoding="async";
        img.onload=()=>{
          IMG_CACHE.set(src,true);
          if(ref.current){ref.current.src=src;ref.current.style.opacity="1";}
        };
        img.onerror=()=>{if(ref.current)ref.current.style.display="none";};
        img.src=src;
      }
    },{rootMargin:"200px"}); // Précharger 200px avant d'être visible
    obs.observe(ref.current);
    return()=>obs.disconnect();
  },[src,cached]);
  return(
    <img
      ref={ref}
      src={cached?src:undefined}
      alt={alt}
      width={width}
      height={height}
      decoding="async"
      style={{imageRendering:"high-quality",WebkitFontSmoothing:"antialiased",...style,opacity:cached?1:0,transition:cached?undefined:"opacity .15s"}}
      onLoad={e=>{IMG_CACHE.set(src,true);e.target.style.opacity="1";}}
      onError={e=>{if(onError)onError(e);e.target.style.display="none";}}
      {...rest}
    />
  );
}

// ── Normalize datetime helper ─────────────────────────────────────────────

// Logo NBA - SVG officiel Wikipedia, fond blanc supprimé, cercle
const NBA_LOGO_B64 = "https://upload.wikimedia.org/wikipedia/fr/8/87/NBA_Logo.svg";

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

// ── Supabase - sync sans login ────────────────────────────────────────────
const SUPA_URL = "https://khjljfeknwwktfjjznhp.supabase.co";
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtoamxqZmVrbnd3a3Rmamp6bmhwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MDg5NjgsImV4cCI6MjEwMjA4NDk2OH0.v4H36n7prn6hVwT90nWF3yW-cxyzvmmFbW5EgH6bZX4";

// ── Players DB functions → voir section "Players DB (Supabase only)" ci-dessous ──

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

async function supaPullBets() {
  // Paginer pour dépasser la limite de 1000 de Supabase
  const limit = 1000;
  let all = [];
  let offset = 0;
  while(true) {
    const batch = await supaFetch(`/rest/v1/bets?select=id,player,description,overUnder,odds,stake,bookmaker,status,game,league,role,team,datetime,isHeadshot,isLive,mapTag,profit,tournament,splits,updatedAt,pp_map_type,pp_line,pp_edge&order=datetime.desc&limit=${limit}&offset=${offset}`);
    if(!batch || batch.length === 0) break;
    all = [...all, ...batch];
    if(batch.length < limit) break;
    offset += limit;
  }
  return all.map(b=>{
    const splits=b.splits?JSON.parse(b.splits):undefined;
    return normalizeBet({...b,splits,
      ppMapType:b.pp_map_type||null,
      ppLine:b.pp_line||null,
      ppEdge:b.pp_edge!=null?b.pp_edge:null,
    });
  });
}

async function supaPushBets(bets) {
  const safeDT=dt=>{
    if(!dt)return dt;
    const s=String(dt);
    if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s))return s.slice(0,16);
    return dt;
  };
  const now=Date.now();
  const rows = bets.map(({id,player,description,overUnder,odds,stake,bookmaker,
    status,game,league,role,team,datetime,isHeadshot,isLive,mapTag,profit,tournament,splits,updatedAt,
    ppMapType,ppLine,ppEdge})=>{
    const row={id,player,description,overUnder,odds,stake,bookmaker,status,game,league,role,
      team,datetime:safeDT(datetime),profit,tournament,
      splits:splits&&splits.length>0?JSON.stringify(splits):null,
      updatedAt:updatedAt||now};
    // Colonnes optionnelles — ne pas envoyer si null pour éviter 400 si colonne absente
    if(isHeadshot!==undefined) row.isHeadshot=!!isHeadshot;
    if(isLive!==undefined) row.isLive=!!isLive;
    if(mapTag) row.mapTag=mapTag;
    if(ppMapType) row.pp_map_type=ppMapType;
    if(ppLine) row.pp_line=ppLine;
    if(ppEdge!=null) row.pp_edge=ppEdge;
    return row;
  });
  // Chunk en 500
  for(let i=0;i<rows.length;i+=500){
    await supaFetch("/rest/v1/bets",{
      method:"POST",
      body:JSON.stringify(rows.slice(i,i+500)),
      prefer:"resolution=merge-duplicates",
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

// ── Game Logos & GameLogo component ──────────────────────────────────────
const L={
"Pro A":"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjEwIiBmaWxsPSIjMDAzMTg5Ii8+PHRleHQgeD0iNTAiIHk9IjYwIiBmb250LXNpemU9IjMwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5QUk88L3RleHQ+PC9zdmc+",
  ACB:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjEwIiBmaWxsPSIjREE0MjFGIi8+PHRleHQgeD0iNTAiIHk9IjYwIiBmb250LXNpemU9IjM1IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5BQ0I8L3RleHQ+PC9zdmc+",
  Bundesliga:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjEwIiBmaWxsPSIjMDA1QUEwIi8+PHRleHQgeD0iNTAiIHk9IjYwIiBmb250LXNpemU9IjI0IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5CTEk8L3RleHQ+PC9zdmc+",
  Lega:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjEwIiBmaWxsPSIjMDA2QjM4Ii8+PHRleHQgeD0iNTAiIHk9IjYwIiBmb250LXNpemU9IjMwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5MQkE8L3RleHQ+PC9zdmc+",
  HEBA:"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcng9IjEwIiBmaWxsPSIjMDA0QkE4Ii8+PHRleHQgeD0iNTAiIHk9IjYwIiBmb250LXNpemU9IjI4IiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5IRUJBPC90ZXh0Pjwvc3ZnPg=="
};
function GameLogo({game,size=18}){
  if(game==="NBA")return(
    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,borderRadius:"50%",overflow:"hidden",flexShrink:0,background:"#fff",flexShrink:0}}>
      <img src={NBA_LOGO_B64} alt="NBA" style={{width:"90%",height:"90%",objectFit:"contain",display:"block"}}/>
    </span>
  );
  if(game==="EuroLeague")return <img src={EL_LOGO_B64} alt="EuroLeague" style={{width:size,height:size,objectFit:"contain",display:"block",flexShrink:0,borderRadius:3}}/>;
  if(game==="Pro A")return <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSBXpNrh-XoYgHEbQOwD6o1oawOHmbDmDjgN5UW5psHuEJ1qG_X1_hUYY8&s=10" alt="Pro A" style={{width:size,height:size,objectFit:"contain",display:"block",flexShrink:0,borderRadius:3}}/>;
  if(game==="ACB")return <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTDHba4RJ-Vnfw7Tmz6lpvavCaoXCjLzlPExXlEcZJmZHQZmQ21d6oX02y8&s=10" alt="ACB" style={{width:size,height:size,objectFit:"contain",display:"block",flexShrink:0,borderRadius:3}}/>;
  if(game==="Bundesliga")return <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTDW9tDc-bCNxHCLjgIbxlRE4xjZ6qjjKz9pLEpPZ29Vgjr0qMzLm4elEY&s=10" alt="BBL" style={{width:size,height:size,objectFit:"contain",display:"block",flexShrink:0,borderRadius:3}}/>;
  if(game==="Lega")return <img src="https://upload.wikimedia.org/wikipedia/en/9/9d/LegaBasket_Serie_A_Logo.png" alt="Lega" style={{width:size,height:size,objectFit:"contain",display:"block",flexShrink:0,borderRadius:3}}/>;
  if(game==="EuroCup")return <img src="https://upload.wikimedia.org/wikipedia/en/c/c3/Eurocup_new_logo.png" alt="EuroCup" style={{width:size,height:size,objectFit:"contain",display:"block",flexShrink:0,borderRadius:3}}/>;
  if(game==="BCL")return <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTOfM_B-Ft8HkiGyTsYadfsXdcGMA4RQiPzXwlC90cE-LMdDDrhlXwtTTMT&s=10" alt="BCL" style={{width:size,height:size,objectFit:"contain",display:"block",flexShrink:0,borderRadius:3}}/>;
  if(game==="HEBA")return <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,background:"#0050A0",borderRadius:3,fontSize:Math.max(5,size-8),fontWeight:900,color:"#fff",flexShrink:0}}>GR</span>;
  const src=L[game];
  if(!src) return null;
  return <img src={src} alt={game} style={{width:size,height:size,objectFit:"cover",display:"block",flexShrink:0}}/>;
}

// ── Bankroll Chart ────────────────────────────────────────────────────────
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
    <svg width="100%" viewBox={"0 0 "+W+" "+H} preserveAspectRatio="none" style={{overflow:"visible"}}><defs><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.52"/><stop offset="45%" stopColor={color} stopOpacity="0.18"/><stop offset="100%" stopColor={color} stopOpacity="0.02"/></linearGradient><filter id={glowId} x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="2" result="blur1"/><feGaussianBlur stdDeviation="5" result="blur2"/><feMerge><feMergeNode in="blur2"/><feMergeNode in="blur1"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id={glowId+"pt"} x="-400%" y="-400%" width="900%" height="900%"><feGaussianBlur stdDeviation="7" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id={glowId+"ath"} x="-500%" y="-500%" width="1100%" height="1100%"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      {yTicks.filter(v=>py(v)>pad.t&&py(v)<pad.t+cy).map((v,i)=>(
        <g key={i}><line x1={pad.l} y1={py(v)} x2={W-pad.r} y2={py(v)} stroke={v===0?"rgba(255,255,255,.12)":"rgba(255,255,255,.05)"} strokeWidth={v===0?"1":"0.8"} strokeDasharray={v===0?"none":"3,6"}/><text x={pad.l-3} y={py(v)+3.5} textAnchor="end" fontSize="8.5" fill={v===0?"rgba(255,255,255,.25)":v>0?"rgba(0,230,118,.35)":"rgba(239,68,68,.35)"} fontWeight="600">{v>0?"+":""}{v.toFixed(0)}$</text></g>
      ))}
      {xSamples.filter(i=>points[i]&&points[i].dt).map((i,k)=><text key={k} x={px(i)} y={H-2} textAnchor="middle" fontSize="8.5" fill="rgba(255,255,255,.18)">{points[i].dt.slice(5,10).replace("-","/")}</text>)}
      {/* Gradient fill */}
      <path d={fillPath} fill="url(#cf)"/>
      {/* Soft underline for depth */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.18"/>
      {/* Main glow line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter={"url(#"+glowId+")"}/>
      {/* ATH dashed line */}
      <line x1={pad.l} y1={athY} x2={W-pad.r} y2={athY} stroke="rgba(255,215,80,.22)" strokeWidth="0.8" strokeDasharray="4,5"/><text x={W-pad.r+3} y={athY+4} textAnchor="start" fontSize="8" fill="rgba(255,215,80,.45)" fontWeight="700">ATH</text>
      {/* ATH halo point */}
      {!isAtATH&&<><circle cx={athX} cy={athY} r="14" fill="rgba(255,215,80,.04)" filter={"url(#"+glowId+"ath)"}/><circle cx={athX} cy={athY} r="5" fill="rgba(255,215,80,.18)" filter={"url(#"+glowId+"ath)"}/><circle cx={athX} cy={athY} r="3" fill="rgba(255,215,80,.55)"/><circle cx={athX} cy={athY} r="1.2" fill="rgba(255,240,150,.9)"/></>}
      {/* Current point */}
      <circle cx={currentX} cy={currentY} r="12" fill={color} opacity="0.07" filter={"url(#"+glowId+"pt)"}/><circle cx={currentX} cy={currentY} r="6" fill={color} opacity="0.22" filter={"url(#"+glowId+"pt)"}/><circle cx={currentX} cy={currentY} r="4" fill={color}/><circle cx={currentX} cy={currentY} r="1.8" fill="#fff" opacity="0.95"/>
      {distFromATH>1&&(
        <g><line x1={currentX} y1={currentY-7} x2={currentX} y2={athY+4} stroke="rgba(255,255,255,.12)" strokeWidth="1" strokeDasharray="2,3"/><text x={currentX+6} y={(currentY+athY)/2+4} fontSize="9" fill="rgba(255,255,255,.4)" fontWeight="700">{"-"+distFromATH.toFixed(0)+"$"}</text></g>
      )}
    </svg>
  );
}

// ── CandleChart - graphique style bourse ────────────────────────────────
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
        <g key={i}><line x1={pad.l} y1={py(v)} x2={W-pad.r} y2={py(v)} stroke={v===0?"rgba(255,255,255,.12)":"rgba(255,255,255,.05)"} strokeWidth={v===0?"1":"0.7"} strokeDasharray={v===0?"none":"3,6"}/><text x={pad.l-3} y={py(v)+3.5} textAnchor="end" fontSize="8.5" fill={v===0?"rgba(255,255,255,.25)":v>0?"rgba(0,230,118,.35)":"rgba(239,68,68,.35)"} fontWeight="600">{v>0?"+":""}{v.toFixed(0)}$</text></g>
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
            <line x1={x} y1={py(c.high)} x2={x} y2={bodyTop} stroke={col} strokeWidth="1.2" opacity="0.8"/><line x1={x} y1={bodyBot} x2={x} y2={py(c.low)} stroke={col} strokeWidth="1.2" opacity="0.8"/>
            {/* Body */}
            <rect x={x-hw} y={bodyTop} width={hw*2} height={bodyH} fill={up?"rgba(0,230,118,.7)":"rgba(239,68,68,.7)"} stroke={col} strokeWidth="0.8" rx="0.5"/></g>
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
    <svg width="100%" viewBox={"0 0 "+W+" "+H} preserveAspectRatio="none" style={{overflow:"visible"}}><defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00E676" stopOpacity=".7"/><stop offset="100%" stopColor="#00E676" stopOpacity=".15"/></linearGradient><linearGradient id="pr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EF4444" stopOpacity=".15"/><stop offset="100%" stopColor="#EF4444" stopOpacity=".7"/></linearGradient></defs>
      {/* zero line */}
      <line x1={padL} y1={zeroY} x2={W-padR} y2={zeroY} stroke="#374151" strokeWidth="1"/><text x={padL-3} y={zeroY+4} textAnchor="end" fontSize="8" fill="#6B7280">0</text><text x={padL-3} y={padT+5} textAnchor="end" fontSize="8" fill="#00E676">+{maxAbs.toFixed(0)}</text><text x={padL-3} y={H-padB+4} textAnchor="end" fontSize="8" fill="#EF4444">-{maxAbs.toFixed(0)}</text>
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

// ── Players DB (Supabase only) ───────────────────────────────────────────
// Structure: { id, name, game, league, role, team, avatar_url, avatar_file }
// avatar_url  → priorité 1 : URL externe
// avatar_file → priorité 2 : nom de fichier dans Supabase Storage (bucket "avatars")
// Sinon        → avatar par défaut (initiales)

const AVATARS_BUCKET = SUPA_URL + "/storage/v1/object/public/avatars/";

// ── Copier une image externe vers Supabase Storage via canvas ────────────────
// Retourne l'URL Supabase permanente, ou l'URL originale si crossOrigin bloqué
async function supaRehost(externalUrl, name) {
  if(!externalUrl) return externalUrl;
  if(externalUrl.includes(SUPA_URL)) return externalUrl;
  if(!SUPA_URL||!SUPA_KEY) return externalUrl;

  // ── Méthode 1 : Edge Function Supabase (côté serveur, zéro CORS) ─────────────
  try{
    const fnRes=await fetch(SUPA_URL+"/functions/v1/rehost-image",{
      method:"POST",
      headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY},
      body:JSON.stringify({url:externalUrl,name:name||"player"}),
    });
    if(fnRes.ok){
      const data=await fnRes.json();
      if(data.url&&data.url.includes(SUPA_URL)) return data.url;
    }
  }catch(e){}

  // ── Méthode 2 : fetch navigateur direct (si le site autorise CORS) ───────────
  try{
    const ctrl=new AbortController();
    const tid=setTimeout(()=>ctrl.abort(),8000);
    const imgRes=await fetch(externalUrl,{signal:ctrl.signal,mode:"cors"});
    clearTimeout(tid);
    if(imgRes.ok){
      const blob=await imgRes.blob();
      const ct=blob.type||"image/jpeg";
      const ext=ct.includes("png")?"png":ct.includes("webp")?"webp":"jpg";
      const safeName=(name||"player").toLowerCase().replace(/[^a-z0-9]/g,"_").slice(0,40);
      const path="photos/players/"+safeName+"_"+Date.now()+"."+ext;
      const upRes=await fetch(SUPA_URL+"/storage/v1/object/avatars/"+path,{
        method:"POST",
        headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":ct,"x-upsert":"true"},
        body:blob,
      });
      if(upRes.ok) return SUPA_URL+"/storage/v1/object/public/avatars/"+path;
    }
  }catch(e){}

  // ── Méthode 3 : canvas crossOrigin (dernier recours) ────────────────────────
  return new Promise((resolve)=>{
    const safeName=(name||"player").toLowerCase().replace(/[^a-z0-9]/g,"_").slice(0,40);
    const path="photos/players/"+safeName+"_"+Date.now()+".png";
    const img=new Image();
    img.crossOrigin="anonymous";
    img.onload=async ()=>{
      try{
        const canvas=document.createElement("canvas");
        canvas.width=img.naturalWidth||300;
        canvas.height=img.naturalHeight||300;
        const ctx=canvas.getContext("2d");
        ctx.drawImage(img,0,0);
        canvas.toBlob(async (blob)=>{
          if(!blob){resolve(externalUrl);return;}
          try{
            const res=await fetch(SUPA_URL+"/storage/v1/object/avatars/"+path,{
              method:"POST",
              headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":"image/png","x-upsert":"true"},
              body:blob,
            });
            if(res.ok) resolve(SUPA_URL+"/storage/v1/object/public/avatars/"+path);
            else resolve(externalUrl);
          }catch(e){resolve(externalUrl);}
        },"image/png",0.98);
      }catch(e){resolve(externalUrl);}
    };
    img.onerror=()=>resolve(externalUrl);
    img.src=externalUrl;
    setTimeout(()=>resolve(externalUrl),8000);
  });
}


function getAvatarSrc(player) {
  if ((player&&player.photo_url)) return player.photo_url;
  if ((player&&player.avatar_url)) return player.avatar_url;
  if ((player&&player.avatar_file)) return AVATARS_BUCKET + encodeURIComponent(player.avatar_file);
  return null; // → afficher les initiales
}

async function supaFetchPlayers() {
  const headers = { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY };
  const limit = 1000;
  async function fetchAll(endpoint, fields) {
    let all = []; let offset = 0;
    while (true) {
      const res = await fetch(SUPA_URL+"/rest/v1/"+endpoint+"?select="+fields+"&order=name.asc&limit="+limit+"&offset="+offset,{headers});
      if (!res.ok) return null;
      const batch = await res.json();
      if (!batch || batch.length === 0) break;
      all = [...all, ...batch];
      if (batch.length < limit) break;
      offset += limit;
    }
    return all;
  }
  return await fetchAll("players","id,name,game,league,role,team,photo_url,team_logo_url,avatar_url,avatar_file");
}

async function supaUpsertPlayer(data) {
  const payload = {
    name: data.name.toLowerCase().trim(),
    game: data.game || "NBA",
    league: data.league || "",
    role: data.role || "",
    team: data.team || "",
    photo_url: data.photo_url || data.avatar_url || null,
    avatar_url: data.avatar_url || null,
    avatar_file: data.avatar_file || null,
    team_logo_url: data.team_logo_url || null,
  };
  if (data.id) payload.id = data.id;
  const res = await fetch(SUPA_URL + "/rest/v1/players", {
    method: "POST",
    headers: {
      "apikey": SUPA_KEY,
      "Authorization": "Bearer " + SUPA_KEY,
      "Content-Type": "application/json",
      "Prefer": "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  const result = await res.json();
  return Array.isArray(result) ? result[0] : result;
}

async function supaDeletePlayer(id) {
  await fetch(SUPA_URL + "/rest/v1/players?id=eq." + encodeURIComponent(id), {
    method: "DELETE",
    headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY },
  });
}

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

const DEFAULT_BK=["Stake","Roobet","Rainbet","BCGame","Duelbits","Duel","Yeet","Thunderpick","Winna","Thrill","Spartans","Gambana","Betpanda","Toshi","Shock","Qzino"];

const BK_LOGOS={};


// ── Constants ──────────────────────────────────────────────────────────────
const ALL_GAMES=["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Bundesliga","Lega","HEBA"];
const LEAGUES_BY_GAME={
  NBA:["Eastern Conference","Western Conference","NBA Finals"],
  EuroLeague:["Regular Season","Final Four","Play-In"],
  "Pro A":["Saison Régulière","Play-offs"],
  ACB:["Liga ACB","Copa del Rey","Play-offs ACB"],
  Bundesliga:["BBL","BBL Play-offs"],
  Lega:["Lega Basket","Coppa Italia"],
  HEBA:["A1","Play-offs HEBA"],
};

// ── Basketball Positions ────────────────────────────────────────────────────
const BASKET_POSITIONS=["PG","SG","SF","PF","C"];
const POS_LABELS={PG:"Point Guard",SG:"Shooting Guard",SF:"Small Forward",PF:"Power Forward",C:"Center"};
const POS_COLORS={PG:{col:"#a78bfa",bg:"rgba(167,139,250,.12)",border:"rgba(167,139,250,.3)"},SG:{col:"#60a5fa",bg:"rgba(96,165,250,.12)",border:"rgba(96,165,250,.3)"},SF:{col:"#34d399",bg:"rgba(52,211,153,.12)",border:"rgba(52,211,153,.3)"},PF:{col:"#fb923c",bg:"rgba(251,146,60,.12)",border:"rgba(251,146,60,.3)"},C:{col:"#f472b6",bg:"rgba(244,114,182,.12)",border:"rgba(244,114,182,.3)"}};
function PositionLogo({role,size=16}){
  if(!role)return null;
  const key=role?.toUpperCase();
  const label=POS_LABELS[key]||role;
  const p=POS_COLORS[key]||{col:"#94a3b8"};
  const fs=Math.max(9,size-3);
  return(
    <span style={{
      fontSize:fs,fontWeight:600,color:p.col,
      flexShrink:0,lineHeight:1.2,
      whiteSpace:"nowrap",
    }}>{label}</span>
  );
}
function FmtProfit({v,fontSize=12,fontWeight=800}){
  const pos=v>=0;
  const color=pos?"#00E676":"#f87171";
  const abs=Math.abs(Math.round(v));
  return(
    <span style={{display:"inline-flex",alignItems:"baseline",fontVariantNumeric:"tabular-nums",fontFeatureSettings:'"tnum"',fontSize,fontWeight,color,justifyContent:"flex-end",letterSpacing:"-0.2px"}}><span style={{display:"inline-block",width:"0.65em",textAlign:"center",flexShrink:0}}>{pos?"+":"−"}</span><span style={{minWidth:"3ch",textAlign:"right"}}>{abs.toLocaleString("fr-CA")}</span><span style={{opacity:.7,marginLeft:1,fontSize:fontSize*0.85}}>$</span></span>
  );
}
const FR_MONTHS=["Janvier","Fevrier","Mars","Avril","Mai","Juin","Juillet","Aout","Septembre","Octobre","Novembre","Decembre"];
const FR_DAYS=["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
const QUICK_STAKES=[50,62,75,87,100];
const GAME_COLORS={
  NBA:{accent:"#C9082A",bg:"rgba(201,8,42,0.08)",border:"rgba(201,8,42,0.25)",logo:"https://www.nba.com/resources/static/team/v2/league/nba-logoman-75-word_white.svg"},
  EuroLeague:{accent:"#0057A8",bg:"rgba(0,87,168,0.08)",border:"rgba(0,87,168,0.25)",logo:"https://upload.wikimedia.org/wikipedia/en/thumb/9/9c/EuroLeague_logo.png/120px-EuroLeague_logo.png"},
  "EuroCup":{accent:"#e8c84a",bg:"rgba(232,200,74,0.08)",border:"rgba(232,200,74,0.25)",logo:""},
  "BCL":{accent:"#4a90d9",bg:"rgba(74,144,217,0.08)",border:"rgba(74,144,217,0.25)",logo:""},
  "Pro A":{accent:"#FF6900",bg:"rgba(255,105,0,0.08)",border:"rgba(255,105,0,0.25)",logo:""},
  ACB:{accent:"#E30613",bg:"rgba(227,6,19,0.08)",border:"rgba(227,6,19,0.25)",logo:""},
  Bundesliga:{accent:"#009DE0",bg:"rgba(0,157,224,0.08)",border:"rgba(0,157,224,0.25)",logo:""},
  Lega:{accent:"#00529B",bg:"rgba(0,82,155,0.08)",border:"rgba(0,82,155,0.25)",logo:""},
  HEBA:{accent:"#1E90FF",bg:"rgba(30,144,255,0.08)",border:"rgba(30,144,255,0.25)",logo:""},
};
const GAME_CFG=GAME_COLORS;

// ── Logos équipes NBA (ESPN CDN) ─────────────────────────────────────────────
const NBA_TEAM_LOGOS = {
  "Atlanta Hawks":        "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/atl.png&h=200&w=200",
  "Boston Celtics":       "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/bos.png&h=200&w=200",
  "Brooklyn Nets":        "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/bkn.png&h=200&w=200",
  "Charlotte Hornets":    "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/cha.png&h=200&w=200",
  "Chicago Bulls":        "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/chi.png&h=200&w=200",
  "Cleveland Cavaliers":  "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/cle.png&h=200&w=200",
  "Dallas Mavericks":     "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/dal.png&h=200&w=200",
  "Denver Nuggets":       "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/den.png&h=200&w=200",
  "Detroit Pistons":      "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/det.png&h=200&w=200",
  "Golden State Warriors":"https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/gs.png&h=200&w=200",
  "Houston Rockets":      "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/hou.png&h=200&w=200",
  "Indiana Pacers":       "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/ind.png&h=200&w=200",
  "LA Clippers":          "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/lac.png&h=200&w=200",
  "Los Angeles Lakers":   "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/lal.png&h=200&w=200",
  "Memphis Grizzlies":    "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/mem.png&h=200&w=200",
  "Miami Heat":           "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/mia.png&h=200&w=200",
  "Milwaukee Bucks":      "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/mil.png&h=200&w=200",
  "Minnesota Timberwolves":"https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/min.png&h=200&w=200",
  "New Orleans Pelicans": "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/no.png&h=200&w=200",
  "New York Knicks":      "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/ny.png&h=200&w=200",
  "Oklahoma City Thunder":"https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/okc.png&h=200&w=200",
  "Orlando Magic":        "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/orl.png&h=200&w=200",
  "Philadelphia 76ers":   "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/phi.png&h=200&w=200",
  "Phoenix Suns":         "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/phx.png&h=200&w=200",
  "Portland Trail Blazers":"https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/por.png&h=200&w=200",
  "Sacramento Kings":     "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/sac.png&h=200&w=200",
  "San Antonio Spurs":    "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/sa.png&h=200&w=200",
  "Toronto Raptors":      "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/tor.png&h=200&w=200",
  "Utah Jazz":            "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/utah.png&h=200&w=200",
  "Washington Wizards":   "https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/wsh.png&h=200&w=200",
};
const EL_LOGO_B64 = "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSc4JJn1YiaNoPGJHVcgw10vQvx2le4Nc4k1g&s";
const EL_TEAM_LOGOS = {
  "Anadolu Efes Istanbul": "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjCgOCxM/a844756c-a58d-4666-93b8-48f7337bc79d.png?width=168&resizeType=fill&format=webp",
  "Besiktas Istanbul": "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjChWbHH/b05e3c54-e672-4b31-9f86-c91e9de7715c.png?width=168&resizeType=fill&format=webp",
  "Crvena Zvezda Meridianbet Belgrade": "https://media-cdn.incrowdsports.com/d2eef4a8-62df-4fdd-9076-276004268515.png?width=168&resizeType=fill&format=webp",
  "Dubai Basketball": "https://media-cdn.incrowdsports.com/1efae090-16e2-4963-ae47-4b94f249c244.png?width=168&resizeType=fill&format=webp",
  "FC Barcelona": "https://media-cdn.incrowdsports.com/35dfa503-e417-481f-963a-bdf6f013763e.png?width=168&resizeType=fill&format=webp",
  "FC Bayern Munich": "https://media-cdn.incrowdsports.com/817b0e58-d595-4b09-ab0b-1e7cc26249ff.png?width=168&resizeType=fill&format=webp",
  "Fenerbahce Istanbul": "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjCiezrk/aa39750a-6203-49ee-a87d-edd0c6f0397d.png?width=168&resizeType=fill&format=webp",
  "Hapoel IBI Tel Aviv": "https://media-cdn.incrowdsports.com/cbb1c3ad-03d5-426a-b5ef-2832a4eee484.png?width=168&resizeType=fill&format=webp",
  "Kosner Baskonia": "https://media-cdn.cortextech.io/cbc49cb0-99ce-4462-bdb7-56983ee03cf4.png?width=168&resizeType=fill&format=webp",
  "LDLC ASVEL Villeurbanne": "https://media-cdn.incrowdsports.com/e33c6d1a-95ca-4dbc-b8cb-0201812104cc.png?width=168&resizeType=fill&format=webp",
  "Maccabi Rapyd Tel Aviv": "https://media-cdn.cortextech.io/1b533342-78f5-4932-b714-a7d80b5826b5.png?width=168&resizeType=fill&format=webp",
  "Olympiacos Piraeus": "https://media-cdn.incrowdsports.com/789423ac-3cdf-4b89-b11c-b458aa5f59a6.png?width=168&resizeType=fill&format=webp",
  "Panathinaikos AKTOR Athens": "https://media-cdn.incrowdsports.com/e3dff28a-9ec6-4faf-9d96-ecbc68f75780.png?width=168&resizeType=fill&format=webp",
  "Paris Basketball": "https://media-cdn.incrowdsports.com/a033e5b3-0de7-48a3-98d9-d9a4b9df1f39.png?width=168&resizeType=fill&format=webp",
  "Partizan Mozzart Bet Belgrade": "https://media-cdn.incrowdsports.com/2681304e-77dd-4331-88b1-683078c0fb49.png?width=168&resizeType=fill&format=webp",
  "Real Madrid": "https://media-cdn.incrowdsports.com/371b0d9b-9250-4c09-bda7-0686cf024657.png?width=168&resizeType=fill&format=webp",
  "Valencia Basket": "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjChWbHL/bc3e00b2-fea4-40be-a7ec-1e633129bde3.png?width=168&resizeType=fill&format=webp",
  "Virtus Bologna": "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjCiezvk/a92d4c3b-9f9c-4163-8a10-bcf8fc15893e.png?width=168&resizeType=fill&format=webp",
  "Zalgiris Kaunas": "https://media-cdn.incrowdsports.com/0aa09358-3847-4c4e-b228-3582ee4e536d.png?width=168&resizeType=fill&format=webp"
};

// ── TEAM_LOGOS - map globale par nom de club (toutes ligues) ─────────────────
// Un club peut jouer dans plusieurs ligues (ex: JL Bourg → Pro A + EuroCup)
// Le logo est cherché par nom de club uniquement, ligue indépendante.
// Colle les URLs ici pour chaque club.
const TEAM_LOGOS = {
  // ── Pro A ──────────────────────────────────────────────────────────────────
  "Paris Basketball":        "https://www.basketguru.fr/team_logos/logo_paris_basketball.png",
  "LDLC ASVEL":              "https://www.basketguru.fr/team_logos/logo_asvel.png",
  "JL Bourg":                "https://www.basketguru.fr/team_logos/logo_jlbourg.png",
  "Cholet Basket":           "https://www.basketguru.fr/team_logos/logo_cholet.png",
  "Nanterre 92":             "https://www.basketguru.fr/team_logos/logo_nanterre.png",
  "Le Mans Sarthe":          "https://www.basketguru.fr/team_logos/logo_msb.png",
  "Élan Chalon":             "https://www.basketguru.fr/team_logos/logo_chalon.png",
  "Gravelines-Dunkerque":    "https://www.basketguru.fr/team_logos/logo_bcm.png",
  "SIG Strasbourg":          "https://www.basketguru.fr/team_logos/logo_strasbourg.png",
  "Limoges CSP":             "https://www.basketguru.fr/team_logos/logo_csp_limoges.png",
  "Roanne":                  "https://www.basketguru.fr/team_logos/logo_roanne.png",
  "Pau-Lacq-Orthez":         "https://www.basketguru.fr/team_logos/logo_pau.png",
  "Nancy":                   "https://www.basketguru.fr/team_logos/logo_sluc.png",
  "Boulazac Basket Dordogne":"https://www.basketguru.fr/team_logos/logo_bbd.png",
  "JDA Dijon":               "https://www.basketguru.fr/team_logos/logo_jda.png",
  "Saint-Quentin":           "https://www.basketguru.fr/team_logos/logo_sqbb.png",
  "LDLC ASVEL":              "",
  "JL Bourg":                "",
  "Cholet Basket":           "",
  "Nanterre 92":             "",
  "Metropolitans 92":        "",
  "Monaco":                  "",
  "Roanne":                  "",
  "Le Mans Sarthe":          "",
  "Orléans Loiret":          "",
  "Pau-Lacq-Orthez":         "",
  "Limoges CSP":             "",
  "Elan Chalon":             "",
  "Gravelines-Dunkerque":    "",
  "SIG Strasbourg":          "",
  "Fos Provence":            "",
  "Champagne Basket":        "",
  "Châlons-Reims":           "",
  "Nancy":                   "",
  "Hyères-Toulon":           "",

  // ── ACB ────────────────────────────────────────────────────────────────────
  "Real Madrid":             "",
  "FC Barcelona":            "",
  "Baskonia":                "",
  "Valencia Basket":         "",
  "Gran Canaria":            "",
  "Unicaja":                 "",
  "Joventut Badalona":       "",
  "Breogán":                 "",
  "Manresa":                 "",
  "BAXI Manresa":            "",
  "Zaragoza":                "",
  "Fuenlabrada":             "",
  "Obradoiro":               "",
  "UCAM Murcia":             "",
  "Bilbao Basket":           "",
  "Surne Bilbao":            "",
  "La Laguna Tenerife":      "",
  "Betis":                   "",
  "Estudiantes":             "",
  "Burgos":                  "",
  "Recoletas Salud Burgos":  "",

  // ── Lega ───────────────────────────────────────────────────────────────────
  "EA7 Olimpia Milano":      "",
  "Virtus Bologna":          "",
  "Dolomiti Energia Trento": "",
  "Umana Reyer Venezia":     "",
  "Pallacanestro Varese":    "",
  "Tortona":                 "",
  "Baglietto Derthona Tortona":"",
  "Brescia":                 "",
  "Reggiana":                "",
  "Napoli Basketball":       "",
  "Trieste":                 "",
  "Treviso":                 "",
  "Cremona":                 "",
  "Scafati":                 "",
  "Pistoia":                 "",
  "Forlì":                   "",
  "Udine":                   "",
  "Brindisi":                "",
  "Pesaro":                  "",
  "Roma Basketball":         "",
  "Trapani":                 "",

  // ── Bundesliga ─────────────────────────────────────────────────────────────
  "Bayern München":          "",
  "Alba Berlin":             "",
  "Telekom Baskets Bonn":    "",
  "Hamburg Towers":          "",
  "Würzburg":                "",
  "Skyliners Frankfurt":     "",
  "BMA365 Bamberg":          "",
  "NINERS Chemnitz":         "",
  "MHP Riesen Ludwigsburg":  "",
  "Rostock Seawolves":       "",
  "Heidelberg":              "",
  "ratiopharm Ulm":          "",
  "Syntainics MBC":          "",
  "Veolia Towers":           "",
  "Jena":                    "",
  "Tübingen":                "",
  "Göttingen":               "",
  "Gießen":                  "",
  "Braunschweig":            "",
  "Dresden":                 "",

  // ── EuroLeague (logos depuis EL_TEAM_LOGOS existants) ────────────────────
  "Real Madrid":                    "https://media-cdn.incrowdsports.com/371b0d9b-9250-4c09-bda7-0686cf024657.png?width=168&resizeType=fill&format=webp",
  "FC Barcelona":                   "https://media-cdn.incrowdsports.com/35dfa503-e417-481f-963a-bdf6f013763e.png?width=168&resizeType=fill&format=webp",
  "Fenerbahçe Tarfin":              "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjCiezrk/aa39750a-6203-49ee-a87d-edd0c6f0397d.png?width=168&resizeType=fill&format=webp",
  "Fenerbahce":                     "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjCiezrk/aa39750a-6203-49ee-a87d-edd0c6f0397d.png?width=168&resizeType=fill&format=webp",
  "Anadolu Efes":                   "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjCgOCxM/a844756c-a58d-4666-93b8-48f7337bc79d.png?width=168&resizeType=fill&format=webp",
  "Olympiacos":                     "https://media-cdn.incrowdsports.com/789423ac-3cdf-4b89-b11c-b458aa5f59a6.png?width=168&resizeType=fill&format=webp",
  "Panathinaikos AKTOR":            "https://media-cdn.incrowdsports.com/e3dff28a-9ec6-4faf-9d96-ecbc68f75780.png?width=168&resizeType=fill&format=webp",
  "Panathinaikos":                  "https://media-cdn.incrowdsports.com/e3dff28a-9ec6-4faf-9d96-ecbc68f75780.png?width=168&resizeType=fill&format=webp",
  "Partizan Mozzart Bet":           "https://media-cdn.incrowdsports.com/2681304e-77dd-4331-88b1-683078c0fb49.png?width=168&resizeType=fill&format=webp",
  "Partizan":                       "https://media-cdn.incrowdsports.com/2681304e-77dd-4331-88b1-683078c0fb49.png?width=168&resizeType=fill&format=webp",
  "Crvena zvezda Meridianbet":      "https://media-cdn.incrowdsports.com/d2eef4a8-62df-4fdd-9076-276004268515.png?width=168&resizeType=fill&format=webp",
  "Crvena zvezda":                  "https://media-cdn.incrowdsports.com/d2eef4a8-62df-4fdd-9076-276004268515.png?width=168&resizeType=fill&format=webp",
  "Maccabi Rapyd Tel Aviv":         "https://media-cdn.cortextech.io/1b533342-78f5-4932-b714-a7d80b5826b5.png?width=168&resizeType=fill&format=webp",
  "Maccabi Tel Aviv":               "https://media-cdn.cortextech.io/1b533342-78f5-4932-b714-a7d80b5826b5.png?width=168&resizeType=fill&format=webp",
  "Olimpia Milano":                 "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjCgPRhK/c3bed86d-f49c-4459-a7b7-97e4a49d67da.png?width=168&resizeType=fill&format=webp",
  "EA7 Olimpia Milano":             "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjCgPRhK/c3bed86d-f49c-4459-a7b7-97e4a49d67da.png?width=168&resizeType=fill&format=webp",
  "Virtus Olidata Bologna":         "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjCiezvk/a92d4c3b-9f9c-4163-8a10-bcf8fc15893e.png?width=168&resizeType=fill&format=webp",
  "Virtus Bologna":                 "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjCiezvk/a92d4c3b-9f9c-4163-8a10-bcf8fc15893e.png?width=168&resizeType=fill&format=webp",
  "Beşiktaş Gain":                  "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjChWbHH/b05e3c54-e672-4b31-9f86-c91e9de7715c.png?width=168&resizeType=fill&format=webp",
  "Besiktas":                       "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjChWbHH/b05e3c54-e672-4b31-9f86-c91e9de7715c.png?width=168&resizeType=fill&format=webp",
  "Kosner Baskonia":                "https://media-cdn.cortextech.io/cbc49cb0-99ce-4462-bdb7-56983ee03cf4.png?width=168&resizeType=fill&format=webp",
  "Bayern München":                 "https://media-cdn.incrowdsports.com/817b0e58-d595-4b09-ab0b-1e7cc26249ff.png?width=168&resizeType=fill&format=webp",
  "FC Bayern Munich":               "https://media-cdn.incrowdsports.com/817b0e58-d595-4b09-ab0b-1e7cc26249ff.png?width=168&resizeType=fill&format=webp",
  "LDLC ASVEL":                     "https://www.basketguru.fr/team_logos/logo_asvel.png",
  "Valencia Basket":                "https://media-cdn.cortextech.io/1dU3kpCqReRp93/1BSdBWIjChWbHL/bc3e00b2-fea4-40be-a7ec-1e633129bde3.png?width=168&resizeType=fill&format=webp",
  "Paris Basketball":               "https://www.basketguru.fr/team_logos/logo_paris_basketball.png",
  "Žalgiris":                       "https://media-cdn.incrowdsports.com/0aa09358-3847-4c4e-b228-3582ee4e536d.png?width=168&resizeType=fill&format=webp",
  "Zalgiris Kaunas":                "https://media-cdn.incrowdsports.com/0aa09358-3847-4c4e-b228-3582ee4e536d.png?width=168&resizeType=fill&format=webp",
  "Dubai Basketball":               "https://media-cdn.incrowdsports.com/1efae090-16e2-4963-ae47-4b94f249c244.png?width=168&resizeType=fill&format=webp",
  "Hapoel IBI Tel Aviv":            "https://media-cdn.incrowdsports.com/cbb1c3ad-03d5-426a-b5ef-2832a4eee484.png?width=168&resizeType=fill&format=webp",
  "Hapoel Tel Aviv":                "https://media-cdn.incrowdsports.com/cbb1c3ad-03d5-426a-b5ef-2832a4eee484.png?width=168&resizeType=fill&format=webp",

  // ── EuroCup ────────────────────────────────────────────────────────────────
  "Aris Thessaloniki":       "",
  "PAOK Thessaloniki":       "",
  "Hapoel Jerusalem":        "",
  "Lietkabelis Panevezys":   "",
  "London Lions":            "",
  "Neptūnas Klaipeda":       "",
  "Riga Zelli":              "",
  "Siauliai":                "",
  "Slask Wroclaw":           "",
  "Tofas Bursa":             "",
  "Türk Telekom":            "",
  "U-BT Cluj-Napoca":        "",
  "Bahcesehir Koleji":       "",
  "Balkan Botevgrad":        "",
  "Buducnost VOLI":          "",
  "Cedevita Olimpija":       "",

  // ── BCL ────────────────────────────────────────────────────────────────────
  "Rytas Vilnius":           "",
  "AEK":                     "",
  "Peristeri":               "",
  "Igokea m:tel":            "",
  "Hapoel Holon":            "",
  "Galatasaray":             "",
  "Spartak Office Shoes":    "",
  "ERA Nymburk":             "",
  "Cibona":                  "",
  "Windrose Giants Antwerp": "",
  "Falco KC Szombathely":    "",
  "FC Porto":                "",
  "Legia Warszawa":          "",
  "Sabah BC":                "",
  "Trabzonspor":             "",
  "BK KVIS Pardubice":       "",
  "Fribourg Olympic":        "",
};

const NATIONAL_LEAGUE_LOGOS = {
  "BSL": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSeCNib_l5_Jelu9gRgxXxC0e5GTwqpCLAXegxG_Xdk0g&s=10",
  "LBA": "https://www.proballers.com/media/league/40.svg",
  "ACB": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSm-H0B_Oo0OO2p5gItkS7GWP0O1kK27KDaFBw4FIPzQQ&s=10",
  "BBL": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTDW9tDc-bCNxHCLjgIbxlRE4xjZ6qjjKz9pLEpPZ29Vgjr0qMzLm4elEY&s=10",
  "ProA": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ_GUimfmTqZn8yeW1XgEr5EdUguRMtCv3wJ8gRr7a_LA&s=10",
  "HEBA": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRZtp4GmQVWNDijCrdwbg_G7twhP_RsCkbV0G4m-x9rdmDHWMxx5H-qE68&s=10"
};

// Mapping équipe EuroLeague → ligue nationale
const EL_TEAM_NATIONAL_LEAGUE = {
  "Anadolu Efes Istanbul":             "BSL",
  "Besiktas Istanbul":                 "BSL",
  "Fenerbahce Istanbul":               "BSL",
  "Armani Olimpia Milan":              "LBA",
  "Virtus Bologna":                    "LBA",
  "FC Barcelona":                      "ACB",
  "Kosner Baskonia Vitoria-Gasteiz":   "ACB",
  "Real Madrid":                       "ACB",
  "Valencia Basket":                   "ACB",
  "FC Bayern Munich":                  "BBL",
  "Hapoel IBI Tel Aviv":               "BSL_Israel",
  "Maccabi Rapyd Tel Aviv":            "BSL_Israel",
  "LDLC ASVEL Villeurbanne":           "ProA",
  "Paris Basketball":                  "ProA",
  "Olympiacos Piraeus":                "HEBA",
  "Panathinaikos AKTOR Athens":        "HEBA",
};
const NBA_LEAGUE_LOGO = "https://a.espncdn.com/combiner/i?img=/i/teamlogos/leagues/500/nba.png&h=200&w=200";

// ── Équipes ligues européennes basket ────────────────────────────────────────
const EURO_TEAMS={
  // ── Pro A / Betclic Élite (France) ───────────────────────────────────────
  "Pro A":["Paris Basketball","LDLC ASVEL","JL Bourg","Cholet Basket","Nanterre 92","Le Mans Sarthe","Élan Chalon","Gravelines-Dunkerque","SIG Strasbourg","Limoges CSP","Roanne","Pau-Lacq-Orthez","Nancy","Boulazac Basket Dordogne","JDA Dijon","Saint-Quentin"],
  // ── ACB (Espagne) ────────────────────────────────────────────────────────
  "ACB":["Real Madrid","FC Barcelona","Kosner Baskonia","Valencia Basket","Unicaja","Joventut Badalona","BAXI Manresa","Casademont Zaragoza","UCAM Murcia","Bilbao Basket","Surne Bilbao","Lenovo Tenerife","Monbus Obradoiro","MoraBanc Andorra","Siblo San Pablo Burgos","Rio Breogan","CB Girona","CB Coruna","Forca Lleida"],
  // ── Lega Basket Serie A (Italie) ─────────────────────────────────────────
  "Lega":["Olimpia Milano","Umana Reyer Venezia","Virtus Olidata Bologna","Maxima Roma","BC Roma SPQR","Pallacanestro Varese","Baglietto Derthona","Napoli Basketball","Pallacanestro Reggiana","Dolomiti Energia Trento","Nutribullet Treviso","APU Udine","Pallacanestro Trieste","Acqua San Bernardo Cantu","Givova Scafati","Tezenis Verona"],
  // ── BBL / Bundesliga (Allemagne) ─────────────────────────────────────────
  "Bundesliga":["Bayern München","Telekom Baskets Bonn","Hamburg Towers","Skyliners Frankfurt","BMA365 Bamberg","NINERS Chemnitz","MHP Riesen Ludwigsburg","Rostock Seawolves","MLP Academics Heidelberg","ratiopharm Ulm","Syntainics MBC","Rasta Vechta","Science City Jena","Tigers Tübingen","BG Göttingen","Giessen 46ers","Löwen Braunschweig","Dresden Titans","Brose Bamberg","Hamburg Towers"],
  // ── EuroLeague 2026-27 (20 équipes officielles Wikipedia) ────────────────
  "EuroLeague":["Real Madrid","FC Barcelona","Fenerbahçe Tarfin","Anadolu Efes","Olympiacos","Panathinaikos AKTOR","Partizan Mozzart Bet","Crvena zvezda Meridianbet","Maccabi Rapyd Tel Aviv","Olimpia Milano","Virtus Olidata Bologna","Beşiktaş Gain","Kosner Baskonia","Bayern München","LDLC ASVEL","Valencia Basket","Paris Basketball","Žalgiris","Dubai Basketball","Hapoel IBI Tel Aviv"],
  // ── EuroCup 2026-27 (32 équipes - Monaco exclu 01/09/2026) ───────────────
  "EuroCup":["JL Bourg","Le Mans Sarthe","Türk Telekom","Skyliners Frankfurt","Budućnost VOLI","U-BT Cluj-Napoca","PAOK","Bahçeşehir Koleji","Cedevita Olimpija","Baglietto Derthona","Aris Thessaloniki","Hapoel Midtown Jerusalem","ratiopharm Ulm","Dolomiti Energia Trento","Neptūnas Klaipeda","La Laguna Tenerife","NINERS Chemnitz","Umana Reyer Venezia","Lietkabelis Panevezys","London Lions","Maxima Roma","BAXI Manresa","Balkan Botevgrad","Šiauliai","Napoli Basketball","Recoletas Salud Burgos","Rostock Seawolves","Śląsk Wrocław","Roma Basketball","Bosna BH Telecom","Rīgas Zeļļi","Tofaş"],
  // ── BCL 2026-27 (30 direct + 2 qualifications) ───────────────────────────
  "BCL":["Asisa Joventut","Slavia Prague ERA NBK","Trabzonspor","UCAM Murcia","KVIS Pardubice","Galatasaray MCT","Surne Bilbao","AEK","Sabah BC","Unicaja","Peristeri Betsson","Windrose Giants Antwerp","Nanterre 92","Hapoel Netanel Holon","Igokea m:tel","Cholet","Bnei Penlink Herzliya","Cibona","SIG Strasbourg","Pallacanestro Reggiana","Alba Berlin","Pallacanestro Varese","Legia Warszawa","BMA365 Bamberg","Juventus Utena","FC Porto","Telekom Baskets Bonn","Rytas Vilnius","Spartak Office Shoes","Falco KC Szombathely"],
};

// ── Clubs multi-ligues 2026-27 (données officielles) ─────────────────────────
const MULTI_LEAGUE_CLUBS={
  // ────────────────────────────────────────────────────────────────────────
  // FRANCE - Pro A
  // ────────────────────────────────────────────────────────────────────────
  "LDLC ASVEL":         ["Pro A","EuroLeague"],
  "Paris Basketball":   ["Pro A","EuroLeague"],
  "JL Bourg":           ["Pro A","EuroCup"],
  "Le Mans Sarthe":     ["Pro A","EuroCup"],
  "Nanterre 92":        ["Pro A","BCL"],
  "Cholet":             ["Pro A","BCL"],
  "SIG Strasbourg":     ["Pro A","BCL"],
  "Élan Chalon":        ["Pro A"],

  // ────────────────────────────────────────────────────────────────────────
  // ESPAGNE - ACB
  // ────────────────────────────────────────────────────────────────────────
  "Real Madrid":               ["ACB","EuroLeague"],
  "FC Barcelona":              ["ACB","EuroLeague"],
  "Kosner Baskonia":           ["ACB","EuroLeague"],
  "Valencia Basket":           ["ACB","EuroLeague"],
  "Unicaja":                   ["ACB","BCL"],
  "Joventut Badalona":          ["ACB","BCL"],
  "UCAM Murcia":               ["ACB","BCL"],
  "Surne Bilbao":              ["ACB","BCL"],
  "Lenovo Tenerife":            ["ACB","EuroCup"],
  "BAXI Manresa":              ["ACB","EuroCup"],
  "Siblo San Pablo Burgos":     ["ACB","EuroCup"],

  // ────────────────────────────────────────────────────────────────────────
  // ITALIE - Lega Basket Serie A
  // ────────────────────────────────────────────────────────────────────────
  "Olimpia Milano":            ["Lega","EuroLeague"],
  "EA7 Olimpia Milano":        ["Lega","EuroLeague"],
  "Virtus Olidata Bologna":    ["Lega","EuroLeague"],
  "Virtus Bologna":            ["Lega","EuroLeague"],
  "Dolomiti Energia Trento":   ["Lega","EuroCup"],
  "Umana Reyer Venezia":       ["Lega","EuroCup"],
  "Baglietto Derthona":        ["Lega","EuroCup"],
  "Napoli Basketball":         ["Lega","EuroCup"],
  "Roma Basketball":           ["Lega","EuroCup"],
  "Pallacanestro Varese":       ["Lega","BCL"],
  "Pallacanestro Reggiana":    ["Lega","BCL"],

  // ────────────────────────────────────────────────────────────────────────
  // ALLEMAGNE - Bundesliga
  // ────────────────────────────────────────────────────────────────────────
  "Bayern München":            ["Bundesliga","EuroLeague"],
  "FC Bayern Munich":          ["Bundesliga","EuroLeague"],
  "Alba Berlin":               ["Bundesliga","BCL"],
  "Telekom Baskets Bonn":      ["Bundesliga","BCL"],
  "BMA365 Bamberg":            ["Bundesliga","BCL"],
  "Skyliners Frankfurt":       ["Bundesliga","EuroCup"],
  "NINERS Chemnitz":           ["Bundesliga","EuroCup"],
  "ratiopharm Ulm":            ["Bundesliga","EuroCup"],
  "Rostock Seawolves":         ["Bundesliga","EuroCup"],
  "Fitness First Würzburg Baskets":["Bundesliga","BCL"],
  "Rasta Vechta":              ["Bundesliga","BCL"],
  "MHP Riesen Ludwigsburg":    ["Bundesliga"],
  "MLP Academics Heidelberg":  ["Bundesliga"],
  "Hamburg Towers":            ["Bundesliga"],

  // ────────────────────────────────────────────────────────────────────────
  // TURQUIE - BSL (Turkish Basketball Super League)
  // ────────────────────────────────────────────────────────────────────────
  "Fenerbahçe Tarfin":         ["BSL","EuroLeague"],
  "Fenerbahce":                ["BSL","EuroLeague"],
  "Anadolu Efes":              ["BSL","EuroLeague"],
  "Beşiktaş Gain":             ["BSL","EuroLeague"],
  "Besiktas":                  ["BSL","EuroLeague"],
  "Türk Telekom":              ["BSL","EuroCup"],
  "Bahçeşehir Koleji":         ["BSL","EuroCup"],
  "Trabzonspor":               ["BSL","BCL"],
  "Galatasaray MCT":           ["BSL","BCL"],
  "Galatasaray":               ["BSL","BCL"],

  // ────────────────────────────────────────────────────────────────────────
  // GRÈCE - HEBA (Greek Basketball League)
  // ────────────────────────────────────────────────────────────────────────
  "Olympiacos":                ["HEBA","EuroLeague"],
  "Panathinaikos AKTOR":       ["HEBA","EuroLeague"],
  "Panathinaikos":             ["HEBA","EuroLeague"],
  "Aris Thessaloniki":         ["HEBA","EuroCup"],
  "PAOK":                      ["HEBA","EuroCup"],
  "Peristeri Betsson":         ["HEBA","BCL"],
  "Peristeri":                 ["HEBA","BCL"],
  "AEK":                       ["HEBA","BCL"],

  // ────────────────────────────────────────────────────────────────────────
  // SERBIE - KLS (Košarkaška liga Srbije)
  // ────────────────────────────────────────────────────────────────────────
  "Partizan Mozzart Bet":      ["KLS","EuroLeague"],
  "Partizan":                  ["KLS","EuroLeague"],
  "Crvena zvezda Meridianbet": ["KLS","EuroLeague"],
  "Crvena zvezda":             ["KLS","EuroLeague"],
  "Spartak Office Shoes":      ["KLS","BCL"],

  // ────────────────────────────────────────────────────────────────────────
  // ISRAËL - Premier League (Israeli Premier League)
  // ────────────────────────────────────────────────────────────────────────
  "Maccabi Rapyd Tel Aviv":    ["IPL","EuroLeague"],
  "Maccabi Tel Aviv":          ["IPL","EuroLeague"],
  "Hapoel IBI Tel Aviv":       ["IPL","EuroLeague"],
  "Hapoel Tel Aviv":           ["IPL","EuroLeague"],
  "Hapoel Midtown Jerusalem":  ["IPL","EuroCup"],
  "Hapoel Netanel Holon":      ["IPL","BCL"],
  "Bnei Penlink Herzliya":     ["IPL","BCL"],

  // ────────────────────────────────────────────────────────────────────────
  // LITUANIE - LKL (Lietuvos krepšinio lyga)
  // ────────────────────────────────────────────────────────────────────────
  "Žalgiris":                  ["LKL","EuroLeague"],
  "Zalgiris Kaunas":           ["LKL","EuroLeague"],
  "Lietkabelis Panevezys":     ["LKL","EuroCup"],
  "Neptūnas Klaipeda":         ["LKL","EuroCup"],
  "Rytas Vilnius":             ["LKL","BCL"],
  "Juventus Utena":            ["LKL","BCL"],
  "Šiauliai":                  ["LKL","EuroCup"],

  // ────────────────────────────────────────────────────────────────────────
  // SLOVÉNIE - Liga Nova KBM
  // ────────────────────────────────────────────────────────────────────────
  "Cedevita Olimpija":         ["Liga Nova KBM","EuroCup"],

  // ────────────────────────────────────────────────────────────────────────
  // BOSNIE - BiH Liga
  // ────────────────────────────────────────────────────────────────────────
  "Bosna BH Telecom":          ["BiH Liga","EuroCup"],
  "Igokea m:tel":              ["BiH Liga","BCL"],

  // ────────────────────────────────────────────────────────────────────────
  // BULGARIE
  // ────────────────────────────────────────────────────────────────────────
  "Balkan Botevgrad":          ["NBL Bulgaria","EuroCup"],

  // ────────────────────────────────────────────────────────────────────────
  // CROATIE
  // ────────────────────────────────────────────────────────────────────────
  "Cibona":                    ["HT Premijer liga","BCL"],

  // ────────────────────────────────────────────────────────────────────────
  // ROUMANIE
  // ────────────────────────────────────────────────────────────────────────
  "U-BT Cluj-Napoca":          ["LNBM Romania","EuroCup"],

  // ────────────────────────────────────────────────────────────────────────
  // LETTONIE
  // ────────────────────────────────────────────────────────────────────────
  "Rīgas Zeļļi":               ["LBL Latvia","EuroCup"],

  // ────────────────────────────────────────────────────────────────────────
  // POLOGNE
  // ────────────────────────────────────────────────────────────────────────
  "Śląsk Wrocław":             ["PLK Poland","EuroCup"],
  "Legia Warszawa":            ["PLK Poland","BCL"],

  // ────────────────────────────────────────────────────────────────────────
  // REPUBLIQUE TCHÈQUE
  // ────────────────────────────────────────────────────────────────────────
  "Slavia Prague ERA NBK":     ["NBL Czech","BCL"],
  "KVIS Pardubice":            ["NBL Czech","BCL"],

  // ────────────────────────────────────────────────────────────────────────
  // BELGIQUE
  // ────────────────────────────────────────────────────────────────────────
  "Windrose Giants Antwerp":   ["EBL Belgium","BCL"],

  // ────────────────────────────────────────────────────────────────────────
  // PORTUGAL
  // ────────────────────────────────────────────────────────────────────────
  "FC Porto":                  ["LPB Portugal","BCL"],

  // ────────────────────────────────────────────────────────────────────────
  // HONGRIE
  // ────────────────────────────────────────────────────────────────────────
  "Falco KC Szombathely":      ["Nemzeti Liga Hungary","BCL"],

  // ────────────────────────────────────────────────────────────────────────
  // AZERBAÏDJAN
  // ────────────────────────────────────────────────────────────────────────
  "Sabah BC":                  ["ABSL Azerbaijan","BCL"],

  // ────────────────────────────────────────────────────────────────────────
  // REPUBLIQUE TCHÈQUE / SLOVAQUIE
  // ────────────────────────────────────────────────────────────────────────
  "ERA Nymburk":               ["NBL Czech","BCL"],

  // ────────────────────────────────────────────────────────────────────────
  // ROYAUME-UNI
  // ────────────────────────────────────────────────────────────────────────
  "London Lions":              ["BBL UK","EuroCup"],

  // ────────────────────────────────────────────────────────────────────────
  // ÉMIRATS ARABES UNIS
  // ────────────────────────────────────────────────────────────────────────
  "Dubai Basketball":          ["EuroLeague"],   // franchise EuroLeague pure, pas de championnat national

  // ────────────────────────────────────────────────────────────────────────
  // DIVERS EuroCup sans ligue nationale dans l'app
  // ────────────────────────────────────────────────────────────────────────
  "Tofaş":                     ["BSL","EuroCup"],
  "Maxima Roma":               ["Lega","EuroCup"],
  "BC Roma SPQR":              ["Lega"],
  "Nutribullet Treviso":       ["Lega"],
  "APU Udine":                 ["Lega"],
  "Acqua San Bernardo Cantu":  ["Lega"],
  "Givova Scafati":            ["Lega"],
  "Tezenis Verona":            ["Lega"],
  "Pallacanestro Trieste":     ["Lega"],
};


const NBA_TEAMS=["Atlanta Hawks","Boston Celtics","Brooklyn Nets","Charlotte Hornets","Chicago Bulls","Cleveland Cavaliers","Dallas Mavericks","Denver Nuggets","Detroit Pistons","Golden State Warriors","Houston Rockets","Indiana Pacers","LA Clippers","Los Angeles Lakers","Memphis Grizzlies","Miami Heat","Milwaukee Bucks","Minnesota Timberwolves","New Orleans Pelicans","New York Knicks","Oklahoma City Thunder","Orlando Magic","Philadelphia 76ers","Phoenix Suns","Portland Trail Blazers","Sacramento Kings","San Antonio Spurs","Toronto Raptors","Utah Jazz","Washington Wizards"];

// Map ligue → liste d'équipes pour le formulaire d'ajout joueur
const ALL_LEAGUE_TEAMS={
  "NBA": NBA_TEAMS,
  ...EURO_TEAMS,
};

// ── Set global de toutes les équipes connues ──────────────────────────────────
// Source de vérité unique : si bet.player est dans ce set → pari équipe
const ALL_TEAMS_SET=new Set(
  Object.values(ALL_LEAGUE_TEAMS).flat()
);
// Inclure aussi les noms depuis les logos (couvre NBA + EuroLeague + autres)
[...Object.keys(TEAM_LOGOS),...Object.keys(EL_TEAM_LOGOS),...Object.keys(NBA_TEAM_LOGOS)].forEach(t=>ALL_TEAMS_SET.add(t));

function checkIsTeamBet(b){
  if(!b)return false;
  // 1. Flag explicite posé au moment de la saisie
  if(b.tbConfirmed)return true;
  // 2. Description typique des paris équipe
  if(b.description&&(
    b.description.startsWith("Victoire ")||
    b.description.startsWith("Champion ")||
    b.description.startsWith("Vainqueur ")
  ))return true;
  // 3. Player est une équipe connue (source de vérité principale)
  if(b.player&&ALL_TEAMS_SET.has(b.player))return true;
  // 4. Description = "NomEquipe +/-X.X" (handicap équipe)
  if(b.description&&/^[A-Z].+[+-]\d+\.?\d+$/.test(b.description))return true;
  return false;
}


// ── Helper : coller image depuis presse-papier → Supabase ────────────────────
async function pasteImageToSupabase(name){
  const items=await navigator.clipboard.read();
  let blob=null;
  for(const item of items){
    const t=item.types.find(x=>x.startsWith("image/"));
    if(t){blob=await item.getType(t);break;}
  }
  if(!blob)throw new Error("Aucune image dans le presse-papier");
  const ext=blob.type.includes("png")?"png":blob.type.includes("webp")?"webp":"jpg";
  const safe=(name||"img").toLowerCase().replace(/[^a-z0-9]/g,"_").slice(0,40);
  const path="photos/players/"+safe+"_"+Date.now()+"."+ext;
  const res=await fetch(SUPA_URL+"/storage/v1/object/avatars/"+path,{
    method:"POST",
    headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":blob.type,"x-upsert":"true"},
    body:blob,
  });
  if(!res.ok){const e=await res.text();throw new Error(e);}
  return SUPA_URL+"/storage/v1/object/public/avatars/"+path;
}

// ── Helper Supabase pour données secondaires (components) ────────────────────
// Chaque composant appelle supaSettingsSave(id, data) pour persister dans Supabase
// et supaSettingsLoad(id) pour récupérer
async function supaSettingsLoad(rowId){
  if(!SUPA_URL||!SUPA_KEY)return null;
  try{
    const r=await fetch(SUPA_URL+"/rest/v1/bets?id=eq."+encodeURIComponent(rowId)+"&select=description",{headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY}});
    const d=await r.json();
    if(d&&d[0]&&d[0].description)return JSON.parse(d[0].description);
  }catch(e){}
  return null;
}
function supaSettingsSave(rowId,data){
  if(!SUPA_URL||!SUPA_KEY)return;
  try{
    const row={id:rowId,player:"__SETTINGS_COMP__",description:JSON.stringify(data),odds:1,stake:0,bookmaker:"",status:"pending",game:"",league:"",role:"",team:"",datetime:"",isHeadshot:false,isLive:false,mapTag:"",profit:0,tournament:"",ppMapType:null,ppLine:null,ppEdge:null,updatedAt:Date.now(),splits:null};
    fetch(SUPA_URL+"/rest/v1/bets",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Prefer":"resolution=merge-duplicates"},body:JSON.stringify(row)}).catch(()=>{});
  }catch(e){}
}

const STATUS_CFG={
  pending:{label:"En attente",color:"#3B82F6",bg:"rgba(96,165,250,0.1)"},
  won:{label:"Gagné",color:"#00E676",bg:"rgba(34,197,94,0.1)"},
  lost:{label:"Perdu",color:"#EF4444",bg:"rgba(248,113,113,0.1)"},
};
const EMPTY_FORM=()=>({player:"",overUnder:"",description:"",odds:"",stake:"",bookmaker:"",status:"pending",autoInfo:null,datetime:nowDT(),isHeadshot:false,mapTag:"Match",isLive:false,mapLocked:false,ppMapType:"",ppDescription:"",calcBkLine:"",calcPPLine:"",calcMapType:"Match",calcOU:"Over",announceOuts:[],selCat:null,betType:null});
const EMPTY_MAP_ROW={odds:"",stake:"",status:"pending",enabled:true};

function toDateKey(dt){
  if(!dt)return "";
  try{const s=String(dt).slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:"";}
  catch{return "";}
}
function nowDT(){
  const p=v=>String(v).padStart(2,"0");
  try{
    // Essayer avec le fuseau horaire de l'appareil (le plus fiable sur iOS)
    const now=new Date();
    return now.getFullYear()+"-"+p(now.getMonth()+1)+"-"+p(now.getDate())+"T"+p(now.getHours())+":"+p(now.getMinutes());
  }catch(e){
    const now=new Date();
    return now.getFullYear()+"-"+p(now.getMonth()+1)+"-"+p(now.getDate())+"T"+p(now.getHours())+":"+p(now.getMinutes());
  }
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


// ── NumPad ────────────────────────────────────────────────────────────────
function NumPad({value,onChange,placeholder,step,id}){
  const isDecimal=step==="0.01"||step==="0.5"||step==="1"; // all fields allow decimals
  return(
    <div style={{position:"relative"}}><input
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
          // Convert shorthand odds only (e.g. 175 → 1.75) - NOT for stake fields (step="1")
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

// ── PlayerAC ──────────────────────────────────────────────────────────────
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
    <div ref={ref} style={{position:"relative"}}><div style={{position:"relative"}}><input ref={inputRef} className="add-ifield" placeholder="ex: LeBron, Wembanyama..." value={inputVal} autoComplete="off"
          onChange={handleChange} onFocus={()=>{setRecents(getRecentPlayers());setOpen(true);}}
          style={{paddingRight:isConfirmed?42:14,height:48,background:"transparent",border:"none",outline:"none",borderRadius:0,boxShadow:"none"}}/>
        {isConfirmed&&(
          <div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",justifyContent:"center",width:24,height:24,background:"rgba(34,197,94,0.15)",borderRadius:"50%",border:"1.5px solid #00E676",pointerEvents:"none"}}><span style={{color:"#00E676",fontSize:14,lineHeight:1}}>✓</span></div>
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
                {/* Photo joueur */}
                <div style={{width:34,height:34,borderRadius:8,overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {p.photo_url
                    ?<img src={optimizePhotoUrl(p.photo_url)} loading="lazy" style={{width:36,height:36,objectFit:"cover",objectPosition:"50% 15%"}} alt={key} onError={e=>{e.target.style.display="none";}}/>
                    :<span style={{fontSize:14,fontWeight:700,color:"#6B7280"}}>{key[0].toUpperCase()}</span>
                  }
                </div>
                <div style={{flex:1,minWidth:0}}><span style={{fontWeight:700,fontSize:14,color:"#E5E7EB"}}>{key.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}</span><div style={{fontSize:11,color:"#6B7280",marginTop:1,display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                    {p.team&&(()=>{const tl=TEAM_LOGOS[p.team]||EL_TEAM_LOGOS[p.team]||NBA_TEAM_LOGOS[p.team];return(<><span style={{display:"inline-flex",alignItems:"center",gap:3,color:"#9CA3AF"}}>{tl&&<img src={tl} style={{width:13,height:13,objectFit:"contain"}} alt=""/>}{p.team}</span></>);})()}
                    {tag==="recent"&&<span style={{color:"#4B5563"}}>· récent</span>}
                    {freq>1&&<span style={{color:"#A78BFA"}}>· {freq}p</span>}
                  </div></div>
                {(()=>{
                  const t=activeTourneys[p.game];
                  const hasTourney=t&&(!t.end||new Date(t.end)>=new Date());
                  return(
                    <div style={{display:"flex",gap:4,alignItems:"center"}}>
                      {p.game==="NBA"
                        ?<img src={NBA_LEAGUE_LOGO} style={{width:20,height:20,objectFit:"contain"}} onError={e=>e.target.style.display="none"} alt="NBA"/>
                        :<span style={{fontSize:9,fontWeight:700,color:"#A78BFA",background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.2)",padding:"1px 5px",borderRadius:4}}>{p.game}</span>
                      }
                      {(getPlayerPosition(p)||p.role)&&<PositionLogo role={getPlayerPosition(p)||p.role} size={14}/>}
                      {isSelected&&<span style={{color:"#00E676",fontSize:14,fontWeight:700,marginLeft:2}}>✓</span>}
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




// ── PlayerSearchPanel ──────────────────────────────────────────────────────
function PlayerSearchPanel({allPlayers,custom,setPlayers,setEditingPlayer,blacklist,toggleBlacklist,onSaveBulk}){
  const [pSearch,setPSearch]=useState("");
  const filtered=useMemo(function(){
    const q=pSearch.toLowerCase().trim();
    if(!q)return[];
    return Object.entries(allPlayers).filter(([k])=>k.includes(q)).slice(0,20);
  },[allPlayers,pSearch]);
  return(
    <div style={{marginBottom:12}}><div style={{position:"relative",marginBottom:8}}><input style={{width:"100%",background:"#111827",border:"1.5px solid #1F2937",borderRadius:12,padding:"12px 44px 12px 16px",color:"#E5E7EB",fontSize:14,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"}}
          placeholder="🔍  ex: LeBron, Wembanyama..." value={pSearch} onChange={e=>setPSearch(e.target.value)}/>
        {pSearch&&<button onClick={()=>setPSearch("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#6B7280",cursor:"pointer",fontSize:16}}>×</button>}
      </div>
      {filtered.length>0&&(
        <div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:14,overflow:"hidden",marginBottom:8}}>
          {filtered.map(([key,p])=>{
            const isCustom=!!custom[key];
            return(
              <div key={key} style={{display:"flex",alignItems:"center",gap:9,padding:"11px 14px",borderBottom:"1px solid #1F2937"}}><GameLogo game={p.game} size={18}/><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontWeight:700,fontSize:14,color:"#E5E7EB",textTransform:"capitalize"}}>{key}</span>
                    {isCustom&&<span style={{fontSize:9,color:"#00E676",background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.2)",padding:"1px 5px",borderRadius:4,fontWeight:700}}>MODIFIÉ</span>}
                  </div><div style={{fontSize:10,color:"#9CA3AF"}}>{p.team} · {p.role}{p.league?" · "+p.league:""}</div></div><div style={{display:"flex",gap:5,flexShrink:0}}><button onClick={()=>setEditingPlayer({key,data:{...p,name:key}})}
                    style={{background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:8,padding:"5px 10px",color:"#3B82F6",cursor:"pointer",fontSize:11,fontFamily:"Inter,sans-serif",fontWeight:600}}>
                    ✎ Éd.
                  </button>
                  {isCustom&&<button onClick={()=>{if(players[key]&&players[key].id){supaDeletePlayer(players[key].id).catch(function(){});}setPlayers(p=>{const n={...p};delete n[key];return n;});}}
                    style={{background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:8,padding:"5px 10px",color:"#EF4444",cursor:"pointer",fontSize:11}}>
                    ×
                  </button>}
                  {!isCustom&&<button onClick={()=>toggleBlacklist(key)}
                    style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:8,padding:"5px 10px",color:"#EF4444",cursor:"pointer",fontSize:11}}
                    title="Masquer ce joueur de la liste">
                    🙈
                  </button>}
                  <button onClick={()=>{if(window.confirm("Supprimer "+key+" ?"))toggleBlacklist(key);}}
                    style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:8,padding:"5px 8px",color:"#EF4444",cursor:"pointer",fontSize:10}}>
                    🗑
                  </button></div></div>
            );
          })}
        </div>
      )}
      {pSearch&&filtered.length===0&&<div style={{fontSize:12,color:"#6B7280",padding:"10px 0",textAlign:"center"}}>Aucun résultat pour "{pSearch}"</div>}


    </div>
  );
}

// ── EditBetModal component ─────────────────────────────────────────────────
const EditBetModal=memo(function EditBetModal({bet,bookmakers,onSave,onClose,calcProfit,allPlayers,activeTourneys={},savedTourneys={}}){
  const ebGame=bet.game||"NBA";
  const ebIs3Pts=bet.isHeadshot;
  // Build kills options
  let ebOpts=[];
  if(ebIs3Pts) ebOpts=Array.from({length:15},(_,i)=>(i+0.5).toFixed(1)+" 3 Pts");
  
  
  
  else ebOpts=Array.from({length:40},(_,i)=>(i+0.5).toFixed(1)+" Points");
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
      updatedAt:now,  // ← crucial : marque ce pari comme plus récent que Supabase
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
    <div className="moverlay" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"88vh",overflowY:"auto"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div><div style={{fontSize:15,fontWeight:700,color:"#E5E7EB"}}>✎ Modifier le pari</div><div style={{fontSize:10,color:"#6B7280",marginTop:2}}>{bet.player} · {ebGame}</div></div><button onClick={onClose} style={{background:"transparent",border:"none",color:"#6B7280",fontSize:20,cursor:"pointer",lineHeight:1,padding:"0 4px"}}>×</button></div>

        {/* Bookmaker */}
        <div style={{marginBottom:12}}><span style={labelStyle}>Bookmaker</span><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {bookmakers.map(bk=>(
              <button key={bk} onClick={()=>setEbBK(bk)}
                style={{padding:"7px 12px",borderRadius:8,border:"1.5px solid "+(ebBK===bk?"#7C3AED":"#1F2937"),background:ebBK===bk?"rgba(124,58,237,0.15)":"transparent",color:ebBK===bk?"#A78BFA":"#6B7280",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                {bk}
              </button>
            ))}
          </div></div>

        {/* Joueur */}
        <div style={{marginBottom:12}}><span style={labelStyle}>Joueur</span><div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:10,position:"relative",zIndex:300}}><PlayerAC value={ebPlayer} onChange={v=>setEbPlayer(v)} allPlayers={allPlayers} onConfirm={()=>{}}/></div></div>

        {/* Over / Under */}
        <div style={{marginBottom:12}}><span style={labelStyle}>Over / Under</span><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {["Over","Under"].map(ou=>(
              <button key={ou} onClick={()=>setEbOU(ou)}
                style={{padding:"11px 0",borderRadius:10,border:"1.5px solid "+(ebOU===ou?(ou==="Over"?"#00E676":"#EF4444"):"#1F2937"),background:ebOU===ou?(ou==="Over"?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)"):"transparent",color:ebOU===ou?(ou==="Over"?"#00E676":"#EF4444"):"#6B7280",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                {ou}
              </button>
            ))}
          </div></div>

        {/* Kills */}
        <div style={{marginBottom:12}}><span style={labelStyle}>Ligne ({ebIs3Pts?"3 Pts":"Points"})</span><select value={ebLine} onChange={e=>setEbLine(e.target.value)}
            style={{...fieldStyle,appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}><option value="" style={{background:"#111827"}}>Choisir une ligne...</option>
            {ebOpts.map(o=><option key={o} value={o} style={{background:"#111827"}}>{o}</option>)}
          </select></div>

        {/* Cote + Mise */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><div><span style={labelStyle}>Cote</span><NumPad value={ebOdds} onChange={v=>setEbOdds(v)} placeholder="1.75" step="0.01"/></div><div><span style={labelStyle}>Mise ($)</span><NumPad value={ebStake} onChange={v=>setEbStake(v)} placeholder="50" step="1"/></div></div>

        {/* Gain potentiel */}
        {ebOdds&&ebStake&&(
          <div style={{textAlign:"center",marginBottom:12,padding:"8px",background:"rgba(34,197,94,0.06)",borderRadius:8,border:"1px solid rgba(34,197,94,0.15)"}}><span style={{fontSize:12,color:"#6B7280"}}>Gain potentiel : </span><span style={{fontSize:14,fontWeight:700,color:"#00E676"}}>+{(parseFloat(ebStake||0)*(parseFloat(ebOdds||1)-1)).toFixed(2)}$</span></div>
        )}

        {/* Map */}
        <div style={{marginBottom:16}}><span style={labelStyle}>Map</span><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {["Q1","Q2","Q3","Q4","H1","H2","Match"].map(m=>(
              <button key={m} onClick={()=>setEbMap(m)}
                style={{padding:"7px 12px",borderRadius:8,border:"1.5px solid "+(ebMap===m?"#F59E0B":"#1F2937"),background:ebMap===m?"rgba(245,158,11,0.1)":"transparent",color:ebMap===m?"#F59E0B":"#6B7280",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                {m}
              </button>
            ))}
          </div></div>

        {/* Tournoi */}
        <div style={{marginBottom:12}}><span style={labelStyle}>Tournoi</span>
          {ebTourneyOptions.length>0?(
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:ebTourneyOptions.length>0?6:0}}><button onClick={()=>setEbTournament("")}
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
        <div style={{marginBottom:12}}><span style={labelStyle}>Date & heure</span><input
            type="datetime-local"
            value={ebDatetime}
            onChange={e=>setEbDatetime(e.target.value)}
            style={{...fieldStyle,colorScheme:"dark",fontSize:13}}
          /></div>

        {/* Live toggle */}
        <div style={{marginBottom:16}}><button onClick={()=>setEbLive(v=>!v)}
            style={{width:"100%",padding:"11px",borderRadius:10,border:"1.5px solid "+(ebLive?"#EF4444":"#1F2937"),background:ebLive?"rgba(239,68,68,0.1)":"transparent",color:ebLive?"#EF4444":"#6B7280",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}><span style={{width:8,height:8,borderRadius:"50%",background:ebLive?"#EF4444":"#374151",boxShadow:ebLive?"0 0 6px rgba(239,68,68,0.8)":"none"}}/>
            {ebLive?"🔴 LIVE - Pari en direct":"LIVE - Pari prématch"}
          </button></div>

        {/* Boutons */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button onClick={onClose}
            style={{padding:"13px",background:"#1F2937",border:"none",borderRadius:10,color:"#94A3B8",fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:14}}>
            Annuler
          </button><button onClick={save}
            style={{padding:"13px",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:14}}>
            ✓ Sauvegarder
          </button></div></div></div>
  );
});

// ── BetRow component ───────────────────────────────────────────────────────
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
// ── Normalize role to canonical short form ──────────────────────────────────
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


// ── effectiveTournament: league counts as tournament for LoL/Valorant ────────
function effectiveTournament(b,allPlayers){
  if(b.tournament)return b.tournament;
  // For LoL/Valorant: use league from bet, or from player data
  if(true){ // basket: all games use league as tournament
    if(b.league)return b.league;
    // Try to get league from allPlayers
    if(allPlayers&&b.player){
      var pi=allPlayers[(b.player||"").toLowerCase().trim()];
      if(pi&&pi.league)return pi.league;
    }
  }
  return null;
}


// ── LeagueLogo component ────────────────────────────────────────────────────
function LeagueLogo({league,size=18}){
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
  if(!src)return <span style={{fontSize:size*0.65,color:"#4a5a6e",fontWeight:700,lineHeight:1}}>{league.slice(0,3).toUpperCase()}</span>;
  return <img src={src} alt={league} style={{width:size,height:size,objectFit:"contain",verticalAlign:"middle",borderRadius:2}}/>;
}

const BetRow=memo(function BetRow({bet,onStatus,onDelete,onDuplicate,onEdit,onSplit,bkPhotos=EMPTY_OBJ,onSave,allTourneys=[],savedTourneys={},allPlayers={}}){
  const [open,setOpen]=useState(false);
  const [confirmDel,setConfirmDel]=useState(false);
  const [clvOpen,setClvOpen]=useState(false);
  const [clvCut,setClvCut]=useState(bet.clvCutLine?String(bet.clvCutLine):"");
  const [clvOdds,setClvOdds]=useState(bet.clvCutOdds?String(bet.clvCutOdds):"");
  const sc=STATUS_CFG[bet.status]||{color:"#3B82F6",label:bet.status};
  const isPending=bet.status==="pending";
  const isWon=bet.status==="won";
  const isLost=bet.status==="lost";
  const profitColor=isPending?"#ffffff":isWon?"#00E676":"#EF4444";
  const profitTxt=isPending?"En cours":((bet.profit||0)>=0?"+":" ")+(bet.profit||0).toFixed(2)+"$";
  const bkLogo=BK_LOGOS[bet.bookmaker]||bkPhotos[bet.bookmaker]||null;
  const descLine=bet.description||"";
  const hasAnnounce=bet.announceOuts&&bet.announceOuts.length>0;
  const glowStyle=!isPending&&(isWon?"0 0 10px rgba(34,197,94,.18)":"0 0 8px rgba(239,68,68,.14)");

  const clvValue=(()=>{
    if(!clvCut||!clvOdds||!bet.odds)return null;
    const betOddsV=parseFloat(bet.odds);
    const cutOddsV=parseFloat(clvOdds);
    if(isNaN(betOddsV)||isNaN(cutOddsV)||cutOddsV<=1)return null;
    const betProb=1/betOddsV;
    const cutProb=1/cutOddsV;
    return ((betProb-cutProb)/cutProb*100).toFixed(1);
  })();

  const teamLogoSrc=(()=>{
    const pData=allPlayers[(bet.player||"").toLowerCase().trim()];
    const team=(pData&&pData.team)||bet.team;
    if(!team)return null;
    return TEAM_LOGOS[team]||EL_TEAM_LOGOS[team]||NBA_TEAM_LOGOS[team]||null;
  })();

  // Détecter type de pari équipe
  const isTeamBet=checkIsTeamBet(bet);
  const isLongTerme=!!(bet.description&&(bet.description.startsWith("Champion ")||bet.description.startsWith("Vainqueur ")));

  // Pour victoire/longterm : logo de l'équipe bet.player (c'est le nom du club)
  const teamBetLogo=(()=>{
    if(!isTeamBet) return null;
    const rawTeam=bet.player||bet.team||"";
    // Essayer le nom exact d'abord
    const direct=TEAM_LOGOS[rawTeam]||EL_TEAM_LOGOS[rawTeam]||NBA_TEAM_LOGOS[rawTeam]||null;
    if(direct)return direct;
    // Essayer sans le préfixe "Victoire " ou "Vainqueur "
    const cleanTeam=rawTeam.replace(/^(Victoire |Vainqueur |Champion )/,"").trim();
    const clean=TEAM_LOGOS[cleanTeam]||EL_TEAM_LOGOS[cleanTeam]||NBA_TEAM_LOGOS[cleanTeam]||null;
    if(clean)return clean;
    // Essayer avec les alias (Olympiakos → Olympiacos, etc.)
    const ALIASES={"Olympiakos":"Olympiacos","Olympiacos Piraeus":"Olympiacos","Panathinaikos":"Panathinaikos AKTOR","Panathinaikos Athens":"Panathinaikos AKTOR","Panathinaikos AKTOR Athens":"Panathinaikos AKTOR","Fenerbahce":"Fenerbahçe Tarfin","Fenerbahce Beko":"Fenerbahçe Tarfin","Anadolu Efes":"Anadolu Efes Istanbul","Zalgiris":"Žalgiris","Zalgiris Kaunas":"Žalgiris","Armani Olimpia Milan":"Olimpia Milano","EA7 Olimpia Milano":"Olimpia Milano","Virtus Bologna":"Virtus Olidata Bologna","Bayern Munich":"Bayern München","FC Bayern Munich":"Bayern München","Baskonia":"Kosner Baskonia","ASVEL":"LDLC ASVEL","Real Madrid":"Real Madrid","Barcelona":"FC Barcelona","Fenerbahce Istanbul":"Fenerbahçe Tarfin","Partizan":"Partizan Mozzart Bet","Red Star Belgrade":"Crvena zvezda Meridianbet","Maccabi Tel Aviv":"Maccabi Rapyd Tel Aviv"};
    const aliasTeam=ALIASES[rawTeam]||ALIASES[cleanTeam];
    if(aliasTeam)return TEAM_LOGOS[aliasTeam]||EL_TEAM_LOGOS[aliasTeam]||NBA_TEAM_LOGOS[aliasTeam]||null;
    // Recherche partielle insensible à la casse
    const lc=cleanTeam.toLowerCase();
    for(const map of[TEAM_LOGOS,EL_TEAM_LOGOS,NBA_TEAM_LOGOS]){
      const found=Object.keys(map).find(k=>k.toLowerCase()===lc||k.toLowerCase().includes(lc)||lc.includes(k.toLowerCase()));
      if(found)return map[found];
    }
    return null;
  })();

  const logoSrc=isTeamBet?(teamBetLogo||teamLogoSrc):teamLogoSrc;

  return(
    <div style={{borderBottom:"1px solid rgba(255,255,255,.1)",WebkitTapHighlightColor:"transparent",contain:"layout style",borderLeft:"2.5px solid "+(isPending?"#60a5fa":isWon?"#00E676":"#f43f5e"),background:"transparent",position:"relative",transition:"all .15s"}}><div onClick={()=>setOpen(v=>!v)} style={{padding:"11px 13px 11px 12px",cursor:"pointer",userSelect:"none",WebkitUserSelect:"none"}}><div style={{display:"flex",alignItems:"center",gap:11}}>

          {/* Logo équipe avec filigrane derrière */}
          <div style={{width:37,height:37,borderRadius:9,overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
            {logoSrc&&(
              <img src={logoSrc} alt="" aria-hidden="true" style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"120%",height:"120%",objectFit:"contain",opacity:.12,pointerEvents:"none",zIndex:0}} onError={e=>e.target.style.display="none"}/>
            )}
            <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",justifyContent:"center",width:"100%",height:"100%"}}>
              {logoSrc
                ? <img src={logoSrc} style={{width:32,height:32,objectFit:"contain"}} alt={bet.team||bet.player} onError={e=>{e.target.style.display="none";}}/>
                : <GameLogo game={bet.game} size={30}/>
              }
            </div>
          </div>

          {/* Centre */}
          <div style={{flex:1,minWidth:0}}>
            {/* Ligne 1 : Nom joueur/club · logo ligue · stat */}
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3,overflow:"hidden"}}>
              <span style={{fontWeight:800,fontSize:14.5,color:"#f0f4ff",letterSpacing:"-.4px",lineHeight:1,flexShrink:0,whiteSpace:"nowrap"}}>
                {(()=>{
                  // Paris équipe : afficher nom club + handicap si applicable
                  if(isTeamBet){
                    const club=bet.player||bet.team||"";
                    const clubName=club.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
                    if(bet.description&&bet.description.includes(" +")&&!bet.description.startsWith("Victoire")&&!bet.description.startsWith("Champion")){
                      // Handicap : extraire "+X.X" ou "-X.X"
                      const m=bet.description.match(/([+-]\d+\.?\d*)/);
                      return m?clubName+" "+m[1]:clubName;
                    }
                    return clubName;
                  }
                  return (bet.player||"").split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
                })()}
              </span>
              <GameLogo game={bet.game} size={16}/>
              {/* Description stat : seulement pour paris joueur, pas équipe */}
              {!isTeamBet&&descLine&&(()=>{
                const parts=descLine.match(/^(\d+\.?\d*)\s*(.*)$/);
                if(parts) return(
                  <span style={{fontSize:12,color:"#8a9eb8",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:1}}>
                    <span style={{fontWeight:800,color:"#c8d8f0",fontSize:13}}>{parts[1]}</span>
                    {parts[2]?" "+parts[2]:""}
                  </span>
                );
                return <span style={{fontSize:12,color:"#8a9eb8",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:1}}>{descLine}</span>;
              })()}
              {/* Long terme : afficher la ligue */}
              {isLongTerme&&(()=>{
                const m=bet.description&&bet.description.match(/—\s*(.+)$/);
                const league=m?m[1]:(bet.game||bet.league||"");
                return league?<span style={{fontSize:11,color:"#a78bfa",fontWeight:700,flexShrink:0,background:"rgba(124,58,237,.12)",borderRadius:4,padding:"1px 5px"}}>Vainqueur {league}</span>:null;
              })()}
              {bet.splits&&bet.splits.length>0&&<span style={{fontSize:8,color:"#00E676",background:"rgba(74,222,128,.1)",border:"1px solid rgba(74,222,128,.2)",borderRadius:4,padding:"1px 5px",fontWeight:700,flexShrink:0}}>{1+bet.splits.length}</span>}
            </div>
            {/* Ligne 2 : @cote • BK logo • mise • logo ligue */}
            <div style={{display:"flex",alignItems:"center",gap:0,flexWrap:"nowrap",overflow:"hidden"}}>
              <span style={{fontSize:12,fontWeight:700,color:"#7a9cbd",letterSpacing:"-.1px",flexShrink:0}}>@{bet.odds}</span>
              {(bkLogo||bet.bookmaker)&&<span style={{color:"#4a5a6e",margin:"0 5px",fontSize:14,lineHeight:1,flexShrink:0}}>•</span>}
              {bkLogo?(<img src={bkLogo} alt={bet.bookmaker} style={{width:13,height:13,objectFit:"contain",flexShrink:0}}/>):bet.bookmaker?(<span style={{fontSize:11,fontWeight:700,color:"#7a9cbd",flexShrink:0}}>{bet.bookmaker}</span>):null}
              {bet.stake&&<><span style={{color:"#4a5a6e",margin:"0 5px",fontSize:14,lineHeight:1,flexShrink:0}}>•</span><span style={{fontSize:12,fontWeight:700,color:"#7a9cbd",flexShrink:0}}>{bet.stake}$</span></>}
              {hasAnnounce&&<><span style={{color:"#4a5a6e",margin:"0 5px",fontSize:14,lineHeight:1,flexShrink:0}}>•</span><span style={{fontSize:8,fontWeight:800,color:"#f97316",background:"rgba(249,115,22,.13)",border:"1px solid rgba(249,115,22,.35)",borderRadius:4,padding:"1px 5px",letterSpacing:.3,flexShrink:0}}>ANNONCE</span></>}
              {bet.tipster&&<><span style={{color:"#4a5a6e",margin:"0 5px",fontSize:14,lineHeight:1,flexShrink:0}}>•</span><span style={{fontSize:11,color:"#a78bfa",fontWeight:600,flexShrink:0}}>{bet.tipster}</span></>}
            </div>
          </div>

          {/* Droite : profit */}
          <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4,minWidth:56}}>
            <div style={{fontWeight:800,fontSize:14,color:profitColor,fontFamily:"Inter,sans-serif",letterSpacing:"-.4px",lineHeight:1,textShadow:isPending?"none":glowStyle||"none"}}>{profitTxt}</div>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{transition:"transform .2s",transform:open?"rotate(180deg)":"none",opacity:.25}}><path d="M2 3.5L5 6.5L8 3.5" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div></div>

      {open&&(
        <div style={{borderTop:"1px solid rgba(255,255,255,.06)",background:"rgba(5,8,18,.6)"}}>

          {/* Date */}
          <div style={{padding:"8px 14px 0"}}>
            <label style={{cursor:"pointer",position:"relative",display:"inline-flex",alignItems:"center"}}>
              <span style={{fontSize:11,color:"#4a5a6e",fontWeight:600,textDecoration:"underline dotted",textDecorationColor:"#3a4a5e"}}>
                {(()=>{const dt=bet.datetime?String(bet.datetime):"";if(!dt||dt.includes("NaN")||!/^\d{4}-\d{2}-\d{2}/.test(dt))return"📅 Date";const mo=parseInt(dt.slice(5,7))-1;const mn=["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"][mo]||"";return dt.slice(8,10)+" "+mn+" "+dt.slice(0,4)+" · "+dt.slice(11,16);})()}
              </span>
              <input type="datetime-local" defaultValue={(bet.datetime&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(bet.datetime)))?String(bet.datetime).slice(0,16):""} onChange={function(e){const newDt=e.target.value;if(!newDt)return;if(onSave)onSave(Object.assign({},bet,{datetime:newDt,updatedAt:Date.now()}));try{const ov=JSON.parse(localStorage.getItem("v7_overrides")||"{}");ov[String(bet.id)]={datetime:newDt,updatedAt:Date.now()};localStorage.setItem("v7_overrides",JSON.stringify(ov));}catch(e2){}}} style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",height:"100%",border:"none",background:"transparent"}}/>
            </label>
          </div>

          {/* CLV */}
          <div style={{margin:"8px 14px 0"}}>
            <button onClick={()=>setClvOpen(v=>!v)} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:8,border:"1px solid rgba(96,165,250,.3)",background:clvOpen?"rgba(96,165,250,.12)":"transparent",color:"#60a5fa",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
              📊 CLV {clvValue!==null&&<span style={{color:parseFloat(clvValue)>=0?"#34d399":"#f87171",marginLeft:3}}>{parseFloat(clvValue)>=0?"+":""}{clvValue}%</span>}
            </button>
            {clvOpen&&(
              <div style={{marginTop:8,padding:"10px 12px",background:"rgba(8,14,28,.9)",borderRadius:10,border:"1px solid rgba(96,165,250,.2)"}}>
                <div style={{fontSize:10,color:"#6B7280",marginBottom:8,fontWeight:600}}>Paris: {bet.overUnder} {bet.description} @{bet.odds}</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                  <div><div style={{fontSize:9,color:"#6B7280",marginBottom:4,fontWeight:700,textTransform:"uppercase"}}>Cut clôture</div>
                    <input type="number" step="0.5" placeholder="ex: 8.5" value={clvCut} onChange={e=>setClvCut(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,padding:"6px 8px",color:"#E5E7EB",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  <div><div style={{fontSize:9,color:"#6B7280",marginBottom:4,fontWeight:700,textTransform:"uppercase"}}>Cote clôture</div>
                    <input type="number" step="0.01" placeholder="ex: 1.70" value={clvOdds} onChange={e=>setClvOdds(e.target.value)} style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:7,padding:"6px 8px",color:"#E5E7EB",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"}}/>
                  </div>
                </div>
                {clvValue!==null&&(
                  <div style={{padding:"8px 10px",borderRadius:8,background:parseFloat(clvValue)>=0?"rgba(52,211,153,.1)":"rgba(248,113,113,.1)",border:"1px solid "+(parseFloat(clvValue)>=0?"rgba(52,211,153,.3)":"rgba(248,113,113,.3)"),display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div><div style={{fontSize:10,color:"#9CA3AF"}}>CLV (edge vs fermeture)</div>
                      <button onClick={()=>{if(onSave)onSave({...bet,clvValue:parseFloat(clvValue),clvCutLine:parseFloat(clvCut),clvCutOdds:parseFloat(clvOdds),updatedAt:Date.now()});}} style={{marginTop:4,padding:"2px 8px",background:"rgba(52,211,153,.15)",border:"1px solid rgba(52,211,153,.3)",borderRadius:5,color:"#34d399",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                        💾 Sauvegarder
                      </button>
                    </div>
                    <div style={{fontSize:20,fontWeight:800,color:parseFloat(clvValue)>=0?"#34d399":"#f87171"}}>{parseFloat(clvValue)>=0?"+":""}{clvValue}%</div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Statut */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,padding:"10px 14px 0"}}>
            <button onClick={()=>{onStatus(bet.id,"won");setOpen(false);}} style={{padding:"13px",borderRadius:12,border:isWon?"none":"1px solid rgba(0,230,118,.2)",background:isWon?"rgba(0,230,118,.18)":"rgba(0,230,118,.05)",color:"#00E676",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>✓ Gagné</button>
            <button onClick={()=>{onStatus(bet.id,"lost");setOpen(false);}} style={{padding:"13px",borderRadius:12,border:isLost?"none":"1px solid rgba(239,68,68,.2)",background:isLost?"rgba(239,68,68,.15)":"rgba(239,68,68,.04)",color:"#f87171",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>✗ Perdu</button>
          </div>
          {!isPending&&(<div style={{padding:"6px 14px 0"}}><button onClick={()=>{onStatus(bet.id,"pending");setOpen(false);}} style={{width:"100%",padding:"9px",borderRadius:10,border:"1px solid rgba(255,255,255,.07)",background:"transparent",color:"#4a5a6e",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>↩ Remettre en attente</button></div>)}

          {/* Actions */}
          <div style={{display:"flex",gap:7,padding:"8px 14px 12px"}}>
            <button onClick={()=>{onEdit(bet);setOpen(false);}} style={{flex:1,padding:"11px 0",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",color:"#9CA3AF",cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600,fontSize:13}}>Modifier</button>
            {!confirmDel
              ?(<button onClick={()=>setConfirmDel(true)} style={{width:44,padding:"11px 0",borderRadius:10,border:"1px solid rgba(239,68,68,.2)",background:"transparent",color:"#5a3030",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:16}}>🗑</button>)
              :(<button onClick={()=>{onDelete(bet.id);}} style={{flex:1,padding:"11px 0",borderRadius:10,border:"none",background:"linear-gradient(135deg,#dc2626,#ef4444)",color:"#fff",cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:700,fontSize:13}}>Confirmer</button>)
            }
          </div>
        </div>
      )}
    </div>
  );
});

// ── BetRowSelectable ───────────────────────────────────────────────────────
const BetRowSelectable=memo(function BetRowSelectable({bet,selected,onToggle,onEdit}){
  const sc=STATUS_CFG[bet.status]||{color:"#3B82F6",label:bet.status};
  return(
    <div className="betrow" style={{background:selected?"rgba(34,197,94,0.04)":"#111827",padding:"11px 13px",borderLeft:selected?"3px solid #00E676":"3px solid transparent"}}><div style={{display:"flex",alignItems:"flex-start",gap:10}}><button onClick={onToggle} style={{width:22,height:22,borderRadius:6,border:"2px solid "+(selected?"#00E676":"#1F2937"),background:selected?"rgba(34,197,94,0.1)":"transparent",cursor:"pointer",flexShrink:0,marginTop:2}}/><div style={{flex:1,minWidth:0}}>
          {/* Date */}
          <div style={{fontSize:10,color:"#9CA3AF",marginBottom:4}}>{fmtDate(bet.datetime)}{bet.bookmaker?" · "+bet.bookmaker:""}</div>
          {/* Player row */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}><div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}><GameLogo game={bet.game} size={18}/><div style={{minWidth:0}}><div style={{fontWeight:700,fontSize:14,color:"#E5E7EB",textTransform:"capitalize"}}>{bet.player}</div><div style={{fontSize:10,color:"#9CA3AF",marginTop:1}}>{bet.description} - @{bet.odds} - {bet.stake}$</div></div></div><div style={{textAlign:"right",flexShrink:0}}><div style={{fontWeight:700,fontSize:13,color:bet.status==="pending"?"#3B82F6":bet.profit>=0?"#00E676":"#EF4444"}}>
                {bet.status==="pending"?"@"+bet.odds:((bet.profit||0)>=0?"+":" ")+(bet.profit||0).toFixed(2)+"$"}
              </div><div style={{fontSize:10,color:sc.color}}>{sc.label}</div></div></div></div><button className="editbtn" onClick={onEdit} style={{flexShrink:0,marginTop:2}}>✎ Modif.</button></div></div>
  );
});

// ── Main App ───────────────────────────────────────────────────────────────
// ── Nav Icons (outside App to avoid recreating on every render) ─────────────
function NavIconHome({active}){
  const c=active?"#A78BFA":"#6B7280";
  return(<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12L12 3l9 9v8a1 1 0 01-1 1H4a1 1 0 01-1-1z" fill={active?"rgba(167,139,250,0.1)":"none"}/><polyline points="9,21 9,12 15,12 15,21"/></svg>);
}
function NavIconParis({active,count}){
  const c=active?"#A78BFA":"#6B7280";
  return(<div style={{position:"relative",display:"inline-flex"}}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" fill={active?"rgba(167,139,250,0.1)":"none"}/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="12" y2="15"/><circle cx="17" cy="17" r="3" fill={active?"#A78BFA":"#6B7280"} stroke="none" opacity={active?1:0.5}/><polyline points="15.5,17 16.5,18 18.5,16" stroke="#0B1220" strokeWidth="1.5" fill="none"/></svg>
    {count>0&&<span style={{position:"absolute",top:-4,right:-6,background:"#3B82F6",color:"#fff",borderRadius:8,fontSize:8,fontWeight:800,padding:"1px 4px",minWidth:14,textAlign:"center",lineHeight:"13px",border:"1.5px solid #0D1526"}}>{count}</span>}
  </div>);
}
function NavIconAnalyse({active}){
  const c=active?"#A78BFA":"#6B7280";
  return(<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="6" fill={active?"rgba(167,139,250,0.1)":"none"}/><line x1="14.5" y1="14.5" x2="20" y2="20"/><line x1="8" y1="10" x2="12" y2="10"/><line x1="10" y1="8" x2="10" y2="12"/></svg>);
}
function NavIconSuivi({active}){
  const c=active?"#A78BFA":"#6B7280";
  return(<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="3" fill={active?"rgba(167,139,250,0.1)":"none"}/><circle cx="5" cy="17" r="2.2" fill={active?"rgba(167,139,250,0.08)":"none"}/><circle cx="19" cy="17" r="2.2" fill={active?"rgba(167,139,250,0.08)":"none"}/><path d="M12 11c-4 0-6 2-6 4"/><path d="M12 11c4 0 6 2 6 4"/></svg>);
}

// ── TipsterIcon - icône SVG "tipster" dans le style du site ──────────────────
function TipsterIcon({size=16,color="#a78bfa",strokeWidth=1.6}){
  return(
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,display:"block"}}>
      {/* Tête */}
      <circle cx="9" cy="7" r="3" fill={color+"18"}/>
      {/* Corps */}
      <path d="M3 21v-1a6 6 0 0 1 6-6h1"/>
      {/* Graphe tendance montante - signal tipster */}
      <polyline points="14,17 17,13 19,15 22,10" strokeWidth={strokeWidth+0.2}/>
      <polyline points="19,10 22,10 22,13" fill="none"/>
    </svg>
  );
}

// ── SelectionModal - sélection multiple + date + tournoi ────────────────────
function SelectionModal({bets,onClose,setBets,supaPushBets,showToast,fmtDay,byDay,monthKeys,byMonth,allByDay,allByMonth,allMonthKeys,bookmakers=[],BK_LOGOS={},bkPhotos={},savedTourneys={},onAfterPush,allPlayers={}}){
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

  // ── One-click: remove PP from ALL live bets ──
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
    try{localStorage.setItem("v7_bets",JSON.stringify(updated));}catch(e){}
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
    showToast(selected.size+" paris : "+parts.join(", ")+" ✓");
    onClose();
  };

  return(
    <div style={{position:"fixed",inset:0,background:"#0B1220",zIndex:200,display:"flex",flexDirection:"column",fontFamily:"Inter,sans-serif",overflow:"hidden"}}><div style={{background:"#0B1220",borderBottom:"1px solid #1F2937",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}><button onClick={onClose} style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:8,width:34,height:34,color:"#9CA3AF",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>←</button><div style={{flex:1,fontSize:15,fontWeight:700,color:"#E5E7EB"}}>{selected.size>0?selected.size+" sélectionné"+(selected.size>1?"s":""):"Sélectionner des paris"}</div>
        {selected.size>0&&<button onClick={()=>setSelected(new Set())} style={{fontSize:11,color:"#6B7280",background:"none",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Tout désélect.</button>}
      </div><div style={{padding:"10px 14px",borderBottom:"1px solid #1F2937",flexShrink:0,background:"#0F1829",display:"flex",flexDirection:"column",gap:8}}>
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
        </div><div><div style={{fontSize:11,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Nouvelle date</div><input type="date" value={newDate} onChange={e=>setNewDate(e.target.value)} style={{width:"100%",background:"#0B1220",border:"1px solid #1F2937",borderRadius:10,padding:"10px 14px",color:"#E5E7EB",fontSize:14,fontFamily:"Inter,sans-serif",outline:"none",colorScheme:"dark",boxSizing:"border-box"}}/></div><div><div style={{fontSize:11,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Ligue</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
            <button onClick={()=>setNewTournament("")} title="Toutes"
              style={{padding:"5px 8px",borderRadius:8,border:"1.5px solid "+(!newTournament?"rgba(167,139,250,.5)":"rgba(255,255,255,.08)"),background:!newTournament?"rgba(124,58,237,.15)":"transparent",color:!newTournament?"#c4b5fd":"#6B7280",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
              Toutes
            </button>
            {["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Bundesliga","Lega","HEBA"].map(g=>{
              const active=newTournament===g;
              return(
                <button key={g} onClick={()=>setNewTournament(active?"":g)} title={g}
                  style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"5px 6px",borderRadius:8,border:"1.5px solid "+(active?"rgba(167,139,250,.5)":"rgba(255,255,255,.08)"),background:active?"rgba(124,58,237,.15)":"transparent",cursor:"pointer",position:"relative"}}>
                  <GameLogo game={g} size={20}/>
                  {active&&<span style={{position:"absolute",top:-4,right:-4,width:10,height:10,borderRadius:"50%",background:"#a78bfa",border:"1.5px solid #0B1220"}}/>}
                </button>
              );
            })}
          </div>
        </div>

        {bookmakers.length>0&&(
          <div><div style={{fontSize:11,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Bookmaker</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {bookmakers.map(bk=>{
                const logo=BK_LOGOS[bk]||bkPhotos[bk]||null;
                const isOn=newBK===bk;
                return(
                  <button key={bk} onClick={()=>setNewBK(isOn?"":bk)} title={bk}
                    style={{width:40,height:40,borderRadius:10,border:"2px solid "+(isOn?"#A78BFA":"rgba(255,255,255,0.08)"),background:isOn?"rgba(124,58,237,0.18)":"rgba(255,255,255,0.03)",cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",boxShadow:isOn?"0 0 10px rgba(124,58,237,0.35)":"none"}}>
                    {logo?(<img src={logo} alt={bk} style={{width:26,height:26,borderRadius:6,objectFit:"cover"}}/>):(<span style={{fontSize:10,fontWeight:700,color:isOn?"#A78BFA":"#6B7280"}}>{bk.slice(0,3)}</span>)}
                  </button>
                );
              })}
            </div>
            {newBK&&<div style={{fontSize:11,color:"#A78BFA",fontWeight:600,marginTop:6}}>✓ {newBK}</div>}
          </div>
        )}
        {/* Status filter */}
        <div><div style={{fontSize:11,color:"#9CA3AF",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Résultat</div><div style={{display:"flex",gap:6}}>
            {[{k:"",l:"Tous"},{k:"won",l:"✓ Gagnés"},{k:"lost",l:"✗ Perdus"},{k:"pending",l:" En attente"}].map(function(s){
              var on=searchStatus===s.k;
              return(
                <button key={s.k} onClick={function(){setSearchStatus(on?"":s.k);}}
                  style={{flex:1,padding:"7px 4px",borderRadius:8,border:"1px solid "+(on?(s.k==="won"?"rgba(0,230,118,.4)":s.k==="lost"?"rgba(239,68,68,.4)":"rgba(96,165,250,.4)"):"rgba(255,255,255,.07)"),background:on?(s.k==="won"?"rgba(0,230,118,.1)":s.k==="lost"?"rgba(239,68,68,.1)":"rgba(96,165,250,.1)"):"transparent",color:on?(s.k==="won"?"#00E676":s.k==="lost"?"#f87171":"#93c5fd"):"#6B7280",fontSize:10,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                  {s.l}
                </button>
              );
            })}
          </div></div>
        {/* Rechercher: filtre la liste */}
        <div style={{marginTop:8}}><button onClick={function(){
            var t=newTournament==="__AUCUN__"?"__NONE__":newTournament;
            setSearchTournament(t);
            setSearchBK(newBK||"");
            setSearchDate(newDate||"");
          }}
            style={{width:"100%",padding:"11px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            "Rechercher"
          </button>
          {(searchTournament||searchBK||searchDate)&&(
            <div style={{fontSize:11,color:"#fbbf24",marginTop:5,textAlign:"center"}}>
              {Object.values(sortedByDay).flat().length} paris trouvés
              {searchTournament==="__NONE__"?" · sans tournoi":searchTournament?" · "+searchTournament:""}
              {searchBK?" · "+searchBK:""}
              {searchDate?" · "+searchDate:""}
              <button onClick={function(){setSearchTournament("");setSearchBK("");setSearchDate("");setSearchStatus("");}}
                style={{marginLeft:8,fontSize:10,color:"#f87171",background:"none",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>✕ Effacer</button></div>
          )}
        </div></div>
      {selected.size>0&&<div style={{padding:"8px 14px",flexShrink:0,borderBottom:"1px solid #1F2937"}}>
        {!canApply&&<div style={{fontSize:11,color:"#fbbf24",marginBottom:6,textAlign:"center"}}>Choisis une date, un tournoi ou un bookmaker ci-dessus</div>}
        <button onClick={apply} disabled={!canApply||saving} style={{width:"100%",padding:"12px",background:canApply?"linear-gradient(135deg,#F97316,#EA580C)":"rgba(255,255,255,.05)",border:canApply?"none":"1px solid rgba(255,255,255,.1)",borderRadius:12,color:canApply?"#fff":"#4a5a6e",fontWeight:800,fontSize:14,cursor:canApply?"pointer":"default",fontFamily:"Inter,sans-serif",opacity:saving?0.6:1,boxShadow:canApply?"0 4px 16px rgba(249,115,22,.3)":"none"}}>{saving?"Enregistrement...":"✓ Appliquer aux "+selected.size+" paris"}</button></div>}
      <div style={{flex:"1 1 0",overflowY:"auto",WebkitOverflowScrolling:"touch",padding:"8px 14px 80px",minHeight:0}}>
        {allMonthKeys.map(mk=>{
          const days=allByMonth[mk]||[];
          return(
            <div key={mk} style={{marginBottom:14}}><div style={{fontSize:13,fontWeight:800,color:"#6B7280",textTransform:"uppercase",letterSpacing:.8,padding:"8px 0 6px"}}>{mk}</div>
              {days.map(dk=>{
                const dayBets=sortedByDay[dk]||[];
                const allDaySel=dayBets.length>0&&dayBets.every(b=>selected.has(b.id));
                return(
                  <div key={dk} style={{marginBottom:8,borderRadius:10,overflow:"hidden",border:"1px solid #1F2937"}}><div style={{padding:"8px 12px",background:"#111827",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>{fmtDay(dk)}</span>
                      {/* League logos */}
                      <div style={{display:"flex",gap:3}}>
                        {[...new Set(dayBets.map(b=>b.game).filter(Boolean))].map(g=>(
                          <GameLogo key={g} game={g} size={14}/>
                        ))}
                      </div>
                    </div><button onClick={()=>toggleDay(dk)} style={{fontSize:11,fontWeight:700,color:allDaySel?"#A78BFA":"#6B7280",background:allDaySel?"rgba(124,58,237,0.15)":"rgba(255,255,255,0.04)",border:"1px solid "+(allDaySel?"rgba(124,58,237,0.4)":"#1F2937"),borderRadius:6,padding:"4px 10px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                        {allDaySel?"✓ Tous":"Tout sélect."}
                      </button></div>
                    {dayBets.map(b=>{
                      const isSel=selected.has(b.id);
                      return(
                        <div key={b.id} onClick={()=>toggle(b.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",background:isSel?"rgba(124,58,237,0.08)":"transparent",borderTop:"1px solid #1F2937",cursor:"pointer",userSelect:"none",WebkitUserSelect:"none"}}><div style={{width:20,height:20,borderRadius:5,border:"2px solid "+(isSel?"#7C3AED":"#374151"),background:isSel?"rgba(124,58,237,0.25)":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {isSel&&<span style={{fontSize:11,color:"#A78BFA",fontWeight:900}}>✓</span>}
                          </div><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:6,overflow:"hidden"}}><GameLogo game={b.game} size={16}/><span style={{fontSize:13,fontWeight:700,color:"#E5E7EB",textTransform:"capitalize",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.player} <span style={{color:"#6B7280",fontWeight:400,fontSize:12}}>- {b.description}</span></span></div><div style={{fontSize:11,color:"#6B7280",marginTop:2}}>@{b.odds} · {b.stake}$ · {b.datetime?String(b.datetime).slice(0,10):""}</div></div><div style={{fontSize:13,fontWeight:700,color:b.status==="won"?"#00E676":b.status==="lost"?"#EF4444":"#3B82F6",flexShrink:0}}>
                            {b.status==="pending"?"@"+b.odds:((b.profit||0)>=0?"+":"")+(b.profit||0).toFixed(0)+"$"}
                          </div></div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div></div>
  );
}

// ── MesParisView ─────────────────────────────────────────────────────────────
function MesParisView({
  bets,setBets,bookmakers,bkPhotos,hiddenBKs,updateStatus,deleteBet,duplicateBet,openEdit,splitBet,showToast,
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
  fTipster="All",setFTipster,
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

  const activeFilters=fGames.length+fBKs.length+(fMinOdds?1:0)+(fMaxOdds?1:0)+(fMinStake?1:0)+(fMaxStake?1:0)+(fMapFilter&&fMapFilter!=="all"?1:0)+(fDuel?1:0)+(fLive?1:0)+(fHeadshot?1:0)+(fStatus&&fStatus!=="All"?1:0)+(fOverUnder&&fOverUnder!=="All"?1:0)+(fRole&&fRole!=="All"?1:0)+(fLeague&&fLeague!=="All"?1:0)+(fTourneys&&fTourneys.size>0?1:0)+(fDateFrom?1:0)+(fDateTo?1:0)+(fTipster&&fTipster!=="All"?1:0);
  const clearFilters=()=>{setFGames([]);setFBKs([]);setFMinOdds("");setFMaxOdds("");setFMinStake("");setFMaxStake("");setFMapFilter("all");setFDuel(false);setFLive(false);setFHeadshot(false);setFStatus("All");setFOverUnder("All");setFRole("All");setFLeague("All");if(setFTourneys)setFTourneys(new Set());setFDateFrom("");setFDateTo("");if(setFTipster)setFTipster("All");};

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
    if(fDuel&&(b.announceOuts&&b.announceOuts.length>0))return false;
    if(fLive&&!b.isLive)return false;
    if(fHeadshot&&!(b.announceOuts&&b.announceOuts.length>0))return false;
    if(fTourneys&&fTourneys.size>0&&!fTourneys.has(effectiveTournament(b,allPlayers)||"Hors tournoi"))return false;
    if(fPlayer&&!(b.player||"").toLowerCase().includes(fPlayer.toLowerCase()))return false;
    if(fMinPP!==""&&(b.ppEdge==null||b.ppEdge<parseFloat(fMinPP)))return false;
    if(fMaxPP!==""&&(b.ppEdge==null||b.ppEdge>parseFloat(fMaxPP)))return false;
    if(fTipster&&fTipster!=="All"&&(b.tipster||null)!==fTipster)return false;
    return true;
  }),[bets,fStatus,fGames,fBKs,fOverUnder,fRole,fLeague,fMinOdds,fMaxOdds,fMinStake,fMaxStake,fDuel,fLive,fHeadshot,fTourneys,fPlayer,fMinPP,fMaxPP,fTipster]);

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
    if(monthKeys.length>2){
      setCollapsedMonths(prev=>{if(prev.size>0)return prev;return new Set(monthKeys.slice(1));});
    }
  },[monthKeys.length]);

  return(
    <div className="view-enter" style={{position:"relative"}}>
      {/* Fond profondeur subtil */}
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}><div style={{position:"absolute",top:"-10%",left:"50%",transform:"translateX(-50%)",width:"100%",height:"45%",background:"radial-gradient(ellipse at 50% 0%,rgba(124,58,237,.04),transparent 70%)"}}/><div style={{position:"absolute",bottom:0,left:0,right:0,height:"25%",background:"linear-gradient(to top,rgba(7,10,20,.4),transparent)"}}/></div>
      {/* ── TOP BAR ── */}
      <div style={{display:"flex",gap:6,marginBottom:10,alignItems:"center"}}><button onClick={()=>setView("filtres")}
          style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:10,border:"1px solid "+(activeFilters>0?"rgba(124,58,237,.4)":"rgba(255,255,255,.06)"),background:activeFilters>0?"rgba(124,58,237,.1)":"rgba(255,255,255,.02)",color:activeFilters>0?"#a78bfa":"#6a7a8a",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
          Filtres{activeFilters>0&&<span style={{background:"#7C3AED",color:"#fff",borderRadius:8,fontSize:9,fontWeight:800,padding:"1px 6px",marginLeft:2}}>{activeFilters}</span>}
        </button><button onClick={()=>setView("statistiques")}
          style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",borderRadius:10,border:"1px solid rgba(255,255,255,.06)",background:"rgba(255,255,255,.02)",color:"#6a7a8a",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          Stats
        </button>
        {/* ── SEARCH BAR ── */}
        {searchOpen?(
          <div style={{flex:1,display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.04)",borderRadius:10,border:"1px solid rgba(255,255,255,.1)",padding:"0 10px",height:36}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6a7a8a" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input autoFocus value={globalSearch} onChange={e=>{setGlobalSearch(e.target.value);setFPlayer(e.target.value);}}
              placeholder="Joueur, tournoi..."
              style={{flex:1,background:"none",border:"none",outline:"none",color:"#e0e8f0",fontSize:13,fontFamily:"Inter,sans-serif",fontWeight:500}}/>
            {globalSearch&&<button onClick={()=>{setGlobalSearch("");setFPlayer("");}} style={{background:"none",border:"none",color:"#6a7a8a",cursor:"pointer",fontSize:14,padding:0}}>✕</button>}
            <button onClick={()=>{setSearchOpen(false);setGlobalSearch("");setFPlayer("");}} style={{background:"none",border:"none",color:"#6a7a8a",cursor:"pointer",fontSize:11,padding:0,fontFamily:"Inter,sans-serif"}}>Annuler</button></div>
        ):(
          <button onClick={()=>setSearchOpen(true)}
            style={{width:34,height:34,borderRadius:10,border:"1px solid rgba(255,255,255,.06)",background:"rgba(255,255,255,.02)",color:"#6a7a8a",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></button>
        )}
        <div style={{flex:searchOpen?0:1}}/>
        {!searchOpen&&activeFilters>0&&<button onClick={clearFilters} style={{padding:"7px 11px",borderRadius:10,border:"1px solid rgba(239,68,68,.25)",background:"rgba(239,68,68,.05)",color:"#f87171",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>✕ Effacer</button>}
        {!searchOpen&&<button onClick={()=>setSelectOpen(true)}
          style={{padding:"8px 14px",borderRadius:10,border:"1.5px solid rgba(255,255,255,.07)",background:"rgba(255,255,255,.03)",color:"#7a8a9a",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>
          Sélectionner
        </button>}
      </div>

      {/* ── BK LOGO FILTERS ── */}
      {bookmakers.length>0&&(
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}>
          {bookmakers.filter(bk=>!hiddenBKs||!hiddenBKs.has(bk)).map(bk=>{
            const on=fBKs.includes(bk);
            const logo=BK_LOGOS[bk]||bkPhotos[bk]||null;
            return(
              <button key={bk} onClick={()=>setFBKs(prev=>on?prev.filter(x=>x!==bk):[...prev,bk])} title={bk}
                style={{width:36,height:36,borderRadius:9,border:"1px solid "+(on?"rgba(34,197,94,.4)":"rgba(255,255,255,.06)"),background:on?"rgba(34,197,94,.08)":"rgba(255,255,255,.02)",cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",flexShrink:0}}>
                {logo?(<img src={logo} alt={bk} style={{width:22,height:22,borderRadius:4,objectFit:"cover"}}/>):(<span style={{fontSize:8,color:on?"#00E676":"#6B7280",fontWeight:700}}>{bk.slice(0,4)}</span>)}
                {on&&<div style={{position:"absolute",top:-3,right:-3,background:"#00E676",borderRadius:"50%",width:10,height:10,display:"flex",alignItems:"center",justifyContent:"center",border:"1.5px solid #0B1220"}}><span style={{fontSize:6,color:"#000",fontWeight:900}}>✓</span></div>}
              </button>
            );
          })}
        </div>
      )}

      {/* W/L quick filter shown when BK is active */}
      {fBKs.length>0&&(
        <div style={{display:"flex",gap:6,marginBottom:10,marginTop:-4}}>
          {[{s:"won",label:"✓ Gagnés",col:"#00E676",bg:"rgba(0,230,118,.1)",border:"rgba(0,230,118,.35)"},{s:"lost",label:"✗ Perdus",col:"#f87171",bg:"rgba(248,113,113,.1)",border:"rgba(248,113,113,.35)"}].map(({s,label,col,bg,border})=>{
            const active=fStatus===s;
            return(
              <button key={s} onClick={()=>setFStatus(active?"All":s)}
                style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:8,border:"1px solid "+(active?border:"rgba(255,255,255,.07)"),background:active?bg:"transparent",color:active?col:"#4a5a6e",fontSize:12,fontWeight:active?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s"}}>
                {label}
              </button>
            );
          })}
          {fStatus!=="All"&&<button onClick={()=>setFStatus("All")} style={{padding:"5px 8px",borderRadius:8,border:"1px solid rgba(255,255,255,.07)",background:"transparent",color:"#4a5a6e",fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>✕</button>}
        </div>
      )}

      {/* ── TIPSTER FILTER DROPDOWN ── */}
      {(()=>{
        const allTipstersInBets=[...new Set(bets.map(b=>b.tipster).filter(Boolean))].sort();
        if(allTipstersInBets.length===0)return null;
        return(
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:"#6B7280",fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}><TipsterIcon size={13} color="#6B7280"/> Tipster</span>
            <select
              value={fTipster}
              onChange={e=>setFTipster(e.target.value)}
              style={{flex:1,background:"rgba(14,20,38,.98)",border:"1px solid "+(fTipster!=="All"?"rgba(167,139,250,.5)":"rgba(255,255,255,.08)"),borderRadius:9,padding:"6px 10px",color:fTipster!=="All"?"#a78bfa":"#9CA3AF",fontSize:12,fontFamily:"Inter,sans-serif",fontWeight:fTipster!=="All"?700:500,outline:"none",cursor:"pointer",appearance:"none",WebkitAppearance:"none"}}>
              <option value="All">Tous les tipsers</option>
              {allTipstersInBets.map(t=>(
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {fTipster!=="All"&&(
              <button onClick={()=>setFTipster("All")} style={{background:"none",border:"none",color:"#6B7280",cursor:"pointer",fontSize:14,padding:"0 4px",flexShrink:0}}>✕</button>
            )}
          </div>
        );
      })()}

      {bets.length===0&&<div style={{color:"#6B7280",fontSize:14,padding:30,textAlign:"center"}}>Aucun pari enregistré</div>}
      {globalSearch&&filtered.length===0&&bets.length>0&&<div style={{color:"#6B7280",fontSize:13,padding:"20px",textAlign:"center"}}>Aucun résultat pour « {globalSearch} »</div>}
      {globalSearch&&filtered.length>0&&<div style={{fontSize:11,color:"#4a5a6e",marginBottom:8,fontWeight:600}}>{filtered.length} paris trouvé{filtered.length>1?"s":""} pour « {globalSearch} »</div>}

      {/* ── PENDING ── */}
      {pending.length>0&&(
        <div style={{marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"4px 2px"}}><div style={{width:3,height:14,borderRadius:2,background:"#60a5fa",flexShrink:0}}/><span style={{fontSize:11,fontWeight:800,color:"#60A5FA",textTransform:"uppercase",letterSpacing:1.5}}>En attente</span><span style={{background:"rgba(96,165,250,.18)",color:"#93c5fd",fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:6}}>{pending.length}</span><span style={{fontSize:11,color:"#7a9cbd",marginLeft:"auto",fontWeight:600}}>{pending.reduce((s,b)=>s+(b.stake||0),0).toFixed(0)}$ en jeu</span></div><div style={{display:"flex",flexDirection:"column",gap:2}}>
            {pending.map(b=>(
              <BetRow key={b.id} bet={b} onStatus={updateStatus} onDelete={deleteBet} onDuplicate={duplicateBet} onEdit={openEdit} onSplit={splitBet} bkPhotos={bkPhotos} onSave={onSave} allTourneys={allTourneys} savedTourneys={savedTourneys} allPlayers={allPlayers}/>
            ))}
          </div></div>
      )}

      {/* ── SETTLED ── */}
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
              <div key={mk} style={{marginBottom:14}}><div onClick={()=>toggleMonth(mk)} style={{background:"linear-gradient(135deg,rgba(10,18,38,.99),rgba(7,14,30,.99))",border:"1px solid rgba(99,130,200,.22)",borderRadius:collapsedMonths.has(mk)?"14px":"14px 14px 0 0",padding:"14px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",userSelect:"none",boxShadow:"0 6px 24px rgba(0,0,0,.4),0 0 0 1px rgba(124,58,237,.04)",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:1,background:"linear-gradient(90deg,transparent,rgba(124,58,237,.4),rgba(59,130,246,.3),transparent)",pointerEvents:"none"}}/><div style={{position:"absolute",top:"-50%",right:"-10%",width:"40%",height:"150%",background:"radial-gradient(ellipse,rgba(124,58,237,.06),transparent 70%)",pointerEvents:"none"}}/><div><div style={{fontSize:16,fontWeight:800,color:"#dce8ff",textTransform:"uppercase",letterSpacing:.8}}>{fmtMonth(mk)}</div><div style={{display:"flex",alignItems:"center",gap:8,marginTop:3}}><span style={{fontSize:11,color:"#4B6080",fontWeight:500}}>{allBets.length} paris</span><span style={{fontSize:10,color:"#3a5070"}}>·</span><span style={{fontSize:11,color:wr>=55?"#00E676":wr>=45?"#f59e0b":"#ef4444",fontWeight:700}}>{wr.toFixed(0)}% WR</span><span style={{fontSize:10,color:"#3a5070"}}>·</span><span style={{fontSize:11,color:staked>0?"#7a9cc4":"#3a5070",fontWeight:500}}>{staked.toFixed(0)}$ misés</span></div></div><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{textAlign:"right"}}><div style={{fontSize:19,fontWeight:800,color:profit>=0?"#00E676":"#f87171",letterSpacing:-.3}}>{profit>=0?"+":""}{profit.toFixed(0)}$</div><div style={{fontSize:11,color:roi>=0?"#22a55a":"#c04040",fontWeight:600}}>{roi>=0?"+":""}{roi.toFixed(1)}% ROI</div></div><span style={{fontSize:11,color:"#4B6080",transition:"transform .2s",display:"inline-block",transform:collapsedMonths.has(mk)?"none":"rotate(180deg)"}}>▼</span></div></div>
                {!collapsedMonths.has(mk)&&(
                  <div style={{borderRadius:"0 0 12px 12px",overflow:"hidden",border:"1px solid rgba(99,130,200,.14)",borderTop:"none",marginBottom:6,background:"rgba(8,12,24,.6)"}}>
                    {days.map((dk,di)=>{
                      const dayBets=byDay[dk]||[];
                      const dayProfit=dayBets.reduce((s,b)=>s+(b.profit||0),0);
                      return(
                        <div key={dk} style={{borderTop:di>0?"1px solid #1F2937":"none"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",background:"rgba(10,16,32,.97)",borderTop:"1px solid rgba(255,255,255,.03)"}}><span style={{fontSize:13,fontWeight:700,color:"#b8c8de"}}>{fmtDay(dk)}</span><span style={{fontSize:13,fontWeight:700,color:dayProfit>=0?"#00E676":"#EF4444"}}>{dayProfit>=0?"+":""}{dayProfit.toFixed(0)}$</span></div>
                          {dayBets.map(b=>(
                            <BetRow key={b.id} bet={b} onStatus={updateStatus} onDelete={deleteBet} onDuplicate={duplicateBet} onEdit={openEdit} onSplit={splitBet} bkPhotos={bkPhotos} onSave={onSave} allTourneys={allTourneys} savedTourneys={savedTourneys} allPlayers={allPlayers}/>
                          ))}
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
}




// ── Optimise URL photo joueur pour affichage miniature ───────────────────────
function optimizePhotoUrl(url, size=120){
  if(!url) return url;
  // Retourner l'URL originale directement — pas de transform Supabase (plan gratuit)
  return url;
}


// ── Corrections positions NBA (ESPN donne souvent de mauvaises positions) ─────
const NBA_POS_CORRECTIONS = {"stephen curry": "PG", "damian lillard": "PG", "luka doncic": "PG", "trae young": "PG", "ja morant": "PG", "tyrese haliburton": "PG", "darius garland": "PG", "chris paul": "PG", "kyrie irving": "PG", "devin booker": "PG", "donovan mitchell": "PG", "shai gilgeous-alexander": "PG", "cade cunningham": "PG", "jalen brunson": "PG", "tyrese maxey": "PG", "de aaron fox": "PG", "lamelo ball": "PG", "fred vanvleet": "PG", "anthony edwards": "SG", "bradley beal": "SG", "klay thompson": "SG", "james harden": "SG", "zach lavine": "SG", "tyler herro": "SG", "desmond bane": "SG", "jordan poole": "SG", "anfernee simons": "SG", "malik monk": "SG", "donte divincenzo": "SG", "lebron james": "SF", "kevin durant": "SF", "jayson tatum": "SF", "paul george": "SF", "kawhi leonard": "SF", "jimmy butler": "SF", "jaylen brown": "SF", "mikal bridges": "SF", "og anunoby": "SF", "brandon ingram": "SF", "pascal siakam": "SF", "khris middleton": "SF", "andrew wiggins": "SF", "michael porter jr": "SF", "franz wagner": "SF", "miles bridges": "SF", "victor wembanyama": "PF", "giannis antetokounmpo": "PF", "anthony davis": "PF", "zion williamson": "PF", "julius randle": "PF", "draymond green": "PF", "kristaps porzingis": "PF", "chet holmgren": "PF", "jerami grant": "PF", "tobias harris": "PF", "lauri markkanen": "PF", "evan mobley": "PF", "jaren jackson jr": "PF", "keegan murray": "PF", "scottie barnes": "PF", "cameron johnson": "PF", "nikola jokic": "C", "joel embiid": "C", "karl-anthony towns": "C", "bam adebayo": "C", "deandre ayton": "C", "steven adams": "C", "clint capela": "C", "rudy gobert": "C", "brook lopez": "C", "myles turner": "C", "walker kessler": "C", "alperen sengun": "C", "ivica zubac": "C", "nic claxton": "C", "jarrett allen": "C", "domantas sabonis": "C", "jonas valanciunas": "C", "mitchell robinson": "C", "isaiah hartenstein": "C", "daniel gafford": "C", "mark williams": "C"};

// Positions ESPN non résolues : G (PG ou SG?) et F (SF ou PF?)
// On utilise les corrections hardcodées en priorité
const ESPN_G_AS_PG = new Set([
  "stephen curry","damian lillard","luka doncic","trae young","ja morant",
  "tyrese haliburton","darius garland","chris paul","kyrie irving",
  "shai gilgeous-alexander","cade cunningham","jalen brunson","tyrese maxey",
  "de aaron fox","lamelo ball","fred vanvleet","kemba walker","mike conley",
  "lonzo ball","monte morris","reggie jackson","ish smith","dennis schroder",
  "cole anthony","devonte graham","josh giddey","markelle fultz",
  "immanuel quickley","facundo campazzo","tre mann","payton pritchard",
  "malachi flynn","jordan goodwin","kira lewis jr","elijah green",
  "jaden ivey","scoot henderson","austin reaves","dyson daniels",
  "keyonte george","brandin podziemski","jaime jaquez jr",
]);
const ESPN_F_AS_PF = new Set([
  "victor wembanyama","giannis antetokounmpo","anthony davis","zion williamson",
  "julius randle","draymond green","kristaps porzingis","chet holmgren",
  "jerami grant","tobias harris","lauri markkanen","evan mobley",
  "jaren jackson jr","keegan murray","scottie barnes","cameron johnson",
  "obi toppin","john collins","p.j. tucker","thaddeus young",
  "christian wood","marvin bagley iii","kelly olynyk","john henson",
]);

function getPlayerPosition(player){
  if(!player) return "";
  const name = (typeof player==="string"?player:(player.name||"")).toLowerCase().trim();
  const correction = NBA_POS_CORRECTIONS[name];
  if(correction) return correction;
  const role = typeof player==="object" ? (player.role||"") : "";
  // Résoudre les positions ESPN ambiguës
  if(role==="G") return ESPN_G_AS_PG.has(name) ? "PG" : "SG";
  if(role==="F") return ESPN_F_AS_PF.has(name) ? "PF" : "SF";
  return role;
}

// ── Composant Annonce (joueurs out) ─────────────────────────────────────────
function AnnonceBlock({team, playerName, allPlayers, outs, onOutsChange}){
  const [open, setOpen] = useState(false);
  const [outPlayers, setOutPlayers] = useState(outs);

  const teammates = Object.values(allPlayers).filter(p=>
    p.team===team && (p.name||"")!==(playerName||"").toLowerCase().trim()
  ).sort((a,b)=>(a.name||"").localeCompare(b.name||""));

  function toggleOut(name){
    const next = outPlayers.includes(name)
      ? outPlayers.filter(x=>x!==name)
      : [...outPlayers, name];
    setOutPlayers(next);
    onOutsChange(next);
  }

  function capName(n){
    return (n||"").split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
  }

  return(
    <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}><div onClick={()=>setOpen(v=>!v)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",userSelect:"none"}}><div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4"}}>
           Annonce
          {outPlayers.length>0&&(
            <span style={{background:"rgba(239,68,68,.2)",color:"#f87171",fontSize:10,fontWeight:700,padding:"1px 7px",borderRadius:10,border:"1px solid rgba(239,68,68,.3)"}}>
              {outPlayers.length} OUT
            </span>
          )}
        </div><span style={{color:"#4a5a6e",fontSize:12,transform:open?"rotate(180deg)":"none",transition:"transform .2s",display:"inline-block"}}>▼</span></div>
      {open&&(
        <div style={{marginTop:10}}><div style={{fontSize:10,color:"#6b7280",marginBottom:8,fontWeight:600}}>
            Joueurs de {team} qui sont OUT :
          </div><div style={{display:"flex",flexWrap:"wrap",gap:6,maxHeight:200,overflowY:"auto"}}>
            {teammates.length===0&&<div style={{fontSize:11,color:"#4a5a6e"}}>Aucun coéquipier trouvé</div>}
            {teammates.map(p=>{
              const isOut=outPlayers.includes(p.name);
              return(
                <button key={p.name} onClick={()=>toggleOut(p.name)}
                  style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:20,border:"1.5px solid "+(isOut?"rgba(239,68,68,.6)":"rgba(255,255,255,.08)"),background:isOut?"rgba(239,68,68,.12)":"rgba(255,255,255,.02)",color:isOut?"#f87171":"#8a9eb8",fontSize:11,fontWeight:isOut?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s"}}>
                  {p.photo_url&&<div style={{width:18,height:18,borderRadius:"50%",overflow:"hidden",flexShrink:0,WebkitTransform:"translateZ(0)",transform:"translateZ(0)"}}><img src={p.photo_url} loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 12%",display:"block"}} onError={e=>e.target.parentElement.style.display="none"} alt=""/></div>}
                  {isOut?" ":""}{capName(p.name)}
                </button>
              );
            })}
          </div>
          {outPlayers.length>0&&(
            <div style={{marginTop:8,fontSize:10,color:"#f87171",fontWeight:600}}>
              Out : {outPlayers.map(capName).join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ── AnnonceStatsView ─────────────────────────────────────────────────────────
function AnnonceStatsView({bets, allPlayers}){
  const settled=bets.filter(b=>b.status!=="pending");
  const ALL_GAMES=["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Bundesliga","Lega","HEBA"];
  const POS_LIST=[
    {key:"PG",label:"Point Guard",color:"#a78bfa"},
    {key:"SG",label:"Shooting Guard",color:"#60a5fa"},
    {key:"SF",label:"Small Forward",color:"#34d399"},
    {key:"PF",label:"Power Forward",color:"#fb923c"},
    {key:"C",label:"Center",color:"#f472b6"},
  ];

  function calcS(arr){
    if(!arr.length)return{count:0,won:0,profit:0,wr:0,roi:0,stake:0};
    const won=arr.filter(b=>b.status==="won").length;
    const profit=arr.reduce((s,b)=>s+(b.profit||0),0);
    const stake=arr.reduce((s,b)=>s+(b.stake||0),0);
    return{count:arr.length,won,profit,wr:arr.length>0?won/arr.length*100:0,roi:stake>0?profit/stake*100:0,stake};
  }

  // CLV calc: average CLV for bets that have clvCut & clvOdds stored (future feature)
  // For now show progression = ROI of announced vs non-announced
  const annBets=settled.filter(b=>b.announceOuts&&b.announceOuts.length>0);
  const nonAnnBets=settled.filter(b=>!b.announceOuts||b.announceOuts.length===0);
  const globalAnn=calcS(annBets);
  const globalNon=calcS(nonAnnBets);
  const progression=globalNon.roi>0?(globalAnn.roi-globalNon.roi):globalAnn.roi;

  // Per game stats
  const byGame={};
  ALL_GAMES.forEach(g=>{
    const gAnn=annBets.filter(b=>b.game===g);
    const gNon=nonAnnBets.filter(b=>b.game===g);
    if(gAnn.length>0||gNon.length>0)byGame[g]={ann:calcS(gAnn),non:calcS(gNon)};
  });

  const [openGame,setOpenGame]=React.useState({});

  if(annBets.length===0)return(
    <div style={{textAlign:"center",padding:"40px 20px",color:"#4a5a6e"}}>
      <div style={{fontSize:32,marginBottom:8}}>📣</div>
      <div style={{fontSize:14,fontWeight:700}}>Aucun pari avec annonce</div>
      <div style={{fontSize:11,marginTop:4}}>Ajoute des paris en mode "Annonce" pour voir les stats ici</div>
    </div>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>

      {/* ── Bloc global ── */}
      <div style={{background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.2)",borderRadius:14,padding:"14px 16px"}}>
        <div style={{fontSize:11,color:"#34d399",fontWeight:800,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>📣 Stats globales annonces</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {[
            {l:"Paris",v:globalAnn.count,fmt:v=>v,col:"#E5E7EB"},
            {l:"Win Rate",v:globalAnn.wr,fmt:v=>v.toFixed(0)+"%",col:globalAnn.wr>=55?"#22C55E":globalAnn.wr<45?"#f87171":"#9CA3AF"},
            {l:"ROI",v:globalAnn.roi,fmt:v=>(v>=0?"+":"")+v.toFixed(1)+"%",col:globalAnn.roi>=0?"#22C55E":"#f87171"},
            {l:"Progression",v:progression,fmt:v=>(v>=0?"+":"")+v.toFixed(1)+"%",col:progression>=0?"#34d399":"#f87171"},
          ].map(({l,v,fmt,col})=>(
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:800,color:col,lineHeight:1}}>{fmt(v)}</div>
              <div style={{fontSize:9,color:"#6B7280",fontWeight:600,marginTop:3,textTransform:"uppercase",letterSpacing:.5}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{fontSize:10,color:"#4a5a6e",marginTop:8,textAlign:"center"}}>
          Profit: {globalAnn.profit>=0?"+":""}{globalAnn.profit.toFixed(0)}$ · Mise totale: {globalAnn.stake.toFixed(0)}$
        </div>
      </div>

      {/* ── Par ligue ── */}
      {ALL_GAMES.filter(g=>byGame[g]).map(game=>{
        const {ann,non}=byGame[game];
        const isOpen=!!openGame[game];
        const pct=non.roi>0?(ann.roi-non.roi):ann.roi;

        // Per position for this game
        const posBets={};
        POS_LIST.forEach(({key})=>{posBets[key]=[];});
        annBets.filter(b=>b.game===game).forEach(b=>{
          const pd=allPlayers[(b.player||"").toLowerCase().trim()];
          const role=pd&&pd.role&&pd.role.toUpperCase();
          if(role&&posBets[role])posBets[role].push(b);
        });

        return(
          <div key={game} style={{background:"rgba(10,16,34,.98)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,overflow:"hidden"}}>
            {/* Header */}
            <button onClick={()=>setOpenGame(s=>({...s,[game]:!s[game]}))}
              style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <GameLogo game={game} size={20}/>
                <div>
                  <div style={{fontWeight:800,fontSize:13,color:"#E5E7EB"}}>{game}</div>
                  <div style={{fontSize:10,color:"#6B7280"}}>{ann.count} annonces · {ann.wr.toFixed(0)}% WR · {ann.roi>=0?"+":""}{ann.roi.toFixed(1)}% ROI</div>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:6,background:pct>=0?"rgba(34,197,94,.1)":"rgba(248,113,113,.1)",color:pct>=0?"#22C55E":"#f87171"}}>{pct>=0?"+":""}{pct.toFixed(1)}%</span>
                <span style={{fontSize:10,color:"#4a5a6e",transform:isOpen?"rotate(180deg)":"none",display:"inline-block",transition:"transform .2s"}}>▼</span>
              </div>
            </button>

            {isOpen&&(
              <div style={{borderTop:"1px solid rgba(255,255,255,.06)"}}>
                {/* Global game stats */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                  {[
                    {l:"Paris",v:ann.count,fmt:v=>v,col:"#E5E7EB"},
                    {l:"WR",v:ann.wr,fmt:v=>v.toFixed(0)+"%",col:ann.wr>=55?"#22C55E":ann.wr<45?"#f87171":"#9CA3AF"},
                    {l:"ROI",v:ann.roi,fmt:v=>(v>=0?"+":"")+v.toFixed(1)+"%",col:ann.roi>=0?"#22C55E":"#f87171"},
                    {l:"Profit",v:ann.profit,fmt:v=>(v>=0?"+":"")+v.toFixed(0)+"$",col:ann.profit>=0?"#22C55E":"#f87171"},
                  ].map(({l,v,fmt,col})=>(
                    <div key={l} style={{textAlign:"center"}}>
                      <div style={{fontSize:13,fontWeight:800,color:col}}>{fmt(v)}</div>
                      <div style={{fontSize:9,color:"#6B7280",fontWeight:600,marginTop:2}}>{l}</div>
                    </div>
                  ))}
                </div>

                {/* Per position */}
                {POS_LIST.map(({key,label,color})=>{
                  const pb=posBets[key]||[];
                  if(pb.length===0)return null;
                  const ps=calcS(pb);
                  // CLV: avg of bets that have clv data
                  const clvBets=pb.filter(b=>b.clvValue!=null);
                  const avgCLV=clvBets.length>0?clvBets.reduce((s,b)=>s+(b.clvValue||0),0)/clvBets.length:null;
                  return(
                    <div key={key} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",borderTop:"1px solid rgba(255,255,255,.04)"}}>
                      <div>
                        <span style={{fontSize:11,fontWeight:700,color}}>{label}</span>
                        <span style={{fontSize:10,color:"#6B7280",marginLeft:6}}>{ps.count}p · {ps.wr.toFixed(0)}% WR</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        {avgCLV!=null&&(
                          <span style={{fontSize:10,fontWeight:700,color:avgCLV>=0?"#34d399":"#f87171",background:avgCLV>=0?"rgba(52,211,153,.08)":"rgba(248,113,113,.08)",padding:"2px 6px",borderRadius:5}}>CLV {avgCLV>=0?"+":""}{avgCLV.toFixed(1)}%</span>
                        )}
                        <span style={{fontSize:12,fontWeight:700,color:ps.profit>=0?"#22C55E":"#f87171"}}>{ps.profit>=0?"+":""}{ps.profit.toFixed(0)}$</span>
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
  );
}


// ── AnnonceNBATracker ──────────────────────────────────────────────────────────
function AnnonceNBATracker({bets,allPlayers}){
  const SUPA_ROW_ANN="__settings_annonce_tracker__";
  function load(){try{return JSON.parse(localStorage.getItem("v7_annonce_tracker")||"[]");}catch(e){return[];}}
  function save(data){
    try{localStorage.setItem("v7_annonce_tracker",JSON.stringify(data));}catch(e){}
    supaSettingsSave(SUPA_ROW_ANN,data);
  }
  useEffect(()=>{
    supaSettingsLoad(SUPA_ROW_ANN).then(d=>{
      if(d&&Array.isArray(d)&&d.length>0){
        setEntries(prev=>{
          const ids=new Set(prev.map(e=>e.id));
          const merged=[...prev,...d.filter(e=>!ids.has(e.id))];
          try{localStorage.setItem("v7_annonce_tracker",JSON.stringify(merged));}catch(e){}
          return merged;
        });
      }
    }).catch(()=>{});
  },[]);
  const [entries,setEntries]=useState(load);
  const [form,setForm]=useState({player:"",outPlayers:[],cutBefore:"",cutAfter:"",note:"",date:new Date().toISOString().slice(0,10)});
  const [addOpen,setAddOpen]=useState(false);
  const [teamSide,setTeamSide]=useState("own");
  const [ownTeam,setOwnTeam]=useState("");
  const [oppTeam,setOppTeam]=useState("");
  const [query,setQuery]=useState("");
  const [selFilter,setSelFilter]=useState("all");
  const nbaPlayers=useMemo(()=>Object.values(allPlayers).filter(p=>p.game==="NBA"),[allPlayers]);
  const filteredPlayers=useMemo(()=>{if(!query)return nbaPlayers.slice(0,8);const q=query.toLowerCase();return nbaPlayers.filter(p=>(p.name||"").toLowerCase().includes(q)).slice(0,8);},[nbaPlayers,query]);
  function getTeammates(team){return nbaPlayers.filter(p=>p.team===team&&p.name!==form.player);}
  function toggleOut(name){setForm(f=>({...f,outPlayers:f.outPlayers.includes(name)?f.outPlayers.filter(x=>x!==name):[...f.outPlayers,name]}));}
  function addEntry(){
    if(!form.player||!form.cutBefore)return;
    const pi=allPlayers[(form.player||"").toLowerCase().trim()];
    const newEntry={id:Date.now(),player:form.player,team:pi?.team||ownTeam,outPlayers:form.outPlayers,cutBefore:parseFloat(form.cutBefore),cutAfter:form.cutAfter?parseFloat(form.cutAfter):null,note:form.note,date:form.date};
    const updated=[newEntry,...entries];
    setEntries(updated);save(updated);
    setForm({player:"",outPlayers:[],cutBefore:"",cutAfter:"",note:"",date:new Date().toISOString().slice(0,10)});
    setQuery("");setAddOpen(false);setOwnTeam("");setOppTeam("");
  }
  function removeEntry(id){const u=entries.filter(e=>e.id!==id);setEntries(u);save(u);}
  function updateCutAfter(id,val){const u=entries.map(e=>e.id===id?{...e,cutAfter:val?parseFloat(val):null}:e);setEntries(u);save(u);}
  const annBets=useMemo(()=>bets.filter(b=>b.announceOuts&&b.announceOuts.length>0&&b.status!=="pending"),[bets]);
  function calcS(arr){if(!arr.length)return null;const won=arr.filter(b=>b.status==="won").length;const profit=arr.reduce((s,b)=>s+(b.profit||0),0);const stake=arr.reduce((s,b)=>s+(b.stake||0),0);return{count:arr.length,won,profit,wr:won/arr.length*100,roi:stake>0?profit/stake*100:0,stake};}
  const globalStats=useMemo(()=>calcS(annBets),[annBets]);
  const filteredEntries=useMemo(()=>{if(selFilter==="cut_up")return entries.filter(e=>e.cutAfter!=null&&e.cutAfter>e.cutBefore);if(selFilter==="cut_down")return entries.filter(e=>e.cutAfter!=null&&e.cutAfter<e.cutBefore);return entries;},[entries,selFilter]);
  const inp={width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"9px 12px",color:"#E5E7EB",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"};
  const cardS={background:"rgba(10,16,34,.98)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,overflow:"hidden",marginBottom:10};
  return(
    <div>
      {globalStats&&(
        <div style={{background:"rgba(52,211,153,.06)",border:"1px solid rgba(52,211,153,.2)",borderRadius:14,padding:"12px 14px",marginBottom:12}}>
          <div style={{fontSize:10,color:"#34d399",fontWeight:800,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>📣 Résultats bets avec annonce</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
            {[{l:"Paris",v:globalStats.count,fmt:v=>v,col:"#E5E7EB"},{l:"Win Rate",v:globalStats.wr,fmt:v=>v.toFixed(0)+"%",col:globalStats.wr>=55?"#22C55E":globalStats.wr<45?"#f87171":"#9CA3AF"},{l:"ROI",v:globalStats.roi,fmt:v=>(v>=0?"+":"")+v.toFixed(1)+"%",col:globalStats.roi>=0?"#22C55E":"#f87171"},{l:"Profit",v:globalStats.profit,fmt:v=>(v>=0?"+":"")+v.toFixed(0)+"$",col:globalStats.profit>=0?"#22C55E":"#f87171"}].map(({l,v,fmt,col})=>(
              <div key={l} style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:800,color:col}}>{fmt(v)}</div><div style={{fontSize:9,color:"#6B7280",fontWeight:600,marginTop:3,textTransform:"uppercase",letterSpacing:.5}}>{l}</div></div>
            ))}
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"center"}}>
        <button onClick={()=>setAddOpen(v=>!v)} style={{flex:1,padding:"10px",borderRadius:10,border:"1.5px solid rgba(124,58,237,.4)",background:addOpen?"rgba(124,58,237,.15)":"transparent",color:"#a78bfa",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{addOpen?"✕ Fermer":"+ Tracker une annonce"}</button>
        {["all","cut_up","cut_down"].map(f=>(
          <button key={f} onClick={()=>setSelFilter(f)} style={{padding:"8px 10px",borderRadius:8,border:"1px solid "+(selFilter===f?"rgba(124,58,237,.4)":"rgba(255,255,255,.07)"),background:selFilter===f?"rgba(124,58,237,.12)":"transparent",color:selFilter===f?"#a78bfa":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>
            {f==="all"?"Tous":f==="cut_up"?"📈 Up":"📉 Down"}
          </button>
        ))}
      </div>
      {addOpen&&(
        <div style={cardS}><div style={{padding:"14px 14px 0"}}>
          <div style={{fontSize:11,color:"#6B7280",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Joueur betté</div>
          <input style={inp} placeholder="Rechercher un joueur NBA…" value={query} onChange={e=>{setQuery(e.target.value);setForm(f=>({...f,player:e.target.value}));}}/>
          {query&&filteredPlayers.length>0&&(
            <div style={{border:"1px solid rgba(255,255,255,.1)",borderRadius:8,marginTop:4,overflow:"hidden",maxHeight:200,overflowY:"auto"}}>
              {filteredPlayers.map(p=>(
                <button key={p.name} onClick={()=>{setQuery(p.name);setOwnTeam(p.team||"");setForm(f=>({...f,player:p.name,outPlayers:[]}));}}
                  style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"9px 12px",background:"rgba(10,14,28,.99)",border:"none",borderBottom:"1px solid rgba(255,255,255,.05)",color:"#E5E7EB",fontFamily:"Inter,sans-serif",cursor:"pointer",textAlign:"left"}}>
                  {p.photo_url&&<div style={{width:26,height:26,borderRadius:"50%",overflow:"hidden",flexShrink:0,WebkitTransform:"translateZ(0)",transform:"translateZ(0)"}}><img src={p.photo_url} loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 12%",display:"block"}} onError={e=>e.target.parentElement.style.display="none"} alt=""/></div>}
                  <div><div style={{fontWeight:700,fontSize:13}}>{p.name}</div><div style={{fontSize:10,color:"#6B7280"}}>{p.team} · {p.role}</div></div>
                </button>
              ))}
            </div>
          )}
          {ownTeam&&(
            <div style={{marginTop:10}}>
              <div style={{fontSize:11,color:"#6B7280",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Joueurs OUT - quelle équipe ?</div>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                {[{k:"own",l:ownTeam||"Mon équipe"},{k:"opp",l:"Équipe adverse"}].map(s=>(
                  <button key={s.k} onClick={()=>setTeamSide(s.k)} style={{flex:1,padding:"7px",borderRadius:8,border:"1.5px solid "+(teamSide===s.k?"rgba(124,58,237,.4)":"rgba(255,255,255,.07)"),background:teamSide===s.k?"rgba(124,58,237,.1)":"transparent",color:teamSide===s.k?"#a78bfa":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{s.l}</button>
                ))}
              </div>
              {teamSide==="opp"&&<input style={{...inp,marginBottom:8}} placeholder="Nom équipe adverse…" value={oppTeam} onChange={e=>setOppTeam(e.target.value)}/>}
              <div style={{display:"flex",flexWrap:"wrap",gap:6,maxHeight:180,overflowY:"auto"}}>
                {getTeammates(teamSide==="own"?ownTeam:oppTeam).map(p=>{
                  const isOut=form.outPlayers.includes(p.name);
                  return(<button key={p.name} onClick={()=>toggleOut(p.name)} style={{padding:"5px 11px",borderRadius:20,border:"1.5px solid "+(isOut?"rgba(239,68,68,.5)":"rgba(255,255,255,.08)"),background:isOut?"rgba(239,68,68,.12)":"rgba(255,255,255,.02)",color:isOut?"#f87171":"#8a9eb8",fontSize:11,fontWeight:isOut?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{isOut?"❌ ":""}{p.name}</button>);
                })}
                {getTeammates(teamSide==="own"?ownTeam:oppTeam).length===0&&<div style={{fontSize:11,color:"#4a5a6e"}}>Aucun coéquipier trouvé</div>}
              </div>
              {form.outPlayers.length>0&&<div style={{fontSize:10,color:"#f87171",marginTop:6,fontWeight:600}}>❌ OUT : {form.outPlayers.join(", ")}</div>}
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:12}}>
            <div><div style={{fontSize:10,color:"#6B7280",marginBottom:4,fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>Ligne AVANT</div><input style={inp} type="number" step="0.5" placeholder="ex: 24.5" value={form.cutBefore} onChange={e=>setForm(f=>({...f,cutBefore:e.target.value}))}/></div>
            <div><div style={{fontSize:10,color:"#6B7280",marginBottom:4,fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>Ligne APRÈS</div><input style={inp} type="number" step="0.5" placeholder="ex: 27.5" value={form.cutAfter} onChange={e=>setForm(f=>({...f,cutAfter:e.target.value}))}/></div>
          </div>
          <input style={{...inp,marginTop:8}} placeholder="Note (optionnel)…" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/>
          <button onClick={addEntry} disabled={!form.player||!form.cutBefore} style={{width:"100%",marginTop:10,marginBottom:14,padding:"11px",borderRadius:10,border:"none",background:(!form.player||!form.cutBefore)?"rgba(255,255,255,.05)":"linear-gradient(135deg,#7C3AED,#3B82F6)",color:(!form.player||!form.cutBefore)?"#4a5a6e":"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>+ Ajouter au tracker</button>
        </div></div>
      )}
      {filteredEntries.length===0?(
        <div style={{textAlign:"center",padding:"32px 16px",color:"#4a5a6e"}}><div style={{fontSize:28,marginBottom:8}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></div><div style={{fontSize:13,fontWeight:600}}>Aucune annonce trackée</div><div style={{fontSize:11,marginTop:4}}>Ajoute une annonce NBA pour voir comment les lignes bougent</div></div>
      ):filteredEntries.map(entry=>{
        const delta=entry.cutAfter!=null?entry.cutAfter-entry.cutBefore:null;
        const deltaColor=delta===null?"#6B7280":delta>0?"#22C55E":delta<0?"#f87171":"#9CA3AF";
        const signal=delta===null?null:delta>0?"📈 Ligne monte":delta<0?"📉 Ligne descend":"➡️ Stable";
        return(
          <div key={entry.id} style={cardS}><div style={{padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
              <div><div style={{fontWeight:800,fontSize:14,color:"#E5E7EB",textTransform:"capitalize"}}>{entry.player}</div><div style={{fontSize:10,color:"#6B7280",marginTop:2}}>{entry.team} · {entry.date}</div></div>
              {signal&&<div style={{fontSize:11,fontWeight:700,color:deltaColor,background:deltaColor+"20",padding:"3px 8px",borderRadius:6}}>{signal} {delta!=null&&(delta>0?"+":"")+delta.toFixed(1)}</div>}
            </div>
            {entry.outPlayers&&entry.outPlayers.length>0&&(
              <div style={{marginBottom:8}}>{entry.outPlayers.map(o=><span key={o} style={{display:"inline-block",background:"rgba(239,68,68,.12)",color:"#f87171",fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:10,border:"1px solid rgba(239,68,68,.25)",marginRight:4}}>❌ {o}</span>)}</div>
            )}
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:entry.note?6:0}}>
              <div style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"6px 10px",textAlign:"center"}}><div style={{fontSize:11,color:"#6B7280",fontWeight:600,marginBottom:2}}>AVANT</div><div style={{fontSize:18,fontWeight:900,color:"#c4b5fd"}}>{entry.cutBefore.toFixed(1)}</div></div>
              <div style={{color:"#4a5a6e",fontSize:16}}>→</div>
              {entry.cutAfter!=null?(
                <div style={{background:"rgba(255,255,255,.04)",borderRadius:8,padding:"6px 10px",textAlign:"center"}}><div style={{fontSize:11,color:"#6B7280",fontWeight:600,marginBottom:2}}>APRÈS</div><div style={{fontSize:18,fontWeight:900,color:deltaColor}}>{entry.cutAfter.toFixed(1)}</div></div>
              ):(
                <div style={{flex:1}}><div style={{fontSize:10,color:"#6B7280",marginBottom:4,fontWeight:600}}>Ligne après (à remplir)</div><input style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"7px 10px",color:"#E5E7EB",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none"}} type="number" step="0.5" placeholder="ex: 27.5" onBlur={e=>e.target.value&&updateCutAfter(entry.id,e.target.value)}/></div>
              )}
            </div>
            {entry.note&&<div style={{fontSize:11,color:"#8a9eb8",fontStyle:"italic",marginBottom:4}}>{entry.note}</div>}
            <button onClick={()=>removeEntry(entry.id)} style={{background:"none",border:"none",color:"#3a4a5e",fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif",padding:0,marginTop:4}}>🗑 Supprimer</button>
          </div></div>
        );
      })}
    </div>
  );
}

// ── VictoireEquipeView ─────────────────────────────────────────────────────────
function VictoireEquipeView({bets,setBets,bookmakers,bkPhotos,BK_LOGOS,showToast,allPlayers}){
  const SUPA_ROW_VB="__settings_victoire_bets__";
  function loadVB(){try{return JSON.parse(localStorage.getItem("v7_victoire_bets")||"[]");}catch(e){return[];}}
  function saveVB(d){
    try{localStorage.setItem("v7_victoire_bets",JSON.stringify(d));}catch(e){}
    supaSettingsSave(SUPA_ROW_VB,d);
  }
  useEffect(()=>{
    supaSettingsLoad(SUPA_ROW_VB).then(d=>{
      if(d&&Array.isArray(d)&&d.length>0){
        setVBets(prev=>{
          // Merge : union par id, Supabase gagne si plus récent
          const localMap=Object.fromEntries(prev.map(b=>[b.id,b]));
          const merged=[...prev];
          d.forEach(b=>{if(!localMap[b.id])merged.push(b);});
          try{localStorage.setItem("v7_victoire_bets",JSON.stringify(merged));}catch(e){}
          return merged;
        });
      }
    }).catch(()=>{});
  },[]);
  const LEAGUES=["Pro A","ACB","Lega","Bundesliga","EuroLeague","EuroCup","BCL"];
  const HANDICAP_VALUES=[];for(let v=0.5;v<=34.5;v+=0.5)HANDICAP_VALUES.push(v);
  const THREEPT_VALUES=[];for(let v=0.5;v<=19.5;v+=0.5)THREEPT_VALUES.push(v);
  function getDefaultCompet(date){const d=date?new Date(date):new Date();const dow=d.getDay();return(dow>=2&&dow<=5)?"euro":"champ";}
  const [vBets,setVBets]=useState(loadVB);
  const [form,setForm]=useState({bookmaker:"",league:"Pro A",team:"",betType:"victoire",handicapSign:"+",handicapVal:"3.5",threeptOU:"Over",threeptVal:"8.5",opponent:"",odds:"",stake:"",datetime:new Date().toISOString().slice(0,16),competitionType:getDefaultCompet(new Date()),outPlayers_own:[],outPlayers_opp:[],note:"",status:"pending"});
  const [outSectionOpen,setOutSectionOpen]=useState(false);
  const [outSide,setOutSide]=useState("own");
  const [showForm,setShowForm]=useState(true);
  const teams=EURO_TEAMS[form.league]||[];
  const opponents=teams.filter(t=>t!==form.team);
  function getPlayersOfTeam(teamName){return Object.values(allPlayers).filter(p=>p.team===teamName);}
  function toggleOut(side,name){const field=side==="own"?"outPlayers_own":"outPlayers_opp";setForm(f=>({...f,[field]:f[field].includes(name)?f[field].filter(x=>x!==name):[...f[field],name]}));}
  function getBetDescription(){
    if(!form.team)return"";
    if(form.betType==="victoire")return"Victoire "+form.team;
    if(form.betType==="handicap")return form.team+" "+(form.handicapSign==="+"?"+":"-")+parseFloat(form.handicapVal).toFixed(1);
    if(form.betType==="3pts")return form.team+" "+form.threeptOU+" "+parseFloat(form.threeptVal).toFixed(1)+" 3 Pts";
    if(form.betType==="longterme")return"Long terme — "+form.team;
    return form.team;
  }
  function addVBet(){
    if(!form.bookmaker||!form.team||!form.odds||!form.stake){showToast("Remplis tous les champs requis","#EF4444");return;}
    const descr=form.note.trim()||getBetDescription();
    const profit=form.status==="won"?parseFloat(form.stake)*(parseFloat(form.odds)-1):form.status==="lost"?-parseFloat(form.stake):0;
    const newBet={id:Date.now(),bookmaker:form.bookmaker,league:form.league,competition:form.competitionType,team:form.team,betType:form.betType,handicapSign:form.handicapSign,handicapVal:form.handicapVal,opponent:form.opponent,description:descr,odds:parseFloat(form.odds),stake:parseFloat(form.stake),status:form.status,profit,datetime:form.datetime,outPlayers_own:form.outPlayers_own,outPlayers_opp:form.outPlayers_opp,note:form.note};
    const updated=[newBet,...vBets];setVBets(updated);saveVB(updated);
    showToast("✓ "+descr+" ajouté","#00E676");
    setForm(f=>({...f,team:"",opponent:"",odds:"",stake:"",outPlayers_own:[],outPlayers_opp:[],note:"",status:"pending"}));
  }
  function updateVStatus(id,status){const updated=vBets.map(b=>{if(b.id!==id)return b;const profit=status==="won"?b.stake*(b.odds-1):status==="lost"?-b.stake:0;return{...b,status,profit};});setVBets(updated);saveVB(updated);}
  function deleteVBet(id){const u=vBets.filter(b=>b.id!==id);setVBets(u);saveVB(u);}
  const settled=vBets.filter(b=>b.status!=="pending");
  const totalProfit=settled.reduce((s,b)=>s+(b.profit||0),0);
  const won=settled.filter(b=>b.status==="won").length;
  const wr=settled.length>0?won/settled.length*100:0;
  const STATUS_C={pending:"#3B82F6",won:"#00E676",lost:"#EF4444"};
  const STATUS_LABELS={pending:"En attente",won:"Gagné",lost:"Perdu"};
  const STATUS_ICONS={pending:"●",won:"✓",lost:"✕"};

  // Team logo helper
  const getTeamLogo=(teamName)=>TEAM_LOGOS[teamName]||EL_TEAM_LOGOS[teamName]||NBA_TEAM_LOGOS[teamName]||null;

  const inp={width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.10)",borderRadius:12,padding:"13px 14px",color:"#E5E7EB",fontSize:15,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"};
  const sel={...inp,cursor:"pointer"};

  const teamLogo=getTeamLogo(form.team);

  return(
    <div style={{paddingBottom:16}}>

      {/* ── Résumé stats ── */}
      {settled.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
          {[
            {v:(totalProfit>=0?"+":"")+totalProfit.toFixed(0)+"$",l:"Profit",c:totalProfit>=0?"#22C55E":"#f87171"},
            {v:wr.toFixed(0)+"%",l:"Win Rate",c:wr>=55?"#22C55E":wr<45?"#f87171":"#9CA3AF"},
            {v:settled.length,l:"Paris",c:"#E5E7EB"},
          ].map(s=>(
            <div key={s.l} style={{background:"rgba(124,58,237,.08)",border:"1px solid rgba(124,58,237,.18)",borderRadius:12,padding:"10px 0",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:900,color:s.c}}>{s.v}</div>
              <div style={{fontSize:9,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Formulaire ── */}
      <div style={{background:"#0D1117",border:"1px solid rgba(255,255,255,.07)",borderRadius:18,overflow:"hidden",marginBottom:14}}>

        {/* Header équipe sélectionnée */}
        <div style={{background:"rgba(255,255,255,.03)",borderBottom:"1px solid rgba(255,255,255,.06)",padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:46,height:46,borderRadius:12,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}>
            {teamLogo
              ?<img src={teamLogo} alt={form.team} style={{width:40,height:40,objectFit:"contain"}}/>
              :<span style={{fontSize:22}}>🏀</span>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:800,fontSize:16,color:form.team?"#E5E7EB":"#6B7280",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
              {form.team||"Choisir une équipe"}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:2}}>
              <GameLogo game={form.league} size={13}/>
              <span style={{fontSize:12,color:"#6B7280"}}>{form.league}</span>
            </div>
          </div>
          <div style={{fontSize:20,color:"#374151"}}>›</div>
        </div>

        <div style={{padding:"16px"}}>

          {/* Ligue */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Ligue</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {LEAGUES.map(lg=>{const on=form.league===lg;return(
                <button key={lg} onClick={()=>setForm(f=>({...f,league:lg,team:"",opponent:"",competitionType:getDefaultCompet(f.datetime)}))}
                  style={{display:"flex",alignItems:"center",gap:4,padding:"5px 10px",borderRadius:20,border:"1.5px solid "+(on?"#7C3AED":"rgba(255,255,255,.08)"),background:on?"rgba(124,58,237,.15)":"rgba(255,255,255,.02)",cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s"}}>
                  <GameLogo game={lg} size={14}/>
                  <span style={{fontSize:11,fontWeight:700,color:on?"#a78bfa":"#6B7280"}}>{lg}</span>
                </button>
              );})}
            </div>
          </div>

          {/* Équipe */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Équipe</div>
            <select style={sel} value={form.team} onChange={e=>setForm(f=>({...f,team:e.target.value}))}>
              <option value="">Choisir une équipe…</option>
              {teams.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Type de pari */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Type de pari</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              {[{k:"victoire",l:"Victoire",i:"🏆"},{k:"handicap",l:"Handicap",i:"📊"},{k:"3pts",l:"3 Pts",i:"🎯"},{k:"longterme",l:"Long terme",i:"📈"}].map(t=>{const on=form.betType===t.k;return(
                <button key={t.k} onClick={()=>setForm(f=>({...f,betType:t.k}))}
                  style={{padding:"11px 6px",borderRadius:12,border:"1.5px solid "+(on?"#7C3AED":"rgba(255,255,255,.08)"),background:on?"rgba(124,58,237,.15)":"rgba(255,255,255,.02)",color:on?"#a78bfa":"#6B7280",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <span style={{fontSize:16}}>{t.i}</span>{t.l}
                </button>
              );})}
            </div>
          </div>

          {/* Handicap value si mode handicap */}
          {form.betType==="handicap"&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Handicap</div>
              <div style={{display:"grid",gridTemplateColumns:"88px 1fr",gap:8}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                  {["+","-"].map(s=>(
                    <button key={s} onClick={()=>setForm(f=>({...f,handicapSign:s}))}
                      style={{padding:"13px 0",borderRadius:10,border:"1.5px solid "+(form.handicapSign===s?(s==="+"?"rgba(34,197,94,.5)":"rgba(248,113,113,.5)"):"rgba(255,255,255,.08)"),background:form.handicapSign===s?(s==="+"?"rgba(34,197,94,.1)":"rgba(248,113,113,.1)"):"rgba(255,255,255,.02)",color:form.handicapSign===s?(s==="+"?"#22C55E":"#f87171"):"#6B7280",fontWeight:900,fontSize:18,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{s}</button>
                  ))}
                </div>
                <select style={sel} value={form.handicapVal} onChange={e=>setForm(f=>({...f,handicapVal:e.target.value}))}>
                  {HANDICAP_VALUES.map(v=><option key={v} value={String(v)}>{v.toFixed(1)}</option>)}
                </select>
              </div>
              {form.team&&<div style={{marginTop:6,fontSize:13,color:"#c4b5fd",fontWeight:700}}>→ {form.team} {form.handicapSign}{parseFloat(form.handicapVal).toFixed(1)}</div>}
            </div>
          )}

          {/* 3 Pts config */}
          {form.betType==="3pts"&&(
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Paniers à 3 pts — équipe</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                {["Over","Under"].map(ou=>{const on=form.threeptOU===ou;return(
                  <button key={ou} onClick={()=>setForm(f=>({...f,threeptOU:ou}))}
                    style={{padding:"12px",borderRadius:12,border:"1.5px solid "+(on?(ou==="Over"?"rgba(34,197,94,.5)":"rgba(248,113,113,.5)"):"rgba(255,255,255,.08)"),background:on?(ou==="Over"?"rgba(34,197,94,.1)":"rgba(248,113,113,.1)"):"rgba(255,255,255,.02)",color:on?(ou==="Over"?"#22C55E":"#f87171"):"#6B7280",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                    {ou==="Over"?"🔼 Over":"🔽 Under"}
                  </button>
                );})}
              </div>
              <select style={sel} value={form.threeptVal} onChange={e=>setForm(f=>({...f,threeptVal:e.target.value}))}>
                {THREEPT_VALUES.map(v=><option key={v} value={String(v)}>{v.toFixed(1)} 3 Pts</option>)}
              </select>
              {form.team&&<div style={{marginTop:6,fontSize:13,color:"#34d399",fontWeight:700}}>🎯 {form.team} {form.threeptOU} {parseFloat(form.threeptVal).toFixed(1)} 3 Pts</div>}
            </div>
          )}

          {/* Cote + Mise */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
            <div>
              <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Cote</div>
              <input style={inp} type="number" step="0.01" placeholder="ex: 1.85" value={form.odds} onChange={e=>setForm(f=>({...f,odds:e.target.value}))}/>
            </div>
            <div>
              <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Mise ($)</div>
              <input style={inp} type="number" step="1" placeholder="ex: 50" value={form.stake} onChange={e=>setForm(f=>({...f,stake:e.target.value}))}/>
            </div>
          </div>

          {/* Statut */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Statut</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
              {["pending","won","lost"].map(s=>{const on=form.status===s;return(
                <button key={s} onClick={()=>setForm(f=>({...f,status:s}))}
                  style={{padding:"12px 6px",borderRadius:12,border:"1.5px solid "+(on?STATUS_C[s]:"rgba(255,255,255,.08)"),background:on?STATUS_C[s]+"18":"rgba(255,255,255,.02)",color:on?STATUS_C[s]:"#6B7280",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  <span style={{fontSize:14,fontWeight:900}}>{STATUS_ICONS[s]}</span>{STATUS_LABELS[s]}
                </button>
              );})}
            </div>
          </div>

          {/* Bookmaker */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Bookmaker</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {bookmakers.slice(0,10).map(bk=>{const logo=BK_LOGOS[bk]||bkPhotos[bk]||null;const on=form.bookmaker===bk;return(
                <button key={bk} onClick={()=>setForm(f=>({...f,bookmaker:bk}))}
                  style={{width:46,height:46,borderRadius:12,border:"1.5px solid "+(on?"#7C3AED":"rgba(255,255,255,.08)"),background:on?"rgba(124,58,237,.15)":"rgba(255,255,255,.02)",cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                  {logo?<img src={logo} alt={bk} style={{width:32,height:32,borderRadius:8,objectFit:"cover"}}/>:<span style={{fontSize:10,fontWeight:700,color:on?"#A78BFA":"#6B7280"}}>{bk.slice(0,3)}</span>}
                </button>
              );})}
            </div>
          </div>

          {/* Adversaire (optionnel) */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Équipe adverse <span style={{fontSize:9,color:"#374151",fontWeight:400,textTransform:"none"}}>(optionnel)</span></div>
            <select style={sel} value={form.opponent} onChange={e=>setForm(f=>({...f,opponent:e.target.value}))}>
              <option value="">Choisir équipe adverse…</option>
              {opponents.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Date */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Date / Heure</div>
            <input style={inp} type="datetime-local" value={form.datetime} onChange={e=>setForm(f=>({...f,datetime:e.target.value,competitionType:getDefaultCompet(e.target.value)}))}/>
          </div>

          {/* Compétition */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Compétition</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {[{k:"champ",l:"🏀 Championnat"},{k:"euro",l:"🌍 Euroligue/Eurocup"}].map(c=>{const on=form.competitionType===c.k;return(
                <button key={c.k} onClick={()=>setForm(f=>({...f,competitionType:c.k}))}
                  style={{padding:"11px",borderRadius:12,border:"1.5px solid "+(on?"#7C3AED":"rgba(255,255,255,.08)"),background:on?"rgba(124,58,237,.1)":"rgba(255,255,255,.02)",color:on?"#a78bfa":"#6B7280",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{c.l}</button>
              );})}
            </div>
          </div>

          {/* Annonces OUT */}
          <div style={{marginBottom:16}}>
            <button onClick={()=>setOutSectionOpen(v=>!v)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,padding:"12px 14px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <span style={{fontSize:14}}>📣</span>
                <span style={{fontSize:12,fontWeight:700,color:(form.outPlayers_own.length+form.outPlayers_opp.length)>0?"#f87171":"#6B7280"}}>
                  Annonces OUT{(form.outPlayers_own.length+form.outPlayers_opp.length)>0?" ("+(form.outPlayers_own.length+form.outPlayers_opp.length)+")":""}
                </span>
              </div>
              <span style={{color:"#4a5a6e",fontSize:11}}>{outSectionOpen?"▲":"▼"}</span>
            </button>
            {outSectionOpen&&(
              <div style={{border:"1px solid rgba(255,255,255,.07)",borderTop:"none",borderRadius:"0 0 12px 12px",padding:"12px 14px"}}>
                <div style={{display:"flex",gap:6,marginBottom:10}}>
                  {[{k:"own",l:form.team||"Mon équipe"},{k:"opp",l:form.opponent||"Équipe adverse"}].map(s=>(
                    <button key={s.k} onClick={()=>setOutSide(s.k)} style={{flex:1,padding:"8px",borderRadius:9,border:"1.5px solid "+(outSide===s.k?"rgba(239,68,68,.4)":"rgba(255,255,255,.07)"),background:outSide===s.k?"rgba(239,68,68,.08)":"transparent",color:outSide===s.k?"#f87171":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{s.l}</button>
                  ))}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {getPlayersOfTeam(outSide==="own"?form.team:form.opponent).map(p=>{
                    const field=outSide==="own"?"outPlayers_own":"outPlayers_opp";
                    const isOut=form[field].includes(p.name);
                    return(<button key={p.name} onClick={()=>toggleOut(outSide,p.name)} style={{padding:"5px 12px",borderRadius:20,border:"1.5px solid "+(isOut?"rgba(239,68,68,.5)":"rgba(255,255,255,.07)"),background:isOut?"rgba(239,68,68,.1)":"rgba(255,255,255,.02)",color:isOut?"#f87171":"#8a9eb8",fontSize:11,fontWeight:isOut?700:400,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{isOut?"❌ ":""}{p.name}</button>);
                  })}
                  {getPlayersOfTeam(outSide==="own"?form.team:form.opponent).length===0&&<div style={{fontSize:11,color:"#4a5a6e"}}>{outSide==="own"&&!form.team?"Sélectionne une équipe":outSide==="opp"&&!form.opponent?"Sélectionne l'adversaire":"Pas de joueurs enregistrés pour cette équipe"}</div>}
                </div>
              </div>
            )}
          </div>

          {/* Description libre */}
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Description</div>
            <input style={{...inp,color:"#fff"}} placeholder="ex: Victoire à domicile, forme récente…" value={form.note} onChange={e=>setForm(f=>({...f,note:e.target.value}))}/>
          </div>

          {/* Bouton principal */}
          <button onClick={addVBet}
            style={{width:"100%",padding:"16px",borderRadius:14,border:"none",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",color:"#fff",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"Inter,sans-serif",letterSpacing:.3}}>
            Ajouter le pari
          </button>
        </div>
      </div>

      {/* ── Liste des paris ── */}
      {vBets.length===0?(
        <div style={{textAlign:"center",padding:"32px 16px",color:"#4a5a6e"}}><div style={{fontSize:28,marginBottom:8}}>🏆</div><div style={{fontSize:13,fontWeight:600}}>Aucun pari victoire enregistré</div></div>
      ):vBets.map(b=>{
        const isPending=b.status==="pending";const isWon=b.status==="won";const col=STATUS_C[b.status];
        const bLogo=getTeamLogo(b.team);
        // Titre propre selon le type
        const cardTitle=(()=>{
          if(b.betType==="victoire")return b.team||b.description;
          if(b.betType==="handicap")return b.team+(b.handicapSign||"")+(b.handicapVal?parseFloat(b.handicapVal).toFixed(1):"");
          if(b.betType==="3pts")return b.team+" "+(b.threeptOU||"Over")+" "+(b.threeptVal?parseFloat(b.threeptVal).toFixed(1):"")+"s 3s";
          if(b.betType==="longterme")return b.team;
          return b.description||b.team;
        })();
        return(
          <div key={b.id} style={{background:"#0D1117",border:"1px solid rgba(255,255,255,.07)",borderLeft:"3px solid "+col+(isPending?"":"AA"),borderRadius:14,marginBottom:10,overflow:"hidden"}}>
            <div style={{padding:"13px 14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                {/* Carré logo club */}
                <div style={{width:40,height:40,borderRadius:10,background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.08)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden"}}>
                  {bLogo
                    ?<img src={bLogo} alt={b.team} style={{width:36,height:36,objectFit:"contain"}}/>
                    :<span style={{fontSize:20}}>🏀</span>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:14,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",marginBottom:2}}>{cardTitle}</div>
                  <div style={{fontSize:11,color:"#6B7280"}}>@{b.odds} · {b.bookmaker}{b.opponent?" · vs "+b.opponent:""}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontWeight:800,fontSize:16,color:isPending?"#3B82F6":isWon?"#22C55E":"#f87171"}}>
                    {isPending?"@"+b.odds:((b.profit||0)>=0?"+":"")+(b.profit||0).toFixed(0)+"$"}
                  </div>
                  <div style={{fontSize:10,color:"#6B7280",marginTop:1}}>{b.stake}$</div>
                </div>
              </div>
              {((b.outPlayers_own||[]).length+(b.outPlayers_opp||[]).length)>0&&(
                <div style={{marginBottom:8,display:"flex",flexWrap:"wrap",gap:4}}>
                  {(b.outPlayers_own||[]).map(o=><span key={o} style={{fontSize:9,fontWeight:700,color:"#f87171",background:"rgba(239,68,68,.1)",padding:"2px 7px",borderRadius:8}}>❌ {o}</span>)}
                  {(b.outPlayers_opp||[]).map(o=><span key={o} style={{fontSize:9,fontWeight:700,color:"#fb923c",background:"rgba(251,146,60,.1)",padding:"2px 7px",borderRadius:8}}>❌ adv {o}</span>)}
                </div>
              )}
              {isPending&&(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                  <button onClick={()=>updateVStatus(b.id,"won")} style={{padding:"10px",borderRadius:10,border:"1px solid rgba(34,197,94,.3)",background:"rgba(34,197,94,.06)",color:"#22C55E",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><span style={{fontWeight:900}}>✓</span> Gagné</button>
                  <button onClick={()=>updateVStatus(b.id,"lost")} style={{padding:"10px",borderRadius:10,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.06)",color:"#f87171",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}><span style={{fontWeight:900}}>✕</span> Perdu</button>
                </div>
              )}
              <button onClick={()=>deleteVBet(b.id)} style={{background:"none",border:"none",color:"#3a4a5e",fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif",padding:0}}>🗑 Supprimer</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── PariCombineView ────────────────────────────────────────────────────────────
function PariCombineView({bets,allPlayers,bookmakers,bkPhotos,BK_LOGOS,showToast}){
  const SUPA_ROW_CB="__settings_combine_bets__";
  function loadCB(){try{return JSON.parse(localStorage.getItem("v7_combine_bets")||"[]");}catch(e){return[];}}
  function saveCB(d){
    try{localStorage.setItem("v7_combine_bets",JSON.stringify(d));}catch(e){}
    supaSettingsSave(SUPA_ROW_CB,d);
  }
  useEffect(()=>{
    supaSettingsLoad(SUPA_ROW_CB).then(d=>{
      if(d&&Array.isArray(d)&&d.length>0){
        setCBets(prev=>{
          const localMap=Object.fromEntries(prev.map(b=>[b.id,b]));
          const merged=[...prev];
          d.forEach(b=>{if(!localMap[b.id])merged.push(b);});
          try{localStorage.setItem("v7_combine_bets",JSON.stringify(merged));}catch(e){}
          return merged;
        });
      }
    }).catch(()=>{});
  },[]);
  const BET_TYPES=["Points","Passes","Rebonds","3 Points","Pts+Passes+Rbs","Blocs","Interceptions"];
  const LINE_VALUES=[];for(let v=0.5;v<=60.5;v+=0.5)LINE_VALUES.push(v);
  const [combineBets,setCombineBets]=useState(loadCB);
  const [bookmaker,setBookmaker]=useState("");
  const [query,setQuery]=useState("");
  const [selections,setSelections]=useState([]);
  const [globalOdds,setGlobalOdds]=useState("");
  const [stake,setStake]=useState("");
  const [status,setStatus]=useState("pending");
  const [datetime,setDatetime]=useState(new Date().toISOString().slice(0,16));
  const allPlayersList=useMemo(()=>Object.values(allPlayers),[allPlayers]);
  const searchResults=useMemo(()=>{if(!query||query.length<1)return[];const q=query.toLowerCase().trim();return allPlayersList.filter(p=>(p.name||"").toLowerCase().includes(q)).slice(0,8);},[allPlayersList,query]);
  function addPlayerToCombo(player){
    if(selections.find(s=>s.player===player.name)){showToast(player.name+" déjà dans le combiné","#F59E0B");return;}
    setSelections(prev=>[...prev,{id:Date.now(),player:player.name,team:player.team||"",role:player.role||"",game:player.game||"NBA",betType:"Points",direction:"Over",value:"20.5"}]);
    setQuery("");
  }
  function updateSel(id,field,val){setSelections(prev=>prev.map(s=>s.id===id?{...s,[field]:val}:s));}
  function removeSel(id){setSelections(prev=>prev.filter(s=>s.id!==id));}
  function addCombo(){
    if(!bookmaker||selections.length<2||!globalOdds||!stake){showToast("Complète tous les champs et ajoute au moins 2 joueurs","#EF4444");return;}
    const profit=status==="won"?parseFloat(stake)*(parseFloat(globalOdds)-1):status==="lost"?-parseFloat(stake):0;
    const newCombo={id:Date.now(),bookmaker,selections:selections.map(s=>({...s})),odds:parseFloat(globalOdds),stake:parseFloat(stake),status,profit,datetime};
    const updated=[newCombo,...combineBets];setCombineBets(updated);saveCB(updated);
    showToast("✓ Combiné "+selections.length+" joueurs ajouté","#00E676");
    setSelections([]);setGlobalOdds("");setStake("");setStatus("pending");
  }
  function updateCStatus(id,st){const updated=combineBets.map(b=>{if(b.id!==id)return b;const profit=st==="won"?b.stake*(b.odds-1):st==="lost"?-b.stake:0;return{...b,status:st,profit};});setCombineBets(updated);saveCB(updated);}
  function deleteCombo(id){const u=combineBets.filter(b=>b.id!==id);setCombineBets(u);saveCB(u);}
  const settled=combineBets.filter(b=>b.status!=="pending");
  const totalProfit=settled.reduce((s,b)=>s+(b.profit||0),0);
  const STATUS_C={pending:"#3B82F6",won:"#00E676",lost:"#EF4444"};
  const inp={width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"9px 12px",color:"#E5E7EB",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"};
  const cardS={background:"rgba(10,16,34,.98)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,marginBottom:10,overflow:"hidden"};
  return(
    <div>
      {settled.length>0&&(
        <div style={{background:"rgba(124,58,237,.08)",border:"1px solid rgba(124,58,237,.2)",borderRadius:12,padding:"10px 14px",marginBottom:12}}>
          <div style={{display:"flex",gap:16,justifyContent:"center"}}>
            <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:900,color:totalProfit>=0?"#22C55E":"#f87171"}}>{totalProfit>=0?"+":""}{totalProfit.toFixed(0)}$</div><div style={{fontSize:9,color:"#6B7280",fontWeight:700,textTransform:"uppercase",marginTop:2}}>Profit</div></div>
            <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:900,color:"#E5E7EB"}}>{settled.length}</div><div style={{fontSize:9,color:"#6B7280",fontWeight:700,textTransform:"uppercase",marginTop:2}}>Combinés</div></div>
          </div>
        </div>
      )}
      <div style={cardS}><div style={{padding:"14px"}}>
        <div style={{fontSize:12,fontWeight:800,color:"#a78bfa",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Nouveau pari combiné</div>
        {/* Bookmaker */}
        <div style={{marginBottom:10}}><div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Bookmaker</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {bookmakers.slice(0,8).map(bk=>{const logo=BK_LOGOS[bk]||bkPhotos[bk]||null;const on=bookmaker===bk;return(
              <button key={bk} onClick={()=>setBookmaker(bk)} style={{width:44,height:44,borderRadius:10,border:"1.5px solid "+(on?"#A78BFA":"rgba(255,255,255,.08)"),background:on?"rgba(124,58,237,.15)":"rgba(255,255,255,.02)",cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {logo?<img src={logo} alt={bk} style={{width:30,height:30,borderRadius:7,objectFit:"cover"}}/>:<span style={{fontSize:10,fontWeight:700,color:on?"#A78BFA":"#6B7280"}}>{bk.slice(0,3)}</span>}
              </button>
            );})}
          </div>
        </div>
        {/* Recherche */}
        <div style={{marginBottom:10,position:"relative"}}><div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Rechercher un joueur</div>
          <input style={inp} placeholder="Ex: Curry, Lebron, Jokic…" value={query} onChange={e=>setQuery(e.target.value)}/>
          {searchResults.length>0&&(
            <div style={{position:"absolute",zIndex:50,left:0,right:0,border:"1px solid rgba(255,255,255,.1)",borderRadius:8,marginTop:4,background:"#0D1526",overflow:"hidden",maxHeight:240,overflowY:"auto",boxShadow:"0 8px 24px rgba(0,0,0,.5)"}}>
              {searchResults.map(p=>(
                <button key={p.name} onClick={()=>addPlayerToCombo(p)} style={{display:"flex",alignItems:"center",gap:10,width:"100%",padding:"10px 12px",background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,.05)",color:"#E5E7EB",fontFamily:"Inter,sans-serif",cursor:"pointer",textAlign:"left"}}>
                  {p.photo_url&&<div style={{width:28,height:28,borderRadius:"50%",overflow:"hidden",flexShrink:0,WebkitTransform:"translateZ(0)",transform:"translateZ(0)"}}><img src={p.photo_url} loading="lazy" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 12%",display:"block"}} onError={e=>e.target.parentElement.style.display="none"} alt=""/></div>}
                  <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13,textTransform:"capitalize"}}>{p.name}</div><div style={{fontSize:10,color:"#6B7280"}}>{p.team} · {p.game} · {p.role}</div></div>
                  <span style={{fontSize:11,color:"#a78bfa",fontWeight:700,flexShrink:0}}>+ Ajouter</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Sélections */}
        {selections.length===0?(
          <div style={{textAlign:"center",padding:"20px",color:"#4a5a6e",border:"1.5px dashed rgba(255,255,255,.07)",borderRadius:10,marginBottom:10}}><div style={{fontSize:20,marginBottom:4}}>👆</div><div style={{fontSize:12}}>Ajoute des joueurs ci-dessus</div></div>
        ):selections.map((s,idx)=>(
          <div key={s.id} style={{background:"rgba(124,58,237,.06)",border:"1px solid rgba(124,58,237,.2)",borderRadius:10,padding:"10px 12px",marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:12,fontWeight:900,color:"#a78bfa"}}>#{idx+1}</span>
                <span style={{fontWeight:700,fontSize:13,color:"#E5E7EB",textTransform:"capitalize"}}>{s.player}</span>
                <span style={{fontSize:10,color:"#6B7280"}}>{s.team}</span>
              </div>
              <button onClick={()=>removeSel(s.id)} style={{background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",borderRadius:6,padding:"3px 8px",color:"#f87171",fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>✕</button>
            </div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
              {BET_TYPES.map(t=>(
                <button key={t} onClick={()=>updateSel(s.id,"betType",t)} style={{padding:"4px 9px",borderRadius:16,border:"1px solid "+(s.betType===t?"rgba(124,58,237,.5)":"rgba(255,255,255,.08)"),background:s.betType===t?"rgba(124,58,237,.15)":"rgba(255,255,255,.02)",color:s.betType===t?"#a78bfa":"#6B7280",fontSize:10,fontWeight:s.betType===t?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>{t}</button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"90px 1fr",gap:6}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                {["Over","Under"].map(d=>(
                  <button key={d} onClick={()=>updateSel(s.id,"direction",d)} style={{padding:"7px 0",borderRadius:7,border:"1.5px solid "+(s.direction===d?(d==="Over"?"rgba(34,197,94,.4)":"rgba(96,165,250,.4)"):"rgba(255,255,255,.07)"),background:s.direction===d?(d==="Over"?"rgba(34,197,94,.1)":"rgba(96,165,250,.1)"):"rgba(255,255,255,.02)",color:s.direction===d?(d==="Over"?"#22C55E":"#60a5fa"):"#6B7280",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{d==="Over"?"▲ Over":"▼ Under"}</button>
                ))}
              </div>
              <select style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"7px 10px",color:"#c4b5fd",fontSize:14,fontWeight:700,fontFamily:"Inter,sans-serif",outline:"none",cursor:"pointer"}} value={s.value} onChange={e=>updateSel(s.id,"value",e.target.value)}>
                {LINE_VALUES.map(v=><option key={v} value={String(v)}>{v.toFixed(1)}</option>)}
              </select>
            </div>
            <div style={{fontSize:11,color:s.direction==="Over"?"#22C55E":"#60a5fa",fontWeight:700,marginTop:6}}>{s.direction} {parseFloat(s.value).toFixed(1)} {s.betType} - {s.player}</div>
          </div>
        ))}
        {/* Cote + Mise + Statut */}
        {selections.length>=2&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div><div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:4}}>Cote combinée</div><input style={{...inp,fontSize:16,fontWeight:800,color:"#a78bfa"}} type="number" step="0.01" placeholder="ex: 3.45" value={globalOdds} onChange={e=>setGlobalOdds(e.target.value)}/></div>
              <div><div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:4}}>Mise ($)</div><input style={inp} type="number" step="1" placeholder="ex: 25" value={stake} onChange={e=>setStake(e.target.value)}/></div>
            </div>
            {globalOdds&&stake&&<div style={{background:"rgba(124,58,237,.08)",borderRadius:8,padding:"8px 12px",marginBottom:8,fontSize:12,color:"#c4b5fd",fontWeight:600}}>Gain potentiel : +{(parseFloat(stake||0)*(parseFloat(globalOdds||1)-1)).toFixed(0)}$</div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
              {["pending","won","lost"].map(s=>(
                <button key={s} onClick={()=>setStatus(s)} style={{padding:"9px",borderRadius:9,border:"1.5px solid "+(status===s?STATUS_C[s]+"66":"rgba(255,255,255,.07)"),background:status===s?STATUS_C[s]+"18":"rgba(255,255,255,.02)",color:status===s?STATUS_C[s]:"#6B7280",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                  {s==="pending"?"⏳ Attente":s==="won"?"✓ Gagné":"✗ Perdu"}
                </button>
              ))}
            </div>
            <button onClick={addCombo} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>+ Enregistrer le combiné ({selections.length} joueurs)</button>
          </>
        )}
      </div></div>
      {combineBets.length===0?(
        <div style={{textAlign:"center",padding:"32px 16px",color:"#4a5a6e"}}><div style={{display:"flex",justifyContent:"center",marginBottom:8}}><TipsterIcon size={34} color="#4a5a6e" strokeWidth={1.2}/></div><div style={{fontSize:13,fontWeight:600}}>Aucun pari combiné enregistré</div></div>
      ):combineBets.map(cb=>{
        const isPending=cb.status==="pending";const isWon=cb.status==="won";const col=STATUS_C[cb.status];
        return(
          <div key={cb.id} style={{...cardS,borderLeft:"3px solid "+col+"33"}}><div style={{padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div><div style={{fontSize:10,color:"#6B7280",marginBottom:2}}>{cb.bookmaker} · {cb.selections.length} joueurs · @{cb.odds}</div><div style={{fontSize:10,color:"#6B7280"}}>{cb.stake}$ · {cb.datetime?cb.datetime.slice(0,10):""}</div></div>
              <div style={{fontWeight:800,fontSize:16,color:isPending?"#3B82F6":isWon?"#22C55E":"#f87171"}}>{isPending?"@"+cb.odds:((cb.profit||0)>=0?"+":"")+(cb.profit||0).toFixed(0)+"$"}</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:4,marginBottom:8}}>
              {cb.selections.map((s,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12}}>
                  <span style={{color:s.direction==="Over"?"#22C55E":"#60a5fa",fontSize:10,fontWeight:800,minWidth:14}}>{s.direction==="Over"?"▲":"▼"}</span>
                  <span style={{fontWeight:700,color:"#E5E7EB",textTransform:"capitalize"}}>{s.player}</span>
                  <span style={{color:"#6B7280"}}>{s.betType}</span>
                  <span style={{fontWeight:800,color:"#c4b5fd"}}>{parseFloat(s.value).toFixed(1)}</span>
                </div>
              ))}
            </div>
            {isPending&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
                <button onClick={()=>updateCStatus(cb.id,"won")} style={{padding:"8px",borderRadius:8,border:"1px solid rgba(34,197,94,.3)",background:"rgba(34,197,94,.06)",color:"#22C55E",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>✓ Gagné</button>
                <button onClick={()=>updateCStatus(cb.id,"lost")} style={{padding:"8px",borderRadius:8,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.06)",color:"#f87171",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>✗ Perdu</button>
              </div>
            )}
            <button onClick={()=>deleteCombo(cb.id)} style={{background:"none",border:"none",color:"#3a4a5e",fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif",padding:0}}>🗑 Supprimer</button>
          </div></div>
        );
      })}
    </div>
  );
}

// ── LeagueEditor - section Édit dans Suivi ────────────────────────────────────
const POSITION_ORDER=["PG","Point Guard","SG","Shooting Guard","SF","Small Forward","PF","Power Forward","C","Center",""];
function posRank(p){const r=POSITION_ORDER.indexOf(p||"");return r===-1?98:r;}

function PlayerEditModal({playerKey,playerData,allPlayers,setPlayers,showToast,onClose,clickY}){
  const [team,setTeam]=useState(playerData.team||"");
  const [role,setRole]=useState(playerData.role||"");
  const [league,setLeague]=useState(playerData.game||"NBA");
  const [photoUrl,setPhotoUrl]=useState(playerData.photo_url||playerData.avatar_url||"");
  const [uploadingPhoto,setUploadingPhoto]=useState(false);
  const [teamLogoUrl,setTeamLogoUrl]=useState(playerData.team_logo_url||"");
  const [uploadingLogo,setUploadingLogo]=useState(false);
  const [saving,setSaving]=useState(false);
  const [photoRehostFailed,setPhotoRehostFailed]=useState(false);
  const isNBA=league==="NBA";
  const positions=isNBA?["PG","SG","SF","PF","C"]:["Point Guard","Shooting Guard","Small Forward","Power Forward","Center"];
  const teamList=(ALL_LEAGUE_TEAMS[league]||[]).slice().sort();
  const photo=photoUrl||playerData.photo_url||playerData.avatar_url||null;
  const teamLogo=TEAM_LOGOS[team]||EL_TEAM_LOGOS[team]||NBA_TEAM_LOGOS[team]||null;
  const sel={width:"100%",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,padding:"12px 14px",color:"#E5E7EB",fontSize:14,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box",appearance:"none",WebkitAppearance:"none"};

  // Centrer le modal sur le point de clic
  const winH=typeof window!=="undefined"?window.innerHeight:800;
  const modalH=500;
  let top=clickY?clickY-modalH/2:winH/2-modalH/2;
  if(top+modalH>winH-12) top=winH-modalH-12;
  if(top<12) top=12;

  async function save(){
    setSaving(true);
    try{
      // Copier les images externes vers Supabase Storage automatiquement
      const finalPhoto=photoUrl.trim()||playerData.photo_url||null;
      const finalLogo=teamLogoUrl.trim()||playerData.team_logo_url||null;
      // Rehost si URL externe (canvas → Supabase)
      const [permanentPhoto,permanentLogo]=await Promise.all([
        finalPhoto?supaRehost(finalPhoto,playerKey):Promise.resolve(null),
        finalLogo?supaRehost(finalLogo,"logo_"+(team||playerKey)):Promise.resolve(null),
      ]);
      // Détecter si le rehost a échoué (URL retournée = même URL externe)
      if(finalPhoto&&permanentPhoto&&!permanentPhoto.includes(SUPA_URL)){
        setPhotoRehostFailed(true);
        setSaving(false);
        // Sauvegarder quand même avec l'URL externe
        const updated={...playerData,team,role,game:league,
          photo_url:finalPhoto,avatar_url:finalPhoto,
          team_logo_url:permanentLogo||finalLogo};
        await supaUpsertPlayer({name:playerKey,...updated});
        setPlayers(p=>({...p,[playerKey]:updated}));
        showToast("Photo externe — lien Supabase impossible","#F59E0B");
        onClose();
        return;
      }
      setPhotoRehostFailed(false);
      const updated={...playerData,team,role,game:league,
        photo_url:permanentPhoto,avatar_url:permanentPhoto,
        team_logo_url:permanentLogo};
      const res=await supaUpsertPlayer({name:playerKey,...updated});
      if(!res) throw new Error("Pas de réponse Supabase");
      setPlayers(p=>({...p,[playerKey]:updated}));
      showToast((playerData.name||playerKey)+" mis à jour ✓","#22C55E");
    }catch(e){
      console.error("Save error:",e);
      // Sauvegarder quand même en local sans rehost
      const updated={...playerData,team,role,game:league,
        photo_url:photoUrl.trim()||playerData.photo_url||null,
        avatar_url:photoUrl.trim()||playerData.avatar_url||null,
        team_logo_url:teamLogoUrl.trim()||playerData.team_logo_url||null};
      setPlayers(p=>({...p,[playerKey]:updated}));
      showToast("Hors ligne — sauvegardé localement","#F59E0B");
    }
    setSaving(false);
    onClose();
  }

  return(
    <>
      {/* Overlay fermeture */}
      <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,.6)"}} onClick={onClose}/>
      {/* Modal positionné exactement au clic */}
      <div style={{position:"fixed",left:"50%",transform:"translateX(-50%)",top,zIndex:9999,width:"calc(100% - 32px)",maxWidth:420,background:"#0a0f1e",borderRadius:18,border:"1px solid rgba(255,255,255,.12)",boxShadow:"0 20px 60px rgba(0,0,0,.8)",overflowY:"auto",maxHeight:"calc(100vh - 24px)"}} onClick={e=>e.stopPropagation()}>

        {/* Player header */}
        <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:"1px solid rgba(255,255,255,.07)"}}>
          {photo?(
            <div style={{width:48,height:48,borderRadius:"50%",overflow:"hidden",flexShrink:0,border:"2px solid rgba(167,139,250,.3)",background:"rgba(124,58,237,.08)",WebkitTransform:"translateZ(0)",transform:"translateZ(0)"}}><CachedImg src={photo} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 12%",display:"block"}}/></div>
          ):(
            <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(124,58,237,.2)",border:"2px solid rgba(124,58,237,.3)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{fontSize:18,fontWeight:800,color:"#a78bfa"}}>{(playerData.name||playerKey).charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{fontSize:15,fontWeight:800,color:"#E5E7EB",textTransform:"capitalize",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{playerData.name||playerKey}</div>
              <button onClick={()=>navigator.clipboard&&navigator.clipboard.writeText(playerData.name||playerKey).then(()=>{})}
                title="Copier le nom"
                style={{flexShrink:0,background:"rgba(255,255,255,.08)",border:"none",borderRadius:6,padding:"2px 6px",color:"#9CA3AF",fontSize:10,cursor:"pointer",fontFamily:"Inter,sans-serif"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3}}>
              {teamLogo&&<img src={teamLogo} alt="" style={{width:13,height:13,objectFit:"contain"}} loading="lazy"/>}
              <span style={{fontSize:11,color:"#6B7280"}}>{team||"Sans équipe"}</span>
              {team&&<button onClick={()=>navigator.clipboard&&navigator.clipboard.writeText(team).then(()=>{})}
                title="Copier l'équipe"
                style={{flexShrink:0,background:"rgba(255,255,255,.08)",border:"none",borderRadius:6,padding:"2px 5px",color:"#9CA3AF",fontSize:9,cursor:"pointer",fontFamily:"Inter,sans-serif"}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>}
              {role&&<span style={{fontSize:10,color:"#a78bfa",background:"rgba(124,58,237,.15)",padding:"1px 6px",borderRadius:8,fontWeight:600}}>{role}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#6B7280",fontSize:20,cursor:"pointer",padding:"0 2px",flexShrink:0}}>×</button>
        </div>

        <div style={{padding:"12px 16px 16px",display:"flex",flexDirection:"column",gap:10}}>

          {/* Photo — upload Supabase ou URL */}
          <div>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
              Photo joueur
              {photoUrl&&(
                photoRehostFailed
                  ?<span title="Impossible d'enregistrer dans Supabase" style={{width:8,height:8,borderRadius:"50%",background:"#EF4444",flexShrink:0,display:"inline-block",boxShadow:"0 0 4px #EF4444"}}/>
                  :!photoUrl.includes(SUPA_URL)
                    ?<span title="Photo externe — pas encore dans Supabase" style={{width:8,height:8,borderRadius:"50%",background:"#FBBF24",flexShrink:0,display:"inline-block",boxShadow:"0 0 4px #FBBF24"}}/>
                    :<span title="Photo hébergée dans Supabase ✓" style={{width:8,height:8,borderRadius:"50%",background:"#22C55E",flexShrink:0,display:"inline-block",boxShadow:"0 0 4px #22C55E"}}/>
              )}
            </div>
            {photoRehostFailed&&<div style={{fontSize:10,color:"#f87171",background:"rgba(239,68,68,.08)",border:"1px solid rgba(239,68,68,.2)",borderRadius:8,padding:"6px 10px",marginBottom:8}}>⚠️ CORS bloqué — essaie d'uploader le fichier directement via le bouton ci-dessous</div>}
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {photoUrl?(
                <div style={{position:"relative",flexShrink:0}}>
                  <img src={photoUrl} alt="" width="36" height="36" style={{width:36,height:36,borderRadius:"50%",objectFit:"cover",objectPosition:"50% 15%",border:"1px solid rgba(255,255,255,.1)"}} onError={e=>e.target.style.display="none"}/>
                  {/* Point statut en bas à droite de la photo */}
                  <span style={{position:"absolute",bottom:0,right:0,width:10,height:10,borderRadius:"50%",background:photoRehostFailed?"#EF4444":photoUrl.includes(SUPA_URL)?"#22C55E":"#FBBF24",border:"2px solid #111827",boxShadow:"0 0 4px "+(photoRehostFailed?"#EF4444":photoUrl.includes(SUPA_URL)?"#22C55E":"#FBBF24")}}/>
                </div>
              ):(
                <div style={{width:36,height:36,borderRadius:"50%",background:"rgba(255,255,255,.06)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#6B7280"}}>👤</div>
              )}
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
                {/* Upload direct Supabase */}
                <label style={{display:"flex",alignItems:"center",gap:6,background:"rgba(124,58,237,.12)",border:"1px solid rgba(124,58,237,.25)",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                  <span style={{fontSize:12,color:"#a78bfa",fontWeight:600}}>{uploadingPhoto?"Envoi...":" Uploader photo"}</span>
                  <input type="file" accept="image/*" style={{display:"none"}} disabled={uploadingPhoto} onChange={async e=>{
                    const file=e.target.files[0];
                    if(!file)return;
                    setUploadingPhoto(true);
                    try{
                      const filename=await supaUploadAvatar(file,playerKey);
                      const url=AVATARS_BUCKET+encodeURIComponent(filename);
                      setPhotoUrl(url);
                      setUploadingPhoto(false);
                    }catch(err){
                      console.error(err);
                      setUploadingPhoto(false);
                      alert("Erreur upload: "+err.message);
                    }
                  }}/>
                </label>
                {/* Coller image depuis presse-papier */}
                <button onClick={async()=>{
                  setUploadingPhoto(true);
                  try{
                    // Lire le presse-papier
                    const items=await navigator.clipboard.read();
                    let imageBlob=null;
                    for(const item of items){
                      const imgType=item.types.find(t=>t.startsWith("image/"));
                      if(imgType){imageBlob=await item.getType(imgType);break;}
                    }
                    if(!imageBlob){
                      // Essayer aussi le texte (URL copiée)
                      const text=await navigator.clipboard.readText().catch(()=>"");
                      if(text&&(text.startsWith("http")||text.startsWith("https"))){
                        setPhotoUrl(text.trim());
                        setUploadingPhoto(false);
                        return;
                      }
                      alert("Aucune image dans le presse-papier — copie d'abord une photo");
                      setUploadingPhoto(false);
                      return;
                    }
                    // Uploader le blob directement dans Supabase
                    const ext=imageBlob.type.includes("png")?"png":imageBlob.type.includes("webp")?"webp":"jpg";
                    const safeName=playerKey.toLowerCase().replace(/[^a-z0-9]/g,"_").slice(0,40);
                    const path="photos/players/"+safeName+"_"+Date.now()+"."+ext;
                    const res=await fetch(SUPA_URL+"/storage/v1/object/avatars/"+path,{
                      method:"POST",
                      headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Content-Type":imageBlob.type,"x-upsert":"true"},
                      body:imageBlob,
                    });
                    if(res.ok){
                      const url=SUPA_URL+"/storage/v1/object/public/avatars/"+path;
                      setPhotoUrl(url);
                      setPhotoRehostFailed(false);
                    }else{
                      const errText=await res.text();
                      alert("Erreur upload Supabase:\n"+res.status+" — "+errText);
                    }
                  }catch(e){
                    alert("Erreur presse-papier : "+e.message+"\n\nSur iPhone, autorise l'accès au presse-papier quand demandé.");
                  }
                  setUploadingPhoto(false);
                }} disabled={uploadingPhoto} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.25)",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif",width:"100%"}}>
                  <span style={{fontSize:12,color:"#34d399",fontWeight:600}}>{uploadingPhoto?"Envoi...":" 📋 Coller image"}</span>
                </button>
                {/* OU coller une URL */}
                <input
                  placeholder="ou colle une URL..."
                  value={photoUrl}
                  onChange={e=>setPhotoUrl(e.target.value)}
                  style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"8px 12px",color:"#E5E7EB",fontSize:11,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box",width:"100%"}}
                />
              </div>
              {photoUrl&&<button onClick={()=>setPhotoUrl("")} style={{flexShrink:0,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",borderRadius:8,padding:"8px 10px",color:"#f87171",fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>×</button>}
            </div>
          </div>

          {/* Logo équipe — upload Supabase ou URL */}
          <div>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Logo équipe</div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {teamLogoUrl?(
                <img src={teamLogoUrl} alt="" width="36" height="36" style={{width:36,height:36,borderRadius:8,objectFit:"contain",flexShrink:0,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.04)",padding:2}} onError={e=>e.target.style.display="none"}/>
              ):(
                <div style={{width:36,height:36,borderRadius:8,background:"rgba(255,255,255,.06)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#6B7280"}}>🏀</div>
              )}
              <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
                <label style={{display:"flex",alignItems:"center",gap:6,background:"rgba(59,130,246,.10)",border:"1px solid rgba(59,130,246,.25)",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                  <span style={{fontSize:12,color:"#60a5fa",fontWeight:600}}>{uploadingLogo?"Envoi...":" Uploader logo"}</span>
                  <input type="file" accept="image/*" style={{display:"none"}} disabled={uploadingLogo} onChange={async e=>{
                    const file=e.target.files[0];
                    if(!file)return;
                    setUploadingLogo(true);
                    try{
                      const filename=await supaUploadAvatar(file,"logo_"+(playerData.team||playerKey));
                      const url=AVATARS_BUCKET+encodeURIComponent(filename);
                      setTeamLogoUrl(url);setUploadingLogo(false);
                    }catch(err){console.error(err);setUploadingLogo(false);alert("Erreur upload: "+err.message);}
                  }}/>
                </label>
                <button onClick={async()=>{setUploadingLogo(true);try{const url=await pasteImageToSupabase("logo_"+(playerData.team||playerKey));setTeamLogoUrl(url);}catch(e){alert("📋 "+e.message);}setUploadingLogo(false);}} disabled={uploadingLogo} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.25)",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif",width:"100%"}}>
                  <span style={{fontSize:12,color:"#34d399",fontWeight:600}}>📋 Coller logo</span>
                </button>
                <input
                  placeholder="ou colle une URL..."
                  value={teamLogoUrl}
                  onChange={e=>setTeamLogoUrl(e.target.value)}
                  style={{background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:10,padding:"8px 12px",color:"#E5E7EB",fontSize:11,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box",width:"100%"}}
                />
              </div>
              {teamLogoUrl&&<button onClick={()=>setTeamLogoUrl("")} style={{flexShrink:0,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",borderRadius:8,padding:"8px 10px",color:"#f87171",fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>×</button>}
            </div>
          </div>

          {/* Ligue */}
          <div>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Ligue</div>
            <div style={{position:"relative"}}>
              <select style={sel} value={league} onChange={e=>{setLeague(e.target.value);setTeam("");}}>
                {["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Lega","Bundesliga","HEBA"].map(g=><option key={g} value={g}>{g}</option>)}
              </select>
              <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"#6B7280",fontSize:11,pointerEvents:"none"}}>▾</span>
            </div>
          </div>

          {/* Equipe */}
          <div>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Équipe</div>
            <div style={{position:"relative"}}>
              <select style={sel} value={team} onChange={e=>setTeam(e.target.value)}>
                <option value="">Choisir une équipe...</option>
                {teamList.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
              <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"#6B7280",fontSize:11,pointerEvents:"none"}}>▾</span>
            </div>
          </div>

          {/* Position */}
          <div>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Position</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {positions.map(pos=>{
                const on=role===pos;
                return(
                  <button key={pos} onClick={()=>setRole(on?"":pos)}
                    style={{padding:"6px 11px",borderRadius:18,border:"1.5px solid "+(on?"rgba(167,139,250,.5)":"rgba(255,255,255,.08)"),background:on?"rgba(124,58,237,.18)":"rgba(255,255,255,.02)",color:on?"#a78bfa":"#6B7280",fontWeight:on?700:500,fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                    {on?"✓ ":""}{pos}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Boutons */}
          <div style={{display:"flex",flexDirection:"column",gap:8,marginTop:2}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <button onClick={onClose} style={{padding:"12px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,color:"#9CA3AF",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Annuler</button>
              <button onClick={save} disabled={saving} style={{padding:"12px",background:saving?"rgba(124,58,237,.4)":"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                {saving?"Copie & sauvegarde...":"Enregistrer"}
              </button>
            </div>
            {/* Supprimer joueur */}
            <button onClick={async()=>{
              if(!window.confirm("Supprimer "+( playerData.name||playerKey)+" ?"))return;
              try{
                if(playerData.id){
                  await fetch(SUPA_URL+"/rest/v1/players?id=eq."+playerData.id,{
                    method:"DELETE",
                    headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY}
                  });
                }
              }catch(e){console.error(e);}
              setPlayers(p=>{const n={...p};delete n[playerKey];return n;});
              // Mettre à jour le cache
              try{
                const cache=JSON.parse(localStorage.getItem("v7_players_cache")||"{}");
                delete cache[playerKey];
                localStorage.setItem("v7_players_cache",JSON.stringify(cache));
              }catch(e){}
              showToast((playerData.name||playerKey)+" supprimé","#EF4444");
              onClose();
            }} style={{padding:"10px",background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.18)",borderRadius:12,color:"#f87171",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif",width:"100%"}}>
              🗑 Supprimer ce joueur
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function LeagueEditor({allPlayers,setPlayers,showToast}){
  const [openLeague,setOpenLeague]=useState(null);
  const [openTeam,setOpenTeam]=useState(null);
  const [editingPlayer,setEditingPlayer]=useState(null);
  const [deletingTeam,setDeletingTeam]=useState(null);
  const [addTeamLeague,setAddTeamLeague]=useState(null);
  const [addTeamName,setAddTeamName]=useState("");
  const [editingTeam,setEditingTeam]=useState(null); // {name, lg} — modal édit club
  const [searchQ,setSearchQ]=useState("");
  const LEAGUES=["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Lega","Bundesliga","HEBA"];

  const searchResults=useMemo(()=>{
    const q=searchQ.toLowerCase().trim();
    if(q.length<2)return{players:[],clubs:[]};
    // Joueurs
    const players=Object.entries(allPlayers)
      .filter(([k,p])=>k.includes(q)||(p.name||"").toLowerCase().includes(q))
      .sort((a,b)=>(a[1].name||a[0]).localeCompare(b[1].name||b[0]))
      .slice(0,5);
    // Clubs
    const seen=new Set();
    const clubs=[];
    Object.entries(ALL_LEAGUE_TEAMS).forEach(([lg,teams])=>{
      teams.filter(t=>t.toLowerCase().includes(q)).forEach(t=>{
        if(!seen.has(t)){seen.add(t);clubs.push({name:t,lg});}
      });
    });
    return{players,clubs:clubs.slice(0,5)};
  },[allPlayers,searchQ]);

  const leagueData=useMemo(()=>{
    const map={};
    LEAGUES.forEach(lg=>{
      map[lg]={};
      (ALL_LEAGUE_TEAMS[lg]||[]).forEach(team=>{map[lg][team]=[];});
    });
    const multiLookup={};
    Object.keys(MULTI_LEAGUE_CLUBS).forEach(name=>{
      multiLookup[name.toLowerCase().trim()]=name;
    });
    Object.entries(allPlayers).forEach(([key,p])=>{
      const primaryLeague=p.game||"NBA";
      const team=p.team||"";
      if(!team){
        if(map[primaryLeague]){
          if(!map[primaryLeague]["Sans equipe"])map[primaryLeague]["Sans equipe"]=[];
          map[primaryLeague]["Sans equipe"].push({key,data:p});
        }
        return;
      }
      const norm=team.toLowerCase().trim();
      const officialName=multiLookup[norm]||null;
      const clubLeagues=officialName?MULTI_LEAGUE_CLUBS[officialName]:null;
      if(clubLeagues){
        clubLeagues.filter(lg=>LEAGUES.includes(lg)).forEach(lg=>{
          if(!map[lg])return;
          if(!map[lg][team])map[lg][team]=[];
          if(!map[lg][team].find(x=>x.key===key)) map[lg][team].push({key,data:p});
        });
      } else {
        if(LEAGUES.includes(primaryLeague)){
          if(!map[primaryLeague][team])map[primaryLeague][team]=[];
          map[primaryLeague][team].push({key,data:p});
        }
      }
    });
    return map;
  },[allPlayers]);

  function handleOpenTeam(key, players){
    setOpenTeam(key);
    // Précharger les photos des joueurs seulement quand on ouvre l'équipe
    if(players && players.length > 0){
      players.forEach(({data})=>{
        if(data.photo_url){
          const img=new Image();
          img.decoding='async';
          img.src=data.photo_url;
        }
      });
    }
  }


  function confirmDeleteTeam(){
    if(!deletingTeam)return;
    const{lg,team}=deletingTeam;
    const toUpdate={};
    Object.entries(allPlayers).forEach(([key,p])=>{
      if(p.team===team&&p.game===lg){
        toUpdate[key]={...p,team:"",game:lg};
      }
    });
    if(Object.keys(toUpdate).length>0){
      setPlayers(prev=>{
        const n={...prev};
        Object.entries(toUpdate).forEach(([k,v])=>{n[k]=v;supaUpsertPlayer({name:k,...v}).catch(()=>{});});
        return n;
      });
    }
    showToast(team+" retire de "+lg,"#EF4444");
    setDeletingTeam(null);
  }

  function addClub(){
    const name=addTeamName.trim();
    if(!name||!addTeamLeague)return;
    // Ajouter dans ALL_LEAGUE_TEAMS runtime (session seulement)
    const list=ALL_LEAGUE_TEAMS[addTeamLeague];
    if(list&&!list.includes(name)){list.push(name);}
    showToast(name+" ajoute en "+addTeamLeague,"#22C55E");
    setAddTeamName("");
    setAddTeamLeague(null);
  }

  return(
    <div style={{marginBottom:16}}>
      <div style={{fontSize:13,fontWeight:700,color:"#E5E7EB",marginBottom:10}}>Édit</div>

      {/* ── Barre de recherche unifiée joueurs + clubs ── */}
      <div style={{position:"relative",marginBottom:12}}>
        <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",color:"#6B7280",fontSize:14,pointerEvents:"none"}}>🔍</div>
        <input
          value={searchQ}
          onChange={e=>setSearchQ(e.target.value)}
          placeholder="Joueur ou club... (ex: Irving, Barcelona)"
          style={{width:"100%",background:"rgba(255,255,255,.05)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,padding:"11px 12px 11px 36px",color:"#E5E7EB",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"}}
        />
        {searchQ&&<button onClick={()=>setSearchQ("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"rgba(255,255,255,.1)",border:"none",borderRadius:"50%",width:20,height:20,color:"#9CA3AF",cursor:"pointer",fontSize:12,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>}
      </div>

      {/* ── Résultats unifiés ── */}
      {searchQ.length>=2&&(searchResults.players.length>0||searchResults.clubs.length>0)&&(
        <div style={{background:"rgba(6,10,20,.95)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,overflow:"hidden",marginBottom:12}}>
          {/* Joueurs */}
          {searchResults.players.length>0&&(
            <>
              {searchResults.clubs.length>0&&<div style={{padding:"5px 14px 3px",fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Joueurs</div>}
              {searchResults.players.map(([key,data])=>{
                const teamLogo=TEAM_LOGOS[data.team]||EL_TEAM_LOGOS[data.team]||NBA_TEAM_LOGOS[data.team]||null;
                const copyText=(txt)=>{navigator.clipboard&&navigator.clipboard.writeText(txt).then(()=>showToast("Copié : "+txt,"#22C55E")).catch(()=>{});};
                return(
                  <div key={key} style={{display:"flex",alignItems:"center",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                    <button onClick={()=>{setEditingPlayer({key,data,clickY:window.innerHeight/2});setSearchQ("");}}
                      style={{flex:1,display:"flex",alignItems:"center",gap:10,padding:"10px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
                      {data.photo_url?(
                        <div style={{width:44,height:44,borderRadius:"50%",overflow:"hidden",flexShrink:0,WebkitTransform:"translateZ(0)",transform:"translateZ(0)",border:"1px solid rgba(255,255,255,.06)"}}><CachedImg src={optimizePhotoUrl(data.photo_url,88)} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 10%",display:"block"}}/></div>
                      ):(
                        <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(124,58,237,.15)",border:"1px solid rgba(124,58,237,.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <span style={{fontSize:13,fontWeight:700,color:"#a78bfa"}}>{(data.name||key).charAt(0).toUpperCase()}</span>
                        </div>
                      )}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#E5E7EB",textTransform:"capitalize",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:5}}>
                          {data.name||key}
                          {data.photo_url&&(data.photo_url.includes(SUPA_URL)?<span title="Photo Supabase ✓" style={{width:6,height:6,borderRadius:"50%",background:"#22C55E",flexShrink:0,display:"inline-block"}}/>:<span title="Photo externe — cliquer pour héberger" style={{width:6,height:6,borderRadius:"50%",background:"#FBBF24",flexShrink:0,display:"inline-block"}}/>)}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:4,marginTop:2}}>
                          {teamLogo&&<img src={teamLogo} alt="" style={{width:11,height:11,objectFit:"contain"}} loading="lazy"/>}
                          <span style={{fontSize:10,color:"#6B7280"}}>{data.team||"Sans équipe"}</span>
                          {data.role&&<span style={{fontSize:9,color:"#a78bfa",background:"rgba(124,58,237,.12)",padding:"1px 5px",borderRadius:6,fontWeight:600}}>{data.role}</span>}
                        </div>
                      </div>
                      <span style={{fontSize:10,color:"#4a5a6e",flexShrink:0}}>✎</span>
                    </button>
                    <div style={{display:"flex",flexDirection:"column",gap:3,paddingRight:10,flexShrink:0}}>
                      <button onClick={e=>{e.stopPropagation();copyText(data.name||key);}}
                        style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",borderRadius:6,padding:"3px 6px",color:"#9CA3AF",fontSize:9,cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600,display:"flex",alignItems:"center",gap:3}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> nom
                      </button>
                      {data.team&&<button onClick={e=>{e.stopPropagation();copyText(data.team);}}
                        style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.08)",borderRadius:6,padding:"3px 6px",color:"#9CA3AF",fontSize:9,cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600,display:"flex",alignItems:"center",gap:3}}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> équipe
                      </button>}
                    </div>
                  </div>
                );
              })}
            </>
          )}
          {/* Clubs */}
          {searchResults.clubs.length>0&&(
            <>
              {searchResults.players.length>0&&<div style={{height:1,background:"rgba(255,255,255,.06)"}}/>}
              {searchResults.clubs.length>0&&<div style={{padding:"5px 14px 3px",fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>Clubs</div>}
              {searchResults.clubs.map((r,i)=>{
                const logo=TEAM_LOGOS[r.name]||EL_TEAM_LOGOS[r.name]||NBA_TEAM_LOGOS[r.name]||null;
                return(
                  <div key={r.name+r.lg} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:i<searchResults.clubs.length-1?"1px solid rgba(255,255,255,.05)":"none",cursor:"pointer"}}
                    onClick={()=>{setEditingTeam({name:r.name,lg:r.lg,logoInput:logo||"",nameInput:r.name});setSearchQ("");}}>
                    {logo?(
                      <img src={logo} alt={r.name} style={{width:28,height:28,objectFit:"contain",flexShrink:0,borderRadius:4}} loading="lazy"/>
                    ):(
                      <div style={{width:28,height:28,borderRadius:4,background:"rgba(255,255,255,.06)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#6B7280"}}>🏀</div>
                    )}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#E5E7EB",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
                      <div style={{fontSize:10,color:"#6B7280",display:"flex",alignItems:"center",gap:4,marginTop:1}}>
                        <GameLogo game={r.lg} size={10}/>
                        <span>{r.lg}</span>
                        {logo&&<span style={{color:"#22C55E",fontSize:9,fontWeight:600}}>● Logo</span>}
                      </div>
                    </div>
                    <span style={{fontSize:10,color:"#4a5a6e"}}>✎</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
      {searchQ.length>=2&&searchResults.players.length===0&&searchResults.clubs.length===0&&(
        <div style={{textAlign:"center",padding:"10px",fontSize:11,color:"#4a5a6e",marginBottom:12}}>Aucun résultat pour "{searchQ}"</div>
      )}



      {/* Player edit modal — fixed position, outside scroll */}
      {editingPlayer&&(
        <PlayerEditModal
          playerKey={editingPlayer.key}
          playerData={editingPlayer.data}
          allPlayers={allPlayers}
          setPlayers={setPlayers}
          showToast={showToast}
          clickY={editingPlayer.clickY}
          onClose={()=>setEditingPlayer(null)}
        />
      )}

      {/* Delete team confirmation — inline */}
      {deletingTeam&&(
        <div style={{position:"fixed",inset:0,zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.7)",padding:16}} onClick={()=>setDeletingTeam(null)}>
          <div style={{background:"#0d1225",borderRadius:18,padding:"22px 20px",maxWidth:320,width:"100%",border:"1px solid rgba(255,255,255,.1)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:"#E5E7EB",marginBottom:8}}>Retirer {deletingTeam.team} ?</div>
            <div style={{fontSize:12,color:"#6B7280",marginBottom:18}}>Les joueurs de cette equipe n'auront plus d'equipe assignee dans {deletingTeam.lg}.</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <button onClick={()=>setDeletingTeam(null)} style={{padding:"12px",background:"rgba(255,255,255,.05)",border:"none",borderRadius:12,color:"#9CA3AF",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Annuler</button>
              <button onClick={confirmDeleteTeam} style={{padding:"12px",background:"rgba(239,68,68,.15)",border:"1px solid rgba(239,68,68,.3)",borderRadius:12,color:"#f87171",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Retirer</button>
            </div>
          </div>
        </div>
      )}

      {/* Add club modal */}
      {addTeamLeague&&(
        <div style={{position:"fixed",inset:0,zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.7)",padding:16}} onClick={()=>setAddTeamLeague(null)}>
          <div style={{background:"#0d1225",borderRadius:18,padding:"22px 20px",maxWidth:320,width:"100%",border:"1px solid rgba(255,255,255,.1)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:"#E5E7EB",marginBottom:4}}>Ajouter un club</div>
            <div style={{fontSize:11,color:"#6B7280",marginBottom:14}}>en {addTeamLeague} (club promu, nouveau club...)</div>
            <input
              autoFocus
              placeholder="Nom du club..."
              value={addTeamName}
              onChange={e=>setAddTeamName(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")addClub();}}
              style={{width:"100%",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,padding:"12px 14px",color:"#E5E7EB",fontSize:14,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box",marginBottom:12}}
            />
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <button onClick={()=>setAddTeamLeague(null)} style={{padding:"12px",background:"rgba(255,255,255,.05)",border:"none",borderRadius:12,color:"#9CA3AF",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Annuler</button>
              <button onClick={addClub} disabled={!addTeamName.trim()} style={{padding:"12px",background:addTeamName.trim()?"linear-gradient(135deg,#7C3AED,#3B82F6)":"rgba(255,255,255,.05)",border:"none",borderRadius:12,color:addTeamName.trim()?"#fff":"#9CA3AF",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Ajouter</button>
            </div>
          </div>
        </div>
      )}


      {/* ── Modal édit club ── */}
      {editingTeam&&(
        <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setEditingTeam(null)}>
          <div style={{width:"100%",maxWidth:360,background:"#0a0f1e",borderRadius:20,border:"1px solid rgba(255,255,255,.12)",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"16px 18px",borderBottom:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",gap:12}}>
              {(editingTeam.logoInput||TEAM_LOGOS[editingTeam.name]||EL_TEAM_LOGOS[editingTeam.name]||NBA_TEAM_LOGOS[editingTeam.name])?(
                <img src={editingTeam.logoInput||TEAM_LOGOS[editingTeam.name]||EL_TEAM_LOGOS[editingTeam.name]||NBA_TEAM_LOGOS[editingTeam.name]} alt="" style={{width:40,height:40,objectFit:"contain",borderRadius:8,background:"rgba(255,255,255,.05)",padding:3}} onError={e=>e.target.style.display="none"}/>
              ):(
                <div style={{width:40,height:40,borderRadius:8,background:"rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:"#6B7280"}}>🏀</div>
              )}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{editingTeam.name}</div>
                <div style={{fontSize:11,color:"#6B7280"}}>{editingTeam.lg}</div>
              </div>
              <button onClick={()=>setEditingTeam(null)} style={{background:"none",border:"none",color:"#6B7280",fontSize:20,cursor:"pointer",flexShrink:0}}>×</button>
            </div>
            <div style={{padding:"14px 18px 18px",display:"flex",flexDirection:"column",gap:12}}>
              <div>
                <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Logo</div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  {editingTeam.logoInput?(
                    <img src={editingTeam.logoInput} alt="" style={{width:32,height:32,objectFit:"contain",borderRadius:6,background:"rgba(255,255,255,.05)",padding:2,flexShrink:0}} onError={e=>e.target.style.display="none"}/>
                  ):(
                    <div style={{width:32,height:32,borderRadius:6,background:"rgba(255,255,255,.06)",flexShrink:0}}/>
                  )}
                  <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
                    <label style={{display:"flex",alignItems:"center",gap:6,background:"rgba(59,130,246,.1)",border:"1px solid rgba(59,130,246,.25)",borderRadius:10,padding:"7px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                      <span style={{fontSize:12,color:"#60a5fa",fontWeight:600}}>{editingTeam.uploading?"Envoi...":"⬆ Uploader logo"}</span>
                      <input type="file" accept="image/*" style={{display:"none"}} disabled={editingTeam.uploading} onChange={async e=>{
                        const file=e.target.files[0];
                        if(!file)return;
                        setEditingTeam(t=>({...t,uploading:true}));
                        try{
                          const fn=await supaUploadAvatar(file,"logo_"+editingTeam.name);
                          const url=AVATARS_BUCKET+encodeURIComponent(fn);
                          setEditingTeam(t=>({...t,logoInput:url,uploading:false}));
                        }catch(err){setEditingTeam(t=>({...t,uploading:false}));alert("Erreur: "+err.message);}
                      }}/>
                    </label>
                    <input
                      style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,padding:"8px 12px",color:"#E5E7EB",fontSize:12,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box",width:"100%"}}
                      placeholder="ou colle une URL..."
                      value={editingTeam.logoInput||""}
                      onChange={e=>setEditingTeam(t=>({...t,logoInput:e.target.value}))}
                    />
                  </div>
                </div>
              </div>
              <div>
                <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Nom du club</div>
                <input
                  style={{width:"100%",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:12,padding:"10px 12px",color:"#E5E7EB",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"}}
                  value={editingTeam.nameInput||editingTeam.name}
                  onChange={e=>setEditingTeam(t=>({...t,nameInput:e.target.value}))}
                />
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <button onClick={()=>setEditingTeam(null)} style={{padding:"12px",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.08)",borderRadius:12,color:"#9CA3AF",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Annuler</button>
                <button onClick={async()=>{
                  let logo=(editingTeam.logoInput||"").trim();
                  // Si URL externe → rehost vers Supabase
                  if(logo&&!logo.includes(SUPA_URL)){
                    try{ logo=await supaRehost(logo,"logo_"+editingTeam.name); }catch(e){}
                  }
                  if(logo) TEAM_LOGOS[editingTeam.name]=logo;
                  showToast(editingTeam.name+" mis à jour","#22C55E");
                  setEditingTeam(null);
                }} style={{padding:"12px",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:12,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {LEAGUES.map(lg=>{
        const teams=leagueData[lg]||{};
        const playerCount=Object.values(teams).reduce((s,arr)=>s+arr.length,0);
        const isOpen=openLeague===lg;
        return(
          <div key={lg} style={{marginBottom:6,borderRadius:12,overflow:"hidden",border:"1px solid rgba(255,255,255,.07)"}}>
            <button onClick={()=>{setOpenLeague(isOpen?null:lg);setOpenTeam(null);}}
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:isOpen?"rgba(255,255,255,.05)":"rgba(255,255,255,.02)",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",borderBottom:isOpen?"1px solid rgba(255,255,255,.06)":"none"}}>
              <GameLogo game={lg} size={18}/>
              <span style={{flex:1,textAlign:"left",fontSize:13,fontWeight:700,color:"#E5E7EB"}}>{lg}</span>
              <span style={{fontSize:10,color:"#6B7280"}}>{playerCount} joueurs</span>
              <span style={{fontSize:11,color:isOpen?"#a78bfa":"#6B7280",marginLeft:4}}>{isOpen?"▲":"▼"}</span>
            </button>

            {isOpen&&(
              <div style={{background:"rgba(6,10,20,.8)"}}>
                {/* Add club button — pas pour NBA */}
                {lg!=="NBA"&&<button onClick={()=>{setAddTeamLeague(lg);setAddTeamName("");}}
                  style={{width:"100%",padding:"9px 14px",background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,.04)",color:"#22c55e",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:14,lineHeight:1}}>+</span> Ajouter un club dans {lg}
                </button>}

                {Object.keys(teams).length===0?(
                  <div style={{padding:"12px 14px",fontSize:11,color:"#4a5a6e"}}>Aucune equipe</div>
                ):Object.keys(teams).sort().map(team=>{
                  const teamPlayers=teams[team];
                  const isTeamOpen=openTeam===lg+":"+team;
                  const teamLogo=TEAM_LOGOS[team]||EL_TEAM_LOGOS[team]||NBA_TEAM_LOGOS[team]||null;
                  return(
                    <div key={team} style={{borderBottom:"1px solid rgba(255,255,255,.04)",contain:"layout style"}}>
                      <div style={{display:"flex",alignItems:"center"}}>
                        <button onClick={()=>handleOpenTeam(isTeamOpen?null:lg+":"+team, teamPlayers)}
                          style={{flex:1,display:"flex",alignItems:"center",gap:9,padding:"10px 10px 10px 18px",background:isTeamOpen?"rgba(255,255,255,.04)":"transparent",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",minWidth:0}}>
                          {teamLogo?(
                            <CachedImg src={teamLogo} alt={team} onClick={e=>{e.stopPropagation();setEditingTeam({name:team,lg,logoInput:teamLogo||""}); }} width={22} height={22} style={{width:22,height:22,objectFit:"contain",flexShrink:0,borderRadius:3,cursor:"pointer"}} title="Modifier le logo"/>
                          ):(
                            <div onClick={e=>{e.stopPropagation();setEditingTeam({name:team,lg,logoInput:"",nameInput:team});}} style={{width:22,height:22,borderRadius:4,background:"rgba(255,255,255,.06)",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#4a5a6e"}} title="Ajouter un logo">+</div>
                          )}
                          <span style={{flex:1,textAlign:"left",fontSize:12,fontWeight:600,color:"#D1D5DB",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{team}</span>
                          <span style={{fontSize:10,color:"#6B7280",flexShrink:0}}>{teamPlayers.length}</span>
                          <span style={{fontSize:10,color:isTeamOpen?"#a78bfa":"#6B7280",marginLeft:4,flexShrink:0}}>{isTeamOpen?"▲":"▼"}</span>
                        </button>
                        {/* Remove team — pas pour NBA */}
                        {lg!=="NBA"&&<button
                          onClick={()=>setDeletingTeam({lg,team})}
                          style={{padding:"0 12px",height:42,background:"none",border:"none",color:"#4a5a6e",cursor:"pointer",fontSize:16,flexShrink:0,display:"flex",alignItems:"center"}}>
                          ×
                        </button>}
                      </div>

                      {isTeamOpen&&(
                        <div style={{background:"rgba(0,0,0,.2)"}}>
                          {teamPlayers.length===0?(
                            <div style={{padding:"10px 24px",fontSize:11,color:"#4a5a6e"}}>Aucun joueur enregistre</div>
                          ):[...teamPlayers].sort((a,b)=>posRank(a.data.role)-posRank(b.data.role)||(a.data.name||"").localeCompare(b.data.name||"")).map(({key,data})=>(
                            <button key={key} onClick={(e)=>setEditingPlayer({key,data,clickY:e.clientY})}
                              style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 14px 9px 24px",background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,.03)",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left",contain:"layout style"}}>
                              {data.photo_url?(
                                <div style={{width:44,height:44,borderRadius:"50%",overflow:"hidden",flexShrink:0,background:"rgba(124,58,237,.08)",WebkitTransform:"translateZ(0)",transform:"translateZ(0)",border:"1px solid rgba(255,255,255,.06)"}}><CachedImg src={optimizePhotoUrl(data.photo_url,88)} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 10%",display:"block"}}/></div>
                              ):(
                                <div style={{width:44,height:44,borderRadius:"50%",background:"rgba(124,58,237,.12)",border:"1px solid rgba(124,58,237,.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                  <span style={{fontSize:16,fontWeight:700,color:"#a78bfa"}}>{(data.name||key).charAt(0).toUpperCase()}</span>
                                </div>
                              )}
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:12,fontWeight:600,color:"#E5E7EB",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",textTransform:"capitalize",display:"flex",alignItems:"center",gap:5}}>
                                {data.name||key}
                                {data.photo_url&&(data.photo_url.includes(SUPA_URL)?<span title="Photo Supabase ✓" style={{width:6,height:6,borderRadius:"50%",background:"#22C55E",flexShrink:0,display:"inline-block"}}/>:<span title="Photo externe — cliquer pour héberger" style={{width:6,height:6,borderRadius:"50%",background:"#FBBF24",flexShrink:0,display:"inline-block"}}/>)}
                              </div>
                                {data.role&&<div style={{fontSize:10,color:"#6B7280",marginTop:1}}>{data.role}</div>}
                              </div>
                              <span style={{fontSize:10,color:"#4a5a6e",flexShrink:0}}>✎</span>
                            </button>
                          ))}
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
  );
}

// ── AddPlayerForm - composant séparé (hooks autorisés) ───────────────────────
function AddPlayerForm({setPlayers,showToast}){
  const [addOpen,setAddOpen]=useState(false);
  const [lf,setLf]=useState({name:"",game:"NBA",league:"NBA",team:"",role:""});
  return(
    <div style={{marginBottom:16}}>
      <button onClick={()=>setAddOpen(v=>!v)}
        style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:addOpen?"rgba(124,58,237,.1)":"rgba(255,255,255,.03)",border:"1.5px solid "+(addOpen?"rgba(124,58,237,.35)":"rgba(255,255,255,.08)"),borderRadius:12,padding:"11px 14px",cursor:"pointer",fontFamily:"Inter,sans-serif",marginBottom:addOpen?10:0}}>
        <span style={{fontSize:13,fontWeight:700,color:addOpen?"#a78bfa":"#E5E7EB"}}>+ Ajouter joueur</span>
        <span style={{fontSize:11,color:"#6B7280"}}>{addOpen?"✕":"▼"}</span>
      </button>
      {addOpen&&(
        <div style={{background:"rgba(10,16,34,.98)",border:"1px solid rgba(124,58,237,.2)",borderRadius:12,padding:"14px"}}>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Nom du joueur *</div>
            <input className="ifield" placeholder="Ex: Victor Wembanyama" value={lf.name} onChange={e=>setLf(p=>({...p,name:e.target.value}))} style={{marginBottom:0}}/>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Ligue *</div>
            <select className="ifield" style={{width:"100%",cursor:"pointer"}} value={lf.game} onChange={e=>setLf(p=>({...p,game:e.target.value,league:e.target.value,team:""}))}>
              {["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Lega","Bundesliga","HEBA"].map(g=>(
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Équipe *</div>
            <select className="ifield" style={{width:"100%",cursor:"pointer"}} value={lf.team} onChange={e=>setLf(p=>({...p,team:e.target.value}))}>
              <option value="">Choisir une équipe…</option>
              {(ALL_LEAGUE_TEAMS[lf.game]||[]).slice().sort().map(t=>(
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Poste</div>
            <select className="ifield" style={{width:"100%",cursor:"pointer"}} value={lf.role} onChange={e=>setLf(p=>({...p,role:e.target.value}))}>
              <option value="">Poste (optionnel)</option>
              {lf.game==="NBA"
                ?["PG","SG","SF","PF","C"].map(r=><option key={r} value={r}>{r}</option>)
                :["Point Guard","Shooting Guard","Small Forward","Power Forward","Center"].map(r=><option key={r} value={r}>{r}</option>)
              }
            </select>
          </div>
          <button
            disabled={!lf.name.trim()||!lf.team}
            onClick={()=>{
              if(!lf.name.trim()||!lf.team)return;
              const rawName=lf.name.toLowerCase().trim();
              const data={game:lf.game,league:lf.league||lf.game,role:lf.role||"",team:lf.team,name:lf.name.trim()};
              setPlayers(p=>{
                supaUpsertPlayer({name:rawName,...data}).catch(()=>{});
                return{...p,[rawName]:data};
              });
              showToast(lf.name+" ajouté ✓","#A78BFA");
              setLf({name:"",game:"NBA",league:"NBA",team:"",role:""});
              setAddOpen(false);
            }}
            style={{width:"100%",padding:"12px",background:lf.name.trim()&&lf.team?"linear-gradient(135deg,#7C3AED,#3B82F6)":"rgba(255,255,255,.05)",border:"none",borderRadius:10,color:lf.name.trim()&&lf.team?"#fff":"#9CA3AF",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
            ✓ Ajouter le joueur
          </button>
        </div>
      )}
    </div>
  );
}

export default function App(){
  const [bets,setBets]=useState([]);
  const [bankroll,setBankroll]=useState(5000);
  const [depots,setDepots]=useState(()=>{try{return JSON.parse(localStorage.getItem("v7_depots")||"[]");}catch(e){return [];}});
  const [modalDepot,setModalDepot]=useState(false);
  const [bkAccounts,setBkAccounts]=useState(()=>{try{return JSON.parse(localStorage.getItem("v7_bk_accounts")||"{}");}catch(e){return {};}});
  const [newAccountInput,setNewAccountInput]=useState("");
  const [showNewAccount,setShowNewAccount]=useState(false);
  const [editDepotId,setEditDepotId]=useState(null); // id du depot en cours d'edition
  const [viewDepots,setViewDepots]=useState(false);
  const [depotForm,setDepotForm]=useState({site:"",username:"",type:"depot",sol:"",solPrice:"",date:new Date().toISOString().slice(0,10)});
  const [players,setPlayers]=useState({});; // { name_lowercase: {id,name,game,league,role,team,avatar_url,avatar_file} }

  const [blacklist,setBlacklist]=useState(()=>{try{return new Set(JSON.parse(localStorage.getItem("v7_blacklist")||"[]"));}catch(e){return new Set();}});
  function toggleBlacklist(key){
    setBlacklist(prev=>{
      const n=new Set(prev);
      if(n.has(key))n.delete(key);else n.add(key);
      try{localStorage.setItem("v7_blacklist",JSON.stringify([...n]));}catch(e){}
      return n;
    });
  }
  const [bookmakers,setBookmakers]=useState(DEFAULT_BK);
  const [form,setForm]=useState({...EMPTY_FORM(),datetime:nowDT()});
  const [stickyBK,setStickyBK]=useState(false);
  const [lockedStatus,setLockedStatus]=useState(null);
  const [tipsterName,setTipsterName]=useState("");
  const [lockedTipster,setLockedTipster]=useState(false);
  const [savedTipsters,setSavedTipsters]=useState(()=>{try{return JSON.parse(localStorage.getItem("v7_saved_tipsers")||"[]");}catch(e){return[];}});
  const [tipsterPhotos,setTipsterPhotos]=useState(()=>{try{return JSON.parse(localStorage.getItem("v7_tipster_photos")||"{}");}catch(e){return{};}});
  const [editingTipsterPhoto,setEditingTipsterPhoto]=useState(null); // {name, url}
  const [combineMode,setCombineMode]=useState(false);
  const [combineLegs,setCombineLegs]=useState([{player:"",description:"",overUnder:"Over"}]);
  const [teamBetMode,setTeamBetMode]=useState(false);
  const [view,setViewRaw]=useState("home");
  const [viewPending,setViewPending]=useState(false);
  const setView=v=>{
    setViewPending(true);
    setTimeout(()=>{
      setViewRaw(v);
      setViewPending(false);
      try{window.scrollTo({top:0,behavior:"instant"});}catch(e){}
    },0);
  };
  const [loaded,setLoaded]=useState(false);
  // Les joueurs viennent uniquement de Supabase - pas de localStorage
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
  const [duelForm,setDuelForm]=useState({player1:"",player2:"",odds:"",stake:"",winner:"",bookmaker:"",mapTag:"Match",isLive:false,datetime:"",ppMapType:"",ppLine_player1:"",ppLine_player2:""});
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
  const [fTipster,setFTipster]=useState("All");
  const [fMapFilter,setFMapFilter]=useState("all");
  const [deletedBets,setDeletedBets]=useState([]);
  const [showCorbeille,setShowCorbeille]=useState(false);
  const [showFullReset,setShowFullReset]=useState(false);
  const [settledOrder,setSettledOrder]=useState({});
  const [fRole,setFRole]=useState("All");
  const [fLeague,setFLeague]=useState("All");
  const FILTRES_PER_PAGE=30;
  const [modalBK,setModalBK]=useState(false);
  const [editingBK,setEditingBK]=useState(null); // {name, logoUrl} pour modifier logo
  const [splitModal,setSplitModal]=useState(null); // bet to split
  const [splitForm,setSplitForm]=useState({bookmaker:"",stake:"",odds:""});
  const [newBK,setNewBK]=useState("");
  const [newBKPhoto,setNewBKPhoto]=useState("");
  const [bkPhotos,setBkPhotos]=useState({});
  const DEFAULT_HIDDEN_BKS=[];
  const [hiddenBKs,setHiddenBKs]=useState(()=>{try{const saved=JSON.parse(localStorage.getItem("v7_hidden_bks")||"null");if(saved!==null)return new Set(saved);return new Set(DEFAULT_HIDDEN_BKS);}catch(e){return new Set(DEFAULT_HIDDEN_BKS);}});
  const toggleHideBK=bk=>setHiddenBKs(prev=>{const n=new Set(prev);n.has(bk)?n.delete(bk):n.add(bk);const arr=[...n];localStorage.setItem("v7_hidden_bks",JSON.stringify(arr));return n;});
  const visibleBKs=bookmakers.filter(bk=>!hiddenBKs.has(bk));
  const [modalPlayer,setModalPlayer]=useState(false);
  const [pform,setPform]=useState({name:"",game:"NBA",league:"",position:"",team:""});
  const [editingPlayer,setEditingPlayer]=useState(null); // {key, data}
  // Tournois actifs par jeu: {CS2: {name:"PGL Astana 2026", end:"2026-04-10"}, ...}
  const [activeTourneys,setActiveTourneys]=useState({});
  // Tous les tournois sauvegardés (historique + réactivation)
  const [savedTourneys,setSavedTourneys]=useState({
    NBA:["NBA Playoffs 2026","NBA Finals 2026","All-Star Game 2026"],
    EuroLeague:["EuroLeague Final Four 2026","EuroLeague Play-In 2026"],
    "Pro A":["Pro A Play-offs 2026","Leaders Cup 2026"],
    ACB:["ACB Liga 2026","Copa del Rey 2026"],
  });
  const [confirmDelete,setConfirmDelete]=useState(false);
  const [modalTourney,setModalTourney]=useState(false); // game string ou false
  const [suiviOpen,setSuiviOpen]=useState({tournois:true,bookmakers:false,prizepicks:false,coupes:false});
  // Coupes personnalisées: [{id, name, logo, clubs:[{name}]}]
  const [customCups,setCustomCups]=useState(()=>{try{const s=localStorage.getItem("v7_custom_cups");return s?JSON.parse(s):[];}catch(e){return[];}});
  const [modalCup,setModalCup]=useState(false); // false | "new" | cupId (édition)
  const [cupForm,setCupForm]=useState({name:"",logo:"",clubs:[]});
  const [editMises,setEditMises]=useState(false);
  const [ppData,setPpData]=useState(()=>{try{const s=localStorage.getItem("v7_pp_data");return s?JSON.parse(s):[];}catch(e){return[];}});
  const [ppActiveLeague,setPpActiveLeague]=useState("all");
  const [ppActiveTiers,setPpActiveTiers]=useState(new Set(["standard","demon","goblin"]));
  const [ppSearch,setPpSearch]=useState("");
  const [ppFullscreen,setPpFullscreen]=useState(false);
  const [ppCalcBk,setPpCalcBk]=useState("");
  const [ppCalcPp,setPpCalcPp]=useState("");
  const [ppCalcMt,setPpCalcMt]=useState("H1+H2");
  const [ppCalcOu,setPpCalcOu]=useState("Over");
  const [statsGameOpen,setStatsGameOpen]=useState({});
  const [ouDrill,setOuDrill]=useState(null);
  const [statsTab,setStatsTab]=useState("apercu");
  const [annSubTab,setAnnSubTab]=useState("tracker");
  const [dowMetric,setDowMetric]=useState("roi");
  const [analyseView,setAnalyseView]=useState("global");
  const [calibDrill,setCalibDrill]=useState(null);
  const [coteSort,setCoteSort]=useState({key:"edge",dir:1});
  const [signalSort,setSignalSort]=useState({key:"profit",dir:-1});
  const [calibSort,setCalibSort]=useState({key:"edge",dir:1});
  const [breakevenSort,setBreakevenSort]=useState({key:"label",dir:1});
  // ── MODE NOUVEAU DÉPART (Men in Black) ───────────────────────────────────
  const [mibActive,setMibActive]=useState(()=>{try{return localStorage.getItem("v7_mib_active")==="1";}catch(e){return false;}});
  const [mibDate,setMibDate]=useState(()=>{try{return localStorage.getItem("v7_mib_date")||new Date().toISOString().slice(0,10);}catch(e){return new Date().toISOString().slice(0,10);}});
  const [statsPeriod,setStatsPeriod]=useState(null);
  const [statsChartMode,setStatsChartMode]=useState("line");
  const [playersExpanded,setPlayersExpanded]=useState(null);
  const [playerSortKey,setPlayerSortKey]=useState("profit");
  const [playerMinBets,setPlayerMinBets]=useState(1);
  const [testingOpen,setTestingOpen]=useState(false);
  const DEFAULT_TEST_FILTER={games:new Set(["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Bundesliga","Lega","HEBA"]),headshot:"all",live:"all",oddsMin:"",oddsMax:"",hideTourneys:new Set(),hideLeagues:new Set(),hideRoles:new Set(),ppEdgeMin:"",ppEdgeMax:"",overUnder:"all"};
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
  const [analyseBets,setAnalyseBets]=useState([]);
  const [analyseLoading,setAnalyseLoading]=useState(false);
  const [analyseLastFetch,setAnalyseLastFetch]=useState(null);
  const [analyseFSport,setAnalyseFSport]=useState("all");
  const [analyseFSource,setAnalyseFSource]=useState("all");
  const [analyseFDir,setAnalyseFDir]=useState("All");
  const [analyseSort,setAnalyseSort]=useState("diff"); // "diff" ou "time"
  const [analyseFStat,setAnalyseFStat]=useState("all"); // "all", "points", "3pts"
  const [showAllRecents,setShowAllRecents]=useState(false);
  const [expandedAnalyseBet,setExpandedAnalyseBet]=useState(null);
  const [analyseFHeure,setAnalyseFHeure]=useState(""); // filtre heure ex: "12:00"
  const [hiddenAnalyseBets,setHiddenAnalyseBets]=useState(()=>{try{return new Set(JSON.parse(localStorage.getItem("v7_hidden_analyse")||"[]"));}catch(e){return new Set();}});
  const [showHiddenAnalyse,setShowHiddenAnalyse]=useState(false);
  const [showSimulation,setShowSimulation]=useState(false);
  const [simRules,setSimRules]=useState([]);
  const [simManual,setSimManual]=useState(()=>{try{return JSON.parse(localStorage.getItem("v7_sim_manual")||"{}");}catch(e){return {};}});
  function setSimResult(uid,result){
  setSimManual(prev=>{
    const n={...prev};
    if(result===null)delete n[uid];
    else n[uid]=result;
    localStorage.setItem("v7_sim_manual",JSON.stringify(n));
    return n;
  });
}
  const [collapsedMonths,setCollapsedMonths]=useState(new Set());
  function toggleMonth(mk){setCollapsedMonths(prev=>{const n=new Set(prev);if(n.has(mk))n.delete(mk);else n.add(mk);return n;});}
  function toggleHideAnalyseBet(key){
  setHiddenAnalyseBets(prev=>{
    const n=new Set(prev);
    if(n.has(key))n.delete(key);else n.add(key);
    try{localStorage.setItem("v7_hidden_analyse",JSON.stringify([...n]));}catch(e){}
    return n;
  });
}
  // ── Supabase sync (sans login) ───────────────────────────────────────────
  const [syncing,setSyncing]=useState(false);
  const [supaOk,setSupaOk]=useState(false);
  const [supaModal,setSupaModal]=useState(false);
  const [integrityChecking,setIntegrityChecking]=useState(false);
  const [integrityReport,setIntegrityReport]=useState(null);

  // ── Load: localStorage ───────────────────────────────────────────────────
  useEffect(()=>{
    try{
      const b=localStorage.getItem("v7_bets");
      if(b){
        const parsed=JSON.parse(b);
        setBets(parsed.map(normalizeBet));
      }
      const bk=localStorage.getItem("v7_bankroll"); if(bk)setBankroll(parseFloat(bk));
      // ── Joueurs: cache-first (localStorage instantane + Supabase background) ──
      const CACHE_KEY="v7_players_cache";
      try{
        const cached=localStorage.getItem(CACHE_KEY);
        if(cached){
          const obj=JSON.parse(cached);
          setPlayers(obj);
          // Précharger les photos en arrière-plan dès le cache
          if(typeof window!=="undefined"){
            setTimeout(()=>{
              Object.values(obj).slice(0,40).forEach(p=>{
                if(p.photo_url){const i=new Image();i.decoding="async";i.src=p.photo_url;}
              });
            },100);
          }
        }
      }catch(e){}

      supaFetchPlayers().then(rows=>{
        if(rows && rows.length > 0) {
          // Aliases pour normaliser les anciens noms d'équipes
          const TEAM_ALIASES={"Anadolu Efes Istanbul":"Anadolu Efes","Efes Pilsen":"Anadolu Efes","Fenerbahce Istanbul":"Fenerbahçe Tarfin","Fenerbahce Beko":"Fenerbahçe Tarfin","Besiktas Istanbul":"Beşiktaş Gain","Besiktas JK":"Beşiktaş Gain","Crvena Zvezda Meridianbet Belgrade":"Crvena zvezda Meridianbet","Crvena zvezda mts":"Crvena zvezda Meridianbet","Red Star Belgrade":"Crvena zvezda Meridianbet","Partizan Belgrade":"Partizan Mozzart Bet","Partizan NIS":"Partizan Mozzart Bet","Partizan":"Partizan Mozzart Bet","Partizan Mozzart Bet Belgrade":"Partizan Mozzart Bet","Maccabi FOX Tel Aviv":"Maccabi Rapyd Tel Aviv","Armani Olimpia Milan":"Olimpia Milano","AX Armani Exchange Milan":"Olimpia Milano","EA7 Emporio Armani Milan":"Olimpia Milano","EA7 Olimpia Milano":"Olimpia Milano","Virtus Bologna":"Virtus Olidata Bologna","Segafredo Virtus Bologna":"Virtus Olidata Bologna","Zalgiris Kaunas":"Žalgiris","Zalgiris":"Žalgiris","FC Bayern Munich":"Bayern München","Bayern Munich":"Bayern München","Asvel Villeurbanne":"LDLC ASVEL","ASVEL Villeurbanne":"LDLC ASVEL","LDLC ASVEL Villeurbanne":"LDLC ASVEL","LDLC ASVEL Lyon-Villeurbanne":"LDLC ASVEL","Baskonia Vitoria-Gasteiz":"Kosner Baskonia","Baskonia":"Kosner Baskonia","TD Systems Baskonia":"Kosner Baskonia","Kosner Baskonia Vitoria-Gasteiz":"Kosner Baskonia","Panathinaikos AKTOR Athens":"Panathinaikos AKTOR","Panathinaikos Athens":"Panathinaikos AKTOR","Panathinaikos":"Panathinaikos AKTOR","Olympiacos Piraeus":"Olympiacos","Olympiakos":"Olympiacos","Joventut Badalona":"Asisa Joventut","Joventut":"Asisa Joventut","San Pablo Burgos":"Recoletas Salud Burgos","Recoletas San Pablo Burgos":"Recoletas Salud Burgos","BAXI Manresa":"BAXI Manresa","Kids&Us Manresa":"BAXI Manresa","Manresa":"BAXI Manresa","Cosea JL Bourg":"JL Bourg","JL Bourg-en-Bresse":"JL Bourg","Le Mans":"Le Mans Sarthe","Buducnost VOLI":"Budućnost VOLI","Buducnost":"Budućnost VOLI","Cedevita Olimpija Ljubljana":"Cedevita Olimpija","Hapoel Jerusalem":"Hapoel Midtown Jerusalem","Hapoel Bank Yahav Jerusalem":"Hapoel Midtown Jerusalem","Lietkabelis":"Lietkabelis Panevezys","Neptūnas":"Neptūnas Klaipeda","Neptunas":"Neptūnas Klaipeda","Riga Zelli":"Rīgas Zeļļi","Siauliai":"Šiauliai","Slask Wroclaw":"Śląsk Wrocław","Tofas Bursa":"Tofaş","Turk Telekom":"Türk Telekom","Bahcesehir Koleji":"Bahçeşehir Koleji","Niners Chemnitz":"NINERS Chemnitz","Baglietto Derthona Tortona":"Baglietto Derthona","Derthona Basket":"Baglietto Derthona","Napoli Basket":"Napoli Basketball","Elan Chalon":"Élan Chalon","Strasbourg IG":"SIG Strasbourg","Nanterre":"Nanterre 92","Gravelines Dunkerque":"Gravelines-Dunkerque","BCM Gravelines":"Gravelines-Dunkerque","Peristeri":"Peristeri Betsson","Rytas":"Rytas Vilnius","Slavia Prague":"Slavia Prague ERA NBK"};

          const obj = {};
          rows.forEach(p => {
            // Normaliser le nom de l'équipe si alias existe
            const normalizedTeam=TEAM_ALIASES[p.team]||p.team;
            const POS_NORM={"G":"Point Guard","Guard":"Point Guard","SG":"Shooting Guard","Shooting Guard":"Shooting Guard","Wing":"Small Forward","F":"Small Forward","Forward":"Small Forward","Big":"Center","PF/C":"Center","F/C":"Center","G/F":"Small Forward"};
            const normalizedRole=POS_NORM[p.role]||p.role;
            const pNorm={...p,team:normalizedTeam,role:normalizedRole};

            const key = pNorm.name.toLowerCase().replace(/[čćžšđ]/g, c=>({č:'c',ć:'c',ž:'z',š:'s',đ:'d'}[c]||c)).trim();
            const entry = {
              id: pNorm.id,
              name: pNorm.name,
              game: pNorm.game,
              league: pNorm.league,
              role: normalizedRole,
              team: pNorm.team,
              photo_url: pNorm.photo_url || null,
              team_logo_url: pNorm.team_logo_url || null,
              avatar_url: pNorm.avatar_url || null,
              avatar_file: pNorm.avatar_file || null,
            };
            // Si doublon, garder celui qui a une équipe
            if(obj[key] && !entry.team) return;
            obj[key] = entry;
          });
          // Migrate roles to short form
          var RMIG={"Top Laner":"Top","Toplaner":"Top","Bot Laner":"Bot","Botlaner":"Bot","Mid Laner":"Mid","Midlaner":"Mid","Jungler":"Jungle","jungler":"Jungle","Jngl":"Jungle","Jng":"Jungle","Support":"Support","Sup":"Support","Supp":"Support"};
          Object.keys(obj).forEach(function(k){var r=obj[k].role;if(r&&RMIG[r])obj[k]=Object.assign({},obj[k],{role:RMIG[r]});});

          // ── Merger avec le cache local — préserver photos/logos locaux si Supabase retourne null ──
          try{
            const cached=localStorage.getItem("v7_players_cache");
            if(cached){
              const localCache=JSON.parse(cached);
              Object.keys(obj).forEach(k=>{
                const local=localCache[k];
                if(local){
                  // Garder photo_url locale si Supabase n'en a pas
                  if(!obj[k].photo_url&&local.photo_url) obj[k].photo_url=local.photo_url;
                  if(!obj[k].avatar_url&&local.avatar_url) obj[k].avatar_url=local.avatar_url;
                  if(!obj[k].team_logo_url&&local.team_logo_url) obj[k].team_logo_url=local.team_logo_url;
                }
              });
            }
          }catch(e){}

          setPlayers(obj);

          // ── Migration batch photos externes → Supabase Storage (background) ──
          // Migre silencieusement les URLs externes vers Supabase après le chargement
          setTimeout(async ()=>{
            const toMigrate=Object.entries(obj).filter(([k,p])=>
              p.photo_url && !p.photo_url.includes(SUPA_URL)
            );
            if(toMigrate.length===0) return;
            console.log(`Migration photos: ${toMigrate.length} joueurs à migrer vers Supabase`);
            let migrated=0;
            for(const [key,p] of toMigrate){
              try{
                const permanentUrl=await supaRehost(p.photo_url, key);
                if(permanentUrl!==p.photo_url){
                  // URL différente = migration réussie → sauvegarder
                  const updated={...p,photo_url:permanentUrl,avatar_url:permanentUrl};
                  await supaUpsertPlayer({name:key,...updated});
                  setPlayers(prev=>prev[key]?{...prev,[key]:updated}:prev);
                  migrated++;
                }
              }catch(e){ /* silencieux */ }
              // Pause entre chaque pour ne pas saturer le réseau
              await new Promise(r=>setTimeout(r,300));
            }
            if(migrated>0){
              console.log(`Migration terminée: ${migrated} photos maintenant dans Supabase`);
              // Mettre à jour le cache
              try{
                const cache=JSON.parse(localStorage.getItem("v7_players_cache")||"{}");
                Object.entries(obj).forEach(([k,p])=>{if(cache[k])cache[k]=p;});
                localStorage.setItem("v7_players_cache",JSON.stringify(cache));
              }catch(e){}
            }
          }, 5000); // Démarrer 5s après le chargement pour ne pas bloquer l'UI
          Object.keys(obj).forEach(k=>{
            const p=obj[k];
            if(p.photo_url&&p.photo_url.includes("espncdn.com")&&p.photo_url.includes("/full/")){
              const img=new Image();
              img.onerror=()=>{
                // URL ESPN invalide → vider pour supprimer le 404
                setPlayers(prev=>prev[k]?{...prev,[k]:{...prev[k],photo_url:null,avatar_url:null}}:prev);
              };
              img.src=p.photo_url;
            }
          });
          try{ localStorage.setItem("v7_players_cache", JSON.stringify(obj)); }catch(e){}
        }
      }).catch(function(){});
      const bm=localStorage.getItem("v7_bmakers");
      if(bm){
        const saved=JSON.parse(bm);
        // Fusionner avec DEFAULT_BK pour s assurer que les nouveaux bookmakers par défaut sont présents
        const merged=[...saved];
        DEFAULT_BK.forEach(bk=>{if(!merged.includes(bk))merged.push(bk);});
        setBookmakers(merged);
        if(merged.length!==saved.length)localStorage.setItem("v7_bmakers",JSON.stringify(merged));
      }
      const bp=localStorage.getItem("v7_bkphotos");
      if(bp){
        const parsed=JSON.parse(bp);
        // Supprimer les anciens logos base64 (trop lourds)
        const cleaned={};
        Object.entries(parsed).forEach(([k,v])=>{
          if(v&&!v.startsWith("data:"))cleaned[k]=v;
        });
        setBkPhotos(cleaned);
        // Réécrire le localStorage sans les base64
        try{localStorage.setItem("v7_bkphotos",JSON.stringify(cleaned));}catch(e){}
      }
      const tv=localStorage.getItem("v7_tourneys"); if(tv)setActiveTourneys(JSON.parse(tv));
      const stv=localStorage.getItem("v7_saved_tourneys"); if(stv)setSavedTourneys(JSON.parse(stv));
      // Restaurer le BK sticky de la session précédente
      const sbk=localStorage.getItem("v7_sticky_bk");
      if(sbk){const d=JSON.parse(sbk);setStickyBK(d.active||false);setForm(f=>({...f,bookmaker:d.bk||""}));}
    }catch(e){}
    setLoaded(true);
  },[]);

  // Persister stickyBK + bookmaker actif

  // Persister tournois actifs + savedTourneys + MIB + testFilter → Supabase
  useEffect(()=>{
    if(!loaded)return;
    try{
      const serFilter={...testFilter,games:[...testFilter.games],hideTourneys:[...testFilter.hideTourneys],hideLeagues:[...testFilter.hideLeagues],hideRoles:[...testFilter.hideRoles]};
      if(SUPA_URL&&SUPA_KEY){
        // Row 1 : settings principaux
        const settingsRow={id:"__settings_tourneys__",player:"__SETTINGS__",description:JSON.stringify({activeTourneys,savedTourneys,mibActive,mibDate,testFilter:serFilter,savedTipsters,customCups}),odds:1,stake:0,bookmaker:"",status:"pending",game:"",league:"",role:"",team:"",datetime:"",isHeadshot:false,isLive:false,mapTag:"",profit:0,tournament:"",ppMapType:null,ppLine:null,ppEdge:null,updatedAt:Date.now(),splits:null};
        fetch(SUPA_URL+"/rest/v1/bets",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Prefer":"resolution=merge-duplicates"},body:JSON.stringify(settingsRow)}).catch(function(){});
      }
    }catch(e){}
  },[activeTourneys,savedTourneys,mibActive,mibDate,testFilter,savedTipsters,customCups,loaded]);

  // ── Supabase save : settings app (bookmakers, bkPhotos, bankroll, dépôts, etc.) ──
  useEffect(()=>{
    if(!loaded)return;
    const t=setTimeout(()=>{
      try{
        if(SUPA_URL&&SUPA_KEY){
          let ovSaved={};try{ovSaved=JSON.parse(localStorage.getItem("v7_overrides")||"{}");}catch(e){}
          const appRow={
            id:"__settings_app__",player:"__SETTINGS_APP__",
            description:JSON.stringify({
              bookmakers,bkPhotos,bkAccounts,
              bankroll,depots,
              overrides:ovSaved,hiddenBKs:[...hiddenBKs],
              stickyBK,lockedStatus,
              hiddenAnalyseBets:[...hiddenAnalyseBets],
              blacklist:[...blacklist],
              simManual,tipsterPhotos,
              ppData,
            }),
            odds:1,stake:0,bookmaker:"",status:"pending",game:"",league:"",role:"",team:"",
            datetime:"",isHeadshot:false,isLive:false,mapTag:"",profit:0,tournament:"",
            ppMapType:null,ppLine:null,ppEdge:null,updatedAt:Date.now(),splits:null
          };
          fetch(SUPA_URL+"/rest/v1/bets",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Prefer":"resolution=merge-duplicates"},body:JSON.stringify(appRow)}).catch(function(){});
        }
      }catch(e){}
    },1500);
    return()=>clearTimeout(t);
  },[bookmakers,bkPhotos,bkAccounts,bankroll,depots,hiddenBKs,stickyBK,lockedStatus,hiddenAnalyseBets,blacklist,simManual,tipsterPhotos,ppData,loaded]);

  // ── Save: localStorage (debounced) ───────────────────────────────────────
  useEffect(()=>{
    if(!loaded)return;
    // Debounce longer for large datasets to avoid blocking UI
    const delay=bets.length>5000?2000:800;
    const t=setTimeout(()=>{
      try{
        const data=JSON.stringify(bets);
        // Warn if approaching localStorage limits (~5MB typical)
        if(data.length>4000000){
          // localStorage near limit
        }
        localStorage.setItem("v7_bets",data);
      }catch(e){
        // QuotaExceededError - localStorage full
        // localStorage full
      }
    },delay);
    return()=>clearTimeout(t);
  },[bets,loaded]);

  const showToast=useCallback(function(msg,color){
  color=color||"#00E676";
    setToast({msg,color});setTimeout(()=>setToast(null),2200);
  },[]);

  const showBetConfirm=useCallback(function(){},[]);

  // ── Supabase: auto-push après chaque changement de paris (debounce 5s) ────
  // Auto-push : déclenché seulement par un vrai changement local (ajout/modif/suppression)
  // NE PAS push après un pull (sinon boucle infinie ordi↔iOS)
  const lastPulledRef=useRef(null);
  const lastPushRef=useRef(0);
  useEffect(()=>{
    if(!loaded)return;
    // Éviter de re-pusher ce qu on vient de puller
    const key=bets.length+":"+( bets[0]&&bets[0].id||"" );
    if(lastPulledRef.current===key)return;
    // Éviter de re-pusher si on vient de pousser via addBet (race condition iOS)
    const timeSincePush=Date.now()-lastPushRef.current;
    if(timeSincePush<5000)return;
    const t=setTimeout(async()=>{
      try{
        // Appliquer les overrides avant push pour garantir que les dates/bookmakers
        // modifiés manuellement sont bien envoyés à Supabase
        const ovRaw=localStorage.getItem("v7_overrides");
        const overrides=ovRaw?JSON.parse(ovRaw):{};
        const hasOv=Object.keys(overrides).length>0;
        const betsToSend=hasOv?bets.map(b=>{
          const ov=overrides[String(b.id)];
          if(!ov)return b;
          return{...b,...(ov.datetime?{datetime:ov.datetime}:{}),...(ov.settledAt?{settledAt:ov.settledAt}:{}),...(ov.bookmaker?{bookmaker:ov.bookmaker}:{})};
        }):bets;
        await supaPushBets(betsToSend);
        // Nettoyer les overrides une fois pushés avec succès
        if(hasOv)localStorage.removeItem("v7_overrides");
        setSupaOk(true);
      }
      catch(e){ setSupaOk(false); }
    },3000);
    return()=>clearTimeout(t);
  },[bets,loaded]);

  // ── Supabase: pull - Supabase est la source de vérité ───────────────────
  const pullFromSupa=useCallback(async function(silentArg){
    // Block pull for 15s after a push to avoid race condition
    if(Date.now()-lastPushRef.current<15000){setSyncing(false);return;}
    setSyncing(true);
    try{
      // 1. Pousser les overrides locaux vers Supabase (changements manuels en attente)
      const ovRaw=localStorage.getItem("v7_overrides");
      const overrides=ovRaw?JSON.parse(ovRaw):{};
      const ovIds=Object.keys(overrides);
      if(ovIds.length>0){
        const localRaw=localStorage.getItem("v7_bets");
        const localBets=localRaw?JSON.parse(localRaw):[];
        const withOv=localBets
          .filter(b=>overrides[String(b.id)])
          .map(b=>{
            const ov=overrides[String(b.id)];
            return{...b,...(ov.datetime?{datetime:ov.datetime}:{}),...(ov.settledAt?{settledAt:ov.settledAt}:{}),...(ov.bookmaker?{bookmaker:ov.bookmaker}:{}),updatedAt:Date.now()};
          });
        if(withOv.length>0){
          await supaPushBets(withOv);
          localStorage.removeItem("v7_overrides");
        }
      }
      // 2. Pull Supabase
      const remote=await supaPullBets();
      setSupaOk(true);
      if(!remote||remote.length===0){setSyncing(false);return;}
      // 3. Merge local-first : le plus récent (updatedAt) gagne
      // Si Supabase est indisponible, l app fonctionne avec le localStorage
      const localRaw=localStorage.getItem("v7_bets");
      const localBets=localRaw?JSON.parse(localRaw):[];
      const localMap={};
      localBets.forEach(b=>{if(b&&b.id)localMap[String(b.id)]=b;});
      const remoteMap={};
      remote.forEach(b=>{if(b&&b.id)remoteMap[String(b.id)]=b;});
      // Union des deux sets d'ids
      const allIds=new Set([...Object.keys(localMap),...Object.keys(remoteMap)]);
      const merged=[];
      allIds.forEach(sid=>{
        const loc=localMap[sid];
        const rem=remoteMap[sid];
        if(!rem)return; // Pari supprimé sur Supabase → ne pas garder le local
        if(!loc){merged.push(normalizeBet(rem));return;}
        // Le plus récent gagne (updatedAt comme arbitre)
        const locTs=loc.updatedAt||loc.settledAt||loc.id||0;
        const remTs=rem.updatedAt||rem.settledAt||rem.id||0;
        merged.push(normalizeBet(locTs>=remTs?loc:rem));
      });
      // Restore tournament settings if present in Supabase data
      const settingsRow=remote.find(b=>b.player==="__SETTINGS__");
      if(settingsRow){
        try{
          const s=JSON.parse(settingsRow.description||"{}");
          if(s.activeTourneys&&Object.keys(s.activeTourneys).length>0){setActiveTourneys(s.activeTourneys);localStorage.setItem("v7_tourneys",JSON.stringify(s.activeTourneys));}
          // Restore MIB settings
          if(s.mibActive!==undefined){setMibActive(!!s.mibActive);}
          if(s.mibDate){setMibDate(s.mibDate);}
          // Restore testFilter (deserialize Arrays → Sets)
          if(s.testFilter){
            try{
              const tf=s.testFilter;
              setTestFilter({...tf,games:new Set(tf.games||["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Bundesliga","Lega","HEBA"]),hideTourneys:new Set(tf.hideTourneys||[]),hideLeagues:new Set(tf.hideLeagues||[]),hideRoles:new Set(tf.hideRoles||[])});
              setTestFilterDraft({...tf,games:new Set(tf.games||["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Bundesliga","Lega","HEBA"]),hideTourneys:new Set(tf.hideTourneys||[]),hideLeagues:new Set(tf.hideLeagues||[]),hideRoles:new Set(tf.hideRoles||[])});
            }catch(e){}
          }
          // Merge savedTourneys instead of overwriting - keep local additions
          if(s.savedTourneys&&Object.keys(s.savedTourneys).length>0){
            setSavedTourneys(prev=>{
              const merged={};
              const allGames=new Set([...Object.keys(prev||{}),...Object.keys(s.savedTourneys)]);
              allGames.forEach(g=>{
                const localList=prev?.[g]||[];
                const remoteList=s.savedTourneys[g]||[];
                // Union: keep all unique entries from both
                merged[g]=[...new Set([...localList,...remoteList])];
              });
              try{localStorage.setItem("v7_saved_tourneys",JSON.stringify(merged));}catch(e){}
              return merged;
            });
          }
          // Restore savedTipsters - union local + remote
          if(s.savedTipsters&&s.savedTipsters.length>0){
            setSavedTipsters(prev=>{
              const merged=[...new Set([...(prev||[]),...s.savedTipsters])];
              try{localStorage.setItem("v7_saved_tipsers",JSON.stringify(merged));}catch(e){}
              return merged;
            });
          }
          // Restore customCups — merge par id pour éviter doublons
          if(s.customCups&&s.customCups.length>0){
            setCustomCups(prev=>{
              const localIds=new Set((prev||[]).map(c=>c.id));
              const merged=[...(prev||[]),...s.customCups.filter(c=>!localIds.has(c.id))];
              try{localStorage.setItem("v7_custom_cups",JSON.stringify(merged));}catch(e){}
              return merged;
            });
          }
        }catch(e){}
      }
      // ── Restore __settings_app__ ──────────────────────────────────────────────
      const appRow=remote.find(b=>b.player==="__SETTINGS_APP__");
      if(appRow){
        try{
          const a=JSON.parse(appRow.description||"{}");
          if(a.bookmakers&&a.bookmakers.length>0){
            setBookmakers(prev=>{
              const merged=[...a.bookmakers];
              DEFAULT_BK.forEach(bk=>{if(!merged.includes(bk))merged.push(bk);});
              return merged;
            });
          }
          if(a.bkPhotos&&Object.keys(a.bkPhotos).length>0){
            setBkPhotos(prev=>({...prev,...a.bkPhotos}));
          }
          if(a.bkAccounts&&Object.keys(a.bkAccounts).length>0){
            setBkAccounts(prev=>({...prev,...a.bkAccounts}));
          }
          if(a.bankroll!=null&&a.bankroll>0){setBankroll(a.bankroll);}
          if(a.depots&&a.depots.length>0){setDepots(a.depots);}
          if(a.overrides&&Object.keys(a.overrides).length>0){try{const merged2={...JSON.parse(localStorage.getItem("v7_overrides")||"{}"), ...a.overrides};localStorage.setItem("v7_overrides",JSON.stringify(merged2));}catch(e){}}
          if(a.hiddenBKs&&a.hiddenBKs.length>0){setHiddenBKs(new Set(a.hiddenBKs));}
          if(a.stickyBK!=null){setStickyBK(a.stickyBK);}
          if(a.lockedStatus!=null){setLockedStatus(a.lockedStatus);}
          if(a.hiddenAnalyseBets&&a.hiddenAnalyseBets.length>0){setHiddenAnalyseBets(new Set(a.hiddenAnalyseBets));}
          if(a.blacklist&&a.blacklist.length>0){setBlacklist(new Set(a.blacklist));}
          if(a.simManual&&Object.keys(a.simManual).length>0){setSimManual(prev=>({...prev,...a.simManual}));}
          if(a.tipsterPhotos&&Object.keys(a.tipsterPhotos).length>0){setTipsterPhotos(prev=>({...prev,...a.tipsterPhotos}));}
          if(a.ppData&&a.ppData.length>0){setPpData(a.ppData);}
        }catch(e){}
      }

      // Marquer comme pull pour éviter re-push automatique
      lastPulledRef.current=merged.length+":"+(merged[0]&&merged[0].id||"");
      // Re-apply any remaining overrides on top of merged data
      const ovRaw2=localStorage.getItem("v7_overrides");
      const ov2=ovRaw2?JSON.parse(ovRaw2):{};
      const finalMerged=merged.map(b=>{
        const o=ov2[String(b.id)];
        if(!o)return b;
        return{...b,...(o.datetime?{datetime:o.datetime}:{}),...(o.settledAt?{settledAt:o.settledAt}:{}),...(o.bookmaker?{bookmaker:o.bookmaker}:{})};
      });
      setBets(finalMerged);
      localStorage.setItem("v7_bets",JSON.stringify(finalMerged));
      // Push les bets locaux plus récents vers Supabase pour les autres appareils
      const toSyncBack=merged.filter(b=>{
        const loc=localMap[String(b.id)];
        const rem=remoteMap[String(b.id)];
        if(!loc||!rem)return false;
        const locTs=loc.updatedAt||loc.settledAt||loc.id||0;
        const remTs=rem.updatedAt||rem.settledAt||rem.id||0;
        return locTs>remTs;
      });
      if(toSyncBack.length>0)supaPushBets(toSyncBack).catch(function(){});
      var silent=silentArg===undefined?false:silentArg;if(!silent)showToast("☁️ "+merged.length+" paris","#7C3AED");
    }catch(e){
      // Supabase indisponible → continuer avec localStorage (offline mode)
      setSupaOk(false);
      var silent=silentArg===undefined?false:silentArg;if(!silent)showToast(" Mode hors-ligne","#F59E0B");
    }
    setSyncing(false);
  },[showToast]);

  // Pull au chargement
  useEffect(()=>{if(!loaded)return;pullFromSupa(false);},[loaded]);

  // Re-pull quand l app revient au premier plan (iOS background → foreground)
  useEffect(()=>{
    const onVisible=()=>{if(document.visibilityState==="visible")pullFromSupa(true);};
    document.addEventListener("visibilitychange",onVisible);
    return()=>document.removeEventListener("visibilitychange",onVisible);
  },[pullFromSupa]);

  // Re-pull toutes les 60s si l app est visible
  useEffect(()=>{
    if(!loaded)return;
    const t=setInterval(()=>{if(document.visibilityState==="visible")pullFromSupa(true);},60000);
    return()=>clearInterval(t);
  },[loaded,pullFromSupa]);

  // ── Reouvrir clavier iPhone au retour sur l'app ──────────────────────────
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
      if(!blacklist.has(k))merged[k]=v;
    });
    return merged;
  },[players,blacklist]);

  // Fréquence de bets par joueur - pour trier les suggestions PlayerAC
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

  // ── Filtre Test + MIB ─────────────────────────────────────────────────────
  const isTestActive=useMemo(()=>{
    const f=testFilter;
    return mibActive||f.games.size<7||f.headshot!=="all"||f.live!=="all"||f.overUnder!=="all"||!!f.oddsMin||!!f.oddsMax||f.hideTourneys.size>0||f.hideLeagues.size>0||f.hideRoles.size>0||!!f.ppEdgeMin||!!f.ppEdgeMax;
  },[testFilter,mibActive]);

  // Filtre pur hors composant - pas de capture de closure React
  const filteredByTest=useCallback((base)=>{
    let r=base;
    // MIB filter
    if(mibActive&&mibDate)r=r.filter(b=>b.datetime&&String(b.datetime).slice(0,10)>=mibDate);
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
  },[isTestActive,testFilter,mibActive,mibDate]);

  const betsForDisplay=useMemo(()=>isTestActive?filteredByTest(bets):bets,[bets,isTestActive,filteredByTest]);

  const settledFiltered=useMemo(function(){
    let base=settled;
    if(statsPeriod){const cutoff=new Date();cutoff.setDate(cutoff.getDate()-statsPeriod);const cutStr=cutoff.toISOString().slice(0,10);base=base.filter(b=>b.datetime&&String(b.datetime).slice(0,10)>=cutStr);}
    return isTestActive?filteredByTest(base):base;
  },[settled,statsPeriod,isTestActive,filteredByTest]);

  // ──  ANALYSE AVANCÉE ────────────────────────────────────────────────────
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

    // 3. Calibration PP Edge - chiffres ronds (0.5, 0.75, 1.0, etc.)
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

    // 4. Signaux - combinaisons Over/Under × Jeu
    const signals={};
    settledFiltered.forEach(b=>{
      if(!b.overUnder||b.overUnder==="")return;
      const k=b.overUnder+"|"+(b.game||"?");
      if(!signals[k])signals[k]={ou:b.overUnder,game:b.game||"?",cnt:0,won:0,profit:0,staked:0};
      const s=signals[k];s.cnt++;s.profit+=b.profit;s.staked+=b.stake;if(b.status==="won")s.won++;
    });
    const signalList=Object.values(signals)
      .filter(s=>s.cnt>=5)
      .map(s=>({...s,wr:Math.round(s.won*100/s.cnt),roi:s.staked>0?Math.round(s.profit/s.staked*1000)/10:0}))
      .sort((a,b)=>b.profit-a.profit);

    // 5. Seuil de rentabilité par tranche de cote - simplifié
    const oddsBuckets={};
    settledFiltered.forEach(b=>{
      const o=b.odds||0;
      const k=o<1.5?"<1.50":o<1.75?"1.50–1.74":o<2?"1.75–1.99":o<2.5?"2.00–2.49":"≥2.50";
      const minWR=o<1.5?67:o<1.75?57:o<2?50:o<2.5?44:40;
      if(!oddsBuckets[k])oddsBuckets[k]={cnt:0,won:0,profit:0,staked:0,minWR};
      const bk=oddsBuckets[k];bk.cnt++;bk.profit+=b.profit;bk.staked+=b.stake;if(b.status==="won")bk.won++;
    });
    const breakevenData=Object.entries(oddsBuckets)
      .map(([k,v])=>({label:k,cnt:v.cnt,wr:Math.round(v.won*100/v.cnt),minWR:v.minWR,roi:v.staked>0?Math.round(v.profit/v.staked*1000)/10:0,profit:v.profit}))
      .sort((a,b)=>a.minWR-b.minWR);

    // 6. ── COTE IDÉALE ── Map 1+2 et Map 3 seulement, edges ronds, Over/Under séparés
    const coteGroups={};
    settledFiltered.filter(b=>b.ppEdge!=null&&b.overUnder&&b.game&&(b.ppMapType==="H1+H2"||b.ppMapType==="Match")).forEach(b=>{
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

    return{dow,DAYS,curStreak,curType,bestWin,bestLoss,calibration,signalList,breakevenData,coteIdéale,weekList};
  },[settledFiltered]);

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
        // No split - all goes to main bookmaker
        add(b.bookmaker||"Autre",totalStake,b.profit,b.odds,b.status==="won");
      } else {
        // Split - distribute proportionally by stake
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

  const oddsRangeStats=useMemo(function(){
    const step=0.10;
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




  // ── Stats par jeu regroupées ─────────────────────────────────────────────
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
      const isNBA=(game==="NBA");
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
      // Tournois pour ce jeu (+ coupes personnalisées)
      // Construire un index club→coupe pour ce jeu
      const clubToCup={};
      (customCups||[]).forEach(cup=>{
        (cup.clubs||[]).forEach(cl=>{
          if(cl.name&&cl.name.trim())clubToCup[cl.name.trim().toLowerCase()]=cup.name;
        });
      });
      const tm={};
      gb.forEach(b=>{
        var effT=b.tournament;
        if(!effT&&true){ // basket
          effT=b.league;
          if(!effT&&allPlayers){var pi=allPlayers[(b.player||"").toLowerCase().trim()];if(pi&&pi.league)effT=pi.league;}
        }
        // Vérifier si le club correspond à une coupe personnalisée
        const teamLower=(b.team||"").toLowerCase().trim();
        const cupName=teamLower?clubToCup[teamLower]:null;
        if(cupName){
          const cupKey="🏆 "+cupName;
          if(!tm[cupKey])tm[cupKey]={name:cupKey,count:0,won:0,profit:0,staked:0,isCup:true};
          tm[cupKey].count++;tm[cupKey].profit+=b.profit;tm[cupKey].staked+=b.stake;
          if(b.status==="won")tm[cupKey].won++;
        }
        const k=effT||"Hors tournoi";
        if(!tm[k])tm[k]={name:k,count:0,won:0,profit:0,staked:0};
        tm[k].count++;tm[k].profit+=b.profit;tm[k].staked+=b.stake;
        if(b.status==="won")tm[k].won++;
      });
      const tourneys=Object.values(tm).sort((a,b)=>b.profit-a.profit);
      // Kills & HS
      const points={};const threes={};const duels={};
      gb.forEach(b=>{
        if(!b.description)return;
        // Fast string split instead of regex: "Over 14.5 Kills" -> parts[1]="14.5", parts[2]="Points"
        const parts=b.description.split(" ");
        const isPoints=parts.length>=3&&parts[2]==="Points";
        const is3Pts=parts.length>=3&&parts[2]==="3 Pts";
        if(is3Pts){const k=parts[1]+" HS";if(!hs[k])hs[k]={line:k,count:0,won:0,profit:0,staked:0};hs[k].count++;hs[k].profit+=b.profit;hs[k].staked+=b.stake;if(b.status==="won")hs[k].won++;}
        else if(isPoints){const k=parts[1]+" K";if(!points[k])points[k]={line:k,count:0,won:0,profit:0,staked:0};points[k].count++;points[k].profit+=b.profit;points[k].staked+=b.stake;if(b.status==="won")points[k].won++;}
        // Duel bets
        const isDuel=b.description&&b.description.includes("Duel vs");
        if(isDuel){const dk="Duel";if(!duels[dk])duels[dk]={line:"Duel",count:0,won:0,profit:0,staked:0};duels[dk].count++;duels[dk].profit+=b.profit;duels[dk].staked+=b.stake;if(b.status==="won")duels[dk].won++;}
        // Live & HS inline
        if(b.isLive){liveCnt++;liveProfit+=b.profit;liveStaked+=b.stake;if(b.status==="won")liveWon++;}
        else{nonLiveCnt++;nonLiveProfit+=b.profit;nonLiveStaked+=b.stake;if(b.status==="won")nonLiveWon++;}
        if(false){hsCnt++;hsProfit+=b.profit;hsStaked+=b.stake;if(b.status==="won")hsWon++;}
        if(isNBA){hsNonCnt++;hsNonProfit+=b.profit;hsNonStaked+=b.stake;if(b.status==="won")hsNonWon++;}
        // Global totals
        if(b.status==="won")won++;
        profit+=b.profit;staked+=b.stake;oddsSum+=b.odds;
      });
      const pointsArr=Object.values(points).map(x=>({...x,wr:x.count>0?x.won/x.count*100:0})).sort((a,b)=>b.profit-a.profit).slice(0,10);
      const duelsArr=Object.values(duels).map(x=>({...x,wr:x.count>0?x.won/x.count*100:0}));
      const hsArr=Object.values(threes).map(x=>({...x,wr:x.count>0?x.won/x.count*100:0})).sort((a,b)=>b.profit-a.profit).slice(0,10);
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
      result[game]={count:gb.length,won,profit,staked,oddsSum,wr:gb.length>0?won/gb.length*100:0,roi:staked>0?profit/staked*100:0,avgOdds:gb.length>0?oddsSum/gb.length:0,topP,worstP,allPlayers:allPSorted,roles,leagues,maps,tourneys,kills:pointsArr,hs:hsArr,liveS,nonLiveS,hsS,hsNonS,duels:duelsArr,overS,underS};
    });
    return result;
  },[settledFiltered,allPlayers,customCups]);

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
    showToast("CSV exporté ✓");
  },[bets,showToast]);

  const exportJSON=useCallback(function(){
    const data={version:7,exportedAt:new Date().toISOString(),bankroll,bets,bookmakers};
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="emeieks_backup_"+new Date().toISOString().slice(0,10)+".json";
    a.click();URL.revokeObjectURL(url);
    showToast("Sauvegarde JSON ✓");
  },[bets,bankroll,bookmakers,showToast]);

  const importJSON=useCallback(function(file){
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const data=JSON.parse(e.target.result);
        if(data.bets){setBets(data.bets);showToast(data.bets.length+" paris importés ✓");}
        if(data.bankroll)setBankroll(data.bankroll);
        if(data.bookmakers)setBookmakers(data.bookmakers);
      }catch(e){showToast("Fichier invalide ✗","#EF4444");}
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
  // ── Compound bankroll system: tier = floor(liveBK/2500)*2500 (min 5000), 1u = 1% of tier ──
  const liveBankroll=useMemo(()=>bankroll+totalProfit,[bankroll,totalProfit]);
  const bkTier=useMemo(()=>Math.max(5000,Math.floor(liveBankroll/2500)*2500),[liveBankroll]);
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
    // form.game est mis à jour par le picker de ligue — priorité sur autoInfo
    if(form.game&&form.game!=="NBA"||form.game==="NBA")return form.game||"NBA";
    if(form.autoInfo&&form.autoInfo.game)return form.autoInfo.game;
    return "NBA";
  },[form.game,form.autoInfo]);

  function addBet(){
    if(!form.player||!form.odds||!form.stake||!form.bookmaker||!form.description)return;
    const info=findPlayer(form.player)||{game:"?",league:"?",role:"?",team:"?"};
    const stake=parseFloat(form.stake),odds=parseFloat(form.odds);
    const desc=form.description?form.overUnder+" "+form.description:form.overUnder;
    const tname=(()=>{const t=activeTourneys[info.game];return(t&&(!t.end||new Date(t.end)>=new Date()))?t.name:"";})();
    if(editingBet){
      // Mode édition - remplace le pari existant avec tous les champs
      const newDatetime=form.datetime||nowDT();
      const ppFinalLineEdit=form.ppDescription||(()=>{
        const bk=parseFloat(form.description);
        if(!bk||isNaN(bk)||!form.overUnder||!form.ppMapType)return null;
        const edge=form.overUnder==="Over"?2.0:2.5;
        if(form.ppMapType==="H1+H2") return(Math.round((bk*2-edge)*2)/2).toFixed(1)+(form.isHeadshot?" 3 Pts":" Points");
        if(form.ppMapType==="Match") return(Math.round((bk-1.5)*2)/2).toFixed(1)+(form.isHeadshot?" 3 Pts":" Points");
        return null;
      })();
      const ppEdgeEdit=(()=>{
        if(!ppFinalLineEdit||!form.description)return null;
        const bk=parseFloat(form.description);
        const pp=parseFloat(ppFinalLineEdit);
        if(isNaN(bk)||isNaN(pp))return null;
        const ppPerMapE=form.ppMapType==="H1+H2"?pp/2:form.ppMapType==="H1+H2+OT"?pp/3:pp;
        return parseFloat((form.overUnder==="Over"?ppPerMapE-bk:bk-ppPerMapE).toFixed(2));
      })();
      const updatedBet={
        ...editingBet,
        player:form.player,description:desc,overUnder:form.overUnder,
        odds,stake,bookmaker:form.bookmaker,
        game:form.game||info.game,league:form.league||form.game||info.league,role:info.role,team:info.team,
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
      setForm(f=>({...EMPTY_FORM(),datetime:nowDT(),bookmaker:stickyBK?f.bookmaker:"",mapTag:f.mapLocked?f.mapTag:"Match",mapLocked:f.mapLocked,status:lockedStatus||"pending"}));
      showToast("Pari modifié ✓");
      if(editedBK){setFBKs(prev=>prev.includes(editedBK)?prev:[...prev,editedBK]);}
      setView("mesparis");
      return;
    }
    // Calcul edge PP
    const ppFinalLine=form.ppDescription||(()=>{
      const bk=parseFloat(form.description);
      if(!bk||isNaN(bk)||!form.overUnder||!form.ppMapType)return null;
      const edge=form.overUnder==="Over"?2.0:2.5;
      if(form.ppMapType==="H1+H2") return(Math.round((bk*2-edge)*2)/2).toFixed(1)+(form.isHeadshot?" 3 Pts":" Points");
      if(form.ppMapType==="Match") return(Math.round((bk-1.5)*2)/2).toFixed(1)+(form.isHeadshot?" 3 Pts":" Points");
      if(form.ppMapType==="H1+H2+OT") return(Math.round((bk*3-(form.overUnder==="Over"?3.0:4.0))*2)/2).toFixed(1)+(form.isHeadshot?" 3 Pts":" Points");
      return null;
    })();
    const ppEdge=(()=>{
      if(!ppFinalLine||!form.description)return null;
      const bk=parseFloat(form.description);
      const pp=parseFloat(ppFinalLine);
      if(isNaN(bk)||isNaN(pp))return null;
      const ppPerMap=form.ppMapType==="H1+H2"?pp/2:form.ppMapType==="H1+H2+OT"?pp/3:pp;
      // Over: edge = ppPerMap - bk (positive when PP line > bk line)
      // Under: edge = bk - ppPerMap (positive when bk line > PP line)
      return parseFloat((form.overUnder==="Over"?ppPerMap-bk:bk-ppPerMap).toFixed(2));
      return null;
    })();
    const newBet={
      id:Date.now(),updatedAt:Date.now(),player:form.player,description:desc,overUnder:form.overUnder,
      odds,stake,bookmaker:form.bookmaker,status:form.status,
      game:form.game||info.game,league:form.league||form.game||info.league,role:info.role,team:info.team,
      datetime:form.datetime||nowDT(),isHeadshot:form.isHeadshot||false,isLive:form.isLive||false,
      mapTag:form.mapTag||"",profit:calcProfit(form.status,stake,odds),
      tournament:tname,
      ppMapType:form.ppMapType||null,
      ppLine:ppFinalLine||null,
      ppEdge:ppEdge,
      tipster:tipsterName||null,
      announceOuts:form.announceOuts||[],
    };
    if(!lockedTipster)setTipsterName("");
    setBets(b=>{
      const updated=[newBet,...b];
      // Write to localStorage immediately to prevent stale reads
      try{localStorage.setItem("v7_bets",JSON.stringify(updated));}catch(e){}
      return updated;
    });
    // Mark push time to block auto-pull for 15s
    lastPushRef.current=Date.now();
    // Push immédiat vers Supabase (pas d'attente du debounce)
    supaPushBets([newBet]).catch(function(){});
    const addedBK=form.bookmaker;
    setForm(f=>({...EMPTY_FORM(),datetime:nowDT(),bookmaker:stickyBK?f.bookmaker:"",mapTag:f.mapLocked?f.mapTag:"Match",mapLocked:f.mapLocked,status:lockedStatus||"pending"}));
    showToast("Pari enregistré ✓");
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
      game:form.game||info.game,league:form.league||form.game||info.league,role:info.role,team:info.team,
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
      try{localStorage.setItem("v7_bets",JSON.stringify(updated));}catch(e){}
      return updated;
    });
    lastPushRef.current=Date.now();
    // Push immédiat vers Supabase
    supaPushBets(newBets).catch(function(){});
    setForm(f=>({...EMPTY_FORM(),datetime:nowDT(),bookmaker:stickyBK?f.bookmaker:"",mapTag:f.mapLocked?f.mapTag:"Match",mapLocked:f.mapLocked,status:lockedStatus||"pending"}));
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
    const infoW=findPlayer(winnerName)||{game:"NBA",league:"",position:"",team:""};
    const now=Date.now();
    const stake=parseFloat(duelForm.stake);
    const odds=parseFloat(duelForm.odds);
    const tname=(()=>{const t=activeTourneys[infoW.game];return(t&&(!t.end||new Date(t.end)>=new Date()))?t.name:"";})();
    const bet={
      id:now,player:winnerName,
      description:"Duel vs "+loserName+" - Plus de kills",
      overUnder:"Over",odds,stake,
      bookmaker:duelForm.bookmaker,status:"pending",
      game:infoW.game,league:infoW.league,role:infoW.role,team:infoW.team,
      datetime:duelForm.datetime||nowDT(),isHeadshot:false,isLive:duelForm.isLive,
      mapTag:duelForm.mapTag,profit:0,tournament:tname,
    };
    const duelBK=duelForm.bookmaker;
    setBets(b=>[bet,...b]);
    supaPushBets([bet]).catch(function(){});
    setDuelForm({player1:"",player2:"",odds:"",stake:"",winner:"",bookmaker:duelForm.bookmaker,mapTag:"Match",isLive:false,datetime:"",ppMapType:"",ppLine_player1:"",ppLine_player2:""});
    showToast("Duel enregistré ⚔️");
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

  function applyBulkStatus(status){
    const now=Date.now();
    const changed=[];
    setBets(b=>{
      const updated=b.map((bet,i)=>{
        if(!selectedIds.has(bet.id))return bet;
        const u={...bet,status,profit:calcProfit(status,bet.stake,bet.odds),settledAt:status!=="pending"?now+i:null,updatedAt:now};
        changed.push(u);return u;
      });
      try{localStorage.setItem("v7_bets",JSON.stringify(updated));}catch(e){}
      setTimeout(()=>supaPushBets(changed).catch(function(){}),0);
      return updated;
    });
    setBulkModal(false);setSelectMode(false);store.clear();setBulkDatetime("");
    showToast(store.count+" paris mis à jour ✓");
  }
  function applyBulkBK(){
    if(!bulkBK)return;
    const changed=[];
    setBets(b=>{
      const updated=b.map(bet=>{if(!selectedIds.has(bet.id))return bet;const u={...bet,bookmaker:bulkBK};changed.push(u);return u;});
      try{localStorage.setItem("v7_bets",JSON.stringify(updated));}catch(e){}
      setTimeout(()=>supaPushBets(changed).catch(function(){}),0);
      return updated;
    });
    setBulkModal(false);setSelectMode(false);store.clear();setBulkDatetime("");
    showToast("Bookmaker mis à jour");
  }
  function applyBulkDatetime(){
    if(!bulkDatetime)return;
    const changed=[];
    setBets(b=>{
      const updated=b.map(bet=>{
        if(!selectedIds.has(bet.id))return bet;
        // Conserver l heure originale, changer seulement la date
        const time=bet.datetime?String(bet.datetime).slice(11,16):"12:00";
        const newDT=bulkDatetime.slice(0,10)+"T"+time;
        // Mettre à jour settledAt pour que le tri dans Mes Paris soit cohérent
        const newSettledAt=bet.status!=="pending"?new Date(newDT).getTime():(bet.settledAt||null);
        const updated={...bet,datetime:newDT,settledAt:newSettledAt};
        changed.push(updated);
        return updated;
      });
      // Stocker overrides pour survivre au pull Supabase
      try{
        const ovRaw=localStorage.getItem("v7_overrides");
        const ov=ovRaw?JSON.parse(ovRaw):{};
        changed.forEach(b=>{ov[b.id]={datetime:b.datetime,settledAt:b.settledAt};});
        localStorage.setItem("v7_overrides",JSON.stringify(ov));
      }catch(e){}
      // Push immédiat uniquement les paris modifiés
      setTimeout(()=>supaPushBets(changed).catch(function(){}),0);
      return updated;
    });
    setBulkModal(false);setSelectMode(false);store.clear();setBulkDatetime("");
    showToast("Date mise à jour ✓");
  }
  function applyBulkMap(){
    if(!bulkMap)return;
    const changed=[];
    setBets(b=>{
      const updated=b.map(bet=>{if(!selectedIds.has(bet.id))return bet;const u={...bet,mapTag:bulkMap};changed.push(u);return u;});
      try{localStorage.setItem("v7_bets",JSON.stringify(updated));}catch(e){}
      setTimeout(()=>supaPushBets(changed).catch(function(){}),0);
      return updated;
    });
    setBulkModal(false);setSelectMode(false);store.clear();setBulkMap("");
    showToast("Map mise à jour ✓");
  }
  function applyBulkTourney(name){
    const changed=[];
    setBets(b=>{
      const updated=b.map(bet=>{if(!selectedIds.has(bet.id))return bet;const u={...bet,tournament:name};changed.push(u);return u;});
      try{localStorage.setItem("v7_bets",JSON.stringify(updated));}catch(e){}
      setTimeout(()=>supaPushBets(changed).catch(function(){}),0);
      return updated;
    });
    setBulkModal(false);setSelectMode(false);store.clear();setBulkTourney("");
    showToast(" Tournoi mis à jour ✓");
  }

  function savePlayer(){
    if(!pform.name.trim()||!pform.game)return;
    const rawName=pform.name.toLowerCase().trim();
    const key=rawName;
    const data={game:pform.game,league:pform.league||pform.game,role:pform.role||pform.position||"",team:pform.team,name:pform.name.trim()};
    setPlayers(p=>{
      const existing=p[key];
      if(existing&&existing.game&&existing.game!==pform.game){
        const gKey=pform.game.toLowerCase().replace(/\s+/g,"_")+":"+rawName;
        supaUpsertPlayer({name:gKey,...data}).catch(function(){});
        return{...p,[gKey]:data};
      }
      supaUpsertPlayer({name:key,...data}).catch(function(){});
      return{...p,[key]:data};
    });
    setPform({name:"",game:"NBA",league:"",role:"",team:""});
    setModalPlayer(false);
    showToast(pform.name+" ajouté ✓");
  }
  function saveBookmaker(){
    if(!newBK.trim())return;
    setBookmakers(b=>[...b,newBK.trim()]);
    if(newBKPhoto){
      const updated={...bkPhotos,[newBK.trim()]:newBKPhoto};
      setBkPhotos(updated);
      try{localStorage.setItem("v7_bkphotos",JSON.stringify(updated));}catch(e){}
    }
    setNewBK("");setNewBKPhoto("");setModalBK(false);
    showToast(newBK+" ajouté");
  }

  function toggleArr(arr,setter,val){
    setter(a=>a.includes(val)?a.filter(x=>x!==val):[...a,val]);
  }

  // ── SVG icons for nav ────────────────────────────────────────────────────


  const NAV=[
    {id:"home",label:"Accueil"},
    {id:"mesparis",label:"Mes Paris"},
    {id:"add",label:"Pari"},
    {id:"statistiques",label:"Stats"},
    {id:"players",label:"Suivi"},
  ];

  const fetchAnalyse=useCallback(async function(){
    setAnalyseLoading(true);
    try{
      const r=await fetch(SUPA_URL+"/rest/v1/bets_comparaison?select=*&order=diff.desc",{
        headers:{"apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY}
      });
      const data=await r.json();
      setAnalyseBets(Array.isArray(data)?data:[]);
      setAnalyseLastFetch(new Date());
    }catch(e){setAnalyseBets([]);}
    setAnalyseLoading(false);
  },[]);  
  const customEntries=useMemo(()=>Object.entries(players),[players]);
  const customCount=useMemo(()=>Object.keys(players).length,[players]);
  const todayKey=useMemo(()=>toDateKey(nowDT()),[]);

  // ── Rafraîchir datetime Montréal à chaque ouverture du formulaire d'ajout ──
  useEffect(()=>{
    if(view==="add"){
      setForm(f=>({...f,datetime:nowDT()}));
    }
  },[view]);


  return(
    <div style={{minHeight:"100vh",background:"#0B1220",fontFamily:"Inter,system-ui,-apple-system,sans-serif",color:"#E5E7EB",paddingBottom:84}}><style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
        img{-webkit-backface-visibility:hidden;backface-visibility:hidden;-webkit-transform:translateZ(0);transform:translateZ(0);}
        img.player-photo{image-rendering:-webkit-optimize-contrast;}
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
        .view-enter{animation:fadeUp .2s cubic-bezier(.32,.72,0,1);will-change:opacity,transform;}
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
      `}</style><div style={{maxWidth:500,margin:"0 auto",padding:"16px 14px",WebkitOverflowScrolling:"touch"}}>

        {/* Toast */}
        {toast&&<div style={{position:"fixed",top:18,left:"50%",transform:"translateX(-50%)",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",color:"#fff",padding:"10px 20px",borderRadius:12,fontWeight:700,fontSize:13,zIndex:500,boxShadow:"0 8px 24px rgba(124,58,237,0.4)",whiteSpace:"nowrap",fontFamily:"'Inter',sans-serif",animation:"fadeUp .2s ease"}}>{toast.msg}</div>}

        {/* ── CONFIRMATION VISUELLE BET ── */}

        {/* Syncing indicator */}
        {syncing&&<div style={{position:"fixed",top:18,right:14,background:"rgba(124,58,237,0.15)",border:"1px solid rgba(124,58,237,0.3)",borderRadius:8,padding:"4px 10px",fontSize:10,fontWeight:700,color:"#A78BFA",zIndex:499,fontFamily:"'Inter',sans-serif"}}>☁️ Sync…</div>}

        {/* ── BANNIÈRE MODE NOUVEAU DÉPART (Men in Black) ── */}
        {mibActive&&(
          <div style={{position:"fixed",top:0,left:0,right:0,zIndex:601,background:"linear-gradient(90deg,#0a0a0a,#111827)",padding:"6px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,.08)",boxShadow:"0 2px 16px rgba(0,0,0,.8)"}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:16}}>🕵️</span><div><div style={{fontSize:11,fontWeight:800,color:"#E5E7EB",letterSpacing:.3}}>NOUVEAU DÉPART</div><div style={{fontSize:9,color:"#4a5a6e"}}>Depuis le {new Date(mibDate).toLocaleDateString("fr-CA",{day:"numeric",month:"long",year:"numeric"})} · anciens paris masqués</div></div></div><button onClick={()=>setMibActive(false)}
              style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:6,padding:"3px 10px",color:"#9CA3AF",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
              👁 Révéler
            </button></div>
        )}

        {/* ── BANNIÈRE MODE TEST GLOBAL ── */}
        {isTestActive&&(
          <div style={{position:"fixed",top:0,left:0,right:0,zIndex:600,background:"linear-gradient(90deg,rgba(234,179,8,.95),rgba(202,138,4,.95))",padding:"5px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 2px 12px rgba(234,179,8,.4)"}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13}}>🧪</span><span style={{fontSize:11,fontWeight:800,color:"#1a1000",letterSpacing:.3}}>MODE TEST ACTIF - simulation en cours</span><span style={{fontSize:10,color:"rgba(0,0,0,.5)",marginLeft:2}}>
                {[testFilter.games.size<4&&`${testFilter.games.size} jeux`,testFilter.headshot!=="all"&&(testFilter.headshot==="yes"?"HS only":"sans HS"),testFilter.live!=="all"&&(testFilter.live==="yes"?"Live only":"sans Live"),testFilter.overUnder!=="all"&&testFilter.overUnder,testFilter.hideRoles.size>0&&`${testFilter.hideRoles.size} pos. masquées`,testFilter.hideTourneys.size>0&&`${testFilter.hideTourneys.size} tournois masqués`].filter(Boolean).join(" · ")}
              </span></div><button onClick={()=>{setTestFilter(DEFAULT_TEST_FILTER);setTestFilterDraft(DEFAULT_TEST_FILTER);}}
              style={{background:"rgba(0,0,0,.15)",border:"none",borderRadius:5,padding:"2px 8px",color:"#1a1000",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0}}>
              ✕ Reset
            </button></div>
        )}

        {/* ── VUE EN CHARGEMENT ── */}
        {viewPending&&(
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"60vh",gap:16}}><div style={{width:32,height:32,border:"2px solid rgba(99,102,241,.3)",borderTop:"2px solid #6366f1",borderRadius:"50%",animation:"spin 0.7s linear infinite"}}/><span style={{fontSize:11,color:"#4a5a6e"}}>Chargement…</span><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style></div>
        )}

        {/* ── HOME ── */}
        {!viewPending&&view==="home"&&(
          <div className="view-enter" style={{paddingBottom:8,paddingTop:(isTestActive||mibActive)?34:0}}>

            {/* ── TOP BAR ── */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18,paddingTop:2}}>
              {/* Logo + nom */}
              <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:38,height:38,borderRadius:11,background:"linear-gradient(135deg,#7c3aed,#3b82f6)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 16px rgba(124,58,237,.4)"}}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93C6.36 8.55 6.5 15.5 4.93 19.07"/><path d="M19.07 4.93C17.64 8.55 17.5 15.5 19.07 19.07"/><path d="M2 12h20"/><path d="M12 2c3.5 4 3.5 16 0 20"/></svg></div><div><div style={{fontSize:19,fontWeight:900,letterSpacing:".5px",color:"#f0f4ff",lineHeight:1}}>EMEIEKS</div><div style={{fontSize:9,color:"#4a5a6e",letterSpacing:"3px",fontWeight:700,marginTop:2}}>BANKROLL</div></div></div>
              {/* Sync */}
              <button onClick={()=>setSupaModal(true)}
                style={{display:"flex",alignItems:"center",gap:5,background:supaOk?"rgba(0,230,118,.1)":"rgba(124,58,237,.1)",border:"1px solid "+(supaOk?"rgba(0,230,118,.25)":"rgba(124,58,237,.25)"),borderRadius:10,padding:"7px 13px",cursor:"pointer",fontFamily:"Inter,sans-serif",color:supaOk?"#00E676":"#a78bfa",fontSize:11,fontWeight:700}}><span>☁️</span><span>{syncing?"Sync…":supaOk?"Sync":"Cloud"}</span>
                {supaOk&&!syncing&&<span style={{width:5,height:5,borderRadius:"50%",background:"#00E676",boxShadow:"0 0 6px rgba(0,230,118,.9)"}}/>}
              </button></div>

            {/* ── HERO PROFIT + GRAPHIQUE ── */}
            <div style={{background:"linear-gradient(160deg,rgba(13,18,38,.99),rgba(8,12,26,.99))",border:"1px solid rgba(99,130,200,.12)",borderRadius:20,padding:"18px 16px 12px",marginBottom:12,boxShadow:"0 8px 30px rgba(0,0,0,.35)"}}><div style={{marginBottom:14}}><div style={{fontSize:10,color:"#5a6a7e",fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",marginBottom:4}}>Profit Net</div><div style={{display:"flex",alignItems:"baseline",gap:10}}><div style={{fontSize:34,fontWeight:900,color:totalProfit>=0?"#00E676":"#ef4444",letterSpacing:"-1.2px",lineHeight:1,textShadow:totalProfit>=0?"0 0 24px rgba(0,230,118,.35)":"0 0 24px rgba(239,68,68,.35)"}}>{totalProfit>=0?"+":""}{totalProfit.toFixed(0)}$</div><div style={{fontSize:12,color:"#4a5a6e",fontWeight:600}}>Bankroll {bankroll.toFixed(0)}$</div></div><div style={{display:"flex",alignItems:"center",gap:6,marginTop:5}}><span style={{fontSize:10,padding:"2px 8px",borderRadius:6,background:"rgba(124,58,237,.15)",border:"1px solid rgba(167,139,250,.25)",color:"#c4b5fd",fontWeight:700}}>Palier {bkTier.toFixed(0)}$</span><span style={{fontSize:10,color:"#5a6a7e"}}>1u = {unitValue.toFixed(0)}$</span></div></div><BankrollChart points={chartPointsFiltered} h={190}/><div style={{display:"flex",gap:5,marginTop:8,alignItems:"center"}}>
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
                  style={{marginLeft:"auto",padding:"5px 8px",borderRadius:8,border:"1px solid rgba(255,255,255,.06)",background:"transparent",color:"#4a5a6e",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M4.93 4.93a10 10 0 0 0 0 14.14"/></svg></button></div></div>

            {/* ── 3 KPI CARDS ── */}
            {(()=>{
              const settled2=homeSettled;
              const pending2=bets.filter(b=>b.status==="pending").length;
              const won2=settled2.filter(b=>b.status==="won").length;
              const lost2=settled2.filter(b=>b.status==="lost").length;
              const roi2=settled2.length>0&&settled2.reduce((s,b)=>s+(b.stake||0),0)>0
                ?(settled2.reduce((s,b)=>s+(b.profit||0),0)/settled2.reduce((s,b)=>s+(b.stake||0),0)*100):0;
              return(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}><div style={{background:"rgba(10,16,34,.98)",border:"1px solid rgba(59,130,246,.18)",borderRadius:14,padding:"13px 12px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#3b82f6,#60a5fa)"}}/><div style={{fontSize:9,color:"#5a6a7e",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:7}}>PARIS</div><div style={{fontSize:22,fontWeight:900,color:"#60a5fa",letterSpacing:"-1px",lineHeight:1,marginBottom:4}}>{settled2.length+pending2}</div><div style={{fontSize:10,color:"#3a4a5a"}}>{pending2>0?pending2+" en cours":won2+"W · "+lost2+"L"}</div></div><div style={{background:"rgba(10,16,34,.98)",border:"1px solid "+(progression>=0?"rgba(0,230,118,.18)":"rgba(239,68,68,.18)"),borderRadius:14,padding:"13px 12px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:2,background:progression>=0?"linear-gradient(90deg,#059669,#00E676)":"linear-gradient(90deg,#dc2626,#ef4444)"}}/><div style={{fontSize:9,color:"#5a6a7e",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:7}}>PROGRESSION</div><div style={{fontSize:22,fontWeight:900,color:progression>=0?"#00E676":"#ef4444",letterSpacing:"-1px",lineHeight:1,marginBottom:4}}>{progression>=0?"+":""}{progression.toFixed(1)}%</div><div style={{fontSize:10,color:"#3a4a5a"}}>BK: {bankroll.toFixed(0)}$</div></div><div style={{background:"rgba(10,16,34,.98)",border:"1px solid "+(totalProfit>=0?"rgba(0,230,118,.18)":"rgba(239,68,68,.18)"),borderRadius:14,padding:"13px 12px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:2,background:totalProfit>=0?"linear-gradient(90deg,#059669,#00E676)":"linear-gradient(90deg,#dc2626,#ef4444)"}}/><div style={{fontSize:9,color:"#5a6a7e",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:7}}>PROFIT NET</div><div style={{fontSize:22,fontWeight:900,color:totalProfit>=0?"#00E676":"#ef4444",letterSpacing:"-1px",lineHeight:1,marginBottom:4}}>{totalProfit>=0?"+":""}{totalProfit.toFixed(0)}$</div><div style={{fontSize:10,color:"#3a4a5a"}}>ROI {roi2>=0?"+":""}{roi2.toFixed(1)}%</div></div></div>
              );
            })()}

            {/* ── BOUTONS ACTIONS ── */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}><button onClick={()=>setView("calendrier")}
                style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"14px",background:"linear-gradient(135deg,rgba(124,58,237,.14),rgba(99,102,241,.08))",border:"1px solid rgba(167,139,250,.25)",borderRadius:14,color:"#c4b5fd",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Calendrier
              </button><button onClick={()=>setView("statistiques")}
                style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"14px",background:"linear-gradient(135deg,rgba(59,130,246,.14),rgba(14,165,233,.08))",border:"1px solid rgba(96,165,250,.25)",borderRadius:14,color:"#93c5fd",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                Stats
              </button></div>

            {/* ── PARIS RÉCENTS ── */}
            {bets.filter(b=>b.status!=="pending").length>0&&(
              <div><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span style={{fontSize:10,color:"#4a5a6e",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase"}}>Paris récents</span><button onClick={()=>setView("mesparis")} style={{fontSize:11,color:"#a78bfa",fontWeight:700,background:"none",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",padding:0}}>
                    Voir tous ({bets.filter(b=>b.status!=="pending").length}) →
                  </button></div><div style={{background:"rgba(10,16,32,.99)",borderRadius:14,border:"1px solid rgba(99,130,200,.1)",overflow:"hidden"}}>
                  {[...bets].filter(b=>b.status!=="pending").sort(function(a,b2){return String(b2.datetime||b2.updatedAt||0).localeCompare(String(a.datetime||a.updatedAt||0));}).slice(0,6).map(function(b,i){
                    const isWon=b.status==="won";
                    const profitVal=b.profit!=null?b.profit:(isWon?(b.stake||0)*(b.odds-1):-(b.stake||0));
                    const bkLogo=BK_LOGOS[b.bookmaker]||bkPhotos[b.bookmaker]||null;
                    const descLine=b.description||"";
                    const pd=allPlayers[(b.player||"").toLowerCase().trim()];
                    const team=(pd&&pd.team)||b.team;
                    const teamLogo=team?(b.game==="EuroLeague"?EL_TEAM_LOGOS[team]:b.game==="NBA"?NBA_TEAM_LOGOS[team]:null):null;
                    const hasAnnounce=b.announceOuts&&b.announceOuts.length>0;
                    return(
                      <div key={b.id} onClick={()=>setView("mesparis")} style={{marginTop:i>0?1:0,cursor:"pointer",borderLeft:"2.5px solid "+(isWon?"#00E676":"#f43f5e"),borderBottom:i<5?"1px solid rgba(255,255,255,.04)":"none"}}><div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px"}}>
                          <div style={{width:34,height:34,borderRadius:8,overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,.04)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            {teamLogo
                              ?<img src={teamLogo} style={{width:28,height:28,objectFit:"contain"}} alt={team} onError={e=>e.target.style.display="none"}/>
                              :<GameLogo game={b.game} size={28}/>
                            }
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:3,flexWrap:"wrap"}}>
                              <span style={{fontWeight:800,fontSize:14,color:"#f0f4ff",flexShrink:0}}>{(b.player||"").split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}</span>
                              {hasAnnounce&&<span style={{fontSize:8,fontWeight:800,color:"#34d399",background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.3)",borderRadius:4,padding:"1px 4px",flexShrink:0}}>ANNONCE</span>}
                              {descLine&&<><span style={{color:"#2e3d50",fontSize:10,margin:"0 1px"}}>·</span><span style={{fontSize:11,color:"#8a9eb8",flexShrink:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{descLine}</span></>}
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:0}}>
                              <span style={{fontSize:11,fontWeight:700,color:"#7a9cbd"}}>@{b.odds}</span>
                              {(bkLogo||b.bookmaker)&&<span style={{color:"#3a4e62",margin:"0 4px",fontSize:11}}>·</span>}
                              {bkLogo?(<img src={bkLogo} alt={b.bookmaker} style={{width:13,height:13,borderRadius:3,objectFit:"cover"}}/>):<span style={{fontSize:11,color:"#7a9cbd"}}>{b.bookmaker}</span>}
                              {b.stake&&<><span style={{color:"#3a4e62",margin:"0 4px",fontSize:11}}>·</span><span style={{fontSize:11,color:"#7a9cbd"}}>{b.stake}$</span></>}
                            </div>
                          </div>
                          <div style={{flexShrink:0,textAlign:"right"}}><div style={{fontWeight:800,fontSize:14,color:isWon?"#00E676":"#f87171"}}>{profitVal>=0?"+":""}{profitVal.toFixed(2)}$</div></div>
                        </div></div>
                    );
                  })}
                </div></div>
            )}

          </div>
        )}
        {/* ── HOME CHART FILTER MODAL ── */}
        {homeChartModal&&(
          <div className="moverlay" onClick={()=>setHomeChartModal(false)}><div className="modal" style={{padding:0,overflow:"hidden",borderRadius:24,display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>

              {/* Header */}
              <div style={{padding:"16px 20px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:18,fontWeight:800,color:"#E5E7EB",letterSpacing:"-0.5px"}}>Filtres</div><button onClick={()=>setHomeChartModal(false)}
                  style={{background:"rgba(255,255,255,0.07)",border:"none",borderRadius:8,width:28,height:28,cursor:"pointer",color:"#9CA3AF",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button></div><div style={{padding:"0 16px 18px",display:"flex",flexDirection:"column",gap:14}}>

                {/* Jeux */}
                <div><div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Jeux</div><div style={{display:"flex",gap:6}}>
                    {["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Bundesliga","Lega","HEBA"].map(g=>{
                      const on=homeChartFilters.games.includes(g);
                      const cfg=GAME_CFG[g]||{accent:"#A78BFA"};
                      const acc=cfg.accent||"#A78BFA";
                      return(
                        <button key={g} onClick={()=>setHomeChartFilters(f=>({...f,games:on?f.games.filter(x=>x!==g):[...f.games,g]}))}
                          style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4,padding:"8px 4px",borderRadius:12,border:"1.5px solid "+(on?acc:"#1F2937"),background:on?`rgba(${acc==="#F1B700"?"241,183,0":acc==="#E84057"?"232,64,87":acc==="#7B8CDE"?"123,140,222":"124,58,237"},0.12)`:"rgba(255,255,255,0.02)",cursor:"pointer",transition:"all .15s"}}><GameLogo game={g} size={18}/><span style={{fontSize:10,fontWeight:600,color:on?acc:"#6B7280",fontFamily:"Inter,sans-serif"}}>{g}</span></button>
                      );
                    })}
                  </div></div>

                {/* Séparateur */}
                <div style={{height:"1px",background:"#1F2937"}}/>

                {/* Type */}
                <div><div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Type</div><div style={{display:"flex",gap:6}}>
                    {[{v:"All",l:"Tous"},{v:"Over",l:"🔼 Over"},{v:"Under",l:"🔽 Under"}].map(({v,l})=>{
                      const on=homeChartFilters.overUnder===v;
                      return(
                        <button key={v} onClick={()=>setHomeChartFilters(f=>({...f,overUnder:v}))}
                          style={{flex:1,padding:"9px 0",borderRadius:10,border:"1.5px solid "+(on?"#60A5FA":"#1F2937"),background:on?"rgba(96,165,250,0.12)":"rgba(255,255,255,0.02)",color:on?"#60A5FA":"#9CA3AF",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s"}}>
                          {l}
                        </button>
                      );
                    })}
                  </div></div>

                {/* Mode */}
                {(()=>{
                  const games=homeChartFilters.games;
                  const hasNBA=games.length===0||games.includes("NBA");
                  const hasEuro=games.length===0||games.includes("EuroLeague");
                  const hasProA=games.length===0||games.includes("Pro A");
                  const modes=[];
                  modes.push({v:"All",l:"Tous",col:"#9CA3AF"});
                  modes.push({v:"Live",l:"🔴 Live",col:"#EF4444"});
                  modes.push({v:"Non-live",l:"Non-live",col:"#60A5FA"});
                  // HS mode removed for basket
                  modes.push({v:"Duel",l:"⚔️ Duel",col:"#F59E0B"});
                  return(
                    <div><div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Mode</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
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
                      </div></div>
                  );
                })()}

                {/* Séparateur */}
                <div style={{height:"1px",background:"#1F2937"}}/>

                {/* Période */}
                <div><div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Période</div><div style={{display:"flex",gap:5,marginBottom:7}}>
                    {[{l:"Cette sem.",fn:()=>{const d=new Date();const mon=new Date(d);mon.setDate(d.getDate()-d.getDay()+1);setHomeChartFilters(f=>({...f,dateFrom:mon.toISOString().slice(0,10),dateTo:d.toISOString().slice(0,10)}));}},{l:"Ce mois",fn:()=>{const d=new Date();setHomeChartFilters(f=>({...f,dateFrom:d.getFullYear()+"-"+(d.getMonth()+1).toString().padStart(2,"0")+"-01",dateTo:d.toISOString().slice(0,10)}));}},{l:"Mois passé",fn:()=>{const d=new Date();const pm=new Date(d.getFullYear(),d.getMonth()-1,1);const pme=new Date(d.getFullYear(),d.getMonth(),0);setHomeChartFilters(f=>({...f,dateFrom:pm.toISOString().slice(0,10),dateTo:pme.toISOString().slice(0,10)}));}}].map(({l,fn})=>(
                      <button key={l} onClick={fn}
                        style={{flex:1,padding:"7px 0",borderRadius:8,border:"1px solid #1F2937",background:"rgba(255,255,255,0.03)",color:"#9CA3AF",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                        {l}
                      </button>
                    ))}
                  </div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
                    {[{label:"Du",key:"dateFrom"},{label:"Au",key:"dateTo"}].map(({label,key})=>(
                      <div key={key} style={{background:"rgba(255,255,255,0.03)",border:"1px solid "+(homeChartFilters[key]?"rgba(96,165,250,0.3)":"#1F2937"),borderRadius:10,padding:"8px 12px",transition:"border .15s"}}><div style={{fontSize:9,color:homeChartFilters[key]?"#60A5FA":"#4B5563",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{label}</div><input type="date" value={homeChartFilters[key]||""}
                          onChange={e=>setHomeChartFilters(f=>({...f,[key]:e.target.value}))}
                          style={{width:"100%",background:"transparent",border:"none",color:homeChartFilters[key]?"#E5E7EB":"#4B5563",fontSize:12,fontFamily:"Inter,sans-serif",outline:"none",padding:0}}/></div>
                    ))}
                  </div></div>

                {/* Séparateur */}
                <div style={{height:"1px",background:"#1F2937"}}/>

                {/* Bookmakers */}
                <div><div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Bookmakers</div><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                    {bookmakers.map(bk=>{
                      const on=homeChartFilters.bookmakers.includes(bk);
                      const logo=BK_LOGOS[bk]||bkPhotos[bk]||null;
                      return(
                        <button key={bk} onClick={()=>setHomeChartFilters(f=>({...f,bookmakers:on?f.bookmakers.filter(x=>x!==bk):[...f.bookmakers,bk]}))}
                          title={bk}
                          style={{width:42,height:42,borderRadius:11,border:"1.5px solid "+(on?"#00E676":"#1F2937"),background:on?"rgba(34,197,94,0.1)":"rgba(255,255,255,0.02)",cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center",position:"relative",transition:"all .15s"}}>
                          {logo?(<img src={logo} alt={bk} style={{width:26,height:26,borderRadius:6,objectFit:"cover"}}/>):(<span style={{fontSize:9,color:on?"#00E676":"#6B7280",fontWeight:700}}>{bk.slice(0,3)}</span>)}
                          {on&&<div style={{position:"absolute",top:-3,right:-3,background:"#00E676",borderRadius:"50%",width:12,height:12,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #0B1220"}}><span style={{fontSize:6,color:"#000",fontWeight:900}}>✓</span></div>}
                        </button>
                      );
                    })}
                  </div></div>

                {/* Boutons action */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:8,paddingTop:2}}><button onClick={()=>{setHomeChartFilters({games:[],overUnder:"All",live:"All",bookmakers:[],dateFrom:"",dateTo:""});setHomePeriod(null);}}
                    style={{padding:"13px",background:"rgba(255,255,255,0.05)",border:"1px solid #1F2937",borderRadius:12,color:"#6B7280",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:12}}>
                    Réinit.
                  </button><button onClick={()=>setHomeChartModal(false)}
                    style={{padding:"13px",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:12,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13,letterSpacing:"0.2px",boxShadow:"0 4px 20px rgba(124,58,237,0.35)"}}>
                    Appliquer
                  </button></div></div></div></div>
        )}

        {/* ── MES PARIS ── */}
        {!viewPending&&view==="mesparis"&&(
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
            fTipster={fTipster} setFTipster={setFTipster}
          />
        )}
        {view==="calendrier"&&(
          <div className="view-enter">
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}><button onClick={()=>setView("home")} style={{background:"rgba(124,58,237,0.15)",border:"1px solid rgba(124,58,237,0.3)",borderRadius:10,padding:"8px 12px",color:"#A78BFA",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:14,fontWeight:700}}>←</button><div style={{fontSize:16,fontWeight:700,color:"#E5E7EB"}}>Calendrier des bénéfices</div></div>

            {/* Nav mois */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}><button onClick={()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--;}setCalMonth(m);setCalYear(y);setCalSelected(null);}}
                style={{background:"#111827",border:"1px solid #1F2937",borderRadius:10,padding:"9px 14px",color:"#94A3B8",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:16,fontWeight:700}}>‹</button><div style={{flex:1,background:"#111827",border:"1px solid #1F2937",borderRadius:10,padding:"10px",textAlign:"center",fontSize:15,fontWeight:700,color:"#E5E7EB"}}>{FR_MONTHS[calMonth]} {calYear}</div><button onClick={()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++;}setCalMonth(m);setCalYear(y);setCalSelected(null);}}
                style={{background:"#111827",border:"1px solid #1F2937",borderRadius:10,padding:"9px 14px",color:"#94A3B8",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:16,fontWeight:700}}>›</button><button onClick={()=>{setCalMonth(new Date().getMonth());setCalYear(new Date().getFullYear());setCalSelected(null);}}
                style={{background:"#111827",border:"1px solid #1F2937",borderRadius:10,padding:"9px 12px",color:"#A78BFA",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>Auj.</button></div>

            {/* Filtre jeu */}
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
              {ALL_GAMES.map(g=>(
                <button key={g} onClick={()=>setCalGames(prev=>prev.includes(g)?prev.filter(x=>x!==g):[...prev,g])}
                  style={{display:"flex",alignItems:"center",gap:4,padding:"6px 10px",borderRadius:8,border:"1.5px solid "+(calGames.includes(g)?"#7C3AED":"#1F2937"),background:calGames.includes(g)?"rgba(124,58,237,0.15)":"transparent",color:calGames.includes(g)?"#A78BFA":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                  <GameLogo game={g} size={14}/>
                  <span style={{fontSize:10}}>{g}</span>
                </button>
              ))}
              {calGames.length>0&&<button onClick={()=>setCalGames([])} style={{padding:"5px 10px",borderRadius:8,border:"1px solid rgba(239,68,68,0.2)",background:"rgba(239,68,68,0.06)",color:"#EF4444",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Tous</button>}
            </div>

            {/* Calendrier grand format */}
            <div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:16,padding:"12px",marginBottom:14}}>
              {/* Jours de la semaine - commence Lundi */}
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
                      <div key={"prev"+i} style={{borderRadius:10,padding:"8px 4px",textAlign:"center",minHeight:52,opacity:.25}}><div style={{fontSize:14,fontWeight:600,color:"#6B7280"}}>{d}</div></div>
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
                        }}><div style={{fontSize:14,fontWeight:isToday?800:600,color:isToday?"#00E676":textColor,marginBottom:hasProfit?2:0}}>{d}</div>
                        {hasProfit&&(
                          <div style={{fontSize:9,fontWeight:700,color:isPositive?(intensity>0.6?"#fff":"#00E676"):(intensity>0.6?"#fff":"#EF4444"),lineHeight:1.1}}>
                            {isPositive?"+":""}{Math.abs(profit)>=1000?(profit/1000).toFixed(1)+"K":profit.toFixed(0)}$
                          </div>
                        )}
                        {hasPending&&!hasProfit&&<div style={{width:5,height:5,borderRadius:"50%",background:"#3B82F6",margin:"4px auto 0"}}/>}
                        {/* League logos for this day */}
                        {(()=>{
                          const dayBetsList=(calGames.length>0?calFilteredBets:bets).filter(b=>toDateKey(b.datetime)===dk);
                          const games=[...new Set(dayBetsList.map(b=>b.game).filter(Boolean))].slice(0,3);
                          if(games.length===0)return null;
                          return(
                            <div style={{display:"flex",justifyContent:"center",gap:2,marginTop:2,flexWrap:"wrap"}}>
                              {games.map(g=><GameLogo key={g} game={g} size={11}/>)}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  }
                  // Compléter la grille avec cases suivant
                  const totalCells=cells.length;
                  const remaining=(7-totalCells%7)%7;
                  for(let i=1;i<=remaining;i++){
                    cells.push(
                      <div key={"next"+i} style={{borderRadius:10,padding:"8px 4px",textAlign:"center",minHeight:52,opacity:.25}}><div style={{fontSize:14,fontWeight:600,color:"#6B7280"}}>{i}</div></div>
                    );
                  }
                  return cells;
                })()}
              </div></div>

            {/* Détail jour sélectionné */}
            {calSelected&&(()=>{
              const selectedDayBets=(calGames.length>0?calFilteredBets.filter(b=>toDateKey(b.datetime)===calSelected):byDay[calSelected])||[];
              const dp=dailyProfit[calSelected];
              return(
                <div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:14,padding:"12px 14px",marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>{calSelected.split("-").reverse().join("/")} - {selectedDayBets.length} paris</div>
                    {dp!==undefined&&<span style={{fontWeight:800,fontSize:14,color:dp>=0?"#00E676":"#EF4444"}}>{dp>=0?"+":""}{dp.toFixed(2)}$</span>}
                  </div><div style={{background:"#0B1220",borderRadius:10,overflow:"hidden",border:"1px solid #1F2937"}}>
                    {selectedDayBets.map(b=>{
                      const pd2=allPlayers[(b.player||"").toLowerCase().trim()];
                      const team2=(pd2&&pd2.team)||b.team;
                      const tLogo2=team2?(b.game==="EuroLeague"?EL_TEAM_LOGOS[team2]:b.game==="NBA"?NBA_TEAM_LOGOS[team2]:null):null;
                      const hasAnn=b.announceOuts&&b.announceOuts.length>0;
                      return(
                      <div key={b.id} style={{padding:"10px 12px",borderBottom:"1px solid #1F2937",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <div style={{width:28,height:28,borderRadius:6,background:"rgba(255,255,255,.04)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {tLogo2?<img src={tLogo2} style={{width:22,height:22,objectFit:"contain"}} alt={team2} onError={e=>e.target.style.display="none"}/>:<GameLogo game={b.game} size={18}/>}
                          </div>
                          <div>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <span style={{fontWeight:600,fontSize:13,color:"#E5E7EB"}}>{(b.player||"").split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}</span>
                              {hasAnn&&<span style={{fontSize:8,fontWeight:800,color:"#34d399",background:"rgba(52,211,153,.12)",border:"1px solid rgba(52,211,153,.3)",borderRadius:4,padding:"1px 4px"}}>ANNONCE</span>}
                            </div>
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
                      );
                    })}
                    {selectedDayBets.length===0&&<div style={{padding:"14px",fontSize:12,color:"#6B7280",textAlign:"center"}}>Aucun pari ce jour</div>}
                  </div></div>
              );
            })()}

            {/* Stats du mois */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:14,padding:"14px 16px"}}><div style={{fontSize:11,color:"#9CA3AF",marginBottom:4}}>Bénéfice du mois</div><div style={{fontSize:22,fontWeight:800,color:monthProfit>=0?"#00E676":"#EF4444"}}>{monthProfit>=0?"+":""}{monthProfit.toFixed(0)}$</div></div><div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:14,padding:"14px 16px"}}><div style={{fontSize:11,color:"#9CA3AF",marginBottom:4}}>Paris du mois</div><div style={{fontSize:22,fontWeight:800,color:"#60A5FA"}}>
                  {(()=>{
                    const mo=String(calMonth+1).padStart(2,"0");
                    const prefix=calYear+"-"+mo;
                    return Object.entries(dailyCount).filter(([d])=>d.startsWith(prefix)).reduce((s,[,v])=>s+v,0);
                  })()}
                </div></div></div></div>
        )}

        {/* ── VUE DÉPÔTS PAR BOOKMAKER ── */}

        {/* ── FILTRES ── */}
        {view==="filtres"&&(
          <div className="view-enter"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><div style={{fontSize:15,fontWeight:700,textTransform:"uppercase",letterSpacing:1,display:"flex",alignItems:"center",gap:7}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="4,4 20,4 14,12 14,20 10,20 10,12" fill="rgba(167,139,250,0.15)"/></svg>
                Filtres
              </div><div style={{display:"flex",gap:8}}><button onClick={()=>{setFGames([]);setFBKs([]);setFPlayer("");setFStatus("All");setFOverUnder("All");setFLive(false);setFHeadshot(false);setFDuel(false);setFMinOdds("");setFMaxOdds("");setFMinStake("");setFMaxStake("");setFMapFilter("all");setFRole("All");setFLeague("All");setFTourneys(new Set());setFiltresPage(1);}}
                  style={{padding:"7px 14px",background:"rgba(255,255,255,0.05)",border:"1px solid #1F2937",borderRadius:9,color:"#6B7280",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                  Réinit.
                </button><button onClick={()=>setView("mesparis")}
                  style={{padding:"7px 16px",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:9,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                  Appliquer →
                </button></div></div>

            {/* Période */}
            <div className="add-card"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span className="add-label" style={{marginBottom:0}}>Période</span>
                {(fDateFrom||fDateTo)&&(
                  <button onClick={()=>{setFDateFrom("");setFDateTo("");}}
                    style={{padding:"3px 10px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:6,color:"#EF4444",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                    Effacer
                  </button>
                )}
              </div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div style={{display:"flex",flexDirection:"column",gap:4}}><span style={{fontSize:10,color:"#6B7280",fontWeight:600}}>Du</span><input type="date" className="ifield" value={fDateFrom} onChange={e=>setFDateFrom(e.target.value)} style={{height:36,fontSize:13,padding:"0 10px"}}/></div><div style={{display:"flex",flexDirection:"column",gap:4}}><span style={{fontSize:10,color:"#6B7280",fontWeight:600}}>Au</span><input type="date" className="ifield" value={fDateTo} onChange={e=>setFDateTo(e.target.value)} style={{height:36,fontSize:13,padding:"0 10px"}}/></div></div></div>

            {/* Joueur */}
            <div className="add-card" style={{position:"relative"}}><span className="add-label">Joueur</span><input className="ifield" placeholder="Rechercher..." value={fPlayer} onChange={e=>setFPlayer(e.target.value)}/>
              {fPlayer&&<button onClick={()=>setFPlayer("")} style={{position:"absolute",right:24,bottom:22,background:"none",border:"none",color:"#9CA3AF",cursor:"pointer",fontSize:16}}>x</button>}
            </div>

            {/* Statut */}
            <div className="add-card"><span className="add-label">Statut</span><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {[{k:"All",label:"Tous"},{k:"pending",label:" Attente"},{k:"won",label:"✓ Gagnés"},{k:"lost",label:"✗ Perdus"}].map(t=>(
                  <button key={t.k} className={"fchip "+(fStatus===t.k?"on":"")} onClick={()=>setFStatus(t.k)}>{t.label}</button>
                ))}
              </div></div>

            {/* Ligue */}
            <div className="add-card"><span className="add-label">Ligue</span><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {ALL_GAMES.map(g=>(
                  <button key={g} className={"fchip "+(fGames.includes(g)?"on":"")} onClick={()=>toggleArr(fGames,setFGames,g)} title={g} style={{display:"flex",alignItems:"center",justifyContent:"center",padding:"6px 8px",minWidth:0}}><GameLogo game={g} size={18}/>
                  </button>
                ))}
              </div></div>

            {/* Bookmaker */}
            <div className="add-card"><span className="add-label">Bookmaker</span><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
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
              </div></div>

            {/* Over / Under */}
            <div className="add-card"><span className="add-label">Over / Under</span><div style={{display:"flex",gap:7}}>
                {[{val:"All",label:"Tous"},{val:"Over",label:"Over"},{val:"Under",label:"Under"}].map(opt=>(
                  <button key={opt.val} className={"fchip "+(fOverUnder===opt.val?"on":"")} onClick={()=>setFOverUnder(opt.val)}>{opt.label}</button>
                ))}
              </div></div>

            {/* Annoncé */}
            <div className="add-card"><span className="add-label">Annoncé</span><div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {[{k:"all",l:"Tous"},{k:"yes",l:"Annonce"},{k:"no",l:"Non annoncé"}].map(({k,l})=>{
                  const isOn=(k==="yes"&&fHeadshot)||(k==="no"&&fDuel)||(k==="all"&&!fHeadshot&&!fDuel);
                  return(
                    <button key={k} className={"fchip "+(isOn?"on":"")} onClick={()=>{
                      if(k==="all"){setFHeadshot(false);setFDuel(false);}
                      else if(k==="yes"){setFHeadshot(true);setFDuel(false);}
                      else{setFDuel(true);setFHeadshot(false);}
                    }}>{l}</button>
                  );
                })}
              </div></div>

            {/* ── Filtre cote min/max ── */}
            <div className="add-card"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span className="add-label">Cote</span>
                {(fMinOdds||fMaxOdds)&&(
                  <button onClick={()=>{setFMinOdds("");setFMaxOdds("");}}
                    style={{fontSize:10,color:"#EF4444",background:"transparent",border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
                    × Effacer
                  </button>
                )}
              </div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><div><div style={{fontSize:10,color:"#6B7280",marginBottom:4}}>Min</div><input type="number" step="0.01" min="1" placeholder="ex: 1.60"
                    value={fMinOdds} onChange={e=>setFMinOdds(e.target.value)}
                    className="ifield" style={{marginBottom:0,fontSize:14}}/></div><div><div style={{fontSize:10,color:"#6B7280",marginBottom:4}}>Max</div><input type="number" step="0.01" min="1" placeholder="ex: 2.00"
                    value={fMaxOdds} onChange={e=>setFMaxOdds(e.target.value)}
                    className="ifield" style={{marginBottom:0,fontSize:14}}/></div></div>
              {(fMinOdds||fMaxOdds)&&(()=>{
                const inRange=filteredBets.filter(b=>b.status!=="pending");
                const profit=inRange.reduce((s,b)=>s+(b.profit||0),0);
                const staked=inRange.reduce((s,b)=>s+(b.stake||0),0);
                const won=inRange.filter(b=>b.status==="won").length;
                const wr=inRange.length>0?(won/inRange.length*100).toFixed(0):0;
                const roi=staked>0?(profit/staked*100).toFixed(1):0;
                if(inRange.length===0)return null;
                return(
                  <div style={{background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.15)",borderRadius:8,padding:"8px 10px",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><div style={{fontSize:10,color:"#9CA3AF"}}>{inRange.length} paris · {wr}% WR</div><div style={{fontSize:10,color:parseFloat(roi)>=0?"#00E676":"#EF4444"}}>{parseFloat(roi)>=0?"+":""}{roi}% ROI</div></div><div style={{fontSize:16,fontWeight:700,color:profit>=0?"#00E676":"#EF4444"}}>
                      {profit>=0?"+":""}{profit.toFixed(0)}$
                    </div></div>
                );
              })()}
            </div>

            {/* ── Filtre Mise min/max ── */}
            <div className="add-card"><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><span className="add-label">Mise ($)</span>
                {(fMinStake||fMaxStake)&&(
                  <button onClick={()=>{setFMinStake("");setFMaxStake("");}}
                    style={{fontSize:10,color:"#EF4444",background:"transparent",border:"none",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>× Effacer</button>
                )}
              </div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div><div style={{fontSize:10,color:"#6B7280",marginBottom:4}}>Min</div><input type="number" step="1" min="0" placeholder="ex: 10"
                    value={fMinStake} onChange={e=>setFMinStake(e.target.value)}
                    className="ifield" style={{marginBottom:0,fontSize:14}}/></div><div><div style={{fontSize:10,color:"#6B7280",marginBottom:4}}>Max</div><input type="number" step="1" min="0" placeholder="ex: 100"
                    value={fMaxStake} onChange={e=>setFMaxStake(e.target.value)}
                    className="ifield" style={{marginBottom:0,fontSize:14}}/></div></div></div>
            <div style={{display:"flex",gap:9,marginBottom:8}}><button onClick={()=>{setFGames([]);setFBKs([]);setFPlayer("");setFStatus("All");setFOverUnder("All");setFLive(false);setFHeadshot(false);setFDuel(false);setFMinOdds("");setFMaxOdds("");setFMinStake("");setFMaxStake("");setFMapFilter("all");setFRole("All");setFLeague("All");setFTourneys(new Set());setFiltresPage(1);}} style={{flex:1,padding:"11px",background:"#111827",border:"1px solid #1F2937",borderRadius:10,color:"#9CA3AF",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600,fontSize:13}}>
                Réinitialiser
              </button><button onClick={()=>setView("mesparis")} style={{flex:1,padding:"11px",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:10,color:"#fff",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:13}}>
                Appliquer →
              </button></div>
            {(()=>{
              const fs=filteredBets;
              const fw=fs.filter(b=>b.status==="won").length;
              const fp=fs.filter(b=>b.status!=="pending").reduce((s,b)=>s+(b.profit||0),0);
              return(
                <div style={{display:"flex",gap:9,marginBottom:14}}><div className="card" style={{flex:1,padding:"10px 12px"}}><div style={{fontSize:11,color:"#9CA3AF",marginBottom:2}}>{fs.length} paris</div><div style={{fontSize:15,fontWeight:700,color:fp>=0?"#00E676":"#EF4444"}}>{fp>=0?"+":""}{fp.toFixed(0)}$</div></div><div className="card" style={{flex:1,padding:"10px 12px"}}><div style={{fontSize:11,color:"#9CA3AF",marginBottom:2}}>Win Rate</div><div style={{fontSize:15,fontWeight:700,color:"#E5E7EB"}}>{fs.length>0?(fw/fs.length*100).toFixed(0):0}%</div></div></div>
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


        {/* ── ADD BET ── */}
        {view==="add"&&(
          <div className="view-enter" style={{margin:"-16px -14px",padding:"0",minHeight:"calc(100vh - 84px)",background:"radial-gradient(circle at 50% -12%,rgba(42,73,145,.35),transparent 35%),linear-gradient(180deg,#080e1c,#050916 72%)"}}>

            {/* ── Top bar ── */}
            <div style={{padding:"14px 16px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid rgba(255,255,255,0.05)"}}><div style={{display:"flex",alignItems:"center",gap:12}}><button onClick={()=>setView("home")} style={{background:"none",border:"none",color:"#fff",fontSize:28,cursor:"pointer",lineHeight:1,padding:0,fontFamily:"Inter,sans-serif"}}>‹</button><div><div style={{fontSize:22,fontWeight:900,letterSpacing:-.5,color:"#eef3ff"}}>
                    {editingBet?"Modifier pari":sessionMode?"Session multi-map":"Ajouter un pari"}
                  </div></div></div><div style={{display:"flex",gap:6,alignItems:"center"}}>
                {editingBet&&(
                  <button onClick={()=>{setEditingBet(null);setForm({...EMPTY_FORM(),datetime:nowDT(),bookmaker:stickyBK?form.bookmaker:""});}}
                    style={{fontSize:11,color:"#6B7280",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"6px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600}}>
                    × Annuler
                  </button>
                )}</div></div><div style={{padding:"10px 14px 20px"}}>


            {/* ── DUEL MODE ── */}
            {duelMode&&(
              <>
                {/* Bookmaker */}
                <div style={{background:"#131525",borderRadius:16,border:"1px solid rgba(245,158,11,0.2)",padding:"14px 16px",marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><span style={{fontSize:12,color:"#9CA3AF",fontWeight:500}}>Bookmaker</span><button onClick={()=>setModalBK(true)} style={{padding:"3px 10px",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"#6B7280",fontSize:10,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
                      + Nouveau
                    </button></div><div style={{display:"flex",alignItems:"center",gap:10,background:"#0D0F1E",borderRadius:12,padding:"12px 14px",border:"1px solid rgba(255,255,255,0.06)"}}>
                    {(BK_LOGOS[duelForm.bookmaker]||bkPhotos[duelForm.bookmaker])&&<img src={BK_LOGOS[duelForm.bookmaker]||bkPhotos[duelForm.bookmaker]} alt="" style={{width:28,height:28,borderRadius:7,objectFit:"cover",flexShrink:0}}/>}
                    <select value={duelForm.bookmaker} onChange={e=>setDuelForm(f=>({...f,bookmaker:e.target.value}))}
                      style={{flex:1,background:"transparent",border:"none",color:duelForm.bookmaker?"#E5E7EB":"#6B7280",fontSize:16,fontFamily:"'Inter',sans-serif",fontWeight:duelForm.bookmaker?600:400,outline:"none",appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}><option value="">Sélectionner...</option>
                      {visibleBKs.map(bk=><option key={bk} value={bk} style={{background:"#131525"}}>{bk}</option>)}
                    </select><span style={{color:"#6B7280",fontSize:16}}>⌄</span></div></div>

                {/* Joueur 1 vs Joueur 2 */}
                <div style={{background:"#131525",borderRadius:16,border:"1px solid rgba(245,158,11,0.2)",padding:"14px 16px",marginBottom:10}}><div style={{fontSize:12,color:"#F59E0B",fontWeight:700,marginBottom:12,letterSpacing:.5}}>⚔️ Duel - Plus de kills sur cette map</div>

                  {/* Joueurs */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"start",marginBottom:14}}><div><div style={{fontSize:10,color:"#9CA3AF",marginBottom:6,fontWeight:600}}>Joueur 1</div><PlayerAC value={duelForm.player1} onChange={v=>setDuelForm(f=>({...f,player1:v,winner:""}))} allPlayers={allPlayers} activeTourneys={activeTourneys} betFreq={betFreq} onConfirm={()=>{}}/>
                      {duelForm.player1&&findPlayer(duelForm.player1)&&(
                        <div style={{marginTop:4,fontSize:10,color:(GAME_CFG[findPlayer(duelForm.player1).game]&&GAME_CFG[findPlayer(duelForm.player1).game].accent)||"#A78BFA",fontWeight:600}}>
                          {findPlayer(duelForm.player1).team}
                        </div>
                      )}
                    </div><div style={{fontSize:16,fontWeight:800,color:"#F59E0B",textAlign:"center",paddingTop:22}}>VS</div><div><div style={{fontSize:10,color:"#9CA3AF",marginBottom:6,fontWeight:600}}>Joueur 2</div><PlayerAC value={duelForm.player2} onChange={v=>setDuelForm(f=>({...f,player2:v,winner:""}))} allPlayers={allPlayers} activeTourneys={activeTourneys} betFreq={betFreq} onConfirm={()=>{}}/>
                      {duelForm.player2&&findPlayer(duelForm.player2)&&(
                        <div style={{marginTop:4,fontSize:10,color:(GAME_CFG[findPlayer(duelForm.player2).game]&&GAME_CFG[findPlayer(duelForm.player2).game].accent)||"#A78BFA",fontWeight:600}}>
                          {findPlayer(duelForm.player2).team}
                        </div>
                      )}
                    </div></div>

                  {/* Sélection du gagnant - apparaît quand les 2 joueurs sont choisis */}
                  {duelForm.player1&&duelForm.player2&&(
                    <div style={{marginBottom:14}}><div style={{fontSize:10,color:"#9CA3AF",marginBottom:6,fontWeight:600}}>Qui va avoir le plus de points ?</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button onClick={()=>setDuelForm(f=>({...f,winner:"player1"}))}
                          style={{padding:"12px 8px",borderRadius:12,border:"2px solid "+(duelForm.winner==="player1"?"#F59E0B":"#1F2937"),background:duelForm.winner==="player1"?"rgba(245,158,11,0.12)":"#111827",color:duelForm.winner==="player1"?"#F59E0B":"#9CA3AF",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all .2s",textTransform:"capitalize"}}>
                          {duelForm.player1||"J1"}
                          {duelForm.winner==="player1"&&<div style={{fontSize:9,color:"#F59E0B",marginTop:2}}>✓ SÉLECTIONNÉ</div>}
                        </button><button onClick={()=>setDuelForm(f=>({...f,winner:"player2"}))}
                          style={{padding:"12px 8px",borderRadius:12,border:"2px solid "+(duelForm.winner==="player2"?"#F59E0B":"#1F2937"),background:duelForm.winner==="player2"?"rgba(245,158,11,0.12)":"#111827",color:duelForm.winner==="player2"?"#F59E0B":"#9CA3AF",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all .2s",textTransform:"capitalize"}}>
                          {duelForm.player2||"J2"}
                          {duelForm.winner==="player2"&&<div style={{fontSize:9,color:"#F59E0B",marginTop:2}}>✓ SÉLECTIONNÉ</div>}
                        </button></div></div>
                  )}

                  {/* Cote unique */}
                  <div style={{marginBottom:12}}><div style={{fontSize:10,color:"#9CA3AF",marginBottom:4,fontWeight:600}}>Cote</div><div style={{background:"#0D0F1E",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}><NumPad value={duelForm.odds} onChange={v=>setDuelForm(f=>({...f,odds:v}))} placeholder="1.50" step="0.01"/></div></div>

                  {/* Mise */}
                  <div style={{marginBottom:12}}><div style={{fontSize:10,color:"#9CA3AF",marginBottom:4,fontWeight:600}}>Mise ($)</div><div style={{background:"#0D0F1E",borderRadius:10,border:"1px solid rgba(255,255,255,0.06)",overflow:"hidden"}}><NumPad value={duelForm.stake} onChange={v=>setDuelForm(f=>({...f,stake:v}))} placeholder="50" step="1"/></div><div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                      {[50,62,75,87,100].map(s=>(
                        <button key={s} onClick={()=>setDuelForm(f=>({...f,stake:String(s)}))}
                          style={{padding:"6px 12px",borderRadius:8,border:"1px solid "+(duelForm.stake===String(s)?"#F59E0B":"#1F2937"),background:duelForm.stake===String(s)?"rgba(245,158,11,0.12)":"#111827",color:duelForm.stake===String(s)?"#F59E0B":"#6B7280",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                          {s}$
                        </button>
                      ))}
                    </div></div>

                  {/* Map + Live */}
                  <div><div style={{fontSize:10,color:"#9CA3AF",marginBottom:6,fontWeight:600}}>Map</div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                      {["Q1","Q2","Q3","Q4","H1","H2","Match"].map(m=>(
                        <button key={m} onClick={()=>setDuelForm(f=>({...f,mapTag:m}))}
                          style={{padding:"7px 14px",borderRadius:20,border:"1.5px solid "+(duelForm.mapTag===m?"#F59E0B":"#1F2937"),background:duelForm.mapTag===m?"rgba(245,158,11,0.1)":"transparent",color:duelForm.mapTag===m?"#F59E0B":"#6B7280",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                          {m}
                        </button>
                      ))}
                    </div><button onClick={()=>setDuelForm(f=>({...f,isLive:!f.isLive}))}
                      style={{width:"100%",padding:"9px",borderRadius:10,border:"1.5px solid "+(duelForm.isLive?"#fb7185":"#1F2937"),background:duelForm.isLive?"rgba(251,113,133,0.12)":"transparent",color:duelForm.isLive?"#fb7185":"#6B7280",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                      {duelForm.isLive?<><span style={{width:8,height:8,borderRadius:"50%",background:"#fb7185",display:"inline-block"}}/>LIVE - En cours</> : "🔴 Marquer comme Live"}
                    </button></div>

                  {/* PP kills Duel */}
                  <div style={{marginTop:10,background:"rgba(139,92,246,.06)",border:"1px solid rgba(139,92,246,.15)",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:9,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>PrizePicks - Lignes Stats</div><div style={{display:"flex",gap:5,marginBottom:8}}>
                      {["H1+H2","Match","H1+H2+OT"].map(function(mt){
                        var on=duelForm.ppMapType===mt;
                        return <button key={mt} onClick={function(){setDuelForm(function(f){return Object.assign({},f,{ppMapType:on?"":mt,ppLine_player1:"",ppLine_player2:""});});}}
                          style={{flex:1,padding:"5px 0",borderRadius:7,border:"1px solid "+(on?"rgba(139,92,246,.4)":"rgba(255,255,255,.07)"),background:on?"rgba(124,58,237,.15)":"transparent",color:on?"#c4b5fd":"#4a5a6e",fontSize:10,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{mt}</button>;
                      })}
                    </div>
                    {duelForm.ppMapType&&(function(){
                      // Build options based on map type
                      var ranges={"H1+H2":[0.5,42.5],"Match":[0.5,24.0],"H1+H2+OT":[0.5,60.5]};
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
                              <div key={p}><div style={{fontSize:9,color:"#4a5a6e",marginBottom:4}}>{p==="player1"?duelForm.player1||"P1":duelForm.player2||"P2"}</div><select value={duelForm["ppLine_"+p]||""}
                                  onChange={function(e){var v=e.target.value;setDuelForm(function(f){var u={};u["ppLine_"+p]=v;return Object.assign({},f,u);});}}
                                  style={{width:"100%",background:"rgba(18,12,30,.98)",border:"1px solid rgba(139,92,246,.3)",borderRadius:8,padding:"7px 8px",color:"#c4b5fd",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",cursor:"pointer",boxSizing:"border-box"}}><option value="">Ligne…</option>
                                  {opts.map(function(v){return <option key={v} value={v}>{v.toFixed(1)}</option>;})}
                                </select>
                                {edge!==null&&<div style={{fontSize:11,fontWeight:700,color:col,marginTop:4}}>Edge: {edge>=0?"+":""}{edge.toFixed(2)}</div>}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div></div>

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
                    <><button onClick={addDuel} disabled={disabled}
                        style={{width:"100%",padding:"17px",background:disabled?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#F59E0B,#EF4444)",border:"none",borderRadius:16,color:disabled?"rgba(255,255,255,0.18)":"#fff",fontSize:16,fontWeight:700,cursor:disabled?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:.3,boxShadow:disabled?"none":"0 8px 28px rgba(245,158,11,0.35)",transition:"all .25s",marginBottom:4}}>
                        ⚔️ Enregistrer le duel
                      </button>
                      {missing.length>0&&(
                        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8,justifyContent:"center"}}>
                          {missing.map(f=>(
                            <span key={f} style={{fontSize:10,fontWeight:700,color:"#F59E0B",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:5,padding:"2px 7px"}}>⚠ {f}</span>
                          ))}
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            {/* ─── Floating label input style helper ─── */}
            {/* Each card: dark rounded box with subtle border + label top-left */}

            {/* ── DATE & HEURE ── */}
            {!duelMode&&<div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"11px 12px 12px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}>
              <div style={{fontSize:13,fontWeight:700,color:"#ccd3e4",marginBottom:8}}>Date & heure</div>
              <div style={{position:"relative"}}>
                {/* Affichage formaté en français */}
                <div style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(139,92,246,.3)",borderRadius:12,padding:"11px 14px",color:"#E5E7EB",fontSize:14,fontWeight:600,fontFamily:"Inter,sans-serif",pointerEvents:"none",userSelect:"none"}}>
                  {(()=>{
                    const dt=form.datetime||nowDT();
                    // Parser le format YYYY-MM-DDTHH:MM directement sans passer par Date()
                    const m=dt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
                    if(!m)return nowDT().replace("T"," à ").slice(0,16).replace("-","/").replace("-","/");
                    const mois=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
                    return parseInt(m[3])+" "+mois[parseInt(m[2])-1]+" "+m[1]+" à "+m[4]+":"+m[5];
                  })()}
                </div>
                {/* Input transparent par-dessus pour ouvrir le picker */}
                <input type="datetime-local" value={form.datetime||nowDT()} onChange={e=>setForm(f=>({...f,datetime:e.target.value}))}
                  style={{position:"absolute",inset:0,opacity:0,cursor:"pointer",width:"100%",height:"100%",border:"none",background:"transparent"}}/>
              </div>
            </div>}

            {/* ── 1. BOOKMAKER ── */}
            {!duelMode&&(()=>{
              const selBK=form.bookmaker||"";
              const selLogo=BK_LOGOS[selBK]||bkPhotos[selBK]||null;
              return(
                <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"11px 12px 12px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4"}}>Bookmaker</div>
                    <div style={{display:"flex",gap:5}}>
                      <button onClick={()=>setStickyBK(v=>!v)} style={{padding:"3px 9px",borderRadius:7,border:"1px solid "+(stickyBK?"#7C3AED":"rgba(255,255,255,0.07)"),background:stickyBK?"rgba(124,58,237,0.1)":"transparent",color:stickyBK?"#A78BFA":"#555e72",fontSize:10,cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600}}>{stickyBK?"📌 Fixé":"📎 Garder"}</button>
                      <button onClick={()=>setModalBK(true)} style={{padding:"3px 9px",borderRadius:7,border:"1px solid rgba(255,255,255,0.06)",background:"transparent",color:"#555e72",fontSize:10,cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600}}>+</button>
                    </div>
                  </div>
                  {/* Dropdown */}
                  <div style={{position:"relative"}}>
                    {selBK&&selLogo&&(
                      <img src={selLogo} alt={selBK} style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",width:22,height:22,objectFit:"contain",borderRadius:4,pointerEvents:"none",zIndex:1}}/>
                    )}
                    <select value={selBK} onChange={e=>setForm(f=>({...f,bookmaker:e.target.value}))}
                      style={{width:"100%",height:46,background:"rgba(8,14,28,.9)",border:"1.5px solid "+(selBK?"rgba(139,92,246,.4)":"rgba(255,255,255,.08)"),borderRadius:12,color:selBK?"#c4b5fd":"#6B7280",fontSize:14,fontWeight:selBK?700:500,fontFamily:"Inter,sans-serif",outline:"none",cursor:"pointer",appearance:"none",WebkitAppearance:"none",paddingLeft:selBK&&selLogo?42:14,paddingRight:36,transition:"border-color .15s"}}>
                      <option value="" style={{background:"#111827",color:"#6B7280"}}>Choisir un bookmaker…</option>
                      {visibleBKs.map(bk=>(
                        <option key={bk} value={bk} style={{background:"#111827",color:"#E5E7EB"}}>{bk}</option>
                      ))}
                    </select>
                    {/* Arrow */}
                    <svg style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",opacity:.4}} width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 5l4 4 4-4" stroke="#a78bfa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              );
            })()}

            {/* ── TEAM BET MODE ── */}
            {teamBetMode&&(()=>{
              const tbLeague=form.tbLeague||"NBA";
              const tbTeam=form.tbTeam||"";
              const tbType=form.tbType||"victoire";
              const tbSign=form.tbSign||"+";
              const tbHcp=form.tbHcp||"3.5";
              const hcpValues=[];for(let v=0.5;v<=40;v+=0.5)hcpValues.push(v.toFixed(1));
              const canSubmit=!!(tbTeam&&form.bookmaker&&form.odds&&form.stake);
              const gain=form.odds&&form.stake?(parseFloat(form.stake||0)*(parseFloat(form.odds||1)-1)).toFixed(2):null;
              const tbLogo=TEAM_LOGOS[tbTeam]||EL_TEAM_LOGOS[tbTeam]||NBA_TEAM_LOGOS[tbTeam]||null;
              const lbl={fontSize:9,color:"#4a5468",fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:4};

              return(
                <div style={{marginBottom:10}}>

                  {/* Header équipe cliquable */}
                  <div onClick={()=>{setTeamBetMode(false);setForm(f=>({...f,tbTeam:"",player:"",game:"NBA"}));}}
                    style={{background:"linear-gradient(135deg,rgba(124,58,237,.14),rgba(59,130,246,.08))",border:"1px solid rgba(139,92,246,.3)",borderRadius:20,padding:"14px 16px",marginBottom:8,display:"flex",alignItems:"center",gap:14,cursor:"pointer",userSelect:"none"}}>
                    <div style={{width:60,height:60,borderRadius:14,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,overflow:"hidden",position:"relative"}}>
                      {tbLogo&&<img src={tbLogo} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",opacity:.15,pointerEvents:"none"}}/>}
                      {tbLogo?<img src={tbLogo} alt={tbTeam} style={{width:46,height:46,objectFit:"contain",position:"relative",zIndex:1}}/>:<span style={{fontSize:28,position:"relative",zIndex:1}}>🏀</span>}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:17,fontWeight:800,color:tbTeam?"#fff":"#6B7280",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",letterSpacing:-.2}}>{tbTeam||"Choisir une équipe"}</div>
                      <div style={{display:"flex",alignItems:"center",gap:5,marginTop:4}}>
                        <GameLogo game={tbLeague} size={13}/>
                        <span style={{fontSize:12,color:"#9CA3AF"}}>{tbLeague}</span>
                        <span style={{fontSize:10,color:"#4B5563",marginLeft:4}}>· Appuyer pour changer</span>
                      </div>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{flexShrink:0,opacity:.4}}><path d="M9 3l6 6-6 6M3 9h12" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>

                  <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:20,border:"1px solid rgba(139,92,246,.2)",overflow:"hidden",marginBottom:8}}>
                    <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:14}}>

                      {/* Type de pari — une seule couleur violette */}
                      <div>
                        <div style={{...lbl,marginBottom:8}}>Type de pari</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                          {[{k:"victoire",l:"Victoire"},{k:"handicap",l:"Handicap"},{k:"longtermebets",l:"Long terme"}].map(t=>{const on=tbType===t.k;return(
                            <button key={t.k} onClick={()=>{
                              const desc=t.k==="victoire"?"Victoire "+tbTeam:t.k==="handicap"?tbTeam+" +"+(tbHcp||"3.5"):"Champion "+tbTeam+" — "+(form.tbChampComp||tbLeague||"NBA");
                              setForm(f=>({...f,tbType:t.k,overUnder:"Over",description:tbTeam?desc:""}));
                            }} style={{padding:"13px 4px",borderRadius:13,border:"1.5px solid "+(on?"rgba(139,92,246,.6)":"rgba(255,255,255,.07)"),background:on?"rgba(124,58,237,.18)":"rgba(255,255,255,.02)",color:on?"#c4b5fd":"#6B7280",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s"}}>
                              {t.l}
                            </button>
                          );})}
                        </div>
                      </div>

                      {/* Handicap */}
                      {tbType==="handicap"&&(
                        <div>
                          <div style={{...lbl,marginBottom:8}}>Handicap</div>
                          <div style={{display:"grid",gridTemplateColumns:"88px 1fr",gap:8}}>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                              {["+","-"].map(s=>(
                                <button key={s} onClick={()=>setForm(f=>({...f,tbSign:s,description:tbTeam?tbTeam+" "+s+tbHcp:s+tbHcp}))}
                                  style={{padding:"14px 0",borderRadius:12,border:"1.5px solid "+(tbSign===s?(s==="+"?"rgba(34,197,94,.5)":"rgba(248,113,113,.5)"):"rgba(255,255,255,.08)"),background:tbSign===s?(s==="+"?"rgba(34,197,94,.1)":"rgba(248,113,113,.1)"):"rgba(255,255,255,.02)",color:tbSign===s?(s==="+"?"#22C55E":"#f87171"):"#6B7280",fontWeight:900,fontSize:20,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{s}</button>
                              ))}
                            </div>
                            <div style={{position:"relative"}}>
                              <select value={tbHcp} onChange={e=>setForm(f=>({...f,tbHcp:e.target.value,description:tbTeam?tbTeam+" "+tbSign+e.target.value:tbSign+e.target.value}))}
                                style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:13,padding:"14px 40px 14px 16px",color:"#fff",fontSize:17,fontWeight:800,fontFamily:"Inter,sans-serif",outline:"none",cursor:"pointer",appearance:"none",WebkitAppearance:"none"}}>
                                {hcpValues.map(v=><option key={v} value={v}>{tbSign}{v}</option>)}
                              </select>
                              <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:"#6B7280",fontSize:13,pointerEvents:"none"}}>▾</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Long terme — compétition */}
                      {tbType==="longtermebets"&&tbTeam&&(
                        <div>
                          <div style={{...lbl,marginBottom:8}}>Compétition</div>
                          <div style={{position:"relative"}}>
                            <select value={form.tbChampComp||tbLeague} onChange={e=>setForm(f=>({...f,tbChampComp:e.target.value,description:"Champion "+tbTeam+" — "+e.target.value}))}
                              style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:13,padding:"14px 40px 14px 16px",color:"#fff",fontSize:16,fontWeight:700,fontFamily:"Inter,sans-serif",outline:"none",cursor:"pointer",appearance:"none",WebkitAppearance:"none"}}>
                              {["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Lega","Bundesliga","HEBA"].map(lg=>(
                                <option key={lg} value={lg}>{lg}</option>
                              ))}
                            </select>
                            <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",color:"#6B7280",fontSize:13,pointerEvents:"none"}}>▾</span>
                          </div>
                        </div>
                      )}

                      {/* ── COTE — identique page joueur ── */}
                      {tbTeam&&(
                        <div>
                          <div style={lbl}>Cote</div>
                          <div style={{height:48,borderRadius:12,border:"1px solid rgba(255,255,255,.09)",background:"rgba(8,14,28,.95)",display:"flex",alignItems:"center",padding:"0 10px",gap:3}}>
                            <span style={{color:"#4a5468",fontSize:13,fontWeight:500,flexShrink:0}}>@</span>
                            <input type="text" inputMode="decimal" placeholder="1.85" value={form.odds||""}
                              onChange={e=>{let v=e.target.value.replace(",",".");setForm(f=>({...f,odds:v}));}}
                              onBlur={e=>{let v=e.target.value.replace(",",".");const n=parseFloat(v);if(!isNaN(n)&&n>=100){v=(n/100).toFixed(2);}setForm(f=>({...f,odds:v}));}}
                              style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#E5E7EB",fontSize:22,fontWeight:800,fontFamily:"Inter,sans-serif",letterSpacing:"-.3px"}}/>
                          </div>
                        </div>
                      )}

                      {/* ── MISE — identique page joueur avec 6 boutons d'unités ── */}
                      {tbTeam&&(
                        <div>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                            <span style={lbl}>Mise</span>
                            <span style={{fontSize:10,color:"#7a6aae",fontWeight:600}}>1u = {unitValue.toFixed(0)}$ · Palier {bkTier.toFixed(0)}$</span>
                          </div>
                          <div style={{height:48,borderRadius:12,border:"1px solid rgba(255,255,255,.09)",background:"rgba(8,14,28,.95)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 10px",marginBottom:8}}>
                            <input type="number" step="1" placeholder="75" value={form.stake||""}
                              onChange={e=>setForm(f=>({...f,stake:e.target.value}))}
                              style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#E5E7EB",fontSize:22,fontWeight:800,fontFamily:"Inter,sans-serif",letterSpacing:"-.3px"}}/>
                            <span style={{color:"#4a5468",fontSize:13,fontWeight:500,flexShrink:0,marginLeft:3}}>$</span>
                          </div>
                          {/* 6 boutons unités — même style que page joueur */}
                          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                            {[0.75,1,1.25,1.5,1.75,2].map(u=>{
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
                          {/* Gain potentiel */}
                          {form.odds&&form.stake&&(
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:9,marginTop:6,borderTop:"1px solid rgba(255,255,255,0.04)"}}>
                              <span style={{fontSize:11,color:"#5a6478",fontWeight:500}}>Gain potentiel</span>
                              <span style={{fontSize:16,fontWeight:700,color:"#00E676"}}>+{gain}$</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tipster */}
                      {savedTipsters.length>0&&tbTeam&&(
                        <div>
                          <div style={{...lbl,marginBottom:8}}>Tipster</div>
                          <div style={{position:"relative"}}>
                            <select value={tipsterName} onChange={e=>setTipsterName(e.target.value)}
                              style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.09)",borderRadius:12,padding:"11px 36px 11px 12px",color:tipsterName?"#E5E7EB":"#6B7280",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}>
                              <option value="">Aucun tipster</option>
                              {savedTipsters.map(t=><option key={t} value={t}>{t}</option>)}
                            </select>
                            <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"#6B7280",fontSize:11,pointerEvents:"none"}}>▾</span>
                          </div>
                        </div>
                      )}

                      {/* Statut */}
                      {tbTeam&&(
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                          {[["pending","En attente","#3B82F6"],["won","Gagné","#22C55E"],["lost","Perdu","#EF4444"]].map(([s,lb,col])=>{const on=(form.status||"pending")===s;return(
                            <button key={s} onClick={()=>setForm(f=>({...f,status:s}))}
                              style={{padding:"13px 4px",borderRadius:13,border:"1.5px solid "+(on?col+"99":"rgba(255,255,255,.07)"),background:on?col+"1A":"rgba(255,255,255,.02)",color:on?col:"#6B7280",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s"}}>
                              {lb}
                            </button>
                          );})}
                        </div>
                      )}

                      {/* Boutons action */}
                      {tbTeam&&(
                        <div style={{display:"flex",flexDirection:"column",gap:8}}>
                          <button onClick={()=>{
                            setCombineMode(true);setTeamBetMode(false);
                            const teamDesc=tbType==="victoire"?"Victoire "+tbTeam:tbTeam+" "+tbSign+tbHcp;
                            setCombineLegs([{player:tbTeam,description:teamDesc,game:tbLeague,isTeam:true}]);
                          }} style={{width:"100%",height:46,border:"1.5px dashed rgba(52,211,153,.3)",borderRadius:14,background:"rgba(52,211,153,.04)",color:"#34d399",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                            + Combiner avec un joueur
                          </button>
                          <button disabled={!canSubmit} onClick={()=>{
                            const finalDesc=tbType==="victoire"?"Victoire "+tbTeam:tbType==="handicap"?tbTeam+" "+tbSign+tbHcp:"Vainqueur "+(form.tbChampComp||tbLeague);
                            setForm(f=>({...f,player:tbTeam,description:finalDesc,overUnder:"Over",game:tbLeague,tbConfirmed:true,status:f.status||"pending",tipster:tipsterName||null}));
                            setTimeout(()=>{addBet();setTeamBetMode(false);setForm(f=>({...f,tbTeam:"",tbConfirmed:false,odds:"",stake:"",status:"pending"}));},0);
                          }} style={{width:"100%",height:58,background:canSubmit?"linear-gradient(135deg,#7c3aed,#6d5dfc)":"rgba(255,255,255,.04)",border:"none",borderRadius:16,color:canSubmit?"#fff":"rgba(255,255,255,.18)",fontSize:15,fontWeight:700,cursor:canSubmit?"pointer":"not-allowed",fontFamily:"Inter,sans-serif",boxShadow:canSubmit?"0 8px 28px rgba(124,58,237,.35)":"none",transition:"all .2s"}}>
                            {canSubmit?"Ajouter à mes paris ✓":"Compléter le formulaire"}
                          </button>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              );
            })()}
            {/* ── COMBINE MODE ── */}
            {combineMode&&(()=>{
              const canSubmitCombo=combineLegs.length>=2&&combineLegs.every(l=>l.player&&l.description)&&form.bookmaker&&form.odds&&form.stake;
              const gain=form.odds&&form.stake?(parseFloat(form.stake||0)*(parseFloat(form.odds||1)-1)).toFixed(0):null;
              return(
                <div style={{background:"#080e1e",borderRadius:20,border:"1px solid rgba(255,255,255,.08)",overflow:"hidden",marginBottom:10}}>
                  <div style={{padding:"14px 16px",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                    <div style={{fontSize:11,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:1.2}}>Paris combinés</div>
                  </div>
                  <div style={{padding:"14px 16px",display:"flex",flexDirection:"column",gap:10}}>
                    {combineLegs.map((leg,i)=>(
                      <div key={i} style={{borderRadius:12,border:"1px solid rgba(255,255,255,.07)",background:"rgba(255,255,255,.02)",overflow:"hidden"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                          <span style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Sélection {i+1}</span>
                          {combineLegs.length>2&&<button onClick={()=>setCombineLegs(l=>l.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#6B7280",cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 2px"}}>×</button>}
                        </div>
                        <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
                          <input className="ifield" placeholder="Joueur…" value={leg.player} onChange={e=>setCombineLegs(l=>l.map((x,j)=>j===i?{...x,player:e.target.value}:x))} style={{marginBottom:0}}/>
                          <input className="ifield" placeholder="Sélection (ex: 24.5 Points)…" value={leg.description} onChange={e=>setCombineLegs(l=>l.map((x,j)=>j===i?{...x,description:e.target.value}:x))} style={{marginBottom:0}}/>
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                            {["Over","Under"].map(ou=>(
                              <button key={ou} onClick={()=>setCombineLegs(l=>l.map((x,j)=>j===i?{...x,overUnder:ou}:x))}
                                style={{padding:"10px",borderRadius:10,border:"1px solid "+(leg.overUnder===ou?(ou==="Over"?"rgba(34,197,94,.35)":"rgba(96,165,250,.35)"):"rgba(255,255,255,.06)"),background:leg.overUnder===ou?(ou==="Over"?"rgba(34,197,94,.07)":"rgba(96,165,250,.07)"):"transparent",color:leg.overUnder===ou?(ou==="Over"?"#4ade80":"#60a5fa"):"#6B7280",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                                {ou==="Over"?"▲ Over":"▼ Under"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={()=>setCombineLegs(l=>[...l,{player:"",description:"",overUnder:"Over"}])}
                      style={{width:"100%",padding:"11px",background:"transparent",border:"1px dashed rgba(255,255,255,.1)",borderRadius:12,color:"#6B7280",cursor:"pointer",fontSize:12,fontFamily:"Inter,sans-serif",fontWeight:600}}>
                      + Ajouter une sélection
                    </button>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div>
                        <div style={{fontSize:10,color:"#4B5563",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Cote combinée</div>
                        <input type="number" step="0.01" placeholder="3.45" value={form.odds||""} onChange={e=>setForm(f=>({...f,odds:e.target.value}))}
                          style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,padding:"13px 14px",color:"#E5E7EB",fontSize:18,fontWeight:800,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"}}/>
                      </div>
                      <div>
                        <div style={{fontSize:10,color:"#4B5563",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Mise ($)</div>
                        <input type="number" step="1" placeholder="25" value={form.stake||""} onChange={e=>setForm(f=>({...f,stake:e.target.value}))}
                          style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:12,padding:"13px 14px",color:"#E5E7EB",fontSize:18,fontWeight:800,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"}}/>
                      </div>
                    </div>
                    {gain&&<div style={{textAlign:"center",fontSize:12,color:"#4ade80",fontWeight:700}}>+{gain}$ potentiel</div>}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>
                      {[["pending","⏳","#3B82F6"],["won","✓","#22C55E"],["lost","✗","#EF4444"]].map(([s,ic,col])=>(
                        <button key={s} onClick={()=>setForm(f=>({...f,status:s}))}
                          style={{padding:"10px",borderRadius:10,border:"1px solid "+((form.status||"pending")===s?col+"66":"rgba(255,255,255,.06)"),background:(form.status||"pending")===s?col+"18":"rgba(255,255,255,.02)",color:(form.status||"pending")===s?col:"#6B7280",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                          {ic} {s==="pending"?"Attente":s==="won"?"Gagné":"Perdu"}
                        </button>
                      ))}
                    </div>
                    <button disabled={!canSubmitCombo}
                      onClick={()=>{
                        const comboDesc=combineLegs.map(l=>l.overUnder+" "+l.description+" ("+l.player+")").join(" | ");
                        const comboPlayer=combineLegs.map(l=>l.player).join(", ");
                        setForm(f=>({...f,player:comboPlayer,description:comboDesc,overUnder:"Over",game:"NBA",tbConfirmed:true,status:f.status||"pending"}));
                        setTimeout(()=>{ addBet(); setCombineMode(false); setCombineLegs([{player:"",description:"",overUnder:"Over"},{player:"",description:"",overUnder:"Over"}]); setForm(f=>({...f,tbConfirmed:false,odds:"",stake:"",status:"pending"})); },0);
                      }}
                      style={{width:"100%",height:56,background:canSubmitCombo?"linear-gradient(135deg,#7c3aed,#6d5dfc)":"rgba(255,255,255,.04)",border:"none",borderRadius:16,color:canSubmitCombo?"#fff":"rgba(255,255,255,.18)",fontSize:15,fontWeight:700,cursor:canSubmitCombo?"pointer":"not-allowed",fontFamily:"Inter,sans-serif",boxShadow:canSubmitCombo?"0 8px 28px rgba(124,58,237,.35)":"none",transition:"all .2s"}}>
                      {canSubmitCombo?"Ajouter à mes paris ✓":"Compléter le formulaire"}
                    </button>
                  </div>
                </div>
              );
            })()}
            {!duelMode&&!teamBetMode&&!combineMode&&<>
            {/* ── 2. JOUEUR / ÉQUIPE ── */}
            <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:10}}><div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4",letterSpacing:.2}}>
                  Joueur / Équipe
                </div><button onClick={()=>{setPform({name:"",game:"NBA",league:"",position:"",team:""});setModalPlayer(true);}}
                  style={{padding:"3px 9px",borderRadius:7,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"#6B7280",fontSize:10,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
                  + Ajouter un joueur
                </button></div>
              {!form.autoInfo&&!teamBetMode&&(()=>{
                // Search teams too
                const uniQ=(form.player||"").toLowerCase().trim();
                const teamMatches=uniQ.length>=2?
                  Object.entries(ALL_LEAGUE_TEAMS)
                    .flatMap(([lg,teams])=>teams.filter(t=>t.toLowerCase().includes(uniQ)).map(t=>({name:t,lg})))
                    .slice(0,5)
                  :[];
                return(
                  <div>
                    <div style={{background:"rgba(8,14,28,0.9)",borderRadius:12,border:"1px solid rgba(255,255,255,0.06)",padding:"2px 10px"}}>
                      <PlayerAC ref={playerACRef} value={form.player} onChange={v=>{
                        const pi=findPlayer(v);
                        setForm(f=>({...f,player:v,autoInfo:pi}));
                      }} allPlayers={allPlayers} activeTourneys={activeTourneys} betFreq={betFreq} onConfirm={()=>{setTimeout(()=>{const el=document.getElementById("kills-select");if(el){el.focus();el.click();}else{const odds=document.getElementById("odds-input-field");if(odds)odds.focus();}},80);}}/>
                    </div>
                    {/* Suggestions équipes */}
                    {teamMatches.length>0&&(
                      <div style={{marginTop:6,display:"flex",flexDirection:"column",gap:3}}>
                        {teamMatches.map(({name,lg})=>{
                          const logo=TEAM_LOGOS[name]||EL_TEAM_LOGOS[name]||NBA_TEAM_LOGOS[name]||null;
                          return(
                            <button key={lg+name} onClick={()=>{
                              setTeamBetMode(true);
                              setCombineMode(false);
                              setForm(f=>({...f,tbLeague:lg,tbTeam:name,player:name,game:lg,description:"Victoire "+name,tbType:"victoire"}));
                            }}
                              style={{display:"flex",alignItems:"center",gap:9,padding:"9px 12px",background:"rgba(96,165,250,.06)",border:"1px solid rgba(96,165,250,.15)",borderRadius:10,cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
                              {logo?<img src={logo} alt={name} style={{width:20,height:20,objectFit:"contain",flexShrink:0}}/>:<GameLogo game={lg} size={18}/>}
                              <span style={{fontSize:13,fontWeight:600,color:"#E5E7EB",flex:1}}>{name}</span>
                              <span style={{fontSize:10,color:"#60a5fa",fontWeight:600}}>{lg}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
              {form.autoInfo&&(
                <div style={{position:"relative",borderRadius:16,border:"1px solid rgba(139,92,246,.18)",background:"linear-gradient(105deg,rgba(12,18,38,.99) 55%,rgba(20,14,42,.97))",display:"flex",alignItems:"stretch",overflow:"hidden",minHeight:118}}>

                  {/* ── Zone photo (38% de la carte) ── */}
                  <div style={{width:"38%",flexShrink:0,position:"relative",display:"flex",alignItems:"flex-end",justifyContent:"center",overflow:"hidden"}}>
                    {/* Logo équipe en filigrane */}
                    {(()=>{
                      const watermarkSrc=
                        form.autoInfo.team_logo_url||
                        TEAM_LOGOS[form.autoInfo.team]||
                        EL_TEAM_LOGOS[form.autoInfo.team]||
                        NBA_TEAM_LOGOS[form.autoInfo.team]||null;
                      if(!watermarkSrc)return null;
                      return(
                        <img src={watermarkSrc} alt="" onError={e=>e.target.style.display='none'}
                          style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"85%",height:"85%",objectFit:"contain",opacity:.12,zIndex:0,pointerEvents:"none"}}/>
                      );
                    })()}
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
                            contain:"layout",
                          }}
                        />
                      );
                      // Avatar par défaut - logo du club ou initiale
                      const teamLogo=TEAM_LOGOS[form.autoInfo.team]||EL_TEAM_LOGOS[form.autoInfo.team]||NBA_TEAM_LOGOS[form.autoInfo.team]||null;
                      if(teamLogo)return(
                        <div style={{position:"relative",zIndex:1,width:72,height:72,borderRadius:16,background:"rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:16,boxShadow:"0 0 20px rgba(124,58,237,.3)"}}>
                          <img src={teamLogo} alt={form.autoInfo.team} style={{width:52,height:52,objectFit:"contain"}} loading="lazy"/>
                        </div>
                      );
                      return(
                        <div style={{position:"relative",zIndex:1,width:64,height:64,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,fontWeight:800,color:"#fff",textTransform:"uppercase",marginBottom:16,boxShadow:"0 0 24px rgba(124,58,237,.5)"}}>
                          {(form.autoInfo.name||form.player).charAt(0)}
                        </div>
                      );
                    })()}
                    {/* Fondu droit pour transition douce vers le texte */}
                    <div style={{position:"absolute",top:0,right:0,bottom:0,width:32,background:"linear-gradient(to right,transparent,rgba(12,18,38,.99))",zIndex:2,pointerEvents:"none"}}/></div>

                  {/* ── Infos joueur (droite) ── */}
                  <div style={{flex:1,padding:"14px 12px 12px 6px",display:"flex",flexDirection:"column",justifyContent:"center",gap:6,minWidth:0}} onClick={()=>form._lgPickerOpen&&setForm(f=>({...f,_lgPickerOpen:false}))}><div style={{fontSize:19,fontWeight:700,letterSpacing:-.3,color:"#f0f4ff",lineHeight:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {(form.autoInfo.name||form.player).split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}
                    </div><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",position:"relative"}}>
                      {form.autoInfo.team&&(()=>{
                        const tl=form.autoInfo.game==="EuroLeague"?EL_TEAM_LOGOS[form.autoInfo.team]:form.autoInfo.game==="NBA"?NBA_TEAM_LOGOS[form.autoInfo.team]:null;
                        return(
                          <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:12,fontWeight:700,color:"#c8d4e8"}}>
                            {tl&&<img src={tl} alt="" style={{width:14,height:14,objectFit:"contain",opacity:.9}} onError={e=>e.target.style.display="none"}/>}
                            {form.autoInfo.team}
                          </span>
                        );
                      })()}
                      <span style={{color:"#4a5a6e",fontSize:12,fontWeight:300}}>·</span>
                      <button
                        onClick={e=>{e.stopPropagation();setForm(f=>({...f,_lgPickerOpen:!f._lgPickerOpen}));}}
                        title="Changer la ligue du pari"
                        style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.15)",borderRadius:8,padding:"4px 8px",cursor:"pointer"}}>
                        <GameLogo game={form.autoInfo.game} size={14}/>
                        <span style={{fontSize:10,color:"#9CA3AF",fontWeight:600}}>{form.autoInfo.game}</span>
                        <span style={{fontSize:9,color:"#6B7280"}}>▾</span>
                      </button>
                      {form._lgPickerOpen&&(()=>{
                        // Trouver les ligues du club du joueur via MULTI_LEAGUE_CLUBS
                        const playerTeam=form.autoInfo.team||"";
                        const teamNorm=playerTeam.toLowerCase().trim();
                        const officialName=Object.keys(MULTI_LEAGUE_CLUBS).find(k=>k.toLowerCase().trim()===teamNorm)||null;
                        const availLeagues=officialName?MULTI_LEAGUE_CLUBS[officialName]:null;
                        // Si pas trouvé → toutes les ligues
                        const leaguesToShow=availLeagues||["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Lega","Bundesliga","HEBA"];
                        return(
                          <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}
                            onClick={()=>setForm(f=>({...f,_lgPickerOpen:false}))}>
                            <div style={{background:"#0d1225",border:"1px solid rgba(255,255,255,.15)",borderRadius:18,padding:"16px",width:"100%",maxWidth:300,boxShadow:"0 24px 60px rgba(0,0,0,.9)"}}
                              onClick={e=>e.stopPropagation()}>
                              <div style={{fontSize:11,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:12,textAlign:"center"}}>Ligue du pari — {form.autoInfo.name||form.player}</div>
                              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                                {leaguesToShow.map(lg=>{
                                  const on=form.autoInfo.game===lg;
                                  return(
                                    <button key={lg} onClick={()=>setForm(f=>({...f,autoInfo:{...f.autoInfo,game:lg,league:lg},game:lg,league:lg,_lgPickerOpen:false}))}
                                      style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:10,border:"1px solid "+(on?"rgba(167,139,250,.4)":"rgba(255,255,255,.07)"),background:on?"rgba(124,58,237,.15)":"rgba(255,255,255,.02)",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left",width:"100%"}}>
                                      <GameLogo game={lg} size={16}/>
                                      <span style={{flex:1,fontSize:13,fontWeight:on?700:500,color:on?"#a78bfa":"#E5E7EB"}}>{lg}</span>
                                      {on&&<span style={{color:"#a78bfa",fontSize:14}}>✓</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {form.autoInfo.role&&(
                        <><span style={{color:"#4a5a6e",fontSize:12,fontWeight:300}}>·</span><span style={{fontSize:11,fontWeight:600,color:"#7a9cbd"}}>{form.autoInfo.role}</span></>
                      )}
                    </div>
                    {(()=>{const t=activeTourneys[form.autoInfo.game];const isExpired=t&&t.end&&new Date(t.end)<new Date();if(!t||isExpired)return null;return <span style={{display:"inline-flex",alignItems:"center",gap:3,padding:"2px 7px",borderRadius:5,background:"rgba(124,58,237,.1)",color:"#a78bfa",fontWeight:600,fontSize:10,border:"1px solid rgba(124,58,237,.2)",alignSelf:"flex-start"}}> {t.name}</span>})()}
                  </div>

                  {/* ── Bouton Changer ── */}
                  <div style={{padding:"12px 12px 12px 0",display:"flex",alignItems:"flex-start",flexShrink:0}}><button onClick={()=>{setForm(f=>({...f,player:"",autoInfo:null}));setTimeout(()=>playerACRef.current&&playerACRef.current.focus(),50);}}
                      style={{padding:"6px 10px",borderRadius:9,border:"1px solid rgba(139,92,246,.3)",color:"#9d7bef",fontWeight:500,fontSize:11,background:"rgba(139,92,246,.05)",cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap"}}>
                      Changer
                    </button></div></div>
              )}
              {form.player&&!form.autoInfo&&!form.tbConfirmed&&<div style={{marginTop:7,fontSize:11,color:"#F59E0B",fontWeight:600}}>⚠ Joueur non reconnu - tu peux quand même enregistrer.</div>}
              {form.player&&!form.autoInfo&&form.tbConfirmed&&(
                <div style={{marginTop:7,padding:"10px 14px",background:"rgba(96,165,250,.06)",border:"1px solid rgba(96,165,250,.15)",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>{form.description}</div>
                    <div style={{fontSize:10,color:"#6B7280",marginTop:2}}>{form.game}</div>
                  </div>
                  <button onClick={()=>setTeamBetMode(true)}
                    style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(96,165,250,.3)",background:"rgba(96,165,250,.08)",color:"#60a5fa",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                    Modifier
                  </button>
                </div>
              )}
            </div>





            {/* ── BET BUILDER — phrase interactive ── */}
            <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"12px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#6b7280",letterSpacing:1,textTransform:"uppercase",marginBottom:12}}>Sélection</div>
              {!form.autoInfo?(
                <div style={{height:50,background:"rgba(8,14,28,.6)",borderRadius:13,border:"1px solid rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"center",color:"#4e5a6e",fontSize:13,fontWeight:500}}>
                  Sélectionnez d'abord un joueur
                </div>
              ):(()=>{
                const BET_TYPES_LIST=[
                  {id:"pts",     label:"PTS",   full:"Points",      col:"#a78bfa"},
                  {id:"reb",     label:"REB",   full:"Rebounds",    col:"#fb923c"},
                  {id:"ast",     label:"AST",   full:"Assists",     col:"#60a5fa"},
                  {id:"3pts",    label:"3PT",   full:"3 Pts",       col:"#34d399"},
                  {id:"pts_reb", label:"P+R",   full:"Pts+Reb",     col:"#f472b6"},
                  {id:"pts_ast", label:"P+A",   full:"Pts+Ast",     col:"#38bdf8"},
                  {id:"pts_reb_ast",label:"P+R+A",full:"Pts+Reb+Ast",col:"#fbbf24"},
                ];
                const BET_OPTS={
                  pts:       Array.from({length:33},(_,i)=>((i+3.5).toFixed(1))),
                  reb:       Array.from({length:16},(_,i)=>((i+0.5).toFixed(1))),
                  ast:       Array.from({length:16},(_,i)=>((i+0.5).toFixed(1))),
                  "3pts":    Array.from({length:13},(_,i)=>((i+0.5).toFixed(1))),
                  pts_reb:   Array.from({length:48},(_,i)=>((i+4.0).toFixed(1))),
                  pts_ast:   Array.from({length:48},(_,i)=>((i+4.0).toFixed(1))),
                  pts_reb_ast:Array.from({length:63},(_,i)=>((i+4.5).toFixed(1))),
                };
                const BET_SUFFIX={
                  pts:"Points",reb:"Rebounds",ast:"Assists","3pts":"3 Pts",
                  pts_reb:"Pts+Reb",pts_ast:"Pts+Ast",pts_reb_ast:"Pts+Reb+Ast",
                };
                const selBT=form.betType||null;
                const selBTObj=BET_TYPES_LIST.find(b=>b.id===selBT);
                const lineVals=selBT?BET_OPTS[selBT]:BET_OPTS.pts;
                // Valeur numérique stockée dans betLine (champ dédié) — fallback sur description
                const selVal=form.betLine||(form.description?form.description.split(" ")[0]:"");
                // S'assurer que selVal est dans les options du type actuel
                const validVal=lineVals.includes(selVal)?selVal:"";

                const boxStyle=(active,col)=>({
                  flex:1,minWidth:0,height:54,borderRadius:13,
                  border:"1.5px solid "+(active?(col||"#a78bfa"):"rgba(255,255,255,.07)"),
                  background:active?"rgba(167,139,250,.1)":"rgba(8,14,28,.8)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  cursor:"pointer",fontFamily:"Inter,sans-serif",
                  appearance:"none",WebkitAppearance:"none",outline:"none",
                  color:active?(col||"#a78bfa"):"#4a5568",
                  fontWeight:active?800:600,fontSize:13,
                  boxShadow:active?"0 0 16px rgba(167,139,250,.2)":"none",
                  transition:"all .15s",padding:"0 6px",
                });

                return(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {/* Ligne 1 : Over/Under */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      {["Over","Under"].map(ou=>{
                        const active=form.overUnder===ou;
                        const col=ou==="Over"?"#00E676":"#3b82f6";
                        return(
                          <button key={ou} onClick={()=>setForm(f=>({...f,overUnder:ou}))}
                            style={{...boxStyle(active,col),fontSize:15,fontWeight:800,letterSpacing:.5}}>
                            {ou==="Over"?"▲ OVER":"▼ UNDER"}
                          </button>
                        );
                      })}
                    </div>

                    {/* Ligne 2 : [Valeur] [Type] côte à côte */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      {/* Valeur */}
                      <div style={{position:"relative"}}>
                        <select value={validVal}
                          onChange={e=>{
                            const v=e.target.value;
                            const suffix=BET_SUFFIX[selBT]||"Points";
                            setForm(f=>({...f,betLine:v,description:v?v+" "+suffix:""}));
                          }}
                          style={{...boxStyle(!!validVal,"#c4b5fd"),width:"100%",paddingRight:28}}>
                          <option value="">Ligne…</option>
                          {lineVals.map(v=><option key={v} value={v}>{v}</option>)}
                        </select>
                        <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:"#6B7280",fontSize:11,pointerEvents:"none"}}>▾</span>
                      </div>

                      {/* Type de stat */}
                      <div style={{position:"relative"}}>
                        <select value={selBT||""}
                          onChange={e=>{
                            const newBT=e.target.value;
                            const suffix=BET_SUFFIX[newBT]||"Points";
                            // Garder la valeur actuelle si elle est valide dans le nouveau type, sinon vider
                            const newOpts=BET_OPTS[newBT]||[];
                            const keepVal=newOpts.includes(selVal)?selVal:"";
                            setForm(f=>({...f,betType:newBT,betLine:keepVal,description:keepVal?keepVal+" "+suffix:""}));
                          }}
                          style={{...boxStyle(!!selBT,selBTObj?.col||"#a78bfa"),width:"100%",paddingRight:28}}>
                          <option value="">Type…</option>
                          {BET_TYPES_LIST.map(bt=><option key={bt.id} value={bt.id}>{bt.full}</option>)}
                        </select>
                        <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",color:"#6B7280",fontSize:11,pointerEvents:"none"}}>▾</span>
                      </div>
                    </div>

                    {/* Résumé de la sélection */}
                    {form.overUnder&&validVal&&selBT&&(
                      <div style={{padding:"8px 12px",borderRadius:10,background:"rgba(167,139,250,.06)",border:"1px solid rgba(167,139,250,.15)",fontSize:13,fontWeight:700,color:"#c4b5fd",textAlign:"center",letterSpacing:.2}}>
                        {form.overUnder} {validVal} {BET_SUFFIX[selBT]}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* ── 4. TYPE DE PARI (Over/Under) — supprimé, intégré ci-dessus ── */}

            {/* ── 5. COTE & MISE ── */}
            {!sessionMode&&(
              <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}><div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4",letterSpacing:.2,marginBottom:9}}>
                  
                  Cote & Mise
                </div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:9}}><div><div style={{fontSize:9,color:"#4a5468",fontWeight:700,marginBottom:4,letterSpacing:.8,textTransform:"uppercase"}}>Cote</div><div style={{height:48,borderRadius:12,border:"1px solid rgba(255,255,255,.09)",background:"rgba(8,14,28,.95)",display:"flex",alignItems:"center",padding:"0 10px",overflow:"hidden",gap:3}}><span style={{color:"#4a5468",fontSize:13,fontWeight:500,flexShrink:0}}>@</span><NumPad id="odds-input-field" value={form.odds} onChange={v=>setForm(f=>({...f,odds:v}))} placeholder="1.85" step="0.01"/></div></div><div><div style={{fontSize:9,color:"#4a5468",fontWeight:700,marginBottom:4,letterSpacing:.8,textTransform:"uppercase"}}>Mise</div><div style={{height:48,borderRadius:12,border:"1px solid rgba(255,255,255,.09)",background:"rgba(8,14,28,.95)",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 10px",overflow:"hidden"}}><NumPad value={form.stake} onChange={v=>setForm(f=>({...f,stake:v}))} placeholder="75" step="1"/><span style={{color:"#4a5468",fontSize:13,fontWeight:500,flexShrink:0,marginLeft:3}}>$</span></div></div></div><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:9,color:"#4a5468",fontWeight:700,letterSpacing:.8,textTransform:"uppercase"}}>Mise rapide</span><span style={{fontSize:10,color:"#7a6aae",fontWeight:600}}>1u = {unitValue.toFixed(0)}$ · Palier {bkTier.toFixed(0)}$</span></div><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6,marginBottom:form.odds&&form.stake?9:0}}>
                  {[0.75,1,1.25,1.5,1.75,2].map(u=>{
                    const s=unitValue*u;
                    const sStr=Number.isInteger(s)?String(s):s.toFixed(1);
                    const isActive=parseFloat(form.stake)===s;
                    return(
                      <button key={u} onClick={()=>setForm(f=>({...f,stake:sStr}))}
                        style={{height:52,borderRadius:12,border:"1px solid "+(isActive?"rgba(139,92,246,.65)":"rgba(255,255,255,.09)"),background:isActive?"rgba(139,92,246,.2)":"rgba(255,255,255,.03)",color:isActive?"#d4c5ff":"#8892a4",cursor:"pointer",fontFamily:"Inter,sans-serif",boxShadow:isActive?"0 0 16px rgba(139,92,246,.25)":"none",transition:"all .15s",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}><span style={{fontSize:13,fontWeight:isActive?800:600,letterSpacing:"-.3px"}}>{u}u</span><span style={{fontSize:11,fontWeight:500,color:isActive?"#c4b5fd":"#5a6478"}}>{sStr}$</span></button>
                    );
                  })}
                </div>
                {form.odds&&form.stake&&(
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:9,borderTop:"1px solid rgba(255,255,255,0.04)"}}><span style={{fontSize:11,color:"#5a6478",fontWeight:500}}>Gain potentiel</span><span style={{fontSize:16,fontWeight:700,color:"#00E676"}}>+{(parseFloat(form.stake||0)*(parseFloat(form.odds||1)-1)).toFixed(2)}$</span></div>
                )}
              </div>
            )}

            {/* ── SESSION MAPS ── */}
            {sessionMode&&(
              <div style={{background:"#131525",borderRadius:12,border:"1px solid rgba(124,58,237,0.12)",padding:"8px 12px",marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><span style={{fontSize:12,color:"#9CA3AF",fontWeight:500}}>Maps · Mise défaut</span><div style={{display:"flex",gap:5}}>
                    {QUICK_STAKES.map(s=>(
                      <button key={s} onClick={()=>setForm(f=>({...f,stake:String(s)}))}
                        style={{padding:"3px 8px",borderRadius:8,border:"1px solid "+(parseFloat(form.stake)===s?"#7C3AED":"rgba(255,255,255,0.08)"),background:parseFloat(form.stake)===s?"rgba(124,58,237,0.12)":"transparent",color:parseFloat(form.stake)===s?"#A78BFA":"#6B7280",fontSize:10,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
                        {s}$
                      </button>
                    ))}
                  </div></div>
                {sessionMaps.map((m,i)=>(
                  <div key={i} style={{padding:"10px 12px",borderRadius:12,border:"1px solid "+(m.enabled?"rgba(124,58,237,0.2)":"rgba(255,255,255,0.04)"),background:m.enabled?"rgba(124,58,237,0.04)":"transparent",marginBottom:7,opacity:m.enabled?1:0.4}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:m.enabled?8:0}}><span style={{fontWeight:600,fontSize:13,color:m.enabled?"#A78BFA":"#4B5563"}}>Map {i+1}</span><div style={{display:"flex",gap:6,alignItems:"center"}}>
                        {m.enabled&&(
                          <button onClick={()=>setSessionMaps(ms=>ms.map((x,j)=>j===i?{...x,locked:!x.locked}:x))}
                            title={m.locked?"Déverrouiller":"Verrouiller cote"}
                            style={{background:m.locked?"rgba(245,158,11,0.15)":"transparent",border:"1px solid "+(m.locked?"rgba(245,158,11,0.4)":"rgba(255,255,255,0.08)"),borderRadius:7,padding:"3px 8px",color:m.locked?"#F59E0B":"#4B5563",cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif"}}>
                            {m.locked?"🔒":"🔓"}
                          </button>
                        )}
                        <button onClick={()=>setSessionMaps(ms=>ms.map((x,j)=>j===i?{...x,enabled:!x.enabled,locked:false}:x))}
                          style={{background:"none",border:"none",color:m.enabled?"#7C3AED":"#4B5563",fontSize:11,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:700}}>
                          {m.enabled?"ON":"OFF"}
                        </button></div></div>
                    {m.enabled&&(
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><NumPad value={m.odds} onChange={v=>setSessionMaps(ms=>ms.map((x,j)=>j===i?{...x,odds:v}:x))} placeholder="Cote" step="0.01"/><NumPad value={m.stake} onChange={v=>setSessionMaps(ms=>ms.map((x,j)=>j===i?{...x,stake:v}:x))} placeholder={form.stake||"Mise"} step="1"/></div>
                    )}
                  </div>
                ))}
                <button onClick={()=>setSessionMaps(ms=>[...ms,{...EMPTY_MAP_ROW}])} style={{width:"100%",background:"transparent",border:"1px dashed rgba(124,58,237,0.2)",borderRadius:10,padding:"9px",color:"#6B7280",cursor:"pointer",fontSize:12,fontFamily:"'Inter',sans-serif"}}>
                  + Ajouter map
                </button></div>
            )}



            

                        {/* ── 2b. ANNONCE - Joueurs out ── */}
            {form.autoInfo&&form.autoInfo.team&&(
              <AnnonceBlock
                team={form.autoInfo.team}
                playerName={form.player}
                allPlayers={allPlayers}
                outs={form.announceOuts||[]}
                onOutsChange={outs=>setForm(f=>({...f,announceOuts:outs}))}
              />
            )}




            {/* ── TIPSTER ── */}
            <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid "+(lockedTipster?"rgba(245,158,11,.25)":"rgba(139,92,246,.2)"),padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}><div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4",letterSpacing:.2}}>
                  <span style={{display:"flex",alignItems:"center",gap:6}}><TipsterIcon size={14} color="#ccd3e4"/> Tipster</span>
                </div><button onClick={()=>setLockedTipster(v=>!v)}
                  style={{padding:"3px 9px",background:lockedTipster?"rgba(245,158,11,0.1)":"rgba(255,255,255,0.03)",border:"1px solid "+(lockedTipster?"rgba(245,158,11,.3)":"rgba(255,255,255,0.06)"),borderRadius:7,color:lockedTipster?"#F59E0B":"#555e72",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                  {lockedTipster?"🔒 Locké":"🔓 Locker"}
                </button></div>
              {savedTipsters.length>0?(
                <div style={{position:"relative"}}>
                  <select
                    value={tipsterName}
                    onChange={e=>setTipsterName(e.target.value)}
                    style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,padding:"11px 36px 11px 12px",color:tipsterName?"#E5E7EB":"#6B7280",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}>
                    <option value="">Aucun tipster</option>
                    {savedTipsters.map(t=><option key={t} value={t}>{t}</option>)}
                  </select>
                  <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",color:"#6B7280",fontSize:11,pointerEvents:"none"}}>▾</span>
                </div>
              ):(
                <div style={{fontSize:11,color:"#6B7280",padding:"8px 0"}}>Crée des tipsers dans l'onglet Suivi pour les sélectionner ici.</div>
              )}
              {lockedTipster&&tipsterName&&<div style={{fontSize:10,color:"#F59E0B",marginTop:6,fontWeight:600}}>🔒 Tipster "{tipsterName}" verrouillé pour les prochains paris</div>}
            </div>

                        {/* ── 7. STATUT ── */}
            <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid "+(lockedStatus?"rgba(245,158,11,.25)":"rgba(139,92,246,.2)"),padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:9}}><div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4",letterSpacing:.2}}>
                  
                  État
                </div><button onClick={()=>setLockedStatus(lockedStatus?null:form.status)}
                  style={{padding:"3px 9px",background:lockedStatus?"rgba(245,158,11,0.1)":"rgba(255,255,255,0.03)",border:"1px solid "+(lockedStatus?"rgba(245,158,11,.3)":"rgba(255,255,255,0.06)"),borderRadius:7,color:lockedStatus?"#F59E0B":"#555e72",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                  {lockedStatus?"🔒 Locké":"🔓 Locker"}
                </button></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>
                {["pending","won","lost"].map(s=>(
                  <button key={s} onClick={()=>{setForm(f=>({...f,status:s}));if(lockedStatus)setLockedStatus(s);}}
                    style={{padding:"9px 0",borderRadius:10,border:"1.5px solid "+(form.status===s?STATUS_CFG[s].color+"66":"rgba(255,255,255,0.06)"),background:form.status===s?STATUS_CFG[s].bg:"rgba(255,255,255,0.02)",color:form.status===s?STATUS_CFG[s].color:"#5a6478",fontWeight:500,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                    {STATUS_CFG[s].label}{lockedStatus===s?" 🔒":""}
                  </button>
                ))}
              </div>
              {lockedStatus&&<div style={{fontSize:10,color:"#F59E0B",marginTop:6,fontWeight:600}}>🔒 "{STATUS_CFG[lockedStatus]&&STATUS_CFG[lockedStatus].label}" verrouillé</div>}
            </div>

            {/* ── CTA ── */}
            {(()=>{
              const missing=[];
              if(!form.bookmaker) missing.push("Bookmaker");
              if(!form.player) missing.push("Joueur");
              // Pari équipe confirmé : pas besoin de Over/Under ni description stat
              if(!form.tbConfirmed){
                if(!form.overUnder) missing.push("Over/Under");
                if(!form.description) missing.push("Stat/Ligne");
              }
              if(!form.odds) missing.push("Cote");
              if(!form.stake) missing.push("Mise");
              // map not required
              const canAdd=sessionMode?(!form.player||!sessionMaps.some(m=>m.enabled&&m.odds)):missing.length===0;
              const isDisabled=sessionMode?(!form.player||!sessionMaps.some(m=>m.enabled&&m.odds)):missing.length>0;
              const gain=form.odds&&form.stake?(parseFloat(form.stake||0)*(parseFloat(form.odds||1)-1)).toFixed(2):null;
              const ticketReady=!sessionMode&&form.player&&form.description&&form.odds&&form.stake;
              return(
                <>
                  {!sessionMode&&missing.length>0&&(
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10,padding:"8px 12px",background:"rgba(245,158,11,0.04)",border:"1px solid rgba(245,158,11,0.12)",borderRadius:12,alignItems:"center"}}><span style={{fontSize:10,color:"#6B7280",flexShrink:0}}>Manque :</span>
                      {missing.map(f=>(
                        <span key={f} style={{fontSize:10,fontWeight:700,color:"#F59E0B",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:6,padding:"2px 8px"}}>
                          {f}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* ── Mini ticket récap ── */}
                  {ticketReady&&(
                    <div style={{marginTop:14,marginBottom:8,borderRadius:14,overflow:"hidden",border:"1px solid rgba(96,165,250,.2)",background:"linear-gradient(135deg,rgba(14,20,38,.98),rgba(8,14,26,.99))"}}>
                      {/* Bande top bleue */}
                      <div style={{height:2,background:"linear-gradient(90deg,#3b82f6,#7c3aed)"}}/><div style={{padding:"11px 14px",display:"flex",alignItems:"center",gap:12}}>
                        {/* Photo miniature + logo équipe */}
                        {(()=>{
                          const src=form.autoInfo?getAvatarSrc(form.autoInfo):null;
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
                          <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:18,fontWeight:800,color:"#f0f4ff",letterSpacing:-.4,lineHeight:1}}>{(form.player||"").split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}</span>
                            {(form.autoInfo&&form.autoInfo.team_logo_url)&&(
                              <img src={form.autoInfo.team_logo_url} alt="" onError={e=>e.target.style.display="none"} style={{width:14,height:14,objectFit:"contain",opacity:.7,flexShrink:0}}/>
                            )}
                          </div>
                          {/* Ligne 2 : sélection + PP edge */}
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}><span style={{fontSize:12,fontWeight:500,color:"#7a9cc4",lineHeight:1.3}}>{form.overUnder&&form.description?form.overUnder+" "+form.description.replace(/^(Over|Under)\s/,""):form.description}</span>
                            {(()=>{
                              const bk=parseFloat(form.description);
                              const ppLine=form.ppDescription||(()=>{
                                if(!bk||isNaN(bk)||!form.overUnder||!form.ppMapType)return null;
                                const edge=form.overUnder==="Over"?2.0:2.5;
                                if(form.ppMapType==="H1+H2") return(Math.round((bk*2-edge)*2)/2).toFixed(1)+(form.isHeadshot?" 3 Pts":" Points");
                                if(form.ppMapType==="Match") return(Math.round((bk-1.5)*2)/2).toFixed(1)+(form.isHeadshot?" 3 Pts":" Points");
                                return null;
                              })();
                              if(!ppLine||isNaN(bk)||!form.ppMapType)return null;
                              const pp=parseFloat(ppLine);
                              const ppPerMapT=form.ppMapType==="H1+H2"?pp/2:form.ppMapType==="H1+H2+OT"?pp/3:pp;
                              const edge=(form.overUnder==="Over"?ppPerMapT-bk:bk-ppPerMapT).toFixed(2);
                              return(
                                <span style={{fontSize:12,fontWeight:700,color:"#c4b5fd"}}>PP {edge>0?"+":""}{edge}</span>
                              );
                            })()}
                          </div>
                          {/* Ligne 3 : cote · mise · bookmaker · gain potentiel */}
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:3,borderTop:"1px solid rgba(255,255,255,.04)"}}><div style={{display:"flex",alignItems:"center",gap:10}}><div style={{display:"flex",flexDirection:"column",gap:2}}><span style={{fontSize:8,color:"#3d4d62",fontWeight:600,letterSpacing:.5}}>COTE</span><span style={{fontSize:14,fontWeight:700,color:"#e4eaf6"}}>@{form.odds}</span></div><span style={{width:1,height:26,background:"rgba(255,255,255,.06)",flexShrink:0}}/><div style={{display:"flex",flexDirection:"column",gap:2}}><span style={{fontSize:8,color:"#3d4d62",fontWeight:600,letterSpacing:.5}}>MISE</span><span style={{fontSize:14,fontWeight:700,color:"#e4eaf6"}}>{form.stake}$</span></div>
                              {form.bookmaker&&BK_LOGOS[form.bookmaker]&&(
                                <><span style={{width:1,height:26,background:"rgba(255,255,255,.06)",flexShrink:0}}/><img src={BK_LOGOS[form.bookmaker]} alt={form.bookmaker} style={{width:22,height:22,objectFit:"contain",borderRadius:5,opacity:.9}}/></>
                              )}
                              {form.bookmaker&&!BK_LOGOS[form.bookmaker]&&(
                                <><span style={{width:1,height:26,background:"rgba(255,255,255,.06)",flexShrink:0}}/><span style={{fontSize:10,color:"#5a6478",fontWeight:600}}>{form.bookmaker}</span></>
                              )}
                            </div>
                            {gain&&(
                              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}><span style={{fontSize:8,color:"#3d4d62",fontWeight:600,letterSpacing:.5}}>GAIN POTENTIEL</span><span style={{fontSize:17,fontWeight:800,color:"#22e875",textShadow:"0 0 12px rgba(34,232,117,.3)"}}>+{gain}$</span></div>
                            )}
                          </div></div></div></div>
                  )}

                  {/* PP edge alert */}
                  {(()=>{
                    const ppEdge=form.ppEdge;
                    if(ppEdge==null||ppEdge>=0||form.ppMapType==="HIDE")return null;
                    return(
                      <div style={{marginBottom:8,padding:"8px 12px",borderRadius:10,background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.3)",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>Edge PP négatif ({ppEdge>0?"+":""}{ppEdge.toFixed(2)}) - EV-</span></div>
                    );
                  })()}

                  {(function(){
                    var ppEdge=form.ppEdge;
                    if(ppEdge==null||ppEdge>=0||form.ppMapType==="HIDE")return null;
                    return(<div style={{marginBottom:8,padding:"8px 12px",borderRadius:10,background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.3)",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>Edge PP négatif ({ppEdge>0?"+":""}{ppEdge.toFixed(2)}) - EV-</span></div>);
                  })()}
                  {(function(){
                    var odds=parseFloat(form.odds)||0;
                    var k=(form.player||"").toLowerCase().trim();
                    var playerBets=(allBetsByPlayer&&allBetsByPlayer[k])||[];
                    if(playerBets.length>=5&&odds>1){
                      var wr=playerBets.filter(function(b){return b.status==="won";}).length/playerBets.length;
                      var ev=wr*odds-1;
                      if(ev<0)return(<div style={{marginBottom:8,padding:"8px 12px",borderRadius:10,background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.3)",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>EV négatif {(ev*100).toFixed(1)}% sur {k}</span></div>);
                    }
                    return null;
                  })()}
                  {/* ── Bouton Combiner inline ── */}
                  {!combineMode&&!editingBet&&(
                    <button onClick={()=>{setCombineMode(true);setTeamBetMode(false);}}
                      style={{width:"100%",height:44,border:"1.5px dashed rgba(52,211,153,.3)",borderRadius:13,background:"rgba(52,211,153,.04)",color:"#34d399",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",marginBottom:6,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                      <span style={{fontSize:16}}>+</span> Ajouter une sélection (combiné)
                    </button>
                  )}
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
                    {isDisabled?"Complète le formulaire ↑":sessionMode?"Enregistrer session ("+sessionMaps.filter(m=>m.enabled&&m.odds).length+" maps)":editingBet?"✓ Sauvegarder":"⊕ Ajouter le pari"}
                  </button>
                  {editingBet&&(
                    <button onClick={()=>{setEditingBet(null);setForm({...EMPTY_FORM(),datetime:nowDT(),bookmaker:stickyBK?form.bookmaker:"",});}}
                      style={{width:"100%",padding:"12px",background:"transparent",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,color:"#6B7280",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif",marginBottom:8}}>
                      × Annuler modification
                    </button>
                  )}
                </>
              );
            })()}


            </>}


            </div>{/* end padding wrapper */}
          </div>
        )}


        {/* ── STATS ── */}
        {!viewPending&&view==="statistiques"&&(
          <div className="view-enter" style={{display:statsDrill?"none":"block"}}><div style={{fontSize:16,fontWeight:800,textTransform:"uppercase",letterSpacing:1.5,color:"#dce8ff",marginBottom:14}}>Statistiques</div>

            {/* ── TAB BAR STATS — scrollable ── */}
            <div style={{position:"relative",marginBottom:16}}>
              <div style={{display:"flex",gap:0,overflowX:"auto",WebkitOverflowScrolling:"touch",scrollbarWidth:"none",msOverflowStyle:"none",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
                {[{k:"apercu",l:"Aperçu"},{k:"jeux",l:"Ligues"},{k:"tournois",l:"Positions"},{k:"annonces",l:"Annonces"},{k:"victoire",l:"Victoire"},{k:"combine",l:"Combiné"},{k:"tipsers",l:"Tipsers"},{k:"plus",l:"Plus"}].map(t=>{
                  const on=statsTab===t.k;
                  return(
                    <button key={t.k} onClick={()=>setStatsTab(t.k)}
                      style={{background:"none",border:"none",padding:"0 14px 10px",color:on?"#A78BFA":"#6B7280",fontSize:12,fontWeight:800,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap",borderBottom:"2px solid "+(on?"#A78BFA":"transparent"),transition:"all .15s",flexShrink:0}}>
                      {t.l}
                    </button>
                  );
                })}
              </div>
              {/* Fade droit pour indiquer scroll */}
              <div style={{position:"absolute",right:0,top:0,bottom:0,width:32,background:"linear-gradient(to right,transparent,rgba(8,12,24,.9))",pointerEvents:"none"}}/>
            </div>

            {/* ── TESTING PANEL ── */}
            {statsTab==="tipsers"&&(()=>{
              const isTeamB=b=>checkIsTeamBet(b);
              const tipsterMap={};
              settled.forEach(b=>{
                const t=b.tipster;if(!t)return;
                if(!tipsterMap[t])tipsterMap[t]={name:t,bets:[],byGame:{},byType:{victoire:[],joueur:[],handicap:[],longterme:[]},ou:{Over:[],Under:[]}};
                const tm=tipsterMap[t];
                tm.bets.push(b);
                // Par ligue
                const g=b.game||"Autre";
                if(!tm.byGame[g])tm.byGame[g]=[];
                tm.byGame[g].push(b);
                // Over/Under
                if(b.overUnder==="Over")tm.ou.Over.push(b);
                else if(b.overUnder==="Under")tm.ou.Under.push(b);
                // Type
                if(isTeamB(b)){
                  if(b.description&&(b.description.startsWith("Vainqueur ")))tm.byType.longterme.push(b);
                  else if(b.description&&/[+-]\d/.test(b.description)&&!b.description.startsWith("Victoire "))tm.byType.handicap.push(b);
                  else tm.byType.victoire.push(b);
                } else {
                  tm.byType.joueur.push(b);
                }
              });
              savedTipsters.forEach(t=>{if(!tipsterMap[t])tipsterMap[t]={name:t,bets:[],byGame:{},byType:{victoire:[],joueur:[],handicap:[],longterme:[]},ou:{Over:[],Under:[]}};});
              const tipsters=Object.values(tipsterMap).sort((a,b2)=>{
                const pa=a.bets.reduce((s,b)=>s+(b.profit||0),0);
                const pb2=b2.bets.reduce((s,b)=>s+(b.profit||0),0);
                return pb2-pa;
              });

              const calcS=bets=>{
                if(!bets.length)return null;
                const c=bets.length,w=bets.filter(b=>b.status==="won").length;
                const p=bets.reduce((s,b)=>s+(b.profit||0),0);
                const st=bets.reduce((s,b)=>s+(b.stake||0),0);
                const ao=bets.reduce((s,b)=>s+(b.odds||0),0)/c;
                return{count:c,won:w,profit:p,staked:st,wr:c>0?w/c*100:0,roi:st>0?p/st*100:0,avgOdds:ao};
              };
              const SubRow=({label,s,color="#E5E7EB"})=>{
                if(!s)return null;
                return(
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 14px",borderTop:"1px solid rgba(255,255,255,.04)"}}>
                    <div><div style={{fontSize:12,fontWeight:700,color}}>{label}</div><div style={{fontSize:10,color:"#6B7280"}}>{s.count} paris · {s.wr.toFixed(0)}% WR · @{s.avgOdds.toFixed(2)}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontWeight:700,fontSize:12,color:s.profit>=0?"#22C55E":"#EF4444"}}>{s.profit>=0?"+":""}{s.profit.toFixed(0)}$</div><div style={{fontSize:10,color:s.roi>=0?"#22C55E":"#EF4444"}}>{s.roi>=0?"+":""}{s.roi.toFixed(1)}%</div></div>
                  </div>
                );
              };

              if(tipsters.length===0)return(
                <div style={{textAlign:"center",padding:"40px 20px",color:"#4a5a6e"}}>
                  <div style={{fontSize:28,marginBottom:10}}>📊</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#6B7280"}}>Aucun tipster pour l'instant</div>
                </div>
              );
              return(
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {tipsters.map(tip=>{
                    const s=calcS(tip.bets);
                    if(!s)return null;
                    const isOpen=!!statsGameOpen["TIP_"+tip.name];
                    const roiAbs=Math.min(Math.abs(s.roi),50);
                    // Meilleure ligue
                    const bestLeague=Object.entries(tip.byGame).map(([g,bs])=>({g,s:calcS(bs)})).filter(x=>x.s).sort((a,b2)=>b2.s.profit-a.s.profit)[0];
                    // Meilleur type
                    const typeList=[
                      {k:"joueur",l:"Joueur",s:calcS(tip.byType.joueur),c:"#a78bfa"},
                      {k:"victoire",l:"Victoire équipe",s:calcS(tip.byType.victoire),c:"#22C55E"},
                      {k:"handicap",l:"Handicap",s:calcS(tip.byType.handicap),c:"#fbbf24"},
                      {k:"longterme",l:"Long terme",s:calcS(tip.byType.longterme),c:"#34d399"},
                    ].filter(x=>x.s);
                    const bestType=typeList.length?[...typeList].sort((a,b2)=>b2.s.profit-a.s.profit)[0]:null;
                    return(
                      <div key={tip.name} style={{background:"#111827",border:"1px solid "+(isOpen?"rgba(167,139,250,.4)":"#1F2937"),borderRadius:isOpen?"14px 14px 0 0":"14px",overflow:"hidden"}}>
                        <button onClick={()=>setStatsGameOpen(prev=>({...prev,["TIP_"+tip.name]:!prev["TIP_"+tip.name]}))}
                          style={{width:"100%",display:"flex",flexDirection:"column",padding:"12px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
                          {/* Ligne 1 */}
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <div style={{width:34,height:34,borderRadius:10,background:"rgba(167,139,250,.08)",border:"1px solid rgba(167,139,250,.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><TipsterIcon size={17} color="#a78bfa"/></div>
                              <div>
                                <div style={{fontWeight:800,fontSize:14,color:"#a78bfa"}}>{tip.name}</div>
                                <div style={{fontSize:10,color:"#6B7280"}}>{s.count} paris</div>
                              </div>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{padding:"2px 8px",borderRadius:6,background:s.profit>=0?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",fontSize:11,fontWeight:700,color:s.profit>=0?"#22C55E":"#EF4444"}}>{s.profit>=0?"+":""}{s.profit.toFixed(0)}$</span>
                              <span style={{fontSize:11,color:"#6B7280",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
                            </div>
                          </div>
                          {/* Stats */}
                          <div style={{display:"flex",gap:10,marginBottom:6}}>
                            <span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>{s.wr.toFixed(0)}% WR</span>
                            <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                            <span style={{fontSize:11,fontWeight:700,color:s.roi>=0?"#22C55E":"#EF4444"}}>{s.roi>=0?"+":""}{s.roi.toFixed(1)}% ROI</span>
                            <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                            <span style={{fontSize:11,color:"#9CA3AF"}}>@{s.avgOdds.toFixed(2)}</span>
                            {bestLeague&&<><span style={{fontSize:11,color:"#6B7280"}}>·</span><span style={{fontSize:10,color:"#fbbf24",fontWeight:600}}>🏆 {bestLeague.g}</span></>}
                            {bestType&&<><span style={{fontSize:11,color:"#6B7280"}}>·</span><span style={{fontSize:10,color:bestType.c,fontWeight:600}}>✓ {bestType.l}</span></>}
                          </div>
                          {/* Barre */}
                          <div style={{display:"flex",gap:4}}>
                            <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:s.wr+"%",background:s.wr>55?"#22C55E":s.wr<45?"#EF4444":"#9CA3AF",borderRadius:2}}/></div>
                            <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden",position:"relative"}}><div style={{position:"absolute",top:0,left:s.roi>=0?"50%":"calc(50% - "+(roiAbs/2)+"%)",height:"100%",width:roiAbs+"%",background:s.roi>=0?"linear-gradient(90deg,#3B82F6,#06B6D4)":"#EF4444",borderRadius:2}}/></div>
                          </div>
                        </button>
                        {isOpen&&(
                          <div style={{background:"#111827",border:"1px solid #1F2937",borderTop:"none",borderRadius:"0 0 14px 14px",overflow:"hidden"}}>
                            {/* Over / Under */}
                            {(tip.ou.Over.length>0||tip.ou.Under.length>0)&&(
                              <><div style={{fontSize:10,color:"#60A5FA",fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",padding:"10px 14px 4px"}}>Over / Under</div>
                                <SubRow label="🔼 Over" s={calcS(tip.ou.Over)} color="#60a5fa"/>
                                <SubRow label="🔽 Under" s={calcS(tip.ou.Under)} color="#60a5fa"/>
                              </>
                            )}
                            {/* Joueur vs Équipe */}
                            {(tip.byType.joueur.length>0||tip.byType.victoire.length>0||tip.byType.handicap.length>0)&&(
                              <><div style={{fontSize:10,color:"#a78bfa",fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",padding:"10px 14px 4px",borderTop:"1px solid rgba(255,255,255,.04)"}}>Type de pari</div>
                                <SubRow label="Joueur" s={calcS(tip.byType.joueur)} color="#a78bfa"/>
                                <SubRow label="Victoire équipe" s={calcS(tip.byType.victoire)} color="#22C55E"/>
                                <SubRow label="Handicap" s={calcS(tip.byType.handicap)} color="#fbbf24"/>
                                <SubRow label="Long terme" s={calcS(tip.byType.longterme)} color="#34d399"/>
                              </>
                            )}
                            {/* Par ligue */}
                            {Object.keys(tip.byGame).length>0&&(
                              <><div style={{fontSize:10,color:"#fbbf24",fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",padding:"10px 14px 4px",borderTop:"1px solid rgba(255,255,255,.04)"}}>Par ligue</div>
                                {Object.entries(tip.byGame).sort((a,b2)=>b2[1].reduce((s,b)=>s+(b.profit||0),0)-a[1].reduce((s,b)=>s+(b.profit||0),0)).map(([g,gb])=>(
                                  <div key={g} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 14px",borderTop:"1px solid rgba(255,255,255,.03)"}}>
                                    <div style={{display:"flex",alignItems:"center",gap:7}}><GameLogo game={g} size={14}/><div><div style={{fontSize:12,fontWeight:600,color:"#E5E7EB"}}>{g}</div><div style={{fontSize:10,color:"#6B7280"}}>{gb.length} paris · {gb.length>0?(gb.filter(b=>b.status==="won").length/gb.length*100).toFixed(0):0}% WR</div></div></div>
                                    <span style={{fontWeight:700,fontSize:12,color:gb.reduce((s,b)=>s+(b.profit||0),0)>=0?"#22C55E":"#EF4444"}}>{gb.reduce((s,b)=>s+(b.profit||0),0)>=0?"+":""}{gb.reduce((s,b)=>s+(b.profit||0),0).toFixed(0)}$</span>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

                        {statsTab==="plus"&&testingOpen&&(()=>{
              const allTourneys=[...new Set(settled.map(b=>b.tournament||"Hors tournoi"))].sort();
              const allLeagues=[...new Set(settled.map(b=>b.league).filter(Boolean))].sort();
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
                <div style={{marginBottom:12}}><div style={{fontSize:9,color:"#8a7a5e",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>{label}</div>
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
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,paddingBottom:10,borderBottom:"1px solid rgba(251,191,36,.1)"}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>🧪</span><div><div style={{fontSize:13,color:"#fbbf24",fontWeight:800}}>MODE TEST</div><div style={{fontSize:10,color:"#6a5a3e"}}>Configure puis applique</div></div></div>
                    {appliedCount>0&&(
                      <div style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:7,height:7,borderRadius:"50%",background:"#22C55E",boxShadow:"0 0 6px #22C55E"}}/><span style={{fontSize:10,color:"#22C55E",fontWeight:700}}>{appliedCount} filtre{appliedCount>1?"s":""} actif{appliedCount>1?"s":""}</span></div>
                    )}
                  </div>

                  {/* JEUX */}
                  <Sec label="Jeux inclus"><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Bundesliga","Lega","HEBA"].map(g=>{
                        const on=f.games.has(g);
                        return(
                          <button key={g} onClick={()=>{const ng=new Set(f.games);on?ng.delete(g):ng.add(g);set("games",ng);}}
                            style={{...chip(on),display:"flex",alignItems:"center",gap:4}}><GameLogo game={g} size={11}/>{on?" ✓ ":""} {g}
                          </button>
                        );
                      })}
                    </div></Sec>

                  {/* DIRECTION */}
                  <Sec label="Direction"><div style={{display:"flex",gap:5}}>
                      {[["all","Tous"],["over","▲ Over"],["under","▼ Under"]].map(([v,l])=>(
                        <button key={v} onClick={()=>set("overUnder",v)} style={chip(f.overUnder===v)}>{l}</button>
                      ))}
                    </div></Sec>



                  {/* COTES */}
                  <Sec label="Cote (min → max)"><div style={{display:"flex",gap:6,alignItems:"center"}}><input type="number" inputMode="decimal" step="0.01" placeholder="Min 1.5" value={f.oddsMin} onChange={e=>set("oddsMin",e.target.value)} style={{...inp,flex:1}}/><span style={{color:"#4a5a6e",flexShrink:0}}>→</span><input type="number" inputMode="decimal" step="0.01" placeholder="Max 2.0" value={f.oddsMax} onChange={e=>set("oddsMax",e.target.value)} style={{...inp,flex:1}}/></div></Sec>



                  {/* POSITIONS */}
                  <Sec label={`Masquer positions${f.hideRoles.size>0?` · ${f.hideRoles.size} 🚫`:""}`}><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      {["PG","SG","SF","PF","C"].map(r=>{
                        const labels={"PG":"Point Guard","SG":"Shooting Guard","SF":"Small Forward","PF":"Power Forward","C":"Center"};
                        const on=f.hideRoles.has(r);
                        return <button key={r} onClick={()=>toggleSet("hideRoles",r)} style={redChip(on)}>{on?"🚫 ":""}{labels[r]||r}</button>;
                      })}
                    </div></Sec>

                  {/* LIGUES */}
                  {allLeagues.length>0&&(
                    <Sec label={`Masquer ligues${f.hideLeagues.size>0?` · ${f.hideLeagues.size} 🚫`:""}`}><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                        {allLeagues.map(l=>{
                          const on=f.hideLeagues.has(l);
                          return <button key={l} onClick={()=>toggleSet("hideLeagues",l)} style={redChip(on)}>{on?"🚫 ":""}{l}</button>;
                        })}
                      </div></Sec>
                  )}



                  {/* BOUTONS APPLY + RESET */}
                  <div style={{display:"flex",gap:8,marginTop:8}}><button onClick={()=>{setTestFilter({...testFilterDraft,games:new Set(testFilterDraft.games),hideTourneys:new Set(testFilterDraft.hideTourneys),hideLeagues:new Set(testFilterDraft.hideLeagues),hideRoles:new Set(testFilterDraft.hideRoles)});}}
                      style={{flex:1,padding:"11px",borderRadius:10,border:"none",background:isDirty?"linear-gradient(135deg,#d4a017,#f5c842)":"rgba(251,191,36,.15)",color:isDirty?"#1a1000":"#6a5a3e",fontSize:13,fontWeight:800,cursor:"pointer",fontFamily:"Inter,sans-serif",letterSpacing:.3,boxShadow:isDirty?"0 2px 12px rgba(212,160,23,.4)":"none",transition:"all .2s"}}>
                      {isDirty?" Appliquer le test":"✓ Déjà appliqué"}
                    </button><button onClick={()=>{setTestFilterDraft(DEFAULT_TEST_FILTER);setTestFilter(DEFAULT_TEST_FILTER);}}
                      style={{padding:"11px 14px",borderRadius:10,border:"1px solid rgba(251,191,36,.15)",background:"transparent",color:"#6a5a3e",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                      ↺ Reset
                    </button></div>

                  {isDirty&&<div style={{marginTop:8,fontSize:10,color:"#f59e0b",textAlign:"center",opacity:.7}}>Changements non appliqués - clique sur  Appliquer</div>}
                </div>
              );
            })()}

            {statsTab==="plus"&&(
              <div style={{marginBottom:16,display:"flex",flexDirection:"column",gap:8}}>

                <button onClick={()=>setTestingOpen(v=>!v)}
                  style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:testingOpen?"rgba(251,191,36,.1)":"#111827",border:"1px solid "+(testingOpen?"rgba(251,191,36,.4)":"#1F2937"),borderRadius:12,padding:"12px 14px",color:testingOpen?"#fbbf24":"#dce8ff",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:700}}>
                  🧪 Mode Test
                  <span style={{fontSize:11,opacity:.6}}>{testingOpen?"▲":"▼"}</span></button><button onClick={exportCSV} style={{display:"flex",alignItems:"center",gap:8,background:"#111827",border:"1px solid #1F2937",borderRadius:12,padding:"12px 14px",color:"#dce8ff",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:700,textAlign:"left"}}> Exporter en CSV</button><button onClick={exportJSON} style={{display:"flex",alignItems:"center",gap:8,background:"#111827",border:"1px solid #1F2937",borderRadius:12,padding:"12px 14px",color:"#dce8ff",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:700,textAlign:"left"}}>💾 Exporter en JSON</button><label style={{display:"flex",alignItems:"center",gap:8,background:"#111827",border:"1px solid #1F2937",borderRadius:12,padding:"12px 14px",color:"#dce8ff",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13,fontWeight:700}}>
                  📂 Importer un JSON
                  <input type="file" accept=".json" style={{display:"none"}} onChange={e=>{if(e.target.files[0])importJSON(e.target.files[0]);e.target.value="";}}/></label></div>
            )}

            {statsTab==="apercu"&&<>
            {settled.length>0&&(()=>{
              const totalStaked=settledFiltered.reduce((s,b)=>s+(b.stake||0),0);
              const globalROI=totalStaked>0?(totalProfit/totalStaked*100):0;
              const globalWR=settledFiltered.length>0?(settledFiltered.filter(b=>b.status==="won").length/settledFiltered.length*100):0;
              return(
              <div style={{marginBottom:14}}>
                {/* Ligne 1 - Profit + ROI */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><div style={{background:"linear-gradient(135deg,rgba(34,197,94,.08),rgba(16,185,129,.04))",border:"1px solid rgba(34,197,94,.15)",borderRadius:14,padding:"14px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#00E676,#16a34a)"}}/><div style={{fontSize:8,color:"#4a6a50",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,fontWeight:700}}>Profit net</div><div style={{fontSize:24,fontWeight:800,color:totalProfit>=0?"#22C55E":"#EF4444",letterSpacing:-.5,lineHeight:1}}>{totalProfit>=0?"+":""}{totalProfit.toFixed(0)}$</div><div style={{fontSize:10,color:"#4a6a50",marginTop:4,fontWeight:500}}>{settledFiltered.length} paris résolus</div></div><div style={{background:"linear-gradient(135deg,rgba(59,130,246,.08),rgba(99,102,241,.04))",border:"1px solid rgba(59,130,246,.15)",borderRadius:14,padding:"14px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#3b82f6,#6366f1)"}}/><div style={{fontSize:8,color:"#3a5270",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,fontWeight:700}}>ROI global</div><div style={{fontSize:24,fontWeight:800,color:globalROI>=0?"#60a5fa":"#EF4444",letterSpacing:-.5,lineHeight:1}}>{globalROI>=0?"+":""}{globalROI.toFixed(1)}%</div><div style={{fontSize:10,color:"#3a5270",marginTop:4,fontWeight:500}}>{totalStaked.toFixed(0)}$ misés</div></div></div>
                {/* Ligne 2 - WR + Série/Meilleur mois */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"12px 14px"}}><div style={{fontSize:8,color:"#5a6880",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,fontWeight:700}}>Win Rate</div><div style={{fontSize:24,fontWeight:800,color:globalWR>=55?"#22C55E":globalWR<45?"#EF4444":"#9CA3AF",letterSpacing:-.5,lineHeight:1}}>{globalWR.toFixed(1)}%</div><div style={{fontSize:10,color:"#4a5a6e",marginTop:4,fontWeight:500}}>{settledFiltered.filter(b=>b.status==="won").length}W · {settledFiltered.filter(b=>b.status==="lost").length}L</div></div><div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"12px 14px"}}><div style={{fontSize:8,color:"#5a6880",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,fontWeight:700}}>{currentStreak>1?"Série en cours":"Meilleur mois"}</div>
                    {currentStreak>1
                      ? <><div style={{fontSize:24,fontWeight:800,color:streakType==="won"?"#22C55E":"#EF4444",letterSpacing:-.5,lineHeight:1}}>{currentStreak}</div><div style={{fontSize:10,color:"#4a5a6e",marginTop:4,fontWeight:500}}>{streakType==="won"?"victoires":"défaites"} consécutives</div></>
                      : bestMonth
                        ? <><div style={{fontSize:20,fontWeight:800,color:"#22C55E",letterSpacing:-.3,lineHeight:1}}>+{bestMonth[1].toFixed(0)}$</div><div style={{fontSize:10,color:"#4a6a50",marginTop:4,fontWeight:500}}>{bestMonth[0]}</div></>
                        : <div style={{fontSize:20,fontWeight:800,color:"#3a4a5e"}}>-</div>
                    }
                  </div></div></div>
              );
            })()}




            {/* ── GRAPHIQUES BANKROLL ── */}
            {settled.length>=2&&(
              <div style={{marginBottom:16}}><div style={{background:"linear-gradient(180deg,rgba(10,18,34,.98),rgba(6,12,24,.99))",border:"1px solid rgba(99,130,200,.15)",borderRadius:16,padding:"14px 16px",boxShadow:"0 8px 32px rgba(0,0,0,.3)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}><div><div style={{fontSize:9,color:"#4a5a6e",textTransform:"uppercase",letterSpacing:1.2,fontWeight:700,marginBottom:2}}>Bankroll cumulative</div><div style={{fontSize:22,fontWeight:800,color:totalProfit>=0?"#22C55E":"#EF4444",letterSpacing:-.5}}>{totalProfit>=0?"+":""}{totalProfit.toFixed(0)}$</div></div><div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8}}><div style={{textAlign:"right"}}><div style={{fontSize:9,color:"#4a5a6e",textTransform:"uppercase",letterSpacing:1,fontWeight:700,marginBottom:2}}>Paris</div><div style={{fontSize:14,fontWeight:700,color:"#7a9cc4"}}>{settledFiltered.length}</div></div>
                      {/* Chart mode toggle */}
                      <div style={{display:"flex",gap:4,background:"rgba(0,0,0,.3)",borderRadius:8,padding:3}}>
                        {[{k:"line",l:""},{k:"candle",l:"🕯"} ].map(({k,l})=>(
                          <button key={k} onClick={()=>setStatsChartMode(k)}
                            style={{padding:"4px 10px",borderRadius:6,border:"none",background:statsChartMode===k?"rgba(96,165,250,.2)":"transparent",color:statsChartMode===k?"#60a5fa":"#4a5a6e",fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:statsChartMode===k?700:400}}>
                            {l}
                          </button>
                        ))}
                      </div></div></div>
                  {statsChartMode==="line"?(
                    <BankrollChart points={chartPoints} h={155}/>
                  ):(
                    <div><div style={{display:"flex",gap:4,marginBottom:8}}>
                        {[{k:"day",l:"1J"},{k:"week",l:"1S"},{k:"month",l:"1M"}].map(({k,l})=>(
                          <button key={k} onClick={()=>setCandleTF(k)}
                            style={{padding:"3px 9px",borderRadius:6,border:"1px solid "+(candleTF===k?"rgba(167,139,250,.4)":"rgba(255,255,255,.07)"),background:candleTF===k?"rgba(124,58,237,.15)":"transparent",color:candleTF===k?"#c4b5fd":"#4a5a6e",fontSize:10,fontWeight:candleTF===k?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                            {l}
                          </button>
                        ))}
                        <span style={{fontSize:9,color:"#3a4a5e",alignSelf:"center",marginLeft:4}}>Vert = haussier · Rouge = baissier</span></div><CandleChart points={chartPoints} h={155} tf={candleTF}/></div>
                  )}
                </div></div>
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


            {/* ── COMPARATEUR GLOBAL OVER/UNDER ── */}
            {(globalOverUnderStats.overS||globalOverUnderStats.underS)&&(
              <div style={{background:"linear-gradient(135deg,rgba(10,16,30,.98),rgba(8,14,24,.99))",border:"1px solid rgba(99,130,200,.12)",borderRadius:16,padding:"12px 14px",marginBottom:16}}><div style={{fontSize:10,color:"#4a5a6e",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>Over / Under - Tous jeux</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {[{key:"over",label:"▲ Over",s:globalOverUnderStats.overS,color:"#22C55E",bg:"rgba(34,197,94,0.05)",border:"rgba(34,197,94,0.12)",activeBorder:"rgba(34,197,94,0.45)"},{key:"under",label:"▼ Under",s:globalOverUnderStats.underS,color:"#60a5fa",bg:"rgba(59,130,246,0.05)",border:"rgba(59,130,246,0.12)",activeBorder:"rgba(96,165,250,0.45)"}].map(({key,label,s,color,bg,border,activeBorder})=>{
                    if(!s)return null;
                    const active=ouDrill===key;
                    return(
                      <div key={key} onClick={()=>setOuDrill(active?null:key)}
                        style={{background:active?bg:"rgba(255,255,255,.02)",borderRadius:11,padding:"9px 11px",border:"1px solid "+(active?activeBorder:border),cursor:"pointer",transition:"all .15s",position:"relative"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:11,fontWeight:800,color,letterSpacing:.3}}>{label}</span><span style={{fontSize:9,color:active?color:"#4a5a6e",opacity:.8}}>{active?"▲ Fermer":"▼ Détail"}</span></div><div style={{display:"flex",flexDirection:"column",gap:3}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,color:"#5a6a7e"}}>Paris</span><span style={{fontSize:10,fontWeight:700,color:"#c8d4e8"}}>{s.count}</span></div><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:10,color:"#5a6a7e"}}>Win Rate</span><span style={{fontSize:10,fontWeight:700,color:s.wr>=55?"#22C55E":s.wr<45?"#EF4444":"#9CA3AF"}}>{s.wr.toFixed(1)}%</span></div><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:"#9CA3AF"}}>ROI</span><span style={{fontSize:11,fontWeight:700,color:s.roi>=0?"#22C55E":"#EF4444"}}>{s.roi>=0?"+":""}{s.roi.toFixed(1)}%</span></div><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,color:"#9CA3AF"}}>Profit</span><FmtProfit v={s.profit} fontSize={13}/></div></div><div style={{marginTop:8,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:s.wr+"%",background:s.wr>=55?"linear-gradient(90deg,#22C55E,#22C55E)":s.wr<45?"linear-gradient(90deg,#EF4444,#EF4444)":"linear-gradient(90deg,#9CA3AF,#6B7280)",borderRadius:2,transition:"width .5s ease"}}/></div></div>
                    );
                  })}
                </div>

                {/* ── DRILL-DOWN PAR JEU ── */}
                {ouDrill&&(()=>{
                  const byGame=ouDrill==="over"?globalOverUnderStats.overByGame:globalOverUnderStats.underByGame;
                  if(!byGame||byGame.length===0)return null;
                  const color=ouDrill==="over"?"#22C55E":"#60a5fa";
                  const maxAbs=Math.max(...byGame.map(g=>Math.abs(g.profit)));
                  return(
                    <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid rgba(255,255,255,.06)"}}><div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,letterSpacing:1.2,textTransform:"uppercase",marginBottom:8}}>
                        Résultats par jeu - {ouDrill==="over"?"Over":"Under"}
                      </div><div style={{display:"flex",flexDirection:"column",gap:6}}>
                        {byGame.map(g=>{
                          const barW=maxAbs>0?Math.abs(g.profit)/maxAbs*100:0;
                          const pos=g.profit>=0;
                          return(
                            <div key={g.game} style={{background:"rgba(255,255,255,.02)",borderRadius:10,padding:"8px 10px",border:"1px solid rgba(255,255,255,.04)"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:5}}><div style={{display:"flex",alignItems:"center",gap:6}}><GameLogo game={g.game} size={14}/><span style={{fontSize:12,fontWeight:700,color:"#E5E7EB"}}>{g.game}</span><span style={{fontSize:10,color:"#4a5a6e"}}>{g.count}p · {g.wr.toFixed(0)}% WR</span></div><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:10,fontWeight:700,color:pos?"#22C55E":"#EF4444"}}>{pos?"+":""}{g.roi.toFixed(1)}% ROI</span><FmtProfit v={g.profit} fontSize={12}/></div></div>
                              {/* Barre de profit */}
                              <div style={{height:3,background:"rgba(255,255,255,.05)",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:barW+"%",background:pos?"#22C55E":"#EF4444",borderRadius:2,opacity:.7}}/></div></div>
                          );
                        })}
                      </div></div>
                  );
                })()}
              </div>
            )}






            {/* ──  PP ANALYTICS HUB ── */}
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

              const GAMES=["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Bundesliga","Lega","HEBA"].filter(g=>ppBets.some(b=>b.game===g));
              const MAP_TYPES=["H1+H2","Match","H1+H2+OT"];

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
                const e=mt==="H1+H2+OT"?snapE6(rawE):snapE(rawE);
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

              // ── Profit formaté : signe fixe + chiffres tabulaires + $ aligné ──

              const StatRow=({s,label,isEdge,onClick,noLine})=>{
                if(!s)return null;
                return(
                  <div onClick={onClick} style={{display:"grid",gridTemplateColumns:GRIDCOLS,padding:"9px 14px",borderBottom:noLine?"none":"1px solid #0d1628",alignItems:"center",background:roiBg(s.roi),cursor:onClick?"pointer":"default"}}><span style={{fontSize:isEdge?15:13,fontWeight:900,color:"#FFFFFF"}}>{label}</span><span style={{fontSize:11,color:"#5a6a7e",textAlign:"center"}}>{s.cnt}</span><span style={{fontSize:11,color:"#7a9cbd",textAlign:"center"}}>{s.avgOdds.toFixed(2)}</span><span style={{fontSize:11,fontWeight:700,color:s.wr>=55?"#00E676":s.wr<45?"#f87171":"#9CA3AF",textAlign:"center"}}>{s.wr}%</span><span style={{fontSize:11,fontWeight:700,color:roiColor(s.roi),textAlign:"center"}}>{fmt(s.roi,"%")}</span><span style={{fontSize:11,fontWeight:800,color:s.ev>=0?"#00E676":"#f87171",textAlign:"center"}}>{fmt(s.ev,"%")}</span><span style={{fontSize:11,color:"#7a9cbd",textAlign:"center"}}>{s.avgStake}$</span><div style={{display:"flex",justifyContent:"flex-end"}}><FmtProfit v={s.profit}/></div></div>
                );
              };

              // ── EDGE DRILL VIEW ──
              if(edgeDrill){
                const {mt,game,edge}=edgeDrill;
                // Get all bets with this exact edge+mt+game
                const drillBets=ppBets.filter(b=>{
                  const rawE2=b.ppEdge!=null?b.ppEdge:0;
                  const e=mt==="H1+H2+OT"?snapE6(rawE2):snapE(rawE2);
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
                    <div style={{background:"rgba(6,10,20,.99)",border:"1px solid rgba(139,92,246,.25)",borderRadius:14,overflow:"hidden",marginBottom:10}}><div style={{padding:"9px 14px",background:"rgba(139,92,246,.07)",borderBottom:"1px solid rgba(139,92,246,.15)"}}><span style={{fontSize:11,fontWeight:800,color:"#c4b5fd",textTransform:"uppercase",letterSpacing:1}}>Over / Under - Edge +{edge.toFixed(2)}</span></div><ColHeaders/>
                      {soS&&<StatRow s={soS} label="Over" isEdge={false} noLine={!suS}/>}
                      {suS&&<StatRow s={suS} label="Under" isEdge={false} noLine={true}/>}
                    </div>

                    {/* All lines played at this edge */}
                    <div style={{background:"rgba(6,10,20,.99)",border:"1px solid rgba(139,92,246,.2)",borderRadius:14,overflow:"hidden"}}><div style={{padding:"9px 14px",background:"rgba(0,0,0,.3)",borderBottom:"1px solid #0d1628"}}><span style={{fontSize:11,fontWeight:700,color:"#7a9cbd",textTransform:"uppercase",letterSpacing:.8}}>Lignes jouées</span></div><div style={{display:"grid",gridTemplateColumns:"40px 44px 44px 28px 38px 38px 44px 44px 40px 54px",padding:"5px 14px",borderBottom:"1px solid #0d1628",background:"rgba(0,0,0,.3)"}}>
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
                          <div key={l.ou+l.bkLine+l.ppLine}><div onClick={()=>setPpBetsDrill(ppBetsDrill&&ppBetsDrill.key===l.ou+l.bkLine+l.ppLine?null:{key:l.ou+l.bkLine+l.ppLine,bets:matchBets,label:l.ou+" "+l.bkLine.toFixed(1)+" → PP "+l.ppLine.toFixed(1)})}
                              style={{display:"grid",gridTemplateColumns:"40px 44px 44px 28px 38px 38px 44px 44px 40px 44px 20px",padding:"9px 14px",borderBottom:"none",alignItems:"center",background:roiBg(s.roi),cursor:"pointer"}}><span style={{fontSize:10,fontWeight:700,color:l.ou==="Over"?"#00E676":"#60a5fa",textAlign:"center"}}>{l.ou}</span><span style={{fontSize:12,fontWeight:800,color:"#e0e8f0",textAlign:"center"}}>{l.bkLine.toFixed(1)}</span><span style={{fontSize:12,fontWeight:800,color:"#c4b5fd",textAlign:"center"}}>{l.ppLine.toFixed(1)}</span><span style={{fontSize:11,color:"#5a6a7e",textAlign:"center"}}>{s.cnt}</span><span style={{fontSize:11,color:"#7a9cbd",textAlign:"center"}}>{s.avgOdds.toFixed(2)}</span><span style={{fontSize:11,fontWeight:700,color:s.wr>=55?"#00E676":s.wr<45?"#f87171":"#9CA3AF",textAlign:"center"}}>{s.wr}%</span><span style={{fontSize:11,fontWeight:700,color:roiColor(s.roi),textAlign:"center"}}>{fmt(s.roi,"%")}</span><span style={{fontSize:11,fontWeight:800,color:s.ev>=0?"#00E676":"#f87171",textAlign:"center"}}>{fmt(s.ev,"%")}</span><span style={{fontSize:11,color:"#7a9cbd",textAlign:"center"}}>{s.avgStake}$</span><div style={{display:"flex",justifyContent:"flex-end"}}><FmtProfit v={s.profit} fontSize={12}/></div><span style={{fontSize:10,color:"#4a5a6e",textAlign:"center"}}>{(ppBetsDrill&&ppBetsDrill.key)===l.ou+l.bkLine+l.ppLine?"▲":"▼"}</span></div>
                            {/* Inline bets view */}
                            {(ppBetsDrill&&ppBetsDrill.key)===l.ou+l.bkLine+l.ppLine&&matchBets.length>0&&(
                              <div style={{background:"rgba(0,0,0,.4)",borderTop:"1px solid #0d1628",borderBottom:isLast?"none":"1px solid #0d1628"}}>
                                {matchBets.map((b,bi)=>{
                                  const isWon=b.status==="won";
                                  const bkLogo=BK_LOGOS[b.bookmaker]||bkPhotos[b.bookmaker]||null;
                                  const profitVal=b.profit!=null?b.profit:(isWon?(b.stake||0)*(b.odds-1):-(b.stake||0));
                                  return(
                                    <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderTop:bi>0?"1px solid rgba(255,255,255,.04)":"none",borderLeft:"2.5px solid "+(isWon?"#00E676":"#f43f5e")}}><div style={{width:32,height:32,borderRadius:8,overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,.04)"}}><GameLogo game={b.game} size={32}/></div><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:4,marginBottom:3,flexWrap:"wrap"}}><span style={{fontWeight:800,fontSize:13,color:"#f0f4ff",textTransform:"capitalize",flexShrink:0}}>{b.player}</span><span style={{color:"#2e3d50",fontSize:10,margin:"0 1px"}}>-</span><span style={{fontSize:11,color:"#8a9eb8",fontWeight:500}}>{(b.description||"").replace(/^(Over|Under)\s/,"")}</span></div><div style={{display:"flex",alignItems:"center",gap:0,flexWrap:"wrap"}}><span style={{fontSize:11,fontWeight:700,color:"#7a9cbd"}}>@{b.odds}</span>
                                          {(bkLogo||b.bookmaker)&&<span style={{color:"#3a4e62",margin:"0 5px",fontSize:11}}>·</span>}
                                          {bkLogo?<img src={bkLogo} alt={b.bookmaker} style={{width:14,height:14,borderRadius:3,objectFit:"cover"}}/>:<span style={{fontSize:11,color:"#7a9cbd"}}>{b.bookmaker}</span>}
                                          {b.stake&&<><span style={{color:"#3a4e62",margin:"0 5px",fontSize:11}}>·</span><span style={{fontSize:11,color:"#7a9cbd"}}>{b.stake}$</span></>}
                                          {b.tournament&&<><span style={{color:"#3a4e62",margin:"0 5px",fontSize:11}}>·</span><span style={{fontSize:10,color:"#7a9cbd"}}> {b.tournament.split(" ")[0]}</span></>}
                                        </div></div><div style={{flexShrink:0,textAlign:"right"}}><FmtProfit v={profitVal} fontSize={13}/><div style={{fontSize:9,color:isWon?"rgba(110,231,160,.5)":"rgba(248,113,113,.5)",fontWeight:700}}>{isWon?"✓ WIN":"✗ LOSS"}</div></div></div>
                                  );
                                })}
                              </div>
                            )}
                            {!isLast&&<div style={{height:1,background:"#0d1628"}}/>}
                          </div>
                        );
                      })}
                    </div></div>
                );
              }

              // ── MAP TAB ──
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
                        <div key={game} style={{background:"rgba(6,10,20,.99)",border:"1px solid rgba(139,92,246,.2)",borderRadius:16,overflow:"hidden"}}><div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",background:"rgba(139,92,246,.06)",borderBottom:"1px solid rgba(139,92,246,.15)"}}><GameLogo game={game} size={20}/><span style={{fontSize:14,fontWeight:800,color:"#e0e8f0"}}>{game}</span>
                            {gT&&<><span style={{marginLeft:"auto",fontSize:11,color:"#5a6a7e"}}>{gT.cnt}p</span><span style={{fontSize:12,fontWeight:700,color:roiColor(gT.roi),marginLeft:6}}>{fmt(gT.roi,"%")} ROI</span><span style={{fontSize:12,fontWeight:800,color:gT.ev>=0?"#00E676":"#f87171",marginLeft:6}}>{fmt(gT.ev,"%")} EV</span><FmtProfit v={gT.profit} fontSize={12}/></>}
                          </div><ColHeaders/>
                          {gameEdges.map((e,i)=>{
                            const s=calc(matrix[mt][game][e.toFixed(2)]);
                            if(!s)return null;
                            const isExpanded=edgeDrill&&edgeDrill.mt===mt&&edgeDrill.game===game&&Math.abs(edgeDrill.edge-e)<0.01&&!edgeDrill.fromHeat;
                            // Get ppLines for this edge
                            const edgeBets=ppBets.filter(function(b){
                              var rawE=b.ppEdge!=null?b.ppEdge:0;
                              var snap=mt==="H1+H2+OT"?snapE6(rawE):snapE(rawE);
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
                            const sortedPPLines=Object.values(ppLineGroups).sort(function(a,b){return b.ppLine-a.ppLine;});
                            return(
                              <div key={e}><StatRow key={e} s={s} label={"+"+e.toFixed(2)} isEdge={true} noLine={false} onClick={function(){setEdgeDrill(isExpanded?null:{mt,game,edge:e,fromHeat:false});}}/>
                                {/* PP Lines breakdown when expanded */}
                                {isExpanded&&sortedPPLines.length>0&&(
                                  <div style={{background:"rgba(0,0,0,.3)",borderBottom:"1px solid rgba(139,92,246,.1)"}}><div style={{padding:"6px 14px 4px",display:"flex",alignItems:"center",gap:6}}><img src={PP_LOGO_B64} style={{width:12,height:12,objectFit:"contain"}}/><span style={{fontSize:9,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>Lignes PP - clique pour voir les paris</span></div>
                                    {sortedPPLines.map(function(lg){
                                      var ls=calc(lg.data);
                                      if(!ls)return null;
                                      var isLineDrill=ppBetsDrill&&ppBetsDrill.key==="ppline_"+mt+"_"+game+"_"+e.toFixed(2)+"_"+lg.ppLine.toFixed(1);
                                      return(
                                        <div key={lg.ppLine}><div onClick={function(){setPpBetsDrill(isLineDrill?null:{key:"ppline_"+mt+"_"+game+"_"+e.toFixed(2)+"_"+lg.ppLine.toFixed(1),bets:lg.bets,label:game+" "+mt+" PP "+lg.ppLine.toFixed(1)});}}
                                            style={{display:"flex",alignItems:"center",gap:8,padding:"8px 14px",cursor:"pointer",background:isLineDrill?"rgba(124,58,237,.12)":"transparent",borderTop:"1px solid rgba(255,255,255,.03)"}}><img src={PP_LOGO_B64} style={{width:13,height:13,objectFit:"contain",flexShrink:0}}/><span style={{fontSize:13,fontWeight:800,color:"#c4b5fd",minWidth:40}}>{lg.ppLine.toFixed(1)}</span><span style={{fontSize:10,color:"#4a5a6e"}}>{ls.cnt} paris</span><span style={{fontSize:11,fontWeight:700,color:roiColor(ls.roi),marginLeft:"auto"}}>{fmt(ls.roi,"%")}</span><span style={{fontSize:11,fontWeight:700,color:ls.wr>=55?"#00E676":ls.wr<45?"#f87171":"#9CA3AF"}}>{ls.wr}%</span><FmtProfit v={ls.profit} fontSize={12}/><span style={{fontSize:10,color:"#4a5a6e"}}>{isLineDrill?"▲":"▼"}</span></div>
                                          {isLineDrill&&lg.bets.length>0&&(
                                            <div style={{background:"rgba(0,0,0,.5)",borderTop:"1px solid #0d1628"}}>
                                              {lg.bets.map(function(b,bi){
                                                var isWon=b.status==="won";
                                                var bkLogo=BK_LOGOS[b.bookmaker]||bkPhotos[b.bookmaker]||null;
                                                var profitVal=b.profit!=null?b.profit:(isWon?(b.stake||0)*(b.odds-1):-(b.stake||0));
                                                return(
                                                  <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 14px",borderTop:bi>0?"1px solid rgba(255,255,255,.03)":"none",borderLeft:"2.5px solid "+(isWon?"#00E676":"#f43f5e")}}><div style={{width:28,height:28,borderRadius:7,overflow:"hidden",flexShrink:0}}><GameLogo game={b.game} size={28}/></div><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2,flexWrap:"wrap"}}><span style={{fontWeight:800,fontSize:12,color:"#f0f4ff",textTransform:"capitalize"}}>{b.player}</span><span style={{fontSize:10,color:"#8a9eb8"}}>{(b.description||"").replace(/^(Over|Under)\s/,"")}</span>
                                                        {b.mapTag&&<span style={{fontSize:9,fontWeight:700,color:"#fbbf24",background:"rgba(251,191,36,.1)",padding:"1px 4px",borderRadius:3}}>{b.mapTag}</span>}
                                                        {b.overUnder&&<span style={{fontSize:9,fontWeight:700,color:b.overUnder==="Over"?"#00E676":"#60a5fa",background:b.overUnder==="Over"?"rgba(0,230,118,.1)":"rgba(96,165,250,.1)",padding:"1px 5px",borderRadius:3}}>{b.overUnder}</span>}
                                                      </div><div style={{display:"flex",alignItems:"center",gap:0}}><span style={{fontSize:10,color:"#7a9cbd"}}>@{b.odds}</span>
                                                        {bkLogo?<><span style={{color:"#3a4e62",margin:"0 4px",fontSize:10}}>·</span><img src={bkLogo} alt={b.bookmaker} style={{width:12,height:12,borderRadius:3,objectFit:"cover"}}/></>:b.bookmaker?<span style={{color:"#3a4e62",margin:"0 4px",fontSize:10}}>·</span>:null}
                                                        {b.stake&&<><span style={{color:"#3a4e62",margin:"0 4px",fontSize:10}}>·</span><span style={{fontSize:10,color:"#7a9cbd"}}>{b.stake}$</span></>}
                                                        {b.datetime&&<><span style={{color:"#3a4e62",margin:"0 4px",fontSize:10}}>·</span><span style={{fontSize:9,color:"#3a4a5e"}}>{String(b.datetime).slice(5,10)}</span></>}
                                                      </div></div><div style={{flexShrink:0,textAlign:"right"}}><FmtProfit v={profitVal} fontSize={12}/><div style={{fontSize:8,color:isWon?"rgba(110,231,160,.5)":"rgba(248,113,113,.5)",fontWeight:700}}>{isWon?"✓ WIN":"✗ LOSS"}</div></div></div>
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

              // ── HEATMAP TAB ──
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
                    <div><button onClick={()=>setPpStatsDrill(prev=>({...(prev||{}),heatDrill:null}))}
                        style={{display:"flex",alignItems:"center",gap:6,background:"none",border:"none",color:"#c4b5fd",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",marginBottom:10,padding:0}}>
                        ← {mt} - {game}
                      </button><div style={{background:"rgba(6,10,20,.99)",border:"1px solid rgba(139,92,246,.2)",borderRadius:14,overflow:"hidden"}}><ColHeaders/>
                        {gameEdges.map((e,i)=>{
                          const s=calc(matrix[mt][game][e.toFixed(2)]);if(!s)return null;
                          return(<StatRow key={e} s={s} label={"+"+e.toFixed(2)} isEdge={true} noLine={i===gameEdges.length-1} onClick={()=>setEdgeDrill({mt,game,edge:e})}/>);
                        })}
                      </div></div>
                  );
                }
                // 4 separate tables by game
                const catColors={Points:"#a78bfa",Rebounds:"#fb923c",Assists:"#60a5fa","3 Pts":"#34d399"};
                return(
                  <div>

                    {/* Metric selector dropdown */}
                    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}><div style={{position:"relative",display:"inline-block"}}><select value={heatMetric} onChange={e=>setHeatMetric(e.target.value)}
                          style={{appearance:"none",WebkitAppearance:"none",background:"rgba(139,92,246,.15)",border:"1px solid rgba(139,92,246,.4)",borderRadius:8,color:"#c4b5fd",fontSize:11,fontWeight:700,padding:"5px 28px 5px 10px",cursor:"pointer",fontFamily:"Inter,sans-serif",outline:"none"}}>
                          {HEAT_METRICS.map(m=>(<option key={m.k} value={m.k}>{m.l}</option>))}
                        </select><span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#c4b5fd",fontSize:10}}>▾</span></div></div>
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
                                <div style={{display:"flex",alignItems:"center",gap:6,padding:"9px 12px",background:"rgba(139,92,246,.07)",borderBottom:"1px solid rgba(139,92,246,.15)",flexWrap:"wrap"}}><GameLogo game={game} size={16}/><span style={{fontSize:13,fontWeight:800,color:"#e0e8f0"}}>{game}</span>
                                  {gS&&<><span style={{fontSize:10,color:"#5a6a7e",marginLeft:4}}>{gS.cnt}p</span><span style={{fontSize:11,fontWeight:700,color:roiColor(gS.roi)}}>{fmt(gS.roi,"%")} ROI</span><span style={{fontSize:11,fontWeight:700,color:gS.ev>=0?"#00E676":"#f87171"}}>{fmt(gS.ev,"%")} EV</span><span style={{fontSize:11,fontWeight:800,color:gS.profit>=0?"#00E676":"#f87171",marginLeft:"auto"}}>{fmt(gS.profit,"$")}</span></>}
                                  {!gS&&<span style={{fontSize:9,color:"#4a5a6e",marginLeft:"auto"}}>{metric.l}</span>}
                                </div>
                              );
                            })()}
                            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}><table style={{borderCollapse:"collapse",tableLayout:"fixed",width:"max-content",minWidth:"100%"}}><thead><tr><th style={{position:"sticky",left:0,zIndex:2,background:"rgba(8,10,20,.98)",width:82,padding:"5px 10px",borderBottom:"1px solid #0d1628",borderRight:"1px solid #0d1628",fontSize:9,color:"#3a4a5e",fontWeight:700,textAlign:"left"}}>Map</th>
                                    {edgeCols.map(e=>(<th key={e} style={{minWidth:44,padding:"5px 4px",borderBottom:"1px solid #0d1628",borderRight:"1px solid #0d1628",fontSize:8,color:"#3a4a5e",fontWeight:700,textAlign:"center",background:"rgba(0,0,0,.3)"}}>+{e.toFixed(2)}</th>))}
                                  </tr></thead><tbody>
                                  {MAP_TYPES.filter(mt=>ppBets.some(b=>b.ppMapType===mt&&b.game===game)).map((mt,ri,arr)=>(
                                    <tr key={mt}><td style={{position:"sticky",left:0,zIndex:2,background:"rgba(8,10,20,.98)",padding:"7px 10px",borderBottom:ri<arr.length-1?"1px solid #0d1628":"none",borderRight:"1px solid #0d1628"}}><span style={{fontSize:9,color:"#7a9cbd",fontWeight:700,whiteSpace:"nowrap"}}>{mt}</span></td>
                                      {edgeCols.map(e=>{
                                        const d=matrix[mt]&&matrix[mt][game]&&matrix[mt][game][e.toFixed(2)];
                                        const s=d?calc(d):null;
                                        const cellBg=s?metric.bg(s):"transparent";
                                        const cellColor=s?metric.color(s):"#151e2c";
                                        const cellVal=s?metric.fmt(s):"-";
                                        return(
                                          <td key={e} onClick={()=>s&&setEdgeDrill({mt,game,edge:e})}
                                            style={{background:cellBg,borderRight:"1px solid #0d1628",borderBottom:ri<arr.length-1?"1px solid #0d1628":"none",padding:"5px 3px",cursor:s?"pointer":"default",textAlign:"center",verticalAlign:"middle",minWidth:44}}><div style={{fontSize:11,fontWeight:800,color:cellColor}}>{cellVal}</div>
                                            {s&&<div style={{fontSize:8,color:"#3a4a5e"}}>{s.cnt}p</div>}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody></table></div></div>
                        );
                      })}
                    </div>
                    {/* Legend */}
                    <div style={{display:"flex",gap:8,marginTop:8,flexWrap:"wrap",alignItems:"center"}}>
                      {heatMetric==="roi"||heatMetric==="prog"||heatMetric==="ev"?[["#00E676","≥+15%"],["rgba(163,228,188,.8)","+5-15%"],["rgba(251,191,36,.8)","±5%"],["rgba(249,115,22,.8)","-5-15%"],["#f87171","≤-15%"]].map(([col,lbl])=>(
                        <div key={lbl} style={{display:"flex",alignItems:"center",gap:3}}><div style={{width:10,height:10,borderRadius:2,background:col}}/><span style={{fontSize:9,color:"#4a5a6e"}}>{lbl}</span></div>
                      )):null}
                      <span style={{fontSize:9,color:"#3a4a5e",marginLeft:4}}>· Clique → détail</span></div></div>
                );
              };

              return(
                <div style={{marginBottom:16}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><img src={PP_LOGO_B64} alt="PP" style={{width:20,height:20,borderRadius:5,objectFit:"cover",flexShrink:0}}/><span style={{fontSize:13,fontWeight:700,color:"#c4b5fd",flex:1}}>Analyse PrizePicks</span><span style={{fontSize:9,color:"#4a3a6e"}}>{ppBetsFiltered?ppBetsFiltered.length:ppBets.length} paris PP{(ppOUApplied||ppMapFilterApplied)?" (filtré)":""}</span></div>
                  {/* PP filters dropdown */}
                  {(function(){
                    var activeCount=(ppOUApplied?1:0)+(ppMapFilterApplied?1:0)+(ppSortByCount?1:0);
                    return(
                      <div style={{marginBottom:8}}><button onClick={function(){setPpFilterOpen(function(v){return !v;});}}
                          style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",borderRadius:9,border:"1px solid "+(ppFilterOpen||activeCount>0?"rgba(167,139,250,.4)":"rgba(255,255,255,.08)"),background:ppFilterOpen||activeCount>0?"rgba(124,58,237,.12)":"transparent",color:activeCount>0?"#c4b5fd":"#6B7280",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",width:"100%",justifyContent:"space-between"}}><span style={{display:"flex",alignItems:"center",gap:6}}>
                            ⚙️ Filtres PP
                            {ppOUApplied&&<span style={{fontSize:9,background:"rgba(167,139,250,.3)",color:"#c4b5fd",padding:"1px 6px",borderRadius:4,fontWeight:700}}>{ppOUApplied}</span>}
                            {ppMapFilterApplied&&<span style={{fontSize:9,background:"rgba(96,165,250,.3)",color:"#93c5fd",padding:"1px 6px",borderRadius:4,fontWeight:700}}>{ppMapFilterApplied}</span>}
                            {ppSortByCount&&<span style={{fontSize:9,background:"rgba(251,191,36,.2)",color:"#fbbf24",padding:"1px 6px",borderRadius:4,fontWeight:700}}>N↓</span>}
                          </span><span style={{fontSize:10,opacity:.5}}>{ppFilterOpen?"▲":"▼"}</span></button>
                        {ppFilterOpen&&(
                          <div style={{marginTop:6,padding:"12px",background:"rgba(124,58,237,.06)",border:"1px solid rgba(124,58,237,.2)",borderRadius:10}}>
                            {/* Over / Under */}
                            <div style={{marginBottom:10}}><div style={{fontSize:9,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Direction</div><div style={{display:"flex",gap:5}}>
                                {[{k:"",l:"Tous"},{k:"Over",l:"Over"},{k:"Under",l:"Under"}].map(function(o){
                                  var on=ppOU===o.k;
                                  return <button key={o.k} onClick={function(){setPpOU(o.k);}}
                                    style={{flex:1,padding:"6px 0",borderRadius:7,border:"1px solid "+(on?"rgba(167,139,250,.5)":"rgba(255,255,255,.08)"),background:on?"rgba(124,58,237,.2)":"transparent",color:on?"#c4b5fd":"#6B7280",fontSize:11,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{o.l}</button>;
                                })}
                              </div></div>
                            {/* Map filter */}
                            <div style={{marginBottom:10}}><div style={{fontSize:9,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Map jouée</div><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                                {["","Q1","Q2","Q3","Q4","H1","H2","Match"].map(function(m){
                                  var on=ppMapFilter===m;
                                  return <button key={m||"all"} onClick={function(){setPpMapFilter(on?"":m);}}
                                    style={{padding:"5px 10px",borderRadius:7,border:"1px solid "+(on?"rgba(96,165,250,.5)":"rgba(255,255,255,.08)"),background:on?"rgba(59,130,246,.2)":"transparent",color:on?"#93c5fd":"#6B7280",fontSize:11,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{m||"Toutes"}</button>;
                                })}
                              </div></div>
                            {/* Sort */}
                            <div><div style={{fontSize:9,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Tri des lignes</div><div style={{display:"flex",gap:5}}>
                                {[{k:false,l:"Edge ↓"},{k:true,l:"N ↓ (plus de paris en haut)"}].map(function(s){
                                  var on=ppSortByCount===s.k;
                                  return <button key={s.l} onClick={function(){setPpSortByCount(s.k);}}
                                    style={{flex:1,padding:"6px 0",borderRadius:7,border:"1px solid "+(on?"rgba(251,191,36,.5)":"rgba(255,255,255,.08)"),background:on?"rgba(251,191,36,.12)":"transparent",color:on?"#fbbf24":"#6B7280",fontSize:10,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{s.l}</button>;
                                })}
                              </div></div><div style={{display:"flex",gap:6,marginTop:10}}>
                              {(ppOUApplied||ppMapFilterApplied)&&<button onClick={function(){setPpOU("");setPpMapFilter("");setPpOUApplied("");setPpMapFilterApplied("");setPpSortByCount(false);}}
                                style={{flex:1,padding:"8px",borderRadius:7,border:"1px solid rgba(239,68,68,.2)",background:"transparent",color:"#f87171",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                                Réinitialiser
                              </button>}
                              <button onClick={function(){setPpOUApplied(ppOU);setPpMapFilterApplied(ppMapFilter);setPpFilterOpen(false);}}
                                style={{flex:1,padding:"8px",borderRadius:7,border:"none",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",color:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                                ✓ Appliquer
                              </button></div></div>
                        )}
                      </div>
                    );
                  })()}
                  <div style={{display:"flex",gap:5,marginBottom:12,overflowX:"auto",paddingBottom:2}}>
                    {[{k:"combiner",l:" Combiner"},{k:"H1+H2",l:"H1+H2"},{k:"Match",l:"Match"},{k:"H1+H2+OT",l:"H1+H2+OT"},{k:"heat",l:" Heatmap"}].map(t=>(
                      <button key={t.k} onClick={()=>{setPpStatsTab(t.k);setPpStatsDrill(null);}} style={tabStyle(ppStatsTab===t.k)}>{t.l}</button>
                    ))}
                  </div>
                  {ppStatsTab==="combiner"&&(()=>{
                    // Combine Map 1+2 + Map 3 stats per game per edge
                    const combined={};
                    GAMES.forEach(game=>{
                      combined[game]={};
                      ["H1+H2","Match"].forEach(mt=>{
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
                            <div key={game} style={{background:"rgba(6,10,20,.99)",border:"1px solid rgba(139,92,246,.2)",borderRadius:16,overflow:"hidden"}}><div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",background:"rgba(139,92,246,.06)",borderBottom:"1px solid rgba(139,92,246,.15)"}}><GameLogo game={game} size={20}/><span style={{fontSize:14,fontWeight:800,color:"#e0e8f0"}}>{game}</span><span style={{fontSize:10,color:"#5a6a7e",marginLeft:4}}>Map 1+2 + Map 3</span>
                                {gT&&<><span style={{marginLeft:"auto",fontSize:11,color:"#5a6a7e"}}>{gT.cnt}p</span><span style={{fontSize:12,fontWeight:700,color:roiColor(gT.roi),marginLeft:6}}>{fmt(gT.roi,"%")} ROI</span><span style={{fontSize:12,fontWeight:800,color:gT.profit>=0?"#00E676":"#f87171",marginLeft:6}}>{fmt(gT.profit,"$")}</span></>}
                              </div><ColHeaders/>
                              {gameEdges.map((e,i)=>{
                                const s=calc(combined[game][e.toFixed(2)]);
                                if(!s)return null;
                                return(
                                  <div key={e}><StatRow s={s} label={"+"+e.toFixed(2)} isEdge={true} noLine={i===gameEdges.length-1}/>
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
                  {ppStatsTab==="H1+H2"&&(<MapTab mt="H1+H2"/>)}
                  {ppStatsTab==="Match"&&(<MapTab mt="Match"/>)}
                  {ppStatsTab==="H1+H2+OT"&&(<MapTab mt="H1+H2+OT"/>)}
                  {ppStatsTab==="heat"&&(<HeatTab/>)}
                </div>
              );
            })()}

            {/* ── Bookmakers ── */}
            {bkStatsSorted.length>0&&(
              <div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:16,overflow:"hidden",marginBottom:10}}>
                <div style={{fontSize:10,color:"#a78bfa",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 8px",fontFamily:"Inter,sans-serif"}}>Bookmakers</div>
                {bkStatsSorted.map(([bk,s],i)=>{
                  const logo=BK_LOGOS[bk]||bkPhotos[bk]||null;
                  const wr=s.count>0?(s.won/s.count*100):0;
                  const roi=s.staked>0?(s.profit/s.staked*100):0;
                  return(
                    <div key={bk} style={{padding:"10px 14px",borderTop:i>0?"1px solid #1F2937":"none",display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:30,height:30,borderRadius:7,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.07)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        {logo?<img src={logo} alt={bk} style={{width:24,height:24,objectFit:"contain"}} onError={e=>e.target.style.display="none"}/>:<span style={{fontSize:10,fontWeight:700,color:"#6B7280"}}>{bk.slice(0,2)}</span>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:"#E5E7EB",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{bk}</div>
                        <div style={{fontSize:10,color:"#6B7280"}}>{s.count} paris · {wr.toFixed(0)}% WR · {roi>=0?"+":""}{roi.toFixed(1)}% ROI</div>
                      </div>
                      <span style={{fontWeight:700,fontSize:13,color:s.profit>=0?"#22C55E":"#EF4444",flexShrink:0}}>{s.profit>=0?"+":""}{s.profit.toFixed(0)}$</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Tranches de cote ── */}
            {oddsRangeStats.length>0&&(
              <div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:16,overflow:"hidden",marginBottom:10}}>
                <div style={{fontSize:10,color:"#fbbf24",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 8px",fontFamily:"Inter,sans-serif"}}>Tranches de cote</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 40px 52px 70px",gap:4,padding:"4px 14px 8px"}}>
                  <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textTransform:"uppercase"}}>Cote</span>
                  <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"center"}}>N</span>
                  <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"center"}}>WR%</span>
                  <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"right"}}>Profit</span>
                </div>
                {oddsRangeStats.map((r,i)=>(
                  <div key={r.label} style={{display:"grid",gridTemplateColumns:"1fr 40px 52px 70px",gap:4,padding:"7px 14px",borderTop:"1px solid #1F2937",alignItems:"center"}}>
                    <span style={{fontSize:12,fontWeight:700,color:"#fbbf24"}}>@{r.label}</span>
                    <span style={{fontSize:11,color:"#9CA3AF",textAlign:"center"}}>{r.count}</span>
                    <span style={{fontSize:11,fontWeight:700,color:r.wr>55?"#22C55E":r.wr<45?"#EF4444":"#9CA3AF",textAlign:"center"}}>{r.wr.toFixed(0)}%</span>
                    <span style={{fontSize:11,fontWeight:700,color:r.profit>=0?"#22C55E":"#EF4444",textAlign:"right"}}>{r.profit>=0?"+":""}{r.profit.toFixed(0)}$</span>
                  </div>
                ))}
              </div>
            )}

            </>}

            {/* ──  ONGLET ANALYSE ── */}
            
            {statsTab==="annonces"&&(()=>{
              // Grouper les paris avec annonces OUT par ligue
              const annByGame={};
              settledFiltered.forEach(b=>{
                if(!b.announceOuts||b.announceOuts.length===0)return;
                const g=b.game||"Autre";
                if(!annByGame[g])annByGame[g]=[];
                annByGame[g].push(b);
              });
              const games=Object.keys(annByGame).sort();
              if(games.length===0){
                return(
                  <div style={{textAlign:"center",padding:"40px 16px",color:"#4a5a6e"}}>
                    <div style={{fontSize:28,marginBottom:10}}>📣</div>
                    <div style={{fontSize:14,fontWeight:600,color:"#6B7280"}}>Aucune annonce OUT enregistrée</div>
                    <div style={{fontSize:11,color:"#4a5a6e",marginTop:6}}>Les annonces apparaissent quand tu ajoutes des joueurs OUT à un pari</div>
                  </div>
                );
              }
              return(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {games.map(game=>{
                    const gb=annByGame[game];
                    const won=gb.filter(b=>b.status==="won").length;
                    const profit=gb.reduce((s,b)=>s+(b.profit||0),0);
                    const staked=gb.reduce((s,b)=>s+(b.stake||0),0);
                    const wr=gb.length>0?(won/gb.length*100):0;
                    const roi=staked>0?(profit/staked*100):0;
                    const avgOdds=gb.length>0?(gb.reduce((s,b)=>s+(b.odds||0),0)/gb.length):0;
                    const roiAbs=Math.min(Math.abs(roi),50);
                    const isOpen=!!statsGameOpen["ANN_"+game];
                    const cfg=GAME_CFG[game]||{accent:"#9CA3AF"};
                    return(
                      <div key={game} style={{background:"#111827",border:"1px solid "+(isOpen?cfg.accent+"55":"#1F2937"),borderRadius:isOpen?"14px 14px 0 0":"14px",overflow:"hidden"}}>
                        <button onClick={()=>setStatsGameOpen(s=>({...s,["ANN_"+game]:!s["ANN_"+game]}))}
                          style={{width:"100%",display:"flex",flexDirection:"column",padding:"12px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <GameLogo game={game} size={20}/>
                              <span style={{fontSize:14,fontWeight:800,color:cfg.accent}}>{game}</span>
                              <span style={{fontSize:10,color:"#6B7280"}}>{gb.length} paris annoncés</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{padding:"2px 8px",borderRadius:6,background:profit>=0?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",fontSize:11,fontWeight:700,color:profit>=0?"#22C55E":"#EF4444"}}>{profit>=0?"+":""}{profit.toFixed(0)}$</span>
                              <span style={{fontSize:11,color:"#6B7280",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:10,marginBottom:6}}>
                            <span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>{wr.toFixed(0)}% WR</span>
                            <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                            <span style={{fontSize:11,fontWeight:700,color:roi>=0?"#22C55E":"#EF4444"}}>{roi>=0?"+":""}{roi.toFixed(1)}% ROI</span>
                            <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                            <span style={{fontSize:11,color:"#9CA3AF"}}>@{avgOdds.toFixed(2)}</span>
                          </div>
                          <div style={{display:"flex",gap:4}}>
                            <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden"}}>
                              <div style={{height:"100%",width:wr+"%",background:wr>55?"#22C55E":wr<45?"#EF4444":"#9CA3AF",borderRadius:2}}/>
                            </div>
                            <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden",position:"relative"}}>
                              <div style={{position:"absolute",top:0,left:roi>=0?"50%":"calc(50% - "+(roiAbs/2)+"%)",height:"100%",width:roiAbs+"%",background:roi>=0?"linear-gradient(90deg,#3B82F6,#06B6D4)":"#EF4444",borderRadius:2}}/>
                            </div>
                          </div>
                        </button>
                        {isOpen&&(
                          <div style={{background:"#111827",border:"1px solid #1F2937",borderTop:"none",borderRadius:"0 0 14px 14px",overflow:"hidden"}}>
                            {gb.map((b,i)=>{
                              const pd=allPlayers[(b.player||"").toLowerCase().trim()];
                              const avatarSrc=pd?getAvatarSrc(pd):null;
                              const allOuts=[...(b.outPlayers_own||[]),...(b.outPlayers_opp||[]),...(b.announceOuts||[])];
                              return(
                                <div key={b.id} style={{padding:"10px 14px",borderTop:i>0?"1px solid rgba(255,255,255,.04)":"none",display:"flex",alignItems:"center",gap:10}}>
                                  <div style={{width:32,height:32,borderRadius:8,overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,.05)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                    {avatarSrc?<img src={avatarSrc} alt={b.player} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} onError={e=>e.target.style.display="none"}/>:<span style={{fontSize:12,fontWeight:700,color:"#6B7280"}}>{(b.player||"?").charAt(0).toUpperCase()}</span>}
                                  </div>
                                  <div style={{flex:1,minWidth:0}}>
                                    <div style={{fontWeight:700,fontSize:13,color:"#E5E7EB",textTransform:"capitalize",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{b.player}</div>
                                    <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:3}}>
                                      {allOuts.map(o=><span key={o} style={{fontSize:9,fontWeight:700,color:"#f87171",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",borderRadius:4,padding:"1px 5px"}}>❌ {o}</span>)}
                                    </div>
                                  </div>
                                  <div style={{textAlign:"right",flexShrink:0}}>
                                    <div style={{fontWeight:700,fontSize:12,color:b.profit>=0?"#22C55E":"#EF4444"}}>{b.profit>=0?"+":""}{(b.profit||0).toFixed(0)}$</div>
                                    <div style={{fontSize:10,color:"#6B7280"}}>@{b.odds}</div>
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
              );
            })()}
            {statsTab==="victoire"&&(()=>{
              const LEAGUES=["Pro A","ACB","Lega","Bundesliga","EuroLeague","EuroCup","BCL"];
              // Tous les paris équipe (victoire + handicap + long terme)
              const isTeamB=b=>checkIsTeamBet(b);
              const teamBets=settledFiltered.filter(isTeamB);

              // ─ Helper stats ─
              const calcS=bets=>{
                const c=bets.length,w=bets.filter(b=>b.status==="won").length;
                const p=bets.reduce((s,b)=>s+(b.profit||0),0);
                const st=bets.reduce((s,b)=>s+(b.stake||0),0);
                const ao=bets.length>0?bets.reduce((s,b)=>s+(b.odds||0),0)/bets.length:0;
                return{count:c,won:w,profit:p,staked:st,wr:c>0?w/c*100:0,roi:st>0?p/st*100:0,avgOdds:ao};
              };
              const AccordionCard=({id,title,logo,count,s,children,accent="#a78bfa"})=>{
                const isOpen=!!statsGameOpen[id];
                const toggle=()=>setStatsGameOpen(prev=>({...prev,[id]:!prev[id]}));
                if(!s||!s.count)return null;
                const roiAbs=Math.min(Math.abs(s.roi),50);
                return(
                  <div style={{background:"#111827",border:"1px solid "+(isOpen?accent+"55":"#1F2937"),borderRadius:isOpen?"14px 14px 0 0":"14px",marginBottom:isOpen?0:8}}>
                    <button onClick={toggle} style={{width:"100%",display:"flex",flexDirection:"column",padding:"12px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>{logo}{title&&<span style={{fontSize:14,fontWeight:800,color:accent}}>{title}</span>}<span style={{fontSize:10,color:"#6B7280"}}>{s.count} paris</span></div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{padding:"2px 8px",borderRadius:6,background:s.profit>=0?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",fontSize:11,fontWeight:700,color:s.profit>=0?"#22C55E":"#EF4444"}}>{s.profit>=0?"+":""}{s.profit.toFixed(0)}$</span><span style={{fontSize:11,color:"#6B7280",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span></div>
                      </div>
                      <div style={{display:"flex",gap:10,marginBottom:6}}>
                        <span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>{s.wr.toFixed(0)}% WR</span>
                        <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                        <span style={{fontSize:11,fontWeight:700,color:s.roi>=0?"#22C55E":"#EF4444"}}>{s.roi>=0?"+":""}{s.roi.toFixed(1)}% ROI</span>
                        <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                        <span style={{fontSize:11,color:"#9CA3AF"}}>@{s.avgOdds.toFixed(2)}</span>
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:s.wr+"%",background:s.wr>55?"#22C55E":s.wr<45?"#EF4444":"#9CA3AF",borderRadius:2}}/></div>
                        <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden",position:"relative"}}><div style={{position:"absolute",top:0,left:s.roi>=0?"50%":"calc(50% - "+(roiAbs/2)+"%)",height:"100%",width:roiAbs+"%",background:s.roi>=0?"linear-gradient(90deg,#3B82F6,#06B6D4)":"#EF4444",borderRadius:2}}/></div>
                      </div>
                    </button>
                    {isOpen&&<div style={{background:"#111827",border:"1px solid #1F2937",borderTop:"none",borderRadius:"0 0 14px 14px",overflow:"hidden",marginBottom:8}}>{children}</div>}
                  </div>
                );
              };
              const SubRow=({label,s,color="#E5E7EB"})=>{
                if(!s||!s.count)return null;
                return(
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 14px",borderTop:"1px solid rgba(255,255,255,.04)"}}>
                    <div><div style={{fontSize:12,fontWeight:700,color}}>{label}</div><div style={{fontSize:10,color:"#6B7280"}}>{s.count} paris · {s.wr.toFixed(0)}% WR · @{s.avgOdds.toFixed(2)}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontWeight:700,fontSize:12,color:s.profit>=0?"#22C55E":"#EF4444"}}>{s.profit>=0?"+":""}{s.profit.toFixed(0)}$</div><div style={{fontSize:10,color:s.roi>=0?"#22C55E":"#EF4444"}}>{s.roi>=0?"+":""}{s.roi.toFixed(1)}%</div></div>
                  </div>
                );
              };

              // Grouper par ligue
              const byLeague={};
              teamBets.forEach(b=>{
                const lg=b.game||b.league||"Autre";
                if(!byLeague[lg])byLeague[lg]=[];
                byLeague[lg].push(b);
              });
              const leagues=Object.keys(byLeague).sort((a,b2)=>byLeague[b2].length-byLeague[a].length);
              if(leagues.length===0)return(
                <div style={{textAlign:"center",padding:"40px 20px",color:"#4a5a6e"}}>
                  <div style={{fontSize:28,marginBottom:10}}>🏆</div>
                  <div style={{fontSize:13,fontWeight:600,color:"#6B7280"}}>Aucun pari équipe réglé</div>
                </div>
              );
              return(
                <div style={{display:"flex",flexDirection:"column",gap:0}}>
                  {leagues.map(league=>{
                    const lb=byLeague[league];
                    const s=calcS(lb);
                    const vic=lb.filter(b=>b.description&&b.description.startsWith("Victoire "));
                    const hcp=lb.filter(b=>b.description&&/[+-]\d+\.?\d+$/.test(b.description)&&!b.description.startsWith("Victoire ")&&!b.description.startsWith("Vainqueur "));
                    const hcpPos=hcp.filter(b=>/\+\d/.test(b.description));
                    const hcpNeg=hcp.filter(b=>/-\d/.test(b.description));
                    const lt=lb.filter(b=>b.description&&b.description.startsWith("Vainqueur "));
                    const cfg=GAME_CFG[league]||{accent:"#9CA3AF"};
                    return(
                      <AccordionCard key={league} id={"VIC_"+league} title={league} logo={<GameLogo game={league} size={20}/>} s={s} accent={cfg.accent}>
                        {/* Victoire */}
                        {vic.length>0&&(
                          <><div style={{fontSize:10,color:"#22C55E",fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",padding:"10px 14px 4px"}}>🏆 Victoires</div>
                            <SubRow label="Toutes victoires" s={calcS(vic)} color="#22C55E"/>
                          </>
                        )}
                        {/* Handicap */}
                        {hcp.length>0&&(
                          <><div style={{fontSize:10,color:"#fbbf24",fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",padding:"10px 14px 4px",borderTop:"1px solid rgba(255,255,255,.04)"}}>📊 Handicaps</div>
                            <SubRow label="Tous handicaps" s={calcS(hcp)} color="#fbbf24"/>
                            {hcpPos.length>0&&<SubRow label="Handicap +" s={calcS(hcpPos)} color="#22C55E"/>}
                            {hcpNeg.length>0&&<SubRow label="Handicap −" s={calcS(hcpNeg)} color="#f87171"/>}
                          </>
                        )}
                        {/* Long terme */}
                        {lt.length>0&&(
                          <><div style={{fontSize:10,color:"#a78bfa",fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",padding:"10px 14px 4px",borderTop:"1px solid rgba(255,255,255,.04)"}}>📈 Long terme</div>
                            {lt.map((b,i)=>(
                              <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 14px",borderTop:"1px solid rgba(255,255,255,.03)"}}>
                                <div>
                                  <div style={{fontSize:12,fontWeight:700,color:"#a78bfa"}}>{b.player||b.team}</div>
                                  <div style={{fontSize:10,color:"#6B7280"}}>{b.description} · @{b.odds}</div>
                                </div>
                                <span style={{fontWeight:700,fontSize:12,color:b.profit>=0?"#22C55E":"#EF4444"}}>{b.profit>=0?"+":""}{(b.profit||0).toFixed(0)}$</span>
                              </div>
                            ))}
                          </>
                        )}
                      </AccordionCard>
                    );
                  })}
                </div>
              );
            })()}
            {statsTab==="combine"&&(()=>{
              // Paris combinés dans bets (description contient "Combiné" ou splits.length > 0)
              const comboBets=settledFiltered.filter(b=>b.splits&&b.splits.length>0);

              // ─ Helper stats ─
              const calcS=bets=>{
                const c=bets.length,w=bets.filter(b=>b.status==="won").length;
                const p=bets.reduce((s,b)=>s+(b.profit||0),0);
                const st=bets.reduce((s,b)=>s+(b.stake||0),0);
                const ao=bets.length>0?bets.reduce((s,b)=>s+(b.odds||0),0)/bets.length:0;
                return{count:c,won:w,profit:p,staked:st,wr:c>0?w/c*100:0,roi:st>0?p/st*100:0,avgOdds:ao};
              };
              const AccordionCard=({id,title,logo,count,s,children,accent="#a78bfa"})=>{
                const isOpen=!!statsGameOpen[id];
                const toggle=()=>setStatsGameOpen(prev=>({...prev,[id]:!prev[id]}));
                if(!s||!s.count)return null;
                const roiAbs=Math.min(Math.abs(s.roi),50);
                return(
                  <div style={{background:"#111827",border:"1px solid "+(isOpen?accent+"55":"#1F2937"),borderRadius:isOpen?"14px 14px 0 0":"14px",marginBottom:isOpen?0:8}}>
                    <button onClick={toggle} style={{width:"100%",display:"flex",flexDirection:"column",padding:"12px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>{logo}{title&&<span style={{fontSize:14,fontWeight:800,color:accent}}>{title}</span>}<span style={{fontSize:10,color:"#6B7280"}}>{s.count} paris</span></div>
                        <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{padding:"2px 8px",borderRadius:6,background:s.profit>=0?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",fontSize:11,fontWeight:700,color:s.profit>=0?"#22C55E":"#EF4444"}}>{s.profit>=0?"+":""}{s.profit.toFixed(0)}$</span><span style={{fontSize:11,color:"#6B7280",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span></div>
                      </div>
                      <div style={{display:"flex",gap:10,marginBottom:6}}>
                        <span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>{s.wr.toFixed(0)}% WR</span>
                        <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                        <span style={{fontSize:11,fontWeight:700,color:s.roi>=0?"#22C55E":"#EF4444"}}>{s.roi>=0?"+":""}{s.roi.toFixed(1)}% ROI</span>
                        <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                        <span style={{fontSize:11,color:"#9CA3AF"}}>@{s.avgOdds.toFixed(2)}</span>
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:s.wr+"%",background:s.wr>55?"#22C55E":s.wr<45?"#EF4444":"#9CA3AF",borderRadius:2}}/></div>
                        <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden",position:"relative"}}><div style={{position:"absolute",top:0,left:s.roi>=0?"50%":"calc(50% - "+(roiAbs/2)+"%)",height:"100%",width:roiAbs+"%",background:s.roi>=0?"linear-gradient(90deg,#3B82F6,#06B6D4)":"#EF4444",borderRadius:2}}/></div>
                      </div>
                    </button>
                    {isOpen&&<div style={{background:"#111827",border:"1px solid #1F2937",borderTop:"none",borderRadius:"0 0 14px 14px",overflow:"hidden",marginBottom:8}}>{children}</div>}
                  </div>
                );
              };
              const SubRow=({label,s,color="#E5E7EB"})=>{
                if(!s||!s.count)return null;
                return(
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 14px",borderTop:"1px solid rgba(255,255,255,.04)"}}>
                    <div><div style={{fontSize:12,fontWeight:700,color}}>{label}</div><div style={{fontSize:10,color:"#6B7280"}}>{s.count} paris · {s.wr.toFixed(0)}% WR · @{s.avgOdds.toFixed(2)}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontWeight:700,fontSize:12,color:s.profit>=0?"#22C55E":"#EF4444"}}>{s.profit>=0?"+":""}{s.profit.toFixed(0)}$</div><div style={{fontSize:10,color:s.roi>=0?"#22C55E":"#EF4444"}}>{s.roi>=0?"+":""}{s.roi.toFixed(1)}%</div></div>
                  </div>
                );
              };

              const byLeague={};
              comboBets.forEach(b=>{
                const lg=b.game||"Autre";
                if(!byLeague[lg])byLeague[lg]=[];
                byLeague[lg].push(b);
              });
              const leagues=Object.keys(byLeague).sort((a,b2)=>byLeague[b2].length-byLeague[a].length);
              if(leagues.length===0){
                // Fallback: show PariCombineView if no splits bets
                return(
                  <PariCombineView
                    bets={bets} allPlayers={allPlayers}
                    bookmakers={bookmakers} bkPhotos={bkPhotos} BK_LOGOS={BK_LOGOS}
                    showToast={showToast}
                  />
                );
              }
              return(
                <div style={{display:"flex",flexDirection:"column",gap:0}}>
                  {leagues.map(league=>{
                    const lb=byLeague[league];
                    const s=calcS(lb);
                    const cfg=GAME_CFG[league]||{accent:"#9CA3AF"};
                    const overB=lb.filter(b=>b.overUnder==="Over");
                    const underB=lb.filter(b=>b.overUnder==="Under");
                    return(
                      <AccordionCard key={league} id={"CMB_"+league} title={league} logo={<GameLogo game={league} size={20}/>} s={s} accent={cfg.accent}>
                        <SubRow label="🔼 Over" s={calcS(overB)} color="#60a5fa"/>
                        <SubRow label="🔽 Under" s={calcS(underB)} color="#60a5fa"/>
                        {lb.slice(0,5).map((b,i)=>(
                          <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 14px",borderTop:"1px solid rgba(255,255,255,.03)"}}>
                            <div>
                              <div style={{fontSize:12,fontWeight:700,color:"#E5E7EB",textTransform:"capitalize"}}>{b.player}</div>
                              <div style={{fontSize:10,color:"#6B7280"}}>{b.description} · @{b.odds} · {(b.splits||[]).length+1} sél.</div>
                            </div>
                            <span style={{fontWeight:700,fontSize:12,color:b.profit>=0?"#22C55E":"#EF4444"}}>{b.profit>=0?"+":""}{(b.profit||0).toFixed(0)}$</span>
                          </div>
                        ))}
                      </AccordionCard>
                    );
                  })}
                </div>
              );
            })()}
{statsTab==="analyse"&&(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>

                {/* ── HELPER: SortHeader ── */}
                {(()=>{
                  const accent="#6366f1";
                  const cardStyle={background:"rgba(10,12,28,.99)",border:"1px solid rgba(255,255,255,.07)",borderRadius:16,overflow:"hidden"};
                  const secTitle=(emoji,title,sub)=>(
                    <div style={{display:"flex",alignItems:"center",gap:9,padding:"12px 14px 10px",borderBottom:"1px solid rgba(255,255,255,.06)"}}><span style={{fontSize:18,lineHeight:1}}>{emoji}</span><div><div style={{fontSize:13,fontWeight:800,color:"#f0f4ff",letterSpacing:.2}}>{title}</div>
                        {sub&&<div style={{fontSize:9,color:"#4a5a6e",marginTop:1}}>{sub}</div>}
                      </div></div>
                  );
                  const SortHdr=({label,k,sort,setSort,align="right"})=>{
                    const active=sort.key===k;
                    return(
                      <span onClick={()=>setSort(s=>({key:k,dir:s.key===k?-s.dir:-1}))}
                        style={{fontSize:8,color:active?"#a5b4fc":"#3a4a5e",fontWeight:active?800:700,textTransform:"uppercase",letterSpacing:.5,cursor:"pointer",textAlign:align,userSelect:"none",display:"flex",alignItems:"center",gap:2,justifyContent:align==="right"?"flex-end":align==="center"?"center":"flex-start"}}>
                        {label}
                        <span style={{fontSize:9,opacity:active?1:.3}}>{active&&sort.dir>0?"↑":"↓"}</span></span>
                    );
                  };

                  const sortFn=(arr,sort,keys)=>{
                    return [...arr].sort((a,b)=>{
                      const va=a[sort.key]??0,vb=b[sort.key]??0;
                      return sort.dir*(vb-va);
                    });
                  };

                  return(<>

                {/* ══ 💡 COTE IDÉALE ══ */}
                {advancedStats&&advancedStats.coteIdéale&&advancedStats.coteIdéale.length>0&&(()=>{
                  const byGame={};
                  advancedStats.coteIdéale.forEach(r=>{if(!byGame[r.game])byGame[r.game]=[];byGame[r.game].push(r);});
                  return(
                    <div style={cardStyle}>
                      {secTitle("💡","Cote idéale par pari","Map 1+2 et Map 3 · formule : cote min = 1 ÷ WR")}
                      {Object.entries(byGame).map(([game,rows])=>{
                        const over=rows.filter(r=>r.ou==="Over");
                        const under=rows.filter(r=>r.ou==="Under");
                        const sortOver=sortFn(over,coteSort,["edge","cnt","wr","avgOdds","idealOdds","profit"]);
                        const sortUnder=sortFn(under,coteSort,["edge","cnt","wr","avgOdds","idealOdds","profit"]);
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
                            <div style={{display:"grid",gridTemplateColumns:COLS,gap:4,alignItems:"center",padding:"8px 14px",borderBottom:last?"none":"1px solid rgba(255,255,255,.03)",background:bg}}><span style={{fontSize:13,fontWeight:900,color:"#fff",fontVariantNumeric:"tabular-nums"}}>+{r.edge%1===0?r.edge.toFixed(0):r.edge}</span><span style={{fontSize:10,color:"#4a5a6e",textAlign:"center"}}>{r.cnt}</span><span style={{fontSize:11,fontWeight:700,color:r.wr>=55?"#22C55E":r.wr<45?"#EF4444":"#F59E0B",textAlign:"center"}}>{r.wr}%</span><span style={{fontSize:12,fontWeight:600,color:"#c8d4e8",textAlign:"center",fontVariantNumeric:"tabular-nums"}}>{r.avgOdds.toFixed(2)}</span><span style={{fontSize:12,fontWeight:800,color:ok?"#22C55E":"#EF4444",textAlign:"center",fontVariantNumeric:"tabular-nums"}}>{r.idealOdds.toFixed(2)}</span><div style={{display:"flex",justifyContent:"flex-end"}}><FmtProfit v={r.profit} fontSize={11}/></div><span style={{fontSize:10,fontWeight:700,color:progC,textAlign:"right",fontVariantNumeric:"tabular-nums"}}>{prog>=0?"+":""}{prog.toFixed(1)}%</span></div>
                          );
                        };
                        return(
                          <div key={game} style={{borderTop:"1px solid rgba(255,255,255,.06)"}}><div style={{display:"flex",alignItems:"center",gap:7,padding:"8px 14px 4px",background:"rgba(255,255,255,.015)"}}><GameLogo game={game} size={14}/><span style={{fontSize:11,fontWeight:800,color:"#c8d4e8",textTransform:"uppercase",letterSpacing:1}}>{game}</span></div>
                            {sortOver.length>0&&<><div style={{padding:"4px 14px 2px",background:"rgba(34,197,94,.04)",display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:9,color:"#22C55E",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>▲ Over</span><span style={{fontSize:8,color:"#3a5a3e"}}>{sortOver.length} lignes</span></div><HDR/>{sortOver.map((r,i)=><Row key={r.mt+r.edge} r={{...r,prog:r.profit/5000*100}} last={i===sortOver.length-1&&!sortUnder.length}/>)}
                            </>}
                            {sortOver.length>0&&sortUnder.length>0&&<div style={{height:1,background:"rgba(255,255,255,.1)",margin:"0 14px"}}/>}
                            {sortUnder.length>0&&<><div style={{padding:"4px 14px 2px",background:"rgba(96,165,250,.04)",display:"flex",alignItems:"center",gap:5}}><span style={{fontSize:9,color:"#60a5fa",fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>▼ Under</span><span style={{fontSize:8,color:"#3a4a6e"}}>{sortUnder.length} lignes</span></div><HDR/>{sortUnder.map((r,i)=><Row key={r.mt+r.edge} r={{...r,prog:r.profit/5000*100}} last={i===sortUnder.length-1}/>)}
                            </>}
                          </div>
                        );
                      })}
                      <div style={{padding:"7px 14px",background:"rgba(0,0,0,.2)",borderTop:"1px solid rgba(255,255,255,.04)"}}><span style={{fontSize:9,color:"#3a4a5e"}}>Min = 1÷WR (seuil zéro) · 5k$ = profit si bankroll de 5 000$</span></div></div>
                  );
                })()}

                {/* ══  SIGNAUX ══ */}
                {advancedStats&&advancedStats.signalList.length>0&&(()=>{
                  const sorted=sortFn(advancedStats.signalList,signalSort);
                  return(
                    <div style={cardStyle}>
                      {secTitle("","Signaux","Quoi garder · quoi couper - min 5 paris par combinaison")}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 32px 40px 40px 70px 60px",gap:4,padding:"5px 14px",background:"rgba(0,0,0,.3)"}}>
                        {[["game","Type","left"],["cnt","N","center"],["wr","WR","center"],["roi","ROI","center"],["profit","Profit","right"],["signal","Signal","right"]].map(([k,l,a])=>(
                          k==="signal"
                          ?<span key={k} style={{fontSize:8,color:"#3a4a5e",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"right"}}>Signal</span>
                          :<SortHdr key={k} label={l} k={k} sort={signalSort} setSort={setSignalSort} align={a}/>
                        ))}
                      </div>
                      {sorted.map((s,i)=>{
                        const isGood=s.roi>=5;const isBad=s.roi<=-5;
                        const sigColor=isGood?"#22C55E":isBad?"#EF4444":"#F59E0B";
                        const bg=isGood?"rgba(34,197,94,.05)":isBad?"rgba(239,68,68,.05)":"transparent";
                        const tag=isGood?" Garder":isBad?" Couper":" Neutre";
                        return(
                          <div key={s.ou+s.game} style={{display:"grid",gridTemplateColumns:"1fr 32px 40px 40px 70px 60px",gap:4,alignItems:"center",padding:"9px 14px",borderTop:"1px solid rgba(255,255,255,.04)",background:bg}}><div style={{display:"flex",alignItems:"center",gap:5}}><GameLogo game={s.game} size={12}/><span style={{fontSize:12,fontWeight:700,color:"#c8d4e8"}}>{s.ou==="Over"?"▲":"▼"} {s.game}</span></div><span style={{fontSize:10,color:"#4a5a6e",textAlign:"center"}}>{s.cnt}</span><span style={{fontSize:11,fontWeight:700,color:s.wr>=55?"#22C55E":s.wr<45?"#EF4444":"#F59E0B",textAlign:"center"}}>{s.wr}%</span><span style={{fontSize:11,fontWeight:700,color:s.roi>=0?"#22C55E":"#EF4444",textAlign:"center"}}>{s.roi>=0?"+":""}{s.roi.toFixed(1)}%</span><div style={{display:"flex",justifyContent:"flex-end"}}><FmtProfit v={s.profit} fontSize={12}/></div><span style={{fontSize:10,fontWeight:800,color:sigColor,textAlign:"right"}}>{tag}</span></div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ══ 📅 PERFORMANCE TEMPORELLE ══ */}
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
                    <div style={cardStyle}><div style={{padding:"12px 14px 10px",borderBottom:"1px solid rgba(255,255,255,.06)"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><div style={{display:"flex",alignItems:"center",gap:9}}><span style={{fontSize:18}}>📅</span><div><div style={{fontSize:13,fontWeight:800,color:"#f0f4ff"}}>Performance temporelle</div><div style={{fontSize:9,color:"#4a5a6e",marginTop:1}}>Par jour · par semaine</div></div></div><select value={dowMetric} onChange={e=>setDowMetric(e.target.value)}
                            style={{background:"rgba(99,102,241,.15)",border:"1px solid rgba(99,102,241,.3)",borderRadius:8,padding:"4px 10px",color:"#a5b4fc",fontSize:11,fontFamily:"Inter,sans-serif",outline:"none",cursor:"pointer",fontWeight:600}}><option value="roi">ROI %</option><option value="wr">Win Rate</option><option value="profit">Profit $</option><option value="cnt">Nb Paris</option></select></div><div style={{display:"flex",gap:4,marginTop:10}}>
                          {[["global","Par jour"],["week","Par semaine"]].map(([v,l])=>(
                            <button key={v} onClick={()=>setAnalyseView(v)}
                              style={{padding:"5px 14px",borderRadius:8,border:"1.5px solid "+(analyseView===v?"rgba(99,102,241,.5)":"rgba(255,255,255,.08)"),background:analyseView===v?"rgba(99,102,241,.15)":"transparent",color:analyseView===v?"#a5b4fc":"#4a5a6e",fontSize:11,fontWeight:analyseView===v?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                              {l}
                            </button>
                          ))}
                        </div></div>
                      {analyseView==="week"?(()=>{
                        const wl=advancedStats.weekList;
                        const vals=wl.map(w=>metricFn(w));
                        const maxAbs=Math.max(...vals.map(Math.abs),1);
                        return(
                          <div style={{padding:"12px 14px",overflowX:"auto"}}><div style={{display:"flex",gap:4,minWidth:Math.max(wl.length*52,280)+"px",alignItems:"flex-end",height:90,marginBottom:8}}>
                              {wl.map((w,i)=>{
                                const v=metricFn(w);const pos=v>=0;
                                const barH=Math.max(4,Math.abs(v)/maxAbs*82);
                                const color=pos?"#22C55E":"#EF4444";
                                return(
                                  <div key={w.key} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",minWidth:44}}><div style={{fontSize:8,fontWeight:700,color,marginBottom:2,whiteSpace:"nowrap"}}>{metricFmt(v)}</div><div style={{width:"75%",height:barH+"px",background:color,borderRadius:"3px 3px 0 0",opacity:.7}}/></div>
                                );
                              })}
                            </div><div style={{display:"flex",gap:4,minWidth:Math.max(wl.length*52,280)+"px",borderTop:"1px solid rgba(255,255,255,.06)",paddingTop:4}}>
                              {wl.map(w=>(
                                <div key={w.key} style={{flex:1,textAlign:"center",minWidth:44}}><div style={{fontSize:8,color:"#4a5a6e",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{w.label}</div><div style={{fontSize:7,color:"#3a4a5e"}}>{w.cnt}p</div></div>
                              ))}
                            </div></div>
                        );
                      })():(()=>{
                        const vals=advancedStats.DAYS.map(d=>metricFn(advancedStats.dow[d]));
                        const maxAbs=Math.max(...vals.map(Math.abs),1);
                        return(
                          <div style={{padding:"12px 14px"}}><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
                              {advancedStats.DAYS.map((d,i)=>{
                                const s=advancedStats.dow[d];const v=metricFn(s);
                                const pos=v>=0;const barH=s.cnt>0?Math.min(100,Math.abs(v)/maxAbs*100):0;
                                const color=pos?"#22C55E":"#EF4444";
                                return(
                                  <div key={d} style={{textAlign:"center"}}><div style={{fontSize:9,color:"#5a6a7e",fontWeight:600,marginBottom:5}}>{d}</div><div style={{height:52,display:"flex",alignItems:"flex-end",justifyContent:"center",marginBottom:4}}>
                                      {s.cnt>0
                                        ?<div style={{width:"72%",height:barH+"%",background:color,borderRadius:"3px 3px 0 0",opacity:.8,minHeight:4,boxShadow:pos?"0 0 8px rgba(34,197,94,.3)":"0 0 8px rgba(239,68,68,.3)"}}/>
                                        :<div style={{width:"72%",height:4,background:"rgba(255,255,255,.04)",borderRadius:2}}/>}
                                    </div><div style={{fontSize:10,fontWeight:800,color:s.cnt>0?(pos?color:"#EF4444"):"#3a4a5e"}}>{s.cnt>0?metricFmt(v):"-"}</div><div style={{fontSize:8,color:"#3a4a5e",marginTop:2}}>{s.cnt}p</div></div>
                                );
                              })}
                            </div></div>
                        );
                      })()}
                    </div>
                  );
                })()}

                {/* ══ 📐 SEUIL DE RENTABILITÉ ══ */}
                {advancedStats&&advancedStats.breakevenData.length>0&&(()=>{
                  const sorted=sortFn(advancedStats.breakevenData.filter(r=>r.cnt>=3),breakevenSort);
                  return(
                    <div style={cardStyle}>
                      {secTitle("📐","Rentabilité par tranche de cote","Vert = WR au-dessus du seuil minimum requis")}
                      <div style={{display:"grid",gridTemplateColumns:"80px 1fr 36px 36px 54px 60px",gap:4,padding:"5px 14px",background:"rgba(0,0,0,.3)"}}>
                        {[["label","Cote","left"],["wr","WR","center"],["minWR","Requis","center"],["cnt","N","center"],["roi","ROI","right"],["profit","Profit","right"]].map(([k,l,a])=>(
                          <SortHdr key={k} label={l} k={k} sort={breakevenSort} setSort={setBreakevenSort} align={a}/>
                        ))}
                      </div>
                      {sorted.map((r,i)=>{
                        const gap=r.wr-r.minWR;const isOk=gap>=0;
                        const bg=isOk?"rgba(34,197,94,.04)":"rgba(239,68,68,.04)";
                        return(
                          <div key={r.label} style={{borderTop:"1px solid rgba(255,255,255,.04)",background:bg}}><div style={{display:"grid",gridTemplateColumns:"80px 1fr 36px 36px 54px 60px",gap:4,alignItems:"center",padding:"8px 14px"}}><span style={{fontSize:12,fontWeight:800,color:"#c8d4e8",fontVariantNumeric:"tabular-nums"}}>{r.label}</span><div style={{display:"flex",alignItems:"center",gap:5}}><div style={{flex:1,height:6,background:"rgba(255,255,255,.05)",borderRadius:3,overflow:"hidden",position:"relative"}}><div style={{position:"absolute",left:r.minWR+"%",top:0,bottom:0,width:2,background:"rgba(255,255,255,.3)"}}/><div style={{height:"100%",width:Math.min(100,r.wr)+"%",background:isOk?"rgba(34,197,94,.7)":"rgba(239,68,68,.7)",borderRadius:3}}/></div></div><span style={{fontSize:11,fontWeight:800,color:isOk?"#22C55E":"#EF4444",textAlign:"center"}}>{r.wr}%</span><span style={{fontSize:10,color:"#5a6a7e",textAlign:"center"}}>{r.minWR}%</span><span style={{fontSize:11,fontWeight:700,color:r.roi>=0?"#22C55E":"#EF4444",textAlign:"right"}}>{r.roi>=0?"+":""}{r.roi.toFixed(1)}%</span><div style={{display:"flex",justifyContent:"flex-end"}}><FmtProfit v={r.profit} fontSize={11}/></div></div><div style={{padding:"0 14px 6px",display:"flex",gap:8}}><span style={{fontSize:8,color:isOk?"rgba(34,197,94,.5)":"rgba(239,68,68,.5)",fontWeight:600}}>{isOk?"✓ "+gap+"% au-dessus":"✗ "+Math.abs(gap)+"% sous le seuil"}</span><span style={{fontSize:8,color:"#3a4a5e"}}>{r.cnt} paris</span></div></div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ══  CALIBRATION EDGE ══ */}
                {advancedStats&&advancedStats.calibration.length>1&&(()=>{
                  const sorted=sortFn(advancedStats.calibration,calibSort);
                  const snapE=e=>Math.round(Math.abs(e)*4)/4;
                  return(
                    <div style={cardStyle}>
                      {secTitle("","Calibration Edge PrizePicks","Clique sur un edge pour le détail Over / Under")}
                      <div style={{display:"grid",gridTemplateColumns:"52px 32px 1fr 44px 54px 28px",gap:4,padding:"5px 14px",background:"rgba(0,0,0,.3)"}}>
                        {[["edge","Edge","left"],["cnt","N","center"],["wr","WR","left"],["roi","ROI","right"],["profit","Profit","right"],["","","right"]].map(([k,l,a],idx)=>(
                          k?<SortHdr key={k} label={l} k={k} sort={calibSort} setSort={setCalibSort} align={a}/>
                          :<span key={idx}/>
                        ))}
                      </div>
                      {sorted.map((c,i)=>{
                        const isGood=c.roi>0;const isOpen=calibDrill===c.edge;
                        const overS={cnt:0,won:0,profit:0,staked:0};
                        const underS={cnt:0,won:0,profit:0,staked:0};
                        if(isOpen){
                          settledFiltered.filter(b=>b.ppEdge!=null&&Math.abs(snapE(b.ppEdge)-c.edge)<0.01).forEach(b=>{
                            const t=b.overUnder==="Over"?overS:b.overUnder==="Under"?underS:null;
                            if(!t)return;t.cnt++;t.profit+=b.profit;t.staked+=b.stake;if(b.status==="won")t.won++;
                          });
                        }
                        const rowBg=isOpen?"rgba(99,102,241,.08)":isGood?"rgba(34,197,94,.03)":"rgba(239,68,68,.03)";
                        return(
                          <div key={c.label} style={{borderTop:"1px solid rgba(255,255,255,.04)"}}><div onClick={()=>setCalibDrill(isOpen?null:c.edge)}
                              style={{display:"grid",gridTemplateColumns:"52px 32px 1fr 44px 54px 28px",gap:4,alignItems:"center",padding:"9px 14px",cursor:"pointer",background:rowBg,transition:"background .15s"}}><span style={{fontSize:14,fontWeight:900,color:isOpen?"#a5b4fc":"#fff",fontVariantNumeric:"tabular-nums"}}>+{c.label}</span><span style={{fontSize:10,color:"#4a5a6e",textAlign:"center"}}>{c.cnt}</span><div style={{display:"flex",alignItems:"center",gap:5}}><div style={{flex:1,height:6,background:"rgba(255,255,255,.05)",borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:c.wr+"%",background:isGood?"#22C55E":"#EF4444",borderRadius:3,boxShadow:isGood?"0 0 6px rgba(34,197,94,.4)":"0 0 6px rgba(239,68,68,.4)"}}/></div><span style={{fontSize:10,fontWeight:700,color:c.wr>=55?"#22C55E":c.wr<45?"#EF4444":"#F59E0B",minWidth:26}}>{c.wr}%</span></div><span style={{fontSize:11,fontWeight:700,color:isGood?"#22C55E":"#EF4444",textAlign:"right"}}>{c.roi>=0?"+":""}{c.roi.toFixed(1)}%</span><div style={{display:"flex",justifyContent:"flex-end"}}><FmtProfit v={c.profit} fontSize={11}/></div><span style={{fontSize:12,color:isOpen?"#a5b4fc":"#3a4a5e",textAlign:"right"}}>{isOpen?"▲":"▼"}</span></div>
                            {isOpen&&(
                              <div style={{margin:"0 10px 10px",background:"rgba(99,102,241,.06)",borderRadius:10,padding:"10px 12px",border:"1px solid rgba(99,102,241,.2)"}}><div style={{fontSize:9,color:"#6366f1",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Détail · Edge +{c.label}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                                  {[{label:"▲ Over",s:overS,color:"#22C55E",bg:"rgba(34,197,94,.05)"},{label:"▼ Under",s:underS,color:"#60a5fa",bg:"rgba(96,165,250,.05)"}].map(({label,s,color,bg})=>{
                                    if(s.cnt===0)return<div key={label} style={{textAlign:"center",color:"#3a4a5e",fontSize:10,padding:12}}>Aucun</div>;
                                    const wr=Math.round(s.won/s.cnt*100);
                                    const roi=s.staked>0?s.profit/s.staked*100:0;
                                    return(
                                      <div key={label} style={{background:bg,borderRadius:8,padding:"9px 10px",border:"1px solid rgba(255,255,255,.06)"}}><div style={{fontSize:12,fontWeight:800,color,marginBottom:7}}>{label}</div>
                                        {[["Paris",s.cnt,null],["WR",wr+"%",wr>=55?"#22C55E":wr<45?"#EF4444":"#F59E0B"],["ROI",(roi>=0?"+":"")+roi.toFixed(1)+"%",roi>=0?"#22C55E":"#EF4444"]].map(([k,v,c])=>(
                                          <div key={k} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:10,color:"#5a6a7e"}}>{k}</span><span style={{fontSize:11,fontWeight:700,color:c||"#c8d4e8"}}>{v}</span></div>
                                        ))}
                                        <div style={{display:"flex",justifyContent:"space-between",marginTop:2}}><span style={{fontSize:10,color:"#5a6a7e"}}>Profit</span><FmtProfit v={s.profit} fontSize={12}/></div></div>
                                    );
                                  })}
                                </div></div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* ══ ⭐ TOP / BAS JOUEURS ══ */}
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
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"7px 0",borderBottom:last?"none":"1px solid rgba(255,255,255,.04)"}}><div style={{display:"flex",alignItems:"center",gap:5}}><GameLogo game={p.game} size={11}/><span style={{fontSize:12,color:"#c8d4e8",fontWeight:600,textTransform:"capitalize"}}>{p.player}</span><span style={{fontSize:9,color:"#3a4a5e"}}>{p.wr}%WR</span></div><FmtProfit v={p.profit} fontSize={12}/></div>
                  );
                  return(
                    <div style={cardStyle}>
                      {secTitle("","Top joueurs · À éviter","Min 3 paris")}
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:0}}><div style={{padding:"10px 14px",borderRight:"1px solid rgba(255,255,255,.06)"}}><div style={{fontSize:9,color:"#22C55E",fontWeight:800,textTransform:"uppercase",letterSpacing:.8,marginBottom:8,display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:"#22C55E",display:"inline-block"}}/> Top 5
                          </div>
                          {top5.map((p,i)=><PRow key={p.player} p={p} good last={i===top5.length-1}/>)}
                        </div><div style={{padding:"10px 14px"}}><div style={{fontSize:9,color:"#EF4444",fontWeight:800,textTransform:"uppercase",letterSpacing:.8,marginBottom:8,display:"flex",alignItems:"center",gap:4}}><span style={{width:6,height:6,borderRadius:"50%",background:"#EF4444",display:"inline-block"}}/> À couper
                          </div>
                          {bot5.map((p,i)=><PRow key={p.player} p={p} last={i===bot5.length-1}/>)}
                        </div></div></div>
                  );
                })()}

                  </>);
                })()}
              </div>
            )}

            {statsTab==="jeux"&&(()=>{
              const isTeamBet=b=>checkIsTeamBet(b);

              // Style commun tableau
              const TableHdr=()=>(
                <div style={{display:"grid",gridTemplateColumns:"1fr 40px 52px 70px",gap:4,padding:"4px 14px 6px"}}>
                  <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textTransform:"uppercase"}}>Type</span>
                  <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"center"}}>N</span>
                  <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"center"}}>WR%</span>
                  <span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"right"}}>Profit</span>
                </div>
              );
              const TableRow=({label,bets,color="#E5E7EB"})=>{
                if(!bets||!bets.length)return null;
                const c=bets.length,w=bets.filter(b=>b.status==="won").length;
                const p=bets.reduce((s,b)=>s+(b.profit||0),0);
                const st=bets.reduce((s,b)=>s+(b.stake||0),0);
                const wr=c>0?(w/c*100):0;
                const roi=st>0?(p/st*100):0;
                return(
                  <div style={{display:"grid",gridTemplateColumns:"1fr 40px 52px 70px",gap:4,padding:"7px 14px",borderTop:"1px solid #1F2937",alignItems:"center"}}>
                    <span style={{fontSize:12,fontWeight:700,color}}>{label}</span>
                    <span style={{fontSize:11,color:"#9CA3AF",textAlign:"center"}}>{c}</span>
                    <span style={{fontSize:11,fontWeight:700,color:wr>55?"#22C55E":wr<45?"#EF4444":"#9CA3AF",textAlign:"center"}}>{wr.toFixed(0)}%</span>
                    <span style={{fontSize:11,fontWeight:700,color:p>=0?"#22C55E":"#EF4444",textAlign:"right"}}>{p>=0?"+":""}{p.toFixed(0)}$</span>
                  </div>
                );
              };

              return(
                <div>
                  {ALL_GAMES.map(game=>{
                    const gs=perGameStats[game];
                    if(!gs)return null;
                    const cfg=GAME_CFG[game]||{accent:"#9CA3AF"};
                    const isOpen=!!statsGameOpen[game];
                    const toggle=()=>setStatsGameOpen(s=>({...s,[game]:!s[game]}));

                    // Paris de cette ligue
                    const gameBets=settledFiltered.filter(b=>b.game===game);
                    const playerBets=gameBets.filter(b=>!isTeamBet(b));
                    const teamBets=gameBets.filter(b=>isTeamBet(b));
                    const vicBets=teamBets.filter(b=>b.description&&b.description.startsWith("Victoire "));
                    const hcpBets=teamBets.filter(b=>b.description&&!b.description.startsWith("Victoire ")&&!b.description.startsWith("Vainqueur "));
                    const ltBets=teamBets.filter(b=>b.description&&b.description.startsWith("Vainqueur "));

                    // Positions — seulement paris joueur
                    const roleMap={};
                    playerBets.forEach(b=>{
                      const pd=allPlayers[(b.player||"").toLowerCase().trim()];
                      const role=pd&&pd.role?normalizeRole(pd.role,b.game)||pd.role:"";
                      if(!role)return;
                      if(!roleMap[role])roleMap[role]={role,bets:[]};
                      roleMap[role].bets.push(b);
                    });
                    const roles=Object.values(roleMap).sort((a,b2)=>{
                      const pa=a.bets.reduce((s,b)=>s+(b.profit||0),0);
                      const pb=b2.bets.reduce((s,b)=>s+(b.profit||0),0);
                      return pb-pa;
                    });

                    return(
                      <div key={game} style={{marginBottom:8}}>
                        {/* Header accordéon */}
                        <button onClick={toggle} style={{width:"100%",display:"flex",flexDirection:"column",background:"#111827",border:"1px solid "+(isOpen?cfg.accent+"55":"#1F2937"),borderRadius:isOpen?"14px 14px 0 0":"14px",padding:"12px 14px",cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .2s",textAlign:"left"}}>
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}><GameLogo game={game} size={20}/><span style={{fontSize:14,fontWeight:800,color:cfg.accent}}>{game}</span><span style={{fontSize:10,color:"#6B7280"}}>{gs.count} paris</span></div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{padding:"2px 8px",borderRadius:6,background:gs.profit>=0?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",fontSize:11,fontWeight:700,color:gs.profit>=0?"#22C55E":"#EF4444"}}>{gs.profit>=0?"+":""}{gs.profit.toFixed(0)}$</span>
                              <span style={{fontSize:11,color:"#6B7280",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
                            </div>
                          </div>
                          <div style={{display:"flex",gap:10,marginBottom:6}}>
                            <span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>{gs.wr.toFixed(0)}% WR</span>
                            <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                            <span style={{fontSize:11,fontWeight:700,color:gs.roi>=0?"#22C55E":"#EF4444"}}>{gs.roi>=0?"+":""}{gs.roi.toFixed(1)}% ROI</span>
                            <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                            <span style={{fontSize:11,color:"#9CA3AF"}}>@{gs.avgOdds.toFixed(2)}</span>
                          </div>
                          <div style={{display:"flex",gap:4}}>
                            <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:gs.wr+"%",background:gs.wr>55?"#22C55E":gs.wr<45?"#EF4444":"#9CA3AF",borderRadius:2}}/></div>
                            <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden",position:"relative"}}><div style={{position:"absolute",top:0,left:gs.roi>=0?"50%":"calc(50% - "+(Math.min(Math.abs(gs.roi),50)/2)+"%)",height:"100%",width:Math.min(Math.abs(gs.roi),50)+"%",background:gs.roi>=0?"linear-gradient(90deg,#3B82F6,#06B6D4)":"#EF4444",borderRadius:2}}/></div>
                          </div>
                        </button>

                        {isOpen&&(
                          <div style={{background:"#111827",border:"1px solid #1F2937",borderTop:"none",borderRadius:"0 0 14px 14px",overflow:"hidden"}}>

                            {/* ── Over / Under ── */}
                            {(gs.overS||gs.underS)&&(
                              <><div style={{fontSize:10,color:"#60A5FA",fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",padding:"12px 14px 4px"}}>Over / Under</div>
                                <TableHdr/>
                                <TableRow label="🔼 Over" bets={gameBets.filter(b=>b.overUnder==="Over")} color="#60A5FA"/>
                                <TableRow label="🔽 Under" bets={gameBets.filter(b=>b.overUnder==="Under")} color="#60a5fa"/>
                              </>
                            )}

                            {/* ── Joueurs vs Équipes ── */}
                            {(playerBets.length>0||teamBets.length>0)&&(
                              <><div style={{fontSize:10,color:"#a78bfa",fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",padding:"12px 14px 4px",borderTop:"1px solid rgba(255,255,255,.05)"}}>Joueurs vs Équipes</div>
                                <TableHdr/>
                                <TableRow label="Joueurs" bets={playerBets} color="#a78bfa"/>
                                <TableRow label="Victoire équipe" bets={vicBets} color="#22C55E"/>
                                <TableRow label="Handicap" bets={hcpBets} color="#fbbf24"/>
                                <TableRow label="Long terme" bets={ltBets} color="#34d399"/>
                              </>
                            )}

                            {/* ── Top joueurs ── */}
                            {(gs.allPlayers||[]).length>0&&(
                              <><div style={{fontSize:10,color:"#00E676",fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",padding:"12px 14px 6px",borderTop:"1px solid rgba(255,255,255,.05)",borderBottom:"1px solid rgba(0,230,118,.15)"}}>Top joueurs</div>
                                {(gs.allPlayers||[]).slice(0,5).map((p,i)=>{
                                  const pd=allPlayers[(p.player||"").toLowerCase().trim()];
                                  const avatarSrc=pd?getAvatarSrc(pd):null;
                                  const wr=p.count>0?(p.won/p.count*100).toFixed(0):0;
                                  return(
                                    <div key={p.player} className="stat-row" onClick={()=>setStatsDrill({game,league:null,filterType:"player",filterValue:p.player})} style={{cursor:"pointer"}}>
                                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                                        <span style={{fontSize:10,color:i<3?"#fbbf24":"#6B7280",fontWeight:700,width:16,textAlign:"center",flexShrink:0}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</span>
                                        <div style={{width:30,height:30,borderRadius:8,overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,.05)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                          {avatarSrc?<img src={avatarSrc} alt={p.player} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top"}} onError={e=>e.target.style.display="none"}/>:<span style={{fontSize:11,fontWeight:700,color:"#6B7280"}}>{(p.player||"").charAt(0).toUpperCase()}</span>}
                                        </div>
                                        <div><div style={{fontSize:13,fontWeight:700,color:"#E5E7EB",textTransform:"capitalize"}}>{p.player}</div><div style={{fontSize:10,color:"#6B7280"}}>{p.count} paris · {wr}% WR</div></div>
                                      </div>
                                      <span style={{fontWeight:700,fontSize:12,color:p.profit>=0?"#22C55E":"#EF4444"}}>{p.profit>=0?"+":""}{p.profit.toFixed(0)}$</span>
                                    </div>
                                  );
                                })}
                              </>
                            )}

                            {/* ── Positions (paris joueur uniquement) ── */}
                            {roles.length>0&&(
                              <><div style={{fontSize:10,color:"#A78BFA",fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",padding:"12px 14px 4px",borderTop:"1px solid rgba(255,255,255,.05)"}}>Positions</div>
                                <TableHdr/>
                                {roles.map(({role,bets:rb})=>(
                                  <TableRow key={role} label={role} bets={rb} color="#A78BFA"/>
                                ))}
                              </>
                            )}

                            {/* ── Coupes ── */}
                            {gs.tourneys.filter(t=>t.isCup).length>0&&(
                              <><div style={{fontSize:10,color:"#FCD34D",fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",padding:"12px 14px 6px",borderTop:"1px solid rgba(255,255,255,.05)",borderBottom:"1px solid rgba(251,191,36,.15)"}}>🏆 Coupes</div>
                                {gs.tourneys.filter(t=>t.isCup).map(t=>{
                                  const wr=t.count>0?(t.won/t.count*100).toFixed(0):0;
                                  const roi=t.staked>0?(t.profit/t.staked*100).toFixed(1):0;
                                  const cupRealName=t.name.replace(/^🏆 /,"");
                                  const cupObj=(customCups||[]).find(c=>c.name===cupRealName);
                                  return(
                                    <div key={t.name} style={{display:"grid",gridTemplateColumns:"1fr 40px 52px 70px",gap:4,padding:"7px 14px",borderTop:"1px solid #1F2937",alignItems:"center"}}>
                                      <div style={{display:"flex",alignItems:"center",gap:6}}>
                                        <div style={{width:16,height:16,borderRadius:3,background:"rgba(251,191,36,.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{cupObj&&cupObj.logo?<img src={cupObj.logo} alt="" style={{width:12,height:12,objectFit:"contain"}}/>:<span style={{fontSize:10}}>🏆</span>}</div>
                                        <span style={{fontSize:12,fontWeight:700,color:"#FCD34D"}}>{cupRealName}</span>
                                      </div>
                                      <span style={{fontSize:11,color:"#9CA3AF",textAlign:"center"}}>{t.count}</span>
                                      <span style={{fontSize:11,fontWeight:700,color:parseFloat(wr)>55?"#22C55E":parseFloat(wr)<45?"#EF4444":"#9CA3AF",textAlign:"center"}}>{wr}%</span>
                                      <span style={{fontSize:11,fontWeight:700,color:t.profit>=0?"#22C55E":"#EF4444",textAlign:"right"}}>{t.profit>=0?"+":""}{t.profit.toFixed(0)}$</span>
                                    </div>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {statsTab==="joueurs"&&(()=>{
              const pm={};
              ALL_GAMES.forEach(game=>{
                const gs=perGameStats[game];
                if(!gs)return;
                (gs.allPlayers||[]).forEach(p=>{
                  const k=p.player;
                  if(!pm[k])pm[k]={player:k,game,count:0,won:0,profit:0,role:p.role||""};
                  pm[k].count+=p.count;pm[k].won+=p.won;pm[k].profit+=p.profit;
                });
              });
              const all=Object.values(pm).filter(p=>p.count>=playerMinBets);
              const sortKey=playerSortKey||"profit";
              const sorted=[...all].sort((a,b)=>{
                if(sortKey==="count")return b.count-a.count;
                if(sortKey==="wr")return (b.count>0?b.won/b.count:0)-(a.count>0?a.won/a.count:0);
                return b.profit-a.profit;
              });
              if(sorted.length===0)return <div style={{fontSize:12,color:"#4a5a6e",textAlign:"center",padding:"30px 0"}}>Aucun joueur pour l'instant</div>;
              const showAll=playersExpanded==="ALL_TAB";
              const displayList=showAll?sorted.slice(0,100):sorted.slice(0,20);
              return(
                <div><div style={{display:"flex",gap:5,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                    {[{k:"profit",l:"Profit"},{k:"count",l:"Paris"},{k:"wr",l:"WR%"}].map(s=>{
                      const on=sortKey===s.k;
                      return <button key={s.k} onClick={()=>setPlayerSortKey(s.k)}
                        style={{padding:"5px 12px",borderRadius:8,border:"1px solid "+(on?"rgba(167,139,250,.4)":"rgba(255,255,255,.07)"),background:on?"rgba(124,58,237,.12)":"transparent",color:on?"#c4b5fd":"#6B7280",fontSize:11,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{s.l}</button>;
                    })}
                    <div style={{width:1,height:14,background:"rgba(255,255,255,.08)",margin:"0 2px"}}/><span style={{fontSize:9,color:"#4a5a6e",fontWeight:600}}>Min paris:</span>
                    {[1,3,5,10,20].map(n=>{
                      const on=playerMinBets===n;
                      return <button key={n} onClick={()=>setPlayerMinBets(n)}
                        style={{padding:"4px 10px",borderRadius:7,border:"1px solid "+(on?"rgba(167,139,250,.4)":"rgba(255,255,255,.07)"),background:on?"rgba(124,58,237,.12)":"transparent",color:on?"#c4b5fd":"#6B7280",fontSize:10,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{n}+</button>;
                    })}
                  </div><div className="stat-bloc">
                    {displayList.map((p,i)=>{
                      const wr=p.count>0?(p.won/p.count*100):0;
                      return(
                        <div key={p.player} className="stat-row"><div style={{display:"flex",alignItems:"center",gap:9}}><span style={{fontSize:11,color:i<3?"#fbbf24":"#6B7280",fontWeight:700,width:18,textAlign:"center",flexShrink:0}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</span>
                            <div style={{width:30,height:30,borderRadius:6,background:"rgba(255,255,255,.04)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              {(()=>{const pd=allPlayers[(p.player||"").toLowerCase().trim()];const team=pd&&pd.team;const tl=team?(p.game==="EuroLeague"?EL_TEAM_LOGOS[team]:p.game==="NBA"?NBA_TEAM_LOGOS[team]:null):null;return tl?<img src={tl} style={{width:24,height:24,objectFit:"contain"}} alt={team} onError={e=>e.target.style.display="none"}/>:<GameLogo game={p.game} size={22}/>;})()}
                            </div>
                            <div><div style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontWeight:700,fontSize:13,color:"#E5E7EB"}}>{(p.player||"").split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}</span><GameLogo game={p.game} size={13}/>{p.role&&<PositionLogo role={p.role} size={11}/>}</div><div style={{fontSize:10,color:"#6B7280"}}>{p.count} paris · {wr.toFixed(0)}% WR</div></div></div><span style={{fontWeight:700,fontSize:13,color:p.profit>=0?"#22C55E":"#EF4444"}}>{p.profit>=0?"+":""}{p.profit.toFixed(0)}$</span></div>
                      );
                    })}
                  </div>
                  {sorted.length>20&&(
                    <button onClick={()=>setPlayersExpanded(showAll?null:"ALL_TAB")}
                      style={{width:"100%",marginTop:8,padding:"9px",borderRadius:10,border:"1px solid rgba(255,255,255,.08)",background:"transparent",color:"#6B7280",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                      {showAll?"▲ Réduire":"Voir plus →"}
                    </button>
                  )}

                  {/* ── Bookmaker stats ── */}
                  {(()=>{
                    const bkMap={};
                    settledFiltered.forEach(b=>{
                      const bk=b.bookmaker||"Autre";
                      if(!bkMap[bk])bkMap[bk]={count:0,won:0,profit:0,staked:0};
                      bkMap[bk].count++;bkMap[bk].profit+=b.profit||0;bkMap[bk].staked+=b.stake||0;
                      if(b.status==="won")bkMap[bk].won++;
                    });
                    const bkList=Object.entries(bkMap).sort((a,b2)=>b2[1].profit-a[1].profit);
                    if(bkList.length===0)return null;
                    return(
                      <div style={{marginTop:12,background:"rgba(10,16,34,.98)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,overflow:"hidden"}}>
                        <div style={{fontSize:11,color:"#60a5fa",fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",padding:"12px 14px 8px"}}>Bookmakers</div>
                        {bkList.map(([bk,s])=>{
                          const wr=s.count>0?(s.won/s.count*100):0;
                          const roi=s.staked>0?(s.profit/s.staked*100):0;
                          const logo=BK_LOGOS[bk]||bkPhotos[bk]||null;
                          return(
                            <div key={bk} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",borderTop:"1px solid rgba(255,255,255,.04)"}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                {logo?<img src={logo} alt={bk} style={{width:18,height:18,objectFit:"contain",borderRadius:3}}/>:<span style={{fontSize:11,fontWeight:700,color:"#6B7280"}}>{bk.slice(0,3)}</span>}
                                <div><div style={{fontWeight:600,fontSize:12,color:"#E5E7EB"}}>{bk}</div><div style={{fontSize:10,color:"#6B7280"}}>{s.count} paris · {wr.toFixed(0)}% WR</div></div>
                              </div>
                              <div style={{textAlign:"right"}}>
                                <div style={{fontWeight:700,fontSize:12,color:s.profit>=0?"#22C55E":"#EF4444"}}>{s.profit>=0?"+":""}{s.profit.toFixed(0)}$</div>
                                <div style={{fontSize:10,color:roi>=0?"#22C55E":"#EF4444"}}>{roi>=0?"+":""}{roi.toFixed(1)}% ROI</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* ── Tranches de cotes ── */}
                  {(()=>{
                    const ranges=[{l:"1.01-1.49",min:1.01,max:1.49},{l:"1.50-1.74",min:1.50,max:1.74},{l:"1.75-1.99",min:1.75,max:1.99},{l:"2.00-2.49",min:2.00,max:2.49},{l:"2.50-2.99",min:2.50,max:2.99},{l:"3.00+",min:3.00,max:999}];
                    const rangeStats=ranges.map(r=>{
                      const rb=settledFiltered.filter(b=>{const o=parseFloat(b.odds)||0;return o>=r.min&&o<=r.max;});
                      if(rb.length===0)return null;
                      const won=rb.filter(b=>b.status==="won").length;
                      const profit=rb.reduce((s,b)=>s+(b.profit||0),0);
                      const staked=rb.reduce((s,b)=>s+(b.stake||0),0);
                      return{label:r.l,count:rb.length,wr:won/rb.length*100,profit,roi:staked>0?profit/staked*100:0};
                    }).filter(Boolean);
                    if(rangeStats.length===0)return null;
                    return(
                      <div style={{marginTop:10,background:"rgba(10,16,34,.98)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,overflow:"hidden"}}>
                        <div style={{fontSize:11,color:"#a78bfa",fontWeight:800,letterSpacing:1.2,textTransform:"uppercase",padding:"12px 14px 8px"}}>Tranches de cotes</div>
                        {rangeStats.map(r=>(
                          <div key={r.label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 14px",borderTop:"1px solid rgba(255,255,255,.04)"}}>
                            <div><div style={{fontWeight:600,fontSize:12,color:"#E5E7EB"}}>{r.label}</div><div style={{fontSize:10,color:"#6B7280"}}>{r.count} paris · {r.wr.toFixed(0)}% WR</div></div>
                            <div style={{textAlign:"right"}}>
                              <div style={{fontWeight:700,fontSize:12,color:r.profit>=0?"#22C55E":"#EF4444"}}>{r.profit>=0?"+":""}{r.profit.toFixed(0)}$</div>
                              <div style={{fontSize:10,color:r.roi>=0?"#22C55E":"#EF4444"}}>{r.roi>=0?"+":""}{r.roi.toFixed(1)}% ROI</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                </div>
              );
            })()}

            {statsTab==="tournois"&&(()=>{
              const POS_LIST=[
                {key:"PG",label:"Point Guard",color:"#a78bfa"},
                {key:"SG",label:"Shooting Guard",color:"#60a5fa"},
                {key:"SF",label:"Small Forward",color:"#34d399"},
                {key:"PF",label:"Power Forward",color:"#fb923c"},
                {key:"C",label:"Center",color:"#f472b6"},
              ];
              const BET_TYPES_ORDER=["Points","Rebounds","Assists","3 Pts","Pts+Reb","Pts+Ast","Pts+Reb+Ast"];
              const posBets={};
              POS_LIST.forEach(({key})=>{posBets[key]=[];});
              settledFiltered.forEach(b=>{
                const pd=allPlayers[(b.player||"").toLowerCase().trim()];
                const role=pd&&pd.role&&pd.role.toUpperCase();
                if(role&&posBets[role])posBets[role].push(b);
              });
              return(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {POS_LIST.map(({key,label,color})=>{
                    const pb=posBets[key]||[];
                    if(pb.length===0)return null;
                    const won=pb.filter(b=>b.status==="won").length;
                    const profit=pb.reduce((s,b)=>s+(b.profit||0),0);
                    const staked=pb.reduce((s,b)=>s+(b.stake||0),0);
                    const wr=pb.length>0?(won/pb.length*100):0;
                    const roi=staked>0?(profit/staked*100):0;
                    const overB=pb.filter(b=>b.overUnder==="Over");
                    const underB=pb.filter(b=>b.overUnder==="Under");
                    const overWR=overB.length>0?(overB.filter(b=>b.status==="won").length/overB.length*100):0;
                    const underWR=underB.length>0?(underB.filter(b=>b.status==="won").length/underB.length*100):0;
                    const byType={};
                    pb.forEach(b=>{
                      const d=b.description||"";
                      const type=BET_TYPES_ORDER.find(t=>d.includes(t))||"Autre";
                      if(!byType[type])byType[type]={count:0,won:0,profit:0,staked:0};
                      byType[type].count++;byType[type].profit+=b.profit||0;byType[type].staked+=b.stake||0;
                      if(b.status==="won")byType[type].won++;
                    });
                    const typeList=Object.entries(byType).sort((a,b2)=>b2[1].count-a[1].count);
                    const isOpen=!!statsGameOpen["POS_"+key];
                    const avgOdds=pb.length>0?(pb.reduce((s,b)=>s+(b.odds||0),0)/pb.length):0;
                    const roiAbs=Math.min(Math.abs(roi),50);
                    return(
                      <div key={key} style={{background:"#111827",border:"1px solid "+(isOpen?"rgba(255,255,255,.12)":"#1F2937"),borderRadius:isOpen?"14px 14px 0 0":"14px",overflow:"hidden"}}>
                        <button onClick={()=>setStatsGameOpen(s=>({...s,["POS_"+key]:!s["POS_"+key]}))}
                          style={{width:"100%",display:"flex",flexDirection:"column",padding:"12px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
                          {/* Ligne 1 : Nom position + profit */}
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{fontSize:15,fontWeight:800,color:"#fff",textDecoration:"underline",textDecorationColor:color,textUnderlineOffset:3}}>{label}</span>
                              <span style={{fontSize:10,color:"#6B7280",fontWeight:500}}>{key}</span>
                              <span style={{fontSize:10,color:"#6B7280"}}>{pb.length} paris</span>
                            </div>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{padding:"2px 8px",borderRadius:6,background:profit>=0?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",fontSize:11,fontWeight:700,color:profit>=0?"#22C55E":"#EF4444"}}>{profit>=0?"+":""}{profit.toFixed(0)}$</span>
                              <span style={{fontSize:11,color:"#6B7280",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
                            </div>
                          </div>
                          {/* Ligne 2 : stats */}
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                            <span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>{wr.toFixed(0)}% WR</span>
                            <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                            <span style={{fontSize:11,fontWeight:700,color:roi>=0?"#22C55E":"#EF4444"}}>{roi>=0?"+":""}{roi.toFixed(1)}% ROI</span>
                            <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                            <span style={{fontSize:11,color:"#9CA3AF"}}>@{avgOdds.toFixed(2)} moy.</span>
                            <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                            <span style={{fontSize:11,color:"#60a5fa"}}>▲{overB.length}</span>
                            <span style={{fontSize:11,color:"#f87171"}}>▼{underB.length}</span>
                          </div>
                          {/* Barre WR + ROI */}
                          <div style={{display:"flex",gap:4,alignItems:"center"}}>
                            <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden"}}>
                              <div style={{height:"100%",width:wr+"%",background:wr>55?"#22C55E":wr<45?"#EF4444":"#9CA3AF",borderRadius:2,transition:"width .5s"}}/>
                            </div>
                            <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden",position:"relative"}}>
                              <div style={{position:"absolute",top:0,left:roi>=0?"50%":"calc(50% - "+(roiAbs/100*50)+"%)",height:"100%",width:roiAbs+"%",background:roi>=0?"linear-gradient(90deg,#3B82F6,#06B6D4)":"#EF4444",borderRadius:2,transition:"all .5s"}}/>
                            </div>
                          </div>
                        </button>
                        {isOpen&&(
                          <div style={{background:"#111827",border:"1px solid #1F2937",borderTop:"none",borderRadius:"0 0 14px 14px",overflow:"hidden"}}>
                            {typeList.map(([type,s])=>{
                              const twr=s.count>0?(s.won/s.count*100):0;
                              const troi=s.staked>0?(s.profit/s.staked*100):0;
                              return(
                                <div key={type} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",borderTop:"1px solid rgba(255,255,255,.04)"}}>
                                  <div>
                                    <div style={{fontWeight:600,fontSize:13,color:"#E5E7EB"}}>{type}</div>
                                    <div style={{fontSize:10,color:"#6B7280"}}>{s.count} paris · {twr.toFixed(0)}% WR · {troi>=0?"+":""}{troi.toFixed(1)}% ROI</div>
                                  </div>
                                  <span style={{fontWeight:700,fontSize:12,color:s.profit>=0?"#22C55E":"#EF4444"}}>{s.profit>=0?"+":""}{s.profit.toFixed(0)}$</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}


        {/* ── STATS DRILL-DOWN ── */}
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
          const isNBA2=game==="NBA",isEuro=game==="EuroLeague";
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
            const role=rawRole; // basket: position directe (PG/SG/SF/PF/C)
            const mo=b.datetime?String(b.datetime).slice(0,7):"?";
            const bkt=bk2(b.odds||1);
            if(!byMap[map])byMap[map]=mk(); add(byMap[map],b);
            if(!byBK[bk])byBK[bk]=mk(); add(byBK[bk],b);
            if(!byOdds[bkt])byOdds[bkt]=mk(); add(byOdds[bkt],b);
            if(!byMonth[mo])byMonth[mo]=mk(); add(byMonth[mo],b);
            if(isO){add(over,b);b.isLive?add(overLive,b):add(overNL,b);}
            if(isU){add(under,b);b.isLive?add(underLive,b):add(underNL,b);}
            if(false){isO?add(overHS,b):isU?add(underHS,b):null;}
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
          const pageTitle=filterType?({role:"Position",map:"Map",tourney:"Tournoi",bk:"Bookmaker",kill:"Points",player:"Joueur"}[filterType]||filterType)+" - "+filterValue:(league?game+" · "+league:game);

          const pc=v=>(v||0)>=0?"#00E676":"#EF4444";
          const wrc=v=>(v||0)>=55?"#00E676":(v||0)<45?"#EF4444":"#9CA3AF";

          // Simple table row - label | N paris | WR% | Profit
          // ── Composants drill-down ──
          const TRow=({label,s,indent=false})=>!s?null:(
            <div style={{display:"flex",alignItems:"center",padding:indent?"7px 12px 7px 24px":"9px 12px",borderBottom:"1px solid #1A2235",background:indent?"rgba(255,255,255,0.01)":"transparent"}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:indent?11:13,fontWeight:indent?500:600,color:indent?"#9CA3AF":"#E5E7EB"}}>{label}</div></div><span style={{fontSize:11,color:"#6B7280",minWidth:36,textAlign:"right"}}>{s.n}p</span><span style={{fontSize:12,fontWeight:700,color:wrc(s.wr),minWidth:44,textAlign:"right"}}>{s.wr.toFixed(0)}%</span><span style={{fontSize:13,fontWeight:800,color:pc(s.profit),minWidth:66,textAlign:"right"}}>{s.profit>=0?"+":""}{(s.profit||0).toFixed(0)}$</span></div>
          );

          const Header=()=>(
            <div style={{display:"flex",padding:"5px 12px",background:"#0A1020",borderBottom:"1px solid #1A2235"}}><div style={{flex:1}}/><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,minWidth:36,textAlign:"right",textTransform:"uppercase",letterSpacing:.5}}>N</span><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,minWidth:44,textAlign:"right",textTransform:"uppercase",letterSpacing:.5}}>WR</span><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,minWidth:66,textAlign:"right",textTransform:"uppercase",letterSpacing:.5}}>Profit</span></div>
          );

          const SubHeader=({label})=>(
            <div style={{padding:"6px 12px 3px",background:"#0A1020",borderBottom:"1px solid #1A2235"}}><span style={{fontSize:9,color:"#4B5563",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{label}</span></div>
          );

          const Sec=({title,children})=>(
            <div style={{marginBottom:12,borderRadius:12,overflow:"hidden",border:"1px solid #1A2235"}}><div style={{fontSize:9,color:"#9CA3AF",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"9px 12px",background:"#0D1626",borderBottom:"1px solid #1A2235"}}>{title}</div><Header/>
              {children}
            </div>
          );

          // Top 5 pertes par position+kills (LoL only)
          let top5Losses=[];
          if(isEuro){
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
            <div style={{position:"fixed",inset:0,background:"#0B1220",zIndex:450,overflowY:"auto",fontFamily:"'Inter',sans-serif"}}><div style={{padding:"16px 16px 40px",maxWidth:500,margin:"0 auto"}}>

                {/* Header */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><button onClick={()=>filterType?(setStatsDrill({game,league}),setDrillPeriod(null)):(setStatsDrill(null),setDrillPeriod(null))}
                    style={{background:"rgba(255,255,255,0.06)",border:"none",borderRadius:9,padding:"8px 14px",color:"#E5E7EB",cursor:"pointer",fontSize:15,fontWeight:700,flexShrink:0}}>←</button><div><div style={{display:"flex",alignItems:"center",gap:7}}>
                      {game&&<GameLogo game={game} size={16}/>}
                      <span style={{fontSize:16,fontWeight:700,color:"#E5E7EB"}}>{pageTitle}</span></div><div style={{fontSize:10,color:"#6B7280",marginTop:2}}>{betsF.length} paris</div></div></div>

                {/* Global */}
                <div style={{marginBottom:12,borderRadius:12,overflow:"hidden",border:"1px solid #1A2235"}}><div style={{fontSize:9,color:"#9CA3AF",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"9px 12px",background:"#0D1626",borderBottom:"1px solid #1A2235"}}>Global</div><div style={{display:"flex",justifyContent:"space-around",padding:"14px 12px"}}>
                    {[{l:"WR",v:gWR.toFixed(0)+"%",c:wrc(gWR)},{l:"ROI",v:(gROI>=0?"+":"")+gROI.toFixed(1)+"%",c:pc(gROI)},{l:"Profit",v:(totalP>=0?"+":"")+totalP.toFixed(0)+"$",c:pc(totalP)},{l:"Cote moy.",v:"@"+(betsF.reduce((s,b)=>s+(b.odds||0),0)/betsF.length).toFixed(2),c:"#9CA3AF"}].map(x=>(
                      <div key={x.l} style={{textAlign:"center"}}><div style={{fontSize:9,color:"#6B7280",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>{x.l}</div><div style={{fontSize:17,fontWeight:800,color:x.c}}>{x.v}</div></div>
                    ))}
                  </div></div>

                {(toS(nlOver)||toS(nlUnder))&&(
                  <div style={{marginBottom:12,background:"#111827",border:"1px solid #1F2937",borderRadius:14,overflow:"hidden"}}>
                    {/* Title */}
                    <div style={{padding:"12px 14px",borderBottom:"1px solid #1F2937"}}><span style={{fontSize:15,fontWeight:700,color:"#FFFFFF"}}>Non-live</span></div>
                    {/* Over/Under */}
                    <Header/>
                    {toS(nlOver)&&<TRow label="🔼 Over" s={toS(nlOver)}/>}
                    {toS(nlUnder)&&<TRow label="🔽 Under" s={toS(nlUnder)}/>}
                    {isNBA2&&(toS(overHS)||toS(underHS))&&<><TRow label="💀 Over HS" s={toS(overHS)}/><TRow label="💀 Under HS" s={toS(underHS)}/></>}
                    {/* POSITIONS */}
                    {sortP(nlByRole).length>0&&<><div style={{padding:"8px 14px 4px",borderTop:"1px solid #1F2937",background:"#0A1020"}}><span style={{fontSize:9,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>Positions</span></div><Header/>
                      {sortP(nlByRole).map(({key,s})=><TRow key={key} label={key} s={s}/>)}
                    </>}
                    {/* MAPS */}
                    {nlByMapArr.length>0&&<><div style={{padding:"8px 14px 4px",borderTop:"1px solid #1F2937",background:"#0A1020"}}><span style={{fontSize:9,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>Maps</span></div><Header/>
                      {nlByMapArr.map(({key,s})=><TRow key={key} label={key} s={s}/>)}
                    </>}
                    {/* LIGNES KILLS */}
                    {sortP(nlByKill).length>0&&<><div style={{padding:"8px 14px 4px",borderTop:"1px solid #1F2937",background:"#0A1020"}}><span style={{fontSize:9,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>Lignes Kills</span></div><Header/>
                      {sortP(nlByKill).map(({key,s})=><TRow key={key} label={key} s={s}/>)}
                    </>}
                  </div>
                )}
                {(toS(liveOver)||toS(liveUnder))&&(
                  <div style={{marginBottom:12,background:"#111827",border:"1px solid #1F2937",borderRadius:14,overflow:"hidden"}}>
                    {/* Title */}
                    <div style={{padding:"12px 14px",borderBottom:"1px solid #1F2937"}}><span style={{fontSize:15,fontWeight:700,color:"#FFFFFF"}}>🔴 Live</span></div>
                    {/* Over/Under */}
                    <Header/>
                    {toS(liveOver)&&<TRow label="🔼 Over" s={toS(liveOver)}/>}
                    {toS(liveUnder)&&<TRow label="🔽 Under" s={toS(liveUnder)}/>}
                    
                    {/* POSITIONS */}
                    {sortP(liveByRole).length>0&&<><div style={{padding:"8px 14px 4px",borderTop:"1px solid #1F2937",background:"#0A1020"}}><span style={{fontSize:9,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>Positions</span></div><Header/>
                      {sortP(liveByRole).map(({key,s})=><TRow key={key} label={key} s={s}/>)}
                    </>}
                    {/* MAPS */}
                    {liveByMapArr.length>0&&<><div style={{padding:"8px 14px 4px",borderTop:"1px solid #1F2937",background:"#0A1020"}}><span style={{fontSize:9,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>Maps</span></div><Header/>
                      {liveByMapArr.map(({key,s})=><TRow key={key} label={key} s={s}/>)}
                    </>}
                    {/* LIGNES KILLS */}
                    {sortP(liveByKill).length>0&&<><div style={{padding:"8px 14px 4px",borderTop:"1px solid #1F2937",background:"#0A1020"}}><span style={{fontSize:9,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase"}}>Lignes Kills</span></div><Header/>
                      {sortP(liveByKill).map(({key,s})=><TRow key={key} label={key} s={s}/>)}
                    </>}
                  </div>
                )}


                {/* Top 5 pertes position+kills - LoL uniquement */}
                {isEuro&&top5Losses.length>0&&(
                  <div style={{marginBottom:12,borderRadius:12,overflow:"hidden",border:"1px solid rgba(239,68,68,0.2)"}}><div style={{fontSize:9,color:"#EF4444",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"9px 12px",background:"rgba(239,68,68,0.06)",borderBottom:"1px solid rgba(239,68,68,0.15)"}}> Top 5 pertes - Position · Ligne</div><Header/>
                    {top5Losses.map((r,i)=>(
                      <div key={r.key} style={{display:"flex",alignItems:"center",padding:"9px 12px",borderBottom:"1px solid #1A2235",background:i===0?"rgba(239,68,68,0.04)":"transparent"}}><div style={{flex:1,minWidth:0}}><div style={{fontSize:12,fontWeight:600,color:"#E5E7EB"}}>{r.key}</div></div><span style={{fontSize:11,color:"#6B7280",minWidth:36,textAlign:"right"}}>{r.n}p</span><span style={{fontSize:12,fontWeight:700,color:wrc(r.wr),minWidth:44,textAlign:"right"}}>{r.wr.toFixed(0)}%</span><span style={{fontSize:13,fontWeight:800,color:"#EF4444",minWidth:66,textAlign:"right"}}>{(r.profit||0).toFixed(0)}$</span></div>
                    ))}
                  </div>
                )}

                {/* Positions par ligne kills */}
                {filterType==="kill"&&killRoleArr.length>0&&(
                  <div style={{marginBottom:12,borderRadius:12,overflow:"hidden",border:"1px solid #1A2235"}}><div style={{fontSize:9,color:"#818CF8",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"9px 12px",background:"#0D1626",borderBottom:"1px solid #1A2235"}}>Positions</div><Header/>
                    {killRoleArr.map(({key,s})=>(
                      <div key={key} style={{display:"flex",alignItems:"center",padding:"9px 12px",borderBottom:"1px solid #1A2235"}}><div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:"#E5E7EB"}}>{key}</div></div><span style={{fontSize:11,color:"#6B7280",minWidth:36,textAlign:"right"}}>{s.n}p</span><span style={{fontSize:12,fontWeight:700,color:wrc(s.wr),minWidth:44,textAlign:"right"}}>{s.wr.toFixed(0)}%</span><span style={{fontSize:13,fontWeight:800,color:pc(s.profit),minWidth:66,textAlign:"right"}}>{s.profit>=0?"+":""}{(s.profit||0).toFixed(0)}$</span></div>
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
                    <div style={{marginBottom:12,borderRadius:12,overflow:"hidden",border:"1px solid #1A2235"}}><div style={{fontSize:9,color:"#9CA3AF",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"9px 12px",background:"#0D1626",borderBottom:"1px solid #1A2235"}}>Période</div><div style={{display:"flex",gap:6,padding:"10px 12px",borderBottom:"1px solid #1A2235",background:"#0A1020"}}>
                        {PERIODS.map(({d,l})=>(
                          <button key={d} onClick={()=>setDrillPeriod(drillPeriod===d?null:d)}
                            style={{flex:1,padding:"7px 0",borderRadius:8,border:"1.5px solid "+(drillPeriod===d?"#60A5FA":"#1A2235"),background:drillPeriod===d?"rgba(96,165,250,0.12)":"rgba(255,255,255,0.02)",color:drillPeriod===d?"#60A5FA":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all .15s"}}>
                            {l}
                          </button>
                        ))}
                      </div>
                      {ps?(
                        <div><div style={{display:"flex",justifyContent:"space-around",padding:"14px 12px",borderBottom:"1px solid #1A2235"}}>
                            {[{l:"Paris",v:ps.n,c:"#E5E7EB"},{l:"WR",v:ps.wr.toFixed(0)+"%",c:ps.wr>=55?"#00E676":ps.wr<45?"#EF4444":"#9CA3AF"},{l:"ROI",v:(ps.roi>=0?"+":"")+ps.roi.toFixed(1)+"%",c:ps.roi>=0?"#00E676":"#EF4444"},{l:"Profit",v:(ps.profit>=0?"+":"")+p(s.profit||0).toFixed(0)+"$",c:ps.profit>=0?"#00E676":"#EF4444"}].map(x=>(
                              <div key={x.l} style={{textAlign:"center"}}><div style={{fontSize:9,color:"#6B7280",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:3}}>{x.l}</div><div style={{fontSize:16,fontWeight:800,color:x.c}}>{x.v}</div></div>
                            ))}
                          </div><Header/>
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
                            return(<><TRow label="🔼 Over" s={toS2(over)}/><TRow label="🔽 Under" s={toS2(under)}/><TRow label="🔴 Live" s={toS2(live)}/><TRow label="Non-live" s={toS2(nonLive)}/>
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

              {/* ── PP KILLS ANALYSIS ── */}
              {filterType==="kill"&&(()=>{
                // killVal2 = numeric value for display (e.g. 17.5)
                const killVal2=parseFloat(filterValue.replace(" Points","").replace(" 3 Pts",""));
                if(isNaN(killVal2))return null;
                const metric2=ppKillMetric;
                const METRICS2=[{k:"roi",label:"ROI"},{k:"profit",label:"Profit"},{k:"wr",label:"WR"},{k:"n",label:"Paris"}];
                // Collect PP bets for this game + kill value
                const ppBets2=settled.filter(b=>
                  b.ppMapType==="H1+H2"&&
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
                  if(!d||d.cnt===0)return{txt:"-",color:"#3a4a5e"};
                  const wr=Math.round(d.won*100/d.cnt);
                  const roi=d.staked>0?Math.round(d.profit*1000/d.staked)/10:0;
                  if(m==="roi")return{txt:(roi>=0?"+":"")+roi.toFixed(1)+"%",color:roi>=0?"#00E676":"#f87171"};
                  if(m==="profit")return{txt:(d.profit>=0?"+":"")+d.profit.toFixed(0)+"$",color:d.profit>=0?"#00E676":"#f87171"};
                  if(m==="wr")return{txt:wr+"%",color:wr>=55?"#00E676":wr<45?"#f87171":"#9CA3AF"};
                  if(m==="n")return{txt:String(d.cnt),color:"#7a9cbd"};
                  return{txt:"-",color:"#3a4a5e"};
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
                      <div style={{marginBottom:10,borderRadius:12,overflow:"hidden",border:"1px solid rgba(139,92,246,.25)"}}><div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:"rgba(107,33,245,.1)",borderBottom:"1px solid rgba(139,92,246,.2)"}}><img src={PP_LOGO_B64} alt="PP" style={{width:16,height:16,borderRadius:3,objectFit:"cover",flexShrink:0}}/><span style={{fontSize:10,color:"#c4b5fd",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>OVER {killVal2.toFixed(1)} - Lignes PP jouées</span></div><div style={{display:"grid",gridTemplateColumns:"70px 1fr 40px 80px",padding:"5px 12px",background:"#0A1020",borderBottom:"1px solid #1A2235"}}><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Ligne PP</span><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"center"}}>Paris</span><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"center"}}>WR</span><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"right"}}>{colLabel}</span></div>
                        {sortedLines(overByLine).map((ppLine,i)=>{
                          const key=ppLine.toFixed(1);
                          const d=overByLine[key];
                          const wr=d.cnt>0?Math.round(d.won*100/d.cnt):0;
                          const mv=mv2(d,metric2);
                          return(
                            <div key={key} style={{display:"grid",gridTemplateColumns:"70px 1fr 40px 80px",padding:"9px 12px",borderBottom:i<sortedLines(overByLine).length-1?"1px solid #111827":"none",alignItems:"center"}}><span style={{fontSize:14,fontWeight:800,color:"#c4b5fd"}}>{key}</span><span style={{fontSize:11,color:"#7a9cbd",textAlign:"center"}}>{d.cnt}</span><span style={{fontSize:11,fontWeight:600,color:wr>=55?"#00E676":wr<45?"#f87171":"#9CA3AF",textAlign:"center"}}>{wr}%</span><span style={{fontSize:12,fontWeight:800,color:mv.color,textAlign:"right"}}>{mv.txt}</span></div>
                          );
                        })}
                      </div>
                    )}
                    {/* UNDER table */}
                    {hasUnder&&(
                      <div style={{marginBottom:10,borderRadius:12,overflow:"hidden",border:"1px solid rgba(139,92,246,.25)"}}><div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:"rgba(107,33,245,.1)",borderBottom:"1px solid rgba(139,92,246,.2)"}}><img src={PP_LOGO_B64} alt="PP" style={{width:16,height:16,borderRadius:3,objectFit:"cover",flexShrink:0}}/><span style={{fontSize:10,color:"#c4b5fd",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>UNDER {killVal2.toFixed(1)} - Lignes PP jouées</span></div><div style={{display:"grid",gridTemplateColumns:"70px 1fr 40px 80px",padding:"5px 12px",background:"#0A1020",borderBottom:"1px solid #1A2235"}}><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Ligne PP</span><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"center"}}>Paris</span><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"center"}}>WR</span><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"right"}}>{colLabel}</span></div>
                        {sortedLines(underByLine).map((ppLine,i)=>{
                          const key=ppLine.toFixed(1);
                          const d=underByLine[key];
                          const wr=d.cnt>0?Math.round(d.won*100/d.cnt):0;
                          const mv=mv2(d,metric2);
                          return(
                            <div key={key} style={{display:"grid",gridTemplateColumns:"70px 1fr 40px 80px",padding:"9px 12px",borderBottom:i<sortedLines(underByLine).length-1?"1px solid #111827":"none",alignItems:"center"}}><span style={{fontSize:14,fontWeight:800,color:"#c4b5fd"}}>{key}</span><span style={{fontSize:11,color:"#7a9cbd",textAlign:"center"}}>{d.cnt}</span><span style={{fontSize:11,fontWeight:600,color:wr>=55?"#00E676":wr<45?"#f87171":"#9CA3AF",textAlign:"center"}}>{wr}%</span><span style={{fontSize:12,fontWeight:800,color:mv.color,textAlign:"right"}}>{mv.txt}</span></div>
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

        {/* ── JOUEURS ── */}
        {view==="analyse"&&(()=>{
  const sports=[...new Set(analyseBets.map(b=>b.sport||"?"))].filter(Boolean);
  const sources=[...new Set(analyseBets.map(b=>b.source||"?"))].filter(Boolean);
  const filtered=analyseBets.filter(b=>{
    if(analyseFSport!=="all"&&b.sport!==analyseFSport)return false;
    if(analyseFSource!=="all"&&b.source!==analyseFSource)return false;
    if(analyseFDir!=="All"&&b.direction!==analyseFDir)return false;
    if(analyseFStat!=="all"&&(b.stat||"points")!==analyseFStat)return false;
    if(analyseFHeure){
      const t=b.match_time||b.start_time||null;
      if(!t)return false;
      return t>=analyseFHeure;
    }
    return true;
  }).sort((a,b)=>{
    if(analyseSort==="time"){
      const ta=a.match_time||a.start_time||"99:99";
      const tb=b.match_time||b.start_time||"99:99";
      return ta.localeCompare(tb);
    }
    if(analyseSort==="team"){
      const ta=(findPlayer(a.player)&&findPlayer(a.player).team)||"zzz";
      const tb=(findPlayer(b.player)&&findPlayer(b.player).team)||"zzz";
      return ta.localeCompare(tb)||a.player.localeCompare(b.player);
    }
    return (b.diff||0)-(a.diff||0);
  });
  const topDiff=filtered.length>0?Math.max(...filtered.map(b=>b.diff||0)):0;
  const avgOdds=filtered.length>0?(filtered.reduce((s,b)=>s+(b.odds||0),0)/filtered.length).toFixed(2):0;
  const sportColor=(sport)=>{
    if(sport&&sport.includes("CS")||sport==="CS2")return"#F0A500";
    if(sport&&sport.includes("Legend")||sport==="LoL")return"#C89B3C";
    if(sport&&sport.includes("Dota"))return"#C23C2A";
    if(sport&&sport.includes("Valor"))return"#FF4655";
    return"#9CA3AF";
  };
  const sportEmoji=(sport)=>{
    if(sport&&sport.includes("CS")||sport==="CS2")return"";
    if(sport&&sport.includes("Legend")||sport==="LoL")return"⚔️";
    if(sport&&sport.includes("Dota"))return"";
    if(sport&&sport.includes("Valor"))return"🔺";
    return"";
  };
  const bkShortName=(source)=>{
    if(source==="Betby")return"Roobet";
    if(source==="Thunderpick")return"Stake";
    return source||"?";
  };
  const diffColor=(diff)=>{
    const d=parseFloat(diff)||0;
    if(d>=2.0)return"#00E676";
    if(d>=1.75)return"#00E676";
    if(d>=1.5)return"#16A34A";
    return"#15803D";
  };
  const diffBg=(diff)=>{
    const d=parseFloat(diff)||0;
    if(d>=2.0)return"rgba(74,222,128,0.15)";
    if(d>=1.75)return"rgba(34,197,94,0.12)";
    if(d>=1.5)return"rgba(22,163,74,0.10)";
    return"rgba(21,128,61,0.08)";
  };
  const mapLabel=(map)=>(!map||map==="?")?"?":"Map "+map;
  return(
    <div className="view-enter">
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div><div style={{fontSize:15,fontWeight:700,color:"#E5E7EB",letterSpacing:.3}}>Positive EV Bets</div><div style={{fontSize:10,color:"#6B7280",marginTop:2}}>
            {analyseLastFetch?"Mis à jour: "+analyseLastFetch.toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit"}):"Pas encore chargé"}
          </div></div><div style={{display:"flex",gap:6,alignItems:"center"}}>
          {hiddenAnalyseBets.size>0&&(
            <button onClick={()=>setShowHiddenAnalyse(v=>!v)}
              style={{padding:"6px 10px",background:showHiddenAnalyse?"rgba(239,68,68,0.12)":"rgba(255,255,255,0.04)",border:"1px solid "+(showHiddenAnalyse?"rgba(239,68,68,0.3)":"#1F2937"),borderRadius:7,color:showHiddenAnalyse?"#EF4444":"#6B7280",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
              {showHiddenAnalyse?"Masquer pris":"Pris ("+hiddenAnalyseBets.size+")"}
            </button>
          )}
          <button onClick={fetchAnalyse}
            style={{display:"flex",alignItems:"center",gap:5,padding:"7px 12px",background:"#1F2937",border:"1px solid #374151",borderRadius:7,color:"#E5E7EB",fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            {analyseLoading?"":"↻"} Actualiser
          </button></div></div>

      {/* Filtres */}
      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10,alignItems:"center"}}><select value={analyseFSport} onChange={e=>setAnalyseFSport(e.target.value)}
          style={{background:"#111827",border:"1px solid #1F2937",borderRadius:6,padding:"5px 8px",color:"#E5E7EB",fontSize:11,fontFamily:"'Inter',sans-serif",outline:"none",cursor:"pointer"}}><option value="all">Tous sports</option>
          {sports.map(s=><option key={s} value={s}>{s}</option>)}
        </select><select value={analyseFSource} onChange={e=>setAnalyseFSource(e.target.value)}
          style={{background:"#111827",border:"1px solid #1F2937",borderRadius:6,padding:"5px 8px",color:"#E5E7EB",fontSize:11,fontFamily:"'Inter',sans-serif",outline:"none",cursor:"pointer"}}><option value="all">Toutes sources</option>
          {sources.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        {["All","OVER","UNDER"].map(d=>(
          <button key={d} onClick={()=>setAnalyseFDir(d)}
            style={{padding:"5px 10px",borderRadius:6,border:"1px solid "+(analyseFDir===d?"#7C3AED":"#1F2937"),background:analyseFDir===d?"rgba(124,58,237,0.15)":"transparent",color:analyseFDir===d?"#A78BFA":"#6B7280",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            {d==="All"?"Tous":d}
          </button>
        ))}
        <button onClick={()=>setAnalyseFStat(analyseFStat==="headshots"?"all":"headshots")}
          style={{padding:"5px 10px",borderRadius:6,border:"1px solid "+(analyseFStat==="headshots"?"#EF4444":"#1F2937"),background:analyseFStat==="headshots"?"rgba(239,68,68,0.12)":"transparent",color:analyseFStat==="headshots"?"#EF4444":"#6B7280",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
          {analyseFStat==="headshots"?"✕ HS":"- HS"}
        </button><div style={{display:"flex",gap:3,marginLeft:"auto",alignItems:"center"}}><input type="time" value={analyseFHeure} onChange={e=>setAnalyseFHeure(e.target.value)}
            title="Filtrer par heure de début"
            style={{background:"#111827",border:"1px solid "+(analyseFHeure?"#F59E0B":"#1F2937"),borderRadius:6,padding:"4px 7px",color:analyseFHeure?"#F59E0B":"#6B7280",fontSize:11,fontFamily:"'Inter',sans-serif",outline:"none",cursor:"pointer",width:82}}/>
          {analyseFHeure&&<button onClick={()=>setAnalyseFHeure("")} style={{background:"transparent",border:"none",color:"#6B7280",fontSize:12,cursor:"pointer",padding:"0 2px"}}>✕</button>}
          {[{v:"diff",l:"↓ Diff"},{v:"time",l:"🕐 Heure"},{v:"team",l:"Équipe"}].map(({v,l})=>(
            <button key={v} onClick={()=>setAnalyseSort(v)}
              style={{padding:"5px 10px",borderRadius:6,border:"1px solid "+(analyseSort===v?"#F59E0B":"#1F2937"),background:analyseSort===v?"rgba(245,158,11,0.1)":"transparent",color:analyseSort===v?"#F59E0B":"#6B7280",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
              {l}
            </button>
          ))}
        </div></div>

      {/* Stats bar */}
      {filtered.length>0&&(
        <div style={{display:"flex",gap:8,marginBottom:10,padding:"8px 12px",background:"#0B1220",borderRadius:8,border:"1px solid #1F2937"}}>
          {[{l:"Bets",v:filtered.length,c:"#A78BFA"},{l:"Max Diff",v:"+"+topDiff.toFixed(2),c:"#00E676"},{l:"Cote moy",v:"@"+avgOdds,c:"#F59E0B"}].map(k=>(
            <div key={k.l} style={{display:"flex",gap:5,alignItems:"center"}}><span style={{fontSize:10,color:"#6B7280"}}>{k.l}:</span><span style={{fontSize:12,fontWeight:700,color:k.c}}>{k.v}</span></div>
          ))}
        </div>
      )}

      {!analyseLoading&&analyseBets.length===0&&(
        <div style={{textAlign:"center",padding:"40px 20px",color:"#4B5563"}}><div style={{fontSize:32,marginBottom:12,display:"flex",justifyContent:"center"}}><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7"/><line x1="15.5" y1="15.5" x2="21" y2="21"/><line x1="7" y1="10" x2="13" y2="10"/><line x1="10" y1="7" x2="10" y2="13"/></svg></div><div style={{fontSize:14,fontWeight:600,color:"#6B7280",marginBottom:6}}>Aucun bet comparé</div><div style={{fontSize:12,color:"#4B5563",marginBottom:16}}>Lance le pipeline pour analyser les props</div><button onClick={fetchAnalyse} style={{padding:"10px 20px",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            Charger les données
          </button></div>
      )}


      {/* Tableau OddsJam style */}
      {filtered.length>0&&(
        <div style={{background:"#0B1220",borderRadius:10,border:"1px solid #1F2937",overflow:"hidden"}}>
          {/* Header colonnes */}
          <div style={{display:"grid",gridTemplateColumns:"20px 1fr 110px 70px 60px 60px 60px 55px",gap:0,padding:"7px 12px",borderBottom:"1px solid #1F2937",background:"#060D18"}}>
            {["","ÉVÉNEMENT","JOUEUR","DIR","BOOK","PP","DIFF","COTE"].map((h,i)=>(
              <div key={i} style={{fontSize:9,color:"#4B5563",fontWeight:700,letterSpacing:.8,textAlign:i>=4?"center":"left"}}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          {filtered.filter(b=>{
            const key=`${b.player||""}|${b.map||""}|${b.direction||""}|${b.source||""}`;
            return showHiddenAnalyse||!hiddenAnalyseBets.has(key);
          }).map((b,i)=>{
            const isOver=b.direction==="OVER";
            const sc=sportColor(b.sport);
            const gameKey=b.sport&&sport.includes("CS")?"CS2":b.sport&&sport.includes("Legend")?"LoL":b.sport&&sport.includes("Dota")?"Dota2":b.sport&&sport.includes("Valor")?"Valorant":null;
            const bkName=bkShortName(b.source);
            const matchTime=b.match_time||b.start_time||null;
            const betKey=`${b.player||""}|${b.map||""}|${b.direction||""}|${b.source||""}`;
            const isHidden=hiddenAnalyseBets.has(betKey);
            const isExpanded=expandedAnalyseBet===betKey;
            const d=parseFloat(b.diff||0);
            return(
              <div key={i}>
                {/* Row principale cliquable */}
                <div onClick={()=>setExpandedAnalyseBet(isExpanded?null:betKey)}
                  style={{display:"grid",gridTemplateColumns:"20px 1fr 110px 70px 60px 60px 60px 55px",gap:0,padding:"9px 12px",borderBottom:isExpanded?"none":"1px solid #0F172A",background:isHidden?"rgba(239,68,68,0.05)":isExpanded?"#131E30":i%2===0?"#0B1220":"#0D1526",alignItems:"center",opacity:isHidden?0.5:1,cursor:"pointer"}}>
                  {/* Logo jeu */}
                  <div>
                    {gameKey&&L[gameKey]
                      ? <img src={L[gameKey]} style={{width:16,height:16,borderRadius:3}} alt={gameKey}/>
                      : <span style={{fontSize:12}}>{sportEmoji(b.sport)}</span>
                    }
                  </div>
                  {/* Événement */}
                  <div style={{minWidth:0,paddingRight:8}}><div style={{fontSize:11,fontWeight:600,color:"#E5E7EB",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.match||"?"}</div></div>
                  {/* Nom joueur + équipe + kills/map + logo bookmaker */}
                  <div style={{minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:4,flexWrap:"nowrap",minWidth:0}}><span style={{fontSize:12,fontWeight:700,color:"#E5E7EB",textTransform:"capitalize",flexShrink:0}}>{b.player||"?"}</span>
                      {(()=>{const pi=findPlayer(b.player);const tm=(pi&&pi.team)||(pi&&pi.team_name);if(!tm)return null;return(<><span style={{color:"#3a4e62",fontSize:10,margin:"0 3px",flexShrink:0}}>-</span><span style={{fontSize:11,fontWeight:700,color:"#ffffff",whiteSpace:"nowrap",flexShrink:0}}>{tm}</span></>);})()}
                    </div><div style={{display:"flex",gap:3,alignItems:"center",marginTop:1}}><span style={{fontSize:10,color:"#A78BFA",fontWeight:600}}>{b.stat==="kills"?"Points":b.stat==="headshots"?"HS":b.stat||"kills"}</span><span style={{fontSize:9,color:"#6B7280"}}>·</span><span style={{fontSize:10,color:"#F59E0B",fontWeight:600}}>Map {b.map||"?"}</span><span style={{fontSize:9,color:"#6B7280"}}>·</span>
                      {BK_LOGOS[bkName]
                        ? <img src={BK_LOGOS[bkName]} style={{width:12,height:12,borderRadius:2,flexShrink:0}} alt={bkName}/>
                        : <span style={{fontSize:9,color:"#60A5FA",fontWeight:700}}>{bkName}</span>
                      }
                    </div></div>
                  {/* Marché - direction */}
                  <div style={{textAlign:"center"}}><span style={{fontSize:11,fontWeight:700,color:isOver?"#00E676":"#EF4444"}}>{isOver?"▲ OVER":"▼ UNDER"}</span></div>
                  {/* Book line */}
                  <div style={{textAlign:"center"}}><div style={{fontSize:12,fontWeight:700,color:"#E5E7EB"}}>{b.book_line||"?"}</div><div style={{fontSize:9,color:"#6B7280"}}>book</div></div>
                  {/* PP line */}
                  <div style={{textAlign:"center"}}><div style={{fontSize:12,fontWeight:700,color:"#E5E7EB"}}>{b.pp_line_original||b.pp_line_per_map||"?"}</div><div style={{fontSize:9,color:"#6B7280"}}>PP</div></div>
                  {/* Diff */}
                  <div style={{textAlign:"center"}}><div style={{fontSize:13,fontWeight:800,color:diffColor(b.diff),background:diffBg(b.diff),borderRadius:5,padding:"2px 4px"}}>+{d.toFixed(2)}</div></div>
                  {/* Cote */}
                  <div style={{textAlign:"center"}}><div style={{fontSize:12,fontWeight:700,color:"#A78BFA"}}>@{b.odds||"?"}</div></div></div>
                {/* Panel expanded - heure + boutons */}
                {isExpanded&&(
                  <div style={{background:"#131E30",borderBottom:"1px solid #0F172A",padding:"8px 12px 10px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}><span style={{fontSize:10,color:"#60A5FA",fontWeight:600,flexShrink:0}}>
                      {matchTime?"🕐 "+matchTime:"Heure non disponible"}
                    </span><div style={{display:"flex",gap:6,alignItems:"center"}}><button onClick={e=>{
                        e.stopPropagation();
                        const bkMap={"Betby":"Betby","Thunderpick":"Thunderpick","betby":"Betby","thunderpick":"Thunderpick"};
                        const bk=bkMap[b.source]||b.source||"";
                        const statLabel=b.stat==="headshots"?"HS":"Points";
                        const desc=b.book_line!=null?String(b.book_line)+" "+statLabel:"";
                        const mapTag=b.map!=null?"Map "+b.map:"Map 1";
                        const ou=b.direction==="OVER"?"Over":"Under";
                        const gk=b.sport&&sport.includes("CS")?"CS2":b.sport&&sport.includes("Legend")?"LoL":b.sport&&sport.includes("Dota")?"Dota2":b.sport&&sport.includes("Valor")?"Valorant":null;
                        const autoInfo=gk?findPlayer(b.player)||{game:gk,league:"?",role:"?",team:b.team||"?"}:null;
                        setForm({...EMPTY_FORM(),datetime:nowDT(),player:b.player||"",overUnder:ou,description:desc,odds:String(b.odds||""),stake:"",bookmaker:bk,mapTag:mapTag,isLive:false,mapLocked:false,autoInfo:autoInfo});
                        setEditingBet(null);
                        setExpandedAnalyseBet(null);
                        setView("add");
                      }}
                        style={{padding:"5px 14px",background:"rgba(124,58,237,0.15)",border:"1px solid rgba(124,58,237,0.4)",borderRadius:7,color:"#A78BFA",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap"}}>
                        + Ajouter
                      </button><button onClick={e=>{e.stopPropagation();toggleHideAnalyseBet(betKey);setExpandedAnalyseBet(null);}}
                        style={{padding:"5px 14px",background:isHidden?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)",border:"1px solid "+(isHidden?"rgba(34,197,94,0.3)":"rgba(239,68,68,0.3)"),borderRadius:7,color:isHidden?"#00E676":"#EF4444",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap"}}>
                        {isHidden?"✓ Réafficher":"✓ Pris"}
                      </button></div></div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length>0&&(
        <div style={{textAlign:"center",padding:"12px 0",fontSize:10,color:"#4B5563"}}>
          {filtered.length} bet{filtered.length>1?"s":""} · {analyseLastFetch?analyseLastFetch.toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit"}):"?"}
        </div>
      )}
    </div>
  );
  })()}
        {view==="players"&&(
          <div className="view-enter">
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",marginBottom:16}}>
              <div>
                <div style={{fontSize:18,fontWeight:800,color:"#E5E7EB",letterSpacing:-0.3}}>Suivi</div>
                <div style={{display:"flex",gap:10,marginTop:3}}>
                  <span style={{fontSize:11,color:"#6B7280"}}>{Object.keys(allPlayers).length} joueurs</span>
                  {customCount>0&&<span style={{fontSize:11,color:"#A78BFA",fontWeight:600}}>✎ {customCount} modifiés</span>}
                </div>
              </div>
            </div>

            {/* ── AJOUTER JOUEUR ── */}
            <AddPlayerForm setPlayers={setPlayers} showToast={showToast}/>

            {/* ── ÉDIT ── */}
            <LeagueEditor allPlayers={allPlayers} setPlayers={setPlayers} showToast={showToast}/>

            {/* ── TIPSERS ── */}
            {(()=>{
              const allTipstersInBets=[...new Set(bets.map(b=>b.tipster).filter(Boolean))];
              // Fusionner: savedTipsters + ceux dans les paris (sans doublons)
              const allTipsters=[...new Set([...savedTipsters,...allTipstersInBets])].sort();
              return(
                <div style={{marginBottom:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:700,color:"#a78bfa",marginBottom:8,letterSpacing:.5}}><TipsterIcon size={14} color="#a78bfa"/> Tipsers</div>

                  {/* Modal photo tipster */}
                  {editingTipsterPhoto&&(
                    <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setEditingTipsterPhoto(null)}>
                      <div style={{width:"100%",maxWidth:340,background:"#0d1225",borderRadius:18,border:"1px solid rgba(255,255,255,.12)",padding:"18px 18px 20px"}} onClick={e=>e.stopPropagation()}>
                        <div style={{fontSize:14,fontWeight:700,color:"#a78bfa",marginBottom:14}}>Photo — {editingTipsterPhoto.name}</div>
                        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:12}}>
                          {editingTipsterPhoto.url?(
                            <img src={editingTipsterPhoto.url} alt="" style={{width:40,height:40,borderRadius:10,objectFit:"cover",objectPosition:"50% 15%",flexShrink:0,border:"1px solid rgba(167,139,250,.3)"}} onError={e=>e.target.style.display="none"}/>
                          ):(
                            <div style={{width:40,height:40,borderRadius:10,background:"rgba(167,139,250,.08)",border:"1px solid rgba(167,139,250,.15)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}><TipsterIcon size={18} color="#a78bfa"/></div>
                          )}
                          <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
                            <label style={{display:"flex",alignItems:"center",gap:6,background:"rgba(124,58,237,.1)",border:"1px solid rgba(124,58,237,.25)",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                              <span style={{fontSize:12,color:"#a78bfa",fontWeight:600}}>⬆ Uploader</span>
                              <input type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                                const file=e.target.files[0];
                                if(!file)return;
                                try{
                                  const fn=await supaUploadAvatar(file,"tipster_"+editingTipsterPhoto.name);
                                  const url=AVATARS_BUCKET+encodeURIComponent(fn);
                                  setEditingTipsterPhoto(t=>({...t,url}));
                                }catch(err){alert("Erreur: "+err.message);}
                              }}/>
                            </label>
                            <input autoFocus placeholder="ou colle une URL..." value={editingTipsterPhoto.url||""}
                              onChange={e=>setEditingTipsterPhoto(t=>({...t,url:e.target.value}))}
                              style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,padding:"9px 12px",color:"#E5E7EB",fontSize:12,fontFamily:"Inter,sans-serif",outline:"none"}}/>
                          </div>
                        </div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                          <button onClick={()=>setEditingTipsterPhoto(null)} style={{padding:"11px",background:"rgba(255,255,255,.05)",border:"none",borderRadius:10,color:"#9CA3AF",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Annuler</button>
                          <button onClick={()=>{
                            const url=(editingTipsterPhoto.url||"").trim();
                            const updated={...tipsterPhotos,[editingTipsterPhoto.name]:url||undefined};
                            if(!url) delete updated[editingTipsterPhoto.name];
                            setTipsterPhotos(updated);
                            try{localStorage.setItem("v7_tipster_photos",JSON.stringify(updated));}catch(e){}
                            showToast(editingTipsterPhoto.name+" photo mise à jour","#A78BFA");
                            setEditingTipsterPhoto(null);
                          }} style={{padding:"11px",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Enregistrer</button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:13,overflow:"hidden",marginBottom:6}}>
                    {allTipsters.length===0&&(
                      <div style={{padding:"14px",fontSize:11,color:"#4a5a6e",textAlign:"center"}}>Aucun tipster - crée-en un ci-dessous</div>
                    )}
                    {allTipsters.map((tip,i)=>{
                      const tipBets=bets.filter(b=>b.tipster===tip);
                      const settled=tipBets.filter(b=>b.status!=="pending");
                      const won=settled.filter(b=>b.status==="won").length;
                      const profit=settled.reduce((s,b)=>s+(b.profit||0),0);
                      const wr=settled.length>0?(won/settled.length*100):0;
                      const isSaved=savedTipsters.includes(tip);
                      const tipPhoto=tipsterPhotos[tip]||null;
                      return(
                        <div key={tip} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:i<allTipsters.length-1?"1px solid #1F2937":"none"}}>
                          {/* Avatar cliquable pour changer la photo */}
                          <button onClick={()=>setEditingTipsterPhoto({name:tip,url:tipPhoto||""})}
                            style={{width:34,height:34,borderRadius:10,background:"rgba(167,139,250,.08)",border:"1px solid rgba(167,139,250,.15)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",overflow:"hidden",padding:0}}>
                            {tipPhoto?(
                              <img src={tipPhoto} alt={tip} style={{width:34,height:34,objectFit:"cover",objectPosition:"50% 15%"}} onError={e=>e.target.style.display="none"}/>
                            ):(
                              <TipsterIcon size={17} color="#a78bfa"/>
                            )}
                          </button>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:13,color:"#a78bfa",display:"flex",alignItems:"center",gap:6}}>
                              {tip}
                              {settled.length===0&&isSaved&&<span style={{fontSize:9,color:"#4a5a6e",fontWeight:500,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.06)",borderRadius:4,padding:"1px 5px"}}>aucun pari</span>}
                            </div>
                            <div style={{fontSize:10,color:"#6B7280"}}>{settled.length>0?`${settled.length} paris · ${wr.toFixed(0)}% WR · ${profit>=0?"+":""}${profit.toFixed(0)}$`:"Pas encore de paris"}</div>
                          </div>
                          <button onClick={()=>{
                            const newName=prompt("Renommer le tipster "+tip+":",tip);
                            if(!newName||!newName.trim()||newName.trim()===tip)return;
                            const n=newName.trim();
                            // Renommer dans bets
                            setBets(prev=>prev.map(b=>b.tipster===tip?{...b,tipster:n,updatedAt:Date.now()}:b));
                            // Renommer dans savedTipsters
                            const updated=savedTipsters.map(t=>t===tip?n:t);
                            setSavedTipsters(updated);
                            try{localStorage.setItem("v7_saved_tipsers",JSON.stringify(updated));}catch(e){}
                            showToast(tip+" → "+n);
                          }} style={{width:30,height:30,background:"rgba(59,130,246,.08)",border:"1px solid rgba(59,130,246,.2)",borderRadius:7,color:"#3B82F6",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>✎</button>
                          <button onClick={()=>{
                            if(!window.confirm("Supprimer le tipster "+tip+" ?"))return;
                            // Retirer des paris
                            if(tipBets.length>0)setBets(prev=>prev.map(b=>b.tipster===tip?{...b,tipster:null,updatedAt:Date.now()}:b));
                            // Retirer de savedTipsters
                            const updated=savedTipsters.filter(t=>t!==tip);
                            setSavedTipsters(updated);
                            try{localStorage.setItem("v7_saved_tipsers",JSON.stringify(updated));}catch(e){}
                            showToast(tip+" supprimé","#EF4444");
                          }} style={{width:30,height:30,background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.18)",borderRadius:7,color:"#EF4444",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={()=>{
                    const name=prompt("Nom du tipster à créer:");
                    if(!name||!name.trim())return;
                    const n=name.trim();
                    if(savedTipsters.includes(n)){showToast(n+" existe déjà","#F59E0B");return;}
                    const updated=[...savedTipsters,n];
                    setSavedTipsters(updated);
                    try{localStorage.setItem("v7_saved_tipsers",JSON.stringify(updated));}catch(e){}
                    showToast("✓ "+n+" ajouté","#A78BFA");
                  }} style={{width:"100%",padding:"10px",background:"rgba(167,139,250,.08)",border:"1px dashed rgba(167,139,250,.3)",borderRadius:10,color:"#a78bfa",cursor:"pointer",fontSize:13,fontFamily:"Inter,sans-serif",fontWeight:600}}>
                    + Ajouter un tipster
                  </button>
                </div>
              );
            })()}

            {/* ── MISES SUGGÉRÉES & BANKROLL ── */}
            {(()=>{
              const defaultMises=[{pct:1,label:"Petite"},{pct:2,label:"Moyenne"},{pct:3,label:"Grosse"},{pct:5,label:"Max"},{pct:0.5,label:"Micro"},{pct:1.5,label:"Standard"}];
              return(
                <div style={{marginBottom:8,background:"#111827",border:"1px solid #1F2937",borderRadius:13,overflow:"hidden"}}>
                  <button onClick={()=>setEditMises(v=>!v)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
                    <span style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>💰 Mises & Bankroll</span>
                    <span style={{fontSize:11,color:"#6B7280"}}>{editMises?"▲":"▼"}</span>
                  </button>
                  {editMises&&(
                    <div style={{padding:"0 14px 14px",borderTop:"1px solid #1F2937"}}>
                      <div style={{marginBottom:10,paddingTop:10}}>
                        <div style={{fontSize:10,color:"#6B7280",marginBottom:6,fontWeight:600}}>Bankroll totale ($)</div>
                        <input type="number" value={bankroll} onChange={e=>setBankroll(parseFloat(e.target.value)||0)}
                          style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"8px 12px",color:"#E5E7EB",fontSize:14,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"}}/>
                      </div>
                      <div style={{fontSize:10,color:"#6B7280",marginBottom:8,fontWeight:600}}>6 cases de mise</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
                        {[0,1,2,3,4,5].map(i=>{
                          const pct=defaultMises[i]?defaultMises[i].pct:1;
                          const dollarVal=(bankroll*pct/100);
                          return(
                            <div key={i} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:9,padding:"8px 10px"}}>
                              <div style={{fontSize:9,color:"#6B7280",marginBottom:4}}>Case {i+1}</div>
                              <div style={{display:"flex",alignItems:"center",gap:4}}>
                                <input type="number" step="0.1" defaultValue={pct} style={{width:"40px",background:"transparent",border:"none",color:"#a78bfa",fontWeight:700,fontSize:12,fontFamily:"Inter,sans-serif",outline:"none"}}/>
                                <span style={{fontSize:10,color:"#6B7280"}}>%</span>
                              </div>
                              <div style={{fontSize:10,color:"#E5E7EB",fontWeight:600,marginTop:2}}>{dollarVal.toFixed(0)}$</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

                        {/* ── TOURNOIS ACTIFS ── */}
            <div style={{marginBottom:8}}><button onClick={()=>setSuiviOpen(s=>({...s,bookmakers:!s.bookmakers}))}
                style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#111827",border:"1px solid #1F2937",borderRadius:suiviOpen.bookmakers?"13px 13px 0 0":"13px",padding:"12px 16px",cursor:"pointer",marginBottom:0,transition:"border-radius .2s"}}><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>Bookmakers</span><span style={{background:"rgba(255,255,255,0.08)",color:"#9CA3AF",fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:8}}>{bookmakers.length}</span></div><span style={{color:"#6B7280",fontSize:12,transition:"transform .2s",display:"inline-block",transform:suiviOpen.bookmakers?"rotate(180deg)":"none"}}>▼</span></button>
              {suiviOpen.bookmakers&&<div style={{background:"#0D1117",border:"1px solid #1F2937",borderTop:"none",borderRadius:"0 0 13px 13px",overflow:"hidden",marginBottom:8}}><div style={{background:"#111827",borderRadius:0,overflow:"hidden"}}>
                {bookmakers.map((bk,idx)=>{
                  const logo=BK_LOGOS[bk]||bkPhotos[bk];
                  return(
                    <div key={bk} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:idx<bookmakers.length-1?"1px solid #1F2937":"none"}}>
                      <div onClick={()=>setEditingBK({name:bk,logoUrl:bkPhotos[bk]||""})} title="Modifier le logo" style={{width:34,height:34,borderRadius:9,flexShrink:0,background:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                        {(bkPhotos[bk])?(<img src={bkPhotos[bk]} alt={bk} style={{width:32,height:32,objectFit:"contain"}} onError={e=>e.target.style.display="none"}/>):(<span style={{fontSize:11,fontWeight:700,color:"#6B7280"}}>{bk.slice(0,2)}</span>)}
                      </div><div style={{flex:1,display:"flex",alignItems:"center",gap:7}}><span style={{fontWeight:600,fontSize:14,color:hiddenBKs.has(bk)?"#6B7280":"#E5E7EB"}}>{bk}</span>
                        {hiddenBKs.has(bk)&&<span style={{fontSize:9,fontWeight:700,color:"#6B7280",background:"rgba(107,114,128,0.12)",border:"1px solid rgba(107,114,128,0.2)",borderRadius:4,padding:"1px 5px",textTransform:"uppercase",letterSpacing:.5}}>masqué</span>}
                      </div><button title={hiddenBKs.has(bk)?"Afficher dans filtres":"Masquer des filtres"} onClick={()=>toggleHideBK(bk)} style={{width:32,height:32,background:hiddenBKs.has(bk)?"rgba(107,114,128,0.15)":"rgba(251,191,36,0.08)",border:"1px solid "+(hiddenBKs.has(bk)?"rgba(107,114,128,0.3)":"rgba(251,191,36,0.25)"),borderRadius:8,color:hiddenBKs.has(bk)?"#6B7280":"#FCD34D",cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {hiddenBKs.has(bk)?"🚫":"👁"}
                      </button><button onClick={()=>{
                        const newName=prompt("Nouveau nom pour "+bk+":",bk);
                        if(!newName||!newName.trim()||newName.trim()===bk)return;
                        setBookmakers(b=>b.map(x=>x===bk?newName.trim():x));
                        setBets(b=>b.map(bet=>bet.bookmaker===bk?{...bet,bookmaker:newName.trim(),updatedAt:Date.now()}:bet));
                        showToast(bk+" → "+newName.trim());
                      }} style={{width:32,height:32,background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:8,color:"#3B82F6",cursor:"pointer",fontSize:13,fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        ✎
                      </button><button onClick={()=>{
                        if(!window.confirm("Supprimer "+bk+" ?"))return;
                        setBookmakers(b=>b.filter(x=>x!==bk));
                        showToast(bk+" supprimé","#EF4444");
                      }} style={{width:32,height:32,background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.18)",borderRadius:8,color:"#EF4444",cursor:"pointer",fontSize:15,fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        ×
                      </button></div>
                  );
                })}
              </div></div>}
              <button onClick={()=>setModalBK(true)}
                style={{width:"100%",padding:"11px",background:"rgba(124,58,237,0.08)",border:"1px dashed rgba(124,58,237,0.3)",borderRadius:10,color:"#A78BFA",cursor:"pointer",fontSize:13,fontFamily:"'Inter',sans-serif",fontWeight:600}}>
                + Ajouter un bookmaker
              </button></div>

            {/* ── COUPES PERSONNALISÉES ── */}
            <div style={{marginBottom:8}}>
              <button onClick={()=>setSuiviOpen(s=>({...s,coupes:!s.coupes}))}
                style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#111827",border:"1px solid #1F2937",borderRadius:suiviOpen.coupes?"13px 13px 0 0":"13px",padding:"12px 16px",cursor:"pointer",marginBottom:0,transition:"border-radius .2s"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>🏆 Coupes</span>
                  <span style={{background:"rgba(255,255,255,0.08)",color:"#9CA3AF",fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:8}}>{customCups.length}</span>
                </div>
                <span style={{color:"#6B7280",fontSize:12,transition:"transform .2s",display:"inline-block",transform:suiviOpen.coupes?"rotate(180deg)":"none"}}>▼</span>
              </button>
              {suiviOpen.coupes&&(
                <div style={{background:"#0D1117",border:"1px solid #1F2937",borderTop:"none",borderRadius:"0 0 13px 13px",overflow:"hidden",marginBottom:8}}>
                  {customCups.length===0&&(
                    <div style={{textAlign:"center",color:"#4B5563",fontSize:12,padding:"16px"}}>Aucune coupe créée</div>
                  )}
                  {customCups.map((cup,idx)=>(
                    <div key={cup.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:idx<customCups.length-1?"1px solid #1F2937":"none"}}>
                      <div style={{width:34,height:34,borderRadius:9,flexShrink:0,background:"rgba(251,191,36,0.08)",border:"1px solid rgba(251,191,36,0.2)",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                        {cup.logo
                          ?<img src={cup.logo} alt={cup.name} style={{width:30,height:30,objectFit:"contain"}} onError={e=>e.target.style.display="none"}/>
                          :<span style={{fontSize:16}}>🏆</span>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:13,color:"#E5E7EB",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cup.name}</div>
                        <div style={{fontSize:10,color:"#6B7280"}}>{cup.clubs.length} club{cup.clubs.length!==1?"s":""}</div>
                      </div>
                      <button onClick={()=>{setCupForm({name:cup.name,logo:cup.logo,clubs:[...cup.clubs]});setModalCup(cup.id);}}
                        style={{width:32,height:32,background:"rgba(59,130,246,0.08)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:8,color:"#3B82F6",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>✎</button>
                      <button onClick={()=>{if(!window.confirm("Supprimer la coupe "+cup.name+" ?"))return;setCustomCups(p=>p.filter(c=>c.id!==cup.id));showToast(cup.name+" supprimée","#EF4444");}}
                        style={{width:32,height:32,background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.18)",borderRadius:8,color:"#EF4444",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={()=>{setCupForm({name:"",logo:"",clubs:[]});setModalCup("new");}}
                style={{width:"100%",padding:"11px",background:"rgba(251,191,36,0.06)",border:"1px dashed rgba(251,191,36,0.3)",borderRadius:10,color:"#FCD34D",cursor:"pointer",fontSize:13,fontFamily:"'Inter',sans-serif",fontWeight:600}}>
                + Créer une coupe
              </button>
            </div>

            <div style={{marginTop:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{display:"flex",alignItems:"center",gap:8}}><div><div style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>Corbeille</div><div style={{fontSize:10,color:"#6B7280"}}>{deletedBets.length} paris supprimés récemment</div></div></div><div style={{display:"flex",gap:6}}>
                  {deletedBets.length>0&&(
                    <button onClick={()=>setDeletedBets([])}
                      style={{fontSize:11,color:"#EF4444",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",borderRadius:7,padding:"5px 10px",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
                      Vider
                    </button>
                  )}
                  <button onClick={()=>setShowCorbeille(v=>!v)}
                    style={{fontSize:11,color:showCorbeille?"#A78BFA":"#9CA3AF",background:showCorbeille?"rgba(124,58,237,0.1)":"transparent",border:"1px solid "+(showCorbeille?"#7C3AED":"#1F2937"),borderRadius:7,padding:"5px 10px",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
                    {showCorbeille?"▲ Masquer":"▼ Voir"}
                  </button></div></div>
              {showCorbeille&&(
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {deletedBets.length===0&&(
                    <div style={{textAlign:"center",color:"#4B5563",fontSize:12,padding:"16px 0"}}>Aucun pari supprimé récemment</div>
                  )}
                  {deletedBets.map((b,i)=>(
                    <div key={b.id+"_"+i} style={{background:"#111827",border:"1px solid #1F2937",borderRadius:10,padding:"10px 13px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:6}}><GameLogo game={b.game} size={13}/><span style={{fontSize:13,fontWeight:700,color:"#9CA3AF",textTransform:"capitalize"}}>{b.player}</span><span style={{fontSize:11,color:"#6B7280"}}>- {b.description}</span></div><div style={{fontSize:10,color:"#4B5563",marginTop:2}}>@{b.odds} · {b.stake}$ · {b.bookmaker||"-"}</div><div style={{fontSize:9,color:"#374151",marginTop:1}}>Supprimé {b.deletedAt?new Date(b.deletedAt).toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit"}):""}</div></div><button onClick={()=>{
                        const restored={...b};delete restored.deletedAt;
                        setBets(prev=>[restored,...prev]);
                        setDeletedBets(prev=>prev.filter((_,idx)=>idx!==i));
                        showToast("Pari restauré ✓");
                      }} style={{padding:"6px 12px",background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:7,color:"#00E676",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>
                        ↩ Restaurer
                      </button></div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── MODAL COUPE ── */}
        {modalCup&&(()=>{
          const isNew=modalCup==="new";
          // Tous les clubs disponibles dans l'app
          const ALL_CLUBS=[
            ...Object.keys(TEAM_LOGOS),
            ...Object.keys(EL_TEAM_LOGOS),
            ...Object.keys(NBA_TEAM_LOGOS),
          ].filter((v,i,a)=>a.indexOf(v)===i).sort();

          const saveCup=()=>{
            if(!cupForm.name.trim()){showToast("Donne un nom à la coupe","#F59E0B");return;}
            if(isNew){
              const newCup={id:Date.now(),name:cupForm.name.trim(),logo:cupForm.logo.trim(),clubs:cupForm.clubs.filter(c=>c.name.trim())};
              setCustomCups(p=>[...p,newCup]);
              showToast("🏆 "+newCup.name+" créée","#FCD34D");
            } else {
              setCustomCups(p=>p.map(c=>c.id===modalCup?{...c,name:cupForm.name.trim(),logo:cupForm.logo.trim(),clubs:cupForm.clubs.filter(x=>x.name.trim())}:c));
              showToast("Coupe mise à jour","#FCD34D");
            }
            setModalCup(false);
          };
          const removeClub=i=>setCupForm(f=>({...f,clubs:f.clubs.filter((_,j)=>j!==i)}));
          const addClubByName=(name)=>{
            if(!name.trim())return;
            if(cupForm.clubs.some(c=>c.name.toLowerCase()===name.toLowerCase()))return;
            setCupForm(f=>({...f,clubs:[...f.clubs,{name:name.trim()}],_search:""}));
          };
          const search=(cupForm._search||"").toLowerCase();
          const suggestions=search.length>=1
            ?ALL_CLUBS.filter(c=>c.toLowerCase().includes(search)&&!cupForm.clubs.some(x=>x.name===c)).slice(0,6)
            :[];
          // Ligues qui ont des clubs matchant la recherche
          const matchLeagues=search.length>=1?Object.entries(ALL_LEAGUE_TEAMS)
            .filter(([,teams])=>teams.some(t=>t.toLowerCase().includes(search)))
            .map(([league,teams])=>({league,clubs:teams.filter(t=>t.toLowerCase().includes(search)&&!cupForm.clubs.some(x=>x.name===t))}))
            .filter(x=>x.clubs.length>0)
            :[];
          return(
            <div className="moverlay" onClick={()=>setModalCup(false)}>
              <div className="modal" onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                  <span style={{fontSize:20}}>🏆</span>
                  <div style={{fontSize:15,fontWeight:700}}>{isNew?"Créer une coupe":"Modifier la coupe"}</div>
                </div>
                <div style={{fontSize:11,color:"#6B7280",marginBottom:14}}>Exemple : Coupe d'Italie, Coupe de France…</div>

                {/* Nom */}
                <div style={{marginBottom:10}}>
                  <div style={{fontSize:11,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Nom de la coupe</div>
                  <input className="ifield" value={cupForm.name} onChange={e=>setCupForm(f=>({...f,name:e.target.value}))} placeholder="ex: Coupe d'Italie" style={{marginBottom:0}}/>
                </div>

                {/* Logo URL */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:11,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Logo (URL image)</div>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
                      <div style={{display:"flex",gap:6}}>
                        <label style={{display:"flex",alignItems:"center",gap:5,background:"rgba(124,58,237,.1)",border:"1px solid rgba(124,58,237,.25)",borderRadius:9,padding:"7px 10px",cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0}}>
                          <span style={{fontSize:11,color:"#a78bfa",fontWeight:600}}>⬆</span>
                          <input type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                            const file=e.target.files[0];if(!file)return;
                            try{const fn=await supaUploadAvatar(file,"cup_"+(cupForm.name||"coupe"));setCupForm(f=>({...f,logo:AVATARS_BUCKET+encodeURIComponent(fn)}));}
                            catch(err){alert("Erreur: "+err.message);}
                          }}/>
                        </label>
                        <button onClick={async()=>{try{const url=await pasteImageToSupabase("cup_"+(cupForm.name||"coupe"));setCupForm(f=>({...f,logo:url}));}catch(e){alert("📋 "+e.message);}}} style={{display:"flex",alignItems:"center",gap:5,background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.25)",borderRadius:9,padding:"7px 10px",cursor:"pointer",fontFamily:"Inter,sans-serif",flexShrink:0}}>
                          <span style={{fontSize:11,color:"#34d399",fontWeight:600}}>📋</span>
                        </button>
                        <input className="ifield" value={cupForm.logo} onChange={e=>setCupForm(f=>({...f,logo:e.target.value}))} placeholder="ou URL…" style={{marginBottom:0,flex:1,fontSize:11}}/>
                      </div>
                    </div>
                    {cupForm.logo&&<img src={cupForm.logo} alt="" style={{width:32,height:32,objectFit:"contain",borderRadius:6,border:"1px solid rgba(255,255,255,.1)",flexShrink:0}} onError={e=>e.target.style.opacity="0.2"}/>}
                  </div>
                </div>

                {/* Clubs — recherche intelligente */}
                <div style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <div style={{fontSize:11,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>Clubs participants</div>
                    <span style={{fontSize:10,color:"#6B7280"}}>{cupForm.clubs.length} club{cupForm.clubs.length!==1?"s":""}</span>
                  </div>

                  {/* Barre de recherche */}
                  <div style={{position:"relative",marginBottom:6}}>
                    <input
                      value={cupForm._search||""}
                      onChange={e=>setCupForm(f=>({...f,_search:e.target.value}))}
                      onKeyDown={e=>{
                        if(e.key==="Enter"&&suggestions.length>0){addClubByName(suggestions[0]);e.preventDefault();}
                        if(e.key==="Escape")setCupForm(f=>({...f,_search:""}));
                      }}
                      placeholder="Rechercher un club… ex: BOS, Olympia…"
                      style={{width:"100%",background:"rgba(255,255,255,.06)",border:"1px solid rgba(124,58,237,.3)",borderRadius:10,padding:"10px 14px",color:"#E5E7EB",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"}}
                    />
                    {search&&<button onClick={()=>setCupForm(f=>({...f,_search:""}))} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#6B7280",cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>}
                  </div>

                  {/* Suggestions groupées par ligue */}
                  {(matchLeagues.length>0||search.length>=2)&&(
                    <div style={{background:"rgba(8,14,28,.98)",border:"1px solid rgba(124,58,237,.25)",borderRadius:10,overflow:"hidden",marginBottom:8}}>
                      {matchLeagues.map(({league,clubs})=>(
                        <div key={league}>
                          <div style={{fontSize:9,color:"#6B7280",fontWeight:800,textTransform:"uppercase",letterSpacing:1,padding:"6px 12px 2px",background:"rgba(255,255,255,.02)"}}>{league}</div>
                          {clubs.slice(0,4).map(name=>{
                            const logo=TEAM_LOGOS[name]||EL_TEAM_LOGOS[name]||NBA_TEAM_LOGOS[name]||null;
                            return(
                              <button key={name} onClick={()=>addClubByName(name)}
                                style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,.03)",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
                                <div style={{width:24,height:24,borderRadius:5,background:"rgba(255,255,255,.05)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                  {logo?<img src={logo} alt="" style={{width:20,height:20,objectFit:"contain"}}/>:<span style={{fontSize:11}}>🏀</span>}
                                </div>
                                <span style={{fontSize:12,color:"#E5E7EB",fontWeight:600}}>{name}</span>
                                <span style={{fontSize:10,color:"#6B7280",marginLeft:"auto"}}>{league}</span>
                              </button>
                            );
                          })}
                        </div>
                      ))}
                      {/* Option : créer une nouvelle coupe avec ce nom */}
                      {search.length>=2&&(
                        <button onClick={()=>{
                          const newName=cupForm._search.trim();
                          setModalCup(false);
                          setTimeout(()=>{
                            setCupForm({name:newName,logo:"",clubs:[]});
                            setModalCup("new");
                          },50);
                        }} style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"rgba(251,191,36,.04)",border:"none",borderTop:"1px solid rgba(251,191,36,.1)",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
                          <span style={{fontSize:14}}>🏆</span>
                          <span style={{fontSize:12,color:"#FCD34D",fontWeight:600}}>Créer une coupe "{cupForm._search}"</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Liste des clubs ajoutés */}
                  {cupForm.clubs.length>0&&(
                    <div style={{maxHeight:180,overflowY:"auto",display:"flex",flexDirection:"column",gap:5}}>
                      {cupForm.clubs.filter(c=>c.name.trim()).map((club,i)=>{
                        const logo=TEAM_LOGOS[club.name]||EL_TEAM_LOGOS[club.name]||NBA_TEAM_LOGOS[club.name]||null;
                        return(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.07)",borderRadius:9}}>
                            <div style={{width:26,height:26,borderRadius:6,background:"rgba(255,255,255,.05)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                              {logo?<img src={logo} alt="" style={{width:22,height:22,objectFit:"contain"}}/>:<span style={{fontSize:12}}>🏀</span>}
                            </div>
                            <span style={{flex:1,fontSize:13,color:"#E5E7EB",fontWeight:500}}>{club.name}</span>
                            <button onClick={()=>removeClub(i)} style={{background:"none",border:"none",color:"#6B7280",cursor:"pointer",fontSize:16,lineHeight:1,padding:"0 2px"}}>×</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {cupForm.clubs.length===0&&!search&&(
                    <div style={{textAlign:"center",color:"#4B5563",fontSize:12,padding:"12px 0"}}>Recherche un club ci-dessus pour l'ajouter</div>
                  )}
                </div>

                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setModalCup(false)} style={{flex:1,padding:"11px",background:"#1F2937",border:"none",borderRadius:10,color:"#9CA3AF",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13}}>Annuler</button>
                  <button onClick={saveCup} style={{flex:2,padding:"11px",background:"linear-gradient(135deg,#F59E0B,#FCD34D)",border:"none",borderRadius:10,color:"#111827",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13}}>{isNew?"Créer la coupe":"Enregistrer"}</button>
                </div>
              </div>
            </div>
          );
        })()}

        {modalTourney&&(()=>{
          const game=modalTourney;
          const cfg=GAME_CFG[game]||{};
          return(
            <div className="moverlay" onClick={()=>setModalTourney(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}><GameLogo game={game} size={20}/><div style={{fontSize:15,fontWeight:700}}>Ajouter un tournoi - {game}</div></div><div style={{fontSize:11,color:"#6B7280",marginBottom:16}}>Le tournoi sera disponible dans le menu déroulant. Tu pourras l'activer quand tu veux.</div>

                {/* Champ nom */}
                <div style={{marginBottom:10}}><div style={{fontSize:11,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Nom du tournoi</div><input id={"tourney-name-"+game} className="ifield" placeholder="ex: PGL Astana 2026" style={{marginBottom:0}}/></div>

                {/* Date de fin optionnelle */}
                <div style={{marginBottom:16}}><div style={{fontSize:11,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Date de fin (optionnel)</div><input id={"tourney-end-"+game} className="ifield" type="date" style={{marginBottom:0}}/><div style={{fontSize:10,color:"#6B7280",marginTop:4}}>Si définie, le tournoi se retire automatiquement après cette date</div></div>

                {/* Liste des tournois existants pour ce jeu */}
                {(savedTourneys[game]||[]).length>0&&(
                  <div style={{marginBottom:16}}><div style={{fontSize:11,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Tournois enregistrés</div><div style={{background:"#0B1220",borderRadius:10,overflow:"hidden",border:"1px solid #1F2937"}}>
                      {(savedTourneys[game]||[]).map((s,i)=>(
                        <div key={s} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"9px 12px",borderBottom:i<(savedTourneys[game]||[]).length-1?"1px solid #1F2937":"none"}}><div style={{display:"flex",alignItems:"center",gap:8}}>
                            {activeTourneys[game]&&activeTourneys[game].name===s&&<span style={{width:6,height:6,borderRadius:"50%",background:"#00E676",boxShadow:"0 0 5px rgba(34,197,94,0.5)"}}/>}
                            <span style={{fontSize:12,color:activeTourneys[game]&&activeTourneys[game].name===s?"#00E676":"#E5E7EB",fontWeight:activeTourneys[game]&&activeTourneys[game].name===s?700:400}}>{s}</span></div><div style={{display:"flex",gap:6}}><button onClick={()=>{
                              setActiveTourneys(prev=>({...prev,[game]:{name:s,end:""}}));
                              setModalTourney(false);showToast(" "+s+" activé");
                            }} style={{padding:"3px 9px",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:6,color:"#00E676",cursor:"pointer",fontSize:10,fontFamily:"'Inter',sans-serif",fontWeight:600}}>
                              Activer
                            </button><button onClick={()=>setSavedTourneys(prev=>({...prev,[game]:(prev[game]||[]).filter(x=>x!==s)}))}
                              style={{padding:"3px 8px",background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:6,color:"#EF4444",cursor:"pointer",fontSize:10,fontFamily:"'Inter',sans-serif"}}>
                              ×
                            </button></div></div>
                      ))}
                    </div></div>
                )}

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button onClick={()=>setModalTourney(false)}
                    style={{padding:"11px",background:"#1F2937",border:"none",borderRadius:10,color:"#9CA3AF",fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                    Fermer
                  </button><button onClick={()=>{
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
                  </button></div></div></div>
          );
        })()}

        {/* ── BOTTOM NAV ── */}
        {(()=>{
          const pendingCount=bets.filter(b=>b.status==="pending").length;
          return(
            <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(9,14,28,.95)",borderTop:"1px solid rgba(255,255,255,.06)",display:"flex",justifyContent:"space-around",alignItems:"center",padding:"8px 4px 14px",zIndex:50,backdropFilter:"blur(20px)",boxShadow:"0 -4px 24px rgba(0,0,0,.4)"}}>
              {(()=>{
                const navItems=NAV.filter(n=>n.id!=="add");
                const mid=Math.floor(navItems.length/2);
                const pendingCount=bets.filter(b=>b.status==="pending").length;
                const items=[];
                navItems.forEach((n,idx)=>{
                  if(idx===mid){
                    items.push(<button key="add-fab" onClick={()=>{setView("add");setTimeout(()=>playerACRef.current&&playerACRef.current.focus(),80);}}
                      style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",boxShadow:"0 4px 16px rgba(124,58,237,0.45)",flexShrink:0,transform:view==="add"?"scale(0.93)":"scale(1)",transition:"transform .15s ease",marginBottom:4}}><span style={{fontSize:30,color:"#fff",lineHeight:1,marginTop:-1}}>+</span></button>);
                  }
                  const active=view===n.id;
                  items.push(<button key={n.id} className={"navitem "+(active?"on":"")} onClick={()=>setView(n.id)} style={{position:"relative"}}>
                    {n.id==="home"&&<NavIconHome active={active}/>}
                    {n.id==="mesparis"&&<NavIconParis active={active} count={pendingCount}/>}
                    {n.id==="statistiques"&&<NavIconAnalyse active={active}/>}
                    {n.id==="players"&&<NavIconSuivi active={active}/>}
                    <span className="lbl">{n.label}</span></button>);
                });
                return items;
              })()}
            </div>
          );
        })()}

        {/* ── CALENDRIER MODAL ── */}
        {showCal&&(
          <div className="moverlay" onClick={()=>{setShowCal(false);setCalSelected(null);}}><div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><button onClick={()=>{let m=calMonth-1,y=calYear;if(m<0){m=11;y--;}setCalMonth(m);setCalYear(y);setCalSelected(null);}} style={{background:"none",border:"1px solid #1F2937",borderRadius:7,padding:"6px 12px",color:"#94A3B8",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:14,fontWeight:700}}>Prev</button><div style={{textAlign:"center"}}><div style={{fontSize:15,fontWeight:700}}>{FR_MONTHS[calMonth]} {calYear}</div><div style={{fontSize:11,color:monthProfit>=0?"#00E676":"#EF4444",fontWeight:600}}>{monthProfit>=0?"+":""}{monthProfit.toFixed(2)}$</div></div><button onClick={()=>{let m=calMonth+1,y=calYear;if(m>11){m=0;y++;}setCalMonth(m);setCalYear(y);setCalSelected(null);}} style={{background:"none",border:"1px solid #1F2937",borderRadius:7,padding:"6px 12px",color:"#94A3B8",cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:14,fontWeight:700}}>Suiv</button></div>
              {/* Filtre jeu calendrier */}
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
                {ALL_GAMES.map(g=>(
                  <button key={g} onClick={()=>setCalGames(prev=>prev.includes(g)?prev.filter(x=>x!==g):[...prev,g])}
                    style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",borderRadius:8,border:"1.5px solid "+(calGames.includes(g)?"#7C3AED":"#1F2937"),background:calGames.includes(g)?"rgba(124,58,237,0.15)":"transparent",color:calGames.includes(g)?"#A78BFA":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}><GameLogo game={g} size={12}/>{g}
                  </button>
                ))}
                {calGames.length>0&&<button onClick={()=>setCalGames([])} style={{padding:"4px 8px",borderRadius:8,border:"1px solid rgba(239,68,68,0.2)",background:"rgba(239,68,68,0.06)",color:"#EF4444",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Tous</button>}
              </div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:2}}>
                {FR_DAYS.map(d=><div key={d} style={{textAlign:"center",fontSize:9,color:"#9CA3AF",fontWeight:600,padding:"3px 0",textTransform:"uppercase"}}>{d}</div>)}
              </div><div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:14}}>
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
                      <div key={dk} className={"cal-cell"+(isToday?" today":"")+(isSel?" selected":"")} onClick={()=>setCalSelected(isSel?null:dk)}><div style={{fontSize:16,fontWeight:isToday?800:600,color:isToday?"#00E676":(hasSettled||pending)?"#E5E7EB":"#6B7280"}}>{d}</div>
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
                  <div><div style={{fontSize:12,color:"#9CA3AF",marginBottom:8}}>
                      {calSelected.split("-").reverse().join("/")} - {selectedDayBets.length} pari{selectedDayBets.length!==1?"s":""}
                      {dp!==undefined&&<span style={{marginLeft:8,fontWeight:700,color:dp>=0?"#00E676":"#EF4444"}}>{dp>=0?"+":""}{dp.toFixed(2)}$</span>}
                    </div><div className="stat-bloc">
                      {selectedDayBets.map(b=>(
                        <div key={b.id} style={{padding:"10px 12px",borderBottom:"1px solid #1F2937",display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:8}}><GameLogo game={b.game} size={16}/><div><div style={{fontWeight:600,fontSize:13,textTransform:"capitalize"}}>{b.player}</div><div style={{fontSize:10,color:"#9CA3AF"}}>{b.description}</div></div></div><div style={{textAlign:"right"}}><div style={{fontWeight:700,fontSize:13,color:b.status==="won"?"#00E676":b.status==="lost"?"#EF4444":"#3B82F6"}}>
                              {b.status==="pending"?"@"+b.odds:(b.profit>=0?"+":"")+(b.profit||0).toFixed(2)+"$"}
                            </div><div style={{fontSize:10,color:STATUS_CFG[b.status]?STATUS_CFG[b.status].color:"#9CA3AF"}}>{STATUS_CFG[b.status]?STATUS_CFG[b.status].label:b.status}</div></div></div>
                      ))}
                    </div></div>
                );
              })()}
              <button onClick={()=>{setShowCal(false);setCalSelected(null);}} style={{width:"100%",marginTop:14,padding:"12px",background:"#1F2937",border:"none",borderRadius:10,color:"#94A3B8",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:14}}>Fermer</button></div></div>
        )}

        {/* ── BULK MODAL ── */}
        {bulkModal&&(
          <div className="moverlay" onClick={()=>{setBulkModal(false);setBulkDatetime("");}}><div className="modal" onClick={e=>e.stopPropagation()}><div style={{fontSize:15,fontWeight:700,marginBottom:14}}>Modifier {store.count} paris</div><div style={{marginBottom:14}}><div style={{fontSize:12,color:"#9CA3AF",marginBottom:8}}>Statut</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7}}>
                  {["won","lost","pending"].map(s=>(
                    <button key={s} onClick={()=>applyBulkStatus(s)}
                      style={{padding:"11px 8px",borderRadius:9,border:"1.5px solid "+(STATUS_CFG[s]?STATUS_CFG[s].color+"44":"#1F2937"),background:STATUS_CFG[s]?STATUS_CFG[s].bg:"#111827",color:STATUS_CFG[s]?STATUS_CFG[s].color:"#E5E7EB",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                      {STATUS_CFG[s]?STATUS_CFG[s].label:s}
                    </button>
                  ))}
                </div></div><div style={{marginBottom:14}}><div style={{fontSize:12,color:"#9CA3AF",marginBottom:8}}>Bookmaker</div><div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:8}}>
                  {bookmakers.map(bk=>(
                    <button key={bk} className={"bkchip"+(bulkBK===bk?" on":"")} onClick={()=>setBulkBK(bk===bulkBK?"":bk)}
                      style={{border:"2px solid "+(bulkBK===bk?"#00E676":"#1F2937")}}>
                      {bk}
                    </button>
                  ))}
                </div><button onClick={applyBulkBK} disabled={!bulkBK}
                  style={{width:"100%",padding:"11px",background:bulkBK?"linear-gradient(135deg,#00E676,#0EA5E9)":"#1F2937",border:"none",borderRadius:9,color:bulkBK?"#0B1220":"#9CA3AF",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                  {bulkBK?"Appliquer "+bulkBK+" à "+store.count+" paris":"Sélectionner un bookmaker"}
                </button></div><div style={{marginBottom:14}}><div style={{fontSize:12,color:"#9CA3AF",marginBottom:8}}>Date & heure</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:8}}><input type="date" className="ifield" value={bulkDatetime?bulkDatetime.split("T")[0]:""} onChange={e=>{const d=e.target.value;const t=bulkDatetime?bulkDatetime.split("T")[1]||"12:00":"12:00";setBulkDatetime(d+"T"+t);}} style={{height:40}}/><input type="time" className="ifield" value={bulkDatetime?bulkDatetime.split("T")[1]||"":"12:00"} onChange={e=>{const t=e.target.value;const d=bulkDatetime?bulkDatetime.split("T")[0]:nowDT().split("T")[0];setBulkDatetime(d+"T"+t);}} style={{height:40}}/></div><button onClick={applyBulkDatetime} disabled={!bulkDatetime}
                  style={{width:"100%",padding:"11px",background:bulkDatetime?"linear-gradient(135deg,#7C3AED,#0EA5E9)":"#1F2937",border:"none",borderRadius:9,color:bulkDatetime?"#fff":"#9CA3AF",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                  {bulkDatetime?"Appliquer la date à "+store.count+" paris":"Choisir une date"}
                </button></div>
              {/* Tournoi - menu déroulant */}
              {(()=>{
                const allT=[...new Set(Object.values(savedTourneys).flat())].filter(Boolean);
                if(allT.length===0)return null;
                return(
                  <div style={{marginBottom:14}}><div style={{fontSize:12,color:"#9CA3AF",marginBottom:8}}>Tournoi</div><div style={{display:"flex",alignItems:"center",gap:8,background:"#0B1220",border:"1px solid #374151",borderRadius:10,padding:"4px 4px 4px 12px",marginBottom:8}}><span style={{fontSize:14,flexShrink:0}}>{bulkTourney&&bulkTourney!=="Hors tournoi"?"":bulkTourney==="Hors tournoi"?"📅":""}</span><select value={bulkTourney} onChange={e=>setBulkTourney(e.target.value)}
                        style={{flex:1,background:"transparent",border:"none",color:bulkTourney?"#E5E7EB":"#6B7280",fontSize:14,fontFamily:"'Inter',sans-serif",fontWeight:bulkTourney?600:400,outline:"none",appearance:"none",WebkitAppearance:"none",cursor:"pointer",padding:"8px 0"}}><option value="" style={{background:"#111827",color:"#6B7280"}}>Choisir un tournoi…</option>
                        {allT.map(t=><option key={t} value={t} style={{background:"#111827",color:"#E5E7EB"}}> {t}</option>)}
                        <option value="Hors tournoi" style={{background:"#111827",color:"#9CA3AF"}}>📅 Hors tournoi</option></select><span style={{color:"#6B7280",fontSize:16,paddingRight:10,flexShrink:0}}>⌄</span></div><button onClick={()=>bulkTourney&&applyBulkTourney(bulkTourney)} disabled={!bulkTourney}
                      style={{width:"100%",padding:"11px",background:bulkTourney?"linear-gradient(135deg,#7C3AED,#3B82F6)":"#1F2937",border:"none",borderRadius:9,color:bulkTourney?"#fff":"#9CA3AF",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                      {bulkTourney?"Appliquer "+bulkTourney+" à "+store.count+" paris":"Sélectionner un tournoi"}
                    </button></div>
                );
              })()}

              {/* Map bulk */}
              <div style={{marginBottom:14}}><div style={{fontSize:12,color:"#9CA3AF",marginBottom:6}}>Map</div><div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                  {["Q1","Q2","Q3","Q4","H1","H2","Match"].map(m=>(
                    <button key={m} onClick={()=>setBulkMap(v=>v===m?"":m)}
                      style={{padding:"7px 14px",borderRadius:20,border:"1.5px solid "+(bulkMap===m?"#7C3AED":"#1F2937"),background:bulkMap===m?"rgba(124,58,237,0.1)":"transparent",color:bulkMap===m?"#A78BFA":"#6B7280",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                      {m}
                    </button>
                  ))}
                </div><button onClick={applyBulkMap} disabled={!bulkMap}
                  style={{width:"100%",padding:"11px",background:bulkMap?"linear-gradient(135deg,#7C3AED,#3B82F6)":"#1F2937",border:"none",borderRadius:9,color:bulkMap?"#fff":"#9CA3AF",fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                  {bulkMap?"Appliquer "+bulkMap+" à "+store.count+" paris":"Sélectionner une map"}
                </button></div><button onClick={()=>{setBulkModal(false);setBulkDatetime("");}} style={{width:"100%",padding:"11px",background:"#1F2937",border:"none",borderRadius:9,color:"#94A3B8",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:14}}>Annuler</button></div></div>
        )}





                {/* ── MODAL ADD BOOKMAKER ── */}
        {/* ── MODAL EDIT LOGO BOOKMAKER ── */}
        {editingBK&&(
          <div style={{position:"fixed",inset:0,zIndex:9998,background:"rgba(0,0,0,.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={()=>setEditingBK(null)}>
            <div style={{width:"100%",maxWidth:340,background:"#0d1225",borderRadius:18,border:"1px solid rgba(255,255,255,.12)",padding:"18px 18px 20px"}} onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:14,fontWeight:700,color:"#E5E7EB",marginBottom:14}}>Logo — {editingBK.name}</div>
              <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:14}}>
                {editingBK.logoUrl?(
                  <img src={editingBK.logoUrl} alt="" style={{width:36,height:36,borderRadius:8,objectFit:"contain",background:"rgba(255,255,255,.05)",padding:2,flexShrink:0,border:"1px solid rgba(255,255,255,.1)"}} onError={e=>e.target.style.display="none"}/>
                ):(
                  <div style={{width:36,height:36,borderRadius:8,background:"rgba(255,255,255,.06)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,color:"#6B7280"}}>🏦</div>
                )}
                <div style={{flex:1,display:"flex",flexDirection:"column",gap:5}}>
                  <label style={{display:"flex",alignItems:"center",gap:6,background:"rgba(124,58,237,.1)",border:"1px solid rgba(124,58,237,.25)",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                    <span style={{fontSize:12,color:"#a78bfa",fontWeight:600}}>⬆ Uploader logo</span>
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                      const file=e.target.files[0];if(!file)return;
                      try{const filename=await supaUploadAvatar(file,"bk_"+editingBK.name);const url=AVATARS_BUCKET+encodeURIComponent(filename);setEditingBK(b=>({...b,logoUrl:url}));}
                      catch(err){alert("Erreur: "+err.message);}
                    }}/>
                  </label>
                  <button onClick={async()=>{try{const url=await pasteImageToSupabase("bk_"+editingBK.name);setEditingBK(b=>({...b,logoUrl:url}));}catch(e){alert("📋 "+e.message);}}} style={{display:"flex",alignItems:"center",gap:6,background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.25)",borderRadius:10,padding:"8px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif",width:"100%"}}>
                    <span style={{fontSize:12,color:"#34d399",fontWeight:600}}>📋 Coller logo</span>
                  </button>
                  <input
                    autoFocus
                    placeholder="ou colle une URL..."
                    value={editingBK.logoUrl||""}
                    onChange={e=>setEditingBK(b=>({...b,logoUrl:e.target.value}))}
                    style={{background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.12)",borderRadius:10,padding:"9px 12px",color:"#E5E7EB",fontSize:12,fontFamily:"Inter,sans-serif",outline:"none"}}
                  />
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <button onClick={()=>setEditingBK(null)} style={{padding:"11px",background:"rgba(255,255,255,.05)",border:"none",borderRadius:10,color:"#9CA3AF",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Annuler</button>
                <button onClick={()=>{
                  const url=(editingBK.logoUrl||"").trim();
                  const updated={...bkPhotos,[editingBK.name]:url||undefined};
                  if(!url) delete updated[editingBK.name];
                  setBkPhotos(updated);
                  try{localStorage.setItem("v7_bkphotos",JSON.stringify(updated));}catch(e){}
                  showToast(editingBK.name+" logo mis à jour","#22C55E");
                  setEditingBK(null);
                }} style={{padding:"11px",background:"linear-gradient(135deg,#00E676,#0EA5E9)",border:"none",borderRadius:10,color:"#0B1220",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Enregistrer</button>
              </div>
            </div>
          </div>
        )}

        {modalBK&&(
          <div className="moverlay" onClick={()=>{setModalBK(false);setNewBK("");setNewBKPhoto("");}}><div className="modal" onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:14}}>Nouveau bookmaker</div>
            <input className="ifield" placeholder="Nom du bookmaker..." value={newBK} onChange={e=>setNewBK(e.target.value)} style={{marginBottom:10}}/>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"#9CA3AF",marginBottom:7}}>Logo URL (optionnel)</div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                {newBKPhoto?(
                  <img src={newBKPhoto} alt="preview" style={{width:36,height:36,borderRadius:8,objectFit:"contain",border:"1px solid #1F2937",background:"rgba(255,255,255,.04)",padding:2,flexShrink:0}} onError={e=>e.target.style.display="none"}/>
                ):(
                  <div style={{width:36,height:36,borderRadius:8,background:"rgba(255,255,255,.06)",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#6B7280"}}>🏦</div>
                )}
                <input
                  placeholder="https://... URL du logo"
                  value={newBKPhoto}
                  onChange={e=>setNewBKPhoto(e.target.value)}
                  style={{flex:1,background:"#111827",border:"1px solid #1F2937",borderRadius:8,padding:"9px 10px",color:"#E5E7EB",fontSize:12,fontFamily:"Inter,sans-serif",outline:"none"}}
                />
                {newBKPhoto&&<button onClick={()=>setNewBKPhoto("")} style={{flexShrink:0,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",borderRadius:6,padding:"7px 9px",color:"#f87171",fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>×</button>}
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <button onClick={()=>{setModalBK(false);setNewBK("");setNewBKPhoto("");}} style={{padding:"12px",background:"#1F2937",border:"none",borderRadius:10,color:"#94A3B8",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Annuler</button>
              <button onClick={saveBookmaker} disabled={!newBK.trim()} style={{padding:"12px",background:newBK.trim()?"linear-gradient(135deg,#00E676,#0EA5E9)":"#1F2937",border:"none",borderRadius:10,color:newBK.trim()?"#0B1220":"#9CA3AF",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Ajouter</button>
            </div>
          </div></div>
        )}

        {/* ── MODAL ADD PLAYER ── */}
        {modalPlayer&&(
          <div className="moverlay" onClick={()=>setModalPlayer(false)}><div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"85vh",overflowY:"auto"}}>
            <div style={{fontSize:15,fontWeight:800,color:"#E5E7EB",marginBottom:16,display:"flex",alignItems:"center",gap:8}}>
              <span>🏀</span> Ajouter un joueur
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Nom du joueur *</div>
              <input className="ifield" placeholder="Ex: Victor Wembanyama" value={pform.name} onChange={e=>setPform(p=>({...p,name:e.target.value}))} style={{marginBottom:0}}/>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Ligue *</div>
              <select className="ifield" style={{width:"100%",cursor:"pointer"}} value={pform.game} onChange={e=>setPform(p=>({...p,game:e.target.value,league:e.target.value,team:""}))}>
                {["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Lega","Bundesliga","HEBA"].map(g=>(
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Équipe *</div>
              <select className="ifield" style={{width:"100%",cursor:"pointer"}} value={pform.team} onChange={e=>setPform(p=>({...p,team:e.target.value}))}>
                <option value="">Choisir une équipe…</option>
                {(ALL_LEAGUE_TEAMS[pform.game]||[]).slice().sort().map(t=>(
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Poste</div>
              <select className="ifield" style={{width:"100%",cursor:"pointer"}} value={pform.role||""} onChange={e=>setPform(p=>({...p,role:e.target.value}))}>
                <option value="">Poste (optionnel)</option>
                {pform.game==="NBA"
                  ?["PG","SG","SF","PF","C"].map(r=><option key={r} value={r}>{r}</option>)
                  :["Point Guard","Shooting Guard","Small Forward","Power Forward","Center"].map(r=><option key={r} value={r}>{r}</option>)
                }
              </select>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <button onClick={()=>setModalPlayer(false)} style={{padding:"12px",background:"#1F2937",border:"none",borderRadius:10,color:"#94A3B8",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Annuler</button>
              <button onClick={savePlayer} disabled={!pform.name||!pform.team} style={{padding:"12px",background:pform.name&&pform.team?"linear-gradient(135deg,#7C3AED,#3B82F6)":"#1F2937",border:"none",borderRadius:10,color:pform.name&&pform.team?"#fff":"#9CA3AF",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                ✓ Ajouter
              </button>
            </div>
          </div></div>
        )}

        {/* ── MODAL EDIT PLAYER ── */}
        {editingPlayer&&(
          <div className="moverlay" onClick={()=>setEditingPlayer(null)}>
            <div className="modal" onClick={e=>e.stopPropagation()}>
              <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>Modifier le joueur</div>
              <div style={{fontSize:11,color:"#6B7280",marginBottom:14,fontWeight:500}}>
                <span style={{color:"#A78BFA",textTransform:"capitalize"}}>{editingPlayer.key}</span>
              </div>

              {/* Photo + infos actuelles */}
              {(()=>{
                const pd=allPlayers[editingPlayer.key]||{};
                const photo=pd.photo_url?optimizePhotoUrl(pd.photo_url):null;
                const teamLogo=pd.team?NBA_TEAM_LOGOS[pd.team]:null;
                return(
                  <div style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:10,padding:"10px 12px",marginBottom:14}}>
                    <div style={{width:44,height:44,borderRadius:10,overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,.04)",position:"relative"}}>
                      {photo?<img src={photo} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 15%"}} onError={e=>e.target.style.display="none"} alt=""/>
                            :<img src={NBA_LEAGUE_LOGO} style={{width:36,height:36,objectFit:"contain",margin:"4px auto",display:"block"}} alt="NBA"/>}
                      {teamLogo&&<img src={teamLogo} style={{position:"absolute",bottom:0,right:0,width:14,height:14,objectFit:"contain",background:"rgba(0,0,0,.7)",borderRadius:2,padding:1}} onError={e=>e.target.style.display="none"} alt=""/>}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",textTransform:"capitalize"}}>{editingPlayer.key}</div>
                      <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>
                        {editingPlayer.data.team||"-"} · {editingPlayer.data.role||"-"} · {editingPlayer.data.league||"NBA"}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Équipe */}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Équipe</div>
                <select className="ifield" style={{width:"100%"}} value={editingPlayer.data.team||""}
                  onChange={e=>setEditingPlayer(ep=>({...ep,data:{...ep.data,team:e.target.value}}))}>
                  <option value="">Choisir une équipe...</option>
                  <option key="Atlanta Hawks" value="Atlanta Hawks">Atlanta Hawks</option>
                    <option key="Boston Celtics" value="Boston Celtics">Boston Celtics</option>
                    <option key="Brooklyn Nets" value="Brooklyn Nets">Brooklyn Nets</option>
                    <option key="Charlotte Hornets" value="Charlotte Hornets">Charlotte Hornets</option>
                    <option key="Chicago Bulls" value="Chicago Bulls">Chicago Bulls</option>
                    <option key="Cleveland Cavaliers" value="Cleveland Cavaliers">Cleveland Cavaliers</option>
                    <option key="Dallas Mavericks" value="Dallas Mavericks">Dallas Mavericks</option>
                    <option key="Denver Nuggets" value="Denver Nuggets">Denver Nuggets</option>
                    <option key="Detroit Pistons" value="Detroit Pistons">Detroit Pistons</option>
                    <option key="Golden State Warriors" value="Golden State Warriors">Golden State Warriors</option>
                    <option key="Houston Rockets" value="Houston Rockets">Houston Rockets</option>
                    <option key="Indiana Pacers" value="Indiana Pacers">Indiana Pacers</option>
                    <option key="LA Clippers" value="LA Clippers">LA Clippers</option>
                    <option key="Los Angeles Lakers" value="Los Angeles Lakers">Los Angeles Lakers</option>
                    <option key="Memphis Grizzlies" value="Memphis Grizzlies">Memphis Grizzlies</option>
                    <option key="Miami Heat" value="Miami Heat">Miami Heat</option>
                    <option key="Milwaukee Bucks" value="Milwaukee Bucks">Milwaukee Bucks</option>
                    <option key="Minnesota Timberwolves" value="Minnesota Timberwolves">Minnesota Timberwolves</option>
                    <option key="New Orleans Pelicans" value="New Orleans Pelicans">New Orleans Pelicans</option>
                    <option key="New York Knicks" value="New York Knicks">New York Knicks</option>
                    <option key="Oklahoma City Thunder" value="Oklahoma City Thunder">Oklahoma City Thunder</option>
                    <option key="Orlando Magic" value="Orlando Magic">Orlando Magic</option>
                    <option key="Philadelphia 76ers" value="Philadelphia 76ers">Philadelphia 76ers</option>
                    <option key="Phoenix Suns" value="Phoenix Suns">Phoenix Suns</option>
                    <option key="Portland Trail Blazers" value="Portland Trail Blazers">Portland Trail Blazers</option>
                    <option key="Sacramento Kings" value="Sacramento Kings">Sacramento Kings</option>
                    <option key="San Antonio Spurs" value="San Antonio Spurs">San Antonio Spurs</option>
                    <option key="Toronto Raptors" value="Toronto Raptors">Toronto Raptors</option>
                    <option key="Utah Jazz" value="Utah Jazz">Utah Jazz</option>
                    <option key="Washington Wizards" value="Washington Wizards">Washington Wizards</option>
                </select>
              </div>

              {/* Position */}
              <div style={{marginBottom:8}}>
                <div style={{fontSize:10,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Position</div>
                <div style={{display:"flex",gap:6}}>
                  {[["PG","1"],["SG","2"],["SF","3"],["PF","4"],["C","5"]].map(([pos,num])=>{
                    const on=editingPlayer.data.role===pos;
                    return(
                      <button key={pos} onClick={()=>setEditingPlayer(ep=>({...ep,data:{...ep.data,role:pos}}))}
                        style={{flex:1,padding:"8px 4px",borderRadius:9,border:"1.5px solid "+(on?"#a78bfa":"rgba(255,255,255,.08)"),background:on?"rgba(167,139,250,.15)":"rgba(255,255,255,.02)",color:on?"#a78bfa":"#4a5568",fontSize:11,fontWeight:on?800:500,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s"}}>
                        <div style={{fontSize:13,fontWeight:900}}>{num}</div>
                        <div style={{fontSize:9,marginTop:1}}>{pos}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ligue */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,color:"#9CA3AF",fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>Ligue</div>
                <select className="ifield" style={{width:"100%"}} value={editingPlayer.data.league||"NBA"}
                  onChange={e=>setEditingPlayer(ep=>({...ep,data:{...ep.data,league:e.target.value}}))}>
                  <option value="NBA">NBA</option>
                  <option value="EuroLeague">EuroLeague</option>
                  <option value="Pro A">Pro A</option>
                  <option value="ACB">ACB</option>
                  <option value="Bundesliga">Bundesliga</option>
                  <option value="Lega">Lega</option>
                  <option value="HEBA">HEBA</option>
                </select>
              </div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button onClick={()=>setEditingPlayer(null)}
                  style={{padding:"12px",background:"#1F2937",border:"none",borderRadius:10,color:"#94A3B8",fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                  Annuler
                </button><button onClick={()=>{
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
                  showToast((newKey!==key?key+" → "+newKey+" ":newKey+" ")+"mis à jour ✓");
                }} style={{padding:"12px",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:10,color:"#fff",fontWeight:700,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                  Sauvegarder
                </button></div></div></div>
        )}

        {/* ── MODAL SPLIT BET ── */}
        {splitModal&&(
          <div className="moverlay" onClick={()=>setSplitModal(null)}><div className="modal" style={{padding:0,overflow:"hidden",borderRadius:24}} onClick={e=>e.stopPropagation()}>

              {/* Header */}
              <div style={{padding:"18px 20px 14px",background:"linear-gradient(135deg,#111827,#0D1626)",borderBottom:"1px solid #1F2937"}}><div style={{fontSize:18,fontWeight:800,color:"#E5E7EB",letterSpacing:"-0.3px"}}>+ Bookmaker</div><div style={{fontSize:11,color:"#4B5563",marginTop:2}}>La mise s'additionne au pari existant</div></div><div style={{padding:"16px 20px 20px",display:"flex",flexDirection:"column",gap:14}}>

                {/* Pari source - compact card */}
                <div style={{background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"12px 14px",border:"1px solid #1F2937"}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><GameLogo game={splitModal.game} size={16}/><span style={{fontSize:14,fontWeight:700,color:"#E5E7EB",textTransform:"capitalize"}}>{splitModal.player}</span><span style={{fontSize:12,color:"#6B7280"}}>{splitModal.description}</span></div><div style={{display:"flex",flexDirection:"column",gap:4}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:"#9CA3AF"}}>{splitModal.bookmaker}</span><span style={{color:"#E5E7EB",fontWeight:600}}>{(splitModal.stake-(splitModal.splits||[]).reduce((s,x)=>s+x.stake,0)).toFixed(0)}$ <span style={{color:"#6B7280"}}>@{splitModal.odds}</span></span></div>
                    {(splitModal.splits||[]).map((sp,i)=>(
                      <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span style={{color:"#9CA3AF"}}>{sp.bookmaker}</span><span style={{color:"#E5E7EB",fontWeight:600}}>{sp.stake}$ <span style={{color:"#6B7280"}}>@{sp.odds}</span></span></div>
                    ))}
                    <div style={{borderTop:"1px solid #1F2937",paddingTop:6,marginTop:2,display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:700}}><span style={{color:"#6B7280"}}>Total</span><span style={{color:"#A78BFA"}}>{splitModal.stake}$</span></div></div></div>

                {/* Bookmakers */}
                <div><div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>Bookmaker</div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {visibleBKs.filter(bk=>bk!==splitModal.bookmaker).map(bk=>{
                      const logo=BK_LOGOS[bk]||bkPhotos[bk]||null;
                      const isOn=splitForm.bookmaker===bk;
                      const alreadySplit=(splitModal.splits||[]).find(s=>s.bookmaker===bk);
                      return(
                        <div key={bk} style={{position:"relative"}}><button onClick={()=>setSplitForm(f=>({...f,bookmaker:bk,stake:alreadySplit?String(alreadySplit.stake):f.stake,odds:alreadySplit?String(alreadySplit.odds):f.odds}))}
                            style={{width:48,height:48,borderRadius:12,border:"2px solid "+(isOn?"#A78BFA":alreadySplit?"rgba(251,191,36,0.4)":"#1F2937"),background:isOn?"rgba(124,58,237,0.15)":alreadySplit?"rgba(251,191,36,0.06)":"rgba(255,255,255,0.03)",cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",boxShadow:isOn?"0 0 12px rgba(124,58,237,0.3)":"none"}}>
                            {logo?(<img src={logo} alt={bk} style={{width:30,height:30,borderRadius:7,objectFit:"cover"}}/>):(<span style={{fontSize:11,fontWeight:700,color:isOn?"#A78BFA":alreadySplit?"#F59E0B":"#6B7280"}}>{bk.slice(0,3)}</span>)}
                          </button>
                          {alreadySplit&&<div style={{position:"absolute",top:-3,right:-3,background:"#F59E0B",borderRadius:"50%",width:12,height:12,display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #0B1220"}}><span style={{fontSize:6,color:"#000",fontWeight:900}}>✎</span></div>}
                          {isOn&&<div style={{position:"absolute",top:-3,right:-3,background:"#A78BFA",borderRadius:"50%",width:12,height:12,border:"2px solid #0B1220"}}/>}
                        </div>
                      );
                    })}
                  </div>
                  {splitForm.bookmaker&&<div style={{fontSize:11,color:"#A78BFA",fontWeight:600,marginTop:8}}>✓ {splitForm.bookmaker}{(splitModal.splits||[]).find(s=>s.bookmaker===splitForm.bookmaker)?" - modifier le split":""}</div>}
                </div>

                {/* Cote + Mise côte à côte */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}><div><div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Cote</div><input className="ifield" type="number" step="0.01" placeholder={"@"+splitModal.odds}
                      value={splitForm.odds} onChange={e=>setSplitForm(f=>({...f,odds:e.target.value}))}
                      style={{marginBottom:0}}/></div><div><div style={{fontSize:9,color:"#6B7280",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8}}>Mise ($)</div><input className="ifield" type="number" step="1" placeholder="Ex: 30"
                      value={splitForm.stake} onChange={e=>setSplitForm(f=>({...f,stake:e.target.value}))}
                      style={{marginBottom:0}}/></div></div>

                {/* Raccourcis mise intelligents */}
                {(()=>{
                  const UNITS=[50,62,75,87,100];
                  const valid=UNITS.map(u=>({unit:u,add:Math.round(u-splitModal.stake)})).filter(x=>x.add>0);
                  if(!valid.length)return null;
                  return(
                    <div style={{display:"flex",gap:6}}>
                      {valid.map(({unit,add})=>(
                        <button key={unit} onClick={()=>setSplitForm(f=>({...f,stake:String(add)}))}
                          style={{flex:"1 1 auto",padding:"8px 4px",borderRadius:10,border:"1.5px solid "+(splitForm.stake===String(add)?"#A78BFA":"#1F2937"),background:splitForm.stake===String(add)?"rgba(124,58,237,0.12)":"rgba(255,255,255,0.03)",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"center",transition:"all .15s"}}><div style={{fontSize:12,fontWeight:700,color:splitForm.stake===String(add)?"#A78BFA":"#E5E7EB"}}>{add}$</div><div style={{fontSize:9,color:"#6B7280",marginTop:1}}>→{unit}$</div></button>
                      ))}
                    </div>
                  );
                })()}

                {splitForm.stake&&<div style={{fontSize:12,color:"#6B7280",textAlign:"center"}}>
                  Total → <span style={{color:"#A78BFA",fontWeight:800,fontSize:14}}>{(splitModal.stake+parseFloat(splitForm.stake||0)).toFixed(0)}$</span></div>}

                {/* Boutons */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 2fr",gap:8}}><button onClick={()=>setSplitModal(null)}
                    style={{padding:"13px",background:"rgba(255,255,255,0.05)",border:"1px solid #1F2937",borderRadius:12,color:"#6B7280",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",fontSize:13}}>
                    Annuler
                  </button><button disabled={!splitForm.bookmaker||!splitForm.stake}
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
                  </button></div></div></div></div>
        )}

        {/* ── MODAL SUPABASE / CLOUD ── */}
        {supaModal&&(
          <div className="moverlay" onClick={()=>{setSupaModal(false);setSupaError("");}}><div className="modal" onClick={e=>e.stopPropagation()}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}><span style={{fontSize:22}}>☁️</span><div><div style={{fontSize:15,fontWeight:700,color:"#E5E7EB"}}>Cloud Sync</div><div style={{fontSize:11,color:"#6B7280"}}>Sync automatique entre tous tes appareils</div></div></div>

              {/* Status */}
              <div style={{background:supaOk?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.06)",border:"1px solid "+(supaOk?"rgba(34,197,94,0.2)":"rgba(239,68,68,0.15)"),borderRadius:10,padding:"12px 14px",marginBottom:14}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><span style={{width:7,height:7,borderRadius:"50%",background:supaOk?"#00E676":"#EF4444",boxShadow:"0 0 6px "+(supaOk?"rgba(34,197,94,0.8)":"rgba(239,68,68,0.6)")}}/><span style={{fontSize:12,fontWeight:700,color:supaOk?"#00E676":"#EF4444"}}>{syncing?"Synchronisation…":supaOk?"Connecté à Supabase":"Hors ligne - vérifie ta connexion"}</span></div><div style={{fontSize:11,color:"#6B7280"}}>{bets.length} paris en local · sync auto toutes les 5s</div></div>

              {/* Integrity check */}
              <div style={{marginBottom:14}}><button onClick={async()=>{
                  setIntegrityChecking(true);setIntegrityReport(null);
                  try{
                    const remote=await supaPullBets();
                    const localIds=new Set(bets.map(b=>String(b.id)));
                    const remoteIds=new Set(remote.map(b=>String(b.id)));
                    const onlyLocal=bets.filter(b=>!remoteIds.has(String(b.id)));
                    const onlyRemote=remote.filter(b=>!localIds.has(String(b.id)));
                    setIntegrityReport({local:bets.length,remote:remote.length,onlyLocal,onlyRemote});
                  }catch(e){setIntegrityReport({error:e.message});}
                  setIntegrityChecking(false);
                }} disabled={integrityChecking}
                  style={{width:"100%",padding:"11px",background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.25)",borderRadius:10,color:"#60A5FA",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:integrityReport?8:0}}>
                  {integrityChecking?"🔍 Vérification…":"🔍 Vérifier l'intégrité des données"}
                </button>
                {integrityReport&&(
                  <div style={{background:"#0B1220",border:"1px solid #1F2937",borderRadius:10,padding:"12px 14px"}}>
                    {integrityReport.error?(
                      <div style={{color:"#EF4444",fontSize:12}}>Erreur : {integrityReport.error}</div>
                    ):(
                      <><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}><div style={{background:"rgba(124,58,237,0.08)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:"#A78BFA"}}>{integrityReport.local}</div><div style={{fontSize:10,color:"#6B7280",marginTop:2}}>Local (iPhone)</div></div><div style={{background:"rgba(34,197,94,0.08)",borderRadius:8,padding:"8px 12px",textAlign:"center"}}><div style={{fontSize:20,fontWeight:800,color:"#00E676"}}>{integrityReport.remote}</div><div style={{fontSize:10,color:"#6B7280",marginTop:2}}>Supabase (Cloud)</div></div></div>
                        {integrityReport.onlyLocal.length===0&&integrityReport.onlyRemote.length===0?(
                          <div style={{display:"flex",alignItems:"center",gap:6,color:"#00E676",fontSize:12,fontWeight:700}}>
                            ✓ Parfait - local et cloud sont identiques
                          </div>
                        ):(
                          <>
                            {integrityReport.onlyLocal.length>0&&(
                              <div style={{marginBottom:8}}><div style={{fontSize:11,fontWeight:700,color:"#F59E0B",marginBottom:4}}>
                                   {integrityReport.onlyLocal.length} paris en local mais PAS dans le cloud
                                </div><div style={{fontSize:10,color:"#6B7280",marginBottom:6}}>
                                  {integrityReport.onlyLocal.slice(0,5).map(b=><div key={b.id} style={{padding:"3px 0",borderBottom:"1px solid #1F2937"}}><span style={{color:"#E5E7EB",fontWeight:600}}>{b.player}</span><span style={{color:"#6B7280"}}> · {b.overUnder} {String(b.description||"").replace(/^(Over|Under)\s/,"")} · @{b.odds} · {b.stake}$ · {b.bookmaker}</span><span style={{color:"#4B5563",marginLeft:4}}>{b.datetime?String(b.datetime).slice(0,10):""}</span></div>)}
                                  {integrityReport.onlyLocal.length>5&&<div style={{paddingTop:4}}>+{integrityReport.onlyLocal.length-5} autres…</div>}
                                </div><button onClick={function(){supaPushBets(integrityReport.onlyLocal).then(function(){showToast(integrityReport.onlyLocal.length+" paris envoyés ✓","#00E676");setIntegrityReport(null);}).catch(function(){showToast("Erreur envoi","#EF4444");});}}
                                  style={{width:"100%",padding:"8px",background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:8,color:"#F59E0B",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                                  ↑ Envoyer ces {integrityReport.onlyLocal.length} paris vers le cloud
                                </button></div>
                            )}
                            {integrityReport.onlyRemote.length>0&&(
                              <div><div style={{fontSize:11,fontWeight:700,color:"#60A5FA",marginBottom:4}}>
                                  ℹ️ {integrityReport.onlyRemote.length} paris dans le cloud mais PAS en local
                                </div><div style={{fontSize:10,color:"#6B7280",marginBottom:6}}>
                                  {integrityReport.onlyRemote.slice(0,5).map(b=><div key={b.id} style={{padding:"3px 0",borderBottom:"1px solid #1F2937"}}><span style={{color:"#E5E7EB",fontWeight:600}}>{b.player}</span><span style={{color:"#6B7280"}}> · {b.overUnder} {String(b.description||"").replace(/^(Over|Under)\s/,"")} · @{b.odds} · {b.stake}$ · {b.bookmaker}</span><span style={{color:b.status==="won"?"#00E676":b.status==="lost"?"#EF4444":"#3B82F6",marginLeft:4,fontWeight:600}}>{b.status}</span><span style={{color:"#4B5563",marginLeft:4}}>{b.datetime?String(b.datetime).slice(0,10):""}</span></div>)}
                                  {integrityReport.onlyRemote.length>5&&<div style={{paddingTop:4}}>+{integrityReport.onlyRemote.length-5} autres…</div>}
                                </div><button onClick={()=>{const merged=[...bets,...integrityReport.onlyRemote];setBets(merged);localStorage.setItem("v7_bets",JSON.stringify(merged));showToast(integrityReport.onlyRemote.length+" paris récupérés ✓","#00E676");setIntegrityReport(null);}}
                                  style={{width:"100%",padding:"8px",background:"rgba(96,165,250,0.1)",border:"1px solid rgba(96,165,250,0.3)",borderRadius:8,color:"#60A5FA",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                                  ↓ Récupérer ces {integrityReport.onlyRemote.length} paris depuis le cloud
                                </button></div>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Actions manuelles */}
              <button onClick={()=>{
                setSyncing(true);
                supaPullBets().then(remote=>{
                  if(remote&&remote.length>0){
                    setBets(remote);
                    localStorage.setItem("v7_bets",JSON.stringify(remote));
                    showToast("☁️ "+remote.length+" paris rechargés","#7C3AED");
                    setSupaOk(true);
                  }
                  setSyncing(false);setSupaModal(false);
                }).catch(e=>{setSyncing(false);setSupaOk(false);showToast("Erreur: "+e.message,"#EF4444");});
              }} style={{width:"100%",padding:"11px",background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.3)",borderRadius:10,color:"#A78BFA",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:8}}>
                ↓ Forcer le rechargement depuis le cloud
              </button><button onClick={()=>{
                setSyncing(true);
                supaPushBets(bets).then(()=>{
                  setSupaOk(true);
                  showToast("☁️ "+bets.length+" paris envoyés","#00E676");
                  setSyncing(false);setSupaModal(false);
                }).catch(e=>{setSyncing(false);setSupaOk(false);showToast("Erreur: "+e.message,"#EF4444");});
              }} style={{width:"100%",padding:"11px",background:"rgba(34,197,94,0.08)",border:"1px solid rgba(34,197,94,0.2)",borderRadius:10,color:"#00E676",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:14}}>
                ↑ Forcer l'envoi vers le cloud
              </button>

              {/* Reset total */}
              <button onClick={()=>{
                if(!confirmDelete){setConfirmDelete(true);return;}
                setSyncing(true);
                setBets([]);
                localStorage.setItem("v7_bets","[]");
                supaDeleteAllBets().catch(function(){}).finally(()=>{setSyncing(false);});
                setConfirmDelete(false);setSupaModal(false);
                showToast("Tous les paris supprimés","#EF4444");
              }}
                style={{width:"100%",padding:"11px",background:confirmDelete?"#EF4444":"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:10,color:confirmDelete?"#fff":"#EF4444",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:8}}>
                {confirmDelete?" Confirmer la suppression de TOUS les paris":"🗑 Remettre à zéro"}
              </button><button onClick={()=>{setSupaModal(false);setConfirmDelete(false);}}
                style={{width:"100%",padding:"11px",background:"#1F2937",border:"none",borderRadius:10,color:"#6B7280",fontWeight:600,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:13}}>
                Fermer
              </button></div></div>
        )}

      </div></div>
  );






// ── ErrorBoundary - prevents full black screen on JS crash ─────────────────
class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={hasError:false,error:null};}
  static getDerivedStateFromError(e){return{hasError:true,error:e};}
  componentDidCatch(e,info){console.error("BasketBettingTracker crash:",e,info);}
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


// ── PP Board Analyzer ────────────────────────────────────────────────────────
function PPBoardAnalyzer(){
  const [gameFilter,setGameFilter]=React.useState("NBA");
  const [img12,setImg12]=React.useState(null);
  const [img3,setImg3]=React.useState(null);
  const [rows,setRows]=React.useState([]);
  const [loading,setLoading]=React.useState(false);
  const [error,setError]=React.useState("");
  const [open,setOpen]=React.useState(false);

  function handleFile(e,which){
    var file=e.target.files&&e.target.files[0];
    if(!file)return;
    var reader=new FileReader();
    reader.onload=function(ev){
      var b64=ev.target.result.split(",")[1];
      var data={b64:b64,mime:file.type,url:ev.target.result};
      if(which==="12")setImg12(data);else setImg3(data);
    };
    reader.readAsDataURL(file);
  }

  async function analyze(){
    if(!img12&&!img3)return;
    setLoading(true);setError("");setRows([]);
    var content12=img12?[{type:"image",source:{type:"base64",media_type:img12.mime,data:img12.b64}}]:[];
    var content3=img3?[{type:"image",source:{type:"base64",media_type:img3.mime,data:img3.b64}}]:[];
    var prompt="Analyse ces boards PrizePicks pour "+gameFilter+"."+(img12?" IMAGE 1=H1+H2.":"")+(img3?" IMAGE 2=Match.":"")+' Retourne UNIQUEMENT ce JSON sans markdown: {"map12":[{"player":"Nom","line":30.5}],"map3":[{"player":"Nom","line":15.5}]}';
    try{
      var resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1000,messages:[{role:"user",content:[...content12,...content3,{type:"text",text:prompt}]}]})
      });
      var data=await resp.json();
      var raw=(data.content&&data.content[0]&&data.content[0].text)||"";
      var clean=raw.replace(/```json|```/g,"").trim();
      var parsed=JSON.parse(clean);
      var map12=parsed.map12||[];
      var map3=parsed.map3||[];
      var lookup={};
      map3.forEach(function(p){lookup[p.player.toLowerCase()]=p.line;});
      var result=[];
      map12.forEach(function(p){
        var th=Math.round(p.line/2*10)/10;
        var actual=lookup[p.player.toLowerCase()]||null;
        var diff=actual!==null?Math.round((actual-th)*100)/100:null;
        result.push({player:p.player,line12:p.line,theoretical:th,map3:actual,diff:diff});
      });
      map3.forEach(function(p){
        var found=result.find(function(r){return r.player.toLowerCase()===p.player.toLowerCase();});
        if(!found)result.push({player:p.player,line12:null,theoretical:null,map3:p.line,diff:null});
      });
      result.sort(function(a,b){return (b.line12||0)-(a.line12||0);});
      setRows(result);
    }catch(e){setError("Erreur: "+e.message);}
    setLoading(false);
  }

  var inputStyle={width:"100%",background:"rgba(0,0,0,.3)",border:"1px solid rgba(255,255,255,.1)",borderRadius:9,padding:"9px 12px",color:"#E5E7EB",fontSize:12,fontFamily:"Inter,sans-serif",outline:"none",cursor:"pointer"};
  var diffCol=function(d){return d===null?"#6B7280":d>=1?"#00E676":d<=-1?"#f87171":"#9CA3AF";};

  return(
    <div style={{margin:"0 0 24px",padding:"0 16px"}}><button onClick={function(){setOpen(function(v){return !v;});}}
        style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#111827",border:"1px solid #1F2937",borderRadius:open?"13px 13px 0 0":"13px",padding:"12px 16px",cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:8}}><img src={PP_LOGO_B64} style={{width:18,height:18,objectFit:"contain",borderRadius:4}}/><span style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>PP Board Analyzer</span><span style={{background:"rgba(124,58,237,.15)",color:"#a78bfa",fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:6}}>Comparer H1+H2 vs Match</span></div><span style={{color:"#6B7280",fontSize:12,transform:open?"rotate(180deg)":"none",display:"inline-block",transition:"transform .2s"}}>▼</span></button>

      {open&&<div style={{background:"#0D1117",border:"1px solid #1F2937",borderTop:"none",borderRadius:"0 0 13px 13px",padding:"16px"}}>
        {/* Game filter */}
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          {["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Bundesliga","Lega","HEBA"].map(function(g){
            var on=gameFilter===g;
            return <button key={g} onClick={function(){setGameFilter(g);}}
              style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:8,border:"1px solid "+(on?"rgba(124,58,237,.5)":"rgba(255,255,255,.07)"),background:on?"rgba(124,58,237,.15)":"transparent",color:on?"#c4b5fd":"#6B7280",fontSize:11,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
              {g}
            </button>;
          })}
        </div>

        {/* Upload row */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          {[{id:"up12",label:"Board Map 1+2",which:"12",img:img12,clear:function(){setImg12(null);}},
            {id:"up3",label:"Board Map 3",which:"3",img:img3,clear:function(){setImg3(null);}}].map(function(u){
            return <div key={u.id}><div style={{fontSize:10,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>{u.label}</div>
              {u.img?(
                <div style={{position:"relative"}}><img src={u.img.url} style={{width:"100%",maxHeight:120,objectFit:"contain",borderRadius:8,border:"1px solid rgba(124,58,237,.2)"}}/><button onClick={u.clear} style={{position:"absolute",top:4,right:4,background:"rgba(239,68,68,.8)",border:"none",borderRadius:"50%",width:20,height:20,color:"#fff",cursor:"pointer",fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div>
              ):(
                <label style={{display:"block",border:"2px dashed rgba(124,58,237,.3)",borderRadius:9,padding:"20px 10px",textAlign:"center",cursor:"pointer",background:"rgba(124,58,237,.04)"}}><input type="file" accept="image/*" style={{display:"none"}} onChange={function(e){handleFile(e,u.which);}}/><div style={{fontSize:18,marginBottom:4}}></div><div style={{fontSize:10,color:"#6B7280"}}>Upload photo</div></label>
              )}
            </div>;
          })}
        </div><button onClick={analyze} disabled={loading||(!img12&&!img3)}
          style={{width:"100%",padding:"11px",borderRadius:10,border:"none",background:(!img12&&!img3)||loading?"rgba(255,255,255,.05)":"linear-gradient(135deg,#7C3AED,#3B82F6)",color:(!img12&&!img3)||loading?"#4a5a6e":"#fff",fontWeight:700,fontSize:13,cursor:(!img12&&!img3)||loading?"default":"pointer",fontFamily:"Inter,sans-serif",marginBottom:12}}>
          {loading?" Analyse en cours...":"Analyser →"}
        </button>

        {error&&<div style={{padding:"8px 12px",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",borderRadius:8,color:"#f87171",fontSize:11,marginBottom:10}}>{error}</div>}

        {rows.length>0&&<div><div style={{fontSize:11,fontWeight:700,color:"#c4b5fd",marginBottom:8}}>{rows.length} joueurs analysés</div><div style={{overflowX:"auto",borderRadius:10,border:"1px solid rgba(139,92,246,.2)"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}><thead><tr style={{background:"rgba(124,58,237,.15)"}}>
                  {["Joueur","Line 1+2","Théo /map","Map 3 PP","Diff","Signal"].map(function(h){
                    return <th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:9,fontWeight:700,color:"#7a6a9e",textTransform:"uppercase",letterSpacing:.6,whiteSpace:"nowrap"}}>{h}</th>;
                  })}
                </tr></thead><tbody>
                {rows.map(function(r,i){
                  var dc=diffCol(r.diff);
                  var signal=r.diff===null?"-":r.diff>=1?<span style={{background:"rgba(0,230,118,.12)",color:"#00E676",padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>Over Map3</span>:r.diff<=-1?<span style={{background:"rgba(248,113,113,.12)",color:"#f87171",padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>Under Map3</span>:<span style={{color:"#9CA3AF",fontSize:10}}>Cohérent</span>;
                  return(
                    <tr key={i} style={{borderTop:"1px solid rgba(255,255,255,.04)"}}><td style={{padding:"9px 10px",fontWeight:700,color:"#E5E7EB",textTransform:"capitalize"}}>{r.player}</td><td style={{padding:"9px 10px",fontWeight:700,color:"#c4b5fd"}}>{r.line12!==null?r.line12:"-"}</td><td style={{padding:"9px 10px",color:"#6B7280"}}>{r.theoretical!==null?r.theoretical:"-"}</td><td style={{padding:"9px 10px",fontWeight:700,color:"#c4b5fd"}}>{r.map3!==null?r.map3:"-"}</td><td style={{padding:"9px 10px",fontWeight:700,color:dc}}>{r.diff!==null?(r.diff>0?"+":"")+r.diff:"-"}</td><td style={{padding:"9px 10px"}}>{signal}</td></tr>
                  );
                })}
              </tbody></table></div></div>}
      </div>}
    </div>
  );
}



// ── PPReferenceTable ─────────────────────────────────────────────────────────
function PPReferenceTable(){
  const [open,setOpen]=useState(false);
  const [game,setGame]=useState("Points");

  const DATA={
    "Points":[
      {pp12:"16 – 18.5",map3:"8 – 9",under:"Under 10"},
      {pp12:"19 – 21.5",map3:"9.5 – 10.5",under:"Under 12"},
      {pp12:"22 – 24.5",map3:"11 – 12",under:"Under 13.5"},
      {pp12:"25 – 27.5",map3:"12.5 – 13.5",under:"Under 15"},
      {pp12:"28 – 30.5",map3:"14 – 15",under:"Under 16.5"},
      {pp12:"31 – 33.5",map3:"15.5 – 16.5",under:"Under 18"},
      {pp12:"34 – 36.5",map3:"17 – 18",under:"Under 19.5"},
    ],
    "3 Pts":[
      {pp12:"2 – 2.5",map3:"1",under:"Under 1.5"},
      {pp12:"3 – 3.5",map3:"1.5",under:"Under 2"},
      {pp12:"4 – 4.5",map3:"2",under:"Under 2.5"},
      {pp12:"5 – 5.5",map3:"2.5",under:"Under 3"},
      {pp12:"6 – 6.5",map3:"3",under:"Under 3.5"},
    ],
    "Assists":[
      {pp12:"6 – 7",map3:"3 – 3.5",under:"Under 4"},
      {pp12:"8 – 9",map3:"4 – 4.5",under:"Under 5"},
      {pp12:"10 – 11",map3:"5 – 5.5",under:"Under 6"},
      {pp12:"12 – 13",map3:"6 – 6.5",under:"Under 7"},
    ],
    "Rebounds":[
      {pp12:"6 – 7",map3:"3 – 3.5",under:"Under 4"},
      {pp12:"8 – 9",map3:"4 – 4.5",under:"Under 5"},
      {pp12:"10 – 11",map3:"5 – 5.5",under:"Under 6"},
      {pp12:"12 – 13",map3:"6 – 6.5",under:"Under 7"},
    ],
  };

  const games=Object.keys(DATA);
  var rows=DATA[game]||[];

  var gameColors={"Points":"#a78bfa","3 Pts":"#34d399","Assists":"#60a5fa","Rebounds":"#fb923c"};
  var col=gameColors[game]||"#c4b5fd";

  return(
    <div style={{margin:"0 0 16px",padding:"0 16px"}}><button onClick={function(){setOpen(function(v){return !v;});}}
        style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#111827",border:"1px solid #1F2937",borderRadius:open?"13px 13px 0 0":"13px",padding:"12px 16px",cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:8}}><img src={PP_LOGO_B64} style={{width:18,height:18,objectFit:"contain",borderRadius:4}}/><span style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>Table de Référence PP</span><span style={{background:"rgba(124,58,237,.12)",color:"#a78bfa",fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:6}}>H1+H2 → Match</span></div><span style={{color:"#6B7280",fontSize:12,transform:open?"rotate(180deg)":"none",display:"inline-block",transition:"transform .2s"}}>▼</span></button>

      {open&&<div style={{background:"#0D1117",border:"1px solid #1F2937",borderTop:"none",borderRadius:"0 0 13px 13px",padding:"12px"}}>
        {/* Game selector */}
        <div style={{display:"flex",gap:5,marginBottom:12}}>
          {games.map(function(g){
            var on=game===g;
            var gc=gameColors[g]||"#c4b5fd";
            return <button key={g} onClick={function(){setGame(g);}}
              style={{flex:1,padding:"7px 6px",borderRadius:8,border:"1px solid "+(on?`rgba(0,0,0,.3)`:"rgba(255,255,255,.07)"),background:on?gc+"22":"transparent",color:on?gc:"#6B7280",fontSize:10,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:5}}>
              {g}
            </button>;
          })}
        </div>

        {/* Table */}
        <div style={{borderRadius:10,overflow:"hidden",border:"1px solid rgba(255,255,255,.06)"}}><div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",background:"rgba(0,0,0,.4)"}}>
            {["PP H1+H2","Match estimé","Under intéressant"].map(function(h){
              return <div key={h} style={{padding:"8px 10px",fontSize:9,fontWeight:700,color:col,textTransform:"uppercase",letterSpacing:.6,textAlign:"center",borderRight:"1px solid rgba(255,255,255,.04)"}}>{h}</div>;
            })}
          </div>
          {rows.map(function(r,i){
            return <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderTop:"1px solid rgba(255,255,255,.04)",background:i%2===0?"transparent":"rgba(255,255,255,.01)"}}><div style={{padding:"10px 10px",textAlign:"center",fontSize:13,fontWeight:700,color:"#fbbf24",borderRight:"1px solid rgba(255,255,255,.04)"}}>{r.pp12}</div><div style={{padding:"10px 10px",textAlign:"center",fontSize:13,fontWeight:600,color:"#9CA3AF",borderRight:"1px solid rgba(255,255,255,.04)"}}>{r.map3}</div><div style={{padding:"10px 10px",textAlign:"center",fontSize:13,fontWeight:700,color:"#60a5fa"}}>{r.under}</div></div>;
          })}
        </div><div style={{marginTop:8,fontSize:10,color:"#3a4a5e",textAlign:"center"}}>
          Source: analyse PP historique · Under = ligne Map3 PP − 1 kill
        </div></div>}
    </div>
  );
}

// ── PPRatioCompiler ─────────────────────────────────────────────────────────
function PPRatioCompiler(){
  const SUPA_ROW_PP="__settings_pp_ratios__";
  function loadData(){try{return JSON.parse(localStorage.getItem("v7_pp_ratios")||"{}");}catch(e){return{};}}
  function saveDataToStorage(d){
    try{localStorage.setItem("v7_pp_ratios",JSON.stringify(d));}catch(e){}
    supaSettingsSave(SUPA_ROW_PP,d);
  }
  useEffect(()=>{
    supaSettingsLoad(SUPA_ROW_PP).then(d=>{
      if(d&&Object.keys(d).length>0){
        setData(prev=>{
          const merged={...prev,...d};
          try{localStorage.setItem("v7_pp_ratios",JSON.stringify(merged));}catch(e){}
          return merged;
        });
      }
    }).catch(()=>{});
  },[]);

  const [game,setGame]=useState("NBA");
  const [mt,setMt]=useState("12");
  const [rows,setRows]=useState([{player:"",anchor:"",comp:""}]);
  const [allData,setAllData]=useState(loadData);
  const [open,setOpen]=useState(false);
  const [uploadImgs,setUploadImgs]=useState({img12:null,img3:null});
  const [analyzing,setAnalyzing]=useState(false);

  async function analyzePhotos(){
    if(!uploadImgs.img12&&!uploadImgs.img3)return;
    setAnalyzing(true);
    var imgs=[];
    if(uploadImgs.img12)imgs.push({type:"image",source:{type:"base64",media_type:uploadImgs.img12.mime,data:uploadImgs.img12.b64}});
    if(uploadImgs.img3)imgs.push({type:"image",source:{type:"base64",media_type:uploadImgs.img3.mime,data:uploadImgs.img3.b64}});
    var prompt="Analyse ces boards PrizePicks pour "+game+"."+(uploadImgs.img12?" IMAGE 1=Map 1+2 kills.":"")+(uploadImgs.img3?" IMAGE 2=Map 3 kills.":"")+" Retourne UNIQUEMENT ce JSON valide sans markdown ni texte: {\"map12\":[{\"player\":\"Nom\",\"line\":30.5}],\"map3\":[{\"player\":\"Nom\",\"line\":15.5}]}. Inclus TOUS les joueurs visibles avec leurs lignes exactes.";
    imgs.push({type:"text",text:prompt});
    try{
      var resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:2000,messages:[{role:"user",content:imgs}]})
      });
      if(!resp.ok){
        var errText=await resp.text();
        throw new Error("API "+resp.status+": "+errText.slice(0,100));
      }
      var data=await resp.json();
      var raw=(data.content&&data.content[0]&&data.content[0].text)||"";
      // Extract JSON from response
      var jsonMatch=raw.match(/\{[\s\S]*\}/);
      if(!jsonMatch)throw new Error("Pas de JSON dans la réponse: "+raw.slice(0,100));
      var parsed=JSON.parse(jsonMatch[0]);
      var map12=parsed.map12||[];
      var map3=parsed.map3||[];
      var lookup={};
      map3.forEach(function(p){lookup[p.player.toLowerCase()]=p.line;});
      var newRows=map12.map(function(p){
        var comp=lookup[p.player.toLowerCase()];
        return{player:p.player,anchor:String(p.line),comp:comp!==undefined?String(comp):""};
      });
      map3.forEach(function(p){
        if(!map12.find(function(m){return m.player.toLowerCase()===p.player.toLowerCase();})){
          newRows.push({player:p.player,anchor:"",comp:String(p.line)});
        }
      });
      if(newRows.length>0)setRows(newRows);
      else throw new Error("Aucun joueur extrait. Réessaie avec une photo plus nette.");
    }catch(e){
      alert("Erreur analyse: "+e.message);
    }
    setAnalyzing(false);
  }

  var MT_LABELS={"12":"H1+H2","3":"Match","123":"H1+H2+OT"};
  var MT_DIVISOR={"12":2,"3":0.5,"123":3};
  var MT_COMP_LABEL={"12":"Match","3":"H1+H2","123":"Match"};

  function getKey(){return game+"_"+mt;}

  function getBuckets(){return(allData[getKey()])||[];}

  function addRow(){setRows(function(r){return r.concat({player:"",anchor:"",comp:""});});}

  function updateRow(i,field,val){
    setRows(function(prev){
      var n=prev.map(function(r,idx){return idx===i?Object.assign({},r,{[field]:val}):r;});
      return n;
    });
  }

  function save(){
    var newEntries=rows.filter(function(r){return r.anchor!=="";}).map(function(r){
      return{player:r.player||"?",anchor:parseFloat(r.anchor),comp:r.comp!==""?parseFloat(r.comp):null,date:new Date().toLocaleDateString("fr-CA"),ts:Date.now()};
    });
    if(!newEntries.length)return;
    var updated=Object.assign({},allData);
    var key=getKey();
    updated[key]=(updated[key]||[]).concat(newEntries);
    setAllData(updated);
    saveDataToStorage(updated);
    setRows([{player:"",anchor:"",comp:""}]);
  }

  function removeEntry(ts){
    var updated=Object.assign({},allData);
    var key=getKey();
    updated[key]=(updated[key]||[]).filter(function(e){return e.ts!==ts;});
    setAllData(updated);
    saveDataToStorage(updated);
  }

  function clearAll(){
    if(!window.confirm("Vider toutes les données "+game+" "+MT_LABELS[mt]+" ?"))return;
    var updated=Object.assign({},allData);
    delete updated[getKey()];
    setAllData(updated);
    saveDataToStorage(updated);
  }

  var buckets=getBuckets();
  var divisor=MT_DIVISOR[mt];
  var compLabel=MT_COMP_LABEL[mt];

  // Build frequency table
  var freq={};
  var allComps=new Set();
  buckets.forEach(function(d){
    var ak=d.anchor.toFixed(1);
    if(!freq[ak])freq[ak]={total:0,values:{}};
    freq[ak].total++;
    if(d.comp!==null){
      var ck=d.comp.toFixed(1);
      freq[ak].values[ck]=(freq[ak].values[ck]||0)+1;
      allComps.add(d.comp);
    }
  });
  var anchorLines=Object.keys(freq).map(Number).sort(function(a,b){return b-a;});
  var compCols=[...allComps].sort(function(a,b){return a-b;});

  var inputStyle={background:"rgba(0,0,0,.3)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"7px 9px",color:"#E5E7EB",fontSize:12,fontFamily:"Inter,sans-serif",outline:"none"};
  var pillStyle=function(on){return{padding:"5px 11px",borderRadius:7,border:"1px solid "+(on?"rgba(124,58,237,.5)":"rgba(255,255,255,.07)"),background:on?"rgba(124,58,237,.15)":"transparent",color:on?"#c4b5fd":"#6B7280",fontSize:10,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"};};

  return(
    <div style={{margin:"0 0 24px",padding:"0 16px"}}>
      {/* Toggle */}
      <button onClick={function(){setOpen(function(v){return !v;});}}
        style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"#111827",border:"1px solid #1F2937",borderRadius:open?"13px 13px 0 0":"13px",padding:"12px 16px",cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:8}}><img src={PP_LOGO_B64} style={{width:18,height:18,objectFit:"contain",borderRadius:4}}/><span style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>PP Ratio Compiler</span><span style={{background:"rgba(124,58,237,.12)",color:"#a78bfa",fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:6}}>{Object.values(allData).reduce(function(s,a){return s+(a&&a.length||0);},0)} entrées</span></div><span style={{color:"#6B7280",fontSize:12,transform:open?"rotate(180deg)":"none",display:"inline-block",transition:"transform .2s"}}>▼</span></button>

      {open&&<div style={{background:"#0D1117",border:"1px solid #1F2937",borderTop:"none",borderRadius:"0 0 13px 13px",padding:"16px"}}>

        {/* Game + MapType */}
        <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
          {["NBA","EuroLeague","EuroCup","BCL","Pro A","ACB","Bundesliga","Lega","HEBA"].map(function(g){
            return <button key={g} onClick={function(){setGame(g);}} style={pillStyle(game===g)}>
              {g}
            </button>;
          })}
        </div><div style={{display:"flex",gap:5,marginBottom:14}}>
          {["12","3","123"].map(function(k){
            return <button key={k} onClick={function(){setMt(k);}} style={Object.assign({},pillStyle(mt===k),{fontSize:10})}>
              {MT_LABELS[k]}
            </button>;
          })}
        </div>

        {/* Input rows */}
        <div style={{background:"rgba(0,0,0,.2)",borderRadius:10,padding:"12px",marginBottom:12}}>

          {/* Photo upload mode */}
          <div style={{marginBottom:12}}><div style={{fontSize:9,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:8}}> Upload photos du board PP</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              {[{key:"img12",label:"H1+H2"},{key:"img3",label:"Match"}].map(function(u){
                var imgData=uploadImgs[u.key];
                return <div key={u.key}><div style={{fontSize:9,color:"#4a5a6e",marginBottom:4}}>{u.label}</div>
                  {imgData?(
                    <div style={{position:"relative"}}><img src={imgData.url} style={{width:"100%",maxHeight:100,objectFit:"contain",borderRadius:7,border:"1px solid rgba(124,58,237,.2)"}}/><button onClick={function(){setUploadImgs(function(p){var n=Object.assign({},p);n[u.key]=null;return n;});}} style={{position:"absolute",top:3,right:3,background:"rgba(239,68,68,.8)",border:"none",borderRadius:"50%",width:18,height:18,color:"#fff",cursor:"pointer",fontSize:11,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button></div>
                  ):(
                    <label style={{display:"block",border:"2px dashed rgba(124,58,237,.25)",borderRadius:8,padding:"14px 8px",textAlign:"center",cursor:"pointer",background:"rgba(124,58,237,.03)"}}><input type="file" accept="image/*" style={{display:"none"}} onChange={function(e){
                        var file=e.target.files&&e.target.files[0];
                        if(!file)return;
                        var reader=new FileReader();
                        var key=u.key;
                        reader.onload=function(ev){
                          var b64=ev.target.result.split(",")[1];
                          setUploadImgs(function(p){var n=Object.assign({},p);n[key]={b64:b64,mime:file.type,url:ev.target.result};return n;});
                        };
                        reader.readAsDataURL(file);
                      }}/><div style={{fontSize:16,marginBottom:2}}></div><div style={{fontSize:10,color:"#6B7280"}}>{u.label}</div></label>
                  )}
                </div>;
              })}
            </div><button onClick={analyzePhotos} disabled={analyzing||(!uploadImgs.img12&&!uploadImgs.img3)}
              style={{width:"100%",padding:"9px",borderRadius:8,border:"none",background:(!uploadImgs.img12&&!uploadImgs.img3)||analyzing?"rgba(255,255,255,.05)":"linear-gradient(135deg,#7C3AED,#3B82F6)",color:(!uploadImgs.img12&&!uploadImgs.img3)||analyzing?"#4a5a6e":"#fff",fontWeight:700,fontSize:12,cursor:(!uploadImgs.img12&&!uploadImgs.img3)||analyzing?"default":"pointer",fontFamily:"Inter,sans-serif"}}>
              {analyzing?" Analyse Claude...":"Analyser photos → remplir tableau"}
            </button></div><div style={{borderTop:"1px solid rgba(255,255,255,.06)",marginBottom:10,paddingTop:10}}><div style={{fontSize:9,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:8}}>✏️ Ou entre manuellement</div></div><div style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 24px",gap:6,marginBottom:6}}><div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>Joueur</div><div style={{fontSize:9,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>{MT_LABELS[mt]}</div><div style={{fontSize:9,color:"#c4b5fd",fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>{compLabel}</div><div/></div>
          {rows.map(function(r,i){
            return <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 80px 24px",gap:6,marginBottom:6,alignItems:"center"}}><input value={r.player} onChange={function(e){updateRow(i,"player",e.target.value);}} placeholder="Nom" style={Object.assign({},inputStyle,{width:"100%"})}/><input type="number" step="0.5" value={r.anchor} onChange={function(e){updateRow(i,"anchor",e.target.value);}} placeholder="ex: 30.5" style={Object.assign({},inputStyle,{width:"100%",color:"#c4b5fd"})}/><input type="number" step="0.5" value={r.comp} onChange={function(e){updateRow(i,"comp",e.target.value);}} placeholder="ex: 15" style={Object.assign({},inputStyle,{width:"100%",color:"#00E676"})}/><button onClick={function(){setRows(function(p){return p.filter(function(_,j){return j!==i;});});}} style={{background:"none",border:"none",color:"#4a5a6e",cursor:"pointer",fontSize:14}}>×</button></div>;
          })}
          <div style={{display:"flex",gap:8,marginTop:8}}><button onClick={addRow} style={{flex:1,padding:"7px",borderRadius:7,border:"1px dashed rgba(124,58,237,.25)",background:"transparent",color:"#7C3AED",fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>+ Joueur</button><button onClick={save} disabled={!rows.some(function(r){return r.anchor!=="";} )}
              style={{flex:2,padding:"7px",borderRadius:7,border:"none",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
              Enregistrer ({rows.filter(function(r){return r.anchor!=="";}).length})
            </button></div></div>

        {/* Frequency table */}
        {buckets.length===0?(
          <div style={{textAlign:"center",padding:"24px",color:"#3a4a5e",fontSize:12}}>
            Aucune donnée pour {game} {MT_LABELS[mt]}<br/><span style={{fontSize:10}}>Ajoute des entrées ci-dessus pour compiler les ratios</span></div>
        ):(
          <>
          {/* Stats bar */}
          {(function(){
            var withComp=buckets.filter(function(d){return d.comp!==null;});
            if(!withComp.length)return null;
            var diffs=withComp.map(function(d){return d.comp-d.anchor/divisor;});
            var avg=diffs.reduce(function(s,v){return s+v;},0)/diffs.length;
            var exact=diffs.filter(function(d){return Math.abs(d)<0.01;}).length;
            var higher=diffs.filter(function(d){return d>0.01;}).length;
            var lower=diffs.filter(function(d){return d<-0.01;}).length;
            return <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
              {[
                {v:withComp.length,l:"Paires",c:"#c4b5fd"},
                {v:(avg>0?"+":"")+avg.toFixed(2),l:"Diff moy.",c:avg>0.05?"#00E676":avg<-0.05?"#f87171":"#9CA3AF"},
                {v:exact,l:"Exact",c:"#9CA3AF"},
                {v:higher,l:compLabel+" haut",c:"#00E676"},
                {v:lower,l:compLabel+" bas",c:"#f87171"},
              ].map(function(s){return <div key={s.l} style={{background:"rgba(124,58,237,.08)",border:"1px solid rgba(124,58,237,.12)",borderRadius:7,padding:"5px 10px"}}><div style={{fontSize:14,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:9,color:"#6a5a8e",textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div></div>;})}
            </div>;
          })()}

          {/* Frequency grid */}
          <div style={{overflowX:"auto",borderRadius:10,border:"1px solid rgba(139,92,246,.2)",marginBottom:12}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}><thead><tr style={{background:"rgba(0,0,0,.3)"}}><th style={{padding:"8px 10px",textAlign:"left",fontSize:9,fontWeight:700,color:"#6a5a8e",textTransform:"uppercase",letterSpacing:.6,whiteSpace:"nowrap"}}>{MT_LABELS[mt]}</th><th style={{padding:"8px 10px",textAlign:"center",fontSize:9,fontWeight:700,color:"#6a5a8e",textTransform:"uppercase",letterSpacing:.6}}>Théo</th><th style={{padding:"8px 10px",textAlign:"center",fontSize:9,fontWeight:700,color:"#6a5a8e",textTransform:"uppercase",letterSpacing:.6}}>N</th>
                  {compCols.map(function(c){
                    return <th key={c} style={{padding:"8px 8px",textAlign:"center",fontSize:10,fontWeight:700,color:"#c4b5fd",whiteSpace:"nowrap"}}>{c.toFixed(1)}</th>;
                  })}
                </tr></thead><tbody>
                {anchorLines.map(function(al){
                  var ak=al.toFixed(1);
                  var bucket=freq[ak];
                  var theo=(al/divisor).toFixed(2);
                  var maxCnt=Math.max.apply(null,Object.values(bucket.values).concat([1]));
                  return <tr key={al} style={{borderTop:"1px solid rgba(255,255,255,.03)"}}><td style={{padding:"9px 10px"}}><span style={{fontSize:14,fontWeight:800,color:"#c4b5fd"}}>{al.toFixed(1)}</span></td><td style={{padding:"9px 10px",textAlign:"center",color:"#4a5a6e",fontSize:11}}>{theo}</td><td style={{padding:"9px 10px",textAlign:"center",color:"#7a9cbd",fontWeight:600}}>{bucket.total}</td>
                    {compCols.map(function(c){
                      var ck=c.toFixed(1);
                      var cnt=bucket.values[ck]||0;
                      var pct=bucket.total>0?Math.round(cnt/bucket.total*100):0;
                      var delta=c-al/divisor;
                      var dc=delta>0.01?"#00E676":delta<-0.01?"#f87171":"#9CA3AF";
                      var deltaStr=delta>0.01?"+"+delta.toFixed(2):delta<-0.01?delta.toFixed(2):"≈0";
                      if(cnt===0)return <td key={c} style={{padding:"9px 8px",textAlign:"center",color:"#1a2a3a"}}>-</td>;
                      var bg=cnt===maxCnt?"rgba(124,58,237,.25)":pct>=20?"rgba(124,58,237,.1)":"rgba(124,58,237,.04)";
                      return <td key={c} style={{padding:"6px 8px",textAlign:"center"}}><div style={{background:bg,borderRadius:7,padding:"4px 6px",display:"inline-flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:36}}><span style={{fontSize:12,fontWeight:700,color:"#c4b5fd"}}>{cnt}×</span><span style={{fontSize:9,color:"#6B7280"}}>{pct}%</span><span style={{fontSize:9,fontWeight:700,color:dc}}>{deltaStr}</span></div></td>;
                    })}
                  </tr>;
                })}
              </tbody></table></div>

          {/* History */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}><span style={{fontSize:10,color:"#4a5a6e",fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>Historique ({buckets.length})</span><button onClick={clearAll} style={{fontSize:10,color:"#f87171",background:"none",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>🗑 Vider</button></div><div style={{maxHeight:160,overflowY:"auto"}}>
            {[...buckets].reverse().slice(0,30).map(function(d){
              var theo=(d.anchor/divisor).toFixed(2);
              var diff=d.comp!==null?d.comp-d.anchor/divisor:null;
              var dc=diff===null?"#6B7280":diff>0.01?"#00E676":diff<-0.01?"#f87171":"#9CA3AF";
              return <div key={d.ts} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid rgba(255,255,255,.03)",fontSize:11}}><span style={{color:"#E5E7EB",fontWeight:600,minWidth:70,textTransform:"capitalize"}}>{d.player}</span><span style={{color:"#c4b5fd",fontWeight:700}}>{d.anchor.toFixed(1)}</span><span style={{color:"#4a5a6e"}}>→ théo {theo}</span>
                {d.comp!==null&&<><span style={{color:"#00E676",fontWeight:700}}>{d.comp.toFixed(1)}</span><span style={{color:dc,fontWeight:700}}>{diff>0?"+":""}{diff!==null?diff.toFixed(2):""}</span></>}
                <span style={{color:"#2a3a4e",fontSize:9,marginLeft:"auto"}}>{d.date}</span><button onClick={function(){removeEntry(d.ts);}} style={{background:"none",border:"none",color:"#3a4a5e",cursor:"pointer",fontSize:12}}>×</button></div>;
            })}
          </div></>
        )}
      </div>}
    </div>
  );
}





}

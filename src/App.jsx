import React, { useState, useEffect, useRef, useMemo, useCallback, memo, forwardRef, useImperativeHandle } from "react";


// ── Normalize datetime helper ─────────────────────────────────────────────

// Logo NBA — SVG officiel Wikipedia, fond blanc supprimé, cercle
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

// ── Supabase — sync sans login ────────────────────────────────────────────
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
    const batch = await supaFetch(`/rest/v1/bets?select=id,player,description,overUnder,odds,stake,bookmaker,status,game,league,role,team,datetime,isHeadshot,isLive,mapTag,profit,tournament,splits,updatedAt,pp_map_type,pp_line,pp_edge,tipster&order=datetime.desc&limit=${limit}&offset=${offset}&archived=is.false`);
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
  // Forcer le format YYYY-MM-DDTHH:MM pour la datetime (éviter transformation Supabase)
  const safeDT=dt=>{
    if(!dt)return dt;
    const s=String(dt);
    if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s))return s.slice(0,16);
    return dt;
  };
  const now=Date.now();
  const rows = bets.map(({id,player,description,overUnder,odds,stake,bookmaker,
    status,game,league,role,team,datetime,isHeadshot,isLive,mapTag,profit,tournament,splits,updatedAt,
    ppMapType,ppLine,ppEdge,tipster})=>
    ({id,player,description,overUnder,odds,stake,bookmaker,status,game,league,role,
      team,datetime:safeDT(datetime),isHeadshot:!!isHeadshot,isLive:!!isLive,mapTag,profit,tournament,
      splits:splits&&splits.length>0?JSON.stringify(splits):null,
      updatedAt:updatedAt||now,archived:false,
      pp_map_type:ppMapType||null,pp_line:ppLine||null,pp_edge:ppEdge!=null?ppEdge:null,
      tipster:tipster||null}));
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
  if(game==="Pro A")return <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,background:"#003189",borderRadius:3,fontSize:Math.max(5,size-8),fontWeight:900,color:"#fff",flexShrink:0}}>FR</span>;
  if(game==="ACB")return <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,background:"#DA421F",borderRadius:3,fontSize:Math.max(5,size-8),fontWeight:900,color:"#fff",flexShrink:0}}>ES</span>;
  if(game==="Bundesliga")return <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,background:"#005AA0",borderRadius:3,fontSize:Math.max(5,size-8),fontWeight:900,color:"#fff",flexShrink:0}}>DE</span>;
  if(game==="Lega")return <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",width:size,height:size,background:"#006B38",borderRadius:3,fontSize:Math.max(5,size-8),fontWeight:900,color:"#fff",flexShrink:0}}>IT</span>;
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

// ── CandleChart — graphique style bourse ────────────────────────────────
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
  const full = await fetchAll("players_full","id,name,game,league,role,team,photo_url,team_logo_url,team_id,avatar_url,avatar_file");
  if (full !== null) return full;
  return await fetchAll("players","id,name,game,league,role,team,photo_url,avatar_url,avatar_file");
}

async function supaUpsertPlayer(data) {
  // data: { id?, name, game, league, role, team, avatar_url?, avatar_file? }
  const payload = {
    name: data.name.toLowerCase().trim(),
    game: data.game || "NBA",
    league: data.league || "",
    role: data.role || "",
    team: data.team || "",
    photo_url: data.photo_url || data.avatar_url || null,
    avatar_url: data.avatar_url || null,
    avatar_file: data.avatar_file || null,
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

const BK_LOGOS={
"Stake":"data:image/png;base64,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",
"Roobet":"data:image/png;base64,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",
"Rainbet":"data:image/png;base64,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",
"BCGame":"data:image/png;base64,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",
"Duel":"data:image/png;base64,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",
"Duelbits":"data:image/png;base64,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",
"Yeet":"data:image/png;base64,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",
"Thunderpick":"","Winna":"","Thrill":"","Spartans":"","Gambana":"data:image/png;base64,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","CrazyBet":"","Toshi":"data:image/jpeg;base64,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aaCSg9YKCj2HQR8888888+PCcvCCCCCCCCCX8ip18888885RF89CCCNNPCCC18pBW888888/PD8+iCEK9WgCGe8LLf8APPPPPPNiOPPCQNNeKnfPMAMvfPPPPPPMSQnQz8ZhyvZ98Yl3fPPPPPPO0QmeMOrLU3XNPJC0hvvPPPPPMKQkMIi88DsOUEsAAo3fPPPPPOYgggm+KkuogggggggqvPPPPOSQggglsQhTIwggggggtVfPPPJYAggg9xB9PIixhiQggkD/AHzzywIIILy5yRap+srzwIIIIFzzzKMIIILDi4mwckEOhkIIIJc/zykIIIIJDnzzpG1ZygoIIIILfzw0sIoAuWcBGALGJfncc44J9/zz6xCD/wCf8LuBCFeOE++MQAY+88888888888+pSf89988888888888888888889/98888888888888888888888888888888888888888888888888888888888888//EACoRAAECAgoDAAMBAQAAAAAAAAEAESAxECEwQVFhcYGRobHB0UBQ8OHx/9oACAEDAQE/EP3LuWGaquucq+5doKc4HsrP8rP8rP8AKz/Kz/KLlOD7VX1TnV3LtP5cWr4KkQIHYmW2Kfx8NhIJ06dOnTp06dP4+G4kUSAmOCW+CGAjiyPzsAjkjB3mfQT0NSyZNS1DoJI5dZj2EOncGxMQJn6D3xG6ewO4mfsPfNgEkoKccRNJshSe+wFCAEZiB/AKKFBhaEUFBESj/AEeeQI5CICxQjeMohMFlsAOBYHCC9Hsc+oWiaE5QXp9DmxKAORcZNM7yRhah6GhCEEwFzm8j6/7YGZmARkSkNLvtAheh4TQJkpHS/6gAzgxsR8XT/ZI2TxBORfj/kuIgPEU9KQ0EvsItTipSOhn9QGELwS52v8Am6MRoFBsAmklztd82hcBc739+IWT2LQtxG53u78wAwAVa3dohLmf4hCcTQgl4r1v7pZF6reB7iETp7F24qx4Pql1ZgG/tY3gezfUYF/7WkQDmodMdoWTJqHhdOmTQiAY1BpjvSAGKLHDAy2wQ5Zp3H1V4XYequ0LPOgA+qaEdSfTII3AB8pwO/CY+hYZY1up9Ii6BzDJqGRViE5B0NB4RRJj7hvLIJVkuuH0qSkNCfboieNQD8VeF0HurtHlmjcfUOOAuEt8UAGFoLYH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","Shock":"data:image/png;base64,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","Qzino":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAS5UlEQVR42u2a7ZNlVXXGf2vtc+/tvt0z3cwMwzCAAzOACVEJDoIKggSlKLGw1KTyWRL9A/xmVSo1VmLFVCpVSSXE8otlJSkrGisalYqAb6AiOohjJMoAIm/zPtMz0y/3nre9Vz7sfc493dMDiJQV43TX6Zdzz71n72ev9TzPWvvIYDAwfou/lN/yr3MAnAPgHADnADgHwDkAzgFwDoBzAJwD4Lf0K/t13kxE2sMs1mCGIUh7jZm1r/3/AEAEp0oIgbIsCSG86OXOObIsQ9N7fqMBcM5R1zWjPAeF7du3s2PXDra/5iI2zs/R7zl87clXChZOLHDo4CEOP3+I48cWKIox/X6fTHp46t8sAJowH41GDIdD/uC2W7n51lu4/PLL6Q8dZagZFWPKYkRRFJR1SVVXFPmYlVOLvPDCIf5n38/Y/9gTjBZXmJqaatPjVR/rq90Qcc5RliV1XXP7u+/gA3fdxaW7LmUlH7G0tMRovEheFeRlTlWNKfKSoi4oyoKyLLCQAw5fw7HDx/nhw4+y/8f7EVMylxEs/N8FwDnHaDxm0+ZN7NnzUW579x0sLa9w6vQCZZVT1zV5tUJZFuRFzrhYoSgKqrKkrErKsqCsxlRlxbjKMTFEhGefeJaH7n+E0allBv0eISgmrw4QLsuyPa9KLmUZo9GIXbuu4DOf+Sxvf/stnDi1QFmViAAS8LWnrAvMAiJgErEPwVNVFWVVUteRKOvgKauScT5mdn4jl+y4mONHj7G0uIRmDmGiKL/WCFh7QzMjyzLG4zGXXbaTL3zxHi66+DUcO3aUWiuKsmCcjxgXI5w6vM9ZOHGCw0cPc3zhGEVRohlkfYeqMM5HLI4W2zSKUVOgJoRxxbfv+wELR07Tz9anr1+WJ35lAESEEALDmSFf+fJXed3Vb+TkqUUEY1yPGI1HgAGevXv3ct89X2Hfvh9x7OgJqnHAMFxf2TA/5KKLt7Hzql2cf9EWimrMaDTCe4+vK4qyRCSjXM757r17KZYLnNNfDwAvFmaqymg04u5P/BN/cteHOHJ0gaw/AIOVfIWp6Sl+8fRT/M3H/5J7772XKi9QFbKsh6giCCFACBW1r9G+sGPnDq654WqGcwNWVkZ4HyOh8h7nepx44Sj7HnwMJ70E7pkAdM3WKwLg5eSWyxwryyvc/q7b+LfPfp5Tp0+TZT0gI9Rw3vw8Dzz4DT70wbs4eOAFpobTqCoWAsHi0IX4Q7A0aMjznMHMFNfd/Ea27tjEaGVECAEfPFXl6Tll/6PPcOCpw0z1lGAvPdazgXEGAC+XVAQIycx+5Z4vcs21b2J5eRlVRwjC3MZN7H34B/zh+9/D8soiw5lZ6rp+mWmmmC+pTdh989VsuXiO0WiMmeG9xzCqlcC+7/wMqnqVlf5lgXjFxZA6R5Hn3HLrTex+0xtZWjqFasCoGAwchw8f4IN/+gGWl5cYDodnmbytc4BZwOmATGDf9x7j1LFlzKCqKkLtqYuSbKBsunCOyvtfSQl0bZFyxhDl7AcC7/2jOzGtCFaCeLwvmJru8Vcf/wueffYXzM7M4uvwMic/WR2PR1yGL2qe+PHT+MqiRFYVVgeqqmZ+6wy9TAkvMs4Xc6oA+krQU1XKsmTLBedz/fW7GY+XUWfUvmB6OOAnj+3j8//+Oaamp1atfBfoFztWS2yPhaMLLBxZQIJS1TXee6pqzGCQMTXdB7OXn7qd60Rk/RRYD8HuAFWEuqx47VW72LJ9nnE1JmhNTUl/mPGlL9/DaDGn33MgARFDMcRCYo5wBnu397GAYpNDAmKBkwdPEKqauvZUVU1V1QSEwUwfCz5+/nogvkRUZK9EAhvSueKKnfSnlJXlGhFFHIyLEd976Pug4DFMZXXQv8RCqa1dDMO5HiuLY/K8wIj9gtoMdYF+rwfrMHwz7peSwl+iGrQJ/ycLu23bVsCDVJgpLss4dfI4zz33HJopASOIrQZOJvK33u9whq5HVSgqz3ick/UdFgxvRgiGZgoqDX12NOplWvj1VmRVnthkJVJ/o/382Y1DjBqjIiBkaqyMFhgtreAyBxjSmZDISw/N1gAgEgGvCZRFDjqFhQAG4jw+85AJgmIWzgBhLaewJgqzl+MB4iDkTNeFByqMOg4AAQvR4b3CQuXM90gLnvc1dVXFiRgo0VQ145LOGNeL/PXAyNa/qa25fQxSQ2MIp0RdXDpNwCcgPN57hjMDNmyY4eTJU2RZ1gnwzuqvuV2QAAKqgpiecYFajaoDU2rvwQTDyLwRyiZCQxyfZQiRSO2MJZPVP83I1g/KEDNWBNNJaBoWw1jiyYOHjmABAhUqUNcwNz9kx2Vbeebnz6FDw4KdNdCDTOxIsEB+smySfjL0tNoyPWCTgq9DrB/EUKCuQhyPGliHQdJniHWJUM6AIls/SjXV6wkKEYQw8esADn7+5LPkxRh1AbNAHQK9wYC33Hg137r3EdQF6k4HZ9W9JDKECPiqYtv2Tbz/IzvJ/QlCULRlcRhkGU8+PubbXz/Iho3TBBPMAl6FqqrayYhYG3EhvVeRjiKcyedZ4+i7qRADKA5Y8RHJDvtZMPpTffbvf5qDBw9wwQXzlFWNaM1yvsQ773wz/3j352Ktrw4jgBgqugoBl+xk1g8cOXKaxbzkw39+BYv1CmKGpjBFBF/3+Yc9Pb7wLz9n/rzZGHleqKuyk8Id3jFLgMfUNYueYi3Ruqw36Qi1b9ZoVmK4r0awOdfLepw+ucjrrvldrt59KaPRGJcZZVmz/eJ5TpxYYO8DP2Vm4zDeXJOJagkSRA1RA1GcCt+/93mOHe9z/U2zLJ3OyUeeoqgZj6IBets7zme0mPHId48zM6tUhaccVwgZnXmvGbd1zJiuYjkBXK/f29NuVoi2Ot8MuJu3qpGoTGMVUZU142rMne+9ibIsEA2IeMqq4prdV/LgAz/m8IHjDIc9zBr+OPNADBFlONvn0YcOMlqZ5pY7tuLJwRSXRfNQ1SNufMdWxrnjh985gRjUVQ2i6TMiqFgDRHcOEZlmI0aJ0ed6/RQBjUifRb5E4zGxlEZvWnn26SNc9+ar2Hn5NvJihIhR1xWzG5Rrr7uK++97hFOnlpmZ6SWdltWk3B6RwIYzyo8ePs7CgnLtDfOIVhBixJgJZZ1zw62bKccDHv76IQZTUxi+1akIgtJ1+e0CY5MGRPrl+oMmAgwjJCLpTlxSAzIFR7qBiuJ6SpHnHDl6gve870aqqoh8oUZejLnwkk289e2v5dFHnuD5ZxboTyn9fg/RDFFQ9aga4gTnFJcZ5pVxUXLkSMHNt+9gfnOF993VVMqi4C23bib4GX7wwAGmpwdxXNbhgiTZXR1sUs8QTCJROjdwewyDNuQ7BYVGzTc1UMMUxGkCIdbtg2GPJ/e/wKYtc7z1bb/H8vIKuJBAGLHtwhnedee1BAs89cRRTp1exvuKmG3RPIXgKXNjPK7Jph3vet9OPvr3b2LrxRZTS1wbKpIkuiiMG2+bw5jh4W8cYmrKgWZtaRwkxLZ6872KKCMRqoBMbRjY2hJRNKSOjxEa4lI6apB6bhJQBe9BHXzqX/+M3ddfysLJBbJedIU+lGQZDGccTz5+hK999TF+uPcpDjx3kvFojCH0h8oFF83xhmu2cdPtW/id18+SV0sUVYFItNpmUX3UJR43xQzm5mb41N8e5ZMfe5wNGw2z2GPE4t6iJjUxwIKuKo7MDBnOTVs8Ockfo25aJZgIqrJKChs1iwxuOCcURc3mLefxyU9/mCuv2srJkwtkmYB4glV4KxhMCYNBj6KoOHVqkZXlFcw8/aGy8TzHYLokL1cYj3NMS1CPWY33gcGU0B8Yy8tjsD6iFRYcZjA/P+TTf3eUT3zsMWaHvQiWJZuc5oaBWIaFkPxA5DyXDbLIAQrmLBYKGoFAJOaogHRZVkPMYTc53+8rS0srfPNr+3jdG3Zx+ZXbGefLBKsRFxAXKKua0XhEFXIG08bMnDHcCP2Bp65z8nGFrz1OLXWLjRACm8/byP6fjLn3P05yzfVb8D7HzMV7I4zzgutu2cDs8Hy+87Uj9LM0zob5m6htTGaHiF1/qrdHRQgCIbH8Kq1umgxqqItSKGqoWrpO2w+dnu6ztDTmq/c8zMxsn6t3X0a/rxRFQe3rqMXa7CUY3sfVjbvgFglYUpscYzDjGA77fOtLJ/nrj+zj/v88gDHLW26ZoyhzYlFoYI7xcsXutw2Znd3Eg/cfoucEzRoM4nwazxf7GXHcrj/M9iAB1NIApdX7SIQSlcCRVj0C04AUr1dEo7/qD+JNvnH/Pn762PNcuH0zF+2Yozd0+OAJtSf4CpMKM49ZwKzGrAbxuMwYDh2DqR5PPZ5z98d/yj/f/d+Yr9k432Pvgwfx+Sw3vHOewZQwNdVnaipjejrK7A03zbPtkq18/4FjhDoarMZrINL2J+KiGTJz3iCKhwrmmhXvlJdq7TnRyetNhCAW1UZDJ2pAnTJaLun1M65765W8446ref3vX8Lm83v0+iRuGMdSWurY6i5rTi7k/OwnR/jmfU/z0APPsrJobJiJSxlCXLulpYp3//HlvPb10xR52RYZZo7gCzbObeS/PneUfd87wqAfgQfaGkK8ICGqmMxsiipgYjH3u6GvxPxtKiuVFE6WfntI/lpaqztRE5dF0llZKQA4/4INXLprEzt2bmHL1iHDmQEixmg04vjRMc8/s8AzT5/m8MFlLFTMTA9xTql9lR6dASw2WpaXcryXqOkhSqOZEHzsGwxn+vQ0I3glWJ1qmMT8qcozDBmePzBEYsmgySGnsI6WOLG/hHaSDUCoj1WiaEoZXUUykt7rksOuypqyjF1dIKYVEHx0eVnm6PV69PoOAXywmCKh2yJrtryiccMUzLVNEkvEGYKkyafnjoJBiP3ECFrqCLX9cZW25Y1GudNWBaJkSCOH6idEmVoKoiEBSCxlk3JAVBYRoz9QBlPTbUSZpErTsrSCaYAWUgHVSLGmgccWm4VACIqYS10KHx+cCC42S6zpXsdoCYR27CE0/YS2JZZeFIsrIoZoDClVSasYK8Rm5SOTW5smEbi4vW14VOtGgRIQ2m5CSefBhnZLS0Ky6LH8ldS4s1TVmNTR0ZpEgyOTxqwFayvAIAELabymIBUahCQzWFIz8ymdgaxle6HV/CYaol21WFyotK81hqhRhJgWoaMO1omqTsrQ0edVm1OTToUFnTwul4q4JuxbN2iRg2IS6Kquj0n8EUIivFT5WeyOoEYi01hhZi2za1PoNOyeCK2RuqYGWEuSrTpYBwBdpSZNOqjqKju9tldnBrj4vMEqyxo0WVnDNBCCpZUXxElLblGObOL0QuSzQBMFUaLUCZYAyhpXhzYqEHNWJZFU8vuaiEy1I3UaUrNBUdeseEBVV6VJW8i03LBe775h+UTA7bl4PoRYlJkJEowQfIwWU0LTOEp7BW0jVwKWpLMBh4ZLUrpl2mlhtyuovl0xEdf25lvTI+l1J0CGc4o6S/xgbTdJnUzSqS2i9Cy7N92+nbTnQoDgY4kd/b2khyjr9jVN4Fnq4FqIi+Kc4GO9iSBYcIQQF7epnDMRQ6W7Ot1cjznrVGOF2Frg0PYERCRZZEFTJMSCSeN1oqtqcVE7gwS7PboYmrRSpwpBtVPgxIeqYpopKhDMt/KHNKoTo6ZVEps0e5oHtAJGptJ0e5oUCJ2VXmN/k1NUpynMNQLiLIGRrsWhrvERnV2hs26WdDc0JoRHKojU4upZgKAeDUIwJfhofMSUIKEjr5HxLUl5BCMQLEp1A7cGyCSRlqphSd8jAJK6NulDUl7HyTO5zlnnPU3uTwj1jMJKWbVZsh4HtIxvRlPRRgWIDB4CSMptEUFCTNOQkj14ixWg01QwTUCOzx9H7kAho9mIUXDtxJtwlxTuDpfRFkrOxZV0Lj4popIm7mJ6NIqhkrXgIqEjh7LO7q10nhZvIkESAJYmb7Fu8w6fFiYE8D5GrffWRq2vPWo+brokA6VpssHivoYFyLSp7VWimRHt/N+Eu0RwnOCcoC6gKdydixEUAUrc0Fn5xlKvKq1TTkg39LuPypvFQSbNNmtWPvr+4BTxcevd++hV4spmqbfrwcX3tGYCI5hrmzshBJRA1uSpph69pL/b8HaGc1kEwRGPLEVA1lxrKRq0fa8kQ6Stt+h4A+nuXsmqTn0I0lZ+1gHAguEDBO/Q5PZCaIqyDDPBC3hvqaNj4MOa/c6QJp4ew5nIoKaQD4nUaENdnZFlMaxcC0iMhvg3rU+IciidZkkDhiQwNFaPQttpXr2L2xiUifaHoCkVAurBS1IBjTtDPlntECxt1UcAtOlhNk5TOpGAIhbHmTnnWrsa/bymFdU0oRDPO8NlEQSX9D3+H8PcZbEIUpf0PzmuBohJZ8mdddu8yfWG9EICI/iUAgnoYIr3EFKh5sWQYG3dEVTwteIcCYDkAtNWXLNp4pzjfwGly4SquM25pQAAAABJRU5ErkJggg==","Betpanda":"data:image/jpeg;base64,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"};


// ── Constants ──────────────────────────────────────────────────────────────
const ALL_GAMES=["NBA","EuroLeague","Pro A","ACB","Bundesliga","Lega","HEBA"];
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
const POS_LABELS={PG:"Point Guard",SG:"Small Guard",SF:"Small Forward",PF:"Power Forward",C:"Center"};
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
const EL_LOGO_B64 = "data:image/png;base64,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";
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

// ── Logos ligues nationales EuroLeague ─────────────────────────────────────
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
  "Pro A":["JL Bourg","Paris Basketball","LDLC ASVEL","Cholet Basket","Nanterre 92","Metropolitans 92","Monaco","Roanne","Le Mans Sarthe","Orléans Loiret","Pau-Lacq-Orthez","Limoges CSP","Elan Chalon","Gravelines-Dunkerque","Strasbourg","Fos Provence","Champagne Basket","Châlons-Reims","Nancy","Hyères-Toulon"],
  "ACB":["Real Madrid","FC Barcelona","Baskonia Vitoria","Valencia Basket","Gran Canaria","Unicaja Málaga","Joventut","Breogán","Manresa","Zaragoza","Fuenlabrada","Obradoiro","Murcia","Bilbao Basket","Surne Bilbao","Tenerife","Betis","Estudiantes","Lenovo Tenerife","San Pablo Burgos"],
  "Lega":["EA7 Olimpia Milano","Virtus Bologna","Fenix Trento","Dolomiti Energia Trento","Umana Reyer Venezia","Pallacanestro Varese","Tortona","Brescia","Reggiana","Brindisi","Napoli","Pesaro","Trieste","Treviso","Cremona","Scafati","Pistoia","Forlì","Udine","Nardò"],
  "Bundesliga":["Bayern München","Alba Berlin","Bonn","Würzburg","Hamburg Towers","Ulm","Frankfurt","Bamberg","Göttingen","Chemnitz","Gießen","MHP Riesen Ludwigsburg","Braunschweig","Rostock Seawolves","Heidelberg","ratiopharm Ulm","Syntainics MBC","Veolia Towers","Jena","Tübingen"],
  "EuroLeague":["Real Madrid","FC Barcelona","Fenerbahce Beko","Anadolu Efes","Olympiacos","Panathinaikos","Partizan","Crvena zvezda","Maccabi Tel Aviv","EA7 Olimpia Milano","Virtus Bologna","Monaco","Baskonia","Bayern München","Alba Berlin","Asvel Villeurbanne","Valencia Basket","Paris Basketball","Zalgiris Kaunas","Strasbourg","Zaragoza"],
};

const STATUS_CFG={
  pending:{label:"En attente",color:"#3B82F6",bg:"rgba(96,165,250,0.1)"},
  won:{label:"Gagné",color:"#00E676",bg:"rgba(34,197,94,0.1)"},
  lost:{label:"Perdu",color:"#EF4444",bg:"rgba(248,113,113,0.1)"},
};
const EMPTY_FORM={player:"",overUnder:"",description:"",odds:"",stake:"",bookmaker:"",status:"pending",autoInfo:null,datetime:"",isHeadshot:false,mapTag:"Match",isLive:false,mapLocked:false,ppMapType:"",ppDescription:"",calcBkLine:"",calcPPLine:"",calcMapType:"Match",calcOU:"Over",announceOuts:[],selCat:null,betType:null};
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
                    ?<img src={optimizePhotoUrl(p.photo_url)} style={{width:36,height:36,objectFit:"cover",objectPosition:"50% 0%"}} alt={key} onError={e=>{e.target.style.display="none";}}/>
                    :<span style={{fontSize:14,fontWeight:700,color:"#6B7280"}}>{key[0].toUpperCase()}</span>
                  }
                </div>
                <div style={{flex:1,minWidth:0}}><span style={{fontWeight:700,fontSize:14,color:"#E5E7EB"}}>{key.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}</span><div style={{fontSize:11,color:"#6B7280",marginTop:1,display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                    {p.team&&(()=>{const tl=p.game==="EuroLeague"?EL_TEAM_LOGOS[p.team]:NBA_TEAM_LOGOS[p.team];return(<><span style={{display:"inline-flex",alignItems:"center",gap:3,color:"#9CA3AF"}}>{tl&&<img src={tl} style={{width:13,height:13,objectFit:"contain"}} alt=""/>}{p.team}</span></>);})()}
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
            {ebLive?"🔴 LIVE — Pari en direct":"LIVE — Pari prématch"}
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
    if(bet.game==="EuroLeague")return EL_TEAM_LOGOS[team]||null;
    if(bet.game==="NBA")return NBA_TEAM_LOGOS[team]||null;
    return null;
  })();

  return(
    <div style={{borderBottom:"1px solid rgba(255,255,255,.1)",WebkitTapHighlightColor:"transparent",contain:"layout style",borderLeft:"2.5px solid "+(isPending?"#60a5fa":isWon?"#00E676":"#f43f5e"),background:"transparent",position:"relative",transition:"all .15s"}}><div onClick={()=>setOpen(v=>!v)} style={{padding:"11px 13px 11px 12px",cursor:"pointer",userSelect:"none",WebkitUserSelect:"none"}}><div style={{display:"flex",alignItems:"center",gap:11}}>

          {/* Logo équipe ou championnat */}
          <div style={{width:37,height:37,borderRadius:9,overflow:"hidden",flexShrink:0,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            {teamLogoSrc
              ? <img src={teamLogoSrc} style={{width:32,height:32,objectFit:"contain"}} alt={bet.team} onError={e=>{e.target.style.display="none";}}/>
              : <GameLogo game={bet.game} size={30}/>
            }
          </div>

          {/* Centre */}
          <div style={{flex:1,minWidth:0}}>
            {/* Ligne 1 : Nom joueur + logo ligue + stat */}
            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3,overflow:"hidden"}}>
              <span style={{fontWeight:800,fontSize:14.5,color:"#f0f4ff",letterSpacing:"-.4px",lineHeight:1,flexShrink:0,whiteSpace:"nowrap"}}>{(bet.player||"").split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}</span>
              <GameLogo game={bet.game} size={14}/>
              {descLine&&<span style={{fontSize:12,color:"#8a9eb8",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:1}}>{descLine}</span>}
              {bet.splits&&bet.splits.length>0&&<span style={{fontSize:8,color:"#00E676",background:"rgba(74,222,128,.1)",border:"1px solid rgba(74,222,128,.2)",borderRadius:4,padding:"1px 5px",fontWeight:700,flexShrink:0}}>{1+bet.splits.length}</span>}
            </div>
            {/* Ligne 2 : @odds · bk logo · mise · tag ANNONCE */}
            <div style={{display:"flex",alignItems:"center",gap:0,flexWrap:"nowrap",overflow:"hidden"}}>
              <span style={{fontSize:12,fontWeight:700,color:"#7a9cbd",letterSpacing:"-.1px",flexShrink:0}}>@{bet.odds}</span>
              {(bkLogo||bet.bookmaker)&&<span style={{color:"#2e3d50",margin:"0 4px",fontSize:11,lineHeight:1,flexShrink:0}}>·</span>}
              {bkLogo?(<img src={bkLogo} alt={bet.bookmaker} style={{width:14,height:14,objectFit:"contain",flexShrink:0}}/>):bet.bookmaker?(<span style={{fontSize:11,fontWeight:700,color:"#7a9cbd",flexShrink:0}}>{bet.bookmaker}</span>):null}
              {bet.stake&&<><span style={{color:"#2e3d50",margin:"0 4px",fontSize:11,lineHeight:1,flexShrink:0}}>·</span><span style={{fontSize:12,fontWeight:700,color:"#7a9cbd",flexShrink:0}}>{bet.stake}$</span></>}
              {hasAnnounce&&<><span style={{color:"#2e3d50",margin:"0 4px",fontSize:11,lineHeight:1,flexShrink:0}}>·</span><span style={{fontSize:8,fontWeight:800,color:"#f97316",background:"rgba(249,115,22,.13)",border:"1px solid rgba(249,115,22,.35)",borderRadius:4,padding:"1px 5px",letterSpacing:.3,flexShrink:0}}>ANNONCE</span></>}
              {bet.tipster&&<><span style={{color:"#2e3d50",margin:"0 4px",fontSize:11,flexShrink:0}}>·</span><span style={{fontSize:11,color:"#a78bfa",fontWeight:600,flexShrink:0}}>{bet.tipster}</span></>}
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

// ── SelectionModal — sélection multiple + date + tournoi ────────────────────
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
            {["NBA","EuroLeague","Pro A","ACB","Bundesliga","Lega","HEBA"].map(g=>{
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
                          </div><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:6,overflow:"hidden"}}><GameLogo game={b.game} size={16}/><span style={{fontSize:13,fontWeight:700,color:"#E5E7EB",textTransform:"capitalize",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.player} <span style={{color:"#6B7280",fontWeight:400,fontSize:12}}>— {b.description}</span></span></div><div style={{fontSize:11,color:"#6B7280",marginTop:2}}>@{b.odds} · {b.stake}$ · {b.datetime?String(b.datetime).slice(0,10):""}</div></div><div style={{fontSize:13,fontWeight:700,color:b.status==="won"?"#00E676":b.status==="lost"?"#EF4444":"#3B82F6",flexShrink:0}}>
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
            <span style={{fontSize:11,color:"#6B7280",fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>🎯 Tipster</span>
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
function optimizePhotoUrl(url){
  if(!url) return url;
  // NBA CDN : passer de 1040x760 à 260x190 (même qualité, plus petit, mieux cadrée)
  if(url.includes("cdn.nba.com/headshots/nba/latest/1040x760/")){
    return url // garder 1040x760 — meilleure qualité sur Retina;
  }
  // ESPN full → ESPN combiner avec crop portrait
  if(url.includes("espncdn.com/i/headshots/nba/players/full/")){
    const id=url.split("/").pop().replace(".png","");
    return `https://a.espncdn.com/combiner/i?img=/i/headshots/nba/players/full/${id}.png&w=200&h=145&scale=crop`;
  }
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
                  {p.photo_url&&<img src={p.photo_url} style={{width:18,height:18,borderRadius:"50%",objectFit:"cover"}} onError={e=>e.target.style.display="none"} alt=""/>}
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
  const ALL_GAMES=["NBA","EuroLeague","Pro A","ACB","Bundesliga","Lega","HEBA"];
  const POS_LIST=[
    {key:"PG",label:"Point Guard",color:"#a78bfa"},
    {key:"SG",label:"Small Guard",color:"#60a5fa"},
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
  const STORAGE_KEY="v7_annonce_tracker";
  function load(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");}catch(e){return[];}}
  function save(data){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data));}catch(e){}}
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
                  {p.photo_url&&<img src={p.photo_url} style={{width:26,height:26,borderRadius:"50%",objectFit:"cover"}} onError={e=>e.target.style.display="none"} alt=""/>}
                  <div><div style={{fontWeight:700,fontSize:13}}>{p.name}</div><div style={{fontSize:10,color:"#6B7280"}}>{p.team} · {p.role}</div></div>
                </button>
              ))}
            </div>
          )}
          {ownTeam&&(
            <div style={{marginTop:10}}>
              <div style={{fontSize:11,color:"#6B7280",marginBottom:6,fontWeight:700,textTransform:"uppercase",letterSpacing:.8}}>Joueurs OUT — quelle équipe ?</div>
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
        <div style={{textAlign:"center",padding:"32px 16px",color:"#4a5a6e"}}><div style={{fontSize:28,marginBottom:8}}>📋</div><div style={{fontSize:13,fontWeight:600}}>Aucune annonce trackée</div><div style={{fontSize:11,marginTop:4}}>Ajoute une annonce NBA pour voir comment les lignes bougent</div></div>
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
  const STORAGE_KEY="v7_victoire_bets";
  function loadVB(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");}catch(e){return[];}}
  function saveVB(d){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}catch(e){}}
  const LEAGUES=["Pro A","ACB","Lega","Bundesliga","EuroLeague"];
  const HANDICAP_VALUES=[];for(let v=0.5;v<=34.5;v+=0.5)HANDICAP_VALUES.push(v);
  function getDefaultCompet(date){const d=date?new Date(date):new Date();const dow=d.getDay();return(dow>=2&&dow<=5)?"euro":"champ";}
  const [vBets,setVBets]=useState(loadVB);
  const [form,setForm]=useState({bookmaker:"",league:"Pro A",team:"",betType:"victoire",handicapSign:"+",handicapVal:"3.5",opponent:"",odds:"",stake:"",datetime:new Date().toISOString().slice(0,16),competitionType:getDefaultCompet(new Date()),outPlayers_own:[],outPlayers_opp:[],note:"",status:"pending"});
  const [outSectionOpen,setOutSectionOpen]=useState(false);
  const [outSide,setOutSide]=useState("own");
  const teams=EURO_TEAMS[form.league]||[];
  const opponents=teams.filter(t=>t!==form.team);
  function getPlayersOfTeam(teamName){return Object.values(allPlayers).filter(p=>p.team===teamName);}
  function toggleOut(side,name){const field=side==="own"?"outPlayers_own":"outPlayers_opp";setForm(f=>({...f,[field]:f[field].includes(name)?f[field].filter(x=>x!==name):[...f[field],name]}));}
  function getBetDescription(){if(!form.team)return"";if(form.betType==="victoire")return"Victoire "+form.team;return form.team+" "+(form.handicapSign==="+"?"+":"-")+parseFloat(form.handicapVal).toFixed(1);}
  function addVBet(){
    if(!form.bookmaker||!form.team||!form.odds||!form.stake){showToast("Remplis tous les champs requis","#EF4444");return;}
    const descr=getBetDescription();
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
  const inp={width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,padding:"9px 12px",color:"#E5E7EB",fontSize:13,fontFamily:"Inter,sans-serif",outline:"none",boxSizing:"border-box"};
  const sel={...inp,cursor:"pointer"};
  const cardS={background:"rgba(10,16,34,.98)",border:"1px solid rgba(255,255,255,.07)",borderRadius:12,marginBottom:10,overflow:"hidden"};
  return(
    <div>
      {settled.length>0&&(
        <div style={{background:"rgba(124,58,237,.08)",border:"1px solid rgba(124,58,237,.2)",borderRadius:12,padding:"12px 14px",marginBottom:12}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,textAlign:"center"}}>
            <div><div style={{fontSize:18,fontWeight:900,color:totalProfit>=0?"#22C55E":"#f87171"}}>{totalProfit>=0?"+":""}{totalProfit.toFixed(0)}$</div><div style={{fontSize:9,color:"#6B7280",fontWeight:700,textTransform:"uppercase",marginTop:2}}>Profit</div></div>
            <div><div style={{fontSize:18,fontWeight:900,color:wr>=55?"#22C55E":wr<45?"#f87171":"#9CA3AF"}}>{wr.toFixed(0)}%</div><div style={{fontSize:9,color:"#6B7280",fontWeight:700,textTransform:"uppercase",marginTop:2}}>Win Rate</div></div>
            <div><div style={{fontSize:18,fontWeight:900,color:"#E5E7EB"}}>{settled.length}</div><div style={{fontSize:9,color:"#6B7280",fontWeight:700,textTransform:"uppercase",marginTop:2}}>Paris</div></div>
          </div>
        </div>
      )}
      <div style={cardS}><div style={{padding:"14px"}}>
        <div style={{fontSize:12,fontWeight:800,color:"#a78bfa",textTransform:"uppercase",letterSpacing:.8,marginBottom:12}}>Nouveau pari victoire / handicap</div>
        {/* Bookmaker */}
        <div style={{marginBottom:10}}><div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Bookmaker</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {bookmakers.slice(0,8).map(bk=>{const logo=BK_LOGOS[bk]||bkPhotos[bk]||null;const on=form.bookmaker===bk;return(
              <button key={bk} onClick={()=>setForm(f=>({...f,bookmaker:bk}))} style={{width:44,height:44,borderRadius:10,border:"1.5px solid "+(on?"#A78BFA":"rgba(255,255,255,.08)"),background:on?"rgba(124,58,237,.15)":"rgba(255,255,255,.02)",cursor:"pointer",padding:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {logo?<img src={logo} alt={bk} style={{width:30,height:30,borderRadius:7,objectFit:"cover"}}/>:<span style={{fontSize:10,fontWeight:700,color:on?"#A78BFA":"#6B7280"}}>{bk.slice(0,3)}</span>}
              </button>
            );})}
          </div>
        </div>
        {/* Ligue */}
        <div style={{marginBottom:10}}><div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Ligue</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {LEAGUES.map(lg=>{const on=form.league===lg;return(
              <button key={lg} onClick={()=>setForm(f=>({...f,league:lg,team:"",opponent:"",competitionType:getDefaultCompet(f.datetime)}))} style={{display:"flex",alignItems:"center",gap:5,padding:"6px 10px",borderRadius:8,border:"1.5px solid "+(on?"rgba(124,58,237,.5)":"rgba(255,255,255,.08)"),background:on?"rgba(124,58,237,.12)":"rgba(255,255,255,.02)",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                <GameLogo game={lg} size={16}/><span style={{fontSize:11,fontWeight:700,color:on?"#a78bfa":"#6B7280"}}>{lg}</span>
              </button>
            );})}
          </div>
        </div>
        {/* Équipe */}
        <div style={{marginBottom:10}}><div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Équipe</div>
          <select style={sel} value={form.team} onChange={e=>setForm(f=>({...f,team:e.target.value}))}>
            <option value="">Choisir une équipe…</option>
            {teams.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {/* Type bet */}
        <div style={{marginBottom:10}}><div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Type de pari</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {["victoire","handicap"].map(t=>(
              <button key={t} onClick={()=>setForm(f=>({...f,betType:t}))} style={{padding:"10px",borderRadius:10,border:"1.5px solid "+(form.betType===t?"rgba(124,58,237,.5)":"rgba(255,255,255,.07)"),background:form.betType===t?"rgba(124,58,237,.12)":"rgba(255,255,255,.02)",color:form.betType===t?"#a78bfa":"#6B7280",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                {t==="victoire"?"🏆 Victoire":"📊 Handicap"}
              </button>
            ))}
          </div>
        </div>
        {/* Handicap */}
        {form.betType==="handicap"&&(
          <div style={{marginBottom:10}}><div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Handicap</div>
            <div style={{display:"grid",gridTemplateColumns:"80px 1fr",gap:6}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
                {["+","-"].map(s=>(
                  <button key={s} onClick={()=>setForm(f=>({...f,handicapSign:s}))} style={{padding:"10px",borderRadius:8,border:"1.5px solid "+(form.handicapSign===s?(s==="+"?"rgba(34,197,94,.5)":"rgba(248,113,113,.5)"):"rgba(255,255,255,.07)"),background:form.handicapSign===s?(s==="+"?"rgba(34,197,94,.1)":"rgba(248,113,113,.1)"):"rgba(255,255,255,.02)",color:form.handicapSign===s?(s==="+"?"#22C55E":"#f87171"):"#6B7280",fontWeight:900,fontSize:16,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{s}</button>
                ))}
              </div>
              <select style={sel} value={form.handicapVal} onChange={e=>setForm(f=>({...f,handicapVal:e.target.value}))}>
                {HANDICAP_VALUES.map(v=><option key={v} value={String(v)}>{v.toFixed(1)}</option>)}
              </select>
            </div>
            {form.team&&<div style={{marginTop:6,fontSize:12,color:"#c4b5fd",fontWeight:700}}>→ {form.team} {form.handicapSign}{parseFloat(form.handicapVal).toFixed(1)}</div>}
          </div>
        )}
        {/* Adversaire */}
        <div style={{marginBottom:10}}><div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Équipe adverse</div>
          <select style={sel} value={form.opponent} onChange={e=>setForm(f=>({...f,opponent:e.target.value}))}>
            <option value="">Choisir équipe adverse…</option>
            {opponents.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        {/* Compétition */}
        <div style={{marginBottom:10}}><div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:5}}>Compétition <span style={{fontSize:9,color:"#4a5a6e",fontWeight:500}}>(auto selon le jour)</span></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {[{k:"champ",l:"🏀 Championnat"},{k:"euro",l:"🌍 Euroligue/Eurocup"}].map(c=>(
              <button key={c.k} onClick={()=>setForm(f=>({...f,competitionType:c.k}))} style={{padding:"9px",borderRadius:9,border:"1.5px solid "+(form.competitionType===c.k?"rgba(124,58,237,.5)":"rgba(255,255,255,.07)"),background:form.competitionType===c.k?"rgba(124,58,237,.1)":"rgba(255,255,255,.02)",color:form.competitionType===c.k?"#a78bfa":"#6B7280",fontWeight:700,fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{c.l}</button>
            ))}
          </div>
        </div>
        {/* Annonces OUT */}
        <div style={{marginBottom:10}}>
          <button onClick={()=>setOutSectionOpen(v=>!v)} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.07)",borderRadius:8,padding:"9px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
            <span style={{fontSize:12,fontWeight:700,color:(form.outPlayers_own.length+form.outPlayers_opp.length)>0?"#f87171":"#6B7280"}}>📣 Annonces OUT{(form.outPlayers_own.length+form.outPlayers_opp.length)>0&&" ("+(form.outPlayers_own.length+form.outPlayers_opp.length)+")"}</span>
            <span style={{color:"#4a5a6e",fontSize:11}}>{outSectionOpen?"▲":"▼"}</span>
          </button>
          {outSectionOpen&&(
            <div style={{border:"1px solid rgba(255,255,255,.07)",borderTop:"none",borderRadius:"0 0 8px 8px",padding:"10px 12px"}}>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                {[{k:"own",l:form.team||"Mon équipe"},{k:"opp",l:form.opponent||"Équipe adverse"}].map(s=>(
                  <button key={s.k} onClick={()=>setOutSide(s.k)} style={{flex:1,padding:"7px",borderRadius:7,border:"1.5px solid "+(outSide===s.k?"rgba(239,68,68,.4)":"rgba(255,255,255,.07)"),background:outSide===s.k?"rgba(239,68,68,.08)":"transparent",color:outSide===s.k?"#f87171":"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{s.l}</button>
                ))}
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {getPlayersOfTeam(outSide==="own"?form.team:form.opponent).map(p=>{
                  const field=outSide==="own"?"outPlayers_own":"outPlayers_opp";
                  const isOut=form[field].includes(p.name);
                  return(<button key={p.name} onClick={()=>toggleOut(outSide,p.name)} style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid "+(isOut?"rgba(239,68,68,.5)":"rgba(255,255,255,.07)"),background:isOut?"rgba(239,68,68,.1)":"rgba(255,255,255,.02)",color:isOut?"#f87171":"#8a9eb8",fontSize:11,fontWeight:isOut?700:400,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{isOut?"❌ ":""}{p.name}</button>);
                })}
                {getPlayersOfTeam(outSide==="own"?form.team:form.opponent).length===0&&<div style={{fontSize:11,color:"#4a5a6e"}}>{outSide==="own"&&!form.team?"Sélectionne une équipe":outSide==="opp"&&!form.opponent?"Sélectionne l'adversaire":"Pas de joueurs enregistrés pour cette équipe"}</div>}
              </div>
            </div>
          )}
        </div>
        {/* Cote + Mise */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          <div><div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:4}}>Cote</div><input style={inp} type="number" step="0.01" placeholder="ex: 1.85" value={form.odds} onChange={e=>setForm(f=>({...f,odds:e.target.value}))}/></div>
          <div><div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:4}}>Mise ($)</div><input style={inp} type="number" step="1" placeholder="ex: 50" value={form.stake} onChange={e=>setForm(f=>({...f,stake:e.target.value}))}/></div>
        </div>
        <div style={{marginBottom:8}}><div style={{fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:.6,marginBottom:4}}>Date/Heure</div>
          <input style={inp} type="datetime-local" value={form.datetime} onChange={e=>setForm(f=>({...f,datetime:e.target.value,competitionType:getDefaultCompet(e.target.value)}))}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:10}}>
          {["pending","won","lost"].map(s=>(
            <button key={s} onClick={()=>setForm(f=>({...f,status:s}))} style={{padding:"9px",borderRadius:9,border:"1.5px solid "+(form.status===s?STATUS_C[s]+"66":"rgba(255,255,255,.07)"),background:form.status===s?STATUS_C[s]+"18":"rgba(255,255,255,.02)",color:form.status===s?STATUS_C[s]:"#6B7280",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
              {s==="pending"?"⏳ Attente":s==="won"?"✓ Gagné":"✗ Perdu"}
            </button>
          ))}
        </div>
        {form.team&&form.odds&&<div style={{padding:"8px 12px",background:"rgba(124,58,237,.08)",borderRadius:8,marginBottom:10,fontSize:12,color:"#c4b5fd",fontWeight:600}}>{getBetDescription()} vs {form.opponent||"?"} @{form.odds} · {form.stake||"?"}$ · {form.competitionType==="euro"?"🌍 Euro":"🏀 Championnat"}</div>}
        <button onClick={addVBet} style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:"linear-gradient(135deg,#7C3AED,#3B82F6)",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>+ Ajouter le pari</button>
      </div></div>
      {vBets.length===0?(
        <div style={{textAlign:"center",padding:"32px 16px",color:"#4a5a6e"}}><div style={{fontSize:28,marginBottom:8}}>🏆</div><div style={{fontSize:13,fontWeight:600}}>Aucun pari victoire enregistré</div></div>
      ):vBets.map(b=>{
        const isPending=b.status==="pending";const isWon=b.status==="won";const col=STATUS_C[b.status];
        return(
          <div key={b.id} style={{...cardS,borderLeft:"3px solid "+col+"33"}}><div style={{padding:"12px 14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}><GameLogo game={b.league} size={14}/><span style={{fontSize:11,color:"#6B7280"}}>{b.league} · {b.competition==="euro"?"🌍":"🏀"}</span></div>
                <div style={{fontWeight:800,fontSize:14,color:"#E5E7EB"}}>{b.description}</div>
                {b.opponent&&<div style={{fontSize:11,color:"#6B7280",marginTop:1}}>vs {b.opponent}</div>}
                <div style={{fontSize:10,color:"#6B7280",marginTop:2}}>@{b.odds} · {b.stake}$ · {b.bookmaker}</div>
              </div>
              <div style={{fontWeight:800,fontSize:16,color:isPending?"#3B82F6":isWon?"#22C55E":"#f87171"}}>{isPending?"@"+b.odds:((b.profit||0)>=0?"+":"")+(b.profit||0).toFixed(0)+"$"}</div>
            </div>
            {((b.outPlayers_own||[]).length+(b.outPlayers_opp||[]).length)>0&&(
              <div style={{marginTop:6,display:"flex",flexWrap:"wrap",gap:4}}>
                {(b.outPlayers_own||[]).map(o=><span key={o} style={{fontSize:9,fontWeight:700,color:"#f87171",background:"rgba(239,68,68,.1)",padding:"1px 6px",borderRadius:8}}>❌ {o}</span>)}
                {(b.outPlayers_opp||[]).map(o=><span key={o} style={{fontSize:9,fontWeight:700,color:"#fb923c",background:"rgba(251,146,60,.1)",padding:"1px 6px",borderRadius:8}}>❌ adv {o}</span>)}
              </div>
            )}
            {isPending&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:10}}>
                <button onClick={()=>updateVStatus(b.id,"won")} style={{padding:"8px",borderRadius:8,border:"1px solid rgba(34,197,94,.3)",background:"rgba(34,197,94,.06)",color:"#22C55E",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>✓ Gagné</button>
                <button onClick={()=>updateVStatus(b.id,"lost")} style={{padding:"8px",borderRadius:8,border:"1px solid rgba(248,113,113,.3)",background:"rgba(248,113,113,.06)",color:"#f87171",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>✗ Perdu</button>
              </div>
            )}
            <button onClick={()=>deleteVBet(b.id)} style={{background:"none",border:"none",color:"#3a4a5e",fontSize:11,cursor:"pointer",fontFamily:"Inter,sans-serif",padding:0,marginTop:6}}>🗑 Supprimer</button>
          </div></div>
        );
      })}
    </div>
  );
}

// ── PariCombineView ────────────────────────────────────────────────────────────
function PariCombineView({bets,allPlayers,bookmakers,bkPhotos,BK_LOGOS,showToast}){
  const STORAGE_KEY="v7_combine_bets";
  function loadCB(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");}catch(e){return[];}}
  function saveCB(d){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}catch(e){}}
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
                  {p.photo_url&&<img src={p.photo_url} style={{width:28,height:28,borderRadius:"50%",objectFit:"cover",flexShrink:0}} onError={e=>e.target.style.display="none"} alt=""/>}
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
            <div style={{fontSize:11,color:s.direction==="Over"?"#22C55E":"#60a5fa",fontWeight:700,marginTop:6}}>{s.direction} {parseFloat(s.value).toFixed(1)} {s.betType} — {s.player}</div>
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
        <div style={{textAlign:"center",padding:"32px 16px",color:"#4a5a6e"}}><div style={{fontSize:28,marginBottom:8}}>🎯</div><div style={{fontSize:13,fontWeight:600}}>Aucun pari combiné enregistré</div></div>
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
  const [players,setPlayers]=useState({
    "zywoo":{id:1,name:"ZywOo",game:"NBA",league:"",role:"PG",team:"Vitality",avatar_url:"data:image/webp;base64,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",avatar_file:null}
  }); // { name_lowercase: {id,name,game,league,role,team,avatar_url,avatar_file} }

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
  const [form,setForm]=useState({...EMPTY_FORM,datetime:nowDT()});
  const [stickyBK,setStickyBK]=useState(false);
  const [lockedStatus,setLockedStatus]=useState(null);
  const [tipsterName,setTipsterName]=useState("");
  const [lockedTipster,setLockedTipster]=useState(false);
  const [savedTipsters,setSavedTipsters]=useState(()=>{try{return JSON.parse(localStorage.getItem("v7_saved_tipsers")||"[]");}catch(e){return[];}});
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
  const [suiviOpen,setSuiviOpen]=useState({tournois:true,bookmakers:false,prizepicks:false});
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
  // Persister MIB dans localStorage
  useEffect(()=>{try{localStorage.setItem("v7_mib_active",mibActive?"1":"0");localStorage.setItem("v7_mib_date",mibDate);}catch(e){}},[mibActive,mibDate]);
  const [statsPeriod,setStatsPeriod]=useState(null);
  const [statsChartMode,setStatsChartMode]=useState("line");
  const [playersExpanded,setPlayersExpanded]=useState(null);
  const [playerSortKey,setPlayerSortKey]=useState("profit");
  const [playerMinBets,setPlayerMinBets]=useState(1);
  const [testingOpen,setTestingOpen]=useState(false);
  const DEFAULT_TEST_FILTER={games:new Set(["NBA","EuroLeague","Pro A","ACB","Bundesliga","Lega","HEBA"]),headshot:"all",live:"all",oddsMin:"",oddsMax:"",hideTourneys:new Set(),hideLeagues:new Set(),hideRoles:new Set(),ppEdgeMin:"",ppEdgeMax:"",overUnder:"all"};
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
      // Charger les joueurs depuis Supabase (table "players")
      supaFetchPlayers().then(rows=>{
        if(rows && rows.length > 0) {
          const obj = {};
          rows.forEach(p => {
            obj[p.name.toLowerCase()] = {
              id: p.id,
              name: p.name,
              game: p.game,
              league: p.league,
              role: p.role,
              team: p.team,
              photo_url: p.photo_url || null,
              team_logo_url: p.team_logo_url || null,
              avatar_url: p.avatar_url || null,
              avatar_file: p.avatar_file || null,
            };
          });
          // Migrate roles to short form
          var RMIG={"Top Laner":"Top","Toplaner":"Top","Bot Laner":"Bot","Botlaner":"Bot","Mid Laner":"Mid","Midlaner":"Mid","Jungler":"Jungle","jungler":"Jungle","Jngl":"Jungle","Jng":"Jungle","Support":"Support","Sup":"Support","Supp":"Support"};
          Object.keys(obj).forEach(function(k){var r=obj[k].role;if(r&&RMIG[r])obj[k]=Object.assign({},obj[k],{role:RMIG[r]});});
          setPlayers(obj);
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
      const bp=localStorage.getItem("v7_bkphotos"); if(bp)setBkPhotos(JSON.parse(bp));
      const tv=localStorage.getItem("v7_tourneys"); if(tv)setActiveTourneys(JSON.parse(tv));
      const stv=localStorage.getItem("v7_saved_tourneys"); if(stv)setSavedTourneys(JSON.parse(stv));
      // Restaurer le BK sticky de la session précédente
      const sbk=localStorage.getItem("v7_sticky_bk");
      if(sbk){const d=JSON.parse(sbk);setStickyBK(d.active||false);setForm(f=>({...f,bookmaker:d.bk||""}));}
    }catch(e){}
    setLoaded(true);
  },[]);

  // Persister stickyBK + bookmaker actif
  useEffect(()=>{
    if(!loaded)return;
    try{localStorage.setItem("v7_sticky_bk",JSON.stringify({active:stickyBK,bk:stickyBK?form.bookmaker:""}));}catch(e){}
  },[stickyBK,form.bookmaker,loaded]);
  useEffect(()=>{if(!loaded)return;try{localStorage.setItem("v7_locked_status",lockedStatus||"");}catch(e){}},[lockedStatus,loaded]);
  useEffect(()=>{try{localStorage.setItem("v7_depots",JSON.stringify(depots));}catch(e){}},[depots]);
  useEffect(()=>{try{localStorage.setItem("v7_bk_accounts",JSON.stringify(bkAccounts));}catch(e){}},[bkAccounts]);

  // Persister tournois actifs + savedTourneys + MIB + testFilter → localStorage + Supabase
  useEffect(()=>{
    if(!loaded)return;
    try{
      localStorage.setItem("v7_tourneys",JSON.stringify(activeTourneys));
      localStorage.setItem("v7_saved_tourneys_bk",JSON.stringify(savedTourneys));
      // Serialize testFilter (Sets → Arrays for JSON)
      const serFilter={...testFilter,games:[...testFilter.games],hideTourneys:[...testFilter.hideTourneys],hideLeagues:[...testFilter.hideLeagues],hideRoles:[...testFilter.hideRoles]};
      if(SUPA_URL&&SUPA_KEY){
        const settingsRow={id:"__settings_tourneys__",player:"__SETTINGS__",description:JSON.stringify({activeTourneys,savedTourneys,mibActive,mibDate,testFilter:serFilter,savedTipsters}),odds:1,stake:0,bookmaker:"",status:"pending",game:"",league:"",role:"",team:"",datetime:"",isHeadshot:false,isLive:false,mapTag:"",profit:0,tournament:"",ppMapType:null,ppLine:null,ppEdge:null,updatedAt:Date.now(),archived:false,splits:null};
        fetch(SUPA_URL+"/rest/v1/bets",{method:"POST",headers:{"Content-Type":"application/json","apikey":SUPA_KEY,"Authorization":"Bearer "+SUPA_KEY,"Prefer":"resolution=merge-duplicates"},body:JSON.stringify(settingsRow)}).catch(function(){});
      }
    }catch(e){}
  },[activeTourneys,savedTourneys,mibActive,mibDate,testFilter,savedTipsters,loaded]);

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

  // ── Supabase: pull — Supabase est la source de vérité ───────────────────
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
              setTestFilter({...tf,games:new Set(tf.games||["NBA","EuroLeague","Pro A","ACB","Bundesliga","Lega","HEBA"]),hideTourneys:new Set(tf.hideTourneys||[]),hideLeagues:new Set(tf.hideLeagues||[]),hideRoles:new Set(tf.hideRoles||[])});
              setTestFilterDraft({...tf,games:new Set(tf.games||["NBA","EuroLeague","Pro A","ACB","Bundesliga","Lega","HEBA"]),hideTourneys:new Set(tf.hideTourneys||[]),hideLeagues:new Set(tf.hideLeagues||[]),hideRoles:new Set(tf.hideRoles||[])});
            }catch(e){}
          }
          // Merge savedTourneys instead of overwriting — keep local additions
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
          // Restore savedTipsters — union local + remote
          if(s.savedTipsters&&s.savedTipsters.length>0){
            setSavedTipsters(prev=>{
              const merged=[...new Set([...(prev||[]),...s.savedTipsters])];
              try{localStorage.setItem("v7_saved_tipsers",JSON.stringify(merged));}catch(e){}
              return merged;
            });
          }
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

  // ── Filtre Test + MIB ─────────────────────────────────────────────────────
  const isTestActive=useMemo(()=>{
    const f=testFilter;
    return mibActive||f.games.size<7||f.headshot!=="all"||f.live!=="all"||f.overUnder!=="all"||!!f.oddsMin||!!f.oddsMax||f.hideTourneys.size>0||f.hideLeagues.size>0||f.hideRoles.size>0||!!f.ppEdgeMin||!!f.ppEdgeMax;
  },[testFilter,mibActive]);

  // Filtre pur hors composant — pas de capture de closure React
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

    // 4. Signaux — combinaisons Over/Under × Jeu
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

    // 5. Seuil de rentabilité par tranche de cote — simplifié
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
      // Tournois pour ce jeu
      const tm={};
      gb.forEach(b=>{
        var effT=b.tournament;
        if(!effT&&true){ // basket
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
  },[settledFiltered,allPlayers]);

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
    if(form.autoInfo&&form.autoInfo.game)return form.autoInfo.game;
    return "NBA";
  },[form.autoInfo]);

  function addBet(){
    if(!form.player||!form.odds||!form.stake||!form.bookmaker||!form.description)return;
    const info=findPlayer(form.player)||{game:"?",league:"?",role:"?",team:"?"};
    const stake=parseFloat(form.stake),odds=parseFloat(form.odds);
    const desc=form.description?form.overUnder+" "+form.description:form.overUnder;
    const tname=(()=>{const t=activeTourneys[info.game];return(t&&(!t.end||new Date(t.end)>=new Date()))?t.name:"";})();
    if(editingBet){
      // Mode édition — remplace le pari existant avec tous les champs
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
      setForm(f=>({...EMPTY_FORM,datetime:nowDT(),bookmaker:stickyBK?f.bookmaker:"",mapTag:f.mapLocked?f.mapTag:"Match",mapLocked:f.mapLocked,status:lockedStatus||"pending"}));
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
      game:info.game,league:info.league,role:info.role,team:info.team,
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
    setForm(f=>({...EMPTY_FORM,datetime:nowDT(),bookmaker:stickyBK?f.bookmaker:"",mapTag:f.mapLocked?f.mapTag:"Match",mapLocked:f.mapLocked,status:lockedStatus||"pending"}));
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
      try{localStorage.setItem("v7_bets",JSON.stringify(updated));}catch(e){}
      return updated;
    });
    lastPushRef.current=Date.now();
    // Push immédiat vers Supabase
    supaPushBets(newBets).catch(function(){});
    setForm(f=>({...EMPTY_FORM,datetime:nowDT(),bookmaker:stickyBK?f.bookmaker:"",mapTag:f.mapLocked?f.mapTag:"Match",mapLocked:f.mapLocked,status:lockedStatus||"pending"}));
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
    if(!pform.name.trim())return;
    const rawName=pform.name.toLowerCase().trim();
    // Clé unique = game:name pour éviter conflits entre jeux (ex: Bach CS2 vs Bach Dota2)
    const key=rawName;
    const autoGame=pform.team&&Object.values({...{"Atlanta Hawks":"NBA","Boston Celtics":"NBA","Brooklyn Nets":"NBA","Charlotte Hornets":"NBA","Chicago Bulls":"NBA","Cleveland Cavaliers":"NBA","Dallas Mavericks":"NBA","Denver Nuggets":"NBA","Detroit Pistons":"NBA","Golden State Warriors":"NBA","Houston Rockets":"NBA","Indiana Pacers":"NBA","LA Clippers":"NBA","Los Angeles Lakers":"NBA","Memphis Grizzlies":"NBA","Miami Heat":"NBA","Milwaukee Bucks":"NBA","Minnesota Timberwolves":"NBA","New Orleans Pelicans":"NBA","New York Knicks":"NBA","Oklahoma City Thunder":"NBA","Orlando Magic":"NBA","Philadelphia 76ers":"NBA","Phoenix Suns":"NBA","Portland Trail Blazers":"NBA","Sacramento Kings":"NBA","San Antonio Spurs":"NBA","Toronto Raptors":"NBA","Utah Jazz":"NBA","Washington Wizards":"NBA"}}).length?"NBA":pform.game;
    const data={game:"NBA",league:pform.league||"NBA",role:pform.role||pform.position||"",team:pform.team,name:pform.name.trim()};
    // Si un joueur du même nom existe déjà dans un jeu différent, on garde les deux via un merge
    setPlayers(p=>{
      const existing=p[key];
      if(existing&&existing.game&&existing.game!==pform.game){
        // Stocker avec clé préfixée par le jeu pour éviter conflit
        const gKey=pform.game.toLowerCase()+":"+rawName;
        supaUpsertPlayer({name:gKey,...data}).catch(function(){});
        return{...p,[gKey]:data};
      }
      supaUpsertPlayer({name:key,...data}).catch(function(){});
      return{...p,[key]:data};
    });
    setPform({name:"",game:"NBA",league:"",position:"",team:""});
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
          <div style={{position:"fixed",top:0,left:0,right:0,zIndex:600,background:"linear-gradient(90deg,rgba(234,179,8,.95),rgba(202,138,4,.95))",padding:"5px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:"0 2px 12px rgba(234,179,8,.4)"}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:13}}>🧪</span><span style={{fontSize:11,fontWeight:800,color:"#1a1000",letterSpacing:.3}}>MODE TEST ACTIF — simulation en cours</span><span style={{fontSize:10,color:"rgba(0,0,0,.5)",marginLeft:2}}>
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
                    {["NBA","EuroLeague","Pro A","ACB","Bundesliga","Lega","HEBA"].map(g=>{
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
                <div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:14,padding:"12px 14px",marginBottom:14}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>{calSelected.split("-").reverse().join("/")} — {selectedDayBets.length} paris</div>
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
                    {editingBet?"Modifier pari":combineMode?"Combiné":teamBetMode?"Pari Équipe":sessionMode?"Session multi-map":"Ajouter un pari"}
                  </div></div></div><div style={{display:"flex",gap:6,alignItems:"center"}}>
                {editingBet&&(
                  <button onClick={()=>{setEditingBet(null);setForm({...EMPTY_FORM,datetime:nowDT(),bookmaker:stickyBK?form.bookmaker:""});}}
                    style={{fontSize:11,color:"#6B7280",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"6px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:600}}>
                    × Annuler
                  </button>
                )}
                <button onClick={()=>{setCombineMode(v=>!v);setTeamBetMode(false);setDuelMode(false);setSessionMode(false);}}
                  style={{padding:"7px 13px",borderRadius:12,border:"1.5px solid "+(combineMode?"#34d399":"rgba(255,255,255,0.1)"),background:combineMode?"rgba(52,211,153,0.12)":"rgba(255,255,255,0.04)",color:combineMode?"#34d399":"#9CA3AF",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                  🔗 Combiner
                </button><button onClick={()=>{setTeamBetMode(v=>!v);setCombineMode(false);setDuelMode(false);setSessionMode(false);}}
                  style={{padding:"7px 13px",borderRadius:12,border:"1.5px solid "+(teamBetMode?"#60a5fa":"rgba(255,255,255,0.1)"),background:teamBetMode?"rgba(96,165,250,0.12)":"rgba(255,255,255,0.04)",color:teamBetMode?"#60a5fa":"#9CA3AF",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                  🏀 Équipe
                </button></div></div><div style={{padding:"10px 14px 20px"}}>


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
                <div style={{background:"#131525",borderRadius:16,border:"1px solid rgba(245,158,11,0.2)",padding:"14px 16px",marginBottom:10}}><div style={{fontSize:12,color:"#F59E0B",fontWeight:700,marginBottom:12,letterSpacing:.5}}>⚔️ Duel — Plus de kills sur cette map</div>

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

                  {/* Sélection du gagnant — apparaît quand les 2 joueurs sont choisis */}
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
                      {duelForm.isLive?<><span style={{width:8,height:8,borderRadius:"50%",background:"#fb7185",display:"inline-block"}}/>LIVE — En cours</> : "🔴 Marquer comme Live"}
                    </button></div>

                  {/* PP kills Duel */}
                  <div style={{marginTop:10,background:"rgba(139,92,246,.06)",border:"1px solid rgba(139,92,246,.15)",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:9,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>PrizePicks — Lignes Stats</div><div style={{display:"flex",gap:5,marginBottom:8}}>
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
            {teamBetMode&&(
              <div style={{background:"#131525",borderRadius:16,border:"1px solid rgba(96,165,250,0.2)",padding:"14px 16px",marginBottom:10}}>
                <div style={{fontSize:12,color:"#60a5fa",fontWeight:700,marginBottom:12}}>🏀 Pari Équipe</div>
                <div style={{marginBottom:10}}><div style={{fontSize:10,color:"#9CA3AF",marginBottom:6,fontWeight:600}}>Équipe</div>
                  <input className="ifield" placeholder="ex: Lakers, Celtics..." value={form.player} onChange={e=>setForm(f=>({...f,player:e.target.value}))} style={{marginBottom:0}}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
                  <button onClick={()=>setForm(f=>({...f,overUnder:"Over",description:"Victoire"}))}
                    style={{height:54,borderRadius:13,border:"1.5px solid "+(form.description==="Victoire"?"#22c55e":"rgba(34,197,94,.2)"),background:form.description==="Victoire"?"rgba(34,197,94,.14)":"rgba(34,197,94,.03)",color:form.description==="Victoire"?"#22e875":"#4e7060",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                    ✓ Victoire
                  </button>
                  <button onClick={()=>setForm(f=>({...f,overUnder:"Over",description:"Handicap"}))}
                    style={{height:54,borderRadius:13,border:"1.5px solid "+(form.description==="Handicap"?"#f59e0b":"rgba(245,158,11,.2)"),background:form.description==="Handicap"?"rgba(245,158,11,.14)":"rgba(245,158,11,.03)",color:form.description==="Handicap"?"#fbbf24":"#6b5a30",fontWeight:800,fontSize:14,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                    ± Handicap
                  </button>
                </div>
                {form.description==="Handicap"&&(
                  <input className="ifield" placeholder="ex: -3.5 points" value={form.player_handicap||""} onChange={e=>setForm(f=>({...f,player_handicap:e.target.value,description:"Handicap "+e.target.value}))} style={{marginBottom:8}}/>
                )}
              </div>
            )}

            {/* ── COMBINE MODE ── */}
            {combineMode&&(
              <div style={{background:"#131525",borderRadius:16,border:"1px solid rgba(52,211,153,0.2)",padding:"14px 16px",marginBottom:10}}>
                <div style={{fontSize:12,color:"#34d399",fontWeight:700,marginBottom:12}}>🔗 Paris combinés</div>
                {combineLegs.map((leg,i)=>(
                  <div key={i} style={{marginBottom:10,padding:"10px 12px",borderRadius:12,border:"1px solid rgba(255,255,255,.06)",background:"rgba(8,14,28,.6)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                      <span style={{fontSize:11,color:"#9CA3AF",fontWeight:700}}>Sélection {i+1}</span>
                      {combineLegs.length>2&&<button onClick={()=>setCombineLegs(l=>l.filter((_,j)=>j!==i))} style={{background:"none",border:"none",color:"#ef4444",cursor:"pointer",fontSize:13}}>×</button>}
                    </div>
                    <input className="ifield" placeholder="Joueur..." value={leg.player} onChange={e=>setCombineLegs(l=>l.map((x,j)=>j===i?{...x,player:e.target.value}:x))} style={{marginBottom:6}}/>
                    <input className="ifield" placeholder="Sélection (ex: 24.5 Points)..." value={leg.description} onChange={e=>setCombineLegs(l=>l.map((x,j)=>j===i?{...x,description:e.target.value}:x))} style={{marginBottom:6}}/>
                    <div style={{display:"flex",gap:6}}>
                      {["Over","Under"].map(ou=>(
                        <button key={ou} onClick={()=>setCombineLegs(l=>l.map((x,j)=>j===i?{...x,overUnder:ou}:x))}
                          style={{flex:1,padding:"6px",borderRadius:8,border:"1.5px solid "+(leg.overUnder===ou?(ou==="Over"?"#22c55e":"#3b82f6"):"rgba(255,255,255,.07)"),background:leg.overUnder===ou?(ou==="Over"?"rgba(34,197,94,.12)":"rgba(59,130,246,.12)"):"transparent",color:leg.overUnder===ou?(ou==="Over"?"#22c55e":"#60a5fa"):"#6B7280",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                          {ou==="Over"?"▲ Over":"▼ Under"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={()=>setCombineLegs(l=>[...l,{player:"",description:"",overUnder:"Over"}])}
                  style={{width:"100%",padding:"9px",background:"transparent",border:"1px dashed rgba(52,211,153,.3)",borderRadius:10,color:"#34d399",cursor:"pointer",fontSize:12,fontFamily:"Inter,sans-serif",marginBottom:8}}>
                  + Ajouter une sélection
                </button>
                <div style={{fontSize:10,color:"#6B7280",marginBottom:6}}>Cote & Mise totale ↓</div>
              </div>
            )}

            {!duelMode&&!teamBetMode&&!combineMode&&<>
            {/* ── 2. JOUEUR ── */}
            <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:10}}><div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4",letterSpacing:.2}}>
                  
                  Joueur
                </div><button onClick={()=>{setPform({name:"",game:"NBA",league:"",position:"",team:""});setModalPlayer(true);}}
                  style={{padding:"3px 9px",borderRadius:7,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"#6B7280",fontSize:10,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:600}}>
                  + Ajouter un joueur
                </button></div>
              {!form.autoInfo&&(
                <div style={{background:"rgba(8,14,28,0.9)",borderRadius:12,border:"1px solid rgba(255,255,255,0.06)",padding:"2px 10px"}}><PlayerAC ref={playerACRef} value={form.player} onChange={v=>{
                    const pi=findPlayer(v);
                    setForm(f=>({
                      ...f,
                      player:v,
                      autoInfo:pi,
                    }));
                  }} allPlayers={allPlayers} activeTourneys={activeTourneys} betFreq={betFreq} onConfirm={()=>{setTimeout(()=>{const el=document.getElementById("kills-select");if(el){el.focus();el.click();}else{const odds=document.getElementById("odds-input-field");if(odds)odds.focus();}},80);}}/></div>
              )}
              {form.autoInfo&&(
                <div style={{position:"relative",borderRadius:16,border:"1px solid rgba(139,92,246,.18)",background:"linear-gradient(105deg,rgba(12,18,38,.99) 55%,rgba(20,14,42,.97))",display:"flex",alignItems:"stretch",overflow:"hidden",minHeight:118}}>

                  {/* ── Zone photo (38% de la carte) ── */}
                  <div style={{width:"38%",flexShrink:0,position:"relative",display:"flex",alignItems:"flex-end",justifyContent:"center",overflow:"hidden"}}>
                    {/* Logo équipe en filigrane */}
                    {form.autoInfo.team_logo_url&&(
                      <img src={form.autoInfo.team_logo_url} alt="" onError={e=>e.target.style.display='none'} style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:"70%",height:"70%",objectFit:"contain",opacity:.08,zIndex:0,pointerEvents:"none"}}/>
                    )}
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
                    <div style={{position:"absolute",top:0,right:0,bottom:0,width:32,background:"linear-gradient(to right,transparent,rgba(12,18,38,.99))",zIndex:2,pointerEvents:"none"}}/></div>

                  {/* ── Infos joueur (droite) ── */}
                  <div style={{flex:1,padding:"14px 12px 12px 6px",display:"flex",flexDirection:"column",justifyContent:"center",gap:6,minWidth:0}}><div style={{fontSize:19,fontWeight:700,letterSpacing:-.3,color:"#f0f4ff",lineHeight:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {(form.autoInfo.name||form.player).split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}
                    </div><div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
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
                      <GameLogo game={form.autoInfo.game} size={15}/>
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
              {form.player&&!form.autoInfo&&<div style={{marginTop:7,fontSize:11,color:"#F59E0B",fontWeight:600}}>⚠ Joueur non reconnu — tu peux quand même enregistrer.</div>}
            </div>





            {/* ── BET TYPE ── */}
            <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"12px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#6b7280",letterSpacing:1,textTransform:"uppercase",marginBottom:10}}>Type de bet</div>
              {(()=>{
                const BET_TYPES=[
                  {id:"pts",   label:"PTS",    full:"Points",      col:"#a78bfa", min:3.5,  max:35.5},
                  {id:"reb",   label:"REB",    full:"Rebonds",     col:"#fb923c", min:0.5,  max:15.5},
                  {id:"ast",   label:"AST",    full:"Passes",      col:"#60a5fa", min:0.5,  max:15.5},
                  {id:"3pts",  label:"3PT",    full:"3 Points",    col:"#34d399", min:0.5,  max:6.5},
                  {id:"pts_reb",     label:"P+R",  full:"Pts+Reb",     col:"#f472b6", min:4.0,  max:51.0},
                  {id:"pts_ast",     label:"P+A",  full:"Pts+Passes",  col:"#38bdf8", min:4.0,  max:51.0},
                  {id:"pts_reb_ast", label:"P+R+A",full:"Pts+Reb+Ast", col:"#fbbf24", min:4.5,  max:66.5},
                ];
                const on=form.betType;
                return(
                  <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:2}}>
                    {BET_TYPES.map(bt=>{
                      const active=on===bt.id;
                      const col=bt.col;
                      return(
                        <button key={bt.id}
                          onClick={()=>setForm(f=>({...f,betType:active?null:bt.id,description:""}))}
                          style={{
                            flexShrink:0,
                            display:"flex",alignItems:"center",justifyContent:"center",
                            padding:"7px 12px",
                            borderRadius:10,
                            border:"1.5px solid "+(active?"#a78bfa":"rgba(255,255,255,.07)"),
                            background:active?"rgba(167,139,250,.15)":"rgba(255,255,255,.02)",
                            color:active?"#a78bfa":"#4a5568",
                            cursor:"pointer",fontFamily:"Inter,sans-serif",
                            transition:"all .15s",
                            minWidth:42,
                            boxShadow:active?"0 0 12px rgba(167,139,250,.3)":"none",
                          }}>
                          <span style={{fontSize:11,fontWeight:900,letterSpacing:.3}}>{bt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* ── 3. SÉLECTION ── */}
            <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}><div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4",letterSpacing:.2,marginBottom:9}}>
                
                Sélection
              </div>
              {form.autoInfo&&(()=>{
                const game=form.autoInfo.game;
                let opts=[];
                // Options selon betType sélectionné
                // Plages : PT=3.5-35.5, REB=0.5-15.5, AST=0.5-15.5, 3PT=0.5-6.5
                // Combinées = somme des min/max de chaque stat
                const BET_OPTS={
                  pts:     Array.from({length:33},(_,i)=>((i+3.5).toFixed(1))+" Points"),
                  reb:     Array.from({length:16},(_,i)=>((i+0.5).toFixed(1))+" Rebounds"),
                  ast:     Array.from({length:16},(_,i)=>((i+0.5).toFixed(1))+" Assists"),
                  "3pts":  Array.from({length:13},(_,i)=>((i+0.5).toFixed(1))+" 3 Pts"),
                  // PR: min=3.5+0.5=4.0, max=35.5+15.5=51.0 → 48 valeurs
                  pts_reb: Array.from({length:48},(_,i)=>((i+4.0).toFixed(1))+" Pts+Reb"),
                  // PA: min=3.5+0.5=4.0, max=35.5+15.5=51.0 → 48 valeurs
                  pts_ast: Array.from({length:48},(_,i)=>((i+4.0).toFixed(1))+" Pts+Ast"),
                  // PRA: min=3.5+0.5+0.5=4.5, max=35.5+15.5+15.5=66.5 → 63 valeurs
                  pts_reb_ast: Array.from({length:63},(_,i)=>((i+4.5).toFixed(1))+" Pts+Reb+Ast"),
                };
                if(form.betType&&BET_OPTS[form.betType]){
                  opts=BET_OPTS[form.betType];
                } else {
                  opts=[
                    ...Array.from({length:33},(_,i)=>((i+3.5).toFixed(1))+" Points"),
                    ...Array.from({length:13},(_,i)=>((i+0.5).toFixed(1))+" 3 Pts"),
                    ...Array.from({length:16},(_,i)=>((i+0.5).toFixed(1))+" Assists"),
                    ...Array.from({length:16},(_,i)=>((i+0.5).toFixed(1))+" Rebounds"),
                    ...Array.from({length:20},(_,i)=>((i+5.5).toFixed(1))+" Pts+Reb"),
                    ...Array.from({length:20},(_,i)=>((i+5.5).toFixed(1))+" Pts+Ast"),
                    ...Array.from({length:20},(_,i)=>((i+8.5).toFixed(1))+" Pts+Reb+Ast"),
                  ];
                }
                
                
                
                if(form.description&&!opts.includes(form.description)){opts=[form.description,...opts];}
                if(opts.length===0)return null;
                return(
                  <div style={{display:"flex",alignItems:"center",gap:8,borderRadius:13,border:"1px solid rgba(255,255,255,.06)",background:"rgba(8,14,28,.9)",overflow:"hidden",height:50}}><div style={{height:"100%",width:46,borderRight:"1px solid rgba(255,255,255,.05)",background:"rgba(255,255,255,.03)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {form.autoInfo.game==="NBA"
                        ? <img src={NBA_LEAGUE_LOGO} style={{width:36,height:36,objectFit:"contain"}} alt="NBA" onError={e=>e.target.style.display="none"}/>
                        : <GameLogo game={form.autoInfo.game} size={22}/>
                      }
                    </div><select id="stat-select" value={form.description} onChange={e=>{const val=e.target.value;const is3Pts=val.includes("Headshot");setForm(f=>({...f,description:val,isHeadshot:is3Pts}));if(e.target.value){setTimeout(()=>{const el=document.getElementById("odds-input-field");if(el)el.focus();},80);}}}
                      style={{flex:1,height:"100%",background:"transparent",border:"none",padding:"0 12px 0 4px",color:form.description?"#a8c4ff":"#5a6880",fontSize:14,fontFamily:"Inter,sans-serif",fontWeight:500,outline:"none",appearance:"none",WebkitAppearance:"none",cursor:"pointer"}}><option value="" style={{color:"#6B7280",background:"#0d1428"}}>Choisir une ligne...</option>
                      {opts.map(o=><option key={o} value={o} style={{color:"#E5E7EB",background:"#0d1428"}}>{o}</option>)}
                    </select><span style={{color:"#4b5568",paddingRight:12,fontSize:13,flexShrink:0}}>⌄</span></div>
                );
              })()}
              {!form.autoInfo&&(
                <div style={{height:50,background:"rgba(8,14,28,.6)",borderRadius:13,border:"1px solid rgba(255,255,255,0.04)",display:"flex",alignItems:"center",justifyContent:"center",color:"#4e5a6e",fontSize:13,fontWeight:500}}>
                  Sélectionnez d'abord un joueur
                </div>
              )}
            </div>

            {/* ── 4. TYPE DE PARI ── */}
            {!sessionMode&&(
              <div style={{background:"linear-gradient(180deg,rgba(14,20,38,.98),rgba(8,12,24,.99))",borderRadius:18,border:"1px solid rgba(139,92,246,.2)",padding:"11px 12px 10px",marginBottom:8,boxShadow:"0 8px 24px rgba(0,0,0,.2)"}}><div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,fontWeight:700,color:"#ccd3e4",letterSpacing:.2,marginBottom:9}}>
                  
                  Type de pari
                </div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button onClick={()=>setForm(f=>({...f,overUnder:"Over"}))}
                    style={{height:54,borderRadius:13,border:"1.5px solid "+(form.overUnder==="Over"?"#00E676":"rgba(34,197,94,.2)"),background:form.overUnder==="Over"?"rgba(34,197,94,.14)":"rgba(34,197,94,.03)",color:form.overUnder==="Over"?"#22e875":"#4e7060",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"Inter,sans-serif",letterSpacing:.5,boxShadow:form.overUnder==="Over"?"0 0 28px rgba(34,197,94,.2),inset 0 1px 0 rgba(34,197,94,.15)":"none",transition:"all .15s"}}>
                    ▲ OVER
                  </button><button onClick={()=>setForm(f=>({...f,overUnder:"Under"}))}
                    style={{height:54,borderRadius:13,border:"1.5px solid "+(form.overUnder==="Under"?"#3b82f6":"rgba(59,130,246,.2)"),background:form.overUnder==="Under"?"rgba(59,130,246,.14)":"rgba(59,130,246,.03)",color:form.overUnder==="Under"?"#60a5fa":"#3d5270",fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"Inter,sans-serif",letterSpacing:.5,boxShadow:form.overUnder==="Under"?"0 0 28px rgba(59,130,246,.2),inset 0 1px 0 rgba(59,130,246,.15)":"none",transition:"all .15s"}}>
                    ▼ UNDER
                  </button></div></div>
            )}
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



            

                        {/* ── 2b. ANNONCE — Joueurs out ── */}
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
                  🎯 Tipster
                </div><button onClick={()=>setLockedTipster(v=>!v)}
                  style={{padding:"3px 9px",background:lockedTipster?"rgba(245,158,11,0.1)":"rgba(255,255,255,0.03)",border:"1px solid "+(lockedTipster?"rgba(245,158,11,.3)":"rgba(255,255,255,0.06)"),borderRadius:7,color:lockedTipster?"#F59E0B":"#555e72",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                  {lockedTipster?"🔒 Locké":"🔓 Locker"}
                </button></div>
              {savedTipsters.length>0?(
                <div style={{display:"flex",gap:6,flexDirection:"column"}}>
                  <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {savedTipsters.map(t=>{
                      const on=tipsterName===t;
                      return(
                        <button key={t} onClick={()=>setTipsterName(on?"":t)}
                          style={{padding:"6px 13px",borderRadius:20,border:"1.5px solid "+(on?"rgba(167,139,250,.5)":"rgba(255,255,255,.08)"),background:on?"rgba(124,58,237,.15)":"rgba(255,255,255,.02)",color:on?"#a78bfa":"#6B7280",fontSize:12,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all .15s"}}>
                          {on?"✓ ":""}{t}
                        </button>
                      );
                    })}
                    <button onClick={()=>setTipsterName(prev=>savedTipsters.includes(prev)?"":prev)}
                      style={{padding:"6px 13px",borderRadius:20,border:"1.5px solid "+(tipsterName&&!savedTipsters.includes(tipsterName)?"rgba(167,139,250,.5)":"rgba(255,255,255,.06)"),background:tipsterName&&!savedTipsters.includes(tipsterName)?"rgba(124,58,237,.1)":"transparent",color:tipsterName&&!savedTipsters.includes(tipsterName)?"#a78bfa":"#4a5a6e",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                      ✏️ Manuel
                    </button>
                  </div>
                  {(!savedTipsters.includes(tipsterName)||tipsterName==="")&&(
                    <input className="ifield" placeholder="Ou saisir manuellement…" value={tipsterName} onChange={e=>setTipsterName(e.target.value)} style={{marginBottom:0}}/>
                  )}
                </div>
              ):(
                <input className="ifield" placeholder="Nom du tipster (optionnel)..." value={tipsterName} onChange={e=>setTipsterName(e.target.value)} style={{marginBottom:0}}/>
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
              if(!form.overUnder) missing.push("Over/Under");
              if(!form.description) missing.push("Stat/Ligne");
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
                      <div style={{marginBottom:8,padding:"8px 12px",borderRadius:10,background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.3)",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>Edge PP négatif ({ppEdge>0?"+":""}{ppEdge.toFixed(2)}) — EV-</span></div>
                    );
                  })()}

                  {(function(){
                    var ppEdge=form.ppEdge;
                    if(ppEdge==null||ppEdge>=0||form.ppMapType==="HIDE")return null;
                    return(<div style={{marginBottom:8,padding:"8px 12px",borderRadius:10,background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.3)",display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:12,fontWeight:700,color:"#f87171"}}>Edge PP négatif ({ppEdge>0?"+":""}{ppEdge.toFixed(2)}) — EV-</span></div>);
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
                    <button onClick={()=>{setEditingBet(null);setForm({...EMPTY_FORM,datetime:nowDT(),bookmaker:stickyBK?form.bookmaker:"",});}}
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

            {/* ── TAB BAR : APERÇU / JEUX / JOUEURS / TOURNOIS / PLUS ── */}
            <div style={{display:"flex",gap:18,marginBottom:16,borderBottom:"1px solid rgba(255,255,255,.07)",overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              {[{k:"apercu",l:"Aperçu"},{k:"jeux",l:"Ligues"},{k:"joueurs",l:"Joueurs"},{k:"tournois",l:"Positions"},{k:"annonces",l:"Annonces"},{k:"victoire",l:"Victoire"},{k:"combine",l:"Combiné"},{k:"tipsers",l:"Tipsers"},{k:"plus",l:"Plus"}].map(t=>{
                const on=statsTab===t.k;
                return(
                  <button key={t.k} onClick={()=>setStatsTab(t.k)}
                    style={{background:"none",border:"none",padding:"0 0 10px",color:on?"#A78BFA":"#6B7280",fontSize:12,fontWeight:800,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",fontFamily:"Inter,sans-serif",whiteSpace:"nowrap",borderBottom:"2px solid "+(on?"#A78BFA":"transparent"),transition:"all .15s"}}>
                    {t.l}
                  </button>
                );
              })}
            </div>

            {/* ── TESTING PANEL ── */}
            {statsTab==="tipsers"&&(()=>{
              // Build stats per tipster — fusionne savedTipsters + ceux dans les paris
              const tipsterMap={};
              settled.forEach(b=>{
                const t=b.tipster;
                if(!t)return;
                if(!tipsterMap[t])tipsterMap[t]={name:t,count:0,won:0,profit:0,staked:0,byGame:{}};
                const tm=tipsterMap[t];
                tm.count++;tm.profit+=b.profit||0;tm.staked+=b.stake||0;
                if(b.status==="won")tm.won++;
                if(b.game){
                  if(!tm.byGame[b.game])tm.byGame[b.game]={count:0,won:0,profit:0,staked:0};
                  const gm=tm.byGame[b.game];
                  gm.count++;gm.profit+=b.profit||0;gm.staked+=b.stake||0;
                  if(b.status==="won")gm.won++;
                }
              });
              // Ajouter les savedTipsters qui n'ont pas encore de paris
              savedTipsters.forEach(t=>{
                if(!tipsterMap[t])tipsterMap[t]={name:t,count:0,won:0,profit:0,staked:0,byGame:{}};
              });
              const tipsters=Object.values(tipsterMap).sort((a,b2)=>b2.profit-a.profit);
              if(tipsters.length===0)return(
                <div style={{textAlign:"center",padding:"40px 20px",color:"#4a5a6e"}}>
                  <div style={{fontSize:24,marginBottom:8}}>🎯</div>
                  <div style={{fontSize:13,fontWeight:600}}>Aucun tipster pour l'instant</div>
                  <div style={{fontSize:11,marginTop:4}}>Crée des tipsers dans l'onglet Suivi</div>
                </div>
              );
              return(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {tipsters.map(tip=>{
                    const wr=tip.count>0?(tip.won/tip.count*100):0;
                    const roi=tip.staked>0?(tip.profit/tip.staked*100):0;
                    const isOpen=!!statsGameOpen["TIP_"+tip.name];
                    const gameList=Object.entries(tip.byGame).sort((a,b2)=>b2[1].profit-a[1].profit);
                    return(
                      <div key={tip.name} style={{background:"rgba(10,16,34,.98)",border:"1px solid rgba(167,139,250,.2)",borderRadius:14,overflow:"hidden"}}>
                        <button onClick={()=>setStatsGameOpen(s=>({...s,["TIP_"+tip.name]:!s["TIP_"+tip.name]}))} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontSize:18}}>🎯</span>
                            <div>
                              <div style={{fontWeight:800,fontSize:14,color:"#a78bfa"}}>{tip.name}</div>
                              <div style={{fontSize:10,color:"#6B7280"}}>{tip.count} paris · {wr.toFixed(0)}% WR · {roi>=0?"+":""}{roi.toFixed(1)}% ROI</div>
                            </div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontWeight:800,fontSize:14,color:tip.profit>=0?"#22C55E":"#EF4444"}}>{tip.profit>=0?"+":""}{tip.profit.toFixed(0)}$</span>
                            <span style={{fontSize:10,color:"#4a5a6e",display:"inline-block",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
                          </div>
                        </button>
                        {isOpen&&(
                          <div style={{borderTop:"1px solid rgba(255,255,255,.06)"}}>
                            {gameList.map(([game,gs])=>{
                              const gwr=gs.count>0?(gs.won/gs.count*100):0;
                              const groi=gs.staked>0?(gs.profit/gs.staked*100):0;
                              return(
                                <div key={game} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",borderBottom:"1px solid rgba(255,255,255,.04)"}}>
                                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                                    <GameLogo game={game} size={16}/>
                                    <div>
                                      <div style={{fontWeight:600,fontSize:12,color:"#E5E7EB"}}>{game}</div>
                                      <div style={{fontSize:10,color:"#6B7280"}}>{gs.count} paris · {gwr.toFixed(0)}% WR</div>
                                    </div>
                                  </div>
                                  <div style={{textAlign:"right"}}>
                                    <div style={{fontWeight:700,fontSize:12,color:gs.profit>=0?"#22C55E":"#EF4444"}}>{gs.profit>=0?"+":""}{gs.profit.toFixed(0)}$</div>
                                    <div style={{fontSize:10,color:groi>=0?"#22C55E":"#EF4444"}}>{groi>=0?"+":""}{groi.toFixed(1)}% ROI</div>
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
                      {["NBA","EuroLeague","Pro A","ACB","Bundesliga","Lega","HEBA"].map(g=>{
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
                        const labels={"PG":"Point Guard","SG":"Small Guard","SF":"Small Forward","PF":"Power Forward","C":"Center"};
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

                  {isDirty&&<div style={{marginTop:8,fontSize:10,color:"#f59e0b",textAlign:"center",opacity:.7}}>Changements non appliqués — clique sur  Appliquer</div>}
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
                {/* Ligne 1 — Profit + ROI */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}><div style={{background:"linear-gradient(135deg,rgba(34,197,94,.08),rgba(16,185,129,.04))",border:"1px solid rgba(34,197,94,.15)",borderRadius:14,padding:"14px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#00E676,#16a34a)"}}/><div style={{fontSize:8,color:"#4a6a50",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,fontWeight:700}}>Profit net</div><div style={{fontSize:24,fontWeight:800,color:totalProfit>=0?"#22C55E":"#EF4444",letterSpacing:-.5,lineHeight:1}}>{totalProfit>=0?"+":""}{totalProfit.toFixed(0)}$</div><div style={{fontSize:10,color:"#4a6a50",marginTop:4,fontWeight:500}}>{settledFiltered.length} paris résolus</div></div><div style={{background:"linear-gradient(135deg,rgba(59,130,246,.08),rgba(99,102,241,.04))",border:"1px solid rgba(59,130,246,.15)",borderRadius:14,padding:"14px",position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,#3b82f6,#6366f1)"}}/><div style={{fontSize:8,color:"#3a5270",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,fontWeight:700}}>ROI global</div><div style={{fontSize:24,fontWeight:800,color:globalROI>=0?"#60a5fa":"#EF4444",letterSpacing:-.5,lineHeight:1}}>{globalROI>=0?"+":""}{globalROI.toFixed(1)}%</div><div style={{fontSize:10,color:"#3a5270",marginTop:4,fontWeight:500}}>{totalStaked.toFixed(0)}$ misés</div></div></div>
                {/* Ligne 2 — WR + Série/Meilleur mois */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"12px 14px"}}><div style={{fontSize:8,color:"#5a6880",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,fontWeight:700}}>Win Rate</div><div style={{fontSize:24,fontWeight:800,color:globalWR>=55?"#22C55E":globalWR<45?"#EF4444":"#9CA3AF",letterSpacing:-.5,lineHeight:1}}>{globalWR.toFixed(1)}%</div><div style={{fontSize:10,color:"#4a5a6e",marginTop:4,fontWeight:500}}>{settledFiltered.filter(b=>b.status==="won").length}W · {settledFiltered.filter(b=>b.status==="lost").length}L</div></div><div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:14,padding:"12px 14px"}}><div style={{fontSize:8,color:"#5a6880",textTransform:"uppercase",letterSpacing:1.2,marginBottom:5,fontWeight:700}}>{currentStreak>1?"Série en cours":"Meilleur mois"}</div>
                    {currentStreak>1
                      ? <><div style={{fontSize:24,fontWeight:800,color:streakType==="won"?"#22C55E":"#EF4444",letterSpacing:-.5,lineHeight:1}}>{currentStreak}</div><div style={{fontSize:10,color:"#4a5a6e",marginTop:4,fontWeight:500}}>{streakType==="won"?"victoires":"défaites"} consécutives</div></>
                      : bestMonth
                        ? <><div style={{fontSize:20,fontWeight:800,color:"#22C55E",letterSpacing:-.3,lineHeight:1}}>+{bestMonth[1].toFixed(0)}$</div><div style={{fontSize:10,color:"#4a6a50",marginTop:4,fontWeight:500}}>{bestMonth[0]}</div></>
                        : <div style={{fontSize:20,fontWeight:800,color:"#3a4a5e"}}>—</div>
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
              <div style={{background:"linear-gradient(135deg,rgba(10,16,30,.98),rgba(8,14,24,.99))",border:"1px solid rgba(99,130,200,.12)",borderRadius:16,padding:"12px 14px",marginBottom:16}}><div style={{fontSize:10,color:"#4a5a6e",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>Over / Under — Tous jeux</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
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
                        Résultats par jeu — {ouDrill==="over"?"Over":"Under"}
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

              const GAMES=["NBA","EuroLeague","Pro A","ACB","Bundesliga","Lega","HEBA"].filter(g=>ppBets.some(b=>b.game===g));
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
                    <div style={{background:"rgba(6,10,20,.99)",border:"1px solid rgba(139,92,246,.25)",borderRadius:14,overflow:"hidden",marginBottom:10}}><div style={{padding:"9px 14px",background:"rgba(139,92,246,.07)",borderBottom:"1px solid rgba(139,92,246,.15)"}}><span style={{fontSize:11,fontWeight:800,color:"#c4b5fd",textTransform:"uppercase",letterSpacing:1}}>Over / Under — Edge +{edge.toFixed(2)}</span></div><ColHeaders/>
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
                                  <div style={{background:"rgba(0,0,0,.3)",borderBottom:"1px solid rgba(139,92,246,.1)"}}><div style={{padding:"6px 14px 4px",display:"flex",alignItems:"center",gap:6}}><img src={PP_LOGO_B64} style={{width:12,height:12,objectFit:"contain"}}/><span style={{fontSize:9,color:"#6a5a8e",fontWeight:700,textTransform:"uppercase",letterSpacing:.6}}>Lignes PP — clique pour voir les paris</span></div>
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
                        ← {mt} — {game}
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
                                        const cellVal=s?metric.fmt(s):"—";
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
            </>}

            {/* ──  ONGLET ANALYSE ── */}
            
            {statsTab==="annonces"&&(
              <div>
                <div style={{display:"flex",gap:6,marginBottom:12}}>
                  {[{k:"tracker",l:"📋 Tracker Lignes"},{k:"stats",l:"📊 Stats"}].map(t=>(
                    <button key={t.k} onClick={()=>setAnnSubTab(t.k)}
                      style={{flex:1,padding:"9px",borderRadius:9,border:"1.5px solid "+(annSubTab===t.k?"rgba(124,58,237,.4)":"rgba(255,255,255,.07)"),background:annSubTab===t.k?"rgba(124,58,237,.12)":"transparent",color:annSubTab===t.k?"#a78bfa":"#6B7280",fontWeight:700,fontSize:12,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                      {t.l}
                    </button>
                  ))}
                </div>
                {annSubTab==="tracker"&&<AnnonceNBATracker bets={bets} allPlayers={allPlayers}/>}
                {annSubTab==="stats"&&<AnnonceStatsView bets={bets} allPlayers={allPlayers}/>}
              </div>
            )}
            {statsTab==="victoire"&&(
              <VictoireEquipeView
                bets={bets} setBets={setBets}
                bookmakers={bookmakers} bkPhotos={bkPhotos} BK_LOGOS={BK_LOGOS}
                showToast={showToast} allPlayers={allPlayers}
              />
            )}
            {statsTab==="combine"&&(
              <PariCombineView
                bets={bets} allPlayers={allPlayers}
                bookmakers={bookmakers} bkPhotos={bkPhotos} BK_LOGOS={BK_LOGOS}
                showToast={showToast}
              />
            )}
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
                      {secTitle("","Signaux","Quoi garder · quoi couper — min 5 paris par combinaison")}
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
                                    </div><div style={{fontSize:10,fontWeight:800,color:s.cnt>0?(pos?color:"#EF4444"):"#3a4a5e"}}>{s.cnt>0?metricFmt(v):"—"}</div><div style={{fontSize:8,color:"#3a4a5e",marginTop:2}}>{s.cnt}p</div></div>
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

            {statsTab==="jeux"&&<>
            {/* ── PAR JEU — accordéons regroupés ── */}
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
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}><div style={{display:"flex",alignItems:"center",gap:8}}><GameLogo game={game} size={22}/><span style={{fontSize:14,fontWeight:800,color:cfg.accent}}>{game}</span><span style={{fontSize:10,color:"#6B7280"}}>{gs.count} paris</span></div><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{padding:"2px 8px",borderRadius:6,background:gs.profit>=0?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)",fontSize:11,fontWeight:700,color:gs.profit>=0?"#22C55E":"#EF4444"}}>{gs.profit>=0?"+":""}{gs.profit.toFixed(0)}$</span><span style={{fontSize:11,color:"#6B7280",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>▼</span></div></div>
                    {/* Stats row */}
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}><span style={{fontSize:11,color:"#9CA3AF",fontWeight:600}}>{gs.wr.toFixed(0)}% WR</span><span style={{fontSize:11,color:"#6B7280"}}>·</span><span style={{fontSize:11,fontWeight:700,color:gs.roi>=0?"#22C55E":"#EF4444"}}>{gs.roi>=0?"+":""}{gs.roi.toFixed(1)}% ROI</span><span style={{fontSize:11,color:"#6B7280"}}>·</span><span style={{fontSize:11,color:"#9CA3AF"}}>@{gs.avgOdds.toFixed(2)} moy.</span><span style={{fontSize:11,color:"#6B7280"}}>·</span><span style={{fontSize:11,fontWeight:700,color:gs.profit>=0?"#22C55E":"#EF4444",background:gs.profit>=0?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.08)",padding:"1px 6px",borderRadius:5}}>{gs.profit>=0?"+":""}{bankroll>0?(gs.profit/bankroll*100).toFixed(1):0}% BK</span></div>
                    {/* Progress bar: WR */}
                    {(()=>{
                      const wr=gs.wr;
                      const roiAbs=Math.min(Math.abs(gs.roi),50); // cap à 50%
                      return(
                        <div style={{display:"flex",gap:4,alignItems:"center"}}>
                          {/* WR bar */}
                          <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:wr+"%",background:wr>55?"linear-gradient(90deg,#22C55E,#22C55E)":wr<45?"linear-gradient(90deg,#EF4444,#EF4444)":"linear-gradient(90deg,#9CA3AF,#6B7280)",borderRadius:2,transition:"width .5s ease"}}/></div>
                          {/* ROI bar */}
                          <div style={{flex:1,height:4,background:"#1F2937",borderRadius:2,overflow:"hidden",position:"relative"}}><div style={{position:"absolute",top:0,left:gs.roi>=0?"50%":"calc(50% - "+(roiAbs/100*100/2)+"%)",height:"100%",width:(roiAbs/50*50)+"%",background:gs.roi>=0?"linear-gradient(90deg,#3B82F6,#06B6D4)":"linear-gradient(90deg,#EF4444,#EF4444)",borderRadius:2,transition:"all .5s ease"}}/></div></div>
                      );
                    })()}
                  </button>

                  {isOpen&&(
                    <div style={{background:"#111827",border:"1px solid #1F2937",borderTop:"none",borderRadius:"0 0 14px 14px",overflow:"hidden"}}>

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
                        return(<><div onClick={function(){setPlayersExpanded(showAll?null:game);}}
                            style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:11,color:"#00E676",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderBottom:"1px solid rgba(74,222,128,.15)",fontFamily:"'Inter',sans-serif",cursor:"pointer"}}><span> {showAll?"Top 50":"Top 5"} joueurs</span><span style={{fontSize:10,color:"#4a5a6e"}}>{showAll?"▲ Réduire":"Voir 50 →"}</span></div>
                          {showAll&&<div style={{display:"flex",gap:5,padding:"8px 14px",borderBottom:"1px solid #1F2937",flexWrap:"wrap",alignItems:"center"}}>
                            {[{k:"profit",l:"Profit"},{k:"count",l:"Paris"},{k:"wr",l:"WR%"}].map(function(s){
                              var on=sortKey===s.k;
                              return <button key={s.k} onClick={function(e){e.stopPropagation();setPlayerSortKey(s.k);}}
                                style={{padding:"3px 10px",borderRadius:6,border:"1px solid "+(on?"rgba(0,230,118,.4)":"rgba(255,255,255,.07)"),background:on?"rgba(0,230,118,.1)":"transparent",color:on?"#00E676":"#6B7280",fontSize:10,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{s.l}</button>;
                            })}
                            <div style={{width:1,height:14,background:"rgba(255,255,255,.08)",margin:"0 2px"}}/><span style={{fontSize:9,color:"#4a5a6e",fontWeight:600}}>Min paris:</span>
                            {[1,3,5,10,20].map(function(n){
                              var on=playerMinBets===n;
                              return <button key={n} onClick={function(e){e.stopPropagation();setPlayerMinBets(n);}}
                                style={{padding:"3px 9px",borderRadius:6,border:"1px solid "+(on?"rgba(167,139,250,.4)":"rgba(255,255,255,.07)"),background:on?"rgba(124,58,237,.12)":"transparent",color:on?"#c4b5fd":"#6B7280",fontSize:10,fontWeight:on?700:500,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{n}+</button>;
                            })}
                            <span style={{fontSize:10,color:"#4a5a6e",marginLeft:4}}>{sorted.length} joueurs</span></div>}
                          {displayList.map(function(p,i){
                            var wr=p.count>0?(p.won/p.count*100).toFixed(0):0;
                            return(
                              <div key={p.player} className="stat-row" onClick={function(){setStatsDrill({game,league:null,filterType:"player",filterValue:p.player});}} style={{cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:9}}><span style={{fontSize:11,color:i<3?"#fbbf24":"#6B7280",fontWeight:700,width:20,textAlign:"center"}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</span><div><div style={{display:"flex",alignItems:"center",gap:5}}><div style={{fontWeight:700,fontSize:13,color:"#E5E7EB",textTransform:"capitalize"}}>{p.player}</div><span style={{fontSize:10,color:"#4B5563"}}>›</span></div><div style={{fontSize:10,color:"#6B7280"}}>{p.count} paris · {wr}% WR</div></div></div><span style={{fontWeight:700,fontSize:13,color:p.profit>=0?"#22C55E":"#EF4444"}}>{p.profit>=0?"+":""}{(p.profit||0).toFixed(0)}$</span></div>
                            );
                          })}
                        </>);
                      })()}

                      {/* Positions */}
                      {gs.roles.length>0&&(
                        <><div style={{fontSize:11,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderBottom:"1px solid rgba(124,58,237,0.2)",fontFamily:"'Inter',sans-serif",borderTop:"1px solid #1F2937"}}>Positions</div>
                          {gs.roles.map(r=>{
                            const wr=r.count>0?(r.won/r.count*100):0;
                            const roi=r.staked>0?(r.profit/r.staked*100):0;
                            return(
                              <div key={r.role} className="stat-row" onClick={()=>setStatsDrill({game,league:null,filterType:"role",filterValue:r.role})} style={{cursor:"pointer"}}><div><div style={{display:"flex",alignItems:"center",gap:5}}>
                                    {r.role&&<PositionLogo role={r.role} size={16}/>}
                                    <div style={{fontWeight:600,fontSize:13,color:"#E5E7EB"}}>{r.role}</div><span style={{fontSize:10,color:"#4B5563"}}>›</span></div><div style={{fontSize:10,color:"#6B7280"}}>{r.count} paris · {wr.toFixed(0)}% WR</div></div><div style={{textAlign:"right"}}><div style={{fontWeight:700,fontSize:13,color:r.profit>=0?"#22C55E":"#EF4444"}}>{r.profit>=0?"+":""}{(r.profit||0).toFixed(0)}$</div><div style={{fontSize:10,color:roi>=0?"#22C55E":"#EF4444"}}>{roi>=0?"+":""}{roi.toFixed(1)}%</div></div></div>
                            );
                          })}
                        </>
                      )}

                      {/* Tournois */}
                      {gs.tourneys.length>0&&(
                        <><div style={{fontSize:11,color:"#A78BFA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderBottom:"1px solid rgba(124,58,237,0.2)",fontFamily:"'Inter',sans-serif",borderTop:"1px solid #1F2937"}}>Tournois</div>
                          {gs.tourneys.map(t=>{
                            const wr=t.count>0?(t.won/t.count*100):0;
                            const roi=t.staked>0?(t.profit/t.staked*100):0;
                            return(
                              <div key={t.name} className="stat-row" onClick={()=>setStatsDrill({game,league:null,filterType:"tourney",filterValue:t.name})} style={{cursor:"pointer"}}><div style={{display:"flex",alignItems:"center",gap:7}}>
                                  {t.name==="Hors tournoi"
                                    ?<span style={{fontSize:12}}>📅</span>
                                    :<LeagueLogo league={t.name} size={18}/>}
                                  <div><div style={{display:"flex",alignItems:"center",gap:5}}><div style={{fontWeight:600,fontSize:13,color:t.name==="Hors tournoi"?"#9CA3AF":"#E5E7EB"}}>{t.name}</div><span style={{fontSize:10,color:"#4B5563"}}>›</span></div><div style={{fontSize:10,color:"#6B7280"}}>{t.count} paris · {wr.toFixed(0)}% WR</div></div></div><div style={{textAlign:"right"}}><div style={{fontWeight:700,fontSize:13,color:t.profit>=0?"#22C55E":"#EF4444"}}>{t.profit>=0?"+":""}{(t.profit||0).toFixed(0)}$</div><div style={{fontSize:10,color:roi>=0?"#22C55E":"#EF4444"}}>{roi>=0?"+":""}{roi.toFixed(1)}%</div></div></div>
                            );
                          })}
                        </>
                      )}

                      {/* Over / Under */}
                      {(gs.overS||gs.underS)&&(
                        <><div style={{fontSize:11,color:"#60A5FA",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderBottom:"1px solid rgba(96,165,250,0.2)",fontFamily:"'Inter',sans-serif",borderTop:"1px solid #1F2937"}}> Over / Under</div><div style={{display:"grid",gridTemplateColumns:"1fr 40px 48px 64px 16px",gap:2,padding:"4px 14px 6px"}}><span style={{fontSize:9,color:"#4B5563",fontWeight:700,textTransform:"uppercase"}}>Type</span><span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"center"}}>N</span><span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"center"}}>WR%</span><span style={{fontSize:9,color:"#4B5563",fontWeight:700,textAlign:"right"}}>Profit</span><span/></div>
                          {[{label:"🔼 Over",s:gs.overS},{label:"🔽 Under",s:gs.underS}].filter(x=>x.s).map(({label,s})=>(
                            <div key={label} style={{display:"grid",gridTemplateColumns:"1fr 40px 48px 64px 16px",gap:2,padding:"6px 14px",borderTop:"1px solid #1F2937",alignItems:"center"}}><span style={{fontSize:12,fontWeight:600,color:"#60A5FA"}}>{label}</span><span style={{fontSize:11,color:"#9CA3AF",textAlign:"center"}}>{s.count}</span><span style={{fontSize:11,fontWeight:700,color:s.wr>55?"#22C55E":s.wr<45?"#EF4444":"#9CA3AF",textAlign:"center"}}>{s.wr.toFixed(0)}%</span><span style={{fontSize:11,fontWeight:700,color:s.profit>=0?"#22C55E":"#EF4444",textAlign:"right"}}>{s.profit>=0?"+":""}{(s.profit||0).toFixed(0)}$</span><span style={{fontSize:10}}>{s.wr>55?"":s.wr<45?"":""}</span></div>
                          ))}
                        </>
                      )}

                      {/* Annonces */}
                      {(()=>{
                        const annBets=settledFiltered.filter(b=>b.game===game&&b.announceOuts&&b.announceOuts.length>0);
                        if(annBets.length===0)return null;
                        const annWon=annBets.filter(b=>b.status==="won").length;
                        const annProfit=annBets.reduce((s,b)=>s+(b.profit||0),0);
                        const annStaked=annBets.reduce((s,b)=>s+(b.stake||0),0);
                        const annROI=annStaked>0?(annProfit/annStaked*100):0;
                        const annWR=annBets.length>0?(annWon/annBets.length*100):0;
                        return(
                          <><div style={{fontSize:11,color:"#34d399",fontWeight:800,letterSpacing:1.5,textTransform:"uppercase",padding:"14px 14px 6px",borderTop:"1px solid #1F2937",borderBottom:"1px solid rgba(52,211,153,.2)",fontFamily:"'Inter',sans-serif"}}>📣 Annonces</div>
                            <div className="stat-row">
                              <div><div style={{fontWeight:700,fontSize:13,color:"#34d399"}}>Paris annoncés</div><div style={{fontSize:10,color:"#6B7280"}}>{annBets.length} paris · {annWR.toFixed(0)}% WR</div></div>
                              <div style={{textAlign:"right"}}><div style={{fontWeight:700,fontSize:13,color:annProfit>=0?"#22C55E":"#EF4444"}}>{annProfit>=0?"+":""}{annProfit.toFixed(0)}$</div><div style={{fontSize:10,color:annROI>=0?"#22C55E":"#EF4444"}}>{annROI>=0?"+":""}{annROI.toFixed(1)}% ROI</div></div>
                            </div>
                          </>
                        );
                      })()}

                    </div>
                  )}
                </div>
              );
            })}

            </>}

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
                {key:"SG",label:"Small Guard",color:"#60a5fa"},
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
                    return(
                      <div key={key} style={{background:"rgba(10,16,34,.98)",border:"1px solid rgba(255,255,255,.07)",borderRadius:14,overflow:"hidden"}}>
                        <button onClick={()=>setStatsGameOpen(s=>({...s,["POS_"+key]:!s["POS_"+key]}))} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"transparent",border:"none",cursor:"pointer",fontFamily:"Inter,sans-serif",textAlign:"left"}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"3px 9px",borderRadius:6,background:color+"22",border:"1px solid "+color+"44",fontSize:11,fontWeight:800,color,fontFamily:"Inter,sans-serif"}}>{label}</span>
                            <span style={{fontSize:11,color:"#6B7280"}}>{pb.length} paris</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:8}}>
                            <span style={{fontWeight:800,fontSize:13,color:profit>=0?"#22C55E":"#EF4444"}}>{profit>=0?"+":""}{profit.toFixed(0)}$</span>
                            <span style={{fontSize:10,color:"#4a5a6e",display:"inline-block",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s"}}>▼</span>
                          </div>
                        </button>
                        <div style={{display:"flex",gap:12,padding:"0 14px 10px",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                          <span style={{fontSize:11,color:"#9CA3AF"}}>{wr.toFixed(0)}% WR</span>
                          <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                          <span style={{fontSize:11,color:roi>=0?"#22C55E":"#EF4444"}}>{roi>=0?"+":""}{roi.toFixed(1)}% ROI</span>
                          <span style={{fontSize:11,color:"#6B7280"}}>·</span>
                          <span style={{fontSize:11,color:"#60a5fa"}}>▲{overB.length} {overWR.toFixed(0)}%</span>
                          <span style={{fontSize:11,color:"#f87171"}}>▼{underB.length} {underWR.toFixed(0)}%</span>
                        </div>
                        {isOpen&&(
                          <div>
                            {typeList.map(([type,s])=>{
                              const twr=s.count>0?(s.won/s.count*100):0;
                              const troi=s.staked>0?(s.profit/s.staked*100):0;
                              return(
                                <div key={type} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 14px",borderTop:"1px solid rgba(255,255,255,.04)"}}>
                                  <div><div style={{fontWeight:600,fontSize:12,color:"#E5E7EB"}}>{type}</div><div style={{fontSize:10,color:"#6B7280"}}>{s.count} paris · {twr.toFixed(0)}% WR · {troi>=0?"+":""}{troi.toFixed(1)}% ROI</div></div>
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
          const pageTitle=filterType?({role:"Position",map:"Map",tourney:"Tournoi",bk:"Bookmaker",kill:"Points",player:"Joueur"}[filterType]||filterType)+" — "+filterValue:(league?game+" · "+league:game);

          const pc=v=>(v||0)>=0?"#00E676":"#EF4444";
          const wrc=v=>(v||0)>=55?"#00E676":(v||0)<45?"#EF4444":"#9CA3AF";

          // Simple table row — label | N paris | WR% | Profit
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


                {/* Top 5 pertes position+kills — LoL uniquement */}
                {isEuro&&top5Losses.length>0&&(
                  <div style={{marginBottom:12,borderRadius:12,overflow:"hidden",border:"1px solid rgba(239,68,68,0.2)"}}><div style={{fontSize:9,color:"#EF4444",fontWeight:700,letterSpacing:1.5,textTransform:"uppercase",padding:"9px 12px",background:"rgba(239,68,68,0.06)",borderBottom:"1px solid rgba(239,68,68,0.15)"}}> Top 5 pertes — Position · Ligne</div><Header/>
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
                      <div style={{marginBottom:10,borderRadius:12,overflow:"hidden",border:"1px solid rgba(139,92,246,.25)"}}><div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:"rgba(107,33,245,.1)",borderBottom:"1px solid rgba(139,92,246,.2)"}}><img src={PP_LOGO_B64} alt="PP" style={{width:16,height:16,borderRadius:3,objectFit:"cover",flexShrink:0}}/><span style={{fontSize:10,color:"#c4b5fd",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>OVER {killVal2.toFixed(1)} — Lignes PP jouées</span></div><div style={{display:"grid",gridTemplateColumns:"70px 1fr 40px 80px",padding:"5px 12px",background:"#0A1020",borderBottom:"1px solid #1A2235"}}><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Ligne PP</span><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"center"}}>Paris</span><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"center"}}>WR</span><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"right"}}>{colLabel}</span></div>
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
                      <div style={{marginBottom:10,borderRadius:12,overflow:"hidden",border:"1px solid rgba(139,92,246,.25)"}}><div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 12px",background:"rgba(107,33,245,.1)",borderBottom:"1px solid rgba(139,92,246,.2)"}}><img src={PP_LOGO_B64} alt="PP" style={{width:16,height:16,borderRadius:3,objectFit:"cover",flexShrink:0}}/><span style={{fontSize:10,color:"#c4b5fd",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>UNDER {killVal2.toFixed(1)} — Lignes PP jouées</span></div><div style={{display:"grid",gridTemplateColumns:"70px 1fr 40px 80px",padding:"5px 12px",background:"#0A1020",borderBottom:"1px solid #1A2235"}}><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>Ligne PP</span><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"center"}}>Paris</span><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"center"}}>WR</span><span style={{fontSize:9,color:"#3D4A5C",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,textAlign:"right"}}>{colLabel}</span></div>
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
                        setForm({...EMPTY_FORM,datetime:nowDT(),player:b.player||"",overUnder:ou,description:desc,odds:String(b.odds||""),stake:"",bookmaker:bk,mapTag:mapTag,isLive:false,mapLocked:false,autoInfo:autoInfo});
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
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><div><div style={{fontSize:18,fontWeight:800,color:"#E5E7EB",letterSpacing:-0.3}}>Suivi</div><div style={{display:"flex",gap:10,marginTop:3}}><span style={{fontSize:11,color:"#6B7280"}}>{Object.keys(allPlayers).length} joueurs</span>
                  {customCount>0&&<span style={{fontSize:11,color:"#A78BFA",fontWeight:600}}>✎ {customCount} modifiés</span>}
                </div></div><button onClick={()=>{setPform({name:"",game:"NBA",league:"",position:"",team:""});setModalPlayer(true);}}
                style={{background:"linear-gradient(135deg,#7C3AED,#3B82F6)",border:"none",borderRadius:12,padding:"10px 18px",color:"#fff",fontWeight:700,fontSize:13,fontFamily:"'Inter',sans-serif",cursor:"pointer",boxShadow:"0 4px 14px rgba(124,58,237,0.35)"}}>
                Modifier joueur
              </button></div>

            {/* ── MODIFIER JOUEUR ── */}
            <div style={{marginTop:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>Joueurs ({Object.keys(allPlayers).length})</div>
              </div>
              <PlayerSearchPanel
                allPlayers={allPlayers}
                custom={players}
                setPlayers={setPlayers}
                setEditingPlayer={setEditingPlayer}
                blacklist={blacklist}
                toggleBlacklist={toggleBlacklist}
                onSaveBulk={()=>{}}
              />
            </div>

            {/* ── TIPSERS ── */}
            {(()=>{
              const allTipstersInBets=[...new Set(bets.map(b=>b.tipster).filter(Boolean))];
              // Fusionner: savedTipsters + ceux dans les paris (sans doublons)
              const allTipsters=[...new Set([...savedTipsters,...allTipstersInBets])].sort();
              return(
                <div style={{marginBottom:8}}>
                  <div style={{fontSize:12,fontWeight:700,color:"#a78bfa",marginBottom:8,letterSpacing:.5}}>🎯 Tipsers</div>
                  <div style={{background:"#111827",border:"1px solid #1F2937",borderRadius:13,overflow:"hidden",marginBottom:6}}>
                    {allTipsters.length===0&&(
                      <div style={{padding:"14px",fontSize:11,color:"#4a5a6e",textAlign:"center"}}>Aucun tipster — crée-en un ci-dessous</div>
                    )}
                    {allTipsters.map((tip,i)=>{
                      const tipBets=bets.filter(b=>b.tipster===tip);
                      const settled=tipBets.filter(b=>b.status!=="pending");
                      const won=settled.filter(b=>b.status==="won").length;
                      const profit=settled.reduce((s,b)=>s+(b.profit||0),0);
                      const wr=settled.length>0?(won/settled.length*100):0;
                      const isSaved=savedTipsters.includes(tip);
                      return(
                        <div key={tip} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:i<allTipsters.length-1?"1px solid #1F2937":"none"}}>
                          <span style={{fontSize:18,flexShrink:0}}>🎯</span>
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
                    showToast("🎯 "+n+" ajouté","#A78BFA");
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
                    <div key={bk} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:idx<bookmakers.length-1?"1px solid #1F2937":"none"}}><div style={{width:34,height:34,borderRadius:9,overflow:"hidden",flexShrink:0,background:"#0B1220",display:"flex",alignItems:"center",justifyContent:"center"}}>
                        {logo?(<img src={logo} alt={bk} style={{width:34,height:34,objectFit:"cover"}}/>):(<span style={{fontSize:11,fontWeight:700,color:"#6B7280"}}>{bk.slice(0,2)}</span>)}
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
              </button></div><div style={{marginTop:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><div style={{display:"flex",alignItems:"center",gap:8}}><div><div style={{fontSize:13,fontWeight:700,color:"#E5E7EB"}}>Corbeille</div><div style={{fontSize:10,color:"#6B7280"}}>{deletedBets.length} paris supprimés récemment</div></div></div><div style={{display:"flex",gap:6}}>
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
                    <div key={b.id+"_"+i} style={{background:"#111827",border:"1px solid #1F2937",borderRadius:10,padding:"10px 13px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}><div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:6}}><GameLogo game={b.game} size={13}/><span style={{fontSize:13,fontWeight:700,color:"#9CA3AF",textTransform:"capitalize"}}>{b.player}</span><span style={{fontSize:11,color:"#6B7280"}}>— {b.description}</span></div><div style={{fontSize:10,color:"#4B5563",marginTop:2}}>@{b.odds} · {b.stake}$ · {b.bookmaker||"—"}</div><div style={{fontSize:9,color:"#374151",marginTop:1}}>Supprimé {b.deletedAt?new Date(b.deletedAt).toLocaleTimeString("fr-CA",{hour:"2-digit",minute:"2-digit"}):""}</div></div><button onClick={()=>{
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

        {modalTourney&&(()=>{
          const game=modalTourney;
          const cfg=GAME_CFG[game]||{};
          return(
            <div className="moverlay" onClick={()=>setModalTourney(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}><GameLogo game={game} size={20}/><div style={{fontSize:15,fontWeight:700}}>Ajouter un tournoi — {game}</div></div><div style={{fontSize:11,color:"#6B7280",marginBottom:16}}>Le tournoi sera disponible dans le menu déroulant. Tu pourras l'activer quand tu veux.</div>

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
              {/* Tournoi — menu déroulant */}
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
        {modalBK&&(
          <div className="moverlay" onClick={()=>{setModalBK(false);setNewBK("");setNewBKPhoto("");}}><div className="modal" onClick={e=>e.stopPropagation()}><div style={{fontSize:15,fontWeight:700,marginBottom:14}}>Nouveau bookmaker</div><input className="ifield" placeholder="Nom du bookmaker..." value={newBK} onChange={e=>setNewBK(e.target.value)} style={{marginBottom:10}}/><div style={{marginBottom:12}}><div style={{fontSize:11,color:"#9CA3AF",marginBottom:7}}>Logo (optionnel)</div><div style={{display:"flex",alignItems:"center",gap:10}}>
                  {newBKPhoto&&<img src={newBKPhoto} alt="preview" style={{width:40,height:40,borderRadius:8,objectFit:"cover",border:"1px solid #1F2937"}}/>}
                  <label style={{flex:1,padding:"10px",background:"#111827",border:"1px dashed #1F2937",borderRadius:8,color:"#9CA3AF",cursor:"pointer",fontSize:12,fontFamily:"Inter,sans-serif",textAlign:"center"}}>
                    {newBKPhoto?"Changer la photo":"📷 Ajouter un logo"}
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={e=>{
                      const f=e.target.files[0];
                      if(!f)return;
                      const r=new FileReader();
                      r.onload=ev=>setNewBKPhoto(ev.target.result);
                      r.readAsDataURL(f);
                    }}/></label></div></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button onClick={()=>{setModalBK(false);setNewBK("");setNewBKPhoto("");}} style={{padding:"12px",background:"#1F2937",border:"none",borderRadius:10,color:"#94A3B8",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Annuler</button><button onClick={saveBookmaker} disabled={!newBK.trim()} style={{padding:"12px",background:newBK.trim()?"linear-gradient(135deg,#00E676,#0EA5E9)":"#1F2937",border:"none",borderRadius:10,color:newBK.trim()?"#0B1220":"#9CA3AF",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Ajouter</button></div></div></div>
        )}

        {/* ── MODAL ADD PLAYER ── */}
        {modalPlayer&&(
          <div className="moverlay" onClick={()=>setModalPlayer(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div style={{fontSize:15,fontWeight:700,marginBottom:14}}> Ajouter un joueur NBA</div><input className="ifield" placeholder="Prénom Nom (ex: lebron james)" value={pform.name} onChange={e=>setPform(p=>({...p,name:e.target.value}))} style={{marginBottom:8}}/><div style={{marginBottom:8}}><select className="ifield" style={{width:"100%"}} value={pform.team} onChange={e=>setPform(p=>({...p,team:e.target.value,game:"NBA",league:"NBA"}))}><option value="">Équipe NBA *</option><option key="Atlanta Hawks" value="Atlanta Hawks">Atlanta Hawks</option><option key="Boston Celtics" value="Boston Celtics">Boston Celtics</option><option key="Brooklyn Nets" value="Brooklyn Nets">Brooklyn Nets</option><option key="Charlotte Hornets" value="Charlotte Hornets">Charlotte Hornets</option><option key="Chicago Bulls" value="Chicago Bulls">Chicago Bulls</option><option key="Cleveland Cavaliers" value="Cleveland Cavaliers">Cleveland Cavaliers</option><option key="Dallas Mavericks" value="Dallas Mavericks">Dallas Mavericks</option><option key="Denver Nuggets" value="Denver Nuggets">Denver Nuggets</option><option key="Detroit Pistons" value="Detroit Pistons">Detroit Pistons</option><option key="Golden State Warriors" value="Golden State Warriors">Golden State Warriors</option><option key="Houston Rockets" value="Houston Rockets">Houston Rockets</option><option key="Indiana Pacers" value="Indiana Pacers">Indiana Pacers</option><option key="LA Clippers" value="LA Clippers">LA Clippers</option><option key="Los Angeles Lakers" value="Los Angeles Lakers">Los Angeles Lakers</option><option key="Memphis Grizzlies" value="Memphis Grizzlies">Memphis Grizzlies</option><option key="Miami Heat" value="Miami Heat">Miami Heat</option><option key="Milwaukee Bucks" value="Milwaukee Bucks">Milwaukee Bucks</option><option key="Minnesota Timberwolves" value="Minnesota Timberwolves">Minnesota Timberwolves</option><option key="New Orleans Pelicans" value="New Orleans Pelicans">New Orleans Pelicans</option><option key="New York Knicks" value="New York Knicks">New York Knicks</option><option key="Oklahoma City Thunder" value="Oklahoma City Thunder">Oklahoma City Thunder</option><option key="Orlando Magic" value="Orlando Magic">Orlando Magic</option><option key="Philadelphia 76ers" value="Philadelphia 76ers">Philadelphia 76ers</option><option key="Phoenix Suns" value="Phoenix Suns">Phoenix Suns</option><option key="Portland Trail Blazers" value="Portland Trail Blazers">Portland Trail Blazers</option><option key="Sacramento Kings" value="Sacramento Kings">Sacramento Kings</option><option key="San Antonio Spurs" value="San Antonio Spurs">San Antonio Spurs</option><option key="Toronto Raptors" value="Toronto Raptors">Toronto Raptors</option><option key="Utah Jazz" value="Utah Jazz">Utah Jazz</option><option key="Washington Wizards" value="Washington Wizards">Washington Wizards</option></select></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}><select className="ifield" value={pform.role} onChange={e=>setPform(p=>({...p,role:e.target.value}))}><option value="">Position...</option>
                  {[["PG","1 — Point Guard"],["SG","2 — Shooting Guard"],["SF","3 — Small Forward"],["PF","4 — Power Forward"],["C","5 — Center"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                </select><select className="ifield" value={pform.league} onChange={e=>setPform(p=>({...p,league:e.target.value}))}><option value="NBA">NBA</option><option value="EuroLeague">EuroLeague</option><option value="Pro A">Pro A</option><option value="ACB">ACB</option></select></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}><button onClick={()=>setModalPlayer(false)} style={{padding:"12px",background:"#1F2937",border:"none",borderRadius:10,color:"#94A3B8",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Annuler</button><button onClick={savePlayer} disabled={!pform.name||!pform.team} style={{padding:"12px",background:pform.name&&pform.team?"linear-gradient(135deg,#00E676,#0EA5E9)":"#1F2937",border:"none",borderRadius:10,color:pform.name&&pform.team?"#0B1220":"#9CA3AF",fontWeight:700,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Ajouter</button></div></div></div>
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
                      {photo?<img src={photo} style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"50% 0%"}} onError={e=>e.target.style.display="none"} alt=""/>
                            :<img src={NBA_LEAGUE_LOGO} style={{width:36,height:36,objectFit:"contain",margin:"4px auto",display:"block"}} alt="NBA"/>}
                      {teamLogo&&<img src={teamLogo} style={{position:"absolute",bottom:0,right:0,width:14,height:14,objectFit:"contain",background:"rgba(0,0,0,.7)",borderRadius:2,padding:1}} onError={e=>e.target.style.display="none"} alt=""/>}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0",textTransform:"capitalize"}}>{editingPlayer.key}</div>
                      <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>
                        {editingPlayer.data.team||"—"} · {editingPlayer.data.role||"—"} · {editingPlayer.data.league||"NBA"}
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

                {/* Pari source — compact card */}
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
                  {splitForm.bookmaker&&<div style={{fontSize:11,color:"#A78BFA",fontWeight:600,marginTop:8}}>✓ {splitForm.bookmaker}{(splitModal.splits||[]).find(s=>s.bookmaker===splitForm.bookmaker)?" — modifier le split":""}</div>}
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
              <div style={{background:supaOk?"rgba(34,197,94,0.08)":"rgba(239,68,68,0.06)",border:"1px solid "+(supaOk?"rgba(34,197,94,0.2)":"rgba(239,68,68,0.15)"),borderRadius:10,padding:"12px 14px",marginBottom:14}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><span style={{width:7,height:7,borderRadius:"50%",background:supaOk?"#00E676":"#EF4444",boxShadow:"0 0 6px "+(supaOk?"rgba(34,197,94,0.8)":"rgba(239,68,68,0.6)")}}/><span style={{fontSize:12,fontWeight:700,color:supaOk?"#00E676":"#EF4444"}}>{syncing?"Synchronisation…":supaOk?"Connecté à Supabase":"Hors ligne — vérifie ta connexion"}</span></div><div style={{fontSize:11,color:"#6B7280"}}>{bets.length} paris en local · sync auto toutes les 5s</div></div>

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
                            ✓ Parfait — local et cloud sont identiques
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






// ── ErrorBoundary — prevents full black screen on JS crash ─────────────────
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
          {["NBA","EuroLeague","Pro A","ACB","Bundesliga","Lega","HEBA"].map(function(g){
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
                  var signal=r.diff===null?"—":r.diff>=1?<span style={{background:"rgba(0,230,118,.12)",color:"#00E676",padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>Over Map3</span>:r.diff<=-1?<span style={{background:"rgba(248,113,113,.12)",color:"#f87171",padding:"2px 7px",borderRadius:5,fontSize:10,fontWeight:700}}>Under Map3</span>:<span style={{color:"#9CA3AF",fontSize:10}}>Cohérent</span>;
                  return(
                    <tr key={i} style={{borderTop:"1px solid rgba(255,255,255,.04)"}}><td style={{padding:"9px 10px",fontWeight:700,color:"#E5E7EB",textTransform:"capitalize"}}>{r.player}</td><td style={{padding:"9px 10px",fontWeight:700,color:"#c4b5fd"}}>{r.line12!==null?r.line12:"—"}</td><td style={{padding:"9px 10px",color:"#6B7280"}}>{r.theoretical!==null?r.theoretical:"—"}</td><td style={{padding:"9px 10px",fontWeight:700,color:"#c4b5fd"}}>{r.map3!==null?r.map3:"—"}</td><td style={{padding:"9px 10px",fontWeight:700,color:dc}}>{r.diff!==null?(r.diff>0?"+":"")+r.diff:"—"}</td><td style={{padding:"9px 10px"}}>{signal}</td></tr>
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
  const STORAGE_KEY="v7_pp_ratios";
  function loadData(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}");}catch(e){return{};}}
  function saveDataToStorage(d){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}catch(e){}}

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
          {["NBA","EuroLeague","Pro A","ACB","Bundesliga","Lega","HEBA"].map(function(g){
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
                      if(cnt===0)return <td key={c} style={{padding:"9px 8px",textAlign:"center",color:"#1a2a3a"}}>—</td>;
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

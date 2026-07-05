/* StoreOS AI — Unified Application */
let view='dashboard',role='owner',sideOpen=false;
let cart={},payMethod='QRIS',posCat='Kopi',opnInput='';

const toast=(m,ok=true)=>{const t=document.createElement('div');t.className='toast';t.style.background=ok?'#059669':'#ef4444';t.textContent=m;document.getElementById('toast-box').appendChild(t);setTimeout(()=>{t.style.opacity=0;setTimeout(()=>t.remove(),300)},2500)};
const modal=(h)=>{const o=document.getElementById('modal-overlay');o.innerHTML=`<div class="modal-bg absolute inset-0" onclick="closeModal()"></div><div class="modal-c relative z-10 m-auto mt-16 mb-16 pop">${h}</div>`;o.classList.replace('hidden','flex');document.body.style.overflow='hidden'};
const closeModal=()=>{document.getElementById('modal-overlay').classList.replace('flex','hidden');document.body.style.overflow=''};
const go=v=>{view=v;if(innerWidth<768)toggleSide(false);render();document.querySelector('.main')?.scrollTo(0,0)};
const setRole=r=>{role=r;view=r==='owner'?'dashboard':r==='kasir'?'pos':'invOverview';go(view)};
const toggleSide=(f)=>{sideOpen=f!==undefined?f:!sideOpen;const s=document.getElementById('sb');const b=document.getElementById('sbd');if(s){if(sideOpen){s.classList.add('open');b?.classList.add('show')}else{s.classList.remove('open');b?.classList.remove('show')}}};

const IC={
  dash:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10"/></svg>',
  alert:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 00-4-5.7V5a2 2 0 10-4 0v.3C7.7 6.2 6 8.4 6 11v3.2c0 .5-.2 1-.6 1.4L4 17h5"/></svg>',
  ai:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>',
  pos:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>',
  inv:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10"/></svg>',
  recipe:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/></svg>',
  opname:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>',
  po:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 2.3c-.6.6-.2 1.7.7 1.7H17"/></svg>',
  variance:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.9 4h13.9c1.5 0 2.5-1.7 1.7-2.5L13.7 4c-.8-.8-2-.8-2.7 0L4.1 16.5c-.8.8.2 2.5 1.7 2.5z"/></svg>',
  ledger:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a1 1 0 01.7.3l5.4 5.4a1 1 0 01.3.7V19a2 2 0 01-2 2z"/></svg>',
  menu:'<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>',
};

const NAVS_OWNER=[
  {id:'dashboard',l:'Dashboard',i:IC.dash},
  {id:'alerts',l:'Alert Center',i:IC.alert,badge:ALERTS.length},
  {id:'insights',l:'AI Insights',i:IC.ai},
  {id:'invOverview',l:'Inventory',i:IC.inv},
  {id:'invStock',l:'Stock Levels',i:IC.inv},
  {id:'invVariance',l:'Variance',i:IC.variance,badge:VARIANCE.filter(v=>v.vstatus==='anomali').length},
  {id:'invLedger',l:'Audit Ledger',i:IC.ledger},
];
const NAVS_KASIR=[{id:'pos',l:'Point of Sale',i:IC.pos}];
const NAVS_KEEPER=[
  {id:'invOverview',l:'Overview',i:IC.inv},
  {id:'invStock',l:'Stock Levels',i:IC.inv},
  {id:'invRecipe',l:'Recipes (BOM)',i:IC.recipe},
  {id:'invOpname',l:'Stock Opname',i:IC.opname},
  {id:'invPO',l:'Purchase Orders',i:IC.po},
  {id:'invVariance',l:'Variance',i:IC.variance},
  {id:'invLedger',l:'Audit Ledger',i:IC.ledger},
];

/* ── SVG Helpers ── */
const spark=(data,w=80,h=28,color='#059669')=>{
  const max=Math.max(...data)*1.15,min=Math.min(...data)*0.85;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/(max-min))*h}`);
  const pathD='M '+pts.join(' L ');
  const areaD=pathD+` L ${w},${h} L 0,${h} Z`;
  const gid='sg'+Math.random().toString(36).slice(2,6);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="overflow-visible"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${areaD}" fill="url(#${gid})"/><path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
};

const healthRing=(score,size=140)=>{
  const c=score>=80?COL.green:score>=60?COL.amber:COL.red;
  const r=56,circ=2*Math.PI*r,offset=circ-(score/100)*circ;
  const label=score>=80?'Sehat':score>=60?'Waspada':'Kritis';
  return `<div class="health-ring pop" style="width:${size}px;height:${size}px"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(120,120,120,.07)" stroke-width="10"/><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${c.t}" stroke-width="10" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" style="transition:stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 0 6px ${c.t}40)"/></svg><div class="score"><div class="text-3xl font-black" style="color:${c.t}">${score}</div><div class="text-[10px] font-bold uppercase tracking-wider" style="color:${c.t}">${label}</div></div></div>`;
};

const velocityChart=()=>{
  const W=600,H=200,pL=36,pR=10,pT=10,pB=26;
  const plotW=W-pL-pR,plotH=H-pT-pB;
  const maxV=Math.max(...CUM_TGT,...CUM_ACT)*1.1;
  const x=i=>pL+(i/23)*plotW,y=v=>pT+plotH-(v/maxV)*plotH;
  let tgt='',act='',grid='',labels='',lastH=0;
  for(let i=0;i<24;i++){
    const px=x(i);
    if(i%3===0){grid+=`<line x1="${px}" y1="${pT}" x2="${px}" y2="${H-pB}" stroke="${p('rgba(0,0,0,.04)','rgba(255,255,255,.04)')}" stroke-width="1"/>`;labels+=`<text x="${px}" y="${H-8}" text-anchor="middle" font-size="9" fill="rgba(120,120,120,.3)">${String(i).padStart(2,'0')}</text>`}
    tgt+=(i===0?'M':'L')+px+','+y(CUM_TGT[i])+' ';
    if(CUM_ACT[i]>0){act+=(act===''?'M':'L')+px+','+y(CUM_ACT[i])+' ';lastH=i}
  }
  const actArea=act?act+`L ${x(lastH)},${H-pB} L ${pL},${H-pB} Z`:'';
  const nowX=x(Math.min(H,lastH)),nowY=y(CUM_ACT[lastH]||0);
  return `<svg viewBox="0 0 ${W} ${H}" class="w-full" style="min-width:400px"><defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#059669" stop-opacity=".25"/><stop offset="1" stop-color="#059669" stop-opacity="0"/></linearGradient></defs>${grid}${labels}<path d="${tgt}" fill="none" stroke="rgba(120,120,120,.15)" stroke-width="2" stroke-dasharray="6 4"/>${actArea?`<path d="${actArea}" fill="url(#vg)"/>`:''}${act?`<path d="${act}" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round"/>`:''}<line x1="${nowX}" y1="${pT}" x2="${nowX}" y2="${H-pB}" stroke="#059669" stroke-width="1" stroke-dasharray="3 3" opacity=".4"/><circle cx="${nowX}" cy="${nowY}" r="4" fill="#059669" stroke="${p('#fff','#0b0d12')}" stroke-width="2"/></svg>`;
};

const weekChart=()=>{
  const max=Math.max(...WEEK_REV)*1.15;
  return WEEK_REV.map((v,i)=>{const h=Math.round((v/max)*60);const today=i===WEEK_REV.length-1;return `<div class="flex flex-col items-center gap-1 flex-1"><div class="text-[9px] font-bold" style="color:${today?'#059669':'rgba(120,120,120,.4)'}">${rpK(v)}</div><div class="w-full rounded-md" style="height:${h}px;background:${today?'#059669':p('rgba(0,0,0,.06)','rgba(255,255,255,.06)')}"></div><div class="text-[10px] font-bold" style="color:${today?'#059669':'rgba(120,120,120,.4)'}">${WEEK_DAYS[i]}</div></div>`}).join('');
};

/* ═══════════════════════════════════════
   OWNER: DASHBOARD
   ═══════════════════════════════════════ */
function vDashboard(){
  const pct=Math.round(TOT_REV/TOT_TGT*100);
  return `<div class="fi space-y-5">
    <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-lg" style="background:#059669;box-shadow:0 4px 14px rgba(5,150,105,.3)">OS</div>
        <div><div class="text-xs" style="color:rgba(120,120,120,.5)">${GREET}, Owner</div><h1 class="text-xl md:text-2xl font-black tracking-tight">${BRAND}</h1></div>
      </div>
      <div class="flex items-center gap-3 text-xs">
        <div class="flex items-center gap-1.5" style="color:rgba(120,120,120,.5)"><span class="w-2 h-2 rounded-full pulse" style="background:#059669"></span>Live · ${TODAY}</div>
        <div class="pill" style="background:${COL.green.bg};color:${COL.green.t}">3 cabang</div>
      </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
      <div class="c p-5 md:col-span-3 flex flex-col items-center justify-center text-center">${healthRing(HEALTH_SCORE)}<div class="mt-2 text-[11px] font-bold uppercase" style="color:rgba(120,120,120,.4)">Business Health</div></div>
      <div class="md:col-span-9 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="c p-4"><div class="flex items-center justify-between mb-1"><div class="text-[10px] font-bold uppercase" style="color:rgba(120,120,120,.4)">Revenue</div><div class="pill text-[10px]" style="background:${COL.green.bg};color:${COL.green.t}">▲ +12.4%</div></div><div class="text-2xl font-black mt-1">${rpK(TOT_REV)}</div><div class="mt-2 bar-t"><div class="bar-f" style="width:${Math.min(pct,100)}%;background:#059669"></div></div><div class="text-[10px] mt-1" style="color:rgba(120,120,120,.35)">${pct}% dari ${rpK(TOT_TGT)}</div></div>
        <div class="c p-4"><div class="flex items-center justify-between mb-1"><div class="text-[10px] font-bold uppercase" style="color:rgba(120,120,120,.4)">Avg Margin</div>${spark([58,57,59,58,60,59,AVG_MARGIN],48,18,'#059669')}</div><div class="text-2xl font-black mt-1">${AVG_MARGIN}%</div><div class="text-[10px] mt-3" style="color:rgba(120,120,120,.35)">Target: 60% · <span style="color:${AVG_MARGIN>=60?COL.green.t:COL.amber.t}">${AVG_MARGIN>=60?'On track ✓':'Below'}</span></div></div>
        <div class="c p-4" style="background:${COL.green.bg};border-color:${COL.green.bd}"><div class="text-[10px] font-bold uppercase mb-1" style="color:${COL.green.t}">⭐ AI Saved</div><div class="text-2xl font-black mt-1" style="color:${COL.green.t}">${rpK(SAVED)}</div><div class="text-[10px] mt-3" style="color:${COL.green.t}">Bulan ini · ROI 89x</div></div>
        <div class="c p-4"><div class="flex items-center justify-between mb-1"><div class="text-[10px] font-bold uppercase" style="color:rgba(120,120,120,.4)">Leak Today</div><div class="pill text-[10px]" style="background:${COL.red.bg};color:${COL.red.t}">Today</div></div><div class="text-2xl font-black mt-1" style="color:${COL.red.t}">${rpK(TOT_LEAK)}</div><div class="text-[10px] mt-3" style="color:rgba(120,120,120,.35)">${B.filter(b=>b.leak>100_000).length} cabang anomali</div></div>
      </div>
    </div>

    <div class="dash-grid">
      <div class="space-y-4">
        <div class="c p-5"><div class="flex items-center justify-between mb-3"><h2 class="font-bold text-base">Revenue Velocity</h2><div class="flex items-center gap-3 text-[11px]" style="color:rgba(120,120,120,.4)"><span class="flex items-center gap-1"><span style="width:12px;height:3px;background:#059669;border-radius:2px;display:inline-block"></span>Aktual</span><span class="flex items-center gap-1"><span style="width:12px;height:0;border-top:2px dashed rgba(120,120,120,.3);display:inline-block"></span>Target</span></div></div><div class="overflow-x-auto">${velocityChart()}</div></div>

        <div><div class="flex items-center justify-between mb-2 px-1"><h2 class="font-bold text-base">Branch Performance</h2><span class="text-[11px]" style="color:rgba(120,120,120,.35)">By health</span></div><div class="grid sm:grid-cols-3 gap-3">
          ${[...B].sort((a,b)=>b.health-a.health).map(b=>{const c=b.health>=80?COL.green:b.health>=60?COL.amber:COL.red;const p=Math.round(b.rev/b.target*100);return `<div class="c p-4 dec-card" style="border-color:${c.bd}"><div class="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[11px] font-black" style="color:${c.t};background:${c.bg}">${b.health}</div><div class="font-bold text-sm mb-1">${b.name}</div><div class="text-[11px] mb-2" style="color:rgba(120,120,120,.4)">${b.trx} trx · M ${b.margin}%</div><div class="text-xl font-black">${rpK(b.rev)}</div><div class="mt-2 bar-t"><div class="bar-f" style="width:${Math.min(p,100)}%;background:${c.t}"></div></div><div class="flex items-center justify-between mt-2"><span class="text-[10px] font-bold" style="color:${c.t}">${p}%</span>${b.leak>100_000?`<span class="text-[10px] font-bold" style="color:${COL.red.t}">Leak ${rpK(b.leak)}</span>`:`<span class="text-[10px] font-bold" style="color:${COL.green.t}">Clean ✓</span>`}</div><div class="mt-2 pt-2 flex items-center justify-between" style="border-top:1px solid ${COL.gray.bd}"><span class="text-[10px]" style="color:rgba(120,120,120,.35)">7d</span>${spark(b.trend,50,18,c.t)}</div></div>`}).join('')}
        </div></div>

        <div class="c p-5"><h2 class="font-bold text-base mb-3">Revenue Minggu Ini</h2><div class="flex items-end gap-2 px-2" style="height:70px">${weekChart()}</div></div>
      </div>

      <div class="space-y-4">
        <div class="c p-5"><div class="flex items-center justify-between mb-3"><h2 class="font-bold text-base flex items-center gap-2"><span class="w-2 h-2 rounded-full pulse" style="background:#ef4444"></span>Perlu Keputusan</h2><span class="pill" style="background:${COL.red.bg};color:${COL.red.t}">${DECISIONS.length}</span></div><div class="space-y-2">${DECISIONS.map(d=>{const cc=d.urgency==='critical'?COL.red:d.urgency==='high'?COL.amber:COL.gray;return `<div class="dec-card p-3 rounded-xl cursor-pointer" style="border:1px solid ${cc.bd};background:${cc.bg}"><div class="flex items-start gap-2"><div class="text-lg">${d.icon}</div><div class="flex-1 min-w-0"><div class="font-bold text-[13px] leading-snug">${d.title}</div><div class="text-[11px] mt-0.5" style="color:rgba(120,120,120,.5)">${d.sub}</div></div><div class="text-[10px] font-bold shrink-0" style="color:rgba(120,120,120,.3)">${d.time}</div></div></div>`}).join('')}</div></div>

        <div class="c p-5"><h2 class="font-bold text-base mb-3">Timeline Hari Ini</h2>${TIMELINE.map((e,i)=>{const dc={ok:'#059669',warn:'#f59e0b',alert:'#ef4444',info:'#3b82f6'};const tc={ok:COL.green.t,warn:COL.amber.t,alert:COL.red.t,info:COL.blue.t};return `<div class="flex gap-3"><div class="flex flex-col items-center"><div style="width:10px;height:10px;border-radius:50%;background:${dc[e.type]};box-shadow:0 0 8px ${dc[e.type]}40;flex-shrink:0"></div>${i<TIMELINE.length-1?`<div style="width:2px;flex:1;min-height:24px;background:rgba(120,120,120,.1);margin:4px 0"></div>`:''}</div><div class="pb-3 flex-1"><div class="text-[10px] font-bold" style="color:rgba(120,120,120,.3)">${e.t}</div><div class="text-[13px] font-medium leading-snug mt-0.5" style="color:${tc[e.type]}">${e.msg}</div></div></div>`}).join('')}</div>

        <div class="c p-5"><div class="flex items-center gap-2 mb-3"><div class="w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] text-white" style="background:#25D366">WA</div><div><div class="font-bold text-sm">Daily Brief</div><div class="text-[10px]" style="color:rgba(120,120,120,.35)">Otomatis pukul 21:00</div></div></div><div class="brief-bubble">${BRIEF.replace(/\*(.+?)\*/g,'<b>$1</b>').replace(/\n/g,'<br>')}<div class="text-right text-[10px] mt-2" style="color:rgba(120,120,120,.3)">21:00 ✓✓</div></div></div>

        <div class="c p-5"><h2 class="font-bold text-base mb-3">Cash Position</h2><div class="space-y-2"><div class="flex justify-between"><span style="color:rgba(120,120,120,.5)">Saldo Bank</span><span class="font-bold font-mono">${rpK(CASH.bank)}</span></div><div class="flex justify-between"><span style="color:rgba(120,120,120,.5)">Piutang</span><span class="font-bold font-mono" style="color:${COL.amber.t}">${rpK(CASH.receivable)}</span></div><div class="flex justify-between pt-2" style="border-top:1px solid ${COL.gray.bd}"><span style="color:rgba(120,120,120,.5)">Hutang</span><span class="font-bold font-mono" style="color:${COL.red.t}">-${rpK(CASH.payable)}</span></div><div class="flex justify-between pt-2 mt-1" style="border-top:2px solid ${COL.gray.bd}"><span class="font-bold">Net Cash</span><span class="text-lg font-black font-mono" style="color:${COL.green.t}">${rpK(CASH.bank+CASH.receivable-CASH.payable)}</span></div></div></div>
      </div>
    </div>
  </div>`;
}

/* ═══ OWNER: ALERTS ═══ */
function vAlerts(){
  return `<div class="fi space-y-4 max-w-4xl mx-auto">
    <div class="flex items-end justify-between"><div><h1 class="text-xl font-black">Alert Center</h1><div class="text-xs mt-0.5" style="color:rgba(120,120,120,.4)">Fraud · Waste · Stok · Performa</div></div><span class="pill" style="background:${COL.red.bg};color:${COL.red.t}">${ALERTS.length} open</span></div>
    <div class="space-y-3">${ALERTS.map(a=>{const c=sevBadge(a.sev);return `<div class="c p-4"><div class="flex flex-col md:flex-row gap-3"><div class="flex-1"><div class="flex items-center gap-2 mb-2"><span class="pill" style="background:${c.bg};color:${c.t}">${a.type} · Lvl ${a.sev}</span><span class="text-[11px]" style="color:rgba(120,120,120,.4)">${a.branch} · ${a.time}</span></div><div class="font-bold text-sm mb-1">${a.title}</div><div class="text-xs leading-relaxed" style="color:rgba(120,120,120,.6)">${a.detail}</div><div class="mt-3 p-2.5 rounded-lg" style="background:${COL.gray.bg}"><div class="text-[11px] font-bold mb-0.5" style="color:${COL.green.t}">✅ Tindakan:</div><div class="text-xs font-medium">${a.action}</div></div></div><div class="md:w-40 flex flex-col justify-between shrink-0 md:border-l md:pl-4" style="border-color:${COL.gray.bd}"><div><div class="text-[10px] font-bold uppercase" style="color:rgba(120,120,120,.3)">Potensi Loss</div><div class="text-lg font-black" style="color:${COL.red.t}">${rp(a.impact)}</div></div><div class="flex flex-col gap-2 mt-3"><button class="btn btn-p btn-s w-full" onclick="toast('Alert resolved')">Resolve</button><button class="btn btn-o btn-s w-full" onclick="toast('Forwarded to WA')">Forward</button></div></div></div></div>`}).join('')}</div>
  </div>`;
}

/* ═══ OWNER: INSIGHTS ═══ */
function vInsights(){
  return `<div class="fi space-y-4 max-w-4xl mx-auto">
    <h1 class="text-xl font-black">AI Insights</h1>
    <div class="p-5 rounded-2xl text-white flex items-center justify-between gap-4" style="background:linear-gradient(135deg,#059669,#0d9488)"><div><div class="text-xs font-bold uppercase opacity-80">Total Potensi AI</div><div class="text-2xl font-black">Rp 11.000.000 <span class="text-sm font-medium opacity-80">/bulan</span></div></div><button class="btn bg-white text-emerald-700 border-none px-5">Implement All</button></div>
    <div class="grid md:grid-cols-2 gap-3">${INSIGHTS.map(i=>`<div class="c p-4"><div class="flex items-center justify-between mb-2"><div class="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style="background:${COL.gray.bg}">${i.icon}</div><div class="text-[10px] font-bold px-2 py-1 rounded" style="background:${COL.green.bg};color:${COL.green.t}">${i.confidence}% Confidence</div></div><div class="font-bold text-sm leading-snug mb-1">${i.title}</div><div class="text-xs leading-relaxed" style="color:rgba(120,120,120,.5)">${i.detail}</div><div class="mt-3 pt-3 flex items-center justify-between" style="border-top:1px solid ${COL.gray.bd}"><div class="font-bold text-sm" style="color:${i.tone==='up'?COL.green.t:COL.amber.t}">Impact: ${i.value}</div><button class="btn btn-o btn-s">Take Action</button></div></div>`).join('')}</div>
  </div>`;
}

/* ═══ KASIR: POS ═══ */
function vPOS(){
  const cats=['Kopi','Non-Kopi','Makanan'];
  const items=MENU.filter(m=>m.cat===posCat);
  const cartTotal=Object.entries(cart).reduce((s,[id,q])=>s+(MENU.find(x=>x.id===id).price*q),0);
  const cartRows=Object.entries(cart).map(([id,q])=>{const m=MENU.find(x=>x.id===id);return `<div class="flex items-center justify-between py-2" style="border-top:1px solid ${COL.gray.bd}"><div class="flex-1 min-w-0 pr-2"><div class="font-bold text-sm truncate">${m.name}</div><div class="text-xs font-mono" style="color:rgba(120,120,120,.4)">${rp(m.price)} × ${q}</div></div><div class="flex items-center gap-2 shrink-0"><button class="w-7 h-7 rounded-full font-bold" style="background:${COL.gray.bg}" onclick="updateCart('${id}',-1)">−</button><span class="w-4 text-center font-bold">${q}</span><button class="w-7 h-7 rounded-full font-bold text-white" style="background:#059669" onclick="updateCart('${id}',1)">+</button></div></div>`}).join('')||'<div class="text-center py-8 text-sm" style="color:rgba(120,120,120,.3)">Keranjang kosong</div>';
  return `<div class="fi h-[calc(100dvh-100px)] flex flex-col md:flex-row gap-4 max-w-7xl mx-auto">
    <div class="flex-1 flex flex-col min-h-0">
      <div class="flex items-center justify-between mb-3 shrink-0"><div><h1 class="text-lg font-bold">Point of Sale</h1><div class="text-xs" style="color:rgba(120,120,120,.4)">Kemang · Shift Pagi · Rina</div></div><div class="flex items-center gap-1 text-xs font-bold" style="color:${COL.green.t}"><span class="w-2 h-2 rounded-full pulse" style="background:#059669"></span>Online</div></div>
      <div class="flex gap-2 mb-3 shrink-0 overflow-x-auto pb-1">${cats.map(c=>`<button class="px-3 py-1.5 rounded-lg text-xs font-bold ${posCat===c?'text-white':'border'}" style="${posCat===c?'background:#059669':'border-color:'+COL.gray.bd}" onclick="posCat='${c}';go('pos')">${c}</button>`).join('')}</div>
      <div class="flex-1 overflow-y-auto pb-3"><div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">${items.map(m=>`<div class="c p-3 cursor-pointer relative" onclick="addToCart('${m.id}')">${cart[m.id]?`<div class="absolute top-2 right-2 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center pop" style="background:#059669">${cart[m.id]}</div>`:''}<div class="text-3xl text-center mb-2">${m.emo}</div><div class="font-bold text-xs text-center leading-tight">${m.name}</div><div class="text-center font-bold text-sm mt-1" style="color:${COL.green.t}">${rp(m.price)}</div></div>`).join('')}</div></div>
    </div>
    <div class="w-full md:w-72 lg:w-80 shrink-0 flex flex-col c shadow-sm md:h-full">
      <div class="p-3 flex items-center justify-between shrink-0" style="border-bottom:1px solid ${COL.gray.bd}"><h2 class="font-bold">Order (${Object.values(cart).reduce((a,b)=>a+b,0)})</h2>${cartTotal>0?`<button class="text-xs font-bold" style="color:${COL.red.t}" onclick="cart={};go('pos')">Clear</button>`:''}</div>
      <div class="flex-1 overflow-y-auto p-3">${cartRows}</div>
      <div class="p-3 rounded-b-xl" style="background:${COL.gray.bg}"><div class="flex justify-between text-xs mb-2"><span style="color:rgba(120,120,120,.5)">Subtotal</span><span class="font-mono font-bold">${rp(cartTotal)}</span></div><div class="flex justify-between text-xs mb-3"><span style="color:rgba(120,120,120,.5)">Tax 11%</span><span class="font-mono font-bold">${rp(cartTotal*0.11)}</span></div><div class="flex justify-between mb-3 pb-3" style="border-bottom:1px solid ${COL.gray.bd}"><span class="font-bold">Total</span><span class="text-xl font-black font-mono" style="color:${COL.green.t}">${rp(cartTotal*1.11)}</span></div><div class="grid grid-cols-3 gap-1.5 mb-3">${['QRIS','Tunai','Card'].map(pm=>`<button class="py-2 rounded-lg text-xs font-bold ${payMethod===pm?'text-white':'border'}" style="${payMethod===pm?'background:#059669':'border-color:'+COL.gray.bd}" onclick="payMethod='${pm}';go('pos')">${pm}</button>`).join('')}</div><button class="btn btn-p w-full py-3" onclick="checkout()" ${cartTotal===0?'disabled style="opacity:.4"':''}>Charge ${rp(cartTotal*1.11)}</button></div>
    </div>
  </div>`;
}
function addToCart(id){cart[id]=(cart[id]||0)+1;go('pos')}
function updateCart(id,d){if(!cart[id])return;cart[id]+=d;if(cart[id]<=0)delete cart[id];go('pos')}
function checkout(){if(!Object.keys(cart).length)return;modal(`<div class="p-6 text-center"><div class="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-3 pop" style="background:${COL.green.bg}">✓</div><h2 class="text-lg font-bold mb-2">Payment Successful</h2><p class="text-xs mb-4" style="color:rgba(120,120,120,.5)">StoreOS mencatat penjualan, auto-deduct stok resep, dan update Owner dashboard real-time.</p><button class="btn btn-p w-full py-3" onclick="cart={};closeModal();go('pos')">New Order</button></div>`)}

/* ═══ KEEPER: INVENTORY OVERVIEW ═══ */
function vInvOverview(){
  const kritis=ING.filter(i=>i.qty_sys<=i.min*0.4).length;
  const anomali=VARIANCE.filter(v=>v.vstatus==='anomali').length;
  const totalLoss=VARIANCE.filter(v=>v.vstatus!=='normal').reduce((a,v)=>a+v.loss,0);
  const pendingPO=POS_LIST.filter(p=>p.status==='draft').length;
  return `<div class="fi space-y-4">
    <h1 class="text-xl font-black">Inventory Overview</h1>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="c p-4 cursor-pointer" onclick="go('invStock')"><div class="text-[10px] font-bold uppercase" style="color:rgba(120,120,120,.4)">Stok Kritis</div><div class="text-2xl font-black mt-1" style="color:${COL.red.t}">${kritis}</div><div class="text-[10px] mt-1" style="color:rgba(120,120,120,.35)">Item rendah</div></div>
      <div class="c p-4 cursor-pointer" onclick="go('invVariance')"><div class="text-[10px] font-bold uppercase" style="color:rgba(120,120,120,.4)">Anomali</div><div class="text-2xl font-black mt-1" style="color:${COL.red.t}">${anomali}</div><div class="text-[10px] mt-1" style="color:${COL.red.t}">Loss: ${rp(totalLoss)}</div></div>
      <div class="c p-4 cursor-pointer" onclick="go('invPO')"><div class="text-[10px] font-bold uppercase" style="color:rgba(120,120,120,.4)">PO Pending</div><div class="text-2xl font-black mt-1" style="color:${COL.amber.t}">${pendingPO}</div><div class="text-[10px] mt-1" style="color:rgba(120,120,120,.35)">Auto by AI</div></div>
      <div class="c p-4 cursor-pointer" onclick="go('invOpname')"><div class="text-[10px] font-bold uppercase" style="color:rgba(120,120,120,.4)">Opname</div><div class="text-2xl font-black mt-1">${OPNAME_TODAY.filter(o=>o.done).length}/${OPNAME_TODAY.length}</div><div class="text-[10px] mt-1" style="color:rgba(120,120,120,.35)">Cycle count</div></div>
    </div>
    <div class="c p-4"><h2 class="font-bold text-sm mb-3">⚠️ Perlu Perhatian</h2>${VARIANCE.filter(v=>v.vstatus!=='normal').map(v=>`<div class="flex items-center gap-3 py-2.5" style="border-top:1px solid ${COL.gray.bd}"><div class="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style="background:${v.vstatus==='anomali'?COL.red.bg:COL.amber.bg}">${v.vstatus==='anomali'?'🚨':'⚠️'}</div><div class="flex-1 min-w-0"><div class="font-bold text-sm">${v.name}</div><div class="text-xs" style="color:rgba(120,120,120,.4)">Variance ${v.pct}% · Theo ${v.qty_theo}${v.unit} → Actual ${v.qty_sys}${v.unit}</div></div><div class="text-right shrink-0"><div class="font-bold text-sm" style="color:${COL.red.t}">${rp(v.loss)}</div><div class="pill" style="background:${v.vstatus==='anomali'?COL.red.bg:COL.amber.bg};color:${v.vstatus==='anomali'?COL.red.t:COL.amber.t}">${v.vstatus==='anomali'?'Anomali':'Watch'}</div></div></div>`).join('')}</div>
    <div class="c p-4"><h2 class="font-bold text-sm mb-3">📋 Ledger Terbaru</h2>${LEDGER.slice(0,5).map(l=>{const tc={SALE:COL.blue,WASTE:COL.red,OPNAME:COL.amber,RECEIVE:COL.green};const c=tc[l.type]||COL.gray;return `<div class="flex items-center gap-3 py-2" style="border-top:1px solid ${COL.gray.bd}"><div class="pill" style="background:${c.bg};color:${c.t}">${l.type}</div><div class="flex-1 min-w-0 text-xs font-medium truncate">${l.ing} <span style="color:rgba(120,120,120,.35)">${l.qty>0?'+':''}${l.qty} ${l.ref}</span></div><div class="text-[10px] shrink-0" style="color:rgba(120,120,120,.3)">${l.ts} · ${l.actor}</div></div>`}).join('')}</div>
  </div>`;
}

/* ═══ KEEPER: STOCK ═══ */
function vInvStock(){
  return `<div class="fi space-y-4"><h1 class="text-xl font-black">Stock Levels</h1><div class="c overflow-hidden"><div class="tw"><table class="tbl"><thead style="background:${COL.gray.bg}"><tr><th>Bahan</th><th>Stok</th><th>Min</th><th>Level</th><th>Status</th><th>ABC</th><th>Supplier</th></tr></thead><tbody>${ING.map(i=>{const s=ingStatus(i);const pct=Math.min(Math.round(i.qty_sys/(i.min*1.5)*100),100);return `<tr><td class="font-bold">${i.name}</td><td class="font-mono font-bold">${i.qty_sys} ${i.unit}</td><td class="font-mono" style="color:rgba(120,120,120,.35)">${i.min} ${i.unit}</td><td><div class="w-16 bar-t"><div class="bar-f" style="width:${pct}%;background:${s.c.t}"></div></div></td><td><span class="pill" style="background:${s.c.bg};color:${s.c.t}">${s.k}</span></td><td><span class="pill" style="background:${COL.gray.bg};color:${COL.gray.t}">${i.abc}</span></td><td style="color:rgba(120,120,120,.35)">${i.supplier}</td></tr>`}).join('')}</tbody></table></div></div></div>`;
}

/* ═══ KEEPER: RECIPE ═══ */
function vInvRecipe(){
  return `<div class="fi space-y-4"><h1 class="text-xl font-black">Recipes (BOM)</h1><div class="grid sm:grid-cols-2 gap-3">${RECIPES.map(r=>{const hpp=r.items.reduce((a,it)=>{const ig=ING.find(x=>x.id===it.ing);return a+(ig?ig.cost*it.qty:0)},0);return `<div class="c p-4"><div class="flex items-center justify-between mb-3"><div class="font-bold">${r.product}</div><div class="pill" style="background:${COL.green.bg};color:${COL.green.t}">HPP ${rp(hpp)}</div></div>${r.items.map(it=>{const ig=ING.find(x=>x.id===it.ing);return `<div class="flex items-center justify-between text-xs py-1" style="border-top:1px solid ${COL.gray.bd}"><span>${ig?ig.name:'?'}</span><span class="font-mono font-bold">${it.qty} ${it.unit}</span></div>`}).join('')}</div>`}).join('')}</div></div>`;
}

/* ═══ KEEPER: OPNAME ═══ */
function startOpname(idx){const item=OPNAME_TODAY[idx];if(item.done)return;opnInput='';modal(`<div class="p-5"><h2 class="font-bold text-lg mb-1">Stock Opname</h2><div class="text-xs mb-4" style="color:rgba(120,120,120,.4)">${item.ing.name} · ${item.ing.storage}</div><div class="c p-3 mb-4 text-center" style="background:${COL.blue.bg};border-color:${COL.blue.bd}"><div class="text-xs font-bold" style="color:${COL.blue.t}">Sistem menunjukkan</div><div class="text-2xl font-black mt-1">${item.ing.qty_theo} ${item.ing.unit}</div></div><div class="text-xs font-bold mb-2" style="color:rgba(120,120,120,.4)">Berapa stok fisik?</div><div id="opn-display" class="text-center text-3xl font-black py-3 mb-3 rounded-xl" style="background:${COL.gray.bg}">0</div><div class="grid grid-cols-3 gap-2 mb-4">${[1,2,3,4,5,6,7,8,9,'.',0,'⌫'].map(k=>`<div class="numpad-btn" onclick="opnTap('${k}',${idx})">${k}</div>`).join('')}</div><button class="btn btn-p w-full py-3" onclick="submitOpname(${idx})">✅ Konfirmasi</button></div>`)}
function opnTap(k,idx){if(k==='⌫')opnInput=opnInput.slice(0,-1);else if(k==='.'&&opnInput.includes('.'))return;else opnInput+=k;document.getElementById('opn-display').textContent=opnInput||'0'}
function submitOpname(idx){const val=parseFloat(opnInput);if(isNaN(val)){toast('Masukkan angka valid',false);return}OPNAME_TODAY[idx].done=true;OPNAME_TODAY[idx].fisik=val;const diff=val-OPNAME_TODAY[idx].ing.qty_theo;closeModal();if(Math.abs(diff/OPNAME_TODAY[idx].ing.qty_theo)>0.05)toast(`⚠️ Selisih ${diff.toFixed(2)} ${OPNAME_TODAY[idx].ing.unit}!`,false);else toast(`✅ ${OPNAME_TODAY[idx].ing.name} OK`);render()}

function vInvOpname(){
  return `<div class="fi space-y-4"><div class="flex items-center justify-between"><div><h1 class="text-xl font-black">Stock Opname</h1><div class="text-xs mt-0.5" style="color:rgba(120,120,120,.4)">${OPNAME_TODAY.filter(o=>o.done).length}/${OPNAME_TODAY.length} selesai</div></div><div class="pill" style="background:${COL.amber.bg};color:${COL.amber.t}">Toyota Cycle Count</div></div><div class="space-y-3">${OPNAME_TODAY.map((o,idx)=>{const diff=o.done?(o.fisik-o.ing.qty_theo):null;const pctDiff=o.done&&o.ing.qty_theo?Math.abs(diff/o.ing.qty_theo*100):0;const isAnomaly=pctDiff>5;return `<div class="c p-4 cursor-pointer" onclick="${o.done?'':`startOpname(${idx})`}" style="${o.done?'opacity:.8':''}"><div class="flex items-center gap-3"><div class="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style="background:${o.done?(isAnomaly?COL.red.bg:COL.green.bg):COL.blue.bg}">${o.done?(isAnomaly?'⚠️':'✅'):'📋'}</div><div class="flex-1 min-w-0"><div class="font-bold">${o.ing.name}</div><div class="text-xs" style="color:rgba(120,120,120,.35)">${o.ing.storage} · ABC ${o.ing.abc} · Sys ${o.ing.qty_theo} ${o.ing.unit}</div></div><div class="text-right shrink-0">${o.done?`<div class="font-bold text-sm">Fisik ${o.fisik} ${o.ing.unit}</div><div class="text-xs font-bold" style="color:${isAnomaly?COL.red.t:COL.green.t}">Δ ${diff>0?'+':''}${diff.toFixed(2)} (${pctDiff.toFixed(1)}%)</div>`:`<span class="btn btn-p btn-s">Hitung →</span>`}</div></div></div>`}).join('')}</div></div>`;
}

/* ═══ KEEPER: PO ═══ */
function vInvPO(){
  return `<div class="fi space-y-4"><div class="flex items-center justify-between"><h1 class="text-xl font-black">Purchase Orders</h1><button class="btn btn-p btn-s" onclick="toast('Buat PO baru...')">+ Buat PO</button></div><div class="space-y-3">${POS_LIST.map(po=>{const sc={draft:COL.amber,sent:COL.blue,received:COL.green};const c=sc[po.status]||COL.gray;return `<div class="c p-4"><div class="flex items-center justify-between mb-2"><div class="flex items-center gap-2"><span class="font-bold font-mono">${po.id}</span><span class="pill" style="background:${c.bg};color:${c.t}">${po.status.toUpperCase()}</span>${po.auto?`<span class="pill" style="background:${COL.green.bg};color:${COL.green.t}">🤖 Auto</span>`:''}</div><div class="font-bold" style="color:${COL.green.t}">${rp(po.total)}</div></div><div class="text-xs" style="color:rgba(120,120,120,.4)">${po.supplier} · ETA ${po.eta}</div><div class="text-xs mt-1" style="color:rgba(120,120,120,.35)">${po.items.map(it=>`${it.name} (${it.qty} ${it.unit})`).join(', ')}</div>${po.status==='draft'?`<div class="flex gap-2 mt-3"><button class="btn btn-p btn-s flex-1" onclick="toast('PO approved & sent!')">✅ Approve</button><button class="btn btn-o btn-s" onclick="toast('Editing...')">Edit</button></div>`:''}</div>`}).join('')}</div></div>`;
}

/* ═══ KEEPER: VARIANCE ═══ */
function vInvVariance(){
  const sorted=[...VARIANCE].sort((a,b)=>b.loss-a.loss);
  const totalLoss=sorted.filter(v=>v.vstatus!=='normal').reduce((a,v)=>a+v.loss,0);
  return `<div class="fi space-y-4"><div class="flex items-center justify-between"><div><h1 class="text-xl font-black">Variance Analysis</h1><div class="text-xs mt-0.5" style="color:rgba(120,120,120,.4)">Theoretical vs Actual</div></div><div class="text-right"><div class="text-[10px] font-bold uppercase" style="color:rgba(120,120,120,.3)">Total Loss</div><div class="font-black text-lg" style="color:${COL.red.t}">${rp(totalLoss)}</div></div></div><div class="c overflow-hidden"><div class="tw"><table class="tbl"><thead style="background:${COL.gray.bg}"><tr><th>Bahan</th><th>Theo</th><th>Actual</th><th>Variance</th><th>Loss</th><th>Status</th></tr></thead><tbody>${sorted.map(v=>{const sc={anomali:COL.red,watch:COL.amber,normal:COL.green};const c=sc[v.vstatus];return `<tr><td class="font-bold">${v.name}</td><td class="font-mono">${v.qty_theo} ${v.unit}</td><td class="font-mono font-bold">${v.qty_sys} ${v.unit}</td><td class="font-mono font-bold" style="color:${v.pct>5?COL.red.t:COL.green.t}">${v.diff>0?'+':''}${v.diff.toFixed(2)} (${v.pct}%)</td><td class="font-mono font-bold" style="color:${v.loss>0?COL.red.t:'inherit'}">${v.loss>0?rp(v.loss):'-'}</td><td><span class="pill" style="background:${c.bg};color:${c.t}">${v.vstatus==='anomali'?'🚨 Anomali':v.vstatus==='watch'?'⚠️ Watch':'✅ Normal'}</span></td></tr>`}).join('')}</tbody></table></div></div></div>`;
}

/* ═══ KEEPER: LEDGER ═══ */
function vInvLedger(){
  return `<div class="fi space-y-4"><h1 class="text-xl font-black">Audit Ledger</h1><div class="text-xs" style="color:rgba(120,120,120,.4)">Immutable log — setiap pergerakan bahan tercatat permanen</div><div class="c overflow-hidden"><div class="tw"><table class="tbl"><thead style="background:${COL.gray.bg}"><tr><th>Waktu</th><th>Type</th><th>Bahan</th><th>Qty</th><th>Referensi</th><th>Actor</th></tr></thead><tbody>${LEDGER.map(l=>{const tc={SALE:COL.blue,WASTE:COL.red,OPNAME:COL.amber,RECEIVE:COL.green};const c=tc[l.type]||COL.gray;return `<tr><td class="font-mono" style="color:rgba(120,120,120,.35)">${l.ts}</td><td><span class="pill" style="background:${c.bg};color:${c.t}">${l.type}</span></td><td class="font-bold">${l.ing}</td><td class="font-mono font-bold" style="color:${l.qty>0?COL.green.t:COL.red.t}">${l.qty>0?'+':''}${l.qty}</td><td class="text-xs" style="color:rgba(120,120,120,.4)">${l.ref}</td><td style="color:rgba(120,120,120,.35)">${l.actor}</td></tr>`}).join('')}</tbody></table></div></div></div>`;
}

/* ═══ RENDER ═══ */
function render(){
  const views={dashboard:vDashboard,alerts:vAlerts,insights:vInsights,pos:vPOS,invOverview:vInvOverview,invStock:vInvStock,invRecipe:vInvRecipe,invOpname:vInvOpname,invPO:vInvPO,invVariance:vInvVariance,invLedger:vInvLedger};
  const content=(views[view]||vDashboard)();
  const navs=role==='owner'?NAVS_OWNER:role==='kasir'?NAVS_KASIR:NAVS_KEEPER;

  document.getElementById('app').innerHTML=`
  <div class="shell">
    <div id="sbd" class="side-bd ${sideOpen?'show':''}" onclick="toggleSide(false)"></div>
    <aside id="sb" class="side bg-white dark:bg-[#0f1117] flex flex-col h-[100dvh] ${sideOpen?'open':''}" style="border-right:1px solid ${COL.gray.bd}">
      <div class="h-14 flex items-center px-4 shrink-0" style="border-bottom:1px solid ${COL.gray.bd}">
        <div class="w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] text-white mr-2.5" style="background:#059669">OS</div>
        <div><div class="font-bold text-sm leading-none">StoreOS <span style="color:#059669">AI</span></div><div class="text-[9px] mt-0.5" style="color:rgba(120,120,120,.4)">${BRAND}</div></div>
        <button class="md:hidden ml-auto text-lg" style="color:rgba(120,120,120,.4)" onclick="toggleSide(false)">✕</button>
      </div>
      <nav class="flex-1 overflow-y-auto p-2 space-y-0.5">${navs.map(n=>`<a class="nl ${view===n.id?'act':''}" onclick="go('${n.id}')">${n.i}<span class="flex-1">${n.l}</span>${n.badge?`<span class="pill" style="background:${COL.red.bg};color:${COL.red.t}">${n.badge}</span>`:''}</a>`).join('')}</nav>
      <div class="p-3 shrink-0" style="border-top:1px solid ${COL.gray.bd}"><div class="text-[10px] font-bold uppercase mb-2" style="color:rgba(120,120,120,.3)">Switch Role (Demo)</div><select class="input !py-1.5 !text-xs font-medium cursor-pointer" onchange="setRole(this.value)"><option value="owner" ${role==='owner'?'selected':''}>👑 Owner</option><option value="kasir" ${role==='kasir'?'selected':''}>🧾 Kasir (POS)</option><option value="keeper" ${role==='keeper'?'selected':''}>📦 Store Keeper</option></select></div>
    </aside>
    <main class="main">
      <header class="md:hidden h-12 bg-white dark:bg-[#0f1117] flex items-center px-4 sticky top-0 z-50" style="border-bottom:1px solid ${COL.gray.bd}"><button class="mr-3" style="color:rgba(120,120,120,.5)" onclick="toggleSide(true)">${IC.menu}</button><span class="font-bold text-sm">StoreOS AI</span></header>
      <div class="p-4 md:p-7 max-w-[1400px] mx-auto pb-20">${content}</div>
    </main>
  </div>`;
}

render();

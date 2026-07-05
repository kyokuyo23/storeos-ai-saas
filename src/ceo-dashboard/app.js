/* StoreOS AI — CEO Dashboard v3.1 (Fixed) */

/* ── Color Maps (no dynamic Tailwind) ── */
const HC={
  green:{text:'#059669',textD:'#34d399',bg:'#ecfdf5',bgD:'rgba(5,150,105,.12)',ring:'#059669',border:'#a7f3d0',borderD:'rgba(5,150,105,.25)'},
  amber:{text:'#d97706',textD:'#fbbf24',bg:'#fffbeb',bgD:'rgba(217,119,6,.12)',ring:'#f59e0b',border:'#fde68a',borderD:'rgba(245,158,11,.25)'},
  red:{text:'#dc2626',textD:'#f87171',bg:'#fef2f2',bgD:'rgba(220,38,38,.12)',ring:'#ef4444',border:'#fecaca',borderD:'rgba(239,68,68,.25)'},
};
const hc=score=>score>=80?HC.green:score>=60?HC.amber:HC.red;
const hlabel=score=>score>=80?'Sehat':score>=60?'Waspada':'Kritis';
const isDark=document.documentElement.classList.contains('dark');
const pick=(light,dark)=>isDark?dark:light;

/* ── SVG Helpers ── */
const spark=(data,w=80,h=28,color='#059669')=>{
  const max=Math.max(...data)*1.15,min=Math.min(...data)*0.85;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/(max-min))*h}`);
  const pathD='M '+pts.join(' L ');
  const areaD=pathD+` L ${w},${h} L 0,${h} Z`;
  const gid='sg'+Math.random().toString(36).slice(2,6);
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="overflow-visible">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${areaD}" fill="url(#${gid})"/>
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
};

const healthRing=(score,size=160)=>{
  const c=hc(score);
  const r=62,circ=2*Math.PI*r,offset=circ-(score/100)*circ;
  return `
    <div class="health-ring pop" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(120,120,120,.07)" stroke-width="12"/>
        <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${c.ring}" stroke-width="12" stroke-linecap="round"
          stroke-dasharray="${circ}" stroke-dashoffset="${offset}" style="transition:stroke-dashoffset 1.5s cubic-bezier(.4,0,.2,1);filter:drop-shadow(0 0 6px ${c.ring}40)"/>
      </svg>
      <div class="score">
        <div class="text-4xl font-black" style="color:${c.ring}">${score}</div>
        <div class="text-[10px] font-bold uppercase tracking-wider mt-0.5" style="color:${pick(c.text,c.textD)}">${hlabel(score)}</div>
      </div>
    </div>`;
};

/* ── Revenue Velocity ── */
const velocityChart=()=>{
  const W=640,H=220,pL=42,pR=16,pT=14,pB=30;
  const plotW=W-pL-pR,plotH=H-pT-pB;
  const maxV=Math.max(...CUM_TGT,...CUM_ACT)*1.1;
  const x=i=>pL+(i/23)*plotW;
  const y=v=>pT+plotH-(v/maxV)*plotH;

  let tgtPath='',actPath='',grid='',labels='';
  let lastH=0;
  for(let i=0;i<24;i++){
    const px=x(i);
    if(i%3===0){
      grid+=`<line x1="${px}" y1="${pT}" x2="${px}" y2="${H-pB}" stroke="${isDark?'rgba(255,255,255,.04)':'rgba(0,0,0,.04)'}" stroke-width="1"/>`;
      labels+=`<text x="${px}" y="${H-8}" text-anchor="middle" font-size="10" font-weight="500" fill="${isDark?'rgba(255,255,255,.3)':'rgba(0,0,0,.3)'}">${String(i).padStart(2,'0')}:00</text>`;
    }
    tgtPath+=(i===0?'M':'L')+px+','+y(CUM_TGT[i])+' ';
    if(CUM_ACT[i]>0){actPath+=(actPath===''?'M':'L')+px+','+y(CUM_ACT[i])+' ';lastH=i;}
  }
  
  const actArea=actPath?actPath+`L ${x(lastH)},${H-pB} L ${pL},${H-pB} Z`:'';

  // Y axis
  for(let i=0;i<=4;i++){
    const val=Math.round((maxV/4)*i);
    const yp=pT+plotH-(val/maxV)*plotH;
    grid+=`<line x1="${pL}" y1="${yp}" x2="${W-pR}" y2="${yp}" stroke="${isDark?'rgba(255,255,255,.04)':'rgba(0,0,0,.04)'}" stroke-width="1"/>`;
    grid+=`<text x="${pL-6}" y="${yp+3}" text-anchor="end" font-size="9" font-weight="500" fill="${isDark?'rgba(255,255,255,.3)':'rgba(0,0,0,.3)'}">${rpK(val*1000)}</text>`;
  }

  const nowX=x(Math.min(H,lastH));
  const nowY=y(CUM_ACT[lastH]||0);
  const tgtNow=CUM_TGT[lastH]||0;
  const actNow=CUM_ACT[lastH]||0;
  const pctNow=tgtNow?Math.round(actNow/tgtNow*100):0;
  const ahead=actNow>=tgtNow;

  return `
    <div class="flex items-center gap-4 mb-4">
      <div class="flex items-center gap-2 px-3 py-1.5 rounded-lg" style="background:${ahead?pick(HC.green.bg,HC.green.bgD):pick(HC.amber.bg,HC.amber.bgD)}">
        <span class="text-sm font-black" style="color:${ahead?pick(HC.green.text,HC.green.textD):pick(HC.amber.text,HC.amber.textD)}">${pctNow}%</span>
        <span class="text-xs font-medium" style="color:${ahead?pick(HC.green.text,HC.green.textD):pick(HC.amber.text,HC.amber.textD)}">${ahead?'Ahead of target':'Below target'}</span>
      </div>
      <div class="text-xs text-gray-400 font-medium">Pukul ${String(lastH).padStart(2,'0')}:00 · ${rpK(actNow*1000)} dari target ${rpK(tgtNow*1000)}</div>
    </div>
    <div class="overflow-x-auto -mx-2 px-2">
      <svg viewBox="0 0 ${W} ${H}" class="w-full" style="min-width:480px">
        <defs><linearGradient id="vg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#059669" stop-opacity=".25"/><stop offset="1" stop-color="#059669" stop-opacity="0"/></linearGradient></defs>
        ${grid}${labels}
        <path d="${tgtPath}" fill="none" stroke="${isDark?'rgba(255,255,255,.15)':'rgba(0,0,0,.12)'}" stroke-width="2" stroke-dasharray="6 4"/>
        ${actArea?`<path d="${actArea}" fill="url(#vg)"/>`:''}
        ${actPath?`<path d="${actPath}" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`:''}
        <line x1="${nowX}" y1="${pT}" x2="${nowX}" y2="${H-pB}" stroke="#059669" stroke-width="1" stroke-dasharray="3 3" opacity=".4"/>
        <circle cx="${nowX}" cy="${nowY}" r="5" fill="#059669" stroke="${isDark?'#0a0c10':'white'}" stroke-width="2.5">
          <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite"/>
        </circle>
      </svg>
    </div>`;
};

/* ── Week Chart ── */
const weekChart=()=>{
  const max=Math.max(...WEEK_REV)*1.15;
  return WEEK_REV.map((v,i)=>{
    const h=Math.round((v/max)*64);
    const today=i===WEEK_REV.length-1;
    return `<div class="flex flex-col items-center gap-1.5 flex-1">
      <div class="text-[9px] font-bold" style="color:${today?'#059669':'rgba(120,120,120,.5)'}">${rpK(v)}</div>
      <div class="w-full rounded-lg transition-all" style="height:${h}px;background:${today?'#059669':isDark?'rgba(255,255,255,.06)':'rgba(0,0,0,.06)'}"></div>
      <div class="text-[10px] font-bold" style="color:${today?'#059669':'rgba(120,120,120,.5)'}">${WEEK_DAYS[i]}</div>
    </div>`;
  }).join('');
};

/* ── Branch Card ── */
const branchCard=(b)=>{
  const c=hc(b.health);
  const p=Math.round(b.rev/b.target*100);
  const hasLeak=b.leak>100_000;
  return `
    <div class="c p-4 relative overflow-hidden cursor-pointer dec-card" style="border-color:${pick(c.border,c.borderD)}">
      <div class="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[11px] font-black" style="color:${pick(c.text,c.textD)};background:${pick(c.bg,c.bgD)}">${b.health}</div>
      <div class="font-bold text-sm mb-1">${b.name}</div>
      <div class="text-[11px] text-gray-400 mb-3">${b.trx} transaksi · Margin ${b.margin}%</div>
      <div class="text-2xl font-black mb-2">${rpK(b.rev)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.min(p,100)}%;background:${c.ring}"></div></div>
      <div class="flex items-center justify-between mt-2">
        <span class="text-[10px] font-bold" style="color:${pick(c.text,c.textD)}">${p}% target</span>
        ${hasLeak?`<span class="text-[10px] font-bold" style="color:${pick(HC.red.text,HC.red.textD)}">Leak ${rpK(b.leak)}</span>`:`<span class="text-[10px] font-bold" style="color:${pick(HC.green.text,HC.green.textD)}">Clean ✓</span>`}
      </div>
      <div class="mt-3 pt-3 flex items-center justify-between" style="border-top:1px solid ${isDark?'rgba(255,255,255,.05)':'rgba(0,0,0,.05)'}">
        <span class="text-[10px] text-gray-400 font-medium">7-day trend</span>
        ${spark(b.trend,56,20,c.ring)}
      </div>
    </div>`;
};

/* ── Decision Card ── */
const decisionCard=(d)=>{
  const colors={critical:{border:pick('#fecaca','rgba(239,68,68,.25)'),bg:pick('#fef2f2','rgba(239,68,68,.04)')},high:{border:pick('#fde68a','rgba(245,158,11,.25)'),bg:pick('#fffbeb','rgba(245,158,11,.04)')},medium:{border:pick('#e5e7eb','rgba(120,120,120,.15)'),bg:'transparent'}};
  const cc=colors[d.urgency];
  return `
    <div class="dec-card p-3.5 rounded-xl cursor-pointer" style="border:1px solid ${cc.border};background:${cc.bg}">
      <div class="flex items-start gap-3">
        <div class="text-xl mt-0.5 leading-none">${d.icon}</div>
        <div class="flex-1 min-w-0">
          <div class="font-bold text-[13px] leading-snug">${d.title}</div>
          <div class="text-[11px] mt-0.5" style="color:rgba(120,120,120,.6)">${d.sub}</div>
        </div>
        <div class="text-[10px] font-bold shrink-0" style="color:rgba(120,120,120,.4)">${d.time}</div>
      </div>
    </div>`;
};

/* ── Timeline ── */
const timelineItem=(e,i,total)=>{
  const dotColors={ok:'#059669',warn:'#f59e0b',alert:'#ef4444',info:'#3b82f6'};
  const textColors={ok:pick('#047857','#34d399'),warn:pick('#b45309','#fbbf24'),alert:pick('#dc2626','#f87171'),info:pick('#2563eb','#60a5fa')};
  return `
    <div class="flex gap-3">
      <div class="flex flex-col items-center">
        <div style="width:10px;height:10px;border-radius:50%;background:${dotColors[e.type]};box-shadow:0 0 8px ${dotColors[e.type]}40;flex-shrink:0"></div>
        ${i<total-1?'<div style="width:2px;flex:1;min-height:28px;background:rgba(120,120,120,.1);margin:4px 0"></div>':''}
      </div>
      <div class="pb-4 flex-1 min-w-0">
        <div class="text-[10px] font-bold" style="color:rgba(120,120,120,.4)">${e.t}</div>
        <div class="text-[13px] font-medium leading-snug mt-0.5" style="color:${textColors[e.type]}">${e.msg}</div>
      </div>
    </div>`;
};

/* ══════════════════════════════════════════
   MAIN RENDER
   ══════════════════════════════════════════ */
function render(){
  const pct=Math.round(TOT_REV/TOT_TGT*100);

  document.getElementById('app').innerHTML=`
  <div class="max-w-[1440px] mx-auto px-4 md:px-8 py-6 md:py-8 fi">

    <!-- HEADER -->
    <header class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-lg" style="background:#059669;box-shadow:0 4px 14px rgba(5,150,105,.3)">OS</div>
        <div>
          <div class="text-xs font-medium" style="color:rgba(120,120,120,.5)">${GREET}, Owner</div>
          <h1 class="text-xl md:text-2xl font-black tracking-tight">${BRAND}</h1>
        </div>
      </div>
      <div class="flex items-center gap-3 text-xs">
        <div class="flex items-center gap-1.5" style="color:rgba(120,120,120,.5)">
          <span class="w-2 h-2 rounded-full pulse" style="background:#059669"></span>Live · ${TODAY}
        </div>
        <div class="pill" style="background:${pick(HC.green.bg,HC.green.bgD)};color:${pick(HC.green.text,HC.green.textD)}">3 cabang aktif</div>
      </div>
    </header>

    <!-- HEALTH + KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-12 gap-5 mb-6">
      
      <div class="c p-6 md:col-span-3 flex flex-col items-center justify-center text-center">
        ${healthRing(HEALTH_SCORE,160)}
        <div class="mt-3 text-[11px] font-bold uppercase tracking-wider" style="color:rgba(120,120,120,.5)">Business Health</div>
        <div class="text-[10px] mt-1" style="color:rgba(120,120,120,.35)">Revenue · Margin · Leak</div>
      </div>

      <div class="md:col-span-9 grid grid-cols-2 md:grid-cols-4 gap-4">

        <!-- Revenue -->
        <div class="c p-4">
          <div class="flex items-center justify-between mb-1">
            <div class="text-[10px] font-bold uppercase tracking-wider" style="color:rgba(120,120,120,.5)">Revenue</div>
            <div class="pill text-[10px]" style="background:${pick(HC.green.bg,HC.green.bgD)};color:${pick(HC.green.text,HC.green.textD)}">▲ +12.4%</div>
          </div>
          <div class="text-2xl font-black mt-2">${rpK(TOT_REV)}</div>
          <div class="mt-3 bar-track"><div class="bar-fill" style="width:${Math.min(pct,100)}%;background:#059669"></div></div>
          <div class="text-[10px] mt-1.5 font-medium" style="color:rgba(120,120,120,.4)">${pct}% dari target ${rpK(TOT_TGT)}</div>
        </div>

        <!-- Margin -->
        <div class="c p-4">
          <div class="flex items-center justify-between mb-1">
            <div class="text-[10px] font-bold uppercase tracking-wider" style="color:rgba(120,120,120,.5)">Avg Margin</div>
            ${spark([58,57,59,58,60,59,AVG_MARGIN],48,18,'#059669')}
          </div>
          <div class="text-2xl font-black mt-2">${AVG_MARGIN}%</div>
          <div class="text-[10px] mt-3 font-medium" style="color:rgba(120,120,120,.4)">Target: 60% · <span style="color:${AVG_MARGIN>=60?pick(HC.green.text,HC.green.textD):pick(HC.amber.text,HC.amber.textD)}">${AVG_MARGIN>=60?'On track ✓':'Below target'}</span></div>
        </div>

        <!-- AI Saved -->
        <div class="c p-4" style="background:${pick(HC.green.bg,HC.green.bgD)};border-color:${pick(HC.green.border,HC.green.borderD)}">
          <div class="text-[10px] font-bold uppercase tracking-wider mb-1" style="color:${pick(HC.green.text,HC.green.textD)}">⭐ AI Saved</div>
          <div class="text-2xl font-black mt-2" style="color:${pick('#047857','#34d399')}">${rpK(SAVED)}</div>
          <div class="text-[10px] mt-3 font-medium" style="color:${pick('rgba(5,100,70,.6)','rgba(52,211,153,.5)')}">Bulan ini · ROI 89x langganan</div>
        </div>

        <!-- Leak -->
        <div class="c p-4">
          <div class="flex items-center justify-between mb-1">
            <div class="text-[10px] font-bold uppercase tracking-wider" style="color:rgba(120,120,120,.5)">Leak Detected</div>
            <div class="pill text-[10px]" style="background:${pick(HC.red.bg,HC.red.bgD)};color:${pick(HC.red.text,HC.red.textD)}">Today</div>
          </div>
          <div class="text-2xl font-black mt-2" style="color:${pick(HC.red.text,HC.red.textD)}">${rpK(TOT_LEAK)}</div>
          <div class="text-[10px] mt-3 font-medium" style="color:rgba(120,120,120,.4)">${B.filter(b=>b.leak>100_000).length} cabang ada anomali</div>
        </div>

      </div>
    </div>

    <!-- MAIN GRID -->
    <div class="dash-grid">
      
      <!-- LEFT -->
      <div class="space-y-5">

        <div class="c p-5">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <div>
              <h2 class="font-bold text-base">Revenue Velocity</h2>
              <div class="text-[11px] mt-0.5" style="color:rgba(120,120,120,.4)">Aktual vs target per jam · real-time</div>
            </div>
            <div class="flex items-center gap-4 text-[11px] font-medium" style="color:rgba(120,120,120,.5)">
              <span class="flex items-center gap-1.5"><span style="width:12px;height:3px;background:#059669;border-radius:2px;display:inline-block"></span>Aktual</span>
              <span class="flex items-center gap-1.5"><span style="width:12px;height:0;border-top:2px dashed rgba(120,120,120,.3);display:inline-block"></span>Target</span>
            </div>
          </div>
          ${velocityChart()}
        </div>

        <div>
          <div class="flex items-center justify-between mb-3 px-1">
            <h2 class="font-bold text-base">Branch Performance</h2>
            <span class="text-[11px] font-medium" style="color:rgba(120,120,120,.4)">Ranked by health</span>
          </div>
          <div class="grid sm:grid-cols-3 gap-3">
            ${[...B].sort((a,b)=>b.health-a.health).map(b=>branchCard(b)).join('')}
          </div>
        </div>

        <div class="c p-5">
          <h2 class="font-bold text-base mb-4">Revenue Minggu Ini</h2>
          <div class="flex items-end gap-2 px-2" style="height:80px">${weekChart()}</div>
        </div>

      </div>

      <!-- RIGHT -->
      <div class="space-y-5">

        <div class="c p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-bold text-base flex items-center gap-2">
              <span class="w-2 h-2 rounded-full pulse" style="background:#ef4444"></span>
              Perlu Keputusan Anda
            </h2>
            <span class="pill" style="background:${pick(HC.red.bg,HC.red.bgD)};color:${pick(HC.red.text,HC.red.textD)}">${DECISIONS.length}</span>
          </div>
          <div class="space-y-2.5">${DECISIONS.map(d=>decisionCard(d)).join('')}</div>
        </div>

        <div class="c p-5">
          <h2 class="font-bold text-base mb-4">Timeline Hari Ini</h2>
          ${TIMELINE.map((e,i)=>timelineItem(e,i,TIMELINE.length)).join('')}
        </div>

        <div class="c p-5">
          <div class="flex items-center gap-2 mb-4">
            <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs text-white" style="background:#25D366">WA</div>
            <div>
              <div class="font-bold text-sm">Daily Brief</div>
              <div class="text-[10px]" style="color:rgba(120,120,120,.4)">Dikirim otomatis pukul 21:00</div>
            </div>
          </div>
          <div class="brief-bubble">${BRIEF.replace(/\*(.+?)\*/g,'<b>$1</b>').replace(/\n/g,'<br>')}<div class="text-right text-[10px] mt-2" style="color:rgba(120,120,120,.4)">21:00 ✓✓</div></div>
        </div>

        <div class="c p-5">
          <h2 class="font-bold text-base mb-3">Cash Position</h2>
          <div class="space-y-2.5">
            <div class="flex items-center justify-between">
              <span class="text-[13px]" style="color:rgba(120,120,120,.6)">Saldo Bank</span>
              <span class="text-[13px] font-bold font-mono">${rpK(CASH.bank)}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-[13px]" style="color:rgba(120,120,120,.6)">Piutang</span>
              <span class="text-[13px] font-bold font-mono" style="color:${pick(HC.amber.text,HC.amber.textD)}">${rpK(CASH.receivable)}</span>
            </div>
            <div class="flex items-center justify-between pt-2" style="border-top:1px solid ${isDark?'rgba(255,255,255,.05)':'rgba(0,0,0,.05)'}">
              <span class="text-[13px]" style="color:rgba(120,120,120,.6)">Hutang Supplier</span>
              <span class="text-[13px] font-bold font-mono" style="color:${pick(HC.red.text,HC.red.textD)}">-${rpK(CASH.payable)}</span>
            </div>
            <div class="flex items-center justify-between pt-2.5 mt-1" style="border-top:2px solid ${isDark?'rgba(255,255,255,.08)':'rgba(0,0,0,.08)'}">
              <span class="text-[14px] font-bold">Net Cash</span>
              <span class="text-lg font-black font-mono" style="color:${pick(HC.green.text,HC.green.textD)}">${rpK(CASH.bank+CASH.receivable-CASH.payable)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>

    <footer class="mt-10 text-center text-[11px] pb-6" style="color:rgba(120,120,120,.2)">StoreOS AI · CEO Dashboard v3.1</footer>
  </div>`;
}

render();

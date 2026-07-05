/* StoreOS AI — Inventory Engine Prototype */

let view='overview';
let sideOpen=false;

const toast=(msg,ok=true)=>{const t=document.createElement('div');t.className='toast';t.style.background=ok?'#059669':'#ef4444';t.textContent=msg;document.getElementById('toast-box').appendChild(t);setTimeout(()=>{t.style.opacity=0;setTimeout(()=>t.remove(),300)},2500)};
const modal=(h)=>{const o=document.getElementById('modal-overlay');o.innerHTML=`<div class="modal-bg absolute inset-0" onclick="closeModal()"></div><div class="modal-c relative z-10 m-auto mt-16 mb-16 pop">${h}</div>`;o.classList.replace('hidden','flex');document.body.style.overflow='hidden'};
const closeModal=()=>{document.getElementById('modal-overlay').classList.replace('flex','hidden');document.body.style.overflow=''};
const go=v=>{view=v;if(innerWidth<768)toggleSide(false);render();document.querySelector('.main')?.scrollTo(0,0)};
const toggleSide=(f)=>{sideOpen=f!==undefined?f:!sideOpen;const s=document.getElementById('sb');const b=document.getElementById('sbd');if(s){if(sideOpen){s.classList.add('open');b?.classList.add('show')}else{s.classList.remove('open');b?.classList.remove('show')}}};

const IC={
  overview:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>',
  stock:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>',
  recipe:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>',
  opname:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>',
  po:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z"/></svg>',
  variance:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.962-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>',
  ledger:'<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>',
  menu:'<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>',
};

const NAVS=[
  {id:'overview',l:'Overview',i:IC.overview},
  {id:'stock',l:'Stock Levels',i:IC.stock},
  {id:'recipe',l:'Recipes (BOM)',i:IC.recipe},
  {id:'opname',l:'Stock Opname',i:IC.opname},
  {id:'po',l:'Purchase Orders',i:IC.po},
  {id:'variance',l:'Variance Analysis',i:IC.variance},
  {id:'ledger',l:'Audit Ledger',i:IC.ledger},
];

/* ═══ VIEWS ═══ */

function vOverview(){
  const kritis=ING.filter(i=>i.qty_sys<=i.min*0.4).length;
  const rendah=ING.filter(i=>i.qty_sys<i.min&&i.qty_sys>i.min*0.4).length;
  const anomali=VARIANCE.filter(v=>v.vstatus==='anomali').length;
  const totalLoss=VARIANCE.filter(v=>v.vstatus!=='normal').reduce((a,v)=>a+v.loss,0);
  const pendingPO=POS_LIST.filter(p=>p.status==='draft').length;

  return `<div class="fi space-y-5">
    <div class="flex items-end justify-between">
      <div><h1 class="text-xl md:text-2xl font-black tracking-tight">Inventory Overview</h1>
      <div class="text-xs mt-0.5" style="color:rgba(120,120,120,.45)">Cabang Kemang · Real-time</div></div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="c p-4 cursor-pointer" onclick="go('stock')">
        <div class="text-[10px] font-bold uppercase" style="color:rgba(120,120,120,.4)">Stok Kritis</div>
        <div class="text-2xl font-black mt-1" style="color:${COL.red.t}">${kritis}</div>
        <div class="text-[10px] mt-2" style="color:rgba(120,120,120,.4)">${rendah} item rendah</div>
      </div>
      <div class="c p-4 cursor-pointer" onclick="go('variance')">
        <div class="text-[10px] font-bold uppercase" style="color:rgba(120,120,120,.4)">Anomali Variance</div>
        <div class="text-2xl font-black mt-1" style="color:${COL.red.t}">${anomali}</div>
        <div class="text-[10px] mt-2" style="color:${COL.red.t}">Loss: ${rp(totalLoss)}</div>
      </div>
      <div class="c p-4 cursor-pointer" onclick="go('po')">
        <div class="text-[10px] font-bold uppercase" style="color:rgba(120,120,120,.4)">PO Pending</div>
        <div class="text-2xl font-black mt-1" style="color:${COL.amber.t}">${pendingPO}</div>
        <div class="text-[10px] mt-2" style="color:rgba(120,120,120,.4)">Auto-generated by AI</div>
      </div>
      <div class="c p-4 cursor-pointer" onclick="go('opname')">
        <div class="text-[10px] font-bold uppercase" style="color:rgba(120,120,120,.4)">Opname Hari Ini</div>
        <div class="text-2xl font-black mt-1">${OPNAME_TODAY.filter(o=>o.done).length}/${OPNAME_TODAY.length}</div>
        <div class="text-[10px] mt-2" style="color:rgba(120,120,120,.4)">Cycle count harian</div>
      </div>
    </div>

    <div class="c p-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-bold text-base">⚠️ Perlu Perhatian</h2>
        <span class="btn btn-o btn-s" onclick="go('variance')">Detail →</span>
      </div>
      ${VARIANCE.filter(v=>v.vstatus!=='normal').map(v=>`
        <div class="flex items-center gap-3 py-3" style="border-top:1px solid ${COL.gray.bd}">
          <div class="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style="background:${v.vstatus==='anomali'?COL.red.bg:COL.amber.bg}">${v.vstatus==='anomali'?'🚨':'⚠️'}</div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm">${v.name}</div>
            <div class="text-xs" style="color:rgba(120,120,120,.5)">Variance ${v.pct}% · Theo: ${v.qty_theo}${v.unit} → Actual: ${v.qty_sys}${v.unit}</div>
          </div>
          <div class="text-right shrink-0">
            <div class="font-bold text-sm" style="color:${COL.red.t}">${rp(v.loss)}</div>
            <div class="pill" style="background:${v.vstatus==='anomali'?COL.red.bg:COL.amber.bg};color:${v.vstatus==='anomali'?COL.red.t:COL.amber.t}">${v.vstatus==='anomali'?'Anomali':'Watch'}</div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="c p-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="font-bold text-base">📋 Ledger Terbaru</h2>
        <span class="btn btn-o btn-s" onclick="go('ledger')">Semua →</span>
      </div>
      ${LEDGER.slice(0,5).map(l=>{
        const tc={SALE:COL.blue,WASTE:COL.red,OPNAME:COL.amber,RECEIVE:COL.green};
        const c=tc[l.type]||COL.gray;
        return `<div class="flex items-center gap-3 py-2.5" style="border-top:1px solid ${COL.gray.bd}">
          <div class="pill" style="background:${c.bg};color:${c.t}">${l.type}</div>
          <div class="flex-1 min-w-0"><div class="text-xs font-medium truncate">${l.ing} <span style="color:rgba(120,120,120,.4)">${l.qty>0?'+':''}${l.qty} ${l.ref}</span></div></div>
          <div class="text-[10px] shrink-0" style="color:rgba(120,120,120,.35)">${l.ts} · ${l.actor}</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function vStock(){
  return `<div class="fi space-y-5">
    <h1 class="text-xl font-black">Stock Levels</h1>
    <div class="c overflow-hidden"><div class="tw">
      <table class="tbl">
        <thead style="background:${COL.gray.bg}"><tr><th>Bahan</th><th>Stok</th><th>Min</th><th>Level</th><th>Status</th><th>Kategori</th><th>Supplier</th></tr></thead>
        <tbody>${ING.map(i=>{
          const s=ingStatus(i);
          const pct=Math.min(Math.round(i.qty_sys/(i.min*1.5)*100),100);
          return `<tr>
            <td class="font-bold">${i.name}</td>
            <td class="font-mono font-bold">${i.qty_sys} ${i.unit}</td>
            <td class="font-mono" style="color:rgba(120,120,120,.4)">${i.min} ${i.unit}</td>
            <td><div class="w-20 bar-t"><div class="bar-f" style="width:${pct}%;background:${s.c.t}"></div></div></td>
            <td><span class="pill" style="background:${s.c.bg};color:${s.c.t}">${s.k}</span></td>
            <td><span class="pill" style="background:${COL.gray.bg};color:${COL.gray.t}">${i.abc}</span></td>
            <td style="color:rgba(120,120,120,.4)">${i.supplier}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div></div>
  </div>`;
}

function vRecipe(){
  return `<div class="fi space-y-5">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-black">Recipes (BOM)</h1>
      <div class="text-xs" style="color:rgba(120,120,120,.4)">Bill of Materials per menu item</div>
    </div>
    <div class="grid sm:grid-cols-2 gap-3">
      ${RECIPES.map(r=>{
        const hpp=r.items.reduce((a,it)=>{const ig=ING.find(x=>x.id===it.ing);return a+(ig?ig.cost*it.qty:0)},0);
        return `<div class="c p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="font-bold">${r.product}</div>
            <div class="pill" style="background:${COL.green.bg};color:${COL.green.t}">HPP ${rp(hpp)}</div>
          </div>
          <div class="space-y-1.5">
            ${r.items.map(it=>{
              const ig=ING.find(x=>x.id===it.ing);
              return `<div class="flex items-center justify-between text-xs py-1" style="border-top:1px solid ${COL.gray.bd}">
                <span>${ig?ig.name:'?'}</span>
                <span class="font-mono font-bold">${it.qty} ${it.unit}</span>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

/* Opname with numpad modal */
let opnameInput='';
function startOpname(idx){
  const item=OPNAME_TODAY[idx];
  if(item.done)return;
  opnameInput='';
  modal(`
    <div class="p-5">
      <h2 class="font-bold text-lg mb-1">Stock Opname</h2>
      <div class="text-xs mb-4" style="color:rgba(120,120,120,.5)">${item.ing.name} · ${item.ing.storage}</div>
      <div class="c p-4 mb-4 text-center" style="background:${COL.blue.bg};border-color:${COL.blue.bd}">
        <div class="text-xs font-bold" style="color:${COL.blue.t}">Sistem menunjukkan</div>
        <div class="text-2xl font-black mt-1">${item.ing.qty_theo} ${item.ing.unit}</div>
      </div>
      <div class="text-xs font-bold mb-2" style="color:rgba(120,120,120,.5)">Berapa stok fisik sekarang?</div>
      <div id="opn-display" class="text-center text-3xl font-black py-4 mb-3 rounded-xl" style="background:${COL.gray.bg}">0</div>
      <div class="grid grid-cols-3 gap-2 mb-4">
        ${[1,2,3,4,5,6,7,8,9,'.',0,'⌫'].map(k=>`<div class="numpad-btn" onclick="opnTap('${k}',${idx})">${k}</div>`).join('')}
      </div>
      <button class="btn btn-p w-full py-3" onclick="submitOpname(${idx})">✅ Konfirmasi</button>
    </div>
  `);
}
function opnTap(k,idx){
  if(k==='⌫')opnameInput=opnameInput.slice(0,-1);
  else if(k==='.'&&opnameInput.includes('.'))return;
  else opnameInput+=k;
  document.getElementById('opn-display').textContent=opnameInput||'0';
}
function submitOpname(idx){
  const val=parseFloat(opnameInput);
  if(isNaN(val)){toast('Masukkan angka yang valid',false);return}
  OPNAME_TODAY[idx].done=true;
  OPNAME_TODAY[idx].fisik=val;
  const diff=val-OPNAME_TODAY[idx].ing.qty_theo;
  closeModal();
  if(Math.abs(diff/OPNAME_TODAY[idx].ing.qty_theo)>0.05){
    toast(`⚠️ Selisih ${diff.toFixed(2)} ${OPNAME_TODAY[idx].ing.unit} terdeteksi!`,false);
  }else{
    toast(`✅ ${OPNAME_TODAY[idx].ing.name} OK — selisih kecil`);
  }
  render();
}

function vOpname(){
  return `<div class="fi space-y-5">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-black">Stock Opname</h1>
      <div class="text-xs mt-0.5" style="color:rgba(120,120,120,.4)">Cycle Count · Hari ini: ${OPNAME_TODAY.filter(o=>o.done).length}/${OPNAME_TODAY.length} selesai</div></div>
      <div class="pill" style="background:${COL.amber.bg};color:${COL.amber.t}">Metode: Toyota Cycle Count</div>
    </div>
    <div class="space-y-3">
      ${OPNAME_TODAY.map((o,idx)=>{
        const diff=o.done?(o.fisik-o.ing.qty_theo):null;
        const pctDiff=o.done&&o.ing.qty_theo?Math.abs(diff/o.ing.qty_theo*100):0;
        const isAnomaly=pctDiff>5;
        return `<div class="c p-4 cursor-pointer ${o.done?'':'hover:shadow-md transition-shadow'}" onclick="${o.done?'':`startOpname(${idx})`}" style="${o.done?'opacity:.8':''}">
          <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style="background:${o.done?(isAnomaly?COL.red.bg:COL.green.bg):COL.blue.bg}">${o.done?(isAnomaly?'⚠️':'✅'):'📋'}</div>
            <div class="flex-1 min-w-0">
              <div class="font-bold">${o.ing.name}</div>
              <div class="text-xs" style="color:rgba(120,120,120,.4)">${o.ing.storage} · ABC: ${o.ing.abc} · Sistem: ${o.ing.qty_theo} ${o.ing.unit}</div>
            </div>
            <div class="text-right shrink-0">
              ${o.done?`
                <div class="font-bold text-sm">Fisik: ${o.fisik} ${o.ing.unit}</div>
                <div class="text-xs font-bold" style="color:${isAnomaly?COL.red.t:COL.green.t}">Δ ${diff>0?'+':''}${diff.toFixed(2)} (${pctDiff.toFixed(1)}%)</div>
              `:`<span class="btn btn-p btn-s">Hitung →</span>`}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function vPO(){
  return `<div class="fi space-y-5">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-black">Purchase Orders</h1>
      <span class="btn btn-p btn-s" onclick="toast('Buat PO baru...')">+ Buat PO</span>
    </div>
    <div class="space-y-3">
      ${POS_LIST.map(po=>{
        const sc={draft:COL.amber,sent:COL.blue,received:COL.green};
        const c=sc[po.status]||COL.gray;
        return `<div class="c p-4">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="font-bold font-mono">${po.id}</span>
              <span class="pill" style="background:${c.bg};color:${c.t}">${po.status.toUpperCase()}</span>
              ${po.auto?`<span class="pill" style="background:${COL.green.bg};color:${COL.green.t}">🤖 Auto</span>`:''}
            </div>
            <div class="font-bold" style="color:${COL.green.t}">${rp(po.total)}</div>
          </div>
          <div class="text-xs" style="color:rgba(120,120,120,.5)">Supplier: ${po.supplier} · ETA: ${po.eta}</div>
          <div class="text-xs mt-1" style="color:rgba(120,120,120,.4)">${po.items.map(it=>`${it.name} (${it.qty} ${it.unit})`).join(', ')}</div>
          ${po.status==='draft'?`<div class="flex gap-2 mt-3"><button class="btn btn-p btn-s flex-1" onclick="toast('PO approved & sent to supplier!')">✅ Approve</button><button class="btn btn-o btn-s" onclick="toast('Editing PO...')">Edit</button></div>`:''}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function vVariance(){
  const sorted=[...VARIANCE].sort((a,b)=>b.loss-a.loss);
  const totalLoss=sorted.filter(v=>v.vstatus!=='normal').reduce((a,v)=>a+v.loss,0);
  return `<div class="fi space-y-5">
    <div class="flex items-center justify-between">
      <div><h1 class="text-xl font-black">Variance Analysis</h1>
      <div class="text-xs mt-0.5" style="color:rgba(120,120,120,.4)">Theoretical vs Actual · Anti-fraud engine</div></div>
      <div class="text-right">
        <div class="text-[10px] font-bold uppercase" style="color:rgba(120,120,120,.4)">Total Loss</div>
        <div class="font-black text-lg" style="color:${COL.red.t}">${rp(totalLoss)}</div>
      </div>
    </div>
    <div class="c overflow-hidden"><div class="tw">
      <table class="tbl">
        <thead style="background:${COL.gray.bg}"><tr><th>Bahan</th><th>Theoretical</th><th>Actual</th><th>Variance</th><th>Est. Loss</th><th>Status</th></tr></thead>
        <tbody>${sorted.map(v=>{
          const sc={anomali:COL.red,watch:COL.amber,normal:COL.green};
          const c=sc[v.vstatus];
          return `<tr>
            <td class="font-bold">${v.name}</td>
            <td class="font-mono">${v.qty_theo} ${v.unit}</td>
            <td class="font-mono font-bold">${v.qty_sys} ${v.unit}</td>
            <td class="font-mono font-bold" style="color:${v.pct>5?COL.red.t:COL.green.t}">${v.diff>0?'+':''}${v.diff.toFixed(2)} (${v.pct}%)</td>
            <td class="font-mono font-bold" style="color:${v.loss>0?COL.red.t:'inherit'}">${v.loss>0?rp(v.loss):'-'}</td>
            <td><span class="pill" style="background:${c.bg};color:${c.t}">${v.vstatus==='anomali'?'🚨 Anomali':v.vstatus==='watch'?'⚠️ Watch':'✅ Normal'}</span></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div></div>
  </div>`;
}

function vLedger(){
  return `<div class="fi space-y-5">
    <h1 class="text-xl font-black">Audit Ledger</h1>
    <div class="text-xs" style="color:rgba(120,120,120,.4)">Immutable log — setiap pergerakan bahan tercatat permanen</div>
    <div class="c overflow-hidden"><div class="tw">
      <table class="tbl">
        <thead style="background:${COL.gray.bg}"><tr><th>Waktu</th><th>Type</th><th>Bahan</th><th>Qty</th><th>Referensi</th><th>Actor</th></tr></thead>
        <tbody>${LEDGER.map(l=>{
          const tc={SALE:COL.blue,WASTE:COL.red,OPNAME:COL.amber,RECEIVE:COL.green};
          const c=tc[l.type]||COL.gray;
          return `<tr>
            <td class="font-mono" style="color:rgba(120,120,120,.4)">${l.ts}</td>
            <td><span class="pill" style="background:${c.bg};color:${c.t}">${l.type}</span></td>
            <td class="font-bold">${l.ing}</td>
            <td class="font-mono font-bold" style="color:${l.qty>0?COL.green.t:COL.red.t}">${l.qty>0?'+':''}${l.qty}</td>
            <td class="text-xs" style="color:rgba(120,120,120,.5)">${l.ref}</td>
            <td style="color:rgba(120,120,120,.4)">${l.actor}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div></div>
  </div>`;
}

/* ═══ RENDER ═══ */
function render(){
  const views={overview:vOverview,stock:vStock,recipe:vRecipe,opname:vOpname,po:vPO,variance:vVariance,ledger:vLedger};
  const content=(views[view]||vOverview)();
  const badge=ING.filter(i=>i.qty_sys<=i.min*0.4).length+VARIANCE.filter(v=>v.vstatus==='anomali').length;

  document.getElementById('app').innerHTML=`
  <div class="shell">
    <div id="sbd" class="side-bd ${sideOpen?'show':''}" onclick="toggleSide(false)"></div>
    <aside id="sb" class="side bg-white dark:bg-[#0f1117] border-r flex flex-col h-[100dvh] ${sideOpen?'open':''}" style="border-color:${COL.gray.bd}">
      <div class="h-14 flex items-center px-4 shrink-0" style="border-bottom:1px solid ${COL.gray.bd}">
        <div class="w-7 h-7 rounded-lg flex items-center justify-center font-black text-[10px] text-white mr-2.5" style="background:#059669">OS</div>
        <div><div class="font-bold text-sm leading-none">Inventory</div><div class="text-[9px]" style="color:rgba(120,120,120,.4)">Kopi Nusantara · Kemang</div></div>
        <button class="md:hidden ml-auto" style="color:rgba(120,120,120,.4)" onclick="toggleSide(false)">✕</button>
      </div>
      <nav class="flex-1 overflow-y-auto p-2 space-y-0.5">
        ${NAVS.map(n=>`<a class="nl ${view===n.id?'act':''}" onclick="go('${n.id}')">${n.i}<span class="flex-1">${n.l}</span>${n.id==='variance'&&badge?`<span class="pill" style="background:${COL.red.bg};color:${COL.red.t}">${badge}</span>`:''}</a>`).join('')}
      </nav>
    </aside>
    <main class="main">
      <header class="md:hidden h-12 bg-white dark:bg-[#0f1117] flex items-center px-4 sticky top-0 z-50" style="border-bottom:1px solid ${COL.gray.bd}">
        <button class="mr-3" style="color:rgba(120,120,120,.5)" onclick="toggleSide(true)">${IC.menu}</button>
        <span class="font-bold text-sm">Inventory Engine</span>
      </header>
      <div class="p-4 md:p-7 max-w-[1200px] mx-auto pb-20">${content}</div>
    </main>
  </div>`;
}

render();

/* ============================================================
   StoreOS AI — SaaS Application Logic
   ============================================================ */

const ICONS = {
  home: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10M9 21h6"/></svg>',
  pos: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>',
  branch: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>',
  alert: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>',
  stock: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>',
  staff: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>',
  report: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>',
  ai: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>',
  menu: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>',
  close: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>',
};

let currentView = 'dashboard';
let role = 'owner'; // owner | kasir | keeper
let showSidebar = false;

// Helpers
const showToast = (msg, type='ok') => {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = msg;
  container.appendChild(t);
  setTimeout(() => { t.style.opacity=0; setTimeout(()=>t.remove(),300); }, 3000);
};

const showModal = (html) => {
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `<div class="modal-bg absolute inset-0 cursor-pointer" onclick="closeModal()"></div>
                       <div class="modal-card relative z-10 m-auto mt-20 mb-20 fade-in">${html}</div>`;
  overlay.classList.replace('hidden', 'flex');
  document.body.style.overflow = 'hidden';
};

const closeModal = () => {
  document.getElementById('modal-overlay').classList.replace('flex', 'hidden');
  document.body.style.overflow = '';
};

const go = (view) => {
  currentView = view;
  if(window.innerWidth < 768) toggleSidebar(false);
  render();
  document.querySelector('.main-content').scrollTop = 0;
};

const setRole = (r) => {
  role = r;
  currentView = r==='owner' ? 'dashboard' : r==='kasir' ? 'pos' : 'stock';
  go(currentView);
};

const toggleSidebar = (force) => {
  showSidebar = force !== undefined ? force : !showSidebar;
  const sb = document.getElementById('sidebar');
  const bd = document.getElementById('sidebar-backdrop');
  if(sb) {
    if(showSidebar) { sb.classList.add('open'); bd.classList.add('show'); }
    else { sb.classList.remove('open'); bd.classList.remove('show'); }
  }
};

// Components
const card = (inner, cls='') => `<div class="card p-4 md:p-5 ${cls}">${inner}</div>`;

const miniChart = (data, w=100, h=40, color='#059669', stroke=2) => {
  const max = Math.max(...data)*1.2, min = 0;
  const pts = data.map((v,i) => `${(i/(data.length-1))*w},${h - ((v-min)/(max-min))*h}`).join(' L ');
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="overflow-visible">
            <path d="M ${pts}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>`;
};

// SVG SVG SVG Chart 8 Months
function renderMonthlyChart(){
  const W=1000, H=280, padL=30, padR=20, padT=20, padB=30;
  const cw = (W-padL-padR)/trendMonths.length;
  const maxBar = Math.max(...trendData.PIK, ...trendData.Kemang, ...trendData.BSD);
  const plotH = H-padT-padB;
  const bw = cw*0.22;
  const y = (v)=> padT + plotH - (v/maxBar)*plotH;

  let bars='', labels='', grid='';
  // grid Y
  for(let i=0; i<=4; i++){
    const gy = padT + (plotH/4)*i;
    const val = Math.round(maxBar - (maxBar/4)*i);
    grid += `<line x1="${padL}" y1="${gy}" x2="${W-padR}" y2="${gy}" stroke="currentColor" class="text-gray-200 dark:text-gray-800" stroke-width="1" stroke-dasharray="4 4"/>`;
    grid += `<text x="${padL-6}" y="${gy+3}" text-anchor="end" font-size="10" fill="currentColor" class="text-gray-400">${val}</text>`;
  }

  trendMonths.forEach((m,i)=>{
    const cx = padL + i*cw + cw*0.5;
    const p = trendData.PIK[i], k = trendData.Kemang[i], b = trendData.BSD[i];
    
    // Stack bars (simple visual offset)
    const px = cx - bw*1.1, kx = cx, bx = cx + bw*1.1;
    
    if(p>0) bars += `<rect x="${px-bw/2}" y="${y(p)}" width="${bw}" height="${padT+plotH-y(p)}" rx="2" fill="#0ea5e9"/>`;
    if(k>0) bars += `<rect x="${kx-bw/2}" y="${y(k)}" width="${bw}" height="${padT+plotH-y(k)}" rx="2" fill="#059669"/>`;
    if(b>0) bars += `<rect x="${bx-bw/2}" y="${y(b)}" width="${bw}" height="${padT+plotH-y(b)}" rx="2" fill="#f59e0b"/>`;
    
    labels += `<text x="${cx}" y="${H-8}" text-anchor="middle" font-size="12" font-weight="500" fill="currentColor" class="text-gray-500">${m}</text>`;
  });

  return `
    <div class="relative w-full overflow-x-auto hide-scrollbar">
      <svg viewBox="0 0 ${W} ${H}" class="w-full min-w-[600px] h-auto">
        ${grid}
        ${bars}
        ${labels}
      </svg>
    </div>
  `;
}

// ---------------- VIEWS: OWNER ----------------

function viewDashboard() {
  const kpis = [
    {label:'Gross Revenue', val:rpK(totalOmzet), sub:'Target '+rpK(totalTarget), chart:miniChart(trendData.Kemang,60,24), color:'#059669'},
    {label:'Transactions', val:totalTrx.toLocaleString(), sub:rpK(totalOmzet/totalTrx)+' avg', chart:miniChart(trendData.BSD,60,24), color:'#0ea5e9'},
    {label:'Saved by AI', val:rpK(savedMonth), sub:'Bulan ini', icon:'⭐', color:'#f59e0b'},
    {label:'Active Alerts', val:alerts.filter(a=>a.status==='open').length, sub:alerts.filter(a=>a.sev>=8).length+' critical', icon:'🚨', color:'#ef4444'}
  ];

  const topAlerts = alerts.filter(a=>a.sev>=7).slice(0,2).map(a=>`
    <div class="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 cursor-pointer hover:border-red-300 transition" onclick="go('alert')">
      <div class="mt-1 w-2 h-2 rounded-full ${sevColor(a.sev)} flex-shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]"></div>
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="badge ${sevBadge(a.sev)} text-[9px]">${a.type}</span>
          <span class="text-[10px] text-gray-500 font-medium">${a.branch} • ${a.time}</span>
        </div>
        <div class="font-bold text-sm leading-snug">${a.title}</div>
        <div class="text-xs text-red-600 dark:text-red-400 mt-1 font-semibold">Potensi Loss: ${rp(a.impact)}</div>
      </div>
    </div>
  `).join('');

  return `
  <div class="fade-in space-y-5">
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-bold tracking-tight">${GREETING}, Owner</h1>
        <p class="text-gray-500 mt-1">Sistem mendeteksi <b class="text-red-500">${alerts.filter(a=>a.sev>=8).length} anomali kritis</b> hari ini. Semua cabang online.</p>
      </div>
      <div class="flex items-center gap-3">
        <button class="btn btn-outline btn-sm" onclick="showToast('Exporting PDF report...')">Export PDF</button>
        <button class="btn btn-primary btn-sm" onclick="go('ai')">${ICONS.ai} AI Insights</button>
      </div>
    </div>

    <!-- KPI Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
      ${kpis.map(k=>`
        ${card(`
          <div class="flex items-start justify-between mb-2">
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider">${k.label}</div>
            ${k.icon ? `<div class="text-lg">${k.icon}</div>` : k.chart}
          </div>
          <div class="text-2xl md:text-3xl font-black mt-1" style="color:${k.color}">${k.val}</div>
          <div class="text-xs font-medium text-gray-400 mt-1.5">${k.sub}</div>
        `,'p-4')}
      `).join('')}
    </div>

    <div class="grid lg:grid-cols-3 gap-5">
      
      <!-- Chart -->
      <div class="lg:col-span-2 space-y-5">
        ${card(`
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-bold text-lg">Revenue Trend (8 Months)</h2>
            <div class="flex items-center gap-3 text-xs font-medium">
              <span class="flex items-center gap-1"><div class="w-3 h-3 rounded bg-[#0ea5e9]"></div> PIK</span>
              <span class="flex items-center gap-1"><div class="w-3 h-3 rounded bg-[#059669]"></div> Kemang</span>
              <span class="flex items-center gap-1"><div class="w-3 h-3 rounded bg-[#f59e0b]"></div> BSD</span>
            </div>
          </div>
          ${renderMonthlyChart()}
        `)}

        ${card(`
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-bold text-lg">Live Operations</h2>
            <button class="text-xs font-bold text-emerald-600 hover:underline" onclick="go('branch')">View All &rarr;</button>
          </div>
          <div class="table-wrapper">
            <table class="tbl">
              <thead><tr><th>Branch</th><th>Status</th><th>Revenue</th><th>Target</th><th>Margin</th></tr></thead>
              <tbody>
                ${branches.map(b=>{
                  const p = pct(b.omzet,b.target);
                  return `<tr>
                    <td class="font-bold">${b.name}</td>
                    <td><span class="badge ${healthBadge(b.health)}"><span class="w-1.5 h-1.5 rounded-full mr-1.5 ${healthBadge(b.health)==='badge-ok'?'bg-emerald-500 live-dot':healthBadge(b.health)==='badge-warn'?'bg-amber-500':'bg-red-500'}"></span>${healthLabel(b.health)}</span></td>
                    <td class="font-mono font-medium">${rpK(b.omzet)}</td>
                    <td>
                      <div class="flex items-center gap-2 text-xs font-medium">
                        <div class="w-16 prog-track"><div class="prog-fill ${p>=100?'bg-emerald-500':'bg-amber-500'}" style="width:${Math.min(p,100)}%"></div></div>
                        <span class="${p>=100?'text-emerald-600':'text-amber-600'}">${p}%</span>
                      </div>
                    </td>
                    <td class="font-mono font-medium">${b.margin}%</td>
                  </tr>`
                }).join('')}
              </tbody>
            </table>
          </div>
        `,'!p-0 overflow-hidden')}
      </div>

      <!-- Right Col -->
      <div class="space-y-5">
        
        ${card(`
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-bold text-lg flex items-center gap-2"><span class="text-red-500 pulse-dot">●</span> Action Required</h2>
            <span class="badge badge-danger">${alerts.length}</span>
          </div>
          <div class="space-y-3 mb-4">${topAlerts}</div>
          <button class="btn btn-outline w-full text-xs" onclick="go('alert')">View All Alerts</button>
        `)}

        ${card(`
          <div class="flex items-center gap-2 mb-4">
            <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 flex items-center justify-center font-bold">AI</div>
            <div>
              <h2 class="font-bold text-sm">StoreOS Intelligence</h2>
              <div class="text-[10px] text-gray-500">Auto-generated insight</div>
            </div>
          </div>
          <div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30">
            <div class="font-bold text-emerald-900 dark:text-emerald-100 text-sm mb-1">${insights[0].title}</div>
            <p class="text-xs text-emerald-800/80 dark:text-emerald-200/80 leading-relaxed">${insights[0].detail}</p>
            <div class="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 text-xs font-bold shadow-sm">
              Impact: ${insights[0].value}
            </div>
          </div>
        `)}
        
      </div>
    </div>
  </div>
  `;
}

function viewAlert() {
  return `
  <div class="fade-in space-y-5 max-w-4xl mx-auto">
    <div class="flex items-end justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Alert Center</h1>
        <p class="text-gray-500 mt-1">Mendeteksi anomali fraud, waste, dan stok secara real-time.</p>
      </div>
      <div class="badge badge-danger text-sm px-3 py-1">${alerts.filter(a=>a.status==='open').length} Open Alerts</div>
    </div>

    <div class="space-y-3">
      ${alerts.map(a=>`
        ${card(`
          <div class="flex flex-col md:flex-row gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-2">
                <span class="badge ${sevBadge(a.sev)} text-[10px]">${a.type} • Lvl ${a.sev}</span>
                <span class="text-[11px] text-gray-500 font-medium">${a.branch} • ${a.time}</span>
              </div>
              <h3 class="font-bold text-base leading-snug mb-1.5">${a.title}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">${a.detail}</p>
              
              <div class="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 flex items-start gap-3">
                <div class="mt-0.5">${ICONS.ai}</div>
                <div>
                  <div class="text-xs font-bold text-emerald-700 dark:text-emerald-400 mb-0.5">Recommended Action</div>
                  <div class="text-sm font-medium text-gray-800 dark:text-gray-200">${a.action}</div>
                </div>
              </div>
            </div>
            <div class="md:w-48 flex flex-col justify-between shrink-0 border-t md:border-t-0 md:border-l border-gray-100 dark:border-gray-800 pt-3 md:pt-0 md:pl-4">
              <div>
                <div class="text-[10px] font-bold text-gray-400 uppercase">Potensi Loss</div>
                <div class="text-lg font-black text-red-600 dark:text-red-400">${rp(a.impact)}</div>
              </div>
              <div class="flex flex-col gap-2 mt-4">
                <button class="btn btn-primary w-full text-xs py-2" onclick="showToast('Alert resolved.')">Resolve</button>
                <button class="btn btn-outline w-full text-xs py-2" onclick="showToast('Forwarded to WhatsApp.')">Forward to Manager</button>
              </div>
            </div>
          </div>
        `)}
      `).join('')}
    </div>
  </div>
  `;
}

function viewInsights() {
  return `
  <div class="fade-in space-y-5 max-w-4xl mx-auto">
    <div>
      <h1 class="text-2xl font-bold tracking-tight">AI Insights</h1>
      <p class="text-gray-500 mt-1">StoreOS menganalisis jutaan titik data harian untuk menemukan celah profit.</p>
    </div>

    <div class="p-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg shadow-emerald-900/20">
      <div>
        <div class="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Total Potensi Nilai AI</div>
        <div class="text-3xl font-black">Rp 11.000.000 <span class="text-lg font-medium text-emerald-200">/ bulan</span></div>
      </div>
      <button class="btn bg-white text-emerald-700 hover:bg-gray-50 border-none px-6 shadow-sm">Implement All</button>
    </div>

    <div class="grid md:grid-cols-2 gap-4">
      ${insights.map(i=>`
        ${card(`
          <div class="flex items-start gap-3 h-full flex-col">
            <div class="flex items-center justify-between w-full">
              <div class="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl">${i.icon}</div>
              <div class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md">${i.confidence}% Confidence</div>
            </div>
            <div class="mt-2 flex-1">
              <h3 class="font-bold text-base leading-snug mb-1.5">${i.title}</h3>
              <p class="text-sm text-gray-500 leading-relaxed">${i.detail}</p>
            </div>
            <div class="mt-4 w-full pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div class="font-bold ${i.tone==='up'?'text-emerald-600':'text-amber-500'}">Impact: ${i.value}</div>
              <button class="btn btn-outline btn-sm">Take Action</button>
            </div>
          </div>
        `)}
      `).join('')}
    </div>
  </div>
  `;
}

// ---------------- VIEWS: KASIR (POS) ----------------

let cart = {};
let payMethod = 'QRIS';

function viewPOS() {
  const catBtns = ['Kopi','Non-Kopi','Makanan'].map(c=>`
    <button class="px-4 py-2 rounded-xl text-sm font-bold transition ${posCat===c?'bg-emerald-600 text-white shadow-md shadow-emerald-900/20':'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}" onclick="posCat='${c}';go('pos')">${c}</button>
  `).join('');

  const items = menuItems.filter(m=>m.cat===posCat).map(m=>`
    <div class="card p-3 cursor-pointer hover:border-emerald-500 transition relative overflow-hidden group select-none" onclick="addToCart('${m.id}')">
      ${cart[m.id]?`<div class="absolute top-2 right-2 w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-md scale-in z-10">${cart[m.id]}</div>`:''}
      <div class="text-4xl text-center mb-2 mt-2 group-hover:scale-110 transition-transform">${m.emo}</div>
      <div class="font-bold text-sm leading-tight text-center mt-3">${m.name}</div>
      <div class="text-emerald-600 dark:text-emerald-400 font-bold text-sm text-center mt-1">${rp(m.price)}</div>
    </div>
  `).join('');

  const cartTotal = Object.entries(cart).reduce((sum,[id,q])=>sum+(menuItems.find(x=>x.id===id).price*q),0);
  const cartRows = Object.entries(cart).map(([id,q])=>{
    const m = menuItems.find(x=>x.id===id);
    return `
    <div class="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800/50 last:border-0">
      <div class="flex-1 min-w-0 pr-2">
        <div class="font-bold text-sm truncate">${m.name}</div>
        <div class="text-xs text-gray-400 font-mono">${rp(m.price)} &times; ${q}</div>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <button class="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center font-bold" onclick="updateCart('${id}',-1)">-</button>
        <div class="w-4 text-center font-bold">${q}</div>
        <button class="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold" onclick="updateCart('${id}',1)">+</button>
      </div>
    </div>`;
  }).join('') || '<div class="text-center text-gray-400 py-10 text-sm">Keranjang Kosong<br>Pilih menu di samping</div>';

  return `
  <div class="fade-in h-[calc(100dvh-40px)] flex flex-col md:flex-row gap-4 max-w-7xl mx-auto -m-4 md:-m-0 md:p-0 p-4">
    
    <!-- Menu Side -->
    <div class="flex-1 flex flex-col min-h-0">
      <div class="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h1 class="text-xl font-bold">Point of Sale</h1>
          <div class="text-xs text-gray-500 font-medium">Cabang Kemang • Shift Pagi • Rina Sari</div>
        </div>
        <div class="text-right">
          <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Status</div>
          <div class="text-xs font-bold text-emerald-600 flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500 live-dot"></span> Online</div>
        </div>
      </div>
      
      <div class="flex gap-2 mb-4 shrink-0 overflow-x-auto hide-scrollbar pb-1">${catBtns}</div>
      
      <div class="flex-1 overflow-y-auto hide-scrollbar pb-4 pr-1">
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          ${items}
        </div>
      </div>
    </div>

    <!-- Cart Side -->
    <div class="w-full md:w-80 lg:w-96 shrink-0 flex flex-col bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm md:h-full">
      <div class="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between shrink-0">
        <h2 class="font-bold text-lg">Order Detail</h2>
        ${cartTotal>0 ? `<button class="text-xs font-bold text-red-500 hover:underline" onclick="cart={};go('pos')">Clear</button>` : ''}
      </div>
      
      <div class="flex-1 overflow-y-auto p-4 hide-scrollbar">
        ${cartRows}
      </div>

      <div class="p-4 bg-gray-50 dark:bg-gray-800/30 border-t border-gray-100 dark:border-gray-800 shrink-0 rounded-b-2xl">
        <div class="flex justify-between items-center mb-3 text-sm">
          <span class="text-gray-500 font-medium">Subtotal</span>
          <span class="font-mono font-bold">${rp(cartTotal)}</span>
        </div>
        <div class="flex justify-between items-center mb-4 text-sm">
          <span class="text-gray-500 font-medium">Tax (11%)</span>
          <span class="font-mono font-bold">${rp(cartTotal*0.11)}</span>
        </div>
        <div class="flex justify-between items-center mb-5 pb-4 border-b border-gray-200 dark:border-gray-700">
          <span class="text-lg font-bold">Total</span>
          <span class="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">${rp(cartTotal*1.11)}</span>
        </div>

        <div class="grid grid-cols-3 gap-2 mb-4">
          ${['QRIS','Tunai','Card'].map(p=>`
            <button class="py-2.5 rounded-xl text-xs font-bold transition ${payMethod===p?'bg-emerald-600 text-white':'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}" onclick="payMethod='${p}';go('pos')">${p}</button>
          `).join('')}
        </div>

        <button class="btn btn-primary w-full py-4 text-base shadow-lg shadow-emerald-900/20" onclick="processCheckout()" ${cartTotal===0?'disabled style="opacity:0.5"':''}>
          Charge ${rp(cartTotal*1.11)}
        </button>
      </div>
    </div>

  </div>
  `;
}

let posCat = 'Kopi';
function addToCart(id) { cart[id]=(cart[id]||0)+1; go('pos'); }
function updateCart(id, d) { 
  if(!cart[id]) return;
  cart[id]+=d; 
  if(cart[id]<=0) delete cart[id];
  go('pos');
}
function processCheckout() {
  if(Object.keys(cart).length===0) return;
  showModal(`
    <div class="p-6 text-center">
      <div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mx-auto mb-4 scale-in">✓</div>
      <h2 class="text-xl font-bold mb-2">Payment Successful</h2>
      <p class="text-gray-500 mb-6">StoreOS mencatat penjualan, memotong stok resep, dan mengupdate laporan Owner secara real-time.</p>
      <button class="btn btn-primary w-full py-3" onclick="cart={};closeModal();go('pos')">New Order</button>
    </div>
  `);
}

// ---------------- MAIN RENDER & ROUTING ----------------

function render() {
  let content = '';
  if(currentView==='dashboard') content = viewDashboard();
  else if(currentView==='alert') content = viewAlert();
  else if(currentView==='ai') content = viewInsights();
  else if(currentView==='pos') content = viewPOS();
  else content = `<div class="p-10 text-center text-gray-500">View under construction for prototype.</div>`;

  const navs = role==='owner' 
    ? [{id:'dashboard',l:'Dashboard',i:ICONS.home},{id:'branch',l:'Branches',i:ICONS.branch},{id:'alert',l:`Alerts <span class="ml-auto badge badge-danger text-[10px] px-1.5">${alerts.length}</span>`,i:ICONS.alert},{id:'ai',l:'AI Insights',i:ICONS.ai},{id:'stock',l:'Inventory',i:ICONS.stock},{id:'staff',l:'Staff',i:ICONS.staff},{id:'report',l:'Reports',i:ICONS.report}]
    : role==='kasir'
    ? [{id:'pos',l:'Point of Sale',i:ICONS.pos},{id:'shift',l:'Shift Close',i:ICONS.report}]
    : [{id:'stock',l:'Inventory',i:ICONS.stock},{id:'po',l:'Purchase Orders',i:ICONS.report}];

  document.getElementById('app').innerHTML = `
    <div class="shell">
      <div id="sidebar-backdrop" class="sidebar-backdrop ${showSidebar?'show':''}" onclick="toggleSidebar(false)"></div>
      
      <aside id="sidebar" class="sidebar bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-[100dvh] ${showSidebar?'open':''}">
        <div class="h-16 flex items-center px-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div class="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs mr-3">OS</div>
          <div>
            <div class="font-bold text-[15px] leading-tight">StoreOS <span class="text-emerald-600">AI</span></div>
            <div class="text-[10px] text-gray-500 font-medium">${BRAND}</div>
          </div>
          <button class="md:hidden ml-auto text-gray-500" onclick="toggleSidebar(false)">${ICONS.close}</button>
        </div>
        
        <div class="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          ${navs.map(n=>`
            <a class="nav-link ${currentView===n.id?'active':''}" onclick="go('${n.id}')">
              ${n.i} <span class="flex-1">${n.l}</span>
            </a>
          `).join('')}
        </div>

        <div class="p-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
          <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Switch Role (Demo)</div>
          <select class="input !py-1.5 !text-xs font-medium cursor-pointer" onchange="setRole(this.value)">
            <option value="owner" ${role==='owner'?'selected':''}>👑 Owner</option>
            <option value="kasir" ${role==='kasir'?'selected':''}>🧾 Kasir (POS)</option>
            <option value="keeper" ${role==='keeper'?'selected':''}>📦 Store Keeper</option>
          </select>
        </div>
      </aside>

      <main class="main-content">
        <header class="md:hidden h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 sticky top-0 z-50">
          <button class="text-gray-600 dark:text-gray-300 mr-4" onclick="toggleSidebar(true)">${ICONS.menu}</button>
          <div class="font-bold text-sm">StoreOS <span class="text-emerald-600">AI</span></div>
        </header>
        
        <div class="p-4 md:p-8 max-w-[1400px] mx-auto pb-24">
          ${content}
        </div>
      </main>
    </div>
  `;
}

// Init
window.onload = render;

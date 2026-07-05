/* StoreOS AI — Inventory Engine Blueprint */
const D=document.documentElement.classList.contains('dark');
const p=(l,d)=>D?d:l;

const SECS=[
  {id:'process',t:'1. Business Process'},
  {id:'db',t:'2. Database Schema'},
  {id:'workflow',t:'3. Workflow Engine'},
  {id:'ux',t:'4. UX Design'},
  {id:'ai',t:'5. AI & ML'},
  {id:'auto',t:'6. Automation'},
  {id:'road',t:'7. Roadmap'},
];

const toc=()=>`
  <div class="hidden lg:block w-60 shrink-0 no-print">
    <div class="sticky top-6 c p-4 shadow-sm">
      <div class="font-black text-lg mb-0.5">Inventory <span style="color:#059669">Engine</span></div>
      <div class="text-[9px] font-bold uppercase tracking-widest mb-4" style="color:rgba(120,120,120,.4)">Architecture Blueprint</div>
      <nav class="flex flex-col gap-0.5">${SECS.map(s=>`<a href="#${s.id}" class="toc-link">${s.t}</a>`).join('')}</nav>
    </div>
  </div>`;

/* ═══════════════════════════════════════
   SECTION 1: BUSINESS PROCESS
   ═══════════════════════════════════════ */
const secProcess=()=>`
<section id="process" class="fi scroll-mt-6">
  <h2 class="text-2xl font-black mb-5"><span style="color:#059669">1.</span> Business Process</h2>
  
  <div class="c p-5 mb-5">
    <h3 class="font-bold text-base mb-3">Paradigma: Double-Entry Inventory Ledger</h3>
    <p class="text-sm leading-relaxed mb-4" style="color:rgba(120,120,120,.7)">
      Jangan pernah langsung update <code class="px-1.5 py-0.5 rounded text-xs" style="background:rgba(120,120,120,.08)">qty = qty - 1</code>. Gunakan <b>Ledger</b> — setiap pergerakan bahan adalah catatan permanen yang tidak bisa di-edit, hanya di-reverse. Seperti pembukuan keuangan double-entry.
    </p>
    
    <div class="grid md:grid-cols-2 gap-4 mb-4">
      <div class="p-4 rounded-xl" style="background:${p('rgba(239,68,68,.04)','rgba(239,68,68,.06)')};border:1px solid ${p('rgba(239,68,68,.12)','rgba(239,68,68,.15)')}">
        <div class="font-bold text-sm mb-2" style="color:${p('#dc2626','#f87171')}">❌ Cara Lama (Semua Kompetitor)</div>
        <div class="code text-[11px]"><span class="cm">-- Kasir jual 1 Cappuccino</span>
<span class="kw">UPDATE</span> inventory <span class="kw">SET</span> qty = qty - <span class="num">0.18</span>
<span class="kw">WHERE</span> name = <span class="str">'Biji Kopi'</span>;
<span class="cm">-- Tidak ada jejak. Siapa? Kapan? Kenapa?</span>
<span class="cm">-- Jika curang, tidak ada bukti.</span></div>
      </div>
      <div class="p-4 rounded-xl" style="background:${p('rgba(5,150,105,.04)','rgba(5,150,105,.06)')};border:1px solid ${p('rgba(5,150,105,.12)','rgba(5,150,105,.15)')}">
        <div class="font-bold text-sm mb-2" style="color:${p('#059669','#34d399')}">✅ StoreOS: Inventory Ledger</div>
        <div class="code text-[11px]"><span class="cm">-- Kasir jual 1 Cappuccino → auto-deduct</span>
<span class="kw">INSERT INTO</span> ledger (ingredient, qty, type,
  reason, ref_id, actor, branch, ts)
<span class="kw">VALUES</span> (<span class="str">'Biji Kopi'</span>, <span class="num">-0.018</span>, <span class="str">'SALE'</span>,
  <span class="str">'Cappuccino #T-4821'</span>, <span class="str">'trx_abc'</span>,
  <span class="str">'Rina'</span>, <span class="str">'Kemang'</span>, <span class="fn">NOW()</span>);
<span class="cm">-- Immutable. Traceable. Auditable.</span></div>
      </div>
    </div>
  </div>

  <div class="c p-5 mb-5">
    <h3 class="font-bold text-base mb-3">5 Jenis Pergerakan Stok</h3>
    <div class="tw">
      <table class="rtbl">
        <thead style="background:${p('rgba(0,0,0,.02)','rgba(255,255,255,.02)')}">
          <tr><th>Type</th><th>Direction</th><th>Trigger</th><th>Contoh</th><th>Fraud Risk</th></tr>
        </thead>
        <tbody>
          <tr><td class="font-bold" style="color:#059669">RECEIVE</td><td>+</td><td>PO diterima & dicek</td><td>Terima 10kg biji kopi dari supplier</td><td class="font-bold" style="color:#f59e0b">Medium</td></tr>
          <tr><td class="font-bold" style="color:#dc2626">SALE</td><td>−</td><td>POS checkout (auto)</td><td>1 Cappuccino = −18g kopi, −180ml susu</td><td style="color:#059669">Low (auto)</td></tr>
          <tr><td class="font-bold" style="color:#dc2626">WASTE</td><td>−</td><td>Manual + alasan wajib</td><td>Susu expired 2L, tumpah 0.5L</td><td class="font-bold" style="color:#dc2626">High</td></tr>
          <tr><td class="font-bold" style="color:#2563eb">TRANSFER</td><td>±</td><td>Antar cabang</td><td>Kirim 2kg matcha dari Kemang ke BSD</td><td style="color:#f59e0b">Medium</td></tr>
          <tr><td class="font-bold" style="color:#7c3aed">OPNAME</td><td>±</td><td>Hitung fisik (adjustment)</td><td>Sistem: 8L susu, Fisik: 6.5L → adj −1.5L</td><td class="font-bold" style="color:#dc2626">Critical</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="c p-5">
    <h3 class="font-bold text-base mb-3">Core Principle: Theoretical vs Actual</h3>
    <p class="text-sm leading-relaxed mb-4" style="color:rgba(120,120,120,.7)">Ini adalah jantung anti-fraud dan anti-waste. McDonald's menggunakan ini di 40.000+ gerai. Toyota menyebutnya <i>Standard Work</i>.</p>
    <div class="grid md:grid-cols-3 gap-3">
      <div class="p-4 rounded-xl text-center" style="background:${p('rgba(37,99,235,.04)','rgba(37,99,235,.06)')};border:1px solid ${p('rgba(37,99,235,.12)','rgba(37,99,235,.15)')}">
        <div class="text-2xl font-black" style="color:${p('#2563eb','#60a5fa')}">Theoretical</div>
        <div class="text-xs mt-1" style="color:rgba(120,120,120,.5)">Berapa seharusnya dipakai<br>(dihitung dari resep × penjualan)</div>
      </div>
      <div class="flex items-center justify-center"><div class="text-3xl font-black" style="color:rgba(120,120,120,.15)">vs</div></div>
      <div class="p-4 rounded-xl text-center" style="background:${p('rgba(245,158,11,.04)','rgba(245,158,11,.06)')};border:1px solid ${p('rgba(245,158,11,.12)','rgba(245,158,11,.15)')}">
        <div class="text-2xl font-black" style="color:${p('#d97706','#fbbf24')}">Actual</div>
        <div class="text-xs mt-1" style="color:rgba(120,120,120,.5)">Berapa yang benar-benar hilang<br>(dihitung dari stock opname)</div>
      </div>
    </div>
    <div class="mt-4 p-4 rounded-xl" style="background:${p('rgba(239,68,68,.04)','rgba(239,68,68,.06)')};border:1px solid ${p('rgba(239,68,68,.1)','rgba(239,68,68,.12)')}">
      <div class="font-bold text-sm" style="color:${p('#dc2626','#f87171')}">Variance = Actual − Theoretical</div>
      <div class="text-xs mt-1" style="color:rgba(120,120,120,.6)">Jika variance > 5% → <b>FLAG ANOMALY</b>. Kemungkinan: over-portion, pencurian, tumpah tidak dilaporkan, atau resep salah.</div>
    </div>
  </div>
</section>`;

/* ═══════════════════════════════════════
   SECTION 2: DATABASE
   ═══════════════════════════════════════ */
const secDB=()=>`
<section id="db" class="fi scroll-mt-6 mt-10">
  <h2 class="text-2xl font-black mb-5"><span style="color:#059669">2.</span> Database Schema</h2>

  <div class="c p-5 mb-5">
    <h3 class="font-bold text-base mb-3">Entity Relationship (Core Tables)</h3>
    <div class="code"><span class="cm">-- ═══ INGREDIENTS (Master Bahan Baku) ═══</span>
<span class="kw">CREATE TABLE</span> ingredients (
  id         <span class="fn">UUID</span> PRIMARY KEY,
  tenant_id  <span class="fn">UUID</span> REFERENCES tenants(id),
  name       <span class="fn">VARCHAR(100)</span>,
  category   <span class="fn">VARCHAR(50)</span>,  <span class="cm">-- dairy, coffee, dry, frozen, fresh</span>
  unit       <span class="fn">VARCHAR(20)</span>,  <span class="cm">-- kg, L, pcs, g, ml</span>
  cost_per   <span class="fn">DECIMAL</span>,     <span class="cm">-- harga per unit (auto-update dari PO)</span>
  shelf_life <span class="fn">INTEGER</span>,     <span class="cm">-- hari (NULL = tidak kadaluarsa)</span>
  storage    <span class="fn">VARCHAR(50)</span>  <span class="cm">-- chiller, freezer, dry_storage, ambient</span>
);

<span class="cm">-- ═══ RECIPES / BOM (Bill of Materials) ═══</span>
<span class="kw">CREATE TABLE</span> recipes (
  id            <span class="fn">UUID</span> PRIMARY KEY,
  product_id    <span class="fn">UUID</span> REFERENCES products(id), <span class="cm">-- menu item</span>
  ingredient_id <span class="fn">UUID</span> REFERENCES ingredients(id),
  qty_required  <span class="fn">DECIMAL</span>,     <span class="cm">-- 0.018 kg kopi per Cappuccino</span>
  unit          <span class="fn">VARCHAR(20)</span>,
  yield_pct     <span class="fn">DECIMAL</span>      <span class="cm">-- 95% (5% loss saat grinding)</span>
);

<span class="cm">-- ═══ INVENTORY LEDGER (Immutable Log) ═══</span>
<span class="kw">CREATE TABLE</span> inventory_ledger (
  id            <span class="fn">UUID</span> PRIMARY KEY,
  branch_id     <span class="fn">UUID</span>,
  ingredient_id <span class="fn">UUID</span>,
  qty           <span class="fn">DECIMAL</span>,       <span class="cm">-- positif = masuk, negatif = keluar</span>
  type          <span class="fn">VARCHAR(20)</span>,   <span class="cm">-- RECEIVE, SALE, WASTE, TRANSFER, OPNAME</span>
  reason        <span class="fn">TEXT</span>,           <span class="cm">-- wajib untuk WASTE & OPNAME</span>
  ref_id        <span class="fn">UUID</span>,           <span class="cm">-- link ke transaction/PO/opname_session</span>
  batch_id      <span class="fn">UUID</span>,           <span class="cm">-- tracking batch (FIFO)</span>
  actor_id      <span class="fn">UUID</span>,           <span class="cm">-- siapa yang melakukan</span>
  created_at    <span class="fn">TIMESTAMPTZ</span>    <span class="cm">-- immutable timestamp</span>
);
<span class="cm">-- INDEX: (branch_id, ingredient_id, created_at)</span>
<span class="cm">-- Saldo = SUM(qty) WHERE branch + ingredient</span>

<span class="cm">-- ═══ PURCHASE ORDERS ═══</span>
<span class="kw">CREATE TABLE</span> purchase_orders (
  id           <span class="fn">UUID</span> PRIMARY KEY,
  branch_id    <span class="fn">UUID</span>,
  supplier_id  <span class="fn">UUID</span>,
  status       <span class="fn">VARCHAR(20)</span>,  <span class="cm">-- draft, sent, partial, received, closed</span>
  auto_gen     <span class="fn">BOOLEAN</span>,      <span class="cm">-- true jika dibuat oleh AI</span>
  total_cost   <span class="fn">DECIMAL</span>,
  expected_at  <span class="fn">DATE</span>,
  received_at  <span class="fn">TIMESTAMPTZ</span>
);</div>
  </div>

  <div class="c p-5">
    <h3 class="font-bold text-base mb-3">Kenapa Ledger, Bukan UPDATE?</h3>
    <div class="tw">
      <table class="rtbl">
        <thead style="background:${p('rgba(0,0,0,.02)','rgba(255,255,255,.02)')}">
          <tr><th>Aspek</th><th style="color:#dc2626">UPDATE qty (Moka/Majoo)</th><th style="color:#059669">Ledger (StoreOS)</th></tr>
        </thead>
        <tbody>
          <tr><td class="font-bold">Audit Trail</td><td>❌ Tidak ada — siapa kurangi stok?</td><td>✅ Setiap baris = bukti: siapa, kapan, kenapa</td></tr>
          <tr><td class="font-bold">Fraud Detection</td><td>❌ Tidak mungkin — data hilang</td><td>✅ Bisa bandingkan theoretical vs actual</td></tr>
          <tr><td class="font-bold">Rollback Error</td><td>❌ Tidak bisa — data sudah overwrite</td><td>✅ Insert reverse entry (tanpa hapus data)</td></tr>
          <tr><td class="font-bold">Performance</td><td>⚡ Cepat (1 UPDATE)</td><td>⚡ Cepat juga — SUM() dengan index, cache di Redis</td></tr>
          <tr><td class="font-bold">Kompleksitas</td><td>✅ Simple</td><td>⚠️ Sedikit lebih kompleks, tapi worth it</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</section>`;

/* ═══════════════════════════════════════
   SECTION 3: WORKFLOW
   ═══════════════════════════════════════ */
const secWorkflow=()=>`
<section id="workflow" class="fi scroll-mt-6 mt-10">
  <h2 class="text-2xl font-black mb-5"><span style="color:#059669">3.</span> Workflow Engine</h2>

  <div class="c p-5 mb-5">
    <h3 class="font-bold text-base mb-4">Recipe Auto-Deduction (Per Transaksi POS)</h3>
    <div class="flex items-center gap-2 overflow-x-auto pb-2">
      <div class="flow-step" style="background:${p('#eff6ff','rgba(37,99,235,.1)')};color:${p('#2563eb','#60a5fa')}">POS<br>Checkout</div>
      <div class="flow-arrow">→</div>
      <div class="flow-step" style="background:${p('#ecfdf5','rgba(5,150,105,.1)')};color:${p('#059669','#34d399')}">Lookup<br>BOM</div>
      <div class="flow-arrow">→</div>
      <div class="flow-step" style="background:${p('#fefce8','rgba(245,158,11,.1)')};color:${p('#d97706','#fbbf24')}">Deduct per<br>Ingredient</div>
      <div class="flow-arrow">→</div>
      <div class="flow-step" style="background:${p('#fef2f2','rgba(239,68,68,.1)')};color:${p('#dc2626','#f87171')}">Check<br>Safety Stock</div>
      <div class="flow-arrow">→</div>
      <div class="flow-step" style="background:${p('#f5f3ff','rgba(124,58,237,.1)')};color:${p('#7c3aed','#a78bfa')}">Auto-PO<br>if Below</div>
    </div>
    <div class="text-xs mt-3" style="color:rgba(120,120,120,.5)">Semuanya terjadi dalam <b>&lt; 50ms</b> per transaksi. Kasir tidak merasakan apapun.</div>
  </div>

  <div class="c p-5 mb-5">
    <h3 class="font-bold text-base mb-4">Stock Opname: Cycle Count (Toyota)</h3>
    <p class="text-sm mb-4" style="color:rgba(120,120,120,.6)">Jangan hitung semua bahan sekaligus (full opname). Gunakan <b>Cycle Count</b> — hitung 3-5 bahan per shift, bergilir. Dalam 1 minggu, semua bahan sudah terhitung tanpa mengganggu operasional.</p>
    <div class="tw">
      <table class="rtbl">
        <thead style="background:${p('rgba(0,0,0,.02)','rgba(255,255,255,.02)')}">
          <tr><th>Hari</th><th>Bahan Dihitung</th><th>Kategori</th><th>Prioritas</th></tr>
        </thead>
        <tbody>
          <tr><td class="font-bold">Senin</td><td>Biji Kopi, Susu</td><td>High-value, High-risk</td><td><span class="pill" style="background:${p('rgba(239,68,68,.08)','rgba(239,68,68,.1)')};color:${p('#dc2626','#f87171')}">A (Daily)</span></td></tr>
          <tr><td class="font-bold">Selasa</td><td>Gula Aren, Coklat, Matcha</td><td>Medium-value</td><td><span class="pill" style="background:${p('rgba(245,158,11,.08)','rgba(245,158,11,.1)')};color:${p('#d97706','#fbbf24')}">B (3x/week)</span></td></tr>
          <tr><td class="font-bold">Rabu</td><td>Biji Kopi, Susu</td><td>High-value (repeat)</td><td><span class="pill" style="background:${p('rgba(239,68,68,.08)','rgba(239,68,68,.1)')};color:${p('#dc2626','#f87171')}">A</span></td></tr>
          <tr><td class="font-bold">Kamis</td><td>Roti, Kentang, Teh</td><td>Low-value</td><td><span class="pill" style="background:${p('rgba(5,150,105,.08)','rgba(5,150,105,.1)')};color:${p('#059669','#34d399')}">C (1x/week)</span></td></tr>
          <tr><td class="font-bold">Jumat</td><td>Biji Kopi, Susu, Gula Aren</td><td>High + Medium</td><td><span class="pill" style="background:${p('rgba(239,68,68,.08)','rgba(239,68,68,.1)')};color:${p('#dc2626','#f87171')}">A+B</span></td></tr>
        </tbody>
      </table>
    </div>
    <div class="mt-3 text-xs" style="color:rgba(120,120,120,.5)"><b>Toyota Insight:</b> Item kategori A (mahal & rawan fraud seperti susu dan kopi) dihitung SETIAP HARI. Item kategori C (murah & stabil seperti teh) cukup 1x/minggu.</div>
  </div>

  <div class="c p-5">
    <h3 class="font-bold text-base mb-4">Purchase Order Automation</h3>
    <div class="flex items-center gap-2 overflow-x-auto pb-2">
      <div class="flow-step" style="background:${p('#fef2f2','rgba(239,68,68,.08)')};color:${p('#dc2626','#f87171')}">Stock ≤<br>Reorder Point</div>
      <div class="flow-arrow">→</div>
      <div class="flow-step" style="background:${p('#eff6ff','rgba(37,99,235,.08)')};color:${p('#2563eb','#60a5fa')}">AI hitung<br>Qty Optimal</div>
      <div class="flow-arrow">→</div>
      <div class="flow-step" style="background:${p('#fefce8','rgba(245,158,11,.08)')};color:${p('#d97706','#fbbf24')}">Draft PO<br>(Auto)</div>
      <div class="flow-arrow">→</div>
      <div class="flow-step" style="background:${p('#ecfdf5','rgba(5,150,105,.08)')};color:${p('#059669','#34d399')}">Owner<br>Approve via WA</div>
      <div class="flow-arrow">→</div>
      <div class="flow-step" style="background:${p('#f5f3ff','rgba(124,58,237,.08)')};color:${p('#7c3aed','#a78bfa')}">Send to<br>Supplier</div>
    </div>
    <div class="mt-3 p-3 rounded-xl text-xs" style="background:${p('rgba(5,150,105,.04)','rgba(5,150,105,.06)')};color:${p('#047857','#6ee7b7')}">
      <b>Reorder Point Formula:</b> (Avg Daily Usage × Lead Time Days) + Safety Stock<br>
      <b>Safety Stock:</b> Z-score × √(Lead Time) × Std Dev of Daily Usage<br>
      <i>Z-score 1.65 = 95% service level (5% chance of stockout)</i>
    </div>
  </div>
</section>`;

/* ═══════════════════════════════════════
   SECTION 4: UX
   ═══════════════════════════════════════ */
const secUX=()=>`
<section id="ux" class="fi scroll-mt-6 mt-10">
  <h2 class="text-2xl font-black mb-5"><span style="color:#059669">4.</span> UX Design</h2>

  <div class="c p-5 mb-5">
    <h3 class="font-bold text-base mb-3">Store Keeper: 3-Tap Stock Opname</h3>
    <p class="text-sm mb-4" style="color:rgba(120,120,120,.6)">Opname tradisional: buka spreadsheet → cari bahan → ketik angka → simpan. Lama dan error-prone. StoreOS: <b>3 tap</b>.</p>
    <div class="grid sm:grid-cols-3 gap-4">
      <div class="c p-4 text-center">
        <div class="text-3xl mb-2">📷</div>
        <div class="font-bold text-sm">Tap 1: Scan</div>
        <div class="text-xs mt-1" style="color:rgba(120,120,120,.5)">Scan barcode bahan atau pilih dari list yang sudah diurutkan AI (prioritas A dulu).</div>
      </div>
      <div class="c p-4 text-center">
        <div class="text-3xl mb-2">🔢</div>
        <div class="font-bold text-sm">Tap 2: Input Qty</div>
        <div class="text-xs mt-1" style="color:rgba(120,120,120,.5)">Numpad besar (bukan keyboard kecil). Sistem menunjukkan: "Sistem: 8.0L. Berapa fisik?"</div>
      </div>
      <div class="c p-4 text-center">
        <div class="text-3xl mb-2">✅</div>
        <div class="font-bold text-sm">Tap 3: Confirm</div>
        <div class="text-xs mt-1" style="color:rgba(120,120,120,.5)">Jika selisih >5%, wajib foto bukti + pilih alasan. Langsung masuk ledger + alert Owner.</div>
      </div>
    </div>
  </div>

  <div class="c p-5">
    <h3 class="font-bold text-base mb-3">Owner: Variance Dashboard</h3>
    <p class="text-sm mb-4" style="color:rgba(120,120,120,.6)">Owner tidak ingin melihat angka stok mentah. Owner ingin tahu: <b>"Di mana uang saya bocor?"</b></p>
    <div class="tw">
      <table class="rtbl">
        <thead style="background:${p('rgba(0,0,0,.02)','rgba(255,255,255,.02)')}">
          <tr><th>Bahan</th><th>Theoretical</th><th>Actual</th><th>Variance</th><th>Est. Loss</th><th>Status</th></tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-bold">Susu Full Cream</td>
            <td>18.0 L</td><td>14.5 L</td>
            <td class="font-bold" style="color:#dc2626">−3.5 L (19.4%)</td>
            <td class="font-bold" style="color:#dc2626">Rp 64.750</td>
            <td><span class="pill" style="background:${p('rgba(239,68,68,.08)','rgba(239,68,68,.1)')};color:${p('#dc2626','#f87171')}">🚨 Anomali</span></td>
          </tr>
          <tr>
            <td class="font-bold">Biji Kopi House Blend</td>
            <td>3.2 kg</td><td>3.0 kg</td>
            <td style="color:#d97706">−0.2 kg (6.3%)</td>
            <td style="color:#d97706">Rp 37.000</td>
            <td><span class="pill" style="background:${p('rgba(245,158,11,.08)','rgba(245,158,11,.1)')};color:${p('#d97706','#fbbf24')}">⚠️ Watch</span></td>
          </tr>
          <tr>
            <td class="font-bold">Gula Aren Cair</td>
            <td>2.1 L</td><td>2.0 L</td>
            <td style="color:#059669">−0.1 L (4.8%)</td>
            <td style="color:rgba(120,120,120,.4)">Rp 4.500</td>
            <td><span class="pill" style="background:${p('rgba(5,150,105,.08)','rgba(5,150,105,.1)')};color:${p('#059669','#34d399')}">✅ Normal</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</section>`;

/* ═══════════════════════════════════════
   SECTION 5: AI
   ═══════════════════════════════════════ */
const secAI=()=>`
<section id="ai" class="fi scroll-mt-6 mt-10">
  <h2 class="text-2xl font-black mb-5"><span style="color:#059669">5.</span> AI & Machine Learning</h2>

  <div class="grid md:grid-cols-2 gap-4">
    <div class="c p-5">
      <div class="text-2xl mb-2">📊</div>
      <h3 class="font-bold text-sm mb-1">Demand Forecasting</h3>
      <div class="text-xs mb-2" style="color:rgba(120,120,120,.5)">Prediksi penjualan besok → hitung kebutuhan bahan → auto-PO jika perlu</div>
      <div class="text-xs" style="color:rgba(120,120,120,.4)"><b>Model:</b> Prophet / XGBoost. <b>Input:</b> Historical sales, day-of-week, weather, events. <b>Akurasi target:</b> MAPE &lt; 15%.</div>
    </div>
    <div class="c p-5">
      <div class="text-2xl mb-2">🚨</div>
      <h3 class="font-bold text-sm mb-1">Variance Anomaly Detection</h3>
      <div class="text-xs mb-2" style="color:rgba(120,120,120,.5)">Deteksi pola tidak normal: over-portion, pencurian, waste tersembunyi</div>
      <div class="text-xs" style="color:rgba(120,120,120,.4)"><b>Model:</b> Z-score + IQR (rule-based). Upgrade ke Isolation Forest di V2. <b>Threshold:</b> Variance &gt; 2σ = FLAG.</div>
    </div>
    <div class="c p-5">
      <div class="text-2xl mb-2">⏰</div>
      <h3 class="font-bold text-sm mb-1">Expiry Prediction</h3>
      <div class="text-xs mb-2" style="color:rgba(120,120,120,.5)">Prediksi bahan mana yang akan expired sebelum habis dipakai → sarankan promo/diskon</div>
      <div class="text-xs" style="color:rgba(120,120,120,.4)"><b>Logic:</b> (Remaining Qty ÷ Avg Daily Usage) vs Days Until Expiry. Jika usage &lt; expiry → FLAG.</div>
    </div>
    <div class="c p-5">
      <div class="text-2xl mb-2">💰</div>
      <h3 class="font-bold text-sm mb-1">Dynamic HPP Calculator</h3>
      <div class="text-xs mb-2" style="color:rgba(120,120,120,.5)">HPP menu berubah otomatis saat harga bahan naik → alert jika margin turun di bawah threshold</div>
      <div class="text-xs" style="color:rgba(120,120,120,.4)"><b>Logic:</b> HPP = Σ(recipe_qty × latest_cost_per_unit ÷ yield_pct). Recalculate setiap PO baru masuk.</div>
    </div>
  </div>
</section>`;

/* ═══════════════════════════════════════
   SECTION 6: AUTOMATION
   ═══════════════════════════════════════ */
const secAuto=()=>`
<section id="auto" class="fi scroll-mt-6 mt-10">
  <h2 class="text-2xl font-black mb-5"><span style="color:#059669">6.</span> Automation Rules</h2>
  <div class="c overflow-hidden">
    <div class="tw">
      <table class="rtbl">
        <thead style="background:${p('rgba(0,0,0,.02)','rgba(255,255,255,.02)')}">
          <tr><th>Trigger</th><th>Condition</th><th>Action</th><th>Channel</th></tr>
        </thead>
        <tbody>
          <tr><td class="font-bold" style="color:#059669">Auto-Deduct</td><td>POS checkout event</td><td>Insert ledger entries per recipe ingredient</td><td>System (instant)</td></tr>
          <tr><td class="font-bold" style="color:#dc2626">Fraud Alert</td><td>Variance &gt; 10% pada item kategori A</td><td>Push alert ke Owner + log untuk audit</td><td>WA + Dashboard</td></tr>
          <tr><td class="font-bold" style="color:#f59e0b">Reorder Alert</td><td>Stock ≤ Reorder Point</td><td>Generate draft PO + kirim approval ke Owner</td><td>WA (1-tap approve)</td></tr>
          <tr><td class="font-bold" style="color:#7c3aed">Expiry Warning</td><td>Remaining days ≤ 2 AND usage rate rendah</td><td>Sarankan promo/diskon menu terkait</td><td>WA + Store Keeper app</td></tr>
          <tr><td class="font-bold" style="color:#2563eb">HPP Shift</td><td>PO baru diterima dengan harga berbeda &gt; 5%</td><td>Recalculate HPP semua menu terkait + alert</td><td>Dashboard + WA</td></tr>
          <tr><td class="font-bold" style="color:#059669">Cycle Count</td><td>Cron harian (awal shift)</td><td>Generate task list opname untuk Store Keeper</td><td>Store Keeper app</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</section>`;

/* ═══════════════════════════════════════
   SECTION 7: ROADMAP
   ═══════════════════════════════════════ */
const secRoad=()=>`
<section id="road" class="fi scroll-mt-6 mt-10 mb-16">
  <h2 class="text-2xl font-black mb-5"><span style="color:#059669">7.</span> Execution Roadmap</h2>
  <div class="space-y-4">
    
    <div class="c p-5">
      <div class="flex items-center gap-3 mb-3">
        <span class="pill" style="background:${p('rgba(120,120,120,.08)','rgba(120,120,120,.1)')};color:rgba(120,120,120,.6)">Sprint 1-2</span>
        <span class="font-bold">Foundation</span>
      </div>
      <div class="grid sm:grid-cols-2 gap-3 text-xs" style="color:rgba(120,120,120,.6)">
        <div>✅ Ingredients CRUD + Categories<br>✅ Recipe/BOM Editor (per menu item)<br>✅ Inventory Ledger (RECEIVE, SALE, WASTE)</div>
        <div>✅ Auto-deduction on POS checkout<br>✅ Current stock view (SUM ledger)<br>✅ Basic stock opname (input fisik → ledger adj)</div>
      </div>
    </div>

    <div class="c p-5">
      <div class="flex items-center gap-3 mb-3">
        <span class="pill" style="background:${p('rgba(124,58,237,.08)','rgba(124,58,237,.1)')};color:${p('#7c3aed','#a78bfa')}">Sprint 3-4</span>
        <span class="font-bold">Intelligence</span>
      </div>
      <div class="grid sm:grid-cols-2 gap-3 text-xs" style="color:rgba(120,120,120,.6)">
        <div>🔜 Theoretical vs Actual variance engine<br>🔜 Variance dashboard (Owner)<br>🔜 Cycle Count scheduler (ABC priority)</div>
        <div>🔜 Supplier management + PO module<br>🔜 Reorder point + safety stock calculator<br>🔜 HPP auto-recalculation</div>
      </div>
    </div>

    <div class="c p-5">
      <div class="flex items-center gap-3 mb-3">
        <span class="pill" style="background:${p('rgba(5,150,105,.08)','rgba(5,150,105,.1)')};color:${p('#059669','#34d399')}">Sprint 5-6</span>
        <span class="font-bold">Automation & AI</span>
      </div>
      <div class="grid sm:grid-cols-2 gap-3 text-xs" style="color:rgba(120,120,120,.6)">
        <div>🔜 Auto-PO generation + WA approval<br>🔜 Demand forecasting (Prophet/XGBoost)<br>🔜 Expiry prediction + promo suggestion</div>
        <div>🔜 Batch tracking (FIFO)<br>🔜 Inter-branch transfer flow<br>🔜 Fraud pattern ML (Isolation Forest)</div>
      </div>
    </div>

  </div>
</section>`;

/* ═══════════════════════════════════════
   RENDER
   ═══════════════════════════════════════ */
document.getElementById('app').innerHTML=`
<div class="max-w-[1280px] mx-auto px-4 md:px-8 py-8 md:py-12 flex gap-8 items-start relative">
  ${toc()}
  <main class="flex-1 min-w-0">
    <header class="mb-10 pb-8" style="border-bottom:1px solid ${p('rgba(0,0,0,.06)','rgba(255,255,255,.06)')}">
      <div class="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider w-fit mb-4" style="background:${p('rgba(5,150,105,.06)','rgba(5,150,105,.1)')};color:${p('#059669','#34d399')}">Engineering Architecture Document</div>
      <h1 class="text-3xl md:text-4xl font-black tracking-tight mb-3">Inventory <span style="color:#059669">Engine</span></h1>
      <p style="color:rgba(120,120,120,.5)" class="text-sm md:text-base max-w-2xl">
        Dirancang dengan mentalitas <b>Amazon Warehouse</b> (Ledger-based tracking), <b>McDonald's</b> (Recipe deduction + variance), dan <b>Toyota</b> (Lean + Cycle Count). Anti-fraud. Anti-waste. Predictive.
      </p>
    </header>
    ${secProcess()}
    ${secDB()}
    ${secWorkflow()}
    ${secUX()}
    ${secAI()}
    ${secAuto()}
    ${secRoad()}
  </main>
</div>`;

// ScrollSpy
const obs=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting)document.querySelectorAll('.toc-link').forEach(l=>l.classList.toggle('active',l.getAttribute('href')==='#'+e.target.id))})},{rootMargin:'-20% 0px -80% 0px'});
SECS.forEach(s=>{const el=document.getElementById(s.id);if(el)obs.observe(el)});

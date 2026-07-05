const SECTIONS=[
  {id:'arch',t:'1. Architecture & Stack'},
  {id:'db',t:'2. Database Schema'},
  {id:'api',t:'3. Core API Design'},
  {id:'ai',t:'4. AI & ML Pipeline'},
  {id:'sprint',t:'5. Execution Roadmap'},
];

const renderTOC=()=>`
  <div class="hidden lg:block w-64 shrink-0 no-print">
    <div class="sticky top-6 p-4 rcard shadow-sm">
      <div class="font-bold text-lg mb-1">StoreOS <span class="text-emerald-600">Eng</span></div>
      <div class="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">Tech Masterplan</div>
      <nav class="flex flex-col gap-1">
        ${SECTIONS.map(s=>`<a href="#${s.id}" class="toc-link">${s.t}</a>`).join('')}
      </nav>
    </div>
  </div>
`;

const secArch=()=>`
  <section id="arch" class="fade-in scroll-mt-6">
    <h2 class="text-2xl font-black mb-4 flex items-center gap-2"><span class="text-emerald-600">1.</span> Architecture & Tech Stack</h2>
    <div class="rcard p-5 space-y-6">
      
      <p class="text-gray-600 dark:text-gray-300"><b>Prinsip Utama:</b> Offline-First untuk Kasir (POS) & Real-time untuk Owner. Jika internet cafe mati, kasir harus 100% jalan. Sinkronisasi di background saat online.</p>

      <div class="grid md:grid-cols-2 gap-4">
        
        <div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold">FE</div>
            <h3 class="font-bold">Frontend (Client)</h3>
          </div>
          <ul class="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <li>
              <span class="pill pill-blue mb-1">POS / Kasir:</span><br>
              <b>React Native (Expo)</b> atau <b>PWA (React/Next.js)</b>.<br>
              <i class="text-xs">Wajib pakai <b>WatermelonDB</b> atau <b>RxDB</b> (Local-first Database) agar transaksi tetap tersimpan saat offline, lalu sync ke server otomatis.</i>
            </li>
            <li>
              <span class="pill pill-blue mb-1">Owner Dashboard:</span><br>
              <b>Next.js (App Router)</b> + Tailwind CSS + Shadcn UI.
            </li>
          </ul>
        </div>

        <div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-2 mb-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">BE</div>
            <h3 class="font-bold">Backend (Server)</h3>
          </div>
          <ul class="space-y-3 text-sm text-gray-600 dark:text-gray-400">
            <li>
              <span class="pill pill-green mb-1">API & Logic:</span><br>
              <b>Node.js (NestJS)</b> atau <b>Go (Golang)</b>.<br>
              <i class="text-xs">Go sangat disarankan jika Anda mengharapkan ribuan transaksi per detik (high concurrency), tapi Node/NestJS lebih cepat dibangun.</i>
            </li>
            <li>
              <span class="pill pill-green mb-1">Background Jobs:</span><br>
              <b>Redis + BullMQ</b> (untuk proses AI analitik malam hari, sinkronisasi stok, dan tembak API WhatsApp).
            </li>
          </ul>
        </div>

      </div>
    </div>
  </section>
`;

const secDB=()=>`
  <section id="db" class="fade-in scroll-mt-6 mt-10">
    <h2 class="text-2xl font-black mb-4 flex items-center gap-2"><span class="text-emerald-600">2.</span> Database Schema (PostgreSQL)</h2>
    <div class="rcard p-5">
      <p class="text-gray-600 dark:text-gray-300 mb-4">Gunakan <b>PostgreSQL</b> sebagai Primary DB. Ini skema <i>multi-tenant</i> yang dioptimalkan untuk performa.</p>
      
      <div class="codeblock">
<span class="cm">-- 1. TENANTS (Perusahaan/Owner)</span>
<span class="kw">CREATE TABLE</span> tenants (
  id <span class="fn">UUID</span> PRIMARY KEY,
  name <span class="fn">VARCHAR(100)</span>,
  subscription_plan <span class="fn">VARCHAR(50)</span>, <span class="cm">-- free, growth, pro</span>
  created_at <span class="fn">TIMESTAMP</span>
);

<span class="cm">-- 2. BRANCHES (Cabang F&B)</span>
<span class="kw">CREATE TABLE</span> branches (
  id <span class="fn">UUID</span> PRIMARY KEY,
  tenant_id <span class="fn">UUID</span> REFERENCES tenants(id),
  name <span class="fn">VARCHAR(100)</span>,
  address <span class="fn">TEXT</span>,
  timezone <span class="fn">VARCHAR(50)</span> <span class="cm">-- Penting! Jam 22:00 di Bali beda dgn Jakarta</span>
);

<span class="cm">-- 3. PRODUCTS (Menu)</span>
<span class="kw">CREATE TABLE</span> products (
  id <span class="fn">UUID</span> PRIMARY KEY,
  tenant_id <span class="fn">UUID</span> REFERENCES tenants(id),
  name <span class="fn">VARCHAR(100)</span>,
  category <span class="fn">VARCHAR(50)</span>,
  price <span class="fn">DECIMAL</span>,
  cost <span class="fn">DECIMAL</span>, <span class="cm">-- HPP dinamis dari komposisi bahan</span>
  is_active <span class="fn">BOOLEAN</span>
);

<span class="cm">-- 4. INVENTORY (Bahan Baku per Cabang)</span>
<span class="kw">CREATE TABLE</span> inventory (
  id <span class="fn">UUID</span> PRIMARY KEY,
  branch_id <span class="fn">UUID</span> REFERENCES branches(id),
  name <span class="fn">VARCHAR(100)</span>,
  qty_system <span class="fn">DECIMAL</span>,
  qty_physical <span class="fn">DECIMAL</span>, <span class="cm">-- Diupdate saat opname</span>
  min_stock <span class="fn">DECIMAL</span>,
  unit <span class="fn">VARCHAR(20)</span>
);

<span class="cm">-- 5. TRANSACTIONS (Penjualan - Harus Cepat)</span>
<span class="kw">CREATE TABLE</span> transactions (
  id <span class="fn">UUID</span> PRIMARY KEY,
  branch_id <span class="fn">UUID</span> REFERENCES branches(id),
  cashier_id <span class="fn">UUID</span>,
  total_amount <span class="fn">DECIMAL</span>,
  payment_method <span class="fn">VARCHAR(50)</span>, <span class="cm">-- qris, cash, card</span>
  status <span class="fn">VARCHAR(50)</span>, <span class="cm">-- completed, voided</span>
  void_reason <span class="fn">TEXT</span>,
  offline_id <span class="fn">VARCHAR(100)</span>, <span class="cm">-- ID dari client saat offline</span>
  created_at <span class="fn">TIMESTAMP</span>
);
<span class="cm">-- CREATE INDEX idx_trx_branch_date ON transactions(branch_id, created_at);</span></div>
      
    </div>
  </section>
`;

const secAPI=()=>`
  <section id="api" class="fade-in scroll-mt-6 mt-10">
    <h2 class="text-2xl font-black mb-4 flex items-center gap-2"><span class="text-emerald-600">3.</span> Core API Design</h2>
    <div class="rcard overflow-hidden">
      <div class="table-wrap">
        <table class="rtbl">
          <thead class="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th class="w-1/4">Endpoint</th>
              <th class="w-1/6">Method</th>
              <th class="w-1/4">Role</th>
              <th>Description & Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="font-mono text-xs">/api/v1/sync/pull</td>
              <td><span class="pill pill-blue">GET</span></td>
              <td>Kasir</td>
              <td>Endpoint WatermelonDB. Kasir narik katalog menu, harga baru, promo terbaru saat aplikasi online.</td>
            </tr>
            <tr>
              <td class="font-mono text-xs">/api/v1/sync/push</td>
              <td><span class="pill pill-green">POST</span></td>
              <td>Kasir</td>
              <td>Kasir mengirim batch transaksi lokal ke server. <i>Idempotent</i> (menggunakan offline_id) agar tidak ada data ganda jika internet putus-nyambung.</td>
            </tr>
            <tr>
              <td class="font-mono text-xs">/api/v1/owner/kpi</td>
              <td><span class="pill pill-blue">GET</span></td>
              <td>Owner</td>
              <td>Data dashboard (omzet, leak, target). Harus di-cache di Redis per 5 menit agar query tidak membebani DB utama.</td>
            </tr>
            <tr>
              <td class="font-mono text-xs">/api/v1/ai/alerts</td>
              <td><span class="pill pill-blue">GET</span></td>
              <td>Owner</td>
              <td>Mengambil list anomali yang sudah difilter oleh ML pipeline.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
`;

const secAI=()=>`
  <section id="ai" class="fade-in scroll-mt-6 mt-10">
    <h2 class="text-2xl font-black mb-4 flex items-center gap-2"><span class="text-emerald-600">4.</span> AI & ML Pipeline</h2>
    <div class="rcard p-5 space-y-5">
      <p class="text-gray-600 dark:text-gray-300">Bagaimana StoreOS menghasilkan "Insights" & "Alerts"? Jangan gunakan LLM (seperti ChatGPT) untuk setiap transaksi — biayanya akan meledak dan terlalu lambat. Gunakan kombinasi <b>Rule-based Heuristics</b> dan <b>Lightweight Anomaly Detection</b>.</p>

      <div class="grid md:grid-cols-3 gap-4">
        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/40">
          <div class="text-[10px] font-bold uppercase text-gray-500 mb-1">Step 1 (Real-time)</div>
          <h3 class="font-bold text-sm mb-2">Heuristics Engine</h3>
          <p class="text-xs text-gray-600 dark:text-gray-400">Jalan di Node/Go. Aturan if-else pintar.<br><i>Contoh:</i> Jika (Status=Void) DAN (Waktu > Waktu Cetak Struk) = FLAG FRAUD LEVEL 8.</p>
        </div>
        
        <div class="p-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-50 dark:bg-gray-800/40">
          <div class="text-[10px] font-bold uppercase text-gray-500 mb-1">Step 2 (Cron / 1 Jam)</div>
          <h3 class="font-bold text-sm mb-2">Statistical Outliers</h3>
          <p class="text-xs text-gray-600 dark:text-gray-400">Jalan di background (Python/Pandas). Cek deviasi bahan baku. <br><i>Contoh:</i> Susu terjual 20 cup, tapi stok turun 35 cup = FLAG WASTE LEVEL 7.</p>
        </div>

        <div class="p-4 border border-emerald-200 dark:border-emerald-800 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
          <div class="text-[10px] font-bold uppercase text-emerald-600 mb-1">Step 3 (Cron / 21:00)</div>
          <h3 class="font-bold text-sm mb-2">LLM Text Generation</h3>
          <p class="text-xs text-emerald-800/80 dark:text-emerald-200/80">Lempar data mentah JSON performa hari ini ke OpenAI API (GPT-4o-mini) dengan prompt <i>"Buat ringkasan 3 poin max via WA untuk Owner F&B"</i>. Lalu kirim via WA API.</p>
        </div>
      </div>
    </div>
  </section>
`;

const secSprint=()=>`
  <section id="sprint" class="fade-in scroll-mt-6 mt-10 mb-20">
    <h2 class="text-2xl font-black mb-4 flex items-center gap-2"><span class="text-emerald-600">5.</span> Execution Roadmap (3 Bulan ke MVP)</h2>
    <div class="rcard overflow-hidden">
      <div class="table-wrap">
        <table class="rtbl">
          <thead class="bg-gray-50 dark:bg-gray-800/50">
            <tr>
              <th class="w-1/6">Timeline</th>
              <th class="w-1/5">Fokus</th>
              <th>Deliverables / Output</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="pill pill-gray">Bulan 1</span><br><span class="text-xs text-gray-400 font-medium">Foundation</span></td>
              <td class="font-bold">Core POS & Sync</td>
              <td>
                <ul class="list-disc list-inside text-xs space-y-1">
                  <li>Setup Repo, Postgres, Next.js, React Native</li>
                  <li>Sistem Auth & Manajemen Tenant/Cabang</li>
                  <li>UI Kasir dasar (Keranjang, Checkout, Bayar)</li>
                  <li><b>CRITICAL:</b> Engine Sync Offline-to-Online (WatermelonDB ke Backend)</li>
                </ul>
              </td>
            </tr>
            <tr>
              <td><span class="pill pill-purple">Bulan 2</span><br><span class="text-xs text-gray-400 font-medium">Value Creation</span></td>
              <td class="font-bold">Intelligence & Owner App</td>
              <td>
                <ul class="list-disc list-inside text-xs space-y-1">
                  <li>UI Owner Dashboard (Web)</li>
                  <li>Manajemen Stok dasar & Resep (BOM - Bill of Materials)</li>
                  <li>Rule-based Anomaly (Deteksi void & selisih bahan baku)</li>
                  <li>Audit Trail Log untuk kasir</li>
                </ul>
              </td>
            </tr>
            <tr>
              <td><span class="pill pill-green">Bulan 3</span><br><span class="text-xs text-gray-400 font-medium">Go-to-Market</span></td>
              <td class="font-bold">AI Bot & Polish</td>
              <td>
                <ul class="list-disc list-inside text-xs space-y-1">
                  <li>Integrasi WhatsApp API (WABA / Baileys) untuk Daily Brief</li>
                  <li>Koneksi LLM untuk merangkum insight harian</li>
                  <li>Export Laporan (PDF/Excel)</li>
                  <li>Beta Testing ke 2-3 restoran teman/koneksi</li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
`;

const layout=`
  <div class="max-w-6xl mx-auto px-4 py-8 md:py-12 flex gap-8 items-start relative">
    ${renderTOC()}
    <main class="flex-1 min-w-0">
      <header class="mb-10 border-b border-gray-200 dark:border-gray-800 pb-8">
        <h1 class="text-3xl md:text-4xl font-black tracking-tight mb-3">StoreOS <span class="text-emerald-600">Technical Roadmap</span></h1>
        <p class="text-gray-500 text-sm md:text-base max-w-2xl">Panduan eksekusi teknis untuk tim engineering. Dari arsitektur database, desain API, hingga pipeline AI dan fase sprint.</p>
      </header>
      ${secArch()}
      ${secDB()}
      ${secAPI()}
      ${secAI()}
      ${secSprint()}
    </main>
  </div>
`;

document.getElementById('app').innerHTML = layout;

// ScrollSpy
window.addEventListener('DOMContentLoaded', () => {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        document.querySelectorAll('.toc-link').forEach(l => {
          l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id);
        });
      }
    });
  }, { rootMargin: '-20% 0px -80% 0px' });
  SECTIONS.forEach(s => { const el = document.getElementById(s.id); if(el) obs.observe(el); });
});

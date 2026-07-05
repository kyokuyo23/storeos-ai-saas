/* ============================================================
   StoreOS AI — Business Discovery & Product Strategy
   Rendered single-page document.
   ============================================================ */

const SECTIONS = [
  { id: "exec", title: "1. Executive Summary" },
  { id: "market", title: "2. Market Opportunity" },
  { id: "competitor", title: "3. Competitor Analysis" },
  { id: "pain", title: "4. Problem Validation" },
  { id: "position", title: "5. Product Positioning" },
  { id: "valprop", title: "6. Value Proposition" },
  { id: "jtbd", title: "7. Jobs To Be Done" },
  { id: "principles", title: "8. Product Principles" },
  { id: "northstar", title: "9. North Star Metric" },
  { id: "risks", title: "10. Risiko & Eksekusi" }
];

const renderMenu = () => `
  <div class="hidden md:block w-64 shrink-0 no-print">
    <div class="sticky top-6 p-4 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
      <div class="font-bold text-lg mb-1">StoreOS <span class="text-emerald-600 dark:text-emerald-400">AI</span></div>
      <div class="text-[10px] text-gray-500 font-semibold tracking-wider uppercase mb-4">Strategy Document</div>
      <nav class="flex flex-col gap-1 text-sm text-gray-600 dark:text-gray-300">
        ${SECTIONS.map(s=>`<a href="#${s.id}" class="nav-item px-3 py-1.5 rounded-lg -ml-3 pl-3 truncate text-[13px]">${s.title}</a>`).join('')}
      </nav>
    </div>
  </div>
`;

// ========================== SECTION BUILDERS ==========================

const secExec = () => `
  <section id="exec" class="section-enter scroll-mt-6">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2"><span class="text-emerald-600">1.</span> Executive Summary</h2>
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 md:p-6 border border-gray-200 dark:border-gray-800 space-y-5">
      <div>
        <h3 class="font-bold text-base mb-2">Apa sebenarnya StoreOS AI?</h3>
        <p class="text-gray-600 dark:text-gray-300 leading-relaxed">
          StoreOS AI bukan "aplikasi kasir yang ditambahkan AI", melainkan <b>"Store Manager digital berbasis AI yang memiliki modul kasir (POS)"</b>. 
          Ini adalah perpindahan paradigma dari <i class="text-gray-500">System of Record</i> (sekadar mencatat transaksi & stok) menjadi <i class="text-emerald-700 dark:text-emerald-400 font-medium">System of Intelligence</i> (menganalisis, menegur, menyarankan, dan bertindak).
        </p>
      </div>
      <div class="grid md:grid-cols-2 gap-4">
        <div class="bg-red-50 dark:bg-red-950/20 p-4 rounded-xl border border-red-100 dark:border-red-900/30">
          <h4 class="font-bold text-red-800 dark:text-red-300 mb-1 flex items-center gap-1.5">❌ Masalah Utama (The Root Pain)</h4>
          <p class="text-sm text-red-900/80 dark:text-red-200/80 leading-relaxed">
            Owner UMKM F&B tidak punya waktu untuk menganalisis laporan. Mereka tidak tahu apa yang bocor, siapa yang curang, atau mengapa cabang sepi sampai akhir bulan. <b>POS konvensional menyajikan data mati, bukan actionable insights.</b> Owner dipaksa menjadi analis data.
          </p>
        </div>
        <div class="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
          <h4 class="font-bold text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1.5">✅ Mengapa Produk Ini Layak Ada?</h4>
          <p class="text-sm text-emerald-900/80 dark:text-emerald-200/80 leading-relaxed">
            Karena UMKM F&B membakar uang dari <i>operational leaks</i> (kebocoran stok, fraud kasir, waste). Menyewa Store Manager berpengalaman untuk tiap cabang terlalu mahal (Rp 4-6jt/bulan). <b>StoreOS AI mendemokratisasi keahlian operasional F&B seharga lisensi SaaS (±Rp 250rb/bulan).</b>
          </p>
        </div>
      </div>
    </div>
  </section>
`;

const secMarket = () => `
  <section id="market" class="section-enter scroll-mt-6 mt-10">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2"><span class="text-emerald-600">2.</span> Market Opportunity</h2>
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 md:p-6 border border-gray-200 dark:border-gray-800 space-y-6">
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="p-3 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          <div class="text-[10px] text-gray-500 font-semibold uppercase mb-1">Pain Size</div>
          <div class="text-lg font-bold text-red-600 dark:text-red-400">Masif</div>
          <div class="text-[11px] text-gray-500 leading-tight mt-1">Kebocoran F&B rata-rata 5-8% dari Gross Revenue.</div>
        </div>
        <div class="p-3 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          <div class="text-[10px] text-gray-500 font-semibold uppercase mb-1">Frequency</div>
          <div class="text-lg font-bold">Harian</div>
          <div class="text-[11px] text-gray-500 leading-tight mt-1">Fraud, over-portion, dan out-of-stock terjadi setiap shift.</div>
        </div>
        <div class="p-3 border border-gray-200 dark:border-gray-800 rounded-xl bg-gray-50 dark:bg-gray-800/50">
          <div class="text-[10px] text-gray-500 font-semibold uppercase mb-1">TAM (Indonesia)</div>
          <div class="text-lg font-bold">± 1.2M</div>
          <div class="text-[11px] text-gray-500 leading-tight mt-1">Gerai F&B skala UMKM & Menengah.</div>
        </div>
        <div class="p-3 border border-emerald-200 dark:border-emerald-900/50 rounded-xl bg-emerald-50 dark:bg-emerald-950/20">
          <div class="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold uppercase mb-1">Willingness to Pay</div>
          <div class="text-lg font-bold text-emerald-700 dark:text-emerald-400">Tinggi</div>
          <div class="text-[11px] text-emerald-800/70 dark:text-emerald-200/60 leading-tight mt-1">Jika terbukti mencegah rugi Rp 1jt, bayar Rp 250rb adalah no-brainer.</div>
        </div>
      </div>

      <div>
        <h3 class="font-bold text-base mb-2">Bantahan Asumsi (YC Partner POV)</h3>
        <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed border-l-2 border-amber-400 pl-3 italic">
          "F&B adalah pasar kuburan SaaS. Churn ratenya mengerikan karena restorannya sering bangkrut."
        </p>
        <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mt-2">
          <b>Strategi Mitigasi:</b> Jangan targetkan warung tenda atau gerai baru buka (0-3 bulan). Targetkan <b>"Mid-Market UMKM"</b> (punya 2-10 cabang, sudah berjalan >1 tahun). Mereka sudah merasakan <i>pain</i> pendelegasian operasional. Mereka butuh kontrol, bukan sekadar mesin kasir murah.
        </p>
      </div>

    </div>
  </section>
`;

const secCompetitor = () => `
  <section id="competitor" class="section-enter scroll-mt-6 mt-10">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2"><span class="text-emerald-600">3.</span> Competitor Analysis</h2>
    <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div class="table-wrapper">
        <table class="strat-table">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th class="w-1/5">Pemain</th>
              <th class="w-1/4">Kelebihan</th>
              <th class="w-1/4">Kekurangan</th>
              <th class="w-auto">Celah yang Ditinggalkan (The Gap)</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr>
              <td class="font-semibold">Moka, Pawoon, Olsera</td>
              <td>Distribusi masif, integrasi payment lengkap, pricing perang harga.</td>
              <td>Fitur bloated, pelaporan pasif (harus ditarik & dibaca manual), lambat inovasi AI.</td>
              <td rowspan="3" class="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-100 p-4 border-l border-emerald-200 dark:border-emerald-800">
                <div class="font-bold text-emerald-700 dark:text-emerald-400 mb-2">Peluang StoreOS AI:</div>
                <ul class="list-disc list-inside space-y-1 text-xs">
                  <li>Kompetitor menjual <b>"Alat Pencatat"</b>. Anda menjual <b>"Alat Pengambil Keputusan"</b>.</li>
                  <li>Kompetitor memaksa owner log in web dashboard melihat grafik. StoreOS <b>mendorong alert ke WhatsApp</b>.</li>
                  <li>Kompetitor menunjukkan "HPP naik". StoreOS mengatakan "HPP susu naik 14% di shift Andi, cek CCTV 15:00, kemungkinan waste."</li>
                </ul>
              </td>
            </tr>
            <tr>
              <td class="font-semibold">Toast POS (US)</td>
              <td>Hardware vertikal terintegrasi, spesifik F&B, ekosistem kuat.</td>
              <td>Hardware-heavy, terlalu mahal untuk Indonesia, bukan AI-native.</td>
            </tr>
            <tr>
              <td class="font-semibold">Square, Shopify POS</td>
              <td>UI/UX kelas dunia, ekosistem e-commerce kuat.</td>
              <td>Lebih condong ke retail/e-com, fitur operasional F&B (resep/waste) lemah.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
`;

const secPain = () => `
  <section id="pain" class="section-enter scroll-mt-6 mt-10">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2"><span class="text-emerald-600">4.</span> Problem Validation (McKinsey Root-Cause)</h2>
    <div class="space-y-3">
      
      <!-- Persona: Owner -->
      <div class="bg-white dark:bg-gray-900 rounded-2xl p-4 md:p-5 border border-gray-200 dark:border-gray-800">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">👑</div>
          <h3 class="font-bold text-lg">Owner / Investor</h3>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <div class="text-[11px] text-gray-500 font-semibold uppercase mb-1">Pain Point & Skor</div>
            <div class="font-medium">Kebocoran Operasional (Fraud/Waste) tidak terdeteksi cepat.</div>
            <div class="mt-1 flex items-center gap-2">
              <span class="text-xs bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300 px-2 py-0.5 rounded font-bold">Pain: 9/10</span>
              <span class="text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 rounded">Rugi: Jutaan/bln</span>
            </div>
          </div>
          <div class="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
            <div class="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase mb-1">🤖 AI Solution</div>
            <div class="text-xs text-emerald-900 dark:text-emerald-100">Anomaly detection pada transaksi (void setelah struk keluar) & penggunaan bahan vs sales. Auto-alert ke WA Owner jika deviasi >5%.</div>
          </div>
        </div>
      </div>

      <!-- Persona: Manager -->
      <div class="bg-white dark:bg-gray-900 rounded-2xl p-4 md:p-5 border border-gray-200 dark:border-gray-800">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-lg">👔</div>
          <h3 class="font-bold text-lg">Store Manager / Supervisor</h3>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <div class="text-[11px] text-gray-500 font-semibold uppercase mb-1">Pain Point & Skor</div>
            <div class="font-medium">Manajemen Stok Reaktif (sering kehabisan bahan unggulan saat jam sibuk).</div>
            <div class="mt-1 flex items-center gap-2">
              <span class="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300 px-2 py-0.5 rounded font-bold">Pain: 7/10</span>
              <span class="text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 rounded">Rugi Omzet Hilang</span>
            </div>
          </div>
          <div class="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
            <div class="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase mb-1">🤖 AI Solution</div>
            <div class="text-xs text-emerald-900 dark:text-emerald-100">Predictive Restock. AI membaca velocity produk, lead time supplier, dan sisa stok fisik. Mengeluarkan draf PO sebelum stok menipis.</div>
          </div>
        </div>
      </div>

      <!-- Persona: Kasir -->
      <div class="bg-white dark:bg-gray-900 rounded-2xl p-4 md:p-5 border border-gray-200 dark:border-gray-800">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-8 h-8 rounded bg-gray-100 text-gray-600 flex items-center justify-center font-bold text-lg">🧾</div>
          <h3 class="font-bold text-lg">Kasir & Barista</h3>
        </div>
        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <div class="text-[11px] text-gray-500 font-semibold uppercase mb-1">Pain Point & Skor</div>
            <div class="font-medium">Kecepatan input & selisih kasir saat tutup shift (rekap manual).</div>
            <div class="mt-1 flex items-center gap-2">
              <span class="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300 px-2 py-0.5 rounded font-bold">Pain: 8/10</span>
              <span class="text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 rounded">Waktu: 1 jam/shift</span>
            </div>
          </div>
          <div class="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/30">
            <div class="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold uppercase mb-1">🤖 AI Solution</div>
            <div class="text-xs text-emerald-900 dark:text-emerald-100">Bukan AI, tapi UX kelas dunia. Smart checkout <3 klik. Rekonsiliasi digital otomatis (Qris/Transfer via API) menghilangkan hitung tunai manual.</div>
          </div>
        </div>
      </div>

    </div>
  </section>
`;

const secPosition = () => `
  <section id="position" class="section-enter scroll-mt-6 mt-10">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2"><span class="text-emerald-600">5.</span> Product Positioning</h2>
    <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 md:p-6 border border-gray-200 dark:border-gray-800">
      
      <div class="grid md:grid-cols-3 gap-6">
        <div>
          <div class="text-sm font-bold text-gray-400 line-through">POS (Point of Sale)</div>
          <p class="text-xs text-gray-500 mt-1">Terlalu sempit, red ocean, perang harga. Dianggap komoditas.</p>
        </div>
        <div>
          <div class="text-sm font-bold text-gray-400 line-through">Business OS</div>
          <p class="text-xs text-gray-500 mt-1">Terlalu abstrak. Terdengar seperti ERP (lambat, mahal, susah dipakai).</p>
        </div>
        <div class="relative">
          <div class="absolute -inset-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-500 z-0"></div>
          <div class="relative z-10 p-1">
            <div class="text-base font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              Digital Store Manager <span class="w-2 h-2 rounded-full bg-emerald-500 pulse-dot"></span>
            </div>
            <p class="text-xs text-emerald-900 dark:text-emerald-100 mt-1 font-medium">Ini adalah kategori baru. Anda tidak menjual software, Anda menjual <i class="italic">"Peace of Mind"</i>.</p>
          </div>
        </div>
      </div>

      <div class="mt-6 border-t border-gray-100 dark:border-gray-800 pt-5">
        <h3 class="font-bold text-sm mb-3">Tagline Strategy:</h3>
        <ul class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <li>❌ <i>"Aplikasi Kasir Terlengkap dengan AI"</i> (Boring, fokus pada fitur)</li>
          <li>✅ <b>"Hire Your Digital Store Manager. Cuma Rp 250rb/Bulan."</b> (Fokus pada ROI & Value)</li>
          <li>✅ <b>"Berhenti jadi Analis Data. Biar StoreOS yang Mengamankan Profit Anda."</b> (Menyerang pain point)</li>
        </ul>
      </div>

    </div>
  </section>
`;

const secValProp = () => `
  <section id="valprop" class="section-enter scroll-mt-6 mt-10">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2"><span class="text-emerald-600">6.</span> Value Proposition</h2>
    <div class="grid md:grid-cols-2 gap-4">
      
      <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold">Untuk Owner</h3>
          <span class="text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-500">The Buyer</span>
        </div>
        <ul class="space-y-3">
          <li class="flex items-start gap-2">
            <span class="text-emerald-500 mt-0.5">✔</span>
            <div>
              <div class="font-semibold text-sm">Anti-Leak System</div>
              <div class="text-xs text-gray-500 mt-0.5">Uang yang diselamatkan dari fraud/waste lebih besar dari harga langganan bulanan. (SaaS yang membayari dirinya sendiri).</div>
            </div>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-emerald-500 mt-0.5">✔</span>
            <div>
              <div class="font-semibold text-sm">Active Intelligence (WA)</div>
              <div class="text-xs text-gray-500 mt-0.5">Tidak perlu login dashboard tiap malam. Dapatkan ringkasan harian 3 poin terpenting langsung ke WhatsApp.</div>
            </div>
          </li>
        </ul>
      </div>

      <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold">Untuk Staf (Kasir/Keeper)</h3>
          <span class="text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-500">The User</span>
        </div>
        <ul class="space-y-3">
          <li class="flex items-start gap-2">
            <span class="text-emerald-500 mt-0.5">✔</span>
            <div>
              <div class="font-semibold text-sm">Zero-Training UX</div>
              <div class="text-xs text-gray-500 mt-0.5">Staf F&B punya turnover tinggi. UI POS harus bisa dikuasai barista baru dalam 5 menit tanpa buku panduan.</div>
            </div>
          </li>
          <li class="flex items-start gap-2">
            <span class="text-emerald-500 mt-0.5">✔</span>
            <div>
              <div class="font-semibold text-sm">Bebas Tuduhan</div>
              <div class="text-xs text-gray-500 mt-0.5">Pencatatan ketat dan rekonsiliasi otomatis membebaskan staf jujur dari tuduhan saat terjadi selisih stok fisik vs sistem.</div>
            </div>
          </li>
        </ul>
      </div>

    </div>
  </section>
`;

const secJTBD = () => `
  <section id="jtbd" class="section-enter scroll-mt-6 mt-10">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2"><span class="text-emerald-600">7.</span> Jobs To Be Done (JTBD)</h2>
    <div class="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div class="table-wrapper">
        <table class="strat-table">
          <thead class="bg-gray-50 dark:bg-gray-800/50 text-gray-500 border-b border-gray-200 dark:border-gray-800">
            <tr>
              <th class="w-1/4">Konteks (When...)</th>
              <th class="w-1/4">Kebutuhan (I want to...)</th>
              <th class="w-1/4">Motivasi (So I can...)</th>
              <th class="w-1/4">Solusi StoreOS</th>
            </tr>
          </thead>
          <tbody class="text-sm">
            <tr>
              <td class="text-gray-600 dark:text-gray-400 italic">"Saat saya sedang bersantai dengan keluarga di malam hari..."</td>
              <td class="font-medium">"...saya ingin tahu apakah gerai berjalan lancar tanpa masalah..."</td>
              <td class="font-medium text-emerald-600 dark:text-emerald-400">"...sehingga saya bisa tidur tenang dan fokus expansi besok."</td>
              <td><b>Daily WA Brief</b>. Ringkasan 3 poin, tanpa perlu buka laptop.</td>
            </tr>
            <tr>
              <td class="text-gray-600 dark:text-gray-400 italic">"Saat kasir melakukan void atau diskon manual..."</td>
              <td class="font-medium">"...saya ingin sistem mencatat alasan dan polanya..."</td>
              <td class="font-medium text-emerald-600 dark:text-emerald-400">"...sehingga staf tidak berani curang mengambil uang laci."</td>
              <td><b>Smart Audit Log</b> dengan Anomaly Alert.</td>
            </tr>
            <tr>
              <td class="text-gray-600 dark:text-gray-400 italic">"Saat persediaan bahan baku (susu, kopi) menipis..."</td>
              <td class="font-medium">"...saya ingin tahu persis kapan harus order ke supplier..."</td>
              <td class="font-medium text-emerald-600 dark:text-emerald-400">"...sehingga gerai tidak pernah kehabisan menu jagoan saat ramai."</td>
              <td><b>Predictive PO</b>. Draf otomatis sebelum stok habis.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
`;

const secPrinciples = () => `
  <section id="principles" class="section-enter scroll-mt-6 mt-10">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2"><span class="text-emerald-600">8.</span> Product Principles (DNA)</h2>
    <div class="grid md:grid-cols-2 gap-3">
      
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex gap-3">
        <div class="text-2xl font-black text-gray-200 dark:text-gray-800">1</div>
        <div>
          <div class="font-bold text-sm">Push, Not Pull</div>
          <p class="text-xs text-gray-500 mt-1">Jangan paksa owner menarik data (pull). Sistem harus menyodorkan insight penting ke mereka (push).</p>
        </div>
      </div>
      
      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex gap-3">
        <div class="text-2xl font-black text-gray-200 dark:text-gray-800">2</div>
        <div>
          <div class="font-bold text-sm">Actionable Rupiah</div>
          <p class="text-xs text-gray-500 mt-1">Semua alert AI harus dikonversi ke nominal Rupiah. Bukan "Waste naik 10%", tapi "Potensi rugi Rp 300rb".</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex gap-3">
        <div class="text-2xl font-black text-gray-200 dark:text-gray-800">3</div>
        <div>
          <div class="font-bold text-sm">Sub-second POS</div>
          <p class="text-xs text-gray-500 mt-1">Layar kasir tidak boleh lag. Checkout < 2 detik. Jika antrian panjang karena aplikasi lemot, produk ini mati.</p>
        </div>
      </div>

      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex gap-3">
        <div class="text-2xl font-black text-gray-200 dark:text-gray-800">4</div>
        <div>
          <div class="font-bold text-sm">Offline-First Resilience</div>
          <p class="text-xs text-gray-500 mt-1">Internet kafe sering mati. Kasir harus tetap bisa jualan offline. Sinkronisasi data ke cloud saat online kembali.</p>
        </div>
      </div>

    </div>
  </section>
`;

const secNorthStar = () => `
  <section id="northstar" class="section-enter scroll-mt-6 mt-10">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2"><span class="text-emerald-600">9.</span> North Star Metric</h2>
    <div class="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-center">
      <div class="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">Primary Metric</div>
      <div class="text-2xl md:text-3xl font-black text-emerald-800 dark:text-emerald-300 mb-3">Rp Diselamatkan / Rp Margin Diciptakan</div>
      <p class="text-sm text-emerald-900/80 dark:text-emerald-200/80 max-w-xl mx-auto leading-relaxed">
        Bukan jumlah MAU (Monthly Active Users), bukan jumlah transaksi diproses. Jika StoreOS AI bisa menyelamatkan Rp 2.000.000 per bulan untuk toko, mereka tidak akan pernah <i>churn</i> dari biaya langganan Rp 250.000.
      </p>
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 border-t border-emerald-200/50 dark:border-emerald-800/50 pt-6">
        <div>
          <div class="text-xl font-bold text-emerald-700 dark:text-emerald-400">TBD</div>
          <div class="text-[10px] uppercase text-emerald-600/70 dark:text-emerald-400/70 font-semibold mt-1">Alerts Actioned</div>
        </div>
        <div>
          <div class="text-xl font-bold text-emerald-700 dark:text-emerald-400">< 2s</div>
          <div class="text-[10px] uppercase text-emerald-600/70 dark:text-emerald-400/70 font-semibold mt-1">Avg Checkout Time</div>
        </div>
        <div>
          <div class="text-xl font-bold text-emerald-700 dark:text-emerald-400">< 3%</div>
          <div class="text-[10px] uppercase text-emerald-600/70 dark:text-emerald-400/70 font-semibold mt-1">Monthly Churn</div>
        </div>
        <div>
          <div class="text-xl font-bold text-emerald-700 dark:text-emerald-400">> 90%</div>
          <div class="text-[10px] uppercase text-emerald-600/70 dark:text-emerald-400/70 font-semibold mt-1">Shift Auto-Reconciled</div>
        </div>
      </div>
    </div>
  </section>
`;

const secRisks = () => `
  <section id="risks" class="section-enter scroll-mt-6 mt-10 mb-20">
    <h2 class="text-2xl font-bold mb-4 flex items-center gap-2"><span class="text-emerald-600">10.</span> Risiko & Prioritas Eksekusi</h2>
    <div class="grid md:grid-cols-2 gap-6">
      
      <div class="bg-red-50 dark:bg-red-950/10 rounded-2xl p-5 border border-red-100 dark:border-red-900/30">
        <h3 class="font-bold text-red-800 dark:text-red-400 mb-3 flex items-center gap-2">⚠️ Risiko Kematian (Death Threats)</h3>
        <ul class="space-y-3 text-sm text-red-900/80 dark:text-red-200/80">
          <li><b>Garbage In, Garbage Out:</b> AI tidak berguna jika kasir input asal-asalan. UX Kasir harus meminimalisir error (barcode, gambar besar, flow kaku).</li>
          <li><b>Alert Fatigue:</b> Jika AI mengirim 20 WA per hari yang tidak penting, owner akan mute bot-nya. Algoritma harus filter hanya anomali ber-value tinggi.</li>
          <li><b>Cost of Sales (CAC) Tinggi:</b> Jualan SaaS F&B <i>door-to-door</i> akan membakar runway. Harus pakai Product-Led Growth (PLG) atau channel partnership.</li>
        </ul>
      </div>

      <div class="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-gray-200 dark:border-gray-800">
        <h3 class="font-bold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">🎯 Prioritas V1 (MVP) vs V2</h3>
        <div class="space-y-4">
          <div>
            <div class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-1">Bangun Sekarang (V1)</div>
            <ul class="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
              <li>Core POS super cepat & stabil (Offline support)</li>
              <li>Basic Inventory (Resep & HPP)</li>
              <li>Daily Shift Summary & Anomaly Flagging (Fraud void)</li>
              <li>WhatsApp Daily Brief bot</li>
            </ul>
          </div>
          <div class="pt-3 border-t border-gray-100 dark:border-gray-800">
            <div class="text-xs font-bold text-gray-400 uppercase mb-1">Tunda Nanti (V2+)</div>
            <ul class="list-disc list-inside text-sm text-gray-500 line-through">
              <li>CRM & Loyalty Poin Pelanggan</li>
              <li>Integrasi Grab/Gojek API (mahal & kompleks di awal)</li>
              <li>Payroll & Absensi Staf</li>
              <li>Prediksi demand cuaca/event (over-engineering)</li>
            </ul>
          </div>
        </div>
      </div>

    </div>
  </section>
`;

const layout = `
  <div class="max-w-6xl mx-auto px-4 py-8 md:py-12 flex gap-8 relative items-start">
    ${renderMenu()}
    <main class="flex-1 min-w-0">
      <header class="mb-12 border-b border-gray-200 dark:border-gray-800 pb-8">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[10px] font-bold tracking-wider uppercase mb-4">
          Confidential Strategy Document
        </div>
        <h1 class="text-4xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white mb-4 leading-tight">
          StoreOS <span class="text-emerald-600 dark:text-emerald-400">AI</span><br>
          <span class="text-2xl md:text-3xl text-gray-500 font-medium">Business Discovery & Product Strategy</span>
        </h1>
        <p class="text-gray-600 dark:text-gray-400 text-base md:text-lg max-w-2xl">
          Analisis komprehensif dari perspektif Business Strategy, Venture Capital, Product Management, dan F&B Operations untuk membangun SaaS bernilai miliaran.
        </p>
      </header>

      ${secExec()}
      ${secMarket()}
      ${secCompetitor()}
      ${secPain()}
      ${secPosition()}
      ${secValProp()}
      ${secJTBD()}
      ${secPrinciples()}
      ${secNorthStar()}
      ${secRisks()}

    </main>
  </div>
`;

document.getElementById('app').innerHTML = layout;

// ScrollSpy setup for navigation
window.addEventListener('DOMContentLoaded', () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        document.querySelectorAll('.nav-item').forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id);
        });
      }
    });
  }, { rootMargin: '-20% 0px -80% 0px' });

  SECTIONS.forEach(s => {
    const el = document.getElementById(s.id);
    if(el) observer.observe(el);
  });
});

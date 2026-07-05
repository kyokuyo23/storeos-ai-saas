/* ============================================================
   StoreOS AI — Data Layer
   Simulated data for the SaaS prototype.
   ============================================================ */

const rp=n=>'Rp'+Math.round(n).toLocaleString('id-ID');
const rpK=n=>{if(n>=1e9)return'Rp'+(n/1e9).toFixed(1).replace('.0','')+'M';if(n>=1e6)return'Rp'+(n/1e6).toFixed(1).replace('.0','')+'jt';if(n>=1e3)return'Rp'+(n/1e3).toFixed(0)+'rb';return'Rp'+n};
const pct=(a,b)=>Math.round(a/b*100);

const BRAND="Kopi Nusantara";
const TODAY_STR="Minggu, 6 Juli 2026";
const NOW_H=new Date().getHours();
const GREETING=NOW_H<11?'Selamat pagi':NOW_H<15?'Selamat siang':NOW_H<18?'Selamat sore':'Selamat malam';

/* ---- BRANCHES ---- */
const branches=[
  {id:'kmg',name:'Kemang',addr:'Jl. Kemang Raya No.12',omzet:12_450_000,target:11_000_000,margin:62,trx:284,avg:43_800,leak:220_000,health:'good',staff:6,open:'08:00',close:'22:00',
   hourly:[0,0,0,0,0,0,0,0,820,1450,1680,1920,2100,1800,1550,1400,1780,2200,2650,2100,1600,980,0,0],
   topItems:[{n:'Kopi Susu Gula Aren',q:82,rev:1_804_000},{n:'Americano',q:58,rev:1_160_000},{n:'Croissant',q:45,rev:1_170_000},{n:'Matcha Latte',q:38,rev:1_064_000}]},
  {id:'bsd',name:'BSD City',addr:'Ruko BSD Junction Blok A5',omzet:9_820_000,target:10_500_000,margin:54,trx:221,avg:44_400,leak:1_180_000,health:'risk',staff:5,open:'09:00',close:'21:00',
   hourly:[0,0,0,0,0,0,0,0,0,680,1120,1380,1650,1420,1200,1080,1350,1680,1900,1560,1100,0,0,0],
   topItems:[{n:'Kopi Susu Gula Aren',q:64,rev:1_408_000},{n:'Cappuccino',q:42,rev:1_050_000},{n:'Roti Bakar',q:39,rev:780_000},{n:'Coklat',q:35,rev:840_000}]},
  {id:'pik',name:'PIK Avenue',addr:'PIK Avenue Mall Lt.1 Unit 15',omzet:15_200_000,target:14_000_000,margin:65,trx:342,avg:44_400,leak:85_000,health:'good',staff:8,open:'10:00',close:'22:00',
   hourly:[0,0,0,0,0,0,0,0,0,0,1200,1800,2400,2100,1900,1700,1850,2300,2800,2400,1800,1200,0,0],
   topItems:[{n:'Matcha Latte',q:92,rev:2_576_000},{n:'Kopi Susu Gula Aren',q:78,rev:1_716_000},{n:'Cappuccino',q:55,rev:1_375_000},{n:'Kentang Goreng',q:48,rev:1_056_000}]}
];

const totalOmzet=branches.reduce((a,b)=>a+b.omzet,0);
const totalTarget=branches.reduce((a,b)=>a+b.target,0);
const totalTrx=branches.reduce((a,b)=>a+b.trx,0);
const totalLeak=branches.reduce((a,b)=>a+b.leak,0);
const savedMonth=22_340_000;
const avgMargin=Math.round(branches.reduce((a,b)=>a+b.margin,0)/branches.length);

/* ---- MONTHLY TRENDS (8 months) ---- */
const trendMonths=['Des','Jan','Feb','Mar','Apr','Mei','Jun','Jul'];
const trendData={
  Kemang:[268,275,285,298,305,322,335,348],
  BSD:[240,248,252,244,258,262,250,268],
  PIK:[0,0,0,310,325,338,352,380],
  saved:[4.2,5.1,6.4,8.1,9.8,11.5,13.2,14.8]
};

/* ---- ALERTS ---- */
const alerts=[
  {id:1,sev:9,type:'Fraud',branch:'BSD City',title:'12 void mencurigakan setelah pembayaran tunai',
   detail:'Kasir Andi (shift sore) melakukan void pada 12 transaksi setelah struk tercetak & pembayaran tunai diterima. Pola ini sangat tidak normal — rata-rata harian hanya 1-2 void.',
   impact:820_000,action:'Cek rekaman CCTV shift 15:00–22:00. Konfirmasi ke supervisor. Jika terbukti, eskalasi ke HR.',time:'18 mnt lalu',ts:Date.now()-18*60000,status:'open'},
  {id:2,sev:8,type:'Waste',branch:'BSD City',title:'HPP susu naik 14% — tidak sesuai jumlah minuman terjual',
   detail:'Pemakaian susu 23L hari ini vs estimasi seharusnya 18L berdasarkan jumlah minuman. Selisih 5L tidak bisa dipertanggungjawabkan. Kemungkinan: over-portion, tumpah, atau dicuri.',
   impact:360_000,action:'Audit stok susu fisik vs sistem sekarang. Briefing barista soal SOP takaran.',time:'1 jam lalu',ts:Date.now()-60*60000,status:'open'},
  {id:3,sev:7,type:'Stok',branch:'Kemang',title:'Biji kopi house blend habis besok jam 11:00',
   detail:'Prediksi berbasis laju penjualan 3 hari terakhir: sisa stok 2.1kg, kebutuhan harian 3.2kg. Belum ada PO aktif ke supplier.',
   impact:1_100_000,action:'Buat PO ke supplier utama sekarang (lead time 1 hari kerja).',time:'3 jam lalu',ts:Date.now()-180*60000,status:'open'},
  {id:4,sev:6,type:'Kas',branch:'Kemang',title:'Selisih kas kecil Rp45.000 kurang — berulang 3 hari',
   detail:'Shift pagi konsisten kurang Rp40-50rb. Kemungkinan: lupa catat bon manual, kembalian salah hitung, atau pengambilan kecil berulang.',
   impact:135_000,action:'Ingatkan kasir prosedur hitung kas. Pasang mandatory cash count foto di awal & akhir shift.',time:'5 jam lalu',ts:Date.now()-300*60000,status:'open'},
  {id:5,sev:5,type:'Performa',branch:'PIK Avenue',title:'Waktu penyajian rata-rata naik 40% di jam 12-14',
   detail:'Antrian > 8 orang, serving time rata-rata 8.5 menit vs target 5 menit. 6 customer walk-out terdeteksi.',
   impact:480_000,action:'Tambah 1 barista untuk shift lunch atau buka counter express untuk menu simple.',time:'6 jam lalu',ts:Date.now()-360*60000,status:'open'},
  {id:6,sev:4,type:'Promo',branch:'Semua',title:'Promo "Beli 2 Gratis 1" Croissant — margin terlalu tipis',
   detail:'Promo aktif 3 hari, redemption rate 34%. Margin Croissant di promo ini hanya 8% (biasanya 55%). Potensi rugi jika lanjut 1 minggu.',
   impact:250_000,action:'Ubah ke "Beli 2 Diskon 30%" agar margin tetap >25%.',time:'1 hari lalu',ts:Date.now()-86400000,status:'open'}
];

/* ---- AI INSIGHTS ---- */
const insights=[
  {icon:'📈',title:'Tambah stok Kopi Susu di Kemang tiap Jumat–Minggu',
   detail:'Penjualan Kopi Susu naik 34% di akhir pekan tapi 4x kehabisan bulan lalu. Potensi omzet hilang terdeteksi.',
   value:'+Rp2,4jt/bln',tone:'up',confidence:92},
  {icon:'⏰',title:'Tambah 1 barista BSD pukul 16:00–19:00',
   detail:'Antrian jam sibuk membuat ±22 pelanggan batal order minggu ini. Cost 1 part-timer < revenue yang hilang.',
   value:'+Rp1,9jt/bln',tone:'up',confidence:87},
  {icon:'🎯',title:'Dorong menu margin tinggi di BSD',
   detail:'BSD di bawah target 6.5%. Avg transaksi sehat, tapi mix produk condong ke item margin rendah (Roti Bakar, Teh). Upsell Cappuccino & Matcha.',
   value:'+Rp1,2jt/bln',tone:'up',confidence:84},
  {icon:'🛑',title:'Standardisasi resep susu di semua cabang',
   detail:'Variasi HPP susu antar cabang 11%. Kemang pakai 180ml/gelas, BSD 210ml. PIK 175ml. Standardisasi ke 180ml.',
   value:'Hemat Rp1,5jt/bln',tone:'save',confidence:91},
  {icon:'📊',title:'PIK bisa jadi model cabang unggulan',
   detail:'PIK punya margin tertinggi (65%), leak terendah, dan growth tercepat. Duplikasi SOP PIK ke cabang lain.',
   value:'+Rp3,2jt/bln potensi',tone:'up',confidence:78},
  {icon:'💡',title:'Jam buka BSD mundur ke 08:00 (dari 09:00)',
   detail:'Area BSD punya traffic pagi (perkantoran). Kompetitor buka 07:30. Anda kehilangan breakfast market.',
   value:'+Rp800rb/bln',tone:'up',confidence:72}
];

/* ---- MENU (POS) ---- */
const menuItems=[
  {id:'m1',cat:'Kopi',name:'Kopi Susu Gula Aren',price:22000,cost:6800,emo:'☕',pop:true},
  {id:'m2',cat:'Kopi',name:'Americano',price:20000,cost:5200,emo:'☕',pop:false},
  {id:'m3',cat:'Kopi',name:'Cappuccino',price:25000,cost:7500,emo:'☕',pop:false},
  {id:'m4',cat:'Kopi',name:'Espresso',price:18000,cost:4800,emo:'☕',pop:false},
  {id:'m5',cat:'Kopi',name:'Latte',price:24000,cost:7200,emo:'☕',pop:false},
  {id:'m6',cat:'Kopi',name:'Mocha',price:27000,cost:8500,emo:'☕',pop:false},
  {id:'m7',cat:'Non-Kopi',name:'Matcha Latte',price:28000,cost:9000,emo:'🍵',pop:true},
  {id:'m8',cat:'Non-Kopi',name:'Coklat',price:24000,cost:7000,emo:'🍫',pop:false},
  {id:'m9',cat:'Non-Kopi',name:'Teh Lemon',price:18000,cost:4500,emo:'🍋',pop:false},
  {id:'m10',cat:'Non-Kopi',name:'Thai Tea',price:22000,cost:6000,emo:'🧋',pop:false},
  {id:'m11',cat:'Non-Kopi',name:'Taro Latte',price:26000,cost:8000,emo:'🟣',pop:false},
  {id:'m12',cat:'Makanan',name:'Croissant',price:26000,cost:11000,emo:'🥐',pop:true},
  {id:'m13',cat:'Makanan',name:'Roti Bakar',price:20000,cost:7000,emo:'🍞',pop:false},
  {id:'m14',cat:'Makanan',name:'Kentang Goreng',price:22000,cost:8000,emo:'🍟',pop:false},
  {id:'m15',cat:'Makanan',name:'Sandwich Club',price:32000,cost:12000,emo:'🥪',pop:false},
  {id:'m16',cat:'Makanan',name:'Pasta Aglio Olio',price:35000,cost:13000,emo:'🍝',pop:false},
];

/* ---- STOCK ---- */
const stockItems=[
  {name:'Biji Kopi House Blend',unit:'kg',qty:2.1,min:5,sys:2.4,supplier:'PT Toraja Kopi',lead:1,price_per:185000,expDays:null,use:'tinggi'},
  {name:'Susu Full Cream',unit:'L',qty:8,min:12,sys:11,supplier:'Greenfields',lead:1,price_per:18500,expDays:2,use:'tinggi'},
  {name:'Gula Aren Cair',unit:'L',qty:6,min:4,sys:6,supplier:'CV Aren Jaya',lead:2,price_per:45000,expDays:14,use:'sedang'},
  {name:'Bubuk Matcha',unit:'kg',qty:1.4,min:1,sys:1.4,supplier:'Import Jepang',lead:7,price_per:320000,expDays:60,use:'sedang'},
  {name:'Coklat Bubuk',unit:'kg',qty:0.8,min:1.5,sys:0.9,supplier:'Van Houten ID',lead:2,price_per:125000,expDays:45,use:'sedang'},
  {name:'Roti Croissant',unit:'pcs',qty:14,min:20,sys:14,supplier:'Bakery Partner',lead:0,price_per:8500,expDays:1,use:'tinggi'},
  {name:'Kentang Beku',unit:'kg',qty:9,min:6,sys:9,supplier:'McCain ID',lead:3,price_per:42000,expDays:90,use:'sedang'},
  {name:'Lemon Segar',unit:'kg',qty:1.2,min:2,sys:1.2,supplier:'Pasar Induk',lead:0,price_per:25000,expDays:4,use:'rendah'},
  {name:'Teh Earl Grey',unit:'box',qty:5,min:3,sys:5,supplier:'Twinings ID',lead:3,price_per:85000,expDays:180,use:'rendah'},
  {name:'Sirup Taro',unit:'L',qty:2.5,min:2,sys:2.5,supplier:'Monin ID',lead:5,price_per:95000,expDays:120,use:'rendah'},
];

/* ---- STAFF ---- */
const staff=[
  {id:'s1',name:'Rina Sari',role:'Kasir',branch:'Kemang',shift:'Pagi',rating:4.8,status:'active',joined:'2025-03',trx_today:142,avatar:'👩'},
  {id:'s2',name:'Andi Pratama',role:'Kasir',branch:'BSD City',shift:'Sore',rating:2.1,status:'flagged',joined:'2025-08',trx_today:98,avatar:'👨'},
  {id:'s3',name:'Dewi Lestari',role:'Barista',branch:'Kemang',shift:'Pagi',rating:4.5,status:'active',joined:'2025-01',trx_today:0,avatar:'👩‍🍳'},
  {id:'s4',name:'Budi Setiawan',role:'Store Keeper',branch:'Kemang',shift:'Full',rating:4.2,status:'active',joined:'2024-11',trx_today:0,avatar:'👨‍🔧'},
  {id:'s5',name:'Maya Putri',role:'Supervisor',branch:'BSD City',shift:'Full',rating:3.8,status:'active',joined:'2025-02',trx_today:0,avatar:'👩‍💼'},
  {id:'s6',name:'Rizky Aditya',role:'Barista',branch:'PIK Avenue',shift:'Pagi',rating:4.6,status:'active',joined:'2025-05',trx_today:0,avatar:'👨‍🍳'},
  {id:'s7',name:'Siti Aminah',role:'Kasir',branch:'PIK Avenue',shift:'Pagi',rating:4.7,status:'active',joined:'2025-04',trx_today:168,avatar:'👩'},
  {id:'s8',name:'Fajar Hidayat',role:'Kasir',branch:'PIK Avenue',shift:'Sore',rating:4.3,status:'active',joined:'2025-06',trx_today:174,avatar:'👨'},
];

/* ---- TRANSACTIONS (recent) ---- */
const recentTrx=[
  {id:'T001',time:'18:42',branch:'PIK Avenue',items:['Matcha Latte','Croissant'],total:54000,pay:'QRIS',kasir:'Siti Aminah'},
  {id:'T002',time:'18:38',branch:'Kemang',items:['Kopi Susu Gula Aren x2'],total:44000,pay:'Tunai',kasir:'Rina Sari'},
  {id:'T003',time:'18:35',branch:'BSD City',items:['Americano','Kentang Goreng'],total:42000,pay:'Kartu',kasir:'Andi Pratama'},
  {id:'T004',time:'18:31',branch:'PIK Avenue',items:['Cappuccino','Sandwich Club'],total:57000,pay:'QRIS',kasir:'Fajar Hidayat'},
  {id:'T005',time:'18:28',branch:'Kemang',items:['Latte','Roti Bakar'],total:44000,pay:'QRIS',kasir:'Rina Sari'},
  {id:'T006',time:'18:22',branch:'PIK Avenue',items:['Thai Tea x2','Croissant'],total:70000,pay:'Tunai',kasir:'Siti Aminah'},
  {id:'T007',time:'18:18',branch:'BSD City',items:['Mocha','Pasta Aglio Olio'],total:62000,pay:'QRIS',kasir:'Andi Pratama'},
  {id:'T008',time:'18:12',branch:'Kemang',items:['Espresso'],total:18000,pay:'Tunai',kasir:'Rina Sari'},
];

/* ---- P&L SUMMARY ---- */
const pnl={
  revenue:totalOmzet,
  cogs:Math.round(totalOmzet*(1-avgMargin/100)),
  gross_profit:Math.round(totalOmzet*avgMargin/100),
  opex:{rent:8_500_000,salary:18_200_000,utilities:2_400_000,marketing:1_500_000,misc:800_000},
};
pnl.total_opex=Object.values(pnl.opex).reduce((a,b)=>a+b,0);
pnl.net_profit=pnl.gross_profit-pnl.total_opex;

/* ---- SUBSCRIPTION ---- */
const subscription={plan:'Growth',price:249_000,stores:3,max_stores:5,period:'Bulanan',next_bill:'1 Agustus 2026',features:['3 Cabang','AI Alert & Insight','WhatsApp Daily Brief','Unlimited Staff','Priority Support']};

/* ---- HELPER FUNCTIONS ---- */
function stockStatus(s){
  if(s.qty<=s.min*0.4)return{k:'kritis',cls:'badge-danger',bg:'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40'};
  if(s.qty<s.min)return{k:'menipis',cls:'badge-warn',bg:'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40'};
  return{k:'aman',cls:'badge-ok',bg:'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40'};
}
function healthBadge(h){return h==='good'?'badge-ok':h==='warn'?'badge-warn':'badge-danger'}
function healthLabel(h){return h==='good'?'Sehat':h==='warn'?'Waspada':'Berisiko'}
function sevBadge(s){return s>=8?'badge-danger':s>=6?'badge-warn':'badge-info'}
function sevColor(s){return s>=8?'bg-red-500':s>=6?'bg-amber-500':'bg-yellow-400'}

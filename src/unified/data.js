/* StoreOS AI — Unified Data Layer */
const rp=n=>'Rp'+Math.round(n).toLocaleString('id-ID');
const rpK=n=>{if(n>=1e9)return'Rp'+(n/1e9).toFixed(1).replace('.0','')+'M';if(n>=1e6)return'Rp'+(n/1e6).toFixed(1).replace('.0','')+'jt';if(n>=1e3)return'Rp'+(n/1e3).toFixed(0)+'rb';return'Rp'+n};
const D=document.documentElement.classList.contains('dark');
const p=(l,d)=>D?d:l;
const COL={
  green:{t:p('#059669','#34d399'),bg:p('#ecfdf5','rgba(5,150,105,.1)'),bd:p('#a7f3d0','rgba(5,150,105,.2)')},
  amber:{t:p('#d97706','#fbbf24'),bg:p('#fffbeb','rgba(245,158,11,.1)'),bd:p('#fde68a','rgba(245,158,11,.2)')},
  red:{t:p('#dc2626','#f87171'),bg:p('#fef2f2','rgba(239,68,68,.1)'),bd:p('#fecaca','rgba(239,68,68,.2)')},
  blue:{t:p('#2563eb','#60a5fa'),bg:p('#eff6ff','rgba(37,99,235,.1)'),bd:p('#bfdbfe','rgba(37,99,235,.2)')},
  gray:{t:'rgba(120,120,120,.5)',bg:p('rgba(0,0,0,.03)','rgba(255,255,255,.03)'),bd:p('rgba(0,0,0,.06)','rgba(255,255,255,.06)')},
};

const BRAND="Kopi Nusantara";
const TODAY="Minggu, 6 Juli 2026";
const H=new Date().getHours();
const GREET=H<11?'Selamat pagi':H<15?'Selamat siang':H<18?'Selamat sore':'Selamat malam';

/* Branches */
const B=[
  {id:'kmg',name:'Kemang',rev:12_450_000,target:11_000_000,margin:62,trx:284,leak:220_000,health:88,trend:[85,82,84,86,85,87,88]},
  {id:'bsd',name:'BSD City',rev:9_820_000,target:10_500_000,margin:54,trx:221,leak:1_180_000,health:61,trend:[72,70,68,65,63,62,61]},
  {id:'pik',name:'PIK Avenue',rev:15_200_000,target:14_000_000,margin:65,trx:342,leak:85_000,health:94,trend:[88,89,90,91,92,93,94]},
];
const TOT_REV=B.reduce((a,b)=>a+b.rev,0);
const TOT_TGT=B.reduce((a,b)=>a+b.target,0);
const TOT_TRX=B.reduce((a,b)=>a+b.trx,0);
const TOT_LEAK=B.reduce((a,b)=>a+b.leak,0);
const SAVED=22_340_000;
const AVG_MARGIN=Math.round(B.reduce((a,b)=>a+b.margin,0)/B.length);
const HEALTH_SCORE=Math.round(B.reduce((a,b)=>a+b.health,0)/B.length);

/* Hourly revenue */
const HOURLY_ACT=[0,0,0,0,0,0,0,0,1520,3130,4200,5100,6150,5320,4650,4180,4980,6180,7350,6060,3500,1180,0,0];
const HOURLY_TGT=[0,0,0,0,0,0,0,0,1600,3000,4000,5000,5800,5200,4800,4400,5200,6000,7000,5800,3800,1400,0,0];
const CUM_ACT=HOURLY_ACT.reduce((a,v,i)=>{a.push((a[i-1]||0)+v);return a},[]);
const CUM_TGT=HOURLY_TGT.reduce((a,v,i)=>{a.push((a[i-1]||0)+v);return a},[]);

/* Alerts */
const ALERTS=[
  {id:1,sev:9,type:'Fraud',branch:'BSD City',title:'12 void mencurigakan setelah pembayaran',detail:'Kasir Andi melakukan void pada 12 transaksi setelah struk tercetak & pembayaran tunai diterima.',impact:820_000,action:'Cek CCTV shift 15:00–22:00. Konfirmasi ke supervisor.',time:'18 mnt',status:'open'},
  {id:2,sev:8,type:'Waste',branch:'BSD City',title:'HPP susu naik 14% — waste terdeteksi',detail:'Pemakaian susu 23L vs estimasi 18L berdasarkan penjualan. Selisih 5L tidak terjelaskan.',impact:360_000,action:'Audit stok susu fisik vs sistem. Briefing barista SOP takaran.',time:'1 jam',status:'open'},
  {id:3,sev:7,type:'Stok',branch:'Kemang',title:'Biji kopi habis besok jam 11:00',detail:'Sisa stok 2.1kg, kebutuhan harian 3.2kg. Belum ada PO aktif.',impact:1_100_000,action:'Buat PO ke supplier utama sekarang (lead time 1 hari).',time:'3 jam',status:'open'},
  {id:4,sev:5,type:'Promo',branch:'Semua',title:'Promo Croissant margin terlalu tipis',detail:'Promo aktif 3 hari, margin hanya 8% (biasanya 55%).',impact:250_000,action:'Ubah ke "Beli 2 Diskon 30%" agar margin >25%.',time:'1 hari',status:'open'},
];

/* Insights */
const INSIGHTS=[
  {icon:'📈',title:'Tambah stok Kopi Susu di Kemang tiap Jumat–Minggu',detail:'Penjualan naik 34% di akhir pekan tapi 4x kehabisan bulan lalu.',value:'+Rp2,4jt/bln',tone:'up',confidence:92},
  {icon:'⏰',title:'Tambah 1 barista BSD pukul 16:00–19:00',detail:'Antrian jam sibuk membuat ±22 pelanggan batal order minggu ini.',value:'+Rp1,9jt/bln',tone:'up',confidence:87},
  {icon:'🎯',title:'Dorong menu margin tinggi di BSD',detail:'BSD di bawah target 6.5%. Mix produk condong ke item margin rendah.',value:'+Rp1,2jt/bln',tone:'up',confidence:84},
  {icon:'🛑',title:'Standardisasi resep susu di semua cabang',detail:'Variasi HPP susu antar cabang 11%. Standardisasi ke 180ml.',value:'Hemat Rp1,5jt/bln',tone:'save',confidence:91},
];

/* Decisions */
const DECISIONS=[
  {id:1,urgency:'critical',title:'12 void mencurigakan di BSD',sub:'Kasir Andi — potensi loss Rp820rb',time:'18m',icon:'🚨'},
  {id:2,urgency:'high',title:'Stok kopi habis besok 11:00',sub:'Kemang — PO belum dibuat',time:'3h',icon:'📦'},
  {id:3,urgency:'medium',title:'Promo Croissant margin tipis',sub:'Semua cabang — margin 8%',time:'1d',icon:'📊'},
];

/* Timeline */
const TIMELINE=[
  {t:'19:12',type:'ok',msg:'PIK melewati target harian (+8.6%)'},
  {t:'18:42',type:'warn',msg:'BSD belum mencapai target — sisa 3 jam, kurang 6.5%'},
  {t:'17:30',type:'alert',msg:'AI mendeteksi 12 void anomali di BSD shift sore'},
  {t:'15:00',type:'ok',msg:'Kemang melewati target harian (+13.2%)'},
  {t:'12:15',type:'info',msg:'Peak hour — semua cabang online'},
  {t:'08:00',type:'info',msg:'Sistem buka — 3 cabang aktif, 19 staf on-shift'},
];

/* Brief */
const BRIEF=`*📊 Ringkasan Hari Ini*\n${BRAND} · ${TODAY}\n\n*Omzet:* ${rp(TOT_REV)} (${Math.round(TOT_REV/TOT_TGT*100)}% target)\n*Transaksi:* ${TOT_TRX} · Avg ${rpK(Math.round(TOT_REV/TOT_TRX))}\n\n*🏆 Terbaik:* PIK Avenue (${rpK(B[2].rev)})\n*⚠️ Perhatian:* BSD (di bawah target)\n\n*🚨 1 hal kritis:*\nVoid mencurigakan kasir Andi BSD — potensi loss ${rp(820_000)}\n\n*💰 AI menyelamatkan:* ${rp(SAVED)} bulan ini`;

/* Cash */
const CASH={bank:145_000_000,receivable:12_400_000,payable:8_200_000};

/* Week */
const WEEK_REV=[32_100_000,34_500_000,31_800_000,35_200_000,36_800_000,33_900_000,TOT_REV];
const WEEK_DAYS=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];

/* Menu (POS) */
const MENU=[
  {id:'m1',cat:'Kopi',name:'Kopi Susu Gula Aren',price:22000,emo:'☕',pop:true},
  {id:'m2',cat:'Kopi',name:'Americano',price:20000,emo:'☕'},
  {id:'m3',cat:'Kopi',name:'Cappuccino',price:25000,emo:'☕'},
  {id:'m4',cat:'Kopi',name:'Espresso',price:18000,emo:'☕'},
  {id:'m5',cat:'Kopi',name:'Latte',price:24000,emo:'☕'},
  {id:'m6',cat:'Non-Kopi',name:'Matcha Latte',price:28000,emo:'🍵',pop:true},
  {id:'m7',cat:'Non-Kopi',name:'Coklat',price:24000,emo:'🍫'},
  {id:'m8',cat:'Non-Kopi',name:'Teh Lemon',price:18000,emo:'🍋'},
  {id:'m9',cat:'Non-Kopi',name:'Thai Tea',price:22000,emo:'🧋'},
  {id:'m10',cat:'Makanan',name:'Croissant',price:26000,emo:'🥐',pop:true},
  {id:'m11',cat:'Makanan',name:'Roti Bakar',price:20000,emo:'🍞'},
  {id:'m12',cat:'Makanan',name:'Kentang Goreng',price:22000,emo:'🍟'},
];

/* Recipes */
const RECIPES=[
  {product:'Kopi Susu Gula Aren',items:[{ing:'i1',qty:0.018,unit:'kg'},{ing:'i2',qty:0.18,unit:'L'},{ing:'i3',qty:0.03,unit:'L'}]},
  {product:'Americano',items:[{ing:'i1',qty:0.018,unit:'kg'}]},
  {product:'Cappuccino',items:[{ing:'i1',qty:0.018,unit:'kg'},{ing:'i2',qty:0.18,unit:'L'}]},
  {product:'Matcha Latte',items:[{ing:'i4',qty:0.008,unit:'kg'},{ing:'i2',qty:0.2,unit:'L'}]},
  {product:'Coklat',items:[{ing:'i5',qty:0.025,unit:'kg'},{ing:'i2',qty:0.2,unit:'L'}]},
  {product:'Croissant',items:[{ing:'i6',qty:1,unit:'pcs'}]},
  {product:'Kentang Goreng',items:[{ing:'i7',qty:0.15,unit:'kg'}]},
];

/* Ingredients */
const ING=[
  {id:'i1',name:'Biji Kopi House Blend',cat:'coffee',unit:'kg',cost:185000,shelf:null,storage:'dry',qty_sys:2.1,qty_theo:2.4,min:5,reorder:7,supplier:'PT Toraja Kopi',lead:1,abc:'A'},
  {id:'i2',name:'Susu Full Cream',cat:'dairy',unit:'L',cost:18500,shelf:2,storage:'chiller',qty_sys:6.5,qty_theo:8.0,min:12,reorder:15,supplier:'Greenfields',lead:1,abc:'A'},
  {id:'i3',name:'Gula Aren Cair',cat:'sweetener',unit:'L',cost:45000,shelf:14,storage:'ambient',qty_sys:5.9,qty_theo:6.0,min:4,reorder:6,supplier:'CV Aren Jaya',lead:2,abc:'B'},
  {id:'i4',name:'Bubuk Matcha',cat:'powder',unit:'kg',cost:320000,shelf:60,storage:'dry',qty_sys:1.35,qty_theo:1.4,min:1,reorder:1.5,supplier:'Import Jepang',lead:7,abc:'B'},
  {id:'i5',name:'Coklat Bubuk',cat:'powder',unit:'kg',cost:125000,shelf:45,storage:'dry',qty_sys:0.75,qty_theo:0.8,min:1.5,reorder:2,supplier:'Van Houten ID',lead:2,abc:'B'},
  {id:'i6',name:'Roti Croissant',cat:'bakery',unit:'pcs',cost:8500,shelf:1,storage:'ambient',qty_sys:14,qty_theo:14,min:20,reorder:30,supplier:'Bakery Partner',lead:0,abc:'A'},
  {id:'i7',name:'Kentang Beku',cat:'frozen',unit:'kg',cost:42000,shelf:90,storage:'freezer',qty_sys:9,qty_theo:9,min:6,reorder:10,supplier:'McCain ID',lead:3,abc:'C'},
  {id:'i8',name:'Lemon Segar',cat:'fresh',unit:'kg',cost:25000,shelf:4,storage:'chiller',qty_sys:1.2,qty_theo:1.2,min:2,reorder:3,supplier:'Pasar Induk',lead:0,abc:'C'},
];

/* Ledger */
const LEDGER=[
  {ts:'19:12',type:'SALE',ing:'Susu Full Cream',qty:-0.18,ref:'Cappuccino #T-891',actor:'Rina'},
  {ts:'19:12',type:'SALE',ing:'Biji Kopi House Blend',qty:-0.018,ref:'Cappuccino #T-891',actor:'Rina'},
  {ts:'18:55',type:'WASTE',ing:'Susu Full Cream',qty:-0.5,ref:'Tumpah di barista station',actor:'Dewi'},
  {ts:'18:30',type:'SALE',ing:'Roti Croissant',qty:-1,ref:'Croissant #T-885',actor:'Rina'},
  {ts:'15:00',type:'OPNAME',ing:'Susu Full Cream',qty:-1.5,ref:'Adj: Fisik 6.5L vs Sys 8.0L',actor:'Budi'},
  {ts:'08:15',type:'RECEIVE',ing:'Roti Croissant',qty:30,ref:'PO-0042 Bakery Partner',actor:'Budi'},
];

/* POs */
const POS_LIST=[
  {id:'PO-0043',supplier:'PT Toraja Kopi',items:[{name:'Biji Kopi House Blend',qty:5,unit:'kg',cost:185000}],status:'draft',auto:true,total:925000,eta:'8 Jul'},
  {id:'PO-0044',supplier:'Greenfields',items:[{name:'Susu Full Cream',qty:12,unit:'L',cost:18500}],status:'draft',auto:true,total:222000,eta:'8 Jul'},
  {id:'PO-0042',supplier:'Bakery Partner',items:[{name:'Roti Croissant',qty:30,unit:'pcs',cost:8500}],status:'received',auto:false,total:255000,eta:'-'},
];

/* Variance */
const VARIANCE=ING.map(i=>{
  const diff=i.qty_sys-i.qty_theo;
  const pct=i.qty_theo?Math.round(Math.abs(diff)/i.qty_theo*100):0;
  const loss=Math.abs(diff)*i.cost;
  const status=pct>10?'anomali':pct>5?'watch':'normal';
  return{...i,diff,pct,loss,vstatus:status};
});

/* Opname */
const OPNAME_TODAY=[
  {ing:ING[0],done:false},{ing:ING[1],done:true,fisik:6.5},{ing:ING[5],done:false},
];

function ingStatus(i){
  if(i.qty_sys<=i.min*0.4)return{k:'Kritis',c:COL.red};
  if(i.qty_sys<i.min)return{k:'Rendah',c:COL.amber};
  return{k:'Aman',c:COL.green};
}
function sevBadge(s){return s>=8?COL.red:s>=6?COL.amber:COL.blue}
function sevColor(s){return s>=8?'#ef4444':s>=6?'#f59e0b':'#3b82f6'}

/* StoreOS AI — CEO Dashboard Data Layer */
const rp=n=>'Rp'+Math.round(n).toLocaleString('id-ID');
const rpK=n=>{if(n>=1e9)return'Rp'+(n/1e9).toFixed(1).replace('.0','')+'M';if(n>=1e6)return'Rp'+(n/1e6).toFixed(1).replace('.0','')+'jt';if(n>=1e3)return'Rp'+(n/1e3).toFixed(0)+'rb';return'Rp'+n};

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

/* Hourly revenue (simulated, 0-23) */
const HOURLY_ACT=[0,0,0,0,0,0,0,0,1520,3130,4200,5100,6150,5320,4650,4180,4980,6180,7350,6060,3500,1180,0,0];
const HOURLY_TGT=[0,0,0,0,0,0,0,0,1600,3000,4000,5000,5800,5200,4800,4400,5200,6000,7000,5800,3800,1400,0,0];
const CUM_ACT=HOURLY_ACT.reduce((a,v,i)=>{a.push((a[i-1]||0)+v);return a},[]);
const CUM_TGT=HOURLY_TGT.reduce((a,v,i)=>{a.push((a[i-1]||0)+v);return a},[]);

/* Decisions queue */
const DECISIONS=[
  {id:1,urgency:'critical',title:'12 void mencurigakan di BSD',sub:'Kasir Andi — potensi loss Rp820rb',time:'18m',icon:'🚨'},
  {id:2,urgency:'high',title:'Stok kopi habis besok 11:00',sub:'Kemang — PO belum dibuat',time:'3h',icon:'📦'},
  {id:3,urgency:'medium',title:'Promo Croissant margin terlalu tipis',sub:'Semua cabang — margin hanya 8%',time:'1d',icon:'📊'},
];

/* Timeline events */
const TIMELINE=[
  {t:'19:12',type:'ok',msg:'PIK melewati target harian (+8.6%)'},
  {t:'18:42',type:'warn',msg:'BSD belum mencapai target — sisa 3 jam, kurang 6.5%'},
  {t:'17:30',type:'alert',msg:'AI mendeteksi 12 void anomali di BSD shift sore'},
  {t:'15:00',type:'ok',msg:'Kemang melewati target harian (+13.2%)'},
  {t:'12:15',type:'info',msg:'Peak hour dimulai — semua cabang online'},
  {t:'08:00',type:'info',msg:'Sistem buka — 3 cabang aktif, 19 staf on-shift'},
];

/* Daily brief */
const BRIEF=`*📊 Ringkasan Hari Ini*\n${BRAND} · ${TODAY}\n\n*Omzet:* ${rp(TOT_REV)} (${Math.round(TOT_REV/TOT_TGT*100)}% target)\n*Transaksi:* ${TOT_TRX} · Avg ${rpK(Math.round(TOT_REV/TOT_TRX))}\n\n*🏆 Terbaik:* PIK Avenue (${rpK(B[2].rev)})\n*⚠️ Perhatian:* BSD (di bawah target)\n\n*🚨 1 hal kritis:*\nVoid mencurigakan kasir Andi BSD — potensi loss ${rp(820_000)}\n\n*💰 AI menyelamatkan:* ${rp(SAVED)} bulan ini`;

/* Cash position */
const CASH={bank:145_000_000,receivable:12_400_000,payable:8_200_000};

/* Week comparison */
const WEEK_REV=[32_100_000,34_500_000,31_800_000,35_200_000,36_800_000,33_900_000,TOT_REV];
const WEEK_DAYS=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];

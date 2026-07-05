/* StoreOS AI — Inventory Engine Data */
const rp=n=>'Rp'+Math.round(n).toLocaleString('id-ID');
const rpK=n=>{if(n>=1e6)return'Rp'+(n/1e6).toFixed(1).replace('.0','')+'jt';if(n>=1e3)return'Rp'+(n/1e3).toFixed(0)+'rb';return'Rp'+n};
const D=document.documentElement.classList.contains('dark');
const p=(l,d)=>D?d:l;

const COL={
  green:{t:p('#059669','#34d399'),bg:p('#ecfdf5','rgba(5,150,105,.1)'),bd:p('#a7f3d0','rgba(5,150,105,.2)')},
  amber:{t:p('#d97706','#fbbf24'),bg:p('#fffbeb','rgba(245,158,11,.1)'),bd:p('#fde68a','rgba(245,158,11,.2)')},
  red:{t:p('#dc2626','#f87171'),bg:p('#fef2f2','rgba(239,68,68,.1)'),bd:p('#fecaca','rgba(239,68,68,.2)')},
  blue:{t:p('#2563eb','#60a5fa'),bg:p('#eff6ff','rgba(37,99,235,.1)'),bd:p('#bfdbfe','rgba(37,99,235,.2)')},
  gray:{t:'rgba(120,120,120,.5)',bg:p('rgba(0,0,0,.03)','rgba(255,255,255,.03)'),bd:p('rgba(0,0,0,.06)','rgba(255,255,255,.06)')},
};

/* Ingredients */
const ING=[
  {id:'i1',name:'Biji Kopi House Blend',cat:'coffee',unit:'kg',cost:185000,shelf:null,storage:'dry',
   qty_sys:2.1,qty_theo:2.4,min:5,reorder:7,supplier:'PT Toraja Kopi',lead:1,abc:'A'},
  {id:'i2',name:'Susu Full Cream',cat:'dairy',unit:'L',cost:18500,shelf:2,storage:'chiller',
   qty_sys:6.5,qty_theo:8.0,min:12,reorder:15,supplier:'Greenfields',lead:1,abc:'A'},
  {id:'i3',name:'Gula Aren Cair',cat:'sweetener',unit:'L',cost:45000,shelf:14,storage:'ambient',
   qty_sys:5.9,qty_theo:6.0,min:4,reorder:6,supplier:'CV Aren Jaya',lead:2,abc:'B'},
  {id:'i4',name:'Bubuk Matcha',cat:'powder',unit:'kg',cost:320000,shelf:60,storage:'dry',
   qty_sys:1.35,qty_theo:1.4,min:1,reorder:1.5,supplier:'Import Jepang',lead:7,abc:'B'},
  {id:'i5',name:'Coklat Bubuk',cat:'powder',unit:'kg',cost:125000,shelf:45,storage:'dry',
   qty_sys:0.75,qty_theo:0.8,min:1.5,reorder:2,supplier:'Van Houten ID',lead:2,abc:'B'},
  {id:'i6',name:'Roti Croissant',cat:'bakery',unit:'pcs',cost:8500,shelf:1,storage:'ambient',
   qty_sys:14,qty_theo:14,min:20,reorder:30,supplier:'Bakery Partner',lead:0,abc:'A'},
  {id:'i7',name:'Kentang Beku',cat:'frozen',unit:'kg',cost:42000,shelf:90,storage:'freezer',
   qty_sys:9,qty_theo:9,min:6,reorder:10,supplier:'McCain ID',lead:3,abc:'C'},
  {id:'i8',name:'Lemon Segar',cat:'fresh',unit:'kg',cost:25000,shelf:4,storage:'chiller',
   qty_sys:1.2,qty_theo:1.2,min:2,reorder:3,supplier:'Pasar Induk',lead:0,abc:'C'},
  {id:'i9',name:'Sirup Taro',cat:'syrup',unit:'L',cost:95000,shelf:120,storage:'ambient',
   qty_sys:2.5,qty_theo:2.5,min:2,reorder:3,supplier:'Monin ID',lead:5,abc:'C'},
  {id:'i10',name:'Teh Earl Grey',cat:'tea',unit:'box',cost:85000,shelf:180,storage:'dry',
   qty_sys:5,qty_theo:5,min:3,reorder:4,supplier:'Twinings ID',lead:3,abc:'C'},
];

/* Recipes (BOM) */
const RECIPES=[
  {product:'Kopi Susu Gula Aren',items:[{ing:'i1',qty:0.018,unit:'kg'},{ing:'i2',qty:0.18,unit:'L'},{ing:'i3',qty:0.03,unit:'L'}]},
  {product:'Americano',items:[{ing:'i1',qty:0.018,unit:'kg'}]},
  {product:'Cappuccino',items:[{ing:'i1',qty:0.018,unit:'kg'},{ing:'i2',qty:0.18,unit:'L'}]},
  {product:'Matcha Latte',items:[{ing:'i4',qty:0.008,unit:'kg'},{ing:'i2',qty:0.2,unit:'L'}]},
  {product:'Coklat',items:[{ing:'i5',qty:0.025,unit:'kg'},{ing:'i2',qty:0.2,unit:'L'}]},
  {product:'Teh Lemon',items:[{ing:'i10',qty:0.01,unit:'box'},{ing:'i8',qty:0.05,unit:'kg'}]},
  {product:'Croissant',items:[{ing:'i6',qty:1,unit:'pcs'}]},
  {product:'Kentang Goreng',items:[{ing:'i7',qty:0.15,unit:'kg'}]},
];

/* Ledger (recent) */
const LEDGER=[
  {ts:'19:12',type:'SALE',ing:'Susu Full Cream',qty:-0.18,ref:'Cappuccino #T-891',actor:'Rina'},
  {ts:'19:12',type:'SALE',ing:'Biji Kopi House Blend',qty:-0.018,ref:'Cappuccino #T-891',actor:'Rina'},
  {ts:'19:08',type:'SALE',ing:'Susu Full Cream',qty:-0.2,ref:'Matcha Latte #T-890',actor:'Rina'},
  {ts:'19:08',type:'SALE',ing:'Bubuk Matcha',qty:-0.008,ref:'Matcha Latte #T-890',actor:'Rina'},
  {ts:'18:55',type:'WASTE',ing:'Susu Full Cream',qty:-0.5,ref:'Tumpah di barista station',actor:'Dewi'},
  {ts:'18:30',type:'SALE',ing:'Roti Croissant',qty:-1,ref:'Croissant #T-885',actor:'Rina'},
  {ts:'15:00',type:'OPNAME',ing:'Susu Full Cream',qty:-1.5,ref:'Adj: Fisik 6.5L vs Sys 8.0L',actor:'Budi'},
  {ts:'08:15',type:'RECEIVE',ing:'Roti Croissant',qty:30,ref:'PO-0042 Bakery Partner',actor:'Budi'},
  {ts:'08:10',type:'RECEIVE',ing:'Kentang Beku',qty:5,ref:'PO-0041 McCain ID',actor:'Budi'},
];

/* POs */
const POS_LIST=[
  {id:'PO-0043',supplier:'PT Toraja Kopi',items:[{name:'Biji Kopi House Blend',qty:5,unit:'kg',cost:185000}],status:'draft',auto:true,total:925000,eta:'8 Jul'},
  {id:'PO-0044',supplier:'Greenfields',items:[{name:'Susu Full Cream',qty:12,unit:'L',cost:18500}],status:'draft',auto:true,total:222000,eta:'8 Jul'},
  {id:'PO-0042',supplier:'Bakery Partner',items:[{name:'Roti Croissant',qty:30,unit:'pcs',cost:8500}],status:'received',auto:false,total:255000,eta:'-'},
  {id:'PO-0041',supplier:'McCain ID',items:[{name:'Kentang Beku',qty:5,unit:'kg',cost:42000}],status:'received',auto:false,total:210000,eta:'-'},
];

/* Variance data */
const VARIANCE=ING.map(i=>{
  const diff=i.qty_sys-i.qty_theo;
  const pct=i.qty_theo?Math.round(Math.abs(diff)/i.qty_theo*100):0;
  const loss=Math.abs(diff)*i.cost;
  const status=pct>10?'anomali':pct>5?'watch':'normal';
  return {...i,diff,pct,loss,vstatus:status};
});

/* Opname schedule */
const OPNAME_TODAY=[
  {ing:ING[0],done:false},{ing:ING[1],done:true,fisik:6.5},{ing:ING[5],done:false},
];

function ingStatus(i){
  if(i.qty_sys<=i.min*0.4)return{k:'Kritis',c:COL.red};
  if(i.qty_sys<i.min)return{k:'Rendah',c:COL.amber};
  return{k:'Aman',c:COL.green};
}

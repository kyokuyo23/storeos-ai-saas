export type MovementType = "Purchase" | "Sale" | "Waste" | "Adjustment" | "Stock Opname";
export type PaymentMethod = "Cash" | "QRIS" | "Transfer" | "Debit" | "Other";
export type AlertSeverity = "critical" | "warning" | "info";

export type BusinessProfile = {
  name: string;
  location: string;
  currency: string;
};

export type Ingredient = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  minStock: number;
  averageCost: number;
};

export type RecipeItem = {
  ingredientId: string;
  quantity: number;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  sellingPrice: number;
  cogs: number;
  stock: number;
  minimumStock: number;
  unit: string;
  status: "Aktif" | "Nonaktif";
  soldToday: number;
  recipe: RecipeItem[];
};

export type StockMovement = {
  id: string;
  ingredientId: string;
  type: MovementType;
  quantity: number;
  note: string;
  createdAt: string;
};

export type SaleItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discount: number;
};

export type SaleTransaction = {
  id: string;
  createdAt: string;
  paymentMethod: PaymentMethod;
  items: SaleItem[];
  total: number;
  grossProfit: number;
  status: "completed" | "void";
};

export type DailyMetric = {
  date: string;
  revenue: number;
  transactions: number;
  grossProfit: number;
};

export type AuditEvent = {
  id: string;
  action: string;
  createdAt: string;
  detail: string;
};

export type StoreData = {
  business: BusinessProfile;
  categories: string[];
  ingredients: Ingredient[];
  products: Product[];
  movements: StockMovement[];
  transactions: SaleTransaction[];
  dailyMetrics: DailyMetric[];
  auditEvents: AuditEvent[];
  voidPotential: number;
};

export type SavingsBreakdown = {
  waste: number;
  variance: number;
  anomaly: number;
  purchasing: number;
  total: number;
};

export type InventoryVariance = Ingredient & {
  theoreticalUsage: number;
  actualUsage: number;
  variance: number;
  varianceValue: number;
  status: "Sehat" | "Perlu perhatian" | "Kritis";
};

export type StoreAlert = {
  id: string;
  severity: AlertSeverity;
  category: "Stok" | "Varians" | "Transaksi" | "Waste";
  title: string;
  description: string;
  impact: number;
  action: string;
};

const dayKey = (offset: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString();
};

const atTime = (hours: number, minutes: number) => {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

export const formatRupiah = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));

export const formatQuantity = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(value);

export const createDemoData = (): StoreData => {
  const dailyMetrics = Array.from({ length: 30 }, (_, index) => {
    const revenuePattern = [0, 120000, -80000, 210000, 95000, -135000, 160000][index % 7];
    const revenue = 3650000 + revenuePattern + index * 12000;
    const transactions = 105 + ((index * 7) % 19);
    const margin = 0.405 + ((index % 4) * 0.006);
    return {
      date: dayKey(index - 29),
      revenue,
      transactions,
      grossProfit: Math.round(revenue * margin),
    };
  });

  dailyMetrics[dailyMetrics.length - 1] = {
    date: dayKey(0),
    revenue: 4280000,
    transactions: 128,
    grossProfit: 1820000,
  };

  return {
    business: {
      name: "Kopi Nusantara",
      location: "Cibitung Bekasi",
      currency: "IDR (Rp)",
    },
    categories: ["Kopi", "Non-kopi", "Makanan", "Pastry", "Minuman"],
    ingredients: [
      { id: "milk", name: "Susu UHT", unit: "L", currentStock: 35, minStock: 15, averageCost: 22000 },
      { id: "coffee", name: "Biji Kopi Arabika", unit: "kg", currentStock: 4.2, minStock: 2, averageCost: 140000 },
      { id: "sugar", name: "Gula Aren", unit: "L", currentStock: 11, minStock: 5, averageCost: 28000 },
      { id: "cup", name: "Cup 16 oz", unit: "pcs", currentStock: 87, minStock: 100, averageCost: 800 },
      { id: "ice", name: "Es Batu", unit: "kg", currentStock: 18, minStock: 10, averageCost: 3500 },
      { id: "matcha", name: "Bubuk Matcha", unit: "kg", currentStock: 0.8, minStock: 0.5, averageCost: 320000 },
      { id: "chicken", name: "Ayam Fillet", unit: "kg", currentStock: 5.4, minStock: 6, averageCost: 36000 },
      { id: "rice", name: "Beras", unit: "kg", currentStock: 14, minStock: 10, averageCost: 15000 },
      { id: "tea", name: "Teh Melati", unit: "kg", currentStock: 1.6, minStock: 1, averageCost: 90000 },
      { id: "croissant", name: "Croissant Butter", unit: "pcs", currentStock: 26, minStock: 20, averageCost: 8000 },
    ],
    products: [
      { id: "es-kopi-susu", name: "Es Kopi Susu", category: "Kopi", sellingPrice: 18000, cogs: 8500, stock: 42, minimumStock: 12, unit: "gelas", status: "Aktif", soldToday: 60, recipe: [{ ingredientId: "coffee", quantity: 0.018 }, { ingredientId: "milk", quantity: 0.12 }, { ingredientId: "sugar", quantity: 0.025 }, { ingredientId: "cup", quantity: 1 }, { ingredientId: "ice", quantity: 0.15 }] },
      { id: "americano", name: "Americano", category: "Kopi", sellingPrice: 15000, cogs: 5500, stock: 35, minimumStock: 10, unit: "gelas", status: "Aktif", soldToday: 32, recipe: [{ ingredientId: "coffee", quantity: 0.018 }, { ingredientId: "cup", quantity: 1 }, { ingredientId: "ice", quantity: 0.12 }] },
      { id: "matcha-latte", name: "Matcha Latte", category: "Non-kopi", sellingPrice: 24000, cogs: 11000, stock: 20, minimumStock: 8, unit: "gelas", status: "Aktif", soldToday: 18, recipe: [{ ingredientId: "matcha", quantity: 0.025 }, { ingredientId: "milk", quantity: 0.16 }, { ingredientId: "cup", quantity: 1 }, { ingredientId: "ice", quantity: 0.15 }] },
      { id: "nasi-ayam", name: "Nasi Ayam Sambal Matah", category: "Makanan", sellingPrice: 32000, cogs: 15000, stock: 11, minimumStock: 10, unit: "porsi", status: "Aktif", soldToday: 31, recipe: [{ ingredientId: "chicken", quantity: 0.14 }, { ingredientId: "rice", quantity: 0.18 }] },
      { id: "croissant", name: "Croissant Butter", category: "Pastry", sellingPrice: 18000, cogs: 8000, stock: 26, minimumStock: 12, unit: "pcs", status: "Aktif", soldToday: 39, recipe: [{ ingredientId: "croissant", quantity: 1 }] },
      { id: "iced-tea", name: "Iced Tea", category: "Minuman", sellingPrice: 8000, cogs: 1800, stock: 57, minimumStock: 18, unit: "gelas", status: "Aktif", soldToday: 74, recipe: [{ ingredientId: "tea", quantity: 0.01 }, { ingredientId: "sugar", quantity: 0.02 }, { ingredientId: "cup", quantity: 1 }, { ingredientId: "ice", quantity: 0.12 }] },
    ],
    movements: [
      { id: "mv-1", ingredientId: "milk", type: "Sale", quantity: 14, note: "Pemakaian tercatat hari ini", createdAt: atTime(19, 30) },
      { id: "mv-2", ingredientId: "coffee", type: "Sale", quantity: 2.326, note: "Pemakaian tercatat hari ini", createdAt: atTime(19, 30) },
      { id: "mv-3", ingredientId: "chicken", type: "Sale", quantity: 4.34, note: "Pemakaian dari penjualan", createdAt: atTime(19, 30) },
      { id: "mv-4", ingredientId: "milk", type: "Waste", quantity: 6, note: "Susu kedaluwarsa pada shift pagi", createdAt: atTime(8, 15) },
      { id: "mv-5", ingredientId: "chicken", type: "Waste", quantity: 3, note: "Produk rusak saat penyimpanan", createdAt: atTime(11, 45) },
      { id: "mv-6", ingredientId: "cup", type: "Purchase", quantity: 200, note: "Pembelian kemasan mingguan", createdAt: dayKey(-2) },
      { id: "mv-7", ingredientId: "chicken", type: "Adjustment", quantity: 1.2, note: "Koreksi penerimaan supplier", createdAt: dayKey(-1) },
    ],
    transactions: [
      { id: "TRX-1007", createdAt: atTime(20, 18), paymentMethod: "QRIS", items: [{ productId: "es-kopi-susu", productName: "Es Kopi Susu", quantity: 2, unitPrice: 18000, unitCost: 8500, discount: 0 }], total: 36000, grossProfit: 19000, status: "completed" },
      { id: "TRX-1006", createdAt: atTime(19, 54), paymentMethod: "Cash", items: [{ productId: "nasi-ayam", productName: "Nasi Ayam Sambal Matah", quantity: 1, unitPrice: 32000, unitCost: 15000, discount: 0 }, { productId: "iced-tea", productName: "Iced Tea", quantity: 1, unitPrice: 8000, unitCost: 1800, discount: 0 }], total: 40000, grossProfit: 23200, status: "completed" },
      { id: "TRX-1005", createdAt: atTime(19, 21), paymentMethod: "Debit", items: [{ productId: "matcha-latte", productName: "Matcha Latte", quantity: 1, unitPrice: 24000, unitCost: 11000, discount: 0 }], total: 24000, grossProfit: 13000, status: "completed" },
      { id: "TRX-1004", createdAt: atTime(18, 46), paymentMethod: "Cash", items: [{ productId: "croissant", productName: "Croissant Butter", quantity: 2, unitPrice: 18000, unitCost: 8000, discount: 3000 }], total: 33000, grossProfit: 17000, status: "completed" },
    ],
    dailyMetrics,
    auditEvents: [
      { id: "audit-1", action: "Waste recorded", detail: "3 kg Ayam Fillet dicatat sebagai waste", createdAt: atTime(11, 45) },
      { id: "audit-2", action: "Inventory adjusted", detail: "Koreksi penerimaan Ayam Fillet sebesar 1,2 kg", createdAt: dayKey(-1) },
    ],
    voidPotential: 160000,
  };
};

export const getTodayMetric = (data: StoreData) => data.dailyMetrics[data.dailyMetrics.length - 1];

export const getPeriodMetrics = (data: StoreData, period: "today" | "7d" | "30d") => {
  if (period === "today") return data.dailyMetrics.slice(-1);
  return data.dailyMetrics.slice(period === "7d" ? -7 : -30);
};

export const getProductMetrics = (data: StoreData) =>
  data.products.map((product) => ({
    ...product,
    revenue: product.soldToday * product.sellingPrice,
    grossProfit: product.soldToday * (product.sellingPrice - product.cogs),
    margin: product.sellingPrice > 0 ? ((product.sellingPrice - product.cogs) / product.sellingPrice) * 100 : 0,
  }));

export const getInventoryVariance = (data: StoreData): InventoryVariance[] => {
  const theoretical = new Map<string, number>();
  data.products.forEach((product) => {
    product.recipe.forEach((item) => {
      theoretical.set(item.ingredientId, (theoretical.get(item.ingredientId) ?? 0) + item.quantity * product.soldToday);
    });
  });

  const actual = new Map<string, number>();
  data.movements.filter((movement) => movement.type === "Sale").forEach((movement) => {
    actual.set(movement.ingredientId, (actual.get(movement.ingredientId) ?? 0) + movement.quantity);
  });

  return data.ingredients.map((ingredient) => {
    const theoreticalUsage = theoretical.get(ingredient.id) ?? 0;
    const actualUsage = actual.get(ingredient.id) ?? theoreticalUsage;
    const variance = actualUsage - theoreticalUsage;
    const variancePercentage = theoreticalUsage > 0 ? variance / theoreticalUsage : 0;
    return {
      ...ingredient,
      theoreticalUsage,
      actualUsage,
      variance,
      varianceValue: Math.max(0, variance * ingredient.averageCost),
      status: variancePercentage > 0.12 ? "Kritis" : variancePercentage > 0.05 ? "Perlu perhatian" : "Sehat",
    };
  });
};

export const calculateSavings = (data: StoreData): SavingsBreakdown => {
  const waste = data.movements
    .filter((movement) => movement.type === "Waste")
    .reduce((total, movement) => total + movement.quantity * (data.ingredients.find((item) => item.id === movement.ingredientId)?.averageCost ?? 0), 0);
  const variance = getInventoryVariance(data).reduce((total, item) => total + item.varianceValue, 0);
  const purchasing = data.ingredients.some((item) => item.currentStock <= item.minStock) ? 100000 : 0;
  const anomaly = data.voidPotential;
  return { waste, variance, anomaly, purchasing, total: waste + variance + anomaly + purchasing };
};

export const getStoreHealth = (data: StoreData) => {
  const today = getTodayMetric(data);
  const averageSevenDays = getPeriodMetrics(data, "7d").reduce((total, item) => total + item.revenue, 0) / 7;
  const margin = today.revenue > 0 ? (today.grossProfit / today.revenue) * 100 : 0;
  const variance = getInventoryVariance(data);
  const lowStock = data.ingredients.filter((item) => item.currentStock <= item.minStock).length;
  const sales = Math.min(100, Math.round(86 + ((today.revenue - averageSevenDays) / averageSevenDays) * 50));
  const marginScore = Math.min(100, Math.max(0, Math.round(margin * 2)));
  const inventory = Math.max(0, 100 - lowStock * 18 - variance.filter((item) => item.status === "Kritis").length * 7);
  const waste = Math.max(0, 100 - Math.round(calculateSavings(data).waste / 8500));
  const operations = Math.max(0, 100 - Math.round(data.voidPotential / 13333));
  const score = Math.round((sales + marginScore + inventory + waste + operations) / 5);
  return { score, sales, margin: marginScore, inventory, waste, operations };
};

export const getAlerts = (data: StoreData): StoreAlert[] => {
  const lowStock = data.ingredients.filter((item) => item.currentStock <= item.minStock);
  const variance = getInventoryVariance(data).filter((item) => item.status !== "Sehat");
  const alerts: StoreAlert[] = lowStock.map((item) => ({
    id: `stock-${item.id}`,
    severity: item.currentStock <= item.minStock ? "critical" : "warning",
    category: "Stok",
    title: `Stok ${item.name} berada di bawah batas minimum`,
    description: `Sisa ${formatQuantity(item.currentStock)} ${item.unit}; batas minimum ${formatQuantity(item.minStock)} ${item.unit}.`,
    impact: item.averageCost * Math.max(0, item.minStock - item.currentStock),
    action: `Buat pembelian ${item.name} hari ini.`,
  }));

  variance.forEach((item) => {
    const percentage = item.theoreticalUsage > 0 ? Math.round((item.variance / item.theoreticalUsage) * 100) : 0;
    alerts.push({
      id: `variance-${item.id}`,
      severity: item.status === "Kritis" ? "critical" : "warning",
      category: "Varians",
      title: `Pemakaian ${item.name} ${percentage}% di atas theoretical usage`,
      description: `Teoritis ${formatQuantity(item.theoreticalUsage)} ${item.unit}, tercatat ${formatQuantity(item.actualUsage)} ${item.unit}.`,
      impact: item.varianceValue,
      action: `Lakukan stock opname dan tinjau penggunaan ${item.name}.`,
    });
  });

  if (data.voidPotential > 0) {
    alerts.push({
      id: "transaction-void",
      severity: "warning",
      category: "Transaksi",
      title: "Void transaksi meningkat pada jam 20:00–22:00",
      description: "Empat void tercatat pada shift malam; pola ini lebih tinggi dari batas operasional demo.",
      impact: data.voidPotential,
      action: "Tinjau transaksi dan catatan shift malam.",
    });
  }

  const waste = calculateSavings(data).waste;
  if (waste > 0) {
    alerts.push({
      id: "waste-detected",
      severity: "critical",
      category: "Waste",
      title: "Waste bahan baku terdeteksi hari ini",
      description: "Waste tercatat dari susu UHT dan ayam fillet pada data operasional hari ini.",
      impact: waste,
      action: "Validasi penyimpanan bahan dan prosedur persiapan.",
    });
  }
  return alerts.sort((left, right) => right.impact - left.impact);
};

export const buildMorningBrief = (data: StoreData) => {
  const today = getTodayMetric(data);
  const average = getPeriodMetrics(data, "7d").slice(0, -1).reduce((total, item) => total + item.revenue, 0) / 6;
  const change = average > 0 ? ((today.revenue - average) / average) * 100 : 0;
  const alerts = getAlerts(data).slice(0, 3);
  const savings = calculateSavings(data);
  return {
    summary: `Omzet hari ini ${formatRupiah(today.revenue)}, ${change >= 0 ? "naik" : "turun"} ${Math.abs(change).toFixed(1)}% dibanding rata-rata 7 hari.`,
    alerts,
    impact: savings.waste + savings.variance + savings.anomaly,
    recommendations: alerts.map((alert) => alert.action),
  };
};

export const answerStoreQuestion = (data: StoreData, question: string) => {
  const query = question.toLocaleLowerCase("id-ID");
  const today = getTodayMetric(data);
  const products = getProductMetrics(data);
  const savings = calculateSavings(data);
  const lowStock = data.ingredients.filter((item) => item.currentStock <= item.minStock);
  if (/(omzet|penjualan|turun|naik)/.test(query)) {
    const average = getPeriodMetrics(data, "7d").slice(0, -1).reduce((total, item) => total + item.revenue, 0) / 6;
    const change = ((today.revenue - average) / average) * 100;
    return `Omzet hari ini **${formatRupiah(today.revenue)}** dari **${today.transactions} transaksi**. Dibanding rata-rata 7 hari sebesar ${formatRupiah(average)}, hasilnya ${change >= 0 ? "naik" : "turun"} **${Math.abs(change).toFixed(1)}%**.`;
  }
  if (/(untung|profit|margin)/.test(query)) {
    const product = [...products].sort((left, right) => right.grossProfit - left.grossProfit)[0];
    return `Produk dengan gross profit tertinggi hari ini adalah **${product.name}**: ${formatRupiah(product.grossProfit)} dari ${product.soldToday} unit. Gross margin-nya **${product.margin.toFixed(1)}%**.`;
  }
  if (/(laris|banyak terjual|terjual)/.test(query)) {
    const product = [...products].sort((left, right) => right.soldToday - left.soldToday)[0];
    return `Produk yang paling banyak terjual adalah **${product.name}** dengan **${product.soldToday} ${product.unit}**. Kontribusi omzetnya ${formatRupiah(product.revenue)}.`;
  }
  if (/(stok|beli|purchase)/.test(query)) {
    if (!lowStock.length) return "Tidak ada bahan di bawah batas minimum saat ini. Tetap pantau penggunaan susu dan cup karena mendekati ambang operasional.";
    return `Prioritas pembelian hari ini adalah ${lowStock.map((item) => `**${item.name}** (sisa ${formatQuantity(item.currentStock)} ${item.unit}, minimum ${formatQuantity(item.minStock)} ${item.unit})`).join(" dan ")}.`;
  }
  if (/(waste|boros|pemborosan|kerugian|loss|varians)/.test(query)) {
    const criticalVariance = getInventoryVariance(data).filter((item) => item.status === "Kritis");
    return `Potensi biaya yang perlu ditindaklanjuti adalah **${formatRupiah(savings.total)}**: waste ${formatRupiah(savings.waste)}, varians pemakaian ${formatRupiah(savings.variance)}, dan anomali transaksi ${formatRupiah(savings.anomaly)}. ${criticalVariance.length ? `Varians tertinggi ada pada **${criticalVariance[0].name}**.` : ""}`;
  }
  const health = getStoreHealth(data);
  return `Kondisi **${data.business.name}** saat ini memiliki Store Health Score **${health.score}/100**. Omzet hari ini ${formatRupiah(today.revenue)} dan terdapat ${getAlerts(data).length} alert operasional. Coba tanyakan tentang omzet, produk terlaris, profit, stok, atau waste.`;
};

export const csvForReport = (data: StoreData, kind: "sales" | "inventory" | "waste") => {
  if (kind === "sales") {
    const rows = getProductMetrics(data).map((item) => [item.name, item.category, item.soldToday, item.revenue, item.grossProfit, item.margin.toFixed(1)]);
    return ["Produk,Kategori,Unit Terjual,Omzet,Gross Profit,Margin (%)", ...rows.map((row) => row.join(","))].join("\n");
  }
  if (kind === "inventory") {
    const rows = getInventoryVariance(data).map((item) => [item.name, item.currentStock, item.unit, item.minStock, item.averageCost, item.status]);
    return ["Bahan,Stok Saat Ini,Unit,Stok Minimum,Rata-rata Biaya,Status", ...rows.map((row) => row.join(","))].join("\n");
  }
  const rows = data.movements.filter((item) => item.type === "Waste").map((item) => {
    const ingredient = data.ingredients.find((entry) => entry.id === item.ingredientId);
    return [ingredient?.name ?? "-", item.quantity, ingredient?.unit ?? "", (ingredient?.averageCost ?? 0) * item.quantity, item.note];
  });
  return ["Bahan,Jumlah,Unit,Nilai Waste,Keterangan", ...rows.map((row) => row.join(","))].join("\n");
};

export type CheckoutLine = {
  product: Product;
  quantity: number;
  discount: number;
};

export const applyCompletedSale = (
  current: StoreData,
  lines: CheckoutLine[],
  paymentMethod: PaymentMethod,
  id: string,
  createdAt: string,
) => {
  const total = lines.reduce((sum, line) => sum + Math.max(0, line.product.sellingPrice * line.quantity - line.discount), 0);
  const grossProfit = lines.reduce((sum, line) => sum + Math.max(0, (line.product.sellingPrice - line.product.cogs) * line.quantity - line.discount), 0);
  const sale: SaleTransaction = {
    id,
    createdAt,
    paymentMethod,
    items: lines.map((line) => ({ productId: line.product.id, productName: line.product.name, quantity: line.quantity, unitPrice: line.product.sellingPrice, unitCost: line.product.cogs, discount: line.discount })),
    total,
    grossProfit,
    status: "completed",
  };
  const ingredientUse = new Map<string, number>();
  lines.forEach((line) => line.product.recipe.forEach((recipe) => ingredientUse.set(recipe.ingredientId, (ingredientUse.get(recipe.ingredientId) ?? 0) + recipe.quantity * line.quantity)));
  const todayIndex = current.dailyMetrics.length - 1;
  const nextData: StoreData = {
    ...current,
    products: current.products.map((product) => {
      const line = lines.find((entry) => entry.product.id === product.id);
      return line ? { ...product, stock: Math.max(0, product.stock - line.quantity), soldToday: product.soldToday + line.quantity } : product;
    }),
    ingredients: current.ingredients.map((ingredient) => ({ ...ingredient, currentStock: Math.max(0, ingredient.currentStock - (ingredientUse.get(ingredient.id) ?? 0)) })),
    movements: [
      ...Array.from(ingredientUse.entries()).map(([ingredientId, quantity]) => ({ id: `${id}-${ingredientId}`, ingredientId, type: "Sale" as const, quantity, note: `POS ${id}`, createdAt })),
      ...current.movements,
    ],
    transactions: [sale, ...current.transactions],
    dailyMetrics: current.dailyMetrics.map((metric, index) => index === todayIndex ? { ...metric, revenue: metric.revenue + total, transactions: metric.transactions + 1, grossProfit: metric.grossProfit + grossProfit } : metric),
    auditEvents: [{ id: `${id}-audit`, action: "POS checkout", detail: `${id} completed via ${paymentMethod}`, createdAt }, ...current.auditEvents],
  };
  return { data: nextData, receipt: { id, total, grossProfit } };
};

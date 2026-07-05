# StoreOS AI — Digital Store Manager

<p align="center">
  <img src="https://img.shields.io/badge/Status-Prototype-emerald?style=for-the-badge" alt="Status">
  <img src="https://img.shields.io/badge/Stack-HTML%20%7C%20TailwindCSS%20%7C%20Vanilla%20JS-blue?style=for-the-badge" alt="Stack">
  <img src="https://img.shields.io/badge/Tests-32%2F32%20Passed-brightgreen?style=for-the-badge" alt="Tests">
</p>

## Apa itu StoreOS AI?

**StoreOS AI bukan POS biasa.** StoreOS AI adalah **Digital Store Manager berbasis AI** yang membantu owner UMKM F&B mengelola operasional bisnis secara real-time — mendeteksi fraud kasir, mencegah waste bahan baku, dan menyodorkan insight langsung ke WhatsApp owner.

> *"Hire Your Digital Store Manager. Cuma Rp 250rb/Bulan."*

## 🎯 Problem Statement

Owner UMKM F&B kehilangan **5-8% gross revenue** setiap bulan dari kebocoran operasional (fraud kasir, over-portion, waste) tanpa menyadarinya. POS konvensional hanya mencatat transaksi — tidak menganalisis, tidak menegur, tidak menyarankan.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│                  Frontend                    │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │  POS (Kasir) │  │  Owner Dashboard     │ │
│  │  React Native│  │  Next.js + Tailwind  │ │
│  │  Offline-1st │  │  Real-time WebSocket │ │
│  └──────┬───────┘  └──────────┬───────────┘ │
│         │ Sync                │ REST/WS     │
├─────────┴─────────────────────┴─────────────┤
│                 Backend                      │
│  ┌────────┐ ┌─────────┐ ┌────────────────┐ │
│  │NestJS/ │ │ Redis + │ │  AI Pipeline   │ │
│  │  Go    │ │ BullMQ  │ │ Heuristics+LLM │ │
│  └────┬───┘ └─────────┘ └────────────────┘ │
├───────┴─────────────────────────────────────┤
│  PostgreSQL │ Redis Cache │ S3 Storage      │
└─────────────────────────────────────────────┘
```

## 🚀 Quick Start (Prototype)

```bash
# Clone repository
git clone https://github.com/kyokuyo23/storeos-ai-saas.git
cd storeos-ai-saas

# Buka langsung di browser (tanpa install)
open src/index.html
# atau
npx serve src/
```

## 📁 Project Structure

```
storeos-ai-saas/
├── src/
│   ├── index.html      # Entry point
│   ├── styles.css       # UI styles (Tailwind)
│   ├── data.js          # Simulated data layer
│   └── app.js           # Application logic & views
├── tests/
│   └── test_suite.py    # Playwright E2E tests (32 tests)
├── docs/
│   └── STRATEGY.md      # Business strategy document
├── .gitignore
├── LICENSE
└── README.md
```

## ✅ Features (Prototype)

| Module | Status | Description |
|--------|--------|-------------|
| **Owner Dashboard** | ✅ Done | KPI cards, 8-month trend chart, live branch monitoring |
| **Alert Center** | ✅ Done | Fraud detection, waste alerts, severity levels, AI recommendations |
| **AI Insights** | ✅ Done | 6 actionable insights with confidence scores & impact values |
| **POS (Kasir)** | ✅ Done | Menu browsing, cart, tax calculation, checkout flow |
| **Role Switching** | ✅ Done | Owner, Kasir, Store Keeper |
| **Mobile Responsive** | ✅ Done | Sidebar, hamburger menu, touch-friendly |
| **Dark Mode** | ✅ Done | Auto-detect OS preference |
| Inventory Management | 🔜 V2 | Stock tracking, opname, purchase orders |
| Staff Management | 🔜 V2 | Performance tracking, shift scheduling |
| WhatsApp Bot | 🔜 V2 | Daily brief integration |
| Financial Reports | 🔜 V2 | P&L, export PDF/Excel |

## 🧪 Testing

```bash
# Install Playwright
pip install playwright
python -m playwright install chromium

# Run tests
cd tests
python test_suite.py
```

**Result: 32/32 tests passed ✅**

## 🛠️ Tech Stack (Production Roadmap)

| Layer | Technology | Why |
|-------|-----------|-----|
| POS Client | React Native + WatermelonDB | Offline-first, cross-platform |
| Owner Dashboard | Next.js + Tailwind + Shadcn UI | Fast dev, SSR, great DX |
| Backend API | NestJS or Go | Scalable, typed |
| Database | PostgreSQL | Multi-tenant, ACID compliant |
| Cache & Queue | Redis + BullMQ | Real-time + background jobs |
| AI Pipeline | Python + OpenAI API | Anomaly detection + LLM summaries |
| WhatsApp | Meta WABA / Baileys | Daily owner briefs |
| Infra | Docker + Railway/AWS | Easy deploy, ID region |

## 📊 North Star Metric

> **Rp Diselamatkan / Rp Margin Diciptakan per Store per Bulan**

Bukan MAU, bukan jumlah transaksi. Jika StoreOS menyelamatkan Rp 2jt/bulan, owner tidak akan pernah churn dari langganan Rp 250rb.

## 📄 License

MIT License — lihat file [LICENSE](LICENSE).

---

<p align="center">
  <b>StoreOS AI</b> — Berhenti jadi Analis Data. Biar StoreOS yang Mengamankan Profit Anda.
</p>

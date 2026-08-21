# Technical Design Document (TECH.md): StoreOS Phase 2.1 — Management Monthly Reporting

**Author:** Manus AI  
**Project:** StoreOS AI ('Kopi Nusantara', Cibitung Bekasi)  
**Status:** Design Ready (Phase 2.1)  

---

## 1. Architecture & Data Flow

StoreOS Phase 2.1 reuses existing Drizzle ORM schemas (`drizzle/schema.ts`) and query helpers (`server/db.ts`). No new database tables or columns are required because monthly management reports are synthesized dynamically from the immutable transaction ledger and stock movement history.

```
[UI: Reports / Monthly Summary] 
       │ (tRPC query with Jakarta month bounds)
       ▼
[Server Router: reports.monthlySummary]
       ├─► [Financial Core Helpers (Revenue, COGS, Reversals)]
       └─► [Inventory Intelligence & Variance Tolerance Engine]
```

---

## 2. API & Procedure Specifications

### `reports.monthlySummary` (tRPC Procedure)
- **Input Schema**:
  ```ts
  z.object({
    year: z.number().int().min(2020).max(2100),
    month: z.number().int().min(1).max(12),
  })
  ```
- **Output Schema**: Returns a unified object containing `financials`, `inventoryIntelligence`, `periodMeta`, and `auditNotes`.

---

## 3. Error Handling & Edge Cases
- **Empty Periods**: If zero sales or stock movements occur in a month, financial metrics return `0` and inventory metrics reflect opening balances with zero variance, avoiding NaN or null reference exceptions.
- **Timezone Drift**: All boundary computations strictly utilize Jakarta offset helpers, preventing UTC leakage.

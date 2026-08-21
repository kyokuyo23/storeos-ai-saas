# Acceptance Test Plan (ACCEPTANCE.md): StoreOS Phase 2.1 — Management Monthly Reporting

**Author:** Manus AI  
**Project:** StoreOS AI ('Kopi Nusantara', Cibitung Bekasi)  
**Status:** Design Ready (Phase 2.1)  

---

## 1. Acceptance Scenarios

### Scenario 1: Completed Month Financial & Inventory Reconciliation
- **Given** a completed calendar month (e.g., July 2026) with recorded sales, voids, purchases, and stock opnames.
- **When** the manager opens the Monthly Management Report for July 2026.
- **Then** gross sales, net revenue, COGS, and gross margin match the Financial Core report for the exact same date range, and inventory variance counts match the Variance Tolerance Engine.

### Scenario 2: Empty Month Handling
- **Given** a future or inactive month with zero transactions and zero stock movements.
- **When** the manager selects that month.
- **Then** the report gracefully displays zero values and informative empty states without throwing errors.

### Scenario 3: Export Integrity (CSV & PDF)
- **Given** a populated monthly report with custom audit notes.
- **When** the manager clicks "Unduh CSV" or "Unduh PDF".
- **Then** a correctly formatted file is downloaded containing all summary KPIs, timestamp metadata, and audit notes.

---

## 2. Test Suite Requirements
- Unit tests in `server/monthlyReports.test.ts` (proposed) must verify boundary calculations, financial aggregation, and inventory synthesis across boundary conditions.

# Software Requirements Specification (SRS): StoreOS Phase 2.1 — Management Monthly Reporting

**Author:** Manus AI  
**Project:** StoreOS AI ('Kopi Nusantara', Cibitung Bekasi)  
**Status:** Design Ready (Phase 2.1)  

---

## 1. System Overview & Architecture Compliance

StoreOS Phase 2.1 builds directly upon the validated StoreOS MVP architecture. It utilizes the tRPC 11 contract-first procedure pattern, connecting React 19 frontend components to robust Express/Drizzle backend procedures backed by MySQL/TiDB. The system maintains strict separation between immutable transactional records (sales, sale lines, stock movements, opname sessions) and analytical read models.

---

## 2. Functional Requirements & Data Contracts

### 2.1 Monthly Period Boundary Calculation
The system shall calculate Jakarta/WIB calendar month boundaries deterministically. For any given year $Y$ and month $M$ (1-12):
- **Start Timestamp (UTC)**: Jakarta local time $Y-M-01\ 00:00:00.000$ converted to UTC epoch milliseconds.
- **End Timestamp (UTC)**: Jakarta local time $Y-M-\text{lastDay}\ 23:59:59.999$ converted to UTC epoch milliseconds.

### 2.2 Financial Aggregation Service (`reports.monthlyFinancial`)
The backend shall aggregate completed sales, refunds, voids, and exchanges within the specified Jakarta/WIB month boundary:
- **Gross Sales**: Sum of all non-reversed sale items (quantity $\times$ unit price).
- **Net Revenue**: Gross Sales minus total refund values and net exchange adjustments.
- **COGS**: Sum of recipe-based ingredient costs snapshot at sale completion, adjusted for partial refunds and voids.
- **Gross Profit**: Net Revenue minus COGS.
- **Gross Margin (%)**: $(\text{Gross Profit} / \text{Net Revenue}) \times 100$ (with zero-division protection yielding $0\%$).

### 2.3 Inventory Intelligence Aggregation (`reports.monthlyInventory`)
The backend shall synthesize inventory data across the selected month:
- **Expected vs Actual Closing Stock**: Calculated using opening balances plus purchases, adjustments, and opnames, minus recipe consumption and waste.
- **Tolerance Classification**: Evaluated using global tolerance and per-ingredient overrides following the larger-applicable-limit rule.
- **Recurring High Variance**: Evaluated across the 3 most recent comparable Jakarta/WIB periods, flagging ingredients out of tolerance in $\ge 2$ of 3 periods.

---

## 3. Non-Functional Requirements

### 3.1 Performance & Read-Only Integrity
- Monthly report queries must execute within 300ms against indexed ledger tables.
- All analytical procedures must be read-only (`query` procedures), guaranteeing zero database mutations.

### 3.2 Localization & Formatting
- All currency values must be formatted in Indonesian Rupiah (IDR) using `id-ID` formatting rules.
- All dates and time ranges must display in Jakarta/WIB (`Asia/Jakarta`).

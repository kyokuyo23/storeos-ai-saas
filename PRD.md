# Product Requirements Document (PRD): StoreOS Phase 2.1 — Management Monthly Reporting

**Author:** Manus AI  
**Project:** StoreOS AI ('Kopi Nusantara', Cibitung Bekasi)  
**Status:** Design Ready (Phase 2.1)  

---

## 1. Executive Summary & Objective

StoreOS Phase 2.1 introduces **Management Monthly Reporting**, providing store management and regional leadership with a unified, monthly executive summary that combines authoritative financial metrics and inventory intelligence. The feature aggregates existing persisted ledger data (sales, recipe-based COGS, inventory movements, stock opnames, and variance tolerance checks) across calendar months using strict **Jakarta/WIB (`Asia/Jakarta`)** time boundaries.

The primary objective is to eliminate manual aggregation errors by presenting a read-only, exportable monthly report card directly inside the existing Reports and Dashboard modules without introducing duplicate data models or altering transactional integrity.

---

## 2. Scope & Boundaries

### In Scope
- **Unified Monthly Summary**: Aggregating financial KPIs and inventory intelligence for any selected completed or current calendar month (Asia/Jakarta timezone).
- **Financial Metrics**: Gross Sales, Net Revenue, COGS, Gross Profit, Gross Margin (%), Sales Transaction Count, Refund Value, Void Value, and Exchange Financial Impact.
- **Inventory Metrics**: Opening Stock Value, Closing Stock Value, Expected Closing Stock, Actual Closing Stock, Total Variance Quantity/Value, Out-of-Tolerance Item Count, High-Value Variance Count, Recurring High-Variance Ingredient Count, Opname Session Count, and Open Opname Follow-up Count.
- **Export Capabilities**: CSV and PDF export generation adhering to existing report export standards and custom audit notes.
- **Read-Only Guarantee**: Strict adherence to the read-only analytics invariant—no inventory or financial mutations are permitted during report generation.

### Out of Scope (Strictly Prohibited in Phase 2.1)
- Automated email delivery or push notifications.
- Multi-store tenancy or multi-location aggregation.
- Authentication or Role-Based Access Control (RBAC) expansions.
- AI/LLM narrative generation.
- Quarterly or multi-year comparative analytics (scoped strictly to single calendar months).

---

## 3. User Stories & Functional Requirements

### FR-1: Monthly Calendar Period Selection
*As a store manager, I want to select a specific calendar month (e.g., August 2026) so that I can review that month's performance independently of daily or weekly noise.*
- **Acceptance Criteria**:
  - The UI provides a month picker defaulting to the current Jakarta/WIB month.
  - Selecting a month automatically determines exact UTC timestamp boundaries corresponding to `00:00:00.000` on the 1st of the month to `23:59:59.999` on the last day of the month in `Asia/Jakarta`.

### FR-2: Unified Financial & Inventory Aggregation
*As an executive, I want to view gross sales, net revenue, COGS, gross margin, inventory variance counts, and opname health in one cohesive screen.*
- **Acceptance Criteria**:
  - Financial figures reconcile with the existing Financial Core (`server/routers.ts` / `server/financials.test.ts`).
  - Inventory intelligence figures reconcile with the existing Variance Tolerance Engine and 3-period recurring high variance logic.

### FR-3: Exportable Management Reports (CSV & PDF)
*As an auditor, I want to download the monthly management summary in CSV or PDF format with optional custom audit notes.*
- **Acceptance Criteria**:
  - Export includes all summary KPIs, timestamp metadata, and user-supplied audit notes.
  - File naming follows the standard format `StoreOS_Monthly_Report_YYYY-MM.[csv|pdf]`.

---

## 4. References & Dependencies
- Existing Financial Core & Ledger (`server/routers.ts`)
- Existing Variance Tolerance Engine (`client/src/lib/varianceToleranceFilter.ts`)
- Existing Recurring High Variance Logic (`client/src/lib/repeatedVariance.ts`)
- Jakarta/WIB Date Utilities (`client/src/lib/settlementDateRanges.ts`)

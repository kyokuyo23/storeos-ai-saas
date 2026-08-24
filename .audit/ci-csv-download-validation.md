# CI CSV Download Validation

The CI browser test runs Playwright with Chromium on an isolated configurable port. It starts the StoreOS dev server, waits for the real browser `download` event, saves the artifact to a temporary filesystem path, and verifies that the downloaded file exists and is non-empty.

The downloaded filename is asserted as `storeos-monthly-2026-01.csv`. The file is decoded as UTF-8 and checked for the UTF-8 BOM, January 2026 Jakarta/WIB start and end dates, `Asia/Jakarta`, Financial and Inventory sections, quoted CSV values, CRLF termination, and exclusion of adjacent-period boundary dates. CI mode was run successfully with `CI=1 PLAYWRIGHT_PORT=4174 pnpm test:browser`.

Desktop `/reports` validation shows reachable CSV and PDF/Cetak controls, readable month selectors, and the active Jakarta period label. Mobile validation shows the same controls remain reachable and the period controls and summary cards stack responsively without clipping.

No production reporting, transaction, ledger, PDF/print, or financial business logic was changed.

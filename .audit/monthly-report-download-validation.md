# Monthly CSV Download CI Validation

- Browser test uses Playwright with Chromium and waits for the real `download` event.
- The downloaded artifact is saved to a temporary filesystem path and verified as an existing non-empty file.
- Assertions cover the exact filename, UTF-8 BOM, January 2026 Jakarta/WIB scope, report sections, quoted CSV values, CRLF termination, and exclusion of adjacent-period boundary dates.
- Desktop `/reports` review: CSV and PDF/Cetak controls are visible, month selectors and active Jakarta period label are readable, and the summary cards render correctly.
- Mobile `/reports` review: export controls remain reachable, period selectors stack correctly, active period label remains readable, and the summary layout is responsive.
- No production export behavior was changed; only test/CI infrastructure was added.

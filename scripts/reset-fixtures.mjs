// Demo data lives in each browser's IndexedDB (database "annie3d-demo"). This script prints the
// ways to reset it; a Node process cannot reach browser storage.
console.log(`Demo fixtures are stored per browser in IndexedDB ("annie3d-demo") and localStorage keys "annie3d.*".
Reset options:
  1. In the app: account menu → Demo scenarios → "Reset all demo data".
  2. In DevTools console: await window.__annie3d.reset()
  3. Playwright tests call page.evaluate(() => window.__annie3d.reset()) in their fixtures.
  4. Browser: Application → Storage → Clear site data for the preview origin.`);

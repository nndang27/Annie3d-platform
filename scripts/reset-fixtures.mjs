// Demo data lives in each browser's IndexedDB (database "3dads-demo"). This script prints the
// ways to reset it; a Node process cannot reach browser storage.
console.log(`Demo fixtures are stored per browser in IndexedDB ("3dads-demo") and localStorage keys "3dads.*".
Reset options:
  1. In the app: account menu → Demo scenarios → "Reset all demo data".
  2. In DevTools console: await window.__3dads.reset()
  3. Playwright tests call page.evaluate(() => window.__3dads.reset()) in their fixtures.
  4. Browser: Application → Storage → Clear site data for the preview origin.`);

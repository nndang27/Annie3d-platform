import { config } from 'zod';

// Our CSP forbids eval; zod 4 otherwise probes `new Function` on its first parse and logs a CSP
// violation (Lighthouse inspector-issues, 2026-09-24). Imported first by main.tsx so it runs
// before any module-level parse. Jitless parsing gives the same results.
config({ jitless: true });

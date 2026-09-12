/** Centralised English product copy. Keys are stable identifiers for future localisation. */
export const en = {
  brand: '3Dads',
  demoLabel: 'Demo workspace',
  demoExplainer:
    'This workspace runs against a simulated backend. Runs, exports and payments are demonstrations; nothing is sent to a generation service or charged.',
  nav: {
    dashboard: 'Projects',
    library: 'Library',
    settings: 'Settings',
    newProject: 'New project',
    signOut: 'Sign out',
    help: 'Help',
  },
  auth: {
    signInTitle: 'Sign in to your demo workspace',
    signInIntro: 'Pick a fixture identity. Demo accounts have no passwords and nothing is emailed.',
    signUpTitle: 'Create a demo account',
    signUpIntro:
      'Creates a local demo workspace in this browser. No email is sent and no password is stored.',
    recoverTitle: 'Recover access',
    recoverIntro:
      'In the live product this sends a sign-in link by email. In the demo the link is shown here instead.',
    continue: 'Continue',
    createAccount: 'Create demo account',
    haveAccount: 'Already have a demo account?',
    noAccount: 'New here?',
    forgot: 'Lost access?',
  },
  dashboard: {
    title: 'Projects',
    activeRuns: 'Active runs',
    empty: 'No projects yet',
    emptyBody:
      'Start from a template or upload a product image. Your first project takes about a minute in the demo.',
    noResults: 'No projects match',
  },
  run: {
    draft: 'Draft',
    queued: 'Queued',
    running: 'Running',
    waiting_input: 'Needs your input',
    paused: 'Paused',
    cancelling: 'Stopping…',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  },
  acceptance: { unreviewed: 'Unreviewed', accepted: 'Accepted', rejected: 'Rejected' },
} as const;

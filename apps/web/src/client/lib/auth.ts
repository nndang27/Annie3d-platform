/**
 * Better Auth browser client, loaded on first use: it is ~75 kB of source that only the
 * sign-in click needs (react-best-practices: bundle-dynamic-imports).
 */
async function client() {
  const { createAuthClient } = await import('better-auth/client');
  return createAuthClient();
}

export async function signInWithGoogle(callbackURL = location.pathname + location.search) {
  return (await client()).signIn.social({ provider: 'google', callbackURL });
}

export async function signOut() {
  await (await client()).signOut();
  location.assign('/');
}

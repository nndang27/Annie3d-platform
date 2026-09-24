/**
 * Better Auth browser client, loaded on first use: ~75 kB of source that only sign-in needs
 * (react-best-practices: bundle-dynamic-imports).
 */
let cached: Promise<{ client: any; googleClientId: string | null }> | null = null;

async function client() {
  cached ??= (async () => {
    const [{ createAuthClient }, { oneTapClient }, config] = await Promise.all([
      import('better-auth/client'),
      import('better-auth/client/plugins'),
      fetch('/api/public/config').then((r) => (r.ok ? r.json() : { googleClientId: null })) as Promise<{
        googleClientId: string | null;
      }>,
    ]);
    const plugins = config.googleClientId
      ? [
          oneTapClient({
            clientId: config.googleClientId,
            context: 'signin',
            promptOptions: { maxAttempts: 1, fedCM: true },
          }),
        ]
      : [];
    return { client: createAuthClient({ plugins }), googleClientId: config.googleClientId };
  })();
  return cached;
}

export async function signInWithGoogle(callbackURL = location.pathname + location.search) {
  return (await client()).client.signIn.social({ provider: 'google', callbackURL });
}

/**
 * Google One Tap (F11): a one-click account chooser, shown when a guest reaches a moment of
 * value (Run, Share, Save). Silently does nothing when Google declines to show it
 * (cooldown, third-party cookies off, origin not registered); the button stays as fallback.
 */
export async function showOneTap() {
  try {
    const { client: c, googleClientId } = await client();
    if (!googleClientId || typeof c.oneTap !== 'function') return;
    await c.oneTap({
      callbackURL: location.pathname + location.search,
      fetchOptions: { onSuccess: () => location.reload() },
      onPromptNotification: () => {},
    });
  } catch {
    /* One Tap is an enhancement only */
  }
}

export async function signOut() {
  await (await client()).client.signOut();
  location.assign('/');
}

import { intentFromSearch, type NavigationIntent } from '@annie3d/contracts';
import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
} from '@tanstack/react-router';
import { AppShell } from '@/components/AppShell';
import { NotFound } from '@/routes/NotFound';
import { RootLayout } from '@/routes/Root';
import { useSessionStore } from '@/stores/sessionStore';

const rootRoute = createRootRoute({ component: RootLayout, notFoundComponent: NotFound });

export interface DashboardSearch {
  q?: string;
  status?: 'archived' | 'all';
  template?: string;
}
export interface ProjectSearch {
  tab?: 'overview' | 'workflow' | 'studio' | 'outputs';
  run?: string;
  node?: string;
  artifact?: string;
}
export interface LibrarySearch {
  q?: string;
  kind?: string;
  project?: string;
  artifact?: string;
}
export interface RecoverSearch extends NavigationIntent {
  token?: string;
}
export interface ReturnSearch {
  checkout?: string;
  success?: string;
}
export interface MembersSearch {
  accept?: string;
}

const intentSearch = (s: Record<string, unknown>): NavigationIntent => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(s)) if (typeof v === 'string') p.set(k, v);
  return intentFromSearch(p);
};

export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signin',
  validateSearch: intentSearch,
  component: lazyRouteComponent(() => import('@/routes/auth/SignIn'), 'SignIn'),
});

export const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  validateSearch: intentSearch,
  component: lazyRouteComponent(() => import('@/routes/auth/SignUp'), 'SignUp'),
});

export const recoverRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/recover',
  validateSearch: (s: Record<string, unknown>): RecoverSearch => ({
    ...intentSearch(s),
    token: typeof s.token === 'string' ? s.token : undefined,
  }),
  component: lazyRouteComponent(() => import('@/routes/auth/Recover'), 'Recover'),
});

/** Everything below requires a session. */
const authedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authed',
  beforeLoad: ({ location }) => {
    const { session } = useSessionStore.getState();
    if (!session) {
      const returnTo = location.href;
      throw redirect({
        to: '/signin',
        search: { returnTo: returnTo.startsWith('/app') ? returnTo : `/app${returnTo}` },
      });
    }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

export const dashboardRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/',
  validateSearch: (s: Record<string, unknown>): DashboardSearch => ({
    q: typeof s.q === 'string' ? s.q : undefined,
    status: s.status === 'archived' || s.status === 'all' ? (s.status as 'archived' | 'all') : undefined,
    template: typeof s.template === 'string' ? s.template : undefined,
  }),
  component: lazyRouteComponent(() => import('@/routes/Dashboard'), 'Dashboard'),
});

export const newProjectRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/projects/new',
  validateSearch: intentSearch,
  component: lazyRouteComponent(() => import('@/routes/NewProject'), 'NewProject'),
});

export const projectRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/projects/$projectId',
  validateSearch: (s: Record<string, unknown>): ProjectSearch => ({
    tab:
      s.tab === 'workflow' || s.tab === 'studio' || s.tab === 'outputs'
        ? (s.tab as 'workflow' | 'studio' | 'outputs')
        : undefined,
    run: typeof s.run === 'string' ? s.run : undefined,
    node: typeof s.node === 'string' ? s.node : undefined,
    artifact: typeof s.artifact === 'string' ? s.artifact : undefined,
  }),
  component: lazyRouteComponent(() => import('@/routes/project/ProjectWorkspace'), 'ProjectWorkspace'),
});

export const libraryRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/library',
  validateSearch: (s: Record<string, unknown>): LibrarySearch => ({
    q: typeof s.q === 'string' ? s.q : undefined,
    kind: typeof s.kind === 'string' ? s.kind : undefined,
    project: typeof s.project === 'string' ? s.project : undefined,
    artifact: typeof s.artifact === 'string' ? s.artifact : undefined,
  }),
  component: lazyRouteComponent(() => import('@/routes/Library'), 'Library'),
});

export const settingsRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/settings',
  component: lazyRouteComponent(() => import('@/routes/settings/SettingsLayout'), 'SettingsLayout'),
});
export const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/settings/profile' });
  },
});
export const settingsProfileRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/profile',
  component: lazyRouteComponent(() => import('@/routes/settings/Profile'), 'Profile'),
});
export const settingsWorkspaceRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/workspace',
  component: lazyRouteComponent(() => import('@/routes/settings/WorkspaceSettings'), 'WorkspaceSettings'),
});
export const settingsNotificationsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/notifications',
  component: lazyRouteComponent(() => import('@/routes/settings/Notifications'), 'Notifications'),
});
export const settingsMembersRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/members',
  validateSearch: (s: Record<string, unknown>): MembersSearch => ({
    accept: typeof s.accept === 'string' ? s.accept : undefined,
  }),
  component: lazyRouteComponent(() => import('@/routes/settings/Members'), 'Members'),
});
export const settingsBillingRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/billing',
  validateSearch: intentSearch,
  component: lazyRouteComponent(() => import('@/routes/settings/Billing'), 'Billing'),
});

export const checkoutRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/billing/checkout',
  validateSearch: intentSearch,
  component: lazyRouteComponent(() => import('@/routes/billing/Checkout'), 'Checkout'),
});

export const checkoutReturnRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/billing/return',
  validateSearch: (s: Record<string, unknown>): ReturnSearch => ({
    checkout: typeof s.checkout === 'string' ? s.checkout : undefined,
    success: s.success === true || s.success === 'true' ? 'true' : undefined,
  }),
  component: lazyRouteComponent(() => import('@/routes/billing/Return'), 'CheckoutReturn'),
});

export const scenariosRoute = createRoute({
  getParentRoute: () => authedRoute,
  path: '/dev/scenarios',
  component: lazyRouteComponent(() => import('@/routes/dev/Scenarios'), 'Scenarios'),
});

const routeTree = rootRoute.addChildren([
  signInRoute,
  signUpRoute,
  recoverRoute,
  authedRoute.addChildren([
    dashboardRoute,
    newProjectRoute,
    projectRoute,
    libraryRoute,
    settingsRoute.addChildren([
      settingsIndexRoute,
      settingsProfileRoute,
      settingsWorkspaceRoute,
      settingsNotificationsRoute,
      settingsMembersRoute,
      settingsBillingRoute,
    ]),
    checkoutRoute,
    checkoutReturnRoute,
    scenariosRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  basepath: '/app',
  defaultPreload: 'intent',
  defaultPreloadDelay: 120,
  defaultPendingMs: 200,
  defaultPendingMinMs: 0,
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

/** Navigate to an internal absolute path such as a validated returnTo (includes the /app prefix). */
export function navigateToHref(href: string): void {
  router.history.push(href);
}

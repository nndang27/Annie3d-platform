import type { PlatformServices } from '@3dads/contracts';
import { createContext, type ReactNode, useContext } from 'react';

const Ctx = createContext<PlatformServices | null>(null);

export function ServicesProvider({
  services,
  children,
}: {
  services: PlatformServices;
  children: ReactNode;
}) {
  return <Ctx.Provider value={services}>{children}</Ctx.Provider>;
}

/** The only way screens reach the data layer. */
export function useServices(): PlatformServices {
  const s = useContext(Ctx);
  if (!s) throw new Error('ServicesProvider missing');
  return s;
}

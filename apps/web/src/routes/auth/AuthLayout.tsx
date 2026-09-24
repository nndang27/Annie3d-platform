import type { ReactNode } from 'react';
import { en } from '@/i18n/en';

const SITE = import.meta.env.VITE_SITE_ORIGIN ?? '';

export function AuthLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main
      id="main"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        background: 'var(--bg-canvas)',
      }}
    >
      <div
        className="card card-pad"
        style={{ width: '100%', maxWidth: 440, display: 'grid', gap: 18, padding: 28 }}
      >
        <a href={`${SITE}/`} className="logo" aria-label="Annie 3D home">
          <span className="logo-mark" aria-hidden="true">
            A
          </span>
          <span>Annie 3D</span>
        </a>
        <div>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 600 }}>{title}</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: '0.9375rem' }}>{intro}</p>
        </div>
        <span className="demo-chip" style={{ alignSelf: 'start' }}>
          {en.demoLabel}
        </span>
        {children}
      </div>
    </main>
  );
}

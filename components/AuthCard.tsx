import React from 'react';
import { CrystalLogo } from '../constants';

/** The simple centred card for signing in and signing up (D-044). */
const AuthCard: React.FC<{ title: string; description: string; children: React.ReactNode; footer: React.ReactNode }> = ({ title, description, children, footer }) => (
  <main className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-canvas px-4 py-8">
    <div className="flex items-center gap-2">
      <CrystalLogo showText={false} />
      <span className="type-section-title text-ink">Crystal</span>
    </div>
    <section className="w-full max-w-[420px] space-y-5 rounded-[var(--radius-xl)] surface-card p-8 max-md:p-5">
      <header>
        <h1 className="type-page-title text-ink">{title}</h1>
        <p className="type-body mt-1 text-muted">{description}</p>
      </header>
      {children}
    </section>
    <p className="type-body text-muted">{footer}</p>
  </main>
);

export default AuthCard;

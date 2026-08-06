// Public site header.
//
// Deliberately stateless — no session lookup, no router. The landing page
// needs a session-aware nav and keeps its own; every other public route
// (legal documents, grievance, account deletion, contact) just needs a way
// home and a way to sign in, and paying for a client component to get that
// would make static legal pages interactive for no reason.

import Logo from '../../shared/components/Logo';

export default function SiteHeader() {
  return (
    <nav
      className="sticky top-0 z-50"
      style={{
        background: 'rgba(255,255,255,0.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid #E4E4E7',
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <a href="/" aria-label="INFLX home" className="inline-flex items-center">
          <Logo tone="dark" size="sm" />
        </a>
        <div className="flex items-center gap-2">
          <a
            href="/legal"
            className="hidden rounded-full px-4 py-2.5 text-[13.5px] font-semibold no-underline sm:inline-block"
            style={{ color: '#52525B' }}
          >
            Legal
          </a>
          <a
            href="/login"
            className="rounded-full px-5 py-2.5 text-[13.5px] font-bold no-underline"
            style={{ background: '#FFC107', color: '#0A0A0A' }}
          >
            Get Started
          </a>
        </div>
      </div>
    </nav>
  );
}

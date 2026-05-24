'use client';

/**
 * /dashboard/settings — Settings hub layout (Phase A9).
 *
 * Wraps Profile / Subscription / Billing as tabbed sub-routes under
 * a single Settings entry. Consolidates 3 prior top-level nav items
 * into one for cleaner mental model. Old URLs (/dashboard/profile,
 * /dashboard/subscription, /dashboard/billing) redirect to the
 * matching tab.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/dashboard/settings/profile',      label: 'Profile'      },
  { href: '/dashboard/settings/subscription', label: 'Subscription' },
  { href: '/dashboard/settings/billing',      label: 'Billing'      },
];

const CSS = `
.shub{font-family:'Outfit',ui-sans-serif,system-ui,sans-serif; background:#FAFAFA; min-height:100vh}
.shub-wrap{max-width:1200px; margin:0 auto; padding:24px 24px 0}
.shub h1{font-size:24px; font-weight:600; margin:0 0 4px; color:#0A0A0A}
.shub .sub{color:#52525B; font-size:14px; margin-bottom:20px}
.shub-tabs{display:flex; gap:4px; border-bottom:1px solid #E4E4E7; margin-bottom:0}
.shub-tab{padding:10px 20px; font-size:14px; font-weight:500; color:#52525B; border-bottom:2px solid transparent; cursor:pointer; text-decoration:none; transition:all 0.1s}
.shub-tab:hover{color:#0A0A0A}
.shub-tab.active{color:#0A0A0A; border-bottom-color:#0A0A0A; font-weight:600}
`;

export default function SettingsLayout({ children }) {
  const pathname = usePathname() || '';
  return (
    <div className="shub">
      <style>{CSS}</style>
      <div className="shub-wrap">
        <h1>Settings</h1>
        <div className="sub">Manage your profile, subscription, and billing in one place.</div>
        <div className="shub-tabs">
          {TABS.map(t => {
            const isActive = pathname === t.href || pathname.startsWith(t.href + '/');
            return (
              <Link key={t.href} href={t.href} className={`shub-tab ${isActive ? 'active' : ''}`}>
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div>{children}</div>
    </div>
  );
}

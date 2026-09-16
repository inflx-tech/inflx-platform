'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../lib/api';

/**
 * PlansOffBanner — the one line every admin page that shows a plan limit must carry while the
 * master switch is off.
 *
 * Contract: features/subscriptions-master-switch (M5).
 *
 * Without it, an admin edits a tier's quota, saves it, watches a brand sail straight past it and
 * has no way to know why. The pages stay fully editable on purpose: what you change is stored and
 * applies the moment the switch goes back on.
 */
export default function PlansOffBanner() {
  const [off, setOff] = useState(false);

  useEffect(() => {
    let alive = true;
    adminApi.getPlatformSettings().then(res => {
      if (!alive || !res.success) return;
      const row = (res.data.settings || []).find(s => s.key === 'subscriptions_enforced');
      setOff(!!row && Number(row.value) === 0);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!off) return null;
  return (
    <div className="mb-5 flex gap-3 items-start rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" data-testid="plans-off-banner">
      <span>●</span>
      <span>
        Plan limits are switched off platform-wide. What you change here is stored and will apply
        when you switch them back on — Settings → Platform → Subscription plans.
      </span>
    </div>
  );
}

// Phase A9 — /dashboard/billing moved under /dashboard/settings/billing.
// Server-side redirect preserves any external links or bookmarks.
import { redirect } from 'next/navigation';
export default function BillingRedirect() {
  redirect('/dashboard/settings/billing');
}

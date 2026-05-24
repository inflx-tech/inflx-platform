// Phase A9 — /dashboard/subscription moved under /dashboard/settings/subscription.
// Server-side redirect preserves any external links or bookmarks.
import { redirect } from 'next/navigation';
export default function SubscriptionRedirect() {
  redirect('/dashboard/settings/subscription');
}

// Phase A9 — /dashboard/profile moved under /dashboard/settings/profile.
// Server-side redirect preserves any external links or bookmarks.
import { redirect } from 'next/navigation';
export default function ProfileRedirect() {
  redirect('/dashboard/settings/profile');
}

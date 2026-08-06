// Account deletion.
//
// This page exists at a stable, public, unauthenticated URL on purpose. It is
// what an app store reviewer opens to verify the deletion route, and it is the
// only way a user who has already uninstalled the app can still ask us to
// erase their account. Gating it behind login would defeat both.

import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import DocPage from '../../components/legal/DocPage';

export const metadata = {
  title: 'Delete My Account — INFLX',
  description:
    'How to delete your INFLX account, what data is erased, what we are required to keep, and how long it takes.',
  alternates: { canonical: 'https://inflx.in/account-deletion' },
};

export { accountDeletion as doc } from '../../lib/legal/docs-support';
import { accountDeletion as doc } from '../../lib/legal/docs-support';

export default function AccountDeletionPage() {
  return (
    <div style={{ background: '#FFFFFF', color: '#0A0A0A', minHeight: '100vh' }}>
      <SiteHeader />
      <DocPage doc={doc} />
      <SiteFooter />
    </div>
  );
}

// Contact.
//
// Carries the entity-identity disclosure an e-commerce entity must display —
// legal name, registered office, and contact details including email, mobile
// and landline. The footer carries the same facts on every page; this is the
// page someone lands on when they searched for "INFLX contact".

import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';
import DocPage from '../../components/legal/DocPage';

export const metadata = {
  title: 'Contact INFLX — Omnara India Private Limited',
  description:
    'How to reach INFLX: customer care, the Grievance Officer, and the registered office of Omnara India Private Limited.',
  alternates: { canonical: 'https://inflx.in/contact' },
};

export { contact as doc } from '../../lib/legal/docs-support';
import { contact as doc } from '../../lib/legal/docs-support';

export default function ContactPage() {
  return (
    <div style={{ background: '#FFFFFF', color: '#0A0A0A', minHeight: '100vh' }}>
      <SiteHeader />
      <DocPage doc={doc} />
      <SiteFooter />
    </div>
  );
}

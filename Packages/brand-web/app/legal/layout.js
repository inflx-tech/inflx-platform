// Chrome for every legal route.
//
// The footer is here rather than in each page so that no legal page can
// exist without the Grievance Officer block on it — that reachability is a
// published-disclosure requirement, and making it structural is cheaper than
// remembering it eleven times.

import SiteHeader from '../../components/SiteHeader';
import SiteFooter from '../../components/SiteFooter';

export default function LegalLayout({ children }) {
  return (
    <div style={{ background: '#FFFFFF', color: '#0A0A0A', minHeight: '100vh' }}>
      <SiteHeader />
      {children}
      <SiteFooter />
    </div>
  );
}

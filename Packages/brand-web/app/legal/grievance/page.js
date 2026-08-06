// Grievance redressal.
//
// The single most load-bearing page in this whole set. An intermediary must
// publish the Grievance Officer's name and contact and a working complaint
// mechanism, reachable from the home screen or one click from it — which the
// footer link satisfies. The timelines below are the ones in force since
// 20 February 2026; the 15-day and 72-hour figures still published across
// most of the Indian web are superseded.

import DocPage from '../../../components/legal/DocPage';
import GrievanceForm from '../../../components/legal/GrievanceForm';

export const metadata = {
  title: 'Grievance Redressal & Grievance Officer — INFLX',
  description:
    'How to raise a complaint with INFLX, who handles it, how quickly we respond, and how to escalate if you are not satisfied.',
  alternates: { canonical: 'https://inflx.in/legal/grievance' },
};

export { grievance as doc } from '../../../lib/legal/docs-support';
import { grievance as doc } from '../../../lib/legal/docs-support';

export default function GrievancePage() {
  return (
    <DocPage doc={doc}>
      <GrievanceForm />
    </DocPage>
  );
}

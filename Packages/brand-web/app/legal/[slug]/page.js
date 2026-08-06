// One route, eleven documents.
//
// Every legal document is rendered from data by the same component, so the
// set cannot drift apart structurally. Unknown slugs 404 rather than
// rendering an empty shell — a legal page that loads but says nothing is
// worse than one that honestly does not exist.

import { notFound } from 'next/navigation';
import DocPage from '../../../components/legal/DocPage';
import { getDoc, allSlugs } from '../../../lib/legal/registry';

export function generateStaticParams() {
  return allSlugs().map((slug) => ({ slug }));
}

export function generateMetadata({ params }) {
  const doc = getDoc(params.slug);
  if (!doc) return { title: 'Not found — INFLX' };
  return {
    title: `${doc.title} — INFLX`,
    description: doc.summary,
    alternates: { canonical: `https://inflx.in/legal/${doc.slug}` },
  };
}

export default function LegalDocumentRoute({ params }) {
  const doc = getDoc(params.slug);
  if (!doc) notFound();
  return <DocPage doc={doc} />;
}

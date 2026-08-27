import { redirect } from 'next/navigation';

/**
 * Superseded — features/admin-people-pipeline.
 *
 * Marketing -> Triage folded into the Influencers and Brands tab sets (Leads tab on
 * each), split by target_type instead of living as one combined "All" list. This route
 * is kept only as a redirect so old bookmarks/links land somewhere real instead of a
 * dead page that contradicts the new PEOPLE nav section.
 */
export default function MarketingTriageRedirect({ searchParams }) {
  const targetType = searchParams?.target_type;
  redirect(targetType === 'brand' ? '/admin/brands?tab=leads' : '/admin/influencers?tab=leads');
}

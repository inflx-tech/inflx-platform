import { redirect } from 'next/navigation';

/**
 * Superseded — features/admin-people-pipeline.
 *
 * The standalone "Add Lead" nav item folded into a "+ Add Lead" button/modal on the
 * Leads tab of both Influencers and Brands (single-intake form only — the old bulk CSV
 * paste mode is not carried over; it wasn't part of the locked mockup for this
 * contract). This route redirects into the Influencers Leads tab with the modal
 * pre-opened so old bookmarks still land somewhere useful.
 */
export default function MarketingAddLeadRedirect() {
  redirect('/admin/influencers?tab=leads&add=1');
}

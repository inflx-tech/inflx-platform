import { redirect } from 'next/navigation';

/**
 * Superseded — features/admin-people-pipeline.
 *
 * Marketing -> Verifications folded into Influencers -> Pending Verification, which is
 * now the ONLY place an influencer account gets approved or rejected (see 01-spec.md
 * for the creator_profiles <-> influencers/users merge this closes).
 */
export default function MarketingVerificationsRedirect() {
  redirect('/admin/influencers?tab=pending');
}

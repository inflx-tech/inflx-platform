import { redirect } from 'next/navigation';

/**
 * Superseded — features/admin-people-pipeline.
 *
 * Marketing -> Invitations folded into Influencers -> Invited.
 */
export default function MarketingInvitationsRedirect() {
  redirect('/admin/influencers?tab=invited');
}

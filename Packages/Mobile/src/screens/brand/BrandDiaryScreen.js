import React from 'react';
import CollabDiaryScreen from '../influencer/CollabDiaryScreen';
import { brandApi } from '../../services/api';

/**
 * BrandDiaryScreen — "what happened here", the brand's side.
 * Contract: features/stage-1-find-each-other-and-agree
 *
 * It is the SAME screen the creator reads, wired to the brand's calls. Not a copy:
 * building it twice is exactly how the two sides end up telling different stories about
 * one negotiation, which is the failure a shared record exists to prevent.
 *
 * The component takes its data through the api prop, so the only difference between the
 * two apps is which token the request carries.
 */
export default function BrandDiaryScreen(props) {
  return <CollabDiaryScreen {...props} api={brandApi} />;
}

'use client';

/**
 * /dashboard/bookings — Wave 2 BookingsInbox entry point.
 *
 * Thin wrapper around BookingsInbox so the component lives in the
 * components/ subdir with the rest of the dashboard surface conventions.
 */

import BookingsInbox from './components/BookingsInbox';

export default function BookingsPage() {
  return <BookingsInbox />;
}

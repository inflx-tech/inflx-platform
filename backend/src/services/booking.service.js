'use strict';

/**
 * booking.service.js
 * Phase 4 — Block C: Pre-booking
 */

const db = require('../config/db');

const FIXED_SLOTS = ['12:00', '13:00', '14:00', '19:00', '20:00', '21:00'];
const SLOT_CAPACITY = 10; // default capacity per slot

/**
 * Get available slots for an offer on a given date.
 * Returns array of { time, available: boolean }
 */
async function getSlots(offerId, date) {
  // Count existing bookings per slot for this date
  // We join via follower_transactions → campaign_offers
  const { rows } = await db.query(
    `SELECT to_char(fb.booking_time, 'HH24:MI') AS slot_time, COUNT(*) AS cnt
     FROM follower_bookings fb
     JOIN follower_transactions ft ON ft.id = fb.transaction_id
     WHERE ft.offer_id = $1
       AND fb.booking_date = $2
       AND fb.status != 'cancelled'
     GROUP BY fb.booking_time`,
    [offerId, date]
  );

  const counts = {};
  for (const r of rows) {
    counts[r.slot_time] = parseInt(r.cnt, 10);
  }

  return FIXED_SLOTS.map(time => ({
    time,
    available: (counts[time] || 0) < SLOT_CAPACITY,
  }));
}

/**
 * Generate a unique booking reference code: BK + 6 random digits
 */
function generateReferenceCode() {
  const digits = Math.floor(100000 + Math.random() * 900000).toString();
  return `BK${digits}`;
}

module.exports = { getSlots, generateReferenceCode };

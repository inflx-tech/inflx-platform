'use strict';

const db = require('../config/db');
const notificationService = require('../services/notification.service');

async function run() {
  console.log('[CRON booking-reminder] Running...');

  // Migration 033 added booking_type + pickup_date for date_range bookings.
  // table/slot/appointment rows fire when booking_date = today; date_range
  // rows fire when pickup_date = today. Without the OR branch below, car_rental
  // bookings would silently miss reminder day after migration 033.
  const { rows: bookings } = await db.query(
    `SELECT fb.id, fb.reference_code,
            fb.booking_type,
            COALESCE(fb.booking_date, fb.pickup_date) AS event_date,
            ft.follower_id,
            fo.user_id AS follower_user_id,
            u.fcm_token, u.phone,
            b.id AS brand_id,
            brands_u.name AS brand_name
     FROM follower_bookings fb
     JOIN follower_transactions ft ON fb.transaction_id = ft.id
     JOIN followers fo ON fo.id = ft.follower_id
     JOIN users u ON u.id = fo.user_id
     JOIN brands b ON b.id = ft.brand_id
     JOIN users brands_u ON brands_u.id = b.user_id
     WHERE (fb.booking_date = CURRENT_DATE OR fb.pickup_date = CURRENT_DATE)
       AND fb.status = 'confirmed'`
  );

  if (bookings.length === 0) {
    console.log('[CRON booking-reminder] No bookings today.');
    return { reminded: 0 };
  }

  for (const booking of bookings) {
    const isPickup = booking.booking_type === 'date_range';
    await notificationService.send({
      userId: booking.follower_user_id,
      type: 'booking.reminder',
      title: isPickup ? 'Pickup Reminder' : 'Booking Reminder',
      body: isPickup
        ? `Reminder: Vehicle pickup from ${booking.brand_name} is today. Ref: ${booking.reference_code}`
        : `Reminder: Your booking at ${booking.brand_name} is today. Ref: ${booking.reference_code}`,
      data: { screen: 'booking_detail', booking_id: booking.id },
      fcmToken: booking.fcm_token,
      sendSms: true,
      phone: booking.phone,
    });
  }

  console.log(`[CRON booking-reminder] Sent ${bookings.length} reminders`);
  return { reminded: bookings.length };
}

module.exports = { run };

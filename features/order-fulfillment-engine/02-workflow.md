# 02 — Workflow: Order Fulfillment Engine (Unit 1)

Brand fulfilment lifecycle (PATCH /brands/me/orders/:id/status):
  confirmed → packed → dispatched(Shipped, + courier_name + tracking_number)
  → out_for_delivery → delivered ; or cancelled (terminal).
Each step stamps its timestamp + pushes the follower an FCM notification.

Brand Orders list (GET /brands/me/orders) now joins the shipping address and
returns courier/tracking + step timestamps (previously errored on a missing column).

Commission: created in pending at purchase; the nightly confirm cron releases to
wallet only after the return window closes AND the order isn't cancelled AND has no
active/successful return — otherwise the commission is held/cancelled.

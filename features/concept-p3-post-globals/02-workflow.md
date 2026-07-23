# Workflow — concept-p3-post-globals

## W1 — App config round trip
GET /v1/follower/app-config (anonymous) → {video_autoplay: true,
video_sound_default: false}. Admin flips "Sound ON by default" at
/admin/app-settings → PATCH merges {video_sound_default: true} → the GET
reflects it. Unknown keys survive merges (jsonb ||).

## W2 — Like / save
Follower JWT: POST /v1/follower/posts/:id/like → {like_count: 1}; repeat →
still 1 (idempotent); DELETE → 0. Same for /save. Non-approved or unknown
post → 404. Anonymous → 401 (follower auth). Feed and detail now return
like_count/save_count always, liked/saved true only for the caller.

## W3 — Ratio decision (design workflow)
mockups/post-frame-ratios.html shows the SAME post at 1:1, 3:4, 4:5 plus the
full-screen viewer — pure white, tags visible in-feed per founder choice.
Founder picks the clamp; the choice becomes the post-frame component's
constant when Stage-A screens build. No code depends on it yet.

## Expected end state
node --check green; ROUTES-LOAD-OK; pnpm qa GREEN; gov-check 0. Deploy =
run-141 prod migration + push (backend + admin page); NO OTA.

# Workflow — wizard Next error visibility

## W1 — empty name is explained, not silent
1. Add section → step 1 pick a design → step 2 (Content), leave Section name blank.
2. Click "Next · Display →".
3. The wizard stays on step 2 AND shows "Give the section a name — it shows in
   the app." in the top banner, and the name input is highlighted red.
4. Type a name → the red clears → Next advances to step 3.

## W2 — Publish validation messages surface
On step 4 Publish, any validation (schedule window, tap-destination node,
banner headline, unpicked rule) now shows its message + jumps to the right
step, instead of failing silently.

## W3 — no regression to normal navigation
Back/Next/Design-pick/tab-switch patches that don't set err still clear a
stale err as before.

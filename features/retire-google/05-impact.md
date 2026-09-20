# retire-google — impact

**Production-impacting (Render + Vercel on push). No migration, no OTA, no money.**

- Seven routes disappear. Live callers today: the website registration page (rewritten in the
  same push) and the follower app's location sheet, which no live screen renders. The one
  route the live follower app does call on cold start (`/follower/reverse-geocode`) keeps
  answering, now from our own city list — a Vijayawada phone still reads "Vijayawada".
- Website registration changes shape: state and city are picked from the offered list; the
  referral box goes (the server already ignored it).
- Follower addresses typed without a pin resolve to the typed city's centre instead of a
  Google-located street point; the follower checkout is dormant (profile-only app).
- After the push the two Google keys are unused; the founder removes them from Render.

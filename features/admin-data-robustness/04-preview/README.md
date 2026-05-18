# Mock UI / Screen Preview (Step 4) — A5b

No new UI. The fix makes each page fall back to its **already-existing**
empty/failed state instead of crashing. Nothing to mock.

Reviewer confirms at the Step-5 lock:
- The 3 confirmed crash points + the uniform "fallback, don't crash"
  approach in 01-spec are correct.
- Acceptable that exact empty-state copy is pinned at Step 7 against
  the real post-fix render (behaviour is contracted; selector is not).
- "Fallback, not mute" — the non-regression populated case is part
  of the bar.

Evidence at Step 9: `screenshots/after/a5b__<page>-empty.png` ×3.

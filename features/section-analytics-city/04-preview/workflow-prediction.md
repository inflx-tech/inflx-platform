# Workflow prediction — section-analytics-city (P5)

Mockup: 00-analytics-city.html — the App Builder with (a) the City-override
input beside the world chips and (b) the 📊 last-7-days panel.

Predicted runtime behavior:
- Engine gains a third merge layer (global < vertical < city); zero change
  for followers when no city rows exist (all current traffic).
- section_events starts EMPTY — analytics counts grow from release moment;
  no invented history (backend-first rule).
- Mobile emits fire-and-forget on tap/see-all; endpoint failure never
  affects UX. Emit rides an OTA under the founder's recorded override
  pattern (same as P3).
- Admin panel + city input are additive UI on the P2 builder.

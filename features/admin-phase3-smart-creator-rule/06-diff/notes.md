# 06 — Before/After · Smart creator rule
Before: creator rules were generic lists — location a weak sort, followed-by
missing from world rules, no brand-scope; no single context-aware creator rule.

After: RULES.creators_smart — one rule that reads placement context (Phase 1):
world → promote-this-world + near-viewer + active + famous + followed-first-then-
discovery; business page → only that brand's collaborators. Placeable via the
'Creator carousel (smart)' admin preset.

Verify: runRule('creators_smart') executes on DB (5 ranked rows world scope, 0
for unknown brand); pnpm qa GREEN(79); brand-web build exit 0. backend+admin, no mobile.

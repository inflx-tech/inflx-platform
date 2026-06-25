# 05 — Impact
Backend + admin-web; no mobile, no migration. Net: a real bug fix (section types
that silently failed to save now save) + deletion of a dead duplicate system
(Collections) + a dead rule. Engine degrades gracefully on any stray collection
row (unknown rule → empty, logged) so no regression. Risk: low-medium; gated on
pnpm qa GREEN + brand-web build exit 0 (both pass).

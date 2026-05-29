# Flow 50 — Impact analysis

## Verdict (chat one-liner)
**Zero functional disturbance — visual + UX only.** The schema engine moves dark→
light brandPalette (brand ink/yellow spine); `__action_dispatch`, Path-B tracking,
every SectionRenderer branch, and the schema-driven section ordering preserved verbatim.

## Classification
- **production-impacting** — follower OTA bundle serves the restyled engine (SchemaDetail
  + SalonDetail re-export + any deferred-business detail).
- Mobile JS-only; no backend, no migration, no native rebuild (NATIVE_RUNTIME=2).
- Brand/influencer carry the shared bundle (no brand/influencer-screen change).

## Preserved verbatim (NON-NEGOTIABLE)
| Concern | Preservation |
|---|---|
| `__action_dispatch` | `handlePrimary` → `navigation.navigate('__action_dispatch', {...})` — half-wired foundation (§9), untouched. NOT fixed in this visual flow. |
| Path-B tracking | `handleViewBrand` → BrandStore with `tracking`; attribution strip props |
| Section renderers | description / spec_grid / feature_chips / gallery / variant_selector / return_policy_notice + pricing_tabs/pickup_options/repeatable_list no-ops |
| Helpers | readPath / formatValue / renderSubtitle unchanged |
| Data-driven CTA | `cfg.cta_primary.action` + label; `orderable` gate + unavailable reason |
| Schema ordering | `template.card_config.detail_sections` rendered in order |
| SalonDetail shim | `export { default } from './SchemaDetailScreen'` unchanged |

## Design decision (founder-approved)
Dark template `cfg.accent`/`accent_dim` dropped for rendering → brand ink/yellow spine
(F0: deferred businesses fall back to the yellow family). Approved via AskUserQuestion
("Green — implement"). Per-category accent in schema detail would need category
plumbing — deferred follow-up if wanted.

## Risk
- **Regression risk: low.** No control-flow/prop changes; restyle is token + StyleSheet
  rewrite + accent reclassification. Verified by dark-hex grep + babel (both) + 18-marker grep.
- **Rollback:** OTA version pin to follower v62 (Flow 49).

## After-evidence
Emulator after-screenshots SKIPPED (deep, data/template-gated engine). After-evidence =
the mockup + founder physical APK smoke-test on live follower v63.

## Mockup sign-off
Founder green-signaled via AskUserQuestion 2026-05-28 ("Green — implement") BEFORE any
screen code. `mockup_locked=true`.

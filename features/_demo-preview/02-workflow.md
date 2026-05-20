# Workflow — _demo-preview

This contract has no implementation. It is a static showcase of the
preview-machinery's output.

## What "runs"

```
pnpm preview:open _demo-preview
```

This is the verification artifact. The founder opens the page,
sees the two mockups + workflow prediction + spec excerpt, and
mentally confirms: "yes, when a real feature comes through, this is
the kind of pre-code preview I want to review before I lock the
mockup and let code begin."

## What does NOT happen

- No code change.
- No DB migration.
- No backend/web/mobile build.
- Never released (`released: false` permanently).

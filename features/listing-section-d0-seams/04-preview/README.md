# 04-preview — intentionally empty

D0 is a **backend-only** contract (`backend/src/services/*`). It touches no
`Packages/*/(src|app|components|lib|screens|services)/` path, so the UI-governed gates
(mockup-lock Rule 3, before/after-diff Rule 4) do **not** apply. There are no screens to
mock. Gov-check requires only Rule 1 (approved contract) + Rule 2 (release evidence).

The user-visible work begins at **D1 `follower-business-page`**, which will carry full
mockups + `06-diff/notes.md`.

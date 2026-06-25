# 02 — Workflow
1. Lock the App Builder mockup (founder).
2. Build the single App Builder page: Scope tabs → World pills (+ Manage worlds
   panel absorbing Home Builder) → Section stack (add/reorder/sticky/edit, each
   row a Template + Rule picker) → Publish. Reuse the existing section_config
   read/write API + sectionLibrary; route 'business'/'home' scopes through it.
3. Retire App Sections + Home Builder + follower-categories nav entries/pages.
4. Verify: brand-web next build exit 0; admin-sections API tests green; a manual
   pass placing a section in each scope.
5. Ship: commit (paths) → push (Vercel).
End state: one builder, three+ scopes, one vocabulary; Home composable; old
pages gone.

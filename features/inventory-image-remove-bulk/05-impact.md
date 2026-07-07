# Impact
Backend: one WHERE clause on getMyNodeProducts (brand's own inventory browse) —
now hides soft-deleted products (correct; they were never restorable in this UI).
brand-web: DefaultFleetRow image + checkbox, DrilldownFleetView selection + bulk
bar. No migration, no mobile/OTA; deploys via Render (backend) + Vercel (web).
Single-remove and toggle paths unchanged. Rollback = revert.

# 02 — Workflow
1. Backend GET /follower/business/:brand_id/sections (brand→world tile→business
   buildSections w/ brandId). 2. Admin 'Menu (food)' preset + vertical-aware
   filter (biz field). 3. Mobile: getBusinessSections + RestaurantDetailScreen
   renders header spine + stack (menu marker→MenuTab, else SectionItem), default
   menu-only. 4. Verify: backend load+execute, brand-web build, metro bundle,
   mobile jest, pnpm qa. 5. Ship: push (Render+Vercel) + OTA.
End state: a composable food business page; admin places banner/creator/offers
around the Menu; nothing regresses when uncomposed.

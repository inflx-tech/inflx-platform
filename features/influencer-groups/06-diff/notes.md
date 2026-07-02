# 06 — Implementation / diff notes (Influencer Groups, F-5)

Backend + frontend; structure approved in-session (Groups in the Influencers tab). Reviewer clean
after one fix; QA GREEN.

## What was implemented
- Migration 123: influencer_groups + influencer_group_members (composite PK, ON DELETE CASCADE, brand index).
- influencerGroup.controller.js + routes (mounted /brands/me): list/create/rename/delete + add/remove members.
  Every op brand-scoped (brand_id from req.user.sub → brands.user_id), ownership re-checked on :id,
  member ids validated against influencers, parameterized SQL, requireRole('brand').
- lib/api.js: influencerGroupApi.list/create/rename/remove/addMembers/removeMember.
- Influencers tab: new "Groups" sub-tab (mirrors Discover/Proposals; ?tab=groups deep-link) + GroupsManager
  (list, create modal with member picker reusing influencerApi.search, detail: rename/add/remove/delete).
- Campaign wizard: removed GROUPS_KEY/loadGroups/saveGroups; infGroups now server-fetched (refreshInfGroups);
  create/delete go to the server; addGroupToSet expands group.members into the set with dedup (behavior preserved).

## Reviewer findings + resolution
- CRITICAL: useRef used in GroupMemberPicker but not imported (influencers/page.js:2) → would crash the
  create-group/add-members panel. FIXED (added useRef to the import).
- Security CLEAN: no cross-brand read/mutate; member-id injection blocked; route not shadowed; migration sound.
- Non-blocking: groups uncapped; wizard uses last-fetched snapshot; a cosmetic rename-input fallback.

## What diverged / deferred
- Group size cap, cross-tab live refresh in the wizard, group analytics — not in scope.

## What to check after deploy (migration 123 applied first)
- Influencers → Groups → create a group, add/remove members, rename, delete.
- New campaign → pick the group → all its influencers added to the set at once.
- Confirm a second brand cannot see your groups.

# Workflow Definition — Admin Capabilities (B-2)

## Actor
Superadmin (manages admins); scoped staff admin (consumes).

## Preconditions
A superadmin account; migration 109 applied.

## Workflow steps (user-observable)
1. Superadmin → Admin → Users → "Create admin": enters phone + name, picks a base role, and
   ticks capability checkboxes (sections from GET /admin/capabilities) → admin created with
   those capabilities.
2. Superadmin can Edit an admin's capabilities/role and Deactivate/Reactivate them.
3. A scoped staff admin logs in → the admin nav shows ONLY the sections they have capability for.
4. If that admin calls a section API they lack the capability for (directly), the API returns 403.
5. Superadmin sees and does everything (capability bypass).

## Success definition
- A non-superadmin admin can access ONLY their granted sections, at BOTH nav and API.
- Superadmin is never locked out; can manage all admins' capabilities.

## Failure / edge workflows
- Admin without capability hits a gated route → 403 FORBIDDEN.
- Unknown capability key on create/update → 422 (validated against catalog).
- Non-superadmin cannot reach user-management routes (superadmin-only).

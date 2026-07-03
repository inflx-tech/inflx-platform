'use client';

/**
 * Follower Categories — RETIRED (Cleanup P2, contract: features/app-builder-wizard).
 *
 * This page duplicated the App Builder's "Manage worlds" panel: both wrote the
 * SAME follower_categories table (verified: adminFollowerCategories.controller
 * vs adminFollowerVerticals.controller, 2026-07-03). One brain, one surface —
 * world tabs + craving rails are managed inside the App Builder now. The route
 * stays as a pointer so old bookmarks don't 404; backend endpoints untouched.
 */

export default function FollowerCategoriesPage() {
  return (
    <div className="p-10 max-w-lg">
      <h1 className="text-lg font-bold text-gray-900 mb-2">This page moved into the App Builder</h1>
      <p className="text-sm text-gray-500 mb-4">
        The follower world tabs (and their craving rails) are managed in one place now:
        open the App Builder and use <b>⚙ Manage worlds</b>.
      </p>
      <a href="/admin/sections" className="inline-block px-4 py-2 rounded-lg bg-amber-700 text-white text-sm font-bold">
        Open the App Builder →
      </a>
    </div>
  );
}

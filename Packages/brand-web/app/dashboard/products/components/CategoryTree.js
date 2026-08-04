'use client';

/**
 * CategoryTree — the persistent left rail (contract: listing-workspace-ux).
 *
 * Replaces the old "drill one level and swap the whole screen" model. The whole
 * vertical stays on screen, so any category or item-type is one click away and
 * the brand never has to walk back up a breadcrumb.
 *
 * Shared by both Listings views:
 *   · Add products → counts come from the in-session `counts` map
 *   · Inventory    → counts come from `product_count` on /brands/me/listing-tree
 *
 * Clicking a branch expands it AND selects it (the centre moves to that level).
 * Clicking a leaf selects it only.
 */

import { useEffect, useState } from 'react';

// Trail of ancestor ids leading to `id`, or null when it isn't in the tree.
function pathTo(nodes, id, trail = []) {
  for (const n of (nodes || [])) {
    if (n.id === id) return trail;
    const hit = pathTo(n.children, id, [...trail, n.id]);
    if (hit) return hit;
  }
  return null;
}

export default function CategoryTree({
  nodes, selectedId, onSelect, countOf, title = 'Categories',
  hideEmpty = false, topItem = null, loading = false,
}) {
  const [open, setOpen] = useState({});

  // Keep the branch holding the current selection expanded — whether the
  // selection came from this rail, a card in the centre, or the breadcrumb.
  useEffect(() => {
    if (!selectedId || !nodes) return;
    const trail = pathTo(nodes, selectedId);
    if (!trail || !trail.length) return;
    setOpen(o => {
      const next = { ...o };
      trail.forEach(id => { next[id] = true; });
      return next;
    });
  }, [selectedId, nodes]);

  const visible = (list) => (list || []).filter(n => !hideEmpty || !countOf || countOf(n) > 0);

  const render = (list) => visible(list).map(n => {
    const kids = visible(n.children);
    const isOpen = !!open[n.id];
    const c = countOf ? countOf(n) : null;
    return (
      <div key={n.id}>
        <button
          className={'tnode' + (n.is_leaf ? ' leaf' : '') + (isOpen ? ' open' : '') + (selectedId === n.id ? ' on' : '')}
          onClick={() => {
            if (!n.is_leaf && kids.length) setOpen(o => ({ ...o, [n.id]: !o[n.id] }));
            onSelect(n);
          }}>
          <span className="cv">{!n.is_leaf && kids.length ? '▸' : ''}</span>
          <span className="nm">{n.name}</span>
          {c ? <span className="n">{c}</span> : null}
        </button>
        {isOpen && kids.length > 0 && <div className="tkids">{render(kids)}</div>}
      </div>
    );
  });

  const rows = render(nodes);

  return (
    <div className="card rail">
      <div className="railhd">
        <span className="t">{title}</span>
        {Object.keys(open).length > 0 && (
          <button className="a" onClick={() => setOpen({})}>Collapse</button>
        )}
      </div>
      <div className="railbody">
        {topItem && (
          <button
            className={'tnode' + (topItem.active ? ' on' : '')}
            onClick={topItem.onClick}>
            <span className="cv" />
            <span className="nm">{topItem.label}</span>
            {topItem.count ? <span className="n">{topItem.count}</span> : null}
          </button>
        )}
        {loading && <div className="railnote">Loading…</div>}
        {!loading && rows.length === 0 && (
          <div className="railnote">{hideEmpty ? 'Nothing listed yet.' : 'No categories.'}</div>
        )}
        {rows}
      </div>
    </div>
  );
}

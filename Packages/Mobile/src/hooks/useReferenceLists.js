import { useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';
import { referenceApi } from '../services/api';

/**
 * Item 3 — the four reference lists every picker and filter reads, loaded once per screen,
 * with label lookups. Contract: features/item3-discovery-profiles-groups
 */
export default function useReferenceLists() {
  const [niches, setNiches] = useState([]);
  const [languages, setLanguages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [states, setStates] = useState([]);
  /**
   * These four are for the Filters sheet, not for the list. They used to fire the moment a
   * screen mounted, four requests racing the one request the brand is actually waiting for —
   * the creators. They now wait until the screen has finished opening, so nothing competes
   * with the first paint. (Founder, 2026-09-16: the creator list took too long to appear.)
   */
  useEffect(() => {
    let alive = true;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!alive) return;
      Promise.all([referenceApi.creatorNiches(), referenceApi.languages(), referenceApi.brandCategories(), referenceApi.states()])
        .then(([n, l, c, s]) => {
          if (!alive) return;
          if (n.success) setNiches(n.data.items || []);
          if (l.success) setLanguages(l.data.items || []);
          if (c.success) setCategories(c.data.items || []);
          if (s.success) setStates(s.data.items || []);
        }).catch(() => {});
    });
    return () => { alive = false; if (task && task.cancel) task.cancel(); };
  }, []);
  const cityIndex = useMemo(() => {
    const m = new Map();
    for (const st of states) for (const c of st.cities || []) m.set(Number(c.id), { ...c, stateName: st.name });
    return m;
  }, [states]);
  return {
    niches, languages, categories, states,
    nicheLabel: (code) => niches.find(n => n.code === code)?.label || code,
    categoryLabel: (code) => categories.find(c => c.code === code)?.label || code,
    cityName: (id) => cityIndex.get(Number(id))?.name || '',
    cityState: (id) => cityIndex.get(Number(id))?.stateName || '',
  };
}

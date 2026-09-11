import { useEffect, useMemo, useState } from 'react';
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
  useEffect(() => {
    let alive = true;
    Promise.all([referenceApi.creatorNiches(), referenceApi.languages(), referenceApi.brandCategories(), referenceApi.states()])
      .then(([n, l, c, s]) => {
        if (!alive) return;
        if (n.success) setNiches(n.data.items || []);
        if (l.success) setLanguages(l.data.items || []);
        if (c.success) setCategories(c.data.items || []);
        if (s.success) setStates(s.data.items || []);
      }).catch(() => {});
    return () => { alive = false; };
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

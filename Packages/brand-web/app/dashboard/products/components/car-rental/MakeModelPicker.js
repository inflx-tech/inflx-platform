'use client';
import { useState, useEffect, useMemo } from 'react';

/**
 * Step 2: Make & Model Picker — brand grid + searchable model list.
 * Models are fetched from master_vehicles API, filtered by selected segment.
 */

export default function MakeModelPicker({ vehicles, selectedSegment, selectedMake, selectedModel, onSelectMake, onSelectModel }) {
  const [search, setSearch] = useState('');

  // Group vehicles by make
  const makes = useMemo(() => {
    const makeSet = new Map();
    for (const v of (vehicles || [])) {
      if (selectedSegment && v.segment !== selectedSegment) continue;
      if (!makeSet.has(v.make)) makeSet.set(v.make, []);
      makeSet.get(v.make).push(v);
    }
    return makeSet;
  }, [vehicles, selectedSegment]);

  // Models for selected make
  const models = useMemo(() => {
    if (!selectedMake) return [];
    const list = makes.get(selectedMake) || [];
    if (!search) return list;
    return list.filter(v => v.model.toLowerCase().includes(search.toLowerCase()));
  }, [makes, selectedMake, search]);

  const MAKE_LABELS = {
    'Maruti Suzuki': { abbr: 'MARUTI', sub: 'Suzuki' },
    'Hyundai': { abbr: 'HYUNDAI', sub: 'Korea' },
    'Toyota': { abbr: 'TOYOTA', sub: 'Japan' },
    'Mahindra': { abbr: 'MAHINDRA', sub: 'India' },
    'Tata': { abbr: 'TATA', sub: 'India' },
    'Honda': { abbr: 'HONDA', sub: 'Japan' },
    'Kia': { abbr: 'KIA', sub: 'Korea' },
    'Mercedes': { abbr: 'MERZ', sub: 'Germany' },
    'Mercedes-Benz': { abbr: 'MERZ', sub: 'Germany' },
    'BMW': { abbr: 'BMW', sub: 'Germany' },
    'Audi': { abbr: 'AUDI', sub: 'Germany' },
    'MG': { abbr: 'MG', sub: 'UK' },
    'Skoda': { abbr: 'SKODA', sub: 'Czech' },
    'Volvo': { abbr: 'VOLVO', sub: 'Sweden' },
    'Jeep': { abbr: 'JEEP', sub: 'USA' },
    'Force': { abbr: 'FORCE', sub: 'India' },
    'Jaguar': { abbr: 'JAG', sub: 'UK' },
  };

  return (
    <div className="space-y-4">
      {/* Make grid */}
      <div>
        <div className="text-sm font-bold text-gray-900 mb-1">Select make</div>
        <div className="text-xs text-gray-500 mb-3">Platform knows the specs of every model listed below</div>
        <div className="grid grid-cols-4 gap-2">
          {Array.from(makes.keys()).map(make => {
            const info = MAKE_LABELS[make] || { abbr: make.substring(0, 6).toUpperCase(), sub: '' };
            const isSelected = selectedMake === make;
            return (
              <button
                key={make}
                type="button"
                onClick={() => { onSelectMake(make); setSearch(''); }}
                className={`border-[1.5px] rounded-[10px] py-3 px-2 text-center transition-all
                  ${isSelected ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white hover:border-amber-400 hover:bg-amber-50/50'}`}
              >
                <div className="text-[11px] font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>{info.abbr}</div>
                <div className="text-[9px] text-gray-500 mt-0.5">{info.sub}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Model list */}
      {selectedMake && (
        <div>
          <div className="text-sm font-bold text-gray-900 mb-2">Select model</div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Type to search models..."
            className="w-full border-[1.5px] border-gray-200 rounded-[10px] py-2.5 px-3.5 text-sm outline-none focus:border-amber-500 transition-colors mb-3"
          />
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {models.map(v => {
              const isSelected = selectedModel?.id === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onSelectModel(v)}
                  className={`w-full flex items-center justify-between p-3 border-[1.5px] rounded-[10px] transition-all text-left
                    ${isSelected ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white hover:border-amber-400'}`}
                >
                  <div className="text-[13px] font-semibold text-gray-900">{v.model}</div>
                  <div className="flex gap-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 font-medium">{v.seats} seats</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 font-medium">{(v.fuel_type || '').split(' / ')[0]}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 font-medium">{(v.transmission || '').split(' / ')[0]}</span>
                  </div>
                </button>
              );
            })}
            {models.length === 0 && (
              <div className="text-center py-4 text-sm text-gray-400">No models found for this make & segment</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

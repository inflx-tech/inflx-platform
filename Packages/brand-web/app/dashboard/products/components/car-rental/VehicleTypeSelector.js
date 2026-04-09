'use client';

/**
 * Step 1: Vehicle Type Selector — grid of vehicle categories with SVG illustrations.
 * Matches the Car Rental HTML mockup exactly.
 */

const VEHICLE_SVGS = {
  hatchback: (
    <svg width="52" height="28" viewBox="0 0 52 28">
      <rect x="8" y="14" width="36" height="10" rx="3" fill="#d1cdc4"/>
      <rect x="14" y="7" width="22" height="11" rx="3" fill="#e5e1d8"/>
      <circle cx="14" cy="24" r="4" fill="#0d1f35"/><circle cx="38" cy="24" r="4" fill="#0d1f35"/>
      <circle cx="14" cy="24" r="2" fill="#f7f6f2"/><circle cx="38" cy="24" r="2" fill="#f7f6f2"/>
    </svg>
  ),
  sedan: (
    <svg width="56" height="28" viewBox="0 0 56 28">
      <rect x="4" y="14" width="48" height="10" rx="3" fill="#d1cdc4"/>
      <rect x="12" y="7" width="26" height="11" rx="2" fill="#e5e1d8"/>
      <circle cx="14" cy="24" r="4" fill="#0d1f35"/><circle cx="42" cy="24" r="4" fill="#0d1f35"/>
      <circle cx="14" cy="24" r="2" fill="#f7f6f2"/><circle cx="42" cy="24" r="2" fill="#f7f6f2"/>
    </svg>
  ),
  suv: (
    <svg width="54" height="32" viewBox="0 0 54 32">
      <rect x="4" y="13" width="46" height="14" rx="3" fill="#d1cdc4"/>
      <rect x="8" y="5" width="36" height="14" rx="3" fill="#e5e1d8"/>
      <circle cx="14" cy="27" r="5" fill="#0d1f35"/><circle cx="40" cy="27" r="5" fill="#0d1f35"/>
      <circle cx="14" cy="27" r="2.5" fill="#f7f6f2"/><circle cx="40" cy="27" r="2.5" fill="#f7f6f2"/>
    </svg>
  ),
  mpv: (
    <svg width="58" height="32" viewBox="0 0 58 32">
      <rect x="4" y="12" width="50" height="15" rx="3" fill="#d1cdc4"/>
      <rect x="6" y="5" width="44" height="14" rx="2" fill="#e5e1d8"/>
      <circle cx="14" cy="27" r="5" fill="#0d1f35"/><circle cx="44" cy="27" r="5" fill="#0d1f35"/>
      <circle cx="14" cy="27" r="2.5" fill="#f7f6f2"/><circle cx="44" cy="27" r="2.5" fill="#f7f6f2"/>
    </svg>
  ),
  luxury: (
    <svg width="58" height="28" viewBox="0 0 58 28">
      <rect x="2" y="14" width="54" height="10" rx="4" fill="#0d1f35"/>
      <rect x="14" y="6" width="26" height="12" rx="2" fill="#1a3050"/>
      <circle cx="14" cy="24" r="4" fill="#f59e0b"/><circle cx="44" cy="24" r="4" fill="#f59e0b"/>
      <circle cx="14" cy="24" r="2" fill="#0d1f35"/><circle cx="44" cy="24" r="2" fill="#0d1f35"/>
    </svg>
  ),
  tempo: (
    <svg width="64" height="32" viewBox="0 0 64 32">
      <rect x="2" y="10" width="58" height="16" rx="3" fill="#d1cdc4"/>
      <rect x="4" y="4" width="54" height="14" rx="2" fill="#e5e1d8"/>
      <circle cx="14" cy="27" r="4" fill="#0d1f35"/><circle cx="30" cy="27" r="4" fill="#0d1f35"/><circle cx="50" cy="27" r="4" fill="#0d1f35"/>
      <circle cx="14" cy="27" r="2" fill="#f7f6f2"/><circle cx="30" cy="27" r="2" fill="#f7f6f2"/><circle cx="50" cy="27" r="2" fill="#f7f6f2"/>
    </svg>
  ),
};

export default function VehicleTypeSelector({ options, selected, onSelect }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {(options || []).map(opt => {
        const isSelected = selected === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={`relative border-2 rounded-xl p-4 text-center transition-all cursor-pointer
              ${isSelected
                ? 'border-amber-500 bg-amber-50'
                : 'border-gray-200 bg-white hover:border-amber-400 hover:bg-amber-50/50'}`}
          >
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <polyline points="2,5 4.5,7.5 8,2.5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                </svg>
              </div>
            )}
            <div className="flex justify-center mb-2">
              {VEHICLE_SVGS[opt.icon] || VEHICLE_SVGS.sedan}
            </div>
            <div className="text-xs font-semibold text-gray-900">{opt.label}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{opt.sub}</div>
          </button>
        );
      })}
    </div>
  );
}

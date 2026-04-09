'use client';

/**
 * Step 3: Spec Confirmation — dark card showing auto-filled specs from master DB.
 * Brand just reviews and picks variant.
 */

export default function SpecConfirmation({ vehicle, selectedVariant, onSelectVariant }) {
  if (!vehicle) return <div className="text-sm text-gray-400 text-center py-8">Select a vehicle first</div>;

  const features = vehicle.features_json || [];
  const variants = (vehicle.transmission || '').split(' / ').map(v => v.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Dark spec card */}
      <div className="relative overflow-hidden rounded-[14px] bg-gradient-to-br from-[#0d1f35] to-[#1a3050] p-5 text-white">
        {/* Decorative circle */}
        <div className="absolute -top-8 -right-8 w-[120px] h-[120px] rounded-full bg-amber-500/10" />

        <div className="text-lg font-extrabold mb-0.5" style={{ fontFamily: 'Syne, sans-serif' }}>
          {vehicle.make} {vehicle.model}
        </div>
        <div className="text-[11px] text-white/50 mb-4">
          {vehicle.segment} · {vehicle.seats} seats · {vehicle.fuel_type}
        </div>

        {/* Spec chips */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {vehicle.ac && (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-[11px] font-medium text-amber-400">❄️ AC</span>
          )}
          {vehicle.sunroof && (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-[11px] font-medium text-amber-400">☀️ Sunroof</span>
          )}
          {features.map((f, i) => (
            <span key={i} className="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-medium text-white/90">{f}</span>
          ))}
        </div>

        {/* Spec grid */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { value: vehicle.seats, label: 'Seats' },
            { value: vehicle.fuel_type?.split(' / ')[0], label: 'Fuel' },
            { value: (vehicle.transmission || '').split(' / ')[0], label: 'Gearbox' },
            { value: vehicle.engine_cc, label: 'Engine' },
            { value: vehicle.kmpl, label: 'KMPL' },
            { value: vehicle.ac ? '✓ Yes' : '✗ No', label: 'AC' },
          ].map((spec, i) => (
            <div key={i} className="bg-white/[0.07] rounded-[10px] py-2.5 px-3">
              <div className="text-base font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>{spec.value}</div>
              <div className="text-[10px] text-white/45 mt-0.5">{spec.label}</div>
            </div>
          ))}
        </div>

        {/* Platform note */}
        <div className="mt-3 bg-green-100 rounded-[10px] py-2.5 px-3.5 flex items-center gap-2">
          <span className="text-sm">✓</span>
          <span className="text-xs text-green-800 font-medium">All specs auto-filled from INFLX vehicle database</span>
        </div>
      </div>

      {/* Variant selector */}
      {variants.length > 1 && (
        <div>
          <div className="text-sm font-bold text-gray-900 mb-1">Variant</div>
          <div className="text-xs text-gray-500 mb-3">Pick the specific variant of your vehicle</div>
          <div className="grid grid-cols-2 gap-2">
            {variants.map(v => {
              const isSelected = selectedVariant === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onSelectVariant(v)}
                  className={`border-[1.5px] rounded-[10px] p-3 text-left transition-all
                    ${isSelected ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white hover:border-amber-400'}`}
                >
                  <div className="text-xs font-semibold text-gray-900">{vehicle.model} — {v}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{vehicle.fuel_type} · {vehicle.seats} seats</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

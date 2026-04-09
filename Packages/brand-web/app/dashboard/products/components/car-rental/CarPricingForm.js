'use client';
import { useState } from 'react';

/**
 * Step 4: Pricing with market benchmarks + service toggles + photos.
 * Matches the HTML mockup: rate inputs with benchmark bars, service chips, photo upload.
 */

export default function CarPricingForm({ vehicle, pricing, onPricingChange, services, onServicesChange }) {
  const dayMin = vehicle?.day_rate_min || 800;
  const dayMax = vehicle?.day_rate_max || 2000;
  const kmMin = vehicle?.km_rate_min || 10;
  const kmMax = vehicle?.km_rate_max || 20;

  const allServices = vehicle?.services_json || ['Self drive', 'With driver', 'Outstation', 'Airport', 'City trips'];

  function getBenchPercent(value, min, max) {
    if (!value || value <= 0) return 0;
    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  }

  function getBenchColor(value, min, max) {
    const mid = (min + max) / 2;
    if (value < min) return '#ef4444'; // too low
    if (value > max) return '#ef4444'; // too high
    if (value < mid) return '#10b981'; // competitive
    return '#f59e0b'; // above average
  }

  return (
    <div className="space-y-6">
      {/* Pricing title */}
      <div>
        <div className="text-base font-bold text-gray-900" style={{ fontFamily: 'Syne, sans-serif' }}>
          Set your rental price
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Market rates for <strong>{vehicle?.make} {vehicle?.model}</strong> in your city are shown as guidance
        </div>
      </div>

      {/* Price fields row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Day rate */}
        <PriceField
          label="Rate per day (24 hrs)"
          unit="₹"
          required
          value={pricing?.day_rate}
          onChange={v => onPricingChange({ ...pricing, day_rate: v })}
          benchMin={dayMin}
          benchMax={dayMax}
          benchPercent={getBenchPercent(pricing?.day_rate, dayMin, dayMax)}
          benchColor={getBenchColor(pricing?.day_rate, dayMin, dayMax)}
        />
        {/* KM rate */}
        <PriceField
          label="Rate per km (outstation)"
          unit="₹/km"
          value={pricing?.km_rate}
          onChange={v => onPricingChange({ ...pricing, km_rate: v })}
          benchMin={kmMin}
          benchMax={kmMax}
          benchPercent={getBenchPercent(pricing?.km_rate, kmMin, kmMax)}
          benchColor={getBenchColor(pricing?.km_rate, kmMin, kmMax)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Security deposit */}
        <PriceField
          label="Security deposit"
          unit="₹"
          value={pricing?.security_deposit}
          onChange={v => onPricingChange({ ...pricing, security_deposit: v })}
          placeholder="5000"
        />
        {/* Extra km charge */}
        <PriceField
          label="Extra km charge (beyond limit)"
          unit="₹/km"
          value={pricing?.extra_km_charge}
          onChange={v => onPricingChange({ ...pricing, extra_km_charge: v })}
          placeholder="12"
        />
      </div>

      {/* Rate hint */}
      {pricing?.day_rate > 0 && pricing?.day_rate >= dayMin && pricing?.day_rate <= dayMax && (
        <div className="bg-amber-50 rounded-lg p-3 flex items-center gap-2">
          <span className="text-sm">💡</span>
          <span className="text-[11px] text-amber-700 font-medium">
            Your rate of ₹{pricing.day_rate}/day is {pricing.day_rate < (dayMin + dayMax) / 2 ? 'competitive — great for bookings!' : 'above average — consider lowering for more bookings'}
          </span>
        </div>
      )}

      {/* Services */}
      <div className="pt-4 border-t border-gray-200">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-3">Services you offer (confirm or change)</div>
        <div className="flex flex-wrap gap-2">
          {allServices.map(service => {
            const isActive = (services || []).includes(service);
            return (
              <button
                key={service}
                type="button"
                onClick={() => {
                  if (isActive) {
                    onServicesChange((services || []).filter(s => s !== service));
                  } else {
                    onServicesChange([...(services || []), service]);
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border-[1.5px] transition-all
                  ${isActive
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}
              >
                {isActive ? '✓ ' : ''}{service}
              </button>
            );
          })}
        </div>
      </div>

      {/* Photo upload */}
      <div>
        <div className="text-base font-bold text-gray-900 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>Quick photos</div>
        <div className="text-xs text-gray-500 mb-3">Add at least 2 photos — listings with photos get 4x more enquiries</div>

        <div className="border-2 border-dashed border-gray-300 rounded-xl p-5 text-center cursor-pointer hover:border-amber-500 transition-colors bg-gray-50">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.5" className="mx-auto mb-2">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
          <div className="text-sm font-semibold text-gray-900">Tap to upload vehicle photos</div>
          <div className="text-xs text-gray-500 mt-1">JPG or PNG · Max 5MB each</div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-3">
          {['Front', 'Rear', 'Interior', 'Dashboard'].map(slot => (
            <div key={slot} className="aspect-[4/3] border-[1.5px] border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-400 cursor-pointer hover:border-amber-500 transition-colors bg-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14"/></svg>
              <span className="text-[10px]">{slot}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PriceField({ label, unit, value, onChange, required, placeholder, benchMin, benchMax, benchPercent, benchColor }) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="flex items-center border-[1.5px] border-gray-200 rounded-[10px] overflow-hidden mt-1.5 bg-white focus-within:border-amber-500 transition-colors">
        <div className="px-2.5 h-10 flex items-center text-[13px] text-gray-500 border-r border-gray-200 bg-gray-50">{unit}</div>
        <input
          type="number"
          value={value || ''}
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
          placeholder={placeholder || '0'}
          className="flex-1 h-10 px-3 text-[15px] font-semibold text-gray-900 outline-none bg-transparent"
        />
      </div>
      {benchMin != null && benchMax != null && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 h-1 bg-gray-200 rounded-full relative">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${benchPercent || 0}%`, backgroundColor: benchColor || '#f59e0b' }}
            />
          </div>
          <span className="text-[10px] text-green-600 font-semibold">₹{benchMin}–₹{benchMax}</span>
        </div>
      )}
    </div>
  );
}

'use client';
import { useEffect, useState } from 'react';

export default function BrandsPage() {
  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold text-t1">Brands</h1>
        <p className="text-xs text-t3 mt-0.5">All registered brands on the platform</p>
      </div>
      <div className="bg-orange-pale border border-orange/20 rounded-xl p-4 text-sm text-orange-deep">
        💡 To review a specific brand, use the Approvals queue and click View on any brand row.
      </div>
    </div>
  );
}

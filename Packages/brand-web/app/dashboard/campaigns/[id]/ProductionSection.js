import Link from 'next/link';

/* Production stage — logistics overview (features/brand-cc-production, A5 step 1).
   Gives physical logistics a named home in the hub. Reads the roster already in the
   campaign payload; the actual scheduling/shipment/remote runs in the existing
   ProductionPanel (reached via "Manage logistics"). Inline actions land in a later step. */

const ACTIVE = ['contracted', 'active', 'live'];

export default function ProductionSection({ id, influencers = [] }) {
  const rows = (influencers || []).filter((ci) => ACTIVE.includes(ci.status));

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-[#E4E4E7] rounded-[14px] p-8 text-center">
        <div className="text-[13.5px] font-bold text-[#0A0A0A] mb-1">No production yet</div>
        <div className="text-[12px] text-[#71717A]">Logistics appear here once creators are contracted — store visits, shipments, or remote.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="text-[11.5px] text-[#71717A] mb-1">
        Store visits, product shipments and remote creators for this campaign. Manage each one&apos;s logistics below.
      </div>
      {rows.map((ci) => {
        const physical = ci.physical_delivery === true || ci.physical_delivery === 'true';
        const addr = (ci.delivery_address || '').trim();
        return (
          <div key={ci.id} className="bg-white border border-[#E4E4E7] rounded-[12px] p-3 flex items-center gap-3">
            <span className={`w-9 h-9 rounded-[9px] flex items-center justify-center text-[13px] ${physical ? (addr ? 'bg-[#DBEAFE] text-[#1D4ED8]' : 'bg-[#FFF7CC] text-[#6B5A00]') : 'bg-[#D1FAE5] text-[#047857]'}`}>
              {physical ? (addr ? '↗' : '◎') : '⌂'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-bold text-[#0A0A0A] truncate">
                {ci.instagram_handle ? `@${ci.instagram_handle}` : (ci.influencer_name || 'Creator')}
              </div>
              <div className="text-[11.5px] text-[#71717A] truncate">
                {physical ? (addr ? `Ship product · ${addr}` : 'Store visit · schedule a slot') : 'Remote · no logistics needed'}
              </div>
            </div>
            <Link
              href={`/dashboard/campaigns/${id}/influencers`}
              className="text-[11.5px] font-bold text-[#0A0A0A] border border-[#E4E4E7] rounded-[8px] px-3 py-1.5 no-underline hover:border-[#0A0A0A] whitespace-nowrap"
            >
              Manage logistics →
            </Link>
          </div>
        );
      })}
    </div>
  );
}

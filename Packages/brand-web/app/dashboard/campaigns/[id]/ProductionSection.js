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
        // Item 11, finding 2: `ci.delivery_address` was read here to decide the icon and the
        // line. It is a creator street address, the roster no longer sends it, and nothing
        // ever wrote it. The mode says everything this card needs — and says it correctly:
        // a shipment is not "no logistics needed", it is the whole of item 11.
        const mode = ci.mode || ci.production_mode || null;
        const isVisit = mode === 'visit';
        const isRemote = mode === 'shipment' || mode === 'remote';
        return (
          <div key={ci.id} className="bg-white border border-[#E4E4E7] rounded-[12px] p-3 flex items-center gap-3">
            <span className={`w-9 h-9 rounded-[9px] flex items-center justify-center text-[13px] ${isRemote ? 'bg-[#DBEAFE] text-[#1D4ED8]' : isVisit ? 'bg-[#FFF7CC] text-[#6B5A00]' : 'bg-[#F4F4F5] text-[#71717A]'}`}>
              {isRemote ? '↗' : isVisit ? '◎' : '·'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-bold text-[#0A0A0A] truncate">
                {ci.instagram_handle ? `@${ci.instagram_handle}` : (ci.influencer_name || 'Creator')}
              </div>
              <div className="text-[11.5px] text-[#71717A] truncate">
                {isRemote ? 'Remote · products are shipped to her, in the app'
                  : isVisit ? 'Store visit · agreed in the app'
                  : 'Not started'}
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

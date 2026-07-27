import { useEffect, useState } from 'react';
import { deliverableApi } from '../../../../lib/api';

/* Shared review UI parts (features/brand-cc-review, A2). One MediaPreview,
   used by the hub — replaces the copy previously duplicated in reviews/page.js. */

export function MediaPreview({ deliverableId, mediaType }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!deliverableId) return;
    let cancelled = false;
    deliverableApi.getMediaUrl(deliverableId).then((res) => {
      if (cancelled) return;
      if (res.success && res.data?.url) setUrl(res.data.url);
      else setErrored(true);
    }).catch(() => { if (!cancelled) setErrored(true); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deliverableId]);

  if (loading) {
    return (
      <div className="mb-2 bg-[#FAFAFA] border border-[#E4E4E7] rounded-[12px] p-5 text-center">
        <div className="text-[11px] text-[#71717A]">Loading media…</div>
      </div>
    );
  }
  if (errored || !url) {
    return <div className="mb-2 text-[11px] text-[#A1A1AA]">No preview available.</div>;
  }

  const isVideo = (mediaType || '').startsWith('video');
  return (
    <div className="mb-2 bg-[#0A0A0A] rounded-[12px] overflow-hidden">
      {isVideo ? (
        <video src={url} controls playsInline className="w-full max-h-[340px]" style={{ objectFit: 'contain' }} />
      ) : (
        <img src={url} alt="Submitted content" className="w-full max-h-[340px] object-contain" />
      )}
    </div>
  );
}

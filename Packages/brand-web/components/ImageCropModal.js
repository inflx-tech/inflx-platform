'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * ImageCropModal — shared crop-to-frame uploader step (image-crop-uploader P1).
 *
 * The follower app renders every image in a FIXED-aspect box with object-fit
 * cover (crops overflow). This modal lets the admin/brand see their photo inside
 * that exact frame, AUTO-CENTERED (covering the frame), and drag/zoom only when
 * the auto-fit clipped something. Output is a JPEG cropped to the target aspect
 * so the phone never crops unexpectedly again — WYSIWYG (the preview canvas and
 * the exported canvas use the identical transform).
 *
 * Props:
 *   file       — the picked File (image/*)
 *   aspect     — target width/height ratio (e.g. 1.5 for 3:2)
 *   outW,outH  — export pixel size (defaults derived from aspect at 1080 wide)
 *   title      — frame caption (e.g. "Full-width banner · 3:2")
 *   onCancel() — dismiss without uploading
 *   onDone(File) — returns the cropped JPEG as a File named like the original
 */
export default function ImageCropModal({ file, aspect = 1, outW, outH, title, onCancel, onDone }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(1);
  const stateRef = useRef({ tx: 0, ty: 0, base: 1, iw: 0, ih: 0, zoom: 1 });
  const dragRef = useRef(null);

  // Display frame size (CSS px) — width fixed, height from aspect.
  const FRAME_W = 320;
  const FRAME_H = Math.round(FRAME_W / aspect);
  const targetW = outW || (aspect >= 1 ? 1080 : Math.round(1080 * aspect));
  const targetH = outH || Math.round(targetW / aspect);

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Clamp pan so the (scaled) image always covers the frame.
  const clampPan = (tx, ty, s, iw, ih) => ({
    tx: clamp(tx, FRAME_W - iw * s, 0),
    ty: clamp(ty, FRAME_H - ih * s, 0),
  });

  const draw = useCallback(() => {
    const canvas = canvasRef.current, img = imgRef.current;
    if (!canvas || !img) return;
    const st = stateRef.current;
    const s = st.base * st.zoom;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, FRAME_W, FRAME_H);
    ctx.drawImage(img, st.tx, st.ty, st.iw * s, st.ih * s);
  }, [FRAME_W, FRAME_H]);

  // Load the picked file, compute the cover ("base") scale, auto-center.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const base = Math.max(FRAME_W / iw, FRAME_H / ih); // cover
      const s = base;
      const tx = (FRAME_W - iw * s) / 2;                 // centered
      const ty = (FRAME_H - ih * s) / 2;
      stateRef.current = { tx, ty, base, iw, ih, zoom: 1 };
      setZoom(1);
      setReady(true);
      requestAnimationFrame(draw);
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); onCancel?.(); };
    img.src = url;
  }, [file, FRAME_W, FRAME_H, draw, onCancel]);

  const onZoom = (z) => {
    const st = stateRef.current;
    const s = st.base * z;
    // keep the frame centre anchored while zooming
    const cx = FRAME_W / 2, cy = FRAME_H / 2;
    const prevS = st.base * st.zoom;
    const ratio = s / prevS;
    let tx = cx - (cx - st.tx) * ratio;
    let ty = cy - (cy - st.ty) * ratio;
    ({ tx, ty } = clampPan(tx, ty, s, st.iw, st.ih));
    stateRef.current = { ...st, tx, ty, zoom: z };
    setZoom(z);
    requestAnimationFrame(draw);
  };

  const pos = (e) => { const t = e.touches?.[0]; return { x: (t || e).clientX, y: (t || e).clientY }; };
  const onDown = (e) => { const p = pos(e); dragRef.current = { ...p, tx: stateRef.current.tx, ty: stateRef.current.ty }; };
  const onMove = (e) => {
    if (!dragRef.current) return;
    const p = pos(e); const st = stateRef.current; const s = st.base * st.zoom;
    let tx = dragRef.current.tx + (p.x - dragRef.current.x);
    let ty = dragRef.current.ty + (p.y - dragRef.current.y);
    ({ tx, ty } = clampPan(tx, ty, s, st.iw, st.ih));
    stateRef.current = { ...st, tx, ty };
    requestAnimationFrame(draw);
  };
  const onUp = () => { dragRef.current = null; };

  const save = () => {
    const img = imgRef.current; if (!img) return;
    const st = stateRef.current;
    const s = st.base * st.zoom;
    const k = targetW / FRAME_W; // scale display transform → export pixels
    const off = document.createElement('canvas');
    off.width = targetW; off.height = targetH;
    const ctx = off.getContext('2d');
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, targetW, targetH);
    ctx.drawImage(img, st.tx * k, st.ty * k, st.iw * s * k, st.ih * s * k);
    off.toBlob((blob) => {
      if (!blob) { onCancel?.(); return; }
      const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg';
      onDone?.(new File([blob], name, { type: 'image/jpeg' }));
    }, 'image/jpeg', 0.9);
  };

  return (
    <div style={ovl} onClick={onCancel}>
      <div style={box} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>Position your image</div>
        <div style={{ fontSize: 11.5, color: '#71717A', marginBottom: 10 }}>
          {title ? `${title} — ` : ''}it’s auto-centred. Drag or zoom only if something important is cut off.
        </div>
        <div style={{ ...frameWrap, width: FRAME_W, height: FRAME_H }}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}>
          <canvas ref={canvasRef} width={FRAME_W} height={FRAME_H} style={{ display: 'block', cursor: 'move', touchAction: 'none' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <span style={{ fontSize: 12, color: '#71717A' }}>Zoom</span>
          <input type="range" min="1" max="3" step="0.01" value={zoom} disabled={!ready}
            onChange={(e) => onZoom(Number(e.target.value))} style={{ flex: 1 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
          <button onClick={onCancel} style={btnGhost}>Cancel</button>
          <button onClick={save} disabled={!ready} style={btnInk}>Use this crop</button>
        </div>
      </div>
    </div>
  );
}

const ovl = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
const box = { background: '#fff', borderRadius: 16, padding: 18, width: 'auto', maxWidth: 380, boxShadow: '0 25px 50px -12px rgba(0,0,0,.25)' };
const frameWrap = { borderRadius: 12, overflow: 'hidden', background: '#f1f1ee', border: '1px solid #E4E4E7', margin: '0 auto' };
const btnGhost = { border: '1px solid #E4E4E7', background: '#fff', borderRadius: 10, padding: '9px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' };
const btnInk = { border: 0, background: '#0A0A0A', color: '#FFC107', borderRadius: 10, padding: '9px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer' };

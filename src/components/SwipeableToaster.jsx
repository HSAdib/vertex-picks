import { useToaster, toast } from 'react-hot-toast';
import { useRef } from 'react';

/**
 * SwipeableToaster — replaces <Toaster>.
 * • Swipe left OR right on any toast to instantly dismiss it.
 * • Click any toast to dismiss it immediately.
 * • Positioned just below the navbar — never covers nav buttons.
 */
export default function SwipeableToaster() {
  const { toasts, handlers } = useToaster({ duration: 3000 });
  const { startPause, endPause, calculateOffset, updateHeight } = handlers;

  return (
    <>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-12px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes toast-out {
          from { opacity: 1; transform: scale(1); }
          to   { opacity: 0; transform: scale(0.88); }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          top: 'calc(var(--nav-height, 72px) + 10px)',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          pointerEvents: 'none',
          width: '100%',
          maxWidth: '420px',
          padding: '0 16px',
          boxSizing: 'border-box',
        }}
        onMouseEnter={startPause}
        onMouseLeave={endPause}
      >
        {toasts.map((t) => {
          const ref = (el) => {
            if (el && !t.height) updateHeight(t.id, el.getBoundingClientRect().height);
          };
          return <SwipeableToast key={t.id} t={t} toastRef={ref} />;
        })}
      </div>
    </>
  );
}

function SwipeableToast({ t, toastRef }) {
  const startXRef = useRef(null);
  const currentXRef = useRef(0);
  const elRef = useRef(null);
  const dismissedRef = useRef(false);

  const SWIPE_THRESHOLD = 55;

  const applyTransform = (x) => {
    if (!elRef.current) return;
    const opacity = Math.max(0, 1 - Math.abs(x) / 140);
    elRef.current.style.transform = `translateX(${x}px)`;
    elRef.current.style.opacity = String(opacity);
  };

  const onTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = 0;
    if (elRef.current) elRef.current.style.transition = '';
  };

  const onTouchMove = (e) => {
    if (startXRef.current === null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    currentXRef.current = dx;
    applyTransform(dx);
  };

  const onTouchEnd = () => {
    if (Math.abs(currentXRef.current) > SWIPE_THRESHOLD && !dismissedRef.current) {
      dismissedRef.current = true;
      const dir = currentXRef.current > 0 ? 220 : -220;
      if (elRef.current) {
        elRef.current.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
        applyTransform(dir);
      }
      setTimeout(() => toast.dismiss(t.id), 200);
    } else {
      if (elRef.current) {
        elRef.current.style.transition = 'transform 0.28s cubic-bezier(0.16,1,0.3,1), opacity 0.28s ease';
        applyTransform(0);
        setTimeout(() => { if (elRef.current) elRef.current.style.transition = ''; }, 280);
      }
      currentXRef.current = 0;
    }
    startXRef.current = null;
  };

  const onMouseDown = (e) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    currentXRef.current = 0;
    if (elRef.current) { elRef.current.style.transition = ''; elRef.current.style.cursor = 'grabbing'; }

    const onMouseMove = (me) => {
      if (startXRef.current === null) return;
      const dx = me.clientX - startXRef.current;
      currentXRef.current = dx;
      applyTransform(dx);
    };
    const onMouseUp = () => {
      if (elRef.current) elRef.current.style.cursor = 'grab';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      onTouchEnd();
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const isSuccess = t.type === 'success';
  const isError = t.type === 'error';
  const isLoading = t.type === 'loading';

  const accentColor = isSuccess ? '#4ade80' : isError ? '#f87171' : isLoading ? '#facc15' : '#94a3b8';
  const icon = isLoading ? '⏳' : isSuccess ? '✓' : isError ? '✕' : 'ℹ';

  const message = typeof t.message === 'string' ? t.message : '';

  if (!t.visible && !message) return null;

  return (
    <div
      ref={(el) => {
        elRef.current = el;
        if (toastRef) toastRef(el);
      }}
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        background: '#1a1a1a',
        color: '#ffffff',
        borderRadius: '100px',
        padding: '10px 14px 10px 10px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.3)',
        fontFamily: "'Sora', sans-serif",
        fontSize: '0.82rem',
        fontWeight: 600,
        maxWidth: '100%',
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'pan-y',
        willChange: 'transform, opacity',
        animation: t.visible
          ? 'toast-in 0.28s cubic-bezier(0.16,1,0.3,1) forwards'
          : 'toast-out 0.2s ease forwards',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        opacity: t.visible ? 1 : 0,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onClick={() => { if (Math.abs(currentXRef.current) < 5) toast.dismiss(t.id); }}
    >
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: `${accentColor}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.72rem', fontWeight: 900, color: accentColor, flexShrink: 0,
      }}>
        {icon}
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{message}</span>
      <span style={{ opacity: 0.4, fontSize: '0.65rem', flexShrink: 0, marginLeft: 2 }}>✕</span>
    </div>
  );
}

import { useEffect, useRef } from 'react';

const MIN_DISPLAY_MS = 1200;
const PRELOAD_TIMEOUT_MS = 5000;
const LOADER_BG_URL = 'https://webcnstatic.yostar.net/ba_cn_web/prod/web/assets/loading_bg_pc.ba246778.png';
function preloadImage(src: string): Promise<void> {
  return new Promise<void>(resolve => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

export const BootLoader = ({ onComplete }: { onComplete: () => void }) => {
  const startedAt = useRef(performance.now());

  useEffect(() => {
    let minDelayTimer = 0;
    let preloadTimeout = 0;
    let completed = false;

    const complete = () => {
      if (completed) return;
      completed = true;
      window.clearTimeout(preloadTimeout);
      const elapsed = performance.now() - startedAt.current;
      const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed);
      if (remaining > 0) {
        minDelayTimer = window.setTimeout(onComplete, remaining);
      } else {
        onComplete();
      }
    };

    preloadTimeout = window.setTimeout(complete, PRELOAD_TIMEOUT_MS);

    void preloadImage(LOADER_BG_URL).then(complete);

    return () => {
      completed = true;
      window.clearTimeout(preloadTimeout);
      window.clearTimeout(minDelayTimer);
    };
  }, [onComplete]);

  return (
  <div className="ba-loader">
    <div className="ba-loader__bg" />

    <div className="ba-loader__info">
      <h1 className="ba-loader__title">CONNECTING...</h1>
    </div>
    </div>
  );
};

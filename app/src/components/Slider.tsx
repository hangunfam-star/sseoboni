"use client";
import { Children, useCallback, useEffect, useRef, useState } from "react";

// param: label 슬라이드 묶음 이름(화면 읽기용), autoMs 자동 넘김 간격(없으면 자동 없음), peek 다음 장을 살짝 보이게, children 슬라이드들
// return: 손가락으로 넘기는 가로 슬라이드 + 점(눌러서 이동) + 이전/다음 버튼. 사용자가 만지면 자동 넘김을 멈춘다.
export function Slider({ label, autoMs, peek = false, children }: { label: string; autoMs?: number; peek?: boolean; children: React.ReactNode }) {
  const slides = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((i: number) => {
    const el = track.current?.children[i] as HTMLElement | undefined;
    if (el && track.current) track.current.scrollTo({ left: el.offsetLeft - track.current.offsetLeft, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const t = track.current;
    if (!t) return;
    const onScroll = () => {
      const kids = Array.from(t.children) as HTMLElement[];
      let best = 0, dist = Infinity;
      kids.forEach((k, i) => { const d = Math.abs(k.offsetLeft - t.offsetLeft - t.scrollLeft); if (d < dist) { dist = d; best = i; } });
      setActive(best);
    };
    t.addEventListener("scroll", onScroll, { passive: true });
    return () => t.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!autoMs || paused || slides.length < 2) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => { if (document.visibilityState === "visible") go((active + 1) % slides.length); }, autoMs);
    return () => clearInterval(timer);
  }, [autoMs, paused, active, slides.length, go]);

  const stop = () => setPaused(true);
  return (
    <div className={`slider${peek ? " slider--peek" : ""}`} role="region" aria-roledescription="슬라이드" aria-label={label} onPointerDown={stop} onFocusCapture={stop}>
      <div ref={track} className="slider__track">
        {slides.map((s, i) => (
          <div key={i} className="slider__slide" role="group" aria-roledescription="슬라이드" aria-label={`${i + 1} / ${slides.length}`}>{s}</div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="slider__nav">
          <button type="button" className="slider__arrow" aria-label="이전" disabled={active === 0} onClick={() => { stop(); go(active - 1); }}>‹</button>
          <div className="slider__dots">
            {slides.map((_, i) => (
              <button key={i} type="button" className="slider__dot" aria-label={`${i + 1}번째로`} aria-current={i === active ? "true" : undefined} onClick={() => { stop(); go(i); }} />
            ))}
          </div>
          <button type="button" className="slider__arrow" aria-label="다음" disabled={active === slides.length - 1} onClick={() => { stop(); go(active + 1); }}>›</button>
        </div>
      )}
    </div>
  );
}

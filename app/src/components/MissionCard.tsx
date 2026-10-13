"use client";
import { useEffect, useId, useState } from "react";

const KEY = "sb_mission_closed";

// param: tag 꼬리표, title 제목, children 펼쳤을 때 본문. 오른쪽 위 닫기(×)로 접고, 접힌 줄을 누르면 다시 연다. 이 기기에 기억한다.
export function MissionCard({ tag, title, children }: { tag: string; title: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  useEffect(() => {
    let closed = false;
    try { closed = localStorage.getItem(KEY) === "1"; } catch { /* 저장소를 못 쓰면 늘 펼침 */ }
    if (closed) void Promise.resolve().then(() => setOpen(false));
  }, []);
  const toggle = (next: boolean) => {
    setOpen(next);
    try { localStorage.setItem(KEY, next ? "0" : "1"); } catch { /* 기억 못 해도 동작은 함 */ }
  };

  if (!open) {
    return (
      <section className="try-hero try-hero--closed">
        <button type="button" className="try-hero__reopen" aria-expanded="false" aria-controls={bodyId} onClick={() => toggle(true)}>
          <span className="try-hero__tag">{tag}</span>
          <span className="try-hero__reopen-text">미션 보기</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </section>
    );
  }
  return (
    <section className="try-hero" id={bodyId} aria-labelledby={`${bodyId}-t`}>
      <button type="button" className="try-hero__close" aria-label="베타테스터 미션 닫기" aria-expanded="true" onClick={() => toggle(false)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      <span className="try-hero__tag">{tag}</span>
      <h2 id={`${bodyId}-t`}>{title}</h2>
      {children}
    </section>
  );
}

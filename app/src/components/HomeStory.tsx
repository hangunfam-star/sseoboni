"use client";

import { useEffect, useRef, useState } from "react";

// 홈 상단 스토리 영상(6초, Grok 생성·로고 제거): 중고 맥북 후회 → 써보니로 먼저 써보기 → 만족 후 구매.
// 영상은 AI로 만든 연출이며, 써보기는 아직 준비 중임을 화면에 함께 밝힌다.
const SCENES = [
  { at: 0, text: "중고로 산 맥북, 화면이 깜빡여요. 이미 산 뒤였죠." },
  { at: 1.9, text: "이번엔 써보니로, 사기 전에 먼저 써봤어요" },
  { at: 4.6, text: "마음에 들어서 샀어요. 사기 전에, 써보니." },
];

// param: t 현재 재생 시각(초)
// return: 그 시각에 보여 줄 장면 번호(0부터)
function sceneAt(t: number): number {
  let i = 0;
  SCENES.forEach((s, k) => { if (t >= s.at) i = k; });
  return i;
}

const CLOSED_KEY = "sb_story_closed";

export function HomeStory() {
  const video = useRef<HTMLVideoElement>(null);
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [open, setOpen] = useState(true);

  // 닫아 둔 기기에서는 접힌 줄로 시작(미션 카드와 같은 방식)
  useEffect(() => {
    let closed = false;
    try { closed = localStorage.getItem(CLOSED_KEY) === "1"; } catch { /* 저장소를 못 쓰면 늘 펼침 */ }
    if (closed) void Promise.resolve().then(() => setOpen(false));
  }, []);
  const setStory = (next: boolean) => {
    setOpen(next);
    try { localStorage.setItem(CLOSED_KEY, next ? "0" : "1"); } catch { /* 기억 못 해도 동작은 함 */ }
  };

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    // 움직임 줄이기 설정을 켠 사용자에게는 자동 재생하지 않는다.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      v.pause();
    }
  }, [open]);

  function toggle() {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play(); else v.pause();
  }

  if (!open) {
    return (
      <section className="home-story home-story--closed" aria-label="써보니 소개 영상">
        <button type="button" className="home-story__reopen" aria-expanded="false" onClick={() => setStory(true)}>
          <span className="home-story__reopen-play" aria-hidden="true">▶</span>
          <span className="home-story__reopen-text">써보니 소개 영상 보기</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
        </button>
      </section>
    );
  }
  return (
    <section className="home-story" aria-label="써보니 소개 영상">
      <button type="button" className="home-story__close" aria-label="소개 영상 닫기" aria-expanded="true" onClick={() => setStory(false)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      <video
        ref={video}
        className="home-story__video"
        src="/hero/story.mp4"
        poster="/hero/story-poster.webp"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setScene(sceneAt(e.currentTarget.currentTime))}
      />
      <div className="home-story__shade" aria-hidden="true" />
      <ol className="home-story__bars" aria-hidden="true">
        {SCENES.map((s, k) => <li key={s.at} data-state={k < scene ? "done" : k === scene ? "now" : "next"} />)}
      </ol>
      <span className="home-story__label">AI로 만든 연출 영상 · 써보기 준비 중</span>
      <div className="home-story__copy">
        <p className="home-story__caption" aria-live="off">{SCENES[scene].text}</p>
        <h1 className="home-story__title">중고, 이제<br />써보고 사세요.</h1>
      </div>
      <button type="button" className="home-story__toggle" onClick={toggle} aria-label={playing ? "영상 멈추기" : "영상 재생"}>
        {playing
          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>}
      </button>
    </section>
  );
}

"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { currentEnv, dismissInstall, enablePush, openInBrowser, readMemo, registerSW, writeMemo, type Env } from "@/ui/pwa";

type BipEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type W = Window & { __sbBip?: BipEvent | null };
// 설치했으면 브라우저 탭으로 다시 열어도 1년 동안 안내하지 않는다(설치 여부는 탭에서 알 수 없음, MY에서 언제든 다시 볼 수 있음)
const INSTALLED_QUIET = 365 * 24 * 3600_000;
const SHOW_ON = ["/", "/me", "/wishlist", "/demand", "/notifications"]; // 하던 일을 막지 않게 둘러보는 화면에서만

const ShareGlyph = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>;
const AddGlyph = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8v8M8 12h8" /></svg>;

// param: env 접속 환경, canPrompt 안드로이드 설치 창을 바로 열 수 있는지, onInstall 설치 버튼, onOpenBrowser 기본 브라우저로 열기
// return: 환경별 설치 방법 본문(레이어와 MY 알림 설정 화면에서 같이 쓴다)
export function InstallGuide({ env, canPrompt, onInstall, onOpenBrowser }: { env: Env; canPrompt: boolean; onInstall?: () => void; onOpenBrowser?: () => void }) {
  if (env === "standalone") return <p className="install-done">이미 홈 화면에서 열었어요.</p>;
  if (env === "ios") {
    return (
      <ol className="install-steps">
        <li><span className="install-steps__num">1</span><span>사파리 아래쪽 <b>공유</b> 버튼을 눌러요</span><span className="install-steps__glyph"><ShareGlyph /></span></li>
        <li><span className="install-steps__num">2</span><span><b>홈 화면에 추가</b>를 골라요</span><span className="install-steps__glyph"><AddGlyph /></span></li>
        <li><span className="install-steps__num">3</span><span>홈 화면의 <b>써보니</b>로 열고 알림을 허용해요</span><span className="install-steps__glyph install-steps__glyph--app">써</span></li>
      </ol>
    );
  }
  if (env === "kakao" || env === "inapp-android") {
    return <button type="button" className="kakao-button install-open" onClick={onOpenBrowser}>기본 브라우저로 열기</button>;
  }
  if (env === "inapp-ios") {
    return <p className="install-why">오른쪽 아래(또는 위) <b>⋯</b> 버튼을 눌러 <b>Safari로 열기</b>를 고른 뒤, 사파리에서 홈 화면에 추가해 주세요.</p>;
  }
  if (env === "android") {
    return canPrompt
      ? <button type="button" className="primary-button" onClick={onInstall}>홈 화면에 추가</button>
      : <p className="install-why">브라우저 오른쪽 위 <b>⋮</b> 메뉴에서 <b>홈 화면에 추가</b>(또는 <b>앱 설치</b>)를 눌러 주세요.</p>;
  }
  return <p className="install-why">휴대폰에서 열면 홈 화면에 추가할 수 있어요. PC에서는 아래 알림 켜기로 브라우저 알림을 받을 수 있어요.</p>;
}

const HEAD: Partial<Record<Env, [string, string]>> = {
  android: ["써보니를 홈 화면에 추가할까요?", "앱처럼 바로 열리고 알림을 받을 수 있어요"],
  ios: ["아이폰은 홈 화면에 추가해야 알림을 받을 수 있어요", "한 번만 하면 돼요 · 10초"],
  kakao: ["카카오톡 안에서는 홈 화면에 추가할 수 없어요", "기본 브라우저로 열면 추가할 수 있어요"],
  "inapp-android": ["앱 안 브라우저에서는 홈 화면에 추가할 수 없어요", "기본 브라우저로 열면 추가할 수 있어요"],
  "inapp-ios": ["앱 안 브라우저에서는 홈 화면에 추가할 수 없어요", "사파리로 열면 추가할 수 있어요"],
};

// 접속했을 때 홈 화면에 추가돼 있지 않으면 설치 안내 레이어를 띄운다. 홈 화면에서 처음 열면 알림 허용 안내를 띄운다.
// 규칙: 둘러보는 화면에서만, 로딩 화면이 끝나고 3초 뒤. 닫으면 7일(세 번째부터 30일). 거래 알림이 생기면 한 번 더.
export function InstallPrompt() {
  const pathname = usePathname();
  const [mode, setMode] = useState<"install" | "notify" | null>(null);
  const [env, setEnv] = useState<Env>("desktop");
  const [canPrompt, setCanPrompt] = useState(false);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const forcedRef = useRef(false);

  useEffect(() => {
    void registerSW();
    const sync = () => setCanPrompt(Boolean((window as W).__sbBip));
    sync();
    window.addEventListener("sb-bip", sync);
    const installed = () => { (window as W).__sbBip = null; setCanPrompt(false); setMode(null); writeMemo({ forced: true, until: Date.now() + INSTALLED_QUIET }); };
    window.addEventListener("appinstalled", installed);
    return () => { window.removeEventListener("sb-bip", sync); window.removeEventListener("appinstalled", installed); };
  }, []);

  useEffect(() => {
    if (!SHOW_ON.includes(pathname)) return;
    const e = currentEnv();
    if (e === "desktop") return;
    let cancelled = false;
    const splash = !document.documentElement.classList.contains("no-splash") && performance.now() < 2500;
    const timer = setTimeout(async () => {
      setEnv(e);
      const memo = readMemo();
      if (e === "standalone") {
        if (!memo.askedNotify && "Notification" in window && Notification.permission === "default" && !cancelled) setMode("notify");
        return;
      }
      const due = memo.until < Date.now();
      let force = false;
      if (!memo.forced) {
        const c = await fetch("/api/notifications?count=1").then((r) => r.json()).catch(() => null);
        force = Boolean(c?.tradeUnread);
      }
      if (cancelled || (!due && !force)) return;
      forcedRef.current = force;
      setMode("install");
    }, (splash ? 1900 : 0) + 3000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [pathname]);

  const close = useCallback(() => {
    if (mode === "install") { dismissInstall(); if (forcedRef.current) writeMemo({ forced: true }); }
    if (mode === "notify") writeMemo({ askedNotify: true });
    setMode(null);
  }, [mode]);

  useEffect(() => {
    if (!mode) return;
    sheet.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, close]);

  async function install() {
    const bip = (window as W).__sbBip;
    if (!bip) return;
    await bip.prompt();
    const choice = await bip.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    (window as W).__sbBip = null;
    setCanPrompt(false);
    if (choice.outcome === "accepted") { writeMemo({ forced: true, until: Date.now() + INSTALLED_QUIET }); setMode(null); } else close();
  }

  async function turnOn() {
    setNotifyMsg(null);
    const r = await enablePush();
    if (r === "on") { writeMemo({ askedNotify: true }); setMode(null); return; }
    setNotifyMsg(r === "denied" ? "알림이 막혀 있어요. 휴대폰 설정 > 알림에서 써보니를 허용해 주세요." : "알림을 켜지 못했어요. MY > 알림 설정에서 다시 시도해 주세요.");
  }

  if (!mode || !SHOW_ON.includes(pathname)) return null; // 다른 화면으로 가면 숨김
  const head = HEAD[env];
  return (
    <div className="install-layer" role="presentation" onClick={close}>
      <div ref={sheet} className="install-sheet" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(e) => e.stopPropagation()}>
        <span className="install-sheet__grab" aria-hidden="true" />
        <div className="install-sheet__head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" width={56} height={56} />
          <div>
            <h2 id="install-title">{mode === "notify" ? "알림을 켜 둘까요?" : head?.[0]}</h2>
            <p>{mode === "notify" ? "거래 기한과 새 채팅을 놓치지 않게 알려 드려요" : head?.[1]}</p>
          </div>
        </div>
        {mode === "notify" ? (
          <>
            <ul className="install-why install-why--list">
              <li>🔔 <b>거래 기한</b>(입금·발송·체험 종료)을 미리 알려 드려요</li>
              <li>💬 새 채팅이 오면 바로 알려 드려요</li>
              <li>🌙 밤 10시~아침 8시에는 거래 알림만 보내요</li>
            </ul>
            <button type="button" className="primary-button" onClick={turnOn}>알림 켜기</button>
            {notifyMsg && <p className="form-error" role="alert">{notifyMsg}</p>}
          </>
        ) : (
          <>
            {env === "android" && (
              <ul className="install-why install-why--list">
                <li>🔔 <b>거래 기한</b>을 놓치지 않게 알려 드려요</li>
                <li>💬 새 채팅이 오면 바로 알려 드려요</li>
                <li>📱 설치 용량 거의 없음 · 언제든 지울 수 있어요</li>
              </ul>
            )}
            {env === "kakao" && <p className="install-why">지금 보던 화면 그대로 열려요. 로그인은 카카오로 다시 이어져요.</p>}
            <InstallGuide env={env} canPrompt={canPrompt} onInstall={install} onOpenBrowser={() => openInBrowser(location.href, env)} />
          </>
        )}
        <button type="button" className="install-sheet__later" onClick={close}>다음에 할게요</button>
        {env === "ios" && mode === "install" && <p className="install-sheet__arrow" aria-hidden="true">화면 맨 아래 공유 버튼 ↓</p>}
      </div>
    </div>
  );
}

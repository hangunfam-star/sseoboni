"use client";
import { useEffect, useState } from "react";
import { InstallGuide } from "@/components/InstallPrompt";
import { currentEnv, disablePush, enablePush, openInBrowser, pushState, type Env } from "@/ui/pwa";

type Prefs = { chat: boolean; interest: boolean; review: boolean; quiet: boolean };
type W = Window & { __sbBip?: (Event & { prompt: () => Promise<void> }) | null };
const ROWS: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: "chat", label: "채팅", hint: "새 메시지(5분 안 여러 개는 한 번만)" },
  { key: "interest", label: "관심", hint: "찜한 상품 가격 내림·판매완료, 찾던 상품, 하루 한 번 내 상품 반응" },
  { key: "review", label: "후기", hint: "거래가 끝나고 3일 뒤 후기 요청" },
  { key: "quiet", label: "밤에는 조용히", hint: "밤 10시~아침 8시에는 거래 알림만 바로 보내요" },
];

// param: prefs 지금 설정. return: 이 기기 알림·홈 화면 추가·종류별 설정
export function NotifySettings({ prefs }: { prefs: Prefs }) {
  const [p, setP] = useState(prefs);
  const [env, setEnv] = useState<Env>("desktop");
  const [push, setPush] = useState<"unsupported" | "denied" | "on" | "off" | "loading">("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);

  useEffect(() => {
    void pushState().then((s) => {
      setEnv(currentEnv());
      setCanPrompt(Boolean((window as W).__sbBip));
      setPush(s);
    });
  }, []);

  async function toggle(key: keyof Prefs) {
    const next = { ...p, [key]: !p[key] };
    setP(next);
    const r = await fetch("/api/notifications/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [key]: next[key] }) }).catch(() => null);
    if (!r?.ok) { setP(p); setMsg("설정을 저장하지 못했어요. 다시 시도해 주세요."); }
  }
  async function pushOn() {
    setBusy(true); setMsg(null);
    const r = await enablePush();
    setBusy(false);
    if (r === "on") setPush("on");
    else if (r === "denied") { setPush("denied"); setMsg("알림이 막혀 있어요. 휴대폰(브라우저) 설정 > 알림에서 써보니를 허용해 주세요."); }
    else if (r === "unsupported") setPush("unsupported");
    else setMsg("알림을 켜지 못했어요. 잠시 후 다시 시도해 주세요.");
  }
  async function pushOff() {
    setBusy(true); await disablePush(); setBusy(false); setPush("off");
  }
  async function install() {
    const bip = (window as W).__sbBip;
    if (bip) { await bip.prompt(); (window as W).__sbBip = null; setCanPrompt(false); }
  }

  return (
    <div className="notify-settings">
      <section className="link-card" aria-labelledby="device-title">
        <h2 id="device-title" className="notify-settings__title">이 기기로 알림 받기</h2>
        {push === "loading" && <p className="field-hint">확인하는 중…</p>}
        {push === "on" && <><p className="notify-settings__state is-on">켜짐 · 이 기기로 알림을 받아요</p><button type="button" className="secondary-button" disabled={busy} onClick={pushOff}>이 기기 알림 끄기</button></>}
        {push === "off" && <button type="button" className="primary-button" disabled={busy} onClick={pushOn}>{busy ? "켜는 중…" : "알림 켜기"}</button>}
        {push === "denied" && <p className="form-error">알림이 막혀 있어요. 휴대폰(브라우저) 설정 &gt; 알림에서 써보니를 허용한 뒤 다시 열어 주세요.</p>}
        {push === "unsupported" && <p className="field-hint">{env === "ios" ? "아이폰은 아래 방법으로 홈 화면에 추가한 뒤, 홈 화면의 써보니 아이콘으로 열면 알림을 켤 수 있어요." : "이 브라우저는 알림을 지원하지 않아요. 크롬·사파리 같은 기본 브라우저로 열어 주세요."}</p>}
        {msg && <p className="form-error" role="alert">{msg}</p>}
      </section>

      <section className="link-card" aria-labelledby="install-title2">
        <h2 id="install-title2" className="notify-settings__title">홈 화면에 추가</h2>
        <InstallGuide env={env} canPrompt={canPrompt} onInstall={install} onOpenBrowser={() => openInBrowser(location.href, env)} />
      </section>

      <section className="link-card" aria-labelledby="kind-title">
        <h2 id="kind-title" className="notify-settings__title">받을 알림</h2>
        <div className="notify-row is-fixed"><div><strong>거래</strong><small>신청·입금·발송·기한 알림. 돈이 걸려 있어 끌 수 없어요</small></div><span className="notify-switch is-on is-locked" aria-hidden="true" /></div>
        {ROWS.map((r) => (
          <div className="notify-row" key={r.key}>
            <div><strong>{r.label}</strong><small>{r.hint}</small></div>
            <button type="button" role="switch" aria-checked={p[r.key]} aria-label={r.label} className={`notify-switch${p[r.key] ? " is-on" : ""}`} onClick={() => toggle(r.key)} />
          </div>
        ))}
      </section>
    </div>
  );
}

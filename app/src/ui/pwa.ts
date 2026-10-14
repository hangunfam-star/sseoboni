// 브라우저 쪽 도우미: 접속 환경 판별, 서비스 워커 등록, 휴대폰 알림 켜기/끄기, 설치 안내 표시 기록.
// 모든 함수는 브라우저에서만 부른다(useEffect·클릭 안).

export type Env = "standalone" | "android" | "ios" | "kakao" | "inapp-android" | "inapp-ios" | "desktop";

// param: ua userAgent, standalone 홈 화면에서 연 상태인지, touchMac 터치되는 맥(아이패드). return: 접속 환경
export function detectEnv(ua: string, standalone: boolean, touchMac = false): Env {
  if (standalone) return "standalone";
  const ios = /iPhone|iPad|iPod/i.test(ua) || touchMac;
  const android = /Android/i.test(ua);
  if (/KAKAOTALK/i.test(ua)) return "kakao";
  if (/Instagram|FBAN|FBAV|NAVER\(inapp|Line\/|DaumApps|everytimeApp|; wv\)/i.test(ua)) return ios ? "inapp-ios" : android ? "inapp-android" : "desktop";
  if (ios) return "ios";
  if (android) return "android";
  return "desktop";
}

// return: 지금 브라우저의 접속 환경
export function currentEnv(): Env {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const touchMac = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return detectEnv(navigator.userAgent, Boolean(standalone), touchMac);
}

// param: url 열 주소, env 접속 환경. 앱 안 브라우저에서 기본 브라우저로 연다(카카오톡·안드로이드). return: 시도했으면 true
export function openInBrowser(url: string, env: Env): boolean {
  if (env === "kakao") { location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`; return true; }
  if (env === "inapp-android") { const u = new URL(url); location.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`; return true; }
  return false;
}

// return: 서비스 워커 등록(이미 있으면 그대로). 지원하지 않으면 null
export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("/sw.js", { scope: "/" }); } catch { return null; }
}

// return: 이 브라우저가 휴대폰 알림을 받을 수 있는지(아이폰은 홈 화면에서 연 경우에만)
export function pushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// return: 이 기기 알림 상태 — 지원 안 함 / 거절됨 / 켜짐 / 꺼짐
export async function pushState(): Promise<"unsupported" | "denied" | "on" | "off"> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return "off";
  const r = await fetch(`/api/push?endpoint=${encodeURIComponent(sub.endpoint)}`).then((x) => x.json()).catch(() => null);
  return r?.subscribed ? "on" : "off";
}

// 알림 허용 창 → 구독 → 서버 저장. return: 결과 문구 코드
export async function enablePush(): Promise<"on" | "denied" | "unsupported" | "error"> {
  if (!pushSupported()) return "unsupported";
  const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "error";
  const reg = (await registerSW()) ?? (await navigator.serviceWorker.getRegistration("/"));
  if (!reg) return "error";
  await navigator.serviceWorker.ready;
  const info = await fetch("/api/push").then((x) => x.json()).catch(() => null);
  if (!info?.publicKey) return "error";
  try {
    const key = keyBytes(info.publicKey);
    const post = (s: PushSubscription) => fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s.toJSON()) });
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    let res = await post(sub);
    if (res.status === 409) { // 이 기기 구독이 다른 계정 것이면 구독을 새로 만들어 지금 계정으로 등록
      await sub.unsubscribe().catch(() => undefined);
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      res = await post(sub);
    }
    return res.ok ? "on" : "error";
  } catch {
    return "error";
  }
}

// 이 기기 알림 끄기(구독 해제 + 서버에서 삭제)
export async function disablePush(): Promise<void> {
  const reg = await navigator.serviceWorker?.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}

// ── 설치 안내 표시 기록(이 기기에만) ──
const KEY = "sb_install";
type InstallMemo = { until: number; dismissed: number; forced: boolean; askedNotify: boolean };
export function readMemo(): InstallMemo {
  try { return { until: 0, dismissed: 0, forced: false, askedNotify: false, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return { until: 0, dismissed: 0, forced: false, askedNotify: false }; }
}
export function writeMemo(m: Partial<InstallMemo>): void {
  try { localStorage.setItem(KEY, JSON.stringify({ ...readMemo(), ...m })); } catch { /* 저장 못 하면 다음에 다시 보일 뿐 */ }
}
// 닫기: 7일, 세 번째부터 30일 동안 안 띄움
export function dismissInstall(now = Date.now()): void {
  const m = readMemo();
  const dismissed = m.dismissed + 1;
  writeMemo({ dismissed, until: now + (dismissed >= 3 ? 30 : 7) * 24 * 3600_000 });
}

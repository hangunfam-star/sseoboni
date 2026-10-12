import test from "node:test";
import assert from "node:assert/strict";
import { quietUntil } from "./notify-rules";
import { detectEnv } from "./pwa";

const kst = (s: string) => new Date(`${s}+09:00`).getTime();

test("밤 시간(한국 22시~8시) 알림은 다음 아침 8시로 미루고, 낮에는 바로", () => {
  assert.equal(quietUntil(kst("2026-10-12T21:59:00")), new Date(kst("2026-10-12T21:59:00")).toISOString());
  assert.equal(quietUntil(kst("2026-10-12T22:00:00")), new Date(kst("2026-10-13T08:00:00")).toISOString());
  assert.equal(quietUntil(kst("2026-10-12T23:30:00")), new Date(kst("2026-10-13T08:00:00")).toISOString());
  assert.equal(quietUntil(kst("2026-10-13T03:00:00")), new Date(kst("2026-10-13T08:00:00")).toISOString());
  assert.equal(quietUntil(kst("2026-10-13T07:59:00")), new Date(kst("2026-10-13T08:00:00")).toISOString());
  assert.equal(quietUntil(kst("2026-10-13T08:00:00")), new Date(kst("2026-10-13T08:00:00")).toISOString());
  assert.equal(quietUntil(kst("2026-10-31T23:00:00")), new Date(kst("2026-11-01T08:00:00")).toISOString()); // 달 넘김
});

test("접속 환경 판별: 홈 화면·안드로이드·아이폰·카카오톡·앱 안 브라우저·PC", () => {
  const AND = "Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";
  const IOS = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  assert.equal(detectEnv(AND, true), "standalone");
  assert.equal(detectEnv(AND, false), "android");
  assert.equal(detectEnv(IOS, false), "ios");
  assert.equal(detectEnv(`${IOS} KAKAOTALK 10.8.0`, false), "kakao");
  assert.equal(detectEnv(`${AND} KAKAOTALK 10.8.0`, false), "kakao");
  assert.equal(detectEnv(`${IOS} Instagram 300.0`, false), "inapp-ios");
  assert.equal(detectEnv(AND.replace("Android 14;", "Android 14; wv)"), false), "inapp-android");
  assert.equal(detectEnv("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0 Safari/537.36", false), "desktop");
  assert.equal(detectEnv("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/18.0 Safari/605.1.15", false, true), "ios"); // 아이패드
});

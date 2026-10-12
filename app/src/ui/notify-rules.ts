// 알림 규칙(순수 함수, 시험 가능).
export const QUIET_FROM = 22; // 한국 시간
export const QUIET_TO = 8;

// param: now 기준 시각(ms). return: 밤 10시~아침 8시(한국 시간)면 다음 아침 8시(ISO), 아니면 지금(ISO)
export function quietUntil(now: number): string {
  const k = new Date(now + 9 * 3600_000);
  const h = k.getUTCHours();
  if (h >= QUIET_FROM || h < QUIET_TO) {
    return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + (h >= QUIET_FROM ? 1 : 0), QUIET_TO) - 9 * 3600_000).toISOString();
  }
  return new Date(now).toISOString();
}

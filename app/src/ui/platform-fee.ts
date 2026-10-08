// 수수료 설정(운영자). 기본 비율 + 특정 기간 비율(예: 프로모션 0%). 날짜는 한국 시간 기준 YYYY-MM-DD, 시작·끝 날짜 포함.

export type FeePromo = { start: string; end: string; pct: number; label: string };
export type PlatformFeeConfig = { defaultPct: number; promos: FeePromo[] };

export const DEFAULT_PLATFORM_FEE: PlatformFeeConfig = { defaultPct: 3, promos: [] }; // 사용자 결정 2026-10-08: 테스트 3%

// param: now 기준 시각. return: 한국 시간 날짜 YYYY-MM-DD
export function kstDate(now: Date): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// param: c 설정, now 기준 시각. return: { pct 지금 비율, promo 적용 중인 기간(없으면 null) }
export function currentFeePct(c: PlatformFeeConfig, now: Date = new Date()): { pct: number; promo: FeePromo | null } {
  const today = kstDate(now);
  const promo = c.promos.find((p) => p.start <= today && today <= p.end) ?? null;
  return { pct: promo ? promo.pct : c.defaultPct, promo };
}

// param: v 저장값·요청 본문. return: 검증된 설정 또는 오류 문구
export function parsePlatformFee(v: unknown): PlatformFeeConfig | string {
  if (!v || typeof v !== "object") return "설정 형식이 올바르지 않습니다.";
  const o = v as Record<string, unknown>;
  const pctOk = (x: unknown): x is number => typeof x === "number" && x >= 0 && x <= 30 && Math.round(x * 10) === x * 10;
  if (!pctOk(o.defaultPct)) return "기본 수수료는 0~30% (소수 첫째 자리까지)로 입력하세요.";
  const raw = Array.isArray(o.promos) ? o.promos : [];
  if (raw.length > 20) return "특정 기간은 20개까지 둘 수 있어요.";
  const date = /^\d{4}-\d{2}-\d{2}$/;
  // 달력에 있는 날짜인지(2026-02-31 같은 값 거부)
  const realDate = (d: string) => {
    if (!date.test(d)) return false;
    const t = new Date(`${d}T00:00:00Z`);
    return Number.isFinite(t.getTime()) && t.toISOString().slice(0, 10) === d;
  };
  const promos: FeePromo[] = [];
  for (const r of raw) {
    const x = (r ?? {}) as Record<string, unknown>;
    const start = typeof x.start === "string" ? x.start : "";
    const end = typeof x.end === "string" ? x.end : "";
    const label = typeof x.label === "string" ? x.label.trim().slice(0, 30) : "";
    if (!realDate(start) || !realDate(end) || start > end) return "기간은 달력에 있는 날짜로, 시작일 ≤ 끝날짜(YYYY-MM-DD)로 입력하세요.";
    if (!pctOk(x.pct)) return "기간 수수료는 0~30%로 입력하세요.";
    if (promos.some((p) => !(end < p.start || start > p.end))) return "겹치는 기간이 있어요.";
    promos.push({ start, end, pct: x.pct, label: label || "특정 기간" });
  }
  promos.sort((a, b) => a.start.localeCompare(b.start));
  return { defaultPct: o.defaultPct, promos };
}

// 거래 설정 저장: runtime-data/trade-settings.json(git 제외) + 백업 .bak. 없으면 기본값(거래 닫힘).
// 손상되면 메모리의 마지막 정상값 → 백업 → 기본값 순으로 쓴다(수수료 설정과 같은 방식).
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_TRADE_SETTINGS, parseTradeSettings, type TradeSettings } from "@/ui/trade-rules";

const g = globalThis as typeof globalThis & { __sseoboniTradeLastGood?: TradeSettings };
// 격리 시험 서버는 TRADE_SETTINGS_FILE로 다른 파일을 써서 실제 서버 설정(거래 열기)에 영향을 주지 않는다.
const file = () => process.env.TRADE_SETTINGS_FILE || path.join(process.cwd(), "runtime-data", "trade-settings.json");

async function readConfig(p: string): Promise<TradeSettings | "MISSING" | "BROKEN"> {
  let raw: string;
  try { raw = await readFile(p, "utf8"); } catch { return "MISSING"; }
  try {
    const parsed = parseTradeSettings(JSON.parse(raw));
    return typeof parsed === "string" ? "BROKEN" : parsed;
  } catch {
    return "BROKEN";
  }
}

// return: 지금 거래 설정
export async function loadTradeSettings(): Promise<TradeSettings> {
  const main = await readConfig(file());
  if (main === "MISSING") return DEFAULT_TRADE_SETTINGS;
  if (main !== "BROKEN") { g.__sseoboniTradeLastGood = main; return main; }
  if (g.__sseoboniTradeLastGood) { console.warn("[trade-settings] 설정 파일 손상 — 마지막 정상값 사용"); return g.__sseoboniTradeLastGood; }
  const bak = await readConfig(`${file()}.bak`);
  if (bak !== "MISSING" && bak !== "BROKEN") { console.warn("[trade-settings] 설정 파일 손상 — 백업 사용"); g.__sseoboniTradeLastGood = bak; return bak; }
  console.error("[trade-settings] 설정 파일과 백업 모두 손상 — 기본값(거래 닫힘) 사용");
  return DEFAULT_TRADE_SETTINGS;
}

// param: c 검증된 설정. return: 저장한 설정
export async function saveTradeSettings(c: TradeSettings): Promise<TradeSettings> {
  await mkdir(path.dirname(file()), { recursive: true });
  const text = JSON.stringify(c, null, 2);
  for (const target of [file(), `${file()}.bak`]) {
    const tmp = `${target}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
    await writeFile(tmp, text, "utf8");
    await rename(tmp, target);
  }
  g.__sseoboniTradeLastGood = c;
  return c;
}

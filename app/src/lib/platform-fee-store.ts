// 수수료 설정 저장: runtime-data/platform-fee.json(git 제외) + 마지막 정상 설정 백업 platform-fee.json.bak
// - 파일이 없으면 기본(3%).
// - 파일이 손상되면: 메모리의 마지막 정상값 → 백업 파일 → (둘 다 없거나 손상) 기본값 순으로 쓰고 서버 로그에 경고한다.
// - 저장은 임시 파일(난수 이름)에 쓴 뒤 rename으로 바꿔 끼우고, 같은 내용을 백업에도 남긴다.
import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_PLATFORM_FEE, currentFeePct, parsePlatformFee, type PlatformFeeConfig } from "@/ui/platform-fee";

const g = globalThis as typeof globalThis & { __sseoboniFeeLastGood?: PlatformFeeConfig };

function file(): string {
  return path.join(process.cwd(), "runtime-data", "platform-fee.json");
}

// param: p 파일 경로. return: 정상 설정, 없으면 "MISSING", 손상이면 "BROKEN"
async function readConfig(p: string): Promise<PlatformFeeConfig | "MISSING" | "BROKEN"> {
  let raw: string;
  try { raw = await readFile(p, "utf8"); } catch { return "MISSING"; }
  try {
    const parsed = parsePlatformFee(JSON.parse(raw));
    return typeof parsed === "string" ? "BROKEN" : parsed;
  } catch {
    return "BROKEN";
  }
}

// return: 지금 수수료 설정
export async function loadPlatformFee(): Promise<PlatformFeeConfig> {
  const main = await readConfig(file());
  if (main === "MISSING") return DEFAULT_PLATFORM_FEE;
  if (main !== "BROKEN") { g.__sseoboniFeeLastGood = main; return main; }
  if (g.__sseoboniFeeLastGood) {
    console.warn("[platform-fee] 설정 파일이 손상됐어요. 마지막 정상 설정(메모리)을 씁니다.");
    return g.__sseoboniFeeLastGood;
  }
  const bak = await readConfig(`${file()}.bak`);
  if (bak !== "MISSING" && bak !== "BROKEN") {
    console.warn("[platform-fee] 설정 파일이 손상됐어요. 백업 파일의 정상 설정을 씁니다.");
    g.__sseoboniFeeLastGood = bak;
    return bak;
  }
  console.error("[platform-fee] 설정 파일과 백업이 모두 손상됐어요. 기본 수수료를 씁니다. 운영자 화면에서 다시 저장해 주세요.");
  return DEFAULT_PLATFORM_FEE;
}

// return: 오늘 적용 수수료율(%)
export async function feePctNow(): Promise<number> {
  return currentFeePct(await loadPlatformFee()).pct;
}

// param: c 검증된 설정. return: 저장한 설정
export async function savePlatformFee(c: PlatformFeeConfig): Promise<PlatformFeeConfig> {
  await mkdir(path.dirname(file()), { recursive: true });
  const text = JSON.stringify(c, null, 2);
  for (const target of [file(), `${file()}.bak`]) {
    const tmp = `${target}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
    await writeFile(tmp, text, "utf8");
    await rename(tmp, target);
  }
  g.__sseoboniFeeLastGood = c;
  return c;
}

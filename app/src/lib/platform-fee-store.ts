// 수수료 설정 저장: runtime-data/platform-fee.json(git 제외). 없거나 깨지면 기본(3%)을 쓴다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_PLATFORM_FEE, currentFeePct, parsePlatformFee, type PlatformFeeConfig } from "@/ui/platform-fee";

function file(): string {
  return path.join(process.cwd(), "runtime-data", "platform-fee.json");
}

// return: 지금 수수료 설정
export async function loadPlatformFee(): Promise<PlatformFeeConfig> {
  try {
    const parsed = parsePlatformFee(JSON.parse(await readFile(file(), "utf8")));
    return typeof parsed === "string" ? DEFAULT_PLATFORM_FEE : parsed;
  } catch {
    return DEFAULT_PLATFORM_FEE;
  }
}

// return: 오늘 적용 수수료율(%)
export async function feePctNow(): Promise<number> {
  return currentFeePct(await loadPlatformFee()).pct;
}

// param: c 검증된 설정. return: 저장한 설정
export async function savePlatformFee(c: PlatformFeeConfig): Promise<PlatformFeeConfig> {
  await mkdir(path.dirname(file()), { recursive: true });
  await writeFile(file(), JSON.stringify(c, null, 2), "utf8");
  return c;
}

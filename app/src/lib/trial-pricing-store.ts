// 써보기 가격안 저장소: runtime-data/trial-pricing.json(git 제외). 파일이 없거나 깨지면 기본 가격안을 쓴다.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_TRIAL_PRICING, parseTrialPricing, type TrialPricing } from "@/ui/trial-pricing";

function file(): string {
  return path.join(process.cwd(), "runtime-data", "trial-pricing.json");
}

// return: 지금 쓰는 가격안
export async function loadTrialPricing(): Promise<TrialPricing> {
  try {
    const parsed = parseTrialPricing(JSON.parse(await readFile(file(), "utf8")));
    return typeof parsed === "string" ? DEFAULT_TRIAL_PRICING : parsed;
  } catch {
    return DEFAULT_TRIAL_PRICING;
  }
}

// param: p 검증된 가격안. 저장할 때마다 version을 새로 붙인다(반응 기록을 가격안별로 나누기 위해).
// return: 저장된 가격안
export async function saveTrialPricing(p: Omit<TrialPricing, "version">): Promise<TrialPricing> {
  const saved: TrialPricing = { ...p, version: `v${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}` };
  await mkdir(path.dirname(file()), { recursive: true });
  await writeFile(file(), JSON.stringify(saved, null, 2), "utf8");
  return saved;
}

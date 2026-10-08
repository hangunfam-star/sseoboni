import { NextResponse } from "next/server";
import { loadPlatformFee } from "@/lib/platform-fee-store";
import { currentFeePct } from "@/ui/platform-fee";

// GET /api/platform-fee — 오늘 적용 수수료율(공개). 판매 등록 화면 미리보기용
export async function GET() {
  const { pct, promo } = currentFeePct(await loadPlatformFee());
  return NextResponse.json({ pct, promo: promo ? { label: promo.label, end: promo.end } : null });
}

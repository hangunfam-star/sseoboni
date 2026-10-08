import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { marketValidationEvents } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { saveTrialPricing } from "@/lib/trial-pricing-store";
import { parseTrialPricing } from "@/ui/trial-pricing";

// POST /api/admin/pricing — 운영자만. 써보기 가격안(검증용 가설)을 바꾼다. 바꾼 기록은 PRICING_CHANGED 이벤트로 남긴다.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "운영자만 바꿀 수 있어요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = parseTrialPricing({ ...(body ?? {}), version: "draft" });
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });
  const { version: _draft, ...rest } = parsed;
  void _draft;
  const saved = await saveTrialPricing(rest);
  await db.insert(marketValidationEvents).values({ eventType: "PRICING_CHANGED", metadata: JSON.stringify(saved) });
  return NextResponse.json({ pricing: saved });
}

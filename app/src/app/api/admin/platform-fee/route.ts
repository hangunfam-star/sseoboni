import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { marketValidationEvents } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { savePlatformFee } from "@/lib/platform-fee-store";
import { parsePlatformFee } from "@/ui/platform-fee";

// POST /api/admin/platform-fee { defaultPct, promos: [{ start, end, pct, label }] } — 운영자만. 바꾼 기록은 PLATFORM_FEE_CHANGED로 남긴다.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "운영자만 바꿀 수 있어요." }, { status: 401 });
  const parsed = parsePlatformFee(await req.json().catch(() => null));
  if (typeof parsed === "string") return NextResponse.json({ error: parsed }, { status: 400 });
  const saved = await savePlatformFee(parsed);
  await db.insert(marketValidationEvents).values({ eventType: "PLATFORM_FEE_CHANGED", metadata: JSON.stringify(saved) });
  return NextResponse.json({ config: saved });
}

import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { dailyDigest, runJobs } from "@/lib/jobs";

// POST /api/admin/jobs { digestAt?: ISO } — 운영자만. 정기 작업(기한 처리·기한 알림·후기 요청·발송)을 지금 한 번 돌린다.
// digestAt을 주면 그 시각 기준으로 하루 묶음 알림도 만든다(한국 시간 12시대만 만들어짐).
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "운영자만 할 수 있어요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const result = await runJobs();
  if (typeof body?.digestAt === "string" && !Number.isNaN(Date.parse(body.digestAt))) result.digestAt = await dailyDigest(Date.parse(body.digestAt));
  return NextResponse.json({ result });
}

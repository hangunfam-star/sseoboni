import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orderPhotos, orders } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { isAdmin } from "@/lib/admin";
import { readPhoto } from "@/lib/photos";

// GET /api/orders/[id]/photos/[file] — 거래 증거 사진. 거래 당사자와 운영자만 본다(공개 사진 주소로는 열리지 않음)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  const userId = await getCurrentUserId();
  const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  const allowed = o && ((userId && (o.buyerId === userId || o.sellerId === userId)) || (await isAdmin()));
  if (!allowed) return NextResponse.json({ error: "사진을 찾을 수 없습니다." }, { status: 404 });
  const row = db.select({ f: orderPhotos.fileName }).from(orderPhotos).where(and(eq(orderPhotos.orderId, id), eq(orderPhotos.fileName, file))).get();
  const data = row ? await readPhoto(row.f, "order") : null;
  if (!data) return NextResponse.json({ error: "사진을 찾을 수 없습니다." }, { status: 404 });
  return new NextResponse(new Uint8Array(data), { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600" } });
}

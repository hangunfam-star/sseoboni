import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orderPhotos } from "@/db/schema";
import { readPhoto } from "@/lib/photos";

// GET /api/photos/[file] — 저장된 상품 사진. 파일 이름은 무작위 24자리+.webp 형식만 허용한다.
// 거래 증거 사진(order_photos)은 여기서 열리지 않는다 — /api/orders/[id]/photos/[file]에서 당사자만.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (db.select({ id: orderPhotos.id }).from(orderPhotos).where(eq(orderPhotos.fileName, file)).get()) {
    return NextResponse.json({ error: "사진을 찾을 수 없습니다." }, { status: 404 });
  }
  const data = await readPhoto(file);
  if (!data) return NextResponse.json({ error: "사진을 찾을 수 없습니다." }, { status: 404 });
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

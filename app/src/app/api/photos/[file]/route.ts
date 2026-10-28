import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listingPhotos, orderPhotos } from "@/db/schema";
import { readPhoto } from "@/lib/photos";

const NOT_FOUND = () => NextResponse.json({ error: "사진을 찾을 수 없습니다." }, { status: 404 });
// 브라우저가 매번 서버에 확인한다(탈퇴·삭제 뒤 바로 404가 되게, 탈퇴 2단계 0000절 8). 바뀌지 않았으면 304
const CACHE = "private, no-cache, must-revalidate";

// GET /api/photos/[file] — 저장된 상품 사진. 파일 이름은 무작위 24자리+.webp 형식만 허용한다.
// 거래 증거 사진(order_photos)은 여기서 열리지 않는다 — /api/orders/[id]/photos/[file]에서 당사자만.
// listing_photos 줄을 먼저 확인하고(없으면 404), 그다음에 If-None-Match(304)를 본다 — 줄이 지워진 뒤에는 304가 나가지 않는다.
export async function GET(req: NextRequest, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!db.select({ id: listingPhotos.id }).from(listingPhotos).where(eq(listingPhotos.fileName, file)).get()) return NOT_FOUND();
  if (db.select({ id: orderPhotos.id }).from(orderPhotos).where(eq(orderPhotos.fileName, file)).get()) return NOT_FOUND();
  const etag = `"${file}"`;
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ETag: etag, "Cache-Control": CACHE } });
  const data = await readPhoto(file);
  if (!data) return NOT_FOUND();
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": "image/webp", "Cache-Control": CACHE, ETag: etag },
  });
}

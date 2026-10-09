import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listings } from "@/db/schema";
import { photosFor, readPhoto } from "@/lib/photos";

// GET /api/listings/[id]/og — 링크 미리보기(카카오톡 등)용 1200×630 JPEG. 판매 중 상품만.
// 메신저마다 webp 미리보기 지원이 달라 JPEG로 바꿔 준다. 사진이 없으면 써보니 대표 이미지를 쓴다.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await db.query.listings.findFirst({ where: eq(listings.id, id) });
  if (!listing || listing.status !== "ACTIVE") return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  const first = (await photosFor([id])).get(id)?.[0];
  const src = (first && (await readPhoto(first.fileName))) || (await readFile(path.join(process.cwd(), "public", "hero", "splash.webp")).catch(() => null));
  if (!src) return NextResponse.json({ error: "이미지가 없습니다." }, { status: 404 });
  const jpg = await sharp(src).resize(1200, 630, { fit: "contain", background: "#f4f4f5" }).flatten({ background: "#f4f4f5" }).jpeg({ quality: 82 }).toBuffer();
  return new NextResponse(new Uint8Array(jpg), { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" } });
}

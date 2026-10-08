import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { listingPhotos, listings } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { MAX_PHOTO_BYTES, MAX_PHOTOS, photoCount, photoUrl, savePhoto } from "@/lib/photos";

// POST /api/listings/[id]/photos (multipart, 필드명 photo, 여러 장) — 판매자 본인만, 상품당 최대 5장
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });

  const listing = await db.query.listings.findFirst({ where: eq(listings.id, id) });
  if (!listing || listing.sellerId !== userId || listing.status === "REMOVED") {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다." }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const files = (form?.getAll("photo") ?? []).filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (files.length === 0) return NextResponse.json({ error: "사진을 골라 주세요." }, { status: 400 });

  const already = await photoCount(id);
  if (already + files.length > MAX_PHOTOS) {
    return NextResponse.json({ error: `사진은 상품당 ${MAX_PHOTOS}장까지 올릴 수 있어요.` }, { status: 400 });
  }
  if (files.some((f) => f.size > MAX_PHOTO_BYTES)) {
    return NextResponse.json({ error: "사진 한 장은 10MB 이하로 올려 주세요." }, { status: 400 });
  }

  const saved = [];
  for (const [i, f] of files.entries()) {
    try {
      const s = await savePhoto(Buffer.from(await f.arrayBuffer()));
      await db.insert(listingPhotos).values({ listingId: id, fileName: s.fileName, width: s.width, height: s.height, sortOrder: already + i });
      saved.push({ url: photoUrl(s.fileName), width: s.width, height: s.height });
    } catch {
      return NextResponse.json({ error: "사진 파일을 읽지 못했어요. JPG·PNG·HEIC 사진으로 다시 올려 주세요.", saved }, { status: 400 });
    }
  }
  return NextResponse.json({ photos: saved }, { status: 201 });
}

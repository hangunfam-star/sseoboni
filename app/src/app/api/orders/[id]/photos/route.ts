import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { orderPhotos, orders } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { MAX_PHOTO_BYTES, removeOrderPhotoFile, savePhoto } from "@/lib/photos";
import { ORDER_PHOTO_MAX, ORDER_PHOTO_STAGES, type OrderPhotoStage } from "@/ui/check-items";
import { lateArrivalUntil } from "@/lib/orders";

// 단계별로 누가·어느 상태에서 사진을 올릴 수 있는지(받을 때=구매자·배송 중, 포장=구매자·반납 신청, 검수=판매자·반송 중)
const RULE: Record<OrderPhotoStage, { role: "buyer" | "seller"; status: string }> = {
  RECEIVE: { role: "buyer", status: "SHIPPED" },
  PACK: { role: "buyer", status: "RETURN_REQUESTED" },
  INSPECT: { role: "seller", status: "RETURN_SHIPPED" },
};

// param: id 거래, userId, stage. return: 올릴 수 있으면 null, 아니면 오류 응답
async function guard(id: string, userId: string | null, stage: unknown) {
  if (!userId) return NextResponse.json({ error: "먼저 카카오로 로그인해 주세요." }, { status: 401 });
  if (!ORDER_PHOTO_STAGES.includes(stage as OrderPhotoStage)) return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  const o = await db.query.orders.findFirst({ where: eq(orders.id, id) });
  const role = o?.buyerId === userId ? "buyer" : o?.sellerId === userId ? "seller" : null;
  if (!o || !role) return NextResponse.json({ error: "거래를 찾을 수 없습니다." }, { status: 404 });
  const rule = RULE[stage as OrderPhotoStage];
  // 받을 때 사진은 자동 받음 뒤 늦은 확인 기한 안에도 올릴 수 있다
  const lateReceive = stage === "RECEIVE" && role === "buyer" && lateArrivalUntil(o) !== null;
  if (!lateReceive && (rule.role !== role || rule.status !== o.status)) return NextResponse.json({ error: "지금은 이 사진을 올릴 수 없어요. 새로고침해 주세요." }, { status: 409 });
  return null;
}

// POST /api/orders/[id]/photos (multipart: stage, photo 여러 장) — 거래 단계 증거 사진. 단계마다 최대 5장
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const form = await req.formData().catch(() => null);
  const stage = form?.get("stage");
  const bad = await guard(id, userId, stage);
  if (bad) return bad;
  const files = (form?.getAll("photo") ?? []).filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  if (files.length === 0) return NextResponse.json({ error: "사진을 골라 주세요." }, { status: 400 });
  const have = db.select({ id: orderPhotos.id }).from(orderPhotos).where(and(eq(orderPhotos.orderId, id), eq(orderPhotos.stage, stage as string))).all().length;
  if (have + files.length > ORDER_PHOTO_MAX) return NextResponse.json({ error: `사진은 단계마다 ${ORDER_PHOTO_MAX}장까지 올릴 수 있어요.` }, { status: 400 });
  if (files.some((f) => f.size > MAX_PHOTO_BYTES)) return NextResponse.json({ error: "사진 한 장은 10MB 이하로 올려 주세요." }, { status: 400 });
  const saved: string[] = [];
  for (const f of files) {
    try {
      const s = await savePhoto(Buffer.from(await f.arrayBuffer()), "order");
      db.insert(orderPhotos).values({ orderId: id, stage: stage as string, userId: userId!, fileName: s.fileName, width: s.width, height: s.height }).run();
      saved.push(s.fileName);
    } catch {
      return NextResponse.json({ error: "사진 파일을 읽지 못했어요. JPG·PNG·HEIC 사진으로 다시 올려 주세요.", saved }, { status: 400 });
    }
  }
  return NextResponse.json({ photos: saved }, { status: 201 });
}

// DELETE /api/orders/[id]/photos?stage=&file= — 그 단계를 마치기 전에 내가 올린 사진 지우기
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  const stage = req.nextUrl.searchParams.get("stage");
  const bad = await guard(id, userId, stage);
  if (bad) return bad;
  const file = req.nextUrl.searchParams.get("file") ?? "";
  const r = db.delete(orderPhotos).where(and(eq(orderPhotos.orderId, id), eq(orderPhotos.stage, stage!), eq(orderPhotos.fileName, file), eq(orderPhotos.userId, userId!))).run();
  if (r.changes === 0) return NextResponse.json({ error: "사진을 찾을 수 없습니다." }, { status: 404 });
  await removeOrderPhotoFile(file); // 기록과 함께 실제 파일도 지운다
  return NextResponse.json({ deleted: file });
}

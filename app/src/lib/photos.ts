// 판매자 상품 사진 저장. 원본을 그대로 두지 않고 다시 인코딩해 위치(GPS) 등 메타데이터를 지우고 크기를 줄인다.
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { listingPhotos } from "@/db/schema";

export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 1600;
const FILE_RE = /^[a-f0-9]{24}\.webp$/;

// 상품 사진(공개)과 거래 증거 사진(당사자만)은 다른 폴더에 둔다 — 공개 사진 주소는 상품 폴더만 읽는다
export type PhotoKind = "listing" | "order";

// param: kind 사진 종류. return: 사진 저장 폴더(저장소 밖으로 나가지 않는 고정 하위 경로)
function uploadsDir(kind: PhotoKind = "listing"): string {
  return path.join(process.cwd(), "runtime-data", kind === "order" ? "order-uploads" : "uploads");
}

// param: name 저장된 파일 이름, kind 사진 종류. return: 안전한 이름이면 절대경로, 아니면 null
export function photoPath(name: string, kind: PhotoKind = "listing"): string | null {
  return FILE_RE.test(name) ? path.join(uploadsDir(kind), name) : null;
}

export { photoUrl } from "@/lib/photo-url";

// param: data 업로드 바이트, kind 사진 종류. return: 저장한 파일 정보. 예외: 이미지가 아니면 throw
export async function savePhoto(data: Buffer, kind: PhotoKind = "listing"): Promise<{ fileName: string; width: number; height: number }> {
  const img = sharp(data, { failOn: "error" }).rotate(); // EXIF 방향만 반영하고 메타데이터는 버린다
  const meta = await img.metadata();
  if (!meta.format || !["jpeg", "png", "webp", "heif", "avif"].includes(meta.format)) throw new Error("unsupported");
  const { data: out, info } = await img
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const fileName = `${randomBytes(12).toString("hex")}.webp`;
  await mkdir(uploadsDir(kind), { recursive: true });
  await writeFile(path.join(uploadsDir(kind), fileName), out);
  return { fileName, width: info.width, height: info.height };
}

// param: name 파일 이름, kind 사진 종류. return: 사진 바이트, 없으면 null
export async function readPhoto(name: string, kind: PhotoKind = "listing"): Promise<Buffer | null> {
  const p = photoPath(name, kind);
  if (!p) return null;
  try { return await readFile(p); } catch { return null; }
}

// param: name 거래 증거 사진 파일 이름. return: 없음. 파일이 이미 없어도 오류 없이 넘어간다
export async function removeOrderPhotoFile(name: string): Promise<void> {
  const p = photoPath(name, "order");
  if (p) await unlink(p).catch(() => undefined);
}

export type PhotoRow = { fileName: string; width: number; height: number };

// param: listingIds 상품 id 목록. return: 상품별 사진(순서대로)
export async function photosFor(listingIds: string[]): Promise<Map<string, PhotoRow[]>> {
  const map = new Map<string, PhotoRow[]>();
  if (listingIds.length === 0) return map;
  const rows = await db
    .select({ listingId: listingPhotos.listingId, fileName: listingPhotos.fileName, width: listingPhotos.width, height: listingPhotos.height })
    .from(listingPhotos)
    .where(inArray(listingPhotos.listingId, listingIds))
    .orderBy(asc(listingPhotos.sortOrder), asc(listingPhotos.createdAt));
  for (const r of rows) {
    const list = map.get(r.listingId) ?? [];
    list.push({ fileName: r.fileName, width: r.width, height: r.height });
    map.set(r.listingId, list);
  }
  return map;
}

export async function photoCount(listingId: string): Promise<number> {
  return (await db.select({ id: listingPhotos.id }).from(listingPhotos).where(eq(listingPhotos.listingId, listingId))).length;
}

// param: listingId 상품 id, fileName 지울 사진 파일 이름
// return: 지웠으면 true, 그 상품의 사진이 아니면 false. 파일이 이미 없어도 DB 행은 지운다.
export async function deletePhoto(listingId: string, fileName: string): Promise<boolean> {
  const p = photoPath(fileName);
  if (!p) return false;
  const removed = await db.delete(listingPhotos).where(and(eq(listingPhotos.listingId, listingId), eq(listingPhotos.fileName, fileName))).returning();
  if (removed.length === 0) return false;
  await unlink(p).catch(() => undefined);
  return true;
}

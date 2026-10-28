// 판매자 상품 사진 저장. 원본을 그대로 두지 않고 다시 인코딩해 위치(GPS) 등 메타데이터를 지우고 크기를 줄인다.
import { mkdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { listingPhotos, orderPhotos } from "@/db/schema";
import { ORPHAN_MS, putFile, type RetainFileIn, type RetainLock } from "@/lib/retain";

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
  // 먼저 staging에 쓰고, DB 줄을 넣은 뒤 commitPhoto로 옮긴다(서버 종료 때 고아 파일 방지, 탈퇴 2단계 0000절 6)
  await mkdir(stagingDir(kind), { recursive: true });
  await writeFile(path.join(stagingDir(kind), fileName), out);
  return { fileName, width: info.width, height: info.height };
}

// param: kind 사진 종류. return: 업로드 staging 폴더
function stagingDir(kind: PhotoKind = "listing"): string {
  return path.join(process.cwd(), "runtime-data", "staging", kind);
}

// param: name, kind. return: 원본이 있을 수 있는 위치(원래 폴더, staging). 이름이 안전하지 않으면 빈 배열
export function photoSourcePaths(name: string, kind: PhotoKind = "listing"): string[] {
  return FILE_RE.test(name) ? [path.join(uploadsDir(kind), name), path.join(stagingDir(kind), name)] : [];
}

// param: name savePhoto가 돌려준 파일 이름, kind. return: 없음. DB 줄을 넣은 뒤 staging → 원래 폴더로 옮긴다
export async function commitPhoto(name: string, kind: PhotoKind = "listing"): Promise<void> {
  if (!FILE_RE.test(name)) return;
  await mkdir(uploadsDir(kind), { recursive: true });
  await rename(path.join(stagingDir(kind), name), path.join(uploadsDir(kind), name));
}

// param: name, kind. return: 없음. DB 줄 넣기에 실패했을 때 staging 파일을 지운다
export async function discardStaged(name: string, kind: PhotoKind = "listing"): Promise<void> {
  if (FILE_RE.test(name)) await rm(path.join(stagingDir(kind), name), { force: true });
}

// param: name 파일 이름, kind 사진 종류. return: 사진 바이트, 없으면 null(원래 폴더에 없으면 staging도 본다)
export async function readPhoto(name: string, kind: PhotoKind = "listing"): Promise<Buffer | null> {
  for (const p of photoSourcePaths(name, kind)) {
    try { return await readFile(p); } catch { /* 다음 위치 */ }
  }
  return null;
}

// param: name, kind. return: 원본(원래 폴더·staging)이 모두 사라졌으면 true(탈퇴 경로는 unlink 결과를 확인한다)
export function removePhotoSources(name: string, kind: PhotoKind): boolean {
  const ps = photoSourcePaths(name, kind);
  for (const p of ps) { try { rmSync(p, { force: true }); } catch { /* 아래에서 확인 */ } }
  return ps.length > 0 && ps.every((p) => !existsSync(p));
}

// param: lock 보관 잠금, req 보관할 사진(원본 위치는 여기서 채움), nowMs. return: putFile 결과. 원본을 암호화해 보관 폴더로 옮긴다(원본 삭제는 운영 DB ④ 뒤)
export function movePhotoToRetained(lock: RetainLock, req: Omit<RetainFileIn, "srcPaths">, nowMs: number): ReturnType<typeof putFile> {
  return putFile(lock, { ...req, srcPaths: photoSourcePaths(req.fileName, req.kind) }, nowMs);
}

// param: nowMs. return: 정리한 파일 수. staging은 DB 줄이 있으면 원래 폴더로 옮기고, 없으면 24시간 뒤 지운다. 원래 폴더의 DB에 없는 파일도 24시간 뒤 지운다
export function cleanupUploadOrphans(nowMs = Date.now()): number {
  let n = 0;
  for (const kind of ["listing", "order"] as const) {
    const names = new Set((kind === "listing"
      ? db.select({ f: listingPhotos.fileName }).from(listingPhotos).all()
      : db.select({ f: orderPhotos.fileName }).from(orderPhotos).all()).map((r) => r.f));
    const old = (p: string) => nowMs - statSync(p).mtimeMs > ORPHAN_MS;
    const sd = stagingDir(kind);
    if (existsSync(sd)) for (const f of readdirSync(sd)) {
      const p = path.join(sd, f);
      if (names.has(f)) { mkdirSync(uploadsDir(kind), { recursive: true }); renameSync(p, path.join(uploadsDir(kind), f)); n++; }
      else if (old(p)) { rmSync(p, { force: true }); n++; }
    }
    const ud = uploadsDir(kind);
    if (existsSync(ud)) for (const f of readdirSync(ud)) {
      const p = path.join(ud, f);
      if (FILE_RE.test(f) && !names.has(f) && old(p)) { rmSync(p, { force: true }); n++; }
    }
  }
  return n;
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

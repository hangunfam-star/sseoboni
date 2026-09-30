// Gate 0 외부 테스터용 개인 초대 코드 저장소.
// 코드 목록은 저장소에 커밋하지 않는 로컬 JSON 파일(기본 ./invites.local.json)에 두고,
// `npm run invite` 스크립트로 발급·폐기한다. 매 요청 다시 읽어 폐기가 즉시 반영된다.
import { readFileSync } from "node:fs";
import path from "node:path";

export type Invite = {
  code: string;
  nickname: string;
  userId: string;
  createdAt: string;
  revokedAt: string | null;
};

// return: 초대 파일 절대경로 (INVITES_FILE 환경변수 우선)
export function invitesFilePath(): string {
  return path.resolve(process.env.INVITES_FILE ?? "./invites.local.json");
}

// return: 초대 목록. 파일이 없거나 형식이 틀리면 빈 배열(= 아무도 로그인 불가)
export function loadInvites(): Invite[] {
  try {
    const data = JSON.parse(readFileSync(invitesFilePath(), "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// param: code 사용자가 입력한 초대 코드(대소문자·하이픈·공백 무시)
export function normalizeCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// return: 유효한(폐기되지 않은) 초대 또는 null
export function findActiveInviteByCode(code: string): Invite | null {
  const target = normalizeCode(code);
  if (target.length < 8) return null;
  return loadInvites().find((i) => !i.revokedAt && normalizeCode(i.code) === target) ?? null;
}

// return: userId에 연결된 유효한 초대 또는 null
export function findActiveInviteByUserId(userId: string): Invite | null {
  return loadInvites().find((i) => !i.revokedAt && i.userId === userId) ?? null;
}

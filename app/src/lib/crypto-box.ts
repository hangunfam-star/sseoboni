// 개인정보(정산 계좌·배송지·환불 계좌) 암호화. AES-256-GCM, 키는 SESSION_SECRET에서 HKDF로 따로 만든다.
// 저장 형식: v1.<iv>.<tag>.<암호문> (base64url). 키가 없으면 저장·읽기를 하지 않는다(안전한 쪽으로 실패).
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

function key(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET이 없어 개인정보를 암호화할 수 없습니다.");
  return Buffer.from(hkdfSync("sha256", s, "sseoboni", "pii-v1", 32));
}

// param: value 저장할 값(JSON으로 바꿀 수 있는 것). return: 암호문 문자열
export function seal(value: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

// param: box seal()로 만든 문자열. return: 원래 값, 손상·변조면 null
export function open<T>(box: string | null | undefined): T | null {
  if (!box) return null;
  const [v, iv, tag, ct] = box.split(".");
  if (v !== "v1" || !iv || !tag || !ct) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]).toString("utf8")) as T;
  } catch {
    return null;
  }
}

// param: account 계좌번호 숫자. return: 가운데를 가린 표시(예: 1002****2354)
export const maskAccount = (account: string) => (account.length <= 8 ? "****" : `${account.slice(0, 4)}${"*".repeat(account.length - 8)}${account.slice(-4)}`);

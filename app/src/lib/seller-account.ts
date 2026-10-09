// 판매자 정산 계좌 저장·읽기. 계좌번호와 예금주는 함께 암호화하고, holder 열에는 가린 이름만 둔다.
// 예전 형식(account_enc = 계좌번호 문자열, holder = 평문)도 읽는다(scripts/encrypt-seller-holder.cjs로 옮김).
import { open, seal } from "@/lib/crypto-box";

export type SellerAccount = { bank: string; account: string; holder: string };
type Row = { bank: string; accountEnc: string; holder: string };

// param: name 예금주. return: 가운데를 가린 이름(예: 한*만, 홍*)
export function maskName(name: string): string {
  const c = Array.from(name.trim());
  if (c.length <= 1) return "*";
  if (c.length === 2) return `${c[0]}*`;
  return `${c[0]}${"*".repeat(c.length - 2)}${c[c.length - 1]}`;
}

// param: acc 검증된 계좌. return: 저장할 값(암호문 + 가린 예금주)
export function sealSellerAccount(acc: SellerAccount) {
  return { bank: acc.bank, accountEnc: seal({ account: acc.account, holder: acc.holder }), holder: maskName(acc.holder) };
}

// param: row DB 행. return: 계좌(풀 수 없거나 비었으면 null — 암호 키가 바뀌었거나 값이 손상된 경우)
export function readSellerAccount(row: Row | null | undefined): SellerAccount | null {
  if (!row) return null;
  const v = open<string | { account: string; holder: string }>(row.accountEnc);
  if (v === null) return null;
  if (typeof v === "string") return v ? { bank: row.bank, account: v, holder: row.holder } : null;
  return v.account && v.holder ? { bank: row.bank, account: v.account, holder: v.holder } : null;
}

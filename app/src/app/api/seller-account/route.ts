import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { sellerAccounts } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { maskAccount, open, seal } from "@/lib/crypto-box";
import { parseBankAccount } from "@/ui/trade-rules";

// GET /api/seller-account — 내 정산 계좌(가린 번호)
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ account: null });
  const row = await db.query.sellerAccounts.findFirst({ where: eq(sellerAccounts.userId, userId) });
  if (!row) return NextResponse.json({ account: null });
  return NextResponse.json({ account: { bank: row.bank, holder: row.holder, masked: maskAccount(open<string>(row.accountEnc) ?? ""), defaultShipping: row.defaultShipping } });
}

// DELETE /api/seller-account — 내 정산 계좌 삭제. 진행 중 거래는 신청 때 저장한 계좌로 계속 안내되고, 새 신청은 다시 등록할 때까지 받지 않는다.
export async function DELETE() {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  const r = db.delete(sellerAccounts).where(eq(sellerAccounts.userId, userId)).run();
  if (r.changes === 0) return NextResponse.json({ error: "등록된 계좌가 없어요." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// PUT /api/seller-account { bank, account, holder, defaultShipping } — 등록·수정(계좌번호는 암호화 저장)
export async function PUT(req: NextRequest) {
  const userId = await getCurrentUserId();
  if (!userId) return NextResponse.json({ error: "먼저 닉네임을 정하고 시작하세요." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const acc = parseBankAccount(body);
  if (typeof acc === "string") return NextResponse.json({ error: acc }, { status: 400 });
  const ship = Number(body?.defaultShipping ?? 0);
  if (!Number.isInteger(ship) || ship < 0 || ship > 50_000) return NextResponse.json({ error: "기본 발송비는 0~50,000원으로 입력하세요." }, { status: 400 });
  const values = { bank: acc.bank, accountEnc: seal(acc.account), holder: acc.holder, defaultShipping: ship };
  db.insert(sellerAccounts).values({ userId, ...values })
    .onConflictDoUpdate({ target: sellerAccounts.userId, set: { ...values, updatedAt: sql`(current_timestamp)` } }).run();
  return NextResponse.json({ ok: true, masked: maskAccount(acc.account) });
}

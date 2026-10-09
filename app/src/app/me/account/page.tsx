import type { Metadata } from "next";
import { Icon } from "@/components/Icon";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sellerAccounts } from "@/db/schema";
import { getCurrentUserId } from "@/lib/session";
import { maskAccount } from "@/lib/crypto-box";
import { readSellerAccount } from "@/lib/seller-account";
import { AccountForm } from "./AccountForm";

export const metadata: Metadata = { title: "정산 계좌 · 써보니", robots: { index: false, follow: false } };

// 판매자 정산 계좌 — 구매자가 상품 대금을 직접 보낼 계좌
export default async function AccountPage() {
  const userId = await getCurrentUserId();
  if (!userId) return <div className="page"><h1 className="page-title"><Icon name="bank" />정산 계좌</h1><div className="empty-card"><strong>닉네임을 정하고 시작해 주세요.</strong><Link href="/login">시작하기</Link></div></div>;
  const row = await db.query.sellerAccounts.findFirst({ where: eq(sellerAccounts.userId, userId) });
  const acc = readSellerAccount(row);
  const current = row && acc ? { bank: acc.bank, holder: acc.holder, masked: maskAccount(acc.account), defaultShipping: row.defaultShipping } : null;
  const broken = Boolean(row) && !acc; // 저장된 계좌를 읽을 수 없음 → 다시 등록 필요
  return (
    <div className="page sell-page">
      <div className="page-top"><Link className="icon-button" href="/me" aria-label="MY로"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></Link></div>
      <h1 className="page-title"><Icon name="bank" />정산 계좌</h1>
      <p className="page-lead">구매자는 상품가와 발송비를 이 계좌로 직접 보내요. 계좌를 등록해야 내 상품을 구매·써보기 신청할 수 있어요.</p>
      {broken && <p className="form-error">저장된 계좌를 읽을 수 없어요. 계좌를 다시 등록해 주세요. 다시 등록하기 전에는 새 신청을 받지 않아요.</p>}
      <AccountForm current={current} />
    </div>
  );
}

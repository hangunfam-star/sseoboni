"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BANKS } from "@/ui/trade-rules";

// 판매자 정산 계좌·기본 발송비 등록. 계좌번호는 서버에서 암호화해 저장하고, 이 화면에는 가린 번호만 다시 보여 준다.
export function AccountForm({ current }: { current: { bank: string; holder: string; masked: string; defaultShipping: number } | null }) {
  const router = useRouter();
  const [bank, setBank] = useState(current?.bank ?? "");
  const [account, setAccount] = useState("");
  const [holder, setHolder] = useState(current?.holder ?? "");
  const [ship, setShip] = useState(String(current?.defaultShipping ?? 0));
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setMsg(null);
    const res = await fetch("/api/seller-account", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bank, account, holder, defaultShipping: Number(ship || 0) }) });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) { setMsg({ ok: false, text: d.error ?? "저장하지 못했어요." }); return; }
    setAccount("");
    setMsg({ ok: true, text: `저장했어요 (${d.masked}).` });
    router.refresh();
  }

  return (
    <form className="sell-form" onSubmit={save}>
      {current && <p className="field-hint">지금 계좌: {current.bank} {current.masked} · {current.holder}</p>}
      <label className="field"><span>은행</span>
        <select value={bank} onChange={(e) => setBank(e.target.value)} required>
          <option value="">은행 선택</option>
          {BANKS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </label>
      <label className="field"><span>계좌번호 {current && <small>(바꿀 때만 다시 입력)</small>}</span>
        <input value={account} onChange={(e) => setAccount(e.target.value.replace(/[^\d-]/g, ""))} inputMode="numeric" maxLength={20} placeholder="숫자만" required />
      </label>
      <label className="field"><span>예금주</span><input value={holder} onChange={(e) => setHolder(e.target.value)} maxLength={20} required /></label>
      <label className="field"><span>기본 발송비 <small>(써보기 조건에 배송비가 없을 때 구매자에게 안내)</small></span>
        <div className="price-input"><input value={ship} onChange={(e) => setShip(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" /><b>원</b></div>
      </label>
      <p className="field-hint">계좌번호는 암호화해 저장하고, 내 상품을 신청한 구매자에게 입금할 때만 보여요.</p>
      {msg && <p className={msg.ok ? "form-ok" : "form-error"} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
      <button className="dark-button" type="submit" disabled={pending}>{pending ? "저장 중…" : "저장하기"}</button>
    </form>
  );
}

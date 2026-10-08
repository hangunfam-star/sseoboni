"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// param: id 제안 id, role seller(승인·거절) 또는 buyer(취소)
// return: 답을 기다리는 제안에 대한 버튼. 판매자는 한마디(선택)를 붙일 수 있다.
export function ProposalActions({ id, role }: { id: string; role: "seller" | "buyer" }) {
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function act(action: "ACCEPT" | "DECLINE" | "CANCEL") {
    if (pending) return;
    if (action === "ACCEPT" && !confirm("이 조건으로 써보기를 승인할까요? 결제·배송이 열리면 이 조건으로 진행돼요.")) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/proposals/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reply }) });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) { setError(d.error ?? "처리하지 못했어요."); return; }
    router.refresh();
  }

  if (role === "buyer") {
    return <div className="proposal-actions"><button type="button" onClick={() => act("CANCEL")} disabled={pending}>제안 취소</button>{error && <p className="form-error">{error}</p>}</div>;
  }
  return (
    <div className="proposal-actions">
      <input value={reply} onChange={(e) => setReply(e.target.value)} maxLength={200} placeholder="한마디(선택) · 연락처는 적지 마세요" aria-label="구매자에게 한마디" />
      <div>
        <button type="button" className="proposal-actions__yes" onClick={() => act("ACCEPT")} disabled={pending}>승인</button>
        <button type="button" onClick={() => act("DECLINE")} disabled={pending}>거절</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

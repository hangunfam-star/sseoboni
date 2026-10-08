"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// param: listingId 상품, label 버튼 글자, className 모양
// return: 판매자에게 채팅 시작(있으면 기존 채팅방으로 이동) 버튼
export function ChatStartButton({ listingId, label = "판매자와 채팅", className = "secondary-button" }: { listingId: string; label?: string; className?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function start() {
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listingId }) });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) { setError(res.status === 401 ? "닉네임을 정하고 시작하면 채팅할 수 있어요." : d.error ?? "채팅을 열지 못했어요."); return; }
    router.push(`/chats/${d.threadId}`);
  }

  return (
    <>
      <button type="button" className={className} onClick={start} disabled={pending}>{pending ? "여는 중…" : label}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}

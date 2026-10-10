"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// param: token 복구 링크 원문, nickname 들어갈 계정 이름. 누르면 링크를 쓰고 MY로 간다
export function UseLinkButton({ token, nickname }: { token: string; nickname: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  async function use() {
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/auth/login-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token }) }).catch(() => null);
    if (!res?.ok) {
      setPending(false);
      const data = await res?.json().catch(() => ({}));
      setError(data?.error ?? "들어가지 못했어요. 다시 시도해 주세요.");
      return;
    }
    router.replace("/me?recovered=1");
    router.refresh();
  }
  return (
    <>
      <button type="button" className="primary-button" disabled={pending} onClick={use}>{pending ? "들어가는 중…" : `${nickname} 계정으로 들어가기`}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}

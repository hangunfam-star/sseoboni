"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 운영자 키 입력 폼
export function AdminLogin() {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/admin/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) { setError(d.error ?? "들어가지 못했어요."); return; }
    setKey("");
    router.refresh();
  }

  return (
    <form className="login-card" onSubmit={submit}>
      <label className="field">
        <span>운영자 키</span>
        <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="current-password" required />
        <small className="field-hint">PC의 app/.env 파일 ADMIN_KEY 값이에요.</small>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "확인 중…" : "결과 보기"}</button>
    </form>
  );
}

export function AdminLogout() {
  const router = useRouter();
  return (
    <button type="button" className="text-button" onClick={async () => { await fetch("/api/admin/session", { method: "DELETE" }); router.refresh(); }}>
      운영자 나가기
    </button>
  );
}

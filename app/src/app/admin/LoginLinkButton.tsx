"use client";
import { useState } from "react";
import { CopyText } from "@/components/CopyText";

// param: userId 복구할 계정. 누르면 1회용 로그인 링크(24시간)를 만들어 보여 주고 복사할 수 있게 한다
export function LoginLinkButton({ userId }: { userId: string }) {
  const [pending, setPending] = useState(false);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function make() {
    if (pending) return;
    if (link && !confirm("새 링크를 만들면 방금 만든 링크는 쓸 수 없게 돼요. 계속할까요?")) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/admin/login-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) }).catch(() => null);
    setPending(false);
    const data = await res?.json().catch(() => null);
    if (!res?.ok || !data?.url) { setError(data?.error ?? "링크를 만들지 못했어요."); return; }
    setLink(data);
  }
  return (
    <div className="login-link-admin">
      <button type="button" className="secondary-button" disabled={pending} onClick={make}>{pending ? "만드는 중…" : link ? "새 복구 링크 만들기" : "복구 링크 만들기"}</button>
      {link && (
        <div className="login-link-admin__out">
          <code>{link.url}</code>
          <CopyText text={link.url} label="링크 복사" />
          <small>{new Date(link.expiresAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}까지 한 번만 쓸 수 있어요. 본인에게만 보내 주세요.</small>
        </div>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}

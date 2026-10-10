"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// 카카오 연결 해제. 해제하면 이 계정은 이 기기의 로그인 상태로만 들어올 수 있어 한 번 더 확인한다.
export function KakaoUnlinkButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  async function unlink() {
    if (pending) return;
    if (!confirm("카카오 연결을 해제할까요? 해제한 뒤 로그아웃하면 이 계정에 다시 들어올 수 없어요.")) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/auth/kakao/link", { method: "DELETE" }).catch(() => null);
    setPending(false);
    if (!res?.ok) { setError("연결을 해제하지 못했어요. 다시 시도해 주세요."); return; }
    router.replace("/me/login?kakao=unlinked");
    router.refresh();
  }
  return (
    <>
      <button type="button" className="secondary-button" disabled={pending} onClick={unlink}>{pending ? "해제하는 중…" : "카카오 연결 해제"}</button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </>
  );
}

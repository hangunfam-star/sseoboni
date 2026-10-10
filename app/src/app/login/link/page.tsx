import type { Metadata } from "next";
import Link from "next/link";
import { peekLoginLink } from "@/lib/login-link";
import { UseLinkButton } from "./UseLinkButton";

export const metadata: Metadata = { title: "계정 되찾기 · 써보니", robots: { index: false, follow: false }, referrer: "no-referrer" };

const REASON: Record<string, string> = {
  invalid: "올바른 복구 링크가 아니에요.",
  used: "이 링크는 이미 사용했어요. 다시 들어가야 하면 운영자에게 새 링크를 요청해 주세요.",
  expired: "링크 사용 기간(24시간)이 지났어요. 운영자에게 새 링크를 요청해 주세요.",
};

// 운영자가 보낸 계정 복구 링크 화면. 링크를 여는 것만으로는 쓰이지 않고, 버튼을 눌러야 들어간다.
export default async function LoginLinkPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  const peek = peekLoginLink(t);
  return (
    <div className="login-page page">
      <p className="wordmark">써보니<span>.</span></p>
      <section className="login-hero">
        <h1>계정 되찾기</h1>
        <p>{peek.ok ? "운영자가 보낸 복구 링크예요. 아래 버튼을 누르면 원래 계정으로 들어가요." : REASON[peek.reason]}</p>
      </section>
      <div className="login-card">
        {peek.ok ? (
          <>
            <p className="validation-notice"><strong>{peek.nickname ?? "이름 없는 계정"}</strong> 계정으로 들어가요. 이 링크는 한 번만 쓸 수 있어요.</p>
            <UseLinkButton token={t} nickname={peek.nickname ?? "이름 없는 계정"} />
          </>
        ) : (
          <Link className="primary-button" href="/login">처음 화면으로</Link>
        )}
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Gate 0 검증용 임시 로그인 — 실제 인증(휴대폰·본인인증)이 아니라
// 닉네임만으로 사용자를 구분하는 스텁입니다. (§78 Gate1/2 승인 전)
export default function LoginPage() {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "로그인에 실패했습니다.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div>
      <h1>닉네임으로 시작하기</h1>
      <p style={{ color: "#888", fontSize: 14 }}>
        검증 단계용 임시 로그인입니다. 같은 닉네임을 다시 입력하면 같은 계정으로 이어집니다.
      </p>
      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="닉네임 (2자 이상)"
          style={{ padding: 8, width: "60%", marginRight: 8 }}
        />
        <button type="submit" style={{ padding: "8px 16px" }}>시작</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}

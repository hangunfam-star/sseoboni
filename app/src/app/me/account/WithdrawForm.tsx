"use client";

import { useState } from "react";
import Link from "next/link";

type Blocker = { orderId: string; title: string; reason: string };

// 탈퇴: 지워지는 것·남는 것을 알리고, 칸에 아무 내용(사유 등)이나 입력해야 실행한다. 끝나지 않은 거래가 있으면 목록을 보여 준다.
export function WithdrawForm() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<Blocker[]>([]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    let res: Response;
    try {
      res = await fetch("/api/me/withdraw", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: text }) });
    } catch {
      // 응답을 못 받으면 탈퇴됐는지 알 수 없다 — 성공·실패를 단정하지 않고 확인 방법을 알려 준다
      setPending(false);
      setError("결과를 확인하지 못했어요. 화면을 새로고침해서 로그인 상태를 확인한 뒤 다시 시도해 주세요.");
      return;
    }
    const d = await res.json().catch(() => ({}));
    setPending(false);
    // 성공(이미 탈퇴 포함 200)이면 문서 전체를 새로 불러온다 — 계좌 칸·알림 수 같은 로그인 화면이 남지 않게
    if (res.ok) { window.location.replace("/withdrawn"); return; }
    setBlockers(Array.isArray(d.blockers) ? d.blockers : []);
    setError(d.error ?? "탈퇴하지 못했어요.");
  }

  return (
    <section className="withdraw-box" aria-labelledby="withdraw-title">
      <h2 className="section-title" id="withdraw-title">탈퇴하기</h2>
      {!open ? <button className="text-button" type="button" onClick={() => setOpen(true)}>탈퇴 안내 보기</button> : (
        <form onSubmit={submit}>
          <ul className="field-hint withdraw-list">
            <li>바로 로그아웃되고, 이 계정으로 다시 로그인할 수 없어요.</li>
            <li>정산 계좌, 찜, 찾는 상품, 알림, 알림 설정, 프로필 사진이 지워져요.</li>
            <li>판매 중인 상품은 내려가요. 후기는 남고 다른 사람에게는 &quot;탈퇴한 사용자&quot;로 보여요. 거래 기록은 법에 따라 따로 보관했다가 기간이 지나면 지워요.</li>
            <li>카카오 계정의 써보니 연결은 카카오 설정에서 직접 끊을 수 있어요. 같은 카카오로 다시 들어오면 새 계정이 돼요.</li>
            <li>끝나지 않은 거래나, 끝난 지 7일이 안 된 거래가 있으면 탈퇴할 수 없어요.</li>
          </ul>
          <label className="field"><span>탈퇴하려면 아무 내용이나 입력해 주세요(탈퇴 사유 등)</span>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="여기에 직접 입력" maxLength={500} autoComplete="off" />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          {blockers.length > 0 && (
            <>
              <ul className="withdraw-blockers">
                {blockers.map((b) => <li key={b.orderId}><Link href={`/orders/${b.orderId}`}>{b.title}</Link> · {b.reason}</li>)}
              </ul>
              <p className="field-hint">자동 처리를 기다리는 거래라면 10분쯤 뒤에 다시 시도해 주세요. 상대가 응답하지 않으면 <Link href="/feedback">의견 보내기</Link>로 알려 주세요.</p>
            </>
          )}
          <button className="dark-button withdraw-submit" type="submit" disabled={pending || text.trim() === ""} aria-busy={pending}>{pending ? "탈퇴 처리 중…" : "탈퇴하기"}</button>
        </form>
      )}
    </section>
  );
}

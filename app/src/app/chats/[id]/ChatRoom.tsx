"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { id: string; seq: number; senderId: string; body: string; kind?: string; createdAt: string };
const POLL_STEPS = [4000, 4000, 4000, 8000]; // 새 메시지가 없으면 최대 8초 간격으로 확인
const REASONS = ["욕설·비방", "직거래·외부 연락 유도", "사기 의심", "기타"];

// param: s 저장 시각(UTC, "YYYY-MM-DD HH:MM:SS" 또는 ISO). return: 한국 시간 "10.09 14:07"
function kstShort(s: string): string {
  const d = new Date(new Date(s.includes("T") ? s : `${s.replace(" ", "T")}Z`).getTime() + 9 * 3600_000).toISOString();
  return `${d.slice(5, 7)}.${d.slice(8, 10)} ${d.slice(11, 16)}`;
}

// param: threadId 채팅방, me 내 사용자 id, initial 처음 메시지, otherName 상대 닉네임
// return: 메시지 목록(4초마다 새 메시지 확인)·입력창·신고
export function ChatRoom({ threadId, me, initial, otherName }: { threadId: string; me: string; initial: Msg[]; otherName: string }) {
  const [messages, setMessages] = useState<Msg[]>(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null); // 신고할 메시지 id
  const [notice, setNotice] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const lastSeq = useRef(initial.length > 0 ? initial[initial.length - 1].seq : 0);
  const quiet = useRef(0);

  function merge(incoming: Msg[]) {
    if (incoming.length === 0) return;
    lastSeq.current = Math.max(lastSeq.current, ...incoming.map((m) => m.seq));
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const add = incoming.filter((m) => !seen.has(m.id));
      return add.length > 0 ? [...prev, ...add].sort((a, b) => a.seq - b.seq) : prev;
    });
  }

  // 새 메시지 확인: 순번 커서 다음부터, 남은 게 있으면(hasMore) 끝까지 이어서 가져온다.
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (stop) return;
      if (document.visibilityState === "visible") {
        let more = true;
        let got = 0;
        while (more && !stop) {
          const res = await fetch(`/api/chats/${threadId}?after=${lastSeq.current}`).catch(() => null);
          if (!res?.ok) break;
          const d = await res.json();
          merge(d.messages ?? []);
          got += (d.messages ?? []).length;
          more = Boolean(d.hasMore);
        }
        quiet.current = got > 0 ? 0 : Math.min(quiet.current + 1, POLL_STEPS.length - 1);
      }
      timer = setTimeout(poll, POLL_STEPS[quiet.current]);
    }
    timer = setTimeout(poll, POLL_STEPS[0]);
    return () => { stop = true; clearTimeout(timer); };
  }, [threadId]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (pending || !text.trim()) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/chats/${threadId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
    const d = await res.json().catch(() => ({}));
    setPending(false);
    if (!res.ok) { setError(d.error ?? "보내지 못했어요."); return; }
    merge([d.message]);
    quiet.current = 0;
    setText("");
  }

  async function report(reason: string) {
    const res = await fetch(`/api/chats/${threadId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, messageId: reporting }) });
    setReporting(null);
    setNotice(res.ok ? "신고를 받았어요. 운영자가 확인할게요." : "신고하지 못했어요.");
  }

  return (
    <div className="chat-room">
      <ol className="chat-messages" aria-live="polite">
        <li className="chat-system">연락처·계좌·메신저 아이디는 보낼 수 없어요. 입금·환불 계좌는 거래 화면에서만 확인해요.</li>
        {messages.map((m) => {
          if (m.kind === "SYSTEM") return <li key={m.id} className="chat-system chat-system--trade"><p>{m.body}</p><time>{kstShort(m.createdAt)}</time></li>;
          const mine = m.senderId === me;
          return (
            <li key={m.id} className={`chat-bubble ${mine ? "chat-bubble--me" : "chat-bubble--other"}`}>
              {!mine && <small>{otherName}</small>}
              <p>{m.body}</p>
              <span className="chat-bubble__meta">
                <time>{kstShort(m.createdAt)}</time>
                {!mine && <button type="button" className="text-button" onClick={() => setReporting(m.id)}>신고</button>}
              </span>
            </li>
          );
        })}
        <div ref={bottom} />
      </ol>
      {reporting && (
        <div className="chat-report" role="dialog" aria-label="신고 이유">
          <p>신고 이유를 골라 주세요</p>
          <div>{REASONS.map((r) => <button key={r} type="button" onClick={() => report(r)}>{r}</button>)}</div>
          <button type="button" className="text-button" onClick={() => setReporting(null)}>취소</button>
        </div>
      )}
      {notice && <p className="form-ok" role="status">{notice}</p>}
      <form className="chat-input" onSubmit={send}>
        <label className="sr-only" htmlFor="chat-text">메시지</label>
        <textarea id="chat-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={1} placeholder="메시지를 입력하세요"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
        <button type="submit" disabled={pending || !text.trim()}>보내기</button>
      </form>
      {error && <p className="form-error chat-error" role="alert">{error}</p>}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";

type Msg = { id: string; senderId: string; body: string; createdAt: string };
const POLL_MS = 4000;
const REASONS = ["욕설·비방", "직거래·외부 연락 유도", "사기 의심", "기타"];

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
  const lastAt = messages.length > 0 ? messages[messages.length - 1].createdAt : undefined;

  function merge(incoming: Msg[]) {
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const add = incoming.filter((m) => !seen.has(m.id));
      return add.length > 0 ? [...prev, ...add] : prev;
    });
  }

  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const q = lastAt ? `?after=${encodeURIComponent(lastAt)}` : "";
      const res = await fetch(`/api/chats/${threadId}${q}`).catch(() => null);
      if (res?.ok) merge((await res.json()).messages ?? []);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [threadId, lastAt]);

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
        <li className="chat-system">연락처·계좌·메신저 아이디는 보낼 수 없어요. 결제·배송은 아직 열리지 않았어요.</li>
        {messages.map((m) => {
          const mine = m.senderId === me;
          return (
            <li key={m.id} className={`chat-bubble ${mine ? "chat-bubble--me" : "chat-bubble--other"}`}>
              {!mine && <small>{otherName}</small>}
              <p>{m.body}</p>
              <span className="chat-bubble__meta">
                <time>{m.createdAt.slice(5, 16).replace("-", ".").replace(" ", " ")}</time>
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

"use client";

import { useState } from "react";
import { COMPONENT_MAX, COMPONENT_SUGGESTIONS } from "@/ui/listing-components";

// param: value 고른 구성품 이름 목록, onChange 바뀐 목록을 받는 함수
// return: 자주 쓰는 구성품 칩 + 직접 추가 입력칸
export function ComponentPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const custom = value.filter((v) => !(COMPONENT_SUGGESTIONS as readonly string[]).includes(v));
  const full = value.length >= COMPONENT_MAX;

  function toggle(name: string) {
    onChange(value.includes(name) ? value.filter((v) => v !== name) : full ? value : [...value, name]);
  }

  function add() {
    const name = draft.trim().slice(0, 30);
    if (!name || value.includes(name) || full) return;
    onChange([...value, name]);
    setDraft("");
  }

  return (
    <fieldset className="field component-picker">
      <legend>구성품 <small>(있는 것을 모두 골라 주세요)</small></legend>
      <div className="component-picker__chips">
        {COMPONENT_SUGGESTIONS.map((name) => (
          <button key={name} type="button" className="chip" aria-pressed={value.includes(name)} onClick={() => toggle(name)}>{name}</button>
        ))}
        {custom.map((name) => (
          <button key={name} type="button" className="chip" aria-pressed="true" aria-label={`${name} 빼기`} onClick={() => toggle(name)}>{name} ×</button>
        ))}
      </div>
      <div className="component-picker__add">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="직접 추가 (예: 펜슬, 여분 이어팁)" maxLength={30} aria-label="구성품 직접 추가" disabled={full} />
        <button type="button" className="secondary-button" onClick={add} disabled={full || !draft.trim()}>추가</button>
      </div>
    </fieldset>
  );
}

"use client";
import { useId, useMemo, useState } from "react";

export const CUSTOM_MODEL = "__custom__"; // 목록에 없는 모델(직접 입력)

const norm = (s: string) => s.toLowerCase().replace(/[\s()\-_/·.,]/g, "");

// 한글로 쳐도 영어 모델명이 찾아지게(맥북 → macbook)
const ALIAS: [string, string][] = [
  ["맥북", "macbook"], ["아이맥", "imac"], ["아이패드", "ipad"], ["아이폰", "iphone"], ["에어팟", "airpods"], ["애플워치", "applewatch"], ["애플", "apple"],
  ["갤럭시북", "galaxybook"], ["갤럭시탭", "galaxytab"], ["갤럭시", "galaxy"], ["삼성", "samsung"], ["엘지", "lg"], ["그램", "gram"],
  ["소니", "sony"], ["닌텐도", "nintendo"], ["스위치", "switch"], ["플레이스테이션", "playstation"], ["다이슨", "dyson"], ["보스", "bose"],
  ["나이키", "nike"], ["아디다스", "adidas"], ["뉴발란스", "newbalance"], ["컨버스", "converse"], ["에어", "air"], ["프로", "pro"], ["미니", "mini"], ["울트라", "ultra"],
];
const key = (s: string) => ALIAS.reduce((t, [ko, en]) => t.split(ko).join(en), norm(s));

// param: models 고를 수 있는 모델, text 입력칸 글자, modelId 고른 모델 id(목록에 없으면 CUSTOM_MODEL, 비었으면 ""), onChange 새 글자·id
// return: 글자를 넣으면 맞는 모델이 아래에 뜨는 모델 입력칸. 목록에서 고르지 않고 그대로 두면 직접 입력한 모델이 된다
export function ModelPicker({ models, text, modelId, onChange }: { models: { id: string; label: string }[]; text: string; modelId: string; onChange: (v: { text: string; modelId: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const hits = useMemo(() => {
    const q = key(text);
    const list = q ? models.filter((m) => key(m.label).includes(q)) : models;
    return list.slice(0, 8);
  }, [models, text]);
  const showList = open && hits.length > 0 && !(modelId && modelId !== CUSTOM_MODEL);

  // 치는 동안에는 직접 입력으로 정하지 않는다(종류·브랜드 칸이 들쑥날쑥하지 않게). 다른 칸으로 가거나 Enter를 누르면 정한다
  function type(v: string) {
    const exact = models.find((m) => norm(m.label) === norm(v));
    onChange({ text: v, modelId: exact ? exact.id : "" });
    setOpen(true);
    setActive(-1);
  }
  function commit() {
    setOpen(false);
    if (modelId || !text.trim()) return;
    const exact = models.find((m) => norm(m.label) === norm(text));
    onChange({ text, modelId: exact ? exact.id : CUSTOM_MODEL });
  }
  function pick(m: { id: string; label: string }) {
    onChange({ text: m.label, modelId: m.id });
    setOpen(false);
    setActive(-1);
  }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return; // 한글 조합 중 Enter는 글자 확정용
    if (e.key === "ArrowDown" && hits.length) { e.preventDefault(); setOpen(true); setActive((a) => (a + 1) % hits.length); }
    else if (e.key === "ArrowUp" && hits.length) { e.preventDefault(); setActive((a) => (a <= 0 ? hits.length - 1 : a - 1)); }
    else if (e.key === "Enter" && showList && active >= 0) { e.preventDefault(); pick(hits[active]); }
    else if (e.key === "Enter" && !modelId && text.trim()) { e.preventDefault(); commit(); }
    else if (e.key === "Escape") setOpen(false);
  }

  return (
    <div className="model-picker">
      <input
        role="combobox" aria-expanded={showList} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        value={text} onChange={(e) => type(e.target.value)} onFocus={() => setOpen(true)} onBlur={commit} onKeyDown={onKey}
        placeholder="모델명을 입력하세요 (예: 맥북 에어 M2)" autoComplete="off" maxLength={60} required
      />
      {showList && (
        <ul className="model-picker__list" id={listId} role="listbox">
          {hits.map((m, i) => (
            <li key={m.id} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={i === active ? "is-active" : undefined}
              onMouseDown={(e) => { e.preventDefault(); pick(m); }}>{m.label}</li>
          ))}
        </ul>
      )}
      {modelId === CUSTOM_MODEL && <small className="field-hint">목록에 없는 모델이에요. 그대로 쓰려면 아래에 종류와 브랜드를 적어 주세요.</small>}
      {modelId && modelId !== CUSTOM_MODEL && <small className="field-hint model-picker__ok">등록된 모델로 골랐어요</small>}
    </div>
  );
}

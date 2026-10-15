"use client";
import { checkItemsFor } from "@/ui/check-items";

// param: category 상품 종류, value {항목 key: 값}, onChange, required 써보기 상품이면 모두 필수
// return: 판매자 점검표 입력(품목별 항목, 고르기 또는 짧게 적기). 받을 때·검수 때 이 점검표와 비교한다
export function CheckFields({ category, value, onChange, required }: { category: string | null; value: Record<string, string>; onChange: (v: Record<string, string>) => void; required: boolean }) {
  const items = checkItemsFor(category);
  const set = (k: string, v: string) => onChange({ ...value, [k]: v });
  const done = items.filter((it) => value[it.key]?.trim()).length;
  return (
    <fieldset className="check-fields">
      <legend>상품 점검표 <small>{required ? `써보기 상품은 모두 채워 주세요 · ${done}/${items.length}` : `채운 항목만 보여요 · ${done}/${items.length}`}</small></legend>
      <p className="field-hint">구매자가 받을 때와 돌려보낼 때 이 점검표로 상태를 비교해요. 사실대로 적어 주세요.</p>
      {items.map((it) => (
        <div className="check-row" key={it.key}>
          <span className="check-row__label">{it.label}{required && <b aria-hidden="true"> *</b>}</span>
          {it.options ? (
            <div className="check-row__options" role="group" aria-label={it.label}>
              {it.options.map((o) => (
                <button key={o} type="button" aria-pressed={value[it.key] === o} onClick={() => set(it.key, value[it.key] === o ? "" : o)}>{o}</button>
              ))}
            </div>
          ) : (
            <input value={value[it.key] ?? ""} onChange={(e) => set(it.key, e.target.value)} placeholder={it.placeholder} maxLength={30} aria-label={it.label} />
          )}
        </div>
      ))}
    </fieldset>
  );
}

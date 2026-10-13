import { Slider } from "./Slider";
import { DEMO_ACTIVITY, DEMO_REVIEWS, DEMO_STATS, DEMO_VERDICTS } from "@/content/demo-trial";

const Tag = ({ text = "예시" }: { text?: string }) => <span className="demo-tag">{text}</span>;

// 메인 "써보기 이야기": 숫자·후기·모델별 결론·활동을 예시 데이터로 보여 준다(블록마다 3개, 슬라이드).
// 실제 기록이 아니므로 블록 제목마다 "예시", 아래에 "실제 기록이 아니에요"를 붙인다.
export function DemoTrialStories() {
  return (
    <section className="demo-stories" aria-labelledby="demo-title">
      <div className="demo-stories__head">
        <h2 className="section-title" id="demo-title">써보니는 이렇게 쌓여요 <Tag text="예시 화면" /></h2>
        <p>서비스 시작 전이라 아래 숫자·후기·활동은 모두 <b>예시</b>예요. 실제 거래가 쌓이면 진짜 기록으로 바뀌어요.</p>
      </div>

      <div className="demo-block">
        <h3>📊 써보니 숫자 <Tag /></h3>
        <Slider label="써보니 숫자 예시">
          {DEMO_STATS.map((s) => (
            <div key={s.title} className="demo-stats">
              <span className="demo-stats__title">{s.title}</span>
              <div className="demo-stats__grid">
                {s.items.map((it) => <div key={it.label} className="demo-stat"><b>{it.value}<em>{it.unit}</em></b><small>{it.label}</small></div>)}
              </div>
            </div>
          ))}
        </Slider>
      </div>

      <div className="demo-block">
        <h3>⭐ 써보고 결정한 사람들 <Tag text="예시 후기" /></h3>
        <Slider label="써보기 후기 예시" peek>
          {DEMO_REVIEWS.map((r) => (
            <article key={r.model} className="demo-review">
              <div className="demo-review__top">
                <span className="demo-review__thumb" aria-hidden="true">{r.emoji}</span>
                <div><strong>{r.model}</strong><p>{r.hours}시간 써봄 · 체험료 {r.fee.toLocaleString("ko-KR")}원</p></div>
              </div>
              <div className="demo-review__result">
                <span className={r.outcome === "PURCHASED" ? "demo-result" : "demo-result demo-result--back"}>{r.outcome === "PURCHASED" ? "써보고 구매" : "써보고 반납"}</span>
                <span className="demo-score">써보기 만족 {r.score}/10</span>
              </div>
              <div className="demo-chips">{r.checked.map((c) => <span key={c}>{c}</span>)}</div>
              <p className="demo-better">👍 {r.better}</p>
              <p className="demo-quote">“{r.quote}”</p>
              <small className="demo-mark">예시 후기 · 실제 이용자 후기가 아니에요</small>
            </article>
          ))}
        </Slider>
      </div>

      <div className="demo-block">
        <h3>🧪 써본 사람들의 결론 <Tag /></h3>
        <Slider label="모델별 써본 결론 예시">
          {DEMO_VERDICTS.map((v) => {
            const total = v.bought + v.returned;
            return (
              <div key={v.model} className="demo-verdict">
                <strong>{v.model}</strong>
                <div className="demo-verdict__bar" role="img" aria-label={`써보고 구매 ${v.bought}명, 반납 ${v.returned}명`}>
                  <i style={{ width: `${(v.bought / total) * 100}%` }} /><i className="is-back" style={{ width: `${(v.returned / total) * 100}%` }} />
                </div>
                <div className="demo-verdict__legend"><span>써보고 구매 {v.bought}명</span><span>반납 {v.returned}명</span></div>
                <dl>
                  <div><dt>가장 많이 확인한 점</dt><dd>{v.topChecked}</dd></div>
                  <div><dt>반납 이유 1위</dt><dd>{v.topReturn}</dd></div>
                  <div><dt>평균 써본 기간</dt><dd>{v.avgHours}시간</dd></div>
                </dl>
              </div>
            );
          })}
        </Slider>
      </div>

      <div className="demo-block">
        <h3>🔔 써보기 활동 <Tag text="예시 활동" /></h3>
        <Slider label="써보기 활동 예시" autoMs={3500}>
          {DEMO_ACTIVITY.map((a) => (
            <p key={a.text} className="demo-activity"><span className="demo-activity__dot" aria-hidden="true" /><b>{a.when}</b> {a.place}에서 {a.text}</p>
          ))}
        </Slider>
        <p className="demo-note">※ 예시 활동이에요. 실제 기록이 아니에요.</p>
      </div>
    </section>
  );
}

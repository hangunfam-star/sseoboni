import { Slider } from "./Slider";
import { DEMO_ACTIVITY, DEMO_REVIEWS, DEMO_STATS, DEMO_VERDICTS } from "@/content/demo-trial";

// 메인 "써보기 이야기": 숫자·후기·모델별 결론·활동을 미리보기 데이터로 보여 준다(블록마다 3개, 슬라이드).
// 실제 기록이 아니므로 섹션 맨 위에 "미리보기 화면" 안내를 한 줄 둔다(사용자 결정 2026-10-13: 블록·카드별 표시는 없앰). 이 줄은 지우지 않는다.
export function DemoTrialStories() {
  return (
    <section className="demo-stories" aria-labelledby="demo-title">
      <div className="demo-stories__head">
        <h2 className="section-title" id="demo-title">써보니는 이렇게 쌓여요</h2>
        <p className="demo-disclosure">써보니가 열리면 이렇게 보여요 · <b>미리보기 화면</b></p>
      </div>

      <div className="demo-block">
        <h3>📊 써보니 숫자</h3>
        <Slider label="써보니 숫자 미리보기">
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
        <h3>⭐ 써보고 결정한 사람들</h3>
        <Slider label="써보기 후기 미리보기" peek>
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
            </article>
          ))}
        </Slider>
      </div>

      <div className="demo-block">
        <h3>🧪 써본 사람들의 결론</h3>
        <Slider label="모델별 써본 결론 미리보기">
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
        <h3>🔔 써보기 활동</h3>
        <Slider label="써보기 활동 미리보기" autoMs={3500}>
          {DEMO_ACTIVITY.map((a) => (
            <p key={a.text} className="demo-activity"><span className="demo-activity__dot" aria-hidden="true" /><b>{a.when}</b> {a.place}에서 {a.text}</p>
          ))}
        </Slider>
      </div>
    </section>
  );
}

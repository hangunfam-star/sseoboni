import { Slider } from "./Slider";

// "일반 중고 vs 써보니" 비교 그림 블록. 그림 왼쪽 = 일반 중고, 오른쪽 = 써보니. 그림 안에는 글자가 없어 제목·설명은 여기서 붙인다.
// 마스코트(윙크하는 쇼핑백)가 안내하는 그림(사용자 선택 B안, 2026-10-13).
const STEPS = [
  { title: "사기 전에, 집에서 직접 써봐요", before: "사진·설명만 보고 결정", after: "집에서 직접 써보고 결정" },
  { title: "마음에 안 들면 돌려보내요", before: "받고 나서 하자 발견 → 판매자와 다툼", after: "돌려보내고 환불 받기" },
  { title: "써본 사람의 후기로 확인해요", before: "판매자 말만 믿기", after: "써본 사람들의 써보기 후기" },
  { title: "구성품은 체크리스트로 검수해요", before: "구성품 빠짐은 운에 맡김", after: "체크리스트로 하나씩 확인" },
];

export function CompareBlock() {
  return (
    <section className="compare-block" aria-label="일반 중고와 써보니 비교">
      <h2 className="section-title">사진만 보고 사던 중고, 이렇게 달라져요</h2>
      <Slider label="일반 중고와 써보니 비교" peek>
        <figure className="compare-slide compare-slide--hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/compare/hero.webp" alt="써보니로 여러 물건을 써보고 고르는 모습" width={1536} height={1024} loading="lazy" />
          <figcaption><strong>써보고 사는 중고거래, 써보니</strong><span>태블릿·헤드폰·노트북·카메라까지, 사기 전에 먼저 써봐요</span></figcaption>
        </figure>
        {STEPS.map((s, i) => (
          <figure key={s.title} className="compare-slide">
            <div className="compare-slide__img">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/compare/step${i + 1}.webp`} alt={`왼쪽 일반 중고: ${s.before} / 오른쪽 써보니: ${s.after}`} width={1536} height={1024} loading="lazy" />
              <span className="compare-chip compare-chip--before">일반 중고</span>
              <span className="compare-chip compare-chip--after">써보니</span>
            </div>
            <figcaption>
              <strong><em>{i + 1}</em>{s.title}</strong>
              <span className="compare-row"><b>일반 중고</b>{s.before}</span>
              <span className="compare-row compare-row--after"><b>써보니</b>{s.after}</span>
            </figcaption>
          </figure>
        ))}
      </Slider>
    </section>
  );
}

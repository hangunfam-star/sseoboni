# 써보니 — Codex 개발용 마스터 기획서 v1.0

> 기준일: 2026-08-27  
> 목적: 지금까지 논의한 **써보니의 서비스 기획, BM, 거래/반환/분쟁 정책, UX, 시장검증, 데이터 전략, 신뢰등급, 광고상품, 장기 확장 방향**을 실제 개발용 단일 문서로 통합한다.  
> 상태: **실개발 착수용 마스터 스펙**

---

# 0. 문서 사용 원칙

이 문서는 Codex 또는 개발팀이 써보니를 구현할 때 참조할 제품 기준서다.

핵심 원칙:

- **일반 중고거래가 기본**이고, `써보기`는 판매자가 선택하는 거래 옵션이다.
- 써보니는 렌탈 앱이 아니다.
- 구매하지 않고 정상적으로 반환한 사용자를 악성 사용자로 보지 않는다.
- 가격, 수수료, 써보기 기간, 등급 혜택, 광고가격은 **하드코딩하지 않는다.**
- 자연 랭킹과 유료 광고 노출은 분리한다.
- 공개 수요 숫자는 실제 행동 데이터만 사용한다.
- 상품상태는 거래 전후로 증거화한다.
- 분쟁 시 관련 금액을 보류할 수 있어야 한다.
- 장기기능은 Feature Flag 뒤에 둔다.
- 법률, PG, 에스크로, 보험 세부구조는 정식 출시 전 별도 검토가 필요하다.

---

# 1. 서비스 정의

## 현재 핵심 정의

**써보니는 일반 중고거래를 기본으로 하되, 판매자가 허용한 상품은 구매자가 일정 기간 직접 써본 뒤 구매 또는 유료 반환을 결정할 수 있는 중고거래 플랫폼이다.**

차이:

- 렌탈: 필요한 동안 빌리고 반납
- 써보니: **사고 싶은 상품을 실제 환경에서 경험한 뒤 구매 여부를 결정**

## 장기 정의

**써보니는 ‘사고 싶은 물건을 실제로 경험하고 결정하는 Product Experience Network’이며, 그 첫 번째 시장이 중고거래다.**

---

# 2. 브랜드 / 포지셔닝

서비스명: **써보니**

메인 카피 후보:

- **사고팔고, 써보고.**
- **사기 전에, 써보니.**

서브 카피:

- **중고거래의 새로운 방법**
- 잘 아는 제품은 바로 사고, 고민되는 제품은 먼저 써보고 결정하세요.

경쟁 포지셔닝:

- 당근 = 가까운 사람에게 산다
- 번개장터 = 전국에서 원하는 중고를 안전하게 산다
- 써보니 = **사기 전에 직접 써보고 결정한다**

써보니가 추가로 해결하는 질문:

> **“이 물건이 나에게 맞는가?”**

---

# 3. 해결하려는 문제

중고상품 구매자는 다음 이유로 구매를 망설인다.

- 직접 써보지 못함
- 개인에게 맞는지 판단하기 어려움
- 사용감/착용감/휴대성/공간 적합성은 스펙과 리뷰만으로 부족
- 구매 후 다시 되파는 비용과 번거로움
- 개인 중고거래의 반품 불확실성
- 상태/하자에 대한 불안

판매자는:

- 가능한 비싸게 팔고 싶음
- 빨리 팔고 싶음
- 귀찮은 분쟁을 피하고 싶음

써보니의 가설:

> **구매실패 비용이 크고 실제 사용 전에는 적합성을 알기 어려운 중고상품에서 `써보고 결정` 옵션이 새로운 거래를 만들어낼 수 있다.**

---

# 4. 구조적 리스크

써보기는 차별점이면서 가장 큰 비용원이다.

## 판매자 리스크

- 정산 지연
- 체험 동안 재고 잠김
- 상품 가치 하락
- 흠집/오염/파손
- 인기상품 판매자는 굳이 써보기를 열 동기가 약함
- 잘 안 팔리는 상품만 몰리는 역선택 가능성

## 구매자 리스크

- 상품대금 전액이 일정 기간 묶임
- 체험료 + 왕복 배송비 부담
- 기존 하자 책임전가
- 고가상품 분쟁
- 계정/데이터 문제

## 플랫폼 리스크

- 왕복 물류
- PG/환불 원가
- CS
- 파손판정
- 사기/차지백
- 분쟁증빙
- 보상 준비금
- 법률
- 양면시장 CAC

## 핵심 경제성 공식

**구매자가 지불할 최대 써보기 비용(WTP)**  
> **판매자가 요구하는 최소 보상(WTA) + PG/운영/리스크 원가 + 플랫폼 마진**

이 교집합이 실제 시장에 있어야 한다.

---

# 5. 거래 타입

```text
TransactionType
- DIRECT_SALE
- TRY_BEFORE_BUY
- EXPERIENCE_ONLY      # 미래 '써보고'
- BRAND_TRIAL          # 미래 브랜드 공식 체험
```

---

# 6. 일반 중고거래

판매자는 상품등록 시 선택:

1. **바로 판매만**
2. **써보기 허용**

모든 판매자에게 써보기를 강제하지 않는다.

기본 흐름:

```text
상품 등록
→ 구매자 결제
→ 판매자 발송
→ 구매자 수령
→ 구매확정
→ 판매자 정산
```

---

# 7. 써보기 거래 정책

## 기간

원안은 1~7일.

BM 검토 후 초기 MVP는 **24/48/72시간**부터 검증하는 방향이 우선.

기간은 하드코딩하지 않는다.

```text
trial_duration_hours
- 24
- 48
- 72
```

향후 5일/7일 확장 가능.

## 상품대금

구매자는 원칙적으로 **상품대금 전액을 먼저 결제**한다.

목적:

- 미반환 리스크 감소
- 단순 렌탈과 구분
- 반환되지 않을 경우 매매확정 구조 가능

실제 PG/에스크로가 체험 + 반환기간 동안 정산보류를 지원하는지 확인 필요.

```text
payment_provider
payment_status
escrow_status
settlement_hold_until
```

---

# 8. 써보기 비용

과거 테스트 예시:

- 1일 2,000원
- 1일 4,000원
- 고가 노트북 72시간 15,000~30,000원 등

모두 확정가격이 아니다.

초기 원안:

> 구매하면 체험료 0원  
> 반환하면 체험료 + 배송비 부담

BM 검토 후 대안:

> 구매 시에도 일정 서비스/옵션비는 남기고, 판매자 사용보상 일부만 구매가격에 상계

따라서 **구매 시 체험료 0원은 아직 고정 정책으로 구현하지 않는다.**

가격 엔티티 예:

```text
TrialPricing
- item_price
- option_fee
- seller_trial_compensation
- platform_service_fee
- risk_reserve_fee
- outbound_shipping_fee
- return_shipping_fee
- purchase_credit_amount
- return_total_cost
```

---

# 9. 써보기 상태머신

```text
DRAFT
LISTED
TRY_REQUESTED
PAYMENT_PENDING
PAYMENT_HELD
SELLER_PREPARING
SELLER_SHIPPED
DELIVERED
TRIAL_ACTIVE

TRIAL_PURCHASE_CONFIRMED
RETURN_REQUESTED
RETURN_SHIPMENT_PENDING
RETURN_SHIPPED
RETURN_DELIVERED
SELLER_RETURN_INSPECTION

COMPLETED_PURCHASE
COMPLETED_RETURN

DISPUTE_OPEN
DISPUTE_REVIEW
DISPUTE_RESOLVED

CANCELLED
EXPIRED
```

정상 구매:

```text
DELIVERED
→ TRIAL_ACTIVE
→ TRIAL_PURCHASE_CONFIRMED
→ COMPLETED_PURCHASE
→ 정산
```

정상 반환:

```text
DELIVERED
→ TRIAL_ACTIVE
→ RETURN_REQUESTED
→ RETURN_SHIPPED
→ RETURN_DELIVERED
→ SELLER_RETURN_INSPECTION
→ COMPLETED_RETURN
→ 환급/판매자 보상/플랫폼 수익
```

분쟁:

```text
→ DISPUTE_OPEN
→ settlement/refund hold
→ DISPUTE_REVIEW
→ DISPUTE_RESOLVED
```

---

# 10. 써보기 만료

원안:

> 기한까지 아무 행동이 없으면 구매확정

다만 약관상 고객의 부작위를 의사표시로 보는 문제를 고려해 반드시:

1. 신청 시 별도 확인
2. 종료 전 알림
3. 종료 직전 알림
4. 반환신청 마감시각 명확화
5. 예외사유 검토

구성.

```text
auto_confirm_purchase_on_expiry
expiry_grace_period_minutes
pre_expiry_notification_schedule
```

정식 출시 전 법률검토 필수.

---

# 11. 반환

## 정상 반환

상품에 문제가 없어도 써보기기간 내 반환 가능.

구매자 부담 후보:

- 옵션/체험 비용
- 배송비
- 사전고지 비용

## 반환 신청 후 미발송

예:

```text
반환신청
→ 48시간 내 택배 인계
→ 미발송 알림
→ 추가 유예
→ 정당한 이유 없이 계속 미발송 시 반환권 소멸/구매확정 검토
```

택배사 장애 등 구매자 책임 없는 경우 제외.

---

# 12. 단순 반환과 하자 신고 분리

UI:

### `그냥 돌려보낼래요`

정상 체험 반환.

### `상품에 문제가 있어요`

예:

- 미고지 하자
- 게시글과 현저히 다른 상태
- 기능불량
- 주요 구성품 누락
- 계정 잠금/MDM
- 허위 사양

판매자 귀책이면 비용면제/배송비조정/수리/환급/계약해제 등을 검토.

---

# 13. 파손 / 사용흔적

원칙:

1. 실제 사용이 허용되는 서비스다.
2. 정상적 사용흔적만으로 반환을 막지 않는다.
3. 구매자가 새롭게 만든 명확한 손상은 구매자 책임.
4. 미고지 기존 하자는 판매자 책임.
5. 증거로 판단한다.

손해액 우선순위:

1. 공식 서비스센터
2. 객관적 부품비
3. 전문 수리견적
4. 실제 중고가치 하락
5. 전손이면 거래가액 범위

`스크래치 = 상품가 10%` 같은 일률적 규칙은 지양.

---

# 14. 구성품

판매자는 반환필수 구성품 체크.

- 본체
- 충전기
- 케이블
- 펜
- 케이스
- 리모컨
- 액세서리

누락 시 합리적 교체비용 기준.

---

# 15. 정상 반복반환과 악성사용 구분

정상:

```text
10번 써보기
0번 구매
10번 정상 비용 지급
10번 기한 내 반환
파손 0
```

→ 정상 또는 우수 사용자.

위험행동:

- 반복 손상
- 부품 바꿔치기
- 동일제품 바꿔치기
- 구성품 누락
- 시리얼 훼손
- 임의 분해
- 허위 하자
- 반환지연
- 결제사기
- 비정상 차지백
- 다중계정
- 제3자 대여/재판매

**구매전환율을 구매자 신뢰도의 핵심으로 사용하지 않는다.**

---

# 16. 신규 구매자 리스크 제한

예시:

- 본인인증
- 실명 결제수단
- 배송지 확인
- 동시 써보기 1건
- 최대 72시간
- 최대 상품가격 제한

신뢰도 상승 후 한도 확대.

```text
Lv0
max_active_trials = 1
max_item_price = 1,000,000

Lv2
max_active_trials = 2
max_item_price = 2,500,000
```

숫자는 설정값.

---

# 17. 써보기 Eligible 상품

조건 예:

- 시리얼 식별 가능
- 정상작동
- 미개봉 제외
- 상태 명확
- 일정 가격 이상
- 정상체험으로 급격히 소모되지 않음
- 상태기록 가능
- 위생/사기 위험 허용범위
- 판매자 신뢰요건 충족

```text
trial_eligibility_status
trial_eligibility_reason
trial_eligibility_policy_version
```

---

# 18. 초기 카테고리

## 확정 1군: 노트북

대표:

1. **MacBook Air M2 13"**
2. LG gram 16
3. Galaxy Book3 Pro

선정 이유:

- 중고 공급
- 높은 객단가
- 배송 가능
- 시리얼/모델 표준화
- 구매실패 비용 큼
- 매장 짧은 체험으로 개인 적합성 판단 어려움
- 체험료/배송비의 상품가 대비 비중이 낮음

특히 MacBook Air M2:

> **맥북, 사고 싶은데 내가 맥에 적응할지는 모르겠다면?**

---

# 19. 추가 후보 카테고리

## 태블릿 — Tier 1

- iPad Air M2 11"
- iPad Pro M4 11"
- Galaxy Tab S9

핵심:

> **아이패드, 내가 진짜 잘 쓸까?**

장점:

- 중고공급
- 객단가
- 배송
- 상태기록
- 필기/노트북대체/크기/사용습관 체험가치

## 프로젝터 — Tier 2

- LG CineBeam Qube HU710PB
- Samsung The Freestyle 2
- LG CineBeam PF510QA

핵심:

> **우리 집에서 제대로 될까?**

체험가치는 매우 높으나:

- 중고 공급 밀도 낮음
- 렌탈 대체재
- 광학/배송 리스크

## 프리미엄 헤드폰 — Tier 3

- AirPods Max 2
- Sony WH-1000XM6
- Bose QC Ultra

핵심:

- 착용감
- 장시간 피로
- 음질
- ANC

약점:

- 객단가
- 위생
- 배송비 비중

## 카메라/렌즈 — Phase 2

체험가치/객단가는 높으나 상태판정·파손·렌탈경쟁 때문에 후순위.

---

# 20. 보류/제외

- 키보드: 저가구간 배송비 부담
- 골프채: 장척배송/사용흔적
- 미개봉: 개봉 자체 감가
- 위생상품
- 화장품
- 식품
- 소모품
- 속옷
- 지나치게 저가 상품
- 초고위험 사기상품

---

# 21. 구매 불확실성 유형

- 노트북 → **업무/OS 적합성**
- 태블릿 → **사용습관 적합성**
- 프로젝터 → **공간 적합성**
- 헤드폰 → **감각/신체 적합성**

어떤 불확실성에서 써보기가 가장 강하게 작동하는지 데이터로 확인.

---

# 22. 4단계 상태증거

```text
1. 판매자 발송 전
2. 구매자 수령 직후
3. 구매자 반환 직전
4. 판매자 반환 수령 후
```

기록:

- 전후좌우/모서리
- 시리얼
- 구성품
- 알려진 흠집
- 주요 기능
- 카테고리별 건강상태

---

# 23. Device / Physical Item Passport

장기적으로 시리얼 단위 상품이력.

예:

```text
MacBook Air M2
Serial XXXXX
Grade A
Battery Health 91%
Cycle 187
Repair none
Trial Count 3
Damage Incident 0
```

활용:

- 재판매 신뢰
- 가치평가
- 분쟁
- 보험
- 리스크 가격
- 인증

---

# 24. 노트북 상태체크

- 모델번호
- 시리얼
- 외관
- 액정
- 키보드
- 트랙패드
- 충전기
- 배터리 건강
- 배터리 사이클
- SSD
- 포트
- 스피커
- 카메라
- Wi-Fi
- 계정 로그아웃
- Find My
- MDM

---

# 25. 신뢰등급과 배지

두 레이어로 설계.

## 행동 배지

판매자:

- 빠른 발송
- 설명 그대로
- 상태기록 완료
- 클린 거래 10회
- 써보기 인기판매자
- 분쟁 0건

구매자:

- 반환시간 준수
- 클린 반환 10회
- 상태확인 성실
- 거래약속 준수
- 무손상 반환

## 종합 등급

예:

```text
START
TRUST 1
TRUST 2
TRUST 3
TRUST PRO
```

명칭은 미확정.

---

# 26. 판매자 신뢰점수 예시

- 상품 설명 일치도 30%
- 분쟁/클레임 25%
- 발송 준수 15%
- 상태기록 완성도 15%
- 반환 후 처리속도 10%
- 응답성 5%

가중치는 설정 가능.

---

# 27. 구매자 신뢰점수 예시

- 반환기한 준수 30%
- 무손상 반환 30%
- 구성품 완전 반환 15%
- 상태기록 성실도 10%
- 결제/차지백 신뢰 10%
- 분쟁협조 5%

**구매전환율 제외 또는 극소 가중치.**

---

# 28. 등급 혜택

판매자:

- 거래수수료 할인
- 써보기 수수료 할인
- 끌어올리기 무료/할인
- 수요타겟 광고 할인
- 인증배지
- 신뢰기반 노출 가점
- 정산 우선
- Seller Pro 할인

구매자:

- 써보기 서비스비 할인
- 동시 써보기 한도 증가
- 고가상품 한도 증가
- 인기상품 우선
- 브랜드 공식체험 우선
- 이벤트/쿠폰

**신뢰등급은 돈으로 살 수 없다.**

---

# 29. 수요 데이터

행동을 분리해 저장/표시.

### 관심
상세조회/찜.

### 찾고 있어요
명시적 찾기 요청.

### 써보고 싶어요
명시적 체험 의향.

### 비용 확인 후 써보기 의향
실제 비용을 본 뒤 `그래도 써볼래요`.

절대로 단순 조회수를 `N명이 원해요`로 바꾸지 않는다.

---

# 30. 찾는 상품 요청

홈:

> **찾는 물건이 없나요?**  
> 사고 싶거나 직접 써보고 싶은 제품을 알려주세요.  
> 상품이 올라오면 알려드릴게요.

입력:

- 모델
- 바로구매/써보기
- 희망가격
- 희망기간
- 알림 연락처

검색 0건:

> 아직 판매 중인 상품이 없어요.  
> **[이 상품 기다릴래요]**

---

# 31. 모델 수요 페이지

상품이 없어도 모델 페이지 유지.

```text
MacBook Air M3

찾는 사람 46
써보기 희망 29
판매중 0
써보기 가능 0

[나도 기다릴래요]
```

---

# 32. 써보니 랭킹

예:

```text
이번 주 써보니 랭킹

1. MacBook Air M2 — 써보기 희망 83
2. iPad Air M2 — 71
3. AirPods Max — 48
```

기간:

- 오늘
- 이번 주
- 이번 달

카테고리 필터 제공.

**Organic Ranking은 돈으로 구매 불가.**

---

# 33. Demand Score

내부 예시:

```text
찾기 요청                x5
비용 확인 후 써보기 의향 x5
써보기 클릭              x3
찜                       x2
상세조회                  x0.1
```

가중치는 관리설정.

---

# 34. 수요/공급 비율

예:

```text
LG gram
써보기 대기자 60
써보기 가능 매물 3
ratio = 20
```

판매자 메시지:

> **지금 판매하기 좋은 시점이에요.**

장기 `판매기회 점수`.

---

# 35. 판매자 광고 BM

## 끌어올리기

검색/목록 상단 프로모션.

## 수요타겟 광고

예:

```text
MacBook Air M2
찾는 사용자 38
써보기 희망 24

[이 사용자들에게 내 상품 알리기]
```

## 써보기 희망자 타겟

비용확인까지 한 강한 의향자에게 광고.

가격은 미확정.

**광고는 `AD` 또는 `프로모션` 명확 표시.**

---

# 36. 광고 성과

판매자에게:

- 노출
- 상세조회
- 찜
- 써보기 신청
- 채팅
- 구매

제공.

---

# 37. Seller Pro

장기 판매자 구독.

- 모델 수요
- 희망가격
- 판매가격
- 경쟁매물
- 판매속도
- 써보기 수요
- 수요/공급
- 가격추천

구독가격 미확정.

---

# 38. 전체 BM

1. 거래수수료
2. 써보기 옵션/서비스 수익
3. 판매자 광고
4. Seller Pro
5. Brand Trial

---

# 39. Unit Economics

GMV보다 거래당 Contribution Margin.

```text
CM_buy
= purchase-related platform revenue
- PG
- support
- expected fraud/loss
- infra
- promotion

CM_return
= return/trial-related revenue
- refund/PG
- support
- expected damage/loss
- infra
- promotion
```

목표:

```text
CM_buy > 0
CM_return > 0
```

---

# 40. KPI

구매자:

- product_view
- buy_click
- try_click
- trial_duration_select
- trial_cost_view
- still_try_click
- actual_try
- purchase
- normal_return
- dispute

판매자:

- seller_lead
- seller_apply
- actual_item_owner
- listing_created
- try_on
- repeat_listing
- ad_purchase

운영:

- damage_rate
- dispute_rate
- fraud_loss
- chargeback
- return_deadline_compliance
- avg_trial_duration
- resolution_time

재무:

- CM_buy
- CM_return
- CAC buyer
- CAC seller
- WTP
- WTA
- subsidy dependency

---

# 41. 내부 검증 가설

업계 표준이 아닌 내부 가설.

- 비용 공개 후 실제 써보기 의향 20~30%+
- 판매자 Try ON 20~30%+
- 분쟁률 2% 미만 목표
- 반환 발송기한 준수 95%+
- 판매자 재등록 40%+ 장기 검증
- CM_buy +
- CM_return +
- 보조금 제거 후 유지 여부 중요

---

# 42. 구매전환율 역설

구매 90%:

> “체험이 정말 필요했나?”

구매 30%:

> “70% 반환 원가는?”

따라서 구매전환율 자체가 성공조건은 아니다.

A/B:

```text
A = Buy Only
B = Try Enabled
```

비교:

- 구매율
- 판매기간
- 판매가격
- 판매자 순수익
- 플랫폼 CM

써보기 기능이 **증분 가치**를 만들었는지 본다.

---

# 43. 장기 Moat

`써보기 버튼`은 moat가 아니다.

## Product Experience Graph

누가 어떤 제품을 얼마 동안 쓰고 왜 구매/반환했는지.

## Physical Item Passport

시리얼 단위 상태이력.

## Risk Pricing Engine

모델/가격/사용자/체험기간/손상률 기반 옵션가격과 한도.

## Demand Graph

어떤 모델을 누가 찾고 써보고 싶은지.

## Dispute Dataset

`사용 전 → 사용 → 반환 후` 상태변화 데이터.

---

# 44. 미래 `써보고` 카테고리

별도 거래모드.

목적:

> **구매하기 망설여지는 상품을 실제 생활에서 경험**

렌탈과 차이:

- 렌탈: 당장 사용 목적
- 써보고: **구매 판단 목적**

---

# 45. `써보고` 후보

- MacBook
- iPad
- 빔프로젝터
- AirPods Max
- 로봇청소기
- 커피머신
- 음식물처리기
- 스마트워치/링
- 유모차
- 고가 생활가전

공통점:

**실제 생활환경에 넣어보기 전 구매적합성을 알기 어려움**

---

# 46. 공급자 확장

```text
개인 C2C
→ 전문 중고/리퍼
→ 체험재고 사업자
→ 브랜드 공식 체험
```

Brand Trial:

- 체험자 모집
- 제품 사용
- 배송/회수
- 구매전환
- 반환이유
- 실제 사용자 피드백

---

# 47. 장기 IA

```text
홈
중고
써보고
랭킹
MY
```

현재 MVP에서는 장기기능 Feature Flag.

---

# 48. 홈 UI

```text
Logo / Search

사고팔고, 써보고.
중고거래의 새로운 방법

Categories

🔥 이번 주 써보니 랭킹
🟢 지금 써볼 수 있어요
❤️ 사람들이 찾고 있어요
지금 인기 있는 중고상품
방금 올라왔어요
```

초기 인상:

- 일반 중고 약 70%
- 써보기 약 30%

---

# 49. 상품 리스트

필터:

- 전체
- 써보기 가능
- 바로구매
- 최신순
- 가격
- 상태

써보기 카드:

- 🟢 써보기 가능
- 써보기 비용
- 수요정보
- 신뢰등급

광고는 AD 표시.

---

# 50. 일반 상세

예:

```text
상품명
상태
가격
판매자 TRUST
설명
배송

[바로 구매하기]
```

---

# 51. 써보기 상세

예:

```text
MacBook Air M2
A급
820,000원
🟢 써보기 가능

38명이 찾고 있어요
24명이 써보고 싶어 해요

판매자 TRUST 3
상태기록 완료

[써보고 결정하기]
[바로 구매하기]
```

---

# 52. 비용 확인

비용을 숨기지 않는다.

```text
상품대금
옵션/체험비
왕복배송 예상
구매 시 최종금액
반환 시 최종금액
```

CTA:

**그래도 써볼래요**

이 행동은 강한 Demand Signal.

---

# 53. 판매등록

모델을 검색하면 수요 표시.

```text
MacBook Air M2

38명이 찾고 있습니다.
24명이 써보기 상품을 기다립니다.
현재 써보기 매물 3개.

[판매상품 등록하기]
```

선택:

- 바로 판매만
- 써보기 허용

---

# 54. 등록 완료 후 광고

```text
상품이 등록됐어요.

현재 이 모델을 38명이 찾고 있어요.

[기본 노출]
[끌어올리기]
[찾는 사람에게 알리기]
[써보기 희망자에게 알리기]
```

---

# 55. 판매자 프로필

예:

```text
김써보
🥇 TRUST 3

✓ 본인인증
✓ 설명 그대로 98%
✓ 평균 발송 0.8일
✓ 써보기 27회
✓ 무분쟁 26회
```

---

# 56. 구매자 신뢰 표시

판매자에게:

```text
구매자 TRUST 2
써보기 12회
정상 반환 8회
구매 4회
기한 준수 100%
파손 0
```

개인정보 과노출 금지.

---

# 57. 배지 UX

예:

```text
짝짝짝! 배지를 획득했어요.

🛡 클린 반환 10회

[배지 확인하기]
```

등급상승 예:

```text
TRUST 2 달성
써보기 서비스비 할인
동시 써보기 한도 증가
```

혜택 숫자는 설정값.

---

# 58. 시장검증 랜딩 10페이지

과거 정의한 검증용 구조이며 Marketing Site에도 재활용 가능.

1. Home
2. Product List
3. 일반 중고 상세
4. 써보기 상세
5. 체험기간
6. 실제 비용 공개
7. `그래도 써볼래요`
8. Buyer Beta
9. Seller Test
10. Seller Economics

---

# 59. 이벤트 트래킹

```text
home_view
search_submit
search_zero_result

product_list_view
product_view
product_like

buy_click
try_click
trial_duration_select
trial_cost_view
still_try_click
try_application_submit

product_request_open
product_request_submit

seller_apply
seller_listing_start
seller_listing_complete
seller_try_yes
seller_try_no

ranking_view
ranking_item_click
demand_alert_subscribe

ad_purchase_start
ad_purchase_complete
ad_impression
ad_click

badge_earned
trust_level_up

return_request
defect_report
return_shipped
purchase_confirm
trial_expired

dispute_open
dispute_resolved
```

연결:

```text
user_id
listing_id
model_id
category_id
transaction_id
source
campaign
timestamp
```

---

# 60. 핵심 DB 엔티티

## User

```text
id
role
status
identity_verified
phone_verified
buyer_trust_level
seller_trust_level
created_at
```

## SellerProfile

```text
user_id
seller_type
business_verified
avg_ship_time
description_match_score
dispute_rate
trial_count
sale_count
```

## BuyerProfile

```text
user_id
trial_count
purchase_count
normal_return_count
on_time_return_rate
damage_incident_count
chargeback_incident_count
```

## Category

```text
id
name
trial_enabled
trial_policy_id
```

## ProductModel

```text
id
brand
model_name
category_id
canonical_spec
active
```

## Listing

```text
id
seller_id
model_id
title
price
condition_grade
description
direct_sale_enabled
trial_enabled
trial_policy_id
status
created_at
```

## ListingComponent

```text
listing_id
name
required_on_return
replacement_value
```

## TrialPolicy

```text
id
allowed_hours
option_fee_rule
purchase_credit_rule
shipping_rule
max_item_price
buyer_min_trust
seller_min_trust
```

## Transaction

```text
id
listing_id
buyer_id
seller_id
type
status
item_price
option_fee
seller_compensation
platform_fee
outbound_shipping_fee
return_shipping_fee
payment_status
escrow_status
trial_started_at
trial_ends_at
return_requested_at
return_deadline_at
completed_at
```

## ConditionSnapshot

```text
id
transaction_id
stage
media
serial
structured_checks
created_by
created_at
```

stage:

```text
SELLER_PRE_SHIP
BUYER_RECEIVED
BUYER_PRE_RETURN
SELLER_POST_RETURN
```

## Dispute

```text
id
transaction_id
reason
status
claimed_amount
held_amount
resolution
opened_at
resolved_at
```

## DemandIntent

```text
id
user_id
model_id
intent_type
desired_price_min
desired_price_max
desired_trial_hours
active
```

intent:

```text
LOOKING_TO_BUY
WANT_TO_TRY
PAID_TRY_INTENT
```

## RankingSnapshot

```text
model_id
period
demand_score
looking_count
want_to_try_count
paid_try_intent_count
active_listing_count
trial_listing_count
```

## Promotion

```text
id
listing_id
seller_id
type
start_at
end_at
price
status
```

promotion type:

```text
BOOST
DEMAND_TARGET
TRY_INTENT_TARGET
```

## Badge / UserBadge

```text
Badge
- id
- code
- name
- description
- type

UserBadge
- user_id
- badge_id
- earned_at
```

---

# 61. Payment / Settlement

결제와 거래상태를 분리.

```text
Payment
Refund
Settlement
SettlementHold
Chargeback
```

PG provider 교체 가능한 adapter.

---

# 62. 알림

구매자:

- 결제
- 발송
- 배송
- 체험 시작
- 종료 24h 전
- 종료 임박
- 반환 신청
- 반환 발송기한
- 구매확정
- 환급
- 분쟁
- 찾던 모델 등록
- 배지/등급

판매자:

- 주문
- 써보기
- 결제 hold
- 발송기한
- 구매확정
- 반환
- 반환도착
- 검수
- 정산
- 분쟁
- 모델수요
- 광고성과
- 배지/등급

---

# 63. Admin / CS

관리자:

- 회원
- 본인인증
- 판매자유형
- 상품
- 거래
- 결제/환불
- 정산보류
- 상태기록
- 분쟁
- 수요
- 랭킹 가중치
- 체험정책
- 가격
- 등급/배지
- 광고
- 프로모션
- Feature Flag
- 위험회원
- Audit Log

---

# 64. 분쟁관리 UI

한 화면에서:

```text
판매자 발송 전
구매자 수령 후
구매자 반환 전
판매자 반환 후
```

비교.

함께 표시:

- 채팅
- 배송
- 결제
- 시리얼
- 수리견적
- 주장
- 판정
- 보류금액
- 환급/정산

---

# 65. 법률 / 규제

정식 출시 전 법률검토.

고려:

- 전자상거래법
- 약관규제법
- 개인정보보호법
- 전자금융/PG
- 공정위 전자상거래 표준약관
- 개인 간 거래 분쟁해결기준
- 소비자분쟁해결기준
- C2C 개인판매자 신원확인
- 사업자판매자 청약철회
- 제품안전/리콜
- 사업자판매자 표시

---

# 66. 서비스 문서 분리 권장

1. 서비스 이용약관
2. 써보기 거래 특별약관
3. 판매자 운영정책
4. 상품상태·파손 분쟁해결기준
5. 개인정보처리방침
6. 결제/환불/정산 정책

---

# 67. 법률 검토 집중 항목

- 종료 후 미응답 구매확정
- 반환신청 후 미발송
- 파손 손해액
- 안전결제/에스크로
- PG
- 환불
- 사업자판매자 청약철회
- 옵션비 법적 성격
- 본인확인
- 분쟁 정산보류

---

# 68. 피해야 할 약관

- 회사 판단이 최종이고 이의 불가
- 어떠한 경우에도 환불 불가
- 모든 파손 구매자 책임
- 회사는 어떤 경우에도 책임 없음
- 과도한 위약금
- 과도한 입증책임
- 부당한 관할 강제

---

# 69. 판매자 필수 고지

- 브랜드/모델
- 제조/구매시기
- 상태
- 하자
- 수리/교환/개조
- 구성품
- 시리얼
- 가격
- 배송
- 써보기 조건
- 리콜/안전
- 구매결정 중요정보

---

# 70. 초기 Growth 원칙

판매자 공급부터 확보.

핵심은 회원수가 아니라:

> **거래 가능한 매물 밀도와 매칭 가능성**

전국 단위 + 카테고리 집중.

---

# 71. Founding Seller 100

혜택 후보:

- 일정기간 일반거래 수수료 0
- 써보기 수수료 할인
- 우선노출
- Founding 배지
- 첫 정상 써보기 보너스
- 광고 크레딧

가설이므로 설정형.

---

# 72. 판매자 모집

나쁜 문구:

> 새 중고앱입니다. 상품 올려주세요.

좋은 문구:

> **새로운 중고거래 방식 베타테스트에 참여할 실제 판매자를 모집합니다.**

수요가 생긴 후:

> 현재 MacBook Air M2를 38명이 찾고 있고 24명은 써보고 싶어 합니다.

실제 데이터로 영업.

---

# 73. 판매자 후보

- 개인 중고판매자
- 헤비셀러
- 중고노트북 업체
- 리퍼업체
- 디지털 중고매장
- 마이크로 크리에이터/리뷰어
- 초기 지인

장기적으로 전문/리퍼 공급자가 Trial Inventory 안정화 역할.

---

# 74. 구매자 모객

브랜드 자체보다 특정 제품의 고민을 광고.

예:

> 맥북 80만원, 내가 맥에 적응할지는 모르겠다면?

> 아이패드, 정말 잘 쓸까요?

> 우리 집에서도 빔프로젝터가 제대로 될까?

구매결정 단계의 수요를 잡는다.

---

# 75. 핵심 Growth Loop

```text
구매자 모델 검색
→ 매물 없음
→ 찾는 상품 요청
→ Demand DB
→ 해당 모델 판매자 모집
→ 매물 등록
→ 기존 요청자 알림
→ 바로구매/써보기
→ 거래
→ 신뢰/상태 데이터
→ 판매자 재등록/추천
```

---

# 76. 7일 검증 일정

- Day 1: 랜딩/측정/폼/영업리스트
- Day 2: 판매자 아웃리치
- Day 3: 구매자 소액 유입
- Day 4: 수요기반 판매자 모집
- Day 5: 실제 수요/공급 매칭
- Day 6: 인터뷰
- Day 7: GO/MODIFY/STOP

---

# 77. 30일 검증

1~7일:
- 랜딩
- Founding Seller
- 수요
- 광고

8~14일:
- 커뮤니티
- 전문판매자
- 크리에이터
- 판매자 인터뷰

15~21일:
- 구매자 광고
- 수요 상위 모델 공급 확보

22~28일:
- 수동 매칭
- 인터뷰
- 비용/배송 테스트
- 추천

29~30일:
- KPI
- GO/MODIFY/STOP

---

# 78. 실개발 전환

과거 단계:

> 시장검증 랜딩

현재 사용자 결정:

> **2026-08-27부터 전체 기획과 정책을 바탕으로 Codex에서 실개발 진행**

단:

- 검증 안 된 정책은 Feature Flag
- 실제 PG 전 adapter/mock
- 거래상태/데이터 모델 우선
- 장기기능 일괄 구현 금지
- 제품 안에서 계속 시장검증

---

# 79. 권장 개발 Phase

## Phase A — Core Marketplace

- 회원
- 본인인증 인터페이스
- 판매자 유형
- 카테고리
- 모델
- 상품등록
- 리스트
- 검색
- 상세
- 찜
- 일반 구매 skeleton
- 분석이벤트

## Phase B — Demand

- 찾는 상품
- 모델페이지
- 수요수치
- 써보기희망
- 랭킹
- 알림

## Phase C — Try Transaction

- Eligibility
- 기간
- 비용
- Payment adapter
- Transaction FSM
- Condition Snapshot
- 반환
- 구매확정
- 분쟁
- 정산보류

## Phase D — Trust

- 배지
- 신뢰등급
- 혜택
- 거래한도

## Phase E — Seller Monetization

- 끌어올리기
- 수요타겟
- 광고성과
- 판매기회 점수

## Phase F — Seller Pro

## Phase G — 써보고 / Brand Trial

---

# 80. Feature Flags

```text
enable_direct_sale
enable_try_before_buy
enable_experience_only
enable_brand_trial

enable_demand_request
enable_demand_counts
enable_ranking

enable_badges
enable_trust_level

enable_boost_ads
enable_demand_target_ads
enable_seller_pro

auto_confirm_purchase_on_expiry

enable_category_notebook
enable_category_tablet
enable_category_projector
enable_category_headphone
enable_category_camera
```

---

# 81. 설정으로 관리할 항목

- 수수료
- 옵션/체험료
- 판매자 보상
- 배송비
- 기간
- 반환기한
- Grace Period
- 최대 상품가격
- 사용자 한도
- 등급 조건
- 등급혜택
- 광고가격
- 랭킹가중치
- Eligibility 기준

---

# 82. Codex가 임의로 바꾸면 안 되는 제품 원칙

1. 렌탈 앱이 아니다.
2. 일반 중고가 기본.
3. 판매자가 써보기를 선택.
4. 정상 반환자는 나쁜 고객이 아님.
5. 구매전환율을 신뢰도 핵심으로 쓰지 않음.
6. 랭킹을 돈으로 살 수 없음.
7. 신뢰등급을 돈으로 살 수 없음.
8. 광고는 명확히 표시.
9. 실제 수요만 표시.
10. 미고지 하자와 구매자 손상 분리.
11. 분쟁 중 관련 금액 hold.
12. 상태 전후 기록.
13. 카테고리별 정책 분리.
14. 가격/수수료/등급은 config.
15. 장기기능 한꺼번에 활성화 금지.

---

# 83. 권장 Domain 구조

기존 Repository가 있으면 그 구조를 우선.

Domain 예:

```text
auth
users
seller
buyer
catalog
models
listings
demand
ranking
transactions
trial
payments
settlements
shipping
condition
disputes
trust
badges
promotions
notifications
analytics
admin
legal
feature_flags
```

Trial 로직을 Listing 코드에 무분별하게 섞지 않는다.

---

# 84. Audit Log

필수 감사로그:

- 가격 변경
- 상태 변경
- 시리얼 변경
- 상태미디어
- 거래상태
- 결제
- 환불
- 정산보류
- 분쟁판정
- 등급 수동조정
- 관리자 액션

---

# 85. Security

- 본인인증 데이터 최소수집
- 관리자 권한분리
- 민감정보 암호화
- 결제정보 직접 저장 최소화
- Signed media
- 상태증거 원본 보존
- 시리얼 공개범위 제한
- 계정탈취 탐지
- 결제 위험로그

---

# 86. 개인정보

공개 가능:

- 거래횟수
- 신뢰등급
- 기한준수율
- 배지

과노출 금지:

- 정확한 주소
- 불필요한 실명
- 전화번호
- 신원확인 원본
- 결제정보

---

# 87. Condition Media

분쟁증거이므로:

- 촬영시각
- 업로더
- 단계
- 원본해시
- 파일메타
- transaction_id

저장.

---

# 88. AI — 후순위

장기:

- 전후 스크래치 비교
- 구성품 누락
- 상태등급 추천
- 시리얼 인식
- 유사분쟁
- Risk Score
- 가격추천

AI만으로 자동 배상판정하지 않는다.

---

# 89. 핵심 화면

1. 홈
2. 검색
3. 상품리스트
4. 모델페이지
5. 일반 상세
6. 써보기 상세
7. 기간선택
8. 비용확인
9. 결제
10. 체험 진행
11. 구매확정
12. 반환신청
13. 하자신고
14. 상태촬영
15. 판매등록
16. 판매자 수요정보
17. MY 거래
18. 신뢰프로필
19. 랭킹
20. 찾는상품
21. 알림
22. 관리자 분쟁

---

# 90. 홈의 써보니 고유 요소

최소:

- 지금 써볼 수 있어요
- 이번 주 써보니 랭킹
- 사람들이 찾고 있어요
- N명이 써보고 싶어 해요
- 찾는 상품 요청

중 복수 적용.

---

# 91. 데이터 진실성

금지:

- 실제 12명인데 100명 표시
- 조회수 100을 `100명이 원해요`로 표시
- 광고를 자연랭킹에 삽입
- 돈으로 신뢰배지 구매
- 운영자가 임의로 Trust 상향

---

# 92. 북극성 후보

**Successful Decision Transactions**

써보기를 통해:

- 구매 완료
- 정상 반환 완료

로 구매결정을 마친 거래.

그러나 재무 KPI로 CM을 반드시 병행.

---

# 93. 판매자 가치

- 가격을 덜 깎고 판매할 가능성
- 새로운 구매수요
- 정상반환 시 체험보상
- 실제 대기수요
- 광고 타겟
- 판매기회 점수
- 신뢰등급
- Seller Pro

주타깃:

> **조금 기다려도 제값에 팔고 싶은 판매자**

---

# 94. 구매자 가치

- 실제 환경에서 확인
- 구매실패 리스크 감소
- 구매 후 재판매 번거로움 감소
- 중고가격 + 사용경험
- 개인 적합성 확인
- 상태/신뢰 데이터

---

# 95. 투자자 설명

> 써보니는 반품이 많은 중고앱이 아니라, 구매자가 **구매결정 옵션을 유료로 확보**하고 판매자가 그 옵션을 제공한 대가를 받는 시장을 지향한다.

성공조건:

> **구매와 정상반환 모두에서 거래당 공헌이익이 플러스가 되는 구조**

---

# 96. 실개발과 함께 검증할 것

1. MacBook Air M2 판매자 WTA
2. 구매자 WTP
3. 써보기 신청률
4. 비용 공개 후 유지율
5. 판매자 Try ON
6. 판매자 재등록
7. 정상반환
8. 분쟁률
9. 건당 CS 시간
10. CM_buy / CM_return

---

# 97. 확정 / 실험 / 장기

## 확정에 가까운 원칙

- 일반 중고 + 써보기
- 판매자 선택제
- 노트북 1차
- 실제 수요데이터
- 찾는 상품
- 상태기록
- 구매/반환 분리
- 하자/단순반환 분리
- 신뢰배지/등급
- 광고/자연랭킹 분리
- 정상 반복반환자를 악성으로 보지 않음

## 실험 필요

- 48h vs 72h
- 옵션비
- 구매 시 비용 상계
- 판매자 보상
- 수수료
- 상품 최대가격
- 등급혜택
- 광고가격
- 자동구매확정 세부정책
- 전문판매자 공급비율

## 장기

- 써보고
- Brand Trial
- Seller Pro
- Risk Pricing
- Product Experience Graph
- Device Passport 고도화
- AI 상태비교
- 보험/보증
- 브랜드 데이터

---

# 98. 구현 우선순위

### P0
- User
- Seller/Buyer Profile
- ProductModel
- Listing
- Search
- Detail
- DemandIntent
- 찾는상품
- Analytics

### P1
- TrialPolicy
- Try Flow
- Transaction FSM
- ConditionSnapshot
- Return
- Dispute skeleton

### P2
- Payment adapter
- Settlement
- Notification
- Trust

### P3
- Ranking
- Badge
- Promotion

### P4
- Seller Pro
- Experience / Brand Trial

---

# 99. Codex 지시문

```text
당신은 써보니 프로젝트의 시니어 풀스택 엔지니어다.

1. 먼저 기존 repository의 framework, dependency, DB schema, auth, coding convention을 분석한다.
2. 기존 스택을 임의로 교체하지 않는다.
3. 본 문서의 Domain Model과 Product Principles를 기준으로 개발한다.
4. 가격/수수료/체험기간/등급은 hard-code하지 않고 config 또는 policy table로 만든다.
5. TRY_BEFORE_BUY는 명시적인 transaction state machine으로 구현한다.
6. 결제상태와 거래상태를 분리한다.
7. ConditionSnapshot 및 Audit Log에 변경이력을 남긴다.
8. 자연랭킹과 Promotion을 데이터/렌더링 모두에서 분리한다.
9. 실제 수요 데이터만 사용자에게 표시한다.
10. 장기기능은 Feature Flag 뒤에 둔다.
11. 핵심 도메인 로직 테스트를 작성한다.
12. migration, seed, API contract, validation, error state를 함께 작성한다.
13. 불명확한 정책은 임의 결정하지 않고 OPEN_DECISION 또는 TODO로 남긴다.
14. 각 구현 단계마다 '어떤 제품정책을 코드로 구현했는지' 요약한다.
```

---

# 100. 필수 테스트 시나리오

## 일반 거래
등록 → 구매 → 발송 → 수령 → 구매확정 → 정산

## 써보기 구매
신청 → Payment Hold → 발송 → 수령 → 체험 → 구매 → 정산

## 써보기 반환
반환신청 → 발송 → 판매자 확인 → 비용계산 → 환급 → 판매자보상

## 하자
신고 → Dispute → Hold → 증빙 → 판정 → 환급/정산

## 만료
종료알림 → 미응답 → Grace → 정책적 확정

## Trust
정상거래 → Badge → Level Up → 혜택

## Demand
찾기 요청 → Count → 판매자 등록 → 요청자 알림

## Promotion
광고구매 → AD 표시 → Organic Ranking 불변 → 성과

---

# 101. MVP 완료 정의

MVP는 기능 수가 아니라 거래 완주 가능 여부로 판단.

1. 판매자가 상품등록
2. 구매자가 검색
3. 써보기 여부 확인
4. 비용 확인
5. 써보기 신청
6. Payment Adapter Hold
7. 발송
8. 상태기록
9. 기간관리
10. 구매 또는 반환
11. 정상 종료
12. Dispute Open
13. Admin 확인
14. Demand/Event 수집

광고/배지/Brand Trial은 그 이후 확장 가능.

---

# 102. 최종 비전

1단계:

> **중고를 사고팔되, 고민되는 상품은 먼저 써보고 결정한다.**

2단계:

> **구매 실패 가능성이 높은 상품을 실제 생활에서 경험한다.**

3단계:

> **실제 제품 경험과 구매결정 데이터를 가진 Product Experience Network가 된다.**

장기 경쟁력은 써보기 버튼이 아니라:

> **누가 어떤 제품을 찾고, 얼마를 내고 써봤고, 얼마 동안 사용했고, 왜 샀고, 왜 반환했고, 상품 상태가 어떻게 변했는지**

라는 데이터다.

---

# 103. Product North Star

> **써보니는 중고거래 앱으로 시작하지만, 최종적으로는 사람들이 제품을 사기 전에 실제 경험을 통해 더 나은 결정을 하게 만드는 플랫폼을 지향한다.**

---

# Appendix A. OPEN DECISIONS

Codex가 임의로 확정하지 말 것.

- 구매 시 Option Fee 전액/일부/0원?
- 초기 체험기간 48h vs 72h?
- 판매자 최소 체험보상?
- 첫 상품 최대가격?
- 개인 vs 전문판매자 Trial 공급비율?
- 정산시점?
- 반환 검수시간?
- 분쟁 제3자 검수 기준?
- 카테고리별 정상 사용흔적?
- 등급별 수수료 할인?
- 광고가격?
- 랭킹가중치?
- 노트북 다음 카테고리?

---

# Appendix B. 카테고리 우선순위

```text
Tier 1
- Notebook
- Tablet

Tier 2
- Projector

Tier 3
- Premium Headphones

Phase 2
- Camera / Lens

Hold
- Keyboard
- Golf
- Low-price goods
- Hygiene-sensitive goods
```

---

# Appendix C. 대표 모델

```text
Notebook
- MacBook Air M2 13"
- LG gram 16
- Galaxy Book3 Pro

Tablet
- iPad Air M2 11"
- iPad Pro M4 11"
- Galaxy Tab S9

Projector
- LG CineBeam Qube HU710PB
- Samsung The Freestyle 2
- LG CineBeam PF510QA

Premium Headphones
- AirPods Max 2
- Sony WH-1000XM6
- Bose QC Ultra
```

---

# Appendix D. 서비스 언어

권장:

- 써보기
- 써보고 결정하기
- 바로 구매
- 돌려보낼래요
- 상품에 문제가 있어요
- 찾는 상품
- 써보고 싶은 사람
- 신뢰도
- 클린 반환

핵심 UX에서 전면 사용을 지양:

- 빌리기
- 렌탈
- 대여

장기 `써보고`에서도 구매결정 목적을 명확히 한다.

---

# Appendix E. 설계 철학

> **체험을 허용해서 거래를 어렵게 만드는 플랫폼이 아니라, 구매 불확실성을 가격화하고 그 비용을 구매자·판매자·플랫폼이 합리적으로 나눌 수 있는 거래 인프라를 만든다.**

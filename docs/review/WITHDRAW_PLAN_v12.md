프로젝트: 써보니 · 작성자: Claude Code
번호: PLAN-써보니-20261028-1316 · 작성 일시: 2026-10-28 13:20:26 KST
기준 지시: 2026-10-28 13:1x 사용자 "권장안"(Codex 3차 결과 선택 ①: 남은 4건만 따로 설계 확정) · 버전: v12(탈퇴 2단계 확정 후보판, 3차 차단 4건 안전 설계 추가) (이전 v11(2차 지적 반영판)) · 이전 버전과 같은지: 일부 다름
일의 크기: 대 — 운영 DB 구조 변경(트리거·표 추가), 탈퇴 때 거래 기록 이동·파기, 운영 서버 백업 삭제
왕복: 3/3 끝 · 계획 검수는 더 하지 않음(63절(검수 왕복 3번)). 3차 차단 4건을 아래 00000절로 설계하고 사용자 확정 뒤 개발, 완성 코드는 Codex가 검수

# 탈퇴 2단계 계획 v12

## 00000. Codex 3차 차단 4건 안전 설계 — 이 절이 아래 모든 절보다 우선
### S1. 파기한 키가 옛 백업에 남는 문제 → "백업부터 비우고 나서 실제 파기"
- 원칙: 실제(라이브) 키를 지우기 전에, 그 키가 든 백업이 하나도 없게 만든다. 순서를 거꾸로 하지 않는다.
- 파기 상태는 retained.db의 `purge_runs` 표(key_id, stage, candidate_set_id, updated_at)에 둔다. 단계마다 다시 실행해도 같은 결과다.
- 모든 보관 백업 세트 만들기(배포 때 포함)는 purge_runs에 있는 key_id 전부를 뺀다. 그래서 파기가 여러 번 실행에 걸쳐 진행되는 동안 만료 키가 새 세트에 다시 들어가지 않는다(만료 key_id가 여럿이어도 같다).
- 보관 이동 때 만료일이 이미 지난 기록은 보관하지 않고 바로 비운다. 파기 중인 키를 다시 쓰지 않게 하려는 것이다.

| stage | 하는 일 | 실패하면 |
|---|---|---|
| PLANNED | 만료일이 지난 key_id를 찾는다 | — |
| CANDIDATE_OK | 그 key_id의 줄·사진·키 파일을 뺀 새 보관 백업 세트를 `tmp-<시각>`에 만들고 검증한다(목록 sha256, 남는 줄이 가리키는 사진·키가 모두 있음, 뺀 key_id 파일이 없음). 검증 항목에 retained.db `PRAGMA integrity_check`와 표본 복호화를 넣는다. 검증이 끝나면 rename으로 확정하고, 그 세트 이름을 candidate_set_id에 적는다 | 실제 파기를 하지 않는다. 옛 세트도 그대로 두고 다음 실행에서 다시 한다. 24시간 넘게 이 단계에 머물면 로그와 관리자 알림을 남긴다 |
| OLD_SETS_GONE | candidate_set_id가 아닌 세트와 tmp 폴더를 모두 지운다(서버가 꺼진 뒤에도 어느 것이 새 세트인지 이 칸으로 안다). 그다음 남은 모든 세트의 목록을 다시 읽어, 뺀 key_id 파일이 0개인지 확인한다 | 지우지 못한 세트가 남으면 이 단계에 머물고 재시도한다. 실제 파기는 하지 않는다 |
| LIVE_PURGED | 바로 직전에 모든 세트(tmp 포함)를 다시 검사해 그 key_id 파일이 0개일 때만 진행한다. 그다음 실제 줄·사진을 지우고, 키 파일을 0으로 덮어쓴 뒤 fsync하고 지운다 | 검사에서 1개라도 나오면 OLD_SETS_GONE로 되돌린다. 지우기 실패는 다음 실행에서 이어서 한다 |
| DONE | purge_runs 줄을 지운다 | — |

- 그래서 "실제 키는 지웠는데 옛 백업에 키가 남는" 순간이 생기지 않는다. 대신 백업을 비우지 못하면 실제 파기가 늦어진다. 이것은 로그와 알림으로 드러낸다(법정 기한을 넘기기 전에 사람이 볼 수 있게).
- 운영 서버의 배포 백업(/opt/sseoboni/backups, ops/deploy.sh:20)은 운영 DB(dev.db)만 담는다. 보관 키·보관 사진은 담지 않는다. 보관 백업 세트는 `runtime-data/retained-backups/`에만 있다.
- K6 확인 범위: 실제 폴더, 확정 세트, tmp 폴더 모두에서 만료 key_id 파일 0개, 시험 표식 0건.
- 시험 T35: CANDIDATE_OK·OLD_SETS_GONE·LIVE_PURGED 각 단계 뒤에서 멈춘 다음 다시 실행하면 DONE까지 간다. 옛 세트 삭제 실패를 흉내 내면 LIVE_PURGED로 넘어가지 않는다. OLD_SETS_GONE 뒤에 배포 백업을 만들어도 새 세트에 만료 키가 없다. 만료 key_id 둘을 함께 파기해도 서로의 세트에 상대 키가 없다.

### S2. 잠금 이어받기 경쟁 → 잠금 파일 대신 SQLite 잠금 줄
- 잠금 파일(0000절 1·1-2)은 쓰지 않는다. retained.db에 `locks` 표(name 기본 키, owner, fence 정수, until)를 둔다.
- 첫 줄: 0019 이동과 잠그기 직전에 `INSERT OR IGNORE INTO locks(name, fence) VALUES('retained', 0)`을 실행한다(줄이 없어 영원히 못 잡는 일 방지).
- 잠그기: 한 문장으로 한다. `UPDATE locks SET owner=?, fence=fence+1, until=지금+10분 WHERE name='retained' AND (owner IS NULL OR until<지금)`. 바뀐 줄이 1일 때만 잠금을 얻고, 새 fence 값을 기억한다. SQLite는 쓰기를 한 번에 하나만 처리하므로, 두 프로세스가 동시에 이어받아도 한쪽만 1줄을 얻는다.
- 쓰기마다 확인: 보관 DB에 쓰는 모든 트랜잭션은 `BEGIN IMMEDIATE`(better-sqlite3 `.immediate()`)로 열고, 첫 문장에서 `SELECT fence FROM locks WHERE name='retained'`가 내 fence와 같은지 본다. 다르면 거기서 멈춘다. 파일 작업(이동·삭제·rename)도 시작 직전에 같은 확인을 하고, 잠금 남은 기한이 2분 이상일 때만 시작한다.
- 작업이 길면 5분마다 until을 늘린다(내 fence일 때만).
- 운영 DB의 lease_owner(0000절 3)는 그대로 두고, 그 위에 이 잠금을 더 씌운다.
- 시험 T36: 두 프로세스가 기한 지난 잠금을 동시에 이어받으면 정확히 하나만 얻는다. 옛 fence를 가진 쪽의 쓰기는 0건이다.

### S3. 키 파일 내구성 → 디스크에 확실히 쓴 뒤에만 사용
- 순서
  1. `retained-keys/tmp-<무작위>`에 32바이트를 쓴다.
  2. 파일을 fsync한다.
  3. `key_registry`에 key_id와 해시를 `INSERT OR IGNORE`로 넣는다. 그다음 `fs.linkSync(tmp, <YYYYMMDD>.key)`로 연결하고 tmp를 지운다. link는 대상이 이미 있으면 실패하므로(rename과 달리 덮어쓰지 않음) 다른 키로 바뀌는 일이 없다. 실패하면 내 tmp를 지우고 있는 파일을 쓴다.
  4. 폴더를 fsync한다(Linux 운영. Windows 개발 PC는 폴더 fsync가 없어 건너뛰고 로그에 적는다).
  5. 다시 읽어 32바이트인지 확인한다.
- 이 다섯 단계가 끝난 키만 암호화에 쓴다. 그래서 키가 디스크에 없는데 그 키로 만든 암호문만 남는 경우가 없다.
- `key_registry` 표(key_id, sha256, created_at)는 위 3에서 먼저 적는다. 다시 읽은 키가 이 해시와 다르면 사용을 멈추고 알린다. 동시 생성에서 진 쪽은 등록된 해시와 자기 tmp가 달라 자기 tmp를 버린다.
- 시험 T37: 1~5 각 단계 뒤에서 멈춘 다음 다시 실행한다. 결과는 둘 중 하나여야 한다. ① 키가 없고 그 키로 만든 암호문도 없음 ② 키가 온전하고 복호화가 됨.

### S4. 보관 경로의 고아 파일 → 보관 사진도 staging과 상태 칸
- 보관 사진 쓰기 순서
  1. `retained/staging/`에 암호화한 파일을 쓰고 fsync한다.
  2. retained.db에 줄을 `state='PENDING_FILE'`로 넣는다.
  3. `retained/`로 rename한다.
  4. state를 'OK'로 바꾼다.
- 정기 정리(잠금 안에서, 매 실행)
  - PENDING_FILE 줄
    - 파일이 이미 `retained/`에 있으면 state='OK'로 마무리한다(rename 직후 종료한 경우, 첫 번째로 본다).
    - 파일이 staging에 있으면 rename해 마무리한다.
    - 원본 파일이 아직 있으면(운영 DB 쪽 ④ 전) 다시 만든다.
    - 둘 다 아니면 줄을 지우고 2절 상태기계가 다시 옮기게 둔다.
  - `retained/`·`retained/staging/`의 파일 중 retained.db 줄이 없는 것은 24시간이 지나면 지운다.
- 2절 ④(운영 DB에서 원래 칸·사진 줄 지우기)는 그 사용자의 보관 파일 줄이 모두 state='OK'일 때만 실행한다. 그래서 보관 사진이 확정되기 전에 원본이 사라지지 않는다.
  - `retained-backups/tmp-*` 중 지금 잠금을 가진 작업의 것이 아닌 폴더는 지운다.
- 시험 T38: 아래 네 경우 각각 서버를 끄고 다시 켠다. 정리 뒤 고아 0개이고 보관값 복호화가 되어야 한다.
  - staging 쓰기 직후
  - 줄을 넣은 직후
  - rename 직후
  - 임시 백업 만드는 도중

### 독립 검토(이 절만, 2026-10-28 13:2x) 반영
- 막는 문제 2건과 참고 5건을 위에 반영했다.
  - 막는 문제: S1 파기 진행 중 다른 세트에 만료 키가 다시 들어감, S4 rename 직후 종료 때 보관 사진 손실
  - 참고: locks 첫 줄, BEGIN IMMEDIATE와 남은 기한 2분, link로 덮어쓰기 방지, 새 세트 무결성·표본 복호화, 이미 만료된 기록은 보관 안 함

### 0000절과 바뀐 점
- 0000절 1의 "잠금 파일"과 1-2의 "잠금 파일 이어받기"는 S2로 대체한다.
- 0000절 1의 "새 세트를 만든 뒤 옛 세트를 지운다"는 S1의 순서(백업 정리 → 실제 파기)로 대체한다.
- 0000절 4의 키 `wx` 생성은 S3로 대체한다.

## 0000. Codex 2차 검수(CODEX_REVIEW_RESULT_WITHDRAW2_PLAN_v2.raw.txt) 차단 오류 8건 처리 — 아래 본문보다 이 표가 우선
| 번호 | 지적 | 처리 |
|---|---|---|
| 1 | 보관 백업 교체가 한 번에 되지 않고 재시도 상태 없음 | ① 보관 이동·파기·백업은 공통 잠금(`runtime-data/retained.lock`, 배타 생성 파일 + 프로세스 안 잠금)을 잡고 한 번에 하나만 돈다 ② 새 세트는 임시 폴더 `runtime-data/retained-backups/tmp-<시각>`에 만들고, 목록 파일 sha256과 "DB 줄이 가리키는 사진·키 파일이 모두 있음"을 검증한 뒤 `rename`으로 확정한다 ③ 확정된 뒤에만 옛 세트를 지운다. 하나라도 남으면 `PURGE_BACKUP_PENDING` 표시 파일을 남기고 다음 실행이 다시 지운다 ④ 새 세트 생성·검증이 실패하면 옛 세트를 그대로 둔다(그 뒤 표시 파일로 재시도) ⑤ T30에 보관 이동 중 백업, 생성 실패, 옛 세트 삭제 실패를 더한다 |
| 2 | 안전하지 않은 옛 되돌리기 지시가 남아 있음 | 1절의 `0019_down.sql` 문장을 지웠다. 긴급 되돌리기는 `0019_down_triggers.sql`만 쓰고 보관·파기 코드는 남긴다. 코드 전체를 1단계로 되돌리는 것은 금지한다(파기가 멈춤). 전체 되돌리기는 `ops/withdraw2_rollback.cjs`(검사+실행 묶음)만 쓰고, 운영 DB withdrawals·보관 DB 줄·키 파일·사진·PURGE_BACKUP_PENDING이 모두 0일 때만 실행한다 |
| 3 | lease_owner를 잡지 않음 | 0019의 withdrawals 칸: `user_id`(기본 키), `stage`, `withdrawn_at`, `lease_owner`, `lease_until`, `updated_at`. 잡을 때 `SET stage='RETAINING', lease_owner=<무작위 값>, lease_until=<지금+5분>`을 한 UPDATE로 한다. 뒤 단계의 모든 UPDATE에 `lease_owner=<내 값>` 조건을 붙이고, RETAINED·WIPE_PENDING으로 갈 때 둘을 null로 비운다. T17d: 서로 다른 owner 두 실행, 5분 지난 lease 이어받기, 늦게 끝난 옛 owner의 UPDATE가 0줄인지 |
| 4 | 달별 키가 같은 달의 늦은 만료 기록까지 먼저 지움 | 키는 "만료일(날짜)별"이다. key_id = 만료일 `YYYYMMDD`. 그 날짜가 지나면 그 날짜 줄은 모두 만료이므로 함께 지운다. 키 파일은 그 key_id를 가리키는 줄과 사진이 0개가 된 뒤에만 지운다. 키 파일은 `wx`(이미 있으면 실패) 플래그로 만들고, 실패하면 있는 파일을 다시 읽어 쓴다(동시 생성 경쟁). T23b: 같은 달 1일·31일 만료 두 기록 → 1일 파기 뒤 31일 기록 복호화 성공. T23c: 두 실행이 같은 key_id를 동시에 만들 때 같은 키를 씀 |
| 5 | 주문 스냅숏 전체를 지워 상대 거래 기록이 망가짐 | 스냅숏 JSON 구조와 비개인 항목(가격·체험 조건·구성품·모델·카테고리 등, orders.ts:36 Snapshot 타입)은 그대로 둔다. 판매자 원문 칸만 바꾼다: title → "탈퇴한 판매자의 상품", description → "", photo → null, conditionNote → null, checks 안 자유 입력 메모 → "". 원래 스냅숏 전체는 보관 DB로 옮긴다. T22b: 바꾼 칸 밖의 스냅숏 항목이 전후 같고 거래 목록·상세 화면이 열림 |
| 6 | 서버 종료로 생긴 업로드 고아 파일 | 두 업로드 API는 먼저 `runtime-data/staging/`에 저장한다. 그 뒤 DB INSERT에 성공하면 원래 폴더로 `rename`하고, 실패하면 지운다. 정기 작업은 24시간 지난 staging 파일과, 두 업로드 폴더(uploads·order-uploads)에서 DB에 없는 24시간 지난 파일을 지운다. T31b: 파일 저장 직후 서버를 끄고 다시 켠 뒤 정기 작업 실행 → 고아 0개 |
| 7 | 백업 30일과 "최신 3개 유지"가 충돌 | 최신 3개 예외를 없앤다. 30일이 절대 상한이다. 백업이 0개가 되지 않게 하려고, 정리 직전에 새 백업을 만들어 열어 보는 검증(`PRAGMA integrity_check`)을 하고, 그 뒤 30일 넘은 것을 모두 지운다. T25: 31일 5개·29일 1개 → 정리 뒤 29일 1개 + 새 1개만 남음 |
| 8 | "탈퇴 즉시 404"와 1일 캐시 충돌 | 상품 사진 응답 헤더를 `private, no-cache, must-revalidate`와 ETag(파일 이름)로 바꾼다. 브라우저는 매번 서버에 확인하고, 바뀌지 않았으면 304로 빠르게 받는다. 탈퇴 뒤에는 404를 받는다. T21b: 같은 브라우저에서 사진을 본 뒤 탈퇴 → 새로 고침하면 사진이 안 보임(PC·모바일 스크린샷) |
| 1-2(이 판 독립 검토) | 잠금 파일이 서버 종료·배포(docker stop, ops/deploy.sh:20)로 남으면 영구 정지 | 잠금 파일에 pid·잡은 시각·무작위 값을 적는다. 10분이 지났거나 같은 컨테이너에서 그 pid가 살아 있지 않으면 이어받는다(파일을 새 값으로 바꾸고 다시 읽어 내 값인지 확인). 프로세스 안에서는 메모리 잠금을 먼저 잡는다. T30c: 잠금 파일을 남긴 채 서버 재시작 → 10분 안에 보관·파기가 다시 돔 |
| 6-2(이 판 독립 검토) | INSERT 커밋 직후·rename 전에 종료되면 staging 정리가 DB에 있는 정상 사진을 지움 | staging 정리 때 DB에 줄이 있는 파일은 지우지 않고 원래 폴더로 옮겨 마무리한다. DB에 없는 것만 지운다. 사진 읽기(photos.ts)는 원래 폴더에 없으면 staging을 한 번 더 본다. T31c: 커밋 직후 종료 → 재시작 뒤 정기 작업 → 사진이 원래 폴더에 있고 주소가 200 |
| 위치 | 보관 백업 세트 기준 폴더 | `runtime-data/retained-backups/`(운영 컨테이너 볼륨, ops/deploy.sh:18). 같은 볼륨이라 rename이 안전하다 |
| 참고 | 트리거 개수 표기, T18 쌍 | 트리거는 사용자 칸 17개 표 + 규칙 6개 표다. T18은 각 트리거마다 ACTIVE 사용자 쓰기 성공과 탈퇴자 쓰기 실패 둘 다를 합격 조건으로 한다 |

## 000. Codex 1차 검수(CODEX_REVIEW_RESULT_WITHDRAW2_PLAN_v1.raw.txt) 차단 오류 6건 처리
| 번호 | 지적 | 처리(본문 반영 위치) |
|---|---|---|
| 1 | RETAIN_SECRET이 없어도 탈퇴 성공 → 개인정보 무기한 잔류 | 탈퇴 POST 시작 전 사전 점검 `retainReady()`: 키 길이 32자 이상, 시험 값 암호화·복호화, 보관 DB 쓰기·지우기 시험. 하나라도 실패하면 탈퇴 트랜잭션을 시작하지 않고 503 "지금은 탈퇴를 처리할 수 없어요. 잠시 뒤 다시 시도해 주세요."(2절 0단계) |
| 2 | WAL 정리 성공 확인 없음 | `wal_checkpoint(TRUNCATE)` 반환값 busy=0이고 -wal 파일 크기 0일 때만 stage=RETAINED. 아니면 stage=WIPE_PENDING으로 두고 정기 작업이 다시 한다. 시험 T29: 읽기 연결을 열어 busy=1을 만든 뒤 WIPE_PENDING에 머무는지, 닫은 뒤 RETAINED로 가는지(2절·4절) |
| 3 | 보관 백업·파기가 양쪽으로 손실 | (v11: 날짜별 키로 바꿈, 0000절 4) ① 보관 자료는 "만료일별 키"로 암호화한다. 키 = HKDF(RETAIN_SECRET, 만료일별 무작위 소금). 소금은 `runtime-data/retained-keys/<YYYYMMDD>.key` 파일에 둔다. 사진 파일도 같은 키로 암호화해 저장한다 ② 파기 = 그 만료일 소금 파일을 0으로 덮어쓰고 fsync 뒤 지우기 + 줄·파일 삭제. 소금이 없으면 journal·지운 디스크 자리·옛 백업에 남은 암호문도 풀 수 없다 ③ 백업은 retained.db + 보관 사진 폴더 + 키 폴더를 한 세트(목록 파일에 sha256)로 만들고, 파기가 일어나면 새 세트를 먼저 만들어 검증·확정한 뒤 옛 세트를 지운다(0000절 1) ④ 복구 시험 T30: 세트로 복원해 복호화가 되는지 ⑤ K6에 백업 세트까지 표식 0건(4절) |
| 4 | 트리거가 사진 줄 쓰기를 막으면 파일이 고아로 남음 | 상품 사진·거래 사진 올리기 API 두 곳에서 INSERT가 실패하면 저장한 파일을 지운다(listings/[id]/photos route 34행, orders/[id]/photos route 47행). 시험 T31: 업로드 도중 탈퇴 → 업로드 폴더에 DB에 없는 파일 0개(7절·9절) |
| 5 | 알림 제목·본문, 주문 스냅숏 제목에 탈퇴자 상품 제목 복사본 | ① 상대방 알림 중 url이 탈퇴자 상품·주문을 가리키는 것은 title·body 안의 원래 상품 제목을 "탈퇴한 판매자의 상품"으로 바꾼다(보존 근거 없음, 보관 안 함) ② (v11에서 바꿈, 0000절 5) 판매자가 탈퇴하면 orders.snapshot 전체를 보관하고 운영 DB 스냅숏은 판매자 원문 칸만 바꾼다 ③ 시험 T32: 탈퇴 전 고유 표식을 탈퇴자가 쓴 모든 칸에 넣고, 탈퇴·보관 이동 뒤 운영 DB 모든 TEXT 칸에서 표식 0건(3절·9절) |
| 6 | 롤백이 보관·파기 상태를 지움 | 롤백을 둘로 나눈다. ① `0019_down_triggers.sql`: 트리거만 지운다. 언제든 실행 가능하고, 긴급 대응은 이것만 쓴다 ② `0019_down_full.sql`: withdrawals 표까지 지운다. (v11: 0000절 2로 강화) 운영 DB withdrawals·보관 DB 줄·키 파일·보관 사진·PURGE_BACKUP_PENDING이 모두 0일 때만 허용한다. 검사와 실행을 묶은 `ops/withdraw2_rollback.cjs`만 쓴다(14절·16절) |
| 참고 | lease 소유자 표시, 트리거별 ACTIVE 성공·WITHDRAWN 실패 쌍 | 둘 다 반영한다. lease_owner(무작위 값)를 두고 ④ 갱신 조건에 넣는다. T18은 트리거마다 쌍으로 한다 |

## 00. 자체 적대 검토(SELF_REVIEW_WITHDRAW_PLAN_v9.md) 반영
| 지적 | 처리(아래 본문에 반영) |
|---|---|
| 막는 1 보관값 덮어쓰기(REPLACE) | 보관 키 = (탈퇴자 id·원천 표·원천 id·칸), `INSERT OR IGNORE`, 빈 값은 옮기지 않는다. 두 번째 당사자 탈퇴나 재실행 때 기존 보관값을 바꾸지 않는다(2절) |
| 막는 2 요청 경로와 정기 작업이 동시에 실행 | 동기 트랜잭션 하나에서 stage를 RETAINING으로 바꾸고(처리 중 표시, 5분 기한) ① 읽기까지 한다. 바뀐 줄이 1이 아니면 돌아간다(2절) |
| 막는 3 원본 사진이 없으면 영구 정지 | 파일이 없으면 보관 DB에 `missing=1`로 적고 다음 단계로 간다(2절) |
| 참고 1 상품 내용 UPDATE 경쟁 | listings·listing_trial_terms UPDATE 트리거: 판매자 withdrawals.stage가 RETAINED면 비운 값으로 가는 갱신만 통과. listing_components INSERT는 판매자 ACTIVE만(5절) |
| 참고 2 스위치를 끄면 파기도 멈춤 | 스위치는 새 탈퇴만 막는다. 이미 탈퇴한 사용자의 보관 이동·파기는 스위치와 상관없이 돈다(K8 변경) |
| 참고 3 거래 기록 취소 사유 | order_events.data의 `reason`(orders.ts:389·394)을 2호로 옮긴다. "운송장 키"는 실제로 없어 뺐다 |
| 참고 3-2(이번 판에서 추가 확인) SYSTEM 채팅에 메모 원문 | 받을 때 확인 메모(orders.ts:80)와 판매자 검수 메모(orders.ts:365)가 SYSTEM 메시지 본문에 들어간다. 탈퇴자 메모가 든 SYSTEM 메시지는 원문을 보관하고 그 부분만 "(탈퇴한 사용자의 메모)"로 바꾼다 |
| 참고 4 listing_components.name | 구성품 이름(예: "충전기")이라 개인정보로 보지 않고 유지(3절에 줄 추가) |
| 참고 5 가명 매핑 불가 | CHAT_REPORT.reportedUserId·LOGIN_LINK_ISSUED.userId는 새 무작위 `wd_` 값으로 바꾼다(원래 id와 연결 저장 안 함) |
| 참고 6 notify.ts 수정은 이미 있음 | 확인: notify.ts:41-43이 ACTIVE 아닌 받는 사람을 건너뛴다. 파일 표에서 뺐다 |
| 참고 7 시험 약함 | T17을 T17a~e로 나누고, T23 경계·T28 상대방 정상 동작 회귀를 더했다. 트리거 표 수를 실제 개수로 고쳤다 |
| 참고 8 백업 0개·키 분실 | (v11에서 바꿈: 0000절 7) 정리 직전 새 백업을 만들고 검증. RETAIN_SECRET은 서버 .env와 사용자 보관 사본 2곳(사용자 행동) |
| 참고 9 사진 캐시 승인 누락 | 1절 승인 목록에 넣었다 |
| 미룬 항목 | 쓰기 호출 목록을 파일로 저장(docs/review/survey/withdraw2_write_calls.txt, 121줄). 운영 백업 개수를 지금 셌다(2026-10-28 11:4x 읽기 전용 ssh: 12개). 시험 파일 이름 확정(ops/e2e/unit/withdraw2_unit.sh) |

참조 규칙: E:\PROJECT_CONTROL_CENTER\00_공통\PLANNING_RULES_v3.md, 38절(기획 규칙 6단계), 41절(기획 규칙 v3 보강), 53절(미룸 0건·서버 실측), 63절(검수 왕복 3번), 65절(기획 3단계), 74절(계획서 4대 대조 칸), 83절(승인은 4가지만), 93절(개발 전 의견 보고 후 진행).
개발 전 의견: docs/review/CODEX_OPINION_RESULT_WITHDRAW_STAGE2_v1.raw.txt(Codex), E:\PROJECTS\_work\reports\2026-10-28_탈퇴2단계_개발전의견.md(Claude 검토·요약).

## 0. 결정과 범위
| 항목 | 내용 |
|---|---|
| 사용자 결정 L1 | 시행령 제6조 보관 기준을 적용해 설계한다. 운영에서 WITHDRAW_ENABLED를 켜기 전에 법률 검토로 확정한다(켜는 것은 별도 승인) |
| 사용자 결정 2 | 운영 서버 DB 백업은 30일 보관 |
| 1단계와의 관계 | 1단계(f25a1d7)의 탈퇴 화면·API·blockersOf·withdrawUser는 그대로 쓰고 고친다. 새로 만들지 않는다(Codex 의견 1) |
| 2단계가 하는 일 | ① 거래 기록 속 개인정보를 보관 DB로 옮기고 원래 칸 비우기 ② 기간이 지나면 보관분 파기 ③ 탈퇴자 이름으로 새 쓰기가 생기지 못하게 DB 트리거 ④ 탈퇴자 상품 사진 공개 주소 차단 ⑤ 백업 30일 정리 ⑥ 안내 문구를 실제 동작에 맞춤 |
| 빼는 것(참고) | 카카오 원격 연결 끊기, 탈퇴 요청 횟수 제한, 운영자 강제 탈퇴, 응답 코드 500→409, 관리자 화면 탈퇴 지표, 키 교체 기능(키 버전 칸만 둔다) |

## 1. 완성 지도
- 완성 정의
  - 탈퇴하면 1단계 동작(로그인 차단·이름 가리기·내 데이터 8종 삭제·상품 내림·진행 중 거래 막기)에 더해, 아래 일이 일어난다.
    - 거래 기록 속 개인정보가 운영 DB에서 사라지고 보관 DB(`runtime-data/retained.db`, 별도 키)에만 남는다.
    - 탈퇴자 상품 사진 주소는 바로 404가 된다.
  - 보관분은 기록 종류별 기한(6개월·5년·3년)이 지나면 정기 작업이 복구할 수 없게 지운다.
  - 탈퇴가 커밋된 뒤에는 그 사용자 이름으로 어떤 표에도 새 줄이 생기지 않는다(DB가 거절).
  - 운영 서버 백업은 30일 지난 것을 지운다.
- 현재 위치: 1단계 커밋 f25a1d7. 시뮬레이션 서버(localhost:3200)에서만 켜져 있고 운영은 꺼져 있다.
- 개발 순서
  1. DB 이전 0019(withdrawals·트리거)
  2. 보관 DB 모듈
  3. 탈퇴 처리 2단계(보관 이동 상태기계)
  4. 사진 차단·이동
  5. 파기 작업
  6. 문구
  7. 백업 정리 스크립트
  8. 시험
  9. Codex 코드 검수
  10. 운영 반영(승인)
- 필요한 승인(83절(승인은 4가지만))
  - 운영 반영 1회(③ 되돌릴 수 없는 변경 — 트리거·표 추가)
  - 운영 서버 비밀값 `RETAIN_SECRET` 등록(④)
  - 첫 백업 정리 실행 때 30일 넘은 백업 삭제(② 영구 삭제, 정리 직전 새 백업을 만들어 검증)
  - 운영에서 WITHDRAW_ENABLED=1로 켜기(L1 법률 검토 뒤, ③)
  - 정책 값(제안): 처리 중 표시 5분, 고아 파일 정리 기준 24시간 — 3단계(사용자 확정)에서 함께 확정
- 되돌리기
  - 코드 되돌리기는 2단계 안의 이전 커밋까지만 한다. 1단계 커밋으로 되돌리면 파기가 멈추므로 금지한다.
  - 긴급 되돌리기는 `app/drizzle/rollback/0019_down_triggers.sql`(트리거만)이다. 보관·파기 코드와 withdrawals 표는 남긴다. 코드를 1단계로 되돌리는 것은 금지한다(파기가 멈춤). 전체 되돌리기는 0000절 2의 조건에서만 한다.
  - 실제 탈퇴로 옮기거나 지운 데이터는 되돌릴 수 없다. 그래서 운영에서는 꺼 둔 채 반영하고, 시뮬레이션 서버에서 끝까지 시험한다.

## 2. 처리 방식 — 보관 이동 상태기계 (Codex 의견: 두 DB 사이 서버 종료 복구)
| 상태(withdrawals.stage) | 언제 | 다음으로 가는 조건 |
|---|---|---|
| 0단계 사전 점검 | 탈퇴 POST에서 blockersOf 전에 retainReady() 실행(000절 1) | 실패하면 503으로 끝나고 아무것도 바꾸지 않는다 |
| (없음) → RETAIN_PENDING | 1단계 탈퇴 트랜잭션 안에서 withdrawals 줄을 같이 쓴다 | 커밋 직후 같은 요청에서 retainUser 실행 |
| RETAIN_PENDING → RETAINING | retainUser ⓪: 운영 DB 동기 트랜잭션 하나에서 `UPDATE withdrawals SET stage='RETAINING', lease_owner=<무작위 값>, lease_until=지금+5분 WHERE user_id=? AND (stage='RETAIN_PENDING' OR (stage='RETAINING' AND lease_until<지금))`. 바뀐 줄이 1이 아니면 다른 실행이 처리 중이라 돌아간다. 같은 트랜잭션에서 ① 대상 값을 읽는다 | 바뀐 줄 1 |
| RETAINING → RETAINED | ② 보관 DB에 `INSERT OR IGNORE`(키 = 탈퇴자 id·원천 표·원천 id·칸). 빈 값(null·"")은 옮기지 않는다. 이미 있는 보관값은 바꾸지 않는다 ③ 사진 파일을 만료일별 키로 암호화해 보관 폴더에 쓰고 fsync, 보관 DB에 파일 줄 기록(원본이 없으면 `missing=1`로 적고 넘어감) ④ 운영 DB 한 트랜잭션에서 원래 칸 비우기·사진 줄 삭제·상대방 알림 제목 바꾸기·`stage='WIPE_PENDING' WHERE stage='RETAINING' AND lease_owner=<내 값>` ⑤ 원본 사진 파일 unlink ⑥ `wal_checkpoint(TRUNCATE)` 결과 busy=0이고 -wal 크기 0이면 `stage='RETAINED', lease_owner=null, lease_until=null`, 아니면 WIPE_PENDING에 둔다(lease 비움). ②~⑥은 공통 잠금(0000절 1) 안에서 한다 | ②~⑥ 성공 |
| WIPE_PENDING → RETAINED | 정기 작업이 ⑤·⑥만 다시 한다 | busy=0·-wal 0바이트 |
| 실패·서버 종료 | 어느 단계든 중간에 멈춤 | 정기 작업(10분마다, jobs.ts:105)이 RETAIN_PENDING과 기한 지난 RETAINING을 찾아 다시 실행한다. ②는 IGNORE라 보관값이 바뀌지 않고, ④는 stage 조건이 있어 한 번만 적용된다 |
| 원본 파일 unlink 실패 | ⑤ | 보관 DB 파일 줄에 `src_removed=0`을 남기고 정기 작업이 다시 지운다(Codex 의견: unlink 실패 무시 금지) |
| 두 번째 당사자 탈퇴 | 같은 주문의 상대도 나중에 탈퇴 | 키에 탈퇴자 id가 있어 따로 보관된다. 이미 비운 칸은 빈 값이라 옮기지 않으므로 앞 보관값을 덮지 않는다 |
| RETAINED → PURGED | 보관분이 모두 기한 지나 파기되면 | withdrawals 줄을 지운다 |
- RETAIN_PENDING 동안(보통 1초 미만, 최악 10분) 거래 상대 화면에 원래 값이 보인다. 탈퇴자는 이미 로그아웃·로그인 차단 상태다. 이 창은 받아들인다(14절 막힘 대응표).

## 3. 개인정보 위치 전수표 (2단계 처리) — 근거: app/src/db/schema.ts, 1단계 처리 근거: app/src/lib/withdraw.ts
| 위치(schema 행) | 분류 | 2단계 처리 | 보관 기간 시작 |
|---|---|---|---|
| listings.title·description·check_items(70·73·79) 탈퇴자 상품 전부(SOLD 포함) | 법정 보관 1호(표시·광고) | 보관 DB로 옮기고 원래 칸을 "탈퇴한 판매자의 상품"·""·null | 탈퇴일 |
| listing_photos 줄·파일(92) | 법정 보관 1호 | 파일 보관 폴더로 이동, 줄 삭제 | 탈퇴일 |
| listing_trial_terms.condition_note(111) | 법정 보관 1호 | 옮기고 null | 탈퇴일 |
| orders.snapshot(218) | 2호(계약) | 판매자가 탈퇴하면 전체를 옮기고, 운영 DB에는 구조와 비개인 항목을 그대로 두고 판매자 원문 칸(title·description·photo·conditionNote·checks 메모)만 바꾼다(0000절 5). 구매자 탈퇴 때는 판매자 상품 내용이라 그대로 둔다 | 주문 끝난 날(없으면 탈퇴일) |
| notifications.title·body(schema 371 부근) 중 상대방 알림, url이 탈퇴자 상품·주문을 가리키는 것 | 보존 근거 없음 | 원래 상품 제목 부분을 "탈퇴한 판매자의 상품"으로 바꾼다(보관 안 함) | — |
| orders.questions·return_note·cancel_reason(225·232·244) | 2호 | 쓴 쪽이 탈퇴하면 옮기고 null(questions는 구매자, return_note는 구매자, cancel_reason은 기록상 작성자 구분이 없어 양쪽 중 누가 탈퇴해도 옮김) | 같음 |
| orders.deposit_name·ship_enc·refund_enc(226-228) | 3호(결제·공급) | 구매자 탈퇴 때 옮기고 "탈퇴한 사용자"·""(NOT NULL)·null | 같음 |
| orders.seller_account_enc(246) | 3호 | 판매자 탈퇴 때 옮기고 null | 같음 |
| orders.ship_tracking(230)·return_tracking(234) | 3호 | ship은 판매자, return은 구매자가 탈퇴하면 옮기고 null | 같음 |
| orders.arrival_check·pack_check(237-238) | 3호 | 구매자 탈퇴 때 JSON 전체를 옮기고, 원래 칸에는 구성품 결과만 남김(메모·사진 이름 제거) | 같음 |
| orders.inspection(236) | 3호 | 판매자 탈퇴 때 같은 방식 | 같음 |
| order_photos 줄·파일(270) | 3호, 분쟁에 쓰였으면 3호·4호 중 긴 쪽 | 탈퇴자가 올린 것만 파일 이동·줄 삭제 | 같음 |
| order_events.data(287) CANCELLED의 reason(orders.ts:389·394, 자유 입력) | 2호 | 탈퇴자가 쓴 취소 이벤트(actor_id=탈퇴자)의 reason만 옮기고 지움. actor_id는 익명화된 users를 가리켜 그대로 | 같음 |
| chat_messages.body SYSTEM 종류 중 탈퇴자 메모가 든 것(orders.ts:80 받을 때 확인 메모, orders.ts:365 판매자 검수 메모) | 3호 | 원문을 보관하고 본문의 메모 부분만 "(탈퇴한 사용자의 메모)"로 바꿈 | 같음 |
| listing_components.name(86) | 유지 | 구성품 이름이라 개인정보로 보지 않음 | — |
| disputes.detail(297) | 4호(분쟁) | 개설자가 탈퇴하면 옮기고 null. resolution은 운영자 글이라 유지 | 분쟁 정리일(없으면 탈퇴일) |
| chat_messages.body(156) USER 종류, 주문이 있었던 방 | 2호 | 옮기고 원래 본문 "(탈퇴한 사용자의 메시지)" | 그 방 주문이 끝난 날 |
| chat_messages.body USER 종류, 주문 없는 방 | 보존 근거 없음 | 탈퇴 트랜잭션에서 바로 "(탈퇴한 사용자의 메시지)"(보관 안 함) | — |
| reviews.body(315), trial_reviews.answers·reason·learned·fit_for(329-332) | 익명화 후 유지 | 탈퇴 때 findContactInfo(app/src/ui/trial-pricing.ts:127)로 검사, 걸린 칸만 null | — |
| market_validation_events.metadata(194) FEEDBACK.message | 보존 근거 없음 | 탈퇴자 것은 탈퇴 때 비움 | — |
| metadata CHAT_REPORT.reportedUserId, LOGIN_LINK_ISSUED.userId | 익명화 | 탈퇴 때 새 무작위 `wd_` 값으로 바꿈(원래 id와 연결해 저장하지 않음) | — |
| 운영 DB 백업 | 보존 근거 없음 | 30일 지난 백업 삭제(ops/backup_prune.sh) | — |
- 1단계가 이미 처리한 것(로그인 연결·로그인 링크·정산 계좌·찜·수요·내 알림·푸시·알림 설정, 이름·사진, 써보기 제안 글, 상대 알림 2종, 이벤트 user_id)은 바꾸지 않는다.

## 4. 법정 보관 기간과 파기
| 기록 종류(시행령 제6조 제1항) | 기간 | 대상(3절) |
|---|---|---|
| 1호 표시·광고 | 6개월 | 상품 글·사진·조건 메모 |
| 2호 계약·청약철회 | 5년 | 스냅숏·질문·반품 메모·취소 사유·주문 있는 방 채팅 |
| 3호 대금결제·재화 공급 | 5년 | 입금자명·배송지·계좌·운송장·확인 기록·거래 사진·거래 기록 운송장 |
| 4호 불만·분쟁 | 3년 | 분쟁 상세(같은 자료가 5년 대상이면 긴 쪽) |
- 보관 DB
  - `runtime-data/retained.db`, `runtime-data/retained/`(사진 파일)에 둔다. 운영 컨테이너에 이미 붙어 있는 볼륨이다(ops/deploy.sh:18).
  - 열 때 `journal_mode=DELETE`, `secure_delete=ON`을 쓴다. WAL 파일에 잔재가 남지 않게 하려는 것이다.
  - 값은 AES-256-GCM으로 암호화한다. 키는 `RETAIN_SECRET`과 만료일별 소금(`runtime-data/retained-keys/<YYYYMMDD>.key`, 32바이트 무작위, `wx`로 생성)으로 HKDF를 거쳐 만든다. 형식은 crypto-box.ts:12와 같고 앞에 `r1.<YYYYMMDD>`를 붙인다. 사진 파일도 같은 방식으로 암호화해 저장한다.
  - 같은 기록의 만료일이 바뀌지 않으므로(시작 기준이 이미 지난 날짜) 기록은 처음 정한 만료일 키에서 바뀌지 않는다.
  - 읽는 함수는 파기 함수뿐이다. 화면·관리자 CSV·API에서는 읽지 않는다.
- 파기(purgeRetained, runJobs에 단계 추가)
  - 만료일이 지난 key_id마다 아래 순서로 지운다(공통 잠금 안).
    1. 그 key_id의 줄과 사진 파일을 지운다. 파일은 unlink한 뒤 존재 여부를 다시 확인하고, 실패하면 줄을 남겨 다음 실행에서 다시 지운다.
    2. 그 key_id를 가리키는 줄·파일이 0개일 때만 소금 파일을 0으로 덮어쓰고 fsync한 뒤 지운다. 이것으로 그 날짜 암호문은 journal·지운 디스크 자리·옛 백업 어디에 남아 있어도 풀 수 없다.
    3. 보관 DB에 VACUUM을 실행한다.
  - 하나라도 지웠으면 새 보관 백업 세트를 만들어 검증·확정한 뒤 옛 세트를 지운다(0000절 1).
  - 같은 기록이 여러 기간에 걸리면(3호와 4호) 긴 쪽 만료일 하나로 정하고, 그 만료일의 키를 쓴다.
- 운영 DB
  - 연결에 `secure_delete=ON`을 더한다(client.ts:6-7).
  - retainUser ⑥에서 `wal_checkpoint(TRUNCATE)`를 실행하고, 결과 busy=0과 -wal 파일 0바이트를 확인한다. 실패하면 WIPE_PENDING으로 두고 재시도한다(Codex 1차 차단 2). SQLite 공식 문서에 따르면 TRUNCATE는 성공했을 때만 WAL을 0바이트로 만든다.
- 백업
  - deploy.sh는 --migrate일 때 운영 DB 백업을 만든다(ops/deploy.sh:20).
  - 백업 방식은 better-sqlite3 `.backup()`이다(WAL 내용까지 일관된 사본, ops/deploy.sh:20).
  - 2단계에서는 보관 백업 세트를 더한다. 세트는 retained.db(`.backup()`), 보관 사진 폴더, 키 폴더, 목록 파일(각 파일 sha256)로 이루어진다. 세트는 배포 때와 파기 직후에 만든다. 파기 직후에는 옛 세트를 모두 지운다.
  - `ops/backup_prune.sh`는 먼저 새 백업을 만들어 검증하고, 그 뒤 30일 넘은 백업을 모두 지운다(0000절 7). 30일이 절대 상한이다.
  - 2026-10-28 운영 서버 백업은 12개다(읽기 전용 확인).
- RETAIN_SECRET을 잃으면 보관분을 읽을 수 없다(파기는 키 없이 가능). 서버 .env에 두고, 사용자가 따로 안전한 곳에 사본을 보관한다(사용자 행동).

## 5. 쓰기 장벽 (0019 트리거) — Codex 의견 3·Claude 검토 2 반영
- 사용자 칸 표: BEFORE INSERT 트리거를 둔다. 그 줄의 사용자가 ACTIVE가 아니면 `RAISE(ABORT,'USER_INACTIVE')`로 거절한다. 대상은 아래 17개 표다(schema에 모두 있음, Claude 검토 2). 그 밖에 listings·listing_photos·listing_trial_terms·listing_components·market_validation_events·users 6개 표에 따로 규칙을 둔다.
- 탈퇴자를 상대로 하는 정상 동작은 막히지 않는다(자체 적대 검토 확인).
  - 알림은 notify.ts:41-43이 먼저 건너뛴다.
  - 경험치·SYSTEM 채팅은 진행 중 거래에서만 생기는데, 탈퇴자는 blockersOf 때문에 진행 중 거래가 없다.
  - SYSTEM 메시지는 kind 조건으로 통과한다.
  - wishlists.user_id, demand_intents.user_id, seller_accounts.user_id, push_subscriptions.user_id, notification_prefs.user_id
  - notifications.user_id, login_links.user_id, social_accounts.user_id
  - chat_messages.sender_id(kind='USER'만), chat_threads.buyer_id·seller_id, trial_proposals.buyer_id, orders.buyer_id·seller_id
  - order_photos.user_id, disputes.opener_id, reviews.writer_id, trial_reviews.writer_id, xp_awards.user_id
- market_validation_events.user_id: 'wd_'로 시작하는 가명과 null은 통과시킨다.
- listings
  - INSERT: seller가 ACTIVE가 아니면 거절한다.
  - UPDATE: seller가 WITHDRAWN이고 NEW.status가 ACTIVE·HIDDEN·RESERVED 중 하나면 거절한다. REMOVED·SOLD로 내용만 비우는 갱신은 통과한다. v4(탈퇴 전체 설계 초안)는 SOLD 상품 비우기까지 막았는데, 이 판에서 고쳤다(Codex 의견 3).
  - UPDATE 추가 규칙: 판매자의 withdrawals.stage가 RETAINED이면 title이 "탈퇴한 판매자의 상품"이고 description이 "", check_items가 null인 갱신만 통과한다. 보관 이동이 끝난 뒤 수정 요청이 늦게 도착해 원래 내용이 다시 써지는 경쟁을 막는다.
- listing_photos·listing_components INSERT: 그 상품의 seller가 ACTIVE가 아니면 거절한다.
- listing_trial_terms
  - INSERT: 그 상품의 seller가 ACTIVE가 아니면 거절한다.
  - UPDATE: seller가 ACTIVE가 아니면 condition_note를 null로 바꾸는 갱신만 통과한다.
- users UPDATE: OLD.status='WITHDRAWN'이고 다음 중 하나면 거절한다. 이렇게 하면 이름 바꾸기와 탈퇴가 겹쳐도 이름이 되살아나지 않는다.
  - NEW.status가 'WITHDRAWN'이 아님
  - NEW.nickname이 '탈퇴한 사용자'가 아님
  - NEW.kakao_image_url이 null이 아님
  - NEW.show_photo가 0이 아님
- 트리거 대상 표에 쓰는 지점은 실측한 쓰기 호출 목록에 있다(Grep `.insert|update|delete(<표>)`, 8절 대조표).
  - 정상 경로에서는 탈퇴자가 session.ts:60에서 먼저 401로 막힌다.
  - 트리거는 그 검사를 지난 직후에 탈퇴가 커밋되는 경우만 막는다. 그때 응답은 500이고 DB 변경은 0이다(409로 바꾸는 일은 참고사항).

## 6. 사진 공개 주소 차단 (Claude 검토 3)
- `app/src/app/api/photos/[file]/route.ts:9-18`
  - 파일을 읽기 전에 `listing_photos` 줄이 있는지 확인하고, 없으면 404를 돌려준다. 2단계가 줄을 지우고 파일을 옮기므로 탈퇴 즉시 404가 된다. 이 확인은 If-None-Match(304) 비교보다 먼저 한다. 그래서 탈퇴 뒤에는 304가 나가지 않는다.
  - 캐시 헤더를 `private, no-cache, must-revalidate`와 ETag로 바꾼다(0000절 8).
  - 이 변경 전에 1년 캐시로 받아 간 사본이 있다. 이를 피하려고 사진 주소(photo-url.ts)에 `?v=2`를 붙인다. 화면이 새 주소를 요청하므로 옛 캐시는 쓰이지 않는다. 다만 옛 주소를 따로 저장해 둔 사본은 회수할 수 없다.
- 주문 화면의 스냅숏 사진(orders.snapshot.photo)
  - 판매자가 탈퇴한 뒤에는 사진 주소가 404가 된다.
  - 주문 화면은 사진이 없을 때 자리표시 화면을 보여 주는지 시험한다(T22).

## 7. 파일
| 파일 | 상태 | 역할 |
|---|---|---|
| app/drizzle/0019_withdraw2.sql + meta/0019_snapshot.json·_journal.json | 신규·수정 | withdrawals 표(user_id 기본 키, stage, withdrawn_at, lease_owner, lease_until, updated_at — 0000절 3), 5절 트리거 |
| app/drizzle/rollback/0019_down_triggers.sql, 0019_down_full.sql | 신규 | 되돌리기 둘(트리거만 / 전체) |
| ops/withdraw2_rollback.cjs | 신규 | 전체 되돌리기 묶음: 0000절 2의 0건 검사 뒤에만 0019_down_full.sql 실행 |
| app/src/lib/photos.ts(staging), app/src/lib/jobs.ts(고아 정리) | 수정 | 0000절 6: staging 저장 → INSERT → rename, 24시간 지난 고아 파일 정리 |
| app/src/app/api/listings/[id]/photos/route.ts, app/src/app/api/orders/[id]/photos/route.ts | 수정 | INSERT 실패 때 저장한 파일 지우기(000절 4) |
| app/src/db/schema.ts | 수정 | withdrawals 정의 |
| app/src/db/client.ts | 수정 | secure_delete=ON |
| app/src/lib/retain.ts | 신규 | 보관 DB 열기·암호화·넣기·파기 |
| app/src/lib/withdraw.ts | 수정 | 탈퇴 트랜잭션에 withdrawals 줄·주문 없는 방 채팅·후기 연락처·이벤트 metadata, retainUser(2절) |
| app/src/app/api/me/withdraw/route.ts | 수정 | 커밋 뒤 retainUser 호출(실패해도 탈퇴 응답은 성공, 정기 작업이 이어서 함) |
| app/src/app/api/photos/[file]/route.ts | 수정 | 6절 |
| app/src/lib/photos.ts | 수정 | 보관 폴더로 이동하는 함수, unlink 결과 확인 |
| app/src/lib/jobs.ts | 수정 | runJobs에 retainPending·purgeRetained 단계 |
| app/src/app/withdrawn/page.tsx, me/account/WithdrawForm.tsx | 수정 | 안내 문구: "거래 기록은 법에 따라 따로 보관했다가 기간이 지나면 지워요" |
| ops/backup_prune.sh, ops/deploy.sh | 신규·수정 | 30일 정리, retained.db 백업 |
| ops/e2e/suites/test_withdraw.py, ops/e2e/unit/withdraw2_unit.sh | 수정·신규 | 9절 시험 |

## 사전 조사 생성표
생성표: docs/review/survey/withdraw2_state.md sha256:e22ca4b7ce4fc4eea194ee0d543d5b82b8894933571b962af3451a56a13f663f
조사 범위 대장: docs/review/survey/withdraw2_state.md.manifest.json sha256:a7401ba18107e0f808a595b8a329c504069d68ffbbbe2bc80ef83faafc974850
생성표: docs/review/survey/withdraw2_literal_withdraw.md sha256:0171b00372673c6e9a46d96e975393ef3f2f7f869cab12f1cb06a89a96446f19
조사 범위 대장: docs/review/survey/withdraw2_literal_withdraw.md.manifest.json sha256:143fadbfd11c7c7a5efca1d94cf45007a854421a62c41860961451c0dd651d1e
생성표: docs/review/survey/withdraw2_literal_photos.md sha256:82fd44cd3689a1a68cad107a25503f2b089c62ed3eaa24430c20b91f77feac6f
조사 범위 대장: docs/review/survey/withdraw2_literal_photos.md.manifest.json sha256:fd2d0c89d72a962f5e060508c75faaf83a946a5a343d3312586162e3e2c00628
조사 생략: ui — 새 화면·버튼·탭이 없고 기존 탈퇴 안내 문구 2곳(withdrawn/page.tsx, WithdrawForm.tsx)만 바꾼다
조사 생략: config — app/.env는 비밀값 파일이라 자동 모드가 읽기를 막았다(2026-10-28 11:3x). 2단계는 새 설정 RETAIN_SECRET 1개만 더하고, 기존 WITHDRAW_ENABLED(withdraw.ts:28)·SESSION_SECRET(crypto-box.ts:6)은 코드에서 확인했다
- 2026-10-28 13:1x 96절(조사 범위 대장) 방식으로 다시 생성. 세 대장 모두 result ok, 오류 0, 열거 수와 재집계 수가 같음(state 168/168, withdraw 168/168, photos 28729/28729). 조사 루트가 저장소 하위 폴더라 git 대조는 도구가 생략했다.

### 제외 묶음 판단 (세 표의 X 행, ID가 겹쳐 표 이름을 함께 씀)
| ID | 판단 | 이유 |
|---|---|---|
| X001 | 제외타당 | state 표: globals.css(스타일, DB 접근 없음) / withdraw 표: 아이콘 png 2개 / photos 표: .next 빌드 결과 1235개 |
| X002 | 제외타당 | state 표: 아이콘 png / photos 표: 옛 빌드 결과의 cache 폴더 |
| X003 | 제외타당 | state 표: .tsx 74개. state 도구는 .ts만 읽는다. 쓰기 호출은 Grep으로 app/src 전체(.tsx 포함)를 따로 실측했고 .tsx 쓰기 호출은 0건이었다(withdraw2_write_calls.txt는 그 결과 중 .ts 경로). 화면 읽기는 T22·T28에서 실제 화면으로 확인 / photos 표: 옛 빌드 결과 logs |
| X004-X005 | 제외타당 | photos 표: node_modules(라이브러리) |
| X006 | 제외타당 | photos 표: .dockerignore·.env·.gitignore — .env는 비밀값(설정값 조사 생략 사유 참고), 나머지는 사진 코드 아님 |
| X007-X011 | 제외타당 | photos 표: 설정 백업·DB 파일·로그 — 코드가 아니고 DB 내용은 schema로 봄 |
| X012 | 제외타당 | photos 표: 빌드 결과 .map |
| X013 | 제외타당 | photos 표: AGENTS.md·CLAUDE.md·README.md(지침 문서) |
| X014-X018 | 제외타당 | photos 표: 영상·이미지·빌드 정보 파일(텍스트 코드 아님) |
- state 표 한계: 생성 도구는 SQL 문자열만 읽어 drizzle 쓰기(`.insert(표)`)를 0으로 셌다. 쓰기 지점은 Grep으로 따로 실측해 8절 대조표에 썼다.
- photos 이름표 한계: --exclude가 `.next.codex-review-20261027`(옛 빌드 결과)와 drizzle/meta를 빼지 못해 F001-F064에 들어 있다.
- 두 이름표는 ID가 둘 다 F001부터라, 아래 판단 표를 표 이름별로 나눠 쓴다.

### 공유 상태 지도(withdraw2_state.md) 판단
| ID | 판단 | 이유 |
|---|---|---|
| S001-S002 | 해당없음 | SQL 문장 속 낱말(answered, better)이 표 이름으로 잡힌 것 |
| S003 | 해당없음 | categories는 개인정보 없음 |
| S004-S005 | 변경 | chat_messages 본문 보관·교체, chat_threads INSERT 트리거 |
| S006 | 유지 | demand_intents는 1단계가 이미 삭제, 2단계는 INSERT 트리거만 |
| S007 | 변경 | disputes.detail 보관, INSERT 트리거 |
| S008 | 해당없음 | drizzle 라이브러리 이름 |
| S009 | 변경 | listing_photos 줄 삭제·파일 이동, INSERT 트리거 |
| S010 | 변경 | listing_trial_terms.condition_note 보관 |
| S011 | 변경 | listings 내용 보관·UPDATE/INSERT 트리거 |
| S012 | 변경 | market_validation_events metadata 정리, 가명 통과 트리거 |
| S013-S014 | 해당없음 | next·node 라이브러리 이름 |
| S015 | 유지 | notifications는 1단계 처리, INSERT 트리거만 |
| S016 | 변경 | orders 개인정보 칸 보관·비우기, INSERT 트리거 |
| S017 | 해당없음 | product_models는 개인정보 없음 |
| S018 | 유지 | push_subscriptions는 1단계 삭제, INSERT 트리거만 |
| S019 | 변경 | reviews 연락처 검사, INSERT 트리거 |
| S020 | 해당없음 | sharp 라이브러리 이름 |
| S021 | 유지 | trial_proposals 글은 1단계 처리, INSERT 트리거만 |
| S022 | 변경 | users UPDATE 트리거 |
| S023 | 해당없음 | web 낱말 |
| S024 | 유지 | wishlists는 1단계 삭제, INSERT 트리거만 |

### 기존 이름 전수(withdraw2_literal_withdraw.md, 검색어 withdraw) 판단
| ID | 판단 | 이유 |
|---|---|---|
| F001 | 유지 | 채팅의 탈퇴 상대 확인(chats/[id]/route.ts:48·63)은 그대로 둔다 |
| F002 | 변경 | 커밋 뒤 retainUser 호출 |
| F003 | 유지 | 탈퇴 화면 스타일 그대로 |
| F004 | 변경 | 안내 문구 한 줄 |
| F005-F006 | 유지 | 탈퇴 입구·폼 위치 그대로(사용자 결정 2026-10-28) |
| F007 | 변경 | 완료 화면 안내 문구 |
| F008 | 변경 | withdrawals 표 정의 추가 |
| F009 | 유지 | 세션의 탈퇴 판정 그대로 |
| F010 | 변경 | 2단계 처리 추가 |

### 기존 이름 전수(withdraw2_literal_photos.md, 검색어 photos) 판단
| ID | 판단 | 이유 |
|---|---|---|
| F001-F044 | 해당없음 | (photos 표의 F001-F044) 옛 빌드 결과 폴더(.next.codex-review-20261027) — 소스 아님 |
| F045-F064 | 유지 | 옛 DB 이전 파일과 스냅숏. 새 0019만 더한다 |
| F065 | 유지 | next.config 이미지 설정, 주소 형식 그대로 |
| F066 | 해당없음 | 당근 가져오기 스크립트(시험 데이터용) |
| F067 | 유지 | 공유 이미지(og)는 상품 사진 경로를 거쳐 6절 차단을 그대로 받는다 |
| F068 | 유지 | 상품 사진 올리기 — 트리거가 탈퇴자 쓰기를 막는다 |
| F069 | 유지 | 상품 수정 API — 트리거가 막는다 |
| F070-F071 | 유지 | 거래 증거 사진 열기·올리기, 당사자 확인 그대로. 탈퇴자 사진은 2단계가 옮긴다 |
| F072 | 변경 | 6절 공개 사진 차단 |
| F073-F078 | 유지 | 화면에서 사진 주소를 쓰는 곳. 404가 되면 기존 빈 사진 처리를 탄다(T22에서 확인) |
| F079-F082 | 유지 | 주문 화면·갤러리·단계 사진 — T22 확인 |
| F083 | 유지 | schema 사진 표 정의 그대로 |
| F084-F085 | 유지 | 채팅·주문의 사진 참조 그대로 |
| F086 | 유지 | 사진 주소 만들기 그대로 |
| F087 | 변경 | 보관 폴더 이동·unlink 결과 확인 |
| F088-F090 | 유지 | 조회·점검표·시험의 사진 참조 그대로 |

## 8. 설계–코드 대조표
| 설계 문장 | 호출 함수 | 읽는 표 | 쓰는 표 | 보호 문구 충돌 |
|---|---|---|---|---|
| 탈퇴 트랜잭션에 withdrawals 줄 추가 | withdrawUser app/src/lib/withdraw.ts:66 | users | withdrawals | 충돌 없음 — 1단계 "트랜잭션 하나만 남긴다"(v7 00절 1)를 지킨다 |
| 커밋 뒤 보관 이동 | 신규 retainUser(withdraw.ts), 호출 app/src/app/api/me/withdraw/route.ts:15 | orders, listings, chat_messages, disputes, order_photos, listing_photos | retained.db, orders, listings, chat_messages, disputes, order_photos, listing_photos, withdrawals | 충돌 후 해소 — 1단계는 요청 안 변경을 탈퇴 트랜잭션 하나로 묶었지만, 2단계 이동은 커밋 뒤 따로 하고 실패해도 정기 작업이 재시도한다(2절) |
| 정기 작업 재시도·파기 | runJobs app/src/lib/jobs.ts:85 | withdrawals, retained.db | retained.db, withdrawals | 충돌 없음 — step 함수가 실패를 다른 단계와 분리한다(jobs.ts:87) |
| 공개 사진 차단 | GET(app/src/app/api/photos/[file]/route.ts 9행 — 대괄호 경로라 점검 도구가 못 읽어 행 표기로 씀), 파일 읽기 readPhoto app/src/lib/photos.ts:46 | listing_photos, order_photos | 없음 | 충돌 없음 — 거래 증거 사진 거절(11행)은 유지 |
| 사진 이동·삭제 확인 | 신규 movePhotoToRetained, 기존 deletePhoto app/src/lib/photos.ts:82 | listing_photos | listing_photos | 충돌 후 해소 — 기존 unlink 실패 무시(photos.ts:53·88)는 상품 수정용으로 두고, 탈퇴 경로만 결과를 확인한다 |
| 운영 DB secure_delete | app/src/db/client.ts:6 | 없음 | 없음 | 충돌 없음 |
| 암호화 형식 | seal app/src/lib/crypto-box.ts:12 참고, 신규 retainSeal | 없음 | retained.db | 충돌 없음 — 키를 SESSION_SECRET과 분리 |
| 후기 연락처 검사 | findContactInfo app/src/ui/trial-pricing.ts:127 | reviews, trial_reviews | reviews, trial_reviews | 충돌 없음 |
| 탈퇴자 쓰기 거절 | 신규 0019 트리거, 기존 검사 app/src/lib/session.ts:60 | users | 없음(거절) | 충돌 없음 |
| 이름 갱신 경쟁 | 이름·사진 갱신 app/src/app/api/session/route.ts:40, app/src/app/api/profile-photo/route.ts:13, app/src/lib/kakao.ts:76 | users | users | 충돌 없음 — 트리거가 탈퇴 뒤 갱신만 거절 |
| 상품 내용 비우기 | 1단계 상품 내림 app/src/lib/withdraw.ts:126 | listings | listings | 충돌 후 해소 — UPDATE 트리거가 REMOVED·SOLD 갱신은 통과(5절) |
| 백업 | ops/deploy.sh:20 | 없음 | 서버 /opt/sseoboni/backups | 충돌 없음 — 백업 만드는 줄은 그대로, 정리만 더한다 |

## 9. 시험 (합격 기준 번호 연결)
- 1단계 시험 T1~T14와 회귀 시험은 그대로 다시 돌린다(시험 서버, 기대: 탈퇴 135/0, 회귀 105/0).
- 2단계 새 시험은 아래와 같다. 모두 시뮬레이션 서버의 사본 DB에서 한다.

| 번호 | 시험 | 실패해야 하는 조건(84절(실패 가능 증거)) | 합격 기준 |
|---|---|---|---|
| T15 | 끝난 거래가 있는 구매자 탈퇴 뒤 orders 개인정보 칸 | 칸 하나라도 원래 값이 남음 | K1 |
| T16 | 같은 사용자의 보관 DB 줄 수·복호화 값이 원래 값과 같음 | 보관 줄 없음 또는 값 다름 | K2 |
| T17a~c | retainUser를 ①·②·③ 뒤에서 각각 멈춘 뒤(단위 시험에서 단계 함수를 바꿔 끼움) 정기 작업 1회 | stage가 RETAINED가 아니거나, 보관 줄이 중복·누락되거나, 보관값이 빈 값 | K3 |
| T17d | 같은 사용자에 retainUser 두 개를 동시에 시작 | 둘 다 ②에 들어감(처리 중 표시 무시) | K3 |
| T17e | 같은 주문의 구매자 탈퇴 → 판매자 탈퇴 | 첫 보관값(cancel_reason 등)이 바뀌거나 사라짐 | K3 |
| T17f | 원본 사진 파일을 미리 지운 뒤 탈퇴 | stage가 RETAINED로 가지 않음 | K3 |
| T18 | 트리거마다 쌍으로: ACTIVE 사용자 id로 INSERT/UPDATE 성공, 탈퇴자 id로 같은 쓰기 실패(17개 표 + 규칙 6개 표) | ACTIVE 쓰기가 막힘 또는 탈퇴자 쓰기가 1건이라도 성공 | K4 |
| T18b | stage=RETAINED 뒤 상품 제목을 원래 값으로 UPDATE | 성공함 | K4 |
| T19 | 탈퇴자 SOLD 상품 내용 비우기, REMOVED 유지 갱신 | 트리거가 막음 | K4 |
| T20 | 탈퇴 뒤 users 이름 되돌리기 UPDATE | 성공함 | K4 |
| T21 | 탈퇴 판매자 상품 사진 주소 | 200 | K5 |
| T21b | 같은 브라우저에서 사진을 본 뒤 탈퇴 → 새로 고침(PC·모바일 스크린샷), 탈퇴 전 두 번째 요청은 304 | 사진이 보임, 탈퇴 전 304가 아님, 탈퇴 뒤 같은 ETag 요청에 304가 나감 | K5 |
| T30c | 잠금 파일을 남긴 채 서버 재시작 | 10분 뒤에도 보관 이동·파기가 멈춰 있음 | K3 |
| T31c | staging→원래 폴더 rename 직전(INSERT 커밋 뒤) 서버 종료 → 재시작·정기 작업 | 사진이 지워지거나 주소가 404 | K4 |
| T22 | 상대방 주문 화면·상품 목록(PC 1280·모바일 375 스크린샷) | 화면 오류·깨진 이미지 아이콘 | K5 |
| T22b | 판매자 탈퇴 뒤 스냅숏의 바꾼 칸 밖 항목(가격·체험 조건·구성품·모델·카테고리) | 전후 값이 다름 | K5 |
| T23 | 시계를 각 기한 −1일·+1일로(nowMs 인자) 파기. 분쟁 있는 주문 사진은 3년+1일에 남고 5년+1일에 지워짐 | 기한 전에 지워지거나 기한 뒤 남음, 긴 쪽 규칙 어김 | K6 |
| T24 | 파기 뒤 retained.db·dev.db·-wal 파일 바이트에서 시험 표식 문자열 검색(백업 폴더는 30일 정리 대상이라 T25로 따로 본다) | 표식 발견 | K6 |
| T25 | backup_prune.sh를 가짜 폴더(31일 5개·29일 1개)로 실행 | 정리 뒤 29일 1개 + 새 백업 1개 말고 다른 것이 남거나, 새 백업 검증 실패에도 지움 | K7 |
| T26 | 주문 없는 방 채팅·후기 연락처·FEEDBACK 메시지·SYSTEM 채팅 속 메모·취소 사유 | 원래 글 남음 | K1 |
| T27 | WITHDRAW_ENABLED를 끈 상태에서 이미 탈퇴한 사용자의 RETAIN_PENDING 처리와 파기 | 꺼졌다고 처리·파기가 멈춤, 또는 새 탈퇴 POST가 503이 아님 | K8 |
| T28 | 탈퇴자를 상대로 하는 정상 동작: 상대가 후기 쓰기, reviewReminders 실행, 탈퇴자 상품이 있던 목록 보기 | 오류(500)·화면 깨짐 | K4·K5 |
| T29 | 읽기 연결을 열어 둔 채 보관 이동 → WIPE_PENDING, 닫은 뒤 정기 작업 → RETAINED | busy=1인데 RETAINED가 됨 | K6 |
| T30 | 보관 백업 세트로 새 폴더에 복원 → 목록 sha256 일치, 기한 안 된 보관값 복호화 | 복원 실패·복호화 실패 | K9 |
| T31 | 상품 사진·거래 사진 업로드 도중 탈퇴(업로드 함수 안에서 탈퇴 실행) | 업로드 폴더에 DB 줄 없는 파일 1개 이상 | K4 |
| T31b | staging 저장 직후 서버 종료 → 다시 켜고 시계를 24시간 뒤로 정기 작업 | staging·uploads·order-uploads에 고아 1개 이상 | K4 |
| T23b·c | 같은 달 1일·31일 만료 두 기록(1일 파기 뒤 31일 기록 복호화), 같은 key_id 동시 생성 | 31일 기록 복호화 실패, 두 키가 다름 | K6 |
| T17g | 늦게 끝난 옛 lease_owner의 UPDATE | 1줄 이상 바뀜 | K3 |
| T30b | 보관 이동 중 백업 시작, 새 세트 생성 실패, 옛 세트 삭제 실패 | 이동과 백업이 겹침, 실패에 옛 세트를 지움, PURGE_BACKUP_PENDING 없이 옛 세트가 남음 | K9 |
| T32 | 탈퇴자가 쓴 모든 칸에 고유 표식을 넣고 탈퇴·보관 이동 → 운영 DB 모든 표·모든 TEXT 칸 검색 | 표식 1건 이상 | K1 |
| T33 | 사전 점검: RETAIN_SECRET 없음·31자·보관 폴더 쓰기 불가 각각 | 탈퇴가 진행됨(503 아님) 또는 DB 변경 1건 이상 | K10 |
| T34 | 되돌리기 검사: withdrawals 1건 있을 때 전체 되돌리기 | 검사가 통과시킴 | K11 |
- 원복: 시험 전에 sim.db·retained.db·사진 폴더를 백업하고, 끝나면 복원해 차이 0을 확인한다(어제와 같은 방식).

## 10. 합격 기준
| 번호 | 기준 |
|---|---|
| K1 | 3절 표의 운영 DB 칸이 탈퇴 뒤 비거나 바뀜 |
| K2 | 같은 값이 보관 DB에만 암호문으로 있음 |
| K3 | 어느 단계에서 멈춰도 재시도 뒤 한 번만 적용됨 |
| K4 | 탈퇴 뒤 탈퇴자 이름의 새 줄 0, 내용 비우기는 통과 |
| K5 | 사진 404, 상대 화면 정상(PC·모바일 스크린샷) |
| K6 | 기한 지난 보관분이 파일 바이트에서도 사라짐 |
| K7 | 30일 정리가 정확히 동작 |
| K8 | 스위치는 새 탈퇴만 막고, 이미 탈퇴한 사용자의 보관 이동·파기는 계속됨(법정 파기 기한 지킴) |
| K9 | 보관 백업 세트로 복구할 수 있음 |
| K10 | 보관 준비가 안 되면 탈퇴가 시작되지 않음 |
| K11 | 보관 기록이 있으면 전체 되돌리기가 막힘 |

## 11. 외부 서비스 근거표
| 항목 | 공식 문서 | 확인한 문장 | 확인일 | 상태 |
|---|---|---|---|---|
| 보관 기간 | https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=63460 | 제6조 제1항: 표시·광고 6개월, 계약 또는 청약철회 5년, 대금결제 및 재화등의 공급 5년, 소비자의 불만 또는 분쟁처리 3년 | 2026-10-28 | 확인 |
| 통신판매중개자 범위 | https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lspttninfSeq=63460 | 통신판매중개자는 자신의 정보처리시스템을 통하여 처리한 기록의 범위에서 거래기록을 보존 | 2026-10-28 | 확인 |
| 써보니가 통신판매중개자에 해당하는지 | 없음(법률 검토 필요) | 사용자 결정 L1로 적용 전제. 운영 켜기 전 법률 검토로 확정 | 2026-10-28 | 미확인 — 개발 범위 제외(운영 켜기 조건으로만 둠) |
| SQLite secure_delete | https://www.sqlite.org/pragma.html#pragma_secure_delete | "When secure_delete is on, SQLite overwrites deleted content with zeros." 제한은 가상 표뿐(써보니는 가상 표를 쓰지 않음) | 2026-10-28 | 확인 |
| SQLite wal_checkpoint(TRUNCATE) | https://www.sqlite.org/pragma.html#pragma_wal_checkpoint | "the WAL file is truncated to zero bytes upon successful completion" — 성공해야만 0바이트(Codex 1차 차단 2) | 2026-10-28 | 확인 |
| SQLite journal_mode=DELETE 잔재 | https://www.sqlite.org/pragma.html#pragma_journal_mode | journal 파일을 지울 뿐 덮어쓰기는 보장하지 않음(Codex 1차 차단 3) — 그래서 보관값은 만료일별 키로 암호화하고 파기는 키 삭제로 한다 | 2026-10-28 | 확인 |

## 12. 값 출처표
| 값 | 출처 |
|---|---|
| 6개월·5년·3년 | 공식 문서(시행령 제6조 제1항) |
| 백업 30일 | 사용자 지시(2026-10-28 "권장안") |
| 고아 파일 정리 24시간 | 제안(승인 필요) |
| 잠금 이어받기 10분 | 제안(승인 필요) |
| 처리 중 표시 5분 | 제안(승인 필요) |
| 만료일별 소금 32바이트 | 제안(승인 필요) |
| 운영 백업 12개 | 실측(2026-10-28 ssh 읽기 전용) |
| 재시도 주기 10분 | 실측(jobs.ts:105) |
| 키 형식 AES-256-GCM | 실측(crypto-box.ts:14) |

## 13. 권한 범위
| 누가 | 무엇을 | 범위 |
|---|---|---|
| Claude | 코드·시뮬레이션 서버·사본 DB | 바로 |
| Claude | 운영 반영·RETAIN_SECRET 등록·첫 백업 삭제·운영 켜기 | 각각 사용자 승인(1절) |
| 운영자 | 보관 DB 열람 | 없음(읽는 화면 없음) |

## 14. 실패·원복표 / 운영 요건·막힘 대응표
| 막힘 | 자동 대처 | 중단·알림 | 사용자 행동 |
|---|---|---|---|
| RETAIN_SECRET 없음·보관 폴더 쓰기 불가 | 탈퇴 POST가 사전 점검에서 503(아무것도 안 바꿈). 이미 RETAIN_PENDING인 사용자는 정기 작업이 매번 재시도 | 서버 로그 `[withdraw] 보관 준비 안 됨` | 비밀값 등록 또는 디스크 확인 |
| WAL 정리 실패(busy=1) | WIPE_PENDING에 두고 10분마다 재시도 | 로그 | 없음(계속 실패하면 서버 재시작) |
| 보관 DB 디스크 오류 | 운영 DB는 건드리지 않음(④ 전에 멈춤) | 로그 | 디스크 확인 |
| RETAIN_PENDING 창(상대 화면에 원래 값) | 같은 요청에서 바로 이동, 실패 시 10분 안 재시도 | — | 없음 |
| 트리거가 정상 기능을 막음 | 해당 API 500 | 로그 USER_INACTIVE | 0019_down_triggers.sql 실행(승인). withdrawals·보관 DB·파기 작업은 그대로 유지 |
| 파일 unlink 실패 | 다음 실행 재시도 | 로그 | 없음 |
| 원본 사진 파일 없음 | `missing=1` 기록 후 진행 | 로그 | 없음 |
| 보관 이동 처리 중 서버 종료 | 처리 중 표시 5분 뒤 다른 실행이 이어받음 | 로그 | 없음 |
- 긴급 정지: `WITHDRAW_ENABLED`를 끄면 새 탈퇴가 멈춘다(K8). 이미 옮긴 데이터는 그대로 남고, 보관 이동·파기는 계속된다.

## 15. 선행 시험·범위 동결
- 선행 시험: 1단계 시험 서버 실행(어제 135/0)이 지금 코드의 출발점이다. 2단계는 실제 외부 데이터를 쓰지 않는다(법령 문장만 공식 확인).
- 범위 동결: 0절 "빼는 것"은 개발 중 넣지 않고 발견 목록에 적는다.

## 16. 롤백 소실 목록
| 롤백 | 사라지는 기록 | 남는 외부 상태 | 재등록 방어 |
|---|---|---|---|
| 0019_down_triggers 실행 | 트리거만(쓰기 장벽) | withdrawals·retained.db·보관 폴더·파기 일정 모두 남는다 | 다시 올리면 트리거만 다시 생긴다 |
| 0019_down_full 실행 | withdrawals 표 | 없음(ops/withdraw2_rollback.cjs가 withdrawals·보관 DB 줄·키 파일·보관 사진·PURGE_BACKUP_PENDING 모두 0일 때만 허용, 0000절 2) | 보관 기록이 있으면 실행 자체가 막힌다(T34) |
| 코드만 1단계로 되돌림 | 금지(파기가 멈춤) | — | 되돌리기 방법은 0019_down_triggers.sql만 안내한다 |
| 운영에서 탈퇴 실행 뒤 | 운영 DB에서 비운 값(보관 DB에만 있음) | 되돌릴 수 없음 | 그래서 운영 켜기는 별도 승인 |

## 17. 예상 지적
- 2절 RETAIN_PENDING 창 동안 노출: 받아들인 이유와 최대 10분 한도를 적었다.
- cancel_reason 작성자 구분 없음: 양쪽 탈퇴 모두 옮기는 쪽으로 정했다(과잉 보관 아님, 어차피 5년 대상).
- 트리거가 실제 쓰기 호출 전부를 덮는지: 쓰기 호출 목록 docs/review/survey/withdraw2_write_calls.txt(121줄, 2026-10-28 실측)의 표 이름이 5절 대상(17개 + 규칙 6개)이나 개인정보 없는 표(categories·product_models·carry_nonces·order_events·buyer/seller_profiles)에 모두 들어가는지 개발 첫 단계 시험 T18이 표 목록을 이 파일에서 읽어 확인한다.
- secure_delete가 과거 백업 파일까지 지우지는 않음: 백업은 30일 정리로만 사라진다(4절). 파기 뒤 최대 30일은 백업에 남는다.

## 확인하지 않은 것
- app/.env 실제 값(비밀 파일, 읽기 막힘).
- 당근 가져오기 시험 사진(scripts/import-daangn.cjs)이 사진 차단 뒤에도 보이는지 — listing_photos 줄로 저장하므로 영향 없을 것으로 보지만 T28 목록 화면에서 함께 확인한다.

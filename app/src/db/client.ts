import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// 운영 DB 파일 경로(탈퇴 2단계 WAL 크기 확인에 쓴다)
export const dbPath = process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./dev.db";
const sqlite = new Database(dbPath);
// param: s PRAGMA 문장. return: 결과. 다른 프로세스가 같은 파일을 막 열고 있으면(SQLITE_BUSY) 0.1초씩 최대 50번 다시 시도한다
function pragma(s: string): unknown {
  for (let i = 0; ; i++) {
    try { return sqlite.pragma(s); }
    catch (e) {
      if ((e as { code?: string }).code !== "SQLITE_BUSY" || i >= 50) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
}
// next build는 여러 작업이 동시에 이 파일을 불러와 빈 DB에 WAL 전환을 겹쳐 걸다 SQLITE_BUSY로 실패한다(2026-10-29 운영 빌드).
// 빌드 중에는 DB 설정을 건너뛴다(빌드는 화면 정보만 모으고 DB에 쓰지 않는다)
if (process.env.NEXT_PHASE !== "phase-production-build") {
  pragma("journal_mode = WAL");
  pragma("foreign_keys = ON");
  pragma("secure_delete = ON"); // 지운 내용을 0으로 덮어쓴다(탈퇴 2단계)
}

export const db = drizzle(sqlite, { schema });

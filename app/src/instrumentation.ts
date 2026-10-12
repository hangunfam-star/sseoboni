// 서버가 켜질 때 한 번: 정기 작업(알림 발송·기한 처리)을 건다. Node 런타임에서만.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startJobs } = await import("./lib/jobs");
  startJobs();
}

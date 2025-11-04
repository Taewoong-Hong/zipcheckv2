/**
 * 버전 식별 API
 *
 * 현재 서빙 중인 배포가 v1인지 v2인지 즉시 확인
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    app: 'zipcheck',
    version: 'v2',
    gitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    gitCommitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
    deploymentUrl: process.env.VERCEL_URL || null,
    projectProductionUrl: process.env.VERCEL_PROJECT_PRODUCTION_URL || null,
    env: process.env.NODE_ENV || null,
    builtAt: new Date().toISOString(),
    region: process.env.VERCEL_REGION || null,
  }, {
    headers: {
      'Cache-Control': 'no-store, must-revalidate',
      'X-Zipcheck-Version': 'v2',
    }
  });
}

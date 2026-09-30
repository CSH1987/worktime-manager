import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서버 저장소 이름을 빌드 때 고정한다. 시험용 임시 배포는
  // WORKTIME_BLOB_STORE=worktime-test 로 빌드해 운영 데이터와 분리.
  env: {
    WORKTIME_BLOB_STORE: process.env.WORKTIME_BLOB_STORE || "worktime",
  },
};

export default nextConfig;

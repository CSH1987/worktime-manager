import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    // 값이 없을 때도 빌드 시점 상수로 고정 → 운영 빌드에서 mock 분기·예시 데이터가 통째로 빠진다
    NEXT_PUBLIC_USE_MOCK: process.env.NEXT_PUBLIC_USE_MOCK ?? "",
  },
};

export default nextConfig;

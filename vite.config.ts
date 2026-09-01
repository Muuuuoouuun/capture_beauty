import { defineConfig } from "vitest/config";

export default defineConfig({
  // Electron 래퍼가 dist/index.html 을 file:// 로 로드하므로 상대 경로 필수
  base: "./",
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});

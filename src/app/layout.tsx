import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Capture Beauty — 예쁘게 캡쳐되는 앱",
  description: "필름카메라 감성 프레임과 타임스탬프로 사진을 예쁘게 완성하세요.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-cream text-ink min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}

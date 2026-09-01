import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Loopine Admin",
  description: "Loopine 피드 콘텐츠 운영 도구",
  robots: { index: false, follow: false },
  icons: {
    icon: [{ url: "/icons/loopine-logo.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}

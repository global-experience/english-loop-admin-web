import { notFound, redirect } from "next/navigation";
import { ADMIN_TABS, DEFAULT_TAB, isTab, TAB_LABELS } from "@/lib/tabs";

/** 알려진 탭만 라우트로 만든다. 그 밖의 경로는 404 다. */
export function generateStaticParams() {
  return ADMIN_TABS.filter((tab) => tab !== DEFAULT_TAB).map((tab) => ({ tab }));
}

export async function generateMetadata({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  return { title: isTab(tab) ? `${TAB_LABELS[tab]} · Loopine Admin` : "Loopine Admin" };
}

/**
 * 화면은 (dashboard)/layout.tsx 가 그린다. 이 페이지는 주소가 유효한지만 판정한다.
 * 레이아웃에 두는 이유는 그 파일의 주석에 있다.
 */
export default async function TabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  // 대시보드의 정식 주소는 `/` 하나로 유지한다.
  if (tab === DEFAULT_TAB) redirect("/");
  if (!isTab(tab)) notFound();
  return null;
}

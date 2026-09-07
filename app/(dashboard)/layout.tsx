"use client";

import { usePathname } from "next/navigation";
import { AdminDashboard } from "@/components/AdminDashboard";
import { DEFAULT_TAB, isTab } from "@/lib/tabs";

/**
 * 대시보드는 페이지가 아니라 이 레이아웃에 걸려 있다.
 *
 * 레이아웃은 자식 라우트 사이를 오가도 다시 마운트되지 않는다. 페이지에 두면
 * 탭을 옮길 때마다 컴포넌트가 새로 만들어져 사이드바 접힘·필터·검색어가 전부
 * 초기화된다(실제로 그렇게 만들었다가 사이드바가 매번 접히는 문제를 겪었다).
 * 여기에 두면 상태는 그냥 살아 있고, 활성 탭만 주소에서 다시 읽는다.
 *
 * 그래서 `children`(각 탭의 page.tsx)은 그리지 않는다. 그 페이지들은 주소가
 * 유효한지 판정하는 역할만 하고 화면을 갖지 않는다.
 */
export default function DashboardLayout() {
  const pathname = usePathname();
  const slug = pathname === "/" ? DEFAULT_TAB : pathname.replace(/^\/+/, "");
  return <AdminDashboard tab={isTab(slug) ? slug : DEFAULT_TAB} />;
}

/**
 * 어드민 탭의 단일 진실 공급원.
 *
 * 탭은 각자 URL 을 갖는다. 링크를 공유하거나 북마크할 수 있어야 하고, 뒤로
 * 가기가 동작해야 하고, 새 탭에서 열 수 있어야 한다 — 운영 도구에서는 전부
 * 실제로 필요한 동작이다.
 *
 * 목록과 라우트가 벌어지면 존재하지 않는 경로로 이동하거나(404), 만든 페이지가
 * 메뉴에 안 나온다. 그래서 라우트 파일도 메뉴도 이 배열만 보게 한다.
 */

export const ADMIN_TABS = [
  "overview",
  "users",
  "categories",
  "sources",
  "videos",
  "expressions",
  "jobs",
  "transcripts",
  "reports",
  "runs",
  "settings",
] as const;

export type Tab = (typeof ADMIN_TABS)[number];

/** 대시보드는 루트(`/`)다. `/overview` 는 여기로 리다이렉트한다. */
export const DEFAULT_TAB: Tab = "overview";

export const TAB_LABELS: Record<Tab, string> = {
  overview: "대시보드",
  users: "사용자 관리",
  categories: "카탈로그 카테고리",
  sources: "수집 소스",
  videos: "피드 검수",
  expressions: "표현/단어장 마스터",
  jobs: "자막 작업 & 워커",
  transcripts: "자막 캐시",
  reports: "코칭 리포트",
  runs: "수집 기록",
  settings: "런타임 설정",
};

export function tabHref(tab: Tab): string {
  return tab === DEFAULT_TAB ? "/" : `/${tab}`;
}

export function isTab(value: string): value is Tab {
  return (ADMIN_TABS as readonly string[]).includes(value);
}

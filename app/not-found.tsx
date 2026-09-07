import Link from "next/link";
import { ADMIN_TABS, DEFAULT_TAB, TAB_LABELS, tabHref } from "@/lib/tabs";

/** 없는 경로로 들어왔을 때. 기본 404 화면은 돌아갈 길이 없어서 막힌 것처럼 보인다. */
export default function NotFound() {
  return (
    <main className="login-page">
      <section className="login-intro">
        <img src="/icons/loopine-logo.svg" alt="Loopine" className="logo-mark" />
        <p className="eyebrow">LOOPINE OPERATIONS</p>
        <h1>없는 주소입니다.</h1>
        <p>주소를 잘못 입력했거나, 이름이 바뀐 화면일 수 있습니다.</p>
      </section>
      <nav className="login-card">
        <p className="eyebrow">이동할 화면</p>
        {ADMIN_TABS.map((tab) => (
          <Link key={tab} href={tabHref(tab)} className="text-button">
            {TAB_LABELS[tab]}
            {tab === DEFAULT_TAB ? " (기본)" : ""}
          </Link>
        ))}
      </nav>
    </main>
  );
}

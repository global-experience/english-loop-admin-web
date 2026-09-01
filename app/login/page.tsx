"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { apiFetch } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiFetch("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      window.location.href = "/";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "로그인하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-intro">
        <img src="/icons/loopine-logo.svg" alt="Loopine" className="logo-mark" />
        <p className="eyebrow">LOOPINE OPERATIONS</p>
        <h1>좋은 영어를<br />학습 피드로.</h1>
        <p>수집 소스부터 후보 검수, 일일 작업 상태까지 한곳에서 관리합니다.</p>
      </section>
      <form className="login-card" onSubmit={submit}>
        <LockKeyhole size={24} />
        <div><p className="eyebrow">ADMIN ONLY</p><h2>관리자 로그인</h2></div>
        <label>이메일<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
        <label>비밀번호<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button" disabled={busy}>{busy ? "확인 중…" : <>로그인 <ArrowRight size={18} /></>}</button>
        <p className="form-note">DB의 관리자 계정만 접근할 수 있습니다. <code>ADMIN_EMAILS</code>는 최초 관리자 생성용으로만 사용됩니다.</p>
      </form>
    </main>
  );
}

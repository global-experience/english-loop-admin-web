"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, BookMarked, Check, ChevronLeft, ChevronRight, CircleOff, Database, ExternalLink,
  Eye, History, LayoutDashboard, LoaderCircle, LogOut, PanelLeftClose, PanelLeftOpen, Pencil, Plus, RefreshCw, RotateCcw,
  Search, Settings2, ShieldCheck, Sparkles, Trash2, ToggleLeft, ToggleRight, UserCheck,
  Users, UserX, Video, X,
} from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import type {
  AdminMember, AdminRole, AdminUser, CoachingHistory, CollectionRun, Expression,
  ExpressionStage, FeedSource, FeedVideo, JobStatus, Overview, SourceType,
  UserApprovalStatus, UserSavedVideo, UserVocabulary, VideoStatus, WorkerHeartbeat, YouTubeJob,
} from "@/lib/types";

type Tab = "overview" | "users" | "sources" | "videos" | "expressions" | "jobs" | "runs";
type UserDetailTab = "profile" | "saved" | "vocabulary" | "coaching";
const PAGE_SIZE = 18;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID_RE = /UC[A-Za-z0-9_-]{22}/;
const CHANNEL_HANDLE_RE = /(?:youtube\.com\/)?@([A-Za-z0-9._-]{3,30})/;
const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const STAGES: ExpressionStage[] = ["NEW", "LISTENED", "UNDERSTOOD", "SHADOWED", "USED_WITH_HELP", "USED_SPONTANEOUSLY", "MASTERED"];

const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "대시보드", icon: LayoutDashboard },
  { id: "users", label: "사용자 관리", icon: Users },
  { id: "sources", label: "수집 소스", icon: Settings2 },
  { id: "videos", label: "피드 검수", icon: Video },
  { id: "expressions", label: "표현/단어장 마스터", icon: BookMarked },
  { id: "jobs", label: "자막 작업 & 워커", icon: Activity },
  { id: "runs", label: "수집 기록", icon: History },
];

function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusClass(value: string) {
  return `status-badge status-${value.toLowerCase().replaceAll("_", "-")}`;
}

function extractVideoId(value: string) {
  const trimmed = value.trim();
  const match = trimmed.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
  return match?.[1] || (VIDEO_ID_RE.test(trimmed) ? trimmed : "");
}

function extractChannelId(value: string) {
  return value.trim().match(CHANNEL_ID_RE)?.[0] || "";
}

function extractChannelHandle(value: string) {
  return value.trim().match(CHANNEL_HANDLE_RE)?.[1] || "";
}

function validateSourceInput(sourceType: SourceType, value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { status: "ERROR" as const, message: "검색 값을 입력하세요." };
  if (sourceType === "VIDEO") {
    return extractVideoId(trimmed)
      ? { status: "OK" as const, message: "YouTube 영상으로 인식됐습니다." }
      : { status: "ERROR" as const, message: "YouTube 영상 URL 또는 11자리 영상 ID를 입력하세요." };
  }
  if (sourceType === "CHANNEL") {
    if (extractChannelId(trimmed)) return { status: "OK" as const, message: "YouTube 채널 ID로 인식됐습니다." };
    if (extractChannelHandle(trimmed)) return { status: "OK" as const, message: "YouTube 핸들로 인식됐습니다. 저장 시 채널 ID로 확인합니다." };
    if (extractVideoId(trimmed)) return { status: "ERROR" as const, message: "영상 URL은 직접 영상 유형으로 추가하세요." };
    return { status: "WARNING" as const, message: "채널 ID가 아니므로 일반 검색어로 수집됩니다." };
  }
  return { status: "OK" as const, message: "검색어로 수집됩니다." };
}

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [runs, setRuns] = useState<CollectionRun[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [expressions, setExpressions] = useState<Expression[]>([]);
  const [jobs, setJobs] = useState<YouTubeJob[]>([]);
  const [workers, setWorkers] = useState<WorkerHeartbeat[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<VideoStatus | "">("CANDIDATE");
  const [search, setSearch] = useState("");
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userStatus, setUserStatus] = useState<UserApprovalStatus | "">("PENDING");
  const [userSearch, setUserSearch] = useState("");
  const [expressionTotal, setExpressionTotal] = useState(0);
  const [expressionPage, setExpressionPage] = useState(1);
  const [expressionSearch, setExpressionSearch] = useState("");
  const [expressionLevel, setExpressionLevel] = useState("");
  const [jobTotal, setJobTotal] = useState(0);
  const [jobPage, setJobPage] = useState(1);
  const [jobStatus, setJobStatus] = useState<JobStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const handleError = useCallback((caught: unknown) => {
    if (caught instanceof ApiError && caught.status === 401) {
      window.location.href = "/login";
      return;
    }
    setError(caught instanceof Error ? caught.message : "요청을 처리하지 못했습니다.");
  }, []);

  const loadOverview = useCallback(async () => setOverview(await apiFetch<Overview>("/api/admin/overview")), []);
  const loadSources = useCallback(async () => setSources((await apiFetch<{ items: FeedSource[] }>("/api/admin/feed/sources")).items), []);
  const loadRuns = useCallback(async () => setRuns((await apiFetch<{ items: CollectionRun[] }>("/api/admin/feed/collection-runs")).items), []);

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams({ page: String(userPage), page_size: String(PAGE_SIZE) });
    if (userStatus) params.set("approval_status", userStatus);
    if (userSearch.trim()) params.set("search", userSearch.trim());
    const [userData, memberData] = await Promise.all([
      apiFetch<{ items: AdminUser[]; total: number }>(`/api/admin/users?${params}`),
      apiFetch<{ items: AdminMember[] }>("/api/admin/members"),
    ]);
    setUsers(userData.items);
    setUserTotal(userData.total);
    setMembers(memberData.items);
  }, [userPage, userSearch, userStatus]);

  const loadVideos = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (status) params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    const data = await apiFetch<{ items: FeedVideo[]; total: number }>(`/api/admin/feed/videos?${params}`);
    setVideos(data.items);
    setTotal(data.total);
  }, [page, search, status]);

  const loadExpressions = useCallback(async () => {
    const params = new URLSearchParams({ page: String(expressionPage), page_size: String(PAGE_SIZE) });
    if (expressionSearch.trim()) params.set("search", expressionSearch.trim());
    if (expressionLevel) params.set("level", expressionLevel);
    const data = await apiFetch<{ items: Expression[]; total: number }>(`/api/admin/expressions?${params}`);
    setExpressions(data.items);
    setExpressionTotal(data.total);
  }, [expressionPage, expressionSearch, expressionLevel]);

  const loadJobs = useCallback(async () => {
    const params = new URLSearchParams({ page: String(jobPage), page_size: "30" });
    if (jobStatus) params.set("status", jobStatus);
    const [jobData, workerData] = await Promise.all([
      apiFetch<{ items: YouTubeJob[]; total: number }>(`/api/admin/jobs?${params}`),
      apiFetch<{ items: WorkerHeartbeat[] }>("/api/admin/workers"),
    ]);
    setJobs(jobData.items);
    setJobTotal(jobData.total);
    setWorkers(workerData.items);
  }, [jobPage, jobStatus]);

  const activeLoader = useMemo(() => ({
    overview: loadOverview,
    users: loadUsers,
    sources: loadSources,
    videos: loadVideos,
    expressions: loadExpressions,
    jobs: loadJobs,
    runs: loadRuns,
  })[tab], [tab, loadOverview, loadUsers, loadSources, loadVideos, loadExpressions, loadJobs, loadRuns]);

  useEffect(() => {
    setLoading(true);
    setError("");
    activeLoader().catch(handleError).finally(() => setLoading(false));
  }, [activeLoader, handleError]);

  async function collect() {
    setCollecting(true);
    setError("");
    setNotice("");
    try {
      const run = await apiFetch<CollectionRun>("/api/admin/feed/collect", { method: "POST", body: JSON.stringify({ limit: 100 }) });
      setNotice(`수집 완료: 신규 ${run.inserted_count}개, 갱신 ${run.updated_count}개`);
      await Promise.all([loadOverview(), loadRuns()]);
    } catch (caught) {
      handleError(caught);
    } finally {
      setCollecting(false);
    }
  }

  async function logout() {
    try { await apiFetch("/api/auth/logout", { method: "POST" }); } finally { window.location.href = "/login"; }
  }

  return (
    <div className={`admin-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="brand" onClick={() => sidebarCollapsed && setSidebarCollapsed(false)} style={{ cursor: sidebarCollapsed ? "pointer" : "default" }} title={sidebarCollapsed ? "메뉴 펼치기" : ""}>
          <img src="/icons/loopine-logo.svg" alt="" aria-hidden="true" className="logo-mark" />
          <div className="brand-text">
            <strong>Loopine</strong>
            <span>Content operations</span>
          </div>
          <button
            className="sidebar-toggle-btn"
            onClick={(event) => { event.stopPropagation(); setSidebarCollapsed((prev) => !prev); }}
            title={sidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        <nav>
          {navItems.map((item) => (
            <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)} title={item.label}>
              <item.icon size={19} />
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <button className="logout-button" onClick={logout} title="로그아웃">
          <LogOut size={18} />
          <span className="nav-label">로그아웃</span>
        </button>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="topbar-title-group">
            <button
              className="topbar-menu-toggle"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              title={sidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>
            <div>
              <p className="eyebrow">CONTENT OPERATIONS</p>
              <h1>{navItems.find((item) => item.id === tab)?.label}</h1>
            </div>
          </div>
          <button className="primary-button collect-button" onClick={collect} disabled={collecting}>
            {collecting ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
            {collecting ? "수집 중…" : "후보 100개 수집"}
          </button>
        </header>
        {error && <div className="alert error"><CircleOff size={18} />{error}<button onClick={() => setError("")}><X size={16} /></button></div>}
        {notice && <div className="alert success"><Check size={18} />{notice}<button onClick={() => setNotice("")}><X size={16} /></button></div>}
        {loading ? <div className="loading-state"><LoaderCircle className="spin" /><p>데이터를 불러오는 중입니다.</p></div> : (
          <>
            {tab === "overview" && overview && <OverviewPanel data={overview} onNavigate={setTab} />}
            {tab === "users" && <UsersPanel users={users} members={members} status={userStatus} setStatus={(next) => { setUserPage(1); setUserStatus(next); }} search={userSearch} setSearch={(next) => { setUserPage(1); setUserSearch(next); }} reload={loadUsers} onError={handleError} total={userTotal} page={userPage} setPage={setUserPage} />}
            {tab === "sources" && <SourcesPanel sources={sources} reload={loadSources} onError={handleError} onNotice={setNotice} />}
            {tab === "videos" && <VideosPanel videos={videos} status={status} setStatus={(next) => { setPage(1); setStatus(next); }} search={search} setSearch={(next) => { setPage(1); setSearch(next); }} reload={loadVideos} onError={handleError} total={total} page={page} setPage={setPage} onNotice={setNotice} />}
            {tab === "expressions" && <ExpressionsPanel expressions={expressions} total={expressionTotal} page={expressionPage} setPage={setExpressionPage} search={expressionSearch} setSearch={(next) => { setExpressionPage(1); setExpressionSearch(next); }} level={expressionLevel} setLevel={(next) => { setExpressionPage(1); setExpressionLevel(next); }} reload={loadExpressions} onError={handleError} />}
            {tab === "jobs" && <JobsPanel jobs={jobs} workers={workers} total={jobTotal} page={jobPage} setPage={setJobPage} status={jobStatus} setStatus={(next) => { setJobPage(1); setJobStatus(next); }} reload={loadJobs} onError={handleError} />}
            {tab === "runs" && <RunsPanel runs={runs} />}
          </>
        )}
      </main>
    </div>
  );
}

function OverviewPanel({ data, onNavigate }: { data: Overview; onNavigate: (tab: Tab) => void }) {
  const metrics = [
    { label: "가입 승인 대기", value: data.users?.pending || 0, detail: "승인이 필요한 계정", icon: Users, tab: "users" as Tab },
    { label: "활성 수집 소스", value: data.active_sources, detail: `전체 ${data.sources}개`, icon: Database, tab: "sources" as Tab },
    { label: "검수 대기", value: data.videos.CANDIDATE || 0, detail: "확인이 필요한 영상", icon: Activity, tab: "videos" as Tab },
    { label: "승인 영상", value: data.videos.APPROVED || 0, detail: "피드 노출 가능", icon: Check, tab: "videos" as Tab },
  ];
  return <section className="panel-stack"><div className="metric-grid">{metrics.map((metric) => <button className="metric-card" key={metric.label} onClick={() => onNavigate(metric.tab)}><span className="metric-icon"><metric.icon size={20} /></span><span>{metric.label}</span><strong>{metric.value.toLocaleString()}</strong><small>{metric.detail}</small></button>)}</div><article className="panel"><div className="panel-heading"><div><p className="eyebrow">LAST COLLECTION</p><h2>최근 수집 상태</h2></div><button className="text-button" onClick={() => onNavigate("runs")}>전체 기록 <ChevronRight size={16} /></button></div>{data.last_run ? <RunRow run={data.last_run} /> : <EmptyState title="아직 수집 기록이 없습니다" description="수집 소스를 준비한 뒤 후보 영상 수집을 실행하세요." />}</article></section>;
}

function UsersPanel(props: { users: AdminUser[]; members: AdminMember[]; status: UserApprovalStatus | ""; setStatus: (status: UserApprovalStatus | "") => void; search: string; setSearch: (value: string) => void; reload: () => Promise<void>; onError: (error: unknown) => void; total: number; page: number; setPage: (page: number) => void }) {
  const { users, members, status, setStatus, search, setSearch, reload, onError, total, page, setPage } = props;
  const [busy, setBusy] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminRole, setAdminRole] = useState<AdminRole>("ADMIN");
  const [detailUserId, setDetailUserId] = useState("");
  async function approve(user: AdminUser) {
    setBusy(user.id);
    try { await apiFetch(`/api/admin/users/${user.id}/approval`, { method: "PATCH", body: JSON.stringify({ approval_status: "APPROVED" }) }); await reload(); } catch (error) { onError(error); } finally { setBusy(""); }
  }
  async function reject(user: AdminUser) {
    setBusy(user.id);
    try { await apiFetch(`/api/admin/users/${user.id}/approval`, { method: "PATCH", body: JSON.stringify({ approval_status: "REJECTED", note: "관리자 거절" }) }); await reload(); } catch (error) { onError(error); } finally { setBusy(""); }
  }
  async function addAdmin(event: FormEvent) {
    event.preventDefault();
    setBusy("add-admin");
    try {
      await apiFetch("/api/admin/members", { method: "POST", body: JSON.stringify({ email: adminEmail, role: adminRole }) });
      setAdminEmail("");
      await reload();
    } catch (error) { onError(error); } finally { setBusy(""); }
  }
  async function removeAdmin(member: AdminMember) {
    if (!window.confirm(`${member.email} 관리자를 제거할까요?`)) return;
    setBusy(member.user_id);
    try { await apiFetch(`/api/admin/members/${member.user_id}`, { method: "DELETE" }); await reload(); } catch (error) { onError(error); } finally { setBusy(""); }
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <section className="panel-stack"><article className="panel"><div className="panel-heading"><div><p className="eyebrow">ACCOUNT APPROVAL</p><h2>회원 가입 승인</h2></div></div><div className="filters"><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이메일 또는 이름 검색" /></div><select value={status} onChange={(event) => setStatus(event.target.value as UserApprovalStatus | "")}><option value="">모든 상태</option><option value="PENDING">승인 대기</option><option value="APPROVED">승인됨</option><option value="REJECTED">거절됨</option></select><span className="result-count">{total.toLocaleString()}명</span></div>{users.length ? <div className="user-list">{users.map((user) => <article className="user-row clickable" key={user.id} onClick={() => setDetailUserId(user.id)}><span className={`user-status status-${user.approval_status.toLowerCase()}`}>{user.approval_status}</span><div><strong>{user.display_name}</strong><span>{user.email}</span><small>{user.english_level} · {user.goals.join(", ") || "목표 없음"}{user.is_admin ? ` · ${user.admin_role} 관리자` : ""}</small></div><span className="joined-at">{dateLabel(user.created_at)}</span><div className="user-actions" onClick={(event) => event.stopPropagation()}>{user.approval_status !== "APPROVED" && <button className="approve-button" onClick={() => approve(user)} disabled={busy === user.id}><UserCheck size={17} /> 승인</button>}{user.approval_status !== "REJECTED" && <button className="reject-button" onClick={() => reject(user)} disabled={busy === user.id}><UserX size={17} /> 거절</button>}</div></article>)}</div> : <EmptyState title="조건에 맞는 사용자가 없습니다" description="필터를 바꾸거나 새 가입 요청을 기다려 주세요." />}<Pagination page={page} pages={pages} setPage={setPage} /></article><article className="panel"><div className="panel-heading"><div><p className="eyebrow">ADMIN MEMBERS</p><h2>관리자 계정</h2></div></div><form className="admin-member-form" onSubmit={addAdmin}><label>관리자 이메일<input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="승인된 사용자 이메일" required /></label><label>권한<select value={adminRole} onChange={(event) => setAdminRole(event.target.value as AdminRole)}><option value="ADMIN">ADMIN</option><option value="OWNER">OWNER</option></select></label><button className="primary-button" disabled={busy === "add-admin"}><ShieldCheck size={17} /> 추가</button></form>{members.length ? <div className="member-list">{members.map((member) => <article className="member-row" key={member.id}><span className="member-icon" style={{ display: "flex" }}><span style={{ display: 'flex', margin: "auto" }}><ShieldCheck size={18} /></span></span><div><strong>{member.display_name}</strong><span>{member.email}</span></div><span className="type-badge type-channel">{member.role}</span><button className="reject-button" onClick={() => removeAdmin(member)} disabled={busy === member.user_id}><X size={17} /> 제거</button></article>)}</div> : <EmptyState title="등록된 관리자가 없습니다" description="최초 관리자는 부트스트랩 계정으로 접속하면 생성됩니다." />}</article>{detailUserId && <UserDetailDrawer userId={detailUserId} onClose={() => setDetailUserId("")} onSaved={reload} onError={onError} />}</section>;
}

function UserDetailDrawer({ userId, onClose, onSaved, onError }: { userId: string; onClose: () => void; onSaved: () => Promise<void>; onError: (error: unknown) => void }) {
  const [tab, setTab] = useState<UserDetailTab>("profile");
  const [user, setUser] = useState<AdminUser | null>(null);
  const [saved, setSaved] = useState<UserSavedVideo[]>([]);
  const [vocab, setVocab] = useState<UserVocabulary[]>([]);
  const [coaching, setCoaching] = useState<CoachingHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [detail, savedData, vocabData, coachingData] = await Promise.all([
        apiFetch<AdminUser>(`/api/admin/users/${userId}`),
        apiFetch<{ items: UserSavedVideo[] }>(`/api/admin/users/${userId}/saved-videos?page_size=50`),
        apiFetch<{ items: UserVocabulary[] }>(`/api/admin/users/${userId}/vocabulary?page_size=50`),
        apiFetch<{ items: CoachingHistory[] }>(`/api/admin/users/${userId}/coaching-history`),
      ]);
      setUser(detail); setSaved(savedData.items); setVocab(vocabData.items); setCoaching(coachingData.items);
    } catch (error) { onError(error); } finally { setLoading(false); }
  }, [userId, onError]);
  useEffect(() => { void load(); }, [load]);
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy("profile");
    try {
      const updated = await apiFetch<AdminUser>(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({
          display_name: String(form.get("display_name") || ""),
          english_level: String(form.get("english_level") || "B1"),
          daily_minutes: Number(form.get("daily_minutes") || 120),
          custom_gpt_url: String(form.get("custom_gpt_url") || "") || null,
          is_active: form.get("is_active") === "on",
        }),
      });
      setUser(updated);
      await onSaved();
    } catch (error) { onError(error); } finally { setBusy(""); }
  }
  async function deleteSaved(item: UserSavedVideo) {
    if (!window.confirm("이 사용자의 찜한 영상을 삭제할까요?")) return;
    setBusy(item.id);
    try { await apiFetch(`/api/admin/users/${userId}/saved-videos/${item.id}`, { method: "DELETE" }); await load(); } catch (error) { onError(error); } finally { setBusy(""); }
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><aside className="drawer" onMouseDown={(event) => event.stopPropagation()}><header className="drawer-header">{user ? <><div className="drawer-avatar">{user.display_name.slice(0, 1).toUpperCase()}</div><div><p className="eyebrow">USER DETAIL</p><h2>{user.display_name}</h2><span>{user.email}</span></div><span className={`user-status status-${user.approval_status.toLowerCase()}`}>{user.approval_status}</span></> : <LoaderCircle className="spin" />}<button className="icon-button" onClick={onClose}><X size={18} /></button></header>{loading || !user ? <div className="loading-state"><LoaderCircle className="spin" /></div> : <><nav className="sub-tabs"><button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}>계정 프로필</button><button className={tab === "saved" ? "active" : ""} onClick={() => setTab("saved")}>찜한 피드 {saved.length}</button><button className={tab === "vocabulary" ? "active" : ""} onClick={() => setTab("vocabulary")}>개인 단어장 {vocab.length}</button><button className={tab === "coaching" ? "active" : ""} onClick={() => setTab("coaching")}>AI 코칭 리포트</button></nav>{tab === "profile" && <form className="drawer-form" onSubmit={saveProfile}><label>표시 이름<input name="display_name" defaultValue={user.display_name} required /></label><label>영어 수준<select name="english_level" defaultValue={user.english_level}>{LEVELS.map((level) => <option key={level}>{level}</option>)}</select></label><label>하루 학습 시간<input name="daily_minutes" type="number" min={30} max={240} defaultValue={user.daily_minutes} /></label><label>Custom GPT URL<input name="custom_gpt_url" type="url" defaultValue={user.custom_gpt_url || ""} /></label><label className="check-label"><input name="is_active" type="checkbox" defaultChecked={user.is_active} /> 활성 계정</label><div className="stat-row"><span>찜한 피드 <b>{user.saved_feeds_count || 0}</b></span><span>단어장 <b>{user.saved_vocabulary_count || 0}</b></span><span>코칭 <b>{user.coaching_sessions_count || 0}</b></span></div><button className="primary-button" disabled={busy === "profile"}><Check size={17} /> 저장</button></form>}{tab === "saved" && <div className="compact-table">{saved.map((item) => <article key={item.id}><img src={item.video.thumbnail_url} alt="" /><div><strong>{item.video.title}</strong><span>{item.video.channel_title} · {dateLabel(item.created_at)}</span></div><span className={statusClass(item.status)}>{item.status}</span><button className="icon-danger" onClick={() => deleteSaved(item)} disabled={busy === item.id}><Trash2 size={16} /></button></article>)}{!saved.length && <EmptyState title="찜한 영상이 없습니다" description="사용자가 피드에서 저장하면 여기에 표시됩니다." />}</div>}{tab === "vocabulary" && <div className="compact-table vocabulary-table">{vocab.map((item) => <article key={item.id}><div><strong>{item.expression.canonical_text}</strong><span>{item.expression.korean_meaning}</span><small>복습 {dateLabel(item.next_review_at)} · 듣기 {item.listened_count} · 쉐도잉 {item.shadowed_count}</small></div><span className={statusClass(item.current_stage)}>{item.current_stage}</span></article>)}{!vocab.length && <EmptyState title="저장된 표현이 없습니다" description="선택 구절 저장 후 학습하면 개인 단어장에 쌓입니다." />}</div>}{tab === "coaching" && <div className="coach-list">{coaching.map((session) => <article key={session.id}><span className={statusClass(session.status)}>{session.status}</span><div><strong>{session.study_date} · {session.provider}</strong><p>{session.report?.summary_ko || "아직 리포트가 없습니다."}</p><small>{session.report?.next_focus?.join(", ") || "다음 포커스 없음"}</small></div></article>)}{!coaching.length && <EmptyState title="코칭 기록이 없습니다" description="Custom GPT 세션 저장 후 리포트가 표시됩니다." />}</div>}</>}</aside></div>;
}

function SourcesPanel({ sources, reload, onError, onNotice }: { sources: FeedSource[]; reload: () => Promise<void>; onError: (error: unknown) => void; onNotice: (message: string) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeedSource | null>(null);
  const [busy, setBusy] = useState("");
  async function seedDefaults() {
    setBusy("defaults");
    try { await apiFetch("/api/admin/feed/sources/defaults", { method: "POST" }); await reload(); } catch (error) { onError(error); } finally { setBusy(""); }
  }
  async function toggle(source: FeedSource) {
    setBusy(source.id);
    try { await apiFetch(`/api/admin/feed/sources/${source.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !source.enabled }) }); await reload(); } catch (error) { onError(error); } finally { setBusy(""); }
  }
  async function collectSource(source: FeedSource) {
    setBusy(`collect:${source.id}`);
    try {
      const run = await apiFetch<CollectionRun>(`/api/admin/feed/sources/${source.id}/collect`, { method: "POST", body: JSON.stringify({ limit: 100 }) });
      onNotice(`${source.label} 수집 완료: 신규 ${run.inserted_count}개, 갱신 ${run.updated_count}개`);
    } catch (error) { onError(error); } finally { setBusy(""); }
  }
  async function remove(source: FeedSource) {
    if (!window.confirm(`${source.label} 수집 소스를 삭제할까요?`)) return;
    setBusy(source.id);
    try { await apiFetch(`/api/admin/feed/sources/${source.id}`, { method: "DELETE" }); await reload(); } catch (error) { onError(error); } finally { setBusy(""); }
  }
  return <section className="panel-stack"><article className="panel"><div className="panel-heading"><div><p className="eyebrow">DISCOVERY INPUTS</p><h2>검색어·채널·직접 영상</h2></div><div className="button-row"><button className="secondary-button" onClick={seedDefaults} disabled={busy === "defaults"}><RefreshCw size={16} /> 기본 소스 채우기</button><button className="primary-button" onClick={() => { setEditing(null); setShowForm(!showForm); }}><Plus size={17} /> 소스 추가</button></div></div>{showForm && <SourceForm onSaved={async () => { setShowForm(false); await reload(); }} onError={onError} />}{sources.length ? <div className="source-list">{sources.map((source) => <article className={source.enabled ? "source-row" : "source-row disabled"} key={source.id}><span className={`type-badge type-${source.source_type.toLowerCase()}`}>{source.source_type}</span><div><strong>{source.label}</strong><span>{source.value}</span>{source.validation && <small className={`source-validation validation-${source.validation.status.toLowerCase()}`}>{source.validation.message}</small>}</div><span className="priority">우선순위 {source.priority}</span><div className="row-actions"><button className="icon-button" onClick={() => collectSource(source)} disabled={busy === `collect:${source.id}`} aria-label="이 소스만 수집"><Sparkles size={17} /></button><button className="icon-button" onClick={() => setEditing(source)} aria-label="수정"><Pencil size={17} /></button><button className="icon-button" onClick={() => toggle(source)} disabled={busy === source.id} aria-label={source.enabled ? "비활성화" : "활성화"}>{source.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}</button><button className="icon-danger" onClick={() => remove(source)} disabled={busy === source.id} aria-label="삭제"><Trash2 size={17} /></button></div></article>)}</div> : <EmptyState title="수집 소스가 없습니다" description="기본 소스를 채우거나 직접 검색어와 채널을 추가하세요." />}</article>{editing && <SourceEditModal source={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); }} onError={onError} />}</section>;
}

function SourceForm({ onSaved, onError }: { onSaved: () => Promise<void>; onError: (error: unknown) => void }) {
  const [sourceType, setSourceType] = useState<SourceType>("KEYWORD");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [priority, setPriority] = useState(60);
  const [busy, setBusy] = useState(false);
  const validation = validateSourceInput(sourceType, value);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (validation.status === "ERROR") return onError(new Error(validation.message));
    setBusy(true);
    try { await apiFetch("/api/admin/feed/sources", { method: "POST", body: JSON.stringify({ source_type: sourceType, label, value, priority }) }); await onSaved(); } catch (error) { onError(error); } finally { setBusy(false); }
  }
  return <form className="source-form" onSubmit={submit}><label>유형<select value={sourceType} onChange={(event) => setSourceType(event.target.value as SourceType)}><option value="KEYWORD">검색어</option><option value="CHANNEL">채널·주제</option><option value="VIDEO">직접 영상</option></select></label><label>표시 이름<input value={label} onChange={(event) => setLabel(event.target.value)} required maxLength={120} placeholder="예: 일상 영어 회화" /></label><label className="grow">검색 값<input value={value} onChange={(event) => setValue(event.target.value)} required maxLength={500} placeholder={sourceType === "KEYWORD" ? "Natural English conversation" : sourceType === "CHANNEL" ? "@handle, 채널 URL, UC... 채널 ID 또는 주제어" : "YouTube URL 또는 영상 ID"} />{value.trim() && <small className={`source-validation validation-${validation.status.toLowerCase()}`}>{validation.message}</small>}</label><label>우선순위<input type="number" value={priority} onChange={(event) => setPriority(Number(event.target.value))} min={0} max={100} /></label><button className="primary-button" disabled={busy || validation.status === "ERROR"}>{busy ? "추가 중…" : "추가"}</button></form>;
}

function SourceEditModal({ source, onClose, onSaved, onError }: { source: FeedSource; onClose: () => void; onSaved: () => Promise<void>; onError: (error: unknown) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch(`/api/admin/feed/sources/${source.id}`, { method: "PATCH", body: JSON.stringify({ label: form.get("label"), value: form.get("value"), priority: Number(form.get("priority")), enabled: form.get("enabled") === "on" }) });
      await onSaved();
    } catch (error) { onError(error); }
  }
  return <Modal title="수집 소스 수정" onClose={onClose}><form className="drawer-form" onSubmit={submit}><label>표시 이름<input name="label" defaultValue={source.label} required /></label><label>값<input name="value" defaultValue={source.value} required /></label><label>우선순위<input name="priority" type="number" min={0} max={100} defaultValue={source.priority} /></label><label className="check-label"><input name="enabled" type="checkbox" defaultChecked={source.enabled} /> 활성화</label><button className="primary-button"><Check size={17} /> 저장</button></form></Modal>;
}

function VideosPanel(props: { videos: FeedVideo[]; status: VideoStatus | ""; setStatus: (status: VideoStatus | "") => void; search: string; setSearch: (value: string) => void; reload: () => Promise<void>; onError: (error: unknown) => void; total: number; page: number; setPage: (page: number) => void; onNotice: (message: string) => void }) {
  const { videos, status, setStatus, search, setSearch, reload, onError, total, page, setPage, onNotice } = props;
  const [busy, setBusy] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState("");
  async function decide(video: FeedVideo, next: VideoStatus) {
    setBusy(video.id);
    try { await apiFetch(`/api/admin/feed/videos/${video.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) }); await reload(); } catch (error) { onError(error); } finally { setBusy(""); }
  }
  async function remove(video: FeedVideo) {
    if (!window.confirm(`"${video.title}" 영상을 삭제할까요?`)) return;
    setBusy(video.id);
    try { await apiFetch(`/api/admin/feed/videos/${video.id}`, { method: "DELETE" }); await reload(); } catch (error) { onError(error); } finally { setBusy(""); }
  }
  async function batch(next: VideoStatus | "DELETE") {
    if (!selected.length) return;
    if (next === "DELETE") {
      if (!window.confirm(`${selected.length}개 영상을 삭제할까요?`)) return;
      setBusy("batch");
      try { await Promise.all(selected.map((id) => apiFetch(`/api/admin/feed/videos/${id}`, { method: "DELETE" }))); setSelected([]); await reload(); onNotice("선택 영상을 삭제했습니다."); } catch (error) { onError(error); } finally { setBusy(""); }
      return;
    }
    setBusy("batch");
    try { await apiFetch("/api/admin/feed/videos/batch-status", { method: "POST", body: JSON.stringify({ video_ids: selected, status: next }) }); setSelected([]); await reload(); onNotice(`선택 영상을 ${next} 상태로 변경했습니다.`); } catch (error) { onError(error); } finally { setBusy(""); }
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <section className="panel-stack"><div className="filters"><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="제목 또는 채널 검색" /></div><select value={status} onChange={(event) => setStatus(event.target.value as VideoStatus | "")}><option value="">모든 상태</option><option value="CANDIDATE">검수 대기</option><option value="APPROVED">승인</option><option value="REJECTED">거절</option><option value="HIDDEN">숨김</option></select><span className="result-count">{total.toLocaleString()}개</span></div>{selected.length > 0 && <div className="batch-bar"><strong>{selected.length}개 선택</strong><button disabled={busy === "batch"} onClick={() => batch("APPROVED")}>승인</button><button disabled={busy === "batch"} onClick={() => batch("HIDDEN")}>숨김</button><button disabled={busy === "batch"} onClick={() => batch("DELETE")} className="danger-text">삭제</button></div>}{videos.length ? <div className="video-grid">{videos.map((video) => <article className="video-card" key={video.id}><label className="video-check"><input type="checkbox" checked={selected.includes(video.id)} onChange={(event) => setSelected((items) => event.target.checked ? [...items, video.id] : items.filter((id) => id !== video.id))} /></label><button className="thumbnail button-reset" onClick={() => setDetailId(video.id)}><img src={video.thumbnail_url} alt="" /><span>{durationLabel(video.duration_seconds)}</span></button><div className="video-body"><div className="video-badges"><span className={statusClass(video.status)}>{video.status}</span><span className="score">{video.base_score}점</span>{video.caption_available && <span className="caption-badge">CC</span>}</div><h3>{video.title}</h3><p>{video.channel_title}</p><small>{dateLabel(video.published_at)}</small><div className="video-actions"><button className="icon-button" onClick={() => setDetailId(video.id)} aria-label="미리보기"><Eye size={17} /></button><a className="icon-button" href={video.youtube_url} target="_blank" rel="noreferrer" aria-label="YouTube에서 열기"><ExternalLink size={17} /></a><button className="reject-button" onClick={() => decide(video, "REJECTED")} disabled={busy === video.id}><X size={17} /> 제외</button><button className="approve-button" onClick={() => decide(video, "APPROVED")} disabled={busy === video.id}><Check size={17} /> 승인</button><button className="icon-danger" onClick={() => remove(video)} disabled={busy === video.id}><Trash2 size={17} /></button></div></div></article>)}</div> : <EmptyState title="조건에 맞는 영상이 없습니다" description="필터를 바꾸거나 새 후보를 수집해 보세요." />}<Pagination page={page} pages={pages} setPage={setPage} />{detailId && <VideoDetailModal videoId={detailId} onClose={() => setDetailId("")} onError={onError} />}</section>;
}

function VideoDetailModal({ videoId, onClose, onError }: { videoId: string; onClose: () => void; onError: (error: unknown) => void }) {
  const [video, setVideo] = useState<FeedVideo | null>(null);
  useEffect(() => { apiFetch<FeedVideo>(`/api/admin/feed/videos/${videoId}`).then(setVideo).catch(onError); }, [videoId, onError]);
  return <Modal title="피드 영상 미리보기" onClose={onClose}>{!video ? <div className="loading-state"><LoaderCircle className="spin" /></div> : <div className="video-detail"><iframe src={`https://www.youtube-nocookie.com/embed/${video.youtube_video_id}`} title={video.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen /><div className="detail-grid"><span>상태 <b>{video.status}</b></span><span>채널 <b>{video.channel_title}</b></span><span>자막 캐시 <b>{video.transcript?.exists ? `${video.transcript.segment_count}개` : "없음"}</b></span><span>임베드 <b>{video.embeddable ? "가능" : "불가"}</b></span></div><p>{video.description || "설명이 없습니다."}</p><details><summary>Raw metadata</summary><pre>{JSON.stringify(video.raw_metadata || {}, null, 2)}</pre></details></div>}</Modal>;
}

function ExpressionsPanel(props: { expressions: Expression[]; total: number; page: number; setPage: (page: number) => void; search: string; setSearch: (value: string) => void; level: string; setLevel: (value: string) => void; reload: () => Promise<void>; onError: (error: unknown) => void }) {
  const { expressions, total, page, setPage, search, setSearch, level, setLevel, reload, onError } = props;
  const [editing, setEditing] = useState<Expression | "new" | null>(null);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  async function remove(expression: Expression) {
    if (!window.confirm(`"${expression.canonical_text}" 표현을 삭제할까요? 사용자 단어장 연결도 함께 제거됩니다.`)) return;
    try { await apiFetch(`/api/admin/expressions/${expression.id}`, { method: "DELETE" }); await reload(); } catch (error) { onError(error); }
  }
  return <section className="panel-stack"><article className="panel"><div className="panel-heading"><div><p className="eyebrow">MASTER VOCABULARY</p><h2>표현 마스터</h2></div><button className="primary-button" onClick={() => setEditing("new")}><Plus size={17} /> 표현 추가</button></div><div className="filters"><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="표현, 뜻, 예문, 카테고리 검색" /></div><select value={level} onChange={(event) => setLevel(event.target.value)}><option value="">모든 레벨</option>{LEVELS.map((item) => <option key={item}>{item}</option>)}</select><span className="result-count">{total.toLocaleString()}개</span></div>{expressions.length ? <div className="expression-table">{expressions.map((expression) => <article key={expression.id}><div><strong>{expression.canonical_text}</strong><span>{expression.korean_meaning}</span><small>{expression.example_sentence}</small></div><span className="type-badge type-channel">{expression.level}</span><span className="priority">{expression.category}</span><button className="icon-button" onClick={() => setEditing(expression)}><Pencil size={17} /></button><button className="icon-danger" onClick={() => remove(expression)}><Trash2 size={17} /></button></article>)}</div> : <EmptyState title="표현이 없습니다" description="학습에서 사용할 마스터 표현을 추가하세요." />}<Pagination page={page} pages={pages} setPage={setPage} /></article>{editing && <ExpressionModal expression={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await reload(); }} onError={onError} />}</section>;
}

function ExpressionModal({ expression, onClose, onSaved, onError }: { expression: Expression | null; onClose: () => void; onSaved: () => Promise<void>; onError: (error: unknown) => void }) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      canonical_text: form.get("canonical_text"),
      korean_meaning: form.get("korean_meaning"),
      example_sentence: form.get("example_sentence"),
      category: form.get("category"),
      level: form.get("level"),
      tags: String(form.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
    };
    try {
      await apiFetch(expression ? `/api/admin/expressions/${expression.id}` : "/api/admin/expressions", { method: expression ? "PATCH" : "POST", body: JSON.stringify(body) });
      await onSaved();
    } catch (error) { onError(error); }
  }
  return <Modal title={expression ? "표현 수정" : "표현 추가"} onClose={onClose}><form className="drawer-form" onSubmit={submit}><label>Canonical text<input name="canonical_text" defaultValue={expression?.canonical_text || ""} required /></label><label>한국어 의미<input name="korean_meaning" defaultValue={expression?.korean_meaning || ""} required /></label><label>예문<textarea name="example_sentence" defaultValue={expression?.example_sentence || ""} required /></label><label>카테고리<input name="category" defaultValue={expression?.category || "conversation"} required /></label><label>레벨<select name="level" defaultValue={expression?.level || "B1"}>{LEVELS.map((item) => <option key={item}>{item}</option>)}</select></label><label>태그, 쉼표 구분<input name="tags" defaultValue={expression?.tags?.join(", ") || ""} /></label><button className="primary-button"><Check size={17} /> 저장</button></form></Modal>;
}

function JobsPanel(props: { jobs: YouTubeJob[]; workers: WorkerHeartbeat[]; total: number; page: number; setPage: (page: number) => void; status: JobStatus | ""; setStatus: (status: JobStatus | "") => void; reload: () => Promise<void>; onError: (error: unknown) => void }) {
  const { jobs, workers, total, page, setPage, status, setStatus, reload, onError } = props;
  const pages = Math.max(1, Math.ceil(total / 30));
  async function retry(job: YouTubeJob) {
    try { await apiFetch(`/api/admin/jobs/${job.id}/retry`, { method: "POST" }); await reload(); } catch (error) { onError(error); }
  }
  return <section className="panel-stack"><div className="worker-grid">{workers.map((worker) => <article className={worker.stale ? "worker-card stale" : "worker-card"} key={worker.worker_id}><span className="metric-icon"><Activity size={18} /></span><strong>{worker.worker_id}</strong><small>{worker.worker_type} · {worker.stale ? "오프라인 의심" : "활성"}</small><div className="detail-grid"><span>GPU <b>{worker.gpu_available ? "OK" : "NO"}</b></span><span>모델 <b>{worker.model_loaded ? "LOADED" : "대기"}</b></span><span>큐 <b>{worker.queue_length}</b></span><span>마지막 <b>{dateLabel(worker.last_seen_at)}</b></span></div></article>)}{!workers.length && <article className="panel"><EmptyState title="워커 하트비트가 없습니다" description="GPU worker가 켜지면 상태가 표시됩니다." /></article>}</div><article className="panel"><div className="panel-heading"><div><p className="eyebrow">YOUTUBE JOBS</p><h2>자막 추출 작업</h2></div><button className="secondary-button" onClick={reload}><RefreshCw size={16} /> 새로고침</button></div><div className="filters"><select value={status} onChange={(event) => setStatus(event.target.value as JobStatus | "")}><option value="">모든 상태</option><option value="QUEUED">QUEUED</option><option value="PROCESSING">PROCESSING</option><option value="COMPLETED">COMPLETED</option><option value="FAILED">FAILED</option></select><span className="result-count">{total.toLocaleString()}개</span></div><div className="jobs-table">{jobs.map((job) => <article key={job.id}><div><strong>{job.video_id}</strong><span>{job.provider} · {job.execution_target} · attempts {job.attempts}</span>{job.error_message && <small>{job.error_code}: {job.error_message}</small>}</div><div className="progress-bar"><span style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }} /></div><span className={statusClass(job.status)}>{job.status}</span><button className="secondary-button" onClick={() => retry(job)} disabled={job.status !== "FAILED"}><RotateCcw size={16} /> Retry</button></article>)}{!jobs.length && <EmptyState title="작업 기록이 없습니다" description="피드 저장/자막 요청 시 작업이 생성됩니다." />}</div><Pagination page={page} pages={pages} setPage={setPage} /></article></section>;
}

function RunsPanel({ runs }: { runs: CollectionRun[] }) {
  return <article className="panel"><div className="panel-heading"><div><p className="eyebrow">COLLECTION HISTORY</p><h2>후보 수집 실행 기록</h2></div></div>{runs.length ? <div className="run-list">{runs.map((run) => <RunRow key={run.id} run={run} />)}</div> : <EmptyState title="수집 기록이 없습니다" description="첫 후보 수집을 실행하면 결과가 여기에 표시됩니다." />}</article>;
}

function RunRow({ run }: { run: CollectionRun }) {
  return <article className="run-row"><span className={`run-status run-${run.status.toLowerCase()}`} style={{ display: 'flex' }}><span style={{ display: 'flex', margin: 'auto' }}>{run.status === "COMPLETED" ? <Check size={17} /> : run.status === "RUNNING" ? <LoaderCircle className="spin" size={17} /> : <CircleOff size={17} />}</span></span><div><strong>{dateLabel(run.started_at)}</strong><span>{run.trigger === "SCHEDULE" ? "자동 스케줄" : "관리자 실행"}</span>{run.error_message && <small>{run.error_message}</small>}</div><dl><div><dt>발견</dt><dd>{run.discovered_count}</dd></div><div><dt>신규</dt><dd>{run.inserted_count}</dd></div><div><dt>갱신</dt><dd>{run.updated_count}</dd></div></dl></article>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal-card" onMouseDown={(event) => event.stopPropagation()}><header className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={18} /></button></header>{children}</section></div>;
}

function Pagination({ page, pages, setPage }: { page: number; pages: number; setPage: (page: number) => void }) {
  return <div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button></div>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><Database size={28} /><strong>{title}</strong><p>{description}</p></div>;
}

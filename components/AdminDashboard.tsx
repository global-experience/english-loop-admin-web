"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity, AlertTriangle, BookMarked, Captions, Check, ChevronLeft, ChevronRight, CircleOff,
  ClipboardList, Database, ExternalLink,
  Eye, History, LayoutDashboard, LoaderCircle, LogOut, PanelLeftClose, PanelLeftOpen, Pencil, Plus, RefreshCw, RotateCcw,
  Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, ToggleLeft, ToggleRight, UserCheck,
  Users, UserX, Video, X, Zap,
} from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import { TAB_LABELS, tabHref, type Tab } from "@/lib/tabs";
import type {
  AdminMember, AdminRole, AdminUser, CoachingHistory, CollectionRun, Expression,
  ExpressionStage, FeedSource, FeedVideo, JobStatus, Overview, ReportHealth, ReportRow,
  RuntimeSetting, SourceType, TranscriptDetail, TranscriptRow, TranscriptStats,
  UserApprovalStatus, UserSavedVideo, UserVocabulary, VideoStatus, WorkerHeartbeat, YouTubeJob,
} from "@/lib/types";

type UserDetailTab = "profile" | "saved" | "vocabulary" | "coaching";
const PAGE_SIZE = 18;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID_RE = /UC[A-Za-z0-9_-]{22}/;
const CHANNEL_HANDLE_RE = /(?:youtube\.com\/)?@([A-Za-z0-9._-]{3,30})/;
const LEVELS = ["A1", "A2", "B1", "B2", "C1"];
const STAGES: ExpressionStage[] = ["NEW", "LISTENED", "UNDERSTOOD", "SHADOWED", "USED_WITH_HELP", "USED_SPONTANEOUSLY", "MASTERED"];

/** 라벨은 lib/tabs.ts 가 갖는다. 여기서는 아이콘과 순서만 정한다. */
const navItems: { id: Tab; icon: typeof LayoutDashboard }[] = [
  { id: "overview", icon: LayoutDashboard },
  { id: "users", icon: Users },
  { id: "sources", icon: Settings2 },
  { id: "videos", icon: Video },
  { id: "expressions", icon: BookMarked },
  { id: "jobs", icon: Activity },
  { id: "transcripts", icon: Captions },
  { id: "reports", icon: ClipboardList },
  { id: "runs", icon: History },
  { id: "settings", icon: SlidersHorizontal },
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

export function AdminDashboard({ tab }: { tab: Tab }) {
  const router = useRouter();
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
  const [transcriptStats, setTranscriptStats] = useState<TranscriptStats | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptRow[]>([]);
  const [transcriptTotal, setTranscriptTotal] = useState(0);
  const [transcriptPage, setTranscriptPage] = useState(1);
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [transcriptSource, setTranscriptSource] = useState("");
  const [transcriptStale, setTranscriptStale] = useState(false);
  const [reportHealth, setReportHealth] = useState<ReportHealth | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportPage, setReportPage] = useState(1);
  const [reportSearch, setReportSearch] = useState("");
  const [reportConfidence, setReportConfidence] = useState("");
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const toggleSidebar = useCallback(() => setSidebarCollapsed((previous) => !previous), []);
  const expandSidebar = useCallback(() => setSidebarCollapsed(false), []);

  const navigate = useCallback((next: Tab) => router.push(tabHref(next)), [router]);

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

  const loadTranscripts = useCallback(async () => {
    const params = new URLSearchParams({ page: String(transcriptPage), page_size: String(PAGE_SIZE) });
    if (transcriptSearch.trim()) params.set("search", transcriptSearch.trim());
    if (transcriptSource) params.set("source", transcriptSource);
    if (transcriptStale) params.set("stale", "true");
    const [listData, statsData] = await Promise.all([
      apiFetch<{ items: TranscriptRow[]; total: number }>(`/api/admin/transcripts?${params}`),
      apiFetch<TranscriptStats>("/api/admin/transcripts/stats"),
    ]);
    setTranscripts(listData.items);
    setTranscriptTotal(listData.total);
    setTranscriptStats(statsData);
  }, [transcriptPage, transcriptSearch, transcriptSource, transcriptStale]);

  const loadReports = useCallback(async () => {
    const params = new URLSearchParams({ page: String(reportPage), page_size: String(PAGE_SIZE) });
    if (reportSearch.trim()) params.set("search", reportSearch.trim());
    if (reportConfidence) params.set("confidence", reportConfidence);
    const [listData, healthData] = await Promise.all([
      apiFetch<{ items: ReportRow[]; total: number }>(`/api/admin/reports?${params}`),
      apiFetch<ReportHealth>("/api/admin/reports/health"),
    ]);
    setReports(listData.items);
    setReportTotal(listData.total);
    setReportHealth(healthData);
  }, [reportPage, reportSearch, reportConfidence]);

  const loadSettings = useCallback(
    async () => setRuntimeSettings((await apiFetch<{ items: RuntimeSetting[] }>("/api/admin/settings")).items),
    [],
  );

  const activeLoader = useMemo(() => ({
    overview: loadOverview,
    users: loadUsers,
    sources: loadSources,
    videos: loadVideos,
    expressions: loadExpressions,
    jobs: loadJobs,
    transcripts: loadTranscripts,
    reports: loadReports,
    runs: loadRuns,
    settings: loadSettings,
  })[tab], [tab, loadOverview, loadUsers, loadSources, loadVideos, loadExpressions, loadJobs, loadTranscripts, loadReports, loadRuns, loadSettings]);

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
        <div className="brand" onClick={() => sidebarCollapsed && expandSidebar()} style={{ cursor: sidebarCollapsed ? "pointer" : "default" }} title={sidebarCollapsed ? "메뉴 펼치기" : ""}>
          <img src="/icons/loopine-logo.svg" alt="" aria-hidden="true" className="logo-mark" />
          <div className="brand-text">
            <strong>Loopine</strong>
            <span>Content operations</span>
          </div>
          <button
            className="sidebar-toggle-btn"
            onClick={(event) => { event.stopPropagation(); toggleSidebar(); }}
            title={sidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
          >
            {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
        <nav>
          {navItems.map((item) => (
            <Link
              key={item.id}
              href={tabHref(item.id)}
              className={tab === item.id ? "active" : ""}
              title={TAB_LABELS[item.id]}
              aria-current={tab === item.id ? "page" : undefined}
            >
              <item.icon size={19} />
              <span className="nav-label">{TAB_LABELS[item.id]}</span>
            </Link>
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
              onClick={toggleSidebar}
              title={sidebarCollapsed ? "메뉴 펼치기" : "메뉴 접기"}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
            </button>
            <div>
              <p className="eyebrow">CONTENT OPERATIONS</p>
              <h1>{TAB_LABELS[tab]}</h1>
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
            {tab === "overview" && overview && <OverviewPanel data={overview} onNavigate={navigate} />}
            {tab === "users" && <UsersPanel users={users} members={members} status={userStatus} setStatus={(next) => { setUserPage(1); setUserStatus(next); }} search={userSearch} setSearch={(next) => { setUserPage(1); setUserSearch(next); }} reload={loadUsers} onError={handleError} total={userTotal} page={userPage} setPage={setUserPage} />}
            {tab === "sources" && <SourcesPanel sources={sources} reload={loadSources} onError={handleError} onNotice={setNotice} />}
            {tab === "videos" && <VideosPanel videos={videos} status={status} setStatus={(next) => { setPage(1); setStatus(next); }} search={search} setSearch={(next) => { setPage(1); setSearch(next); }} reload={loadVideos} onError={handleError} total={total} page={page} setPage={setPage} onNotice={setNotice} />}
            {tab === "expressions" && <ExpressionsPanel expressions={expressions} total={expressionTotal} page={expressionPage} setPage={setExpressionPage} search={expressionSearch} setSearch={(next) => { setExpressionPage(1); setExpressionSearch(next); }} level={expressionLevel} setLevel={(next) => { setExpressionPage(1); setExpressionLevel(next); }} reload={loadExpressions} onError={handleError} />}
            {tab === "jobs" && <JobsPanel jobs={jobs} workers={workers} total={jobTotal} page={jobPage} setPage={setJobPage} status={jobStatus} setStatus={(next) => { setJobPage(1); setJobStatus(next); }} reload={loadJobs} onError={handleError} />}
            {tab === "transcripts" && <TranscriptsPanel stats={transcriptStats} rows={transcripts} total={transcriptTotal} page={transcriptPage} setPage={setTranscriptPage} search={transcriptSearch} setSearch={(next) => { setTranscriptPage(1); setTranscriptSearch(next); }} source={transcriptSource} setSource={(next) => { setTranscriptPage(1); setTranscriptSource(next); }} onlyStale={transcriptStale} setOnlyStale={(next) => { setTranscriptPage(1); setTranscriptStale(next); }} reload={loadTranscripts} onError={handleError} onNotice={setNotice} />}
            {tab === "reports" && <ReportsPanel health={reportHealth} rows={reports} total={reportTotal} page={reportPage} setPage={setReportPage} search={reportSearch} setSearch={(next) => { setReportPage(1); setReportSearch(next); }} confidence={reportConfidence} setConfidence={(next) => { setReportPage(1); setReportConfidence(next); }} reload={loadReports} />}
            {tab === "runs" && <RunsPanel runs={runs} />}
            {tab === "settings" && <SettingsPanel items={runtimeSettings} reload={loadSettings} onError={handleError} onNotice={setNotice} />}
          </>
        )}
      </main>
    </div>
  );
}

function SearchForm(props: { value: string; onSearch: (value: string) => void; placeholder: string }) {
  const { value, onSearch, placeholder } = props;
  const [query, setQuery] = useState(value);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSearch(query);
  }

  function clear() {
    setQuery("");
    onSearch("");
  }

  return (
    <form className="search-form" onSubmit={submit}>
      <div className="search-box">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
        />
        {query ? (
          <button type="button" className="search-clear-button" onClick={clear} title="검색어 초기화">
            <X size={15} />
          </button>
        ) : null}
      </div>
      <button type="submit" className="primary-button search-button">
        검색
      </button>
    </form>
  );
}

function OverviewPanel({ data, onNavigate }: { data: Overview; onNavigate: (tab: Tab) => void }) {
  const activity = data.activity;
  const transcripts = data.transcripts;
  const reports = data.reports;
  const metrics = [
    { label: "가입 승인 대기", value: data.users?.pending || 0, detail: "승인이 필요한 계정", icon: Users, tab: "users" as Tab },
    { label: "활성 수집 소스", value: data.active_sources, detail: `전체 ${data.sources}개`, icon: Database, tab: "sources" as Tab },
    { label: "검수 대기", value: data.videos.CANDIDATE || 0, detail: "확인이 필요한 영상", icon: Activity, tab: "videos" as Tab },
    { label: "승인 영상", value: data.videos.APPROVED || 0, detail: "피드 노출 가능", icon: Check, tab: "videos" as Tab },
  ];
  // 수집·승인 숫자만으로는 학습이 실제로 일어나는지 알 수 없다. 아래 네 개가
  // 각각 사용 · 비용 · 자막 파이프라인 · ChatGPT 연동의 생존 신호다.
  const healthMetrics = activity && transcripts && reports ? [
    {
      label: "오늘 활동 사용자",
      value: activity.active_today.toLocaleString(),
      detail: `최근 ${activity.window_days}일 ${activity.active_week}명`,
      icon: Users,
      tab: "users" as Tab,
      warn: activity.active_week === 0,
    },
    {
      label: "루틴 완료율",
      value: percentLabel(activity.routine_completion_rate),
      detail: `${activity.routine_completed}/${activity.routine_completions}건 · 발화 ${activity.speech_attempts}회`,
      icon: Check,
      tab: "reports" as Tab,
      warn: false,
    },
    {
      label: "자막 캐시 히트율",
      value: percentLabel(transcripts.hit_rate),
      detail: transcripts.stale ? `구버전 ${transcripts.stale}건 재추출 중` : `캐시 ${transcripts.total}건`,
      icon: Zap,
      tab: "transcripts" as Tab,
      warn: transcripts.stale > 0 || transcripts.recent_errors.length > 0,
    },
    {
      label: "리포트 연속 결측",
      value: `${reports.consecutive_missing_days}일`,
      detail: reports.missing ? `최근 ${reports.days}일 ${reports.missing}건 누락` : "누락 없음",
      icon: ClipboardList,
      tab: "reports" as Tab,
      warn: reports.consecutive_missing_days > 0,
    },
  ] : [];
  return <section className="panel-stack"><div className="metric-grid">{metrics.map((metric) => <button className="metric-card" key={metric.label} onClick={() => onNavigate(metric.tab)}><span className="metric-icon"><metric.icon size={20} /></span><span>{metric.label}</span><strong>{metric.value.toLocaleString()}</strong><small>{metric.detail}</small></button>)}</div>{healthMetrics.length > 0 && <div className="metric-grid">{healthMetrics.map((metric) => <button className={metric.warn ? "metric-card warn" : "metric-card"} key={metric.label} onClick={() => onNavigate(metric.tab)}><span className="metric-icon"><metric.icon size={20} /></span><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></button>)}</div>}<article className="panel"><div className="panel-heading"><div><p className="eyebrow">LAST COLLECTION</p><h2>최근 수집 상태</h2></div><button className="text-button" onClick={() => onNavigate("runs")}>전체 기록 <ChevronRight size={16} /></button></div>{data.last_run ? <RunRow run={data.last_run} /> : <EmptyState title="아직 수집 기록이 없습니다" description="수집 소스를 준비한 뒤 후보 영상 수집을 실행하세요." />}</article></section>;
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
  return <section className="panel-stack"><article className="panel"><div className="panel-heading"><div><p className="eyebrow">ACCOUNT APPROVAL</p><h2>회원 가입 승인</h2></div></div><div className="filters"><SearchForm value={search} onSearch={setSearch} placeholder="이메일 또는 이름 검색" /><select value={status} onChange={(event) => setStatus(event.target.value as UserApprovalStatus | "")}><option value="">모든 상태</option><option value="PENDING">승인 대기</option><option value="APPROVED">승인됨</option><option value="REJECTED">거절됨</option></select><span className="result-count">{total.toLocaleString()}명</span></div>{users.length ? <div className="user-list">{users.map((user) => <article className="user-row clickable" key={user.id} onClick={() => setDetailUserId(user.id)}><span className={`user-status status-${user.approval_status.toLowerCase()}`}>{user.approval_status}</span><div><strong>{user.display_name}</strong><span>{user.email}</span><small>{user.english_level} · {user.goals.join(", ") || "목표 없음"}{user.is_admin ? ` · ${user.admin_role} 관리자` : ""}</small></div><span className="joined-at">{dateLabel(user.created_at)}</span><div className="user-actions" onClick={(event) => event.stopPropagation()}>{user.approval_status !== "APPROVED" && <button className="approve-button" onClick={() => approve(user)} disabled={busy === user.id}><UserCheck size={17} /> 승인</button>}{user.approval_status !== "REJECTED" && <button className="reject-button" onClick={() => reject(user)} disabled={busy === user.id}><UserX size={17} /> 거절</button>}</div></article>)}</div> : <EmptyState title="조건에 맞는 사용자가 없습니다" description="필터를 바꾸거나 새 가입 요청을 기다려 주세요." />}<Pagination page={page} pages={pages} setPage={setPage} /></article><article className="panel"><div className="panel-heading"><div><p className="eyebrow">ADMIN MEMBERS</p><h2>관리자 계정</h2></div></div><form className="admin-member-form" onSubmit={addAdmin}><label>관리자 이메일<input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="승인된 사용자 이메일" required /></label><label>권한<select value={adminRole} onChange={(event) => setAdminRole(event.target.value as AdminRole)}><option value="ADMIN">ADMIN</option><option value="OWNER">OWNER</option></select></label><button className="primary-button" disabled={busy === "add-admin"}><ShieldCheck size={17} /> 추가</button></form>{members.length ? <div className="member-list">{members.map((member) => <article className="member-row" key={member.id}><span className="member-icon" style={{ display: "flex" }}><span style={{ display: 'flex', margin: "auto" }}><ShieldCheck size={18} /></span></span><div><strong>{member.display_name}</strong><span>{member.email}</span></div><span className="type-badge type-channel">{member.role}</span><button className="reject-button" onClick={() => removeAdmin(member)} disabled={busy === member.user_id}><X size={17} /> 제거</button></article>)}</div> : <EmptyState title="등록된 관리자가 없습니다" description="최초 관리자는 부트스트랩 계정으로 접속하면 생성됩니다." />}</article>{detailUserId && <UserDetailDrawer userId={detailUserId} onClose={() => setDetailUserId("")} onSaved={reload} onError={onError} />}</section>;
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
  return <section className="panel-stack"><div className="filters"><SearchForm value={search} onSearch={setSearch} placeholder="제목 또는 채널 검색" /><select value={status} onChange={(event) => setStatus(event.target.value as VideoStatus | "")}><option value="">모든 상태</option><option value="CANDIDATE">검수 대기</option><option value="APPROVED">승인</option><option value="REJECTED">거절</option><option value="HIDDEN">숨김</option></select><span className="result-count">{total.toLocaleString()}개</span></div>{selected.length > 0 && <div className="batch-bar"><strong>{selected.length}개 선택</strong><button disabled={busy === "batch"} onClick={() => batch("APPROVED")}>승인</button><button disabled={busy === "batch"} onClick={() => batch("HIDDEN")}>숨김</button><button disabled={busy === "batch"} onClick={() => batch("DELETE")} className="danger-text">삭제</button></div>}{videos.length ? <div className="video-grid">{videos.map((video) => <article className="video-card" key={video.id}><label className="video-check"><input type="checkbox" checked={selected.includes(video.id)} onChange={(event) => setSelected((items) => event.target.checked ? [...items, video.id] : items.filter((id) => id !== video.id))} /></label><button className="thumbnail button-reset" onClick={() => setDetailId(video.id)}><img src={video.thumbnail_url} alt="" /><span>{durationLabel(video.duration_seconds)}</span></button><div className="video-body"><div className="video-badges"><span className={statusClass(video.status)}>{video.status}</span><span className="score">{video.base_score}점</span>{video.caption_available && <span className="caption-badge">CC</span>}</div><h3>{video.title}</h3><p>{video.channel_title}</p><small>{dateLabel(video.published_at)}</small><div className="video-actions"><button className="icon-button" onClick={() => setDetailId(video.id)} aria-label="미리보기"><Eye size={17} /></button><a className="icon-button" href={video.youtube_url} target="_blank" rel="noreferrer" aria-label="YouTube에서 열기"><ExternalLink size={17} /></a><button className="reject-button" onClick={() => decide(video, "REJECTED")} disabled={busy === video.id}><X size={17} /> 제외</button><button className="approve-button" onClick={() => decide(video, "APPROVED")} disabled={busy === video.id}><Check size={17} /> 승인</button><button className="icon-danger" onClick={() => remove(video)} disabled={busy === video.id}><Trash2 size={17} /></button></div></div></article>)}</div> : <EmptyState title="조건에 맞는 영상이 없습니다" description="필터를 바꾸거나 새 후보를 수집해 보세요." />}<Pagination page={page} pages={pages} setPage={setPage} />{detailId && <VideoDetailModal videoId={detailId} onClose={() => setDetailId("")} onError={onError} />}</section>;
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
  return (
    <section className="panel-stack">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">MASTER VOCABULARY</p>
            <h2>표현 마스터</h2>
          </div>
          <button className="primary-button" onClick={() => setEditing("new")}>
            <Plus size={17} /> 표현 추가
          </button>
        </div>
        <div className="filters">
          <SearchForm value={search} onSearch={setSearch} placeholder="표현, 뜻, 예문, 카테고리 검색" />
          <select value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="">모든 레벨</option>
            {LEVELS.map((item) => <option key={item}>{item}</option>)}
          </select>
          <span className="result-count">{total.toLocaleString()}개</span>
        </div>
        {expressions.length ? (
          <div className="expression-table">
            {expressions.map((expression) => (
              <article key={expression.id}>
                <div>
                  <strong>{expression.canonical_text}</strong>
                  <span>{expression.korean_meaning}</span>
                  <small>{expression.example_sentence}</small>
                </div>
                <span className="type-badge type-channel">{expression.level}</span>
                <span className="priority">{expression.category}</span>
                <button className="icon-button" onClick={() => setEditing(expression)}>
                  <Pencil size={17} />
                </button>
                <button className="icon-danger" onClick={() => remove(expression)}>
                  <Trash2 size={17} />
                </button>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="표현이 없습니다" description="학습에서 사용할 마스터 표현을 추가하세요." />
        )}
        <Pagination page={page} pages={pages} setPage={setPage} />
      </article>
      {editing && (
        <ExpressionModal
          expression={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await reload(); }}
          onError={onError}
        />
      )}
    </section>
  );
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

/* ─────────────────────────── 자막 캐시 운영 ───────────────────────────
 * 자막 파이프라인은 가장 비싸고 가장 자주 깨지는 경로다. 지금까지 어드민은
 * 작업(job)만 보여줬고 결과물인 캐시는 사각지대였다: 무엇이 어떤 경로로
 * 만들어졌는지, 재사용되고 있는지, 잘못된 걸 어떻게 버리는지 전부. */

function percentLabel(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${Math.round(value * 1000) / 10}%`;
}

function sourceLabel(source: string | null) {
  return ({
    youtube_caption: "YouTube 자막",
    "youtube_caption+whisper": "자막+Whisper 보정",
    whisper: "로컬 Whisper",
    groq_whisper: "Groq Whisper",
    cloudflare_whisper: "Cloudflare Whisper",
  } as Record<string, string>)[source || ""] || source || "알 수 없음";
}

function TranscriptsPanel(props: {
  stats: TranscriptStats | null;
  rows: TranscriptRow[];
  total: number;
  page: number;
  setPage: (page: number) => void;
  search: string;
  setSearch: (value: string) => void;
  source: string;
  setSource: (value: string) => void;
  onlyStale: boolean;
  setOnlyStale: (value: boolean) => void;
  reload: () => Promise<void>;
  onError: (error: unknown) => void;
  onNotice: (message: string) => void;
}) {
  const { stats, rows, total, page, setPage, search, setSearch, source, setSource, onlyStale, setOnlyStale, reload, onError, onNotice } = props;
  const [detailId, setDetailId] = useState("");
  const [busy, setBusy] = useState("");
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function invalidate(row: TranscriptRow) {
    if (!window.confirm(`${row.video_id} 자막 캐시를 버릴까요? 다음 요청에서 다시 추출됩니다.`)) return;
    setBusy(row.video_id);
    try {
      await apiFetch(`/api/admin/transcripts/${row.video_id}`, { method: "DELETE" });
      onNotice(`${row.video_id} 캐시를 버렸습니다. 다음 요청에서 재추출됩니다.`);
      await reload();
    } catch (caught) {
      onError(caught);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="panel-stack">
      {stats && (
        <>
          <div className="metric-grid">
            <div className="metric-card static">
              <span className="metric-icon"><Captions size={20} /></span>
              <span>캐시된 자막</span>
              <strong>{stats.total.toLocaleString()}</strong>
              <small>파이프라인 v{stats.pipeline_version}</small>
            </div>
            <div className="metric-card static">
              <span className="metric-icon"><Zap size={20} /></span>
              <span>캐시 히트율</span>
              <strong>{percentLabel(stats.hit_rate)}</strong>
              <small>히트 {stats.hits.toLocaleString()} · 미스 {stats.misses.toLocaleString()}</small>
            </div>
            <div className={stats.stale > 0 ? "metric-card static warn" : "metric-card static"}>
              <span className="metric-icon"><RotateCcw size={20} /></span>
              <span>구버전 캐시</span>
              <strong>{stats.stale.toLocaleString()}</strong>
              <small>읽히지 않고 매번 재추출됨</small>
            </div>
            <div className={stats.empty > 0 ? "metric-card static warn" : "metric-card static"}>
              <span className="metric-icon"><CircleOff size={20} /></span>
              <span>빈 자막</span>
              <strong>{stats.empty.toLocaleString()}</strong>
              <small>세그먼트 0개</small>
            </div>
          </div>
          <div className="split-panels">
            <article className="panel">
              <div className="panel-heading"><div><p className="eyebrow">EXTRACTION PATH</p><h2>추출 경로 분포</h2></div></div>
              {stats.by_source.length ? (
                <div className="bar-list">
                  {stats.by_source.map((item) => (
                    <div className="bar-row" key={item.source}>
                      <span>{sourceLabel(item.source)}</span>
                      <div className="bar-track"><span style={{ width: `${Math.max(3, (item.count / stats.total) * 100)}%` }} /></div>
                      <b>{item.count.toLocaleString()}</b>
                      <small>히트 {item.hits.toLocaleString()}</small>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="캐시된 자막이 없습니다" description="영상을 학습하면 자막이 캐시됩니다." />}
            </article>
            <article className="panel">
              <div className="panel-heading">
                <div><p className="eyebrow">RECENT FAILURES</p><h2>최근 {stats.error_window_days}일 실패 코드</h2></div>
              </div>
              {stats.recent_errors.length ? (
                <div className="code-list">
                  {stats.recent_errors.map((item) => (
                    <div key={item.error_code}>
                      {/* HTTP_429 / 403 이 몰려 있으면 YouTube 의 데이터센터 IP 차단이다. */}
                      <code>{item.error_code}</code>
                      <b>{item.count.toLocaleString()}</b>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="실패한 작업이 없습니다" description="최근 자막 추출이 모두 성공했습니다." />}
            </article>
          </div>
        </>
      )}
      <article className="panel">
        <div className="panel-heading">
          <div><p className="eyebrow">TRANSCRIPT CACHE</p><h2>자막 캐시 목록</h2></div>
          <button className="secondary-button" onClick={reload}><RefreshCw size={16} /> 새로고침</button>
        </div>
        <div className="filters">
          <SearchForm value={search} onSearch={setSearch} placeholder="video ID 검색" />
          <select value={source} onChange={(event) => setSource(event.target.value)}>
            <option value="">모든 경로</option>
            {(stats?.by_source || []).map((item) => (
              <option key={item.source} value={item.source}>{sourceLabel(item.source)}</option>
            ))}
          </select>
          <label className="check-filter">
            <input type="checkbox" checked={onlyStale} onChange={(event) => setOnlyStale(event.target.checked)} />
            구버전만
          </label>
          <span className="result-count">{total.toLocaleString()}개</span>
        </div>
        {rows.length ? (
          <div className="transcript-list">
            {rows.map((row) => (
              <article className={row.stale ? "transcript-row stale" : "transcript-row"} key={row.video_id}>
                <button className="button-reset transcript-id" onClick={() => setDetailId(row.video_id)}>
                  <code>{row.video_id}</code>
                  <span className="type-badge type-channel">{sourceLabel(row.source)}</span>
                  {row.stale && <span className="status-rejected">v{row.pipeline_version} 구버전</span>}
                </button>
                <dl>
                  <div><dt>세그먼트</dt><dd>{row.segment_count.toLocaleString()}</dd></div>
                  <div><dt>히트</dt><dd>{row.hit_count.toLocaleString()}</dd></div>
                  <div><dt>마지막 사용</dt><dd>{dateLabel(row.last_hit_at)}</dd></div>
                  <div><dt>갱신</dt><dd>{dateLabel(row.updated_at)}</dd></div>
                </dl>
                <div className="row-actions">
                  <button className="icon-button" onClick={() => setDetailId(row.video_id)} aria-label="자막 미리보기"><Eye size={17} /></button>
                  <a className="icon-button" href={`https://www.youtube.com/watch?v=${row.video_id}`} target="_blank" rel="noreferrer" aria-label="YouTube에서 열기"><ExternalLink size={17} /></a>
                  <button className="icon-danger" onClick={() => invalidate(row)} disabled={busy === row.video_id} aria-label="캐시 버리기"><Trash2 size={17} /></button>
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState title="조건에 맞는 자막이 없습니다" description="필터를 바꾸거나 영상을 학습해 캐시를 만들어 보세요." />}
        <Pagination page={page} pages={pages} setPage={setPage} />
      </article>
      {detailId && <TranscriptDetailModal videoId={detailId} onClose={() => setDetailId("")} onError={onError} />}
    </section>
  );
}

function TranscriptDetailModal({ videoId, onClose, onError }: { videoId: string; onClose: () => void; onError: (error: unknown) => void }) {
  const [detail, setDetail] = useState<TranscriptDetail | null>(null);

  useEffect(() => {
    apiFetch<TranscriptDetail>(`/api/admin/transcripts/${videoId}`).then(setDetail).catch(onError);
  }, [videoId, onError]);

  return (
    <Modal title={`자막 ${videoId}`} onClose={onClose}>
      {!detail ? <div className="loading-state"><LoaderCircle className="spin" /></div> : (
        <div className="modal-body">
          <dl className="detail-grid">
            <div><dt>추출 경로</dt><dd>{sourceLabel(detail.source)}</dd></div>
            <div><dt>파이프라인</dt><dd>v{detail.pipeline_version}{detail.stale ? " (구버전)" : ""}</dd></div>
            <div><dt>세그먼트</dt><dd>{detail.segment_count.toLocaleString()}</dd></div>
            <div><dt>번역됨</dt><dd>{detail.translated_segment_count.toLocaleString()}</dd></div>
            <div><dt>히트</dt><dd>{detail.hit_count.toLocaleString()}</dd></div>
            <div><dt>자동 생성</dt><dd>{detail.is_generated === null ? "—" : detail.is_generated ? "예" : "아니오"}</dd></div>
          </dl>
          <a className="text-button" href={detail.youtube_url} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> YouTube에서 확인
          </a>
          {/* 앞 문장 몇 개만 봐도 오인식(엉뚱한 언어, 빈 텍스트)은 바로 드러난다. */}
          <div className="segment-preview">
            {detail.preview.map((segment) => (
              <div key={segment.sequence}>
                <span>{durationLabel(Math.floor(segment.start_ms / 1000))}</span>
                <div>
                  <strong>{segment.english_text || <em>빈 텍스트</em>}</strong>
                  {segment.translation && <small>{segment.translation}</small>}
                </div>
              </div>
            ))}
            {!detail.preview.length && <EmptyState title="세그먼트가 없습니다" description="빈 자막입니다. 캐시를 버리고 재추출해 보세요." />}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ─────────────────────────── 코칭 리포트 진단 ───────────────────────────
 * 2026-09-04 부터 6일간 리포트가 한 건도 쌓이지 않았는데 어디에도 신호가
 * 없었다. 세션은 정상 생성되고 있었으니 "세션 수" 만으로는 보이지 않는다.
 * 연속 결측일이 그 장애를 당일에 드러내는 지표다. */

function ReportsPanel(props: {
  health: ReportHealth | null;
  rows: ReportRow[];
  total: number;
  page: number;
  setPage: (page: number) => void;
  search: string;
  setSearch: (value: string) => void;
  confidence: string;
  setConfidence: (value: string) => void;
  reload: () => Promise<void>;
}) {
  const { health, rows, total, page, setPage, search, setSearch, confidence, setConfidence, reload } = props;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const maxSessions = Math.max(1, ...(health?.daily || []).map((day) => day.sessions));

  return (
    <section className="panel-stack">
      {health && health.consecutive_missing_days > 0 && (
        <div className="alert error standing">
          <AlertTriangle size={18} />
          <span>
            <strong>{health.consecutive_missing_days}일 연속으로 리포트가 들어오지 않았습니다.</strong>{" "}
            세션은 생성되는데 리포트가 없다면 ChatGPT 쪽 Action 호출이 끊긴 상태입니다.
            Custom GPT 의 Action 키와 OpenAPI 버전을 먼저 확인하세요.
          </span>
        </div>
      )}
      {health && (
        <>
          <div className="metric-grid">
            <div className="metric-card static">
              <span className="metric-icon"><ClipboardList size={20} /></span>
              <span>코칭 세션</span>
              <strong>{health.sessions.toLocaleString()}</strong>
              <small>최근 {health.days}일</small>
            </div>
            <div className="metric-card static">
              <span className="metric-icon"><Check size={20} /></span>
              <span>수신된 리포트</span>
              <strong>{health.reports.toLocaleString()}</strong>
              <small>최근 {health.days}일</small>
            </div>
            <div className={health.missing > 0 ? "metric-card static warn" : "metric-card static"}>
              <span className="metric-icon"><CircleOff size={20} /></span>
              <span>리포트 누락</span>
              <strong>{health.missing.toLocaleString()}</strong>
              <small>누락률 {percentLabel(health.missing_rate)}</small>
            </div>
            <div className={health.consecutive_missing_days > 0 ? "metric-card static warn" : "metric-card static"}>
              <span className="metric-icon"><AlertTriangle size={20} /></span>
              <span>연속 결측일</span>
              <strong>{health.consecutive_missing_days}</strong>
              <small>0이어야 정상</small>
            </div>
          </div>
          <div className="split-panels">
            <article className="panel">
              <div className="panel-heading"><div><p className="eyebrow">DAILY DELIVERY</p><h2>일자별 세션 대비 리포트</h2></div></div>
              {health.daily.length ? (
                <div className="bar-list">
                  {health.daily.map((day) => (
                    <div className="bar-row" key={day.study_date}>
                      <span>{day.study_date.slice(5)}</span>
                      <div className="bar-track stacked">
                        <span className="filled" style={{ width: `${(day.reports / maxSessions) * 100}%` }} />
                        <span className="missing" style={{ width: `${(day.missing / maxSessions) * 100}%` }} />
                      </div>
                      <b>{day.reports}/{day.sessions}</b>
                      <small>{day.missing ? `${day.missing} 누락` : "정상"}</small>
                    </div>
                  ))}
                </div>
              ) : <EmptyState title="코칭 세션이 없습니다" description="사용자가 ChatGPT 코치와 대화하면 기록됩니다." />}
            </article>
            <article className="panel">
              <div className="panel-heading"><div><p className="eyebrow">WEAKNESS</p><h2>자주 지적된 약점</h2></div></div>
              {health.weakness_top.length ? (
                <div className="code-list">
                  {health.weakness_top.map((item) => (
                    <div key={item.category}><code>{item.category}</code><b>{item.count.toLocaleString()}</b></div>
                  ))}
                </div>
              ) : <EmptyState title="집계된 약점이 없습니다" description="리포트가 쌓이면 카테고리별로 집계됩니다." />}
            </article>
          </div>
        </>
      )}
      <article className="panel">
        <div className="panel-heading">
          <div><p className="eyebrow">SESSION REPORTS</p><h2>수신된 리포트</h2></div>
          <button className="secondary-button" onClick={reload}><RefreshCw size={16} /> 새로고침</button>
        </div>
        <div className="filters">
          <SearchForm value={search} onSearch={setSearch} placeholder="사용자 이메일 또는 이름" />
          <select value={confidence} onChange={(event) => setConfidence(event.target.value)}>
            <option value="">모든 신뢰도</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
          <span className="result-count">{total.toLocaleString()}건</span>
        </div>
        {rows.length ? (
          <div className="report-list">
            {rows.map((row) => (
              <article className="report-row" key={row.id}>
                <div className="report-head">
                  <span className="type-badge type-keyword">{row.study_date}</span>
                  <strong>{row.user_display_name}</strong>
                  <span>{row.user_email}</span>
                  <span className={`status-${row.analysis_confidence.toLowerCase()}`}>{row.analysis_confidence}</span>
                </div>
                <p>{row.summary_ko}</p>
                <dl>
                  <div><dt>약점</dt><dd>{row.weakness_count}</dd></div>
                  <div><dt>교정</dt><dd>{row.correction_count}</dd></div>
                  <div><dt>목표 표현</dt><dd>{row.target_usage_count}</dd></div>
                  <div><dt>근거</dt><dd>{row.evidence_count}</dd></div>
                  <div><dt>루브릭</dt><dd>v{row.rubric_version}</dd></div>
                </dl>
                {row.next_focus.length > 0 && (
                  <small>다음 초점: {row.next_focus.join(", ")}</small>
                )}
              </article>
            ))}
          </div>
        ) : <EmptyState title="수신된 리포트가 없습니다" description="ChatGPT 코치가 대화를 마치면 리포트가 저장됩니다." />}
        <Pagination page={page} pages={pages} setPage={setPage} />
      </article>
    </section>
  );
}

/* ─────────────────────────── 런타임 설정 ───────────────────────────
 * env 로만 관리하면 값 하나 바꿀 때마다 Render 재배포가 필요하다. YouTube
 * 차단 대응처럼 실험이 필요한 설정은 여기서 즉시 토글한다. 화이트리스트에
 * 있는 키만 바뀌고, 전파는 각 인스턴스의 15초 캐시 만료 뒤에 완료된다. */

function SettingsPanel({ items, reload, onError, onNotice }: {
  items: RuntimeSetting[];
  reload: () => Promise<void>;
  onError: (error: unknown) => void;
  onNotice: (message: string) => void;
}) {
  const [busy, setBusy] = useState("");

  async function apply(setting: RuntimeSetting, body: { value?: boolean | string; reset?: boolean }) {
    setBusy(setting.key);
    try {
      await apiFetch(`/api/admin/settings/${setting.key}`, { method: "PATCH", body: JSON.stringify(body) });
      onNotice(`${setting.label} 을 변경했습니다. 모든 인스턴스에 최대 15초 뒤 반영됩니다.`);
      await reload();
    } catch (caught) {
      onError(caught);
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="panel-stack">
      <article className="panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">RUNTIME OVERRIDES</p>
            <h2>재배포 없이 바꾸는 설정</h2>
          </div>
          <button className="secondary-button" onClick={reload}><RefreshCw size={16} /> 새로고침</button>
        </div>
        <p className="panel-note">
          env 값이 기본값이고 여기서 바꾼 값이 그 위에 덮입니다. 각 인스턴스(웹 · Render 러너 · GPU 워커)는
          15초 캐시를 쓰므로 반영에 최대 그만큼 걸립니다.
        </p>
        <div className="setting-list">
          {items.map((setting) => (
            <article className={setting.overridden ? "setting-row overridden" : "setting-row"} key={setting.key}>
              <div>
                <strong>{setting.label}</strong>
                <p>{setting.description}</p>
                <small>
                  <code>{setting.key}</code>
                  {setting.overridden
                    ? ` · env 기본값 ${String(setting.env_default)} 을 덮고 있음`
                    : " · env 기본값 사용 중"}
                </small>
              </div>
              <div className="setting-control">
                {setting.kind === "bool" ? (
                  <button
                    className="icon-button"
                    disabled={busy === setting.key}
                    onClick={() => apply(setting, { value: !setting.value })}
                    aria-label={setting.value ? "끄기" : "켜기"}
                  >
                    {setting.value ? <ToggleRight size={30} /> : <ToggleLeft size={30} />}
                  </button>
                ) : (
                  <select
                    value={String(setting.value)}
                    disabled={busy === setting.key}
                    onChange={(event) => apply(setting, { value: event.target.value })}
                  >
                    {setting.choices.map((choice) => <option key={choice} value={choice}>{choice}</option>)}
                  </select>
                )}
                <button
                  className="text-button"
                  disabled={busy === setting.key || !setting.overridden}
                  onClick={() => apply(setting, { reset: true })}
                >
                  <RotateCcw size={14} /> env 값으로
                </button>
              </div>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}

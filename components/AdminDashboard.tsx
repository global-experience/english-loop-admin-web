"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Activity, Check, ChevronLeft, ChevronRight, CircleOff, Database, ExternalLink,
  History, LayoutDashboard, LoaderCircle, LogOut, Plus, RefreshCw, Search, Settings2,
  ShieldCheck, Sparkles, ToggleLeft, ToggleRight, UserCheck, Users, UserX, Video, X,
} from "lucide-react";
import { ApiError, apiFetch } from "@/lib/api";
import type {
  AdminMember,
  AdminRole,
  AdminUser,
  CollectionRun,
  FeedSource,
  FeedVideo,
  Overview,
  SourceType,
  UserApprovalStatus,
  VideoStatus,
} from "@/lib/types";

type Tab = "overview" | "users" | "sources" | "videos" | "runs";
const PAGE_SIZE = 18;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID_RE = /UC[A-Za-z0-9_-]{22}/;
const CHANNEL_HANDLE_RE = /(?:youtube\.com\/)?@([A-Za-z0-9._-]{3,30})/;

const navItems: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "대시보드", icon: LayoutDashboard },
  { id: "users", label: "사용자", icon: Users },
  { id: "sources", label: "수집 소스", icon: Settings2 },
  { id: "videos", label: "후보 영상", icon: Video },
  { id: "runs", label: "수집 기록", icon: History },
];

function durationLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function dateLabel(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
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
  const [overview, setOverview] = useState<Overview | null>(null);
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [runs, setRuns] = useState<CollectionRun[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<VideoStatus | "">("CANDIDATE");
  const [search, setSearch] = useState("");
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userStatus, setUserStatus] = useState<UserApprovalStatus | "">("PENDING");
  const [userSearch, setUserSearch] = useState("");
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

  const loadOverview = useCallback(async () => {
    setOverview(await apiFetch<Overview>("/api/admin/overview"));
  }, []);

  const loadSources = useCallback(async () => {
    const data = await apiFetch<{ items: FeedSource[] }>("/api/admin/feed/sources");
    setSources(data.items);
  }, []);

  const loadRuns = useCallback(async () => {
    const data = await apiFetch<{ items: CollectionRun[] }>("/api/admin/feed/collection-runs");
    setRuns(data.items);
  }, []);

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

  useEffect(() => {
    setLoading(true);
    setError("");
    const task = tab === "overview" ? loadOverview() : tab === "users" ? loadUsers() : tab === "sources" ? loadSources() : tab === "videos" ? loadVideos() : loadRuns();
    task.catch(handleError).finally(() => setLoading(false));
  }, [tab, loadOverview, loadUsers, loadSources, loadVideos, loadRuns, handleError]);

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
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand"><div className="logo-mark">L</div><div><strong>Loopine</strong><span>Content operations</span></div></div>
        <nav>{navItems.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><item.icon size={19} />{item.label}</button>)}</nav>
        <button className="logout-button" onClick={logout}><LogOut size={18} /> 로그아웃</button>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">CONTENT OPERATIONS</p><h1>{navItems.find((item) => item.id === tab)?.label}</h1></div>
          <button className="primary-button collect-button" onClick={collect} disabled={collecting}>{collecting ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}{collecting ? "수집 중…" : "후보 100개 수집"}</button>
        </header>
        {error && <div className="alert error"><CircleOff size={18} />{error}<button onClick={() => setError("")}><X size={16} /></button></div>}
        {notice && <div className="alert success"><Check size={18} />{notice}<button onClick={() => setNotice("")}><X size={16} /></button></div>}
        {loading ? <div className="loading-state"><LoaderCircle className="spin" /><p>데이터를 불러오는 중입니다.</p></div> : (
          <>
            {tab === "overview" && overview && <OverviewPanel data={overview} onNavigate={setTab} />}
            {tab === "users" && <UsersPanel users={users} members={members} status={userStatus} setStatus={(next) => { setUserPage(1); setUserStatus(next); }} search={userSearch} setSearch={(next) => { setUserPage(1); setUserSearch(next); }} reload={loadUsers} onError={handleError} total={userTotal} page={userPage} setPage={setUserPage} />}
            {tab === "sources" && <SourcesPanel sources={sources} reload={loadSources} onError={handleError} />}
            {tab === "videos" && <VideosPanel videos={videos} status={status} setStatus={(next) => { setPage(1); setStatus(next); }} search={search} setSearch={(next) => { setPage(1); setSearch(next); }} reload={loadVideos} onError={handleError} total={total} page={page} setPage={setPage} />}
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

function UsersPanel({ users, members, status, setStatus, search, setSearch, reload, onError, total, page, setPage }: { users: AdminUser[]; members: AdminMember[]; status: UserApprovalStatus | ""; setStatus: (status: UserApprovalStatus | "") => void; search: string; setSearch: (value: string) => void; reload: () => Promise<void>; onError: (error: unknown) => void; total: number; page: number; setPage: (page: number) => void }) {
  const [busy, setBusy] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminRole, setAdminRole] = useState<AdminRole>("ADMIN");
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
    setBusy(member.user_id);
    try { await apiFetch(`/api/admin/members/${member.user_id}`, { method: "DELETE" }); await reload(); } catch (error) { onError(error); } finally { setBusy(""); }
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <section className="panel-stack"><article className="panel"><div className="panel-heading"><div><p className="eyebrow">ACCOUNT APPROVAL</p><h2>회원 가입 승인</h2></div></div><div className="filters"><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="이메일 또는 이름 검색" /></div><select value={status} onChange={(event) => setStatus(event.target.value as UserApprovalStatus | "")}><option value="">모든 상태</option><option value="PENDING">승인 대기</option><option value="APPROVED">승인됨</option><option value="REJECTED">거절됨</option></select><span className="result-count">{total.toLocaleString()}명</span></div>{users.length ? <div className="user-list">{users.map((user) => <article className="user-row" key={user.id}><span className={`user-status status-${user.approval_status.toLowerCase()}`}>{user.approval_status}</span><div><strong>{user.display_name}</strong><span>{user.email}</span><small>{user.english_level} · {user.goals.join(", ") || "목표 없음"}{user.is_admin ? ` · ${user.admin_role} 관리자` : ""}</small></div><span className="joined-at">{dateLabel(user.created_at)}</span><div className="user-actions">{user.approval_status !== "APPROVED" && <button className="approve-button" onClick={() => approve(user)} disabled={busy === user.id}><UserCheck size={17} /> 승인</button>}{user.approval_status !== "REJECTED" && <button className="reject-button" onClick={() => reject(user)} disabled={busy === user.id}><UserX size={17} /> 거절</button>}</div></article>)}</div> : <EmptyState title="조건에 맞는 사용자가 없습니다" description="필터를 바꾸거나 새 가입 요청을 기다려 주세요." />}<div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button></div></article><article className="panel"><div className="panel-heading"><div><p className="eyebrow">ADMIN MEMBERS</p><h2>관리자 계정</h2></div></div><form className="admin-member-form" onSubmit={addAdmin}><label>관리자 이메일<input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="승인된 사용자 이메일" required /></label><label>권한<select value={adminRole} onChange={(event) => setAdminRole(event.target.value as AdminRole)}><option value="ADMIN">ADMIN</option><option value="OWNER">OWNER</option></select></label><button className="primary-button" disabled={busy === "add-admin"}><ShieldCheck size={17} /> 추가</button></form>{members.length ? <div className="member-list">{members.map((member) => <article className="member-row" key={member.id}><span className="member-icon"><ShieldCheck size={18} /></span><div><strong>{member.display_name}</strong><span>{member.email}</span></div><span className="type-badge type-channel">{member.role}</span><button className="reject-button" onClick={() => removeAdmin(member)} disabled={busy === member.user_id}><X size={17} /> 제거</button></article>)}</div> : <EmptyState title="등록된 관리자가 없습니다" description="ADMIN_EMAILS 부트스트랩 계정으로 접속하면 최초 관리자가 생성됩니다." />}</article></section>;
}

function SourcesPanel({ sources, reload, onError }: { sources: FeedSource[]; reload: () => Promise<void>; onError: (error: unknown) => void }) {
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState("");
  async function seedDefaults() {
    setBusy("defaults");
    try { await apiFetch("/api/admin/feed/sources/defaults", { method: "POST" }); await reload(); } catch (error) { onError(error); } finally { setBusy(""); }
  }
  async function toggle(source: FeedSource) {
    setBusy(source.id);
    try { await apiFetch(`/api/admin/feed/sources/${source.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !source.enabled }) }); await reload(); } catch (error) { onError(error); } finally { setBusy(""); }
  }
  return <section className="panel-stack"><article className="panel"><div className="panel-heading"><div><p className="eyebrow">DISCOVERY INPUTS</p><h2>검색어·채널·직접 영상</h2></div><div className="button-row"><button className="secondary-button" onClick={seedDefaults} disabled={busy === "defaults"}><RefreshCw size={16} /> 기본 소스 채우기</button><button className="primary-button" onClick={() => setShowForm(!showForm)}><Plus size={17} /> 소스 추가</button></div></div>{showForm && <SourceForm onSaved={async () => { setShowForm(false); await reload(); }} onError={onError} />}{sources.length ? <div className="source-list">{sources.map((source) => <article className={source.enabled ? "source-row" : "source-row disabled"} key={source.id}><span className={`type-badge type-${source.source_type.toLowerCase()}`}>{source.source_type}</span><div><strong>{source.label}</strong><span>{source.value}</span>{source.validation && <small className={`source-validation validation-${source.validation.status.toLowerCase()}`}>{source.validation.message}</small>}</div><span className="priority">우선순위 {source.priority}</span><button className="icon-button" onClick={() => toggle(source)} disabled={busy === source.id} aria-label={source.enabled ? "비활성화" : "활성화"}>{source.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}</button></article>)}</div> : <EmptyState title="수집 소스가 없습니다" description="기본 소스를 채우거나 직접 검색어와 채널을 추가하세요." />}</article></section>;
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
    if (validation.status === "ERROR") {
      onError(new Error(validation.message));
      return;
    }
    setBusy(true);
    try { await apiFetch("/api/admin/feed/sources", { method: "POST", body: JSON.stringify({ source_type: sourceType, label, value, priority }) }); await onSaved(); } catch (error) { onError(error); } finally { setBusy(false); }
  }
  return <form className="source-form" onSubmit={submit}><label>유형<select value={sourceType} onChange={(event) => setSourceType(event.target.value as SourceType)}><option value="KEYWORD">검색어</option><option value="CHANNEL">채널·주제</option><option value="VIDEO">직접 영상</option></select></label><label>표시 이름<input value={label} onChange={(event) => setLabel(event.target.value)} required maxLength={120} placeholder="예: 일상 영어 회화" /></label><label className="grow">검색 값<input value={value} onChange={(event) => setValue(event.target.value)} required maxLength={500} placeholder={sourceType === "KEYWORD" ? "Natural English conversation" : sourceType === "CHANNEL" ? "@handle, 채널 URL, UC... 채널 ID 또는 주제어" : "YouTube URL 또는 영상 ID"} />{value.trim() && <small className={`source-validation validation-${validation.status.toLowerCase()}`}>{validation.message}</small>}</label><label>우선순위<input type="number" value={priority} onChange={(event) => setPriority(Number(event.target.value))} min={0} max={100} /></label><button className="primary-button" disabled={busy || validation.status === "ERROR"}>{busy ? "추가 중…" : "추가"}</button></form>;
}

function VideosPanel({ videos, status, setStatus, search, setSearch, reload, onError, total, page, setPage }: { videos: FeedVideo[]; status: VideoStatus | ""; setStatus: (status: VideoStatus | "") => void; search: string; setSearch: (value: string) => void; reload: () => Promise<void>; onError: (error: unknown) => void; total: number; page: number; setPage: (page: number) => void }) {
  const [busy, setBusy] = useState("");
  async function decide(video: FeedVideo, next: VideoStatus) {
    setBusy(video.id);
    try { await apiFetch(`/api/admin/feed/videos/${video.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) }); await reload(); } catch (error) { onError(error); } finally { setBusy(""); }
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return <section className="panel-stack"><div className="filters"><div className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="제목 또는 채널 검색" /></div><select value={status} onChange={(event) => setStatus(event.target.value as VideoStatus | "")}><option value="">모든 상태</option><option value="CANDIDATE">검수 대기</option><option value="APPROVED">승인</option><option value="REJECTED">거절</option><option value="HIDDEN">숨김</option></select><span className="result-count">{total.toLocaleString()}개</span></div>{videos.length ? <div className="video-grid">{videos.map((video) => <article className="video-card" key={video.id}><a className="thumbnail" href={video.youtube_url} target="_blank" rel="noreferrer"><img src={video.thumbnail_url} alt="" /><span>{durationLabel(video.duration_seconds)}</span></a><div className="video-body"><div className="video-badges"><span className={`status-badge status-${video.status.toLowerCase()}`}>{video.status}</span><span className="score">{video.base_score}점</span>{video.caption_available && <span className="caption-badge">CC</span>}</div><h3>{video.title}</h3><p>{video.channel_title}</p><small>{dateLabel(video.published_at)}</small><div className="video-actions"><a className="icon-button" href={video.youtube_url} target="_blank" rel="noreferrer" aria-label="YouTube에서 열기"><ExternalLink size={17} /></a><button className="reject-button" onClick={() => decide(video, "REJECTED")} disabled={busy === video.id}><X size={17} /> 제외</button><button className="approve-button" onClick={() => decide(video, "APPROVED")} disabled={busy === video.id}><Check size={17} /> 승인</button></div></div></article>)}</div> : <EmptyState title="조건에 맞는 영상이 없습니다" description="필터를 바꾸거나 새 후보를 수집해 보세요." />}<div className="pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft size={17} /></button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)}><ChevronRight size={17} /></button></div></section>;
}

function RunsPanel({ runs }: { runs: CollectionRun[] }) {
  return <article className="panel"><div className="panel-heading"><div><p className="eyebrow">COLLECTION HISTORY</p><h2>후보 수집 실행 기록</h2></div></div>{runs.length ? <div className="run-list">{runs.map((run) => <RunRow key={run.id} run={run} />)}</div> : <EmptyState title="수집 기록이 없습니다" description="첫 후보 수집을 실행하면 결과가 여기에 표시됩니다." />}</article>;
}

function RunRow({ run }: { run: CollectionRun }) {
  return <article className="run-row"><span className={`run-status run-${run.status.toLowerCase()}`}>{run.status === "COMPLETED" ? <Check size={17} /> : run.status === "RUNNING" ? <LoaderCircle className="spin" size={17} /> : <CircleOff size={17} />}</span><div><strong>{dateLabel(run.started_at)}</strong><span>{run.trigger === "SCHEDULE" ? "자동 스케줄" : "관리자 실행"}</span>{run.error_message && <small>{run.error_message}</small>}</div><dl><div><dt>발견</dt><dd>{run.discovered_count}</dd></div><div><dt>신규</dt><dd>{run.inserted_count}</dd></div><div><dt>갱신</dt><dd>{run.updated_count}</dd></div></dl></article>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><Database size={28} /><strong>{title}</strong><p>{description}</p></div>;
}

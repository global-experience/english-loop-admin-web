export type SourceType = "KEYWORD" | "CHANNEL" | "VIDEO";
export type VideoStatus = "CANDIDATE" | "APPROVED" | "REJECTED" | "HIDDEN";
/** 어드민 목록의 출처 필터. 사용자 가져오기는 검수 대상이 아니다. */
export type VideoOrigin = "" | "ADMIN" | "USER";
export type UserApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type AdminRole = "OWNER" | "ADMIN";
export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";
export type ExpressionStage =
  | "NEW"
  | "LISTENED"
  | "UNDERSTOOD"
  | "SHADOWED"
  | "USED_WITH_HELP"
  | "USED_SPONTANEOUSLY"
  | "MASTERED";

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  english_level: string;
  goals: string[];
  timezone: string;
  custom_gpt_url: string | null;
  daily_minutes: number;
  recording_retention_days: number;
  approval_status: UserApprovalStatus;
  is_active: boolean;
  is_admin: boolean;
  admin_role: AdminRole | null;
  approved_at: string | null;
  rejected_at: string | null;
  approval_note: string | null;
  created_at: string;
  updated_at: string;
  saved_feeds_count?: number;
  saved_vocabulary_count?: number;
  coaching_sessions_count?: number;
}

export interface AdminMember {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeedCategory {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  /** 지금은 TOPIC 뿐. 난이도 같은 축을 나중에 더할 자리다. */
  kind: string;
  sort_order: number;
  enabled: boolean;
  /** 소스 매핑 외의 자동 규칙. 예: { youtube_category_ids: ["27"] } */
  auto_rule: { youtube_category_ids?: string[] } & Record<string, unknown>;
  video_count?: number;
  created_at: string;
  updated_at: string;
}

export interface VideoCategoryAssignment extends FeedCategory {
  /** ADMIN 이면 자동 재분류가 덮지 않는다. */
  assigned_by: "AUTO" | "ADMIN";
  confidence: number | null;
}

export interface FeedSource {
  id: string;
  source_type: SourceType;
  value: string;
  label: string;
  enabled: boolean;
  priority: number;
  /** 이 소스로 모은 영상이 들어갈 카탈로그 줄. 자동 분류의 1순위 근거다. */
  category_ids: string[];
  validation?: {
    status: "OK" | "WARNING" | "ERROR";
    message: string;
  };
  created_at: string;
  updated_at: string;
}

export interface FeedVideo {
  id: string;
  youtube_video_id: string;
  youtube_url: string;
  source_id: string | null;
  title: string;
  channel_title: string;
  thumbnail_url: string;
  published_at: string | null;
  duration_seconds: number;
  language: string | null;
  caption_available: boolean;
  base_score: number;
  status: VideoStatus;
  description?: string;
  channel_id?: string;
  embeddable?: boolean;
  discovery_method?: string;
  /** 누가 만들었나. null 이면 수집기(어드민)다. */
  created_by_user_id: string | null;
  /** 표시용 "이름 (이메일)". 목록에서만 채워진다. */
  created_by?: string | null;
  /** 누가 볼 수 있나. 귀속과 별개다 — 승격해도 작성자는 유지된다. */
  visibility: "PUBLIC" | "PRIVATE";
  raw_metadata?: Record<string, unknown>;
  transcript?: {
    exists: boolean;
    pipeline_version: number | null;
    segment_count: number;
    updated_at: string | null;
  };
}

export interface UserSavedVideo {
  id: string;
  status: "PROCESSING" | "READY" | "FAILED";
  error_message: string | null;
  youtube_job_id: string | null;
  learning_content_id: string | null;
  created_at: string;
  updated_at: string;
  video: FeedVideo;
}

export interface Expression {
  id: string;
  canonical_text: string;
  korean_meaning: string;
  example_sentence: string;
  category: string;
  level: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface UserVocabulary {
  id: string;
  current_stage: ExpressionStage;
  first_seen_at: string;
  last_seen_at: string;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  listened_count: number;
  understood_count: number;
  shadowed_count: number;
  used_with_help_count: number;
  used_spontaneously_count: number;
  review_interval_index: number;
  mastered_at: string | null;
  expression: Expression;
}

export interface CoachingHistory {
  id: string;
  study_date: string;
  provider: string;
  status: string;
  started_at: string | null;
  voice_finished_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  report: null | {
    id: string;
    summary_ko: string;
    topics: string[];
    scores: Record<string, number>;
    weaknesses: Array<Record<string, unknown>>;
    next_focus: string[];
    analysis_confidence: string;
    created_at: string;
  };
}

export interface YouTubeJob {
  id: string;
  user_id: string;
  video_id: string;
  source_url: string;
  languages: string[];
  status: JobStatus;
  provider: string;
  execution_target: string;
  progress: number;
  attempts: number;
  claimed_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkerHeartbeat {
  worker_id: string;
  worker_type: string;
  gpu_available: boolean;
  model_loaded: boolean;
  queue_length: number;
  capabilities: Record<string, unknown>;
  last_seen_at: string;
  stale: boolean;
}

export interface CollectionRun {
  id: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  requested_count: number;
  discovered_count: number;
  inserted_count: number;
  updated_count: number;
  error_message: string | null;
  trigger: string;
  started_at: string;
  completed_at: string | null;
}

export interface Overview {
  sources: number;
  active_sources: number;
  videos: Record<VideoStatus, number>;
  users?: { pending: number; approved: number; rejected: number };
  admins?: number;
  last_run: CollectionRun | null;
  activity?: LearningActivity;
  transcripts?: TranscriptStats;
  reports?: ReportHealth;
}

/** 실사용 지표. 값이 0 이면 학습 루프 어딘가가 조용히 끊긴 것이다. */
export interface LearningActivity {
  window_days: number;
  active_today: number;
  active_week: number;
  routine_completions: number;
  routine_completed: number;
  routine_completion_rate: number | null;
  speech_attempts: number;
  speech_by_provider: { provider: string; count: number }[];
  sessions_completed: number;
}

export interface TranscriptStats {
  total: number;
  stale: number;
  empty: number;
  pipeline_version: number;
  hits: number;
  misses: number;
  hit_rate: number | null;
  by_source: { source: string; count: number; hits: number }[];
  recent_errors: { error_code: string; count: number }[];
  error_window_days: number;
}

export interface TranscriptRow {
  video_id: string;
  pipeline_version: number;
  stale: boolean;
  source: string | null;
  segment_count: number;
  hit_count: number;
  last_hit_at: string | null;
  language_code: string | null;
  is_generated: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptDetail extends TranscriptRow {
  youtube_url: string;
  translated_segment_count: number;
  preview: {
    sequence: number;
    start_ms: number;
    end_ms: number;
    english_text: string;
    translation: string | null;
    translation_model: string | null;
  }[];
}

export interface ReportHealth {
  days: number;
  sessions: number;
  reports: number;
  missing: number;
  missing_rate: number | null;
  /** 1 이상이면 ChatGPT 연동이 끊긴 것으로 봐야 한다. */
  consecutive_missing_days: number;
  daily: { study_date: string; sessions: number; reports: number; missing: number }[];
  weakness_top: { category: string; count: number }[];
}

export interface ReportRow {
  id: string;
  coach_session_id: string;
  user_id: string;
  user_email: string;
  user_display_name: string;
  study_date: string;
  provider: string;
  session_status: string;
  summary_ko: string;
  topics: string[];
  scores: Record<string, number>;
  next_focus: string[];
  weakness_count: number;
  correction_count: number;
  target_usage_count: number;
  analysis_confidence: string;
  rubric_version: string;
  evidence_count: number;
  report_received_at: string | null;
  created_at: string;
}

/**
 * 추천 품질 지표. 랭킹을 바꾼 게 좋아졌는지 보려면 배포 전 기준선이 필요하다.
 * `GET /api/admin/feed/quality` 의 응답 모양과 1:1 이다.
 */
export interface RecommendationQuality {
  days: number;
  views: number;
  conversions: number;
  /** 노출이 0이면 계산할 수 없어 null 이다. */
  conversion_rate: number | null;
  saves: number;
  open_learning: number;
  skips: number;
  likes: number;
  imports: number;
  categories: {
    slug: string;
    label: string;
    videos: number;
    interested: number;
    /** 관심자는 있는데 재고가 목표 미만 — 수집을 더 기울여야 한다. */
    short: boolean;
  }[];
  quota: {
    searches_today: number;
    daily_cap: number;
    per_run_budget: number;
  };
}

export interface RuntimeSetting {
  key: string;
  label: string;
  description: string;
  kind: "bool" | "choice" | "number";
  choices: string[];
  /** number 설정에만 값이 있다. 입력에 그대로 걸어 422 왕복을 줄인다. */
  minimum: number | null;
  maximum: number | null;
  value: boolean | string | number;
  env_default: boolean | string | number;
  /** true 면 DB 오버레이가 env 값을 덮고 있다. */
  overridden: boolean;
}

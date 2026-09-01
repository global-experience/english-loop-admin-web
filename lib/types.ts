export type SourceType = "KEYWORD" | "CHANNEL" | "VIDEO";
export type VideoStatus = "CANDIDATE" | "APPROVED" | "REJECTED" | "HIDDEN";
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

export interface FeedSource {
  id: string;
  source_type: SourceType;
  value: string;
  label: string;
  enabled: boolean;
  priority: number;
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
}

export type SourceType = "KEYWORD" | "CHANNEL" | "VIDEO";
export type VideoStatus = "CANDIDATE" | "APPROVED" | "REJECTED" | "HIDDEN";
export type UserApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";
export type AdminRole = "OWNER" | "ADMIN";

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

export function getApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
  const isLoopback = configured === "http://localhost:8000" || configured === "http://127.0.0.1:8000";
  if (configured && !isLoopback) return configured;
  if (typeof window !== "undefined") return `${window.location.protocol}//${window.location.hostname}:8000`;
  return "http://localhost:8000";
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function csrfToken() {
  if (typeof document === "undefined") return "";
  return document.cookie.split("; ").find((value) => value.startsWith("csrf_token="))?.split("=")[1] || "";
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  const internalSecret = process.env.NEXT_PUBLIC_INTERNAL_API_SECRET || "loopine-internal-secret-dev-key";
  headers.set("X-Internal-Secret", internalSecret);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("X-CSRF-Token", decodeURIComponent(csrfToken()));
  const response = await fetch(`${getApiBase()}${path}`, { cache: "no-store", credentials: "include", ...init, headers });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = data?.error;
    throw new ApiError(response.status, error?.code || "REQUEST_FAILED", error?.message || "요청을 처리하지 못했습니다.");
  }
  return data as T;
}

const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const ACCESS_KEY = "aula.access_token";
const REFRESH_KEY = "aula.refresh_token";
const MUST_CHANGE_KEY = "aula.must_change";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function mustChangeCredentials(): boolean {
  return localStorage.getItem(MUST_CHANGE_KEY) === "1";
}

export function setSession(tokens: {
  access_token: string;
  refresh_token: string;
  must_change_credentials: boolean;
}): void {
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
  localStorage.setItem(MUST_CHANGE_KEY, tokens.must_change_credentials ? "1" : "0");
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(MUST_CHANGE_KEY);
}

async function parseError(response: Response): Promise<string> {
  let detail = response.statusText || "Error";
  try {
    const body = (await response.json()) as { detail?: string | { msg?: string }[] };
    if (typeof body.detail === "string") detail = body.detail;
    else if (Array.isArray(body.detail))
      detail = body.detail.map((d) => d.msg ?? "invalid").join("; ");
  } catch {
    // sin cuerpo JSON
  }
  return detail;
}

export async function apiGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE}${path}`, {
    headers,
    credentials: "include",
    signal,
  });
  if (!response.ok) throw new ApiError(response.status, await parseError(response));
  return (await response.json()) as T;
}

export async function apiSend<T>(
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  if (!response.ok) throw new ApiError(response.status, await parseError(response));
  return (await response.json()) as T;
}

export async function apiUpload<T>(path: string, file: File): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    credentials: "include",
    body: form,
  });
  if (!response.ok) throw new ApiError(response.status, await parseError(response));
  return (await response.json()) as T;
}

export type HealthPayload = {
  status: string;
  app: string;
  version: string;
  time: string;
};

export type TokenPayload = {
  access_token: string;
  token_type: string;
  refresh_token: string;
  must_change_credentials: boolean;
};

export type CoursePublic = {
  id: number;
  name: string;
  description: string | null;
  code: string;
  status: string;
  layout_rows: number;
  layout_cols: number;
  settings: Record<string, unknown>;
  created_at: string;
};

export type ClassroomSeat = {
  seat_id: number;
  row: number;
  col: number;
  enrollment_id: number | null;
  student_id: number | null;
  student_name: string | null;
  student_username: string | null;
  status: string | null;
};

export type ClassroomPayload = {
  course: CoursePublic;
  seats: ClassroomSeat[];
  rows: number;
  cols: number;
  teachers: { id: number; name: string }[];
};

export type AssignmentPublic = {
  id: number;
  course_id: number;
  section_id: number | null;
  title: string;
  description_markdown: string;
  due_at: string | null;
  max_score: string;
  visibility: string;
  rubric_id: number | null;
  created_by: number;
  created_at: string;
};

export type EvaluationPublic = {
  id: number;
  submission_id: number;
  teacher_id: number;
  score: string | null;
  rubric_scores: Record<string, unknown>;
  comment_markdown: string;
  created_at: string;
};

export type SubmissionFilePublic = {
  id: number;
  original_name: string;
  mime: string;
  size_bytes: number;
  sha256: string;
};

export type SubmissionPublic = {
  id: number;
  assignment_id: number | null;
  course_id: number;
  student_id: number;
  github_url: string | null;
  notes: string;
  status: string;
  submitted_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  files: SubmissionFilePublic[];
  latest_evaluation: EvaluationPublic | null;
  evaluations: EvaluationPublic[];
  student_name: string | null;
};

export type EnrollmentPublic = {
  id: number;
  course_id: number;
  student_id: number;
  seat_id: number | null;
  status: string;
  student_name: string | null;
  student_username: string | null;
  seat_row: number | null;
  seat_col: number | null;
};

export type SectionKind = "content" | "external";

export type SectionPublic = {
  id: number;
  course_id: number;
  title: string;
  slug: string;
  order: number;
  kind: SectionKind;
  body_markdown: string | null;
  external_url: string | null;
};

export type AnnouncementPublic = {
  id: number;
  course_id: number;
  author_id: number;
  title: string;
  body_markdown: string;
  created_at: string;
  author_name: string | null;
};

export type UserPublic = {
  id: number;
  name: string;
  email: string | null;
  username: string | null;
  role: "admin" | "teacher" | "student";
  is_active: boolean;
  must_change_credentials: boolean;
  created_at: string;
};

export type AdminUserPublic = UserPublic;

export type PinResetResponse = {
  user_id: number;
  pin: string;
  must_change_credentials: boolean;
};

export type CsvImportResult = {
  created: number;
  skipped: number;
  pins: Record<string, string>;
};

export type AuditLogPublic = {
  id: number;
  actor_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  course_id: number | null;
  payload: Record<string, unknown>;
  ip: string | null;
  created_at: string;
  actor_name: string | null;
};

export type RubricCriterion = {
  id: string;
  label: string;
  max: number;
};

export type RubricPublic = {
  id: number;
  course_id: number;
  title: string;
  criteria: RubricCriterion[];
  created_by: number;
  created_at: string;
};

export type AttendanceStatus = "present" | "late" | "absent" | "excused";

export type AttendanceRecordPublic = {
  id: number;
  course_id: number;
  student_id: number;
  date: string;
  status: AttendanceStatus;
  student_name: string | null;
  student_username: string | null;
  seat_row: number | null;
  seat_col: number | null;
};

export type AttendanceDayResponse = {
  date: string;
  records: AttendanceRecordPublic[];
};

export type AttendanceSummaryItem = {
  student_id: number;
  student_name: string | null;
  student_username: string | null;
  present: number;
  late: number;
  absent: number;
  excused: number;
};

export type CalendarEvent = {
  kind: "assignment" | "announcement";
  id: number;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  body_markdown: string | null;
};

export type GithubMetaResponse = {
  url: string;
  full_name: string | null;
  description: string | null;
  language: string | null;
  default_branch: string | null;
  stars: number | null;
  pushed_at: string | null;
  html_url: string | null;
  cached: boolean;
  ok: boolean;
  error: string | null;
};

export type RgpdExportResponse = {
  user: Record<string, unknown>;
  enrollments: unknown[];
  submissions: unknown[];
  evaluations: unknown[];
  attendance: unknown[];
  exported_at: string;
};

export async function apiDownload(path: string, filename: string): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${BASE}${path}`, { headers, credentials: "include" });
  if (!response.ok) throw new ApiError(response.status, await parseError(response));
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

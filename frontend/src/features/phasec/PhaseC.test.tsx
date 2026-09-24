import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "../../app/theme";
import { MultiCourseDashboardPage } from "./MultiCourseDashboardPage";
import { CenterSettingsPage } from "./CenterSettingsPage";
import { ReportsPage } from "./ReportsPage";
import { GradebookPage } from "./GradebookPage";
import { InstitutionalCalendarPage } from "./InstitutionalCalendarPage";

function renderPage(ui: ReactNode, path = "/admin/multi") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            <Routes>
              <Route path="/admin/multi" element={ui} />
              <Route path="/admin/settings" element={ui} />
              <Route path="/admin/reports" element={ui} />
              <Route path="/calendar" element={ui} />
              <Route path="/courses/:courseId/gradebook" element={ui} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function adminAuth() {
  return {
    id: 1,
    name: "Admin",
    email: "admin@aula.test",
    username: null,
    role: "admin",
    is_active: true,
    must_change_credentials: false,
    created_at: new Date().toISOString(),
  };
}

function stubFetch(handlers: (url: string, init?: RequestInit) => Response | undefined) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const custom = handlers(url, init);
      if (custom) return Promise.resolve(custom);
      return Promise.resolve(json({}));
    }),
  );
}

describe("Fase C frontend", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "admin-token");
    localStorage.setItem("aula.must_change", "0");
  });

  it("muestra el dashboard multi-curso con totales y tabla", async () => {
    stubFetch((url) => {
      if (url.includes("/auth/me")) return json(adminAuth());
      if (url.includes("/admin/dashboard/multi"))
        return json({
          totals: { courses: 1, enrolled: 1, assignments: 1, submissions: 2, pending: 1 },
          courses: [
            {
              course_id: 1,
              name: "Java",
              code: "JAVA1",
              status: "active",
              enrolled: 1,
              assignments: 1,
              submissions_total: 2,
              submissions_pending: 1,
              completion_rate: 66.7,
            },
          ],
        });
      return undefined;
    });

    renderPage(<MultiCourseDashboardPage />);
    expect(await screen.findByText("Vista multi-curso")).toBeInTheDocument();
    expect(await screen.findByText("Matrículas")).toBeInTheDocument();
    expect(screen.getByText("Java")).toBeInTheDocument();
    expect(screen.getByText("66.7%")).toBeInTheDocument();
  });

  it("carga y guarda los ajustes del centro", async () => {
    const user = userEvent.setup();
    stubFetch((url, init) => {
      if (url.includes("/auth/me")) return json(adminAuth());
      if (url.includes("/admin/settings") && (!init || !init.method))
        return json({
          center_name: "Aspasia",
          support_email: null,
          default_visibility: "private",
          allow_peer_submissions: false,
          pin_length: 6,
          max_upload_mb: 10,
          terms_markdown: "",
        });
      if (url.includes("/admin/settings") && init?.method === "PUT") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        return json({
          center_name: "Aspasia",
          support_email: null,
          default_visibility: "private",
          allow_peer_submissions: false,
          pin_length: 6,
          max_upload_mb: 10,
          terms_markdown: "",
          ...body,
        });
      }
      return undefined;
    });

    renderPage(<CenterSettingsPage />, "/admin/settings");
    const input = await screen.findByLabelText("Nombre del centro");
    expect(input).toHaveValue("Aspasia");

    await user.clear(input);
    await user.type(input, "IES Aspasia");
    await user.click(screen.getByRole("button", { name: /guardar ajustes/i }));

    expect(await screen.findByText("Ajustes guardados")).toBeInTheDocument();
    expect(input).toHaveValue("IES Aspasia");
  });

  it("lista el informe de reportes y ofrece exportar CSV", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    stubFetch((url) => {
      if (url.includes("/auth/me")) return json(adminAuth());
      if (url.includes("/admin/reports/overview"))
        return json({
          generated_at: "2026-09-24T10:00:00Z",
          center_name: "Aspasia",
          totals: { courses: 1, enrolled: 2, submissions: 3, reviewed: 1 },
          courses: [
            {
              course_id: 1,
              name: "Java",
              code: "JAVA1",
              status: "active",
              enrolled: 2,
              assignments: 2,
              submissions: 3,
              reviewed: 1,
              avg_score: 87.5,
              attendance_present: 4,
              attendance_absent: 1,
            },
          ],
        });
      return undefined;
    });

    renderPage(<ReportsPage />, "/admin/reports");
    expect(await screen.findByText("Reportes")).toBeInTheDocument();
    expect(screen.getByText("87.5")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /exportar csv/i }));
    await waitFor(() => expect(vi.mocked(globalThis.fetch)).toHaveBeenCalled());
  });

  it("renderiza la matriz del gradebook", async () => {
    stubFetch((url) => {
      if (url.includes("/auth/me")) return json(adminAuth());
      if (url.includes("/gradebook"))
        return json({
          course_id: 1,
          course_name: "Java",
          columns: [{ assignment_id: 10, title: "Tarea 1", max_score: "100.00" }],
          students: [
            {
              student_id: 2,
              name: "Ana",
              username: "ana1",
              cells: { "10": { assignment_id: 10, status: "reviewed", score: "87.50" } },
              average: "87.5",
            },
          ],
        });
      return undefined;
    });

    renderPage(<GradebookPage />, "/courses/1/gradebook");
    expect(await screen.findByText(/gradebook · java/i)).toBeInTheDocument();
    expect(screen.getByText("Tarea 1")).toBeInTheDocument();
    expect(screen.getByText("87.50")).toBeInTheDocument();
    expect(screen.getByText("@ana1")).toBeInTheDocument();
  });

  it("lista el calendario institucional agrupado por curso", async () => {
    stubFetch((url) => {
      if (url.includes("/auth/me")) return json(adminAuth());
      if (url.includes("/calendar/institutional"))
        return json([
          {
            kind: "assignment",
            id: 1,
            title: "Entrega final",
            course_id: 1,
            course_name: "Java",
            course_code: "JAVA1",
            starts_at: null,
            ends_at: "2026-10-01T10:00:00Z",
          },
          {
            kind: "announcement",
            id: 2,
            title: "Aviso",
            course_id: 1,
            course_name: "Java",
            course_code: "JAVA1",
            starts_at: "2026-09-20T10:00:00Z",
            ends_at: null,
          },
        ]);
      return undefined;
    });

    renderPage(<InstitutionalCalendarPage />, "/calendar");
    expect(await screen.findByText("Calendario institucional")).toBeInTheDocument();
    expect(screen.getByText("Entrega final")).toBeInTheDocument();
    expect(screen.getByText("Aviso")).toBeInTheDocument();
    expect(screen.getAllByText("Ir al curso →")).toHaveLength(2);
  });
});

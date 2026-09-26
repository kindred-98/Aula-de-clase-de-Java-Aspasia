import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppRoutes } from "../../app/routes";
import { ThemeProvider } from "../../app/theme";
import { AuthProvider } from "../auth/AuthContext";

function renderRoutes(initialEntries: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function authAs(role: "teacher" | "student" | "org_admin", effective?: string[]) {
  const name = role === "teacher" ? "Profe" : role === "org_admin" ? "Admin" : "Ana";
  const granted = effective ?? (role === "org_admin" ? ["reports.view"] : []);
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes("/auth/me"))
        return Promise.resolve(
          json({
            id: 1,
            name,
            email: `${role}@aula.test`,
            username: null,
            role,
            is_active: true,
            must_change_credentials: false,
            created_at: new Date().toISOString(),
          }),
        );
      if (url.includes("/auth/permissions"))
        return json({
          permissions: ["reports.view", "grades.edit", "attendance.manage"],
          effective: granted,
        });
      if (url.includes("/admin/reports/overview"))
        return json({
          generated_at: "2026-09-25T10:00:00Z",
          center_name: "Aspasia",
          totals: { courses: 1, enrolled: 2, submissions: 3, reviewed: 1 },
          courses: [
            {
              course_id: 1,
              name: "Java",
              code: "JAVA",
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
      if (url.includes("/teacher/dashboard"))
        return Promise.resolve(
          json({
            totals: {
              courses_count: 1,
              students_count: 10,
              pending_evaluations: 2,
              due_this_week: 1,
              open_assignments: 3,
            },
            courses: [
              {
                id: 1,
                name: "Java",
                code: "JAVA",
                status: "active",
                students: 10,
                pending: 2,
                open_assignments: 3,
                next_due_at: "2026-10-01T10:00:00Z",
              },
            ],
            upcoming: [
              {
                course_id: 1,
                course_name: "Java",
                assignment_id: 9,
                title: "Tarea 9",
                due_at: "2026-10-01T10:00:00Z",
              },
            ],
            recent: [
              {
                course_id: 1,
                course_name: "Java",
                assignment_title: "Tarea 9",
                student_name: "Ana",
                status: "submitted",
                submitted_at: "2026-09-24T10:00:00Z",
              },
            ],
          }),
        );
      if (url.includes("/teacher/pending-count")) return Promise.resolve(json({ pending: 2 }));
      if (url.includes("/courses/1/overview"))
        return Promise.resolve(
          json({
            course_id: 1,
            course_name: "Java",
            assignment_stats: [
              { assignment_id: 9, title: "Tarea 9", submitted: 5, total: 10, pct: 50 },
            ],
            student_stats: [
              {
                student_id: 2,
                name: "Ana",
                submitted: 3,
                pending: 1,
                last_score: 87.5,
                attendance_pct: 90,
              },
            ],
          }),
        );
      if (url.includes("/courses/1/students/2"))
        return Promise.resolve(
          json({
            student_id: 2,
            name: "Ana",
            username: "ana",
            course_id: 1,
            course_name: "Java",
            submitted: 3,
            pending: 1,
            average_score: 87.5,
            attendance: { present: 9, late: 1, absent: 1, excused: 0, pct: 90.9 },
            submissions: [
              {
                submission_id: 5,
                assignment_id: 9,
                assignment_title: "Tarea 9",
                status: "reviewed",
                submitted_at: "2026-09-24T10:00:00Z",
                score: 87.5,
                evaluated_at: "2026-09-25T10:00:00Z",
              },
            ],
          }),
        );
      if (url.includes("/teacher/queue"))
        return Promise.resolve(
          json({
            items: [
              {
                submission_id: 5,
                course_id: 1,
                course_name: "Java",
                assignment_id: 9,
                assignment_title: "Tarea 9",
                student_id: 2,
                student_name: "Ana",
                status: "submitted",
                submitted_at: "2026-09-24T10:00:00Z",
                due_at: "2026-10-01T10:00:00Z",
              },
            ],
            total: 1,
            page: 1,
            page_size: 20,
          }),
        );
      if (url.includes("/me/courses")) return Promise.resolve(json([]));
      return Promise.resolve(json({ total: 0 }));
    }),
  );
}

describe("Fase T0 — estructura del panel del profesor", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "session-token");
    localStorage.setItem("aula.must_change", "0");
  });

  it("el teacher ve el layout con sus secciones", async () => {
    authAs("teacher");
    renderRoutes(["/teacher"]);

    expect(await screen.findByRole("heading", { name: /panel del profesor/i })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: /panel del profesor/i });
    expect(within(nav).getByRole("link", { name: /cola de evaluación/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /mis cursos/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Panel" })).toBeInTheDocument();
  });

  it("el dashboard muestra KPIs, cursos y actividad", async () => {
    authAs("teacher");
    renderRoutes(["/teacher"]);

    expect(await screen.findByText("Por revisar")).toBeInTheDocument();
    expect(screen.getByText("Fechas esta semana")).toBeInTheDocument();
    expect(screen.getByText("10 alumnos")).toBeInTheDocument();
    expect(screen.getByText("Tarea 9")).toBeInTheDocument();
  });

  it("la cola de evaluación lista entregas en /teacher/queue", async () => {
    authAs("teacher");
    renderRoutes(["/teacher/queue"]);

    expect(await screen.findByRole("heading", { name: /cola de evaluación/i })).toBeInTheDocument();
    expect(await screen.findByText("Ana")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /evaluar/i })).toBeInTheDocument();
    expect(await screen.findByLabelText(/entregas por revisar/i)).toBeInTheDocument();
  });

  it("el panel de curso muestra progreso de tareas y alumnos", async () => {
    authAs("teacher");
    renderRoutes(["/teacher/courses/1"]);

    expect(await screen.findByRole("heading", { name: "Java" })).toBeInTheDocument();
    expect(screen.getByText("Tarea 9")).toBeInTheDocument();
    expect(screen.getByText(/5\/10 entregas/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Ana/ })).toBeInTheDocument();
    expect(screen.getByText("3 entregadas")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Notas/ })).toBeInTheDocument();
  });

  it("la ficha del alumno muestra media, asistencia y entregas", async () => {
    authAs("teacher");
    renderRoutes(["/teacher/courses/1/students/2"]);

    expect(await screen.findByRole("heading", { name: "Ana" })).toBeInTheDocument();
    expect(screen.getByText("Nota media")).toBeInTheDocument();
    expect(screen.getByText("87.5")).toBeInTheDocument();
    expect(screen.getByText("90.9%")).toBeInTheDocument();
    expect(screen.getByText("Tarea 9")).toBeInTheDocument();
    expect(screen.getByText("Revisado")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /volver al curso/i })).toBeInTheDocument();
  });

  it("un student es redirigido fuera del panel", async () => {
    authAs("student");
    renderRoutes(["/teacher"]);

    expect(
      await screen.findByRole("heading", { name: /plataforma de aula virtual/i }),
    ).toBeInTheDocument();
  });

  it("un admin supera el guard", async () => {
    authAs("org_admin");
    renderRoutes(["/teacher"]);

    expect(await screen.findByRole("heading", { name: /panel del profesor/i })).toBeInTheDocument();
  });
});

describe("Fase T4 — permisos, reportes y export", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "session-token");
    localStorage.setItem("aula.must_change", "0");
  });

  it("oculta el enlace Informes sin reports.view", async () => {
    authAs("teacher");
    renderRoutes(["/teacher"]);

    const nav = await screen.findByRole("navigation", { name: /panel del profesor/i });
    expect(within(nav).queryByRole("link", { name: /informes/i })).not.toBeInTheDocument();
  });

  it("un teacher con reports.view entra en /admin/reports", async () => {
    const user = userEvent.setup();
    authAs("teacher", ["reports.view"]);
    renderRoutes(["/teacher"]);

    const teacherNav = await screen.findByRole("navigation", { name: /panel del profesor/i });
    await user.click(within(teacherNav).getByRole("link", { name: /informes/i }));

    expect(await screen.findByRole("heading", { name: "Reportes" })).toBeInTheDocument();
    const adminNav = await screen.findByRole("navigation", { name: /administración/i });
    expect(within(adminNav).getByRole("link", { name: /mensajes/i })).toBeInTheDocument();
    expect(within(adminNav).getByRole("link", { name: /reportes/i })).toBeInTheDocument();
    expect(within(adminNav).queryByRole("link", { name: /dashboard/i })).not.toBeInTheDocument();
    expect(within(adminNav).queryByRole("link", { name: /usuarios/i })).not.toBeInTheDocument();
  });

  it("un teacher sin reports.view es redirigido desde /admin/reports", async () => {
    authAs("teacher");
    renderRoutes(["/admin/reports"]);

    expect(
      await screen.findByRole("heading", { name: /plataforma de aula virtual/i }),
    ).toBeInTheDocument();
  });

  it("un admin accede directo a /admin/reports", async () => {
    authAs("org_admin");
    renderRoutes(["/admin/reports"]);

    expect(await screen.findByRole("heading", { name: "Reportes" })).toBeInTheDocument();
    const adminNav = await screen.findByRole("navigation", { name: /administración/i });
    expect(within(adminNav).getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
  });

  it("exporta las notas del curso en CSV", async () => {
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const user = userEvent.setup();
    authAs("teacher");
    renderRoutes(["/teacher/courses/1"]);

    const button = await screen.findByRole("button", { name: /exportar notas csv/i });
    await user.click(button);

    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  });
});

import { render, screen, within } from "@testing-library/react";
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

function authAs(role: "teacher" | "student" | "admin") {
  const name = role === "teacher" ? "Profe" : role === "admin" ? "Admin" : "Ana";
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

  it("la cola de evaluación responde en /teacher/queue", async () => {
    authAs("teacher");
    renderRoutes(["/teacher/queue"]);

    expect(await screen.findByRole("heading", { name: /cola de evaluación/i })).toBeInTheDocument();
    expect(screen.getByText(/fase t2/i)).toBeInTheDocument();
  });

  it("un student es redirigido fuera del panel", async () => {
    authAs("student");
    renderRoutes(["/teacher"]);

    expect(
      await screen.findByRole("heading", { name: /plataforma de aula virtual/i }),
    ).toBeInTheDocument();
  });

  it("un admin supera el guard", async () => {
    authAs("admin");
    renderRoutes(["/teacher"]);

    expect(await screen.findByRole("heading", { name: /panel del profesor/i })).toBeInTheDocument();
  });
});

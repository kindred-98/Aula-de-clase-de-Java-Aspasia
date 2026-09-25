import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppRoutes } from "../../app/routes";
import { ThemeProvider } from "../../app/theme";
import { AuthProvider } from "../auth/AuthContext";
import { homePathAfterLogin } from "../auth/homePath";

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

function authAs(role: "teacher" | "student" | "admin", pending = 2) {
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
            username: role === "student" ? "ana" : null,
            role,
            is_active: true,
            must_change_credentials: false,
            created_at: new Date().toISOString(),
          }),
        );
      if (url.includes("/student/dashboard"))
        return Promise.resolve(
          json({
            totals: {
              courses_count: 1,
              pending_submissions: 2,
              due_this_week: 1,
              graded_submissions: 1,
            },
            courses: [
              {
                id: 1,
                name: "Java",
                code: "JAVA",
                status: "active",
                pending: 2,
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
                assignment_id: 9,
                assignment_title: "Tarea 9",
                score: 87.5,
                evaluated_at: "2026-09-24T10:00:00Z",
              },
            ],
            pending_items: [
              {
                course_id: 1,
                course_name: "Java",
                assignment_id: 9,
                title: "Tarea 9",
                due_at: "2026-10-01T10:00:00Z",
              },
            ],
          }),
        );
      if (url.includes("/student/pending-count")) return Promise.resolve(json({ pending }));
      return Promise.resolve(json({ total: 0 }));
    }),
  );
}

function tokenWithRole(role: string): string {
  return `header.${btoa(JSON.stringify({ role }))}.signature`;
}

describe("Fase S0 — estructura del panel del alumno", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "session-token");
    localStorage.setItem("aula.must_change", "0");
  });

  it("el student ve el layout con sus secciones", async () => {
    authAs("student");
    renderRoutes(["/student"]);

    expect(await screen.findByRole("heading", { name: /panel del alumno/i })).toBeInTheDocument();
    const nav = screen.getByRole("navigation", { name: /panel del alumno/i });
    expect(within(nav).getByRole("link", { name: /inicio/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /mis cursos/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /calendario/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /mensajes/i })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: /mi cuenta/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it("un teacher es redirigido fuera del panel del alumno", async () => {
    authAs("teacher");
    renderRoutes(["/student"]);

    expect(
      await screen.findByRole("heading", { name: /plataforma de aula virtual/i }),
    ).toBeInTheDocument();
  });

  it("un admin supera el guard", async () => {
    authAs("admin");
    renderRoutes(["/student"]);

    expect(await screen.findByRole("heading", { name: /panel del alumno/i })).toBeInTheDocument();
  });

  it("el enlace Panel del alumno aparece en la nav global", async () => {
    authAs("student");
    renderRoutes(["/student"]);

    expect(await screen.findByRole("link", { name: "Panel" })).toBeInTheDocument();
  });
});

describe("Fase S1 — dashboard del alumno", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "session-token");
    localStorage.setItem("aula.must_change", "0");
  });

  it("muestra KPIs, cursos, próximas entregas y evaluaciones", async () => {
    authAs("student");
    renderRoutes(["/student"]);

    expect(await screen.findByRole("heading", { name: /panel del alumno/i })).toBeInTheDocument();
    expect(screen.getByText("Fechas esta semana")).toBeInTheDocument();
    expect(screen.getByText("Evaluadas")).toBeInTheDocument();
    expect(screen.getAllByText("Mis cursos").length).toBeGreaterThan(1);
    expect(screen.getAllByText("Por entregar").length).toBeGreaterThan(1);
    expect(screen.getByText("Evaluaciones recientes")).toBeInTheDocument();
    expect(screen.getAllByText("Tarea 9").length).toBeGreaterThan(1);
    expect(screen.getByText("87.5")).toBeInTheDocument();
    expect((await screen.findAllByText("Java")).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /2 por entregar/i })).toBeInTheDocument();
  });

  it("muestra estado vacío si no hay cursos matriculados", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/auth/me"))
          return Promise.resolve(
            json({
              id: 1,
              name: "Ana",
              email: "student@aula.test",
              username: "ana",
              role: "student",
              is_active: true,
              must_change_credentials: false,
              created_at: new Date().toISOString(),
            }),
          );
        if (url.includes("/student/dashboard"))
          return Promise.resolve(
            json({
              totals: {
                courses_count: 0,
                pending_submissions: 0,
                due_this_week: 0,
                graded_submissions: 0,
              },
              courses: [],
              upcoming: [],
              recent: [],
              pending_items: [],
            }),
          );
        if (url.includes("/student/pending-count")) return Promise.resolve(json({ pending: 0 }));
        return Promise.resolve(json({ total: 0 }));
      }),
    );
    renderRoutes(["/student"]);

    expect(await screen.findByText("Sin cursos matriculados")).toBeInTheDocument();
    expect(screen.getByText("Nada por entregar")).toBeInTheDocument();
    expect(screen.getByText("Sin evaluaciones")).toBeInTheDocument();
  });
});

describe("Fase S2 — badge y pendientes", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "session-token");
    localStorage.setItem("aula.must_change", "0");
  });

  it("muestra el badge de entregas por entregar en la navegación", async () => {
    authAs("student");
    renderRoutes(["/student"]);

    expect(await screen.findByLabelText("2 entregas por entregar")).toBeInTheDocument();
  });

  it("la sección Por entregar enlaza a cada tarea", async () => {
    authAs("student");
    renderRoutes(["/student"]);

    const link = await screen.findByRole("link", { name: /tarea 9/i });
    expect(link).toHaveAttribute("href", "/courses/1/work/9");
  });

  it("no muestra badge cuando no hay pendientes", async () => {
    authAs("student", 0);
    renderRoutes(["/student"]);

    expect(await screen.findByRole("heading", { name: /panel del alumno/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/entregas por entregar/i)).not.toBeInTheDocument();
  });
});

describe("homePathAfterLogin (D-S2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("redirige a /student cuando el rol es student", () => {
    localStorage.setItem("aula.access_token", tokenWithRole("student"));
    expect(homePathAfterLogin()).toBe("/student");
  });

  it("redirige a /teacher cuando el rol es teacher", () => {
    localStorage.setItem("aula.access_token", tokenWithRole("teacher"));
    expect(homePathAfterLogin()).toBe("/teacher");
  });

  it("redirige a / cuando no hay token o el rol no tiene panel", () => {
    expect(homePathAfterLogin()).toBe("/");
    localStorage.setItem("aula.access_token", tokenWithRole("admin"));
    expect(homePathAfterLogin()).toBe("/");
  });
});

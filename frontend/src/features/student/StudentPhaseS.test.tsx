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
            username: role === "student" ? "ana" : null,
            role,
            is_active: true,
            must_change_credentials: false,
            created_at: new Date().toISOString(),
          }),
        );
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

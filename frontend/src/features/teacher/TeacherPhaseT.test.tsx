import { render, screen } from "@testing-library/react";
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
    expect(screen.getByRole("navigation", { name: /panel del profesor/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /cola de evaluación/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Panel" })).toBeInTheDocument();
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

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppRoutes } from "../app/routes";
import { ThemeProvider } from "../app/theme";
import { AuthProvider } from "../features/auth/AuthContext";

function renderRoutes(initialEntries: string[] = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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

describe("AppRoutes", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("redirige al login si no hay sesión", async () => {
    renderRoutes(["/"]);
    expect(await screen.findByRole("heading", { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it("muestra la página de inicio autenticado", async () => {
    localStorage.setItem("aula.access_token", "test-token");
    localStorage.setItem("aula.must_change", "0");
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              status: "ok",
              app: "AulaVirtual",
              version: "0.1.0",
              time: new Date().toISOString(),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      ),
    );

    renderRoutes(["/"]);

    expect(
      screen.getByRole("heading", { name: /plataforma de aula virtual/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("ok")).toBeInTheDocument();
  });

  it("muestra el formulario de login con pestañas", async () => {
    renderRoutes(["/login"]);
    expect(await screen.findByRole("tab", { name: "Estudiante" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Personal" })).toBeInTheDocument();
    expect(screen.getByLabelText(/código de curso/i)).toBeInTheDocument();
  });

  it("muestra 404 en rutas desconocidas", () => {
    localStorage.setItem("aula.access_token", "test-token");
    localStorage.setItem("aula.must_change", "0");
    renderRoutes(["/no-existe"]);
    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
  });
});

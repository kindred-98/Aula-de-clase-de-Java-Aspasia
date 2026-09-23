import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AppRoutes } from "../app/routes";
import { ThemeProvider } from "../app/theme";

function renderRoutes() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/"]}>
          <AppRoutes />
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe("AppRoutes", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("muestra la página de inicio y estados base", async () => {
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

    renderRoutes();

    expect(
      screen.getByRole("heading", { name: /plataforma de aula virtual/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("ok")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("muestra 404 en rutas desconocidas", () => {
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={["/no-existe"]}>
          <AppRoutes />
        </MemoryRouter>
      </ThemeProvider>,
    );
    expect(screen.getByRole("heading", { name: "404" })).toBeInTheDocument();
  });
});

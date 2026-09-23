import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "../../app/theme";
import { CalendarPage } from "./CalendarPage";

function renderCalendar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/courses/1/calendar"]}>
          <AuthProvider>
            <Routes>
              <Route path="/courses/:courseId/calendar" element={<CalendarPage />} />
            </Routes>
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

describe("CalendarPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "t");
    localStorage.setItem("aula.must_change", "0");
  });

  it("lista eventos de tareas y anuncios", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/auth/me")) {
          return Promise.resolve(
            json({
              id: 1,
              name: "Ana",
              email: null,
              username: "ana1",
              role: "student",
              is_active: true,
              must_change_credentials: false,
              created_at: new Date().toISOString(),
            }),
          );
        }
        if (url.includes("/calendar")) {
          return Promise.resolve(
            json([
              {
                kind: "assignment",
                id: 7,
                title: "Tarea 1",
                starts_at: null,
                ends_at: "2026-10-01T23:59:00Z",
                body_markdown: null,
              },
              {
                kind: "announcement",
                id: 2,
                title: "Anuncio nuevo",
                starts_at: "2026-09-20T10:00:00Z",
                ends_at: null,
                body_markdown: "Hola",
              },
            ]),
          );
        }
        return Promise.resolve(json(null));
      }),
    );

    renderCalendar();

    expect(await screen.findByText("Tarea 1")).toBeInTheDocument();
    expect(screen.getByText("Anuncio nuevo")).toBeInTheDocument();
    expect(screen.getByText("Tarea")).toBeInTheDocument();
    expect(screen.getByText("Anuncio")).toBeInTheDocument();
  });
});

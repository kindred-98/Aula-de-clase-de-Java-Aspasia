import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "../../app/theme";
import { AdminUsersPage } from "./users/AdminUsersPage";
import { AdminDashboardPage } from "./dashboard/AdminDashboardPage";
import { ImportCsvPage } from "./import/ImportCsvPage";

function renderPage(ui: ReactNode, path = "/admin") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            <Routes>
              <Route path="/admin" element={ui} />
              <Route path="/admin/import" element={ui} />
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
    role: "org_admin",
    is_active: true,
    must_change_credentials: false,
    created_at: new Date().toISOString(),
  };
}

describe("Admin dashboard y usuarios", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "admin-token");
    localStorage.setItem("aula.must_change", "0");
  });

  it("muestra KPIs del dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/auth/me")) return Promise.resolve(json(adminAuth()));
        if (url.includes("/admin/dashboard"))
          return Promise.resolve(
            json({
              courses_total: 2,
              courses_active: 1,
              users_total: 10,
              students_total: 8,
              teachers_total: 1,
              enrollments_total: 7,
              submissions_pending: 3,
              submissions_total: 12,
              recent_audit: [],
              recent_submissions: [],
            }),
          );
        return Promise.resolve(json({}));
      }),
    );

    renderPage(<AdminDashboardPage />);
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(await screen.findByText("Cursos activos")).toBeInTheDocument();
    expect(screen.getByText("Por revisar")).toBeInTheDocument();
  });

  it("lista usuarios y permite filtrar por rol", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/auth/me")) return Promise.resolve(json(adminAuth()));
      if (url.includes("/admin/users"))
        return Promise.resolve(
          json([
            {
              id: 2,
              name: "Ana",
              email: null,
              username: "ana1",
              role: "student",
              is_active: true,
              must_change_credentials: true,
              created_at: new Date().toISOString(),
            },
          ]),
        );
      return Promise.resolve(json({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage(<AdminUsersPage />);
    expect(await screen.findByText("Ana")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/filtrar por rol/i), "student");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("role=student"),
        expect.anything(),
      );
    });
  });

  it("muestra el formulario de importación CSV", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/auth/me")) return Promise.resolve(json(adminAuth()));
        if (url.includes("/courses")) return Promise.resolve(json([]));
        return Promise.resolve(json([]));
      }),
    );

    renderPage(<ImportCsvPage />, "/admin/import");
    expect(await screen.findByRole("heading", { name: /importar csv/i })).toBeInTheDocument();
    expect(screen.getByText(/name\[,email\]\[,username\]/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/curso destino/i)).toBeInTheDocument();
  });
});

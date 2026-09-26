import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "../../app/theme";
import { CategoriesPage } from "./CategoriesPage";
import { CohortsPage } from "./CohortsPage";
import { RolesPage } from "./RolesPage";
import { SessionsPage } from "./SessionsPage";

function renderPage(ui: ReactNode, path = "/admin/categories") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <AuthProvider>
            <Routes>
              <Route path="/admin/categories" element={ui} />
              <Route path="/admin/cohorts" element={ui} />
              <Route path="/admin/roles" element={ui} />
              <Route path="/admin/sessions" element={ui} />
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

describe("Fase D frontend", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "admin-token");
    localStorage.setItem("aula.must_change", "0");
  });

  it("lista y crea categorías", async () => {
    const user = userEvent.setup();
    const categories: unknown[] = [];
    stubFetch((url, init) => {
      if (url.includes("/auth/me")) return json(adminAuth());
      if (url.includes("/admin/categories") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        const created = {
          id: 9,
          course_count: 0,
          created_at: "2026-09-24T00:00:00Z",
          description: null,
          ...body,
        };
        categories.push(created);
        return json(created, 201);
      }
      if (url.includes("/categories")) return json(categories);
      return undefined;
    });

    renderPage(<CategoriesPage />);
    expect(await screen.findByText("Categorías de cursos")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nombre"), "Programación");
    await user.type(screen.getByLabelText("Slug"), "programacion");
    await user.click(screen.getByRole("button", { name: /crear categoría/i }));

    expect(await screen.findByText("Programación")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_content, el) => el?.tagName === "LI" && !!el.textContent?.includes("programacion"),
      ),
    ).toBeInTheDocument();
  });

  it("lista cohorts y despliega miembros", async () => {
    stubFetch((url) => {
      if (url.includes("/auth/me")) return json(adminAuth());
      if (url.includes("/admin/cohorts/"))
        return json({
          id: 1,
          name: "Grupo A",
          code: "GA1",
          category_id: null,
          created_at: "2026-09-24T00:00:00Z",
          member_count: 1,
          members: [{ student_id: 2, name: "Ana", username: "ana1" }],
        });
      if (url.includes("/admin/cohorts"))
        return json([
          {
            id: 1,
            name: "Grupo A",
            code: "GA1",
            category_id: null,
            created_at: "2026-09-24T00:00:00Z",
            member_count: 1,
          },
        ]);
      return undefined;
    });

    renderPage(<CohortsPage />, "/admin/cohorts");
    expect(await screen.findByText("Cohorts")).toBeInTheDocument();
    expect(screen.getByText("Grupo A")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Miembros" }));
    expect(await screen.findByText(/miembros \(1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/@ana1/)).toBeInTheDocument();
  });

  it("crea roles personalizados con permisos", async () => {
    const user = userEvent.setup();
    const roles: unknown[] = [];
    stubFetch((url, init) => {
      if (url.includes("/auth/me")) return json(adminAuth());
      if (url.includes("/admin/permissions"))
        return json({
          permissions: ["reports.view", "settings.manage"],
          effective: ["reports.view", "settings.manage"],
        });
      if (url.includes("/admin/users") && !init?.method) return json([]);
      if (url.includes("/admin/roles") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        const created = {
          id: 7,
          created_at: "2026-09-24T00:00:00Z",
          assigned_count: 0,
          ...body,
        };
        roles.push(created);
        return json(created, 201);
      }
      if (url.includes("/admin/roles")) return json(roles);
      return undefined;
    });

    renderPage(<RolesPage />, "/admin/roles");
    expect(await screen.findByText("Roles personalizados")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nombre del rol"), "Coordinador");
    await user.click(screen.getByLabelText("reports.view"));
    await user.click(screen.getByRole("button", { name: /crear rol/i }));

    expect(
      await screen.findByText(
        (_content, el) => el?.tagName === "LI" && !!el.textContent?.includes("Coordinador"),
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_content, el) => el?.tagName === "LI" && !!el.textContent?.includes("0 asignado"),
      ),
    ).toBeInTheDocument();
  });

  it("muestra sesiones activas con acciones de cuenta", async () => {
    stubFetch((url) => {
      if (url.includes("/auth/me")) return json(adminAuth());
      if (url.includes("/admin/sessions"))
        return json([
          {
            id: 11,
            user_id: 2,
            user_name: "Profe",
            user_role: "teacher",
            created_at: "2026-09-24T10:00:00Z",
            expires_at: "2026-10-01T10:00:00Z",
          },
        ]);
      if (url.includes("/admin/users"))
        return json([
          {
            id: 2,
            name: "Profe",
            email: "profe@aula.test",
            username: null,
            role: "teacher",
            is_active: true,
            must_change_credentials: false,
            created_at: "2026-09-01T10:00:00Z",
          },
        ]);
      return undefined;
    });

    renderPage(<SessionsPage />, "/admin/sessions");
    expect(await screen.findByText("Sesiones activas")).toBeInTheDocument();
    expect(await screen.findByText("Profe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revocar sesiones" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Desbloquear cuenta" })).toBeDisabled();

    const select = screen.getByLabelText("Usuario");
    await waitFor(() => expect(select).toHaveValue(""));
    await userEvent.selectOptions(select, "2");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Revocar sesiones" })).toBeEnabled(),
    );
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "../../app/theme";
import { AccountPrivacyPage } from "./AccountPrivacyPage";

function renderPrivacy() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/account/privacy"]}>
          <AuthProvider>
            <Routes>
              <Route path="/account/privacy" element={<AccountPrivacyPage />} />
              <Route path="/admin/tools" element={<div>tools</div>} />
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

function authBody(role: string) {
  return {
    id: 1,
    name: role === "org_admin" ? "Admin" : "Ana",
    email: role === "org_admin" ? "a@x.test" : null,
    username: role === "org_admin" ? null : "ana1",
    role,
    is_active: true,
    must_change_credentials: false,
    created_at: new Date().toISOString(),
  };
}

describe("AccountPrivacyPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "t");
    localStorage.setItem("aula.must_change", "0");
  });

  it("muestra acciones RGPD de estudiante", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/auth/me")) return Promise.resolve(json(authBody("student")));
        if (url.includes("/me/export"))
          return Promise.resolve(
            json({
              user: {},
              exported_at: new Date().toISOString(),
              enrollments: [],
              submissions: [],
              evaluations: [],
              attendance: [],
            }),
          );
        return Promise.resolve(json(null));
      }),
    );

    renderPrivacy();
    expect(await screen.findByText(/Exportar mis datos/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Borrar mis datos/i })).toBeInTheDocument();
    expect(screen.queryByText(/Clonar curso/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Exportar notas \(CSV\)/i)).not.toBeInTheDocument();
  });

  it("enlaza herramientas de centro a admin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/auth/me")) return Promise.resolve(json(authBody("org_admin")));
        return Promise.resolve(json([]));
      }),
    );

    renderPrivacy();
    expect(await screen.findByRole("link", { name: /Herramientas/i })).toBeInTheDocument();
    expect(screen.queryByText(/Clonar curso/i)).not.toBeInTheDocument();
  });
});

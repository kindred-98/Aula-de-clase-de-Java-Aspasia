import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    name: role === "admin" ? "Admin" : "Ana",
    email: role === "admin" ? "a@x.test" : null,
    username: role === "admin" ? null : "ana1",
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
  });

  it("ofrece clonar curso y exportar CSV a admin", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/auth/me")) return Promise.resolve(json(authBody("admin")));
        if (url.includes("/courses")) {
          return Promise.resolve(
            json([
              {
                id: 3,
                name: "Java",
                code: "JAVA",
                description: null,
                status: "active",
                layout_rows: 3,
                layout_cols: 5,
                settings: {},
                created_at: new Date().toISOString(),
              },
            ]),
          );
        }
        return Promise.resolve(json(null));
      }),
    );

    renderPrivacy();
    expect(await screen.findByText(/Clonar curso/i)).toBeInTheDocument();
    expect(screen.getByText(/Exportar notas \(CSV\)/i)).toBeInTheDocument();

    expect(await screen.findByRole("option", { name: /Java \(JAVA\)/i })).toBeInTheDocument();
    const source = screen.getByLabelText(/Curso origen/i);
    await user.selectOptions(source, "3");
    expect(source).toHaveValue("3");
    await waitFor(() => {
      expect(screen.getByLabelText(/Nombre del clon/i)).toBeInTheDocument();
    });
  });
});

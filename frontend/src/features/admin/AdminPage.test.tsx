import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "../../app/theme";
import { AdminPage } from "./AdminPage";

function renderAdmin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/admin"]}>
          <AuthProvider>
            <Routes>
              <Route path="/admin" element={<AdminPage />} />
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

describe("AdminPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "admin-token");
    localStorage.setItem("aula.must_change", "0");
  });

  it("lista usuarios y permite filtrar por rol", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve(
          json({
            id: 1,
            name: "Admin",
            email: "admin@aula.test",
            username: null,
            role: "admin",
            is_active: true,
            must_change_credentials: false,
            created_at: new Date().toISOString(),
          }),
        );
      }
      if (url.includes("/admin/users")) {
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
      }
      return Promise.resolve(json({}));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAdmin();

    expect(await screen.findByText("Ana")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/filtrar por rol/i), "student");
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("role=student"),
        expect.anything(),
      );
    });
  });

  it("muestra la pestaña de importación CSV", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/auth/me")) {
          return Promise.resolve(
            json({
              id: 1,
              name: "Admin",
              email: "admin@aula.test",
              username: null,
              role: "admin",
              is_active: true,
              must_change_credentials: false,
              created_at: new Date().toISOString(),
            }),
          );
        }
        if (url.includes("/courses")) return Promise.resolve(json([]));
        return Promise.resolve(json([]));
      }),
    );

    renderAdmin();
    await userEvent.click(screen.getByRole("tab", { name: "Importar CSV" }));
    expect(screen.getByText(/name\[,email\]\[,username\]/i)).toBeInTheDocument();
  });
});

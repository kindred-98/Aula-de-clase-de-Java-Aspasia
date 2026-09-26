import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider } from "./AuthContext";
import { LoginPage } from "./LoginPage";
import { ThemeProvider } from "../../app/theme";

function renderLogin() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthProvider>
            <LoginPage />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("permite alternar a personal y enviar el formulario", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "a",
          must_change_credentials: false,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    renderLogin();

    await user.click(screen.getByRole("tab", { name: "Personal" }));
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText(/email/i), "profe@demo.test");
    await user.type(screen.getByLabelText(/contraseña/i), "profe-demo-pass");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    await waitFor(() => {
      expect(localStorage.getItem("aula.access_token")).toBe("a");
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("muestra error cuando el login falla", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Invalid credentials" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    renderLogin();

    await user.type(screen.getByLabelText(/código de curso/i), "JAVA");
    await user.type(screen.getByLabelText(/identificador/i), "student01");
    await user.type(screen.getByLabelText(/pin/i), "123456");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
    expect(localStorage.getItem("aula.access_token")).toBeNull();
  });
});

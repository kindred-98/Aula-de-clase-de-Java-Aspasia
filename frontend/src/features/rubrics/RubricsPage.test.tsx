import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "../../app/theme";
import { RubricsPage } from "./RubricsPage";

function renderRubrics() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/courses/1/rubrics"]}>
          <AuthProvider>
            <Routes>
              <Route path="/courses/:courseId/rubrics" element={<RubricsPage />} />
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

describe("RubricsPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "t");
    localStorage.setItem("aula.must_change", "0");
  });

  it("lista rúbricas existentes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/auth/me")) {
          return Promise.resolve(
            json({
              id: 1,
              name: "Profe",
              email: "p@x.test",
              username: null,
              role: "teacher",
              is_active: true,
              must_change_credentials: false,
              created_at: new Date().toISOString(),
            }),
          );
        }
        if (url.includes("/rubrics")) {
          return Promise.resolve(
            json([
              {
                id: 1,
                course_id: 1,
                title: "Rúbrica Java",
                criteria: [{ id: "c1", label: "Compila", max: 10 }],
                created_by: 1,
                created_at: new Date().toISOString(),
              },
            ]),
          );
        }
        return Promise.resolve(json(null));
      }),
    );

    renderRubrics();
    expect(await screen.findByText("Rúbrica Java")).toBeInTheDocument();
    expect(screen.getByText(/Compila/)).toBeInTheDocument();
  });

  it("permite crear una rúbrica", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/auth/me")) {
        return Promise.resolve(
          json({
            id: 1,
            name: "Profe",
            email: "p@x.test",
            username: null,
            role: "teacher",
            is_active: true,
            must_change_credentials: false,
            created_at: new Date().toISOString(),
          }),
        );
      }
      if (init?.method === "POST" && url.includes("/rubrics")) {
        return Promise.resolve(
          json(
            {
              id: 2,
              course_id: 1,
              title: "Nueva",
              criteria: [{ id: "c1", label: "X", max: 10 }],
              created_by: 1,
              created_at: new Date().toISOString(),
            },
            201,
          ),
        );
      }
      if (url.includes("/rubrics")) return Promise.resolve(json([]));
      return Promise.resolve(json(null));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRubrics();

    const title = await screen.findByLabelText(/título/i);
    await user.clear(title);
    await user.type(title, "Nueva");
    const label = screen.getByLabelText(/label criterio/i);
    await user.type(label, "X");
    await user.click(screen.getByRole("button", { name: /crear rúbrica/i }));

    expect(
      fetchMock.mock.calls.some((call) => {
        const [url, init] = call;
        return (
          typeof url === "string" &&
          url.includes("/rubrics") &&
          typeof init === "object" &&
          init !== null &&
          (init as RequestInit).method === "POST"
        );
      }),
    ).toBe(true);
  });
});

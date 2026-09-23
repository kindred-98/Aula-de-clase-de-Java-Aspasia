import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "../../app/theme";
import { AssignmentDetailPage } from "./AssignmentDetailPage";

function renderDetail() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/courses/1/work/9"]}>
          <AuthProvider>
            <Routes>
              <Route
                path="/courses/:courseId/work/:assignmentId"
                element={<AssignmentDetailPage />}
              />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  );
}

describe("AssignmentDetailPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "t");
    localStorage.setItem("aula.must_change", "0");
  });

  it("muestra detalle con fecha, visibilidad y descripción", async () => {
    const due = new Date(Date.now() + 86_400_000).toISOString();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/assignments/9")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 9,
                course_id: 1,
                section_id: null,
                title: "Tarea Java 1",
                description_markdown: "Implementa **clases**",
                due_at: due,
                max_score: "100.00",
                visibility: "class",
                created_by: 2,
                created_at: new Date().toISOString(),
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
          );
        }
        if (url.includes("/auth/me")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: 1,
                name: "Alumna",
                email: null,
                username: "ana1",
                role: "student",
                is_active: true,
                must_change_credentials: false,
                created_at: new Date().toISOString(),
              }),
              { status: 200, headers: { "Content-Type": "application/json" } },
            ),
          );
        }
        return Promise.resolve(new Response("null", { status: 200 }));
      }),
    );

    renderDetail();

    expect(await screen.findByRole("heading", { name: "Tarea Java 1" })).toBeInTheDocument();
    expect(screen.getByText(/visibilidad/i)).toBeInTheDocument();
    expect(screen.getByText("class")).toBeInTheDocument();
    expect(screen.getByText("clases")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });
});

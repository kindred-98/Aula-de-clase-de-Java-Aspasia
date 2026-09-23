import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "../../app/theme";
import { ContentPage } from "./ContentPage";

function renderContent() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/courses/1/content"]}>
          <AuthProvider>
            <Routes>
              <Route path="/courses/:courseId/content" element={<ContentPage />} />
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

describe("ContentPage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "t");
    localStorage.setItem("aula.must_change", "0");
  });

  it("lista secciones y muestra Markdown activo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/sections")) {
          return Promise.resolve(
            json([
              {
                id: 1,
                course_id: 1,
                title: "HTML",
                slug: "html",
                order: 1,
                kind: "content",
                body_markdown: "# Hola **mundo**",
                external_url: null,
              },
              {
                id: 2,
                course_id: 1,
                title: "Docs",
                slug: "docs",
                order: 2,
                kind: "external",
                body_markdown: null,
                external_url: "https://docs.example.com",
              },
            ]),
          );
        }
        if (url.includes("/announcements")) return Promise.resolve(json([]));
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
        return Promise.resolve(json(null));
      }),
    );

    renderContent();

    expect(await screen.findByRole("heading", { name: "HTML" })).toBeInTheDocument();
    expect(screen.getByText("Hola")).toBeInTheDocument();
    expect(screen.getByText("mundo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva sección" })).toBeInTheDocument();
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "../../app/theme";
import { MessagesPage } from "./MessagesPage";
import { PrivateMessagesPage } from "./private/PrivateMessagesPage";
import { CourseMessagesPage } from "./course/CourseMessagesPage";
import { useUnreadCount } from "./useUnreadCount";

function renderPage(initialPath = "/messages") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <AuthProvider>
            <Routes>
              <Route path="/messages" element={<MessagesPage />}>
                <Route index element={<PrivateMessagesPage />} />
                <Route path="course" element={<CourseMessagesPage />} />
              </Route>
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

function studentAuth() {
  return {
    id: 2,
    name: "Ana",
    email: null,
    username: "ana1",
    role: "student",
    is_active: true,
    must_change_credentials: false,
    created_at: new Date().toISOString(),
  };
}

function stubFetch(handlers: (url: string) => Response | undefined) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      const custom = handlers(url);
      if (custom) return Promise.resolve(custom);
      return Promise.resolve(json({}));
    }),
  );
}

describe("Mensajes Fase B", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "student-token");
    localStorage.setItem("aula.must_change", "0");
  });

  it("lista el directorio messageable del estudiante", async () => {
    stubFetch((url) => {
      if (url.includes("/auth/me")) return json(studentAuth());
      if (url.includes("/messages/directory"))
        return json([
          {
            id: 3,
            name: "Luis",
            role: "student",
            username: "luis1",
            email: null,
            course_ids: [1],
          },
          {
            id: 1,
            name: "Admin",
            role: "org_admin",
            username: null,
            email: "admin@aula.test",
            course_ids: [],
          },
        ]);
      if (url.includes("/messages/conversations")) return json([]);
      if (url.includes("/messages/unread-count"))
        return json({ private: 2, courses: { "1": 1 }, total: 3 });
      return undefined;
    });

    renderPage();
    expect(await screen.findByText("Luis")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("lista salas de curso con badge de no leídos", async () => {
    stubFetch((url) => {
      if (url.includes("/auth/me")) return json(studentAuth());
      if (url.includes("/me/course-chats"))
        return json([
          {
            course_id: 1,
            course_name: "Java",
            course_code: "JAVA1",
            unread: 4,
            last_message: "Ejercicio 1",
            last_at: new Date().toISOString(),
            last_sender_name: "Profe",
          },
        ]);
      return undefined;
    });

    renderPage("/messages/course");
    expect(await screen.findByText("Java")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("cambia a la pestaña Por curso", async () => {
    const user = userEvent.setup();
    stubFetch((url) => {
      if (url.includes("/auth/me")) return json(studentAuth());
      if (url.includes("/messages/directory")) return json([]);
      if (url.includes("/messages/conversations")) return json([]);
      if (url.includes("/me/course-chats"))
        return json([
          {
            course_id: 1,
            course_name: "Java",
            course_code: "JAVA1",
            unread: 0,
            last_message: null,
            last_at: null,
            last_sender_name: null,
          },
        ]);
      return undefined;
    });

    renderPage();
    expect(await screen.findByRole("link", { name: "Por curso" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Por curso" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Salas de curso" })).toBeInTheDocument();
    });
  });

  it("expone useUnreadCount con total", async () => {
    function Probe() {
      const q = useUnreadCount();
      return <span data-testid="total">{q.data?.total ?? "…"}</span>;
    }
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    stubFetch((url) => {
      if (url.includes("/auth/me")) return json(studentAuth());
      if (url.includes("/messages/unread-count"))
        return json({ private: 1, courses: { "1": 2 }, total: 3 });
      return undefined;
    });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AuthProvider>
            <Probe />
          </AuthProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByTestId("total")).toHaveTextContent("3");
  });
});

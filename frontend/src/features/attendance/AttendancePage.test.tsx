import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AuthProvider } from "../auth/AuthContext";
import { ThemeProvider } from "../../app/theme";
import { AttendancePage } from "./AttendancePage";

function renderAttendance() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/courses/1/attendance"]}>
          <AuthProvider>
            <Routes>
              <Route path="/courses/:courseId/attendance" element={<AttendancePage />} />
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

const seat = {
  seat_id: 1,
  row: 1,
  col: 1,
  enrollment_id: 10,
  student_id: 2,
  student_name: "Ana",
  student_username: "ana1",
  status: "draft",
};

describe("AttendancePage", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    localStorage.setItem("aula.access_token", "t");
    localStorage.setItem("aula.must_change", "0");
  });

  it("muestra asientos matriculados y permite pasar lista", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (typeof url === "string" && url.includes("/auth/me")) {
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
      if (typeof url === "string" && url.includes("/classroom")) {
        return Promise.resolve(
          json({
            course: {
              id: 1,
              name: "Java",
              code: "JAVA",
              description: null,
              status: "active",
              layout_rows: 1,
              layout_cols: 1,
              settings: {},
              created_at: new Date().toISOString(),
            },
            seats: [seat],
            rows: 1,
            cols: 1,
            teachers: [],
          }),
        );
      }
      if (typeof url === "string" && url.includes("/attendance/summary")) {
        return Promise.resolve(json([]));
      }
      if (typeof url === "string" && url.includes("/attendance")) {
        if (init?.method === "PUT") {
          return Promise.resolve(
            json({
              date: "2026-09-24",
              records: [
                {
                  id: 1,
                  course_id: 1,
                  student_id: 2,
                  date: "2026-09-24",
                  status: "present",
                  student_name: "Ana",
                  student_username: "ana1",
                  seat_row: 1,
                  seat_col: 1,
                },
              ],
            }),
          );
        }
        return Promise.resolve(json({ date: "2026-09-24", records: [] }));
      }
      return Promise.resolve(json(null));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAttendance();

    expect(await screen.findByText(/Ana/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /guardar asistencia/i }));

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(
          (call) =>
            typeof call[1] === "object" &&
            call[1] !== null &&
            (call[1] as RequestInit).method === "PUT",
        ),
      ).toBe(true);
    });
  });
});

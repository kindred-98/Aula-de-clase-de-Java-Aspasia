import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "./layout";
import { HomePage } from "../features/home/HomePage";
import { NotFoundPage } from "./NotFoundPage";
import { LoginPage } from "../features/auth/LoginPage";
import { ChangeCredentialsPage } from "../features/auth/ChangeCredentialsPage";
import { useAuth } from "../features/auth/AuthContext";
import { CourseListPage } from "../features/courses/CourseListPage";
import { ClassroomPage } from "../features/courses/ClassroomPage";
import { WorkPage } from "../features/work/WorkPage";
import { EvaluatePage } from "../features/work/EvaluatePage";
import type { ReactNode } from "react";

function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, mustChange } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  if (mustChange) return <Navigate to="/change-credentials" replace />;
  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/change-credentials" element={<ChangeCredentialsPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />
        <Route
          path="/courses"
          element={
            <RequireAuth>
              <CourseListPage />
            </RequireAuth>
          }
        />
        <Route
          path="/courses/:courseId"
          element={
            <RequireAuth>
              <ClassroomPage />
            </RequireAuth>
          }
        />
        <Route
          path="/courses/:courseId/work"
          element={
            <RequireAuth>
              <WorkPage />
            </RequireAuth>
          }
        />
        <Route
          path="/courses/:courseId/evaluate"
          element={
            <RequireAuth>
              <EvaluatePage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

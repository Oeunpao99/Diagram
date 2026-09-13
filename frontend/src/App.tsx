import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Settings from "./pages/Settings";
import Studio from "./pages/Studio";
import { useAuth } from "./store/useAuth";
import { applyTheme, watchSystemTheme } from "./theme";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuth((s) => s.user);
  const booting = useAuth((s) => s.booting);
  const location = useLocation();

  // Don't decide anything until the stored token has been checked, or a
  // refresh would flash the login screen at an already-signed-in user.
  if (booting) return <div className="min-h-screen bg-paper" role="status" aria-label="Loading" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  const boot = useAuth((s) => s.boot);

  useEffect(() => {
    // Paint the cached preference immediately; boot() corrects it from the
    // account once /auth/me answers.
    applyTheme(useAuth.getState().theme, useAuth.getState().accent);
    void boot();
    return watchSystemTheme(
      () => useAuth.getState().theme,
      () => useAuth.getState().accent,
    );
  }, [boot]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <Settings />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Studio />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

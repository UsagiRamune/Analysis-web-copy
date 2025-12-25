import { Link, useLocation } from "react-router-dom";
import AppRoutes from "./routes";

export default function AppShell() {
  const loc = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center gap-4">
          <div className="font-bold">Game Design Dashboard</div>
          <nav className="text-sm flex gap-3">
            <Link className={loc.pathname.startsWith("/upload") ? "font-semibold" : ""} to="/upload">
              Upload
            </Link>
            <Link className={loc.pathname.startsWith("/dashboard") ? "font-semibold" : ""} to="/dashboard">
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <AppRoutes />
      </main>
    </div>
  );
}

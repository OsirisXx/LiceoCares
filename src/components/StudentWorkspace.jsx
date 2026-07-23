import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  LogOut,
  Menu,
  Plus,
  Search,
  Ticket,
  X,
} from "lucide-react";

const navigationLinks = [
  { to: "/", label: "Home", icon: Home },
  { to: "/track", label: "Track Status", icon: Search },
  { to: "/my-tickets", label: "My Tickets", icon: Ticket },
];

const isTrackingPath = (pathname) =>
  pathname === "/track" || pathname.startsWith("/ticket/");

const StudentWorkspace = ({ children }) => {
  const { user, studentProfile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const displayName = studentProfile?.full_name || user?.email || "Student";

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const isActive = (path) =>
    path === "/track"
      ? isTrackingPath(location.pathname)
      : location.pathname === path;

  const sidebar = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-maroon-700 px-5">
        <Link to="/" onClick={closeMobileMenu} className="flex min-w-0 items-center gap-3">
          <img src="/ldcu.ico" alt="LDCU Logo" className="h-9 w-9 shrink-0 object-contain" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">Liceo Cares</p>
            <p className="truncate text-[10px] text-gold-300">Feedback Management System</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setSidebarCollapsed(true)}
          className="hidden rounded-lg p-2 text-maroon-100 transition-colors hover:bg-maroon-700 md:inline-flex"
          aria-label="Close student sidebar"
          title="Close sidebar"
        >
          <ChevronLeft size={19} />
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-5" aria-label="Student navigation">
        {navigationLinks.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={closeMobileMenu}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
              isActive(to)
                ? "bg-gold-500 font-semibold text-maroon-800"
                : "text-white hover:bg-maroon-700"
            }`}
          >
            <Icon size={19} />
            {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => {
            closeMobileMenu();
            navigate("/");
          }}
          className="mt-5 flex w-full items-center gap-3 rounded-lg border border-maroon-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-maroon-700"
        >
          <Plus size={19} />
          Submit Feedback
        </button>
      </nav>

      <div className="border-t border-maroon-700 p-4">
        <p className="truncate text-sm font-semibold text-white">{displayName}</p>
        <p className="mt-0.5 truncate text-xs text-maroon-200">{user?.email}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-4 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-maroon-100 transition-colors hover:bg-maroon-700 hover:text-white"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50">
      {sidebarCollapsed && (
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          className="fixed left-4 top-4 z-50 hidden h-11 w-11 items-center justify-center rounded-xl border border-maroon-700/30 bg-maroon-800 text-white shadow-lg transition hover:bg-maroon-700 md:inline-flex"
          aria-label="Open student sidebar"
          title="Open sidebar"
        >
          <ChevronRight size={21} />
        </button>
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden w-64 overflow-y-auto bg-maroon-800 text-white shadow-xl transition-transform duration-300 md:flex md:flex-col ${
          sidebarCollapsed ? "-translate-x-full" : "translate-x-0"
        }`}
      >
        {sidebar}
      </aside>

      <div className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between bg-maroon-800 px-4 text-white shadow-lg md:hidden">
        <Link to="/" className="flex items-center gap-2">
          <img src="/ldcu.ico" alt="LDCU Logo" className="h-8 w-8 object-contain" />
          <span className="font-bold">Liceo Cares</span>
        </Link>
        <button type="button" onClick={() => setMobileMenuOpen(true)} className="rounded-lg p-2 hover:bg-maroon-700" aria-label="Open navigation">
          <Menu size={22} />
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button type="button" onClick={closeMobileMenu} className="absolute inset-0 h-full w-full bg-black/50" aria-label="Close navigation" />
          <aside className="relative flex h-full w-72 flex-col bg-maroon-800 text-white shadow-xl">
            <button type="button" onClick={closeMobileMenu} className="absolute right-3 top-4 rounded-lg p-2 text-white hover:bg-maroon-700" aria-label="Close navigation">
              <X size={20} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className={`min-h-screen min-w-0 pt-16 transition-[margin] duration-300 md:pt-0 ${sidebarCollapsed ? "md:ml-0" : "md:ml-64"}`}>
        {children}
      </main>
    </div>
  );
};

export default StudentWorkspace;

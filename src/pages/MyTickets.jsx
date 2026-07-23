import { createElement, useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Filter,
  Home,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Tag,
  Ticket,
  X,
  XCircle,
  AlertTriangle,
  Lock,
} from "lucide-react";

const statusConfig = {
  submitted: { label: "Submitted", color: "bg-blue-100 text-blue-700 border-blue-200", icon: FileText },
  verified: { label: "Verified", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-700 border-yellow-200", icon: Clock },
  resolved: { label: "Resolved", color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: CheckCircle },
  closed: { label: "Closed", color: "bg-gray-100 text-gray-700 border-gray-200", icon: Lock },
  disputed: { label: "Disputed", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
};

const statusFilters = [
  { value: "all", label: "All Tickets" },
  { value: "submitted", label: "Submitted" },
  { value: "verified", label: "Verified" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "disputed", label: "Disputed" },
  { value: "rejected", label: "Rejected" },
];

const formatDate = (dateString) =>
  new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

const renderIcon = (Icon, size) => createElement(Icon, { size });

const MyTickets = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isStudent, studentProfile, loading: authLoading, signOut } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isStudent)) navigate("/student-login", { replace: true });
  }, [user, isStudent, authLoading, navigate]);

  const fetchMyComplaints = useCallback(async ({ showRefreshState = false } = {}) => {
    if (!user?.id) return;
    if (!initialLoadDone) setLoading(true);
    if (showRefreshState) setIsRefreshing(true);

    try {
      const { data, error } = await supabase
        .from("complaints")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComplaints(data || []);
      setInitialLoadDone(true);
    } catch (err) {
      console.error("Error fetching complaints:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.id, initialLoadDone]);

  useEffect(() => {
    if (!user?.id || !isStudent) {
      setLoading(false);
      return;
    }

    fetchMyComplaints();
    const loadingTimeout = setTimeout(() => setLoading(false), 10000);
    const subscription = supabase
      .channel(`user-complaints-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "complaints", filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === "INSERT") setComplaints((previous) => [payload.new, ...previous]);
        if (payload.eventType === "UPDATE") setComplaints((previous) => previous.map((complaint) => complaint.id === payload.new.id ? payload.new : complaint));
        if (payload.eventType === "DELETE") setComplaints((previous) => previous.filter((complaint) => complaint.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, [user?.id, isStudent, fetchMyComplaints]);

  const filteredComplaints = complaints.filter((complaint) => {
    const matchesStatus = filterStatus === "all" || complaint.status === filterStatus;
    const matchesSearch = [complaint.reference_number, complaint.description, complaint.category, complaint.assigned_department]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(searchQuery.trim().toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    total: complaints.length,
    active: complaints.filter((complaint) => !["closed", "rejected"].includes(complaint.status)).length,
    resolved: complaints.filter((complaint) => complaint.status === "resolved").length,
    closed: complaints.filter((complaint) => complaint.status === "closed").length,
  };
  const hasActiveFilters = filterStatus !== "all" || searchQuery.trim() !== "";
  const displayName = studentProfile?.full_name || user?.email || "Student";

  const closeMobileMenu = () => setMobileMenuOpen(false);
  const navigationLinks = [
    { to: "/", label: "Home", icon: Home },
    { to: "/track", label: "Track Status", icon: Search },
    { to: "/my-tickets", label: "My Tickets", icon: Ticket },
  ];

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
              location.pathname === to ? "bg-gold-500 font-semibold text-maroon-800" : "text-white hover:bg-maroon-700"
            }`}
          >
            {renderIcon(Icon, 19)}
            {label}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => { closeMobileMenu(); navigate("/"); }}
          className="mt-5 flex w-full items-center gap-3 rounded-lg border border-maroon-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-maroon-700"
        >
          <Plus size={19} />
          Submit Feedback
        </button>
      </nav>

      <div className="border-t border-maroon-700 p-4">
        <p className="truncate text-sm font-semibold text-white">{displayName}</p>
        <p className="mt-0.5 truncate text-xs text-maroon-200">{user?.email}</p>
        <button type="button" onClick={signOut} className="mt-4 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-maroon-100 transition-colors hover:bg-maroon-700 hover:text-white">
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </>
  );

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-gray-50"><div className="h-12 w-12 animate-spin rounded-full border-4 border-maroon-800 border-t-transparent" /></div>;
  }

  return (
    <div className="h-screen overflow-hidden bg-gray-50">
      {sidebarCollapsed && (
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          className="fixed left-4 top-4 z-50 hidden h-11 w-11 items-center justify-center rounded-xl border border-maroon-700/30 bg-[#800020] text-white shadow-lg transition hover:bg-maroon-700 md:inline-flex"
          aria-label="Open student sidebar"
          title="Open sidebar"
        >
          <ChevronRight size={21} />
        </button>
      )}
      <aside className={`fixed inset-y-0 left-0 z-40 hidden w-64 overflow-y-auto bg-[#800020] text-white shadow-xl transition-transform duration-300 md:flex md:flex-col ${sidebarCollapsed ? "-translate-x-full" : "translate-x-0"}`}>{sidebar}</aside>

      <div className="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between bg-[#800020] px-4 text-white shadow-lg md:hidden">
        <Link to="/" className="flex items-center gap-2"><img src="/ldcu.ico" alt="LDCU Logo" className="h-8 w-8 object-contain" /><span className="font-bold">Liceo Cares</span></Link>
        <button type="button" onClick={() => setMobileMenuOpen(true)} className="rounded-lg p-2 hover:bg-maroon-700" aria-label="Open navigation"><Menu size={22} /></button>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <button type="button" onClick={closeMobileMenu} className="absolute inset-0 h-full w-full bg-black/50" aria-label="Close navigation" />
          <aside className="relative flex h-full w-72 flex-col bg-[#800020] text-white shadow-xl">
            <button type="button" onClick={closeMobileMenu} className="absolute right-3 top-4 rounded-lg p-2 text-white hover:bg-maroon-700" aria-label="Close navigation"><X size={20} /></button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className={`h-screen min-w-0 overflow-y-auto px-4 pb-8 pt-20 transition-[margin] duration-300 sm:px-6 md:pt-8 lg:px-8 ${sidebarCollapsed ? "md:ml-0" : "md:ml-64"}`}>
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 sm:text-3xl"><Ticket className="text-maroon-800" /> My Tickets</h1>
              <p className="mt-1 text-gray-600">View and track the feedback you have submitted.</p>
            </div>
            <button type="button" onClick={() => fetchMyComplaints({ showRefreshState: true })} disabled={isRefreshing} className="inline-flex items-center justify-center gap-2 rounded-lg bg-maroon-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-maroon-700 disabled:cursor-not-allowed disabled:opacity-60">
              <RefreshCw size={17} className={isRefreshing ? "animate-spin" : ""} />
              Refresh
            </button>
          </header>

          <section aria-label="Ticket summary" className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Total", value: stats.total, icon: FileText, color: "bg-maroon-100 text-maroon-800" },
              { label: "Active", value: stats.active, icon: Clock, color: "bg-yellow-100 text-yellow-700" },
              { label: "Resolved", value: stats.resolved, icon: CheckCircle, color: "bg-emerald-100 text-emerald-700" },
              { label: "Closed", value: stats.closed, icon: Lock, color: "bg-gray-100 text-gray-600" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between"><div><p className="text-sm text-gray-500">{label}</p><p className="mt-1 text-2xl font-bold text-gray-900">{value}</p></div><div className={`rounded-lg p-2.5 ${color}`}>{renderIcon(Icon, 19)}</div></div>
              </div>
            ))}
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div><h2 className="font-semibold text-gray-900">Your feedback</h2><p className="mt-1 text-sm text-gray-500">{loading ? "Loading tickets..." : `Showing ${filteredComplaints.length} of ${complaints.length} ticket${complaints.length === 1 ? "" : "s"}`}</p></div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <label className="relative block sm:w-72"><span className="sr-only">Search tickets</span><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><input type="search" placeholder="Search reference or description..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full rounded-lg border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-maroon-500 focus:ring-2 focus:ring-maroon-100" /></label>
                  <div className="relative"><Filter size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" /><select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="w-full appearance-none rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-maroon-500 focus:ring-2 focus:ring-maroon-100 sm:w-44">{statusFilters.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}</select><ChevronDown size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /></div>
                </div>
              </div>
              {hasActiveFilters && <button type="button" onClick={() => { setFilterStatus("all"); setSearchQuery(""); }} className="mt-3 text-sm font-medium text-maroon-800 hover:text-maroon-600">Clear filters</button>}
            </div>

            {loading ? (
              <div className="space-y-4 p-5"><div className="h-28 animate-pulse rounded-xl bg-gray-100" /><div className="h-28 animate-pulse rounded-xl bg-gray-100" /></div>
            ) : filteredComplaints.length === 0 ? (
              <div className="p-12 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100"><Ticket size={27} className="text-gray-400" /></div><h3 className="mt-4 text-lg font-semibold text-gray-900">{complaints.length === 0 ? "No tickets yet" : "No matching tickets"}</h3><p className="mt-2 text-sm text-gray-500">{complaints.length === 0 ? "You have not submitted any feedback yet." : "Try adjusting your search or filters."}</p>{complaints.length === 0 ? <button type="button" onClick={() => navigate("/")} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-maroon-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-maroon-700"><Plus size={17} />Submit Feedback</button> : <button type="button" onClick={() => { setFilterStatus("all"); setSearchQuery(""); }} className="mt-5 text-sm font-medium text-maroon-800 hover:text-maroon-600">Clear filters</button>}</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredComplaints.map((complaint) => {
                  const status = statusConfig[complaint.status] || statusConfig.submitted;
                  const StatusIcon = status.icon;
                  return (
                    <article key={complaint.id} className="p-4 transition-colors hover:bg-gray-50 sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-maroon-50 px-2 py-1 font-mono text-xs font-semibold text-maroon-800">{complaint.reference_number}</span><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${status.color}`}><StatusIcon size={12} />{status.label}</span></div><p className="mt-3 line-clamp-2 font-medium text-gray-900">{complaint.description || "No description provided"}</p><div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500"><span className="inline-flex items-center gap-1.5"><Tag size={14} />{complaint.category || "General"}</span><span className="inline-flex items-center gap-1.5"><Calendar size={14} />{formatDate(complaint.created_at)}</span>{complaint.assigned_department && <span className="inline-flex items-center gap-1.5"><Shield size={14} />{complaint.assigned_department.replace(/_/g, " ")}</span>}</div></div>
                        <button type="button" onClick={() => navigate(`/ticket/${complaint.reference_number}`)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-maroon-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-maroon-700"><Eye size={16} />View Details</button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default MyTickets;

import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Home from "./pages/Home";
import TrackComplaint from "./pages/TrackComplaint";
import AdminDashboard from "./pages/AdminDashboard";
import DepartmentDashboard from "./pages/DepartmentDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import StudentLogin from "./pages/StudentLogin";
import AuthCallback from "./pages/AuthCallback";
import MyTickets from "./pages/MyTickets";
import TermsOfService from "./pages/TermsOfService";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/student-login" element={<StudentLogin />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/submit" element={<Navigate to="/" replace />} />
            <Route path="/track" element={<TrackComplaint />} />
            <Route path="/ticket/:referenceNumber" element={<TrackComplaint />} />
            <Route
              path="/my-tickets"
              element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <MyTickets />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/department"
              element={
                <ProtectedRoute allowedRoles={["department"]}>
                  <DepartmentDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute allowedRoles={["super_admin"]}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}

export default App;

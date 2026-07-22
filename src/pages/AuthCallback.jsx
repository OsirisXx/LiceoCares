import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { AlertCircle, ShieldAlert } from "lucide-react";

const CALLBACK_TIMEOUT_MS = 8000;

const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [wrongRole, setWrongRole] = useState(null);
  const processedUserId = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let subscription;
    let timeoutId;

    const showError = (message) => {
      if (isMounted) setError(message);
    };

    const processSession = async (session) => {
      if (!session?.user || processedUserId.current === session.user.id) return;
      processedUserId.current = session.user.id;

      const email = (session.user.email || "").toLowerCase();
      const provider = session.user.app_metadata?.provider;

      if (!email.endsWith("@liceo.edu.ph") || provider !== "google") {
        await supabase.auth.signOut();
        showError("Only Liceo de Cagayan University students using Google sign-in can access this portal.");
        return;
      }

      const { data: userData, error: roleError } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (roleError) {
        showError("We could not verify your account permissions. Please try again or contact support.");
        return;
      }

      if (userData?.role && userData.role !== "student") {
        const formattedRole = userData.role
          .split("_")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");

        await supabase.auth.signOut();
        if (isMounted) setWrongRole(formattedRole);
        return;
      }

      if (isMounted) navigate("/my-tickets", { replace: true });
    };

    const resolveSession = async () => {
      const callbackParams = new URLSearchParams(window.location.search);
      const callbackError = callbackParams.get("error");
      if (callbackError) {
        const callbackErrorCode = callbackParams.get("error_code");
        const callbackErrorDescription = callbackParams.get("error_description");
        const details = [callbackError, callbackErrorCode, callbackErrorDescription]
          .filter(Boolean)
          .join(": ")
          .slice(0, 300);

        showError(
          import.meta.env.DEV && details
            ? `Google sign-in failed (${details}).`
            : "Google sign-in was not completed. Please return to login and try again."
        );
        return;
      }

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          showError("We could not complete your sign-in. Please try again.");
          return;
        }

        if (session?.user) {
          await processSession(session);
          return;
        }

        const authState = supabase.auth.onAuthStateChange((event, newSession) => {
          if (event === "SIGNED_IN" && newSession?.user) {
            window.clearTimeout(timeoutId);
            subscription?.unsubscribe();
            processSession(newSession);
          }
        });
        subscription = authState.data.subscription;
        timeoutId = window.setTimeout(() => {
          subscription?.unsubscribe();
          showError("Sign-in timed out. Please return to login and try again.");
        }, CALLBACK_TIMEOUT_MS);
      } catch {
        showError("An error occurred during authentication. Please try again.");
      }
    };

    resolveSession();

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, [navigate]);

  // Wrong role error screen
  if (wrongRole) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-amber-100 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ShieldAlert size={32} className="text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Wrong Portal
            </h2>
            <p className="text-gray-600 mb-6">
              Your account is a <span className="font-semibold text-amber-700">{wrongRole}</span>. Please login through the correct channels.
            </p>
            <button
              onClick={() => navigate("/student-login")}
              className="w-full bg-maroon-800 text-white py-3 px-4 rounded-xl font-semibold hover:bg-maroon-700 transition-all duration-200"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Generic error screen
  if (error) {
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Authentication Error
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate("/student-login")}
              className="w-full bg-maroon-800 text-white py-3 px-4 rounded-xl font-semibold hover:bg-maroon-700 transition-all duration-200"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-maroon-800 border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
};

export default AuthCallback;

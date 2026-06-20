import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { Mail, Lock, LogIn, AlertCircle, ShieldCheck } from "lucide-react";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SITEVERIFY_WORKER_URL = "https://turnstile-siteverify-liceocares.harleybusa82.workers.dev";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [turnstileReady, setTurnstileReady] = useState(false);
  const turnstileRef = useRef(null);
  const widgetIdRef = useRef(null);
  const { signIn, user, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && userRole) {
      if (userRole === "super_admin") {
        navigate("/super-admin", { replace: true });
      } else if (userRole === "admin") {
        navigate("/admin", { replace: true });
      } else if (userRole === "department") {
        navigate("/department", { replace: true });
      }
    }
  }, [user, userRole, navigate]);

  // Load Cloudflare Turnstile script
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      // No site key configured — skip CAPTCHA in dev mode
      setTurnstileReady(false);
      return;
    }

    const existingScript = document.getElementById("cf-turnstile-script");
    if (existingScript) {
      if (window.turnstile) setTurnstileReady(true);
      return;
    }

    const script = document.createElement("script");
    script.id = "cf-turnstile-script";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => setTurnstileReady(true);
    document.head.appendChild(script);

    return () => {
      // Cleanup widget on unmount
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, []);

  // Render the Turnstile widget once the script is ready
  useEffect(() => {
    if (!turnstileReady || !turnstileRef.current || !TURNSTILE_SITE_KEY) return;
    if (widgetIdRef.current) return; // Already rendered

    widgetIdRef.current = window.turnstile.render(turnstileRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "light",
      callback: (token) => setTurnstileToken(token),
      "expired-callback": () => setTurnstileToken(null),
      "error-callback": () => setTurnstileToken(null),
    });
  }, [turnstileReady]);

  const resetTurnstile = useCallback(() => {
    if (widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      setTurnstileToken(null);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Block submission if CAPTCHA is enabled but not yet solved
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("Please complete the security check before signing in.");
      return;
    }

    setLoading(true);

    // Server-side Turnstile verification via Cloudflare Worker
    if (TURNSTILE_SITE_KEY && turnstileToken) {
      try {
        const verifyRes = await fetch(SITEVERIFY_WORKER_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: turnstileToken }),
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
          setError("Security verification failed. Please try again.");
          setLoading(false);
          resetTurnstile();
          return;
        }
      } catch {
        setError("Could not verify security check. Please try again.");
        setLoading(false);
        resetTurnstile();
        return;
      }
    }

    const { data, error: signInError } = await signIn(email, password);

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      resetTurnstile();
      return;
    }

    if (data?.user) {
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", data.user.id)
        .single();

      if (userData?.role === "super_admin") {
        navigate("/super-admin");
      } else if (userData?.role === "admin") {
        navigate("/admin");
      } else if (userData?.role === "department") {
        navigate("/department");
      } else {
        navigate("/");
      }
    }
    setLoading(false);
  };

  const captchaEnabled = !!TURNSTILE_SITE_KEY;
  const canSubmit = !loading && (!captchaEnabled || !!turnstileToken);

  return (
    <div className="min-h-[calc(100vh-200px)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-maroon-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock size={32} className="text-gold-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Staff Login</h2>
            <p className="text-gray-600 mt-2">
              Sign in to access your dashboard
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-3">
              <AlertCircle
                size={20}
                className="text-red-500 flex-shrink-0 mt-0.5"
              />
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Mail size={20} className="text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 transition-all duration-200 outline-none"
                  placeholder="Enter your email"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock size={20} className="text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-maroon-500 focus:border-maroon-500 transition-all duration-200 outline-none"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {/* Cloudflare Turnstile CAPTCHA */}
            {captchaEnabled && (
              <div className="flex flex-col items-center space-y-2">
                <div ref={turnstileRef} />
                {turnstileToken && (
                  <div className="flex items-center space-x-1.5 text-green-600 text-xs font-medium">
                    <ShieldCheck size={14} />
                    <span>Security check passed</span>
                  </div>
                )}
              </div>
            )}

            <button
              id="login-submit-btn"
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-maroon-800 text-white py-3 px-4 rounded-xl font-semibold hover:bg-maroon-700 focus:ring-4 focus:ring-maroon-200 transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              This portal is for authorized staff only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

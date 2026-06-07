"use client";

import React, { useState, useEffect } from "react";
import { LogIn, ShieldAlert, Mail, User as UserIcon } from "lucide-react";
import { API_URL } from "../../config";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleInitialized, setGoogleInitialized] = useState(false);
  
  // Custom mock identity modal states
  const [showMockModal, setShowMockModal] = useState(false);
  const [mockEmail, setMockEmail] = useState("");
  const [mockName, setMockName] = useState("");

  const handleLogin = async (email: string, name: string, avatarUrl: string = "") => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          name,
          avatarUrl,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to connect to backend server");
      }

      const user = await response.json();
      // Store user details in localStorage for session state persistence
      localStorage.setItem("gsuite_user", JSON.stringify(user));
      window.location.href = "/dashboard";
    } catch (err) {
      // Offline fallback: store in localStorage directly
      console.warn("Backend offline. Logging in locally.");
      const mockUser = {
        id: "mock-user-uuid-1234-5678",
        email: email || "gunalrtr@gmail.com",
        name: name || "Gunal",
        avatarUrl: avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=256",
        role: "STORE_EXECUTIVE",
      };
      localStorage.setItem("gsuite_user", JSON.stringify(mockUser));
      window.location.href = "/dashboard";
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialResponse = async (response: any) => {
    const jwt = response.credential;
    if (!jwt) return;

    setLoading(true);
    setError("");

    try {
      // Decode JWT token locally
      const base64Url = jwt.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(
        window
          .atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      const payload = JSON.parse(jsonPayload);

      if (!payload || !payload.email) {
        throw new Error("Invalid JWT token received from Google");
      }

      await handleLogin(payload.email, payload.name || "Google User", payload.picture || "");
    } catch (err: any) {
      console.error("Google login error:", err);
      setError(err.message || "Google Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only run on client-side
    if (typeof window === "undefined") return;

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === "mock-google-client-id") {
      console.warn("Google OAuth Client ID not set. Using local mock Google login.");
      return;
    }

    const loadGoogleScript = () => {
      // Check if script is already present
      if (document.getElementById("google-gsi-client")) {
        initializeGoogleSDK(clientId);
        return;
      }

      const script = document.createElement("script");
      script.id = "google-gsi-client";
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initializeGoogleSDK(clientId);
      };
      script.onerror = () => {
        console.error("Failed to load Google Sign-In SDK script.");
      };
      document.body.appendChild(script);
    };

    const initializeGoogleSDK = (cid: string) => {
      try {
        const google = (window as any).google;
        if (google && google.accounts && google.accounts.id) {
          google.accounts.id.initialize({
            client_id: cid,
            callback: handleCredentialResponse,
            auto_select: false,
          });

          const buttonDiv = document.getElementById("google-signin-btn");
          if (buttonDiv) {
            google.accounts.id.renderButton(buttonDiv, {
              theme: "filled_blue",
              size: "large",
              width: buttonDiv.clientWidth || 382,
              shape: "rectangular",
            });
            setGoogleInitialized(true);
          }
        }
      } catch (err) {
        console.error("Failed to initialize Google Sign-In:", err);
      }
    };

    // Delay a bit to ensure target container is rendered in DOM
    const timer = setTimeout(loadGoogleScript, 200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-[#090d16]">
      {/* Ambient glassmorphism gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md z-10">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20 mb-4">
            <span className="text-2xl font-black text-white tracking-wider">G360</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">GSuite 360</h1>
          <p className="text-slate-400 text-sm">Your Personal Mobile-First Operating System</p>
        </div>

        {/* Card Panel */}
        <div className="glass-panel rounded-3xl p-6 md:p-8">
          <h2 className="text-xl font-bold text-white mb-6">Initialize Session</h2>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-6 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Real Google Sign In container OR mock button */}
            <div className="w-full">
              {googleInitialized ? (
                <div id="google-signin-btn" className="w-full flex justify-center min-h-[44px]" />
              ) : (
                <button
                  onClick={() => setShowMockModal(true)}
                  disabled={loading}
                  className="w-full touch-active flex items-center justify-center gap-3 px-5 py-4 rounded-2xl bg-white text-slate-900 font-bold hover:bg-slate-100 transition-all duration-200 shadow-lg shadow-black/20 text-sm active:scale-95 disabled:opacity-50"
                >
                  {/* Google G Logo SVG */}
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" width="24" height="24">
                    <path
                      fill="#EA4335"
                      d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.67 1.57 14.99 1 12 1 7.35 1 3.37 3.67 1.39 7.56l3.89 3.02C6.21 7.42 8.87 5.04 12 5.04z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.29 1.48-1.14 2.73-2.4 3.58l3.73 2.89c2.18-2.01 3.7-4.99 3.7-8.62z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.78A7.17 7.17 0 0 1 4.9 12c0-.98.17-1.92.47-2.78L1.48 6.2C.54 8.08 0 10.18 0 12s.54 3.92 1.48 5.8l3.8-3.02z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.73-2.89c-1.04.7-2.38 1.11-4.23 1.11-3.13 0-5.79-2.38-6.72-5.54L1.39 16.8C3.37 20.69 7.35 23 12 23z"
                    />
                  </svg>
                  <span>{loading ? "Authenticating..." : "Sign in with Google"}</span>
                </button>
              )}
            </div>

            <div className="relative flex items-center justify-center my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <span className="relative px-3 bg-[#0c1322] text-xs text-slate-500 uppercase tracking-widest">
                Developer Mode
              </span>
            </div>

            {/* Quick Demo Bypass Button */}
            <button
              onClick={() => handleLogin("gunalrtr@gmail.com", "Gunal")}
              disabled={loading}
              className="w-full touch-active flex items-center justify-center gap-2 px-5 py-4 rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md shadow-blue-500/10 text-sm active:scale-95 disabled:opacity-50"
            >
              <LogIn className="w-4 h-4 shrink-0" />
              <span>Enter Demo Cockpit</span>
            </button>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div className="text-center mt-8 px-4 space-y-2">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            GSuite 360 will access your Work, Calendar, and Finance logs. All session data is stored securely in your Supabase configuration.
          </p>
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
            © 2026 Tomcodex Technologies
          </p>
        </div>
      </div>

      {/* Mock Identity Modal */}
      {showMockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#0f172a]/95 border border-slate-800 p-6 rounded-3xl space-y-4 shadow-2xl shadow-black/80 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Mock Google Identity</h3>
              <button
                onClick={() => setShowMockModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed">
              Simulate Google Sign-In locally to create or load any user profile on your Supabase database.
            </p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={mockEmail}
                    onChange={(e) => setMockEmail(e.target.value)}
                    placeholder="e.g. user@gmail.com"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={mockName}
                    onChange={(e) => setMockName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-slate-200 text-sm focus:border-blue-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
            
            <button
              onClick={async () => {
                if (!mockEmail) {
                  setError("Email is required for authentication");
                  setShowMockModal(false);
                  return;
                }
                setShowMockModal(false);
                await handleLogin(mockEmail, mockName || "Mock User", "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=128");
              }}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors active:scale-[0.98]"
            >
              Sign In & Save Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

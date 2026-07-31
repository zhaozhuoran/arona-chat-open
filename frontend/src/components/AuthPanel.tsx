import { SignIn, SignUp, useAuth } from "@clerk/clerk-react";
import { useState } from "react";
import { Lock } from "lucide-react";

type AuthPanelProps = {
  loading: boolean;
  previewAvailable: boolean;
  onPasswordLogin: (password: string) => Promise<void>;
};

type ClerkMode = "signin" | "signup";

const IS_CLERK_AVAILABLE = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

const clerkAppearance = {
  variables: {
    colorPrimary: "#FF43C8",
    colorText: "#0F172A",
    colorBackground: "transparent",
  },
  elements: {
    card: {
      boxShadow: "none",
      backgroundColor: "transparent",
    },
    header: { display: "none" },
    footer: { display: "none" },
  },
} as const;

export const AuthPanel = ({ loading, previewAvailable, onPasswordLogin }: AuthPanelProps) => {
  const [password, setPassword] = useState("");
  const [clerkMode, setClerkMode] = useState<ClerkMode>("signin");
  const clerk = IS_CLERK_AVAILABLE ? useAuth() : null;
  const isClerkAvailable = Boolean(clerk);

  return (
    <div className="ba-auth-screen">
      <div className="ba-auth-card">
        <img src="/ba/arona-logo.jpg" alt="Arona" className="ba-auth-avatar" />
        <h1>Arona</h1>
        <p>SCHALE TERMINAL</p>

        {previewAvailable && (
          <>
            <div className="ba-auth-preview-notice">
              ⚠ Preview build — enter the preview password to explore.
            </div>
            <div className="ba-auth-field" style={{ width: "100%", marginTop: "0.5rem" }}>
              <span>Access Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && password.trim()) {
                    void onPasswordLogin(password);
                  }
                }}
                placeholder="••••••••"
                disabled={loading}
              />
            </div>
            <button
              type="button"
              className="ba-auth-button primary"
              style={{ width: "100%" }}
              disabled={loading || !password.trim()}
              onClick={() => void onPasswordLogin(password)}
            >
              <Lock size={16} />
              <span>Enter Schale Terminal</span>
            </button>
            {!isClerkAvailable && <small style={{ marginTop: "0.5rem", opacity: 0.7 }}>Passkey and Clerk login are disabled in this preview build.</small>}
          </>
        )}

        {isClerkAvailable && (
          <>
            <div className="ba-auth-divider" style={{ width: "100%", height: "1px", background: "rgba(15, 23, 42, 0.08)", margin: "1rem 0" }} />
            <div className="ba-auth-tabs" style={{ display: "flex", width: "100%", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <button
                type="button"
                className={`ba-auth-tab ${clerkMode === "signin" ? "active" : ""}`}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  borderRadius: "8px",
                  border: "1px solid var(--arona-border-soft)",
                  background: clerkMode === "signin" ? "#FF43C8" : "transparent",
                  color: clerkMode === "signin" ? "#fff" : "#475569",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setClerkMode("signin")}
              >
                Sign In
              </button>
              <button
                type="button"
                className={`ba-auth-tab ${clerkMode === "signup" ? "active" : ""}`}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  borderRadius: "8px",
                  border: "1px solid var(--arona-border-soft)",
                  background: clerkMode === "signup" ? "#FF43C8" : "transparent",
                  color: clerkMode === "signup" ? "#fff" : "#475569",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setClerkMode("signup")}
              >
                Sign Up
              </button>
            </div>
            <div className="clerk-signin-wrapper">
              {clerkMode === "signin" ? (
                <SignIn routing="virtual" appearance={clerkAppearance} />
              ) : (
                <SignUp routing="virtual" appearance={clerkAppearance} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

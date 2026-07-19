import { SignIn, useAuth } from "@clerk/clerk-react";
import { useState } from "react";
import { Lock } from "lucide-react";

type AuthPanelProps = {
  loading: boolean;
  previewAvailable: boolean;
  onPasswordLogin: (password: string) => Promise<void>;
};

const IS_CLERK_AVAILABLE = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

export const AuthPanel = ({ loading, previewAvailable, onPasswordLogin }: AuthPanelProps) => {
  const [password, setPassword] = useState("");
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
            <div className="ba-auth-divider" style={{ width: "100%", height: "1px", background: "rgba(15, 98, 166, 0.1)", margin: "1rem 0" }} />
            <div className="clerk-signin-wrapper">
              <SignIn
                appearance={{
                  variables: {
                    colorPrimary: "#0f62a6",
                    colorText: "#0d314f",
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
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

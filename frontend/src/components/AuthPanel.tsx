import { useState } from "react";
import { Fingerprint, KeyRound } from "lucide-react";

type AuthPanelProps = {
  loading: boolean;
  previewAvailable: boolean;
  onPasswordLogin: (password: string) => Promise<void>;
  onPasskeyLogin: () => Promise<void>;
};

export const AuthPanel = ({ loading, previewAvailable, onPasswordLogin, onPasskeyLogin }: AuthPanelProps) => {
  const [password, setPassword] = useState("");
  const [showPasswordLogin] = useState(() => {
    const revealed = sessionStorage.getItem("arona-chat.show-password-login") === "1";
    if (revealed) {
      sessionStorage.removeItem("arona-chat.show-password-login");
    }
    return revealed;
  });

  const submitPassword = async () => {
    if (!password.trim()) {
      return;
    }
    await onPasswordLogin(password);
    setPassword("");
  };

  return (
    <div className="ba-auth-screen">
        <div className="ba-auth-card">
          <img src="/ba/arona-logo.jpg" alt="Arona" className="ba-auth-avatar" />
          <h1>Arona</h1>
          <p>SCHALE TERMINAL</p>

        {previewAvailable && (
          <div className="ba-auth-preview-notice">
            ⚠ Preview build — sign in with the preview password to explore.
          </div>
        )}

        <button type="button" className="ba-auth-button" onClick={() => void onPasskeyLogin()} disabled={loading}>
          <Fingerprint size={16} />
          <span>Passkey Login</span>
        </button>

        {!showPasswordLogin && (
          <button
            type="button"
            className="ba-auth-text-trigger"
            disabled={loading}
            onClick={() => {
              sessionStorage.setItem("arona-chat.show-password-login", "1");
              window.location.reload();
            }}
          >
            Password Login
          </button>
        )}

        {showPasswordLogin && (
          <>
            <label className="ba-auth-field">
              <span>Password</span>
              <input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void submitPassword();
                  }
                }}
                disabled={loading}
              />
            </label>

            <button type="button" className="ba-auth-button primary" onClick={() => void submitPassword()} disabled={loading}>
              <KeyRound size={16} />
              <span>Password Login</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

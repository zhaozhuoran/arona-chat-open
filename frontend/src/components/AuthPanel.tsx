import { SignIn } from "@clerk/clerk-react";

type AuthPanelProps = {
  loading: boolean;
  previewAvailable: boolean;
  onPasswordLogin: (password: string) => Promise<void>;
  onPasskeyLogin: () => Promise<void>;
};

export const AuthPanel = ({ previewAvailable }: AuthPanelProps) => {
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
      </div>
    </div>
  );
};

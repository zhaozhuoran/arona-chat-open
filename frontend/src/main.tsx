import { StrictMode, Component, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import 'katex/dist/katex.min.css'
import './index.css'
import App from './App.tsx'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          color: '#003153',
          background: '#edf5ff'
        }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Application Error</h1>
          <p style={{ color: '#5f7f98', maxWidth: '500px', lineHeight: '1.5', wordBreak: 'break-word' }}>
            {this.state.error?.message || "An unexpected error occurred during startup."}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '1.5rem',
              padding: '10px 20px',
              background: '#0f62a6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const rootElement = document.getElementById('root')!;

if (!PUBLISHABLE_KEY) {
  createRoot(rootElement).render(
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      textAlign: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#003153',
      background: '#edf5ff'
    }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Configuration Error</h1>
      <p style={{ color: '#5f7f98', maxWidth: '400px', lineHeight: '1.5' }}>
        Missing <strong>Clerk Publishable Key</strong>. <br /><br />
        Please ensure the <code>VITE_CLERK_PUBLISHABLE_KEY</code> environment variable is set correctly during the build process.
      </p>
    </div>
  );
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
          <App />
        </ClerkProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
}

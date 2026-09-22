"use client";

/** Shown while MSAL is starting up or finishing a redirect and the page cannot yet decide what to render. */
export default function AuthLoading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "50vh",
        gap: "var(--space-4)",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid rgba(0, 68, 70, 0.1)",
          borderTopColor: "var(--teal-primary)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p style={{ color: "var(--text-tertiary)", fontSize: "var(--text-base)" }}>
        Signing in...
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

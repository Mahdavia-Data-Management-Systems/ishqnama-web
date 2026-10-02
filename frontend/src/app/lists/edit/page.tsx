"use client";

import { Suspense, useEffect, useRef } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import AuthLoading from "@/components/auth-loading";
import EmptyState from "@/components/empty-state";
import ProtectedRoute from "@/components/protected-route";
import { SIGN_IN_COPY, SIGN_IN_LABEL } from "@/config/sign-in-copy";
import { useSignInPrompt } from "@/context/sign-in-prompt-context";
import ListEditor from "./list-editor";

/**
 * The editor is for the list's owner. Like SavedGate: wait for MSAL to settle, show anonymous
 * readers the sign-in prompt, and only then mount ProtectedRoute for signed-in ones (mounting it
 * earlier would race its own redirect).
 */
function EditGate() {
  const isAuthenticated = useIsAuthenticated();
  const { authSettled, promptSignIn } = useSignInPrompt();
  const anonymous = authSettled && !isAuthenticated;
  const prompted = useRef(false);

  useEffect(() => {
    if (!anonymous || prompted.current) return;
    prompted.current = true;
    promptSignIn("lists");
  }, [anonymous, promptSignIn]);

  if (!authSettled) return <AuthLoading />;

  if (!isAuthenticated) {
    return (
      <main style={{ padding: "var(--space-8) 0 var(--space-16)" }}>
        <div className="page-container">
          <EmptyState
            icon="listBullet"
            title={SIGN_IN_COPY.lists.title}
            body={SIGN_IN_COPY.lists.body}
            action={{ label: SIGN_IN_LABEL, onClick: () => promptSignIn("lists") }}
          />
        </div>
      </main>
    );
  }

  return (
    <ProtectedRoute>
      <ListEditor />
    </ProtectedRoute>
  );
}

export default function ListEditPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <EditGate />
    </Suspense>
  );
}

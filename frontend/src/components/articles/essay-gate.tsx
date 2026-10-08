"use client";

import { useEffect, useRef } from "react";
import { useIsAuthenticated } from "@azure/msal-react";
import AuthLoading from "@/components/auth-loading";
import EmptyState from "@/components/empty-state";
import ProtectedRoute from "@/components/protected-route";
import EssayContent from "@/components/articles/essay-content";
import { SIGN_IN_COPY, SIGN_IN_LABEL } from "@/config/sign-in-copy";
import { useSignInPrompt } from "@/context/sign-in-prompt-context";

/**
 * The essay's text, for signed-in readers only. Same settle-then-gate order as LibraryGate, which
 * explains why ProtectedRoute must not mount before auth has settled. The page around it (title,
 * neighbours) is static and shown to everyone.
 */
export default function EssayGate({ slug }: { slug: string }) {
  const isAuthenticated = useIsAuthenticated();
  const { authSettled, promptSignIn } = useSignInPrompt();
  const anonymous = authSettled && !isAuthenticated;
  const prompted = useRef(false);

  useEffect(() => {
    if (!anonymous || prompted.current) return;
    prompted.current = true;
    promptSignIn("articles");
  }, [anonymous, promptSignIn]);

  if (!authSettled) return <AuthLoading />;

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon="article"
        title={SIGN_IN_COPY.articles.title}
        body={SIGN_IN_COPY.articles.body}
        action={{ label: SIGN_IN_LABEL, onClick: () => promptSignIn("articles") }}
      />
    );
  }

  return (
    <ProtectedRoute>
      <EssayContent slug={slug} />
    </ProtectedRoute>
  );
}

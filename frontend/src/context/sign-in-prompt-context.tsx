"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { loginRequest } from "@/config/auth-config";
import SignInPromptSheet from "@/components/sign-in-prompt-sheet";
import type { SignInFeature } from "@/config/sign-in-copy";

interface SignInPromptContextValue {
  isOpen: boolean;
  feature: SignInFeature | null;
  /** True once MSAL has finished starting up or handling a redirect (inProgress === None). */
  authSettled: boolean;
  /** Open the prompt for a feature. Pages that prompt on arrival must wait for authSettled first. */
  promptSignIn: (feature: SignInFeature) => void;
  dismiss: () => void;
}

const SignInPromptContext = createContext<SignInPromptContextValue | null>(null);

/**
 * Owns the one sign-in prompt for the whole app. Mounted in AppShell inside AuthProvider so
 * every provider, page and component below it can gate an account-only action.
 */
export default function SignInPromptProvider({ children }: { children: ReactNode }) {
  const isAuthenticated = useIsAuthenticated();
  const { instance, inProgress } = useMsal();
  const [feature, setFeature] = useState<SignInFeature | null>(null);

  // Once signed in, forget the pending feature so a later sign-out does not reopen the sheet.
  useEffect(() => {
    if (isAuthenticated) setFeature(null);
  }, [isAuthenticated]);

  const promptSignIn = useCallback((f: SignInFeature) => setFeature(f), []);
  const dismiss = useCallback(() => setFeature(null), []);

  const signIn = useCallback(() => {
    // The sheet stays open while the browser navigates away. If the call rejects (for example
    // an interaction is already in progress) it also stays open; MSAL logs the error itself.
    instance.loginRedirect(loginRequest).catch(() => {});
  }, [instance]);

  // Reading isAuthenticated here means the sheet closes the moment a sign-in completes.
  const isOpen = feature !== null && !isAuthenticated;
  const authSettled = inProgress === InteractionStatus.None;

  const value = useMemo<SignInPromptContextValue>(
    () => ({ isOpen, feature, authSettled, promptSignIn, dismiss }),
    [isOpen, feature, authSettled, promptSignIn, dismiss],
  );

  return (
    <SignInPromptContext.Provider value={value}>
      {children}
      <SignInPromptSheet isOpen={isOpen} feature={feature} onSignIn={signIn} onClose={dismiss} />
    </SignInPromptContext.Provider>
  );
}

export function useSignInPrompt(): SignInPromptContextValue {
  const ctx = useContext(SignInPromptContext);
  if (!ctx) throw new Error("useSignInPrompt must be used within SignInPromptProvider");
  return ctx;
}

/**
 * Returns gate(action). Signed in: runs action and returns true. Anonymous: opens the prompt
 * for `feature`, does not run action, and returns false. Call sites never check auth themselves.
 */
export function useSignInGate(feature: SignInFeature): (action: () => void) => boolean {
  const isAuthenticated = useIsAuthenticated();
  const { promptSignIn } = useSignInPrompt();
  return useCallback(
    (action: () => void) => {
      if (isAuthenticated) {
        action();
        return true;
      }
      promptSignIn(feature);
      return false;
    },
    [isAuthenticated, promptSignIn, feature],
  );
}

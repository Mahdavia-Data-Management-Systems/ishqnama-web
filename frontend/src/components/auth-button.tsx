"use client";

import { useMsal, useIsAuthenticated } from "@azure/msal-react";
import { loginRequest } from "@/config/auth-config";

export default function AuthButton() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const handleLogin = () => {
    instance.loginRedirect(loginRequest);
  };

  const handleLogout = () => {
    instance.logoutRedirect();
  };

  if (isAuthenticated && accounts.length > 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>        
        <span>{accounts[0].name ?? accounts[0].username}</span>
        <button onClick={handleLogout}>Logout</button>
      </div>
    );
  }

  return <button onClick={handleLogin}>Login</button>;
}

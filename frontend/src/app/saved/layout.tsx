"use client";

import SavedGate from "@/components/saved-gate";

export default function SavedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SavedGate>{children}</SavedGate>;
}

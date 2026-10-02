import { Suspense } from "react";
import AuthLoading from "@/components/auth-loading";
import ListView from "./list-view";

export default function ListViewPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <ListView />
    </Suspense>
  );
}

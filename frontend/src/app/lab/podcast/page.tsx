import { Suspense } from "react";
import AuthLoading from "@/components/auth-loading";
import PodcastLab from "./podcast-lab";

// `useSearchParams` needs a Suspense boundary under the static export, as on /lists/view/.
export default function PodcastLabPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <PodcastLab />
    </Suspense>
  );
}

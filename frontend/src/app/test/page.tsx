import styles from "../static-page.module.css";
import { pageMetadata } from "@/lib/page-metadata";
import TestPlayable from "./test-playable";

export const metadata = pageMetadata({
  title: "Test",
  description: "A page for trying features of Ishqnama before they reach the content.",
  path: "/test/",
});

/** A scratch page for trying features by hand. Kept out of robots.txt and the sitemap. */
export default function TestPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Test</h1>
        <div className={styles.body}>
          <h2>Recordings</h2>
          <p>
            Text that can be played carries a small play mark. Tap it to hear the recording in
            the dock along the bottom of the screen, and tap it again to pause. The dock keeps
            playing while you move between pages.
          </p>
          <TestPlayable />
        </div>
      </div>
    </main>
  );
}

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ArabicPassage from "@/components/lists/arabic-passage";
import styles from "@/components/lists/arabic-passage.module.css";

vi.mock("@/context/reader-settings-context", () => ({ useReaderSettings: () => ({ lang: "english", fontScale: 2 }) }));
vi.mock("@/context/audio-player-context", () => ({
  useAudioPlayer: () => ({ isCurrent: (ref: { chapter: number; verse: number }) => ref.chapter === 2 && ref.verse === 2 }),
}));

afterEach(cleanup);

describe("ArabicPassage", () => {
  it("gives every verse the reader's id and washes the one being read", () => {
    render(
      <ArabicPassage
        chapter={2}
        verses={[
          { verseNumber: 1, arabicText: "الٓمٓ", hasSajdah: false },
          { verseNumber: 2, arabicText: "ذَٰلِكَ", hasSajdah: false },
        ]}
      />,
    );
    expect(document.getElementById("verse-2-1")).not.toBeNull();
    expect(document.getElementById("verse-2-2")?.classList.contains(styles.reading)).toBe(true);
    expect(document.getElementById("verse-2-1")?.classList.contains(styles.reading)).toBe(false);
  });
});

import { Fragment } from "react";
import type { Block, PairRow, Run, RunKind } from "@/types/articles";
import styles from "./essay-body.module.css";

const LANG: Record<RunKind, string> = { urdu: "ur", quran: "ar", arabic: "ar", farsi: "fa", english: "en" };

/** Urdu runs are plain text in the Urdu essay; every other run marks its language and face. */
function Runs({ runs }: { runs: Run[] }) {
  return (
    <>
      {runs.map((run, i) =>
        run.kind === "urdu" ? (
          <Fragment key={i}>{run.text}</Fragment>
        ) : (
          <span
            key={i}
            lang={LANG[run.kind]}
            // A dir attribute isolates the run, so English punctuation keeps its place in RTL text
            dir={run.kind === "english" ? "ltr" : undefined}
            data-kind={run.kind}
            className={styles[run.kind]}
          >
            {run.text}
          </span>
        ),
      )}
    </>
  );
}

function Paragraphs({ paragraphs }: { paragraphs: Run[][] }) {
  return (
    <>
      {paragraphs.map((runs, i) => (
        <p key={i}>
          <Runs runs={runs} />
        </p>
      ))}
    </>
  );
}

/** The book's two-column translation table: the quotation on the right, its Urdu rendering on the left. */
function Pair({ rows }: { rows: PairRow[] }) {
  return (
    <figure className={styles.pair}>
      {rows.map((row, i) => (
        <div key={i} className={styles.pairRow}>
          <blockquote className={styles.quote}>
            <Paragraphs paragraphs={row.quote} />
          </blockquote>
          <div className={styles.rendering}>
            <Paragraphs paragraphs={row.rendering} />
          </div>
        </div>
      ))}
    </figure>
  );
}

export default function EssayBody({ blocks }: { blocks: Block[] }) {
  const sections = blocks.filter((b): b is Extract<Block, { type: "h2" }> => b.type === "h2");

  return (
    <div className={styles.body} lang="ur" dir="rtl">
      {sections.length > 0 && (
        <nav className={styles.contents} aria-label="Contents">
          <ol>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  <Runs runs={s.runs} />
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {blocks.map((block, i) => {
        switch (block.type) {
          case "p":
            return (
              <p key={i} className={styles.paragraph}>
                <Runs runs={block.runs} />
              </p>
            );
          case "h2":
            return (
              <h2 key={i} id={block.id} className={styles.heading}>
                <span className={styles.bracket} aria-hidden="true">
                  ﴿
                </span>
                <Runs runs={block.runs} />
                <span className={styles.bracket} aria-hidden="true">
                  ﴾
                </span>
              </h2>
            );
          case "pair":
            return <Pair key={i} rows={block.rows} />;
        }
      })}
    </div>
  );
}

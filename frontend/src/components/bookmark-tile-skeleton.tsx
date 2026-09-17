import styles from "./bookmark-tile-skeleton.module.css";

interface BookmarkTileSkeletonProps {
  /** "tile" matches BookmarkTile's footprint; "row" matches a history list row. */
  variant?: "tile" | "row";
}

/**
 * A ghost placeholder shown while a signed-in reader's bookmarks or history
 * are still loading, so the layout does not jump when the real items arrive.
 * A blank page from the volume: paper-coloured, carrying the site's own gold
 * girih lattice, with a faint circle where the bookmark's icon will sit. No
 * animation; the loading rail carries the motion. Decorative only: hidden
 * from assistive technology; the page caption and the warm-up notice carry
 * the spoken explanation.
 */
export default function BookmarkTileSkeleton({ variant = "tile" }: BookmarkTileSkeletonProps) {
  return (
    <div className={variant === "row" ? styles.row : styles.tile} aria-hidden="true">
      {variant === "tile" && <span className={styles.mark} />}
    </div>
  );
}

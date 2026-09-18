"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { canRenderBook } from "@/lib/book-model-support";
import type { BookScene, BookVariant } from "./book-scene";
import styles from "./book-model.module.css";

export const BOOK_MODEL_URL = "/models/noor-e-imaan-book.v1.glb";
export const BOOK_POSTER = {
  src: "/images/noor-e-imaan-book-poster.webp",
  width: 640,
  height: 640,
};
export const BOOK_POSTER_ALT =
  "The printed volume of Noor e Imaan, a mint green hardcover with a teal border and gold title";

interface BookModelProps {
  variant: BookVariant;
  /** Fraction through the Quran; shows the ribbon marker when given. */
  progress?: number;
  className?: string;
  /** Element whose pointer position drives the tilt. Defaults to the book's own box. */
  tiltTargetRef?: RefObject<HTMLElement | null>;
  /** Home hero only: the poster is the page's largest image, fetch it first. */
  priority?: boolean;
  /** False keeps the poster only, whatever the browser can do. */
  live?: boolean;
}

function whenLoaded(callback: () => void): () => void {
  if (document.readyState === "complete") {
    callback();
    return () => {};
  }
  window.addEventListener("load", callback, { once: true });
  return () => window.removeEventListener("load", callback);
}

export default function BookModel({
  variant,
  progress,
  className,
  tiltTargetRef,
  priority = false,
  live = true,
}: BookModelProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BookScene | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // The gate runs on the client after mount; until then the poster is all there is.
  useEffect(() => {
    setEnabled(live && canRenderBook());
  }, [live]);

  // Lifecycle: wait for the window to load and the box to come near the viewport, then import
  // the scene module, build the scene, and fade the canvas in. Anything that fails leaves the
  // poster in place.
  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!enabled || !box || !canvas) return;

    let disposed = false;
    let started = false;
    let inView = false;
    let cancelLoad = () => {};

    const initialProgress = progress;
    const hoverCapable = window.matchMedia("(hover: hover)").matches;

    const start = () => {
      if (started) return;
      started = true;
      cancelLoad = whenLoaded(() => {
        if (disposed) return;
        import("./book-scene")
          .then((module) =>
            module.createBookScene(canvas, {
              variant,
              modelUrl: BOOK_MODEL_URL,
              progress: initialProgress,
              hoverCapable,
            }),
          )
          .then((scene) => {
            if (disposed) {
              scene.dispose();
              return;
            }
            sceneRef.current = scene;
            scene.resize(box.clientWidth, box.clientHeight);
            scene.setActive(inView && document.visibilityState === "visible");
            setIsLive(true);
          })
          .catch((error: unknown) => {
            // The poster stays. Nothing to show the reader; say why in development only.
            if (process.env.NODE_ENV === "development") console.error("BookModel:", error);
          });
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          inView = entry.isIntersecting;
          if (inView) start();
          sceneRef.current?.setActive(inView && document.visibilityState === "visible");
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(box);

    const resizeObserver = new ResizeObserver(() => {
      sceneRef.current?.resize(box.clientWidth, box.clientHeight);
    });
    resizeObserver.observe(box);

    const onVisibility = () => {
      sceneRef.current?.setActive(inView && document.visibilityState === "visible");
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      cancelLoad();
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      sceneRef.current?.dispose();
      sceneRef.current = null;
      setIsLive(false);
    };
    // `progress` is applied through its own effect; changing it must not rebuild the scene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, variant]);

  useEffect(() => {
    sceneRef.current?.setProgress(progress);
  }, [progress, isLive]);

  // Pointer tilt over the target element, on devices that can hover. The About book uses
  // drag-to-turn inside the scene instead.
  useEffect(() => {
    if (!isLive || variant === "inspect") return;
    if (!window.matchMedia("(hover: hover)").matches) return;
    const target = tiltTargetRef?.current ?? boxRef.current;
    if (!target) return;

    const onMove = (event: PointerEvent) => {
      const rect = target.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      sceneRef.current?.setTilt(x, y);
    };
    const onLeave = () => sceneRef.current?.setTilt(0, 0);

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerleave", onLeave);
    return () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerleave", onLeave);
    };
  }, [isLive, variant, tiltTargetRef]);

  const boxClass = [styles.box, variant === "inspect" ? styles.inspect : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div ref={boxRef} className={boxClass}>
      <div className={styles.shadow} aria-hidden="true" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static export; the poster is a plain file */}
      <img
        className={`${styles.poster} ${isLive ? styles.posterHidden : ""}`}
        src={BOOK_POSTER.src}
        width={BOOK_POSTER.width}
        height={BOOK_POSTER.height}
        alt={BOOK_POSTER_ALT}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        draggable={false}
      />
      {enabled && (
        <canvas
          ref={canvasRef}
          className={`${styles.canvas} ${isLive ? styles.live : ""}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

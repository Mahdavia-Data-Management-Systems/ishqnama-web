"use client";

import type { CSSProperties } from "react";
import { mascotImage, type Mascot, type MascotExpression } from "@/config/podcast";
import styles from "./mascot-avatar.module.css";

interface MascotAvatarProps {
  mascot: Mascot;
  expression: MascotExpression;
  /** Whether this mascot has the floor: its name is bright and its glow follows the voice. */
  speaking: boolean;
  /** The voice's loudness, 0 to 1; ignored for a listener. */
  level: number;
}

/**
 * One host's round portrait on the gold wash, showing the expression of the moment. While the
 * host speaks a gold glow breathes with the voice, from `--voice-level`, which the stylesheet
 * turns into the halo's opacity and size.
 */
export default function MascotAvatar({ mascot, expression, speaking, level }: MascotAvatarProps) {
  const style = { "--voice-level": speaking ? String(level) : "0" } as CSSProperties;
  return (
    <figure className={styles.avatar} data-speaking={speaking ? "true" : "false"} style={style}>
      <span className={styles.disc}>
        <img className={styles.portrait} src={mascotImage(mascot.id, expression)} alt={mascot.name} width={80} height={80} draggable={false} />
      </span>
      <figcaption className={styles.name}>{mascot.name}</figcaption>
    </figure>
  );
}

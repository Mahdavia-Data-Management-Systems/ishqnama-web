"use client";

import { useEffect, useRef } from "react";

/** How much of a level survives each frame when the sound drops: the glow fades over ~150 ms. */
const DECAY = 0.82;

/**
 * The loudness of a frame of time-domain analyser bytes, 0 for silence (every byte at the
 * centre, 128) to about 1 for a full swing.
 */
export function rmsLevel(bytes: Uint8Array): number {
  if (bytes.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) {
    const v = (bytes[i] - 128) / 128;
    sum += v * v;
  }
  return Math.min(1, Math.sqrt(sum / bytes.length) * Math.SQRT2);
}

/**
 * The glow for a loudness: speech on a normalised recording measures only about a tenth of full
 * scale, so the curve lifts that to half brightness and saturates well before full scale.
 */
export function glowLevel(rms: number): number {
  return Math.min(1, Math.sqrt(Math.max(0, rms) * 2.5));
}

/** The next displayed level: jumps up with the sound, falls back gradually. */
export function smoothLevel(previous: number, next: number): number {
  return next >= previous ? next : previous * DECAY + next * (1 - DECAY);
}

/**
 * Follows the loudness of an `<audio>` element frame by frame through the Web Audio analyser,
 * writing 0–1 into `onLevel`, so a glow can breathe with the voice without a React render per
 * frame. The analyser is created on the first call while `active`, which must follow a tap
 * (browsers refuse an AudioContext before one), and the element must be `crossOrigin`
 * because the recording comes from another origin. When the browser cannot provide one, the
 * level is left to the caller's fallback (it is never written).
 */
export function useAudioLevel(audio: HTMLAudioElement | null, active: boolean, onLevel: (level: number) => void): void {
  const graph = useRef<{ context: AudioContext; analyser: AnalyserNode; bytes: Uint8Array<ArrayBuffer> } | null>(null);
  const failed = useRef(false);

  useEffect(() => {
    if (!audio || !active || failed.current) return;
    if (!graph.current) {
      try {
        const context = new AudioContext();
        const source = context.createMediaElementSource(audio);
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        analyser.connect(context.destination);
        graph.current = { context, analyser, bytes: new Uint8Array(new ArrayBuffer(analyser.fftSize)) };
      } catch {
        failed.current = true;
        return;
      }
    }
    const { context, analyser, bytes } = graph.current;
    if (context.state === "suspended") void context.resume();

    let frame = 0;
    let level = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(bytes);
      level = smoothLevel(level, glowLevel(rmsLevel(bytes)));
      onLevel(level);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      onLevel(0);
    };
  }, [audio, active, onLevel]);

  useEffect(() => () => {
    void graph.current?.context.close();
    graph.current = null;
  }, []);
}

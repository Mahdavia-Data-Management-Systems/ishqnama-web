/**
 * The Ishqnama mark, teal on light pages and gold on dark ones. Both images are rendered and
 * CSS in globals.css shows the one for the current data-theme, so it is right from the first
 * paint and follows live theme changes without a hydration check. The hidden image is
 * display:none, so assistive tech sees only the visible one's alt; the gold one is also
 * marked aria-hidden so the pair never reads twice.
 */
export default function ThemedLogo({
  alt,
  width,
  height,
  className = "",
}: {
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-ishqnama.svg" alt={alt} width={width} height={height} className={`logo-light ${className}`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-ishqnama-gold.svg"
        alt=""
        aria-hidden="true"
        width={width}
        height={height}
        className={`logo-dark ${className}`}
      />
    </>
  );
}

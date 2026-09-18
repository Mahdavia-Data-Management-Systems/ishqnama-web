// Captures the hero book at rest from the running dev server into a transparent WebP.
// Usage: npm run dev (in another terminal), then npm run model:poster.
// Env: POSTER_URL (default http://localhost:3000/), CHROME_PATH (default: the usual install path).
import { mkdir } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const URL = process.env.POSTER_URL ?? "http://localhost:3000/";
const OUTPUT = path.resolve("public/images/noor-e-imaan-book-poster.webp");
const BUDGET_BYTES = 60 * 1024;

const defaultChrome = {
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/usr/bin/google-chrome",
}[process.platform];

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? defaultChrome,
  headless: true,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

try {
  const page = await browser.newPage();
  // 1280 wide puts the hero in its two-column layout; the book box is 320 css px, so at a
  // device scale of 2 the canvas is 640 by 640, the size BookModel declares for the poster.
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: "load" });
  await page.waitForFunction(() => typeof window.__renderBookPoster === "function", {
    timeout: 90_000,
  });
  // Let the settle animation and the fade finish so the first render is not mid-motion.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const dataUrl = await page.evaluate(() => window.__renderBookPoster());

  const png = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  const info = await sharp(png).webp({ quality: 88, alphaQuality: 90 }).toFile(OUTPUT);
  console.log(
    `${path.relative(process.cwd(), OUTPUT)}: ${info.width}x${info.height}, ${(info.size / 1024).toFixed(0)} KB`,
  );
  if (info.width !== 640 || info.height !== 640) {
    console.error("Unexpected size; is the hero in its 320 px two-column layout?");
    process.exit(1);
  }
  if (info.size > BUDGET_BYTES) {
    console.error(`Over budget: ${info.size} bytes > ${BUDGET_BYTES}. Lower the quality.`);
    process.exit(1);
  }
} finally {
  await browser.close();
}

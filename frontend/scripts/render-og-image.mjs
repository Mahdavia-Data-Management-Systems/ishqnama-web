// Renders the link-preview image that WhatsApp and other social platforms show for every page
// (the og:image and twitter:image set in src/lib/page-metadata.ts).
// Usage: npm run og:image. Needs local Chrome and network access for Google Fonts.
// Env: CHROME_PATH (default: the usual install path).
//
// The card is composed in HTML from files already in the repo (the gold logo, the book poster,
// the MDMS mark and the Nastaleeq font), so a change to any of them only needs a re-run.
// Its content is centred because WhatsApp shows a square crop of the middle in compact previews.
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";
import sharp from "sharp";

const OUTPUT = path.resolve("public/images/og-ishqnama.jpg");
const WIDTH = 1200;
const HEIGHT = 630;
// WhatsApp drops preview images much above 300 KB.
const BUDGET_BYTES = 250 * 1024;

const defaultChrome = {
  win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  linux: "/usr/bin/google-chrome",
}[process.platform];

const dataUrl = async (file, type) =>
  `data:${type};base64,${(await readFile(path.resolve(file))).toString("base64")}`;

const logo = await dataUrl("public/logo-ishqnama-gold.svg", "image/svg+xml");
const book = await dataUrl("public/images/noor-e-imaan-book-poster.webp", "image/webp");
const mdms = await dataUrl("public/images/mdms-mark.webp", "image/webp");
const nastaleeq = await dataUrl("public/fonts/JameelNooriNastaleeq.ttf", "font/ttf");

const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond&family=Source+Sans+3:wght@400;600&display=block">
<style>
  @font-face { font-family: "Jameel Noori Nastaleeq"; src: url("${nastaleeq}") format("truetype"); font-display: block; }
  * { margin: 0; box-sizing: border-box; }
  html, body { width: ${WIDTH}px; height: ${HEIGHT}px; }
  body {
    position: relative;
    overflow: hidden;
    background: radial-gradient(ellipse at 50% 35%, #0b5a5b 0%, #004446 45%, #00292b 100%);
    font-family: "Source Sans 3", sans-serif;
    color: #fff;
  }
  .lattice {
    position: absolute; inset: 0;
    background:
      repeating-linear-gradient(45deg, rgba(190,170,48,.09) 0 1px, transparent 1px 32px),
      repeating-linear-gradient(-45deg, rgba(190,170,48,.09) 0 1px, transparent 1px 32px);
  }
  .frame { position: absolute; inset: 22px; border: 1px solid rgba(247,228,151,.28); }
  .frame::after { content: ""; position: absolute; inset: 6px; border: 1px solid rgba(247,228,151,.14); }
  .arch {
    position: absolute; left: 50%; top: 70px; width: 600px; height: 640px; transform: translateX(-50%);
    border: 1px solid rgba(247,228,151,.2); border-radius: 300px 300px 0 0;
  }
  .mdms {
    position: absolute; top: 52px; left: 58px; display: flex; align-items: center; gap: 14px;
    font-size: 13px; font-weight: 600; letter-spacing: .16em; line-height: 1.5; color: rgba(255,255,255,.62);
  }
  .mdms img { width: 56px; height: 56px; border-radius: 8px; }
  .book {
    position: absolute; right: 36px; bottom: 34px; width: 300px; height: 300px;
    filter: drop-shadow(0 18px 30px rgba(0,0,0,.35));
  }
  .centre {
    position: absolute; left: 50%; top: 84px; width: 640px; transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; text-align: center;
  }
  .logo { height: 250px; }
  .rule { margin: 22px 0 10px; width: 300px; height: 1px; background: linear-gradient(90deg, transparent, #beaa30, transparent); }
  .urdu { font-family: "Jameel Noori Nastaleeq", serif; font-size: 50px; line-height: 1.6; color: #fff; }
  .tagline { margin-top: 4px; font-family: "EB Garamond", serif; font-size: 30px; line-height: 1.3; color: rgba(255,255,255,.9); }
  .languages { margin-top: 14px; font-size: 17px; font-weight: 600; letter-spacing: .22em; text-transform: uppercase; color: #beaa30; }
</style>
</head>
<body>
  <div class="lattice"></div>
  <div class="arch"></div>
  <div class="frame"></div>
  <div class="mdms"><img src="${mdms}" alt=""><span>MAHDAVIA<br>DATA MANAGEMENT SYSTEMS</span></div>
  <img class="book" src="${book}" alt="">
  <div class="centre">
    <img class="logo" src="${logo}" alt="">
    <div class="rule"></div>
    <div class="urdu" dir="rtl" lang="ur">نور ایمان</div>
    <div class="tagline">The Holy Quran with tarjuma and tafseer</div>
    <div class="languages">Urdu · Hindi · English</div>
  </div>
</body>
</html>`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? defaultChrome,
  headless: true,
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: "png" });

  await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(OUTPUT);
  const { size } = await stat(OUTPUT);
  console.log(`${path.relative(process.cwd(), OUTPUT)}: ${WIDTH}x${HEIGHT}, ${(size / 1024).toFixed(0)} KB`);
  if (size > BUDGET_BYTES) {
    console.error(`Over budget: ${size} bytes > ${BUDGET_BYTES}. Lower the quality.`);
    process.exit(1);
  }
} finally {
  await browser.close();
}

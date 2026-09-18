// Shrinks the Blender export into the file the site serves.
// Source: design/noor_e_iman_book.glb (34 MB, four large PNGs).
// Output: public/models/noor-e-imaan-book.v1.glb (budget 500 KB).
import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { prune, textureCompress } from "@gltf-transform/functions";
import sharp from "sharp";

const SOURCE = path.resolve("design/noor_e_iman_book.glb");
const OUTPUT = path.resolve("public/models/noor-e-imaan-book.v1.glb");
const BUDGET_BYTES = 500 * 1024;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const document = await io.read(SOURCE);

await document.transform(
  // The cover carries the title and border; keep it sharp.
  textureCompress({
    encoder: sharp,
    targetFormat: "webp",
    quality: 82,
    resize: [2048, 2048],
    pattern: /^book_cover_full/,
  }),
  // Page-block maps are barely visible at hero scale.
  textureCompress({
    encoder: sharp,
    targetFormat: "webp",
    quality: 82,
    resize: [1024, 512],
    pattern: /^book_pages_/,
  }),
  prune(),
);

await mkdir(path.dirname(OUTPUT), { recursive: true });
await io.write(OUTPUT, document);

const { size } = await stat(OUTPUT);
for (const texture of document.getRoot().listTextures()) {
  const [width, height] = texture.getSize() ?? [0, 0];
  const bytes = texture.getImage()?.byteLength ?? 0;
  console.log(
    `${texture.getName().padEnd(24)} ${texture.getMimeType().padEnd(12)} ${width}x${height} ${(bytes / 1024).toFixed(0)} KB`,
  );
}
console.log(`\n${path.relative(process.cwd(), OUTPUT)}: ${(size / 1024).toFixed(0)} KB`);

if (size > BUDGET_BYTES) {
  console.error(`Over budget: ${size} bytes > ${BUDGET_BYTES}`);
  process.exit(1);
}

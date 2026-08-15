import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const extensionRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const iconsDir = join(extensionRoot, "public", "icons");
const sourceIcon = join(iconsDir, "128.png");
const sizes = [16, 32, 48, 64, 128];

if (!existsSync(sourceIcon)) {
  throw new Error(`Icon source not found: ${sourceIcon}`);
}

mkdirSync(iconsDir, { recursive: true });

for (const size of sizes) {
  const target = join(iconsDir, `${size}.png`);
  if (size === 128) {
    if (target !== sourceIcon) copyFileSync(sourceIcon, target);
    continue;
  }
  resizeWithSips(sourceIcon, target, size);
}

console.log(
  `Generated extension icons from public/icons/128.png: ${sizes
    .map((size) => `${size}.png`)
    .join(", ")}`
);

function resizeWithSips(source, target, size) {
  try {
    execFileSync("sips", ["-z", String(size), String(size), source, "--out", target], {
      stdio: "ignore"
    });
    assertNonEmpty(target);
  } catch (error) {
    throw new Error(
      `Failed to generate ${size}.png from 128.png. This script uses macOS "sips"; install a PNG resize tool or generate icons manually. ${error instanceof Error ? error.message : ""}`
    );
  }
}

function assertNonEmpty(path) {
  if (!existsSync(path) || statSync(path).size === 0) {
    throw new Error(`Generated icon is missing or empty: ${path}`);
  }
}

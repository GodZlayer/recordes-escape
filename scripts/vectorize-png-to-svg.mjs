import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const potrace = require("potrace");

const [sourcePath, targetPath] = process.argv.slice(2);

if (!sourcePath || !targetPath) {
  console.error("Uso: node scripts/vectorize-png-to-svg.mjs origem.png destino.svg");
  process.exit(1);
}

const params = {
  blackOnWhite: false,
  threshold: 128,
  color: "#ffffff",
  background: "transparent",
  turdSize: 2,
  alphaMax: 1,
  optCurve: true,
  optTolerance: 0.2,
};

potrace.trace(sourcePath, params, async (error, svg) => {
  if (error) {
    console.error(error.message || error);
    process.exitCode = 1;
    return;
  }

  await writeFile(targetPath, svg, "utf8");
});

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "videos");
const tempDir = path.join(rootDir, "temp", `frames-${Date.now()}`);

const width = 1080;
const height = 1920;
const fps = 30;
const boardDuration = 11000;
const photoDuration = 6000;
const transitionDuration = 1150;
const transitionLead = transitionDuration * 0.45;

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".xml", "application/xml; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".woff2", "font/woff2"],
]);

function browserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} saiu com codigo ${code}`));
    });
  });
}

function startStaticServer() {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const decodedPath = decodeURIComponent(requestUrl.pathname);
    const safePath = path.normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(rootDir, safePath === "\\" || safePath === "/" ? "index.html" : safePath);

    if (!filePath.startsWith(rootDir)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.setHeader("Content-Type", mimeTypes.get(extension) || "application/octet-stream");
    response.setHeader("Cache-Control", "no-store");

    import("node:fs").then(({ createReadStream }) => {
      const stream = createReadStream(filePath);
      stream.on("error", () => {
        response.writeHead(404);
        response.end("Not found");
      });
      stream.pipe(response);
    });
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}/index.html` });
    });
  });
}

async function pageData(page) {
  return page.evaluate(async () => {
    const config = typeof loadConfig === "function" ? await loadConfig() : { roomCount: 7 };
    const text = await fetch("records.xml", { cache: "no-store" }).then((response) => response.text());
    const xml = new DOMParser().parseFromString(text, "application/xml");
    const records = [...xml.querySelectorAll("record")].map((record) => ({
      id: record.getAttribute("id") || record.querySelector("id")?.textContent.trim() || "",
      room: record.querySelector("room")?.textContent.trim() || "",
      team: record.querySelector("team")?.textContent.trim() || "",
      time: record.querySelector("time")?.textContent.trim() || "",
      style: record.getAttribute("style") || "script",
    }));
    const roomCount = Math.min(Math.max(Number.parseInt(config.roomCount, 10) || 7, 1), 7);
    const activeRecords = records.filter((record) => {
      const id = Number.parseInt(record.id, 10);
      return id >= 1 && id <= roomCount && record.room.trim() && record.team.trim() && record.time.trim();
    });
    return { activeRecords, roomCount };
  });
}

async function preparePage(page) {
  await page.addStyleTag({
    content: `
      :root { --art-scale: 2.4 !important; }
      html, body { width: ${width}px !important; height: ${height}px !important; overflow: hidden !important; }
      body { margin: 0 !important; }
      .fit-shell { width: ${width}px !important; height: ${height}px !important; }
      .frame { transform: scale(2.4) !important; transform-origin: 0 0 !important; }
      .fullscreen-button { display: none !important; }
    `,
  });

  await page.evaluate(() => {
    window.clearTimeout(cycleTimer);
    document.querySelector(".frame")?.classList.remove("show-photo", "is-wiping");
    document.getAnimations({ subtree: true }).forEach((animation) => animation.pause());
  });
}

function buildTimeline(activeRecords) {
  return activeRecords.flatMap((record) => {
    const listHold = Math.max(boardDuration - transitionLead, 0);
    const photoHold = Math.max(photoDuration - transitionLead, 0);

    return [
      { type: "list", duration: listHold, record },
      { type: "to-photo", duration: transitionLead, record },
      { type: "photo", duration: photoHold, record },
      { type: "to-list", duration: transitionLead, record },
    ];
  });
}

function timelinePosition(timeline, timeMs) {
  let elapsed = 0;

  for (const segment of timeline) {
    if (timeMs < elapsed + segment.duration) {
      return {
        segment,
        segmentTime: timeMs - elapsed,
        elapsed,
      };
    }
    elapsed += segment.duration;
  }

  const segment = timeline[timeline.length - 1];
  return {
    segment,
    segmentTime: Math.max(segment.duration - 1, 0),
    elapsed: Math.max(elapsed - segment.duration, 0),
  };
}

function describeTimeline(timeline) {
  return timeline
    .map((segment, index) => `${String(index + 1).padStart(2, "0")}. ${segment.type} - ${segment.record.room} (${(segment.duration / 1000).toFixed(2)}s)`)
    .join("\n");
}

function validateTimeline(timeline) {
  for (let index = 1; index < timeline.length; index += 1) {
    if (timeline[index - 1].type === "list" && timeline[index].type === "list") {
      throw new Error("Timeline invalida: duas telas de lista ficaram em sequencia.");
    }
  }
}

async function setFrame(page, position) {
  await page.evaluate(
    ({ segment, animationTime, transitionDuration: wipeDuration }) => {
      const frame = document.querySelector(".frame");
      const showPhoto = segment.type === "photo" || segment.type === "to-list";
      const isWiping = segment.type === "to-photo" || segment.type === "to-list";
      const wipeTime = isWiping ? segment.segmentTime : 0;

      window.clearTimeout(cycleTimer);
      if (typeof setPhotoRecord === "function") setPhotoRecord(segment.record);
      frame.classList.toggle("show-photo", showPhoto);
      frame.classList.toggle("is-wiping", isWiping);

      document.getAnimations({ subtree: true }).forEach((animation) => {
        const timing = animation.effect?.getTiming?.();
        const isOneShot = timing && Number.isFinite(timing.duration) && timing.iterations === 1;
        const isWipe = isOneShot && Math.abs(timing.duration - wipeDuration) < 5;
        animation.pause();
        animation.currentTime = isOneShot
          ? Math.min(isWipe ? wipeTime : segment.segmentTime, timing.duration)
          : animationTime;
      });
    },
    position,
  );

  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll(".frame img")].filter((image) => !image.hidden && image.src);
    return images.every((image) => image.complete && image.naturalWidth > 0);
  }, { timeout: 10000 });
}

async function main() {
  const executablePath = browserExecutable();
  if (!executablePath) {
    throw new Error("Chrome ou Edge nao encontrado. Instale um deles ou defina CHROME_PATH.");
  }

  await mkdir(outputDir, { recursive: true });
  await mkdir(tempDir, { recursive: true });

  const { server, url } = await startStaticServer();
  const browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding"],
  });

  try {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts?.ready);
    await page.waitForSelector("#entries article", { timeout: 15000 });
    await preparePage(page);

    const { activeRecords } = await pageData(page);
    if (!activeRecords.length) throw new Error("Nenhuma sala ativa encontrada em records.xml.");

    const timeline = buildTimeline(activeRecords);
    validateTimeline(timeline);
    const durationMs = timeline.reduce((sum, segment) => sum + segment.duration, 0);
    const fullFrameCount = Math.ceil((durationMs / 1000) * fps);
    const testFrameLimit = Number.parseInt(process.env.VIDEO_TEST_FRAMES || "", 10);
    const frameCount = Number.isFinite(testFrameLimit) && testFrameLimit > 0 ? Math.min(fullFrameCount, testFrameLimit) : fullFrameCount;
    const outputPath = path.join(outputDir, `painel-recordes-${timestamp()}.mp4`);

    console.log(`Salas ativas: ${activeRecords.length}`);
    console.log(`Duracao final: ${(durationMs / 1000).toFixed(2)}s`);
    console.log(`Frames: ${frameCount}${frameCount !== fullFrameCount ? ` de ${fullFrameCount}` : ""} (${fps} fps, ${width}x${height})`);
    console.log("Ordem da timeline:");
    console.log(describeTimeline(timeline));
    console.log("Renderizando frames...");

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const timeMs = frameIndex * (1000 / fps);
      const framePath = path.join(tempDir, `frame_${String(frameIndex + 1).padStart(6, "0")}.jpg`);
      const position = timelinePosition(timeline, timeMs);
      await setFrame(page, {
        segment: position.segment,
        segmentTime: position.segmentTime,
        animationTime: timeMs,
        transitionDuration,
      });
      await page.screenshot({ path: framePath, type: "jpeg", quality: 92, fullPage: false });

      if (frameIndex === 0 || (frameIndex + 1) % fps === 0 || frameIndex + 1 === frameCount) {
        const percent = Math.round(((frameIndex + 1) / frameCount) * 100);
        process.stdout.write(`\r${percent}%`);
      }
    }

    console.log("\nMontando MP4 com FFmpeg...");
    await run("ffmpeg", [
      "-y",
      "-framerate", String(fps),
      "-i", path.join(tempDir, "frame_%06d.jpg"),
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", "18",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputPath,
    ]);

    console.log(`\nArquivo final: ${outputPath}`);
    await rm(tempDir, { recursive: true, force: true });
  } finally {
    await browser.close().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

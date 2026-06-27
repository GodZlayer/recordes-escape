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

const renderWidth = 1080;
const renderHeight = 1920;
const rotateClockwise = process.argv.includes("--rotate-clockwise-landscape");
const outputWidth = rotateClockwise ? 1920 : renderWidth;
const outputHeight = rotateClockwise ? 1080 : renderHeight;
const fps = 30;
const boardDuration = 11000;
const photoDuration = 6000;
const transitionDuration = 1150;

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
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    path.join(process.env.LOCALAPPDATA || "", "Microsoft", "Edge", "Application", "msedge.exe"),
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
      html, body { width: ${renderWidth}px !important; height: ${renderHeight}px !important; overflow: hidden !important; }
      body { margin: 0 !important; }
      .fit-shell { width: ${renderWidth}px !important; height: ${renderHeight}px !important; }
      .frame { transform: scale(2.4) !important; transform-origin: 0 0 !important; }
      .header, .podium-mark, .entries, .photo-view, .photo-image, .screen-wipe {
        transition: none !important;
        animation: none !important;
      }
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
    return [
      { type: "list", duration: boardDuration, record },
      { type: "to-photo", duration: transitionDuration, record },
      { type: "photo", duration: photoDuration, record },
      { type: "to-list", duration: transitionDuration, record },
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
    ({ segment, segmentTime, animationTime }) => {
      const frame = document.querySelector(".frame");
      const listItems = [
        document.querySelector(".header"),
        document.querySelector(".podium-mark"),
        document.querySelector(".entries"),
      ].filter(Boolean);
      const photoView = document.querySelector(".photo-view");
      const photoImage = document.querySelector(".photo-image");
      const screenWipe = document.querySelector(".screen-wipe");
      const clamp = (value, min = 0, max = 1) => Math.min(Math.max(value, min), max);
      const easeOut = (value) => 1 - Math.pow(1 - clamp(value), 3);
      const easeInOut = (value) => {
        const t = clamp(value);
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };
      const safeSegmentTime = Number.isFinite(segmentTime) ? segmentTime : 0;
      const transitionProgress = clamp(safeSegmentTime / Math.max(segment.duration, 1));
      const transitionEase = easeOut(transitionProgress);
      const photoProgress =
        segment.type === "to-photo" ? transitionEase :
        segment.type === "photo" ? 1 :
        segment.type === "to-list" ? 1 - transitionEase :
        0;
      const listProgress =
        segment.type === "to-photo" ? 1 - transitionEase :
        segment.type === "photo" ? 0 :
        segment.type === "to-list" ? transitionEase :
        1;
      const wipeProgress = segment.type === "to-photo" || segment.type === "to-list" ? easeInOut(transitionProgress) : 0;

      window.clearTimeout(cycleTimer);
      if (typeof setPhotoRecord === "function") setPhotoRecord(segment.record);
      frame.classList.remove("show-photo", "is-wiping");

      listItems.forEach((element) => {
        element.style.opacity = String(listProgress);
        element.style.transform = `translateY(${(1 - listProgress) * -12}px) scale(${1 - (1 - listProgress) * 0.02})`;
        element.style.filter = `blur(${(1 - listProgress) * 3}px)`;
      });

      if (photoView) {
        photoView.style.opacity = String(photoProgress);
        photoView.style.clipPath = `inset(0 ${100 - photoProgress * 100}% 0 0)`;
      }

      if (photoImage) {
        const imageProgress = segment.type === "photo"
          ? clamp(safeSegmentTime / 5000)
          : photoProgress;
        photoImage.style.transform = `scale(${1.04 - imageProgress * 0.04})`;
      }

      if (screenWipe) {
        if (segment.type === "to-photo" || segment.type === "to-list") {
          screenWipe.style.opacity = wipeProgress < 0.5 ? wipeProgress * 2 : (1 - wipeProgress) * 2;
          screenWipe.style.transform = `translateX(${-120 + wipeProgress * 240}%)`;
        } else {
          screenWipe.style.opacity = "0";
          screenWipe.style.transform = "translateX(-120%)";
        }
      }

      document.getAnimations({ subtree: true }).forEach((animation) => {
        const fallbackTime = Number.isFinite(animationTime) ? animationTime : 0;

        animation.pause();
        animation.currentTime = Math.max(fallbackTime, 0);
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
    const page = await browser.newPage({ viewport: { width: renderWidth, height: renderHeight }, deviceScaleFactor: 1 });
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
    const testFrameStart = Number.parseInt(process.env.VIDEO_TEST_START || "", 10);
    const startFrame = Number.isFinite(testFrameStart) && testFrameStart > 0 ? Math.min(testFrameStart, fullFrameCount - 1) : 0;
    const frameCount = Number.isFinite(testFrameLimit) && testFrameLimit > 0 ? Math.min(fullFrameCount - startFrame, testFrameLimit) : fullFrameCount - startFrame;
    const outputSuffix = rotateClockwise ? "1920x1080-girado" : "1080x1920";
    const outputPath = path.join(outputDir, `painel-recordes-${outputSuffix}-${timestamp()}.mp4`);

    console.log(`Salas ativas: ${activeRecords.length}`);
    console.log(`Duracao final: ${(durationMs / 1000).toFixed(2)}s`);
    console.log(`Frames: ${frameCount}${frameCount !== fullFrameCount ? ` de ${fullFrameCount}` : ""} (${fps} fps, ${outputWidth}x${outputHeight})`);
    console.log("Ordem da timeline:");
    console.log(describeTimeline(timeline));
    console.log("Renderizando frames...");

    for (let renderedFrameIndex = 0; renderedFrameIndex < frameCount; renderedFrameIndex += 1) {
      const frameIndex = startFrame + renderedFrameIndex;
      const timeMs = frameIndex * (1000 / fps);
      const framePath = path.join(tempDir, `frame_${String(renderedFrameIndex + 1).padStart(6, "0")}.jpg`);
      const position = timelinePosition(timeline, timeMs);
      await setFrame(page, {
        segment: position.segment,
        segmentTime: position.segmentTime,
        animationTime: timeMs,
      });
      await page.screenshot({ path: framePath, type: "jpeg", quality: 92, fullPage: false });

      if (renderedFrameIndex === 0 || (renderedFrameIndex + 1) % fps === 0 || renderedFrameIndex + 1 === frameCount) {
        const percent = Math.round(((renderedFrameIndex + 1) / frameCount) * 100);
        process.stdout.write(`\r${percent}%`);
      }
    }

    console.log("\nMontando MP4 com FFmpeg...");
    const ffmpegArgs = [
      "-y",
      "-framerate", String(fps),
      "-i", path.join(tempDir, "frame_%06d.jpg"),
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", "18",
    ];
    if (rotateClockwise) {
      ffmpegArgs.push("-vf", "transpose=1");
    }
    ffmpegArgs.push(
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      outputPath,
    );
    await run("ffmpeg", ffmpegArgs);

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

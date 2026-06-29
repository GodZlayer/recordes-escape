import { createServer } from "node:http";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const designsDirectory = join(root, "designs");
const libraryDirectory = join(designsDirectory, "library");
const port = Number(process.env.CANVA_BRIDGE_PORT || 3210);
const host = process.env.CANVA_BRIDGE_HOST || "127.0.0.1";
const aliases = new Map([
  ["photo", "groups"],
  ["group", "groups"],
  ["grupos", "groups"],
  ["lista", "list"],
  ["transicao", "transition"],
]);
const validDesigns = new Set(["list", "transition", "groups"]);

function json(response, status, value) {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Private-Network": "true",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value, null, 2));
}

function designName(rawName = "") {
  const normalizedName = String(rawName).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const name = aliases.get(normalizedName) || normalizedName;
  return validDesigns.has(name) ? name : null;
}

function designId(rawId = "default") {
  const value = String(rawId)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return value || "default";
}

function pathFor(screen, id = "default") {
  return id === "default"
    ? join(designsDirectory, `${screen}.json`)
    : join(libraryDirectory, screen, `${id}.json`);
}

async function readDesign(screen, id = "default") {
  const document = JSON.parse(await readFile(pathFor(screen, designId(id)), "utf8"));
  if (document.extends) {
    const base = await readDesign(screen, document.extends);
    const { extends: _extends, ...overlay } = document;
    return { ...base, ...overlay };
  }
  return document;
}

async function listDesigns(screen) {
  const entries = [];
  const base = await readDesign(screen);
  entries.push({
    id: "default",
    name: base.name || "Design principal",
    screen,
    variant: base.variant,
    updatedAt: base.updatedAt,
    isDefault: true,
  });
  const directory = join(libraryDirectory, screen);
  try {
    for (const file of await readdir(directory)) {
      if (!file.endsWith(".json")) continue;
      const id = file.slice(0, -5);
      const document = await readDesign(screen, id);
      entries.push({
        id,
        name: document.name || id,
        screen,
        variant: document.variant,
        updatedAt: document.updatedAt,
        isDefault: false,
      });
    }
  } catch {
    // A pasta nasce quando a primeira variação é criada.
  }
  return entries.sort((a, b) =>
    String(a.variant || a.name).localeCompare(
      String(b.variant || b.name),
      "pt-BR",
      { numeric: true },
    ),
  );
}

async function createDesign(screen, payload) {
  const name = String(payload?.name || "").trim();
  if (!name) throw new Error("Informe um nome para o novo design.");
  const source = await readDesign(screen, payload?.sourceId || "default");
  const baseId = designId(name) === "default" ? "design" : designId(name);
  let id = baseId;
  let suffix = 2;
  const existing = new Set((await listDesigns(screen)).map((item) => item.id));
  while (existing.has(id)) id = `${baseId}-${suffix++}`;
  const document = validateDesign({ ...source, name }, screen);
  const directory = join(libraryDirectory, screen);
  await mkdir(directory, { recursive: true });
  await writeFile(pathFor(screen, id), `${JSON.stringify(document, null, 2)}\n`, "utf8");
  return { id, document };
}

async function bodyFrom(request) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 2_000_000) {
      throw new Error("Documento de design maior que 2 MB.");
    }
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function validateDesign(document, expectedName) {
  if (!document || document.schema !== "painel-canva/v1") {
    throw new Error("Schema ausente ou incompatível.");
  }
  if (!Array.isArray(document.elements)) {
    throw new Error("O documento precisa conter uma lista de elementos.");
  }
  if (document.canvas?.width !== 450 || document.canvas?.height !== 800) {
    throw new Error("O canvas precisa medir 450 × 800 px.");
  }
  document.screen = expectedName;
  document.updatedAt = new Date().toISOString();
  return document;
}

async function serveAsset(requestPath, response) {
  const relativePath = decodeURIComponent(requestPath.slice("/assets/".length));
  const target = normalize(join(root, relativePath));
  if (!target.startsWith(root) || ![".jpeg", ".jpg", ".png", ".svg", ".webp"].includes(extname(target).toLowerCase())) {
    json(response, 404, { error: "Asset não encontrado." });
    return;
  }
  try {
    const content = await readFile(target);
    const mime = {
      ".jpeg": "image/jpeg",
      ".jpg": "image/jpeg",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
    }[extname(target).toLowerCase()];
    response.writeHead(200, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Private-Network": "true",
      "Cache-Control": "no-store",
      "Content-Type": mime,
    });
    response.end(content);
  } catch {
    json(response, 404, { error: "Asset não encontrado." });
  }
}

const server = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    json(response, 204, {});
    return;
  }

  const url = new URL(request.url || "/", `http://${request.headers.host || `${host}:${port}`}`);
  if (url.pathname === "/api/health") {
    json(response, 200, { ok: true, schema: "painel-canva/v1" });
    return;
  }
  if (url.pathname.startsWith("/assets/") && request.method === "GET") {
    await serveAsset(url.pathname, response);
    return;
  }

  const libraryMatch = url.pathname.match(/^\/api\/designs\/([^/]+)\/library$/);
  const deleteMatch = url.pathname.match(/^\/api\/designs\/([^/]+)\/([^/]+)$/);
  const match = url.pathname.match(/^\/api\/designs\/([^/]+)$/);
  const name = designName((libraryMatch || deleteMatch || match)?.[1]);
  if (!name) {
    json(response, 404, { error: "Use list, transition ou groups." });
    return;
  }

  try {
    if (libraryMatch && request.method === "GET") {
      json(response, 200, { designs: await listDesigns(name) });
      return;
    }
    if (libraryMatch && request.method === "POST") {
      const created = await createDesign(name, await bodyFrom(request));
      json(response, 201, {
        id: created.id,
        name: created.document.name,
        screen: name,
        updatedAt: created.document.updatedAt,
      });
      return;
    }
    if (deleteMatch && request.method === "DELETE") {
      const id = designId(deleteMatch[2]);
      if (id === "default") throw new Error("O design principal não pode ser excluído.");
      await unlink(pathFor(name, id));
      json(response, 200, { ok: true, id, screen: name });
      return;
    }

    const id = designId(url.searchParams.get("id") || "default");
    const path = pathFor(name, id);
    if (request.method === "GET") {
      json(response, 200, await readDesign(name, id));
      return;
    }
    if (request.method === "POST") {
      const document = validateDesign(await bodyFrom(request), name);
      await writeFile(path, `${JSON.stringify(document, null, 2)}\n`, "utf8");
      json(response, 200, { ok: true, screen: name, updatedAt: document.updatedAt });
      return;
    }
    json(response, 405, { error: "Método não permitido." });
  } catch (error) {
    json(response, 400, { error: error instanceof Error ? error.message : "Falha ao processar o design." });
  }
});

server.listen(port, host, () => {
  console.log(`Painel ↔ Canva bridge: http://${host}:${port}`);
  console.log("Endpoints: /api/designs/list, /transition e /groups");
});

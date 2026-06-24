import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const recordsPath = path.join(rootDir, "records.xml");
const configPath = path.join(rootDir, "config.xml");
const photosDir = path.join(rootDir, "fotos");
const logosDir = path.join(rootDir, "salaslogos");
const generatorPath = path.join(__dirname, "generate-video-mp4.mjs");
const vectorizerPath = path.join(__dirname, "vectorize-png-to-svg.mjs");
const photoExtensions = [".jpeg", ".png", ".jpg", ".webp"];

const rl = readline.createInterface({ input, output });

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function encodeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function parseRecords(xml) {
  return [...xml.matchAll(/<record\b([^>]*)>([\s\S]*?)<\/record>/g)].map((match) => {
    const id = match[1].match(/\bid="([^"]+)"/)?.[1] || "";
    const block = match[2];
    const field = (name) => decodeXml(block.match(new RegExp(`<${name}>\\s*([\\s\\S]*?)\\s*<\\/${name}>`))?.[1] || "");
    return {
      id,
      room: field("room"),
      team: field("team"),
      time: field("time"),
    };
  });
}

function updateRecordXml(xml, id, nextRecord) {
  return xml.replace(/<record\b([^>]*)>([\s\S]*?)<\/record>/g, (fullMatch, attrs, block) => {
    const currentId = attrs.match(/\bid="([^"]+)"/)?.[1] || "";
    if (currentId !== String(id)) return fullMatch;

    let nextBlock = block;
    for (const [tag, value] of [
      ["room", nextRecord.room],
      ["team", nextRecord.team],
      ["time", nextRecord.time],
    ]) {
      nextBlock = nextBlock.replace(
        new RegExp(`(<${tag}>)([\\s\\S]*?)(<\\/${tag}>)`),
        `$1${encodeXml(value)}$3`,
      );
    }
    return `<record${attrs}>${nextBlock}</record>`;
  });
}

async function loadRecords() {
  const xml = await readFile(recordsPath, "utf8");
  return { xml, records: parseRecords(xml) };
}

async function loadConfigXml() {
  return readFile(configPath, "utf8");
}

function currentListDesignNumber(configXml) {
  return configXml.match(/<config>[\s\S]*?<design\b[^>]*\bnumero="([^"]+)"/)?.[1] || "1";
}

function currentPhotoDesignNumber(configXml) {
  return configXml.match(/<foto>[\s\S]*?<design\b[^>]*\bnumero="([^"]+)"/)?.[1] || "1";
}

function updateListDesignXml(configXml, designNumber) {
  return configXml.replace(
    /(<config>[\s\S]*?<design\b[^>]*\bnumero=")([^"]+)(")/,
    `$1${designNumber}$3`,
  );
}

function updatePhotoDesignXml(configXml, designNumber) {
  return configXml.replace(
    /(<foto>[\s\S]*?<design\b[^>]*\bnumero=")([^"]+)(")/,
    `$1${designNumber}$3`,
  );
}

async function listDesignOptions(kind) {
  const files = await readdir(rootDir);
  const pattern = kind === "list" ? /^design-(\d+)\.html$/i : /^photo-design-(\d+)\.html$/i;
  return files
    .map((fileName) => {
      const match = fileName.match(pattern);
      if (!match) return null;
      return { number: match[1], fileName };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.number) - Number(b.number));
}

function printMenu(records) {
  console.clear();
  console.log("GERENCIADOR DE VIDEO - PAINEL DE RECORDES");
  console.log("");
  for (const record of records) {
    console.log(`${record.id}. ${record.room} | ${record.team} | ${record.time}`);
  }
  console.log("");
  console.log("A. Alterar design do quadro de recordes (lista)");
  console.log("B. Alterar design do quadro de foto");
  console.log("8. Gerar video 1080x1920");
  console.log("9. Gerar video 1920x1080 (retrato girado 90 graus sentido horario)");
  console.log("0. Fechar");
  console.log("");
}

async function askWithDefault(label, currentValue) {
  const answer = await rl.question(`${label} [${currentValue}]: `);
  return answer.trim() || currentValue;
}

async function openImagePicker({
  title = "Escolha a imagem da sala",
  filter = "Imagens (*.jpg;*.jpeg;*.png;*.webp)|*.jpg;*.jpeg;*.png;*.webp|Todos os arquivos (*.*)|*.*",
} = {}) {
  const script = [
    "Add-Type -AssemblyName System.Windows.Forms",
    "$dialog = New-Object System.Windows.Forms.OpenFileDialog",
    `$dialog.Title = '${title.replace(/'/g, "''")}'`,
    `$dialog.Filter = '${filter.replace(/'/g, "''")}'`,
    "$dialog.Multiselect = $false",
    "$dialog.CheckFileExists = $true",
    "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { $dialog.FileName }",
  ].join("; ");

  return new Promise((resolve, reject) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-STA", "-Command", script], {
      windowsHide: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Seletor de imagem finalizou com codigo ${code}.`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function writePngAsSvg(sourcePath, targetPath) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [vectorizerPath, sourcePath, targetPath], {
      cwd: rootDir,
      stdio: ["ignore", "ignore", "pipe"],
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `Conversor SVG finalizou com codigo ${code}.`));
    });
  });
}

async function replacePhoto(id) {
  const selectedPath = await openImagePicker();
  if (!selectedPath) {
    console.log("Nenhuma imagem selecionada. A imagem atual foi mantida.");
    return;
  }

  const extension = path.extname(selectedPath).toLowerCase();
  if (!photoExtensions.includes(extension)) {
    console.log("Formato nao aceito. Use JPG, JPEG, PNG ou WEBP.");
    return;
  }

  await mkdir(photosDir, { recursive: true });
  await Promise.all(
    photoExtensions.map((photoExtension) =>
      rm(path.join(photosDir, `${id}${photoExtension}`), { force: true }).catch(() => {}),
    ),
  );

  const targetPath = path.join(photosDir, `${id}${extension}`);
  await copyFile(selectedPath, targetPath);
  console.log(`Imagem substituida: ${targetPath}`);
}

async function replaceLogo(id) {
  const numericId = Number.parseInt(id, 10);
  if (!Number.isInteger(numericId) || numericId < 1) {
    console.log(`Logo da sala ${id} nao configurada.`);
    return;
  }

  const selectedPath = await openImagePicker({
    title: "Escolha a logo da sala em PNG",
    filter: "Logo PNG (*.png)|*.png|Todos os arquivos (*.*)|*.*",
  });
  if (!selectedPath) {
    console.log("Nenhuma logo selecionada. A logo atual foi mantida.");
    return;
  }

  const extension = path.extname(selectedPath).toLowerCase();
  if (extension !== ".png") {
    console.log("Formato nao aceito. Use PNG.");
    return;
  }

  await mkdir(logosDir, { recursive: true });
  const targetPath = path.join(logosDir, `${numericId}.svg`);
  await writePngAsSvg(selectedPath, targetPath);
  console.log(`Logo substituida: ${targetPath}`);
}

async function askPhotoReplacement(id) {
  while (true) {
    console.log("");
    console.log("Trocar imagem da sala?");
    console.log("1. Trocar imagem");
    console.log("2. Nao trocar");
    const option = (await rl.question("Escolha uma opcao: ")).trim();

    if (option === "1") {
      await replacePhoto(id);
      return;
    }
    if (option === "2" || option === "") {
      console.log("Imagem atual mantida.");
      return;
    }

    console.log("Opcao invalida.");
  }
}

async function askLogoReplacement(id) {
  while (true) {
    console.log("");
    console.log("Trocar logo da sala?");
    console.log("1. Trocar logo PNG e transformar em SVG");
    console.log("2. Nao trocar");
    const option = (await rl.question("Escolha uma opcao: ")).trim();

    if (option === "1") {
      await replaceLogo(id);
      return;
    }
    if (option === "2" || option === "") {
      console.log("Logo atual mantida.");
      return;
    }

    console.log("Opcao invalida.");
  }
}

async function editRecord(id) {
  const { xml, records } = await loadRecords();
  const current = records.find((record) => record.id === String(id));
  if (!current) {
    console.log(`Sala ${id} nao encontrada.`);
    await rl.question("Pressione Enter para voltar ao menu...");
    return;
  }

  console.log("");
  console.log(`Editando opcao ${id}. Deixe em branco para manter o valor atual.`);
  const nextRecord = {
    room: await askWithDefault("Nome da sala", current.room),
    team: await askWithDefault("Nome da equipe", current.team),
    time: await askWithDefault("Tempo", current.time),
  };
  await askPhotoReplacement(id);
  await askLogoReplacement(id);

  await writeFile(recordsPath, updateRecordXml(xml, id, nextRecord), "utf8");
  console.log("");
  console.log("Registro atualizado.");
  await rl.question("Pressione Enter para voltar ao menu...");
}

async function changeDesign(kind) {
  const configXml = await loadConfigXml();
  const options = await listDesignOptions(kind);
  const currentNumber = kind === "list" ? currentListDesignNumber(configXml) : currentPhotoDesignNumber(configXml);
  const title = kind === "list" ? "quadro de recordes (lista)" : "quadro de foto";

  console.log("");
  console.log(`Alterar design do ${title}`);
  console.log(`Atual: ${currentNumber}`);
  console.log("");

  if (!options.length) {
    console.log("Nenhum arquivo de design encontrado.");
    await rl.question("Pressione Enter para voltar ao menu...");
    return;
  }

  for (const option of options) {
    const marker = option.number === currentNumber ? " (atual)" : "";
    console.log(`${option.number}. ${option.fileName}${marker}`);
  }
  console.log("");

  const selected = (await rl.question("Escolha um design ou Enter para manter o atual: ")).trim();
  if (!selected) {
    console.log("Design atual mantido.");
    await rl.question("Pressione Enter para voltar ao menu...");
    return;
  }

  const selectedOption = options.find((option) => option.number === selected);
  if (!selectedOption) {
    console.log("Opcao invalida. Design atual mantido.");
    await rl.question("Pressione Enter para voltar ao menu...");
    return;
  }

  const nextConfigXml = kind === "list"
    ? updateListDesignXml(configXml, selectedOption.number)
    : updatePhotoDesignXml(configXml, selectedOption.number);
  await writeFile(configPath, nextConfigXml, "utf8");
  console.log(`Design alterado para ${selectedOption.fileName}.`);
  await rl.question("Pressione Enter para voltar ao menu...");
}

async function generateVideo(args = []) {
  console.log("");
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [generatorPath, ...args], {
      cwd: rootDir,
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Gerador finalizou com codigo ${code}.`));
    });
  });
  console.log("");
  await rl.question("Pressione Enter para voltar ao menu...");
}

async function main() {
  while (true) {
    const { records } = await loadRecords();
    printMenu(records);
    const option = (await rl.question("Escolha uma opcao: ")).trim();
    const normalizedOption = option.toLowerCase();

    if (option === "0") break;
    if (/^[1-7]$/.test(option)) {
      await editRecord(option);
      continue;
    }
    if (normalizedOption === "a") {
      await changeDesign("list");
      continue;
    }
    if (normalizedOption === "b") {
      await changeDesign("photo");
      continue;
    }
    if (option === "8") {
      await generateVideo();
      continue;
    }
    if (option === "9") {
      await generateVideo(["--rotate-clockwise-landscape"]);
      continue;
    }

    console.log("Opcao invalida.");
    await rl.question("Pressione Enter para voltar ao menu...");
  }
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => {
    rl.close();
  });

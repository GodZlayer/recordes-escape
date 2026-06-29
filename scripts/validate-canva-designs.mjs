import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const names = ["list", "transition", "groups"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateNode(node, context) {
  assert(node && typeof node === "object", `${context}: elemento inválido`);
  assert(typeof node.id === "string" && node.id, `${context}: id ausente`);
  assert(["rect", "text", "shape", "group"].includes(node.type), `${context}: tipo ${node.type} não suportado`);
  for (const field of ["left", "top", "width", "height"]) {
    assert(Number.isFinite(node[field]), `${context}/${node.id}: ${field} precisa ser numérico`);
  }
  assert(node.width > 0 && node.height > 0, `${context}/${node.id}: tamanho inválido`);
  if (node.type === "text") assert(typeof node.text === "string", `${context}/${node.id}: texto ausente`);
  if (node.type === "rect") assert(/^#[0-9a-f]{6}$/i.test(node.fill), `${context}/${node.id}: cor inválida`);
  if (node.type === "shape") {
    const paths = node.paths || [{ path: node.path }];
    paths.forEach((path, index) => {
      assert(typeof path.path === "string" && path.path, `${context}/${node.id}: path ${index} ausente`);
      const normalizedSegments = path.path
        .split(/(?=[Mm])/)
        .map((segment) => segment.trim())
        .filter(Boolean)
        .map((segment) => (/[Zz]\s*$/.test(segment) ? segment : `${segment} Z`));
      assert(
        normalizedSegments.every((segment) => (segment.match(/[Mm]/g) || []).length === 1 && /[Zz]\s*$/.test(segment)),
        `${context}/${node.id}: path ${index} não pôde ser normalizado para o Canva`,
      );
    });
  }
  if (node.type === "group") {
    assert(Array.isArray(node.children), `${context}/${node.id}: children ausente`);
    node.children.forEach((child, index) => validateNode(child, `${context}/${node.id}[${index}]`));
  }
}

for (const name of names) {
  const path = resolve(root, "designs", `${name}.json`);
  const document = JSON.parse(await readFile(path, "utf8"));
  assert(document.schema === "painel-canva/v1", `${name}: schema incompatível`);
  assert(document.screen === name, `${name}: screen incorreto`);
  assert(document.canvas?.width === 450 && document.canvas?.height === 800, `${name}: canvas precisa ser 450x800`);
  assert(Array.isArray(document.elements), `${name}: elements ausente`);
  document.elements.forEach((node, index) => validateNode(node, `${name}[${index}]`));
}

console.log("Designs Canva válidos: list, transition e groups.");

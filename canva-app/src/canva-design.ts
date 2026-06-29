import { findFonts } from "@canva/asset";
import type { FontRef } from "@canva/asset";
import { addElementAtPoint, openDesign } from "@canva/design";
import type { GroupContentAtPoint } from "@canva/design";
import type { DesignDocument, DesignNode, GroupNode, ScreenType, TextNode } from "./types";

type EditingSession = Parameters<Parameters<typeof openDesign>[1]>[0];
type AbsolutePage = Extract<EditingSession["page"], { type: "absolute" }>;
type PageHelpers = EditingSession["helpers"];
type AbsoluteElement = ReturnType<AbsolutePage["elements"]["toArray"]>[number];

function transparency(opacity = 1) {
  return Math.max(0, Math.min(1, 1 - opacity));
}

function nodeGeometry(node: DesignNode, offsetLeft: number, offsetTop: number) {
  return {
    top: offsetTop + node.top,
    left: offsetLeft + node.left,
    width: node.width,
    height: node.height,
    rotation: node.rotation || 0,
    transparency: transparency(node.opacity),
  };
}

function splitSvgMoveCommands(path: string) {
  const segments = path
    .split(/(?=[Mm])/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return (segments.length ? segments : [path]).map((segment) =>
    /[Zz]\s*$/.test(segment) ? segment : `${segment} Z`,
  );
}

function flattenedNodes(
  node: DesignNode,
  offsetLeft = 0,
  offsetTop = 0,
): Array<{ node: Exclude<DesignNode, GroupNode>; left: number; top: number }> {
  if (node.type === "group") {
    return node.children.flatMap((child) =>
      flattenedNodes(child, offsetLeft + node.left, offsetTop + node.top),
    );
  }
  return [{ node, left: offsetLeft + node.left, top: offsetTop + node.top }];
}

function nativeNodeFor(
  node: Exclude<DesignNode, GroupNode>,
  left: number,
  top: number,
  fontRefs: Map<string, FontRef>,
): GroupContentAtPoint {
  if (node.type === "text") {
    const fontRef = node.fontFamily
      ? fontRefs.get(node.fontFamily.toLowerCase())
      : undefined;
    return {
      type: "text",
      children: [node.text],
      top,
      left,
      width: node.width,
      rotation: node.rotation || 0,
      fontSize: node.fontSize || 16,
      fontStyle: node.fontStyle || "normal",
      fontWeight: node.fontWeight || "normal",
      textAlign: node.textAlign || "start",
      color: node.color || "#000000",
      ...(fontRef ? { fontRef } : {}),
    };
  }

  if (node.type === "rect") {
    return {
      type: "shape",
      top,
      left,
      width: node.width,
      height: node.height,
      rotation: node.rotation || 0,
      viewBox: { top: 0, left: 0, width: node.width, height: node.height },
      paths: [
        {
          d: `M0 0H${node.width}V${node.height}H0Z`,
          fill: { color: node.fill, dropTarget: false },
        },
      ],
    };
  }

  const normalizedPaths = (node.paths || [
    {
      path: node.path || "",
      fill: node.fill,
      stroke: node.stroke,
      strokeWeight: node.strokeWeight,
    },
  ]).flatMap((shapePath) =>
    splitSvgMoveCommands(shapePath.path).map((path) => ({
      ...shapePath,
      path,
    })),
  );
  return {
    type: "shape",
    top,
    left,
    width: node.width,
    height: node.height,
    rotation: node.rotation || 0,
    viewBox: node.viewBox,
    paths: normalizedPaths.map((path) => ({
      d: path.path,
      fill: { ...(path.fill ? { color: path.fill } : {}), dropTarget: false },
      ...(path.stroke
        ? {
            stroke: {
              color: path.stroke,
              weight: path.strokeWeight || 1,
              strokeAlign: "inset" as const,
            },
          }
        : {}),
    })),
  };
}

function fillColor(element: any, fallback = "#000000") {
  const ref = element.fill?.colorContainer?.ref;
  return ref?.type === "solid" ? ref.color : fallback;
}

function exportedGeometry(element: any) {
  return {
    left: Number(element.left || 0),
    top: Number(element.top || 0),
    width: Number(element.width || 1),
    height: Number(element.height || 1),
    rotation: Number(element.rotation || 0),
    opacity: 1 - Number(element.transparency || 0),
  };
}

function inferredRole(text: string) {
  const match = text.match(/\{\{(room|team|time|rank)\}\}/);
  return match?.[1];
}

function withData(node: DesignNode, data: Record<string, string | number>): DesignNode {
  const clone = structuredClone(node);
  if (clone.type === "text") {
    clone.text = clone.text.replace(/\{\{(room|team|time|rank)\}\}/g, (_, field) => String(data[field] ?? ""));
  } else if (clone.type === "group") {
    clone.children = clone.children.map((child) => withData(child, data));
  }
  return clone;
}

function exportElement(element: any, index: number, previous?: DesignNode): DesignNode | null {
  const geometry = exportedGeometry(element);
  const compatiblePrevious = previous?.type === element.type ? previous : undefined;
  if (element.type === "text") {
    const regions = element.text.readTextRegions();
    const first = regions[0]?.formatting || {};
    const text = regions.map((region: { text: string }) => region.text).join("");
    return {
      id: compatiblePrevious?.id || `text-${index}`,
      type: "text",
      role: inferredRole(text) || compatiblePrevious?.role,
      ...geometry,
      text,
      color: first.color || "#000000",
      fontSize: first.fontSize || 16,
      fontWeight: first.fontWeight || "normal",
      fontStyle: first.fontStyle || "normal",
      textAlign: first.textAlign || "start",
    } satisfies TextNode;
  }
  if (element.type === "rect") {
    return {
      id: compatiblePrevious?.id || `rect-${index}`,
      type: "rect",
      role: compatiblePrevious?.role,
      ...geometry,
      fill: fillColor(element),
    };
  }
  if (element.type === "shape") {
    const path = element.paths.toArray()[0];
    return {
      id: compatiblePrevious?.id || `shape-${index}`,
      type: "shape",
      role: compatiblePrevious?.role,
      ...geometry,
      viewBox: element.viewBox,
      path: path?.d || "",
      paths: element.paths.toArray().map((item: any) => ({
        path: item.d || "",
        fill: fillColor(item, "transparent"),
        stroke:
          item.stroke?.colorContainer?.ref?.type === "solid"
            ? item.stroke.colorContainer.ref.color
            : undefined,
        strokeWeight: item.stroke?.weight,
      })),
      fill: fillColor(path),
    };
  }
  if (element.type === "group") {
    const previousGroup = compatiblePrevious?.type === "group" ? compatiblePrevious : undefined;
    const children = element.contents
      .toArray()
      .map((child: any, childIndex: number) => exportElement(child, childIndex, previousGroup?.children[childIndex]))
      .filter(Boolean) as DesignNode[];
    return {
      id: compatiblePrevious?.id || `group-${index}`,
      type: "group",
      role: compatiblePrevious?.role,
      ...geometry,
      repeat: previousGroup?.repeat,
      children,
    } satisfies GroupNode;
  }
  return null;
}

function everyNode(elements: DesignNode[]): DesignNode[] {
  return elements.flatMap((element) => [
    element,
    ...(element.type === "group" ? everyNode(element.children) : []),
  ]);
}

function rebuildListTemplate(elements: DesignNode[], previous?: DesignDocument) {
  const previousTemplate = everyNode(previous?.elements || []).find(
    (node): node is GroupNode => node.type === "group" && node.role === "record-template",
  );
  if (!previousTemplate) return;

  const rowTop = previousTemplate.top;
  const rowLeft = previousTemplate.left;
  const rowBottom = rowTop + previousTemplate.height;
  const rowRight = rowLeft + previousTemplate.width;
  const belongsToFirstRow = (node: DesignNode) =>
    node.type !== "group" &&
    node.left >= rowLeft - 1 &&
    node.top >= rowTop - 1 &&
    node.left + node.width <= rowRight + 1 &&
    node.top + node.height <= rowBottom + 1;

  const firstRow = elements.filter(belongsToFirstRow);
  if (!firstRow.length) return;

  const previousChildren = previousTemplate.children;
  const children = firstRow.map((node) => {
    const child = structuredClone(node);
    child.left -= rowLeft;
    child.top -= rowTop;
    const previousChild = previousChildren.find(
      (candidate) =>
        candidate.type === child.type &&
        Math.abs(candidate.left - child.left) < 2 &&
        Math.abs(candidate.top - child.top) < 2,
    );
    if (previousChild) {
      child.id = previousChild.id;
      child.role = previousChild.role;
      if (child.type === "text" && previousChild.type === "text") {
        child.fontFamily = previousChild.fontFamily;
        if (["room", "team", "time", "rank"].includes(child.role || "")) {
          child.text = `{{${child.role}}}`;
        }
      }
    }
    return child;
  });

  const repeat = previousTemplate.repeat || { source: "records" as const, max: 7, gap: 3 };
  const repeatedBottom =
    rowTop + repeat.max * previousTemplate.height + Math.max(0, repeat.max - 1) * repeat.gap;
  const isRepeatedRowElement = (node: DesignNode) => {
    if (node.type === "group" || node.left < rowLeft - 1 || node.left + node.width > rowRight + 1) return false;
    if (node.top < rowTop - 1 || node.top + node.height > repeatedBottom + 1) return false;
    const relativeTop = node.top - rowTop;
    const stride = previousTemplate.height + repeat.gap;
    const rowIndex = Math.floor(Math.max(0, relativeTop) / stride);
    const localTop = relativeTop - rowIndex * stride;
    return rowIndex < repeat.max && localTop >= -1 && localTop + node.height <= previousTemplate.height + 1;
  };

  const insertionIndex = elements.findIndex(belongsToFirstRow);
  const retained = elements.filter((node) => !isRepeatedRowElement(node));
  const template: GroupNode = {
    ...structuredClone(previousTemplate),
    children,
    repeat,
  };
  retained.splice(Math.max(0, insertionIndex), 0, template);
  elements.splice(0, elements.length, ...retained);
}

function restoreScreenSemantics(screen: ScreenType, elements: DesignNode[], previous?: DesignDocument) {
  if (screen === "list") {
    rebuildListTemplate(elements, previous);
    const nodes = everyNode(elements);
    const template = nodes.find((node) => {
      if (node.type !== "group") return false;
      const roles = new Set(everyNode(node.children).map((child) => child.role).filter(Boolean));
      return roles.has("room") && roles.has("team") && roles.has("time");
    });
    if (template?.type === "group") {
      const previousTemplate = everyNode(previous?.elements || []).find(
        (node): node is GroupNode => node.type === "group" && node.role === "record-template",
      );
      template.role = "record-template";
      template.repeat = previousTemplate?.repeat || { source: "records", max: 7, gap: 12 };
      everyNode(template.children).forEach((node) => {
        if (node.type === "text" && ["room", "team", "time", "rank"].includes(node.role || "")) {
          node.text = `{{${node.role}}}`;
        }
      });
      const templateIndex = elements.indexOf(template);
      for (let index = elements.length - 1; index > templateIndex; index -= 1) {
        const candidate = elements[index];
        if (
          candidate.type === "group" &&
          Math.abs(candidate.width - template.width) < 2 &&
          Math.abs(candidate.height - template.height) < 2
        ) {
          elements.splice(index, 1);
        }
      }
    }
  }

  if (screen === "groups") {
    const nodes = everyNode(elements);
    const photoPlaceholder = nodes
      .filter((node) => node.type === "rect")
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (photoPlaceholder) photoPlaceholder.role = "photo-placeholder";
    nodes.forEach((node) => {
      if (node.type === "text" && ["room", "team", "time"].includes(node.role || "")) {
        node.text = `{{${node.role}}}`;
      }
    });
  }

  if (screen === "transition") {
    const nodes = everyNode(elements);
    const wipe = nodes
      .filter((node) => node.type === "rect")
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (wipe) wipe.role = "transition-wipe";
  }
}

export async function importIntoCanva(document: DesignDocument) {
  let fontRefs = new Map<string, FontRef>();
  try {
    const { fonts } = await findFonts();
    fontRefs = new Map(fonts.map((font) => [font.name.toLowerCase(), font.ref]));
  } catch {
    // O Canva aplica a fonte padrão quando a família sugerida não está disponível.
  }
  await openDesign({ type: "current_page" }, async (session) => {
    const page = session.page;
    if (page.type !== "absolute" || page.locked) {
      throw new Error("Abra um design Canva de tamanho fixo e desbloqueado.");
    }
    if (
      !page.dimensions ||
      Math.abs(page.dimensions.width - document.canvas.width) > 1 ||
      Math.abs(page.dimensions.height - document.canvas.height) > 1
    ) {
      throw new Error(
        `O design aberto mede ${page.dimensions?.width || "?"} × ${page.dimensions?.height || "?"}. ` +
          `Crie um design personalizado de ${document.canvas.width} × ${document.canvas.height} px antes de importar.`,
      );
    }
    page.elements.toArray().forEach((element) => page.elements.delete(element));
    page.background?.colorContainer?.set({
      type: "solid",
      color: document.canvas.background,
    });
    await session.sync();
  });

  const flattenedDesign: Array<{
    node: Exclude<DesignNode, GroupNode>;
    left: number;
    top: number;
  }> = [];
  for (const element of document.elements) {
    if (element.type === "group" && element.repeat?.source === "records") {
      const count = element.repeat.max || 1;
      for (let index = 0; index < count; index += 1) {
        const repeated = structuredClone(element);
        repeated.top = element.top + index * (element.height + (element.repeat.gap || 0));
        flattenedDesign.push(...flattenedNodes(repeated));
      }
    } else {
      flattenedDesign.push(...flattenedNodes(element));
    }
  }

  const children = flattenedDesign.map(({ node, left, top }) =>
    nativeNodeFor(node, left, top, fontRefs),
  );
  await addElementAtPoint({
    type: "group",
    children,
  });
}

export async function exportFromCanva(screen: ScreenType, previous?: DesignDocument) {
  let exported: DesignDocument | undefined;
  await openDesign({ type: "current_page" }, async (session) => {
    const page = session.page;
    if (page.type !== "absolute") {
      throw new Error("A página atual não usa coordenadas fixas.");
    }
    if (!page.dimensions || Math.abs(page.dimensions.width - 450) > 1 || Math.abs(page.dimensions.height - 800) > 1) {
      throw new Error("A exportação exige um design personalizado de 450 × 800 px.");
    }
    let elements = page.elements
      .toArray()
      .map((element, index) => exportElement(element, index, previous?.elements[index]))
      .filter(Boolean) as DesignNode[];
    if (elements.length === 1 && elements[0].type === "group") {
      const masterGroup = elements[0];
      elements = masterGroup.children.map((child) => ({
        ...child,
        left: child.left + masterGroup.left,
        top: child.top + masterGroup.top,
      }));
    }
    restoreScreenSemantics(screen, elements, previous);
    exported = {
      schema: "painel-canva/v1",
      screen,
      name: previous?.name || `Tela ${screen}`,
      canvas: {
        width: 450,
        height: 800,
        background: page.background ? fillColor(page.background, "#132019") : "#132019",
      },
      motion: previous?.motion,
      preview: previous?.preview,
      elements,
    };
  });
  if (!exported) {
    throw new Error("Não foi possível ler a página atual.");
  }
  return exported;
}

import { openDesign } from "@canva/design";
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

async function insertNode(
  page: AbsolutePage,
  helpers: PageHelpers,
  node: DesignNode,
  offsetLeft = 0,
  offsetTop = 0,
): Promise<AbsoluteElement> {
  if (node.type === "group") {
    const children: AbsoluteElement[] = [];
    for (const child of node.children) {
      children.push(await insertNode(page, helpers, child, offsetLeft + node.left, offsetTop + node.top));
    }
    return helpers.group({ elements: children as any });
  }

  const geometry = nodeGeometry(node, offsetLeft, offsetTop);
  if (node.type === "text") {
    const state = helpers.elementStateBuilder.createTextElement({
      ...geometry,
      text: {
        regions: [
          {
            text: node.text,
            formatting: {
              color: node.color || "#000000",
              fontSize: node.fontSize || 16,
              fontStyle: node.fontStyle || "normal",
              fontWeight: node.fontWeight || "normal",
              textAlign: node.textAlign || "start",
            },
          },
        ],
      },
    });
    return page.elements.insertAfter(undefined, state);
  }

  if (node.type === "shape") {
    const state = helpers.elementStateBuilder.createShapeElement({
      ...geometry,
      viewBox: node.viewBox,
      paths: [
        {
          d: node.path,
          fill: {
            colorContainer: { type: "solid", color: node.fill || "#000000" },
          },
          ...(node.stroke
            ? {
                stroke: {
                  weight: node.strokeWeight || 1,
                  colorContainer: {
                    type: "solid",
                    color: node.stroke,
                  },
                },
              }
            : {}),
        },
      ],
    });
    return page.elements.insertAfter(undefined, state);
  }

  const state = helpers.elementStateBuilder.createRectElement({
    ...geometry,
    fill: {
      colorContainer: { type: "solid", color: node.fill },
    },
  });
  return page.elements.insertAfter(undefined, state);
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

function restoreScreenSemantics(screen: ScreenType, elements: DesignNode[], previous?: DesignDocument) {
  const nodes = everyNode(elements);
  if (screen === "list") {
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
    }
  }

  if (screen === "groups") {
    const photoPlaceholder = nodes
      .filter((node) => node.type === "rect")
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (photoPlaceholder) photoPlaceholder.role = "photo-placeholder";
  }

  if (screen === "transition") {
    const wipe = nodes
      .filter((node) => node.type === "rect")
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (wipe) wipe.role = "transition-wipe";
  }
}

export async function importIntoCanva(document: DesignDocument) {
  await openDesign({ type: "current_page" }, async (session) => {
    const page = session.page;
    if (page.type !== "absolute" || page.locked) {
      throw new Error("Abra um design Canva de tamanho fixo e desbloqueado.");
    }
    page.elements.toArray().forEach((element) => page.elements.delete(element));
    page.background?.colorContainer?.set({
      type: "solid",
      color: document.canvas.background,
    });
    for (const element of document.elements) {
      await insertNode(page, session.helpers, element);
    }
    await session.sync();
  });
}

export async function exportFromCanva(screen: ScreenType, previous?: DesignDocument) {
  let exported: DesignDocument | undefined;
  await openDesign({ type: "current_page" }, async (session) => {
    const page = session.page;
    if (page.type !== "absolute") {
      throw new Error("A página atual não usa coordenadas fixas.");
    }
    const elements = page.elements
      .toArray()
      .map((element, index) => exportElement(element, index, previous?.elements[index]))
      .filter(Boolean) as DesignNode[];
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
      elements,
    };
  });
  if (!exported) {
    throw new Error("Não foi possível ler a página atual.");
  }
  return exported;
}

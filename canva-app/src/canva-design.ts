import { findFonts } from "@canva/asset";
import type { FontRef } from "@canva/asset";
import { addElementAtPoint, openDesign } from "@canva/design";
import type { GroupContentAtPoint } from "@canva/design";
import type { DesignDocument, DesignNode, GroupNode, ScreenType, TextNode } from "./types";
import {
  headerFloatADataUrl,
  headerFloatBDataUrl,
  headerFloatCDataUrl,
} from "./header-design-2";
import {
  header1FloatADataUrl,
  header1FloatBDataUrl,
  header1FloatCDataUrl,
} from "./header-design-1";

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

function transparentBoundary(width: number, height: number): GroupContentAtPoint {
  return {
    type: "shape",
    top: 0,
    left: 0,
    width,
    height,
    viewBox: { top: 0, left: 0, width, height },
    paths: [
      {
        d: `M0 0H${width}V${height}H0Z`,
        fill: { dropTarget: false },
      },
    ],
  };
}

async function addNativeGroup(
  nodes: Array<{ node: Exclude<DesignNode, GroupNode>; left: number; top: number }>,
  box: { left: number; top: number; width: number; height: number },
  fontRefs: Map<string, FontRef>,
  extraChildren: GroupContentAtPoint[] = [],
) {
  const children = [
    transparentBoundary(box.width, box.height),
    ...nodes.map(({ node, left, top }) =>
      nativeNodeFor(node, left - box.left, top - box.top, fontRefs),
    ),
    ...extraChildren,
  ];
  await addElementAtPoint({
    type: "group",
    top: box.top,
    left: box.left,
    width: box.width,
    height: box.height,
    children,
  });
}

function svgTextDataUrl(svg: string) {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

async function loadLogoDataUrl(bridgeUrl: string) {
  try {
    const response = await fetch(`${bridgeUrl.replace(/\/+$/, "")}/assets/salaslogos/1.svg`, {
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    return svgTextDataUrl(await response.text());
  } catch {
    return undefined;
  }
}

function fillColor(element: any, fallback = "#000000") {
  const ref = element.fill?.colorContainer?.ref;
  return ref?.type === "solid" ? ref.color : fallback;
}

function usedFontRefs(elements: readonly any[]): FontRef[] {
  const refs = new Map<string, FontRef>();
  const visit = (element: any) => {
    if (element.type === "text") {
      for (const region of element.text.readTextRegions()) {
        const ref = region.formatting?.fontRef as FontRef | undefined;
        if (ref) refs.set(String(ref), ref);
      }
    }
    if (element.type === "group") {
      element.contents.toArray().forEach(visit);
    }
  };
  elements.forEach(visit);
  return [...refs.values()];
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

function exportElement(
  element: any,
  index: number,
  previous: DesignNode | undefined,
  fontNames: Map<string, string>,
): DesignNode | null {
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
      fontFamily:
        (first.fontRef && fontNames.get(String(first.fontRef))) ||
        (compatiblePrevious?.type === "text" ? compatiblePrevious.fontFamily : undefined),
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
      .map((child: any, childIndex: number) =>
        exportElement(child, childIndex, previousGroup?.children[childIndex], fontNames),
      )
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

function flattenTopLevelGroups(elements: DesignNode[]) {
  return elements.flatMap((element) => {
    if (element.type !== "group") return [element];
    return element.children.slice(1).map((child) => ({
      ...child,
      left: child.left + element.left,
      top: child.top + element.top,
    }));
  });
}

function restoreTopLevelIdentity(elements: DesignNode[], previous?: DesignDocument) {
  const candidates = (previous?.elements || []).filter((node) => node.type !== "group");
  elements.forEach((node) => {
    const match = candidates.find(
      (candidate) =>
        candidate.type === node.type &&
        Math.abs(candidate.left - node.left) < 2 &&
        Math.abs(candidate.top - node.top) < 2 &&
        Math.abs(candidate.width - node.width) < 2 &&
        Math.abs(candidate.height - node.height) < 2,
    );
    if (!match) return;
    node.id = match.id;
    node.role = match.role;
    if (node.type === "text" && match.type === "text") {
      node.fontFamily ||= match.fontFamily;
    }
  });
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
  const repeat = previousTemplate.repeat || { source: "records" as const, max: 7, gap: 3 };
  const isRowGroup = (node: DesignNode) =>
    node.type === "group" &&
    Math.abs(node.left - rowLeft) < 2 &&
    Math.abs(node.width - previousTemplate.width) < 2 &&
    Math.abs(node.height - previousTemplate.height) < 2 &&
    node.top >= rowTop - 2 &&
    node.top <=
      rowTop + (repeat.max - 1) * (previousTemplate.height + repeat.gap) + 2;
  const firstRowGroup = elements.find(isRowGroup);
  if (firstRowGroup?.type === "group") {
    const sourceChildren = firstRowGroup.children.slice(1);
    const children = sourceChildren.map((node) => {
      const child = structuredClone(node);
      const previousChild = previousTemplate.children.find(
        (candidate) =>
          candidate.type === child.type &&
          Math.abs(candidate.left - child.left) < 2 &&
          Math.abs(candidate.top - child.top) < 2,
      );
      if (previousChild) {
        child.id = previousChild.id;
        child.role = previousChild.role;
        if (child.type === "text" && previousChild.type === "text") {
          child.fontFamily ||= previousChild.fontFamily;
          if (["room", "team", "time", "rank"].includes(child.role || "")) {
            child.text = `{{${child.role}}}`;
          }
        }
      }
      return child;
    });
    const insertionIndex = elements.findIndex(isRowGroup);
    const retained = elements.filter((node) => !isRowGroup(node));
    retained.splice(Math.max(0, insertionIndex), 0, {
      ...structuredClone(previousTemplate),
      children,
      repeat,
    });
    elements.splice(0, elements.length, ...retained);
    return;
  }

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
        child.fontFamily ||= previousChild.fontFamily;
        if (["room", "team", "time", "rank"].includes(child.role || "")) {
          child.text = `{{${child.role}}}`;
        }
      }
    }
    return child;
  });

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

function restoreListHeader(elements: DesignNode[], previous?: DesignDocument) {
  const headerIds = new Set([
    "title",
    "trophy",
    "lock-left",
    "lock-right",
    "header-stars",
  ]);
  const originalHeader = (previous?.elements || [])
    .filter((element) => headerIds.has(element.id))
    .map((element) => structuredClone(element));
  if (!originalHeader.length) return;

  const matchingAssets = elements
    .map((element, index) => ({ element, index }))
    .filter(
      ({ element }) =>
        Math.abs(element.left - 44) < 3 &&
        Math.abs(element.top - 60) < 3 &&
        Math.abs(element.width - 362) < 3 &&
        Math.abs(element.height - 154) < 3,
    );
  const assetIndex = matchingAssets[0]?.index ?? Math.min(1, elements.length);
  const matchingIndexes = new Set(matchingAssets.map(({ index }) => index));
  const retained = elements.filter((_, index) => !matchingIndexes.has(index));
  retained.splice(assetIndex, 0, ...originalHeader);
  elements.splice(0, elements.length, ...retained);
}

function restoreScreenSemantics(screen: ScreenType, elements: DesignNode[], previous?: DesignDocument) {
  if (screen === "list") {
    restoreListHeader(elements, previous);
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

export async function importIntoCanva(
  document: DesignDocument,
  bridgeUrl = "http://127.0.0.1:3210",
) {
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

  if (document.screen === "list") {
    const fixedIds = new Set([
      "wood-left",
      "wood-right",
      "wood-top",
      "wood-bottom",
      "board-shadow",
      "board",
    ]);
    await addNativeGroup(
      document.elements
        .filter((node) => fixedIds.has(node.id))
        .flatMap((node) => flattenedNodes(node)),
      { left: 0, top: 0, width: document.canvas.width, height: document.canvas.height },
      fontRefs,
    );

    const headerBox = { top: 60, left: 44, width: 362, height: 154 };
    const headerParts = document.variant === "list-1"
      ? [
          { dataUrl: header1FloatADataUrl, label: "top-float-a: QUADRO e raio" },
          { dataUrl: header1FloatBDataUrl, label: "top-float-b: RECORDES e pódio" },
          { dataUrl: header1FloatCDataUrl, label: "top-float-c: medalha DE e raios" },
        ]
      : [
          { dataUrl: headerFloatADataUrl, label: "top-float-a: título e estrelas" },
          { dataUrl: headerFloatBDataUrl, label: "top-float-b: troféu e raios" },
          { dataUrl: headerFloatCDataUrl, label: "top-float-c: cadeados" },
        ];
    for (const part of headerParts) {
      await addElementAtPoint({
        type: "image",
        ...headerBox,
        dataUrl: part.dataUrl,
        altText: { text: part.label, decorative: false },
      });
    }

    const rowTemplate = document.elements.find(
      (node): node is GroupNode => node.type === "group" && node.role === "record-template",
    );
    if (rowTemplate) {
      const count = rowTemplate.repeat?.max || 1;
      const gap = rowTemplate.repeat?.gap || 0;
      for (let index = 0; index < count; index += 1) {
        const repeated = structuredClone(rowTemplate);
        repeated.top = rowTemplate.top + index * (rowTemplate.height + gap);
        await addNativeGroup(
          flattenedNodes(repeated),
          {
            left: repeated.left,
            top: repeated.top,
            width: repeated.width,
            height: repeated.height,
          },
          fontRefs,
        );
      }
    }
    return;
  }

  if (document.screen === "groups") {
    if (document.variant === "photo-1") {
      const floatAIds = new Set(["photo1-title"]);
      const floatBIds = new Set([
        "photo1-room-icon",
        "photo1-room-tape",
        "photo1-room",
        "photo1-time-icon",
        "photo1-time-tape",
        "photo1-time",
      ]);
      const floatCIds = new Set([
        "photo1-team-icon",
        "photo1-team-tape",
        "photo1-team",
      ]);
      const animatedIds = new Set([...floatAIds, ...floatBIds, ...floatCIds]);
      await addNativeGroup(
        document.elements
          .filter((node) => !animatedIds.has(node.id))
          .flatMap((node) => flattenedNodes(node)),
        { left: 0, top: 0, width: 450, height: 800 },
        fontRefs,
      );
      await addNativeGroup(
        document.elements.filter((node) => floatAIds.has(node.id)).flatMap((node) => flattenedNodes(node)),
        { left: 46, top: 66, width: 358, height: 64 },
        fontRefs,
      );
      await addNativeGroup(
        document.elements.filter((node) => floatBIds.has(node.id)).flatMap((node) => flattenedNodes(node)),
        { left: 50, top: 588, width: 350, height: 150 },
        fontRefs,
      );
      await addNativeGroup(
        document.elements.filter((node) => floatCIds.has(node.id)).flatMap((node) => flattenedNodes(node)),
        { left: 50, top: 641, width: 350, height: 44 },
        fontRefs,
      );
      return;
    }

    if (document.variant === "photo-2") {
      const floatAIds = new Set([
        "photo2-logo-frame",
        "photo2-logo-left",
        "photo2-logo-right",
      ]);
      const floatBIds = new Set([
        "photo2-room-strip",
        "photo2-room-top",
        "photo2-room-bottom",
        "photo2-room",
      ]);
      const floatCIds = new Set([
        "photo2-record",
        "photo2-record-left",
        "photo2-record-right",
        "photo2-team",
        "photo2-time",
      ]);
      const animatedIds = new Set([...floatAIds, ...floatBIds, ...floatCIds]);
      await addNativeGroup(
        document.elements
          .filter((node) => !animatedIds.has(node.id))
          .flatMap((node) => flattenedNodes(node)),
        { left: 0, top: 0, width: 450, height: 800 },
        fontRefs,
      );
      const logoDataUrl = await loadLogoDataUrl(bridgeUrl);
      const logoChildren: GroupContentAtPoint[] = logoDataUrl
        ? [{
            type: "image",
            dataUrl: logoDataUrl,
            altText: { text: "{{logo}}", decorative: false },
            left: 9,
            top: 11,
            width: 94,
            height: 96,
          }]
        : [{
            type: "text",
            children: ["{{logo}}"],
            left: 8,
            top: 42,
            width: 96,
            fontSize: 20,
            fontWeight: "bold",
            textAlign: "center",
            color: "#ffffff",
          }];
      await addNativeGroup(
        document.elements.filter((node) => floatAIds.has(node.id)).flatMap((node) => flattenedNodes(node)),
        { left: 44, top: 632, width: 112, height: 118 },
        fontRefs,
        logoChildren,
      );
      await addNativeGroup(
        document.elements.filter((node) => floatBIds.has(node.id)).flatMap((node) => flattenedNodes(node)),
        { left: 44, top: 570, width: 362, height: 54 },
        fontRefs,
      );
      await addNativeGroup(
        document.elements.filter((node) => floatCIds.has(node.id)).flatMap((node) => flattenedNodes(node)),
        { left: 166, top: 632, width: 240, height: 118 },
        fontRefs,
      );
      return;
    }

    const floatAIds = new Set(["record-badge", "logo-field", "logo-label"]);
    const floatBIds = new Set([
      "photo-title",
      "record-panel",
      "record-left-line",
      "record-right-line",
      "photo-team",
      "photo-time",
    ]);
    const floatCIds = new Set([
      "room-strip",
      "room-line-top",
      "room-line-bottom",
      "photo-room",
    ]);
    const animatedIds = new Set([...floatAIds, ...floatBIds, ...floatCIds]);
    await addNativeGroup(
      document.elements
        .filter((node) => !animatedIds.has(node.id))
        .flatMap((node) => flattenedNodes(node)),
      { left: 0, top: 0, width: document.canvas.width, height: document.canvas.height },
      fontRefs,
    );

    const badge = document.elements
      .filter((node) => node.id === "record-badge")
      .flatMap((node) => flattenedNodes(node));
    const logoDataUrl = await loadLogoDataUrl(bridgeUrl);
    const logoChildren: GroupContentAtPoint[] = logoDataUrl
      ? [
          {
            type: "image",
            dataUrl: logoDataUrl,
            altText: { text: "{{logo}}", decorative: false },
            left: 40,
            top: 92,
            width: 260,
            height: 118,
          },
        ]
      : [
          {
            type: "text",
            children: ["{{logo}}"],
            left: 40,
            top: 130,
            width: 260,
            fontSize: 28,
            fontWeight: "bold",
            textAlign: "center",
            color: "#ffffff",
          },
        ];
    await addNativeGroup(
      badge,
      { left: 55, top: 76, width: 340, height: 340 },
      fontRefs,
      logoChildren,
    );

    await addNativeGroup(
      document.elements
        .filter((node) => floatBIds.has(node.id))
        .flatMap((node) => flattenedNodes(node)),
      { left: 52, top: 420, width: 346, height: 316 },
      fontRefs,
    );
    await addNativeGroup(
      document.elements
        .filter((node) => floatCIds.has(node.id))
        .flatMap((node) => flattenedNodes(node)),
      { left: 65, top: 486, width: 320, height: 58 },
      fontRefs,
    );
    return;
  }

  const wipeIds = new Set([
    "wipe-soft-left",
    "wipe-mid-left",
    "wipe-core",
    "wipe-mid-right",
    "wipe-soft-right",
  ]);
  await addNativeGroup(
    document.elements
      .filter((node) => !wipeIds.has(node.id))
      .flatMap((node) => flattenedNodes(node)),
    { left: 0, top: 0, width: document.canvas.width, height: document.canvas.height },
    fontRefs,
  );
  const wipeDataUrl = svgTextDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="406" height="756" viewBox="0 0 406 756">
      <defs>
        <linearGradient id="wipe" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#f8f8f2" stop-opacity="0"/>
          <stop offset=".18" stop-color="#f8f8f2" stop-opacity=".18"/>
          <stop offset=".48" stop-color="#f8f8f2" stop-opacity=".76"/>
          <stop offset=".78" stop-color="#f8f8f2" stop-opacity=".12"/>
          <stop offset="1" stop-color="#f8f8f2" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="406" height="756" fill="url(#wipe)"/>
    </svg>
  `);
  await addElementAtPoint({
    type: "image",
    dataUrl: wipeDataUrl,
    altText: {
      text: "Feixe da transição: animar da esquerda para a direita",
      decorative: false,
    },
    left: 22,
    top: 22,
    width: 406,
    height: 756,
  });
  return;
}

export async function exportFromCanva(screen: ScreenType, previous?: DesignDocument) {
  let exported: DesignDocument | undefined;
  let fontNames = new Map<string, string>();
  await openDesign({ type: "current_page" }, async (session) => {
    const page = session.page;
    if (page.type !== "absolute") {
      throw new Error("A página atual não usa coordenadas fixas.");
    }
    if (!page.dimensions || Math.abs(page.dimensions.width - 450) > 1 || Math.abs(page.dimensions.height - 800) > 1) {
      throw new Error("A exportação exige um design personalizado de 450 × 800 px.");
    }
    const pageElements = page.elements.toArray();
    try {
      const refs = usedFontRefs(pageElements);
      const { fonts } = await findFonts(refs.length ? { fontRefs: refs } : undefined);
      fontNames = new Map(fonts.map((font) => [String(font.ref), font.name]));
    } catch {
      // Se a consulta falhar, preserva a família que já existia no documento.
    }
    let elements = pageElements
      .map((element, index) =>
        exportElement(element, index, previous?.elements[index], fontNames),
      )
      .filter(Boolean) as DesignNode[];
    elements = flattenTopLevelGroups(elements);
    restoreTopLevelIdentity(elements, previous);
    restoreScreenSemantics(screen, elements, previous);
    exported = {
      schema: "painel-canva/v1",
      screen,
      variant: previous?.variant,
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

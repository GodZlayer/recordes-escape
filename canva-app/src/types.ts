export type ScreenType = "list" | "transition" | "groups";

type BaseNode = {
  id: string;
  role?: string;
  left: number;
  top: number;
  width: number;
  height: number;
  rotation?: number;
  opacity?: number;
  locked?: boolean;
};

export type RectNode = BaseNode & {
  type: "rect";
  fill: string;
};

export type TextNode = BaseNode & {
  type: "text";
  text: string;
  color?: string;
  fontSize?: number;
  fontWeight?: "normal" | "thin" | "extralight" | "light" | "medium" | "semibold" | "bold" | "ultrabold" | "heavy";
  fontStyle?: "normal" | "italic";
  textAlign?: "start" | "center" | "end" | "justify";
};

export type ShapeNode = BaseNode & {
  type: "shape";
  path: string;
  viewBox: { top: number; left: number; width: number; height: number };
  fill?: string;
  stroke?: string;
  strokeWeight?: number;
};

export type GroupNode = BaseNode & {
  type: "group";
  repeat?: { source: "records"; max: number; gap: number };
  children: DesignNode[];
};

export type DesignNode = RectNode | TextNode | ShapeNode | GroupNode;

export type DesignDocument = {
  schema: "painel-canva/v1";
  screen: ScreenType;
  name: string;
  canvas: { width: 450; height: 800; background: string };
  motion?: Record<string, unknown>;
  elements: DesignNode[];
  updatedAt?: string;
};

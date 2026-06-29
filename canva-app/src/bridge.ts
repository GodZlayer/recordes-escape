import type { DesignDocument, ScreenType } from "./types";

export type DesignSummary = {
  id: string;
  name: string;
  screen: ScreenType;
  variant?: string;
  updatedAt?: string;
  isDefault: boolean;
};

export function normalizedBridgeUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export async function loadDocument(
  bridgeUrl: string,
  screen: ScreenType,
  designId = "default",
): Promise<DesignDocument> {
  const response = await fetch(`${normalizedBridgeUrl(bridgeUrl)}/api/designs/${screen}?id=${encodeURIComponent(designId)}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Bridge respondeu ${response.status}: ${message}`);
  }
  return response.json() as Promise<DesignDocument>;
}

export async function saveDocument(bridgeUrl: string, document: DesignDocument, designId = "default") {
  const response = await fetch(`${normalizedBridgeUrl(bridgeUrl)}/api/designs/${document.screen}?id=${encodeURIComponent(designId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(document),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Bridge respondeu ${response.status}: ${message}`);
  }
}

export async function listDocuments(
  bridgeUrl: string,
  screen: ScreenType,
): Promise<DesignSummary[]> {
  const response = await fetch(`${normalizedBridgeUrl(bridgeUrl)}/api/designs/${screen}/library`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Não foi possível carregar a biblioteca (${response.status}).`);
  const payload = await response.json() as { designs: DesignSummary[] };
  return payload.designs;
}

export async function createDocument(
  bridgeUrl: string,
  screen: ScreenType,
  name: string,
  sourceId: string,
): Promise<DesignSummary> {
  const response = await fetch(`${normalizedBridgeUrl(bridgeUrl)}/api/designs/${screen}/library`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, sourceId }),
  });
  if (!response.ok) throw new Error(`Não foi possível criar o design: ${await response.text()}`);
  return response.json() as Promise<DesignSummary>;
}

export async function deleteDocument(
  bridgeUrl: string,
  screen: ScreenType,
  designId: string,
) {
  const response = await fetch(
    `${normalizedBridgeUrl(bridgeUrl)}/api/designs/${screen}/${encodeURIComponent(designId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(`Não foi possível excluir o design: ${await response.text()}`);
}

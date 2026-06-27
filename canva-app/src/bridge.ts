import type { DesignDocument, ScreenType } from "./types";

export function normalizedBridgeUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

export async function loadDocument(bridgeUrl: string, screen: ScreenType): Promise<DesignDocument> {
  const response = await fetch(`${normalizedBridgeUrl(bridgeUrl)}/api/designs/${screen}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Bridge respondeu ${response.status}: ${message}`);
  }
  return response.json() as Promise<DesignDocument>;
}

export async function saveDocument(bridgeUrl: string, document: DesignDocument) {
  const response = await fetch(`${normalizedBridgeUrl(bridgeUrl)}/api/designs/${document.screen}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(document),
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Bridge respondeu ${response.status}: ${message}`);
  }
}

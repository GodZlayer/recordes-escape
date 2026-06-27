import { useMemo, useState } from "react";
import { loadDocument, saveDocument } from "./bridge";
import { exportFromCanva, importIntoCanva } from "./canva-design";
import type { DesignDocument, ScreenType } from "./types";
import "./styles.css";

const labels: Record<ScreenType, string> = {
  list: "Lista",
  transition: "Transição",
  groups: "Grupos / foto",
};

export function App() {
  const [screen, setScreen] = useState<ScreenType>("list");
  const [bridgeUrl, setBridgeUrl] = useState(
    () => localStorage.getItem("painel-bridge-url") || "http://127.0.0.1:3210",
  );
  const [documents, setDocuments] = useState<Partial<Record<ScreenType, DesignDocument>>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Conecte o bridge e escolha uma tela.");
  const current = useMemo(() => documents[screen], [documents, screen]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      localStorage.setItem("painel-bridge-url", bridgeUrl);
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ocorreu uma falha.");
    } finally {
      setBusy(false);
    }
  }

  function importScreen() {
    return run(async () => {
      setMessage("Carregando o documento do painel…");
      const document = await loadDocument(bridgeUrl, screen);
      await importIntoCanva(document);
      setDocuments((value) => ({ ...value, [screen]: document }));
      setMessage(`${labels[screen]} foi criada com elementos nativos e editáveis.`);
    });
  }

  function exportScreen() {
    return run(async () => {
      setMessage("Lendo elementos editados no Canva…");
      const sourceDocument = current || await loadDocument(bridgeUrl, screen);
      const document = await exportFromCanva(screen, sourceDocument);
      await saveDocument(bridgeUrl, document);
      setDocuments((value) => ({ ...value, [screen]: document }));
      setMessage(`${labels[screen]} foi salva no projeto.`);
    });
  }

  return (
    <main className="panel">
      <header>
        <span className="eyebrow">PAINEL DE RECORDES</span>
        <h1>Editor de telas</h1>
        <p>Round-trip de elementos nativos entre o painel e o Canva.</p>
      </header>

      <label>
        Tela
        <select value={screen} onChange={(event) => setScreen(event.target.value as ScreenType)} disabled={busy}>
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <label>
        Endereço do bridge
        <input value={bridgeUrl} onChange={(event) => setBridgeUrl(event.target.value)} disabled={busy} />
      </label>

      <div className="actions">
        <button className="primary" onClick={importScreen} disabled={busy}>
          Importar do painel
        </button>
        <button onClick={exportScreen} disabled={busy}>
          Exportar para o painel
        </button>
      </div>

      <div className="status" role="status">{busy ? "Processando…" : message}</div>

      <aside>
        <strong>Campos dinâmicos</strong>
        <p>Mantenha <code>{"{{room}}"}</code>, <code>{"{{team}}"}</code> e <code>{"{{time}}"}</code> nos textos que recebem os recordes.</p>
      </aside>
    </main>
  );
}

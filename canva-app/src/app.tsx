import { useEffect, useMemo, useState } from "react";
import {
  createDocument,
  deleteDocument,
  listDocuments,
  loadDocument,
  saveDocument,
} from "./bridge";
import type { DesignSummary } from "./bridge";
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
  const [library, setLibrary] = useState<DesignSummary[]>([]);
  const [libraryError, setLibraryError] = useState<string>();
  const [selectedDesigns, setSelectedDesigns] = useState<Record<ScreenType, string>>({
    list: "default",
    transition: "default",
    groups: "default",
  });
  const [newDesignName, setNewDesignName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Conecte o bridge e escolha uma tela.");
  const current = useMemo(() => documents[screen], [documents, screen]);
  const selectedDesign = selectedDesigns[screen];

  useEffect(() => {
    let active = true;
    listDocuments(bridgeUrl, screen)
      .then((items) => {
        if (active) {
          setLibrary(items);
          setLibraryError(undefined);
        }
      })
      .catch((error) => {
        if (active) {
          setLibrary([]);
          setLibraryError(
            error instanceof Error
              ? `${error.message} Reinicie o canva-editor.bat para atualizar o bridge.`
              : "Biblioteca indisponível.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [screen]);

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
      setMessage("Carregando o design escolhido…");
      const document = await loadDocument(bridgeUrl, screen, selectedDesign);
      await importIntoCanva(document, bridgeUrl);
      setDocuments((value) => ({ ...value, [screen]: document }));
      setMessage(`${document.name} foi aberto no Canva com elementos editáveis.`);
    });
  }

  function exportScreen() {
    return run(async () => {
      setMessage("Lendo os elementos editados no Canva…");
      const sourceDocument =
        current || await loadDocument(bridgeUrl, screen, selectedDesign);
      const document = await exportFromCanva(screen, sourceDocument);
      await saveDocument(bridgeUrl, document, selectedDesign);
      setDocuments((value) => ({ ...value, [screen]: document }));
      setMessage(`${document.name} foi salvo na biblioteca.`);
    });
  }

  function refreshLibrary() {
    return run(async () => {
      const items = await listDocuments(bridgeUrl, screen);
      setLibrary(items);
      setLibraryError(undefined);
      setMessage(`${items.length} design(s) disponíveis em ${labels[screen]}.`);
    });
  }

  function createDesign() {
    return run(async () => {
      const created = await createDocument(
        bridgeUrl,
        screen,
        newDesignName,
        selectedDesign,
      );
      setLibrary(await listDocuments(bridgeUrl, screen));
      setSelectedDesigns((value) => ({ ...value, [screen]: created.id }));
      setDocuments((value) => ({ ...value, [screen]: undefined }));
      setNewDesignName("");
      setMessage(`${created.name} foi criado como cópia editável.`);
    });
  }

  function removeDesign() {
    if (selectedDesign === "default") return;
    if (!window.confirm("Excluir este design da biblioteca?")) return;
    return run(async () => {
      await deleteDocument(bridgeUrl, screen, selectedDesign);
      setLibrary(await listDocuments(bridgeUrl, screen));
      setSelectedDesigns((value) => ({ ...value, [screen]: "default" }));
      setDocuments((value) => ({ ...value, [screen]: undefined }));
      setMessage("Design excluído. O design principal foi selecionado.");
    });
  }

  return (
    <main className="panel">
      <header>
        <span className="eyebrow">PAINEL DE RECORDES</span>
        <h1>Editor de telas</h1>
        <p>Escolha, duplique e edite os designs nativos no Canva.</p>
      </header>

      <label>
        Tipo de tela
        <select
          value={screen}
          onChange={(event) => setScreen(event.target.value as ScreenType)}
          disabled={busy}
        >
          {Object.entries(labels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <section className="library">
        <label>
          Design deste tipo
          <select
            value={selectedDesign}
            onChange={(event) => {
              setSelectedDesigns((value) => ({ ...value, [screen]: event.target.value }));
              setDocuments((value) => ({ ...value, [screen]: undefined }));
            }}
            disabled={busy || !library.length}
          >
            {library.length ? library.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}{item.isDefault ? " — principal" : ""}
              </option>
            )) : <option value="default">Biblioteca não carregada</option>}
          </select>
        </label>

        <div className="create-row">
          <input
            aria-label="Nome do novo design"
            placeholder="Nome da nova cópia"
            value={newDesignName}
            onChange={(event) => setNewDesignName(event.target.value)}
            disabled={busy}
          />
          <button onClick={createDesign} disabled={busy || !library.length || !newDesignName.trim()}>
            Criar
          </button>
        </div>

        <div className="library-actions">
          <button onClick={refreshLibrary} disabled={busy}>Atualizar</button>
          <button
            className="danger"
            onClick={removeDesign}
            disabled={busy || selectedDesign === "default"}
          >
            Excluir
          </button>
        </div>
      </section>

      {libraryError ? <div className="status error" role="alert">{libraryError}</div> : null}

      <label>
        Endereço do bridge
        <input
          value={bridgeUrl}
          onChange={(event) => setBridgeUrl(event.target.value)}
          disabled={busy}
        />
      </label>

      <div className="actions">
        <button className="primary" onClick={importScreen} disabled={busy || !library.length}>
          Abrir design no Canva
        </button>
        <button onClick={exportScreen} disabled={busy || !library.length}>
          Salvar alterações neste design
        </button>
      </div>

      <div className="status" role="status">{busy ? "Processando…" : message}</div>

      {screen === "transition" ? (
        <aside>
          <strong>Como funciona a transição</strong>
          <p>O objeto claro é o feixe animado. No painel ele atravessa a tela da esquerda para a direita em 1,15 s; o fundo serve como referência de enquadramento.</p>
        </aside>
      ) : (
        <aside>
          <strong>Campos dinâmicos</strong>
          <p>Mantenha <code>{"{{room}}"}</code>, <code>{"{{team}}"}</code> e <code>{"{{time}}"}</code> nos textos que recebem os recordes.</p>
        </aside>
      )}
    </main>
  );
}

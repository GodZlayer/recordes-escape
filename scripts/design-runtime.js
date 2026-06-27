(function () {
  const state = {
    documents: null,
    records: [],
    roomCount: 7,
  };

  function px(value) {
    return `${Number(value || 0)}px`;
  }

  function replaceFields(value, data) {
    return String(value || "").replace(/\{\{(room|team|time|rank)\}\}/g, (_, field) => data?.[field] ?? "");
  }

  function baseStyle(element) {
    return {
      position: "absolute",
      left: px(element.left),
      top: px(element.top),
      width: px(element.width),
      height: px(element.height),
      opacity: String(element.opacity ?? 1),
      transform: element.rotation ? `rotate(${element.rotation}deg)` : "",
      transformOrigin: "center",
    };
  }

  function applyStyle(node, styles) {
    Object.assign(node.style, styles);
  }

  function renderElement(element, data = {}, options = {}) {
    if (element.role === "photo-placeholder" && options.skipPhotoPlaceholder) {
      return null;
    }

    if (element.type === "group") {
      const group = document.createElement("div");
      group.className = "canva-native-group";
      group.dataset.designId = element.id;
      applyStyle(group, baseStyle(element));
      element.children.forEach((child) => {
        const childNode = renderElement(child, data, options);
        if (childNode) group.appendChild(childNode);
      });
      return group;
    }

    if (element.type === "text") {
      const text = document.createElement("div");
      text.className = "canva-native-text";
      text.dataset.designId = element.id;
      text.dataset.role = element.role || "";
      text.textContent = replaceFields(element.text, data);
      applyStyle(text, {
        ...baseStyle(element),
        color: element.color || "#000000",
        fontFamily: element.fontFamily || "Arial, sans-serif",
        fontSize: px(element.fontSize || 16),
        fontStyle: element.fontStyle || "normal",
        fontWeight: element.fontWeight || "normal",
        justifyContent: element.textAlign === "center" ? "center" : element.textAlign === "end" ? "flex-end" : "flex-start",
        textAlign: element.textAlign || "start",
      });
      return text;
    }

    if (element.type === "shape") {
      const namespace = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(namespace, "svg");
      svg.dataset.designId = element.id;
      const viewBox = element.viewBox || { left: 0, top: 0, width: element.width, height: element.height };
      svg.setAttribute("viewBox", `${viewBox.left} ${viewBox.top} ${viewBox.width} ${viewBox.height}`);
      applyStyle(svg, baseStyle(element));
      const path = document.createElementNS(namespace, "path");
      path.setAttribute("d", element.path || "");
      path.setAttribute("fill", element.fill || "none");
      if (element.stroke) {
        path.setAttribute("stroke", element.stroke);
        path.setAttribute("stroke-width", element.strokeWeight || 1);
      }
      svg.appendChild(path);
      return svg;
    }

    const rect = document.createElement("div");
    rect.className = "canva-native-rect";
    rect.dataset.designId = element.id;
    rect.dataset.role = element.role || "";
    applyStyle(rect, {
      ...baseStyle(element),
      background: element.fill || "transparent",
    });
    return rect;
  }

  function layer(className, background) {
    const node = document.createElement("div");
    node.className = `canva-design-layer ${className}`;
    node.style.background = background || "transparent";
    return node;
  }

  function renderList(records = state.records, roomCount = state.roomCount) {
    const design = state.documents?.list;
    const board = document.querySelector(".board");
    if (!design || !board) return;
    board.querySelector(".canva-list-layer")?.remove();
    const root = layer("canva-list-layer", design.canvas.background);
    design.elements.forEach((element) => {
      if (element.type === "group" && element.repeat?.source === "records") {
        records.slice(0, Math.min(roomCount, element.repeat.max || roomCount)).forEach((record, index) => {
          const clone = structuredClone(element);
          clone.top = element.top + index * (element.height + (element.repeat.gap || 0));
          const node = renderElement(clone, { ...record, rank: index + 1 });
          if (node) root.appendChild(node);
        });
      } else {
        const node = renderElement(element);
        if (node) root.appendChild(node);
      }
    });
    board.prepend(root);
    document.querySelector(".frame")?.classList.add("canva-list-active");
  }

  function renderGroups(record = {}) {
    const design = state.documents?.groups;
    const container = document.querySelector("#photo-design");
    if (!design || !container) return;
    const root = layer("canva-groups-layer", "transparent");
    design.elements.forEach((element) => {
      const node = renderElement(element, record, { skipPhotoPlaceholder: true });
      if (node) root.appendChild(node);
    });
    container.replaceChildren(root);
    document.querySelector(".frame")?.classList.add("canva-groups-active");
  }

  function renderTransition() {
    const design = state.documents?.transition;
    const container = document.querySelector(".screen-wipe");
    if (!design || !container) return;
    container.replaceChildren();
    container.style.background = "transparent";
    design.elements.forEach((element) => {
      const node = renderElement(element);
      if (node) container.appendChild(node);
    });
    document.documentElement.style.setProperty(
      "--canva-transition-duration",
      `${Number(design.motion?.durationMs || 1150)}ms`,
    );
  }

  async function getDesign(name) {
    const response = await fetch(`designs/${name}.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Design ${name} indisponível`);
    return response.json();
  }

  async function load(records, roomCount) {
    state.records = records || [];
    state.roomCount = roomCount || 7;
    try {
      const [list, transition, groups] = await Promise.all([
        getDesign("list"),
        getDesign("transition"),
        getDesign("groups"),
      ]);
      state.documents = { list, transition, groups };
      renderList();
      renderTransition();
      return true;
    } catch (error) {
      console.warn("Designs Canva não foram ativados:", error);
      return false;
    }
  }

  window.CanvaDesignRuntime = {
    load,
    renderGroups,
    renderList,
    renderTransition,
  };
})();

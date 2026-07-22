(() => {
  const STORAGE_KEY = "zp-labels-fs-v1";
  const ORIENT = ["N", "R", "I", "B"];
  const ROOT_ID = "root";

  const DEFAULT_FIELD_LABELS = {
    PART_NUMBER: "Part number",
    BARCODE_VALUE: "Barcode value",
    DESCRIPTION: "Description",
    PO_NO: "PO number",
    WORK_ORDER: "Work order / SO",
    CUSTOMER: "Customer",
    QUANTITY: "Quantity",
    LOCATION: "Location",
    LOT_SERIAL: "Lot / serial",
    COMMENT: "Comment",
  };

  const BUILTIN_FILES = [
    {
      id: "file-template-1",
      name: "Template 1.zpl",
      builtinKey: "1",
      zpl: "^XA ^CF0,33 ^FO20,20^FD{{PART_NUMBER}}^FS ^CF0,20 ^FO20,160^FD{{DESCRIPTION}}^FS ^BY2,2,140 ^FO20,70^BCN,40,Y,N,N^FD{{BARCODE_VALUE}}^FS ^FO20,190^FDPO: {{PO_NO}}^FS ^FO20,220^FDWO/SO: {{WORK_ORDER}} / {{CUSTOMER}}^FS ^FO190,190^FDQTY: {{QUANTITY}}^FS ^XZ",
      density: 8,
      widthIn: 2.5,
      heightIn: 1.5,
    },
    {
      id: "file-template-2",
      name: "Template 2.zpl",
      builtinKey: "2",
      zpl: "^XA ^CF0,33 ^FO20,20^FD{{PART_NUMBER}}^FS ^CF0,20 ^FO20,135^FD{{DESCRIPTION}}^FS ^BY2,2,140 ^FO20,70^BCN,40,Y,N,N^FD{{BARCODE_VALUE}}^FS ^XZ",
      density: 8,
      widthIn: 2.5,
      heightIn: 1.25,
    },
    {
      id: "file-template-3",
      name: "Template 3.zpl",
      builtinKey: "3",
      zpl: "^XA ^CF0,68 ^FO40,60^FD{{PART_NUMBER}}^FS ^CF0,28 ^FO40,160^FDDESC: {{DESCRIPTION}}^FS ^BY3,2,140 ^FO56,230^BCN,140,Y,N,N^FD{{BARCODE_VALUE}}^FS ^FO30,500^FDPO: {{PO_NO}}^FS ^FO30,580^FDLOC: {{LOCATION}}^FS ^FO30,660^FDQTY: {{QUANTITY}}^FS ^FO30,740^FDWO/SO: {{WORK_ORDER}}^FS ^FO500,500^FDLOT/SN: {{LOT_SERIAL}}^FS ^FO500,580^FDCOMMENT: {{COMMENT}}^FS ^XZ",
      density: 8,
      widthIn: 4,
      heightIn: 4.5,
    },
  ];

  const BROWSER_PRINT_URLS = ["http://127.0.0.1:9100", "https://127.0.0.1:9101"];

  const form = document.getElementById("label-form");
  const fieldsEl = document.getElementById("fields");
  const fieldListEl = document.getElementById("field-list");
  const fieldMetaListEl = document.getElementById("field-meta-list");
  const templateEditor = document.getElementById("template-editor");
  const labelWidthInput = document.getElementById("label-width");
  const labelHeightInput = document.getElementById("label-height");
  const labelDensityInput = document.getElementById("label-density");
  const propX = document.getElementById("prop-x");
  const propY = document.getElementById("prop-y");
  const propSize = document.getElementById("prop-size");
  const propRot = document.getElementById("prop-rot");
  const applyPropsBtn = document.getElementById("apply-props-btn");
  const zplCodeEl = document.querySelector("#zpl-output code");
  const copyBtn = document.getElementById("copy-btn");
  const downloadBtn = document.getElementById("download-btn");
  const printBtn = document.getElementById("print-btn");
  const sendZebraBtn = document.getElementById("send-zebra-btn");
  const clearBtn = document.getElementById("clear-btn");
  const previewBtn = document.getElementById("preview-btn");
  const resetTemplateBtn = document.getElementById("reset-template-btn");
  const previewEl = document.getElementById("label-preview");
  const dragLayer = document.getElementById("drag-layer");
  const previewSizeEl = document.getElementById("preview-size");
  const selectedFoEl = document.getElementById("selected-fo");
  const toastEl = document.getElementById("toast");
  const toolbar = document.querySelector(".toolbar");
  const fsListEl = document.getElementById("fs-list");
  const fsPathEl = document.getElementById("fs-path");
  const newFieldKeyInput = document.getElementById("new-field-key");
  const newFieldLabelInput = document.getElementById("new-field-label");
  const openFileNameEl = document.getElementById("open-file-name");
  const printModeSelect = document.getElementById("print-mode");

  let store = loadStore();
  let toastTimer = null;
  let previewTimer = null;
  let editorPreviewTimer = null;
  let lastPreviewKey = "";
  let lastPreviewObjectUrl = "";
  let hasPreviewImage = false;
  let selectedFoIndexes = [];
  let foItems = [];
  let dragState = null;
  let suppressEditorInput = false;
  let selectedFsId = store.openFileId;

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function defaultStore() {
    const nodes = {
      [ROOT_ID]: {
        id: ROOT_ID,
        type: "folder",
        name: "Templates",
        parentId: null,
        children: BUILTIN_FILES.map((f) => f.id),
      },
    };
    BUILTIN_FILES.forEach((file) => {
      nodes[file.id] = {
        id: file.id,
        type: "file",
        name: file.name,
        parentId: ROOT_ID,
        builtinKey: file.builtinKey,
        zpl: file.zpl,
        widthIn: file.widthIn,
        heightIn: file.heightIn,
        density: file.density,
        fieldLabels: {},
      };
    });
    return {
      nodes,
      currentFolderId: ROOT_ID,
      openFileId: BUILTIN_FILES[0].id,
    };
  }

  function migrateOldTemplates(parsed) {
    const storeObj = defaultStore();
    // Old object-map style: { "1": {zpl...}, "2":... }
    for (const builtin of BUILTIN_FILES) {
      const old = parsed[builtin.builtinKey];
      if (old && typeof old.zpl === "string") {
        Object.assign(storeObj.nodes[builtin.id], {
          zpl: old.zpl,
          widthIn: old.widthIn ?? builtin.widthIn,
          heightIn: old.heightIn ?? builtin.heightIn,
          density: old.density ?? builtin.density,
        });
      }
    }
    return storeObj;
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.nodes && parsed.nodes[ROOT_ID]) return parsed;
      }
      const legacy =
        localStorage.getItem("zp-labels-templates-v3") ||
        localStorage.getItem("zp-labels-templates-v2") ||
        localStorage.getItem("zp-labels-templates-v1");
      if (legacy) return migrateOldTemplates(JSON.parse(legacy));
    } catch {
      // fall through
    }
    return defaultStore();
  }

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch {
      // ignore
    }
  }

  function getNode(id) {
    return store.nodes[id] || null;
  }

  function getOpenFile() {
    const node = getNode(store.openFileId);
    return node && node.type === "file" ? node : null;
  }

  function getTemplate() {
    return getOpenFile() || getNode(BUILTIN_FILES[0].id);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function sanitizeZplField(value) {
    return String(value ?? "")
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/\^/g, "")
      .replace(/~/g, "")
      .trim();
  }

  function normalizeFieldKey(raw) {
    return String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function humanizeKey(key, file) {
    if (file?.fieldLabels?.[key]) return file.fieldLabels[key];
    return DEFAULT_FIELD_LABELS[key] || key.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  }

  function extractPlaceholders(zpl) {
    const keys = [...String(zpl).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
    return [...new Set(keys)];
  }

  function collectValues() {
    const values = {};
    fieldsEl.querySelectorAll("[data-field]").forEach((input) => {
      values[input.dataset.field] = sanitizeZplField(input.value);
    });
    return values;
  }

  function buildZpl(templateZpl, values) {
    return templateZpl.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "");
  }

  function setActionButtonsEnabled(hasZpl, hasImage) {
    copyBtn.disabled = !hasZpl;
    downloadBtn.disabled = !hasZpl;
    sendZebraBtn.disabled = !hasZpl;
    printBtn.disabled = !hasImage;
  }

  function labelDotsSize(template) {
    return {
      dotsW: Math.round(template.widthIn * 25.4 * template.density),
      dotsH: Math.round(template.heightIn * 25.4 * template.density),
    };
  }

  function updateSizeInputsFromTemplate(template) {
    labelWidthInput.value = template.widthIn;
    labelHeightInput.value = template.heightIn;
    labelDensityInput.value = template.density;
    document.documentElement.style.setProperty("--print-width", `${template.widthIn}in`);
    document.documentElement.style.setProperty("--print-height", `${template.heightIn}in`);
    previewSizeEl.textContent = `Label size: ${template.widthIn}" × ${template.heightIn}" @ ${template.density} dpmm`;
  }

  function applySizeInputsToTemplate() {
    const template = getTemplate();
    template.widthIn = Math.max(0.5, Number(labelWidthInput.value) || template.widthIn);
    template.heightIn = Math.max(0.5, Number(labelHeightInput.value) || template.heightIn);
    template.density = Math.max(6, Number(labelDensityInput.value) || template.density);
    updateSizeInputsFromTemplate(template);
    saveStore();
  }

  function clearPreviewObjectUrl() {
    if (lastPreviewObjectUrl) {
      URL.revokeObjectURL(lastPreviewObjectUrl);
      lastPreviewObjectUrl = "";
    }
    hasPreviewImage = false;
  }

  function pathForFolder(folderId) {
    const parts = [];
    let cur = getNode(folderId);
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parentId ? getNode(cur.parentId) : null;
    }
    return parts.join("/") + "/";
  }

  function renderFileSystem() {
    const folder = getNode(store.currentFolderId) || getNode(ROOT_ID);
    store.currentFolderId = folder.id;
    fsPathEl.textContent = pathForFolder(folder.id);

    const children = (folder.children || [])
      .map((id) => getNode(id))
      .filter(Boolean)
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    const rows = [];
    if (folder.parentId) {
      rows.push(`<button type="button" class="fs-item is-folder" data-fs-action="up" data-id="${escapeHtml(folder.parentId)}">
        <span class="fs-icon">[..]</span><span>..</span></button>`);
    }

    children.forEach((node) => {
      const selected = node.id === selectedFsId || node.id === store.openFileId ? " is-selected" : "";
      const icon = node.type === "folder" ? "[DIR]" : "[ZPL]";
      const cls = node.type === "folder" ? "is-folder" : "is-file";
      rows.push(`<button type="button" class="fs-item ${cls}${selected}" data-fs-action="open" data-id="${escapeHtml(node.id)}" role="option">
        <span class="fs-icon">${icon}</span><span>${escapeHtml(node.name)}</span></button>`);
    });

    if (!children.length && !folder.parentId) {
      rows.push(`<div class="note" style="padding:8px">No templates yet.</div>`);
    }

    fsListEl.innerHTML = rows.join("");
  }

  function openFile(fileId) {
    const node = getNode(fileId);
    if (!node || node.type !== "file") return;
    store.openFileId = fileId;
    selectedFsId = fileId;
    if (node.parentId) store.currentFolderId = node.parentId;
    saveStore();
    loadSelectedTemplateIntoUi();
    renderFileSystem();
    showToast("Opened " + node.name);
  }

  function updateOpenFileLabel() {
    const file = getOpenFile();
    openFileNameEl.textContent = file ? file.name : "No file";
  }

  function openFolder(folderId) {
    const node = getNode(folderId);
    if (!node || node.type !== "folder") return;
    store.currentFolderId = folderId;
    selectedFsId = folderId;
    saveStore();
    renderFileSystem();
  }

  function ensureUniqueName(parentId, baseName) {
    const parent = getNode(parentId);
    const names = new Set((parent.children || []).map((id) => getNode(id)?.name).filter(Boolean));
    if (!names.has(baseName)) return baseName;
    const match = baseName.match(/^(.*?)(\.zpl)?$/i);
    const stem = match[1];
    const ext = match[2] || "";
    let i = 2;
    while (names.has(`${stem} (${i})${ext}`)) i += 1;
    return `${stem} (${i})${ext}`;
  }

  function createFolder() {
    const name = prompt("Folder name:", "New folder");
    if (!name) return;
    const id = uid("folder");
    const parent = getNode(store.currentFolderId);
    const finalName = ensureUniqueName(parent.id, name.trim() || "New folder");
    store.nodes[id] = { id, type: "folder", name: finalName, parentId: parent.id, children: [] };
    parent.children.push(id);
    selectedFsId = id;
    saveStore();
    renderFileSystem();
    showToast("Created folder " + finalName);
  }

  function createFile({ name, zpl, widthIn, heightIn, density, fieldLabels } = {}) {
    const parent = getNode(store.currentFolderId);
    const id = uid("file");
    const finalName = ensureUniqueName(parent.id, name || "New template.zpl");
    store.nodes[id] = {
      id,
      type: "file",
      name: finalName.endsWith(".zpl") ? finalName : `${finalName}.zpl`,
      parentId: parent.id,
      zpl: zpl || "^XA^FO20,20^FD{{PART_NUMBER}}^FS^XZ",
      widthIn: widthIn || 4,
      heightIn: heightIn || 2,
      density: density || 8,
      fieldLabels: fieldLabels || {},
    };
    parent.children.push(id);
    saveStore();
    openFile(id);
    showToast("Created " + store.nodes[id].name);
  }

  function saveCurrentFile() {
    const file = getOpenFile();
    if (!file) {
      showToast("No template file open.");
      return;
    }
    file.zpl = templateEditor.value;
    applySizeInputsToTemplate();
    saveStore();
    showToast("Saved " + file.name);
  }

  function saveCurrentFileAs() {
    const file = getOpenFile();
    if (!file) {
      showToast("No template file open.");
      return;
    }
    const suggested = file.name.replace(/\.zpl$/i, "") + " copy.zpl";
    const name = prompt("Save as:", suggested);
    if (!name) return;
    createFile({
      name,
      zpl: templateEditor.value,
      widthIn: file.widthIn,
      heightIn: file.heightIn,
      density: file.density,
      fieldLabels: { ...(file.fieldLabels || {}) },
    });
  }

  function renameSelected() {
    const node = getNode(selectedFsId);
    if (!node || node.id === ROOT_ID) {
      showToast("Select a file or folder to rename.");
      return;
    }
    const next = prompt("Rename:", node.name);
    if (!next || !next.trim()) return;
    let name = next.trim();
    if (node.type === "file" && !/\.zpl$/i.test(name)) name += ".zpl";

    const parent = getNode(node.parentId);
    const taken = new Set(
      (parent.children || []).filter((id) => id !== node.id).map((id) => getNode(id)?.name)
    );
    if (taken.has(name)) {
      name = ensureUniqueName(node.parentId, name);
    }
    node.name = name;
    saveStore();
    renderFileSystem();
    showToast("Renamed to " + node.name);
  }

  function deleteSelected() {
    const node = getNode(selectedFsId);
    if (!node || node.id === ROOT_ID) {
      showToast("Select a file or folder to delete.");
      return;
    }
    if (!confirm(`Delete "${node.name}"?`)) return;

    function removeRecursive(id) {
      const n = getNode(id);
      if (!n) return;
      if (n.type === "folder") (n.children || []).slice().forEach(removeRecursive);
      delete store.nodes[id];
    }

    const parent = getNode(node.parentId);
    if (parent) parent.children = (parent.children || []).filter((id) => id !== node.id);
    removeRecursive(node.id);

    if (store.openFileId === node.id || !getNode(store.openFileId)) {
      const fallback = (getNode(ROOT_ID).children || []).map((id) => getNode(id)).find((n) => n?.type === "file");
      store.openFileId = fallback?.id || BUILTIN_FILES[0].id;
      // recreate builtin if everything wiped
      if (!getNode(store.openFileId)) {
        store = defaultStore();
      }
    }
    selectedFsId = store.openFileId;
    store.currentFolderId = getNode(store.openFileId)?.parentId || ROOT_ID;
    saveStore();
    renderFileSystem();
    loadSelectedTemplateIntoUi();
    showToast("Deleted.");
  }

  function nextTextFieldY(zpl) {
    const items = parseFoItems(zpl);
    if (!items.length) return 20;
    return Math.max(...items.map((i) => i.y)) + 40;
  }

  function addTextFieldToTemplate() {
    const file = getOpenFile();
    if (!file) {
      showToast("Open a template file first.");
      return;
    }
    const key = normalizeFieldKey(newFieldKeyInput.value);
    const label = (newFieldLabelInput.value || key.replaceAll("_", " ")).trim();
    if (!key) {
      showToast("Enter a field key like CUSTOM_TEXT.");
      return;
    }
    if (extractPlaceholders(file.zpl).includes(key)) {
      showToast("That field already exists in the template.");
      return;
    }

    const y = nextTextFieldY(file.zpl);
    const snippet = ` ^CF0,28 ^FO20,${y}^FD{{${key}}}^FS`;
    let zpl = file.zpl;
    if (/\^XZ/i.test(zpl)) zpl = zpl.replace(/\^XZ/i, `${snippet} ^XZ`);
    else zpl += snippet;

    file.zpl = zpl;
    file.fieldLabels = file.fieldLabels || {};
    file.fieldLabels[key] = label || key;
    newFieldKeyInput.value = "";
    newFieldLabelInput.value = "";
    saveStore();
    commitZpl(zpl, { refreshPreview: true, keepSelection: false });
    showToast(`Added text field {{${key}}}`);
  }

  function removeFieldFromTemplate(key) {
    const file = getOpenFile();
    if (!file) return;
    if (!confirm(`Remove field {{${key}}} from the template?`)) return;

    // Remove FO blocks that contain this placeholder.
    let zpl = file.zpl;
    const items = parseFoItems(zpl).filter((item) => item.label === key);
    items
      .slice()
      .sort((a, b) => b.blockStart - a.blockStart)
      .forEach((item) => {
        zpl = zpl.slice(0, item.blockStart) + zpl.slice(item.blockEnd);
      });
    // Also strip leftover placeholders
    zpl = zpl.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), "");
    if (file.fieldLabels) delete file.fieldLabels[key];
    file.zpl = zpl;
    saveStore();
    commitZpl(zpl, { refreshPreview: true, keepSelection: false });
    showToast(`Removed {{${key}}}`);
  }

  function renameFieldLabel(key) {
    const file = getOpenFile();
    if (!file) return;
    const current = humanizeKey(key, file);
    const next = prompt("Field label:", current);
    if (!next) return;
    file.fieldLabels = file.fieldLabels || {};
    file.fieldLabels[key] = next.trim();
    saveStore();
    renderFields({ keepValues: true });
  }

  function renderFieldMetaList() {
    // Field manage actions live inline in the Fields panel now.
  }

  function findBlockStart(text, foStart, prevEnd) {
    const before = text.slice(prevEnd, foStart);
    const markers = [];
    const re = /\^(CF|BY|FW|A0|A@|A)/gi;
    let m;
    while ((m = re.exec(before))) markers.push(prevEnd + m.index);
    if (!markers.length) return foStart;
    return markers[markers.length - 1] > foStart - 80 ? markers[0] : markers[markers.length - 1];
  }

  function parseFoItems(zpl) {
    const text = String(zpl);
    const items = [];
    const foRegex = /\^FO(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*(-?\d+))?/gi;
    let match;
    let prevEnd = 0;
    const xa = text.search(/\^XA/i);
    if (xa >= 0) prevEnd = xa + 3;

    while ((match = foRegex.exec(text))) {
      const foStart = match.index;
      const full = match[0];
      const xToken = match[1];
      const yToken = match[2];
      const xStartInMatch = full.search(/-?\d+/);
      const afterXComma = full.indexOf(",", xStartInMatch);
      const yStartInMatch = afterXComma + 1 + full.slice(afterXComma + 1).search(/-?\d+/);
      const afterFo = foStart + full.length;
      const nextFoRel = text.slice(afterFo).search(/\^FO/i);
      const nextXzRel = text.slice(afterFo).search(/\^XZ/i);
      let blockEnd = text.length;
      if (nextFoRel >= 0) blockEnd = Math.min(blockEnd, afterFo + nextFoRel);
      if (nextXzRel >= 0) blockEnd = Math.min(blockEnd, afterFo + nextXzRel);
      const blockStart = findBlockStart(text, foStart, prevEnd);
      const block = text.slice(blockStart, blockEnd);
      const segment = text.slice(foStart, blockEnd);
      const placeholderMatch = segment.match(/\{\{(\w+)\}\}/);
      const label = placeholderMatch ? placeholderMatch[1] : `FO#${items.length + 1}`;
      const cfMatch = block.match(/\^CF\d+\s*,\s*(\d+)(?:\s*,\s*(\d+))?/i);
      const bcMatch = block.match(/\^BC([NRIB])\s*,\s*(\d+)/i);
      const aMatch = block.match(/\^A[0-9A-Z@]*([NRIB])/i);
      const fwMatch = block.match(/\^FW([NRIB])/i);
      let orientation = "N";
      let size = null;
      if (bcMatch) {
        orientation = bcMatch[1].toUpperCase();
        size = Number(bcMatch[2]);
      } else if (cfMatch) {
        size = Number(cfMatch[1]);
        if (aMatch) orientation = aMatch[1].toUpperCase();
        else if (fwMatch) orientation = fwMatch[1].toUpperCase();
      } else if (aMatch) orientation = aMatch[1].toUpperCase();
      else if (fwMatch) orientation = fwMatch[1].toUpperCase();

      items.push({
        index: items.length,
        label,
        x: Number(xToken),
        y: Number(yToken),
        size,
        orientation,
        xAbsStart: foStart + xStartInMatch,
        xAbsEnd: foStart + xStartInMatch + xToken.length,
        yAbsStart: foStart + yStartInMatch,
        yAbsEnd: foStart + yStartInMatch + yToken.length,
        foStart,
        foEnd: foStart + full.length,
        blockStart,
        blockEnd,
        block,
      });
      prevEnd = blockEnd;
    }
    return items;
  }

  function commitZpl(zpl, { refreshPreview = true, keepSelection = true } = {}) {
    const template = getTemplate();
    template.zpl = zpl;
    saveStore();
    suppressEditorInput = true;
    templateEditor.value = zpl;
    suppressEditorInput = false;
    const oldSelectedLabels = keepSelection
      ? selectedFoIndexes.map((i) => foItems[i]?.label).filter(Boolean)
      : [];
    foItems = parseFoItems(zpl);
    if (keepSelection && oldSelectedLabels.length) {
      selectedFoIndexes = foItems.filter((item) => oldSelectedLabels.includes(item.label)).map((item) => item.index);
    } else {
      selectedFoIndexes = [];
    }
    updateSelectionUi();
    renderFields({ keepValues: true });
    if (refreshPreview) {
      lastPreviewKey = "";
      updateOutput();
    } else {
      updateOutput({ skipPreview: true });
      renderDragHandles();
      renderFieldList();
    }
  }

  function primarySelected() {
    if (!selectedFoIndexes.length) return null;
    return foItems[selectedFoIndexes[selectedFoIndexes.length - 1]] || null;
  }

  function updateSelectionUi() {
    const item = primarySelected();
    if (!item) {
      selectedFoEl.textContent = "No field selected";
      propX.value = "";
      propY.value = "";
      propSize.value = "";
      propRot.value = "N";
    } else {
      const extra = selectedFoIndexes.length > 1 ? ` (+${selectedFoIndexes.length - 1})` : "";
      selectedFoEl.textContent = `${item.label}  ^FO${item.x},${item.y}${item.size != null ? `  sz=${item.size}` : ""}${extra}`;
      propX.value = item.x;
      propY.value = item.y;
      propSize.value = item.size != null ? item.size : "";
      propRot.value = ORIENT.includes(item.orientation) ? item.orientation : "N";
      templateEditor.setSelectionRange(item.xAbsStart, item.yAbsEnd);
    }
    renderFieldList();
    renderDragHandles();
  }

  function setSelection(indexes, { additive = false } = {}) {
    const next = indexes.map(Number).filter((i) => i >= 0 && i < foItems.length);
    if (additive) {
      const set = new Set(selectedFoIndexes);
      next.forEach((i) => {
        if (set.has(i)) set.delete(i);
        else set.add(i);
      });
      selectedFoIndexes = [...set];
    } else {
      selectedFoIndexes = next;
    }
    updateSelectionUi();
  }

  function replaceFoCoordinates(zpl, item, newX, newY) {
    const xStr = String(Math.round(newX));
    const yStr = String(Math.round(newY));
    return zpl.slice(0, item.xAbsStart) + xStr + zpl.slice(item.xAbsEnd, item.yAbsStart) + yStr + zpl.slice(item.yAbsEnd);
  }

  function rewriteBlock(zpl, item, newBlock) {
    return zpl.slice(0, item.blockStart) + newBlock + zpl.slice(item.blockEnd);
  }

  function cycleOrient(current, steps = 1) {
    const idx = Math.max(0, ORIENT.indexOf(String(current || "N").toUpperCase()));
    return ORIENT[(idx + steps + ORIENT.length * 4) % ORIENT.length];
  }

  function setBlockOrientation(block, orient) {
    let next = block;
    if (/\^BC[NRIB]/i.test(next)) next = next.replace(/\^BC[NRIB]/i, `^BC${orient}`);
    else if (/\^A[0-9A-Z@]*[NRIB]/i.test(next)) next = next.replace(/(\^A[0-9A-Z@]*)[NRIB]/i, `$1${orient}`);
    else if (/\^FW[NRIB]/i.test(next)) next = next.replace(/\^FW[NRIB]/i, `^FW${orient}`);
    else next = next.replace(/\^FO/i, `^FW${orient}^FO`);
    return next;
  }

  function scaleBlock(block, factor) {
    let next = block;
    let changed = false;
    next = next.replace(/\^CF(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d+))?/gi, (_, type, h, w) => {
      changed = true;
      const nh = Math.max(8, Math.round(Number(h) * factor));
      if (w != null) return `^CF${type},${nh},${Math.max(8, Math.round(Number(w) * factor))}`;
      return `^CF${type},${nh}`;
    });
    next = next.replace(/\^BC([NRIB])\s*,\s*(\d+)/gi, (_, o, h) => {
      changed = true;
      return `^BC${o},${Math.max(10, Math.round(Number(h) * factor))}`;
    });
    next = next.replace(/\^BY(\d+)(?:\s*,\s*([\d.]+))?(?:\s*,\s*(\d+))?/gi, (_, w, r, h) => {
      changed = true;
      const width = Math.max(1, Number(w) + (factor >= 1 ? 1 : -1));
      if (h != null) return `^BY${width},${r ?? "2"},${Math.max(10, Math.round(Number(h) * factor))}`;
      if (r != null) return `^BY${width},${r}`;
      return `^BY${width}`;
    });
    if (!changed) next = next.replace(/\^FO/i, `^CF0,${Math.max(12, Math.round(20 * factor))}^FO`);
    return next;
  }

  function setBlockSize(block, size) {
    const n = Math.max(1, Math.round(Number(size) || 1));
    let next = block;
    if (/\^BC[NRIB]\s*,\s*\d+/i.test(next)) next = next.replace(/(\^BC[NRIB]\s*,\s*)\d+/i, `$1${n}`);
    if (/\^CF\d+\s*,\s*\d+/i.test(next)) next = next.replace(/(\^CF\d+\s*,\s*)\d+/i, `$1${n}`);
    else if (!/\^BC/i.test(next)) next = next.replace(/\^FO/i, `^CF0,${n}^FO`);
    return next;
  }

  function moveSelected(dx, dy) {
    if (!selectedFoIndexes.length) return showToast("Select a field first.");
    let zpl = getTemplate().zpl;
    for (const index of [...selectedFoIndexes].sort((a, b) => b - a)) {
      const items = parseFoItems(zpl);
      const item = items[index];
      if (!item) continue;
      zpl = replaceFoCoordinates(zpl, item, Math.max(0, item.x + dx), Math.max(0, item.y + dy));
    }
    commitZpl(zpl);
  }

  function alignSelected(mode) {
    if (!selectedFoIndexes.length) return showToast("Select a field first.");
    const template = getTemplate();
    const { dotsW, dotsH } = labelDotsSize(template);
    const margin = 20;
    let zpl = template.zpl;
    let items = parseFoItems(zpl);
    const selected = selectedFoIndexes.map((i) => items[i]).filter(Boolean);
    if (!selected.length) return;
    let targetX = null;
    let targetY = null;
    if (selected.length === 1) {
      if (mode === "left") targetX = margin;
      if (mode === "right") targetX = Math.max(margin, dotsW - 120);
      if (mode === "center-x") targetX = Math.round(dotsW / 2 - 40);
      if (mode === "top") targetY = margin;
      if (mode === "bottom") targetY = Math.max(margin, dotsH - 40);
      if (mode === "center-y") targetY = Math.round(dotsH / 2 - 20);
    } else {
      const xs = selected.map((s) => s.x);
      const ys = selected.map((s) => s.y);
      if (mode === "left") targetX = Math.min(...xs);
      if (mode === "right") targetX = Math.max(...xs);
      if (mode === "center-x") targetX = Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
      if (mode === "top") targetY = Math.min(...ys);
      if (mode === "bottom") targetY = Math.max(...ys);
      if (mode === "center-y") targetY = Math.round(ys.reduce((a, b) => a + b, 0) / ys.length);
    }
    for (const index of [...selectedFoIndexes].sort((a, b) => b - a)) {
      items = parseFoItems(zpl);
      const item = items[index];
      if (!item) continue;
      zpl = replaceFoCoordinates(zpl, item, targetX == null ? item.x : targetX, targetY == null ? item.y : targetY);
    }
    commitZpl(zpl);
    showToast(`Aligned ${mode}`);
  }

  function transformSelected(kind, payload) {
    if (!selectedFoIndexes.length) return showToast("Select a field first.");
    let zpl = getTemplate().zpl;
    const { dotsW, dotsH } = labelDotsSize(getTemplate());
    for (const index of [...selectedFoIndexes].sort((a, b) => b - a)) {
      const items = parseFoItems(zpl);
      const item = items[index];
      if (!item) continue;
      if (kind === "flip") {
        const nx = payload === "h" ? Math.max(0, dotsW - item.x - 80) : item.x;
        const ny = payload === "v" ? Math.max(0, dotsH - item.y - 30) : item.y;
        zpl = replaceFoCoordinates(zpl, item, nx, ny);
        const refreshed = parseFoItems(zpl)[index];
        if (refreshed) zpl = rewriteBlock(zpl, refreshed, setBlockOrientation(refreshed.block, cycleOrient(refreshed.orientation, 2)));
        continue;
      }
      let block = item.block;
      if (kind === "scale") block = scaleBlock(block, Number(payload) || 1);
      if (kind === "rotate") block = setBlockOrientation(block, cycleOrient(item.orientation, 1));
      zpl = rewriteBlock(zpl, item, block);
    }
    commitZpl(zpl);
    showToast(kind === "scale" ? "Scaled" : kind === "rotate" ? "Rotated" : "Flipped");
  }

  function reorderSelected(direction) {
    if (selectedFoIndexes.length !== 1) return showToast("Select one field to change order.");
    const index = selectedFoIndexes[0];
    let zpl = getTemplate().zpl;
    const items = parseFoItems(zpl);
    if (!items[index]) return;
    let targetIndex = index;
    if (direction === "forward") targetIndex = Math.min(items.length - 1, index + 1);
    if (direction === "backward") targetIndex = Math.max(0, index - 1);
    if (direction === "front") targetIndex = items.length - 1;
    if (direction === "back") targetIndex = 0;
    if (targetIndex === index) return;
    const blocks = items.map((item) => ({ label: item.label, text: zpl.slice(item.blockStart, item.blockEnd) }));
    const moving = blocks.splice(index, 1)[0];
    blocks.splice(targetIndex, 0, moving);
    const prefix = zpl.slice(0, items[0].blockStart);
    const suffix = zpl.slice(items[items.length - 1].blockEnd);
    zpl = prefix + blocks.map((b) => b.text).join("") + suffix;
    commitZpl(zpl);
    foItems = parseFoItems(zpl);
    const found = foItems.find((item) => item.label === moving.label);
    selectedFoIndexes = found ? [found.index] : [];
    updateSelectionUi();
    showToast(direction === "forward" || direction === "front" ? "Moved forward" : "Moved backward");
  }

  function applyPropsFromInputs() {
    const item = primarySelected();
    if (!item) return showToast("Select a field first.");
    let zpl = getTemplate().zpl;
    let items = parseFoItems(zpl);
    let current = items[item.index];
    if (!current) return;
    const nx = Math.max(0, Number(propX.value));
    const ny = Math.max(0, Number(propY.value));
    if (Number.isFinite(nx) && Number.isFinite(ny)) {
      zpl = replaceFoCoordinates(zpl, current, nx, ny);
      items = parseFoItems(zpl);
      current = items[item.index];
    }
    if (current) {
      let block = current.block;
      if (propSize.value !== "") block = setBlockSize(block, propSize.value);
      block = setBlockOrientation(block, propRot.value || "N");
      zpl = rewriteBlock(zpl, current, block);
    }
    commitZpl(zpl);
    showToast("Properties applied.");
  }

  function renderFields({ keepValues = true } = {}) {
    const template = getTemplate();
    const previous = keepValues ? collectValues() : {};
    const keys = extractPlaceholders(template.zpl);
    if (!keys.length) {
      fieldsEl.innerHTML = "<p class='hint'>No fields yet. Add a KEY above.</p>";
      return;
    }
    fieldsEl.innerHTML = keys
      .map((key) => {
        const id = `field-${key}`;
        const label = humanizeKey(key, template);
        const value = previous[key] ?? "";
        const required = key === "PART_NUMBER" || key === "BARCODE_VALUE" ? " required" : "";
        const multiline = key === "DESCRIPTION" || key === "COMMENT";
        const input = multiline
          ? `<textarea id="${id}" name="${key}" data-field="${key}"${required}>${escapeHtml(value)}</textarea>`
          : `<input id="${id}" name="${key}" data-field="${key}" type="text" value="${escapeHtml(value)}"${required} />`;
        return `<div class="field-row">
          <label for="${id}" title="{{${escapeHtml(key)}}}">${escapeHtml(label)}</label>
          ${input}
          <div class="field-row-actions">
            <button type="button" data-field-action="rename" data-key="${escapeHtml(key)}" title="Edit label">Lbl</button>
            <button type="button" data-field-action="remove" data-key="${escapeHtml(key)}" title="Remove field">Del</button>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderFieldList() {
    foItems = parseFoItems(getTemplate().zpl);
    fieldListEl.innerHTML = foItems
      .map((item) => {
        const selected = selectedFoIndexes.includes(item.index) ? " is-selected" : "";
        return `<button type="button" class="${selected}" data-fo-index="${item.index}">${escapeHtml(item.label)} — ^FO${item.x},${item.y}</button>`;
      })
      .join("");
  }

  function loadSelectedTemplateIntoUi() {
    const template = getTemplate();
    suppressEditorInput = true;
    templateEditor.value = template.zpl;
    suppressEditorInput = false;
    updateSizeInputsFromTemplate(template);
    updateOpenFileLabel();
    foItems = parseFoItems(template.zpl);
    selectedFoIndexes = [];
    updateSelectionUi();
    renderFields({ keepValues: true });
    lastPreviewKey = "";
    updateOutput();
  }

  function updateOutput({ skipPreview = false } = {}) {
    const template = getTemplate();
    const zpl = buildZpl(template.zpl, collectValues());
    zplCodeEl.textContent = zpl;
    setActionButtonsEnabled(Boolean(zpl.trim()), hasPreviewImage);
    renderFieldList();
    if (skipPreview) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => renderPreview(zpl, template), 350);
  }

  function showToast(message) {
    toastEl.hidden = false;
    toastEl.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 2500);
  }

  async function copyZpl() {
    const text = zplCodeEl.textContent || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      showToast("Copied.");
    } catch {
      showToast("Copy failed — select the ZPL text manually.");
    }
  }

  function downloadZpl() {
    const text = zplCodeEl.textContent || "";
    if (!text) return;
    const file = getOpenFile();
    const filename = (file?.name || "label.zpl").replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded " + filename);
  }

  function getPrintMode() {
    return printModeSelect?.value || "fit";
  }

  function printLabel() {
    const img = previewEl.querySelector("img");
    if (!img) return showToast("Load a preview before printing.");
    const template = getTemplate();
    updateSizeInputsFromTemplate(template);
    const mode = getPrintMode();
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!printWindow) {
      window.print();
      return;
    }

    const width = template.widthIn;
    const height = template.heightIn;
    const fitCss = `
      @page { margin: 0.4in; }
      html, body { margin: 0; padding: 0; height: 100%; }
      body { display: flex; align-items: center; justify-content: center; }
      img {
        display: block;
        max-width: 100%;
        max-height: 100vh;
        width: auto;
        height: auto;
        object-fit: contain;
        page-break-inside: avoid;
      }
    `;
    const actualCss = `
      @page { margin: 0; size: ${width}in ${height}in; }
      html, body { margin: 0; padding: 0; }
      img { display: block; width: ${width}in; height: ${height}in; object-fit: fill; }
    `;

    printWindow.document.write(`<!DOCTYPE html><html><head><title>Print label</title>
<style>${mode === "actual" ? actualCss : fitCss}</style>
</head><body><img src="${img.src}" alt="Label" /></body></html>`);
    printWindow.document.close();
    const doPrint = () => {
      printWindow.focus();
      printWindow.print();
    };
    const printImg = printWindow.document.querySelector("img");
    if (printImg && !printImg.complete) printImg.onload = doPrint;
    else setTimeout(doPrint, 50);
    showToast(mode === "fit" ? "Printing fit to page…" : "Printing actual size…");
  }

  async function fetchJson(url) {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function findBrowserPrintBase() {
    for (const base of BROWSER_PRINT_URLS) {
      try {
        await fetchJson(`${base}/available`);
        return base;
      } catch {
        // next
      }
    }
    return null;
  }

  function pickPrinter(available) {
    const list = Array.isArray(available) ? available : available?.printer || available?.device || [];
    if (!list.length) return null;
    return (
      list.find((d) => String(d.connection || "").toLowerCase() === "usb") ||
      list.find((d) => String(d.deviceType || d.type || "").toLowerCase() === "printer") ||
      list[0]
    );
  }

  async function sendToZebra() {
    const zpl = zplCodeEl.textContent || "";
    if (!zpl.trim()) return;
    sendZebraBtn.disabled = true;
    showToast("Looking for Zebra Browser Print…");
    try {
      const base = await findBrowserPrintBase();
      if (!base) throw new Error("Zebra Browser Print not found.");
      const available = await fetchJson(`${base}/available`);
      const device = pickPrinter(available);
      if (!device) throw new Error("No printer found in Zebra Browser Print.");
      const response = await fetch(`${base}/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device, data: zpl }),
      });
      if (!response.ok) throw new Error(`Send failed (HTTP ${response.status})`);
      showToast("Sent ZPL to " + (device.name || device.uid || "printer"));
    } catch (error) {
      showToast(error.message || "Could not send to Zebra printer.");
    } finally {
      setActionButtonsEnabled(Boolean((zplCodeEl.textContent || "").trim()), hasPreviewImage);
    }
  }

  function getPreviewMetrics() {
    const img = previewEl.querySelector("img");
    const template = getTemplate();
    if (!img || !img.naturalWidth) return null;
    const { dotsW, dotsH } = labelDotsSize(template);
    return {
      img,
      displayWidth: img.clientWidth,
      displayHeight: img.clientHeight,
      dotsW: img.naturalWidth || dotsW,
      dotsH: img.naturalHeight || dotsH,
      scaleX: img.clientWidth / (img.naturalWidth || dotsW),
      scaleY: img.clientHeight / (img.naturalHeight || dotsH),
    };
  }

  function renderDragHandles() {
    const metrics = getPreviewMetrics();
    if (!metrics) {
      dragLayer.hidden = true;
      dragLayer.innerHTML = "";
      return;
    }
    dragLayer.hidden = false;
    dragLayer.style.width = `${metrics.displayWidth}px`;
    dragLayer.style.height = `${metrics.displayHeight}px`;
    foItems = parseFoItems(getTemplate().zpl);
    dragLayer.innerHTML = foItems
      .map((item) => {
        const selected = selectedFoIndexes.includes(item.index) ? " is-selected" : "";
        return `<div class="fo-handle${selected}" data-fo-index="${item.index}" style="left:${item.x * metrics.scaleX}px;top:${item.y * metrics.scaleY}px;" title="${escapeHtml(item.label)}">
          <span>${escapeHtml(item.label)}</span>
          <span class="fo-coords">^FO${item.x},${item.y}</span>
        </div>`;
      })
      .join("");
  }

  function updateHandlePosition(index, x, y) {
    const metrics = getPreviewMetrics();
    const handle = dragLayer.querySelector(`[data-fo-index="${index}"]`);
    if (!metrics || !handle) return;
    handle.style.left = `${x * metrics.scaleX}px`;
    handle.style.top = `${y * metrics.scaleY}px`;
    const coords = handle.querySelector(".fo-coords");
    if (coords) coords.textContent = `^FO${Math.round(x)},${Math.round(y)}`;
  }

  async function renderPreview(zpl, template) {
    const key = `${store.openFileId}|${template.widthIn}x${template.heightIn}|${template.density}|${zpl}`;
    if (!zpl.trim()) {
      clearPreviewObjectUrl();
      previewEl.innerHTML = "<p>Generate ZPL to preview the label.</p>";
      dragLayer.hidden = true;
      dragLayer.innerHTML = "";
      lastPreviewKey = "";
      setActionButtonsEnabled(false, false);
      return;
    }
    if (key === lastPreviewKey) {
      renderDragHandles();
      return;
    }
    lastPreviewKey = key;
    updateSizeInputsFromTemplate(template);
    previewEl.innerHTML = "<p>Loading preview…</p>";
    dragLayer.hidden = true;
    setActionButtonsEnabled(true, false);
    const endpoint = `https://api.labelary.com/v1/printers/${template.density}dpmm/labels/${template.widthIn}x${template.heightIn}/0/`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Accept: "image/png", "Content-Type": "application/x-www-form-urlencoded" },
        body: zpl,
      });
      if (!response.ok) throw new Error(`Preview failed (${response.status})`);
      const blob = await response.blob();
      clearPreviewObjectUrl();
      const url = URL.createObjectURL(blob);
      lastPreviewObjectUrl = url;
      previewEl.innerHTML = "";
      const img = document.createElement("img");
      img.alt = "Label preview";
      img.src = url;
      const maxCssWidth = template.heightIn >= 3 ? 360 : 420;
      img.style.width = `${Math.min(template.widthIn * 140, maxCssWidth)}px`;
      img.onload = () => {
        hasPreviewImage = true;
        setActionButtonsEnabled(true, true);
        renderDragHandles();
      };
      previewEl.appendChild(img);
    } catch {
      clearPreviewObjectUrl();
      previewEl.innerHTML = "<p>Preview unavailable (Labelary request failed). ZPL is still ready.</p>";
      dragLayer.hidden = true;
      setActionButtonsEnabled(true, false);
    }
  }

  function onDragStart(event) {
    const handle = event.target.closest(".fo-handle");
    if (!handle) return;
    event.preventDefault();
    const index = Number(handle.dataset.foIndex);
    const additive = event.ctrlKey || event.metaKey;
    if (additive) setSelection([index], { additive: true });
    else if (!selectedFoIndexes.includes(index)) setSelection([index]);
    const baseZpl = getTemplate().zpl;
    foItems = parseFoItems(baseZpl);
    const item = foItems[index];
    if (!item) return;
    handle.classList.add("is-dragging", "is-selected");
    dragState = {
      index,
      startClientX: event.clientX,
      startClientY: event.clientY,
      baseZpl,
      selectedSnapshot: selectedFoIndexes
        .map((i) => {
          const it = foItems[i];
          return it ? { index: i, x: it.x, y: it.y, item: it } : null;
        })
        .filter(Boolean),
    };
  }

  function onDragMove(event) {
    if (!dragState) return;
    const metrics = getPreviewMetrics();
    if (!metrics) return;
    const dxDots = (event.clientX - dragState.startClientX) / metrics.scaleX;
    const dyDots = (event.clientY - dragState.startClientY) / metrics.scaleY;
    let liveZpl = dragState.baseZpl;
    const ordered = [...dragState.selectedSnapshot].sort((a, b) => b.index - a.index);
    for (const snap of ordered) {
      const nx = Math.max(0, Math.round(snap.x + dxDots));
      const ny = Math.max(0, Math.round(snap.y + dyDots));
      updateHandlePosition(snap.index, nx, ny);
      liveZpl = replaceFoCoordinates(liveZpl, snap.item, nx, ny);
      if (snap.index === dragState.index) {
        selectedFoEl.textContent = `${snap.item.label}  ^FO${nx},${ny}`;
        propX.value = nx;
        propY.value = ny;
      }
    }
    suppressEditorInput = true;
    templateEditor.value = liveZpl;
    suppressEditorInput = false;
    dragState.liveZpl = liveZpl;
  }

  function onDragEnd() {
    if (!dragState) return;
    const { liveZpl, index } = dragState;
    dragState = null;
    const handle = dragLayer.querySelector(`[data-fo-index="${index}"]`);
    if (handle) handle.classList.remove("is-dragging");
    if (!liveZpl) {
      renderDragHandles();
      return;
    }
    commitZpl(liveZpl);
    showToast("Moved field(s).");
  }

  // File system events
  fsListEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-fs-action]");
    if (!btn) return;
    const id = btn.dataset.id;
    const action = btn.dataset.fsAction;
    selectedFsId = id;
    if (action === "up") {
      openFolder(id);
      return;
    }
    const node = getNode(id);
    if (!node) return;
    if (node.type === "folder") {
      if (event.detail === 2 || event.detail === 1) {
        // single click selects + opens folder for browsing
        openFolder(id);
      }
      return;
    }
    if (event.detail >= 2) openFile(id);
    else {
      selectedFsId = id;
      renderFileSystem();
      openFile(id);
    }
  });

  document.getElementById("fs-up-btn").addEventListener("click", () => {
    const folder = getNode(store.currentFolderId);
    if (folder?.parentId) openFolder(folder.parentId);
  });
  document.getElementById("fs-new-folder-btn").addEventListener("click", createFolder);
  document.getElementById("fs-new-file-btn").addEventListener("click", () => createFile());
  document.getElementById("fs-save-btn").addEventListener("click", saveCurrentFile);
  document.getElementById("fs-save-as-btn").addEventListener("click", saveCurrentFileAs);
  document.getElementById("fs-rename-btn").addEventListener("click", renameSelected);
  document.getElementById("fs-delete-btn").addEventListener("click", deleteSelected);
  document.getElementById("add-field-btn").addEventListener("click", addTextFieldToTemplate);

  fieldsEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-field-action]");
    if (!btn) return;
    if (btn.dataset.fieldAction === "remove") removeFieldFromTemplate(btn.dataset.key);
    if (btn.dataset.fieldAction === "rename") renameFieldLabel(btn.dataset.key);
  });

  fieldMetaListEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-field-action]");
    if (!btn) return;
    if (btn.dataset.fieldAction === "remove") removeFieldFromTemplate(btn.dataset.key);
    if (btn.dataset.fieldAction === "rename") renameFieldLabel(btn.dataset.key);
  });

  toolbar.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-tool]");
    if (!btn) return;
    const tool = btn.dataset.tool;
    if (tool === "nudge") moveSelected(Number(btn.dataset.dx), Number(btn.dataset.dy));
    if (tool === "align") alignSelected(btn.dataset.align);
    if (tool === "scale") transformSelected("scale", btn.dataset.factor);
    if (tool === "rotate") transformSelected("rotate");
    if (tool === "flip") transformSelected("flip", btn.dataset.axis);
    if (tool === "forward" || tool === "backward" || tool === "front" || tool === "back") reorderSelected(tool);
  });

  applyPropsBtn.addEventListener("click", applyPropsFromInputs);

  fieldListEl.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-fo-index]");
    if (!btn) return;
    setSelection([Number(btn.dataset.foIndex)], { additive: event.ctrlKey || event.metaKey });
  });

  form.addEventListener("input", (event) => {
    if (event.target.matches("[data-field]")) updateOutput();
  });

  templateEditor.addEventListener("input", () => {
    if (suppressEditorInput) return;
    const template = getTemplate();
    template.zpl = templateEditor.value;
    saveStore();
    foItems = parseFoItems(template.zpl);
    clearTimeout(editorPreviewTimer);
    editorPreviewTimer = setTimeout(() => {
      renderFields({ keepValues: true });
      lastPreviewKey = "";
      updateOutput();
    }, 400);
  });

  templateEditor.addEventListener("click", () => {
    const pos = templateEditor.selectionStart;
    foItems = parseFoItems(templateEditor.value);
    const hit = foItems.find((item) => pos >= item.blockStart && pos <= item.blockEnd);
    if (hit) setSelection([hit.index]);
  });

  [labelWidthInput, labelHeightInput, labelDensityInput].forEach((input) => {
    input.addEventListener("change", () => {
      applySizeInputsToTemplate();
      lastPreviewKey = "";
      updateOutput();
    });
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    lastPreviewKey = "";
    updateOutput();
    showToast("ZPL generated.");
  });

  clearBtn.addEventListener("click", () => {
    fieldsEl.querySelectorAll("[data-field]").forEach((input) => {
      input.value = "";
    });
    lastPreviewKey = "";
    updateOutput();
    showToast("Data cleared.");
  });

  resetTemplateBtn.addEventListener("click", () => {
    const file = getOpenFile();
    if (!file) return;
    const builtin = BUILTIN_FILES.find((b) => b.id === file.id || b.builtinKey === file.builtinKey);
    if (!builtin) {
      if (!confirm("Reset this custom template to a blank starter?")) return;
      file.zpl = "^XA^FO20,20^FD{{PART_NUMBER}}^FS^XZ";
      file.fieldLabels = {};
    } else if (confirm(`Reset ${file.name} to the original built-in layout?`)) {
      file.zpl = builtin.zpl;
      file.widthIn = builtin.widthIn;
      file.heightIn = builtin.heightIn;
      file.density = builtin.density;
      file.fieldLabels = {};
    } else {
      return;
    }
    saveStore();
    loadSelectedTemplateIntoUi();
    showToast("Template reset.");
  });

  copyBtn.addEventListener("click", copyZpl);
  downloadBtn.addEventListener("click", downloadZpl);
  printBtn.addEventListener("click", printLabel);
  sendZebraBtn.addEventListener("click", sendToZebra);
  previewBtn.addEventListener("click", () => {
    lastPreviewKey = "";
    renderPreview(zplCodeEl.textContent || "", getTemplate());
  });

  dragLayer.addEventListener("pointerdown", onDragStart);
  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", onDragEnd);
  window.addEventListener("pointercancel", onDragEnd);
  window.addEventListener("resize", () => renderDragHandles());

  renderFileSystem();
  loadSelectedTemplateIntoUi();
})();

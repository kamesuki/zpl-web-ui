(() => {
  const STORAGE_KEY = "zp-labels-templates-v1";

  const DEFAULT_TEMPLATES = {
    "1": {
      name: "Template 1",
      zpl: "^XA ^CF0,33 ^FO20,20^FD{{PART_NUMBER}}^FS ^CF0,20 ^FO20,160^FD{{DESCRIPTION}}^FS ^BY2,2,140 ^FO20,70^BCN,40,Y,N,N^FD{{BARCODE_VALUE}}^FS ^FO20,190^FDPO: {{PO_NO}}^FS ^FO20,220^FDWO/SO: {{WORK_ORDER}} / {{CUSTOMER}}^FS ^FO190,190^FDQTY: {{QUANTITY}}^FS ^XZ",
      density: 8,
      widthIn: 2.5,
      heightIn: 1.5,
    },
    "2": {
      name: "Template 2",
      zpl: "^XA ^CF0,33 ^FO20,20^FD{{PART_NUMBER}}^FS ^CF0,20 ^FO20,135^FD{{DESCRIPTION}}^FS ^BY2,2,140 ^FO20,70^BCN,40,Y,N,N^FD{{BARCODE_VALUE}}^FS ^XZ",
      density: 8,
      widthIn: 2.5,
      heightIn: 1.25,
    },
    "3": {
      name: "Template 3",
      zpl: "^XA ^CF0,68 ^FO40,60^FD{{PART_NUMBER}}^FS ^CF0,28 ^FO40,160^FDDESC: {{DESCRIPTION}}^FS ^BY3,2,140 ^FO56,230^BCN,140,Y,N,N^FD{{BARCODE_VALUE}}^FS ^FO30,500^FDPO: {{PO_NO}}^FS ^FO30,580^FDLOC: {{LOCATION}}^FS ^FO30,660^FDQTY: {{QUANTITY}}^FS ^FO30,740^FDWO/SO: {{WORK_ORDER}}^FS ^FO500,500^FDLOT/SN: {{LOT_SERIAL}}^FS ^FO500,580^FDCOMMENT: {{COMMENT}}^FS ^XZ",
      density: 8,
      widthIn: 4,
      heightIn: 4.5,
    },
  };

  const FIELD_LABELS = {
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

  const BROWSER_PRINT_URLS = ["http://127.0.0.1:9100", "https://127.0.0.1:9101"];

  const form = document.getElementById("label-form");
  const fieldsEl = document.getElementById("fields");
  const templateEditor = document.getElementById("template-editor");
  const labelWidthInput = document.getElementById("label-width");
  const labelHeightInput = document.getElementById("label-height");
  const labelDensityInput = document.getElementById("label-density");
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

  let templates = loadTemplates();
  let toastTimer = null;
  let previewTimer = null;
  let editorPreviewTimer = null;
  let lastPreviewKey = "";
  let lastPreviewObjectUrl = "";
  let hasPreviewImage = false;
  let selectedFoIndex = -1;
  let foItems = [];
  let dragState = null;
  let suppressEditorInput = false;

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_TEMPLATES));
  }

  function loadTemplates() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefaults();
      const parsed = JSON.parse(raw);
      const merged = cloneDefaults();
      for (const key of Object.keys(merged)) {
        if (parsed[key] && typeof parsed[key].zpl === "string") {
          merged[key] = {
            ...merged[key],
            ...parsed[key],
            name: merged[key].name,
          };
        }
      }
      return merged;
    } catch {
      return cloneDefaults();
    }
  }

  function saveTemplates() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    } catch {
      // ignore quota / private mode
    }
  }

  function getSelectedTemplateId() {
    const selected = form.querySelector('input[name="templateType"]:checked');
    return selected ? selected.value : "1";
  }

  function getTemplate() {
    return templates[getSelectedTemplateId()];
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

  function humanizeKey(key) {
    return FIELD_LABELS[key] || key.replaceAll("_", " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
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
    saveTemplates();
  }

  function clearPreviewObjectUrl() {
    if (lastPreviewObjectUrl) {
      URL.revokeObjectURL(lastPreviewObjectUrl);
      lastPreviewObjectUrl = "";
    }
    hasPreviewImage = false;
  }

  function parseFoItems(zpl) {
    const text = String(zpl);
    const items = [];
    const foRegex = /\^FO(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*(-?\d+))?/gi;
    let match;

    while ((match = foRegex.exec(text))) {
      const start = match.index;
      const full = match[0];
      const xToken = match[1];
      const yToken = match[2];
      const xStartInMatch = match[0].search(/-?\d+/);
      const afterXComma = match[0].indexOf(",", xStartInMatch);
      const yStartInMatch = afterXComma + 1 + match[0].slice(afterXComma + 1).search(/-?\d+/);

      const nextFo = text.slice(start + full.length).search(/\^FO/i);
      const nextEnd = text.slice(start + full.length).search(/\^XZ/i);
      let segmentEnd = text.length;
      if (nextFo >= 0) segmentEnd = Math.min(segmentEnd, start + full.length + nextFo);
      if (nextEnd >= 0) segmentEnd = Math.min(segmentEnd, start + full.length + nextEnd);
      const segment = text.slice(start, segmentEnd);
      const placeholderMatch = segment.match(/\{\{(\w+)\}\}/);
      const label = placeholderMatch ? placeholderMatch[1] : `FO#${items.length + 1}`;

      items.push({
        index: items.length,
        label,
        x: Number(xToken),
        y: Number(yToken),
        xAbsStart: start + xStartInMatch,
        xAbsEnd: start + xStartInMatch + xToken.length,
        yAbsStart: start + yStartInMatch,
        yAbsEnd: start + yStartInMatch + yToken.length,
        foStart: start,
        foEnd: start + full.length,
      });
    }

    return items;
  }

  function setTemplateZpl(zpl, { refreshFields = false, caret = null } = {}) {
    const template = getTemplate();
    template.zpl = zpl;
    saveTemplates();

    suppressEditorInput = true;
    templateEditor.value = zpl;
    if (caret != null) {
      templateEditor.setSelectionRange(caret, caret);
    }
    suppressEditorInput = false;

    foItems = parseFoItems(zpl);
    if (refreshFields) renderFields({ keepValues: true });
    updateOutput({ skipPreview: false });
  }

  function highlightFoInEditor(item) {
    if (!item) {
      selectedFoEl.textContent = "";
      return;
    }
    selectedFoEl.textContent = `Selected: ${item.label}  ^FO${item.x},${item.y}`;
    templateEditor.focus();
    templateEditor.setSelectionRange(item.xAbsStart, item.yAbsEnd);
  }

  function replaceFoCoordinates(zpl, item, newX, newY) {
    const xStr = String(Math.round(newX));
    const yStr = String(Math.round(newY));
    // Replace from end to start so earlier offsets stay valid for this single item.
    return (
      zpl.slice(0, item.xAbsStart) +
      xStr +
      zpl.slice(item.xAbsEnd, item.yAbsStart) +
      yStr +
      zpl.slice(item.yAbsEnd)
    );
  }

  function renderFields({ keepValues = true } = {}) {
    const template = getTemplate();
    const previous = keepValues ? collectValues() : {};
    const keys = extractPlaceholders(template.zpl);

    if (!keys.length) {
      fieldsEl.innerHTML = "<p class='note'>No {{PLACEHOLDERS}} found in this template.</p>";
      return;
    }

    fieldsEl.innerHTML = keys
      .map((key) => {
        const id = `field-${key}`;
        const label = humanizeKey(key);
        const value = previous[key] ?? "";
        const required = key === "PART_NUMBER" || key === "BARCODE_VALUE" ? " required" : "";
        const multiline = key === "DESCRIPTION" || key === "COMMENT";

        if (multiline) {
          return `
            <p>
              <label for="${id}">${escapeHtml(label)}</label>
              <textarea id="${id}" name="${key}" data-field="${key}"${required}>${escapeHtml(value)}</textarea>
            </p>
          `;
        }

        return `
          <p>
            <label for="${id}">${escapeHtml(label)}</label>
            <input id="${id}" name="${key}" data-field="${key}" type="text" value="${escapeHtml(value)}"${required} />
          </p>
        `;
      })
      .join("");
  }

  function loadSelectedTemplateIntoUi() {
    const template = getTemplate();
    suppressEditorInput = true;
    templateEditor.value = template.zpl;
    suppressEditorInput = false;
    updateSizeInputsFromTemplate(template);
    foItems = parseFoItems(template.zpl);
    selectedFoIndex = -1;
    selectedFoEl.textContent = "";
    renderFields({ keepValues: true });
    lastPreviewKey = "";
    updateOutput();
  }

  function updateOutput({ skipPreview = false } = {}) {
    const template = getTemplate();
    const zpl = buildZpl(template.zpl, collectValues());
    zplCodeEl.textContent = zpl;
    setActionButtonsEnabled(Boolean(zpl.trim()), hasPreviewImage);

    if (skipPreview) return;

    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      renderPreview(zpl, template);
    }, 350);
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
    const type = `template-${getSelectedTemplateId()}`;
    const part = sanitizeZplField(collectValues().PART_NUMBER) || "label";
    const filename = `${type}-${part}.zpl`.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Downloaded " + filename);
  }

  function printLabel() {
    const img = previewEl.querySelector("img");
    if (!img) {
      showToast("Load a preview before printing.");
      return;
    }

    const template = getTemplate();
    updateSizeInputsFromTemplate(template);

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=640,height=480");
    if (!printWindow) {
      window.print();
      return;
    }

    const width = template.widthIn;
    const height = template.heightIn;
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Print label</title>
  <style>
    @page { margin: 0; size: ${width}in ${height}in; }
    html, body { margin: 0; padding: 0; }
    img { display: block; width: ${width}in; height: ${height}in; object-fit: fill; }
  </style>
</head>
<body>
  <img src="${img.src}" alt="Label" />
</body>
</html>`);
    printWindow.document.close();

    const doPrint = () => {
      printWindow.focus();
      printWindow.print();
    };

    const printImg = printWindow.document.querySelector("img");
    if (printImg && !printImg.complete) {
      printImg.onload = doPrint;
      printImg.onerror = () => {
        showToast("Could not load label image for printing.");
        printWindow.close();
      };
    } else {
      setTimeout(doPrint, 50);
    }
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
        // try next
      }
    }
    return null;
  }

  function pickPrinter(available) {
    const list = Array.isArray(available)
      ? available
      : available && Array.isArray(available.printer)
        ? available.printer
        : available && Array.isArray(available.device)
          ? available.device
          : [];
    if (!list.length) return null;
    return (
      list.find((device) => String(device.connection || "").toLowerCase() === "usb") ||
      list.find((device) => String(device.deviceType || device.type || "").toLowerCase() === "printer") ||
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
      if (!base) {
        throw new Error(
          "Zebra Browser Print not found. Start Browser Print, then try again — or use Print label / Download .zpl."
        );
      }

      const available = await fetchJson(`${base}/available`);
      const device = pickPrinter(available);
      if (!device) throw new Error("No printer found in Zebra Browser Print.");

      const response = await fetch(`${base}/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device, data: zpl }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || `Send failed (HTTP ${response.status})`);
      }

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

    const displayWidth = img.clientWidth;
    const displayHeight = img.clientHeight;
    const dotsW = Math.round(template.widthIn * 25.4 * template.density);
    const dotsH = Math.round(template.heightIn * 25.4 * template.density);

    return {
      img,
      displayWidth,
      displayHeight,
      // Prefer Labelary natural pixels (1px ≈ 1 dot). Fall back to calculated dots.
      dotsW: img.naturalWidth || dotsW,
      dotsH: img.naturalHeight || dotsH,
      scaleX: displayWidth / (img.naturalWidth || dotsW),
      scaleY: displayHeight / (img.naturalHeight || dotsH),
    };
  }

  function syncDragLayerSize(metrics) {
    dragLayer.hidden = false;
    dragLayer.style.width = `${metrics.displayWidth}px`;
    dragLayer.style.height = `${metrics.displayHeight}px`;
  }

  function renderDragHandles() {
    const metrics = getPreviewMetrics();
    if (!metrics) {
      dragLayer.hidden = true;
      dragLayer.innerHTML = "";
      return;
    }

    syncDragLayerSize(metrics);
    foItems = parseFoItems(getTemplate().zpl);

    dragLayer.innerHTML = foItems
      .map((item) => {
        const left = item.x * metrics.scaleX;
        const top = item.y * metrics.scaleY;
        const selected = item.index === selectedFoIndex ? " is-selected" : "";
        return `
          <div class="fo-handle${selected}" data-fo-index="${item.index}" style="left:${left}px;top:${top}px;" title="Drag to move ${escapeHtml(item.label)}">
            <span>${escapeHtml(item.label)}</span>
            <span class="fo-coords">^FO${item.x},${item.y}</span>
          </div>
        `;
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
    const key = `${getSelectedTemplateId()}|${template.widthIn}x${template.heightIn}|${template.density}|${zpl}`;
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
        headers: {
          Accept: "image/png",
          "Content-Type": "application/x-www-form-urlencoded",
        },
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
      dragLayer.innerHTML = "";
      setActionButtonsEnabled(true, false);
    }
  }

  function onDragStart(event) {
    const handle = event.target.closest(".fo-handle");
    if (!handle) return;

    event.preventDefault();
    const index = Number(handle.dataset.foIndex);
    const baseZpl = getTemplate().zpl;
    foItems = parseFoItems(baseZpl);
    const item = foItems[index];
    if (!item) return;

    selectedFoIndex = index;
    highlightFoInEditor(item);
    handle.classList.add("is-dragging", "is-selected");

    dragState = {
      index,
      startClientX: event.clientX,
      startClientY: event.clientY,
      originX: item.x,
      originY: item.y,
      itemSnapshot: item,
      baseZpl,
    };
  }

  function onDragMove(event) {
    if (!dragState) return;
    const metrics = getPreviewMetrics();
    if (!metrics) return;

    const dxDots = (event.clientX - dragState.startClientX) / metrics.scaleX;
    const dyDots = (event.clientY - dragState.startClientY) / metrics.scaleY;
    const newX = Math.max(0, Math.round(dragState.originX + dxDots));
    const newY = Math.max(0, Math.round(dragState.originY + dyDots));

    updateHandlePosition(dragState.index, newX, newY);
    selectedFoEl.textContent = `Selected: ${dragState.itemSnapshot.label}  ^FO${newX},${newY}`;

    const liveZpl = replaceFoCoordinates(dragState.baseZpl, dragState.itemSnapshot, newX, newY);

    suppressEditorInput = true;
    templateEditor.value = liveZpl;
    const xLen = String(newX).length;
    const yLen = String(newY).length;
    const xStart = dragState.itemSnapshot.xAbsStart;
    const oldXLen = dragState.itemSnapshot.xAbsEnd - dragState.itemSnapshot.xAbsStart;
    const yStart = dragState.itemSnapshot.yAbsStart + (xLen - oldXLen);
    templateEditor.setSelectionRange(xStart, yStart + yLen);
    suppressEditorInput = false;

    dragState.currentX = newX;
    dragState.currentY = newY;
    dragState.liveZpl = liveZpl;
  }

  function onDragEnd() {
    if (!dragState) return;

    const { index, currentX, currentY, liveZpl, itemSnapshot } = dragState;
    dragState = null;

    const handle = dragLayer.querySelector(`[data-fo-index="${index}"]`);
    if (handle) handle.classList.remove("is-dragging");

    if (liveZpl == null || currentX == null) {
      renderDragHandles();
      return;
    }

    const template = getTemplate();
    template.zpl = liveZpl;
    saveTemplates();
    foItems = parseFoItems(liveZpl);
    selectedFoIndex = index;
    highlightFoInEditor(foItems[index] || { ...itemSnapshot, x: currentX, y: currentY });

    lastPreviewKey = "";
    updateOutput();
    showToast(`Moved ${itemSnapshot.label} to ^FO${currentX},${currentY}`);
  }

  form.addEventListener("change", (event) => {
    if (event.target.name === "templateType") {
      loadSelectedTemplateIntoUi();
      return;
    }
    updateOutput();
  });

  form.addEventListener("input", (event) => {
    if (event.target.matches("[data-field]")) {
      updateOutput();
    }
  });

  templateEditor.addEventListener("input", () => {
    if (suppressEditorInput) return;
    const template = getTemplate();
    template.zpl = templateEditor.value;
    saveTemplates();
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
    const hit = foItems.find((item) => pos >= item.foStart && pos <= item.yAbsEnd + 1);
    if (hit) {
      selectedFoIndex = hit.index;
      highlightFoInEditor(hit);
      renderDragHandles();
    }
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
    const id = getSelectedTemplateId();
    templates[id] = JSON.parse(JSON.stringify(DEFAULT_TEMPLATES[id]));
    saveTemplates();
    loadSelectedTemplateIntoUi();
    showToast(`Template ${id} reset.`);
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

  loadSelectedTemplateIntoUi();
})();

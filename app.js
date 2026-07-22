(() => {
  const TEMPLATES = {
    DSS: {
      zpl: "^XA ^CF0,33 ^FO20,20^FD{{PART_NUMBER}}^FS ^CF0,20 ^FO20,160^FD{{DESCRIPTION}}^FS ^BY2,2,140 ^FO20,70^BCN,40,Y,N,N^FD{{BARCODE_VALUE}}^FS ^FO20,190^FDPO: {{PO_NO}}^FS ^FO20,220^FDWO/SO: {{WORK_ORDER}} / {{CUSTOMER}}^FS ^FO190,190^FDQTY: {{QUANTITY}}^FS ^XZ",
      fields: [
        { key: "PART_NUMBER", label: "Part number", required: true },
        { key: "BARCODE_VALUE", label: "Barcode value", required: true },
        { key: "DESCRIPTION", label: "Description" },
        { key: "PO_NO", label: "PO number" },
        { key: "WORK_ORDER", label: "Work order / SO" },
        { key: "CUSTOMER", label: "Customer" },
        { key: "QUANTITY", label: "Quantity" },
      ],
      density: 8,
      widthIn: 2.5,
      heightIn: 1.5,
    },
    "Generate DSS Stock Label": {
      zpl: "^XA ^CF0,33 ^FO20,20^FD{{PART_NUMBER}}^FS ^CF0,20 ^FO20,135^FD{{DESCRIPTION}}^FS ^BY2,2,140 ^FO20,70^BCN,40,Y,N,N^FD{{BARCODE_VALUE}}^FS ^XZ",
      fields: [
        { key: "PART_NUMBER", label: "Part number", required: true },
        { key: "BARCODE_VALUE", label: "Barcode value", required: true },
        { key: "DESCRIPTION", label: "Description" },
      ],
      density: 8,
      widthIn: 2.5,
      heightIn: 1.25,
    },
    Standard: {
      zpl: "^XA ^CF0,68 ^FO40,60^FD{{PART_NUMBER}}^FS ^CF0,28 ^FO40,160^FDDESC: {{DESCRIPTION}}^FS ^BY3,2,140 ^FO56,230^BCN,140,Y,N,N^FD{{BARCODE_VALUE}}^FS ^FO30,500^FDPO: {{PO_NO}}^FS ^FO30,580^FDLOC: {{LOCATION}}^FS ^FO30,660^FDQTY: {{QUANTITY}}^FS ^FO30,740^FDWO/SO: {{WORK_ORDER}}^FS ^FO500,500^FDLOT/SN: {{LOT_SERIAL}}^FS ^FO500,580^FDCOMMENT: {{COMMENT}}^FS ^XZ",
      fields: [
        { key: "PART_NUMBER", label: "Part number", required: true },
        { key: "BARCODE_VALUE", label: "Barcode value", required: true },
        { key: "DESCRIPTION", label: "Description" },
        { key: "PO_NO", label: "PO number" },
        { key: "LOCATION", label: "Location" },
        { key: "QUANTITY", label: "Quantity" },
        { key: "WORK_ORDER", label: "Work order / SO" },
        { key: "LOT_SERIAL", label: "Lot / serial" },
        { key: "COMMENT", label: "Comment" },
      ],
      density: 8,
      widthIn: 4,
      heightIn: 4.5,
    },
  };

  const BROWSER_PRINT_URLS = [
    "http://127.0.0.1:9100",
    "https://127.0.0.1:9101",
  ];

  const form = document.getElementById("label-form");
  const fieldsEl = document.getElementById("fields");
  const zplCodeEl = document.querySelector("#zpl-output code");
  const copyBtn = document.getElementById("copy-btn");
  const downloadBtn = document.getElementById("download-btn");
  const printBtn = document.getElementById("print-btn");
  const sendZebraBtn = document.getElementById("send-zebra-btn");
  const clearBtn = document.getElementById("clear-btn");
  const previewBtn = document.getElementById("preview-btn");
  const previewEl = document.getElementById("label-preview");
  const previewSizeEl = document.getElementById("preview-size");
  const toastEl = document.getElementById("toast");

  let toastTimer = null;
  let previewTimer = null;
  let lastPreviewKey = "";
  let lastPreviewObjectUrl = "";
  let hasPreviewImage = false;

  function getSelectedTemplateType() {
    const selected = form.querySelector('input[name="templateType"]:checked');
    return selected ? selected.value : "DSS";
  }

  function getTemplate() {
    return TEMPLATES[getSelectedTemplateType()];
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

  function collectValues() {
    const values = {};
    fieldsEl.querySelectorAll("[data-field]").forEach((input) => {
      values[input.dataset.field] = sanitizeZplField(input.value);
    });
    return values;
  }

  function buildZpl(template, values) {
    return template.zpl.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? "");
  }

  function setActionButtonsEnabled(hasZpl, hasImage) {
    copyBtn.disabled = !hasZpl;
    downloadBtn.disabled = !hasZpl;
    sendZebraBtn.disabled = !hasZpl;
    printBtn.disabled = !hasImage;
  }

  function updatePreviewSizeNote(template) {
    previewSizeEl.textContent = `Labelary size: ${template.widthIn}" × ${template.heightIn}" @ ${template.density} dpmm`;
    document.documentElement.style.setProperty("--print-width", `${template.widthIn}in`);
    document.documentElement.style.setProperty("--print-height", `${template.heightIn}in`);
  }

  function clearPreviewObjectUrl() {
    if (lastPreviewObjectUrl) {
      URL.revokeObjectURL(lastPreviewObjectUrl);
      lastPreviewObjectUrl = "";
    }
    hasPreviewImage = false;
  }

  function renderFields() {
    const template = getTemplate();
    const previous = collectValues();

    fieldsEl.innerHTML = template.fields
      .map((field) => {
        const value = previous[field.key] ?? "";
        const id = `field-${field.key}`;
        const requiredAttr = field.required ? " required" : "";

        if (field.key === "DESCRIPTION" || field.key === "COMMENT") {
          return `
            <p>
              <label for="${id}">${escapeHtml(field.label)}</label>
              <textarea id="${id}" name="${field.key}" data-field="${field.key}"${requiredAttr}>${escapeHtml(value)}</textarea>
            </p>
          `;
        }

        return `
          <p>
            <label for="${id}">${escapeHtml(field.label)}</label>
            <input id="${id}" name="${field.key}" data-field="${field.key}" type="text" value="${escapeHtml(value)}"${requiredAttr} />
          </p>
        `;
      })
      .join("");

    updatePreviewSizeNote(template);
    updateOutput();
  }

  function updateOutput() {
    const template = getTemplate();
    const zpl = buildZpl(template, collectValues());
    zplCodeEl.textContent = zpl;
    setActionButtonsEnabled(Boolean(zpl.trim()), hasPreviewImage);

    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      renderPreview(zpl, template);
    }, 400);
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

    const type = getSelectedTemplateType().replace(/\s+/g, "-").toLowerCase();
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
    updatePreviewSizeNote(template);

    // Prefer a dedicated print window so only the label is printed.
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
    img {
      display: block;
      width: ${width}in;
      height: ${height}in;
      object-fit: fill;
    }
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
        // try next endpoint
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
      if (!device) {
        throw new Error("No printer found in Zebra Browser Print.");
      }

      const response = await fetch(`${base}/write`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device, data: zpl }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || `Send failed (HTTP ${response.status})`);
      }

      const name = device.name || device.uid || "printer";
      showToast("Sent ZPL to " + name);
    } catch (error) {
      showToast(error.message || "Could not send to Zebra printer.");
    } finally {
      setActionButtonsEnabled(Boolean((zplCodeEl.textContent || "").trim()), hasPreviewImage);
    }
  }

  async function renderPreview(zpl, template) {
    const key = `${getSelectedTemplateType()}|${template.widthIn}x${template.heightIn}|${zpl}`;
    if (!zpl.trim()) {
      clearPreviewObjectUrl();
      previewEl.innerHTML = "<p>Generate ZPL to preview the label.</p>";
      lastPreviewKey = "";
      setActionButtonsEnabled(false, false);
      return;
    }

    if (key === lastPreviewKey) return;
    lastPreviewKey = key;
    updatePreviewSizeNote(template);
    previewEl.innerHTML = "<p>Loading preview…</p>";
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

      if (!response.ok) {
        throw new Error(`Preview failed (${response.status})`);
      }

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
      previewEl.appendChild(img);
      hasPreviewImage = true;
      setActionButtonsEnabled(true, true);
    } catch {
      clearPreviewObjectUrl();
      previewEl.innerHTML = "<p>Preview unavailable (Labelary request failed). ZPL is still ready.</p>";
      setActionButtonsEnabled(true, false);
    }
  }

  form.addEventListener("change", (event) => {
    if (event.target.name === "templateType") {
      lastPreviewKey = "";
      renderFields();
      return;
    }
    updateOutput();
  });

  form.addEventListener("input", (event) => {
    if (event.target.matches("[data-field]")) {
      updateOutput();
    }
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
    clearPreviewObjectUrl();
    updateOutput();
    previewEl.innerHTML = "<p>Generate ZPL to preview the label.</p>";
    setActionButtonsEnabled(Boolean((zplCodeEl.textContent || "").trim()), false);
    showToast("Cleared.");
  });

  copyBtn.addEventListener("click", copyZpl);
  downloadBtn.addEventListener("click", downloadZpl);
  printBtn.addEventListener("click", printLabel);
  sendZebraBtn.addEventListener("click", sendToZebra);
  previewBtn.addEventListener("click", () => {
    lastPreviewKey = "";
    renderPreview(zplCodeEl.textContent || "", getTemplate());
  });

  renderFields();
})();

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
      // Content goes to ~Y220 and X~300 — use a short label size so preview isn't padded.
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
      // Content to ~Y740 and X~500+ — tall label, crop height closer to content.
      density: 8,
      widthIn: 4,
      heightIn: 4.5,
    },
  };

  const form = document.getElementById("label-form");
  const fieldsEl = document.getElementById("fields");
  const zplCodeEl = document.querySelector("#zpl-output code");
  const copyBtn = document.getElementById("copy-btn");
  const downloadBtn = document.getElementById("download-btn");
  const clearBtn = document.getElementById("clear-btn");
  const previewBtn = document.getElementById("preview-btn");
  const previewEl = document.getElementById("label-preview");
  const previewSizeEl = document.getElementById("preview-size");
  const toastEl = document.getElementById("toast");

  let toastTimer = null;
  let previewTimer = null;
  let lastPreviewKey = "";

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

  function updatePreviewSizeNote(template) {
    previewSizeEl.textContent = `Labelary size: ${template.widthIn}" × ${template.heightIn}" @ ${template.density} dpmm`;
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
    const hasContent = Boolean(zpl.trim());
    copyBtn.disabled = !hasContent;
    downloadBtn.disabled = !hasContent;

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
    }, 2000);
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

  async function renderPreview(zpl, template) {
    const key = `${getSelectedTemplateType()}|${template.widthIn}x${template.heightIn}|${zpl}`;
    if (!zpl.trim()) {
      previewEl.innerHTML = "<p>Generate ZPL to preview the label.</p>";
      lastPreviewKey = "";
      return;
    }

    if (key === lastPreviewKey) return;
    lastPreviewKey = key;
    updatePreviewSizeNote(template);
    previewEl.innerHTML = "<p>Loading preview…</p>";

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
      const url = URL.createObjectURL(blob);
      previewEl.innerHTML = "";
      const img = document.createElement("img");
      img.alt = "Label preview";
      img.src = url;
      // Keep DSS/stock previews readable without stretching tall Standard labels too wide.
      const maxCssWidth = template.heightIn >= 3 ? 360 : 420;
      img.style.width = `${Math.min(template.widthIn * 140, maxCssWidth)}px`;
      img.onload = () => URL.revokeObjectURL(url);
      previewEl.appendChild(img);
    } catch {
      previewEl.innerHTML = "<p>Preview unavailable (Labelary request failed). ZPL is still ready.</p>";
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
    updateOutput();
    previewEl.innerHTML = "<p>Generate ZPL to preview the label.</p>";
    showToast("Cleared.");
  });

  copyBtn.addEventListener("click", copyZpl);
  downloadBtn.addEventListener("click", downloadZpl);
  previewBtn.addEventListener("click", () => {
    lastPreviewKey = "";
    renderPreview(zplCodeEl.textContent || "", getTemplate());
  });

  renderFields();
})();

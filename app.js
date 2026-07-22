(() => {
  const TEMPLATES = {
    DSS: {
      zpl: "^XA ^CF0,33 ^FO20,20^FD{{PART_NUMBER}}^FS ^CF0,20 ^FO20,160^FD{{DESCRIPTION}}^FS ^BY2,2,140 ^FO20,70^BCN,40,Y,N,N^FD{{BARCODE_VALUE}}^FS ^FO20,190^FDPO: {{PO_NO}}^FS ^FO20,220^FDWO/SO: {{WORK_ORDER}} / {{CUSTOMER}}^FS ^FO190,190^FDQTY: {{QUANTITY}}^FS ^XZ",
      fields: [
        { key: "PART_NUMBER", label: "Part number", required: true },
        { key: "BARCODE_VALUE", label: "Barcode value", required: true },
        { key: "DESCRIPTION", label: "Description", full: true },
        { key: "PO_NO", label: "PO number" },
        { key: "WORK_ORDER", label: "Work order / SO" },
        { key: "CUSTOMER", label: "Customer" },
        { key: "QUANTITY", label: "Quantity" },
      ],
      density: 8,
      widthIn: 2,
      heightIn: 1,
    },
    "Generate DSS Stock Label": {
      zpl: "^XA ^CF0,33 ^FO20,20^FD{{PART_NUMBER}}^FS ^CF0,20 ^FO20,135^FD{{DESCRIPTION}}^FS ^BY2,2,140 ^FO20,70^BCN,40,Y,N,N^FD{{BARCODE_VALUE}}^FS ^XZ",
      fields: [
        { key: "PART_NUMBER", label: "Part number", required: true },
        { key: "BARCODE_VALUE", label: "Barcode value", required: true },
        { key: "DESCRIPTION", label: "Description", full: true },
      ],
      density: 8,
      widthIn: 2,
      heightIn: 1,
    },
    Standard: {
      zpl: "^XA ^CF0,68 ^FO40,60^FD{{PART_NUMBER}}^FS ^CF0,28 ^FO40,160^FDDESC: {{DESCRIPTION}}^FS ^BY3,2,140 ^FO56,230^BCN,140,Y,N,N^FD{{BARCODE_VALUE}}^FS ^FO30,500^FDPO: {{PO_NO}}^FS ^FO30,580^FDLOC: {{LOCATION}}^FS ^FO30,660^FDQTY: {{QUANTITY}}^FS ^FO30,740^FDWO/SO: {{WORK_ORDER}}^FS ^FO500,500^FDLOT/SN: {{LOT_SERIAL}}^FS ^FO500,580^FDCOMMENT: {{COMMENT}}^FS ^XZ",
      fields: [
        { key: "PART_NUMBER", label: "Part number", required: true },
        { key: "BARCODE_VALUE", label: "Barcode value", required: true },
        { key: "DESCRIPTION", label: "Description", full: true },
        { key: "PO_NO", label: "PO number" },
        { key: "LOCATION", label: "Location" },
        { key: "QUANTITY", label: "Quantity" },
        { key: "WORK_ORDER", label: "Work order / SO" },
        { key: "LOT_SERIAL", label: "Lot / serial" },
        { key: "COMMENT", label: "Comment", full: true },
      ],
      density: 8,
      widthIn: 4,
      heightIn: 6,
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
  const toastEl = document.getElementById("toast");

  let toastTimer = null;
  let previewTimer = null;
  let lastPreviewZpl = "";

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
    // Keep printable text; strip control chars and ZPL field terminators that would break output.
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

  function renderFields() {
    const template = getTemplate();
    const previous = collectValues();

    fieldsEl.innerHTML = template.fields
      .map((field, index) => {
        const value = previous[field.key] ?? "";
        const id = `field-${field.key}`;
        const fullClass = field.full ? " field-full" : "";
        const requiredAttr = field.required ? " required" : "";
        const delay = Math.min(index * 0.03, 0.2);

        if (field.key === "DESCRIPTION" || field.key === "COMMENT") {
          return `
            <div class="field${fullClass}" style="animation-delay:${delay}s">
              <label for="${id}">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>
              <textarea id="${id}" name="${field.key}" data-field="${field.key}" rows="2" placeholder="${escapeHtml(field.label)}"${requiredAttr}>${escapeHtml(value)}</textarea>
            </div>
          `;
        }

        return `
          <div class="field${fullClass}" style="animation-delay:${delay}s">
            <label for="${id}">${escapeHtml(field.label)}${field.required ? " *" : ""}</label>
            <input id="${id}" name="${field.key}" data-field="${field.key}" type="text" value="${escapeHtml(value)}" placeholder="${escapeHtml(field.label)}" autocomplete="off"${requiredAttr} />
          </div>
        `;
      })
      .join("");

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
      if (zpl !== lastPreviewZpl) {
        renderPreview(zpl, template);
      }
    }, 450);
  }

  function showToast(message, success = false) {
    toastEl.hidden = false;
    toastEl.textContent = message;
    toastEl.classList.toggle("is-success", success);
    toastEl.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("is-visible");
    }, 2200);
  }

  async function copyZpl() {
    const text = zplCodeEl.textContent || "";
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      showToast("ZPL copied to clipboard", true);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(zplCodeEl);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      showToast("Select and copy the ZPL manually");
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
    showToast(`Downloaded ${filename}`, true);
  }

  async function renderPreview(zpl, template) {
    if (!zpl.trim()) {
      previewEl.innerHTML = `<p class="preview-placeholder">Generate ZPL to preview the label.</p>`;
      lastPreviewZpl = "";
      return;
    }

    lastPreviewZpl = zpl;
    previewEl.innerHTML = `<p class="preview-placeholder">Rendering preview…</p>`;

    const density = template.density;
    const width = template.widthIn;
    const height = template.heightIn;
    const endpoint = `https://api.labelary.com/v1/printers/${density}dpmm/labels/${width}x${height}/0/`;

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
      img.alt = "Rendered ZP label preview";
      img.src = url;
      img.onload = () => URL.revokeObjectURL(url);
      previewEl.appendChild(img);
    } catch {
      previewEl.innerHTML = `<p class="preview-error">Could not reach Labelary for a visual preview. Your ZPL is still ready to copy or download.</p>`;
    }
  }

  form.addEventListener("change", (event) => {
    if (event.target.name === "templateType") {
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
    updateOutput();
    const template = getTemplate();
    renderPreview(zplCodeEl.textContent || "", template);
    showToast("ZPL generated", true);
  });

  clearBtn.addEventListener("click", () => {
    fieldsEl.querySelectorAll("[data-field]").forEach((input) => {
      input.value = "";
    });
    updateOutput();
    previewEl.innerHTML = `<p class="preview-placeholder">Generate ZPL to preview the label.</p>`;
    lastPreviewZpl = "";
    showToast("Form cleared");
  });

  copyBtn.addEventListener("click", copyZpl);
  downloadBtn.addEventListener("click", downloadZpl);
  previewBtn.addEventListener("click", () => {
    const template = getTemplate();
    lastPreviewZpl = "";
    renderPreview(zplCodeEl.textContent || "", template);
  });

  renderFields();
})();

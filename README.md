# ZP Labels

Simple static form for generating ZPL from three editable templates:

1. **Template 1**
2. **Template 2**
3. **Template 3**

## Features

- Fill label data from `{{PLACEHOLDERS}}` in the selected template
- **Template editor** — edit ZPL (including `^FO` coordinates) directly
- **Drag in preview** — grab a field box on the preview; `^FO` numbers update live in the editor
- Print preview image, or send raw ZPL via Zebra Browser Print
- Template edits are saved in the browser (`localStorage`)

## Run

Open `index.html`, or:

```bash
python3 -m http.server 8080
```

## Print

- **Print label** — browser print dialog with the Labelary preview at label size
- **Send to Zebra** — raw ZPL through [Zebra Browser Print](https://www.zebra.com/us/en/support-downloads/software/printer-software/browser-print.html) (must be running locally)

## GitHub Pages

Settings → Pages → Deploy from branch → `main` / `(root)`

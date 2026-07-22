# ZP Labels

Simple static form for generating ZPL from three templates:

1. **DSS**
2. **DSS Stock** (`Generate DSS Stock Label`)
3. **Standard**

## Run

Open `index.html`, or:

```bash
python3 -m http.server 8080
```

## Print

- **Print label** — opens a browser print dialog with the Labelary preview image at label size.
- **Send to Zebra** — sends raw ZPL through [Zebra Browser Print](https://www.zebra.com/us/en/support-downloads/software/printer-software/browser-print.html) (must be running locally).

## GitHub Pages

Settings → Pages → Deploy from branch → `main` / `(root)`

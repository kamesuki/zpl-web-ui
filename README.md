# ZP Labels — ZPL Template Builder

A small static website for filling ZP label fields and generating ZPL from the three templates used in your Apps Script:

1. **DSS** — part, description, barcode, PO, WO/SO + customer, quantity  
2. **DSS Stock** (`Generate DSS Stock Label`) — part, description, barcode only  
3. **Standard** — full warehouse label (PO, location, qty, WO/SO, lot/serial, comment)

## Features

- Template switcher with fields that match each layout
- Live ZPL generation as you type
- Copy to clipboard and download `.zpl`
- Optional visual preview via [Labelary](http://labelary.com/)

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

No build step or dependencies required.

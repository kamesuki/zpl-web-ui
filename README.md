# ZP Labels

Static form + right-side template editor for ZPL labels.

## Layout

- **Left:** template picker, label data, preview, generated ZPL, print actions
- **Right:** sticky **Template editor** panel with Move / Align / Transform / Order tools

If the live GitHub Pages site looks outdated, hard-refresh (`Ctrl/Cmd+Shift+R`) — Pages can lag a minute after merges.

## Templates

1. Template 1
2. Template 2
3. Template 3

## Editor tools

- Move / nudge, drag on preview
- Align (left/center/right/top/middle/bottom)
- Scale +, Scale −
- Rotate 90°
- Flip H / Flip V
- Forward / Backward / To front / To back
- X, Y, Size, Rotation properties
- Multi-select with Ctrl/Cmd-click

Edits sync into `^FO` / orientation / size commands and are saved in `localStorage`.

## Run

```bash
python3 -m http.server 8080
```

## GitHub Pages

Settings → Pages → Deploy from branch → `main` / `(root)`

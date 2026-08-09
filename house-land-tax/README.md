# House Land Tax Tool

房地合一 2.0 免費試算工具。

## Folder Contract

This folder owns the public tool route:

```text
/house-land-tax/
```

Expected files:

```text
index.html
house_land_tax_style.css
house_land_tax_engine.js
house_land_tax_ui.js
SPEC.md
test/
```

## File Responsibilities

- `SPEC.md`: product, tax-rule, validation, UI, and wording specification.
- `house_land_tax_engine.js`: pure calculation logic. No DOM access.
- `house_land_tax_ui.js`: DOM reading, validation display, result rendering, copy and print actions.
- `house_land_tax_style.css`: page-specific tool styling.
- `test/`: calculation tests for boundary dates, tax brackets, expenses, land deduction, and self-use benefit.

Shared site assets should remain in `../assets/` and shared images in `../images/`.


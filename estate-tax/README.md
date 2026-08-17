# Estate Tax Tool

台灣遺產稅免費試算工具。

## Folder Contract

This folder owns the public tool route:

```text
/estate-tax/
```

Expected files:

```text
index.html
estate_tax_style.css
estate_tax_engine.js
estate_tax_ui.js
SPEC.md
test/
```

## File Responsibilities

- `SPEC.md`: product, tax-rule, validation, UI, and wording specification.
- `estate_tax_engine.js`: pure calculation logic. No DOM access.
- `estate_tax_ui.js`: DOM reading, validation display, result rendering, copy and print actions.
- `estate_tax_style.css`: page-specific tool styling.
- `test/`: calculation tests for exemption, exclusions, deductions, brackets, and warnings.

Shared site assets should remain in `../assets/` and shared images in `../images/`.

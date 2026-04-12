import os

html_dir = r"d:\AI\lawrence_financial_site"
css_path = r"d:\AI\lawrence_financial_site\assets\styles.css"

# 1. HTML Fonts link update
old_font = "family=Noto+Serif+TC:wght@600;900&family=Playfair+Display:ital,wght@0,600;0,800;1,600&display=swap"
new_font = "family=Noto+Serif+TC:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&display=swap"

for fn in os.listdir(html_dir):
    if not fn.endswith(".html"):
        continue
    filepath = os.path.join(html_dir, fn)
    with open(filepath, "r", encoding="utf-8") as f:
        html = f.read()
    if old_font in html:
        html = html.replace(old_font, new_font)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)

# 2. CSS adjustments
with open(css_path, "r", encoding="utf-8") as f:
    css = f.read()

# Replace css sizes to be smaller and force font-weight: 500 for a more modest, non-obtrusive premium look.
css = css.replace('font-size:clamp(2.5rem, 6vw, 4.8rem);\n  font-family:"Playfair Display", "Noto Serif TC", serif;', 'font-size:clamp(2.15rem, 4.4vw, 3.8rem);\n  font-family:"Playfair Display", "Noto Serif TC", serif;\n  font-weight:500;')

css = css.replace('font-size:clamp(1.8rem, 3vw, 2.4rem);\n  font-family:"Playfair Display", "Noto Serif TC", serif;', 'font-size:clamp(1.55rem, 2.3vw, 2.15rem);\n  font-family:"Playfair Display", "Noto Serif TC", serif;\n  font-weight:600;')

css = css.replace('font-size:clamp(2rem, 4vw, 3.2rem); line-height:1.16;\n  font-family:"Playfair Display", "Noto Serif TC", serif;', 'font-size:clamp(1.82rem, 3vw, 2.8rem); line-height:1.16;\n  font-family:"Playfair Display", "Noto Serif TC", serif;\n  font-weight:600;')

css = css.replace('font-size: 1.618rem; font-family:"Playfair Display", "Noto Serif TC", serif;', 'font-size: 1.45rem; font-family:"Playfair Display", "Noto Serif TC", serif;\n  font-weight: 600;')

css = css.replace('font-size:1.35rem; font-family:"Playfair Display", "Noto Serif TC", serif;}', 'font-size:1.15rem; font-family:"Playfair Display", "Noto Serif TC", serif;\n  font-weight:600;}')

# Revert .home-hero h1 gradient if it's too aggressive, but the font weight change might be enough. Let's tone down the gold gradient a little bit in CSS:
# "color:#d8b97a !important;" instead of the heavy gradient.
# Actually, lowering the font weight removes the massive "gold blocks" look. Let's see if this fixes it.

with open(css_path, "w", encoding="utf-8") as f:
    f.write(css)

print("Toned down aesthetic executed successfully.")

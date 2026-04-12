import os, glob

html_dir = r"d:\AI\lawrence_financial_site"

for fn in glob.glob(os.path.join(html_dir, "*.html")):
    with open(fn, "r", encoding="utf-8") as f:
        html = f.read()

    target = '<a href="contact.html">聯絡我</a>'
    replacement = '<a href="calculator.html" style="color:var(--amber-600); font-weight:bold; letter-spacing:0.05em;">📝免費試算</a>\n        <a href="contact.html">聯絡我</a>'

    if '<a href="calculator.html"' not in html and target in html:
        html = html.replace(target, replacement)
        with open(fn, "w", encoding="utf-8") as f:
            f.write(html)
            
print("Nav menu successfully injected.")

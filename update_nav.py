import os, glob

for file in glob.glob(r'd:\AI\lawrence_financial_site\*.html'):
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Try to find exactly <a href="contact.html">聯絡諮詢</a> and replace it with calculator + contact
    target = '<a href="contact.html">聯絡諮詢</a>'
    replacement = '<a href="calculator.html" style="color:var(--amber-600); font-weight:bold; letter-spacing:0.05em;">📝免費試算</a>\n        <a href="contact.html">聯絡諮詢</a>'
    
    if '<a href="calculator.html"' not in content and target in content:
        content = content.replace(target, replacement)
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)

print("Navigation completely updated with calculator linker")

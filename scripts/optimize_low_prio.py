import os
import re

css_path = r"d:\AI\lawrence_financial_site\assets\styles.css"
html_dir = r"d:\AI\lawrence_financial_site"

# 1. Update CSS File
with open(css_path, "r", encoding="utf-8") as f:
    css = f.read()

# Replace lines 895-984 logic using regex or string replacement
css_to_remove = """[data-theme="dark"] .hero-card h1,
[data-theme="dark"] .hero-card h2,
[data-theme="dark"] .hero-card h3,
[data-theme="dark"] .hero-card p,
[data-theme="dark"] .hero-card span,
[data-theme="dark"] .hero-card strong,
[data-theme="dark"] .hero-card small,
[data-theme="dark"] .hero-card li,
[data-theme="dark"] .hero-card a,
[data-theme="dark"] .panel h1,
[data-theme="dark"] .panel h2,
[data-theme="dark"] .panel h3,
[data-theme="dark"] .panel p,
[data-theme="dark"] .panel span,
[data-theme="dark"] .panel strong,
[data-theme="dark"] .panel small,
[data-theme="dark"] .panel li,
[data-theme="dark"] .panel a,
[data-theme="dark"] .feature-card h1,
[data-theme="dark"] .feature-card h2,
[data-theme="dark"] .feature-card h3,
[data-theme="dark"] .feature-card p,
[data-theme="dark"] .feature-card span,
[data-theme="dark"] .feature-card strong,
[data-theme="dark"] .feature-card small,
[data-theme="dark"] .feature-card li,
[data-theme="dark"] .feature-card a,
[data-theme="dark"] .service-card h1,
[data-theme="dark"] .service-card h2,
[data-theme="dark"] .service-card h3,
[data-theme="dark"] .service-card p,
[data-theme="dark"] .service-card span,
[data-theme="dark"] .service-card strong,
[data-theme="dark"] .service-card small,
[data-theme="dark"] .service-card li,
[data-theme="dark"] .service-card a,
[data-theme="dark"] .article-card h1,
[data-theme="dark"] .article-card h2,
[data-theme="dark"] .article-card h3,
[data-theme="dark"] .article-card p,
[data-theme="dark"] .article-card span,
[data-theme="dark"] .article-card strong,
[data-theme="dark"] .article-card small,
[data-theme="dark"] .article-card li,
[data-theme="dark"] .article-card a,
[data-theme="dark"] .testimonial h1,
[data-theme="dark"] .testimonial h2,
[data-theme="dark"] .testimonial h3,
[data-theme="dark"] .testimonial p,
[data-theme="dark"] .testimonial span,
[data-theme="dark"] .testimonial strong,
[data-theme="dark"] .testimonial small,
[data-theme="dark"] .testimonial li,
[data-theme="dark"] .testimonial a,
[data-theme="dark"] .contact-card h1,
[data-theme="dark"] .contact-card h2,
[data-theme="dark"] .contact-card h3,
[data-theme="dark"] .contact-card p,
[data-theme="dark"] .contact-card span,
[data-theme="dark"] .contact-card strong,
[data-theme="dark"] .contact-card small,
[data-theme="dark"] .contact-card li,
[data-theme="dark"] .contact-card a,
[data-theme="dark"] .timeline-card h1,
[data-theme="dark"] .timeline-card h2,
[data-theme="dark"] .timeline-card h3,
[data-theme="dark"] .timeline-card p,
[data-theme="dark"] .timeline-card span,
[data-theme="dark"] .timeline-card strong,
[data-theme="dark"] .timeline-card small,
[data-theme="dark"] .timeline-card li,
[data-theme="dark"] .timeline-card a,
[data-theme="dark"] .article-block h1,
[data-theme="dark"] .article-block h2,
[data-theme="dark"] .article-block h3,
[data-theme="dark"] .article-block p,
[data-theme="dark"] .article-block span,
[data-theme="dark"] .article-block strong,
[data-theme="dark"] .article-block small,
[data-theme="dark"] .article-block li,
[data-theme="dark"] .article-block a,
[data-theme="dark"] .floating-badge h1,
[data-theme="dark"] .floating-badge h2,
[data-theme="dark"] .floating-badge h3,
[data-theme="dark"] .floating-badge p,
[data-theme="dark"] .floating-badge span,
[data-theme="dark"] .floating-badge strong,
[data-theme="dark"] .floating-badge small,
[data-theme="dark"] .floating-badge li,
[data-theme="dark"] .floating-badge a,"""

css_replacement_is = """[data-theme="dark"] :is(.hero-card, .panel, .feature-card, .service-card, .article-card, .testimonial, .contact-card, .timeline-card, .article-block, .floating-badge) :is(h1, h2, h3, p, span, strong, small, li, a),"""

# Perform replacement
css = css.replace(css_to_remove, css_replacement_is)

# Append footer CSS if not there
if ".footer-brand" not in css:
    footer_css_old = """footer{padding:30px 0 38px; color:var(--slate-500); font-size:.95rem}
.footer-inner{
  display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap;
  border-top:1px solid rgba(219,228,238,.98); padding-top:24px;
}"""
    footer_css_new = """footer{padding:40px 0 30px; color:var(--slate-500); font-size:.95rem}
.footer-inner{
  display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:30px;
  border-top:1px solid var(--line); padding-top:30px; margin-bottom:30px;
}
.footer-brand strong, .footer-nav strong, .footer-contact strong { display:block; color:var(--navy-900); margin-bottom:12px; font-size:1.05rem; }
.footer-brand p { margin:0; line-height:1.6; }
.footer-nav a, .footer-contact a { display:block; padding:4px 0; color:var(--text-soft); }
.footer-nav a:hover, .footer-contact a:hover { color:var(--navy-700); }
.footer-bottom { border-top:1px solid var(--line); padding-top:20px; display:flex; justify-content:space-between; align-items:center; }
[data-theme="dark"] .footer-brand strong, [data-theme="dark"] .footer-nav strong, [data-theme="dark"] .footer-contact strong { color:#f8fbff; }
[data-theme="dark"] .footer-nav a, [data-theme="dark"] .footer-contact a { color:#d8e1ec; }
[data-theme="dark"] .footer-nav a:hover, [data-theme="dark"] .footer-contact a:hover { color:#fff; }"""
    css = css.replace(footer_css_old, footer_css_new)
    
with open(css_path, "w", encoding="utf-8") as f:
    f.write(css)

# HTML modifications for Footer and Schema
old_footer = """  <footer>
    <div class="container footer-inner">
      <div>© 2026 駱潤生 Lawrence. All Rights Reserved.</div>
    </div>
  </footer>"""

new_footer = """  <footer>
    <div class="container footer-inner">
      <div class="footer-brand">
        <strong>駱潤生 Lawrence</strong>
        <p>CFP®認證理財規劃顧問<br>高齡金融・信託・資產傳承</p>
      </div>
      <div class="footer-nav">
        <strong>網站導覽</strong>
        <a href="about.html">關於我</a>
        <a href="services.html">服務項目</a>
        <a href="articles.html">專業文章</a>
      </div>
      <div class="footer-contact">
        <strong>聯絡方式</strong>
        <a href="mailto:camel40tw@gmail.com">camel40tw@gmail.com</a>
        <a href="https://line.me/ti/p/iaCU1C6Wbl" target="_blank" rel="noopener">LINE 預約諮詢</a>
      </div>
    </div>
    <div class="container footer-bottom">
      <div>© 2026 駱潤生 Lawrence. All Rights Reserved.</div>
    </div>
  </footer>"""

for filename in os.listdir(html_dir):
    if not filename.endswith(".html"): continue
    p = os.path.join(html_dir, filename)
    with open(p, "r", encoding="utf-8") as f:
        html = f.read()
        
    html = html.replace(old_footer, new_footer)
    
    # Schema customization
    if filename == "about.html":
        html = html.replace('"@type":"ProfessionalService"', '"@type":"Person"')
    elif filename == "contact.html":
        html = html.replace('"@type":"ProfessionalService"', '"@type":"ContactPage"')
    elif filename == "articles.html" or "article-" in filename:
        html = html.replace('"@type":"ProfessionalService"', '"@type":"WebPage"')
        
    with open(p, "w", encoding="utf-8") as f:
        f.write(html)
print("Low-Prio optimization successfully applied.")

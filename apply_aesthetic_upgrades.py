import os

html_dir = r"d:\AI\lawrence_financial_site"
css_path = r"d:\AI\lawrence_financial_site\assets\styles.css"
js_path = r"d:\AI\lawrence_financial_site\assets\main.js"

# 1. Modify HTML files (insert Google Fonts before </head>)
fonts_link = """  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@600;900&family=Playfair+Display:ital,wght@0,600;0,800;1,600&display=swap" rel="stylesheet">
"""

for fn in os.listdir(html_dir):
    if not fn.endswith(".html"):
        continue
    filepath = os.path.join(html_dir, fn)
    with open(filepath, "r", encoding="utf-8") as f:
        html = f.read()
    
    if "fonts.googleapis.com" not in html:
        html = html.replace("</head>", fonts_link + "</head>")
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(html)

# 2. Modify styles.css
with open(css_path, "r", encoding="utf-8") as f:
    css = f.read()

# Make hero-title bigger and add serif font
css = css.replace('font-size:clamp(2.15rem, 4.4vw, 3.45rem);', 'font-size:clamp(2.5rem, 6vw, 4.8rem);\n  font-family:"Playfair Display", "Noto Serif TC", serif;')

# About intro title
css = css.replace('font-size:clamp(1.55rem, 2.3vw, 2.06rem);', 'font-size:clamp(1.8rem, 3vw, 2.4rem);\n  font-family:"Playfair Display", "Noto Serif TC", serif;')

# section-title h2
css = css.replace('margin:0; color:var(--navy-900); font-size:clamp(1.82rem, 3vw, 2.8rem); line-height:1.16;', 'margin:0; color:var(--navy-900); font-size:clamp(2rem, 4vw, 3.2rem); line-height:1.16;\n  font-family:"Playfair Display", "Noto Serif TC", serif;')

# Quote panel
css = css.replace('.quote-panel strong{display:block; margin-bottom:14px; font-size:1.12rem}', '.quote-panel strong{display:block; margin-bottom:14px; font-size:1.35rem; font-family:"Playfair Display", "Noto Serif TC", serif;}')

# Adding noise texture
noise_css = """
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.04;
}
[data-theme="dark"] body::before {
  opacity: 0.055;
}
"""

if "feTurbulence" not in css:
    css += noise_css

# Button shimmer
btn_shimmer_css = """
.btn-primary {
  position: relative;
  overflow: hidden;
}
.btn-primary::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
  transform: skewX(-20deg);
  transition: all 0.6s cubic-bezier(0.19, 1, 0.22, 1);
}
.btn-primary:hover::after {
  left: 150%;
}
"""
if "skewX(-20deg)" not in css:
    css += btn_shimmer_css
    
# Golden ratio scale upgrades for service card
css = css.replace('.feature-card h3, .service-card h3 {\n  margin: 0 0 14px; \n  color: var(--navy-900); \n  font-size: 1.618rem;', '.feature-card h3, .service-card h3 {\n  margin: 0 0 14px; \n  color: var(--navy-900); \n  font-size: 1.618rem; font-family:"Playfair Display", "Noto Serif TC", serif;')

with open(css_path, "w", encoding="utf-8") as f:
    f.write(css)

# 3. Main.js - Animated counter for stats
js_stat_code = """
// ─── Stat Counter Animation ──────────────────────────────────────────────────
const statBoxes = document.querySelectorAll('.stat-box strong');
if (statBoxes.length) {
  const statIo = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const text = el.innerText;
      const match = text.match(/(\\d+)(.*)/);
      if (match) {
        let max = parseInt(match[1], 10);
        let suffix = match[2] || '';
        let current = 0;
        let inc = Math.max(1, Math.ceil(max / 40));
        let int = setInterval(() => {
          current += inc;
          if (current >= max) {
            current = max;
            clearInterval(int);
          }
          el.innerText = current + suffix;
        }, 30);
        statIo.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  statBoxes.forEach(el => statIo.observe(el));
}
"""

with open(js_path, "r", encoding="utf-8") as f:
    js = f.read()

if "Stat Counter" not in js:
    js += js_stat_code
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(js)

print("Aesthetic upgrade executed successfully.")

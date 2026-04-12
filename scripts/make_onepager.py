import os
import re

html_path = r'd:\AI\lawrence_financial_site\calculator.html'
css_path = r'd:\AI\lawrence_financial_site\assets\calc-style.css'

with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Provide fallback if regex fails
# Find and remove wizard-progress block
html = re.sub(r'<div class="wizard-progress" id="wizardProgress">.*?</div>\s*<!-- Step 1 -->', '<!-- Step 1 -->', html, flags=re.DOTALL)

# 2. Find and obliterate all wizard-nav blocks
html = re.sub(r'<div class="wizard-nav">.*?</div>\s*</div>\s*(<!-- Step [234] -->|</section>)', r'</div>\n      \1', html, flags=re.DOTALL)

# 3. Add a unified action bar at the end of panel4, right before the </section>
unified_bar = """
        <div class="unified-action-bar" style="display:flex; justify-content:center; gap:16px; margin-top:40px; padding-top:30px; border-top:1px solid rgba(219,228,238,0.5);">
          <button type="button" class="btn btn-outline" style="border-radius:6px; padding:10px 24px;" onclick="loadData()">載入上次儲存紀錄</button>
          <button type="button" class="btn btn-outline" style="border-radius:6px; padding:10px 24px;" onclick="saveData()">儲存輸入內容</button>
          <button type="button" class="btn btn-primary" style="border-radius:6px; padding:10px 48px; background:var(--navy-900); color:#fff; font-family:var(--font-serif);" onclick="calculateRetirement()">產出退休規劃報告</button>
        </div>
      </div>
"""

# Wait, the previous regex removed the closing `</div>` of panel4 if it was caught.
# Let's do a more precise replacement just for the wizard-navs.
with open(html_path, 'r', encoding='utf-8') as f:
    html = f.read() # reset

# Remove wizard progress
html = re.sub(r'<div class="wizard-progress" id="wizardProgress">.*?</div>\s*<!--', '<!--', html, flags=re.DOTALL)

# Remove wizard navs
html = re.sub(r'<div class="wizard-nav">.*?</div>\s*</div>', '</div>', html, flags=re.DOTALL)

# Inject unified action bar at the end of panel4
html = html.replace('<!-- 報告頁 -->', unified_bar + '\n    <!-- 報告頁 -->')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(html)

# Let's make sure the CSS displays all panels now
with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

one_page_css = """
/* One Pager overrides */
.wizard-panel { display: block !important; opacity: 1 !important; transform: none !important; margin-bottom: 30px; border-radius: 12px; }
.unified-action-bar { margin-bottom: 60px; }
.card.form-card { padding: 40px; box-shadow: 0 12px 28px rgba(16,41,71,0.03); border: 1px solid rgba(219,228,238,0.6); }
[data-theme="dark"] .card.form-card { background: rgba(28,42,60,0.4); border-color: rgba(255,255,255,0.05); }
@media (max-width: 640px) {
  .unified-action-bar { flex-direction: column; }
  .unified-action-bar button { width: 100%; }
}
"""

if 'One Pager' not in css:
    css += '\n\n' + one_page_css
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(css)

print("Converted to one-pager successfully.")

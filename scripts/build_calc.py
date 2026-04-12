import os
import re

origin_site_file = r"d:\AI\lawrence_financial_site\services.html"
calc_source_file = r"d:\AI\程式備份\2_gemini_ABC補全版\index_v3_abc_fusion.html"
target_calc_file = r"d:\AI\lawrence_financial_site\calculator.html"

# Extract header from original
with open(origin_site_file, "r", encoding="utf-8") as f:
    site_html = f.read()

header_part = site_html.split("<main")[0]
footer_part_match = re.search(r'(<footer\b.*)', site_html, re.DOTALL)
footer_part = footer_part_match.group(1) if footer_part_match else ""

# Replace title and description in header_part
header_part = re.sub(r'<title>.*?</title>', '<title>退休財富缺口精準試算系統 | 駱潤生 Lawrence</title>', header_part)
header_part = re.sub(r'<meta name="description" content=".*?">', '<meta name="description" content="免費互動式試算您的退休資金缺口與長照風險壓力測試，協助您盡早規劃專屬的安穩退休制度。">', header_part)

# Add calc styles before closing head
header_part = header_part.replace('</head>', '  <link rel="stylesheet" href="assets/calc-style.css">\n  <style>\n    .page-bg { background: transparent !important; box-shadow: none !important; }\n    .container { max-width: 1080px !important; margin: 0 auto; }\n  </style>\n</head>')

# Ensure navigation links active state can be toggled by JS (handled by main.js)
# Extract calculator DOM
with open(calc_source_file, "r", encoding="utf-8") as f:
    calc_html = f.read()

calc_body_match = re.search(r'<div class="page-bg">(.*?)</div>\s*<script src="https://cdn.jsdelivr.net/npm/chart.js"', calc_html, re.DOTALL)
calc_body = calc_body_match.group(0) if calc_body_match else ""
calc_body = re.sub(r'<script src="https://cdn.jsdelivr.net/npm/chart.js".*', '', calc_body, flags=re.DOTALL) # remove trailing script parts if caught
calc_body = calc_body.strip()

# Inject LINE lead magnet button into the button-group in report section
line_btn_html = """            <button type="button" class="btn btn-primary" onclick="sendToLine()" style="background: linear-gradient(135deg, #06c755 0%, #02b34a 100%); border:none; border-radius: 8px; color: #fff; padding: 10px 20px; font-weight:bold; font-family:var(--font-serif); letter-spacing:0.05em;">✨ 一鍵傳送給 Lawrence 預約解析</button>"""

calc_body = calc_body.replace('<div class="button-group horizontal">', '<div class="button-group horizontal">\n' + line_btn_html)

# Append specific Javascript files
script_injections = """
  <!-- Calculator Scripts -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="assets/calc-core.js"></script>
  <script src="assets/calc-ui.js"></script>
  <script>
    // Lead Magnet Integration
    function sendToLine() {
      try {
        const p1 = document.getElementById('reportSummary')?.innerText || '';
        const p2 = document.getElementById('result')?.innerText || '';
        if(!p1) {
            alert('請先產出報告');
            return;
        }
        
        let msg = "Lawrence 老師您好：\\n\\n我剛剛在官網完成了【退休資金缺口試算】。\\n以下是系統診斷的初步結果：\\n\\n";
        msg += p1.substring(0, 150) + "...\\n\\n"; // limit length
        msg += "請問我能預約進一步的免費線上諮詢嗎？謝謝您！";
        
        const lineUrl = "https://line.me/ti/p/iaCU1C6Wbl?text=" + encodeURIComponent(msg);
        window.open(lineUrl, '_blank');
      } catch (e) {
        window.open("https://line.me/ti/p/iaCU1C6Wbl", '_blank');
      }
    }
  </script>
"""

# Assemble final HTML
final_html = header_part + "\n<main style=\"padding: 100px 0 60px;\">\n" + calc_body + "\n</main>\n" + footer_part
final_html = final_html.replace('</body>', script_injections + '\n</body>')

with open(target_calc_file, "w", encoding="utf-8") as f:
    f.write(final_html)

print("Calculator page built successfully at " + target_calc_file)

import os
import re

directory = r"d:\AI\lawrence_financial_site"

script_old = """  <script>
    try {
      if (localStorage.getItem('theme') === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch (error) {}
  </script>"""

script_new = """  <script>
    try {
      const saved = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (saved === 'dark' || (!saved && prefersDark)) {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    } catch (error) {}
  </script>"""

nav_regex = re.compile(r'(<nav class="nav-links" id="navLinks">)(.*?)(</nav>)', re.DOTALL)

for filename in os.listdir(directory):
    if filename.endswith(".html"):
        filepath = os.path.join(directory, filename)
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
            
        original_content = content
        
        # Update script
        if script_old in content:
            content = content.replace(script_old, script_new)
        
        # Update nav links
        def nav_replacer(match):
            nav_open = match.group(1)
            nav_content = match.group(2)
            nav_close = match.group(3)
            
            # remove class=""
            nav_content = nav_content.replace(' class=""', '')
            # remove class="active"
            nav_content = nav_content.replace(' class="active"', '')
            
            return f"{nav_open}{nav_content}{nav_close}"
            
        content = nav_regex.sub(nav_replacer, content)

        if content != original_content:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"Updated {filename}")

print("HTML files processed.")

import os

css_path = r'd:\AI\lawrence_financial_site\assets\calc-style.css'
with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

premium_progress_css = """
/* Premium Wizard Progress Re-design */
.wizard-progress { display:flex; align-items:flex-start; justify-content:space-between; gap:0; margin:0 auto 48px; max-width:680px; position:relative; }
.wp-step { display:flex; flex-direction:column; align-items:center; flex:1; position:relative; cursor:pointer; }
.wp-step:not(:last-child)::after { content:''; position:absolute; top:20px; left:50%; right:-50%; height:2px; background:rgba(219,228,238,0.5); z-index:0; transition:all 0.6s ease; }
[data-theme="dark"] .wp-step:not(:last-child)::after { background: rgba(56,86,122,0.5); }
.wp-step.done:not(:last-child)::after { background:var(--amber-500); }

.wp-circle {
  width:40px; height:40px; border-radius:50%; border:1px solid rgba(16,41,71,0.1); background:#f8fbff; 
  color:var(--slate-500); display:flex; align-items:center; justify-content:center; 
  font-family:"Playfair Display", "Noto Serif TC", serif; font-size:16px; font-weight:600; 
  z-index:1; transition:all 0.4s ease; position:relative;
}
[data-theme="dark"] .wp-circle {
  background:var(--navy-900); border-color:rgba(255,255,255,0.1); color:rgba(255,255,255,0.4);
}

.wp-step.active .wp-circle {
  border-color:var(--amber-500); background:var(--amber-500); color:#fff; box-shadow:0 0 0 6px rgba(245,158,11,0.15);
}
.wp-step.done .wp-circle {
  border-color:var(--amber-500); background:var(--navy-50); color:var(--amber-600);
}
[data-theme="dark"] .wp-step.done .wp-circle {
  background:rgba(245,158,11,0.1); color:var(--amber-500); border-color:var(--amber-500);
}

.wp-num {}
.wp-step.done .wp-num::before { content:'✓'; }
.wp-step.done .wp-num-text { display:none; }

.wp-label {
  margin-top:12px; font-size:14px; font-family:"Playfair Display", "Noto Serif TC", serif; 
  color:var(--slate-500); letter-spacing:0.05em; text-align:center; white-space:nowrap; transition:all 0.3s;
}
[data-theme="dark"] .wp-label { color:rgba(255,255,255,0.4); }

.wp-step.active .wp-label { color:var(--navy-900); font-weight:700; transform: translateY(2px); }
[data-theme="dark"] .wp-step.active .wp-label { color:var(--amber-500); }
.wp-step.done .wp-label { color:var(--slate-700); }
[data-theme="dark"] .wp-step.done .wp-label { color:rgba(255,255,255,0.7); }

/* Animation panels */
.wizard-panel{display:none;animation:fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);}
.wizard-panel.active{display:block;}
@keyframes fadeIn{from{opacity:0;transform:translateY(15px);}to{opacity:1;transform:translateY(0);}}
"""

if 'wizard-progress' not in css:
    css = css + '\n\n' + premium_progress_css
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(css)
    print('Wizard progress CSS beautifully restored.')
else:
    print('Already present')

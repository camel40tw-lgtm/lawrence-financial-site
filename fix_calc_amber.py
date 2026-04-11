import os

css_path = r'd:\AI\lawrence_financial_site\assets\calc-style.css'
with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

dark_mode_amber_fix = """
/* Force all orange/kaki text to amber in dark mode */
[data-theme="dark"] .main-title span,
[data-theme="dark"] .section-title::before,
[data-theme="dark"] .medical-block strong,
[data-theme="dark"] .rule4-block strong,
[data-theme="dark"] .report-advice strong,
[data-theme="dark"] .result strong,
[data-theme="dark"] .cashflow-positive,
[data-theme="dark"] .good,
[data-theme="dark"] .step-heading span {
    color: var(--amber-400) !important;
}

[data-theme="dark"] .report-advice { border-color: rgba(251,191,36,0.3) !important; border-left: 4px solid var(--amber-400) !important; }
[data-theme="dark"] .medical-block { border-color: rgba(251,191,36,0.2) !important; }
[data-theme="dark"] .rule4-badge.safe { color: var(--emerald-400) !important; border-color: rgba(52,211,153,0.3) !important; }
[data-theme="dark"] .rule4-badge.caution { color: var(--amber-400) !important; border-color: rgba(251,191,36,0.3) !important; }
[data-theme="dark"] .rule4-badge.danger { color: var(--rose-400) !important; border-color: rgba(244,63,94,0.3) !important; }
"""

if 'Force all orange/kaki text to amber' not in css:
    css = css + '\n' + dark_mode_amber_fix
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(css)
    print('Kaki orange texts replaced with amber in dark mode.')
else:
    print('Already applied.')

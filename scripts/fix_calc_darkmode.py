import os

css_path = r'd:\AI\lawrence_financial_site\assets\calc-style.css'
with open(css_path, 'r', encoding='utf-8') as f:
    css = f.read()

dark_mode_css = """
/* Dark Mode Deep Consistency Fixes */
[data-theme="dark"] .step-heading { color: rgba(255,255,255,0.95) !important; }
[data-theme="dark"] .step-desc { color: rgba(255,255,255,0.65) !important; }
[data-theme="dark"] .section-title { color: var(--amber-400) !important; }
[data-theme="dark"] .finance-group-title { color: var(--amber-400) !important; }
[data-theme="dark"] .finance-group { background: rgba(16,30,45,0.4) !important; border-color: rgba(255,255,255,0.08) !important; }
[data-theme="dark"] .field-note { color: rgba(255,255,255,0.5) !important; }
[data-theme="dark"] .goal-box, [data-theme="dark"] .income-box { background: rgba(16,30,45,0.4) !important; border-color: rgba(255,255,255,0.08) !important; }
[data-theme="dark"] .goal-title { color: var(--amber-400) !important; }
[data-theme="dark"] .check-item, [data-theme="dark"] .checkbox-row { color: rgba(255,255,255,0.7) !important; }
[data-theme="dark"] .summary-confirm { background: rgba(30,50,75,0.6) !important; color: rgba(255,255,255,0.85) !important; border-color: rgba(255,255,255,0.1) !important; }
[data-theme="dark"] .summary-confirm strong { color: var(--amber-400) !important; }

[data-theme="dark"] .report-summary,
[data-theme="dark"] .rule4-block,
[data-theme="dark"] .medical-block,
[data-theme="dark"] .report-advice { background: rgba(16,30,45,0.5) !important; color: rgba(255,255,255,0.85) !important; border-color: rgba(255,255,255,0.1) !important; }

[data-theme="dark"] .result, [data-theme="dark"] .result-title { color: rgba(255,255,255,0.9) !important; }
[data-theme="dark"] .chart-title { color: rgba(255,255,255,0.9) !important; }
[data-theme="dark"] .cashflow-audit { background: rgba(16,30,45,0.5) !important; border-color: rgba(255,255,255,0.08) !important; color: rgba(255,255,255,0.7) !important; }
[data-theme="dark"] .cashflow-table-wrap { background: rgba(16,30,45,0.5) !important; border-color: rgba(255,255,255,0.08) !important; }
[data-theme="dark"] .cashflow-table { color: rgba(255,255,255,0.8) !important; }
[data-theme="dark"] .cashflow-table th { background: rgba(25,40,60,0.8) !important; color: rgba(255,255,255,0.95) !important; border-bottom: 1px solid rgba(255,255,255,0.1) !important; }
[data-theme="dark"] .cashflow-table td { border-bottom: 1px solid rgba(255,255,255,0.05) !important; }
[data-theme="dark"] .cashflow-table tbody tr:nth-child(even) { background: rgba(255,255,255,0.02) !important; }
[data-theme="dark"] .cashflow-table tbody tr:hover { background: rgba(255,255,255,0.05) !important; }

[data-theme="dark"] .accordion-btn { background: rgba(25,40,60,0.6) !important; color: rgba(255,255,255,0.85) !important; border-color: rgba(255,255,255,0.1) !important; }
[data-theme="dark"] .accordion-panel { background: rgba(16,30,45,0.5) !important; border-color: rgba(255,255,255,0.1) !important; color: rgba(255,255,255,0.7) !important; }
[data-theme="dark"] .accordion-content { color: rgba(255,255,255,0.7) !important; }
[data-theme="dark"] .house-diagnostics-item { background: rgba(16,30,45,0.4) !important; border-color: rgba(255,255,255,0.08) !important; color: rgba(255,255,255,0.75) !important; }
[data-theme="dark"] .house-diagnostics-summary { background: rgba(16,30,45,0.4) !important; border-color: rgba(255,255,255,0.08) !important; color: rgba(255,255,255,0.75) !important; }
[data-theme="dark"] .house-diagnostics-title { color: rgba(255,255,255,0.95) !important; }
[data-theme="dark"] .house-diagnostics-subtitle { color: rgba(255,255,255,0.5) !important; }
[data-theme="dark"] .house-diagnostics-bridge { color: rgba(255,255,255,0.7) !important; }
[data-theme="dark"] .house-diagnostics-value { color: rgba(255,255,255,0.95) !important; }
[data-theme="dark"] .house-diagnostics-metric { background: rgba(255,255,255,0.05) !important; border-color: rgba(255,255,255,0.1) !important; }

[data-theme="dark"] canvas { background: rgba(16,30,45,0.5) !important; border-color: rgba(255,255,255,0.08) !important; }
"""

if 'Dark Mode Deep Consistency Fixes' not in css:
    css = css + '\n\n' + dark_mode_css
    with open(css_path, 'w', encoding='utf-8') as f:
        f.write(css)
    print('Dark mode texts beautifully fixed.')
else:
    print('Already fixed.')

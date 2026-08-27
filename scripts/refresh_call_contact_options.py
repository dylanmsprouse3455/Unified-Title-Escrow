from pathlib import Path
import re

js_path = Path("tracker/call-tracker.js")
html_path = Path("tracker/index.html")

js = js_path.read_text(encoding="utf-8").replace("\r\n", "\n")
old = '''  calls.forEach(function(record){upsertContact(record,false);});
  persistContacts();
}'''
new = '''  calls.forEach(function(record){upsertContact(record,false);});
  persistContacts();
  refreshCallerOptions();
}'''
if old in js:
    js = js.replace(old, new, 1)
elif new not in js:
    raise SystemExit("Could not locate loadContacts refresh point")
js_path.write_text(js, encoding="utf-8")

html = html_path.read_text(encoding="utf-8").replace("\r\n", "\n")
html, count = re.subn(
    r'<script src="call-tracker\.js[^\"]*"></script>',
    '<script src="call-tracker.js?v=contacts-layout-20260827-2"></script>',
    html,
    count=1,
)
if count != 1:
    raise SystemExit("Could not bump call tracker script version")
html_path.write_text(html, encoding="utf-8")

#!/usr/bin/env python3
"""Usage: markdone.py WP-1.2 "one-line note"  -> flips the package header to [x] and adds a Done line."""
import re, sys
wp, note = sys.argv[1], sys.argv[2]
p = 'audit/plan.md'; s = open(p).read()
m = re.search(r"(#### %s [^\n]*?)`\[[ ~x]\]`" % re.escape(wp), s)
assert m, wp
s = s[:m.start()] + m.group(1) + "`[x]`" + s[m.end():]
# insert Done line after the header line
i = s.index("\n", m.start()) + 1
s = s[:i] + "- **Done:** %s\n" % note + s[i:]
open(p, 'w').write(s)

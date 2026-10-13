#!/usr/bin/env python3
"""Remove openBug('AUD-xx'...) / fixme annotations for the given AUD ids from the e2e specs."""
import re, sys, glob
ids = sys.argv[1:]
n = 0
for f in glob.glob('tests/e2e/chunk-*/*.spec.ts'):
    s = open(f).read(); o = s
    for i in ids:
        s = re.sub(r"\n[ \t]*openBug\('%s'[^;]*\);" % re.escape(i), "", s)
        s = re.sub(r"\n[ \t]*test\.fixme\([^;]*'%s open[^;]*\);" % re.escape(i), "", s)
    if s != o:
        open(f, 'w').write(s); n += 1
print('files changed:', n)

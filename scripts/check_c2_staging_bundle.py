#!/usr/bin/env python3
"""Run after a staging sentinel build; prints no bundle contents/credential values."""
from pathlib import Path
assets = list(Path('dist/assets').glob('*.js'))
assert assets, 'Build first'
for marker in ['LC_TEST_SECRET_SENTINEL', 'LC_TEST_ID_SENTINEL', 'VITE_CONCEPT2_CLIENT_SECRET',
               'https://log.concept2.com/oauth/', 'https://log.concept2.com/api', 'concept2Legacy-']:
    assert not any(marker in p.read_text() for p in assets), 'Forbidden legacy auth material in staging assets'
assert not list(Path('dist/assets').glob('concept2Legacy-*'))
print('PASS: staging assets exclude sentinel credentials, production OAuth/API endpoints and legacy refresh module')

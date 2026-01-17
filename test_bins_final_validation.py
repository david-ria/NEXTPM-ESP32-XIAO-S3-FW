#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validation finale du parsing BINS avec les données utilisateur
"""

import sys
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Données réelles du screenshot utilisateur
test_cases = [
    {
        "name": "Sample 1 (16:48:13)",
        "raw": "81 25 00 00 02 C7 B0 00 00 05 23 00 00 01 BC 00 00 00 00 00 00 00 00",
        "expected": {"bin0": 2, "bin1": 51120, "bin2": 0, "bin3": 1315, "bin4": 444}
    },
    {
        "name": "Sample 2 (16:48:15)",
        "raw": "81 25 00 00 02 C5 B0 00 00 07 57 00 00 01 BC 00 00 00 00 00 00 00 00",
        "expected": {"bin0": 2, "bin1": 50608, "bin2": 0, "bin3": 1879, "bin4": 444}
    }
]

def parse_bins_corrected(raw_hex):
    """Parse BINS avec les offsets corrigés (comme kernel.js v1.0.3)"""
    bytes_arr = [int(b, 16) for b in raw_hex.split()]

    if len(bytes_arr) < 23:
        return None

    # Offsets corrigés avec gap
    offsets = [3, 5, 7, 9, 13]
    bins = {}

    for i, offset in enumerate(offsets):
        msb = bytes_arr[offset]
        lsb = bytes_arr[offset + 1]
        value = (msb << 8) | lsb
        bins[f'bin{i}'] = value

    return bins

print("="*70)
print("VALIDATION FINALE - Parsing BINS avec offsets corrigés")
print("="*70)
print()

all_passed = True

for test in test_cases:
    print(f"Test: {test['name']}")
    print(f"RAW:  {test['raw']}")

    result = parse_bins_corrected(test['raw'])
    expected = test['expected']

    print("Résultat:")
    test_passed = True

    for i in range(5):
        key = f'bin{i}'
        result_val = result[key]
        expected_val = expected[key]

        status = "✅" if result_val == expected_val else "❌"
        if result_val != expected_val:
            test_passed = False
            all_passed = False

        print(f"  {status} {key}: {result_val:6d} (attendu: {expected_val:6d})")

    if test_passed:
        print("✅ TEST RÉUSSI")
    else:
        print("❌ TEST ÉCHOUÉ")

    print()

print("="*70)
if all_passed:
    print("✅ TOUS LES TESTS RÉUSSIS")
    print()
    print("Le parsing BINS est maintenant correct!")
    print("Version web: v1.0.3-prod (build 20260117-155355)")
    print()
    print("Action requise:")
    print("1. Rafraîchissez la page web: Ctrl+Shift+R")
    print("2. Vérifiez la version dans le footer: v1.0.3-prod")
    print("3. Testez le bouton BINS dans l'interface")
    print("4. Le graphique devrait maintenant afficher les 5 barres correctement")
else:
    print("❌ CERTAINS TESTS ONT ÉCHOUÉ")
    print()
    print("Le parsing nécessite encore des corrections.")

print("="*70)

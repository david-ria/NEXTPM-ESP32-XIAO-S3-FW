#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test parsing BINS avec les données réelles de l'utilisateur
"""

# Données du screenshot
raw_samples = [
    "81 25 00 00 02 C7 B0 00 00 05 23 00 00 01 BC 00 00 00 00 00 00 00 00",
    "81 25 00 00 02 B7 BD 00 00 04 67 00 00 01 BC 00 00 00 00 00 00 00 00",
]

def parse_bins(raw_hex):
    """Parse BINS selon le code kernel.js"""
    bytes_arr = [int(b, 16) for b in raw_hex.split()]

    if len(bytes_arr) < 23:
        return None

    print(f"Raw: {raw_hex}")
    print(f"Length: {len(bytes_arr)} bytes")
    print()

    # Code actuel kernel.js (offset 3)
    print("=== Parsing actuel (offset 3, contigu) ===")
    bins_current = []
    for i in range(5):
        offset = 3 + (i * 2)
        msb = bytes_arr[offset]
        lsb = bytes_arr[offset + 1]
        value = (msb << 8) | lsb
        bins_current.append(value)
        print(f"bin{i} (offset {offset:2d}-{offset+1:2d}): 0x{msb:02X} {lsb:02X} = {value:6d}")

    print()
    print("=== Test avec gaps (offset 3,5,7,9,13) ===")
    offsets = [3, 5, 7, 9, 13]
    bins_gaps = []
    for i, offset in enumerate(offsets):
        msb = bytes_arr[offset]
        lsb = bytes_arr[offset + 1]
        value = (msb << 8) | lsb
        bins_gaps.append(value)
        print(f"bin{i} (offset {offset:2d}-{offset+1:2d}): 0x{msb:02X} {lsb:02X} = {value:6d}")

    print()
    print("=== Comparaison ===")
    print(f"Actuel: bin0={bins_current[0]:6d}, bin1={bins_current[1]:6d}, bin2={bins_current[2]:6d}, bin3={bins_current[3]:6d}, bin4={bins_current[4]:6d}")
    print(f"Gaps:   bin0={bins_gaps[0]:6d}, bin1={bins_gaps[1]:6d}, bin2={bins_gaps[2]:6d}, bin3={bins_gaps[3]:6d}, bin4={bins_gaps[4]:6d}")

    print()
    print("=== Analyse ===")
    if bins_gaps[1] > 10000 and bins_gaps[1] < 60000:
        print("✅ Parsing avec gaps semble correct (bin1 dominant ~50k)")
    else:
        print("⚠️  Valeurs inhabituelles")

    print("\n" + "="*70 + "\n")

    return bins_gaps

# Test avec les deux échantillons
for raw in raw_samples:
    parse_bins(raw)

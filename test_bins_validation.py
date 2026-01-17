#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test de validation complet pour BINS
Vérifie que les données BINS sont correctement reçues et parsées
"""

import serial
import time
import json
import sys

# Windows UTF-8 fix
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Configuration
PORT = 'COM23'
BAUD = 115200
TIMEOUT = 10

def send_command(ser, cmd):
    """Envoie une commande et attend la réponse"""
    print(f"\n{'='*60}")
    print(f"📤 TX: {cmd}")
    print('='*60)

    # Vider le buffer
    ser.reset_input_buffer()

    # Envoyer commande
    ser.write(f"{cmd}\n".encode())

    # Attendre réponse
    start_time = time.time()
    response_lines = []

    while (time.time() - start_time) < TIMEOUT:
        if ser.in_waiting > 0:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            if line:
                response_lines.append(line)
                print(f"📥 RX: {line}")

                # Essayer de parser en JSON
                try:
                    data = json.loads(line)
                    return data, line
                except:
                    pass

    print("❌ TIMEOUT - Aucune réponse JSON valide")
    return None, None

def validate_bins_data(data):
    """Valide les données BINS reçues"""
    print(f"\n{'='*60}")
    print("🔍 VALIDATION DES DONNÉES BINS")
    print('='*60)

    if not data:
        print("❌ Aucune donnée à valider")
        return False

    valid = True

    # Vérifier structure de base
    if 'info' in data:
        print(f"✅ info: {data['info']}")
    else:
        print("❌ Champ 'info' manquant")
        valid = False

    if 'ok' in data:
        print(f"✅ ok: {data['ok']}")
    else:
        print("❌ Champ 'ok' manquant")
        valid = False

    # Vérifier données nextpm
    if 'nextpm' in data:
        nextpm = data['nextpm']
        print(f"✅ nextpm.state: {nextpm.get('state', 'N/A')}")
        print(f"✅ nextpm.chk_ok: {nextpm.get('chk_ok', 'N/A')}")

        if not nextpm.get('chk_ok'):
            print("⚠️  Checksum FAIL (bug connu FW 1047)")
    else:
        print("❌ Champ 'nextpm' manquant")
        valid = False

    # Vérifier données BINS avec format firmware
    if 'bins' in data:
        bins = data['bins']
        print("\n📊 DONNÉES BINS (format firmware):")

        expected_keys = ['ch_0_3_0_5', 'ch_0_5_1', 'ch_1_2_5', 'ch_2_5_5', 'ch_5_10']

        for i, key in enumerate(expected_keys):
            if key in bins:
                value = bins[key]
                print(f"  ✅ bin{i} ({key}): {value}")
            else:
                print(f"  ❌ bin{i} ({key}): MANQUANT")
                valid = False

        # Vérifier si les valeurs sont raisonnables
        print("\n🔬 ANALYSE DES VALEURS:")
        for i, key in enumerate(expected_keys):
            if key in bins:
                value = bins[key]

                # Les valeurs BINS devraient être des entiers positifs < 65535
                if isinstance(value, int) and 0 <= value <= 65535:
                    print(f"  ✅ bin{i}: Valeur raisonnable ({value})")
                elif isinstance(value, int) and value > 65535:
                    # Valeur trop grande - possible problème d'endianness
                    print(f"  ⚠️  bin{i}: Valeur très grande ({value}) - possible problème encodage")
                    print(f"      Si interprété comme uint16: {value & 0xFFFF}")
                else:
                    print(f"  ❌ bin{i}: Valeur invalide ({value})")
                    valid = False
    else:
        print("❌ Champ 'bins' manquant")
        valid = False

    # Vérifier données brutes
    if 'raw' in data:
        raw = data['raw']
        print(f"\n✅ raw: {raw}")

        # Parser les bytes
        raw_bytes = raw.split(' ')
        print(f"   Nombre de bytes: {len(raw_bytes)}")

        if len(raw_bytes) >= 23:
            print("   ✅ Longueur correcte (23 bytes attendus)")

            # Extraire les bins depuis raw
            print("\n🔬 BINS DEPUIS RAW:")
            for i in range(5):
                offset = 3 + (i * 2)
                if offset + 1 < len(raw_bytes):
                    msb = int(raw_bytes[offset], 16)
                    lsb = int(raw_bytes[offset + 1], 16)
                    value = (msb << 8) | lsb
                    print(f"   bin{i}: {value} (0x{raw_bytes[offset]} {raw_bytes[offset + 1]})")
        else:
            print(f"   ⚠️  Longueur inattendue ({len(raw_bytes)} bytes)")
    else:
        print("⚠️  Champ 'raw' manquant (optionnel)")

    print(f"\n{'='*60}")
    if valid:
        print("✅ VALIDATION RÉUSSIE")
    else:
        print("❌ VALIDATION ÉCHOUÉE")
    print('='*60)

    return valid

def main():
    print("🚀 Test de validation BINS - NextPM ESP32")
    print("="*60)

    try:
        # Connexion
        print(f"📡 Connexion à {PORT} @ {BAUD} baud...")
        ser = serial.Serial(PORT, BAUD, timeout=1)
        time.sleep(2)  # Attendre stabilisation
        print("✅ Connecté!")

        # Test 1: PING pour vérifier connectivité
        print("\n" + "="*60)
        print("TEST 1: PING")
        print("="*60)
        data, raw = send_command(ser, "PING")
        if data and data.get('ok'):
            print("✅ PING OK")
        else:
            print("❌ PING FAIL")
            return

        time.sleep(0.5)

        # Test 2: FW pour vérifier version
        print("\n" + "="*60)
        print("TEST 2: FW")
        print("="*60)
        data, raw = send_command(ser, "FW")
        if data and data.get('ok'):
            print("✅ FW OK")
            if 'nextpm' in data and 'fw' in data['nextpm']:
                fw = data['nextpm']['fw'].get('u16_swap', 0)
                print(f"   Firmware NextPM: {fw} (0x{fw:04x})")

                if fw >= 1047:
                    print("   ✅ BINS supporté (FW >= 1047)")
                else:
                    print("   ⚠️  BINS non supporté (FW < 1047)")
        else:
            print("❌ FW FAIL")

        time.sleep(0.5)

        # Test 3: BINS 10s
        print("\n" + "="*60)
        print("TEST 3: BINS (10s)")
        print("="*60)
        data, raw = send_command(ser, "BINS")

        if data:
            valid = validate_bins_data(data)
            if valid:
                print("\n✅ TEST BINS RÉUSSI")
            else:
                print("\n❌ TEST BINS ÉCHOUÉ")
        else:
            print("\n❌ Aucune donnée BINS reçue")

        time.sleep(0.5)

        # Test 4: BINS 1M
        print("\n" + "="*60)
        print("TEST 4: BINS 1M")
        print("="*60)
        data, raw = send_command(ser, "BINS 1M")

        if data:
            valid = validate_bins_data(data)
            if valid:
                print("\n✅ TEST BINS 1M RÉUSSI")
            else:
                print("\n❌ TEST BINS 1M ÉCHOUÉ")
        else:
            print("\n❌ Aucune donnée BINS 1M reçue")

        # Fermer
        ser.close()
        print("\n" + "="*60)
        print("🏁 Tests terminés")
        print("="*60)

    except serial.SerialException as e:
        print(f"❌ Erreur série: {e}")
        print(f"Vérifiez que le port {PORT} est correct et disponible")
    except Exception as e:
        print(f"❌ Erreur: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()

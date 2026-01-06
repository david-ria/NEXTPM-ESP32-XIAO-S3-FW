# NEXTPM-ESP32-XIAO-S3-FW
Firmware ESP32 (XIAO ESP32-S3) for NextPM sensor using UART Simple Protocol. Stable DEBUG baseline with immutable text/JSON API, RAW access, and golden-frame validation. Validated on XIAO ESP32-S3 only.
Firmware ESP32 pour le capteur **NextPM**, basé sur le **UART Simple Protocol**.


## Scope (V1)

- Capteur : NextPM
- Protocole : UART Simple Protocol (115200, 8E1)
- Carte validée : **Seeed Studio XIAO ESP32-S3 uniquement**
- Interfaces :
  - USB Serial (CDC)
  - BLE (NUS)
- API : commandes texte + JSON **immutables**

⚠️ Ce dépôt est volontairement **monoplateforme** pour garantir la stabilité.
Toute autre carte ESP32 est hors périmètre sans adaptation explicite.

## Commandes supportées (contrat figé)

- PING  
- FW  
- STATE  
- TRH  
- PM [10S|1M|15M]  
- BINS [10S|1M|15M] *(timeout attendu si FW capteur < 1047)*  
- SNAPSHOT [10S|1M|15M]  
- RAW <cmd_hex> <len>

Les clés JSON existantes ne doivent **jamais** être renommées ou supprimées.

## Statut

- `v1.0-debug-baseline` : baseline DEBUG figée
- Goldens de référence : `goldens/golden_v1.md`

## Notes importantes

- Les valeurs décodées utilisent actuellement l’endianness **swap**, validée par mesures terrain.
- Toute modification doit préserver les goldens existants.

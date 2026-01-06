# Build instructions – NextPM ESP32 XIAO S3 (DEBUG)

This document describes how to build and flash the DEBUG firmware baseline
(tag: v1.0.0-debug).

No code modification is required.

---

## Hardware

- Board: Seeed Studio XIAO ESP32-S3
- Sensor: NextPM
- UART wiring:
  - RX: GPIO44 (D7)
  - TX: GPIO43 (D6)
- UART settings:
  - Baudrate: 115200
  - Format: 8E1

---

## Software requirements

- Arduino IDE (tested with Arduino IDE 2.x)
- ESP32 board package:
  - Vendor: Espressif
  - Version tested: 3.3.x
- Library:
  - NimBLE-Arduino
  - Version tested: 2.3.7

---

## Arduino IDE configuration

- Board: Seeed Studio XIAO ESP32-S3
- USB CDC On Boot: Enabled
- CPU Frequency: 240 MHz
- Flash Size: 8 MB
- Partition Scheme: default_8MB
- PSRAM: Disabled

---

## Firmware file

DEBUG firmware source:

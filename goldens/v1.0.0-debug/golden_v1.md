# Golden frames – v1.0.0-debug

This document defines the reference (“truth on the wire”) captured on a real NextPM sensor.
Any change breaking these goldens is a regression.

Context:
- Platform: Seeed Studio XIAO ESP32-S3
- Sensor: NextPM
- Protocol: UART Simple Protocol (115200, 8E1)
- Expected effective decoding: endianness = swap
- Notes: BINS may timeout when sensor FW < 1047

## RAW frames (captured)

### RAW 0x17 (FW) – len 6
81 17 00 10 46 12

### RAW 0x16 – len 4
81 16 00 69

### RAW 0x14 (TRH) – len 8
81 14 00 08 AB 0E 4E 5C

### RAW 0x11 (PM 10s) – len 16
81 11 00 00 4F 00 4F 00 4F 00 35 00 4A 00 4A B8

## Expected JSON outputs (captured)

### FW
{"info":"fw","ok":true,"ts_ms":24228,"nextpm":{"state":0,"fw":{"u16_doc":17936,"u16_swap":4166},"chk_ok":true}}

### STATE
{"info":"state","ok":true,"ts_ms":28476,"nextpm":{"state":0,"chk_ok":true}}

### TRH
{"info":"trh","ok":true,"ts_ms":34054,"nextpm":{"state":0,"chk_ok":true},"trh":{"t_c_doc":192.10,"rh_pct_doc":307.31,"t_c_swap":26.35,"rh_pct_swap":29.36}}

### PM (10s)
{"info":"pm","ok":true,"ts_ms":41157,"avg":"10s","nextpm":{"state":0,"chk_ok":true},"pm":{"nb_l":{"pm1_doc":15872,"pm25_doc":15872,"pm10_doc":15872,"pm1_swap":62,"pm25_swap":62,"pm10_swap":62},"ug_m3":{"pm1_doc":998.40,"pm25_doc":998.40,"pm10_doc":998.40,"pm1_swap":3.90,"pm25_swap":3.90,"pm10_swap":3.90}}}

## Additional observed RAW frames (captured later)

### RAW 0x11 – len 16
81 11 00 00 39 00 39 00 39 00 27 00 50 00 50 FC

### RAW 0x11 – len 16
81 11 00 00 36 00 37 00 37 00 23 00 38 00 38 37

### RAW 0x17 (FW) – len 6
81 17 00 10 46 12

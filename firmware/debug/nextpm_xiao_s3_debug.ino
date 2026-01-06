/*
  ESP32 + NextPM (UART Simple Protocol) — FW DEBUG (API stable)

  V1 candidate — JSON canonique
  PATCH STRICT:
    - UART pins set to XIAO ESP32S3:
        RX = GPIO44 (D7)
        TX = GPIO43 (D6)
    - Keep API/JSON contract stable
    - RAW <cmd_hex> <len> parsing robust

  Immutable commands:
    PING
    FW
    STATE
    TRH
    PM [10S|1M|15M]
    BINS [10S|1M|15M]
    SNAPSHOT [10S|1M|15M]
    RAW <cmd_hex> <len>
*/

#include <Arduino.h>
#include <NimBLEDevice.h>

// ==============================
// CONFIG
// ==============================
static constexpr uint32_t NEXTPM_BAUD = 115200;

// PATCH STRICT: XIAO ESP32S3 exposed UART pins
static constexpr int NEXTPM_RX_PIN = 44; // D7 / GPIO44
static constexpr int NEXTPM_TX_PIN = 43; // D6 / GPIO43

static constexpr uint32_t UART_READ_TOTAL_TIMEOUT_MS = 300;
static constexpr uint32_t UART_INTERBYTE_TIMEOUT_MS  = 50;

static constexpr uint32_t HEARTBEAT_MS = 500;
static constexpr size_t   LINE_BUF_MAX = 512;
static constexpr size_t   BLE_RX_ACCUM_MAX = 1024;
static constexpr size_t   RAW_MAX_LEN = 64; // safety guard

// BLE NUS UUIDs
static const char* NUS_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
static const char* NUS_RX_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";
static const char* NUS_TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e";

// ==============================
// Utilities
// ==============================
static inline uint32_t uptime_ms() { return (uint32_t)millis(); }

static inline uint8_t checksum_simple3(uint8_t addr, uint8_t cmd) {
  uint8_t sum = (uint8_t)(addr + cmd);
  return (uint8_t)(0u - sum);
}

static inline bool checksum_ok(const uint8_t* b, size_t n) {
  uint32_t sum = 0;
  for (size_t i = 0; i < n; i++) sum += b[i];
  return ((sum & 0xFFu) == 0u);
}

static String hex_bytes_upper(const uint8_t* b, size_t n) {
  String s;
  s.reserve(n * 3);
  for (size_t i = 0; i < n; i++) {
    if (i) s += ' ';
    if (b[i] < 16) s += '0';
    String h = String(b[i], HEX);
    h.toUpperCase();
    s += h;
  }
  return s;
}

static String json_escape(const String& in) {
  String out;
  out.reserve(in.length() + 8);
  for (size_t i = 0; i < in.length(); i++) {
    char c = in[i];
    switch (c) {
      case '\\': out += "\\\\"; break;
      case '"':  out += "\\\""; break;
      case '\n': out += "\\n";  break;
      case '\r': out += "\\r";  break;
      case '\t': out += "\\t";  break;
      default:   out += c;      break;
    }
  }
  return out;
}

static bool is_space(char c) { return c == ' ' || c == '\t'; }

static void trim_inplace(String& s) {
  int start = 0;
  while (start < (int)s.length() && is_space(s[start])) start++;
  int end = (int)s.length() - 1;
  while (end >= start && is_space(s[end])) end--;
  if (start == 0 && end == (int)s.length() - 1) return;
  s = (end >= start) ? s.substring(start, end + 1) : String("");
}

static void split2(const String& s, String& a, String& b) {
  int i = 0;
  while (i < (int)s.length() && is_space(s[i])) i++;
  int j = i;
  while (j < (int)s.length() && !is_space(s[j])) j++;
  a = (j > i) ? s.substring(i, j) : String("");
  while (j < (int)s.length() && is_space(s[j])) j++;
  b = (j < (int)s.length()) ? s.substring(j) : String("");
}

// ==============================
// Output (USB + BLE)
// ==============================
struct Out {
  NimBLECharacteristic* nusTx = nullptr;

  void printLine(const String& s) {
    Serial.println(s);
    if (nusTx) {
      const size_t mtuSafe = 180;
      size_t off = 0;
      while (off < s.length()) {
        String chunk = s.substring(off, min(off + mtuSafe, s.length()));
        nusTx->setValue((uint8_t*)chunk.c_str(), chunk.length());
        nusTx->notify();
        off += chunk.length();
        delay(2);
      }
      const char nl = '\n';
      nusTx->setValue((uint8_t*)&nl, 1);
      nusTx->notify();
    }
  }
};

static Out g_out;

// ==============================
// NextPM driver (Simple Protocol)
// ==============================
class NextPM {
public:
  explicit NextPM(HardwareSerial& s) : uart(s) {}

  void begin() {
    uart.begin(NEXTPM_BAUD, SERIAL_8E1, NEXTPM_RX_PIN, NEXTPM_TX_PIN);
    flush();
  }

  void flush() {
    while (uart.available()) (void)uart.read();
  }

  void send_cmd(uint8_t cmd) {
    uint8_t tx[3] = { 0x81, cmd, checksum_simple3(0x81, cmd) };
    uart.write(tx, 3);
    uart.flush();
  }

  bool read_exact(uint8_t* rx, size_t n, uint32_t totalTimeoutMs = UART_READ_TOTAL_TIMEOUT_MS) {
    const uint32_t t0 = millis();
    size_t got = 0;
    uint32_t lastByteMs = millis();

    while (got < n) {
      if (uart.available()) {
        int c = uart.read();
        if (c >= 0) {
          rx[got++] = (uint8_t)c;
          lastByteMs = millis();
        }
      } else {
        uint32_t now = millis();
        if ((now - t0) > totalTimeoutMs) return false;
        if (got > 0 && (now - lastByteMs) > UART_INTERBYTE_TIMEOUT_MS) return false;
        delay(1);
      }
    }
    return true;
  }

  bool raw(uint8_t cmd, uint8_t* rx, size_t len) {
    flush();
    send_cmd(cmd);
    return read_exact(rx, len);
  }

  bool fw(uint8_t* rx6)    { return raw(0x17, rx6, 6); }
  bool state(uint8_t* rx4) { return raw(0x16, rx4, 4); }
  bool trh(uint8_t* rx8)   { return raw(0x14, rx8, 8); }
  bool pm(uint8_t* rx16)   { return raw(0x11, rx16, 16); }

private:
  HardwareSerial& uart;
};

static NextPM g_nextpm(Serial2);

// ==============================
// BLE NUS
// ==============================
static NimBLEServer* g_bleServer = nullptr;
static NimBLECharacteristic* g_nusTx = nullptr;
static NimBLECharacteristic* g_nusRx = nullptr;

static String g_bleRxAccum;

class ServerCB : public NimBLEServerCallbacks {
public:
  void onConnect(NimBLEServer*) {}
  void onDisconnect(NimBLEServer*) {
    NimBLEDevice::startAdvertising();
  }
};

class RxCB : public NimBLECharacteristicCallbacks {
public:
  void onWrite(NimBLECharacteristic* pCharacteristic) {
    std::string v = pCharacteristic->getValue();
    if (v.empty()) return;

    for (char c : v) {
      if (g_bleRxAccum.length() >= BLE_RX_ACCUM_MAX) {
        g_bleRxAccum.remove(0, g_bleRxAccum.length() / 2);
      }
      if (c == '\n' || c == '\r') g_bleRxAccum += '\n';
      else g_bleRxAccum += c;
    }
  }
};

static void ble_init() {
  NimBLEDevice::init("XIAO-NUS");
  NimBLEDevice::setPower(ESP_PWR_LVL_P9);

  g_bleServer = NimBLEDevice::createServer();
  g_bleServer->setCallbacks(new ServerCB());

  NimBLEService* svc = g_bleServer->createService(NUS_SERVICE_UUID);

  g_nusTx = svc->createCharacteristic(NUS_TX_CHAR_UUID, NIMBLE_PROPERTY::NOTIFY);

  g_nusRx = svc->createCharacteristic(
    NUS_RX_CHAR_UUID,
    NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
  );
  g_nusRx->setCallbacks(new RxCB());

  svc->start();

  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(NUS_SERVICE_UUID);
  adv->start();

  g_out.nusTx = g_nusTx;
}

// ==============================
// JSON helpers
// ==============================
static String json_error(const String& code, const String& detail) {
  String s = "{";
  s += "\"info\":\"error\",";
  s += "\"ok\":false,";
  s += "\"ts_ms\":" + String(uptime_ms()) + ",";
  s += "\"error\":\"" + json_escape(code) + "\"";
  if (detail.length()) s += ",\"detail\":\"" + json_escape(detail) + "\"";
  s += "}";
  return s;
}

static String json_info(const String& info) {
  String s = "{";
  s += "\"info\":\"" + json_escape(info) + "\",";
  s += "\"ok\":true,";
  s += "\"ts_ms\":" + String(uptime_ms());
  s += "}";
  return s;
}

static String json_raw(const uint8_t* b, size_t n) {
  String s = "{";
  s += "\"info\":\"raw\",";
  s += "\"ok\":true,";
  s += "\"ts_ms\":" + String(uptime_ms()) + ",";
  s += "\"raw\":\"" + hex_bytes_upper(b, n) + "\"";
  s += "}";
  return s;
}

static inline uint16_t u16_doc_LSBMSB(uint8_t lsb, uint8_t msb) {
  return (uint16_t)((uint16_t)msb << 8) | (uint16_t)lsb;
}
static inline uint16_t u16_swap_MSBLSB(uint8_t msb, uint8_t lsb) {
  return (uint16_t)((uint16_t)msb << 8) | (uint16_t)lsb;
}

static String json_fw_debug(const uint8_t* rx6) {
  uint8_t state = rx6[2];
  uint16_t fw_doc  = u16_doc_LSBMSB(rx6[3], rx6[4]);
  uint16_t fw_swap = u16_swap_MSBLSB(rx6[3], rx6[4]);

  String s = "{";
  s += "\"info\":\"fw\",";
  s += "\"ok\":true,";
  s += "\"ts_ms\":" + String(uptime_ms()) + ",";
  s += "\"nextpm\":{";
  s += "\"state\":" + String(state) + ",";
  s += "\"fw\":{";
  s += "\"u16_doc\":" + String(fw_doc) + ",";
  s += "\"u16_swap\":" + String(fw_swap);
  s += "},";
  s += "\"chk_ok\":" + String(checksum_ok(rx6, 6) ? "true" : "false");
  s += "}";
  s += "}";
  return s;
}

static String json_state(const uint8_t* rx4) {
  uint8_t state = rx4[2];
  String s = "{";
  s += "\"info\":\"state\",";
  s += "\"ok\":true,";
  s += "\"ts_ms\":" + String(uptime_ms()) + ",";
  s += "\"nextpm\":{";
  s += "\"state\":" + String(state) + ",";
  s += "\"chk_ok\":" + String(checksum_ok(rx4, 4) ? "true" : "false");
  s += "}";
  s += "}";
  return s;
}

static String json_trh_debug(const uint8_t* rx8) {
  uint8_t state = rx8[2];

  uint16_t t_doc  = u16_doc_LSBMSB(rx8[3], rx8[4]);
  uint16_t rh_doc = u16_doc_LSBMSB(rx8[5], rx8[6]);

  uint16_t t_swap  = u16_swap_MSBLSB(rx8[3], rx8[4]);
  uint16_t rh_swap = u16_swap_MSBLSB(rx8[5], rx8[6]);

  float t_doc_c   = (float)t_doc / 100.0f;
  float rh_doc_p  = (float)rh_doc / 100.0f;
  float t_swap_c  = (float)t_swap / 100.0f;
  float rh_swap_p = (float)rh_swap / 100.0f;

  String s = "{";
  s += "\"info\":\"trh\",";
  s += "\"ok\":true,";
  s += "\"ts_ms\":" + String(uptime_ms()) + ",";
  s += "\"nextpm\":{";
  s += "\"state\":" + String(state) + ",";
  s += "\"chk_ok\":" + String(checksum_ok(rx8, 8) ? "true" : "false");
  s += "},";
  s += "\"trh\":{";
  s += "\"t_c_doc\":" + String(t_doc_c, 2) + ",";
  s += "\"rh_pct_doc\":" + String(rh_doc_p, 2) + ",";
  s += "\"t_c_swap\":" + String(t_swap_c, 2) + ",";
  s += "\"rh_pct_swap\":" + String(rh_swap_p, 2);
  s += "}";
  s += "}";
  return s;
}

static String json_pm_debug(const uint8_t* rx16, const String& avg) {
  uint8_t state = rx16[2];

  auto u16_doc_at = [&](int idxLsb) -> uint16_t {
    return u16_doc_LSBMSB(rx16[idxLsb], rx16[idxLsb + 1]);
  };
  auto u16_swap_at = [&](int idx) -> uint16_t {
    return u16_swap_MSBLSB(rx16[idx], rx16[idx + 1]);
  };

  uint16_t pm1_nb_d  = u16_doc_at(3);
  uint16_t pm25_nb_d = u16_doc_at(5);
  uint16_t pm10_nb_d = u16_doc_at(7);
  uint16_t pm1_ug_d  = u16_doc_at(9);
  uint16_t pm25_ug_d = u16_doc_at(11);
  uint16_t pm10_ug_d = u16_doc_at(13);

  uint16_t pm1_nb_s  = u16_swap_at(3);
  uint16_t pm25_nb_s = u16_swap_at(5);
  uint16_t pm10_nb_s = u16_swap_at(7);
  uint16_t pm1_ug_s  = u16_swap_at(9);
  uint16_t pm25_ug_s = u16_swap_at(11);
  uint16_t pm10_ug_s = u16_swap_at(13);

  float pm1_ug_d_f  = (float)pm1_ug_d / 10.0f;
  float pm25_ug_d_f = (float)pm25_ug_d / 10.0f;
  float pm10_ug_d_f = (float)pm10_ug_d / 10.0f;

  float pm1_ug_s_f  = (float)pm1_ug_s / 10.0f;
  float pm25_ug_s_f = (float)pm25_ug_s / 10.0f;
  float pm10_ug_s_f = (float)pm10_ug_s / 10.0f;

  String s = "{";
  s += "\"info\":\"pm\",";
  s += "\"ok\":true,";
  s += "\"ts_ms\":" + String(uptime_ms()) + ",";
  s += "\"avg\":\"" + json_escape(avg) + "\",";
  s += "\"nextpm\":{";
  s += "\"state\":" + String(state) + ",";
  s += "\"chk_ok\":" + String(checksum_ok(rx16, 16) ? "true" : "false");
  s += "},";
  s += "\"pm\":{";
  s += "\"nb_l\":{";
  s += "\"pm1_doc\":" + String(pm1_nb_d) + ",";
  s += "\"pm25_doc\":" + String(pm25_nb_d) + ",";
  s += "\"pm10_doc\":" + String(pm10_nb_d) + ",";
  s += "\"pm1_swap\":" + String(pm1_nb_s) + ",";
  s += "\"pm25_swap\":" + String(pm25_nb_s) + ",";
  s += "\"pm10_swap\":" + String(pm10_nb_s);
  s += "},";
  s += "\"ug_m3\":{";
  s += "\"pm1_doc\":" + String(pm1_ug_d_f, 2) + ",";
  s += "\"pm25_doc\":" + String(pm25_ug_d_f, 2) + ",";
  s += "\"pm10_doc\":" + String(pm10_ug_d_f, 2) + ",";
  s += "\"pm1_swap\":" + String(pm1_ug_s_f, 2) + ",";
  s += "\"pm25_swap\":" + String(pm25_ug_s_f, 2) + ",";
  s += "\"pm10_swap\":" + String(pm10_ug_s_f, 2);
  s += "}";
  s += "}";
  s += "}";
  return s;
}

// ==============================
// RAW parsing
// ==============================
static bool parse_u8_hex_token(const String& tokRaw, uint8_t& out) {
  String tok = tokRaw;
  tok.replace(",", "");
  tok.replace(";", "");
  tok.replace(")", "");
  tok.replace("(", "");
  trim_inplace(tok);
  if (!tok.length()) return false;

  String t = tok;
  t.toUpperCase();
  if (t.startsWith("0X")) t = t.substring(2);

  if (!t.length() || t.length() > 2) return false;

  for (size_t i = 0; i < t.length(); i++) {
    char c = t[i];
    bool ok = (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F');
    if (!ok) return false;
  }

  long v = strtol(t.c_str(), nullptr, 16);
  if (v < 0 || v > 255) return false;
  out = (uint8_t)v;
  return true;
}

static bool parse_len_token(const String& tokRaw, uint16_t& out) {
  String tok = tokRaw;
  tok.replace(",", "");
  tok.replace(";", "");
  tok.replace(")", "");
  tok.replace("(", "");
  trim_inplace(tok);
  if (!tok.length()) return false;

  String t = tok;
  t.toUpperCase();

  int base = 10;
  if (t.startsWith("0X")) { base = 16; t = t.substring(2); }
  if (!t.length()) return false;

  for (size_t i = 0; i < t.length(); i++) {
    char c = t[i];
    if (base == 10) {
      if (!(c >= '0' && c <= '9')) return false;
    } else {
      bool ok = (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F');
      if (!ok) return false;
    }
  }

  long v = strtol(t.c_str(), nullptr, base);
  if (v < 1 || v > (long)RAW_MAX_LEN) return false;
  out = (uint16_t)v;
  return true;
}

// ==============================
// Command handling
// ==============================
static String normalize_avg_token(String tok) {
  tok.toUpperCase();
  trim_inplace(tok);
  if (tok == "10S") return "10s";
  if (tok == "1M")  return "1m";
  if (tok == "15M") return "15m";
  return "";
}

static uint8_t cmd_for_pm_avg(const String& avgNorm) {
  if (avgNorm == "10s") return 0x11;
  if (avgNorm == "1m")  return 0x12;
  if (avgNorm == "15m") return 0x13;
  return 0;
}

static uint8_t cmd_for_bins_avg(const String& avgNorm) {
  if (avgNorm == "10s") return 0x25;
  if (avgNorm == "1m")  return 0x26;
  if (avgNorm == "15m") return 0x27;
  return 0;
}

static void handle_line(String line) {
  trim_inplace(line);
  if (!line.length()) return;

  String cmd, rest;
  split2(line, cmd, rest);
  cmd.toUpperCase();

  if (cmd == "PING") { g_out.printLine(json_info("pong")); return; }

  if (cmd == "HELP") {
    g_out.printLine("{\"info\":\"type HELP\"}");
    g_out.printLine("OK Commands: PING, FW, STATE, TRH, PM [10S|1M|15M], BINS [10S|1M|15M], SNAPSHOT [10S|1M|15M], RAW <cmd_hex> <len>");
    return;
  }

  if (cmd == "RAW") {
    String t1, t2;
    split2(rest, t1, t2);
    trim_inplace(t2);

    uint8_t cmdByte = 0;
    uint16_t len = 0;

    if (!t1.length() || !t2.length()) { g_out.printLine(json_error("raw_bad_args", "expected: RAW <cmd_hex> <len>")); return; }
    if (!parse_u8_hex_token(t1, cmdByte)) { g_out.printLine(json_error("raw_bad_cmd", "cmd_hex must be 1 byte hex")); return; }
    if (!parse_len_token(t2, len)) { g_out.printLine(json_error("raw_bad_len", "len must be 1..64")); return; }

    uint8_t rx[RAW_MAX_LEN];
    if (!g_nextpm.raw(cmdByte, rx, len)) { g_out.printLine(json_error("timeout", "no reply or short reply")); return; }
    g_out.printLine(json_raw(rx, len));
    return;
  }

  if (cmd == "FW") {
    uint8_t rx6[6];
    if (!g_nextpm.fw(rx6)) { g_out.printLine(json_error("timeout", "FW no reply")); return; }
    g_out.printLine(json_fw_debug(rx6));
    return;
  }

  if (cmd == "STATE") {
    uint8_t rx4[4];
    if (!g_nextpm.state(rx4)) { g_out.printLine(json_error("timeout", "STATE no reply")); return; }
    g_out.printLine(json_state(rx4));
    return;
  }

  if (cmd == "TRH") {
    uint8_t rx8[8];
    if (!g_nextpm.trh(rx8)) { g_out.printLine(json_error("timeout", "TRH no reply")); return; }
    g_out.printLine(json_trh_debug(rx8));
    return;
  }

  if (cmd == "PM") {
    String avgTok = rest; trim_inplace(avgTok);
    if (!avgTok.length()) avgTok = "10S";
    String avgNorm = normalize_avg_token(avgTok);
    if (!avgNorm.length()) { g_out.printLine(json_error("bad_args", "PM expects [10S|1M|15M]")); return; }

    uint8_t c = cmd_for_pm_avg(avgNorm);
    uint8_t rx16[16];
    if (!g_nextpm.raw(c, rx16, 16)) { g_out.printLine(json_error("timeout", "PM no reply")); return; }
    g_out.printLine(json_pm_debug(rx16, avgNorm));
    return;
  }

  if (cmd == "BINS") {
    String avgTok = rest; trim_inplace(avgTok);
    if (!avgTok.length()) avgTok = "10S";
    String avgNorm = normalize_avg_token(avgTok);
    if (!avgNorm.length()) { g_out.printLine(json_error("bad_args", "BINS expects [10S|1M|15M]")); return; }

    uint8_t c = cmd_for_bins_avg(avgNorm);
    uint8_t rx23[23];
    if (!g_nextpm.raw(c, rx23, 23)) { g_out.printLine(json_error("timeout", "BINS no reply")); return; }

    String s = "{";
    s += "\"info\":\"bins\",";
    s += "\"ok\":true,";
    s += "\"ts_ms\":" + String(uptime_ms()) + ",";
    s += "\"avg\":\"" + avgNorm + "\",";
    s += "\"raw\":\"" + hex_bytes_upper(rx23, 23) + "\",";
    s += "\"chk_ok\":" + String(checksum_ok(rx23, 23) ? "true" : "false");
    s += "}";
    g_out.printLine(s);
    return;
  }

  if (cmd == "SNAPSHOT") {
    String avgTok = rest; trim_inplace(avgTok);
    if (!avgTok.length()) avgTok = "10S";
    String avgNorm = normalize_avg_token(avgTok);
    if (!avgNorm.length()) { g_out.printLine(json_error("bad_args", "SNAPSHOT expects [10S|1M|15M]")); return; }

    uint8_t rx6[6], rx4[4], rx8[8], rx16[16], rx23[23];
    bool ok_fw = g_nextpm.fw(rx6);
    bool ok_st = g_nextpm.state(rx4);
    bool ok_tr = g_nextpm.trh(rx8);

    uint8_t cpm = cmd_for_pm_avg(avgNorm);
    uint8_t cbi = cmd_for_bins_avg(avgNorm);
    bool ok_pm = g_nextpm.raw(cpm, rx16, 16);
    bool ok_bi = g_nextpm.raw(cbi, rx23, 23);

    String s = "{";
    s += "\"info\":\"snapshot\",";
    s += "\"ok\":true,";
    s += "\"ts_ms\":" + String(uptime_ms()) + ",";
    s += "\"avg\":\"" + avgNorm + "\",";
    s += "\"parts\":{";
    s += "\"fw\":" + String(ok_fw ? "true" : "false") + ",";
    s += "\"state\":" + String(ok_st ? "true" : "false") + ",";
    s += "\"trh\":" + String(ok_tr ? "true" : "false") + ",";
    s += "\"pm\":" + String(ok_pm ? "true" : "false") + ",";
    s += "\"bins\":" + String(ok_bi ? "true" : "false");
    s += "}";

    if (ok_fw) s += ",\"fw_raw\":\"" + hex_bytes_upper(rx6, 6) + "\"";
    if (ok_st) s += ",\"state_raw\":\"" + hex_bytes_upper(rx4, 4) + "\"";
    if (ok_tr) s += ",\"trh_raw\":\"" + hex_bytes_upper(rx8, 8) + "\"";
    if (ok_pm) s += ",\"pm_raw\":\"" + hex_bytes_upper(rx16, 16) + "\"";
    if (ok_bi) s += ",\"bins_raw\":\"" + hex_bytes_upper(rx23, 23) + "\"";

    s += "}";
    g_out.printLine(s);
    return;
  }

  g_out.printLine(json_error("unknown_cmd", "type HELP"));
}

// ==============================
// Input processing (USB + BLE)
// ==============================
static String g_usbLine;
static void process_usb() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\r') continue;
    if (c == '\n') {
      String line = g_usbLine;
      g_usbLine = "";
      if (line.length() > 0) handle_line(line);
    } else {
      if (g_usbLine.length() < LINE_BUF_MAX) g_usbLine += c;
    }
  }
}

static void process_ble() {
  int idx;
  while ((idx = g_bleRxAccum.indexOf('\n')) >= 0) {
    String line = g_bleRxAccum.substring(0, idx);
    g_bleRxAccum.remove(0, idx + 1);
    trim_inplace(line);
    if (line.length() > 0) handle_line(line);
  }
}

// ==============================
// Setup / Loop
// ==============================
static uint32_t g_lastHeartbeat = 0;

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  Serial.begin(115200);
  delay(200);

  g_nextpm.begin();
  ble_init();

  g_out.printLine("READY");
  g_out.printLine("{\"info\":\"type HELP\"}");
}

void loop() {
  uint32_t now = millis();
  if (now - g_lastHeartbeat >= HEARTBEAT_MS) {
    g_lastHeartbeat = now;
    digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN));
  }
  process_usb();
  process_ble();
}

#include <ArduinoBLE.h>

const int ecg = P0_28;
const int sdn = P0_06;
const int lop = P0_29;
const int lon = P0_03;
const uint32_t dt = 4000;

BLEService svc("7e570001-7e57-4e57-8e57-7e577e577e57");
BLECharacteristic dat("7e570002-7e57-4e57-8e57-7e577e577e57", BLERead | BLENotify, 7);

uint32_t t;
uint32_t n;

void setup() {
  pinMode(sdn, OUTPUT);
  digitalWrite(sdn, HIGH);
  pinMode(lop, INPUT);
  pinMode(lon, INPUT);
  analogReadResolution(12);

  if (!BLE.begin()) {
    digitalWrite(sdn, LOW);
    while (true) {}
  }

  BLE.setLocalName("uECG");
  BLE.setAdvertisedService(svc);
  svc.addCharacteristic(dat);
  BLE.addService(svc);
  BLE.advertise();
  delay(3000);
  t = micros();
}

void loop() {
  BLE.poll();
  uint32_t now = micros();
  uint32_t slots = (now - t) / dt;
  if (!slots) return;

  t += slots * dt;
  n += slots;
  if (!BLE.connected()) return;

  uint16_t v = analogRead(ecg);
  uint8_t p[7] = {
    uint8_t(n), uint8_t(n >> 8), uint8_t(n >> 16), uint8_t(n >> 24),
    uint8_t(v), uint8_t(v >> 8),
    uint8_t((digitalRead(lop) ? 1 : 0) | (digitalRead(lon) ? 2 : 0))
  };
  dat.writeValue(p, sizeof(p));
}

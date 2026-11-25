# uECG routing and signal-integrity check

## Result

The newly saved board includes the USB receptacle and U5's exposed-pad ground via. Those two findings from the previous review are withdrawn. A USB-C D_N connection still appears incomplete, and USB impedance settings and return-path routing need attention before signoff.

This is a read-only review of the current `uECG.PcbDoc`, supported by `Sheet1.SchDoc`. No routing or rules were changed. Inspection used the existing `journal/tools/pcb.mjs` binary parser and direct reads of Altium's saved component, rule, differential-pair, and stackup records. It is not an Altium connectivity signoff, field-solver simulation, or measured eye/noise test. Unsaved editor changes are outside this review.

Source SHA-256: `371d0469477259ec70dd0d4d96ba9ae52915631e94886df0de63603f68743bf3`. Rechecked after the user's save, file size 4,369,920 bytes.

Coordinates below are absolute Altium coordinates in mil, X/Y, not distances from the board edge.

## Findings, in priority order

### 1. Cleared: U5 has an exposed-pad ground via

The new saved file contains a GND via at `(2070,2333.96)`, inside U5's exposed pad 21, and ground tracks into the pad. The earlier missing-via finding does not apply to this revision. Native connectivity checks should still confirm plane connections and bypass returns.

### 2. High: USB-C B7 D_N appears disconnected from A7 D_N

The receptacle is now present as component `*`, with footprint `USB_C_Receptacle_HRO_TYPE-C-31-M-12`. Its A6/B6 pads are assigned D_P and A7/B7 pads are assigned D_N. The earlier missing-connector finding is withdrawn.

However, B7 at `(2342.75,2152.47)` has only a short D_N track ending near `(2313.47,2152.69)`. I found no track joining that branch to A7 at `(2342.75,2191.84)` or to the main D_N route. A7 connects to the PHY route and D2; B7 appears isolated. This could make USB work in only one plug orientation. Confirm in Altium's unrouted-net check, then join the duplicate D_N pins with a short route. D_P has a visible routed connection between its duplicate pads. Also assign the connector a proper designator and check schematic synchronization.

### 3. Medium: USB impedance profile is set to the wrong nominal value

The saved differential-pair profile is `D100`, targeting **100 ohms**, with a saved calculated value of **107.684 ohms** on both outer layers. Its geometry is approximately 4.098 mil width and 5.918 mil edge gap. The main routed bottom-layer pair uses approximately this geometry. USB's nominal differential impedance is **90 ohms**.

The active stack is Top / GND plane / GND plane / Bottom, with approximately 3.913 mil outer dielectrics, dielectric constant 4.1, 1.378 mil outer copper, and a 49.803 mil core. These are design-file values, not a confirmed fabricator stackup.

Replace the profile with a fabricator-validated 90-ohm differential profile and update the routing geometry. The saved 107.684-ohm value is a cached CAD calculation, not a measured impedance. This is an nRF52840 full-speed USB design, so the short route makes this less urgent than connectivity and grounding. It is not evidence that USB will necessarily fail. Do not add external series resistors by default; Nordic states that termination is integrated into the PHY.

### 4. Medium: USB layer transition lacks a nearby return-path via

`D_P` changes layers at `(2387.32,2172.16)` and `D_N` at `(2378,2194)`. Their nearest explicit GND via is approximately **3.72 mm** and **4.32 mm** away, respectively. The signals change reference from one internal GND plane to the other across the thick core.

Add ground stitching beside the signal-via pair, connecting both reference planes. Keep the signal transitions and connector/ESD breakout compact and symmetric. Equal signal-via count is already a positive feature: each net has one explicit transition via. Grounded through-hole pads may provide additional plane connections, but they do not remove the need for a short local return path here.

### 5. Medium: ECG electrode meanders add unnecessary pickup area

`NetJ3_1`, `NetJ3_2`, and `NetJ3_3` contain repeated serpentine turns between J3 at Y=1989 and the input resistor area near Y=2200. Their approximate total track-plus-arc lengths are 9.83, 9.09, and 9.63 mm.

For ECG, preserving input symmetry and low parasitic pickup matters more than matching propagation delays. Shorten these routes, especially the two measurement inputs, and preserve symmetry relative to their protection/bias components. Do not add delay-matching meanders to the driven-electrode route merely to match the inputs. AD8232 guidance recommends short high-impedance connections, symmetrical input traces, and a ground plane for noise rejection.

`A0` and `REFOUT` also have about 18.37 and 18.74 mm of total routed copper, including branches. Review their branches for shorter placement and separation from USB and radio activity. These totals are not individual source-to-load path lengths and do not prove a noise-budget failure. `SW` is the AD8232 switch node, not a switching-regulator output.

### 6. High verification gap: the existing DRC report does not check SI

`Project Outputs for uECG/Design Rule Check - uECG.drc` refers to history version 558, not the current saved board. It reports only an unrouted-net check and a global matched-length check. Its zero-unrouted result cannot clear the current connectivity findings.

The saved matched-length rule applies to `All` with a **25.4 mm tolerance**, comparing unrelated signals and power nets. It does not establish useful intra-pair USB skew control. The differential-pair rule permits **12.7 mm uncoupled length**, which is loose relative to this board's USB route.

Replace the board-wide matching requirement with a scoped USB intra-pair rule. Set the uncoupled allowance for the actual connector and PHY breakout, rather than keeping the broad default. Then run current unrouted, short-circuit, clearance, differential-pair, and return-path checks.

## Measurements and limits

| Item | Saved-board observation |
|---|---|
| USB pair definition | `D`, positive `D_P`, negative `D_N` |
| D_P total straight-track copper | About 20.20 mm across both outer layers |
| D_N total straight-track copper | About 17.83 mm across both outer layers |
| USB signal vias | One per net |
| Adjacent reference planes | Both assigned GND in saved plane polygons |
| I2C | Short bottom-layer routes between U4 and U3, with pull-ups R10/R11 |

USB totals include branches. Their difference is **not** a valid pin-to-pin skew measurement. Measure actual endpoint paths after resolving the duplicate-pin connectivity. No evidence here justifies adding length-tuning meanders. I2C edge quality still needs a rise-time check at the intended bus speed and loading; no termination change is proposed from routing alone.

Plane assignments are favorable, but the binary reconstruction does not prove poured-plane continuity around every antipad, split, or keepout. Inspect that in Altium. The HJ-840 antenna keepout also needs verification against the module vendor's layout requirements before RF signoff.

## Recommended closure sequence

1. Confirm and resolve the apparent B7-to-A7 D_N open, assign the connector a designator, and check PCB/schematic synchronization.
2. Repour and run a fresh full Altium DRC on the current board.
3. Add local ground stitching at USB transitions and direct ground returns at bypass/ESD components.
4. Validate the physical stackup with the fabricator and change USB to a 90-ohm profile.
5. Shorten electrode meanders and unnecessary analog branches. Scope matching rules to signals that need them.
6. On hardware, check USB full-speed signaling and sustained transfers. Measure ECG noise with representative electrode impedances during USB traffic, radio transmission, and charging, using a safe isolated test setup rather than a person connected to a non-isolated USB host.

## References

- [AD8232 data sheet, layout recommendations and RFI guidance](https://www.analog.com/media/en/technical-documentation/data-sheets/ad8232.pdf).
- [Nordic nRF52840 USB impedance and integrated termination guidance](https://devzone.nordicsemi.com/f/nordic-q-a/82014/nrf52840-usb-d-d--impedance-matching).
- [TI USB layout basics, impedance and reference-plane guidance](https://www.ti.com/content/dam/videos/external-videos/en-us/4/3816841626001/6087491555001.mp4/subassets/usb_layout_basics.pdf).

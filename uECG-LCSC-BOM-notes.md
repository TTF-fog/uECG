# LCSC BOM for one uECG board

The [BOM](uECG-LCSC-BOM.csv) covers one board and assumes no parts on hand. LCSC prices and stock were checked on 2026-11-23. Order quantities include LCSC minimums and multiples, so many rows include spare parts. The estimated total is $40.6433, including $9 shipping and an estimated $0.0145 for R26, which is out of stock. It excludes taxes, PCB fabrication, assembly and other project items.

The JLC library column is a JLCPCB classification, not an LCSC pricing tier. Basic and preferred parts were favored where their listed value, tolerance, voltage, power, dielectric and package matched. JLCPCB assembly minimums, fees and stock can differ from LCSC's. Obtain a JLCPCB quote rather than using these LCSC order quantities as an assembly quote.

## Before ordering

- **R26 is unresolved.** The original 332k, 1%, 1/3 W, 0603 part is out of stock. LCSC C23139 is an in-stock 332k, 1%, 0603 alternative rated at only 100 mW. Do not substitute it until the circuit's worst-case dissipation, working voltage, transients and temperature derating are checked. The BOM includes an estimated price for the original part, not a confirmed order price.
- **USB-C is U7.** Check the specified C165948 footprint and orientation against the board.
- J1 and J3 use the original Molex part numbers. Check footprint, orientation and cable clearance against the [Molex drawing](https://www.molex.com/content/dam/molex/molex-dot-com/products/automated/en-us/salesdrawingpdf/705/70553/705530002_sd.pdf?inline=). Mating cable connectors are not included.
- C7 is a same-value, same-size, same-voltage X5R substitution. Check its effective capacitance under DC bias against the original and the circuit requirements. The same check is prudent for other high-capacitance 0402 capacitors.
- The four test points are copper pads and do not require purchased components.

## ECG front end

U5 uses AD8232ACPZ-R7 instead of the out-of-stock AD8232ACPZ-WP. [Analog Devices' ordering table](https://www.analog.com/cn/products/ad8232/sample-buy.html) lists both as 20-lead 4 x 4 mm LFCSP with exposed pad and -40 to 85 C range. R7 is supplied on a reel and WP in a waffle pack. The device and package match, subject to the existing PCB footprint being correct.

This BOM only covers parts present in the source CSV. It does not include electrodes, battery, enclosure, cables or any other items absent from that file. It is not evidence of electrical safety or medical-device compliance. Keep a body-connected prototype isolated from mains-connected equipment.

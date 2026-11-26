---
title: "uECG"
github: "https://github.com/TTF-fog/uECG"
description: "a tiny  wireless ECG board"
created_at: "2026-11-03"
total_time: "21h 48m"
---

# November 3, 2026: schematicing [beginning]
<!-- fabricate:entry 2100 -->

## parts selection
- mcu: i chose the esp32c3, but im not _that _sure about it. While it does have a relatively small package size which allows me to skip out on a lot of the difficult parts (trace antenna, matching network etc.) the power-consumption is pretty high for a battery powered device (~100 amps at -15dBm TX for ble) especially when compared to an nRF or other, more modern, wireless mcus
- ldo: ended up selecting the MIC5528 for, yes, a small package. While i did look at other LDOs, they either used nearly 7x the space (SOT-23-5) or were only able to sink around ~250mA


![](https://fabricate.hackclub-assets.com/6049675274a8e4dd56b8a4a4c8eb80be24ed60a800b0bb0078bd9397bb50f6d8/image-png/image.png)
>smol

- imu: LSM6 -- not much to say here, practically the standard for decent, low-cost imus
- battery charging: i took a look at the BQ25100, the same thing the xiao uses, but it can only source 250mA, so i decided to use the 25170, which could provide 800mA
- ecg sensor: this is the main part of the project, and can vary a lot in implementation (from opamp monkeying) to full on cortex-m4 solutions (ambiq moment). I decided to go for the midway area, with my options being the max30003, ads1292 and the good ol' 8232. Both the 1292 and the 30003 had a LOT of extra features i didn't need (like a literal temperature sensor), so i decided to use the 8232 *


## schoomatic



![](https://fabricate.hackclub-assets.com/f88214b7ec2430d608a2e8293c2d43e936d8cab45514e86dd8909c0996ed14f3/image-png/image.png)

![](https://fabricate.hackclub-assets.com/95b10f5bcc8e2da4a4893c0fcab0b650028e0e49e06c919727a189edc2bf9528/image-png/image.png)

## peeceebee

![](https://fabricate.hackclub-assets.com/c8af020252aa40726834ed8ab23e2df7f660990ae9edf3d665c8aafec05cde91/image-png/image.png)

(not actual, layout testing)

*:  literally saw the 8233 rn, which is better AND cheaper. will probably switch -- good thing the pins are the same

**Total time spent: 3h 36m**

# November 4, 2026: [more] schematicing
<!-- fabricate:entry 2136 -->

- swapped out the horizontal usb footprint for a vertical one, which gives me a lot more flexibility for placement. 
![](https://fabricate.hackclub-assets.com/691108397798a4893bbe4fb5d28ef25913e80a3a2da4cd647eb2b6f30952c050/image-png/image.png)
> Did do a bit of fucking around with the holes on the bottom of the footprint, which hopefully shouldnt break anything? they're just mounting holes so worst case i chop them off

![](https://fabricate.hackclub-assets.com/339e6e27b5da08d11fc8b5e448e6cb855b65edc196929c61b10b334eebdf04aa/image-png/image.png)
> the symbols kinda ass ik

other than that, i finished the logical connections for the AD -- there's a high pass and a low pass in this, so it requires some very specific setups (note to self: RECHECK!!)

![](https://fabricate.hackclub-assets.com/b9e926d4c8e7ba28bb60ee1f2625ce9aa7c3b75c96372ed46231f19a78416dec/image-png/image.png)

![](https://fabricate.hackclub-assets.com/fa016bb58d440f417369e516b64e560ac009e17356a5da3d7004aa3da0311eaf/image-png/image.png)

**Total time spent: 2h 24m**

# November 5, 2026: passives
<!-- fabricate:entry 2185 -->

![](https://fabricate.hackclub-assets.com/8e1d1bb402ccff30572465148affe9a59030ed9e21455584b5c6d041c1d3bfb5/image-png/image.png)

bunch of passive updates, nothing else really. also changed the annotations on parts to show their value instead of the MPN

![](https://fabricate.hackclub-assets.com/9fd4f7b0358d4202f224bc86aed868753c0e658d586e2999c504da5762bef1a9/image-png/image.png)

I did add a JST header for the  battery, but its a lot bigger than expected, so i'll probably swap it out for testpads or something

**Total time spent: 48m**

# November 5, 2026 (entry 2): pcb routing
<!-- fabricate:entry 2206 -->

first thing i did was swap out the 1uf cap on the bq (which, i forgot to mention, i switched to the 25175 since it comes in a wcsp package -- not much to note there, it's really simple) to a 0402 instead of 0603. 
Also tied the VOUT pins together on the MIC.

## routing
i mostly messed around with placement here. the biggest part here was the USB-C receptacle. It was, however, vertical so i decided to make a quick outcropping to the right to stick it on.
![](https://fabricate.hackclub-assets.com/2a84b91a124c8ca9ebd64a32d3211303ffa2403768e3d29ecd5f1c886a57d45e/image-png/image.png)
it took a bit of messing around with altium's built in board design tools, but i did get it done fairly easily.

And then i realised (okay i kinda had thought about it already but i went "well i'll figure it out") that this would require me to route across the entire board basically for the data lines
![](https://fabricate.hackclub-assets.com/027de44a734ad8cd5ade4b0f6f16b72e311d1d28f21a6b87566e4b17661b9931/image-png/image.png)

> that's not very fun

![](https://fabricate.hackclub-assets.com/acb49b3ac23863f988c5e51ebb1f3c5419e37c3b565391ea5f22d57c97fe78c6/image-png/image.png)
> swapped!

this was a lot easier to route, and that was it!

## 3d views
![](https://fabricate.hackclub-assets.com/5f6fae58a5209aa3103939a73d04414c267e8741b99d5f657c8e6a00aa495af2/image-png/image.png)
> front
![](https://fabricate.hackclub-assets.com/48803ce2d4579a7dfa56dbf4941f0630fef4c184006af2acc3664d2623d5eefa/image-png/image.png)


> back

note 2:

forgot to mention also routed the imu
![](https://fabricate.hackclub-assets.com/d40e49bd3bb9068ffaed816d711e025927b0a1ebadb9c7ca7189d82dfeeb4107/image-png/image.png)

note 3:

the ad8233 is out of question since it has a 0.4 pitch and would 100% require microvias which probably ultragigapentuples the cost

**Total time spent: 3h 30m**

# November 6, 2026: schematic fixes!
<!-- fabricate:entry 2267 -->

quick rapid fire round since i did a cleanup:
![](https://fabricate.hackclub-assets.com/5b72fb6713ee7334f8b309e56d1e0141d140ba97331033ab34c8a43d1f3851ca/image-png/image.png)

>  untied the +IN & -IN nets for the AD
>  added a missing 10M resistor b/w HPSENSE & IOUT
>  added a missing 4.7uF cap b/w IAOUT & SW
> added a 2.54mm header for +IN -IN (note to self: add RLD breakout)

flipped SDA & SCL
![](https://fabricate.hackclub-assets.com/ba5b817b291eff0ea6a3880f8195668a49a26ed0b64d22c6b0dc258085d17831/image-png/image.png)


![](https://fabricate.hackclub-assets.com/b0b22b18bdfb2ef3ff7ae62d910571d2801cee549a007a8c5f5e964a2b75d930/image-png/image.png)

swapped the C3-mini  for the C6-mini (<half the active TX current)
used the BQ25185 instead of the 175 which had a charging voltage of 4.35 volts (meant for LiHV cells)
added testpoints for UART0

**Total time spent: 1h 6m**

# November 21, 2026: indecision.exe
<!-- fabricate:entry 3583 -->

i routed the pcb!!! 
![](https://fabricate.hackclub-assets.com/116782806e645dbf95a879923d50f1086cbd31dd36e1a49d7b24e6af4cd2596e/image-png/image.png)
![](https://fabricate.hackclub-assets.com/4a94b69329f514c41620a45b3e53abc329830abe970d7cf8bd00172f844af99b/image-png/image.png)


or well, i actually havn't, as of two minutes ago. See, i decided that the C6 was kinda _chuddy_ -- it takes 7 uA at sleep and ~189 mA (peak @ 8.0 dBm) for TX transmit which isn't really that good... SO! i decided to switch to a completely different chip! dumb? yes. am i still going to do it? also yes. I took a look at modules from LCSC, since they just make more sense on every count vs. the soc.

I took a look at a few, finally settling down on either the BMD-340 or the HJ-840. The end choice was the HJ-840, since it was ~2$ cheaper, much smaller (6.2x7mm vs nearly 11x11mm) [note: comparing to our previous chip, 2uA sleep, 14.8mA @ 8.0dBm]
(also it had a really nice datasheet - 10/10)
![](https://fabricate.hackclub-assets.com/750aef7588af1155a72dfebd170223b029c33edac125efd412b9696939ec8e62/image-png/image.png)

rewiring this was really easy, after i got 6.2 (using usesprocket.dev my goat :100: [not sponsored trust] ) to remake the symbol.
![](https://fabricate.hackclub-assets.com/a52e75fb51246315d3a51a54feaee43a8e5bbb6617d5c24f4947732fa39ba298/image-png/image.png)

some notes:
- used the internal antenna by tying ANT + BOARD_ANT
- lp mode

**Total time spent: 5h 36m**

# November 25, 2026: weesa done routingsa :)
<!-- fabricate:entry 3891 -->

yep, we're done with the 4th complete revision by my count!
for reference, this is what we started with, 
![](https://fabricate.hackclub-assets.com/e63b8483f01c3597836decddc4e7608a9d8a60d2a2c97e3e2cdcf9278f377c31/image-png/image.png)
![](https://fabricate.hackclub-assets.com/78bc545d693843ed62e680494cf1c409fd179bd6e8668103a0e511e3dfb06a24/image-png/image.png)

![](https://fabricate.hackclub-assets.com/b94d8557fac1ddb3ae2aa87f7056a707a265e077f4a183e52f0bbd0edbe54518/image-png/image.png)

and this is what we've finished with!

![](https://fabricate.hackclub-assets.com/d5dcbe9584b375e7caf11ebfcfd015d8030e6b5f7692d5972d30a1e7719c87e8/image-png/image.png)
![](https://fabricate.hackclub-assets.com/8beff1cc7a720dbe29bce60b13385c2863ee8857ac12160f5cfa2508c95fa710/image-png/image.png)

it's smaller than a xiao (very impressive i know /j) more power efficient and probably better in every way.

the biggest improvement i could make with the nRF module was freeing up nearly 80% of our top space -- we previously had the whole thing covered by the C6, which forced me to ration space on the bottom. with the extra area, i could shift the AD to the bottom layer, allowing me to shorted the return traces a lot, and even length tune them (not that required but still fun)

![](https://fabricate.hackclub-assets.com/a20cbb813f280b1174fa72f8e25af75478d5e542bb68fa2c482310299e6edb0e/image-png/image.png)
> less messy routing yay!

now all i have left is DRC, which will be it's own unique PITA -- alth im pretty sure at least one of my rules are wayyy overtuned!
![](https://fabricate.hackclub-assets.com/fc20ac9e1b383086c57abf893f193e15fca8a07ee82561fa7fe15ff025260e28/image-png/image.png)

**Total time spent: 4h**

# November 25, 2026 (entry 2): forgot to log this
<!-- fabricate:entry 3892 -->

i also got sol to look through my local history and compose timelapses, so now we have lapse at home:tm:
uh not sure what to put here so maybe this is 150?

![](https://fabricate.hackclub-assets.com/64388a2c5bc2ae080fe87e99fbb655032b067731293acb5f64528bb60d5fd3c1/video-mp4/uECG-PCB-timelapse.mp4)
![](https://fabricate.hackclub-assets.com/a592e16c76cfaf25012d1fefe190ac5b6547440826c6079d430dff4a9ca33669/video-mp4/uECG-schematic-timelapse.mp4)

**Total time spent: 6m**

# November 25, 2026 (entry 3): DRC fixes
<!-- fabricate:entry 3898 -->

Not really a lot to note here, but i resolved (nearly) every DRC violation! 
![](https://fabricate.hackclub-assets.com/c79e4b6d24ba4048ff047ecda50dcf957b67874df1a8640a641ac02486512a3c/image-png/image.png)

As i had mentioned in my previous devlog, the rules did end up being overtuned. lowering my solder mask sliver to 0.1mm (JLC constraint) from 2.54 cleared nearly 70% of my violations. After that, twas just a matter of hunting down individual issues and repositioning things. The only stuff i left was -
- two vias complaining about thermal dissipation (they're tiny, not really doing much)
- and ~~one 0.994 < 0.1mm solder mask violation (couldn't fix it)~~

 

![](https://fabricate.hackclub-assets.com/9f641d9e4db8811c12e284136768b8090761ba907adea7dd6d325d6328d110eb/image-png/image.png)
>  nvm was looking at wrong track lmao


ZERO !!

![](https://fabricate.hackclub-assets.com/c5baad96b8ae23997c5154f87e05ca38c1069fcb6623aa10314a8602b45429b8/image-png/image.png)

all that's left is some repo prep and i can submit :)

**Total time spent: 42m**

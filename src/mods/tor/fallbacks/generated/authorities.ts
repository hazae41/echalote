import { $run$ } from "@hazae41/saumon"
import { readFile } from "fs/promises"
import { Fallback } from "../fallback.js"

export namespace Authorities {

  export const fallbacks = [
  {
    "id": "1A25C6358DB91342AA51720A5038B72742732498",
    "eid": "qpL/LxLYVEXghU76iG3LsSI/UW7MBpIROZK0AB18560",
    "exit": false,
    "onion": [
      17,
      129,
      54,
      17,
      5,
      72,
      174,
      158,
      223,
      228,
      144,
      144,
      77,
      206,
      212,
      142,
      76,
      225,
      47,
      18,
      5,
      225,
      81,
      110,
      219,
      139,
      60,
      27,
      43,
      28,
      174,
      127
    ],
    "hosts": [
      "128.31.0.39:9201"
    ]
  },
  {
    "id": "24E2F139121D4394C54B5BCC368B3B411857C413",
    "eid": "orTwlvk+pMu2fwEwys/cM8ruVul2dEWTjCxXNBOe09M",
    "exit": false,
    "onion": [
      76,
      111,
      55,
      89,
      92,
      176,
      189,
      88,
      34,
      74,
      86,
      254,
      229,
      215,
      155,
      34,
      89,
      78,
      164,
      246,
      68,
      173,
      25,
      33,
      35,
      168,
      82,
      46,
      187,
      246,
      166,
      53
    ],
    "hosts": [
      "204.13.164.118:443",
      "[2620:13:4000:6000::1000:118]:443"
    ]
  },
  {
    "id": "74A910646BCEEFBCD2E874FC1DC997430F968145",
    "eid": "bHzOT41w56KHh+w6TYwUhN4KrGwPWQWJX04/+tw/+RU",
    "exit": false,
    "onion": [
      83,
      20,
      80,
      98,
      130,
      185,
      64,
      17,
      38,
      133,
      59,
      33,
      152,
      43,
      11,
      149,
      236,
      6,
      136,
      4,
      63,
      40,
      0,
      81,
      243,
      249,
      194,
      87,
      108,
      90,
      89,
      51
    ],
    "hosts": [
      "199.58.81.140:443"
    ]
  },
  {
    "id": "7BE683E65D48141321C5ED92F075C55364AC7123",
    "eid": "9/xFbR9WgxJAjVkqjCd/S/55D1iqbAecfKTeai6v/Eg",
    "exit": false,
    "onion": [
      86,
      14,
      63,
      24,
      19,
      39,
      96,
      233,
      160,
      126,
      159,
      41,
      197,
      246,
      179,
      66,
      216,
      109,
      38,
      89,
      252,
      166,
      111,
      117,
      83,
      123,
      75,
      245,
      193,
      220,
      21,
      108
    ],
    "hosts": [
      "193.23.244.244:443",
      "[2001:678:558:1000::244]:443"
    ]
  },
  {
    "id": "7EA6EAD6FD83083C538F44038BBFA077587DD755",
    "eid": "g/2ajydWM/x16QePc6QXMVcVsaftXbmH4dZUozDhl5E",
    "exit": false,
    "onion": [
      9,
      138,
      203,
      5,
      62,
      176,
      241,
      118,
      192,
      6,
      190,
      106,
      84,
      251,
      145,
      152,
      157,
      121,
      189,
      229,
      110,
      18,
      41,
      43,
      19,
      52,
      251,
      106,
      175,
      230,
      63,
      8
    ],
    "hosts": [
      "45.66.35.11:443"
    ]
  },
  {
    "id": "847B1F850344D7876491A54892F904934E4EB85D",
    "eid": "kXdA5dmIhXblAquMx0M0ApWJJ4JGQGLsjUSn86cbIaU",
    "exit": false,
    "onion": [
      186,
      41,
      165,
      130,
      126,
      181,
      90,
      93,
      25,
      249,
      241,
      193,
      43,
      4,
      91,
      9,
      41,
      98,
      133,
      136,
      171,
      106,
      201,
      251,
      129,
      52,
      127,
      62,
      132,
      180,
      231,
      53
    ],
    "hosts": [
      "86.59.21.38:443",
      "[2001:858:2:2:aabb:0:563b:1526]:443"
    ]
  },
  {
    "id": "BA44A889E64B93FAA2B114E02C2A279A8555C533",
    "eid": "HymdZCakUvsQMKzuBkx9z1yv80GMifRMXyNG6biXrwA",
    "exit": false,
    "onion": [
      103,
      191,
      78,
      184,
      126,
      226,
      139,
      229,
      193,
      222,
      205,
      123,
      39,
      109,
      207,
      45,
      243,
      46,
      54,
      33,
      8,
      230,
      175,
      251,
      47,
      110,
      44,
      133,
      181,
      95,
      253,
      113
    ],
    "hosts": [
      "66.111.2.131:9001",
      "[2610:1c0:0:5::131]:9001"
    ]
  },
  {
    "id": "BD6A829255CB08E66FBE7D3748363586E46B3810",
    "eid": "kIpbo7q9uK2/P1NgHMPf1anOKAKpfl2lelc6DNYv7EQ",
    "exit": false,
    "onion": [
      126,
      163,
      53,
      91,
      22,
      76,
      15,
      165,
      215,
      15,
      165,
      190,
      76,
      244,
      216,
      108,
      13,
      52,
      220,
      109,
      218,
      19,
      142,
      11,
      173,
      221,
      213,
      84,
      247,
      192,
      96,
      122
    ],
    "hosts": [
      "171.25.193.9:80",
      "[2001:67c:289c::9]:80"
    ]
  },
  {
    "id": "F2044413DAC2E02E3D6BCF4735A19BCA1DE97281",
    "eid": "Xca0yFP4KpydoUaIX6YcXbSAPwsuokdnybJoC53C/yM",
    "exit": false,
    "onion": [
      36,
      61,
      8,
      215,
      35,
      27,
      71,
      215,
      106,
      19,
      146,
      254,
      165,
      68,
      84,
      179,
      180,
      215,
      3,
      217,
      45,
      221,
      177,
      79,
      38,
      71,
      108,
      21,
      196,
      175,
      70,
      47
    ],
    "hosts": [
      "131.188.40.189:443",
      "[2001:638:a000:4140::ffff:189]:443"
    ]
  }
]

}
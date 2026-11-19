import type {LevelSource} from './levels';
// Three layouts rebuilt under fixed-head rules; original par/chain targets retained.
export const LEVEL_REPAIRS: Record<string,Omit<LevelSource,'name'>> = {
  "Osaka Loop": {
    "rows": [
      ".III...",
      ".GAF#.s",
      ".CA..#.",
      ".CA.BBB",
      ".....k.",
      "..DDkH.",
      "#sEE.HJ"
    ],
    "axis": {
      "A": "v",
      "B": "h",
      "C": "v",
      "D": "h",
      "E": "h",
      "F": "v",
      "G": "v",
      "H": "v",
      "I": "h",
      "J": "h"
    },
    "head": {
      "A": 1,
      "B": -1,
      "C": -1,
      "D": -1,
      "E": 1,
      "F": -1,
      "G": 1,
      "H": -1,
      "I": 1,
      "J": -1
    }
  },
  "Line 49": {
    "rows": [
      "KKKtH.C",
      "......C",
      ".....G.",
      "...D...",
      "..sJJ.A",
      ".BBB.EA",
      ".....I.",
      "...FF.t"
    ],
    "axis": {
      "A": "v",
      "B": "h",
      "C": "v",
      "D": "v",
      "E": "v",
      "F": "h",
      "G": "v",
      "H": "h",
      "I": "v",
      "J": "h",
      "K": "h"
    },
    "head": {
      "A": -1,
      "B": 1,
      "C": -1,
      "D": -1,
      "E": -1,
      "F": -1,
      "G": 1,
      "H": 1,
      "I": -1,
      "J": 1,
      "K": -1
    }
  },
  "Line 88": {
    "rows": [
      "C......D",
      "BB.J....",
      "..sJ.K..",
      "A..JMKm.",
      "..s.G...",
      "k...#s.F",
      "....HHHF",
      ".....tII",
      "L....EEE"
    ],
    "axis": {
      "A": "v",
      "B": "h",
      "C": "h",
      "D": "v",
      "E": "h",
      "F": "v",
      "G": "v",
      "H": "h",
      "I": "h",
      "J": "v",
      "K": "v",
      "L": "v",
      "M": "v"
    },
    "head": {
      "A": 1,
      "B": -1,
      "C": 1,
      "D": 1,
      "E": -1,
      "F": 1,
      "G": -1,
      "H": -1,
      "I": 1,
      "J": 1,
      "K": -1,
      "L": -1,
      "M": -1
    }
  }
};

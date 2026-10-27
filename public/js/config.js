// Site settings. Edit this file to switch the site from demo mode to live mode.
//
// DEMO MODE (firebase: null)
//   The board comes from data/board.json if it exists, otherwise data/demo-board.json.
//   Messages and video notes are saved on this device only.
//
// LIVE MODE (firebase: { ...your Firebase web config... })
//   Everyone signs in. The board, messages, video notes and files are shared live
//   between TRUCK and SSC. See README.md, "Going live".
export const CONFIG = {
  firebase: null,
  // firebase: {
  //   apiKey: "…",
  //   authDomain: "truck-ssc.firebaseapp.com",
  //   projectId: "truck-ssc",
  //   storageBucket: "truck-ssc.appspot.com",
  //   messagingSenderId: "…",
  //   appId: "…"
  // },

  // Email addresses allowed to open the Admin page (upload board data and files).
  admins: ["brett@truckgloves.com", "brett.keyes72@gmail.com"],

  // Quick-pick names on the "Who are you?" screen.
  people: [
    { name: "Brett", org: "TRUCK" },
    { name: "Mansab", org: "SSC" },
    { name: "Imran", org: "SSC" }
  ],

  // Longest video note, in seconds. Short keeps uploads quick on slow connections.
  maxVideoSeconds: 120,

  // How often (seconds) an open page re-checks the board in demo mode.
  refreshSeconds: 60
};

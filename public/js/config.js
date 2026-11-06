// Site settings. Edit this file to switch the site from demo mode to live mode.
//
// DEMO MODE (set firebase: null)
//   The board comes from data/board.json if it exists, otherwise data/demo-board.json.
//   Messages and video notes are saved on this device only.
//
// LIVE MODE (firebase: { ...your Firebase web config... })
//   Everyone signs in. The board, messages, video notes and files are shared live
//   between TRUCK and SSC. See README.md, "Going live".
export const CONFIG = {
  // Firebase web config for the TRUCK SSC Portal project. These values identify the
  // project to the browser; they are not secrets. Access is controlled by sign-in and
  // by firestore.rules / storage.rules.
  firebase: {
    apiKey: "AIzaSyBMzEM_EuUBoc2Eazlnmr-mffx1Xuc0xmo",
    authDomain: "truck-ssc-portal.firebaseapp.com",
    projectId: "truck-ssc-portal",
    storageBucket: "truck-ssc-portal.firebasestorage.app",
    messagingSenderId: "463148473740",
    appId: "1:463148473740:web:f6ba87f00a973d27950aa9"
  },

  // Email addresses allowed to open the Admin page (upload board data and files).
  admins: ["brett@truckgloves.com", "brett.keyes72@gmail.com"],

  // Quick-pick names on the "Who are you?" screen.
  people: [
    { name: "Brett", org: "TRUCK" },
    { name: "Mansab", org: "SSC" },
    { name: "Seqlain", org: "SSC" }
  ],

  // Public half of the Web Push key pair (the private half is the VAPID_PRIVATE secret).
  vapidKey: "BEzIBFHdwvhMDP5sX-bcLeCD1VX951xF6Pz9eekYf_SehSScoCcRgB9flbbscSw-tq9r7QUAyZj1e7aVz4nVkFg",

  // Folder of TRUCK icons (one SVG per name, e.g. "img/icons/"), or null for the built-in set.
  iconSet: null,

  // Longest video note, in seconds. Short keeps uploads quick on slow connections.
  maxVideoSeconds: 120,

  // How often (seconds) an open page re-checks the board in demo mode.
  refreshSeconds: 60
};

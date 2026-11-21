/* Tiny enhancer shared by every module: scroll reveal + the break-in slider.
   Works on a full page or on a single module dropped into another page. */
(function () {
  var mods = document.querySelectorAll(".tg-mod");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
      });
    }, { threshold: 0.2 });
    mods.forEach(function (m) { io.observe(m); });
  } else {
    mods.forEach(function (m) { m.classList.add("is-in"); });
  }

  document.querySelectorAll("[data-break]").forEach(function (root) {
    var input = root.querySelector("input");
    var out = root.querySelector(".tg-break__readout");
    var path = root.querySelector("[data-break-path]");
    var stops = [
      ["Day one.", "Stiff and a little formal. The leather hasn't learned your hand yet."],
      ["A few outings in.", "Creases settle where your knuckles bend. It starts to move with you."],
      ["Broken in.", "Shaped to your hand. Fingertip feel for clips, zippers and straps, with no bunching to pinch circulation."]
    ];
    function update() {
      var v = +input.value;
      out.innerHTML = "<strong>" + stops[v][0] + "</strong> " + stops[v][1];
      // finger curve relaxes as the leather conforms
      var lift = [0, 14, 26][v];
      if (path) path.setAttribute("d", "M40 150 L40 " + (70 + lift) + " Q40 " + (50 + lift) + " 62 " + (50 + lift) + " Q84 " + (50 + lift) + " 84 " + (70 + lift) + " L84 150");
    }
    input.addEventListener("input", update);
    update();
  });


  // Leather cross-section: draw the fibers in the browser (seeded, so it looks the same every time).
  function drawLeather(svg) {
    var a = 20260217;
    function rnd() { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    function r(lo, hi) { return lo + rnd() * (hi - lo); }
    function f(n) { return Math.round(n); }
    function fiber(x, y, len, maxAng, w, col, op) {
      var ang = r(-maxAng, maxAng) * Math.PI / 180, dx = Math.cos(ang) * len, dy = Math.sin(ang) * len;
      var cx = x + dx / 2 + r(-8, 8), cy = y + dy / 2 + r(-10, 10);
      return '<path d="M' + f(x) + ' ' + f(y) + 'Q' + f(cx) + ' ' + f(cy) + ' ' + f(x + dx) + ' ' + f(y + dy) + '" stroke="' + col + '" stroke-width="' + w.toFixed(1) + '" opacity="' + op.toFixed(1) + '"/>';
    }
    var S = 90, G = 160, B = 380, i, grain = "", fibers = "", links = "", pores = "";
    for (i = 0; i < 190; i++) grain += fiber(r(0, 620), r(S + 8, G - 6), r(18, 40), 22, r(1.4, 2.4), "#e8cf9f", r(.45, .9));
    for (i = 0; i < 52; i++) fibers += fiber(r(-20, 600), r(G + 6, B - 12), r(70, 140), 55, r(2.4, 4), "#c49a68", r(.3, .7));
    for (i = 0; i < 30; i++) links += fiber(r(0, 640), r(G - 30, G + 20), r(40, 70), 80, r(1.6, 2.6), "#d8b684", r(.35, .7));
    for (i = 0; i < 34; i++) { var x = r(10, 630); pores += '<ellipse cx="' + f(x) + '" cy="93" rx="' + f(r(1.2, 2.6)) + '" ry="' + f(r(1, 2)) + '" fill="#14100c"/>'; }
    svg.querySelector(".tg-xs__g--fiber").innerHTML = fibers + links;
    svg.querySelector(".tg-xs__g--grain").innerHTML = grain;
    svg.querySelector(".tg-xs__g--surface").insertAdjacentHTML("afterbegin", pores);
  }

  document.querySelectorAll("[data-xs]").forEach(function (root) {
    var buttons = root.querySelectorAll("[data-layer]");
    var panels = root.querySelectorAll("[data-for]");
    var svg = root.querySelector(".tg-xs");
    drawLeather(svg);
    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        var layer = b.getAttribute("data-layer");
        svg.setAttribute("data-active", layer);
        buttons.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        panels.forEach(function (p) { p.hidden = p.getAttribute("data-for") !== layer; });
      });
    });
  });

  document.querySelectorAll("[data-video]").forEach(function (box) {
    var link = box.querySelector("a");
    link.addEventListener("click", function (e) {
      e.preventDefault();
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + box.getAttribute("data-video") + "?autoplay=1&rel=0";
      f.title = link.getAttribute("aria-label").replace("Play video: ", "");
      f.allow = "autoplay; encrypted-media; picture-in-picture";
      f.allowFullscreen = true;
      box.innerHTML = "";
      box.appendChild(f);
    });
  });
})();

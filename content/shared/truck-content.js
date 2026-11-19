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

  document.querySelectorAll("[data-xs]").forEach(function (root) {
    var buttons = root.querySelectorAll("[data-layer]");
    var panels = root.querySelectorAll("[data-for]");
    var svg = root.querySelector(".tg-xs");
    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        var layer = b.getAttribute("data-layer");
        svg.setAttribute("data-active", layer);
        buttons.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        panels.forEach(function (p) { p.hidden = p.getAttribute("data-for") !== layer; });
      });
    });
  });
})();

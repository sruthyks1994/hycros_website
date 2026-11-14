/* global document */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  /* mobile menu */
  var burger = document.querySelector(".burger");
  var menu = document.getElementById("menu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        menu.classList.remove("open");
        burger.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* screenshots: when a file is missing, show a clearly marked placeholder instead of a broken image */
  function pending(img) {
    var fig = img.closest("figure.shot");
    if (!fig || fig.querySelector(".pendingbox")) return;
    var box = document.createElement("div");
    box.className = "pendingbox";
    box.innerHTML = "<div><b></b>Product screenshot goes here</div>";
    box.querySelector("b").textContent = img.getAttribute("data-name") || "Screenshot";
    img.replaceWith(box);
  }
  document.querySelectorAll("figure.shot img").forEach(function (img) {
    if (img.complete && img.naturalWidth === 0) pending(img);
    img.addEventListener("error", function () {
      pending(img);
    });
  });

  /* product tour tabs (all panels stay visible without JavaScript) */
  var tabs = document.getElementById("tabs");
  if (tabs) {
    var panels = Array.prototype.slice.call(document.querySelectorAll("[data-panel]"));
    var buttons = [];
    var pick = function (i) {
      panels.forEach(function (p, j) {
        p.hidden = j !== i;
      });
      buttons.forEach(function (b, j) {
        b.setAttribute("aria-selected", j === i ? "true" : "false");
        b.tabIndex = j === i ? 0 : -1;
      });
    };
    panels.forEach(function (p, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.textContent = p.getAttribute("data-panel");
      b.addEventListener("click", function () {
        pick(i);
      });
      b.addEventListener("keydown", function (e) {
        var n = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
        if (n === null) return;
        n = (n + panels.length) % panels.length;
        pick(n);
        buttons[n].focus();
      });
      tabs.appendChild(b);
      buttons.push(b);
    });
    pick(0);
  }
})();

/* global document */
(function () {
  "use strict";
  document.documentElement.classList.add("js");

  /* mobile menu */
  var burger = document.querySelector(".burger");
  var menu = document.getElementById("menu");
  if (burger && menu) {
    var close = function () {
      menu.classList.remove("open");
      burger.setAttribute("aria-expanded", "false");
    };
    burger.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("open")) {
        close();
        burger.focus();
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
      b.id = "tab-" + i;
      b.setAttribute("role", "tab");
      b.setAttribute("aria-controls", "panel-" + i);
      b.textContent = p.getAttribute("data-panel");
      p.id = "panel-" + i;
      p.setAttribute("role", "tabpanel");
      p.setAttribute("aria-labelledby", b.id);
      p.tabIndex = 0;
      b.addEventListener("click", function () {
        pick(i);
      });
      b.addEventListener("keydown", function (e) {
        var keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: panels.length - 1 };
        if (!(e.key in keys)) return;
        e.preventDefault();
        var n = (keys[e.key] + panels.length) % panels.length;
        pick(n);
        buttons[n].focus();
      });
      tabs.appendChild(b);
      buttons.push(b);
    });
    pick(0);
  }

  /* cost calculator: the visitor's own figures, worked out in the page (hidden without JavaScript) */
  var calc = document.getElementById("calc");
  if (calc) {
    var field = function (id) {
      return document.getElementById(id);
    };
    var people = field("c-people");
    var hours = field("c-hours");
    var rate = field("c-rate");
    var cost = field("c-cost");
    var time = field("c-time");
    var currency = calc.getAttribute("data-currency") || "";
    var num = function (input) {
      var v = parseFloat(input.value);
      return isFinite(v) && v > 0 ? v : 0;
    };
    var fmt = function (n) {
      return Math.round(n).toLocaleString("en-IN");
    };
    var update = function () {
      var monthlyHours = (num(people) * num(hours) * 52) / 12;
      cost.textContent = currency + fmt(monthlyHours * num(rate));
      time.textContent =
        fmt(monthlyHours) + " working hours a month, about " + fmt(monthlyHours / 8) + " working days";
    };
    [people, hours, rate].forEach(function (input) {
      input.addEventListener("input", update);
    });
    update();
    calc.hidden = false;
  }
})();

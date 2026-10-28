(function () {
  "use strict";

  // ---- Footer year (was @DateTime.Now.Year in the Razor version) ----
  document.querySelectorAll("[data-current-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  // ---- Preloader (Netflix-style logo intro, logo lands in the navbar) ----
  var preloader = document.getElementById("preloader");
  var MIN_PRELOADER_MS = 2300;
  var FLY_MS = 700;
  var loadStart = Date.now();

  function removePreloader() {
    document.body.classList.remove("is-loading");
    if (preloader && preloader.parentNode) preloader.parentNode.removeChild(preloader);
  }

  function flyLogoToNavbar() {
    var logo = preloader.querySelector(".preloader-logo");
    var navLogo = document.querySelector(".navbar .brand img");

    if (!logo || !navLogo) {
      preloader.classList.add("preloader-hide");
      setTimeout(removePreloader, 650);
      return;
    }

    var startRect = logo.getBoundingClientRect();
    var endRect = navLogo.getBoundingClientRect();

    // Fade out the decorative bits + background so the real page shows through.
    preloader.classList.add("preloader-collapse");
    preloader.style.pointerEvents = "none";

    // Hide the real navbar logo until the flying one lands exactly on top of it.
    navLogo.style.transition = "opacity 0.2s ease";
    navLogo.style.opacity = "0";

    // Pin the flying logo at its current on-screen position, then animate it
    // to the navbar logo's position/size.
    logo.style.animation = "none";
    logo.style.opacity = "1";
    logo.style.position = "fixed";
    logo.style.margin = "0";
    logo.style.zIndex = "10000";
    logo.style.left = startRect.left + "px";
    logo.style.top = startRect.top + "px";
    logo.style.width = startRect.width + "px";
    logo.style.height = startRect.height + "px";
    logo.style.transform = "none";

    // Force a reflow so the browser registers the start position before we
    // change it, otherwise the transition below would be skipped.
    void logo.offsetWidth;

    logo.style.transition =
      "left " + FLY_MS + "ms cubic-bezier(0.22,1,0.36,1), " +
      "top " + FLY_MS + "ms cubic-bezier(0.22,1,0.36,1), " +
      "width " + FLY_MS + "ms cubic-bezier(0.22,1,0.36,1), " +
      "height " + FLY_MS + "ms cubic-bezier(0.22,1,0.36,1), " +
      "filter " + FLY_MS + "ms ease";
    logo.style.left = endRect.left + "px";
    logo.style.top = endRect.top + "px";
    logo.style.width = endRect.width + "px";
    logo.style.height = endRect.height + "px";
    logo.style.filter = "none";

    document.body.classList.remove("is-loading");

    setTimeout(function () {
      navLogo.style.opacity = "";
      removePreloader();
    }, FLY_MS + 40);
  }

  function hidePreloader() {
    if (!preloader) {
      document.body.classList.remove("is-loading");
      return;
    }
    var elapsed = Date.now() - loadStart;
    var remaining = Math.max(MIN_PRELOADER_MS - elapsed, 0);
    setTimeout(function () {
      flyLogoToNavbar();
    }, remaining);
  }
  if (document.readyState === "complete") {
    hidePreloader();
  } else {
    window.addEventListener("load", hidePreloader);
    // Safety net in case 'load' is delayed by slow third-party assets
    setTimeout(hidePreloader, 4000);
  }

  // ---- Navbar background on scroll ----
  var navbar = document.querySelector(".navbar");
  function onScroll() {
    if (!navbar) return;
    if (window.scrollY > 40) {
      navbar.classList.add("is-scrolled");
    } else {
      navbar.classList.remove("is-scrolled");
    }
  }
  document.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // ---- Scroll reveal animations ----
  var revealEls = document.querySelectorAll(".reveal, .reveal-pop");
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach(function (el) { observer.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  // ---- Smooth anchor scrolling with sticky-header offset ----
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener("click", function (e) {
      var id = link.getAttribute("href");
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var offset = 84;
      var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: top, behavior: "smooth" });
    });
  });

  // ---- Cycling reviews carousel ----
  var reviewCards = document.querySelectorAll(".review-card");
  var reviewDotsWrap = document.querySelector(".review-dots");
  if (reviewCards.length && reviewDotsWrap) {
    var reviewIndex = 0;
    reviewCards.forEach(function (card, i) {
      if (card.classList.contains("active")) reviewIndex = i;
      var dot = document.createElement("button");
      dot.type = "button";
      dot.className = "dot" + (i === reviewIndex ? " active" : "");
      dot.setAttribute("aria-label", "Avis " + (i + 1));
      dot.addEventListener("click", function () {
        goToReview(i);
        resetReviewTimer();
      });
      reviewDotsWrap.appendChild(dot);
    });
    var reviewDots = reviewDotsWrap.querySelectorAll(".dot");

    function goToReview(next) {
      reviewCards[reviewIndex].classList.remove("active");
      reviewDots[reviewIndex].classList.remove("active");
      reviewIndex = next;
      reviewCards[reviewIndex].classList.add("active");
      reviewDots[reviewIndex].classList.add("active");
    }

    var reviewTimer;
    function startReviewTimer() {
      reviewTimer = setInterval(function () {
        goToReview((reviewIndex + 1) % reviewCards.length);
      }, 4500);
    }
    function resetReviewTimer() {
      clearInterval(reviewTimer);
      startReviewTimer();
    }
    startReviewTimer();
  }

  // ---- Fake download buttons (app not released yet) ----
  var toast = document.getElementById("toast");
  var toastTimer = null;
  // Texte inséré tel quel (textContent), le nom du store en gras.
  function showToast(before, bold, after) {
    if (!toast) return;
    var strong = document.createElement("strong");
    strong.textContent = bold;
    toast.textContent = "";
    toast.append(before, strong, after);
    toast.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.classList.remove("show");
    }, 3200);
  }
  document.querySelectorAll(".fake-download").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var store = btn.getAttribute("data-store") || "l'app";
      showToast("📲 Reçois le lien de téléchargement Medflow pour ", store, " par e-mail ci-dessous.");
      var target = document.querySelector("#cta");
      if (target) {
        var top = target.getBoundingClientRect().top + window.pageYOffset - 84;
        window.scrollTo({ top: top, behavior: "smooth" });
      }
    });
  });

  // ---- Inscription à la beta : ouvre le formulaire Google, e-mail déjà rempli ----
  var FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSdEpZ-ccOVJsfjLocchMHk0lfbyHFD4CEUu-m-9OWHbR3IE6A/viewform";
  var FORM_EMAIL_FIELD = "entry.1480854054";
  var form = document.querySelector(".cta-form");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var input = form.querySelector("input[type='email']");
      var button = form.querySelector("button");
      if (!input || !input.value) return;
      window.open(
        FORM_URL + "?usp=pp_url&" + FORM_EMAIL_FIELD + "=" + encodeURIComponent(input.value),
        "_blank",
        "noopener"
      );
      // Conversion : une inscription commencée (le compteur charge en différé).
      if (window.goatcounter && window.goatcounter.count) {
        window.goatcounter.count({ path: "inscription", title: "Inscription commencée", event: true });
      }
      var original = button.textContent;
      button.textContent = "Inscrit(e) ✓";
      button.style.background = "#ffffff";
      button.style.color = "#0c8f70";
      input.value = "";
      setTimeout(function () {
        button.textContent = original;
        button.style.background = "";
        button.style.color = "";
      }, 2800);
    });
  }

  // ---- Animated counters (stats band) ----
  var counters = document.querySelectorAll("[data-count]");
  if (counters.length && "IntersectionObserver" in window) {
    var counterObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          animateCount(entry.target);
          counterObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach(function (el) { counterObserver.observe(el); });
  }

  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    var suffix = el.getAttribute("data-suffix") || "";
    var duration = 1400;
    var start = null;

    function step(timestamp) {
      if (!start) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      var value = Math.round(eased * target);
      el.textContent = value.toLocaleString("fr-FR") + suffix;
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    }
    window.requestAnimationFrame(step);
  }
})();

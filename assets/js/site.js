(function () {
  "use strict";
  var D = window.CLIPS;
  var M = "assets/media/";
  var RATE = 0.75;
  var SEC = D.sections,
    CL = D.clips;
  var $ = function (s, r) {
    return (r || document).querySelector(s);
  };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
  var CHEV_L =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
    CHEV_R =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>';
  var COLS3 =
    '<div class="cols"><span class="dd">DiffusionDrive</span><span class="mf">MeanFuser</span><span class="fm">FM-Drive (Ours)</span></div>';
  var COLS2 =
    '<div class="cols"><span class="wg">FM-Drive (Ours, with goal)</span><span class="ng">FM-Drive (Ours, w/o goal)</span></div>';
  var LEG =
    '<div class="legend"><span><i style="background:#111"></i>Expert</span><span><i style="background:#3fae6a"></i>Candidates (BEV)</span><span><i style="background:#ef5a45"></i>Executed trajectory</span><span><span class="sw"></span>Other agents</span></div>';
  function rate(v) {
    v.defaultPlaybackRate = RATE;
    v.playbackRate = RATE;
  }
  function tryPlay(v) {
    var p = v.play();
    p && p.catch && p.catch(function () {});
  }

  function lazyVideo(v) {
    rate(v);
    if (!("IntersectionObserver" in window)) {
      v.src = v.dataset.src;
      return;
    }
    new IntersectionObserver(
      function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            if (!v.src) v.src = v.dataset.src;
            if (!reduce) tryPlay(v);
          } else v.pause();
        });
      },
      { rootMargin: "120px" },
    ).observe(v);
  }
  $$("video.lazyvid").forEach(lazyVideo);

  (function () {
    var root = $("#stepper");
    if (!root) return;
    var btns = $$("button", root),
      v = $("video", root),
      t = $("#steptitle"),
      d = $("#stepdesc"),
      box = $("#stepbox");
    t.textContent = btns[0].dataset.title;
    d.textContent = btns[0].dataset.desc;
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        btns.forEach(function (x) {
          x.setAttribute("aria-selected", x === b);
        });
        v.src = b.dataset.src;
        v.poster = b.dataset.poster;
        box.style.setProperty("--ar", b.dataset.ar);
        rate(v);
        t.textContent = b.dataset.title;
        d.textContent = b.dataset.desc;
        tryPlay(v);
      });
    });
  })();

  function fmt(s) {
    s = Math.max(0, s | 0);
    return ((s / 60) | 0) + ":" + ("0" + (s % 60)).slice(-2);
  }
  function Viewer(root) {
    var keys = root.dataset.sections.split(","),
      more = root.dataset.more === "1";
    var cur = 0,
      tabKey = keys[0],
      userPaused = false,
      visible = false,
      started = false;
    var list = function (k) {
      return CL.filter(function (c) {
        return c.s === k && (more ? !c.f : c.f);
      });
    };
    var tabs =
      keys.length > 1
        ? '<div class="chips" role="tablist">' +
          keys
            .map(function (k, i) {
              return (
                '<button role="tab" aria-selected="' +
                (i === 0) +
                '" data-k="' +
                k +
                '">' +
                SEC[k][0] +
                "</button>"
              );
            })
            .join("") +
          '</div><p class="secnote"></p>'
        : "";
    var nc = root.dataset.cols === "2" ? "c2" : "c3";
    root.innerHTML =
      tabs +
      '<div class="glass vwr ' +
      nc +
      '">' +
      (nc === "c2" ? COLS2 : COLS3) +
      '<div class="screen"><img alt="" decoding="async"><video muted loop playsinline preload="none"></video></div>' +
      '<div class="ctl"><button class="pp" aria-label="Play or pause">' +
      PAUSE +
      '</button><input class="seek" type="range" min="0" max="1000" value="0" aria-label="Seek"><span class="tm">0:00</span><button class="spd" aria-label="Playback speed">0.75×</button></div>' +
      LEG +
      '<div class="info"><h3></h3><span class="cnt"></span><p></p></div>' +
      '<div class="car"><button class="nav prev" aria-label="Previous clip">' +
      CHEV_L +
      '</button><div class="strip" role="list"></div><button class="nav next" aria-label="Next clip">' +
      CHEV_R +
      "</button></div></div>";
    var note = $(".secnote", root),
      screen = $(".screen", root),
      img = $("img", root),
      vid = $("video", root),
      pp = $(".pp", root),
      seek = $(".seek", root),
      tm = $(".tm", root),
      spd = $(".spd", root),
      h = $(".info h3", root),
      cnt = $(".cnt", root),
      p = $(".info p", root),
      strip = $(".strip", root);
    var speeds = [0.75, 1, 0.5, 0.25],
      si = 0,
      raf = 0,
      seeking = false;
    rate(vid);
    function tick() {
      cancelAnimationFrame(raf);
      if (!seeking && vid.duration) {
        seek.value = (vid.currentTime / vid.duration) * 1000;
      }
      tm.textContent = fmt(vid.currentTime) + " / " + fmt(vid.duration || 0);
      raf = vid.paused ? 0 : requestAnimationFrame(tick);
    }
    function setIcon() {
      pp.innerHTML = vid.paused ? PLAY : PAUSE;
    }
    function setRate() {
      vid.defaultPlaybackRate = speeds[si];
      vid.playbackRate = speeds[si];
      spd.textContent = (speeds[si] === 1 ? "1" : speeds[si]) + "×";
    }
    function centre() {
      var b = strip.children[cur];
      if (b)
        strip.scrollTo({
          left: b.offsetLeft - (strip.clientWidth - b.offsetWidth) / 2,
          behavior: "smooth",
        });
    }
    function load(i, auto) {
      var L = list(tabKey);
      cur = i;
      var c = L[i];
      if (!c) return;
      h.textContent = c.t;
      p.textContent = c.c;
      cnt.textContent = i + 1 + " / " + L.length;
      if (note) note.textContent = SEC[tabKey][1];
      img.src = M + c.i + ".webp";
      img.alt = c.t;
      screen.classList.remove("live");
      $$(".thumb", strip).forEach(function (b, j) {
        b.setAttribute("aria-current", j === i);
      });
      if (started) {
        vid.src = M + c.i + ".mp4";
        setRate();
        vid.load();
        userPaused = false;
        if (auto !== false && visible) tryPlay(vid);
      }
    }
    function thumbs() {
      strip.innerHTML = list(tabKey)
        .map(function (c, j) {
          return (
            '<button class="thumb" title="' +
            c.t +
            '" aria-label="' +
            c.t +
            '" role="listitem" data-j="' +
            j +
            '" aria-current="' +
            (j === cur) +
            '"><img loading="lazy" decoding="async" width="176" height="176" alt="" src="' +
            M +
            c.i +
            '-s.webp"></button>'
          );
        })
        .join("");
    }
    function go(i) {
      var n = list(tabKey).length;
      if (n) {
        load((i + n) % n);
        centre();
      }
    }
    strip.addEventListener("click", function (e) {
      var b = e.target.closest(".thumb");
      if (b) {
        load(+b.dataset.j);
        centre();
      }
    });
    $(".prev", root).addEventListener("click", function () {
      go(cur - 1);
    });
    $(".next", root).addEventListener("click", function () {
      go(cur + 1);
    });
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[role=tab]");
      if (!b) return;
      tabKey = b.dataset.k;
      $$("[role=tab]", root).forEach(function (x) {
        x.setAttribute("aria-selected", x === b);
      });
      thumbs();
      strip.scrollLeft = 0;
      load(0);
    });
    vid.addEventListener("playing", function () {
      screen.classList.add("live");
      setIcon();
      if (!raf) raf = requestAnimationFrame(tick);
    });
    vid.addEventListener("pause", setIcon);
    vid.addEventListener("loadedmetadata", tick);
    function toggle() {
      if (vid.paused) {
        userPaused = false;
        tryPlay(vid);
      } else {
        userPaused = true;
        vid.pause();
      }
    }
    function ensure() {
      if (!started) {
        started = true;
        vid.src = M + list(tabKey)[cur].i + ".mp4";
        setRate();
        userPaused = false;
      }
    }
    pp.addEventListener("click", function () {
      ensure();
      toggle();
    });
    screen.addEventListener("click", function () {
      ensure();
      toggle();
    });
    spd.addEventListener("click", function () {
      si = (si + 1) % speeds.length;
      setRate();
    });
    seek.addEventListener("input", function () {
      seeking = true;
      if (vid.duration) vid.currentTime = (seek.value / 1000) * vid.duration;
      tick();
    });
    seek.addEventListener("change", function () {
      seeking = false;
    });
    thumbs();
    load(0, false);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        function (es) {
          es.forEach(function (e) {
            visible = e.isIntersecting;
            if (visible) {
              ensure();
              if (!userPaused && !reduce) tryPlay(vid);
            } else vid.pause();
          });
        },
        { threshold: 0.25 },
      ).observe(screen);
    }
  }

  $$(".viewer").forEach(function (v) {
    if (!v.closest("details.acc")) Viewer(v);
  });
  $$("details.acc").forEach(function (d) {
    var v = $(".viewer", d),
      init = function () {
        if (d.open && !d.dataset.ready) {
          d.dataset.ready = 1;
          Viewer(v);
        }
      };
    d.addEventListener("toggle", init);
    init();
  });
  $$("[data-acc]").forEach(function (b) {
    b.addEventListener("click", function () {
      var o = b.dataset.acc === "open";
      $$("details.acc").forEach(function (d) {
        d.open = o;
      });
    });
  });
})();

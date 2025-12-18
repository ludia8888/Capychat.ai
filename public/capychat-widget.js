/* CapyChat Widget Loader (vanilla JS)
 *
 * Embed example:
 *   <script
 *     src="https://YOUR_DOMAIN/capychat-widget.js"
 *     data-install-code="YOUR_INSTALL_CODE"
 *     async
 *   ></script>
 *
 * Optional:
 *   data-position="left|right" (default: right)
 *   data-icon="https://.../icon.png" (launcher icon override; default: chatbot thumbnail)
 *   data-chatbot-url="https://YOUR_DOMAIN/chatbot" (override)
 *   data-auto-open="1" (auto open on load)
 *   data-auto-open-delay="1000" (ms)
 *   data-drag="0" (disable drag)
 */

(function () {
  var existing = window.CapyChatWidget || {};
  if (existing.__initialized) return;

  // Allow calling API before the script finishes loading.
  var queue = existing.__queue || [];
  function enqueue(fn, args) {
    queue.push({ fn: fn, args: args || [] });
  }
  existing.__queue = queue;
  existing.open = existing.open || function () {
    enqueue("open");
  };
  existing.close = existing.close || function () {
    enqueue("close");
  };
  existing.toggle = existing.toggle || function () {
    enqueue("toggle");
  };
  existing.setPosition = existing.setPosition || function (pos) {
    enqueue("setPosition", [pos]);
  };
  existing.resetPosition = existing.resetPosition || function () {
    enqueue("resetPosition");
  };
  existing.isOpen = existing.isOpen || function () {
    return false;
  };
  window.CapyChatWidget = existing;

  var WIDGET_PREFIX = "capychat-widget";
  var BUTTON_SIZE = 56;
  var PANEL_MAX_WIDTH = 380;
  var PANEL_MAX_HEIGHT = 640;
  var EDGE_MARGIN = 16;
  var PANEL_GAP = 16;

  function getCurrentScript() {
    if (document.currentScript) return document.currentScript;
    var scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1] || null;
  }

  var script = getCurrentScript();
  var scriptSrc = (script && script.src) || "";
  var origin = "";
  try {
    origin = scriptSrc ? new URL(scriptSrc).origin : "";
  } catch (e) {
    origin = "";
  }

  var dataset = (script && script.dataset) || {};
  var tenantKey = dataset.installCode || dataset.code || dataset.channel || dataset.tenant || dataset.tenantKey || "";
  var position = dataset.position === "left" ? "left" : "right";

  var baseChatbotUrl = dataset.chatbotUrl || (origin ? origin + "/chatbot" : "/chatbot");
  var chatbotUrl = baseChatbotUrl + "?embed=1";
  if (tenantKey) chatbotUrl += "&code=" + encodeURIComponent(tenantKey);

  var defaultIconUrl = origin ? origin + "/api/public/chat-thumbnail" : "/api/public/chat-thumbnail";
  if (tenantKey) defaultIconUrl += "?code=" + encodeURIComponent(tenantKey);
  var iconUrl = dataset.icon || defaultIconUrl;

  var autoOpen = dataset.autoOpen === "1" || dataset.autoOpen === "true";
  var autoOpenDelay = parseInt(dataset.autoOpenDelay || dataset.openDelay || "0", 10);
  if (isNaN(autoOpenDelay)) autoOpenDelay = 0;

  var dragEnabled = !(dataset.drag === "0" || dataset.drag === "false");

  function isMobile() {
    return window.innerWidth <= 480;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function storageKey() {
    return WIDGET_PREFIX + ":pos" + (tenantKey ? ":" + tenantKey : "");
  }

  function createStyle() {
    var style = document.createElement("style");
    style.setAttribute("data-" + WIDGET_PREFIX, "");
    style.textContent =
      "\\
#" +
      WIDGET_PREFIX +
      "{position:fixed;z-index:2147483000;bottom:calc(24px + env(safe-area-inset-bottom));" +
      position +
      ":calc(24px + env(safe-area-inset-right));font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial} \\
#" +
      WIDGET_PREFIX +
      "-button{width:" +
      BUTTON_SIZE +
      "px;height:" +
      BUTTON_SIZE +
      "px;border-radius:9999px;border:none;cursor:pointer;box-shadow:0 12px 30px rgba(0,0,0,.18);background:#111;display:flex;align-items:center;justify-content:center;overflow:hidden;touch-action:none} \\
#" +
      WIDGET_PREFIX +
      "-button img{width:" +
      BUTTON_SIZE +
      "px;height:" +
      BUTTON_SIZE +
      "px;object-fit:cover;display:block} \\
#" +
      WIDGET_PREFIX +
      "-panel{position:fixed;z-index:2147483001;bottom:96px;" +
      position +
      ":24px;width:min(" +
      PANEL_MAX_WIDTH +
      "px, calc(100vw - 32px));height:min(" +
      PANEL_MAX_HEIGHT +
      "px, calc(100vh - 128px));border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,.28);background:#fff;overflow:hidden;display:none} \\
#" +
      WIDGET_PREFIX +
      "-iframe{width:100%;height:100%;border:0} \\
#" +
      WIDGET_PREFIX +
      "-close{position:absolute;top:10px;" +
      position +
      ":10px;z-index:2147483002;width:32px;height:32px;border-radius:9999px;border:none;cursor:pointer;background:rgba(0,0,0,.55);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1} \\
@media (max-width: 480px){\\
  #" +
      WIDGET_PREFIX +
      "{bottom:calc(16px + env(safe-area-inset-bottom));" +
      position +
      ":calc(16px + env(safe-area-inset-right))} \\
  #" +
      WIDGET_PREFIX +
      "-panel{top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;border-radius:0}\\
  #" +
      WIDGET_PREFIX +
      "-close{top:calc(12px + env(safe-area-inset-top));right:calc(12px + env(safe-area-inset-right));left:auto}\\
}\\
";
    document.head.appendChild(style);
  }

  function ensureBodyReady(fn) {
    if (document.body) return fn();
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  }

  function init() {
    createStyle();

    var root = document.createElement("div");
    root.id = WIDGET_PREFIX;

    var button = document.createElement("button");
    button.type = "button";
    button.id = WIDGET_PREFIX + "-button";
    button.setAttribute("aria-label", "챗봇 열기");
    button.setAttribute("aria-expanded", "false");

    var img = document.createElement("img");
    img.src = iconUrl;
    img.alt = "챗봇";
    img.loading = "eager";
    button.appendChild(img);

    var panel = document.createElement("div");
    panel.id = WIDGET_PREFIX + "-panel";

    var close = document.createElement("button");
    close.type = "button";
    close.id = WIDGET_PREFIX + "-close";
    close.setAttribute("aria-label", "닫기");
    close.textContent = "×";

    var iframe = document.createElement("iframe");
    iframe.id = WIDGET_PREFIX + "-iframe";
    iframe.title = "CapyChat";
    iframe.src = chatbotUrl;
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("referrerpolicy", "no-referrer-when-downgrade");

    panel.appendChild(close);
    panel.appendChild(iframe);
    root.appendChild(button);
    document.body.appendChild(root);
    document.body.appendChild(panel);

    var state = {
      open: false,
    };

    var prevBodyOverflow = null;
    var prevHtmlOverflow = null;

    function lockScrollForMobile() {
      if (!isMobile()) return;
      if (prevBodyOverflow !== null) return;
      prevBodyOverflow = document.body.style.overflow;
      prevHtmlOverflow = document.documentElement.style.overflow;
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }

    function unlockScroll() {
      if (prevBodyOverflow === null) return;
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      prevBodyOverflow = null;
      prevHtmlOverflow = null;
    }

    function defaultButtonPosition() {
      var x = position === "left" ? EDGE_MARGIN : window.innerWidth - EDGE_MARGIN - BUTTON_SIZE;
      var y = window.innerHeight - EDGE_MARGIN - BUTTON_SIZE;
      return { x: x, y: y };
    }

    function applyButtonPosition(x, y) {
      var maxX = window.innerWidth - BUTTON_SIZE - EDGE_MARGIN;
      var maxY = window.innerHeight - BUTTON_SIZE - EDGE_MARGIN;
      var cx = clamp(x, EDGE_MARGIN, Math.max(EDGE_MARGIN, maxX));
      var cy = clamp(y, EDGE_MARGIN, Math.max(EDGE_MARGIN, maxY));

      root.style.left = cx + "px";
      root.style.top = cy + "px";
      root.style.right = "auto";
      root.style.bottom = "auto";

      return { x: cx, y: cy };
    }

    function loadSavedPosition() {
      try {
        var raw = window.localStorage.getItem(storageKey());
        if (!raw) return false;
        var parsed = JSON.parse(raw);
        if (typeof parsed.x !== "number" || typeof parsed.y !== "number") return false;
        applyButtonPosition(parsed.x, parsed.y);
        return true;
      } catch (e) {
        return false;
      }
    }

    function saveCurrentPosition() {
      try {
        var rect = root.getBoundingClientRect();
        window.localStorage.setItem(storageKey(), JSON.stringify({ x: rect.left, y: rect.top }));
      } catch {
        // ignore
      }
    }

    function resetPosition() {
      try {
        window.localStorage.removeItem(storageKey());
      } catch {
        // ignore
      }
      var pos = defaultButtonPosition();
      applyButtonPosition(pos.x, pos.y);
      if (state.open && !isMobile()) positionPanel();
    }

    if (!loadSavedPosition()) {
      var pos0 = defaultButtonPosition();
      applyButtonPosition(pos0.x, pos0.y);
    }

    function positionPanel() {
      if (isMobile()) {
        // Mobile full-screen is handled by CSS.
        panel.style.left = "";
        panel.style.top = "";
        panel.style.right = "";
        panel.style.bottom = "";
        panel.style.width = "";
        panel.style.height = "";
        return;
      }

      var buttonRect = root.getBoundingClientRect();
      var width = Math.min(PANEL_MAX_WIDTH, window.innerWidth - EDGE_MARGIN * 2);
      var height = Math.min(PANEL_MAX_HEIGHT, window.innerHeight - 128);

      var alignRight = buttonRect.left > window.innerWidth / 2;
      var left = alignRight ? buttonRect.right - width : buttonRect.left;
      left = clamp(left, EDGE_MARGIN, window.innerWidth - width - EDGE_MARGIN);

      var topAbove = buttonRect.top - height - PANEL_GAP;
      var topBelow = buttonRect.bottom + PANEL_GAP;
      var top;
      if (topAbove >= EDGE_MARGIN) top = topAbove;
      else if (topBelow + height <= window.innerHeight - EDGE_MARGIN) top = topBelow;
      else top = clamp(window.innerHeight - height - EDGE_MARGIN, EDGE_MARGIN, window.innerHeight - height - EDGE_MARGIN);

      panel.style.left = left + "px";
      panel.style.top = top + "px";
      panel.style.width = width + "px";
      panel.style.height = height + "px";
      panel.style.right = "auto";
      panel.style.bottom = "auto";
    }

    function open() {
      if (state.open) return;
      state.open = true;
      panel.style.display = "block";
      positionPanel();
      button.setAttribute("aria-expanded", "true");

      if (isMobile()) {
        // Fullscreen: hide launcher and lock scroll.
        root.style.display = "none";
        lockScrollForMobile();
      }

      try {
        window.dispatchEvent(new CustomEvent("capychat:open"));
      } catch {
        // ignore
      }
    }

    function closePanel() {
      if (!state.open) return;
      state.open = false;
      panel.style.display = "none";
      button.setAttribute("aria-expanded", "false");
      root.style.display = "block";
      unlockScroll();

      try {
        window.dispatchEvent(new CustomEvent("capychat:close"));
      } catch {
        // ignore
      }
    }

    function toggle() {
      if (state.open) closePanel();
      else open();
    }

    // Drag launcher button
    var suppressNextClick = false;
    var dragging = false;
    var pointerActive = false;
    var startX = 0;
    var startY = 0;
    var startLeft = 0;
    var startTop = 0;

    if (dragEnabled && "PointerEvent" in window) {
      button.addEventListener("pointerdown", function (e) {
        if (state.open) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        pointerActive = true;
        dragging = false;
        startX = e.clientX;
        startY = e.clientY;
        var rect = root.getBoundingClientRect();
        startLeft = rect.left;
        startTop = rect.top;
        try {
          button.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      });

      button.addEventListener("pointermove", function (e) {
        if (!pointerActive) return;
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (!dragging && Math.hypot(dx, dy) < 6) return;
        dragging = true;
        applyButtonPosition(startLeft + dx, startTop + dy);
      });

      function endDrag(e) {
        if (!pointerActive) return;
        pointerActive = false;
        try {
          button.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        if (dragging) {
          suppressNextClick = true;
          saveCurrentPosition();
        }
        dragging = false;
      }

      button.addEventListener("pointerup", endDrag);
      button.addEventListener("pointercancel", endDrag);
    }

    button.addEventListener("click", function () {
      if (suppressNextClick) {
        suppressNextClick = false;
        return;
      }
      toggle();
    });

    close.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      closePanel();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closePanel();
    });

    window.addEventListener("resize", function () {
      // Keep launcher in bounds
      var rect = root.getBoundingClientRect();
      applyButtonPosition(rect.left, rect.top);
      if (state.open) positionPanel();
    });

    window.addEventListener("message", function (event) {
      // If origin is known, lock it down; otherwise accept (dev/local)
      if (origin && event.origin !== origin) return;
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type === "CAPYCHAT_WIDGET_CLOSE") closePanel();
      if (event.data.type === "CAPYCHAT_WIDGET_OPEN") open();
    });

    // Finalize API
    var api = window.CapyChatWidget || {};
    api.__initialized = true;
    api.open = open;
    api.close = closePanel;
    api.toggle = toggle;
    api.isOpen = function () {
      return state.open;
    };
    api.setPosition = function (pos) {
      if (!pos || typeof pos.x !== "number" || typeof pos.y !== "number") return;
      applyButtonPosition(pos.x, pos.y);
      saveCurrentPosition();
      if (state.open && !isMobile()) positionPanel();
    };
    api.resetPosition = resetPosition;
    api.getUrl = function () {
      return chatbotUrl;
    };

    // Flush queued calls
    var q = api.__queue || [];
    api.__queue = [];
    for (var i = 0; i < q.length; i++) {
      var item = q[i];
      if (!item || !item.fn) continue;
      if (item.fn === "open") open();
      else if (item.fn === "close") closePanel();
      else if (item.fn === "toggle") toggle();
      else if (item.fn === "setPosition") api.setPosition(item.args && item.args[0]);
      else if (item.fn === "resetPosition") resetPosition();
    }

    window.CapyChatWidget = api;

    if (autoOpen) {
      window.setTimeout(function () {
        open();
      }, autoOpenDelay);
    }
  }

  ensureBodyReady(init);
})();

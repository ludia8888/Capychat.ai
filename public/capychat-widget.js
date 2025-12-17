/* CapyChat Widget Loader (vanilla JS)
 *
 * Embed example:
 *   <script
 *     src="https://YOUR_DOMAIN/capychat-widget.js"
 *     data-tenant="YOUR_TENANT_KEY"
 *     async
 *   ></script>
 *
 * Optional:
 *   data-position="left|right" (default: right)
 *   data-icon="https://.../icon.png" (launcher icon)
 *   data-chatbot-url="https://YOUR_DOMAIN/chatbot" (override)
 */

(function () {
  if (window.CapyChatWidget && window.CapyChatWidget.__initialized) return;

  var WIDGET_PREFIX = "capychat-widget";

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
  var tenantKey = dataset.tenant || dataset.tenantKey || "";
  var position = dataset.position === "left" ? "left" : "right";

  var baseChatbotUrl = dataset.chatbotUrl || (origin ? origin + "/chatbot" : "/chatbot");
  var chatbotUrl = baseChatbotUrl + "?embed=1";
  if (tenantKey) chatbotUrl += "&tenant=" + encodeURIComponent(tenantKey);

  var iconUrl = dataset.icon || (origin ? origin + "/capychat_mascot.png" : "/capychat_mascot.png");

  function createStyle() {
    var style = document.createElement("style");
    style.setAttribute("data-" + WIDGET_PREFIX, "");
    style.textContent =
      "\\
#" +
      WIDGET_PREFIX +
      "{position:fixed;z-index:2147483000;bottom:24px;" +
      position +
      ":24px;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial} \\
#" +
      WIDGET_PREFIX +
      "-button{width:56px;height:56px;border-radius:9999px;border:none;cursor:pointer;box-shadow:0 12px 30px rgba(0,0,0,.18);background:#111;display:flex;align-items:center;justify-content:center;overflow:hidden} \\
#" +
      WIDGET_PREFIX +
      "-button img{width:56px;height:56px;object-fit:cover;display:block} \\
#" +
      WIDGET_PREFIX +
      "-panel{position:fixed;z-index:2147483001;bottom:96px;" +
      position +
      ":24px;width:min(380px, calc(100vw - 32px));height:min(640px, calc(100vh - 128px));border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,.28);background:#fff;overflow:hidden;display:none} \\
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
      "{bottom:16px;" +
      position +
      ":16px} \\
  #" +
      WIDGET_PREFIX +
      "-panel{bottom:88px;" +
      position +
      ":16px;width:calc(100vw - 32px);height:calc(100vh - 120px)}\\
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

    var img = document.createElement("img");
    img.src = iconUrl;
    img.alt = "챗봇";
    img.loading = "lazy";
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

    function open() {
      panel.style.display = "block";
      button.setAttribute("aria-expanded", "true");
    }

    function closePanel() {
      panel.style.display = "none";
      button.setAttribute("aria-expanded", "false");
    }

    function toggle() {
      if (panel.style.display === "block") closePanel();
      else open();
    }

    button.addEventListener("click", function () {
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

    window.addEventListener("message", function (event) {
      // If origin is known, lock it down; otherwise accept (dev/local)
      if (origin && event.origin !== origin) return;
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type === "CAPYCHAT_WIDGET_CLOSE") closePanel();
    });

    window.CapyChatWidget = {
      __initialized: true,
      open: open,
      close: closePanel,
      toggle: toggle,
      getUrl: function () {
        return chatbotUrl;
      },
    };
  }

  ensureBodyReady(init);
})();

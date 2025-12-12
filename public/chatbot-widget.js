(function () {
  if (window.__capychatWidgetLoaded) return;
  window.__capychatWidgetLoaded = true;

  const currentScript = document.currentScript;
  const dataset = currentScript?.dataset || {};
  const hostFromScript = (() => {
    try {
      return currentScript ? new URL(currentScript.src, window.location.href).origin : window.location.origin;
    } catch {
      return window.location.origin;
    }
  })();

  const base = (dataset.base || dataset.host || hostFromScript || "").replace(/\/$/, "");
  const chatbotUrl = (dataset.chatbotUrl || dataset.url || `${base}/chatbot?embed=1`).replace(/\/$/, "");
  const position = (dataset.position || "bottom-right").toLowerCase();

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.zIndex = "2147483000";
  wrapper.style.fontFamily = "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  wrapper.style.lineHeight = "1.4";

  const setPosition = () => {
    const margin = "20px";
    wrapper.style.bottom = margin;
    wrapper.style.right = position.includes("right") ? margin : "";
    wrapper.style.left = position.includes("left") ? margin : "";
  };
  setPosition();

  const iframe = document.createElement("iframe");
  iframe.src = chatbotUrl;
  iframe.title = "Capychat AI";
  iframe.style.width = "420px";
  iframe.style.maxWidth = "calc(100vw - 32px)";
  iframe.style.height = "560px";
  iframe.style.border = "1px solid #e5e7eb";
  iframe.style.borderRadius = "18px";
  iframe.style.boxShadow = "0 18px 50px rgba(0,0,0,0.15)";
  iframe.style.display = "none";
  iframe.style.background = "white";
  iframe.allowFullscreen = true;

  const card = document.createElement("div");
  card.style.position = "relative";
  card.style.display = "none";
  card.style.marginBottom = "12px";
  card.appendChild(iframe);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  closeBtn.setAttribute("aria-label", "Close chat");
  closeBtn.style.position = "absolute";
  closeBtn.style.top = "6px";
  closeBtn.style.right = "10px";
  closeBtn.style.border = "none";
  closeBtn.style.background = "rgba(0,0,0,0.6)";
  closeBtn.style.color = "white";
  closeBtn.style.width = "26px";
  closeBtn.style.height = "26px";
  closeBtn.style.borderRadius = "50%";
  closeBtn.style.cursor = "pointer";
  closeBtn.style.boxShadow = "0 8px 18px rgba(0,0,0,0.2)";
  closeBtn.style.fontSize = "16px";
  closeBtn.style.lineHeight = "26px";
  closeBtn.style.textAlign = "center";
  closeBtn.style.opacity = "0.92";
  closeBtn.onmouseenter = () => (closeBtn.style.opacity = "1");
  closeBtn.onmouseleave = () => (closeBtn.style.opacity = "0.92");
  card.appendChild(closeBtn);

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "카피챗 열기";
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.gap = "8px";
  button.style.padding = "12px 16px";
  button.style.borderRadius = "9999px";
  button.style.border = "1px solid #111827";
  button.style.background = "#111827";
  button.style.color = "#fff";
  button.style.boxShadow = "0 12px 30px rgba(17,24,39,0.25)";
  button.style.cursor = "pointer";
  button.style.fontWeight = "600";
  button.style.fontSize = "14px";
  button.style.transition = "transform 0.15s ease, box-shadow 0.15s ease";
  button.onmouseenter = () => {
    button.style.transform = "translateY(-2px)";
    button.style.boxShadow = "0 16px 40px rgba(17,24,39,0.3)";
  };
  button.onmouseleave = () => {
    button.style.transform = "translateY(0)";
    button.style.boxShadow = "0 12px 30px rgba(17,24,39,0.25)";
  };

  const dot = document.createElement("span");
  dot.style.display = "inline-block";
  dot.style.width = "10px";
  dot.style.height = "10px";
  dot.style.borderRadius = "9999px";
  dot.style.background = "#10b981";
  dot.style.boxShadow = "0 0 0 6px rgba(16,185,129,0.12)";
  button.prepend(dot);

  let isOpen = false;
  const open = () => {
    if (isOpen) return;
    isOpen = true;
    iframe.style.display = "block";
    card.style.display = "block";
    button.textContent = "카피챗 닫기";
    button.prepend(dot);
  };
  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    iframe.style.display = "none";
    card.style.display = "none";
    button.textContent = "카피챗 열기";
    button.prepend(dot);
  };

  button.onclick = () => (isOpen ? close() : open());
  closeBtn.onclick = close;

  const escHandler = (e) => {
    if (e.key === "Escape") close();
  };
  window.addEventListener("keydown", escHandler);

  wrapper.appendChild(card);
  wrapper.appendChild(button);
  document.body.appendChild(wrapper);
})();

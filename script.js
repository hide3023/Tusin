(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";

  // ---- data model -----------------------------------------------------
  const ITEMS = [
    { id: "yt_short",    category: "動画",       name: "YouTubeショート 1分",     mb: 10 },
    { id: "yt_10",       category: "動画",       name: "YouTube動画 10本視聴",     mb: 60 },
    { id: "music",       category: "音楽",       name: "曲を1曲聴く",             mb: 3 },
    { id: "sns_img",     category: "SNS",       name: "SNSで画像を見る",          mb: 15 },
    { id: "sns_live",    category: "SNS",       name: "SNSでライブ配信を見る",      mb: 25 },
    { id: "sns_reel",    category: "SNS",       name: "SNSでリールを見る",         mb: 45 },
    { id: "dl_game",     category: "ダウンロード", name: "ゲームをダウンロード",       mb: 250 },
    { id: "dl_sns",      category: "ダウンロード", name: "SNSアプリをダウンロード",     mb: 100 },
    { id: "game_card",   category: "ゲーム",     name: "カードゲームで遊ぶ",         mb: 5 },
    { id: "game_battle", category: "ゲーム",     name: "対戦ゲームで遊ぶ",          mb: 30 },
  ];

  const ICONS = {
    "動画": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="M10 9l6 3-6 3z" fill="currentColor" stroke="none"/></svg>`,
    "音楽": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="17" r="2.4" fill="currentColor" stroke="none"/><circle cx="17" cy="15" r="2.4" fill="currentColor" stroke="none"/><path d="M9.4 17V5.5L19.4 4v10.5"/></svg>`,
    "SNS": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 5h16v11H9l-4 4V5z"/><circle cx="9" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10.5" r="1" fill="currentColor" stroke="none"/></svg>`,
    "ダウンロード": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v11"/><path d="M7.5 10.5L12 15l4.5-4.5"/><path d="M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>`,
    "ゲーム": `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2.5" y="8" width="19" height="9" rx="4"/><path d="M7 10.5v4M5 12.5h4"/><circle cx="16" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="18.2" cy="13.2" r="1" fill="currentColor" stroke="none"/></svg>`,
  };

  const PLAN_OPTIONS = [
    { value: "1", label: "1GB" },
    { value: "3", label: "3GB" },
    { value: "5", label: "5GB" },
    { value: "7", label: "7GB" },
    { value: "10", label: "10GB" },
    { value: "20", label: "20GB" },
    { value: "30", label: "30GB" },
    { value: "50", label: "50GB" },
    { value: "unlimited", label: "制限なし" },
  ];
  const DEFAULT_PLAN_VALUE = "10";

  // ---- units (decimal, matching how carriers advertise plans) ---------
  const BITS_PER_MB = 8 * 1000 * 1000;      // 1MB = 1,000,000 bytes
  const BITS_PER_GB = BITS_PER_MB * 1000;   // 1GB = 1000MB
  const FALLBACK_GAUGE_GB = 10; // used only if the plan is "unlimited", so the gauge still has a scale

  const NORMAL_SPEED_MBPS = 20;      // typical 4G speed used for this simulation
  const THROTTLED_SPEED_MBPS = 0.128; // 128kbps, a common Japanese "speed limit" value

  // ---- state ------------------------------------------------------------
  let totalBits = 0;
  let throttled = false;

  // ---- DOM refs -----------------------------------------------------
  const stage = document.getElementById("stage");
  const sourceList = document.getElementById("sourceList");
  const cableLayer = document.getElementById("cableLayer");
  const phone = document.getElementById("phone");
  const phonePort = document.getElementById("phonePort");
  const phoneValue = document.getElementById("phoneValue");
  const phoneGaugeFill = document.getElementById("phoneGaugeFill");
  const phoneMax = document.getElementById("phoneMax");
  const planSelect = document.getElementById("planSelect");
  const resetBtn = document.getElementById("resetBtn");
  const speedValue = document.getElementById("speedValue");
  const speedStatus = document.getElementById("speedStatus");
  const planBarFill = document.getElementById("planBarFill");
  const planBarLabel = document.getElementById("planBarLabel");
  const timeTable = document.getElementById("timeTable");

  // ---- helpers --------------------------------------------------------
  function formatSize(mb) {
    if (mb >= 1000) {
      const gb = mb / 1000;
      return (Number.isInteger(gb) ? gb.toString() : gb.toFixed(2)) + "GB";
    }
    return mb + "MB";
  }

  function formatTime(sec) {
    if (sec < 1) return sec.toFixed(2) + "秒";
    if (sec < 60) return sec.toFixed(1) + "秒";
    const min = Math.floor(sec / 60);
    const rem = Math.round(sec % 60);
    return `${min}分${rem}秒`;
  }

  function getSelectedPlanGB() {
    const v = planSelect.value;
    return v === "unlimited" ? Infinity : Number(v);
  }

  function currentSpeedMbps() {
    return throttled ? THROTTLED_SPEED_MBPS : NORMAL_SPEED_MBPS;
  }

  function gaugeCapBits() {
    const planGB = getSelectedPlanGB();
    return (planGB === Infinity ? FALLBACK_GAUGE_GB : planGB) * BITS_PER_GB;
  }

  // ---- rendering --------------------------------------------------------
  function renderSourceList() {
    sourceList.innerHTML = "";
    const categories = [...new Set(ITEMS.map((i) => i.category))];
    categories.forEach((cat) => {
      const group = document.createElement("div");
      group.className = "source-group";

      const label = document.createElement("p");
      label.className = "source-group-label";
      label.textContent = cat;
      group.appendChild(label);

      ITEMS.filter((i) => i.category === cat).forEach((item) => {
        const row = document.createElement("div");
        row.className = "source-row";
        row.dataset.id = item.id;
        row.innerHTML = `
          <span class="source-icon">${ICONS[cat]}</span>
          <span class="source-info">
            <span class="source-name">${item.name}</span><br>
            <span class="source-size">（${formatSize(item.mb)}）</span>
          </span>
          <button class="send-btn" type="button">送る</button>
        `;
        row.querySelector(".send-btn").addEventListener("click", () => sendData(item, row));
        group.appendChild(row);
      });

      sourceList.appendChild(group);
    });
  }

  function renderPhone() {
    const capBits = gaugeCapBits();
    const pct = Math.min(totalBits / capBits, 1) * 100;
    phoneGaugeFill.style.height = pct + "%";
    phoneGaugeFill.classList.toggle("warn", pct >= 60 && pct < 100);
    phoneGaugeFill.classList.toggle("danger", pct >= 100);
    phoneValue.textContent = (totalBits / BITS_PER_GB).toFixed(1);
    phoneMax.textContent = "/ " + (capBits / BITS_PER_GB) + "GB";
    phone.classList.toggle("over-cap", totalBits >= capBits);
  }

  function renderDashboard() {
    speedValue.textContent = throttled ? "128 kbps" : "20 Mbps";
    speedValue.classList.toggle("throttled", throttled);
    speedStatus.textContent = throttled
      ? "契約データ容量を超えたため、速度制限がかかっています"
      : "通常の速度で通信中";

    const planGB = getSelectedPlanGB();
    const limitBits = planGB === Infinity ? Infinity : planGB * BITS_PER_GB;
    const pct = limitBits === Infinity ? 0 : Math.min(totalBits / limitBits, 1) * 100;
    planBarFill.style.width = pct + "%";
    planBarFill.classList.toggle("danger", throttled);
    planBarLabel.textContent = `${(totalBits / BITS_PER_GB).toFixed(1)}GB / ${
      planGB === Infinity ? "制限なし" : planGB + "GB"
    }`;
  }

  function renderTimeTable() {
    const speedMbps = currentSpeedMbps();
    timeTable.innerHTML = "";
    ITEMS.forEach((item) => {
      const sec = (item.mb * 8) / speedMbps;
      const row = document.createElement("div");
      row.className = "time-row";
      row.innerHTML = `
        <span class="time-row-name">${item.name}</span>
        <span class="time-row-time ${throttled ? "throttled" : ""}">${formatTime(sec)}</span>
      `;
      timeTable.appendChild(row);
    });
  }

  function renderAll() {
    renderPhone();
    renderDashboard();
    renderTimeTable();
  }

  // ---- throttle logic -----------------------------------------------
  function updateThrottleState() {
    const planGB = getSelectedPlanGB();
    const limitBits = planGB === Infinity ? Infinity : planGB * BITS_PER_GB;
    throttled = totalBits >= limitBits;
  }

  // ---- data flow ------------------------------------------------------
  function addUsage(mb) {
    totalBits += mb * BITS_PER_MB;
    updateThrottleState();
    renderAll();
  }

  function sendData(item, rowEl) {
    animateCable(rowEl, throttled, () => addUsage(item.mb));
  }

  // ---- cable / light animation ----------------------------------------
  function animateCable(rowEl, wasThrottled, onArrive) {
    const stageRect = stage.getBoundingClientRect();
    const rowRect = rowEl.getBoundingClientRect();
    const portRect = phonePort.getBoundingClientRect();

    const x1 = rowRect.right - stageRect.left;
    const y1 = rowRect.top + rowRect.height / 2 - stageRect.top;
    const x2 = portRect.left + portRect.width / 2 - stageRect.left;
    const y2 = portRect.top + portRect.height / 2 - stageRect.top;
    const midX = (x1 + x2) / 2;

    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", `M ${x1} ${y1} Q ${midX} ${y1} ${midX} ${(y1 + y2) / 2} T ${x2} ${y2}`);
    path.setAttribute("class", "cable-path" + (wasThrottled ? " throttled" : ""));
    cableLayer.appendChild(path);

    const len = path.getTotalLength();
    const color = wasThrottled ? "#f2b84b" : "#4ad9e0";

    const circle = document.createElementNS(SVG_NS, "circle");
    circle.setAttribute("r", "5");
    circle.setAttribute("class", "light-ball");
    circle.style.fill = color;
    circle.style.filter = `drop-shadow(0 0 6px ${color})`;
    cableLayer.appendChild(circle);

    const duration = wasThrottled ? 3200 : 750;
    let startTime = null;

    function step(ts) {
      if (startTime === null) startTime = ts;
      const t = Math.min((ts - startTime) / duration, 1);
      const point = path.getPointAtLength(t * len);
      circle.setAttribute("cx", point.x);
      circle.setAttribute("cy", point.y);
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        cableLayer.removeChild(path);
        cableLayer.removeChild(circle);
        onArrive();
      }
    }
    requestAnimationFrame(step);
  }

  // ---- setup ------------------------------------------------------------
  function populatePlanSelect() {
    planSelect.innerHTML = "";
    PLAN_OPTIONS.forEach((opt) => {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      planSelect.appendChild(el);
    });
    planSelect.value = DEFAULT_PLAN_VALUE;
  }

  planSelect.addEventListener("change", () => {
    updateThrottleState();
    renderAll();
  });

  resetBtn.addEventListener("click", () => {
    totalBits = 0;
    updateThrottleState();
    renderAll();
  });

  populatePlanSelect();
  renderSourceList();
  updateThrottleState();
  renderAll();
})();

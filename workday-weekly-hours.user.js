// ==UserScript==
// @name         Workday Weekly Hours
// @namespace    https://github.com/tksoftw/workday-script
// @version      1.0.0
// @description  Fill UVA Workday Quick Add hours for each job. Review before OK. Never submits.
// @author       tksoftw
// @match        https://*.myworkday.com/*
// @match        https://*.workday.com/*
// @match        http://127.0.0.1:*/test/*
// @match        http://localhost:*/test/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const STORAGE_KEY = "workdayWeeklyHours.v1";
  const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Hours read from Enter Time on Nov 11, 2026. Time type is Regular Hours.
  // Week of Nov 2–8 had no blocks. Week of Nov 9–15 matched the 20.00 Regular total.
  const JOBS = [
    {
      id: "P590506",
      name: "P590506 UTA - Reiss (+), EN-Comp Science Dept-JM (Charles Reiss)",
      short: "Reiss",
    },
    {
      id: "P581852",
      name: "P581852 UTA - Yi, EN-Comp Science Dept-JM (Xinyao Yi)",
      short: "Yi",
    },
    {
      id: "P596989",
      name: "P596989 UTA - Floryan (+), EN-Comp Science Dept-JM (Mark Richard Floryan)",
      short: "Floryan",
    },
    {
      id: "P599534",
      name: "P599534 STAT UTA/Grader-Somal (+), AS-Statistics (STAT)-JM (Harsimran Somal)",
      short: "Somal",
    },
  ];

  const WEEKS = [
    {
      id: "2026-11-02",
      label: "11/02/2026 - 11/08/2026",
      title: "Nov 2–8, 2026",
    },
    {
      id: "2026-11-09",
      label: "11/09/2026 - 11/15/2026",
      title: "Nov 9–15, 2026",
    },
  ];

  const TIME_TYPE = "Regular Hours";

  const DEFAULT_HOURS = {
    "2026-11-02": {
      P590506: [0, 0, 0, 0, 0, 0, 0],
      P581852: [0, 0, 0, 0, 0, 0, 0],
      P596989: [0, 0, 0, 0, 0, 0, 0],
      P599534: [0, 0, 0, 0, 0, 0, 0],
    },
    "2026-11-09": {
      P590506: [1, 1, 1.25, 2, 0, 0, 0.5],
      P581852: [0, 3.25, 1, 0, 1, 0, 1],
      P596989: [0, 0, 2, 2, 2, 1, 1],
      P599534: [0, 0, 0, 0, 0, 0, 0],
    },
  };

  const store = {
    get(key, fallback) {
      try {
        if (typeof GM_getValue === "function") {
          const value = GM_getValue(key, fallback);
          return value == null ? fallback : value;
        }
      } catch (err) {
        /* local page */
      }
      const raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw);
      } catch (err) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        if (typeof GM_setValue === "function") {
          GM_setValue(key, value);
          return;
        }
      } catch (err) {
        /* local page */
      }
      localStorage.setItem(key, JSON.stringify(value));
    },
  };

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_HOURS));
  }

  function loadSettings() {
    const saved = store.get(STORAGE_KEY, null);
    const hours = cloneDefaults();
    if (saved && saved.hours) {
      for (const weekId of Object.keys(hours)) {
        for (const job of JOBS) {
          const row = saved.hours[weekId] && saved.hours[weekId][job.id];
          if (Array.isArray(row) && row.length === 7) {
            hours[weekId][job.id] = row.map((n) => Number(n) || 0);
          }
        }
      }
    }
    return { hours, applyOk: false };
  }

  function saveSettings(settings) {
    store.set(STORAGE_KEY, { hours: settings.hours });
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function visible(el) {
    if (!el || el.closest("#wwh-root")) return false;
    let node = el;
    while (node && node.nodeType === 1) {
      if (node.hidden) return false;
      const style = window.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return false;
      if (node.getAttribute("aria-hidden") === "true") return false;
      node = node.parentElement;
    }
    return true;
  }

  function textOf(el) {
    return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function allElements(root) {
    const out = [];
    const visit = (node) => {
      if (!node || !node.querySelectorAll) return;
      for (const el of node.querySelectorAll("*")) {
        if (!el.closest || !el.closest("#wwh-root")) out.push(el);
        if (el.shadowRoot) visit(el.shadowRoot);
      }
    };
    visit(root || document);
    return out;
  }

  function findButton(name) {
    const wanted = name.toLowerCase();
    return allElements(document).find((el) => {
      if (!visible(el)) return false;
      const tag = el.tagName;
      const role = (el.getAttribute("role") || "").toLowerCase();
      if (tag !== "BUTTON" && role !== "button" && role !== "menuitem") return false;
      const label = textOf(el).toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      return label === wanted || aria === wanted || aria.startsWith(wanted + " ");
    });
  }

  async function waitFor(fn, timeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const value = fn();
      if (value) return value;
      await sleep(150);
    }
    return null;
  }

  function setNativeValue(input, value) {
    const text = String(value);
    input.focus();
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (proto && proto.set) proto.set.call(input, text);
    else input.value = text;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  function numbersClose(a, b) {
    return Math.abs(Number(a) - Number(b)) < 0.001;
  }

  function sameRow(a, b) {
    return a.length === b.length && a.every((n, i) => numbersClose(n, b[i]));
  }

  function sum(row) {
    return row.reduce((total, n) => total + Number(n || 0), 0);
  }

  function formatHours(n) {
    const value = Number(n) || 0;
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 100) / 100);
  }

  function parseEntryText(value) {
    const match = String(value || "").match(/([\d.]+)\s*Hours:\s*(P\d{6})/i);
    if (!match) return null;
    return { hours: Number(match[1]), id: match[2] };
  }

  function emptyRows() {
    const rows = {};
    for (const job of JOBS) rows[job.id] = [0, 0, 0, 0, 0, 0, 0];
    return rows;
  }

  function dialogs() {
    return allElements(document).filter(
      (el) => el.getAttribute("role") === "dialog" && visible(el)
    );
  }

  async function closeTopDialog() {
    const dialog = dialogs().pop();
    if (!dialog) return false;
    const close = [...dialog.querySelectorAll("button, [role=button]")].find((button) => {
      const label = (textOf(button) || button.getAttribute("aria-label") || "").toLowerCase();
      return label === "close" || label.startsWith("close ");
    });
    if (!close) return false;
    close.click();
    await sleep(300);
    return true;
  }

  async function readCellEntries(cell) {
    const entries = [...cell.querySelectorAll("[data-testid=calendar_entry_subtitle]")]
      .map((el) => parseEntryText(textOf(el)))
      .filter(Boolean);
    const more = cell.querySelector("[data-testid=view_all_caret_button]");
    const countMatch = ((more && more.getAttribute("aria-label")) || "").match(/(\d+)/);
    const expected = countMatch ? Number(countMatch[1]) : entries.length;
    if (!more || entries.length >= expected) return entries;
    more.click();
    const dialog = await waitFor(() => dialogs().pop(), 3000);
    if (!dialog) return entries;
    const fromDialog = [...dialog.querySelectorAll("button, [role=button]")]
      .map((button) => parseEntryText(textOf(button) || button.getAttribute("aria-label")))
      .filter(Boolean);
    await closeTopDialog();
    return fromDialog.length ? fromDialog : entries;
  }

  async function readCalendar() {
    const cells = [...document.querySelectorAll("[data-testid^=date_cell_]")].filter((cell) =>
      /^date_cell_\d+$/.test(cell.getAttribute("data-testid") || "")
    );
    const weeks = {};
    for (const week of WEEKS) weeks[week.id] = emptyRows();
    for (let index = 0; index < cells.length; index += 1) {
      const week = WEEKS[Math.floor(index / 7)];
      if (!week) continue;
      const day = index % 7;
      const entries = await readCellEntries(cells[index]);
      for (const entry of entries) {
        if (!weeks[week.id][entry.id]) continue;
        weeks[week.id][entry.id][day] += entry.hours;
      }
    }
    return { found: cells.length > 0, weeks };
  }

  function hourInputs() {
    const inputs = allElements(document).filter(
      (el) => el.getAttribute("data-automation-id") === "numericInput" && visible(el)
    );
    return inputs.slice(0, 7);
  }

  async function openQuickAdd() {
    if (hourInputs().length === 7 && findButton("OK")) return;
    if (!findButton("Next") || !document.body.innerText.includes("Select Week")) {
      const actions =
        document.querySelector("[data-testid=actions_button]") || findButton("Actions");
      if (!actions) throw new Error("Open Enter Time, then run Fill from this panel.");
      actions.click();
      const quickAdd = await waitFor(() => findButton("Quick Add"), 4000);
      if (!quickAdd) throw new Error("Quick Add is not in the Actions menu.");
      quickAdd.click();
    }
    const week = await waitFor(
      () => document.body.innerText.includes("Select Week") || findButton("Next"),
      5000
    );
    if (!week) throw new Error("Quick Add did not open.");
  }

  async function selectWeek(label) {
    const radio = await waitFor(() => {
      return allElements(document).find((el) => {
        if (!visible(el)) return false;
        const role = el.getAttribute("role");
        const auto = el.getAttribute("data-automation-id");
        if (role !== "radio" && auto !== "radioBtn") return false;
        return textOf(el).includes(label) || (el.getAttribute("aria-label") || "").includes(label);
      });
    }, 4000);
    if (!radio) throw new Error("Could not find week " + label);
    radio.click();
    await sleep(200);
  }

  async function clickNext() {
    const next = findButton("Next");
    if (!next) throw new Error("Next is not on this Quick Add step.");
    next.click();
    await sleep(400);
  }

  async function selectPosition(job) {
    const selected = () => {
      const el = document.querySelector("[data-automation-id=selectSelectedOption]");
      return el && textOf(el).includes(job.id);
    };
    if (selected()) return;
    const widget = await waitFor(
      () =>
        allElements(document).find(
          (el) => el.getAttribute("data-automation-id") === "selectWidget" && visible(el)
        ),
      4000
    );
    if (!widget) throw new Error("Position list is not on this step.");
    widget.click();
    const option = await waitFor(() => {
      return allElements(document).find((el) => {
        if (el.getAttribute("data-automation-id") !== "promptOption") return false;
        return textOf(el).includes(job.id);
      });
    }, 4000);
    if (!option) throw new Error("Position " + job.id + " is not in the list.");
    option.click();
    const done = await waitFor(selected, 4000);
    if (!done) throw new Error("Could not select " + job.name);
  }

  async function fillInputs(row) {
    const inputs = await waitFor(() => (hourInputs().length === 7 ? hourInputs() : null), 5000);
    if (!inputs) throw new Error("The Monday–Sunday hours grid did not open.");
    inputs.forEach((input, index) => {
      const next = formatHours(row[index]);
      if (numbersClose(input.value, next)) return;
      setNativeValue(input, next);
    });
    return inputs.map((input) => input.value);
  }

  function maybeClickOk(applyOk) {
    if (!applyOk) return false;
    const ok = allElements(document).find((el) => {
      if (!visible(el)) return false;
      const auto = el.getAttribute("data-automation-id") || "";
      const label = textOf(el).toLowerCase();
      return auto === "wd-CommandButton_uic_okButton" || label === "ok";
    });
    if (!ok) throw new Error("OK is not available.");
    ok.click();
    return true;
  }

  async function fillJob(weekId, jobId, applyOk) {
    const week = WEEKS.find((item) => item.id === weekId);
    const job = JOBS.find((item) => item.id === jobId);
    const settings = loadSettings();
    const desired = settings.hours[weekId][jobId].slice();
    const calendar = await readCalendar();
    const existing = calendar.found ? calendar.weeks[weekId][jobId] : null;
    if (existing && sameRow(existing, desired)) {
      return {
        job: job.short,
        week: week.title,
        action: "skipped",
        detail: "already on the calendar",
        values: existing,
      };
    }
    if (sum(desired) === 0 && (!existing || sum(existing) === 0)) {
      return {
        job: job.short,
        week: week.title,
        action: "skipped",
        detail: "0 hours",
        values: desired,
      };
    }
    await openQuickAdd();
    if (document.body.innerText.includes("Select Week")) {
      await selectWeek(week.label);
      await clickNext();
    }
    await selectPosition(job);
    await clickNext();
    const values = await fillInputs(desired);
    const applied = maybeClickOk(applyOk);
    const warning =
      existing && sum(existing) > 0
        ? " Quick Add adds a new block on top of hours already on the calendar."
        : "";
    return {
      job: job.short,
      week: week.title,
      action: applied ? "applied" : "filled",
      detail: (applied ? "OK clicked." : "Left for review. OK was not clicked.") + warning,
      values,
    };
  }

  function describe(result) {
    return (
      result.job +
      " · " +
      result.week +
      ": " +
      result.action +
      " (" +
      result.detail +
      ") [" +
      result.values.map(formatHours).join(", ") +
      "]"
    );
  }

  function ensurePanel(settings) {
    if (document.getElementById("wwh-root")) return;
    const style = document.createElement("style");
    style.textContent = [
      "#wwh-root{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:380px;max-height:86vh;overflow:auto;",
      "background:#fff;color:#1c1c1c;border:1px solid #c6c6c6;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.18);",
      "font:13px/1.4 Segoe UI,sans-serif;padding:12px 14px}",
      "#wwh-root h2{margin:0 0 4px;font-size:15px}",
      "#wwh-root p{margin:0 0 8px;color:#444}",
      "#wwh-root label{display:block;margin:8px 0 4px;font-weight:600}",
      "#wwh-root select,#wwh-root button{font:inherit}",
      "#wwh-root select{width:100%;padding:4px}",
      ".wwh-job{border-top:1px solid #ececec;padding-top:8px;margin-top:8px}",
      ".wwh-job strong{display:block}",
      ".wwh-days{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:6px}",
      ".wwh-days span{font-size:11px;color:#555}",
      ".wwh-days input{width:100%;box-sizing:border-box;padding:3px}",
      "#wwh-actions{display:flex;gap:6px;margin-top:10px;flex-wrap:wrap}",
      "#wwh-actions button{background:#0b63ce;color:#fff;border:0;border-radius:6px;padding:6px 8px;cursor:pointer}",
      "#wwh-actions button.secondary{background:#eee;color:#222}",
      "#wwh-ok{margin-top:8px;font-weight:400}",
      "#wwh-status{white-space:pre-wrap;margin-top:8px;background:#f6f7f9;border-radius:6px;padding:8px}",
    ].join("");
    document.documentElement.appendChild(style);

    const root = document.createElement("div");
    root.id = "wwh-root";
    root.innerHTML = [
      "<h2>Weekly hours</h2>",
      "<p>Places Regular Hours for 4 jobs. Quick Add adds blocks. Submit is never clicked, and OK stays off unless you check it.</p>",
      "<label for='wwh-week'>Week</label><select id='wwh-week'></select>",
      "<label for='wwh-job'>Job to fill</label><select id='wwh-job'></select>",
      "<div id='wwh-jobs'></div>",
      "<label class='wwh-ok' id='wwh-ok'><input id='wwh-apply' type='checkbox'> Click OK after filling</label>",
      "<div id='wwh-actions'>",
      "<button type='button' id='wwh-fill'>Fill selected job</button>",
      "<button type='button' class='secondary' id='wwh-check'>Read calendar</button>",
      "<button type='button' class='secondary' id='wwh-reset'>Reset week</button>",
      "</div>",
      "<div id='wwh-status'>Ready.</div>",
    ].join("");
    document.documentElement.appendChild(root);

    const weekSelect = root.querySelector("#wwh-week");
    const jobSelect = root.querySelector("#wwh-job");
    const jobsHost = root.querySelector("#wwh-jobs");
    const status = root.querySelector("#wwh-status");
    for (const week of WEEKS) {
      const option = document.createElement("option");
      option.value = week.id;
      option.textContent = week.label;
      weekSelect.appendChild(option);
    }
    weekSelect.value = "2026-11-09";
    for (const job of JOBS) {
      const option = document.createElement("option");
      option.value = job.id;
      option.textContent = job.short + " · " + job.id;
      jobSelect.appendChild(option);
    }

    function render() {
      jobsHost.replaceChildren();
      const weekId = weekSelect.value;
      for (const job of JOBS) {
        const section = document.createElement("div");
        section.className = "wwh-job";
        const title = document.createElement("strong");
        const row = settings.hours[weekId][job.id];
        title.textContent = job.short + " · " + formatHours(sum(row)) + " h";
        section.appendChild(title);
        const name = document.createElement("div");
        name.textContent = job.name;
        section.appendChild(name);
        const days = document.createElement("div");
        days.className = "wwh-days";
        DAYS.forEach((day, index) => {
          const wrap = document.createElement("label");
          const caption = document.createElement("span");
          caption.textContent = DAY_LABELS[index];
          const input = document.createElement("input");
          input.type = "number";
          input.min = "0";
          input.step = "0.25";
          input.value = formatHours(row[index]);
          input.setAttribute("aria-label", job.short + " " + DAY_LABELS[index]);
          input.addEventListener("change", () => {
            settings.hours[weekId][job.id][index] = Number(input.value) || 0;
            saveSettings(settings);
            title.textContent = job.short + " · " + formatHours(sum(settings.hours[weekId][job.id])) + " h";
          });
          wrap.append(caption, input);
          days.appendChild(wrap);
        });
        section.appendChild(days);
        jobsHost.appendChild(section);
      }
    }

    function setStatus(message) {
      status.textContent = message;
    }

    weekSelect.addEventListener("change", render);
    root.querySelector("#wwh-reset").addEventListener("click", () => {
      settings.hours[weekSelect.value] = JSON.parse(
        JSON.stringify(DEFAULT_HOURS[weekSelect.value])
      );
      saveSettings(settings);
      render();
      setStatus("Restored the hours read from Workday for this week.");
    });
    root.querySelector("#wwh-check").addEventListener("click", async () => {
      setStatus("Reading the calendar…");
      try {
        const calendar = await readCalendar();
        if (!calendar.found) {
          setStatus("No Enter Time calendar on this page.");
          return;
        }
        const lines = [];
        for (const week of WEEKS) {
          lines.push(week.title);
          for (const job of JOBS) {
            lines.push(
              "  " +
                job.short +
                ": " +
                calendar.weeks[week.id][job.id].map(formatHours).join(", ")
            );
          }
        }
        setStatus(lines.join("\n"));
      } catch (err) {
        setStatus(err.message);
      }
    });
    root.querySelector("#wwh-fill").addEventListener("click", async () => {
      const button = root.querySelector("#wwh-fill");
      button.disabled = true;
      setStatus("Filling " + jobSelect.selectedOptions[0].textContent + "…");
      try {
        const result = await fillJob(
          weekSelect.value,
          jobSelect.value,
          root.querySelector("#wwh-apply").checked
        );
        setStatus(describe(result));
      } catch (err) {
        setStatus(err.message);
      } finally {
        button.disabled = false;
      }
    });
    render();
  }

  const settings = loadSettings();
  ensurePanel(settings);
  window.__wwh = {
    JOBS,
    WEEKS,
    DEFAULT_HOURS,
    loadSettings,
    readCalendar,
    fillJob,
  };
})();

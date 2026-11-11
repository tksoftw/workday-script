// ==UserScript==
// @name         Workday Delete Hours
// @namespace    https://github.com/tksoftw/workday-script
// @version      1.0.0
// @description  Delete Workday time blocks for one week or both visible weeks. Never submits.
// @author       tksoftw
// @match        https://www.myworkday.com/*
// @match        https://*.myworkday.com/*
// @match        https://*.workday.com/*
// @include      /^https?:\/\/([^/?#]*\.)?myworkday\.com(\/|$)/
// @include      /^https?:\/\/([^/?#]*\.)?workday\.com(\/|$)/
// @include      http://127.0.0.1:*/test/*
// @include      http://localhost:*/test/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const WEEKS = [
    { id: "2026-11-02", label: "11/02/2026 - 11/08/2026", title: "Nov 2–8, 2026", start: "2026-11-02" },
    { id: "2026-11-09", label: "11/09/2026 - 11/15/2026", title: "Nov 9–15, 2026", start: "2026-11-09" },
  ];

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function textOf(el) {
    return (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function visible(el) {
    if (!el || (el.closest && el.closest("#wdh-root"))) return false;
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

  function allElements(root) {
    const out = [];
    const visit = (node) => {
      if (!node || !node.querySelectorAll) return;
      for (const el of node.querySelectorAll("*")) {
        if (!el.closest || !el.closest("#wdh-root")) out.push(el);
        if (el.shadowRoot) visit(el.shadowRoot);
      }
    };
    visit(root || document);
    return out;
  }

  function dialogs() {
    return allElements(document).filter((el) => el.getAttribute("role") === "dialog" && visible(el));
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

  function isoDate(start, offset) {
    const date = new Date(start + "T12:00:00");
    date.setDate(date.getDate() + offset);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function datesFor(weekId) {
    const week = WEEKS.find((item) => item.id === weekId);
    if (!week) return [];
    return [0, 1, 2, 3, 4, 5, 6].map((offset) => isoDate(week.start, offset));
  }

  function entryButtons(dates) {
    return allElements(document).filter((el) => {
      if (!visible(el)) return false;
      const id = el.getAttribute("data-testid") || "";
      return dates.some((date) => id.indexOf(date + "_quantity_calendar_entry") === 0);
    });
  }

  function buttonNamed(root, pattern) {
    return [...root.querySelectorAll("button")].find((button) => {
      return visible(button) && pattern.test(textOf(button));
    });
  }

  async function closeTopDialog() {
    const dialog = dialogs().pop();
    if (!dialog) return;
    const close = buttonNamed(dialog, /^close/i);
    if (close) close.click();
    await sleep(250);
  }

  async function openHiddenEntry(dates) {
    const more = allElements(document).find((el) => {
      if (!visible(el)) return false;
      if (el.getAttribute("data-testid") !== "view_all_caret_button") return false;
      const cell = el.closest("[data-testid^=date_cell_]");
      if (!cell) return false;
      const index = Number((cell.getAttribute("data-testid") || "").replace("date_cell_", ""));
      if (!Number.isInteger(index)) return false;
      const weekIndex = Math.floor(index / 7);
      const week = WEEKS[weekIndex];
      return week && dates[0] === week.start;
    });
    if (!more) return false;
    more.click();
    const dialog = await waitFor(() => dialogs().pop(), 4000);
    if (!dialog) return false;
    const entry = [...dialog.querySelectorAll("button")].find((button) => {
      return /hours:/i.test(textOf(button)) && !/^add time$/i.test(textOf(button));
    });
    if (!entry) {
      await closeTopDialog();
      return false;
    }
    entry.click();
    await sleep(300);
    return true;
  }

  async function deleteOpenBlock() {
    const del = await waitFor(() => {
      const dialog = dialogs().find((item) => buttonNamed(item, /^delete$/i));
      return dialog ? buttonNamed(dialog, /^delete$/i) : null;
    }, 5000);
    if (!del) throw new Error("The time block did not offer Delete.");
    const label = textOf(del.closest("[role=dialog]") || del);
    del.click();
    const confirm = await waitFor(() => {
      return dialogs().find((dialog) => /delete time block/i.test(textOf(dialog)));
    }, 4000);
    if (confirm) {
      const confirmButton = buttonNamed(confirm, /^ok$/i);
      if (!confirmButton) throw new Error("Delete Time Block did not offer OK.");
      confirmButton.click();
    }
    await waitFor(() => {
      return !dialogs().some((dialog) => /delete time block|enter time/i.test(textOf(dialog)));
    }, 5000);
    return label.slice(0, 120);
  }

  async function deleteWeek(weekId) {
    const dates = datesFor(weekId);
    const removed = [];
    for (let guard = 0; guard < 40; guard += 1) {
      const button = entryButtons(dates)[0];
      if (!button) {
        const opened = await openHiddenEntry(dates);
        if (!opened) break;
      } else {
        button.click();
        await sleep(300);
      }
      removed.push(await deleteOpenBlock());
      await sleep(400);
    }
    const left = entryButtons(dates).length;
    if (left) throw new Error(left + " blocks are still on " + weekId + ".");
    return removed;
  }

  function selectedWeekIds() {
    const value = document.querySelector("#wdh-week").value;
    if (value === "both") return WEEKS.map((week) => week.id);
    return [value];
  }

  function ensurePanel() {
    if (document.getElementById("wdh-root")) return;
    const style = document.createElement("style");
    style.textContent = [
      "#wdh-root{position:fixed;left:16px;bottom:16px;z-index:2147483646;width:320px;",
      "background:#fff;color:#1c1c1c;border:1px solid #c6c6c6;border-radius:12px;",
      "box-shadow:0 10px 30px rgba(0,0,0,.18);font:13px/1.4 Segoe UI,sans-serif;padding:12px 14px}",
      "#wdh-root h2{margin:0 0 6px;font-size:15px}",
      "#wdh-root p,#wdh-root label{margin:0 0 8px}",
      "#wdh-root select{width:100%;font:inherit;margin-bottom:8px}",
      "#wdh-root button{font:inherit;background:#9b1c1c;color:#fff;border:0;border-radius:6px;padding:6px 8px;cursor:pointer}",
      "#wdh-root button:disabled{opacity:.45;cursor:default}",
      "#wdh-status{white-space:pre-wrap;background:#f6f7f9;border-radius:6px;padding:8px;margin-top:8px}",
    ].join("");
    document.documentElement.appendChild(style);
    const root = document.createElement("div");
    root.id = "wdh-root";
    root.innerHTML = [
      "<h2>Delete hours</h2>",
      "<p>Removes time blocks for the week you pick. It never clicks Submit.</p>",
      "<select id='wdh-week'></select>",
      "<label><input id='wdh-confirm' type='checkbox'> Delete these blocks</label>",
      "<button type='button' id='wdh-go' disabled>Delete</button>",
      "<div id='wdh-status'>Choose a week and confirm.</div>",
    ].join("");
    document.documentElement.appendChild(root);
    const select = root.querySelector("#wdh-week");
    for (const week of WEEKS) {
      const option = document.createElement("option");
      option.value = week.id;
      option.textContent = week.title;
      select.appendChild(option);
    }
    const both = document.createElement("option");
    both.value = "both";
    both.textContent = "Both weeks";
    select.appendChild(both);
    select.value = "2026-11-02";
    const confirm = root.querySelector("#wdh-confirm");
    const button = root.querySelector("#wdh-go");
    const status = root.querySelector("#wdh-status");
    const arm = () => {
      button.disabled = !confirm.checked;
    };
    confirm.addEventListener("change", arm);
    select.addEventListener("change", () => {
      confirm.checked = false;
      arm();
      status.textContent = "Confirm again before deleting " + select.selectedOptions[0].textContent + ".";
    });
    button.addEventListener("click", async () => {
      if (!confirm.checked) return;
      button.disabled = true;
      const ids = selectedWeekIds();
      status.textContent = "Deleting " + ids.join(", ") + "…";
      try {
        const lines = [];
        for (const id of ids) {
          const removed = await deleteWeek(id);
          lines.push(id + ": removed " + removed.length);
        }
        status.textContent = lines.join("\n") + "\nTimesheet was not submitted.";
      } catch (err) {
        status.textContent = err.message;
      } finally {
        confirm.checked = false;
        arm();
      }
    });
  }

  ensurePanel();
  window.__wdh = { WEEKS, datesFor, deleteWeek, entryButtons };
})();

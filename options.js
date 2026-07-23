// options.js — full exception list management
const addInput = document.getElementById("addInput");
const addBtn = document.getElementById("addBtn");
const addError = document.getElementById("addError");
const searchInput = document.getElementById("searchInput");
const clearAllBtn = document.getElementById("clearAllBtn");
const listEl = document.getElementById("list");
const metaEl = document.getElementById("meta");

let whitelist = [];

function normalizeHost(raw) {
  let value = String(raw || "").trim().toLowerCase();
  if (!value) return "";
  value = value.replace(/^https?:\/\//, "");
  value = value.split("/")[0];
  value = value.split("?")[0];
  value = value.replace(/:\d+$/, "");
  value = value.replace(/^\.+|\.+$/g, "");
  if (!value || value.includes(" ") || !value.includes(".")) return "";
  // Basic hostname check
  if (!/^[a-z0-9.-]+$/.test(value)) return "";
  return value;
}

function showError(message) {
  addError.textContent = message || "";
  addError.classList.toggle("is-visible", !!message);
}

function saveList(list, callback) {
  const next = [...new Set(list.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
  chrome.storage.sync.set({ whitelist: next }, () => {
    whitelist = next;
    render();
    if (callback) callback();
  });
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = query
    ? whitelist.filter((site) => site.toLowerCase().includes(query))
    : whitelist;

  listEl.innerHTML = "";

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = whitelist.length
      ? "No matches"
      : "No exceptions yet";
    listEl.appendChild(empty);
  } else {
    filtered.forEach((site) => {
      const row = document.createElement("div");
      row.className = "item";

      const label = document.createElement("div");
      label.className = "item-host";
      label.textContent = site;
      label.title = site;

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "item-remove";
      removeBtn.setAttribute("aria-label", `Remove ${site}`);
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", () => {
        saveList(whitelist.filter((entry) => entry !== site));
      });

      row.appendChild(label);
      row.appendChild(removeBtn);
      listEl.appendChild(row);
    });
  }

  if (!whitelist.length) {
    metaEl.textContent = "0 sites exempted";
  } else if (query) {
    metaEl.textContent = `Showing ${filtered.length} of ${whitelist.length}`;
  } else {
    metaEl.textContent = `${whitelist.length} site${
      whitelist.length === 1 ? "" : "s"
    } exempted`;
  }

  clearAllBtn.disabled = whitelist.length === 0;
}

function addSite() {
  const host = normalizeHost(addInput.value);
  if (!host) {
    showError("Enter a valid hostname like example.com");
    addInput.focus();
    return;
  }
  if (whitelist.includes(host)) {
    showError("That site is already in the list");
    return;
  }
  showError("");
  saveList([...whitelist, host], () => {
    addInput.value = "";
    addInput.focus();
  });
}

addBtn.addEventListener("click", addSite);
addInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addSite();
  }
});

searchInput.addEventListener("input", render);

clearAllBtn.addEventListener("click", () => {
  if (!whitelist.length) return;
  if (confirm(`Remove all ${whitelist.length} exceptions?`)) {
    saveList([]);
  }
});

chrome.storage.sync.get(["whitelist"], ({ whitelist: stored = [] }) => {
  whitelist = Array.isArray(stored) ? stored : [];
  render();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes.whitelist) return;
  whitelist = Array.isArray(changes.whitelist.newValue)
    ? changes.whitelist.newValue
    : [];
  render();
});

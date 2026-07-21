/* ============================================================
   LEDGER — app.js
   All data lives in the browser's localStorage, so it stays on
   whichever device/browser you use the site from. No server,
   no account — open source and easy to self-host on GitHub Pages.
   ============================================================ */

const STORE_KEY = "ledger_transactions_v1";
const GOALS_KEY = "ledger_goals_v1";

/* ---------- storage helpers ---------- */

function loadTransactions() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveTransactions(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

function loadGoals() {
  try {
    return JSON.parse(localStorage.getItem(GOALS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveGoals(list) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(list));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmt(amount) {
  const n = Number(amount) || 0;
  const sign = n < 0 ? "-" : "";
  return sign + "RM " + Math.abs(n).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function currentMonthKey(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

/* === FORMULA: distribute income into deductions + a daily spending budget.
   Unallocated = whatever's left after both — a true residual, not the daily pool.
   Shared by the Monthly Budget page and the Daily Spending page. */
function computeMonthlyAllocation(monthKey) {
  const all = loadTransactions().filter((t) => t.date.startsWith(monthKey));
  const totalIncome = all.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalDeduction = all.filter((t) => t.type === "deduction").reduce((s, t) => s + t.amount, 0);
  const dailyBudget = all.filter((t) => t.type === "budget").reduce((s, t) => s + t.amount, 0);
  const unallocated = totalIncome - totalDeduction - dailyBudget;
  return { totalIncome, totalDeduction, dailyBudget, unallocated };
}

/* ============================================================
   BUDGET PAGE (index.html) — income & deductions -> leftover
   ============================================================ */

function initBudgetPage() {
  const form = document.getElementById("txn-form");
  if (!form) return; // not on this page

  const monthInput = document.getElementById("month-select");
  const list = document.getElementById("ledger-list");
  const incomeFigure = document.getElementById("total-income");
  const breakdown = document.getElementById("category-breakdown");
  const emptyState = document.getElementById("empty-state");

  monthInput.value = currentMonthKey();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const type = form.querySelector('input[name="kind"]:checked').value; // "income" | "deduction" | "budget"
    const category = document.getElementById("txn-category").value.trim();
    const amount = parseFloat(document.getElementById("txn-amount").value);
    const date = document.getElementById("txn-date").value || new Date().toISOString().slice(0, 10);
    const note = document.getElementById("txn-note").value.trim();

    if (!category || !amount || amount <= 0) return;

    const all = loadTransactions();
    all.push({ id: uid(), type, category, amount, date, note });
    saveTransactions(all);

    form.reset();
    document.getElementById("txn-date").value = date;
    render();
  });

  monthInput.addEventListener("change", render);

  list.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete]");
    if (!btn) return;
    const all = loadTransactions().filter((t) => t.id !== btn.dataset.delete);
    saveTransactions(all);
    render();
  });

  function render() {
    const monthKey = monthInput.value || currentMonthKey();
    const all = loadTransactions().filter((t) => t.date.startsWith(monthKey) && t.type !== "daily");
    all.sort((a, b) => (a.date < b.date ? 1 : -1));

    const { totalIncome, totalDeduction, dailyBudget, unallocated } = computeMonthlyAllocation(monthKey);
    incomeFigure.textContent = fmt(totalIncome);

    // === FORMULA: distribution = every deduction/budget category, grouped, as a % of total income ===
    const catTotals = {}; // category -> { amount, kind }
    all.filter((t) => t.type === "deduction" || t.type === "budget").forEach((t) => {
      if (!catTotals[t.category]) catTotals[t.category] = { amount: 0, kind: t.type };
      catTotals[t.category].amount += t.amount;
    });
    const catEntries = Object.entries(catTotals).sort((a, b) => b[1].amount - a[1].amount);

    breakdown.innerHTML = "";
    if (totalIncome <= 0) {
      breakdown.innerHTML = '<p class="empty-state">Add income to see it distributed.</p>';
    } else {
      if (catEntries.length === 0) {
        breakdown.innerHTML = '<p class="empty-state">Add a deduction or daily budget to see the distribution.</p>';
      }
      catEntries.forEach(([cat, info]) => {
        const pct = (info.amount / totalIncome) * 100;
        const barColor = info.kind === "budget" ? "var(--gold-500)" : "var(--brick-600)";
        const row = document.createElement("div");
        row.className = "bar-row";
        row.innerHTML = `
          <div class="bar-label-row">
            <span>${escapeHtml(cat)}</span>
            <span class="amt">${fmt(info.amount)} · ${pct.toFixed(0)}%</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(pct, 100)}%; background:${barColor}"></div></div>
        `;
        breakdown.appendChild(row);
      });
      // === FORMULA: unallocated = income - deductions - daily budget, as a % of income ===
      if (unallocated !== 0) {
        const pct = (unallocated / totalIncome) * 100;
        const row = document.createElement("div");
        row.className = "bar-row";
        row.innerHTML = `
          <div class="bar-label-row">
            <span>${unallocated < 0 ? "Over-allocated" : "Unallocated"}</span>
            <span class="amt">${fmt(unallocated)} · ${pct.toFixed(0)}%</span>
          </div>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(Math.abs(pct), 100)}%; background:${unallocated < 0 ? "var(--brick-600)" : "var(--text-400)"}"></div></div>
        `;
        breakdown.appendChild(row);
      }
    }

    // list
    list.innerHTML = "";
    if (all.length === 0) {
      emptyState.style.display = "block";
    } else {
      emptyState.style.display = "none";
      all.forEach((t) => {
        const cls = t.type === "income" ? "income" : t.type === "budget" ? "budget" : "expense";
        const sign = t.type === "income" ? "+" : "-";
        const li = document.createElement("li");
        li.className = "ledger-item";
        li.innerHTML = `
          <div class="ledger-main">
            <div class="ledger-category">${escapeHtml(t.category)}</div>
            <div class="ledger-meta">${t.date}${t.note ? " · " + escapeHtml(t.note) : ""}</div>
          </div>
          <div class="ledger-amount ${cls}">${sign}${fmt(t.amount)}</div>
          <button class="ledger-delete" data-delete="${t.id}" aria-label="Delete entry" title="Delete">✕</button>
        `;
        list.appendChild(li);
      });
    }
  }

  render();
}

/* ============================================================
   SAVINGS GOALS PAGE (savings.html)
   ============================================================ */

function initGoalsPage() {
  const form = document.getElementById("goal-form");
  if (!form) return; // not on this page

  const grid = document.getElementById("goal-grid");
  const emptyState = document.getElementById("goals-empty");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("goal-name").value.trim();
    const target = parseFloat(document.getElementById("goal-target").value);
    const saved = parseFloat(document.getElementById("goal-saved").value) || 0;
    const deadline = document.getElementById("goal-deadline").value;

    if (!name || !target || target <= 0 || !deadline) return;

    const goals = loadGoals();
    goals.push({ id: uid(), name, target, saved, deadline });
    saveGoals(goals);
    form.reset();
    render();
  });

  grid.addEventListener("click", (e) => {
    const del = e.target.closest("[data-delete-goal]");
    if (del) {
      const goals = loadGoals().filter((g) => g.id !== del.dataset.deleteGoal);
      saveGoals(goals);
      render();
      return;
    }
    const addBtn = e.target.closest("[data-add-saved]");
    if (addBtn) {
      const amount = parseFloat(prompt("Add how much to this goal? (RM)", "0"));
      if (!amount || amount <= 0) return;
      const goals = loadGoals();
      const g = goals.find((g) => g.id === addBtn.dataset.addSaved);
      if (g) g.saved = (g.saved || 0) + amount;
      saveGoals(goals);
      render();
    }
  });

  function monthsBetween(from, to) {
    // === FORMULA: months left = whole calendar months between today and the deadline, rounded up, minimum 1 ===
    let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (to.getDate() > from.getDate()) months += 1;
    return Math.max(months, 1);
  }

  function render() {
    const goals = loadGoals();
    grid.innerHTML = "";

    if (goals.length === 0) {
      emptyState.style.display = "block";
      return;
    }
    emptyState.style.display = "none";

    const today = new Date();

    goals.forEach((g) => {
      // === FORMULA: % achieved = saved so far / target ===
      const pct = g.target > 0 ? Math.min(g.saved / g.target, 1) * 100 : 0;
      // === FORMULA: still need = target - saved (floor at 0) ===
      const stillNeed = Math.max(g.target - g.saved, 0);
      const deadlineDate = new Date(g.deadline + "T00:00:00");
      const monthsLeft = monthsBetween(today, deadlineDate);
      // === FORMULA: needed per month = still need / months left ===
      const neededPerMonth = stillNeed / monthsLeft;
      const reached = g.saved >= g.target;

      const card = document.createElement("div");
      card.className = "goal-card";
      card.innerHTML = `
        <div class="goal-head">
          <div>
            <div class="goal-name">${escapeHtml(g.name)}</div>
            <div class="ledger-meta">by ${g.deadline}</div>
          </div>
          <button class="ledger-delete" data-delete-goal="${g.id}" aria-label="Delete goal" title="Delete">✕</button>
        </div>
        <div class="goal-jar"><div class="goal-jar-fill" style="width:${pct}%"></div></div>
        <div class="goal-stats">
          <div>
            <div class="goal-stat-label">Saved / Target</div>
            <div class="goal-stat-value">${fmt(g.saved)} / ${fmt(g.target)}</div>
          </div>
          <div>
            <div class="goal-stat-label">% Achieved</div>
            <div class="goal-stat-value">${pct.toFixed(1)}%</div>
          </div>
          <div>
            <div class="goal-stat-label">Still Need</div>
            <div class="goal-stat-value">${fmt(stillNeed)}</div>
          </div>
          <div>
            <div class="goal-stat-label">${reached ? "Reached 🎉" : "Needed / Month"}</div>
            <div class="goal-stat-value">${reached ? "—" : fmt(neededPerMonth)}</div>
          </div>
        </div>
        <button class="btn btn-ghost" style="margin-top:14px" data-add-saved="${g.id}">+ Add to savings</button>
      `;
      grid.appendChild(card);
    });
  }

  render();
}

/* ============================================================
   DAILY SPENDING PAGE (daily.html)
   ============================================================ */

function initDailyPage() {
  const monthInput = document.getElementById("daily-month-select");
  if (!monthInput) return; // not on this page

  const form = document.getElementById("daily-form");
  const container = document.getElementById("daily-list");
  const hideEmptyToggle = document.getElementById("hide-empty-days");
  const budgetFigure = document.getElementById("leftover-budget");
  const spentFigure = document.getElementById("spent-so-far");
  const remainingFigure = document.getElementById("remaining-figure");
  const dailyAvg = document.getElementById("daily-avg");
  const dailySuggested = document.getElementById("daily-suggested");

  monthInput.value = currentMonthKey();
  const dateInput = document.getElementById("daily-date");
  dateInput.value = new Date().toISOString().slice(0, 10);

  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const category = document.getElementById("daily-category").value.trim();
    const amount = parseFloat(document.getElementById("daily-amount").value);
    const date = dateInput.value || new Date().toISOString().slice(0, 10);
    const note = document.getElementById("daily-note").value.trim();

    if (!category || !amount || amount <= 0) return;

    const all = loadTransactions();
    all.push({ id: uid(), type: "daily", category, amount, date, note });
    saveTransactions(all);

    form.reset();
    dateInput.value = date;
    monthInput.value = date.slice(0, 7);
    render();
  });

  monthInput.addEventListener("change", render);
  hideEmptyToggle.addEventListener("change", render);

  container.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-delete]");
    if (!btn) return;
    const all = loadTransactions().filter((t) => t.id !== btn.dataset.delete);
    saveTransactions(all);
    render();
  });

  function render() {
    const monthKey = monthInput.value || currentMonthKey();
    const [y, m] = monthKey.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    // === FORMULA: this month's daily budget, allocated on the Monthly Budget page ===
    const { dailyBudget } = computeMonthlyAllocation(monthKey);

    const dailyEntries = loadTransactions()
      .filter((t) => t.type === "daily" && t.date.startsWith(monthKey))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    // === FORMULA: spent so far = SUM(amount) of this month's daily entries ===
    const spent = dailyEntries.reduce((s, t) => s + t.amount, 0);
    // === FORMULA: remaining = daily budget - spent so far ===
    const remaining = dailyBudget - spent;

    budgetFigure.textContent = fmt(dailyBudget);
    spentFigure.textContent = fmt(spent);
    remainingFigure.textContent = fmt(remaining);
    remainingFigure.className = "receipt-balance-figure " + (remaining >= 0 ? "positive" : "negative");

    // === FORMULA: days elapsed / days remaining in the month, for a daily-average read ===
    const today = new Date();
    const isCurrentMonth = currentMonthKey(today) === monthKey;
    const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;
    const daysRemaining = Math.max(daysInMonth - daysElapsed, 1);

    // === FORMULA: average daily spend so far = spent so far / days elapsed ===
    const avgDaily = spent / daysElapsed;
    // === FORMULA: suggested daily spend for the rest of the month = remaining / days remaining ===
    const suggestedDaily = isCurrentMonth ? remaining / daysRemaining : null;

    dailyAvg.textContent = fmt(avgDaily) + " / day so far";
    dailySuggested.textContent = isCurrentMonth
      ? fmt(suggestedDaily) + " / day for the " + daysRemaining + " day(s) left"
      : "Not the current month";

    // === FORMULA: group daily entries by exact date ===
    const byDate = {};
    dailyEntries.forEach((t) => {
      (byDate[t.date] = byDate[t.date] || []).push(t);
    });

    container.innerHTML = "";
    const hideEmpty = hideEmptyToggle.checked;

    for (let day = daysInMonth; day >= 1; day--) {
      const dateStr = `${monthKey}-${String(day).padStart(2, "0")}`;
      const entries = byDate[dateStr] || [];

      if (entries.length === 0 && hideEmpty) continue;

      // === FORMULA: daily total spent = SUM(amount) for that date ===
      const dayTotal = entries.reduce((s, t) => s + t.amount, 0);
      const weekday = WEEKDAYS[new Date(dateStr + "T00:00:00").getDay()];

      const block = document.createElement("div");
      block.className = "day-block";
      block.innerHTML = `
        <div class="day-head">
          <span><span class="day-date">${dateStr}</span><span class="day-weekday">${weekday}</span></span>
          <span class="day-total ${entries.length ? "negative" : "zero"}">${entries.length ? fmt(dayTotal) : "—"}</span>
        </div>
      `;

      if (entries.length > 0) {
        const list = document.createElement("div");
        list.className = "day-entries";
        entries.forEach((t) => {
          const row = document.createElement("div");
          row.className = "day-entry";
          row.innerHTML = `
            <span>${escapeHtml(t.category)}${t.note ? " · " + escapeHtml(t.note) : ""}</span>
            <span class="day-entry-right">
              <span class="amt expense">-${fmt(t.amount)}</span>
              <button class="ledger-delete" data-delete="${t.id}" aria-label="Delete entry" title="Delete">✕</button>
            </span>
          `;
          list.appendChild(row);
        });
        block.appendChild(list);
      }

      container.appendChild(block);
    }

    if (container.children.length === 0) {
      container.innerHTML = '<p class="empty-state">No entries this month.</p>';
    }
  }

  render();
}

/* ============================================================
   BACKUP — export / import all data as a single JSON file
   ============================================================ */

function initBackupBar() {
  const exportBtn = document.getElementById("export-btn");
  const importBtn = document.getElementById("import-btn");
  const importInput = document.getElementById("import-input");
  if (!exportBtn) return; // not on this page

  exportBtn.addEventListener("click", () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      transactions: loadTransactions(),
      goals: loadGoals(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `ledger-backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  importBtn.addEventListener("click", () => importInput.click());

  importInput.addEventListener("change", () => {
    const file = importInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try {
        data = JSON.parse(reader.result);
      } catch {
        alert("That file isn't valid JSON — nothing was changed.");
        return;
      }
      if (!Array.isArray(data.transactions) && !Array.isArray(data.goals)) {
        alert("That file doesn't look like a Ledger backup — nothing was changed.");
        return;
      }
      const ok = confirm(
        "This will REPLACE all current entries and goals in this browser with the contents of the file. This can't be undone. Continue?"
      );
      if (!ok) return;

      if (Array.isArray(data.transactions)) saveTransactions(data.transactions);
      if (Array.isArray(data.goals)) saveGoals(data.goals);
      alert("Backup restored.");
      location.reload();
    };
    reader.readAsText(file);
    importInput.value = "";
  });
}

/* ---------- utils ---------- */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.addEventListener("DOMContentLoaded", () => {
  initBudgetPage();
  initGoalsPage();
  initDailyPage();
  initBackupBar();
});

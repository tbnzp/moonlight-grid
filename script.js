// Data structure containing default pricing categories, items, notes, and bundles
const DEFAULT_DATA = [
  // ... Graphics, Formats, Academic/Creative Commissions, and Art/Architecture categories ...
  ];

// State variables for catalog, orders, filter selection, edit mode, and active calculator items
let catalog = JSON.parse(localStorage.getItem("mg_catalog")) || structuredClone(DEFAULT_DATA);
let orders = JSON.parse(localStorage.getItem("mg_orders")) || [];
let activeFilter = "All";
let editMode = false;
let selectedCalcIds = new Set();

// Tab Switching logic
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// Render Pricelist & Category Filters
function renderFilters() {
  const container = document.getElementById("categoryFilters");
  const categories = ["All", ...catalog.map(c => c.category)];
  container.innerHTML = categories.map(cat =>
    `<button class="filter-pill ${activeFilter === cat ? "active" : ""}" onclick="setFilter('${cat}')">${cat}</button>`
  ).join("");
}

function setFilter(cat) {
  activeFilter = cat;
  renderFilters();
  renderPricelist();
}

function renderPricelist() {
  const container = document.getElementById("pricelistContainer");
  const filtered = activeFilter === "All" ? catalog : catalog.filter(c => c.category === activeFilter);

  container.innerHTML = filtered.map(group => `
    <div class="card">
      <h3>☾ ${group.category}</h3>
      ${group.items.map(item => `
        <div class="price-item">
          <div class="item-name">
            ${item.name} ${item.isBundle ? "✨" : ""}
            ${item.note ? `<small>${item.note}</small>` : ""}
          </div>
          ${editMode
            ? `<input type="number" class="edit-price-input" value="${item.price}" onchange="updatePrice('${item.id}', this.value)" />`
            : `<span class="price-tag">₱${item.price.toLocaleString()}</span>`
          }
        </div>
      `).join("")}
    </div>
  `).join("");
}

function updatePrice(itemId, newPrice) {
  const val = Math.max(0, Number(newPrice) || 0);
  catalog.forEach(group => {
    const found = group.items.find(i => i.id === itemId);
    if (found) found.price = val;
  });
  localStorage.setItem("mg_catalog", JSON.stringify(catalog));
  renderCalculatorChecklist();
  recalculateQuote();
}

document.getElementById("editModeToggle").addEventListener("change", (e) => {
  editMode = e.target.checked;
  document.getElementById("exportDataBtn").classList.toggle("hidden", !editMode);
  document.getElementById("resetDataBtn").classList.toggle("hidden", !editMode);
  renderPricelist();
});

document.getElementById("exportDataBtn").addEventListener("click", () => {
  const code = `const DEFAULT_DATA = ${JSON.stringify(catalog, null, 2)};`;
  navigator.clipboard.writeText(code);
  alert("Updated price data copied! Paste it over DEFAULT_DATA in script.js on GitHub to make it permanent.");
});

document.getElementById("resetDataBtn").addEventListener("click", () => {
  if (confirm("Reset all prices back to original defaults?")) {
    catalog = structuredClone(DEFAULT_DATA);
    localStorage.removeItem("mg_catalog");
    renderPricelist();
    renderCalculatorChecklist();
    recalculateQuote();
  }
});

// Bundle vs Individual Calculator Initialization and Logic
function initCalculator() {
  const select = document.getElementById("calcCategorySelect");
  select.innerHTML = catalog.map((g, idx) => `<option value="${idx}">${g.category}</option>`).join("");
  select.addEventListener("change", renderCalculatorChecklist);
  document.getElementById("affiliationAddon").addEventListener("change", recalculateQuote);
  document.getElementById("rushSelect").addEventListener("change", recalculateQuote);
  renderCalculatorChecklist();
}

function renderCalculatorChecklist() {
  const idx = document.getElementById("calcCategorySelect").value || 0;
  const items = catalog[idx]?.items || [];
  const list = document.getElementById("calcItemList");

  list.innerHTML = items.map(item => `
    <label class="check-row">
      <span>
        <input type="checkbox" ${selectedCalcIds.has(item.id) ? "checked" : ""} onchange="toggleCalcItem('${item.id}')" />
        ${item.name}
      </span>
      <strong>₱${item.price}</strong>
    </label>
  `).join("");
}

function toggleCalcItem(id) {
  if (selectedCalcIds.has(id)) selectedCalcIds.delete(id);
  else selectedCalcIds.add(id);
  recalculateQuote();
}

function recalculateQuote() {
  const allItems = catalog.flatMap(g => g.items);
  const picked = allItems.filter(i => selectedCalcIds.has(i.id));
  const summaryEl = document.getElementById("selectedItemsSummary");
  const tipEl = document.getElementById("bundleTipBox");

  if (picked.length === 0) {
    summaryEl.innerHTML = "No items selected yet.";
    document.getElementById("baseSubtotal").textContent = "₱0";
    document.getElementById("addonSubtotal").textContent = "₱0";
    document.getElementById("grandTotal").textContent = "₱0";
    document.getElementById("paymentSplitNote").textContent = "Select services to view payment terms.";
    tipEl.classList.add("hidden");
    return;
  }

  summaryEl.innerHTML = picked.map(i => `<div>• ${i.name} (₱${i.price})</div>`).join("");

  const base = picked.reduce((sum, i) => sum + i.price, 0);
  const affFee = document.getElementById("affiliationAddon").checked ? 10 : 0;
  const mult = Number(document.getElementById("rushSelect").value) || 1;
  const total = Math.round((base + affFee) * mult);
  const extraFee = total - base;

  document.getElementById("baseSubtotal").textContent = `₱${base.toLocaleString()}`;
  document.getElementById("addonSubtotal").textContent = `₱${extraFee.toLocaleString()}`;
  document.getElementById("grandTotal").textContent = `₱${total.toLocaleString()}`;

  const splitNote = total > 100
    ? `Required Down Payment (50%): ₱${Math.ceil(total / 2).toLocaleString()} | Balance upon completion: ₱${Math.floor(total / 2).toLocaleString()}`
    : `Full Payment Required Upfront (₱100 or below): ₱${total.toLocaleString()}`;
  document.getElementById("paymentSplitNote").textContent = splitNote;

  // Smart Bundle Comparison Hint logic
  const hasMultipleLayouts = picked.filter(i => i.id.startsWith("g") && !i.id.startsWith("go") && !i.isBundle).length >= 2;
  const hasMultipleFormats = picked.filter(i => i.id.startsWith("f") && !i.id.startsWith("fo") && !i.isBundle).length >= 2;

  if (hasMultipleLayouts && base >= 80) {
    tipEl.textContent = "💡 Bundle Tip: The Account Layout Bundle is ₱100 for Profile + Cover + Highlights + Pinned!";
    tipEl.classList.remove("hidden");
  } else if (hasMultipleFormats && base >= 35) {
    tipEl.textContent = "💡 Bundle Tip: The Complete OC/IC Format Bundle is only ₱40 for all 4 format items!";
    tipEl.classList.remove("hidden");
  } else {
    tipEl.classList.add("hidden");
  }
}

document.getElementById("copyQuoteBtn").addEventListener("click", () => {
  const allItems = catalog.flatMap(g => g.items);
  const picked = allItems.filter(i => selectedCalcIds.has(i.id));
  if (!picked.length) return alert("Select at least one item first.");

  const lines = picked.map(i => `- ${i.name}: ₱${i.price}`).join("\n");
  const total = document.getElementById("grandTotal").textContent;
  const note = document.getElementById("paymentSplitNote").textContent;
  const text = `☾ MOONLIGHT GRID QUOTE\n${lines}\n\nEstimated Total: ${total}\n${note}\nPayment via GCash, MariBank, or BPI.`;
  navigator.clipboard.writeText(text);
  alert("Quote copied to clipboard!");
});

// Client Order Tracker Management
document.getElementById("orderForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const newOrder = {
    id: Date.now(),
    client: document.getElementById("clientName").value.trim(),
    details: document.getElementById("orderDetails").value.trim(),
    deadline: document.getElementById("orderDeadline").value,
    price: Number(document.getElementById("orderPrice").value) || 0,
    payment: document.getElementById("orderPaymentStatus").value,
    status: document.getElementById("orderStatus").value
  };
  orders.unshift(newOrder);
  saveAndRenderOrders();
  e.target.reset();
});

function updateOrderField(id, field, value) {
  const order = orders.find(o => o.id === id);
  if (order) {
    order[field] = value;
    saveAndRenderOrders();
  }
}

function deleteOrder(id) {
  if (confirm("Delete this order?")) {
    orders = orders.filter(o => o.id !== id);
    saveAndRenderOrders();
  }
}

function saveAndRenderOrders() {
  localStorage.setItem("mg_orders", JSON.stringify(orders));
  const tbody = document.getElementById("orderTableBody");
  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted">No orders tracked yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(o => {
    const balance = o.payment === "Fully Paid" ? 0 : o.payment === "50% DP Paid" ? Math.floor(o.price / 2) : o.price;
    return `
      <tr>
        <td><strong>${o.client}</strong></td>
        <td>${o.details}</td>
        <td>${o.deadline}</td>
        <td>₱${o.price.toLocaleString()}</td>
        <td>
          <select onchange="updateOrderField(${o.id}, 'payment', this.value)">
            <option ${o.payment === "Unpaid" ? "selected" : ""}>Unpaid</option>
            <option ${o.payment === "50% DP Paid" ? "selected" : ""}>50% DP Paid</option>
            <option ${o.payment === "Fully Paid" ? "selected" : ""}>Fully Paid</option>
          </select>
        </td>
        <td>₱${balance.toLocaleString()}</td>
        <td>
          <select onchange="updateOrderField(${o.id}, 'status', this.value)">
            <option ${o.status === "Pending" ? "selected" : ""}>Pending</option>
            <option ${o.status === "In Progress" ? "selected" : ""}>In Progress</option>
            <option ${o.status === "For Revision" ? "selected" : ""}>For Revision</option>
            <option ${o.status === "Completed" ? "selected" : ""}>Completed</option>
          </select>
        </td>
        <td><button class="btn-danger" onclick="deleteOrder(${o.id})">✕</button></td>
      </tr>
    `;
  }).join("");
}

// Initial Execution on Page Load
renderFilters();
renderPricelist();
initCalculator();
recalculateQuote();
saveAndRenderOrders();

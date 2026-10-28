import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const initialProducts = [
  { id: "p1", title: "The Sunday Shirt", category: "Tops", price: 650, size: "M", condition: "Like new", tag: "JUST FOUND", image: "https://images.unsplash.com/photo-1598554747436-c9293d6a588f?auto=format&fit=crop&w=800&q=85", description: "A soft, easy cotton button-down with just the right amount of slouch. Your new every-day, anything-goes shirt.", measurements: { "Chest width": "21 in", "Length": "27 in", "Shoulder width": "18 in", "Sleeve": "23 in" } },
  { id: "p2", title: "Soft Hours Knit", category: "Tops", price: 780, size: "S–M", condition: "Excellent", tag: "ONE OF ONE", image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=800&q=85", description: "A buttery-soft knit in a warm, goes-with-everything neutral. Gently worn and ready for slow mornings.", measurements: { "Chest width": "19 in", "Length": "23 in", "Shoulder width": "16 in", "Sleeve": "22 in" } },
  { id: "p3", title: "Weekend Denim", category: "Bottoms", price: 920, size: "28", condition: "Good vintage", tag: "GOOD VINTAGE", image: "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=85", description: "Broken-in denim with a straight leg and a little bit of lived-in magic. The kind you keep reaching for.", measurements: { "Waist": "28 in", "Hip": "38 in", "Rise": "11 in", "Inseam": "29 in" } },
  { id: "p4", title: "Sunday Best Dress", category: "Dresses", price: 1150, size: "S", condition: "Excellent", tag: "A RARE FIND", image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=800&q=85", description: "An effortless little dress that can do a coffee date or a dance floor. Lightweight, lovely, and just one.", measurements: { "Chest width": "17 in", "Length": "44 in", "Shoulder width": "14 in", "Waist": "15 in" } },
  { id: "p5", title: "The Old Favorite", category: "Outerwear", price: 1480, size: "M", condition: "Good vintage", tag: "ONE LEFT", image: "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=800&q=85", description: "A beautifully broken-in layer with lots of life left. Wear it over everything, everywhere.", measurements: { "Chest width": "22 in", "Length": "25 in", "Shoulder width": "19 in", "Sleeve": "24 in" } },
  { id: "p6", title: "Easy Days Trousers", category: "Bottoms", price: 850, size: "27", condition: "Like new", tag: "JUST FOUND", image: "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=800&q=85", description: "Relaxed, roomy trousers with a high rise and a soft drape. A good outfit starts here.", measurements: { "Waist": "27 in", "Hip": "39 in", "Rise": "12 in", "Inseam": "28 in" } }
];
const GCASH_QR_IMAGE = "gcash-qr.jpg";
const backendConfig = window.STORE_BACKEND_CONFIG || {};
const supabase = backendConfig.url && backendConfig.anonKey
  ? createClient(backendConfig.url, backendConfig.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;
const apiBaseUrl = String(backendConfig.apiBaseUrl || "").replace(/\/+$/, "");
localStorage.removeItem("rewear-reservation-token");

const state = {
  products: supabase ? [] : (JSON.parse(localStorage.getItem("rewear-products") || "null") || initialProducts)
    .map(product => ({ ...product, is_featured: product.is_featured ?? true })),
  cart: JSON.parse(localStorage.getItem("rewear-cart") || "[]"),
  orders: supabase ? [] : JSON.parse(localStorage.getItem("rewear-orders") || "[]"),
  category: "All",
  sort: "featured",
  selectedPayment: "COD",
  editId: null,
  isAdmin: false,
  authUser: null
};
const $ = (selector, root = document) => root.querySelector(selector);
const money = value => `₱${Number(value).toLocaleString("en-PH")}`;
function formatCheckoutTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila"
  }).format(date);
}
async function apiRequest(route, options = {}) {
  const { auth = false, ...requestOptions } = options;
  const headers = new Headers(requestOptions.headers || {});
  if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (auth) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (auth && !data.session) throw new Error("Sign in again to continue.");
    if (data.session) headers.set("Authorization", ["Bearer", data.session.access_token].join(" "));
  }
  const response = await fetch(`${apiBaseUrl}/api${route}`, { ...requestOptions, headers });
  if (response.status === 204) return null;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}
const persist = () => {
  localStorage.setItem("rewear-cart", JSON.stringify(state.cart));
  if (!supabase) {
    localStorage.setItem("rewear-products", JSON.stringify(state.products));
    localStorage.setItem("rewear-orders", JSON.stringify(state.orders));
  }
};
const productFromRow = row => ({
  id: row.id,
  title: row.title,
  category: row.category,
  price: Number(row.price),
  size: row.size,
  condition: row.condition,
  tag: row.tag,
  image: row.image,
  back_image: row.back_image || "",
  description: row.description,
  measurements: row.measurements || {},
  stock: row.stock,
  is_active: row.is_active !== false,
  is_featured: row.is_featured === true
});
const orderFromRow = row => ({
  id: row.order_number,
  databaseId: row.id,
  name: row.customer_name,
  email: row.customer_email,
  phone: row.customer_phone,
  address: row.shipping_address,
  products: (row.order_items || []).map(item => ({
    id: item.product_id,
    title: item.title,
    price: Number(item.unit_price),
    quantity: Number(item.quantity)
  })),
  total: Number(row.total),
  payment: row.payment_method,
  reference: row.payment_reference || "",
  status: row.status,
  placedAt: row.placed_at,
  tracking: row.tracking_number || "",
  courier: row.courier || "",
  eta: row.estimated_delivery || "",
  receiptPath: row.receipt_path
});
async function loadProducts(admin = false) {
  const data = await apiRequest(admin ? "/admin/products" : "/products", { auth: admin });
  state.products = data.map(productFromRow);
}
async function loadAdminOrders() {
  const data = await apiRequest("/admin/orders", { auth: true });
  state.orders = data.map(orderFromRow);
}
function inventoryLabel(product) {
  if (product.is_active === false) return "Hidden";
  if (product.stock === 0) return "Sold out";
  if (state.cart.some(item => item.id === product.id)) return "In your cart";
  return `${product.is_featured ? "Featured · " : ""}${product.stock} available`;
}
function inventoryStatus(product) {
  if (product.is_active === false) return "hidden";
  if (product.stock === 0) return "sold-out";
  return product.is_featured ? "featured" : "available";
}
function renderInventorySection(title, products, status) {
  const rows = [...products].sort((a, b) => a.title.localeCompare(b.title)).map(product => `<tr>
    <td>${escapeHTML(product.title)}</td>
    <td>${escapeHTML(product.category)} · ${escapeHTML(product.size)}</td>
    <td>${money(product.price)}</td>
    <td>${escapeHTML(inventoryLabel(product))}</td>
    <td><select data-product-status="${product.id}" aria-label="${escapeHTML(product.title)} inventory status">
      <option value="featured" ${status === "featured" ? "selected" : ""}>Featured</option>
      <option value="available" ${status === "available" ? "selected" : ""}>Available</option>
      <option value="sold-out" ${status === "sold-out" ? "selected" : ""}>Sold out</option>
      <option value="hidden" ${status === "hidden" ? "selected" : ""}>Hide</option>
    </select><button data-edit="${product.id}">Edit</button><button class="inventory-delete" data-delete="${product.id}">Delete</button></td>
  </tr>`).join("");
  return `<section class="inventory-group inventory-${status}"><div class="admin-section-title"><h3>${title}</h3><span class="eyebrow muted-eyebrow">${products.length} ITEMS</span></div>
    ${products.length ? `<table class="admin-table"><thead><tr><th>PIECE</th><th>TYPE / SIZE</th><th>PRICE</th><th>STATUS</th><th>MANAGE</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="inventory-empty">No ${title.toLowerCase()} pieces.</div>`}
  </section>`;
}
function renderAdminInventory() {
  const groups = {
    featured: state.products.filter(product => inventoryStatus(product) === "featured"),
    available: state.products.filter(product => inventoryStatus(product) === "available"),
    "sold-out": state.products.filter(product => inventoryStatus(product) === "sold-out"),
    hidden: state.products.filter(product => inventoryStatus(product) === "hidden")
  };
  return `<div class="inventory-groups">
    ${renderInventorySection("Featured", groups.featured, "featured")}
    ${renderInventorySection("Available", groups.available, "available")}
    ${renderInventorySection("Sold out", groups["sold-out"], "sold-out")}
    ${renderInventorySection("Hidden", groups.hidden, "hidden")}
  </div>`;
}
function confirmProductDeletion(product) {
  return new Promise(resolve => {
    const dialog = document.createElement("dialog");
    dialog.className = "delete-confirm-dialog";
    dialog.setAttribute("aria-labelledby", "deleteConfirmTitle");
    const content = document.createElement("div");
    content.className = "delete-confirm-content";
    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow muted-eyebrow";
    eyebrow.textContent = "REMOVE FROM INVENTORY";
    const heading = document.createElement("h2");
    heading.id = "deleteConfirmTitle";
    heading.textContent = "Delete this piece?";
    const message = document.createElement("p");
    message.textContent = `“${product.title}” will be permanently removed from your inventory. This cannot be undone.`;
    const actions = document.createElement("div");
    actions.className = "delete-confirm-actions";
    const cancel = document.createElement("button");
    cancel.className = "button button-outline";
    cancel.type = "button";
    cancel.textContent = "Keep piece";
    cancel.addEventListener("click", () => dialog.close("cancel"));
    const confirm = document.createElement("button");
    confirm.className = "button button-danger";
    confirm.type = "button";
    confirm.textContent = "Delete piece";
    confirm.addEventListener("click", () => dialog.close("delete"));
    actions.append(cancel, confirm);
    content.append(eyebrow, heading, message, actions);
    dialog.append(content);
    document.body.append(dialog);
    dialog.addEventListener("close", () => {
      resolve(dialog.returnValue === "delete");
      dialog.remove();
    }, { once: true });
    dialog.addEventListener("click", event => {
      if (event.target === dialog) dialog.close("cancel");
    });
    dialog.showModal();
    cancel.focus();
  });
}

function renderProducts() {
  let products = state.products.filter(product =>
    product.is_active !== false
    && (document.body.classList.contains("shop-page") || (product.is_featured && product.stock > 0))
    && (state.category === "All" || product.category === state.category)
  );
  if (state.sort === "price-low") products = products.sort((a, b) => a.price - b.price);
  if (state.sort === "price-high") products = products.sort((a, b) => b.price - a.price);
  $("#productGrid").innerHTML = products.map(product => {
    const inCart = state.cart.some(item => item.id === product.id);
    const soldOut = product.stock === 0;
    const status = soldOut ? "sold-out" : inCart ? "in-cart" : "available";
    const statusLabel = soldOut ? "SOLD OUT" : inCart ? "IN YOUR CART" : "";
    return `
    <article class="product-card ${status === "sold-out" ? "sold-out" : ""}" data-status="${status}">
      <div class="product-image-wrap" data-product="${product.id}" role="button" tabindex="0" aria-label="View ${escapeHTML(product.title)} details">
        <img class="product-image" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.title)}" loading="lazy" />
        <span class="product-tag">${escapeHTML(product.tag || product.condition)}</span>
        ${statusLabel ? `<span class="product-availability">${statusLabel}</span>` : ""}
        <button class="quick-add" data-add="${product.id}" aria-label="Add ${escapeHTML(product.title)} to cart" ${status === "available" ? "" : "disabled"}>${status === "available" ? "+" : "×"}</button>
      </div>
      <div class="product-info"><div><div class="product-name">${escapeHTML(product.title)}</div><div class="product-meta">${escapeHTML(product.category)} · Size ${escapeHTML(product.size)}</div></div><div class="product-price">${money(product.price)}</div></div>
    </article>`;
  }).join("");
  $("#emptyProducts").classList.toggle("hidden", products.length > 0);
  const visibleProducts = state.products.filter(product =>
    product.is_active !== false
    && (document.body.classList.contains("shop-page") || (product.is_featured && product.stock > 0))
  );
  $("#allCount").textContent = String(visibleProducts.length).padStart(2, "0");
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2500);
}
function setDialog(name) {
  ["cartDrawer", "productModal", "checkoutModal", "ordersModal", "adminPanel"].forEach(id => $(`#${id}`).classList.add("hidden"));
  $("#overlay").classList.toggle("hidden", !name);
  document.body.classList.toggle("locked", Boolean(name));
  if (name) $(`#${name}`).classList.remove("hidden");
}
function renderCheckoutAuthPrompt() {
  $("#checkoutModal").innerHTML = `<div class="checkout-auth-prompt">
    <button class="close-button checkout-auth-close" data-close aria-label="Close checkout sign-in prompt">×</button>
    <span class="eyebrow muted-eyebrow">ONE LAST STEP</span>
    <h2 id="checkoutTitle">Sign in to check out.</h2>
    <p>Create an account or sign in before placing your order. Your items will stay in your cart while you do.</p>
    <div class="checkout-auth-actions">
      <button class="button button-dark" type="button" data-checkout-auth>Continue to account <span>→</span></button>
      <button class="button button-outline" type="button" data-return-cart>Back to cart</button>
    </div>
  </div>`;
  setDialog("checkoutModal");
  $("[data-checkout-auth]").focus();
}
async function addToCart(id) {
  const product = state.products.find(item => item.id === id);
  if (!product || product.is_active === false || product.stock === 0 || state.cart.some(item => item.id === id)) return;
  state.cart.push({ id, product: { ...product } });
  persist();
  renderCart();
  renderProducts();
  showToast("Added to your cart.");
}
function renderCart() {
  const items = state.cart.map(item => state.products.find(product => product.id === item.id)).filter(Boolean);
  $("#cartCount").textContent = items.length;
  $("#drawerCount").textContent = `(${items.length})`;
  $("#cartEmpty").classList.toggle("hidden", items.length > 0);
  $("#cartFooter").classList.toggle("hidden", items.length === 0);
  $("#cartItems").innerHTML = items.map(product => `<div class="cart-item"><img src="${escapeHTML(product.image)}" alt="" /><div><h3>${escapeHTML(product.title)}</h3><p>Size ${escapeHTML(product.size)}</p><strong>${money(product.price)}</strong></div><button class="remove-item" data-remove="${product.id}">Remove</button></div>`).join("");
  $("#cartSubtotal").textContent = money(items.reduce((sum, item) => sum + item.price, 0));
}
function openProduct(id) {
  const product = state.products.find(item => item.id === id);
  if (!product) return;
  const inCart = state.cart.some(item => item.id === product.id);
  const soldOut = product.stock === 0;
  const unavailable = soldOut || inCart;
  const availabilityLabel = soldOut ? "Sold out" : "Already in your cart";
  const productPhotos = product.back_image
    ? `<div class="modal-product-carousel" data-image-index="0" data-front-image="${escapeHTML(product.image)}" data-back-image="${escapeHTML(product.back_image)}"><img class="modal-product-image" data-carousel-image data-zoom-image tabindex="0" role="button" aria-label="Enlarge front photo" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.title)} — front" /><span class="modal-product-image-label" data-image-label aria-live="polite">FRONT</span><div class="product-image-controls"><button class="product-image-arrow product-image-previous" type="button" data-image-direction="previous" aria-label="Show front photo">‹</button><button class="product-image-arrow product-image-next" type="button" data-image-direction="next" aria-label="Show back photo">›</button></div></div>`
    : `<img class="modal-product-image" data-zoom-image tabindex="0" role="button" aria-label="Enlarge product photo" src="${escapeHTML(product.image)}" alt="${escapeHTML(product.title)}" />`;
  $("#productModal").innerHTML = `<div class="product-modal-content">${productPhotos}<div class="modal-product-copy"><button class="close-button modal-close" data-close aria-label="Close details">×</button><span class="eyebrow muted-eyebrow">${escapeHTML(product.tag || product.condition)} · SIZE ${escapeHTML(product.size)}</span><h2 id="modalTitle">${escapeHTML(product.title)}</h2><div class="modal-price">${money(product.price)}</div><p class="modal-description">${escapeHTML(product.description)}</p><div class="measurement-title">MEASURED FLAT, BY HAND</div><div class="measurement-grid">${Object.entries(product.measurements || {}).map(([label, value]) => `<div>${escapeHTML(label)}<strong>${escapeHTML(value)}</strong></div>`).join("")}</div><button class="button button-dark modal-add" data-add="${product.id}" ${unavailable ? "disabled" : ""}>${unavailable ? availabilityLabel : "Add to cart"} <span>→</span></button></div></div>`;
  setDialog("productModal");
}
function changeProductImage(direction) {
  const carousel = $("#productModal .modal-product-carousel");
  if (!carousel) return;
  const currentIndex = Number(carousel.dataset.imageIndex) || 0;
  const nextIndex = (currentIndex + (direction === "next" ? 1 : -1) + 2) % 2;
  const showingBack = nextIndex === 1;
  const image = carousel.querySelector("[data-carousel-image]");
  image.src = showingBack ? carousel.dataset.backImage : carousel.dataset.frontImage;
  image.alt = `${$("#modalTitle").textContent} — ${showingBack ? "back" : "front"}`;
  carousel.querySelector("[data-image-label]").textContent = showingBack ? "BACK" : "FRONT";
  carousel.querySelector(".product-image-previous").setAttribute("aria-label", `Show ${showingBack ? "front" : "back"} photo`);
  carousel.querySelector(".product-image-next").setAttribute("aria-label", `Show ${showingBack ? "front" : "back"} photo`);
  carousel.dataset.imageIndex = String(nextIndex);
  if (!$("#productImageViewer").classList.contains("hidden")) updateImageViewer(image, carousel.querySelector("[data-image-label]").textContent);
}
let zoomReturnFocus = null;
function updateImageViewer(sourceImage, label = "") {
  const viewer = $("#productImageViewer");
  viewer.querySelector("[data-zoom-viewer-image]").src = sourceImage.src;
  viewer.querySelector("[data-zoom-viewer-image]").alt = sourceImage.alt;
  viewer.querySelector("[data-zoom-viewer-label]").textContent = label;
}
function openImageViewer(image) {
  const viewer = $("#productImageViewer");
  const carousel = image.closest(".modal-product-carousel");
  zoomReturnFocus = image;
  updateImageViewer(image, carousel?.querySelector("[data-image-label]").textContent || "");
  viewer.querySelectorAll("[data-zoom-viewer-direction]").forEach(button => {
    button.classList.toggle("hidden", !carousel);
  });
  $("#productModal").setAttribute("aria-modal", "false");
  viewer.classList.remove("hidden");
  viewer.querySelector("[data-close-image-viewer]").focus();
}
function closeImageViewer() {
  const viewer = $("#productImageViewer");
  if (viewer.classList.contains("hidden")) return;
  viewer.classList.add("hidden");
  $("#productModal").setAttribute("aria-modal", "true");
  if (zoomReturnFocus?.isConnected) zoomReturnFocus.focus();
  zoomReturnFocus = null;
}
function checkoutShipping() {
  const region = $("#destination")?.value || "metro";
  return region === "metro" ? 80 : region === "luzon" ? 130 : 180;
}
function customerAddress(profile = {}) {
  return [
    profile.streetAddress,
    profile.apartment,
    profile.barangay && `Barangay ${profile.barangay}`,
    profile.city,
    profile.province,
    profile.postalCode,
    "Philippines"
  ].filter(Boolean).join(", ");
}
function renderCheckout() {
  const products = state.cart.map(item => state.products.find(product => product.id === item.id)).filter(Boolean);
  if (!products.length) return showToast("Your cart is empty.");
  const shipping = checkoutShipping();
  const subtotal = products.reduce((sum, item) => sum + item.price, 0);
  const payment = state.selectedPayment;
  const profile = state.authUser?.user_metadata || {};
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ");
  $("#checkoutModal").innerHTML = `<div class="modal-head"><div><span class="eyebrow muted-eyebrow">ALMOST YOURS</span><h2 id="checkoutTitle">A few last details.</h2></div><button class="close-button" data-close aria-label="Close checkout">×</button></div><div class="checkout-grid"><form class="checkout-form" id="checkoutForm"><label>YOUR NAME<input name="name" required placeholder="First and last name" autocomplete="name" maxlength="120" value="${escapeHTML(fullName)}" /></label><label>EMAIL ADDRESS<input name="email" type="email" required placeholder="you@example.com" autocomplete="email" maxlength="254" value="${escapeHTML(state.authUser?.email || "")}" /></label><label>PHONE NUMBER<input name="phone" type="tel" required placeholder="09XX XXX XXXX" autocomplete="tel" maxlength="40" /></label><label>SHIPPING ADDRESS<textarea name="address" required placeholder="House / unit, street, barangay" maxlength="1000">${escapeHTML(customerAddress(profile))}</textarea></label><label>SHIP TO<select id="destination" name="destination"><option value="metro">Metro Manila · ₱80</option><option value="luzon">Luzon · ₱130</option><option value="vismin">Visayas / Mindanao · ₱180</option></select></label><div class="measurement-title">HOW WOULD YOU LIKE TO PAY?</div><div class="payment-choice"><button type="button" data-payment="COD" class="${payment === "COD" ? "selected" : ""}">Cash on delivery</button><button type="button" data-payment="GCash" class="${payment === "GCash" ? "selected" : ""}">GCash</button></div><div id="gcashFields" class="${payment === "GCash" ? "" : "hidden"}"><div class="gcash-panel"><strong>Pay with GCash</strong><div class="gcash-qr"><img class="gcash-qr-image" src="${GCASH_QR_IMAGE}" alt="RG Thrift Collection GCash payment QR code" /><span class="gcash-qr-fallback">Add your QR image as <strong>${GCASH_QR_IMAGE}</strong> beside index.html</span></div><div>Scan the store QR and upload your payment receipt (JPEG or PNG, up to 5 MB).</div><label>PAYMENT RECEIPT<input name="receipt" type="file" accept="image/jpeg,image/png" ${payment === "GCash" ? "required" : ""} /></label><span class="file-help">Images only · Maximum file size 5 MB</span>${supabase ? "" : '<p class="file-help">Demo mode: receipts are validated but not uploaded.</p>'}</div></div><button class="button button-dark checkout-submit" type="submit">${payment === "COD" ? "Place COD order" : "Submit payment for review"} <span>→</span></button></form><aside class="checkout-summary"><h3>Your finds</h3>${products.map(product => `<div class="summary-item"><span>${escapeHTML(product.title)}</span><strong>${money(product.price)}</strong></div>`).join("")}<div class="summary-item"><span>Shipping</span><strong id="shippingAmount">${money(shipping)}</strong></div><div class="summary-total"><span>Total</span><strong id="checkoutTotal">${money(subtotal + shipping)}</strong></div></aside></div>`;
  const qrImage = $("#checkoutModal .gcash-qr-image");
  qrImage.addEventListener("load", () => { qrImage.nextElementSibling.hidden = true; });
  qrImage.addEventListener("error", () => { qrImage.hidden = true; });
  setDialog("checkoutModal");
}
async function placeOrder(form) {
  const data = new FormData(form);
  const receipt = data.get("receipt");
  if (state.selectedPayment === "GCash") {
    if (!receipt || !receipt.size) return showToast("Please upload your GCash receipt.");
    if (!["image/jpeg", "image/png"].includes(receipt.type)) return showToast("Receipt must be a JPEG or PNG image.");
    if (receipt.size > 5 * 1024 * 1024) return showToast("Receipt must be 5 MB or smaller.");
  }
  const products = state.cart.map(item => state.products.find(product => product.id === item.id)).filter(Boolean);
  if (supabase) {
    const orderData = new FormData();
    orderData.set("name", data.get("name"));
    orderData.set("email", data.get("email"));
    orderData.set("phone", data.get("phone"));
    orderData.set("address", data.get("address"));
    orderData.set("payment", state.selectedPayment);
    orderData.set("destination", data.get("destination"));
    orderData.set("productIds", JSON.stringify(state.cart.map(item => item.id)));
    orderData.set("checkoutToken", crypto.randomUUID());
    if (state.selectedPayment === "GCash") orderData.set("receipt", receipt);
    let result;
    try {
      result = await apiRequest("/orders", { method: "POST", auth: true, body: orderData });
    } catch (error) {
      return showToast(error.message);
    }
    state.cart = [];
    persist();
    try {
      await loadProducts(true);
    } catch (refreshError) {
      showToast(`Order placed, but the catalog did not refresh: ${refreshError.message}`);
    }
    renderProducts();
    renderCart();
    $("#checkoutModal").innerHTML = `<div class="confirmation"><div class="confirmation-icon">✓</div><span class="eyebrow muted-eyebrow">IT'S A GOOD DAY</span><h2>Order placed.</h2><p>${state.selectedPayment === "GCash" ? "Your receipt was uploaded securely. Payment will be reviewed by the shop." : "Your order is pending and payment is due on delivery."} Save your order number to check its status.</p><div class="order-code">ORDER ${escapeHTML(result.order_number)} · ${money(result.total)}</div><button class="button button-dark" data-close>Back to the good stuff <span>→</span></button></div>`;
    return;
  }
  const region = data.get("destination");
  const shipping = region === "metro" ? 80 : region === "luzon" ? 130 : 180;
  const subtotal = products.reduce((sum, item) => sum + item.price, 0);
  const order = {
    id: `RW-${Date.now().toString().slice(-7)}`,
    name: data.get("name"),
    email: data.get("email"),
    phone: data.get("phone"),
    address: data.get("address"),
    products: products.map(product => ({ id: product.id, title: product.title, price: product.price })),
    total: subtotal + shipping,
    shipping,
    payment: state.selectedPayment,
    reference: "",
    status: state.selectedPayment === "COD" ? "Pending COD" : "Payment review",
    placedAt: new Date().toISOString(),
    tracking: "",
    eta: ""
  };
  state.orders.unshift(order);
  state.products = state.products.map(product => products.some(item => item.id === product.id) ? { ...product, stock: 0, soldPending: true } : product);
  state.cart = [];
  persist();
  renderProducts();
  renderCart();
  $("#checkoutModal").innerHTML = `<div class="confirmation"><div class="confirmation-icon">✓</div><span class="eyebrow muted-eyebrow">IT'S A GOOD DAY</span><h2>Order placed.</h2><p>${state.selectedPayment === "GCash" ? "Your payment details are marked for review in this demo. No payment is processed, and receipt files are not stored." : "Your one-of-a-kind finds are confirmed for this order. Please have your payment ready when it arrives."} Save your order number to check its status.</p><div class="order-code">ORDER ${escapeHTML(order.id)} · ${money(order.total)}</div><button class="button button-dark" data-close>Back to the good stuff <span>→</span></button></div>`;
}
async function renderOrders() {
  if (supabase) {
    let session;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      session = data.session;
    } catch (error) {
      return showToast(`Could not check your sign-in: ${error.message}`);
    }
    if (session) {
      let orders;
      try {
        orders = await apiRequest("/customer/orders", { auth: true });
      } catch (error) {
        return showToast(`Could not load your orders: ${error.message}`);
      }
      const sortedOrders = [...orders].sort((a, b) => new Date(b.placed_at) - new Date(a.placed_at));
      $("#ordersModal").innerHTML = `<div class="modal-head"><div><span class="eyebrow muted-eyebrow">THE JOURNEY HOME</span><h2 id="ordersTitle">Your orders.</h2></div><button class="close-button" data-close aria-label="Close orders">×</button></div><div class="order-history-list">${sortedOrders.length ? sortedOrders.map(order => {
        const items = (order.order_items || []).map(item => `<li>${escapeHTML(item.title)}${Number(item.quantity) > 1 ? ` <span>× ${Number(item.quantity)}</span>` : ""}</li>`).join("");
        const delivery = [order.courier, order.tracking_number && `Tracking ${order.tracking_number}`, order.estimated_delivery && `ETA ${order.estimated_delivery}`].filter(Boolean);
        return `<article class="order-card"><div class="order-card-head"><div><h3>Order ${escapeHTML(order.order_number)}</h3><p>Placed ${new Date(order.placed_at).toLocaleDateString()}</p></div><span class="status-pill">${escapeHTML(order.status)}</span></div><div class="order-card-items"><span class="order-card-label">ITEMS</span><ul>${items || "<li>Order details unavailable</li>"}</ul></div><div class="order-card-summary"><div><span>Total</span><strong>${money(order.total)}</strong></div><div><span>Payment</span><strong>${escapeHTML(order.payment_method)}</strong></div></div>${delivery.length ? `<div class="order-card-delivery"><span class="order-card-label">DELIVERY</span><p>${delivery.map(escapeHTML).join(" · ")}</p></div>` : ""}</article>`;
      }).join("") : `<div class="no-orders">Orders you place while signed in will appear here.</div>`}</div>`;
      setDialog("ordersModal");
      return;
    }
    $("#ordersModal").innerHTML = `<div class="modal-head"><div><span class="eyebrow muted-eyebrow">THE JOURNEY HOME</span><h2 id="ordersTitle">Order history.</h2></div><button class="close-button" data-close aria-label="Close orders">×</button></div><p class="order-signin-note">Sign in to your account to view your orders and track their status.</p><a class="button button-outline order-signin-link" href="account.html">Sign in to your account <span>→</span></a>`;
    setDialog("ordersModal");
    return;
  }
  const sortedOrders = [...state.orders].sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
  $("#ordersModal").innerHTML = `<div class="modal-head"><div><span class="eyebrow muted-eyebrow">THE JOURNEY HOME</span><h2 id="ordersTitle">Your orders.</h2></div><button class="close-button" data-close aria-label="Close orders">×</button></div><div class="order-history-list">${sortedOrders.length ? sortedOrders.map(order => {
    const items = order.products.map(product => `<li>${escapeHTML(product.title)}</li>`).join("");
    const delivery = [order.tracking && `Tracking ${order.tracking}`, order.eta && `ETA ${order.eta}`].filter(Boolean);
    return `<article class="order-card"><div class="order-card-head"><div><h3>Order ${escapeHTML(order.id)}</h3><p>Placed ${new Date(order.placedAt).toLocaleDateString()}</p></div><span class="status-pill">${escapeHTML(order.status)}</span></div><div class="order-card-items"><span class="order-card-label">ITEMS</span><ul>${items}</ul></div><div class="order-card-summary"><div><span>Total</span><strong>${money(order.total)}</strong></div><div><span>Payment</span><strong>${escapeHTML(order.payment)}</strong></div></div>${delivery.length ? `<div class="order-card-delivery"><span class="order-card-label">DELIVERY</span><p>${delivery.map(escapeHTML).join(" · ")}</p></div>` : ""}</article>`;
  }).join("") : `<div class="no-orders">Your next good find will show up here.</div>`}</div>`;
  setDialog("ordersModal");
}
function updateAccountButton() {
  const button = $("#accountButton");
  if (button) button.textContent = state.authUser ? "My account" : "Sign in";
}
function updateAdminButton(isAdmin) {
  state.isAdmin = isAdmin;
  const button = $("#adminButton");
  if (button) button.hidden = !isAdmin;
}
const measurementFieldsByCategory = {
  Tops: ["Chest width", "Length", "Shoulder width", "Sleeve"],
  Bottoms: ["Waist", "Hip", "Rise", "Inseam"],
  Outerwear: ["Chest width", "Length", "Shoulder width", "Sleeve"],
  Dresses: ["Chest width", "Waist", "Hip", "Length", "Shoulder width", "Sleeve"]
};
function renderMeasurementFields(container, category, measurements = {}) {
  container.innerHTML = (measurementFieldsByCategory[category] || []).map(label => {
    const value = Number.parseFloat(measurements[label] || "");
    const inputValue = Number.isFinite(value) ? String(value) : "";
    return `<label>${label} (in)<input type="number" min="0.1" step="0.1" data-measurement="${label}" value="${inputValue}" placeholder="e.g. 20" /></label>`;
  }).join("");
}
async function verifyAdminButtonAccess() {
  updateAdminButton(false);
  if (!supabase) return;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) return;
    await apiRequest("/admin/me", { auth: true });
    updateAdminButton(true);
  } catch (error) {
    if (!error.message.includes("not authorized")) {
      showToast(`Could not verify admin access: ${error.message}`);
    }
  }
}
async function renderAdmin() {
  if (!supabase) {
    updateAdminButton(false);
    $("#adminPanel").innerHTML = `<div class="admin-login"><button class="close-button" data-close aria-label="Close admin">×</button><span class="eyebrow muted-eyebrow">SECURE STORE DESK</span><h2>Admin sign-in is unavailable.</h2><p>Connect the Supabase project to enable authenticated admin access. Demo mode does not provide a secure admin portal.</p></div>`;
    setDialog("adminPanel");
    return;
  }
  if (supabase) {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) return showToast(sessionError.message);
    if (!sessionData.session) {
      updateAdminButton(false);
      $("#adminPanel").innerHTML = `<div class="admin-login"><button class="close-button" data-close aria-label="Close admin sign in">×</button><span class="eyebrow muted-eyebrow">SECURE STORE DESK</span><h2>Admin sign in.</h2><p>Use your existing account, then ask the store owner to add it to the admin list. New customer sign-ups are not admins.</p><form id="adminLoginForm"><label>EMAIL<input name="email" type="email" required autocomplete="username" /></label><label>PASSWORD<input name="password" type="password" required autocomplete="current-password" /></label><button class="button button-dark" type="submit">Sign in</button></form></div>`;
      setDialog("adminPanel");
      return;
    }
    try {
      await apiRequest("/admin/me", { auth: true });
    } catch (error) {
      if (error.message.includes("not authorized")) {
        updateAdminButton(false);
        setDialog(null);
        return;
      }
      updateAdminButton(false);
      showToast(error.message);
      $("#adminPanel").innerHTML = `<div class="admin-login"><button class="close-button" data-close aria-label="Close admin">×</button><h2>Could not verify admin access.</h2><p>${escapeHTML(error.message)}</p></div>`;
      setDialog("adminPanel");
      return;
    }
    updateAdminButton(true);
    try {
      await loadProducts(state.isAdmin);
      await loadAdminOrders();
    } catch (error) {
      return showToast(error.message);
    }
  }
  const pending = state.orders.filter(order => ["Payment review", "Pending COD"].includes(order.status)).length;
  state.orders.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
  $("#adminPanel").innerHTML = `<header class="admin-top"><div><span class="eyebrow muted-eyebrow">REWEAR · STORE DESK</span><h2>Good Day, shopkeeper.</h2></div><div class="admin-top-actions"><button class="button button-outline" id="adminBack">← Back to shop</button></div></header><div class="admin-content"><div class="admin-stats"><div class="stat-card"><span>AVAILABLE PIECES</span><strong>${state.products.filter(product => inventoryStatus(product) === "available").length}</strong></div><div class="stat-card"><span>ORDERS TO CHECK</span><strong>${pending}</strong></div><div class="stat-card"><span>ORDERS TOTAL</span><strong>${state.orders.length}</strong></div></div><div class="admin-columns"><section><div class="admin-section-title"><h3>The rack</h3><span class="eyebrow muted-eyebrow">INVENTORY · ${state.products.length} ITEMS</span></div></section><form class="admin-form" id="productForm"><h3>${state.editId ? "Edit this piece" : "Add a good find"}</h3><label>PIECE NAME<input name="title" required placeholder="The Sunday Shirt" /></label><label>CATEGORY<select name="category"><option>Tops</option><option>Bottoms</option><option>Outerwear</option><option>Dresses</option></select></label><label>PRICE (₱)<input name="price" type="number" min="1" required placeholder="650" /></label><label>SIZE<input name="size" required placeholder="M" /></label><label>PHOTO URL<input name="image" type="url" required placeholder="https://..." /></label><label>CONDITION<input name="condition" required placeholder="Excellent" /></label><label><textarea name="measurements" required placeholder="Chest width: 20 in&#10;Length: 24 in&#10;Shoulder width: 17 in&#10;Inseam: 28 in"></textarea></label><button class="button button-dark" type="submit">${state.editId ? "Save piece" : "Add to the rack"} <span>→</span></button>${state.editId ? `<button class="text-link" type="button" id="cancelEdit" style="margin:12px 0 0">Cancel edit</button>` : ""}</form></div><section class="admin-order-list"><div class="admin-section-title"><h3>Customer Orders</h3><span class="eyebrow muted-eyebrow">PAYMENTS · FULFILLMENT · DELIVERY</span></div>${state.orders.length ? state.orders.map(order => `<div class="admin-order"><div class="order-info"><strong>${escapeHTML(order.id)} · ${escapeHTML(order.products.map(p => p.title).join(", "))}</strong><span>${escapeHTML(order.name)} · ${escapeHTML(order.payment)} · ${money(order.total)}${order.reference ? ` · Ref ${escapeHTML(order.reference)}` : ""}</span>${order.payment === "GCash" ? `<span><a class="admin-proof" href="#" data-proof="${order.databaseId || order.id}">View receipt</a></span>` : ""}</div><select data-order-status="${order.databaseId || order.id}">${["Payment review", "Pending COD", "Paid", "Processing", "Shipped", "Delivered", "Cancelled", "Rejected"].map(status => `<option ${order.status === status ? "selected" : ""}>${status}</option>`).join("")}</select><input aria-label="Courier and tracking number" placeholder="Courier / tracking no." data-tracking="${order.databaseId || order.id}" value="${escapeHTML(order.tracking || "")}" /><input aria-label="Delivery ETA" placeholder="ETA e.g. Oct 30" data-eta="${order.databaseId || order.id}" value="${escapeHTML(order.eta || "")}" /></div>`).join("") : `<div class="no-orders">No orders yet. The good finds are waiting.</div>`}</section></div>`;
  $(".admin-columns > section:first-child").innerHTML = renderAdminInventory();
  $(".admin-order-list .admin-section-title .eyebrow").textContent = "NEWEST CHECKOUT FIRST · PHILIPPINE TIME";
  document.querySelectorAll(".admin-order").forEach((card, index) => {
    const order = state.orders[index];
    const orderCard = document.createElement("details");
    orderCard.className = "admin-order";
    const summary = document.createElement("summary");
    summary.className = "admin-order-summary";
    const heading = document.createElement("span");
    heading.className = "admin-order-heading";
    const buyer = document.createElement("strong");
    buyer.textContent = order.name;
    const checkoutTime = document.createElement("span");
    checkoutTime.className = "order-checkout-time";
    checkoutTime.textContent = `Checked out · ${formatCheckoutTime(order.placedAt)}`;
    heading.append(buyer, checkoutTime);
    const orderNumber = document.createElement("span");
    orderNumber.className = "admin-order-number";
    orderNumber.textContent = order.id;
    const status = document.createElement("span");
    status.className = "status-pill";
    status.textContent = order.status;
    const total = document.createElement("span");
    total.className = "admin-order-total";
    total.textContent = `${order.payment} · ${money(order.total)}`;
    const expandHint = document.createElement("span");
    expandHint.className = "admin-order-expand";
    expandHint.textContent = "View details";
    orderCard.addEventListener("toggle", () => {
      expandHint.textContent = orderCard.open ? "Hide details" : "View details";
    });
    summary.append(heading, orderNumber, status, total, expandHint);
    orderCard.append(summary);
    const details = document.createElement("div");
    details.className = "admin-order-details";
    while (card.firstChild) details.append(card.firstChild);
    orderCard.append(details);
    card.replaceWith(orderCard);

    const info = $(".order-info", orderCard);
    const receiptLink = info.querySelector("[data-proof]");
    info.replaceChildren();

    const makeOrderSection = (title, className, values) => {
      const section = document.createElement("section");
      section.className = `admin-order-section ${className}`;
      const heading = document.createElement("h4");
      heading.textContent = title;
      section.append(heading);
      values.filter(Boolean).forEach(value => {
        const detail = document.createElement("p");
        detail.textContent = value;
        section.append(detail);
      });
      return section;
    };
    info.className = "admin-order-info";
    const customerSection = makeOrderSection("Customer", "admin-order-customer", [order.name, order.email, order.phone]);
    if (order.email) {
      const emailButton = document.createElement("a");
      const subject = `About your RG Thrift Collection order ${order.id}`;
      const body = `Hi ${order.name},\n\nI'm contacting you about your order ${order.id}.\n\nRG Thrift Collection`;
      const gmailComposeUrl = new URL("https://mail.google.com/mail/");
      gmailComposeUrl.search = new URLSearchParams({
        view: "cm",
        fs: "1",
        to: order.email,
        su: subject,
        body
      }).toString();
      emailButton.className = "admin-email-button";
      emailButton.href = gmailComposeUrl.toString();
      emailButton.target = "_blank";
      emailButton.rel = "noopener noreferrer";
      emailButton.textContent = "Email customer";
      customerSection.append(emailButton);
    }
    info.append(
      customerSection,
      makeOrderSection("Shipping address", "admin-order-address", [order.address]),
      makeOrderSection("Items", "admin-order-items", order.products.map(product =>
        `${product.title}${product.quantity > 1 ? ` × ${product.quantity}` : ""}`
      )),
      makeOrderSection("Payment", "admin-order-payment", [
        `${order.payment} · ${money(order.total)}`,
        order.reference ? `Reference: ${order.reference}` : ""
      ])
    );
    if (receiptLink) {
      const receiptRow = document.createElement("div");
      receiptRow.className = "admin-order-receipt";
      receiptRow.append(receiptLink);
      $(".admin-order-payment", info).append(receiptRow);
    }
    const controls = document.createElement("section");
    controls.className = "admin-order-controls";
    const controlsHeading = document.createElement("h4");
    controlsHeading.textContent = "Order status and delivery";
    controls.append(controlsHeading);
    const controlsGrid = document.createElement("div");
    controlsGrid.className = "admin-order-control-grid";
    while (orderCard.querySelector(".admin-order-details").children.length > 1) {
      controlsGrid.append(orderCard.querySelector(".admin-order-details").children[1]);
    }
    controls.append(controlsGrid);
    orderCard.querySelector(".admin-order-details").append(controls);
  });
  setDialog("adminPanel");
  $(".admin-top .eyebrow").textContent = "RG THRIFT COLLECTION · STORE DESK";
  if (supabase) {
    const logout = document.createElement("button");
    logout.id = "adminLogout";
    logout.className = "button button-outline";
    logout.textContent = "Sign out";
    $(".admin-top-actions").prepend(logout);
    document.querySelectorAll("[data-proof]").forEach(link => { link.textContent = "View receipt"; });
    document.querySelectorAll("[data-tracking]").forEach(input => {
      const order = state.orders.find(item => (item.databaseId || item.id) === input.dataset.tracking);
      const courier = document.createElement("input");
      courier.type = "text";
      courier.placeholder = "Courier";
      courier.setAttribute("aria-label", "Courier");
      courier.dataset.courier = input.dataset.tracking;
      courier.value = order?.courier || "";
      courier.dataset.savedValue = courier.value;
      input.before(courier);
    });
    const imageUrl = $("#productForm [name='image']");
    imageUrl.required = false;
    const photoLabel = document.createElement("label");
    photoLabel.textContent = "UPLOAD PHOTO (JPEG, PNG OR WEBP · MAX 5 MB)";
    const photoInput = document.createElement("input");
    photoInput.name = "imageFile";
    photoInput.type = "file";
    photoInput.accept = "image/jpeg,image/png,image/webp";
    photoLabel.append(photoInput);
    imageUrl.closest("label").before(photoLabel);
    const backPhotoLabel = document.createElement("label");
    backPhotoLabel.textContent = "UPLOAD BACK PHOTO (OPTIONAL · JPEG, PNG OR WEBP · MAX 5 MB)";
    const backPhotoInput = document.createElement("input");
    backPhotoInput.name = "backImageFile";
    backPhotoInput.type = "file";
    backPhotoInput.accept = "image/jpeg,image/png,image/webp";
    backPhotoLabel.append(backPhotoInput);
    imageUrl.closest("label").after(backPhotoLabel);
  }
  const backImageUrlLabel = document.createElement("label");
  backImageUrlLabel.textContent = "BACK PHOTO URL (OPTIONAL)";
  const backImageUrl = document.createElement("input");
  backImageUrl.name = "backImage";
  backImageUrl.type = "url";
  backImageUrl.placeholder = "https://...";
  backImageUrlLabel.append(backImageUrl);
  $("#productForm [name='image']").closest("label").after(backImageUrlLabel);
  const stockLabel = document.createElement("label");
  stockLabel.textContent = "STOCK";
  const stockInput = document.createElement("input");
  stockInput.name = "stock";
  stockInput.type = "number";
  stockInput.min = "0";
  stockInput.required = true;
  stockInput.value = String(state.editId ? state.products.find(item => item.id === state.editId)?.stock ?? 1 : 1);
  stockLabel.append(stockInput);
  $("#productForm button[type='submit']").before(stockLabel);
  const conditionInput = $("#productForm [name='condition']");
  const conditionSelect = document.createElement("select");
  conditionSelect.name = "condition";
  conditionSelect.required = true;
  [["", "Select condition"], ["Like new", "Like new"], ["Excellent", "Excellent"], ["Good vintage", "Good vintage"], ["Fair", "Fair"]]
    .forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.disabled = !value;
      conditionSelect.append(option);
    });
  conditionInput.replaceWith(conditionSelect);
  const measurementTextarea = $("#productForm [name='measurements']");
  const measurementContainer = document.createElement("div");
  measurementContainer.className = "measurement-fields";
  measurementContainer.id = "measurementFields";
  measurementTextarea.replaceWith(measurementContainer);
  const measurementHeading = document.createElement("div");
  measurementHeading.className = "measurement-heading";
  measurementHeading.textContent = "MEASUREMENTS (INCHES)";
  measurementContainer.before(measurementHeading);
  renderMeasurementFields(measurementContainer, $("#productForm [name='category']").value);
  if (state.editId) {
    const product = state.products.find(item => item.id === state.editId);
    const form = $("#productForm");
    if (product) {
      Object.entries({ title: product.title, category: product.category, price: product.price, size: product.size, image: product.image, condition: product.condition }).forEach(([key, value]) => { form.elements[key].value = value; });
      form.elements.backImage.value = product.back_image || "";
      renderMeasurementFields(measurementContainer, product.category, product.measurements);
    }
  }
}
async function updateOrderStatus(orderId, status) {
  const order = state.orders.find(item => (item.databaseId || item.id) === orderId);
  if (!order) return;
  if (supabase) {
    return apiRequest(`/admin/orders/${encodeURIComponent(order.databaseId)}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ status })
    }).then(async () => {
      await loadProducts(true);
      await loadAdminOrders();
      renderProducts();
      renderAdmin();
      showToast(`Order updated: ${status}.`);
    }).catch(error => showToast(error.message));
  }
  order.status = status;
  if (["Cancelled", "Rejected"].includes(status)) {
    const ids = order.products.map(product => product.id);
    state.products = state.products.map(product => ids.includes(product.id) ? { ...product, stock: 1, soldPending: false } : product);
  } else if (["Paid", "Processing", "Shipped", "Delivered"].includes(status)) {
    const ids = order.products.map(product => product.id);
    state.products = state.products.map(product => ids.includes(product.id) ? { ...product, stock: 0, soldPending: false } : product);
  }
  persist();
  renderProducts();
  renderAdmin();
  showToast(`Order updated: ${status}.`);
}

$("#categoryFilters").addEventListener("click", event => {
  const chip = event.target.closest("[data-category]");
  if (!chip) return;
  state.category = chip.dataset.category;
  document.querySelectorAll(".filter-chip").forEach(button => button.classList.toggle("active", button === chip));
  renderProducts();
});
$("#sortSelect").addEventListener("change", event => { state.sort = event.target.value; renderProducts(); });
$("#productGrid").addEventListener("click", event => {
  const add = event.target.closest("[data-add]");
  const card = event.target.closest("[data-product]");
  if (add) { event.stopPropagation(); addToCart(add.dataset.add); }
  else if (card) openProduct(card.dataset.product);
});
$("#productGrid").addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-product]")) openProduct(event.target.dataset.product);
});
document.body.addEventListener("click", event => {
  const imageDirection = event.target.closest("[data-image-direction]");
  if (imageDirection) {
    changeProductImage(imageDirection.dataset.imageDirection);
    return;
  }
  if (event.target.closest("[data-close-image-viewer]") || event.target.id === "productImageViewer") {
    closeImageViewer();
    return;
  }
  const zoomDirection = event.target.closest("[data-zoom-viewer-direction]");
  if (zoomDirection) {
    changeProductImage(zoomDirection.dataset.zoomViewerDirection);
    return;
  }
  const zoomImage = event.target.closest("[data-zoom-image]");
  if (zoomImage) {
    openImageViewer(zoomImage);
    return;
  }
  const add = event.target.closest("[data-add]");
  if (add && !$("#productGrid").contains(add)) { addToCart(add.dataset.add); setDialog("cartDrawer"); }
  const remove = event.target.closest("[data-remove]");
  if (remove) {
    state.cart = state.cart.filter(cartItem => cartItem.id !== remove.dataset.remove);
    persist(); renderCart(); renderProducts();
  }
  if (event.target.closest("[data-close]")) setDialog(null);
  if (event.target.closest("[data-checkout-auth]")) {
    window.location.assign("account.html?checkout=1");
    return;
  }
  if (event.target.closest("[data-return-cart]")) {
    renderCart();
    setDialog("cartDrawer");
    return;
  }
  if (event.target.id === "overlay") setDialog(null);
  const payment = event.target.closest("[data-payment]");
  if (payment) {
    state.selectedPayment = payment.dataset.payment;
    renderCheckout();
  }
  const proof = event.target.closest("[data-proof]");
  if (proof) {
    event.preventDefault();
    const order = state.orders.find(item => item.databaseId === proof.dataset.proof);
    if (!supabase || !order?.receiptPath) return showToast("No uploaded receipt is available.");
    apiRequest(`/admin/orders/${encodeURIComponent(order.databaseId)}/receipt`, { auth: true })
      .then(({ url }) => window.open(url, "_blank", "noopener,noreferrer"))
      .catch(error => showToast(error.message));
  }
});
$("#cartButton").addEventListener("click", () => { renderCart(); setDialog("cartDrawer"); });
$("#checkoutButton").addEventListener("click", async () => {
  if (!supabase) {
    showToast("Create an account and sign in before checkout.");
    return;
  }
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    state.authUser = data.session?.user || null;
    if (!state.authUser) {
      renderCheckoutAuthPrompt();
      return;
    }
    state.selectedPayment = "COD";
    renderCheckout();
  } catch (error) {
    showToast(`Could not check your sign-in: ${error.message}`);
  }
});
$("#checkoutModal").addEventListener("change", event => {
  if (event.target.id === "destination") {
    const products = state.cart.map(item => state.products.find(product => product.id === item.id)).filter(Boolean);
    const subtotal = products.reduce((sum, item) => sum + item.price, 0);
    const shipping = checkoutShipping();
    $("#shippingAmount").textContent = money(shipping);
    $("#checkoutTotal").textContent = money(subtotal + shipping);
  }
});
$("#checkoutModal").addEventListener("submit", event => {
  if (event.target.id !== "checkoutForm") return;
  event.preventDefault();
  placeOrder(event.target);
});
$("#ordersButton").addEventListener("click", renderOrders);
$("#accountButton").addEventListener("click", () => { window.location.href = "account.html"; });
$("#adminButton").addEventListener("click", () => { state.editId = null; renderAdmin(); });
$("#adminPanel").addEventListener("click", async event => {
  if (event.target.id === "adminBack") {
    state.isAdmin = false;
    try {
      await loadProducts();
      renderProducts();
    } catch (error) {
      return showToast(error.message);
    }
    setDialog(null); state.editId = null;
  }
  if (event.target.id === "cancelEdit") { state.editId = null; renderAdmin(); }
  if (event.target.id === "adminLogout") {
    const { error } = await supabase.auth.signOut();
    if (error) return showToast(error.message);
    updateAdminButton(false);
    state.authUser = null;
    updateAccountButton();
    try {
      await loadProducts();
    } catch (refreshError) {
      return showToast(`Signed out, but the catalog did not refresh: ${refreshError.message}`);
    }
    renderProducts();
    setDialog(null);
    showToast("Signed out.");
  }
  const edit = event.target.closest("[data-edit]");
  if (edit) { state.editId = edit.dataset.edit; renderAdmin(); }
  const remove = event.target.closest("[data-delete]");
  if (remove) {
    const product = state.products.find(item => item.id === remove.dataset.delete);
    if (product && state.cart.some(item => item.id === product.id)) return showToast("Remove this piece from your cart before deleting it.");
    if (product && await confirmProductDeletion(product)) {
      if (supabase) {
        try {
          await apiRequest(`/admin/products/${encodeURIComponent(product.id)}`, {
            method: "DELETE",
            auth: true
          });
          state.cart = state.cart.filter(item => item.id !== product.id);
          persist();
          await loadProducts(true);
        } catch (error) {
          return showToast(error.message);
        }
      } else {
        state.products = state.products.filter(item => item.id !== product.id);
      }
      persist(); renderAdmin(); renderProducts();
    }
  }
});
$("#adminPanel").addEventListener("submit", async event => {
  if (event.target.id === "adminLoginForm") {
    event.preventDefault();
    const form = new FormData(event.target);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: form.get("email"),
      password: form.get("password")
    });
    if (error) return showToast(error.message);
    state.authUser = data.user;
    updateAccountButton();
    await renderAdmin();
    return;
  }
  if (event.target.id !== "productForm") return;
  event.preventDefault();
  const form = new FormData(event.target);
  const existing = state.products.find(item => item.id === state.editId);
  let image = String(form.get("image") || "").trim();
  const imageFile = form.get("imageFile");
  const backImageFile = form.get("backImageFile");
  for (const [file, side] of [[imageFile, "Front"], [backImageFile, "Back"]]) {
    if (!file?.size) continue;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      return showToast(`${side} photo must be a JPEG, PNG, or WEBP image.`);
    }
    if (file.size > 5 * 1024 * 1024) return showToast(`${side} photo must be 5 MB or smaller.`);
  }
  if (!image && !imageFile?.size) return showToast("Add a photo URL or upload a photo.");
  const item = {
    id: existing?.id || `p${Date.now()}`,
    title: form.get("title"),
    category: form.get("category"),
    price: Number(form.get("price")),
    size: form.get("size"),
    image,
    back_image: String(form.get("backImage") || "").trim(),
    condition: form.get("condition"),
    tag: existing?.tag || "JUST FOUND",
    description: existing?.description || "A one-of-a-kind pre-loved piece, ready for its next favorite person.",
    is_active: existing?.is_active !== false,
    is_featured: existing?.is_featured === true,
    measurements: Object.fromEntries([...event.target.querySelectorAll("[data-measurement]")]
      .filter(input => input.value !== "")
      .map(input => [input.dataset.measurement, `${input.value} in`])),
    stock: Number(form.get("stock") ?? existing?.stock ?? 1)
  };
  if (!Object.keys(item.measurements).length) {
    return showToast("Add at least one garment measurement.");
  }
  if (supabase) {
    const productData = new FormData();
    Object.entries({
      title: item.title,
      category: item.category,
      price: item.price,
      size: item.size,
      condition: item.condition,
      tag: item.tag,
      image: item.image,
      back_image: item.back_image,
      description: item.description,
      measurements: JSON.stringify(item.measurements),
      stock: item.stock,
      is_active: item.is_active,
      is_featured: item.is_featured
    }).forEach(([key, value]) => productData.set(key, value));
    const file = form.get("imageFile");
    if (file?.size) productData.set("imageFile", file);
    if (backImageFile?.size) productData.set("backImageFile", backImageFile);
    try {
      await apiRequest(existing
        ? `/admin/products/${encodeURIComponent(existing.id)}`
        : "/admin/products", {
        method: existing ? "PUT" : "POST",
        auth: true,
        body: productData
      });
    } catch (error) {
      return showToast(error.message);
    }
    await loadProducts(true);
  } else if (existing) {
    state.products = state.products.map(product => product.id === existing.id ? item : product);
  } else {
    state.products.unshift(item);
  }
  state.editId = null;
  persist(); renderProducts(); renderAdmin(); showToast(existing ? "Piece updated." : "New find added to the rack.");
});
$("#adminPanel").addEventListener("change", async event => {
  const productStatus = event.target.closest("[data-product-status]");
  if (productStatus) {
    const product = state.products.find(item => item.id === productStatus.dataset.productStatus);
    if (!product) return;
    const status = productStatus.value;
    if (status === "featured" && product.stock === 0) {
      showToast("Restock this piece before featuring it.");
      return renderAdmin();
    }
    if (supabase) {
      try {
        await apiRequest(`/admin/products/${encodeURIComponent(product.id)}/status`, {
          method: "PATCH",
          auth: true,
          body: JSON.stringify({ status })
        });
        await loadProducts(true);
      } catch (error) {
        showToast(`Could not update inventory status: ${error.message}`);
        return renderAdmin();
      }
    } else {
      product.is_active = status !== "hidden";
      product.is_featured = status === "featured";
      if (status === "available") product.stock = Math.max(product.stock, 1);
      if (status === "sold-out") product.stock = 0;
      persist();
    }
    renderProducts();
    renderAdmin();
    const statusLabel = {
      featured: "Featured",
      available: "Available",
      "sold-out": "Sold out",
      hidden: "Hidden"
    }[status];
    showToast(`Inventory updated: ${statusLabel}.`);
    return;
  }
  if (event.target.matches("#productForm [name='category']")) {
    const values = Object.fromEntries([...$("#measurementFields").querySelectorAll("[data-measurement]")]
      .map(input => [input.dataset.measurement, input.value]));
    renderMeasurementFields($("#measurementFields"), event.target.value, values);
  }
  const status = event.target.closest("[data-order-status]");
  if (status) await updateOrderStatus(status.dataset.orderStatus, status.value);
  const tracking = event.target.closest("[data-tracking]");
  if (tracking) {
    const order = state.orders.find(item => (item.databaseId || item.id) === tracking.dataset.tracking);
    if (order && supabase) {
      try {
        await apiRequest(`/admin/orders/${encodeURIComponent(order.databaseId)}`, {
          method: "PATCH",
          auth: true,
          body: JSON.stringify({ tracking: tracking.value })
        });
      } catch (error) {
        return showToast(error.message);
      }
      await loadAdminOrders();
    } else if (order) { order.tracking = tracking.value; persist(); }
    showToast("Tracking details saved.");
  }
  const eta = event.target.closest("[data-eta]");
  if (eta) {
    const order = state.orders.find(item => (item.databaseId || item.id) === eta.dataset.eta);
    if (order && supabase) {
      try {
        await apiRequest(`/admin/orders/${encodeURIComponent(order.databaseId)}`, {
          method: "PATCH",
          auth: true,
          body: JSON.stringify({ eta: eta.value })
        });
      } catch (error) {
        return showToast(error.message);
      }
      await loadAdminOrders();
    } else if (order) { order.eta = eta.value; persist(); }
    showToast("Delivery ETA saved.");
  }
  const courier = event.target.closest("[data-courier]");
  if (courier) {
    const order = state.orders.find(item => (item.databaseId || item.id) === courier.dataset.courier);
    if (order && supabase) {
      try {
        await apiRequest(`/admin/orders/${encodeURIComponent(order.databaseId)}`, {
          method: "PATCH",
          auth: true,
          body: JSON.stringify({ courier: courier.value })
        });
      } catch (error) {
        return showToast(error.message);
      }
      await loadAdminOrders();
    } else if (order) {
      order.courier = courier.value;
      persist();
    }
    showToast("Courier details saved.");
  }
});
document.addEventListener("keydown", event => {
  const viewerOpen = !$("#productImageViewer").classList.contains("hidden");
  if (viewerOpen && event.key === "Escape") {
    event.stopPropagation();
    closeImageViewer();
    return;
  }
  if (viewerOpen && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    event.preventDefault();
    changeProductImage(event.key === "ArrowRight" ? "next" : "previous");
    return;
  }
  if ((event.key === "Enter" || event.key === " ") && event.target.closest("[data-zoom-image]")) {
    event.preventDefault();
    openImageViewer(event.target.closest("[data-zoom-image]"));
    return;
  }
  if (event.key === "Escape") setDialog(null);
});
async function initializeStore() {
  if (supabase) {
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      state.authUser = sessionData.session?.user || null;
      updateAccountButton();
      await verifyAdminButtonAccess();
      await loadProducts();
      state.cart.forEach(item => {
        if (!state.products.some(product => product.id === item.id) && item.product) {
          state.products.push(item.product);
        }
      });
    } catch (error) {
      showToast(`Could not load the store: ${error.message}`);
    }
  }
  renderProducts();
  renderCart();
  if (!supabase) showToast("Demo mode: connect Supabase to enable shared stock and checkout.");
  if (new URLSearchParams(window.location.search).get("checkout") === "1") {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
    if (state.authUser) {
      state.selectedPayment = "COD";
      renderCheckout();
    } else {
      window.location.assign("account.html?checkout=1");
      return;
    }
  }
  if (new URLSearchParams(window.location.search).get("openAdmin") === "1") {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
    await renderAdmin();
  }
}
initializeStore();

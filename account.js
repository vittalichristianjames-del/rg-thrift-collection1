import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const provinces = [
  "Abra", "Agusan del Norte", "Agusan del Sur", "Aklan", "Albay", "Antique",
  "Apayao", "Aurora", "Basilan", "Bataan", "Batanes", "Batangas", "Benguet",
  "Biliran", "Bohol", "Bukidnon", "Bulacan", "Cagayan", "Camarines Norte",
  "Camarines Sur", "Camiguin", "Capiz", "Catanduanes", "Cavite", "Cebu",
  "Cotabato", "Davao de Oro", "Davao del Norte", "Davao del Sur",
  "Davao Occidental", "Davao Oriental", "Dinagat Islands", "Eastern Samar",
  "Guimaras", "Ifugao", "Ilocos Norte", "Ilocos Sur", "Iloilo", "Isabela",
  "Kalinga", "La Union", "Laguna", "Lanao del Norte", "Lanao del Sur", "Leyte",
  "Maguindanao del Norte", "Maguindanao del Sur", "Marinduque", "Masbate",
  "Misamis Occidental", "Misamis Oriental", "Mountain Province",
  "Negros Occidental", "Negros Oriental", "Northern Samar", "Nueva Ecija",
  "Nueva Vizcaya", "Occidental Mindoro", "Oriental Mindoro", "Palawan",
  "Pampanga", "Pangasinan", "Quezon", "Quirino", "Rizal", "Romblon", "Samar",
  "Sarangani", "Siquijor", "Sorsogon", "South Cotabato", "Southern Leyte",
  "Sultan Kudarat", "Sulu", "Surigao del Norte", "Surigao del Sur", "Tarlac",
  "Tawi-Tawi", "Zambales", "Zamboanga del Norte", "Zamboanga del Sur",
  "Zamboanga Sibugay"
];
const content = document.querySelector("#accountContent");
const config = window.STORE_BACKEND_CONFIG || {};
const apiBaseUrl = String(config.apiBaseUrl || "").replace(/\/+$/, "");
const turnstileSiteKey = String(config.turnstileSiteKey || "").trim();
const supabase = config.url && config.anonKey
  ? createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;
const checkoutRequested = new URLSearchParams(window.location.search).get("checkout") === "1";
let turnstileLoadPromise;
let turnstileToken = "";

function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileLoadPromise) {
    turnstileLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.turnstile) resolve(window.turnstile);
        else {
          turnstileLoadPromise = null;
          reject(new Error("Turnstile could not be initialized. Please reload and try again."));
        }
      };
      script.onerror = () => {
        turnstileLoadPromise = null;
        reject(new Error("Could not load sign-in security check. Check your connection and try again."));
      };
      document.head.append(script);
    });
  }
  return turnstileLoadPromise;
}

async function setupTurnstile() {
  const container = content.querySelector("#turnstileWidget");
  if (!container) return;
  const submit = content.querySelector('#authForm [type="submit"]');
  if (!turnstileSiteKey) {
    container.textContent = "Sign-in protection is not configured yet. Please contact the store owner.";
    container.setAttribute("role", "alert");
    submit.disabled = true;
    return;
  }
  submit.disabled = true;
  try {
    const turnstile = await loadTurnstile();
    if (!container.isConnected) return;
    turnstileWidgetId = turnstile.render(container, {
      sitekey: turnstileSiteKey,
      callback(token) {
        if (!container.isConnected) return;
        turnstileToken = token;
        content.querySelector('#authForm [type="submit"]').disabled = false;
      },
      "expired-callback"() {
        if (!container.isConnected) return;
        turnstileToken = "";
        content.querySelector('#authForm [type="submit"]').disabled = true;
      },
      "error-callback"() {
        if (!container.isConnected) return;
        turnstileToken = "";
        container.textContent = "The security check failed to load. Please reload and try again.";
        content.querySelector('#authForm [type="submit"]').disabled = true;
      }
    });
  } catch (error) {
    if (!container.isConnected) return;
    container.textContent = error.message;
    container.setAttribute("role", "alert");
    submit.disabled = true;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]
  );
}

function profileFields(profile = {}) {
  const options = provinces.map(province =>
    `<option value="${province}" ${profile.province === province ? "selected" : ""}>${province}</option>`
  ).join("");
  return `<h3 class="account-section-title">Delivery details</h3>
    <label class="account-field">COUNTRY<input name="country" value="Philippines" readonly /></label>
    <label class="account-field">FIRST NAME<input name="firstName" autocomplete="given-name" required maxlength="80" value="${escapeHTML(profile.firstName)}" /></label>
    <label class="account-field">LAST NAME<input name="lastName" autocomplete="family-name" required maxlength="80" value="${escapeHTML(profile.lastName)}" /></label>
    <label class="account-field account-field-wide">ADDRESS<input name="streetAddress" autocomplete="address-line1" required maxlength="200" value="${escapeHTML(profile.streetAddress)}" /></label>
    <label class="account-field account-field-wide">APARTMENT, SUITE, ETC. <span class="optional">(OPTIONAL)</span><input name="apartment" autocomplete="address-line2" maxlength="120" value="${escapeHTML(profile.apartment)}" /></label>
    <label class="account-field">BARANGAY<input name="barangay" autocomplete="address-level3" required maxlength="100" value="${escapeHTML(profile.barangay)}" /></label>
    <label class="account-field">POSTAL CODE<input name="postalCode" autocomplete="postal-code" inputmode="numeric" pattern="[0-9]{4}" title="Enter a 4-digit Philippine postal code" required maxlength="4" value="${escapeHTML(profile.postalCode)}" /></label>
    <label class="account-field">CITY / MUNICIPALITY<input name="city" autocomplete="address-level2" required maxlength="100" value="${escapeHTML(profile.city)}" /></label>
    <label class="account-field">PROVINCE / REGION<select name="province" autocomplete="address-level1" required><option value="">Choose your province</option>${options}<option value="Metro Manila" ${profile.province === "Metro Manila" ? "selected" : ""}>Metro Manila (NCR)</option></select></label>`;
}

function profileFromForm(form) {
  const data = new FormData(form);
  return {
    country: "Philippines",
    firstName: String(data.get("firstName") || "").trim(),
    lastName: String(data.get("lastName") || "").trim(),
    streetAddress: String(data.get("streetAddress") || "").trim(),
    apartment: String(data.get("apartment") || "").trim(),
    barangay: String(data.get("barangay") || "").trim(),
    postalCode: String(data.get("postalCode") || "").trim(),
    city: String(data.get("city") || "").trim(),
    province: String(data.get("province") || "").trim()
  };
}

function renderAuth(mode = "login", message = "") {
  const signup = mode === "signup";
  turnstileToken = "";
  content.innerHTML = `<form class="account-form" id="authForm" data-mode="${signup ? "signup" : "login"}">
    <span class="eyebrow muted-eyebrow account-field-wide">CUSTOMER ACCOUNT</span>
    <h2>${signup ? "Create your account." : "Welcome back."}</h2>
    <p>${checkoutRequested
      ? (signup ? "Create an account or sign in to continue to checkout. Your cart will be saved." : "Sign in to continue to checkout. Your cart will be saved.")
      : (signup ? "Add your delivery details so they are ready when you find something good." : "Sign in to manage your customer details and orders.")}</p>
    ${message ? `<p class="account-message error account-field-wide" role="alert">${escapeHTML(message)}</p>` : ""}
    ${signup ? profileFields() : ""}
    <label class="account-field account-field-wide">EMAIL ADDRESS<input name="email" type="email" autocomplete="email" required maxlength="254" /></label>
    <label class="account-field account-field-wide">PASSWORD<input name="password" type="password" autocomplete="${signup ? "new-password" : "current-password"}" required minlength="8" /></label>
    ${signup ? `<label class="account-field account-field-wide">CONFIRM PASSWORD<input name="confirmPassword" type="password" autocomplete="new-password" required minlength="8" /></label>` : ""}
    <div class="turnstile-container account-field-wide" id="turnstileWidget"></div>
    <button class="button button-dark" type="submit" disabled>${signup ? "Create account" : "Sign in"} <span>→</span></button>
    <button class="text-link account-switch" type="button" data-mode="${signup ? "login" : "signup"}">${signup ? "Already have an account? Sign in" : "New here? Create an account"}</button>
  </form>`;
  setupTurnstile();
}

async function apiRequest(route) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) throw new Error("Please sign in again to view your orders.");
  const response = await fetch(`${apiBaseUrl}/api${route}`, {
    headers: { Authorization: `Bearer ${data.session.access_token}` }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not load your orders.");
  return result;
}

async function isStoreAdmin() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session) return false;

  const response = await fetch(`${apiBaseUrl}/api/admin/me`, {
    headers: { Authorization: `Bearer ${data.session.access_token}` }
  });
  if (response.status === 403) return false;
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not verify admin access.");
  return true;
}

async function continueAfterSignIn(user) {
  if (checkoutRequested) {
    window.location.assign("index.html?checkout=1");
    return;
  }
  try {
    if (await isStoreAdmin()) {
      window.location.assign("index.html?openAdmin=1");
      return;
    }
    await renderAccount(user);
  } catch (error) {
    await renderAccount(user, `Signed in, but admin access could not be verified: ${error.message}`);
  }
}

function renderOrders(orders) {
  if (!orders.length) return `<div class="account-empty">Orders placed while you are signed in will appear here. Guest orders can still be checked with the order lookup on the shop.</div>`;
  return [...orders].sort((a, b) => new Date(b.placed_at) - new Date(a.placed_at)).map(order => {
    const placed = new Date(order.placed_at).toLocaleDateString();
    const delivery = [
      order.courier,
      order.tracking_number && `Tracking ${order.tracking_number}`,
      order.estimated_delivery && `ETA ${order.estimated_delivery}`
    ].filter(Boolean).join(" · ");
    const items = (order.order_items || []).map(item => `<li>${escapeHTML(item.title)}${Number(item.quantity) > 1 ? ` <span>× ${Number(item.quantity)}</span>` : ""}</li>`).join("");
    return `<article class="account-order"><div class="account-order-top"><div><h3>Order ${escapeHTML(order.order_number)}</h3><p>Placed ${escapeHTML(placed)}</p></div><span class="status-pill">${escapeHTML(order.status)}</span></div><div class="account-order-items"><span class="account-order-label">ITEMS</span><ul>${items || "<li>Order details unavailable</li>"}</ul></div><div class="account-order-summary"><div><span>Total</span><strong>₱${Number(order.total).toLocaleString("en-PH")}</strong></div><div><span>Payment</span><strong>${escapeHTML(order.payment_method)}</strong></div></div>${delivery ? `<div class="account-order-delivery"><span class="account-order-label">DELIVERY</span><p>${escapeHTML(delivery)}</p></div>` : ""}</article>`;
  }).join("");
}

async function renderAccount(user, errorMessage = "") {
  let orders = [];
  let orderError = "";
  try {
    orders = await apiRequest("/customer/orders");
  } catch (error) {
    orderError = error.message;
  }
  const profile = user.user_metadata || {};
  content.innerHTML = `<section class="account-panel">
    <div class="account-panel-head"><div><span class="eyebrow muted-eyebrow">YOUR CUSTOMER ACCOUNT</span><h2>Welcome back.</h2><p>${escapeHTML(user.email)}</p></div><button class="text-link" id="signOutButton">Sign out</button></div>
    ${errorMessage ? `<p class="account-message error" role="alert">${escapeHTML(errorMessage)}</p>` : ""}
    <form class="account-form" id="profileForm">${profileFields(profile)}<button class="button button-dark" type="submit">Save delivery details</button></form>
    <section class="account-orders"><h2>Your orders</h2>${orderError ? `<p class="account-message error" role="alert">${escapeHTML(orderError)}</p>` : renderOrders(orders)}</section>
  </section>`;
}

async function initialize() {
  if (!supabase) {
    content.innerHTML = `<p class="account-message error" role="alert">Customer accounts are unavailable because Supabase has not been configured.</p>`;
    return;
  }
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) return renderAuth(checkoutRequested ? "signup" : "login");
    if (checkoutRequested) {
      window.location.replace("index.html?checkout=1");
      return;
    }
    try {
      if (await isStoreAdmin()) {
        window.location.replace("index.html?openAdmin=1");
        return;
      }
    } catch (adminError) {
      await renderAccount(data.session.user, `Could not verify admin access: ${adminError.message}`);
      return;
    }
    await renderAccount(data.session.user);
  } catch (error) {
    content.innerHTML = `<p class="account-message error" role="alert">${escapeHTML(error.message)}</p>`;
  }
}

content.addEventListener("click", async event => {
  const mode = event.target.closest("button[data-mode]");
  if (mode) return renderAuth(mode.dataset.mode);
  if (event.target.closest("#continueToSignIn")) return renderAuth("login");
  if (event.target.id === "signOutButton") {
    const { error } = await supabase.auth.signOut();
    if (error) return renderAccount((await supabase.auth.getUser()).data.user, error.message);
    renderAuth();
  }
});

content.addEventListener("input", event => {
  if (event.target.name !== "confirmPassword") return;
  const form = event.target.form;
  const password = form.elements.password;
  event.target.setCustomValidity(
    password.value === event.target.value ? "" : "Passwords do not match."
  );
});

content.addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.target;
  const submit = form.querySelector('[type="submit"]');
  if (form.id === "authForm" && form.dataset.mode === "signup") {
    const password = form.elements.password;
    const confirmPassword = form.elements.confirmPassword;
    confirmPassword.setCustomValidity(
      password.value === confirmPassword.value ? "" : "Passwords do not match."
    );
    if (!form.reportValidity()) return;
  }
  submit.disabled = true;
  try {
    if (form.id === "authForm") {
      const values = new FormData(form);
      const email = String(values.get("email")).trim();
      const password = String(values.get("password"));
      if (form.dataset.mode === "signup" && password !== String(values.get("confirmPassword"))) {
        throw new Error("Passwords do not match.");
      }
      if (form.dataset.mode === "signup") {
        if (!turnstileToken) throw new Error("Complete the security check before creating an account.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            captchaToken: turnstileToken,
            data: profileFromForm(form),
            ...(checkoutRequested ? { emailRedirectTo: `${window.location.origin}/account.html?checkout=1` } : {})
          }
        });
        if (error) throw error;
        turnstileToken = "";
        if (!data.session) {
          content.innerHTML = `<div class="account-confirmation"><h2>Confirm your account.</h2><p>Use the confirmation link sent to your email, then sign in to continue to checkout. Your cart will be saved.</p><button class="button button-dark" type="button" id="continueToSignIn">Continue to sign in <span>→</span></button></div>`;
          return;
        }
        if (checkoutRequested) {
          window.location.assign("index.html?checkout=1");
          return;
        }
        await renderAccount(data.user || data.session.user);
      } else {
        if (!turnstileToken) throw new Error("Complete the security check before signing in.");
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: { captchaToken: turnstileToken }
        });
        if (error) throw error;
        turnstileToken = "";
        await continueAfterSignIn(data.user);
      }
      return;
    }
    if (form.id === "profileForm") {
      const { data, error } = await supabase.auth.updateUser({ data: profileFromForm(form) });
      if (error) throw error;
      await renderAccount(data.user);
    }
  } catch (error) {
    if (form.id === "authForm") renderAuth(form.dataset.mode, error.message);
    else renderAccount((await supabase.auth.getUser()).data.user, error.message);
  }
});

initialize();

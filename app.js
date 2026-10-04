/* =========================================================
   PRESTIGE HOME DEALS
   CUSTOMER APPLICATION
   ========================================================= */

(function () {
  "use strict";

  /* =======================================================
     SUPABASE CONFIGURATION
     ======================================================= */

  const SUPABASE_URL =
    "https://nyehwoxvyizburpzptcj.supabase.co";

  /*
    IMPORTANT:
    Replace ONLY the value below with your Supabase
    ANON / PUBLIC key.

    NEVER use the service_role key here.
  */

  const SUPABASE_ANON_KEY =
    "sb_publishable_hoVyM0VHwiOHapPiBdktQg_58pVPc4T";

  window.PRESTIGE_CONFIG = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    WHATSAPP: "254769218680",
    PHONE: "0769218680",
    PAYMENT_TILL: "4991074"
  };

  if (!window.supabase) {
    console.error("Supabase library was not loaded.");
    return;
  }

  window.prestigeDB = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  const db = window.prestigeDB;

  /* =======================================================
     HELPERS
     ======================================================= */

  function money(value) {
    return "KSh " + Number(value || 0).toLocaleString("en-KE", {
      maximumFractionDigits: 2
    });
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getQueryParameter(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function show(element) {
    if (element) element.classList.remove("hidden");
  }

  function hide(element) {
    if (element) element.classList.add("hidden");
  }

  function productPlaceholder(name) {
    const first = String(name || "P").charAt(0).toUpperCase();
    return first;
  }

  /* =======================================================
     INDEX PAGE
     ======================================================= */

  let allProducts = [];

  async function loadProducts() {

    const loading = document.getElementById("productsLoading");
    const grid = document.getElementById("productsGrid");
    const empty = document.getElementById("productsEmpty");

    if (!grid) return;

    show(loading);
    hide(empty);

    const { data, error } = await db
      .from("products")
      .select("*")
      .eq("active", true)
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false });

    hide(loading);

    if (error) {
      console.error(error);
      grid.innerHTML = `
        <div class="status-box">
          Unable to load products. Please try again.
        </div>
      `;
      return;
    }

    allProducts = data || [];

    populateCategories(allProducts);
    renderProducts(allProducts);
  }

  function populateCategories(products) {

    const select = document.getElementById("categoryFilter");

    if (!select) return;

    const categories = [
      ...new Set(
        products
          .map(product => product.category)
          .filter(Boolean)
      )
    ].sort();

    select.innerHTML =
      `<option value="">All Categories</option>` +
      categories
        .map(category =>
          `<option value="${escapeHtml(category)}">
            ${escapeHtml(category)}
          </option>`
        )
        .join("");
  }

  function renderProducts(products) {

    const grid = document.getElementById("productsGrid");
    const empty = document.getElementById("productsEmpty");

    if (!grid) return;

    if (!products.length) {
      grid.innerHTML = "";
      show(empty);
      return;
    }

    hide(empty);

    grid.innerHTML = products.map(product => {

      const image = product.image_url
        ? `
          <img
            src="${escapeHtml(product.image_url)}"
            alt="${escapeHtml(product.name)}"
            loading="lazy"
          >
        `
        : `
          <div class="product-placeholder">
            ${escapeHtml(productPlaceholder(product.name))}
          </div>
        `;

      const oldPrice = product.old_price
        ? `
          <span class="old-price">
            ${money(product.old_price)}
          </span>
        `
        : "";

      return `
        <article class="product-card">

          <a href="product.html?id=${encodeURIComponent(product.id)}">

            <div class="product-card-image">
              ${image}
            </div>

          </a>

          <div class="product-card-content">

            <span class="product-category">
              ${escapeHtml(product.category || "Product")}
            </span>

            <h3>
              ${escapeHtml(product.name)}
            </h3>

            <div class="product-card-price">
              ${money(product.price)}
              ${oldPrice}
            </div>

            <a
              href="product.html?id=${encodeURIComponent(product.id)}"
              class="btn btn-primary"
              style="width:100%;"
            >
              View Product
            </a>

          </div>

        </article>
      `;

    }).join("");
  }

  function filterProducts() {

    const search =
      (document.getElementById("searchInput")?.value || "")
        .toLowerCase()
        .trim();

    const category =
      document.getElementById("categoryFilter")?.value || "";

    const filtered = allProducts.filter(product => {

      const matchesSearch =
        !search ||
        String(product.name || "").toLowerCase().includes(search) ||
        String(product.description || "").toLowerCase().includes(search) ||
        String(product.category || "").toLowerCase().includes(search);

      const matchesCategory =
        !category ||
        product.category === category;

      return matchesSearch && matchesCategory;
    });

    renderProducts(filtered);
  }

  /* =======================================================
     PRODUCT PAGE
     ======================================================= */

  async function loadSingleProduct() {

    const details =
      document.getElementById("productDetails");

    if (!details) return;

    const loading =
      document.getElementById("productLoading");

    const errorBox =
      document.getElementById("productError");

    const id = getQueryParameter("id");

    if (!id) {
      hide(loading);
      show(errorBox);
      return;
    }

    const { data: product, error } = await db
      .from("products")
      .select("*")
      .eq("id", id)
      .eq("active", true)
      .single();

    hide(loading);

    if (error || !product) {
      console.error(error);
      show(errorBox);
      return;
    }

    document.title =
      `${product.name} | PRESTIGE HOME DEALS`;

    document.getElementById("productName").textContent =
      product.name;

    document.getElementById("productCategory").textContent =
      product.category || "Product";

    document.getElementById("productPrice").textContent =
      money(product.price);

    const oldPrice =
      document.getElementById("productOldPrice");

    if (product.old_price) {
      oldPrice.textContent = money(product.old_price);
      show(oldPrice);
    } else {
      hide(oldPrice);
    }

    document.getElementById("productDescription").textContent =
      product.description || "Quality product from PRESTIGE HOME DEALS.";

    const image =
      document.getElementById("productImage");

    const placeholder =
      document.getElementById("productPlaceholder");

    if (product.image_url) {
      image.src = product.image_url;
      image.alt = product.name;
      show(image);
      hide(placeholder);
    } else {
      hide(image);
      placeholder.textContent =
        productPlaceholder(product.name);
      show(placeholder);
    }

    if (Number(product.price) > 10000) {
      show(document.getElementById("freeDeliveryNote"));
    }

    const quantityInput =
      document.getElementById("productQuantity");

    const minus =
      document.getElementById("quantityMinus");

    const plus =
      document.getElementById("quantityPlus");

    minus?.addEventListener("click", () => {
      const current = Number(quantityInput.value || 1);
      quantityInput.value = Math.max(1, current - 1);
    });

    plus?.addEventListener("click", () => {
      const current = Number(quantityInput.value || 1);
      quantityInput.value = Math.min(99, current + 1);
    });

    document
      .getElementById("orderNowButton")
      ?.addEventListener("click", () => {

        const quantity =
          Math.max(
            1,
            Math.min(
              99,
              Number(quantityInput.value || 1)
            )
          );

        localStorage.setItem(
          "prestige_order",
          JSON.stringify({
            product_id: product.id,
            quantity
          })
        );

        window.location.href = "checkout.html";
      });

    show(details);
  }

  /* =======================================================
     CHECKOUT
     ======================================================= */

  async function loadCheckout() {

    const form =
      document.getElementById("checkoutForm");

    if (!form) return;

    const saved =
      localStorage.getItem("prestige_order");

    const loading =
      document.getElementById("checkoutLoading");

    const productBox =
      document.getElementById("checkoutProduct");

    if (!saved) {
      loading.textContent =
        "No product selected.";

      return;
    }

    let orderData;

    try {
      orderData = JSON.parse(saved);
    } catch {
      loading.textContent =
        "Invalid order information.";

      return;
    }

    const { data: product, error } =
      await db
        .from("products")
        .select("*")
        .eq("id", orderData.product_id)
        .eq("active", true)
        .single();

    if (error || !product) {
      loading.textContent =
        "The selected product is no longer available.";
      return;
    }

    const quantity =
      Math.max(
        1,
        Math.min(
          99,
          Number(orderData.quantity || 1)
        )
      );

    const total =
      Number(product.price) * quantity;

    document.getElementById("summaryName").textContent =
      product.name;

    document.getElementById("summaryQuantity").textContent =
      quantity;

    document.getElementById("summaryQty").textContent =
      quantity;

    document.getElementById("summaryPrice").textContent =
      money(product.price);

    document.getElementById("summaryTotal").textContent =
      money(total);

    const image =
      document.getElementById("summaryImage");

    const placeholder =
      document.getElementById("summaryPlaceholder");

    if (product.image_url) {
      image.src = product.image_url;
      image.alt = product.name;
      show(image);
      hide(placeholder);
    } else {
      hide(image);
      placeholder.textContent =
        productPlaceholder(product.name);
      show(placeholder);
    }

    hide(loading);
    show(productBox);

    form.addEventListener("submit", async event => {

      event.preventDefault();

      const button =
        document.getElementById("placeOrderButton");

      const errorBox =
        document.getElementById("checkoutError");

      hide(errorBox);

      button.disabled = true;
      button.textContent = "Submitting Order...";

      const formData =
        new FormData(form);

      const items = [
        {
          product_id: product.id,
          quantity
        }
      ];

      const { data: orderId, error } =
        await db.rpc("create_order", {
          p_customer_name:
            formData.get("customerName"),

          p_phone:
            formData.get("phone"),

          p_email:
            formData.get("email") || null,

          p_county:
            formData.get("county"),

          p_town:
            formData.get("town"),

          p_address:
            formData.get("address"),

          p_notes:
            formData.get("notes") || null,

          p_items: items
        });

      if (error) {

        console.error(error);

        errorBox.textContent =
          error.message ||
          "Unable to submit your order. Please try again.";

        show(errorBox);

        button.disabled = false;
        button.textContent = "Place Order";

        return;
      }

      localStorage.removeItem("prestige_order");

      window.location.href =
        `order-success.html?id=${encodeURIComponent(orderId)}`;
    });
  }

  /* =======================================================
     SUCCESS PAGE
     ======================================================= */

  function loadSuccessPage() {

    const element =
      document.getElementById("orderId");

    if (!element) return;

    const id =
      getQueryParameter("id");

    if (id) {
      element.textContent = id;
    } else {
      element.textContent =
        "Order received";
    }
  }

  /* =======================================================
     INDEX EVENTS
     ======================================================= */

  function initializeIndex() {

    if (!document.getElementById("productsGrid")) {
      return;
    }

    loadProducts();

    document
      .getElementById("searchInput")
      ?.addEventListener(
        "input",
        filterProducts
      );

    document
      .getElementById("categoryFilter")
      ?.addEventListener(
        "change",
        filterProducts
      );
  }

  /* =======================================================
     INITIALIZE
     ======================================================= */

  document.addEventListener("DOMContentLoaded", () => {

    initializeIndex();
    loadSingleProduct();
    loadCheckout();
    loadSuccessPage();

  });

})();

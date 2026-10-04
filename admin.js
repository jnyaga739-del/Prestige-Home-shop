/* =========================================================
   PRESTIGE HOME DEALS
   ADMIN APPLICATION
   ========================================================= */

(function () {
  "use strict";

  const db = window.prestigeDB;

  if (!db) {
    console.error("Supabase client is unavailable.");
    return;
  }

  let editingProductId = null;

  const loginSection =
    document.getElementById("loginSection");

  if (!loginSection) {
    return;
  }

  const dashboardSection =
    document.getElementById("dashboardSection");

  const loginForm =
    document.getElementById("loginForm");

  const logoutButton =
    document.getElementById("logoutButton");

  const productForm =
    document.getElementById("productForm");

  const productsTable =
    document.getElementById("productsAdminTable");

  const ordersTable =
    document.getElementById("ordersAdminTable");


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

  function show(element) {
    element?.classList.remove("hidden");
  }

  function hide(element) {
    element?.classList.add("hidden");
  }

  function setError(message) {

    const box =
      document.getElementById("loginError");

    if (!box) return;

    box.textContent = message;
    show(box);
  }

  function clearError() {

    hide(
      document.getElementById("loginError")
    );

    hide(
      document.getElementById("productAdminError")
    );

    hide(
      document.getElementById("productAdminSuccess")
    );
  }


  /* =======================================================
     AUTH CHECK
     ======================================================= */

  async function checkAdmin() {

    clearError();

    const {
      data: { user }
    } = await db.auth.getUser();

    if (!user) {

      show(loginSection);
      hide(dashboardSection);
      hide(logoutButton);

      return;
    }

    const { data: admin, error } =
      await db
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {

      console.error(error);

      setError(
        "Unable to verify administrator access."
      );

      await db.auth.signOut();

      return;
    }

    if (!admin) {

      setError(
        "This account is not authorized to access the admin dashboard."
      );

      await db.auth.signOut();

      return;
    }

    hide(loginSection);
    show(dashboardSection);
    show(logoutButton);

    document.getElementById(
      "adminEmailDisplay"
    ).textContent = user.email || "";

    await refreshDashboard();
  }


  /* =======================================================
     LOGIN
     ======================================================= */

  loginForm?.addEventListener("submit", async event => {

    event.preventDefault();

    clearError();

    const button =
      document.getElementById("loginButton");

    const email =
      document.getElementById("adminEmail").value.trim();

    const password =
      document.getElementById("adminPassword").value;

    button.disabled = true;
    button.textContent = "Signing in...";

    const { error } =
      await db.auth.signInWithPassword({
        email,
        password
      });

    if (error) {

      setError(
        error.message ||
        "Login failed."
      );

      button.disabled = false;
      button.textContent = "Login";

      return;
    }

    document.getElementById(
      "adminPassword"
    ).value = "";

    button.disabled = false;
    button.textContent = "Login";

    await checkAdmin();
  });


  /* =======================================================
     LOGOUT
     ======================================================= */

  logoutButton?.addEventListener("click", async () => {

    await db.auth.signOut();

    window.location.reload();
  });


  /* =======================================================
     LOAD PRODUCTS
     ======================================================= */

  async function loadAdminProducts() {

    const { data, error } =
      await db
        .from("products")
        .select("*")
        .order("created_at", {
          ascending: false
        });

    if (error) {

      console.error(error);

      productsTable.innerHTML = `
        <tr>
          <td colspan="6">
            Unable to load products.
          </td>
        </tr>
      `;

      return;
    }

    document.getElementById(
      "totalProducts"
    ).textContent = data?.length || 0;

    if (!data?.length) {

      productsTable.innerHTML = `
        <tr>
          <td colspan="6">
            No products yet.
          </td>
        </tr>
      `;

      return;
    }

    productsTable.innerHTML =
      data.map(product => {

        const image = product.image_url
          ? `<img
              class="admin-product-image"
              src="${escapeHtml(product.image_url)}"
              alt=""
            >`
          : `<div class="admin-product-image"></div>`;

        return `
          <tr>

            <td>
              <div class="table-product">
                ${image}
                <strong>
                  ${escapeHtml(product.name)}
                </strong>
              </div>
            </td>

            <td>
              ${escapeHtml(product.category || "")}
            </td>

            <td>
              ${money(product.price)}
            </td>

            <td>
              ${Number(product.stock || 0)}
            </td>

            <td>
              ${
                product.active
                  ? "Active"
                  : "Hidden"
              }
            </td>

            <td>

              <div class="table-actions">

                <button
                  class="small-btn"
                  data-edit-product="${product.id}"
                >
                  Edit
                </button>

                <button
                  class="small-btn danger"
                  data-delete-product="${product.id}"
                >
                  Delete
                </button>

              </div>

            </td>

          </tr>
        `;

      }).join("");

    document
      .querySelectorAll("[data-edit-product]")
      .forEach(button => {

        button.addEventListener("click", () => {

          const id =
            button.getAttribute(
              "data-edit-product"
            );

          const product =
            data.find(item => item.id === id);

          if (product) {
            startEditProduct(product);
          }

        });

      });

    document
      .querySelectorAll("[data-delete-product]")
      .forEach(button => {

        button.addEventListener("click", () => {

          const id =
            button.getAttribute(
              "data-delete-product"
            );

          deleteProduct(id);
        });

      });
  }


  /* =======================================================
     PRODUCT FORM
     ======================================================= */

  productForm?.addEventListener("submit", async event => {

    event.preventDefault();

    clearError();

    const name =
      document.getElementById(
        "productAdminName"
      ).value.trim();

    const category =
      document.getElementById(
        "productAdminCategory"
      ).value.trim();

    const price =
      Number(
        document.getElementById(
          "productAdminPrice"
        ).value
      );

    const oldPriceValue =
      document.getElementById(
        "productAdminOldPrice"
      ).value;

    const oldPrice =
      oldPriceValue === ""
        ? null
        : Number(oldPriceValue);

    const stock =
      Number(
        document.getElementById(
          "productAdminStock"
        ).value || 0
      );

    const imageUrl =
      document.getElementById(
        "productAdminImage"
      ).value.trim() || null;

    const description =
      document.getElementById(
        "productAdminDescription"
      ).value.trim();

    const featured =
      document.getElementById(
        "productAdminFeatured"
      ).checked;

    const active =
      document.getElementById(
        "productAdminActive"
      ).checked;

    const errorBox =
      document.getElementById(
        "productAdminError"
      );

    const successBox =
      document.getElementById(
        "productAdminSuccess"
      );

    if (
      !name ||
      !category ||
      !description ||
      !Number.isFinite(price)
    ) {

      errorBox.textContent =
        "Please complete all required fields.";

      show(errorBox);

      return;
    }

    const button =
      document.getElementById(
        "saveProductButton"
      );

    button.disabled = true;
    button.textContent =
      editingProductId
        ? "Saving..."
        : "Adding...";

    const payload = {
      name,
      category,
      price,
      old_price: oldPrice,
      description,
      image_url: imageUrl,
      stock,
      featured,
      active
    };

    let result;

    if (editingProductId) {

      result =
        await db
          .from("products")
          .update(payload)
          .eq("id", editingProductId);

    } else {

      result =
        await db
          .from("products")
          .insert(payload);

    }

    if (result.error) {

      console.error(result.error);

      errorBox.textContent =
        result.error.message ||
        "Unable to save product.";

      show(errorBox);

      button.disabled = false;
      button.textContent =
        editingProductId
          ? "Save Changes"
          : "Add Product";

      return;
    }

    successBox.textContent =
      editingProductId
        ? "Product updated successfully."
        : "Product added successfully.";

    show(successBox);

    resetProductForm();

    await loadAdminProducts();

    button.disabled = false;
    button.textContent = "Add Product";
  });


  /* =======================================================
     EDIT PRODUCT
     ======================================================= */

  function startEditProduct(product) {

    editingProductId = product.id;

    document.getElementById(
      "productFormTitle"
    ).textContent = "Edit Product";

    document.getElementById(
      "saveProductButton"
    ).textContent = "Save Changes";

    document.getElementById(
      "cancelEditButton"
    ).classList.remove("hidden");

    document.getElementById(
      "productAdminName"
    ).value = product.name || "";

    document.getElementById(
      "productAdminCategory"
    ).value = product.category || "";

    document.getElementById(
      "productAdminPrice"
    ).value = product.price || "";

    document.getElementById(
      "productAdminOldPrice"
    ).value =
      product.old_price ?? "";

    document.getElementById(
      "productAdminStock"
    ).value =
      product.stock ?? 0;

    document.getElementById(
      "productAdminImage"
    ).value =
      product.image_url || "";

    document.getElementById(
      "productAdminDescription"
    ).value =
      product.description || "";

    document.getElementById(
      "productAdminFeatured"
    ).checked =
      !!product.featured;

    document.getElementById(
      "productAdminActive"
    ).checked =
      !!product.active;

    window.scrollTo({
      top: document
        .getElementById("productForm")
        .getBoundingClientRect()
        .top +
        window.scrollY -
        100,
      behavior: "smooth"
    });
  }


  /* =======================================================
     RESET FORM
     ======================================================= */

  function resetProductForm() {

    editingProductId = null;

    productForm.reset();

    document.getElementById(
      "productAdminActive"
    ).checked = true;

    document.getElementById(
      "productFormTitle"
    ).textContent = "Add Product";

    document.getElementById(
      "saveProductButton"
    ).textContent = "Add Product";

    hide(
      document.getElementById(
        "cancelEditButton"
      )
    );
  }

  document
    .getElementById("cancelEditButton")
    ?.addEventListener(
      "click",
      resetProductForm
    );


  /* =======================================================
     DELETE PRODUCT
     ======================================================= */

  async function deleteProduct(id) {

    if (
      !window.confirm(
        "Delete this product permanently?"
      )
    ) {
      return;
    }

    const { error } =
      await db
        .from("products")
        .delete()
        .eq("id", id);

    if (error) {

      alert(
        error.message ||
        "Unable to delete product."
      );

      return;
    }

    await loadAdminProducts();
  }


  /* =======================================================
     LOAD ORDERS
     ======================================================= */

  async function loadAdminOrders() {

    const { data: orders, error } =
      await db
        .from("orders")
        .select(`
          *,
          order_items (
            product_name,
            unit_price,
            quantity,
            subtotal
          )
        `)
        .order("created_at", {
          ascending: false
        });

    if (error) {

      console.error(error);

      ordersTable.innerHTML = `
        <tr>
          <td colspan="7">
            Unable to load orders.
          </td>
        </tr>
      `;

      return;
    }

    document.getElementById(
      "totalOrders"
    ).textContent =
      orders?.length || 0;

    document.getElementById(
      "pendingOrders"
    ).textContent =
      orders?.filter(
        order => order.status === "pending"
      ).length || 0;

    if (!orders?.length) {

      ordersTable.innerHTML = `
        <tr>
          <td colspan="7">
            No orders yet.
          </td>
        </tr>
      `;

      return;
    }

    ordersTable.innerHTML =
      orders.map(order => {

        const items =
          order.order_items || [];

        const productsText =
          items.map(item =>
            `${escapeHtml(item.product_name)}
             × ${item.quantity}`
          ).join("<br>");

        const date =
          new Date(
            order.created_at
          ).toLocaleString("en-KE");

        return `
          <tr>

            <td>
              <small>
                ${escapeHtml(order.id)}
              </small>
            </td>

            <td>
              <strong>
                ${escapeHtml(order.customer_name)}
              </strong>
              <br>
              ${escapeHtml(order.phone)}
              <br>
              ${escapeHtml(order.town)}
            </td>

            <td>
              ${productsText}
            </td>

            <td>
              ${money(order.total)}
            </td>

            <td>

              <select
                class="order-status-select"
                data-order-status="${order.id}"
              >

                <option value="pending"
                  ${order.status === "pending" ? "selected" : ""}>
                  Pending
                </option>

                <option value="confirmed"
                  ${order.status === "confirmed" ? "selected" : ""}>
                  Confirmed
                </option>

                <option value="processing"
                  ${order.status === "processing" ? "selected" : ""}>
                  Processing
                </option>

                <option value="shipped"
                  ${order.status === "shipped" ? "selected" : ""}>
                  Shipped
                </option>

                <option value="delivered"
                  ${order.status === "delivered" ? "selected" : ""}>
                  Delivered
                </option>

                <option value="cancelled"
                  ${order.status === "cancelled" ? "selected" : ""}>
                  Cancelled
                </option>

              </select>

            </td>

            <td>

              <select
                class="payment-status-select"
                data-payment-status="${order.id}"
              >

                <option value="unpaid"
                  ${order.payment_status === "unpaid" ? "selected" : ""}>
                  Unpaid
                </option>

                <option value="paid"
                  ${order.payment_status === "paid" ? "selected" : ""}>
                  Paid
                </option>

                <option value="refunded"
                  ${order.payment_status === "refunded" ? "selected" : ""}>
                  Refunded
                </option>

              </select>

            </td>

            <td>
              ${escapeHtml(date)}
            </td>

          </tr>
        `;

      }).join("");

    document
      .querySelectorAll("[data-order-status]")
      .forEach(select => {

        select.addEventListener(
          "change",
          async () => {

            await updateOrder(
              select.dataset.orderStatus,
              {
                status: select.value
              }
            );

          }
        );
      });

    document
      .querySelectorAll("[data-payment-status]")
      .forEach(select => {

        select.addEventListener(
          "change",
          async () => {

            await updateOrder(
              select.dataset.paymentStatus,
              {
                payment_status: select.value
              }
            );

          }
        );
      });
  }


  /* =======================================================
     UPDATE ORDER
     ======================================================= */

  async function updateOrder(id, changes) {

    const { error } =
      await db
        .from("orders")
        .update(changes)
        .eq("id", id);

    if (error) {

      alert(
        error.message ||
        "Unable to update order."
      );

      return;
    }

    await loadAdminOrders();
  }


  /* =======================================================
     DASHBOARD REFRESH
     ======================================================= */

  async function refreshDashboard() {

    await Promise.all([
      loadAdminProducts(),
      loadAdminOrders()
    ]);
  }


  document
    .getElementById("refreshProductsButton")
    ?.addEventListener(
      "click",
      loadAdminProducts
    );

  document
    .getElementById("refreshOrdersButton")
    ?.addEventListener(
      "click",
      loadAdminOrders
    );


  /* =======================================================
     INITIALIZE
     ======================================================= */

  document.addEventListener(
    "DOMContentLoaded",
    checkAdmin
  );

})();

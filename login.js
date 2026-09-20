/**
 * ============================================================
 * SRCCFPC SHARED CLIENT RUNTIME
 * ============================================================
 * Handles navigation, authentication UI, cursor lighting,
 * card spotlights, GSAP, ScrollTrigger, Lenis and API forms.
 */

// ⚠️⚠️⚠️ GOOGLE APPS SCRIPT API URL — EDIT THIS ONE LINE ONLY ⚠️⚠️⚠️
// This MUST be the exact same Web App URL used in admin.js and join.js.
// If you ever redeploy admin.gs as a brand-new deployment (not "New
// version" on the existing one), Google gives you a NEW /exec URL —
// update it here (and in admin.js / join.js) too.
const SRCCFPC_API_URL = "https://script.google.com/macros/s/AKfycbyRrT4TS8ZrvNqw_WzO8T1ll96YMr9aUTY2KfA7h7Jija3uaGx1ZTptSXDWp8fRAfcPjg/exec";

/**
 * Selects the first matching element.
 * @param {string} selector CSS selector.
 * @param {ParentNode} [root=document] Search root.
 * @returns {Element|null} Matching element.
 */
function selectElement(selector, root = document) {
  return root.querySelector(selector);
}

/**
 * Selects all matching elements.
 * @param {string} selector CSS selector.
 * @param {ParentNode} [root=document] Search root.
 * @returns {Element[]} Matching elements.
 */
function selectElements(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

/**
 * Returns the locally stored opaque session token.
 * @returns {string|null} Session token.
 */
function getSessionToken() {
  return localStorage.getItem("srccfpc_session");
}

/**
 * Displays a temporary toast notification.
 * @param {string} message Message to display.
 * @returns {void}
 */
function showToast(message) {
  const toast = selectElement("#toast");

  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add("is-visible");

  window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 3200);
}

/**
 * Updates guest/member navigation state.
 * @returns {void}
 */
function updateAuthenticationUI() {
  const sessionToken = getSessionToken();
  const authenticated = Boolean(sessionToken);

  document.body.classList.toggle("authenticated", authenticated);

  let user = {};
  try {
    user = JSON.parse(
      localStorage.getItem("srccfpc_user") || "{}"
    );
  } catch (error) {
    user = {};
  }

  const welcomeText = selectElement("#welcomeText");
  if (welcomeText) {
    welcomeText.textContent = authenticated
      ? (user.username ? `Welcome, ${user.username}` : "Member")
      : "Member";
  }

  // Member-only navigation is controlled by authentication.
  selectElements(".protected-nav").forEach((element) => {
    element.hidden = !authenticated;
    element.setAttribute("aria-hidden", String(!authenticated));
  });

  // Admin navigation is controlled by the server-issued role.
  const isAdmin = authenticated && String(user.role || "").toLowerCase() === "admin";
  selectElements("[data-admin-only]").forEach((element) => {
    element.hidden = !isAdmin;
    element.setAttribute("aria-hidden", String(!isAdmin));
  });

  // Guest actions remain available only while signed out.
  selectElements(".guest-only").forEach((element) => {
    element.hidden = authenticated;
  });
}

/**
 * Opens or closes the mobile navigation drawer.
 * The required .active state is applied directly to the drawer.
 * @returns {void}
 */
function toggleMobileNavigation() {
  const drawer = selectElement("#navDrawer");
  const toggle = selectElement("#navToggle");

  if (!drawer || !toggle) {
    return;
  }

  const isActive = drawer.classList.toggle("active");

  toggle.setAttribute(
    "aria-expanded",
    String(isActive)
  );
}

/**
 * Closes the mobile navigation drawer.
 * @returns {void}
 */
function closeMobileNavigation() {
  const drawer = selectElement("#navDrawer");
  const toggle = selectElement("#navToggle");

  if (!drawer || !toggle) {
    return;
  }

  drawer.classList.remove("active");
  toggle.setAttribute("aria-expanded", "false");
}

/**
 * Ends the current local session.
 * @returns {void}
 */
function logoutMember() {
  localStorage.removeItem("srccfpc_session");
  localStorage.removeItem("srccfpc_user");

  showToast("Secure session closed.");

  window.setTimeout(() => {
    window.location.href = "index.html";
  }, 450);
}

/**
 * Creates a visual click ripple.
 * @param {MouseEvent} event Pointer event.
 * @returns {void}
 */
function createButtonRipple(event) {
  const button = event.target.closest(".btn");

  if (!button) {
    return;
  }

  const rectangle = button.getBoundingClientRect();
  const ripple = document.createElement("span");

  ripple.className = "click-ripple";
  ripple.style.left = `${event.clientX - rectangle.left}px`;
  ripple.style.top = `${event.clientY - rectangle.top}px`;

  button.appendChild(ripple);

  window.setTimeout(() => {
    ripple.remove();
  }, 700);
}

/**
 * Updates each glass card's spotlight coordinates.
 * @param {MouseEvent} event Pointer movement event.
 * @returns {void}
 */
function updateCardSpotlight(event) {
  const card = event.target.closest(".glass-card");

  if (!card) {
    return;
  }

  const rectangle = card.getBoundingClientRect();
  const x = ((event.clientX - rectangle.left) / rectangle.width) * 100;
  const y = ((event.clientY - rectangle.top) / rectangle.height) * 100;

  card.style.setProperty("--spot-x", `${x}%`);
  card.style.setProperty("--spot-y", `${y}%`);
}

/**
 * Initializes the glowing cursor and light-beam spotlight.
 * @returns {void}
 */
function initializeCursorLighting() {
  const dot = document.createElement("div");
  const spotlight = document.createElement("div");

  dot.className = "cursor-dot";
  spotlight.className = "cursor-spotlight";

  document.body.append(dot, spotlight);

  window.addEventListener("pointermove", (event) => {
    dot.style.left = `${event.clientX}px`;
    dot.style.top = `${event.clientY}px`;
    spotlight.style.left = `${event.clientX}px`;
    spotlight.style.top = `${event.clientY}px`;
  });
}

/**
 * Dynamically loads a script resource.
 * @param {string} source Script URL.
 * @returns {Promise<void>} Resolves after successful loading.
 */
function loadExternalScript(source) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${source}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement("script");

    script.src = source;

    script.onload = () => resolve();

    script.onerror = () => {
      reject(
        new Error(`Could not load ${source}`)
      );
    };

    document.head.appendChild(script);
  });
}

/**
 * Initializes Lenis inertia scrolling.
 * @returns {Promise<void>} Initialization promise.
 */
async function initializeLenis() {
  try {
    await loadExternalScript(
      "https://cdn.jsdelivr.net/npm/lenis@1.1.18/dist/lenis.min.js"
    );

    if (!window.Lenis) {
      return;
    }

    const lenis = new window.Lenis({
      duration: 1.15,
      smoothWheel: true,
      wheelMultiplier: 0.95
    });

    window.SRCCFPC_LENIS = lenis;

    /**
     * Runs Lenis' animation frame.
     * @param {number} time Current animation time.
     * @returns {void}
     */
    function animationFrame(time) {
      lenis.raf(time);
      window.requestAnimationFrame(animationFrame);
    }

    window.requestAnimationFrame(animationFrame);
  } catch (error) {
    console.warn(
      "Lenis enhancement unavailable; native smooth scrolling remains active.",
      error
    );
  }
}

/**
 * Initializes GSAP and ScrollTrigger reveal animations.
 * @returns {Promise<void>} Initialization promise.
 */
async function initializeGSAP() {
  try {
    await loadExternalScript(
      "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"
    );

    await loadExternalScript(
      "https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"
    );

    if (!window.gsap || !window.ScrollTrigger) {
      return;
    }

    window.gsap.registerPlugin(
      window.ScrollTrigger
    );

    selectElements(".reveal").forEach((element) => {
      window.gsap.to(element, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: element,
          start: "top 88%",
          once: true
        }
      });
    });

    selectElements("[data-count]").forEach((element) => {
      const target = Number(
        element.dataset.count
      );

      window.gsap.fromTo(
        element,
        { textContent: 0 },
        {
          textContent: target,
          duration: 1.8,
          snap: { textContent: 1 },
          scrollTrigger: {
            trigger: element,
            start: "top 90%",
            once: true
          }
        }
      );
    });

    if (window.SRCCFPC_LENIS) {
      window.SRCCFPC_LENIS.on(
        "scroll",
        window.ScrollTrigger.update
      );
    }
  } catch (error) {
    console.warn(
      "GSAP enhancement unavailable.",
      error
    );
  }
}

/**
 * Calls the Google Apps Script JSON API.
 * @param {string} action API action name.
 * @param {Object} data Payload object.
 * @param {string|null} [token=getSessionToken()] Session token.
 * @returns {Promise<Object>} Parsed API response.
 */
async function callSRCCFPCAPI(
  action,
  data,
  token = getSessionToken()
) {
  const endpoint = SRCCFPC_API_URL;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      data,
      token
    })
  });

  if (!response.ok) {
    throw new Error(
      `Backend returned HTTP ${response.status}.`
    );
  }

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      result.message || "Backend request failed."
    );
  }

  return result;
}

/**
 * Handles a generic API-backed form.
 * @param {SubmitEvent} event Form submission event.
 * @returns {Promise<void>}
 */
async function handleAPIForm(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = selectElement(
    'button[type="submit"]',
    form
  );

  const action = form.dataset.api;
  const data = Object.fromEntries(
    new FormData(form)
  );

  button?.classList.add("is-loading");

  try {
    const result = await callSRCCFPCAPI(
      action,
      data
    );

    showToast(
      result.message || "Submission completed."
    );

    form.reset();
  } catch (error) {
    showToast(error.message);
  } finally {
    button?.classList.remove("is-loading");
  }
}


/**
 * Enforces a client-side protected-route redirect for user experience.
 * Backend authorization independently protects sensitive operations.
 * @returns {void}
 */
function enforceProtectedRoute() {
  if (
    document.body.dataset.protected !== "true" ||
    getSessionToken()
  ) {
    return;
  }

  const currentPage = encodeURIComponent(
    window.location.pathname.split("/").pop()
  );

  window.location.replace(
    `login.html?next=${currentPage}`
  );
}

/**
 * Initializes all shared client behavior.
 * @returns {void}
 */
function initializeSharedRuntime() {
  updateAuthenticationUI();
  enforceProtectedRoute();

  initializeCursorLighting();
  initializeLenis();
  initializeGSAP();

  selectElement("#navToggle")
    ?.addEventListener(
      "click",
      toggleMobileNavigation
    );

  selectElement("#logout")
    ?.addEventListener(
      "click",
      logoutMember
    );

  selectElements(".nav-link")
    .forEach((link) => {
      link.addEventListener(
        "click",
        closeMobileNavigation
      );
    });

  document.addEventListener(
    "click",
    createButtonRipple
  );

  document.addEventListener(
    "pointermove",
    updateCardSpotlight
  );

  selectElements("form[data-api]")
    .forEach((form) => {
      form.addEventListener(
        "submit",
        handleAPIForm
      );
    });
}

/* Public namespace for page-specific controllers. */
window.SRCCFPC = {
  callAPI: callSRCCFPCAPI,
  getSessionToken,
  showToast
};

document.addEventListener(
  "DOMContentLoaded",
  initializeSharedRuntime
);



/**
 * Login page controller.
 */

/**
 * Handles member authentication.
 * @param {SubmitEvent} event Login form event.
 * @returns {Promise<void>}
 */
async function handleLoginSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const button = form.querySelector(
    'button[type="submit"]'
  );

  const data = Object.fromEntries(
    new FormData(form)
  );

  button?.classList.add("is-loading");

  try {
    const result = await SRCCFPC.callAPI(
      "login",
      data,
      null
    );

    localStorage.removeItem("srccfpc_admin_token");

    localStorage.setItem(
      "srccfpc_session",
      result.token
    );

    localStorage.setItem(
      "srccfpc_user",
      JSON.stringify(result.user)
    );

    SRCCFPC.showToast(
      "Authentication successful."
    );

    const requestedNext = new URLSearchParams(
      window.location.search
    ).get("next");

    const safeNext = requestedNext &&
      /^[A-Za-z0-9_-]+\.html$/.test(requestedNext)
      ? requestedNext
      : "member-detail.html";

    window.setTimeout(() => {
      window.location.assign(safeNext);
    }, 500);
  } catch (error) {
    SRCCFPC.showToast(error.message);
  } finally {
    button?.classList.remove("is-loading");
  }
}

/**
 * Password Visibility Toggle
 * Switches the password field between type="password" (hidden) and
 * type="text" (visible) when the eye icon button is clicked.
 * @returns {void}
 */
function setupPasswordToggle() {
  const toggle = document.getElementById("togglePassword");
  const input = document.getElementById("password");

  if (!toggle || !input) {
    return;
  }

  toggle.addEventListener("click", () => {
    const willShow = input.type === "password";
    input.type = willShow ? "text" : "password";
    toggle.textContent = willShow ? "🙈" : "👁";
    toggle.setAttribute(
      "aria-label",
      willShow ? "Hide password" : "Show password"
    );
  });
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    document
      .querySelector("#loginForm")
      ?.addEventListener(
        "submit",
        handleLoginSubmit
      );

    setupPasswordToggle();
  }
);
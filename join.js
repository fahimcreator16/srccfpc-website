/*
  SRCCFPC Membership Portal
  Front-end only.
  For Google Sheets storage, paste your deployed Apps Script Web App URL
  into CONFIG.GOOGLE_SCRIPT_URL below.
*/

const CONFIG = {
  GOOGLE_SCRIPT_URL: "PASTE_YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE",
  MAX_PHOTO_MB: 5
};

const form = document.getElementById("membershipForm");
const submitBtn = document.getElementById("submitBtn");
const formStatus = document.getElementById("formStatus");
const photoInput = document.getElementById("photo");
const photoPreview = document.getElementById("photoPreview");
const previewWrap = document.getElementById("previewWrap");
const removePhoto = document.getElementById("removePhoto");
const photoError = document.getElementById("photoError");
const agreeTerms = document.getElementById("agreeTerms");
const termsError = document.getElementById("termsError");
const charCount = document.getElementById("charCount");
const whyJoin = document.querySelector('[name="whyJoin"]');

function setupAccordion(triggerSelector) {
  document.querySelectorAll(triggerSelector).forEach(trigger => {
    trigger.addEventListener("click", () => {
      const content = trigger.nextElementSibling;
      const open = trigger.getAttribute("aria-expanded") === "true";
      trigger.setAttribute("aria-expanded", String(!open));
      content.classList.toggle("open", !open);
    });
  });
}

setupAccordion(".accordion-trigger");
setupAccordion(".terms-toggle");

document.querySelectorAll(".reveal").forEach(el => {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  }, {threshold: .08});
  observer.observe(el);
});

whyJoin.addEventListener("input", () => {
  charCount.textContent = whyJoin.value.length;
});

photoInput.addEventListener("change", () => {
  photoError.textContent = "";
  const file = photoInput.files[0];
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    photoInput.value = "";
    photoError.textContent = "Please choose an image file.";
    return;
  }

  if (file.size > CONFIG.MAX_PHOTO_MB * 1024 * 1024) {
    photoInput.value = "";
    photoError.textContent = `Photo must be ${CONFIG.MAX_PHOTO_MB}MB or smaller.`;
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    photoPreview.src = e.target.result;
    previewWrap.classList.add("show");
  };
  reader.readAsDataURL(file);
});

removePhoto.addEventListener("click", e => {
  e.preventDefault();
  e.stopPropagation();
  photoInput.value = "";
  photoPreview.removeAttribute("src");
  previewWrap.classList.remove("show");
});

document.querySelectorAll(".glow-btn").forEach(btn => {
  btn.addEventListener("click", e => {
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  });
});

function getValue(name) {
  const el = form.querySelector(`[name="${name}"]:checked`);
  return el ? el.value : "";
}

function validate() {
  let valid = true;

  form.querySelectorAll("[required]").forEach(el => {
    if (el.type === "radio" || el.type === "checkbox") return;
    const field = el.closest(".field");
    const error = field?.querySelector(".error");
    if (!el.value.trim()) {
      valid = false;
      if (error) error.textContent = "This field is required.";
    } else if (error) {
      error.textContent = "";
    }
  });

  ["gender", "bloodGroup", "group", "paymentMethod"].forEach(name => {
    if (!getValue(name)) valid = false;
  });

  if (!photoInput.files[0]) {
    valid = false;
    photoError.textContent = "Please upload your photo.";
  }

  if (!agreeTerms.checked) {
    valid = false;
    termsError.textContent = "Please read and agree to the Membership Terms.";
  } else {
    termsError.textContent = "";
  }

  if (!form.checkValidity()) {
    valid = false;
  }

  return valid;
}

function setLoading(loading) {
  submitBtn.classList.toggle("loading", loading);
  submitBtn.disabled = loading;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function collectData(photoBase64, file) {
  return {
    timestamp: new Date().toISOString(),
    fullName: form.fullName.value.trim(),
    address: form.address.value.trim(),
    gender: getValue("gender"),
    bloodGroup: getValue("bloodGroup"),
    dob: form.dob.value,
    rollNumber: form.rollNumber.value.trim(),
    collegeId: form.collegeId.value.trim(),
    group: getValue("group"),
    section: form.section.value.trim(),
    mobile: form.mobile.value.trim(),
    email: form.email.value.trim(),
    facebook: form.facebook.value.trim(),
    photo: {
      base64: photoBase64,
      name: file.name,
      mimeType: file.type
    },
    paymentMethod: getValue("paymentMethod"),
    paymentNumber: form.paymentNumber.value.trim(),
    transactionId: form.transactionId.value.trim(),
    whyJoin: form.whyJoin.value.trim()
  };
}

function showModal() {
  const modal = document.getElementById("successModal");
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  const modal = document.getElementById("successModal");
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

document.querySelector(".modal-close").addEventListener("click", closeModal);
document.querySelector(".modal-backdrop").addEventListener("click", closeModal);

form.addEventListener("submit", async e => {
  e.preventDefault();
  formStatus.className = "form-status";

  if (!validate()) {
    formStatus.textContent = "Please complete all required fields.";
    formStatus.classList.add("error");
    form.querySelector(":invalid")?.scrollIntoView({behavior:"smooth", block:"center"});
    return;
  }

  if (!CONFIG.GOOGLE_SCRIPT_URL || CONFIG.GOOGLE_SCRIPT_URL.includes("PASTE_YOUR")) {
    formStatus.textContent = "Form UI is ready. Add your Google Apps Script Web App URL in join.js to enable submission.";
    formStatus.classList.add("error");
    return;
  }

  setLoading(true);
  formStatus.textContent = "Submitting your application...";

  try {
    const file = photoInput.files[0];
    const base64 = await fileToBase64(file);
    const payload = collectData(base64, file);

    const response = await fetch(CONFIG.GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: {"Content-Type": "text/plain;charset=utf-8"},
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.ok) {
      throw new Error(result.message || "Submission failed.");
    }

    form.reset();
    previewWrap.classList.remove("show");
    photoPreview.removeAttribute("src");
    charCount.textContent = "0";
    formStatus.textContent = "";
    showModal();

  } catch (error) {
    console.error(error);
    formStatus.textContent = "Submission failed. Please check your Apps Script URL and deployment settings.";
    formStatus.classList.add("error");
  } finally {
    setLoading(false);
  }
});

// Prevent accidental double submission by Enter in a text field.
form.addEventListener("keydown", e => {
  if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "radio") {
    e.preventDefault();
  }
});

(() => {
  "use strict";

  const form = document.getElementById("details-form");
  const statusEl = document.getElementById("form-status");
  const setupBanner = document.getElementById("setup-banner");
  const nameInput = document.getElementById("name");
  const emailInput = document.getElementById("email");
  const usnInput = document.getElementById("usn");
  const phoneInput = document.getElementById("phone");
  const manualFillBtn = document.getElementById("manual-fill-btn");

  let statusTimeout = null;

  function showStatus(message, isError = false) {
    if (statusTimeout) {
      clearTimeout(statusTimeout);
      statusTimeout = null;
    }
    statusEl.textContent = message;
    statusEl.className = isError ? "status-msg status-error" : "status-msg status-success";

    if (!isError) {
      statusTimeout = setTimeout(() => {
        statusEl.textContent = "";
        statusEl.className = "status-msg";
      }, 4000);
    }
  }

  function getFormDetails() {
    const checkedAttendance = form.querySelector('input[name="attendance"]:checked');
    return {
      name: nameInput.value.trim(),
      email: emailInput.value.trim(),
      usn: usnInput.value.trim(),
      phone: phoneInput.value.trim(),
      attendance: checkedAttendance ? checkedAttendance.value : ""
    };
  }

  function validate(details) {
    if (!details.name) {
      return "Please enter your Full Name.";
    }
    if (!details.email) {
      return "Please enter your College Email ID.";
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(details.email)) {
      return "Please enter a valid email address.";
    }
    if (!details.usn) {
      return "Please enter your USN Number.";
    }
    if (!details.phone) {
      return "Please enter your Mobile Number.";
    }
    if (!["Yes", "No"].includes(details.attendance)) {
      return "Please choose Yes or No for attendance.";
    }
    return null;
  }

  // Load saved details on popup open
  function loadSavedDetails() {
    if (!window.chrome?.storage?.local) return;

    chrome.storage.local.get("stepxDetails", (result) => {
      const details = result?.stepxDetails;
      if (details && typeof details === "object") {
        nameInput.value = details.name || "";
        emailInput.value = details.email || "";
        usnInput.value = details.usn || "";
        phoneInput.value = details.phone || "";

        if (details.attendance) {
          const radio = form.querySelector(`input[name="attendance"][value="${details.attendance}"]`);
          if (radio) {
            radio.checked = true;
          }
        }

        const isComplete = details.name && details.email && details.usn && details.phone && details.attendance;
        setupBanner.hidden = Boolean(isComplete);
      } else {
        setupBanner.hidden = false;
      }
    });
  }

  // Handle save
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const details = getFormDetails();
    const error = validate(details);

    if (error) {
      showStatus(error, true);
      return;
    }

    if (!window.chrome?.storage?.local) {
      showStatus("Error: Storage API not available", true);
      return;
    }

    chrome.storage.local.set({ stepxDetails: details }, () => {
      if (chrome.runtime?.lastError) {
        showStatus("Failed to save details: " + chrome.runtime.lastError.message, true);
        return;
      }
      setupBanner.hidden = true;
      showStatus("✓ Details saved", false);
    });
  });

  // Handle "Fill Current Form" manual button
  if (manualFillBtn) {
    manualFillBtn.addEventListener("click", () => {
      if (!window.chrome?.tabs) {
        showStatus("Tabs API not available", true);
        return;
      }

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs?.[0];
        if (!activeTab || !activeTab.id) {
          showStatus("No active tab detected", true);
          return;
        }

        const tabUrl = activeTab.url || "";
        const isSupportedDomain =
          tabUrl.includes("forms.cloud.microsoft") ||
          tabUrl.includes("forms.office.com") ||
          tabUrl.includes("forms.microsoft.com");

        if (!isSupportedDomain) {
          showStatus("⚠ Open a Microsoft Forms tab first", true);
          return;
        }

        showStatus("Filling form...", false);

        chrome.tabs.sendMessage(activeTab.id, { action: "STEPX_AUTOFILL_NOW" }, (response) => {
          if (chrome.runtime?.lastError) {
            // Content script might need to be injected dynamically
            if (chrome.scripting) {
              chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                files: ["content/content.js"]
              }, () => {
                setTimeout(() => {
                  chrome.tabs.sendMessage(activeTab.id, { action: "STEPX_AUTOFILL_NOW" }, (resp2) => {
                    handleResponse(resp2);
                  });
                }, 150);
              });
            } else {
              showStatus("⚠ Refresh the Microsoft Forms tab and try again", true);
            }
            return;
          }

          handleResponse(response);
        });
      });
    });
  }

  function handleResponse(response) {
    if (!response || !response.success) {
      showStatus(response?.reason ? `⚠ ${response.reason}` : "⚠ Could not autofill form", true);
      return;
    }

    if (response.count === response.total) {
      showStatus(`✓ ${response.count}/${response.total} fields filled`, false);
    } else {
      showStatus(`⚠ ${response.count}/${response.total} fields filled`, true);
    }
  }

  // Initialize
  document.addEventListener("DOMContentLoaded", loadSavedDetails);
  loadSavedDetails();
})();

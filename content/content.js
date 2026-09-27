/**
 * STEPX AutoFill - Production Content Script
 * Robust autofill for recurring Microsoft Forms attendance forms.
 * Supports forms.cloud.microsoft, forms.office.com, and forms.microsoft.com.
 */
(() => {
  "use strict";

  // Diagnostic log confirming content script is loaded
  console.log("[STEPX] Content script loaded");

  // Prevent duplicate execution in same frame
  if (window.__stepxAutoFillInitialized) return;
  window.__stepxAutoFillInitialized = true;

  const TEXT_FIELDS = ["name", "email", "usn", "phone"];
  const filledElements = new WeakSet();

  let savedDetails = null;
  let scanDebounceTimer = null;
  let feedbackTimer = null;
  let observer = null;
  let lastReportedScore = -1;

  /**
   * Normalizes question titles:
   * - Lowercase
   * - Replace non-breaking spaces (\u00a0) & zero-width spaces (\u200b)
   * - Strip asterisks (*)
   * - Strip leading question numbers e.g. "1. ", "2 )", "03-", "(4)"
   * - Remove punctuation and extra whitespace
   */
  function cleanQuestionTitle(str) {
    if (!str) return "";
    return String(str)
      .toLowerCase()
      .replace(/[\u00a0\u200b]/g, " ")
      .replace(/\*/g, " ")
      .replace(/^\s*\(?\d+\)?[\.\)\-:]\s*/g, " ") // removes leading "1. " or "2) " or "(3)"
      .replace(/[\u2018\u2019'"`]/g, "")
      .replace(/[\?:\-_,;\/\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Specifically matches the Name question title without false positives.
   * Tolerates "1. Name *", "1. Name", "1 Name *", "1.Name*", "Name *", "Full Name *", "Student Name *".
   */
  function isNameTitle(rawText) {
    if (!rawText) return false;
    const cleaned = cleanQuestionTitle(rawText);
    const normalized = cleaned.replace(/^\s*\d+\s*/, "").trim();

    return (
      normalized === "name" ||
      normalized === "full name" ||
      normalized === "student name" ||
      normalized === "students name" ||
      normalized === "name of the student" ||
      normalized === "name of student" ||
      normalized === "candidate name" ||
      normalized === "name of the candidate"
    );
  }

  /**
   * Matches normalized question text to a credential field key.
   */
  function matchField(rawText) {
    if (!rawText) return null;
    const t = cleanQuestionTitle(rawText);
    if (!t) return null;

    // 1. Attendance check
    if (
      t.includes("attending the session") ||
      t.includes("will you attend the session") ||
      t.includes("will you attend") ||
      t.includes("are you attending the session") ||
      t.includes("are you attending") ||
      t === "attending the session"
    ) {
      return "attendance";
    }

    // 2. Email check
    if (
      t.includes("college email id") ||
      t.includes("college email") ||
      t.includes("email id") ||
      t.includes("email address") ||
      t === "email" ||
      t.startsWith("email ") ||
      t.endsWith(" email")
    ) {
      return "email";
    }

    // 3. USN check
    if (
      t.includes("usn number") ||
      t.includes("usn no") ||
      t.includes("usn") ||
      t.includes("university id") ||
      t.includes("student id") ||
      t.includes("registration number") ||
      t.includes("roll number")
    ) {
      return "usn";
    }

    // 4. Phone check
    if (
      t.includes("mobile number") ||
      t.includes("mobile no") ||
      t.includes("mobile") ||
      t.includes("phone number") ||
      t.includes("phone no") ||
      t.includes("phone") ||
      t.includes("contact number")
    ) {
      return "phone";
    }

    // 5. Name check (uses dedicated robust matcher)
    if (isNameTitle(rawText)) {
      return "name";
    }

    return null;
  }

  /**
   * Check if an element is visible in the DOM.
   */
  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    if (el.hidden || el.getAttribute("aria-hidden") === "true") return false;

    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  /**
   * Extracts accessible text from an element.
   */
  function getAccessibleText(el) {
    if (!el) return "";
    const parts = [];

    const ariaLabel = el.getAttribute("aria-label");
    if (ariaLabel) parts.push(ariaLabel);

    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) {
        const refEl = document.getElementById(id);
        if (refEl && refEl.textContent) {
          parts.push(refEl.textContent);
        }
      }
    }

    if (el.labels && el.labels.length > 0) {
      for (const lbl of el.labels) {
        if (lbl.textContent) parts.push(lbl.textContent);
      }
    }

    return parts.join(" ").trim();
  }

  /**
   * Determines if the current page is a STEPX Microsoft Form.
   * Signal 1: Page text or document title contains "STEPX".
   * Signal 2: At least 2 known attendance question fields are present on the page.
   */
  function isStepxForm() {
    const rawBody = document.body ? (document.body.innerText || document.body.textContent || "") : "";
    const rawTitle = document.title || "";
    const pageText = cleanQuestionTitle(`${rawTitle} ${rawBody}`);

    if (!pageText.includes("stepx")) {
      return false;
    }

    const testPhrases = [
      "college email id", "college email", "email id",
      "usn number", "usn no", "usn",
      "mobile number", "mobile", "phone number",
      "name", "full name", "student name"
    ];

    let foundCount = 0;
    for (const phrase of testPhrases) {
      if (pageText.includes(phrase)) {
        foundCount++;
      }
    }

    return foundCount >= 2;
  }

  /**
   * Dedicated resolver for the Name field to guarantee detection on all Microsoft Forms layouts.
   */
  function findNameInput() {
    console.log("[STEPX DEBUG] Searching for Name field");

    // 1. Look for question title matching Name
    const titleCandidates = Array.from(document.querySelectorAll(
      '[data-automation-id="questionTitle"], .office-form-question-title, .question-title-box, [class*="questionTitle"], [class*="question-title"], .fui-Label, label, span, div, h2, h3, h4'
    ));

    let nameTitleEl = null;
    let nameContainer = null;
    let nameInput = null;

    for (const el of titleCandidates) {
      const text = (el.textContent || "").trim();
      if (text.length > 80) continue;

      if (isNameTitle(text)) {
        nameTitleEl = el;
        nameContainer = el.closest(
          '[data-automation-id="questionItem"], .office-form-question, .question-item, [role="group"], .fui-Field'
        ) || el.parentElement?.parentElement || el.parentElement;
        break;
      }
    }

    if (nameContainer) {
      console.log("[STEPX DEBUG] Name question found");

      // Find input inside the Name question container
      nameInput = nameContainer.querySelector(
        'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]), textarea'
      );

      // Check aria-labelledby referencing the title element id
      if (!nameInput && nameTitleEl && nameTitleEl.id) {
        nameInput = document.querySelector(`input[aria-labelledby~="${nameTitleEl.id}"], textarea[aria-labelledby~="${nameTitleEl.id}"]`);
      }

      // Check siblings of title
      if (!nameInput && nameTitleEl) {
        let sibling = nameTitleEl.nextElementSibling;
        while (sibling && !nameInput) {
          nameInput = sibling.querySelector('input, textarea') || (sibling.tagName === "INPUT" || sibling.tagName === "TEXTAREA" ? sibling : null);
          sibling = sibling.nextElementSibling;
        }
      }
    }

    // Fallback: Check all inputs for aria-label or aria-labelledby pointing to Name
    if (!nameInput) {
      const allInputs = Array.from(document.querySelectorAll(
        'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]), textarea'
      ));

      for (const input of allInputs) {
        if (!isVisible(input)) continue;

        // Check aria-label
        const ariaLabel = input.getAttribute("aria-label");
        if (ariaLabel && isNameTitle(ariaLabel)) {
          nameInput = input;
          console.log("[STEPX DEBUG] Name question found via aria-label");
          break;
        }

        // Check aria-labelledby
        const labelledBy = input.getAttribute("aria-labelledby");
        if (labelledBy) {
          for (const id of labelledBy.split(/\s+/)) {
            const refEl = document.getElementById(id);
            if (refEl && isNameTitle(refEl.textContent)) {
              nameInput = input;
              console.log("[STEPX DEBUG] Name question found via aria-labelledby");
              break;
            }
          }
          if (nameInput) break;
        }

        // Check parent container text
        let parent = input.parentElement;
        for (let depth = 0; parent && depth < 8; depth++, parent = parent.parentElement) {
          if (parent.tagName === "FORM" || parent.tagName === "BODY") break;
          const pText = parent.textContent || "";
          if (pText.length > 250) continue;
          const candidateTitle = parent.querySelector('[data-automation-id="questionTitle"], .office-form-question-title, label, span');
          if (candidateTitle && isNameTitle(candidateTitle.textContent)) {
            nameInput = input;
            console.log("[STEPX DEBUG] Name question found via container traversal");
            break;
          }
        }
        if (nameInput) break;
      }
    }

    if (nameInput) {
      console.log("[STEPX DEBUG] Name input found");
      console.log(`[STEPX DEBUG] Name input type = ${nameInput.type || "text"}`);
      console.log(`[STEPX DEBUG] Name input placeholder = ${nameInput.placeholder || "none"}`);
      console.log(`[STEPX DEBUG] Name input tag = ${nameInput.tagName}`);
      console.log(`[STEPX DEBUG] Name input aria-label = ${nameInput.getAttribute("aria-label") || "none"}`);
      console.log(`[STEPX DEBUG] Name input role = ${nameInput.getAttribute("role") || "none"}`);
    } else {
      console.log("[STEPX DEBUG] Could not locate Name input");
    }

    return nameInput;
  }

  /**
   * Sets the value of a text input or textarea, compatible with React / Fluent UI.
   * Uses the native prototype setter, clears React value tracker, and dispatches events.
   */
  function setNativeValue(input, value) {
    if (!input || value == null) return false;

    // Focus element to trigger any active React/Fluent UI listeners
    input.focus();

    // Traverse prototype chain to find true native value setter
    let proto = Object.getPrototypeOf(input);
    let descriptor = null;
    while (proto && !descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      proto = Object.getPrototypeOf(proto);
    }

    // Reset React's internal valueTracker if present
    if (input._valueTracker) {
      input._valueTracker.setValue("");
    }

    if (descriptor && descriptor.set) {
      descriptor.set.call(input, value);
    } else {
      input.value = value;
    }

    // Mark as autofilled by STEPX
    input.setAttribute("data-stepx-autofilled", "true");

    // Dispatch input and change events with bubbles
    input.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));

    // Blur to commit value
    input.blur();

    return input.value === value;
  }

  /**
   * Dispatches realistic click sequence on a radio/choice element.
   */
  function triggerChoiceClick(el) {
    if (!el) return;
    el.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("pointerup", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
    el.click();

    const innerInput = el.querySelector('input[type="radio"]') || (el instanceof HTMLInputElement ? el : null);
    if (innerInput) {
      innerInput.checked = true;
      innerInput.dispatchEvent(new Event("input", { bubbles: true }));
      innerInput.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      el.setAttribute("aria-checked", "true");
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  /**
   * Checks whether a choice/radio control is currently in a selected state.
   */
  function isChoiceChecked(el) {
    if (!el) return false;
    if (el.checked === true) return true;
    if (el.getAttribute("aria-checked") === "true") return true;
    if (el.getAttribute("aria-selected") === "true") return true;

    const childInput = el.querySelector('input[type="radio"]');
    if (childInput && childInput.checked) return true;

    const childRadio = el.querySelector('[role="radio"]');
    if (childRadio && childRadio.getAttribute("aria-checked") === "true") return true;

    return false;
  }

  /**
   * Discovers all question containers and maps them to fields.
   */
  function locateQuestionItems() {
    const questionItems = {
      name: { container: null, input: null },
      email: { container: null, input: null },
      usn: { container: null, input: null },
      phone: { container: null, input: null },
      attendance: { container: null, options: [] }
    };

    // 1. Locate all question container candidates
    const containerCandidates = Array.from(document.querySelectorAll(
      '[data-automation-id="questionItem"], .office-form-question, .question-item, [role="group"], [role="radiogroup"], .fui-Field'
    ));

    for (const container of containerCandidates) {
      if (!isVisible(container)) continue;

      // Extract title from container
      const titleEl = container.querySelector(
        '[data-automation-id="questionTitle"], .office-form-question-title, .question-title-box, [class*="questionTitle"], [class*="question-title"], .fui-Label, label'
      );
      const titleText = titleEl ? titleEl.textContent : container.textContent;
      const field = matchField(titleText);

      if (field && questionItems[field]) {
        questionItems[field].container = container;

        if (field === "attendance") {
          const radios = container.querySelectorAll(
            '[role="radio"], [role="option"], input[type="radio"], label.office-form-choice, label[class*="Radio"], [data-automation-id="choiceItem"]'
          );
          questionItems.attendance.options = Array.from(radios);
        } else {
          const input = container.querySelector(
            'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]), textarea, [role="textbox"]'
          );
          if (input) {
            questionItems[field].input = input;
          }
        }
      }
    }

    // 2. Secondary fallback: check all inputs directly in case containers lacked standard attributes
    const textInputs = Array.from(document.querySelectorAll(
      'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]), textarea, [role="textbox"]'
    ));

    for (const input of textInputs) {
      if (!isVisible(input)) continue;

      // Check direct accessible text on the input
      const accText = getAccessibleText(input);
      let field = matchField(accText);

      // Check surrounding container if not found directly
      if (!field) {
        let parent = input.parentElement;
        for (let depth = 0; parent && depth < 8; depth++, parent = parent.parentElement) {
          if (parent.tagName === "FORM" || parent.tagName === "BODY") break;
          const text = parent.textContent || "";
          if (text.length > 500) continue;
          field = matchField(text);
          if (field) {
            if (!questionItems[field].container) questionItems[field].container = parent;
            break;
          }
        }
      }

      if (field && TEXT_FIELDS.includes(field) && !questionItems[field].input) {
        questionItems[field].input = input;
      }
    }

    // 3. Secondary fallback for attendance question if not yet found
    if (!questionItems.attendance.container || questionItems.attendance.options.length === 0) {
      const allRadios = Array.from(document.querySelectorAll(
        '[role="radio"], [role="option"], input[type="radio"], [data-automation-id="choiceItem"]'
      ));

      for (const radio of allRadios) {
        if (!isVisible(radio)) continue;
        let parent = radio.parentElement;
        for (let depth = 0; parent && depth < 8; depth++, parent = parent.parentElement) {
          if (parent.tagName === "FORM" || parent.tagName === "BODY") break;
          if (matchField(parent.textContent) === "attendance") {
            questionItems.attendance.container = parent;
            questionItems.attendance.options = Array.from(parent.querySelectorAll(
              '[role="radio"], [role="option"], input[type="radio"], label.office-form-choice, label[class*="Radio"], [data-automation-id="choiceItem"]'
            ));
            break;
          }
        }
        if (questionItems.attendance.container) break;
      }
    }

    return questionItems;
  }

  /**
   * Displays the non-intrusive bottom-right feedback badge.
   * Completely secure: never prints user credentials.
   */
  function showFeedback(score, total = 5) {
    let badge = document.getElementById("stepx-autofill-notification");

    if (!badge) {
      badge = document.createElement("div");
      badge.id = "stepx-autofill-notification";
      badge.setAttribute("role", "status");
      badge.setAttribute("aria-live", "polite");

      Object.assign(badge.style, {
        position: "fixed",
        bottom: "24px",
        right: "24px",
        zIndex: "2147483647",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        padding: "10px 16px",
        borderRadius: "10px",
        backgroundColor: "#0b0f19",
        color: "#f8fafc",
        border: "1px solid rgba(16, 185, 129, 0.4)",
        boxShadow: "0 8px 30px rgba(0, 0, 0, 0.45), 0 0 16px rgba(16, 185, 129, 0.2)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        fontSize: "13px",
        fontWeight: "600",
        letterSpacing: "0.01em",
        pointerEvents: "none",
        transition: "opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1), transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        opacity: "0",
        transform: "translateY(12px) scale(0.96)"
      });

      const iconSvg = `
        <div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#10b981;color:#ffffff;flex-shrink:0;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
      `;
      const textSpan = `<span id="stepx-notification-text" style="color:#ffffff;">STEPX AutoFill ✓ · ${score}/${total} fields filled</span>`;
      badge.innerHTML = `${iconSvg} ${textSpan}`;
      document.documentElement.appendChild(badge);
    } else {
      const textSpan = document.getElementById("stepx-notification-text");
      if (textSpan) {
        textSpan.textContent = `STEPX AutoFill ✓ · ${score}/${total} fields filled`;
      }
    }

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        badge.style.opacity = "1";
        badge.style.transform = "translateY(0) scale(1)";
      });
    } else {
      badge.style.opacity = "1";
      badge.style.transform = "translateY(0) scale(1)";
    }

    if (feedbackTimer) clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(() => {
      badge.style.opacity = "0";
      badge.style.transform = "translateY(10px) scale(0.96)";
      setTimeout(() => {
        if (badge && badge.parentElement) {
          badge.parentElement.removeChild(badge);
        }
      }, 350);
    }, 4000);
  }

  /**
   * Main Autofill routine.
   * Inspects questions, fills empty inputs with React setters,
   * ensures Attendance accurately reflects user preference,
   * logs required debug format, and returns the result.
   */
  function executeAutofill(isManualTrigger = false) {
    if (!savedDetails || !document.body) {
      return { success: false, reason: "No saved details available" };
    }

    if (!isStepxForm()) {
      return { success: false, reason: "Not a STEPX form" };
    }

    console.log("[STEPX] STEPX form detected");

    const items = locateQuestionItems();
    let filledCount = 0;
    const totalFields = 5;

    // Field 1: Name (Robust dedicated detection)
    let nameInput = items.name.input;
    if (!nameInput) {
      nameInput = findNameInput();
      if (nameInput) {
        items.name.input = nameInput;
      }
    } else {
      console.log("[STEPX DEBUG] Searching for Name field");
      console.log("[STEPX DEBUG] Name question found");
      console.log("[STEPX DEBUG] Name input found");
      console.log(`[STEPX DEBUG] Name input type = ${nameInput.type || "text"}`);
      console.log(`[STEPX DEBUG] Name input placeholder = ${nameInput.placeholder || "none"}`);
      console.log(`[STEPX DEBUG] Name input tag = ${nameInput.tagName}`);
      console.log(`[STEPX DEBUG] Name input aria-label = ${nameInput.getAttribute("aria-label") || "none"}`);
      console.log(`[STEPX DEBUG] Name input role = ${nameInput.getAttribute("role") || "none"}`);
    }

    if (nameInput) {
      console.log("[STEPX] Found question: Name");
      console.log("[STEPX] Name input found");

      const currentVal = (nameInput.value || "").trim();
      if (currentVal.length === 0 || nameInput.hasAttribute("data-stepx-autofilled")) {
        const ok = setNativeValue(nameInput, savedDetails.name);
        if (ok) {
          filledElements.add(nameInput);
          filledCount++;
          console.log("[STEPX DEBUG] Name field filled successfully");
          console.log("[STEPX] Name filled successfully");
        } else {
          console.log("[STEPX DEBUG] Could not verify Name field value setter");
        }
      } else {
        // Manual user entry preserved
        filledCount++;
        console.log("[STEPX] Name already has manual entry, preserved");
      }
    } else {
      console.log("[STEPX DEBUG] Could not locate Name field");
      console.log("[STEPX] Could not locate Name question");
    }

    // Field 2: College Email ID
    if (items.email.container || items.email.input) {
      console.log("[STEPX] Found question: College Email ID");
      const input = items.email.input;
      if (input) {
        console.log("[STEPX] Email input found");
        const currentVal = (input.value || "").trim();
        if (currentVal.length === 0 || input.hasAttribute("data-stepx-autofilled")) {
          const ok = setNativeValue(input, savedDetails.email);
          if (ok) {
            filledElements.add(input);
            filledCount++;
            console.log("[STEPX] Email filled successfully");
          }
        } else {
          filledCount++;
          console.log("[STEPX] Email already has manual entry, preserved");
        }
      } else {
        console.log("[STEPX] Could not locate Email input");
      }
    } else {
      console.log("[STEPX] Could not locate College Email ID question");
    }

    // Field 3: USN Number
    if (items.usn.container || items.usn.input) {
      console.log("[STEPX] Found question: USN Number");
      const input = items.usn.input;
      if (input) {
        console.log("[STEPX] USN input found");
        const currentVal = (input.value || "").trim();
        if (currentVal.length === 0 || input.hasAttribute("data-stepx-autofilled")) {
          const ok = setNativeValue(input, savedDetails.usn);
          if (ok) {
            filledElements.add(input);
            filledCount++;
            console.log("[STEPX] USN filled successfully");
          }
        } else {
          filledCount++;
          console.log("[STEPX] USN already has manual entry, preserved");
        }
      } else {
        console.log("[STEPX] Could not locate USN input");
      }
    } else {
      console.log("[STEPX] Could not locate USN Number question");
    }

    // Field 4: Mobile number
    if (items.phone.container || items.phone.input) {
      console.log("[STEPX] Found question: Mobile number");
      const input = items.phone.input;
      if (input) {
        console.log("[STEPX] Phone input found");
        const currentVal = (input.value || "").trim();
        if (currentVal.length === 0 || input.hasAttribute("data-stepx-autofilled")) {
          const ok = setNativeValue(input, savedDetails.phone);
          if (ok) {
            filledElements.add(input);
            filledCount++;
            console.log("[STEPX] Phone filled successfully");
          }
        } else {
          filledCount++;
          console.log("[STEPX] Phone already has manual entry, preserved");
        }
      } else {
        console.log("[STEPX] Could not locate Phone input");
      }
    } else {
      console.log("[STEPX] Could not locate Mobile number question");
    }

    // Field 5: Attendance (Are you attending the session ?)
    if (items.attendance.container && items.attendance.options.length > 0) {
      console.log("[STEPX] Found attendance question");
      const targetChoice = (savedDetails.attendance || "Yes").trim().toLowerCase(); // "yes" or "no"

      let yesOption = null;
      let noOption = null;

      for (const opt of items.attendance.options) {
        const text = cleanQuestionTitle(`${opt.textContent || ""} ${getAccessibleText(opt)} ${opt.value || ""}`);
        if (text.includes("yes") || text === "yes") {
          yesOption = opt;
        } else if (text.includes("no") || text === "no") {
          noOption = opt;
        }
      }

      const targetOption = targetChoice === "yes" ? yesOption : noOption;
      const optionName = targetChoice === "yes" ? "Yes" : "No";

      if (targetOption) {
        console.log(`[STEPX] Found ${optionName} option`);

        // Check if target is already selected
        const isAlreadySelected = isChoiceChecked(targetOption);

        if (isAlreadySelected) {
          filledCount++;
          console.log("[STEPX] Attendance selected successfully");
        } else {
          // Trigger selection to match saved preference (even if form defaulted to the other option)
          triggerChoiceClick(targetOption);

          // Verify state
          if (isChoiceChecked(targetOption)) {
            filledCount++;
            console.log("[STEPX] Attendance selected successfully");
          } else {
            console.log("[STEPX] Could not verify attendance selection");
          }
        }
      } else {
        console.log(`[STEPX] Could not locate ${optionName} option inside attendance question`);
      }
    } else {
      console.log("[STEPX] Could not locate attendance question");
    }

    console.log(`[STEPX] Autofill result: ${filledCount}/${totalFields}`);

    if (filledCount > 0 && (filledCount !== lastReportedScore || isManualTrigger)) {
      lastReportedScore = filledCount;
      showFeedback(filledCount, totalFields);
    }

    return {
      success: true,
      count: filledCount,
      total: totalFields
    };
  }

  /**
   * Debounced scanner for DOM mutations.
   */
  function scheduleScan(delay = 120) {
    if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
    scanDebounceTimer = setTimeout(() => {
      scanDebounceTimer = null;
      executeAutofill(false);
    }, delay);
  }

  /**
   * Initializes content script, observer, delayed scans, and message listeners.
   */
  function initialize() {
    if (!window.chrome?.storage?.local) return;

    // Listen for manual fill triggers from popup "Fill Current Form" button
    if (window.chrome.runtime?.onMessage) {
      window.chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request?.action === "STEPX_AUTOFILL_NOW") {
          const result = executeAutofill(true);
          sendResponse(result);
        }
        return true; // Keep message channel open for async response
      });
    }

    // Listen for storage changes in real time
    if (window.chrome.storage.onChanged) {
      window.chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.stepxDetails) {
          savedDetails = changes.stepxDetails.newValue || null;
          if (savedDetails) {
            scheduleScan(50);
          }
        }
      });
    }

    // Setup MutationObserver to watch for dynamic DOM rendering
    observer = new MutationObserver((mutations) => {
      let shouldScan = false;
      for (const m of mutations) {
        if (m.type === "childList" && m.addedNodes.length > 0) {
          const isOurToast = Array.from(m.addedNodes).some(
            (n) => n.id === "stepx-autofill-notification"
          );
          if (!isOurToast) {
            shouldScan = true;
            break;
          }
        } else if (m.type === "attributes") {
          shouldScan = true;
          break;
        }
      }

      if (shouldScan) {
        scheduleScan(120);
      }
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-label", "aria-labelledby", "aria-checked", "hidden", "class"]
    });

    // Retrieve saved credentials and initiate multi-stage scans
    window.chrome.storage.local.get("stepxDetails", (result) => {
      savedDetails = result?.stepxDetails || null;
      if (savedDetails) {
        // Multi-stage scan sequence: initial, 500ms, 1500ms, 3000ms
        executeAutofill(false);
        setTimeout(() => executeAutofill(false), 500);
        setTimeout(() => executeAutofill(false), 1500);
        setTimeout(() => executeAutofill(false), 3000);
      } else {
        console.log("[STEPX] No saved details found in storage yet. Open extension popup to configure.");
      }
    });
  }

  // Run initialization
  if (document.body) {
    initialize();
  } else {
    document.addEventListener("DOMContentLoaded", initialize);
  }
})();

const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");

const root = join(__dirname, "..");
const contentScript = readFileSync(join(root, "content", "content.js"), "utf8");
const popupHtml = readFileSync(join(root, "popup", "popup.html"), "utf8");
const popupScript = readFileSync(join(root, "popup", "popup.js"), "utf8");

const mockDetailsYes = {
  name: "Rahul Sharma",
  email: "rahul.cs21@college.edu",
  usn: "1SV21CS042",
  phone: "9876543210",
  attendance: "Yes"
};

const mockDetailsNo = {
  name: "Rahul Sharma",
  email: "rahul.cs21@college.edu",
  usn: "1SV21CS042",
  phone: "9876543210",
  attendance: "No"
};

/**
 * Creates a question block matching standard Microsoft Forms DOM layout.
 */
function createQuestionBlock(number, title, inputHtml) {
  return `
    <div class="office-form-question" data-automation-id="questionItem">
      <div class="office-form-question-title" data-automation-id="questionTitle">
        <span>${number}. ${title} *</span>
      </div>
      <div class="office-form-question-element">
        ${inputHtml}
      </div>
    </div>
  `;
}

/**
 * Generates mock Microsoft Forms HTML for STEPX.
 */
function createStepxPage(title = "SVCE - STEPX Phase 0 Attendance Form - 10:15 AM", options = {}) {
  const defaultYes = options.defaultChecked === "Yes" ? 'checked aria-checked="true"' : 'aria-checked="false"';
  const defaultNo = options.defaultChecked === "No" ? 'checked aria-checked="true"' : 'aria-checked="false"';

  const attendanceBlock = options.includeAttendance === false ? "" : `
    <div class="office-form-question" data-automation-id="questionItem" id="attendance-section">
      <div class="office-form-question-title" data-automation-id="questionTitle">
        <span>5. Are you attending the session ? *</span>
      </div>
      <div role="radiogroup" aria-label="5. Are you attending the session ? *">
        <label class="office-form-choice" data-automation-id="choiceItem">
          <input type="radio" name="r_attendance" value="Yes" aria-label="Yes" ${defaultYes}>
          <span>Yes</span>
        </label>
        <label class="office-form-choice" data-automation-id="choiceItem">
          <input type="radio" name="r_attendance" value="No" aria-label="No" ${defaultNo}>
          <span>No</span>
        </label>
      </div>
    </div>
  `;

  const questions = [
    createQuestionBlock(1, "Name", `<input type="text" data-automation-id="textInput" id="field-name" value="${options.nameValue || ""}">`),
    createQuestionBlock(2, "College Email ID", `<input type="email" data-automation-id="textInput" id="field-email" value="">`),
    createQuestionBlock(3, "USN Number", `<input type="text" data-automation-id="textInput" id="field-usn" value="">`),
    createQuestionBlock(4, "Mobile number", `<input type="tel" data-automation-id="textInput" id="field-phone" value="">`),
    attendanceBlock
  ].join("\n");

  return `
    <!doctype html>
    <html lang="en">
    <head><title>${title}</title></head>
    <body>
      <div class="office-form">
        <div class="office-form-title-container">
          <h1 class="office-form-title">${title}</h1>
        </div>
        <form id="office-form-root">
          ${questions}
          <div class="office-form-button-container">
            <button type="submit" id="submit-btn" class="office-form-submit-button">Submit</button>
          </div>
        </form>
      </div>
    </body>
    </html>
  `;
}

/**
 * Helper to bootstrap a test page with content script and chrome API mocks on forms.cloud.microsoft.
 */
function setupContentScriptDom(html, storageData = mockDetailsYes) {
  const dom = new JSDOM(html, {
    url: "https://forms.cloud.microsoft/pages/responsepage.aspx?id=example_stepx",
    runScripts: "outside-only"
  });

  const listeners = [];
  const messageListeners = [];

  dom.window.chrome = {
    runtime: {
      onMessage: {
        addListener(fn) {
          messageListeners.push(fn);
        }
      }
    },
    storage: {
      local: {
        get(key, callback) {
          callback({ stepxDetails: storageData });
        },
        set(data, callback) {
          if (callback) callback();
        }
      },
      onChanged: {
        addListener(fn) {
          listeners.push(fn);
        }
      }
    }
  };

  dom.window.eval(contentScript);
  return { dom, listeners, messageListeners };
}

function wait(ms = 180) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -----------------------------------------------------------------------------
// VERIFIED TESTS
// -----------------------------------------------------------------------------

test("TEST 1: Fresh STEPX form fills Name, Email, USN, Phone, and Attendance (Yes)", async () => {
  const html = createStepxPage();
  const { dom } = setupContentScriptDom(html, mockDetailsYes);

  await wait();

  const doc = dom.window.document;
  assert.equal(doc.getElementById("field-name").value, mockDetailsYes.name, "Name must be filled");
  assert.equal(doc.getElementById("field-email").value, mockDetailsYes.email, "Email must be filled");
  assert.equal(doc.getElementById("field-usn").value, mockDetailsYes.usn, "USN must be filled");
  assert.equal(doc.getElementById("field-phone").value, mockDetailsYes.phone, "Phone must be filled");

  const yesRadio = doc.querySelector('#attendance-section input[value="Yes"]');
  const noRadio = doc.querySelector('#attendance-section input[value="No"]');
  assert.equal(yesRadio.checked, true, "Yes radio should be selected");
  assert.equal(noRadio.checked, false, "No radio should NOT be selected");

  const toast = doc.getElementById("stepx-autofill-notification");
  assert.ok(toast, "Visual feedback toast should be displayed");
  assert.match(toast.textContent, /5\/5 fields filled/);
  dom.window.close();
});

test("TEST 2: Attendance set to No switches selection even if form defaulted to Yes", async () => {
  // Form initially defaults to Yes
  const html = createStepxPage("SVCE - STEPX Phase 0 Attendance Form", { defaultChecked: "Yes" });
  const { dom } = setupContentScriptDom(html, mockDetailsNo);

  await wait();

  const doc = dom.window.document;
  const yesRadio = doc.querySelector('#attendance-section input[value="Yes"]');
  const noRadio = doc.querySelector('#attendance-section input[value="No"]');

  assert.equal(noRadio.checked, true, "No option MUST be selected to match saved preference");
  assert.equal(yesRadio.checked, false, "Yes option must be unselected");
  dom.window.close();
});

test("TEST 3: Attendance set to Yes switches selection even if form defaulted to No", async () => {
  // Form initially defaults to No
  const html = createStepxPage("SVCE - STEPX Phase 0 Attendance Form", { defaultChecked: "No" });
  const { dom } = setupContentScriptDom(html, mockDetailsYes);

  await wait();

  const doc = dom.window.document;
  const yesRadio = doc.querySelector('#attendance-section input[value="Yes"]');
  const noRadio = doc.querySelector('#attendance-section input[value="No"]');

  assert.equal(yesRadio.checked, true, "Yes option MUST be selected to match saved preference");
  assert.equal(noRadio.checked, false, "No option must be unselected");
  dom.window.close();
});

test("TEST 4: Manually typed Name is NOT overwritten", async () => {
  const manualName = "Existing Typed Name";
  const html = createStepxPage("SVCE - STEPX Attendance", { nameValue: manualName });
  const { dom } = setupContentScriptDom(html, mockDetailsYes);

  await wait();

  const doc = dom.window.document;
  assert.equal(doc.getElementById("field-name").value, manualName, "Manual name entry must be preserved");
  assert.equal(doc.getElementById("field-email").value, mockDetailsYes.email, "Empty email should be filled");
  assert.equal(doc.getElementById("field-usn").value, mockDetailsYes.usn, "Empty USN should be filled");
  dom.window.close();
});

test("TEST 5: Form with changed title and time still autofills completely", async () => {
  const alteredTitle = "SVCE - STEPX Phase 1 Attendance Form - 2:30 PM";
  const html = createStepxPage(alteredTitle);
  const { dom } = setupContentScriptDom(html, mockDetailsYes);

  await wait();

  const doc = dom.window.document;
  assert.equal(doc.getElementById("field-name").value, mockDetailsYes.name);
  assert.equal(doc.getElementById("field-email").value, mockDetailsYes.email);
  assert.equal(doc.getElementById("field-usn").value, mockDetailsYes.usn);
  assert.equal(doc.getElementById("field-phone").value, mockDetailsYes.phone);
  assert.equal(doc.querySelector('#attendance-section input[value="Yes"]').checked, true);
  dom.window.close();
});

test("TEST 6: Unrelated non-STEPX Microsoft Form is completely ignored", async () => {
  const nonStepxHtml = `
    <!doctype html><html><body>
      <h1>Department Feedback Survey</h1>
      <form>
        <div class="office-form-question" data-automation-id="questionItem">
          <label>Full Name</label>
          <input id="q-name" type="text" value="">
        </div>
        <div class="office-form-question" data-automation-id="questionItem">
          <label>College Email ID</label>
          <input id="q-email" type="email" value="">
        </div>
        <button type="submit">Submit</button>
      </form>
    </body></html>
  `;
  const { dom } = setupContentScriptDom(nonStepxHtml, mockDetailsYes);

  await wait();

  const doc = dom.window.document;
  assert.equal(doc.getElementById("q-name").value, "");
  assert.equal(doc.getElementById("q-email").value, "");
  assert.equal(doc.getElementById("stepx-autofill-notification"), null);
  dom.window.close();
});

test("TEST 7: Dynamically added questions inserted after initial load are detected", async () => {
  const partialHtml = `
    <!doctype html><html><body>
      <h1>SVCE - STEPX Phase 0 Attendance Form</h1>
      <form id="test-form">
        ${createQuestionBlock(1, "Name", '<input type="text" id="initial-name">')}
        ${createQuestionBlock(2, "College Email ID", '<input type="email" id="initial-email">')}
      </form>
    </body></html>
  `;
  const { dom } = setupContentScriptDom(partialHtml, mockDetailsYes);

  await wait();
  assert.equal(dom.window.document.getElementById("initial-name").value, mockDetailsYes.name);

  // Dynamically insert USN question after load
  const newQuestion = dom.window.document.createElement("div");
  newQuestion.innerHTML = createQuestionBlock(3, "USN Number", '<input type="text" id="late-usn">');
  dom.window.document.getElementById("test-form").appendChild(newQuestion);

  await wait();
  assert.equal(dom.window.document.getElementById("late-usn").value, mockDetailsYes.usn);
  dom.window.close();
});

test("TEST 8: Form submit button is NEVER clicked automatically", async () => {
  const html = createStepxPage();
  const { dom } = setupContentScriptDom(html, mockDetailsYes);

  let formSubmitted = false;
  const form = dom.window.document.getElementById("office-form-root");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    formSubmitted = true;
  });

  await wait(300);

  assert.equal(formSubmitted, false, "Form should NEVER be automatically submitted");
  const submitBtn = dom.window.document.getElementById("submit-btn");
  assert.equal(submitBtn.textContent, "Submit");
  dom.window.close();
});

test("TEST 9: Manual 'Fill Current Form' button triggers autofill and returns result", async () => {
  const html = createStepxPage();
  const { dom, messageListeners } = setupContentScriptDom(html, mockDetailsYes);

  await wait();

  let responseData = null;
  for (const listener of messageListeners) {
    listener({ action: "STEPX_AUTOFILL_NOW" }, {}, (res) => {
      responseData = res;
    });
  }

  assert.ok(responseData, "Response must be returned for manual trigger");
  assert.equal(responseData.success, true);
  assert.equal(responseData.count, 5);
  assert.equal(responseData.total, 5);
  dom.window.close();
});

test("TEST 10: Popup validates email, phone, and required fields", async () => {
  const dom = new JSDOM(popupHtml, { runScripts: "outside-only" });
  let savedCalled = false;

  dom.window.chrome = {
    runtime: {},
    storage: {
      local: {
        get(_key, cb) { cb({}); },
        set() { savedCalled = true; }
      }
    }
  };

  dom.window.eval(popupScript);

  const form = dom.window.document.getElementById("details-form");
  const statusEl = dom.window.document.getElementById("form-status");

  // Attempt save with empty form
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(savedCalled, false);
  assert.match(statusEl.textContent, /Full Name/);

  // Fill name with invalid email
  dom.window.document.getElementById("name").value = "Alex";
  dom.window.document.getElementById("email").value = "not-an-email";
  form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  assert.equal(savedCalled, false);
  assert.match(statusEl.textContent, /valid email/);

  dom.window.close();
});

test("TEST 11: Realistic name 'Himesh' from chrome.storage.local fills Name field", async () => {
  const himeshDetails = {
    name: "Himesh",
    email: "himesh.cs22@college.edu",
    usn: "1SV22CS045",
    phone: "9123456780",
    attendance: "Yes"
  };

  const html = createStepxPage();
  const { dom } = setupContentScriptDom(html, himeshDetails);

  await wait();

  const doc = dom.window.document;
  const nameInput = doc.getElementById("field-name");
  assert.equal(nameInput.value, "Himesh", "Name field must display 'Himesh' from storage");
  assert.equal(doc.getElementById("field-email").value, himeshDetails.email);
  assert.equal(doc.getElementById("field-usn").value, himeshDetails.usn);
  assert.equal(doc.getElementById("field-phone").value, himeshDetails.phone);
  assert.equal(doc.querySelector('#attendance-section input[value="Yes"]').checked, true);
  dom.window.close();
});

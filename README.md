# STEPX AutoFill (Manifest V3 Chrome/Edge Extension)

**STEPX AutoFill** is a lightweight, secure, and production-ready browser extension designed to instantly autofill recurring Microsoft Forms used for **STEPX attendance**.

> **Important**: This extension **NEVER automatically submits forms**. It autofills only your saved attendance fields, leaving the final review and manual submission entirely in your control.

---

## 📁 Project Structure

```text
16 chrome_form filler/
├── manifest.json            # Manifest V3 specification
├── README.md                # Documentation & installation guide
├── package.json             # Dev dependencies and automated test scripts
│
├── popup/                   # Extension popup interface
│   ├── popup.html           # Accessible, modern popup layout
│   ├── popup.css            # Dark mode Fluent/Tailwind inspired design
│   └── popup.js             # Form validation & chrome.storage.local sync
│
├── content/                 # Injected content script
│   └── content.js           # STEPX detection, DOM traversal, React setter & feedback toast
│
├── icons/                   # High-resolution extension icons
│   ├── icon16.png           # 16x16 icon
│   ├── icon48.png           # 48x48 icon
│   └── icon128.png          # 128x128 icon
│
├── scripts/
│   └── generate-icons.js    # Node.js script generating crisp icons
│
└── test/                    # Test suite & sandbox
    ├── extension.test.js    # Automated unit & DOM integration test suite (11 tests)
    └── ms-forms-demo.html   # Realistic Microsoft Forms sandbox DOM
```

---

## 🌐 Supported Microsoft Forms Domains

- `https://forms.cloud.microsoft/*`
- `https://forms.office.com/*`
- `https://forms.microsoft.com/*`

---

## 🚀 How to Install

### Loading into Google Chrome
1. Open Google Chrome.
2. In the address bar, navigate to `chrome://extensions/`.
3. In the top-right corner, enable **Developer mode** toggle.
4. Click **Load unpacked** in the top-left corner.
5. Select the extension directory:
   ```
   D:\00 study\projects\16 chrome_form filler
   ```
6. The extension is now installed! Pin **STEPX AutoFill** to your toolbar for quick access.

### Loading into Microsoft Edge
1. Open Microsoft Edge.
2. In the address bar, navigate to `edge://extensions/`.
3. Turn on **Developer mode** in the left sidebar.
4. Click **Load unpacked**.
5. Select the folder:
   ```
   D:\00 study\projects\16 chrome_form filler
   ```
6. Pin **STEPX AutoFill** to the Edge toolbar.

---

## ⚡ How It Works

### 1. Initial Setup
1. Click the **STEPX AutoFill** extension icon in your browser toolbar.
2. Enter your details:
   - **Full Name**
   - **College Email ID**
   - **USN Number**
   - **Mobile Number**
   - **Are you attending?** (Select `Yes` or `No`)
3. Click **Save Details**.
4. Your information is securely stored in `chrome.storage.local` on your computer. You only need to do this once.

### 2. Intelligent Form Detection
The extension triggers only when a page satisfies both:
1. Visible page text contains **`STEPX`** (case-insensitive).
2. At least **two known STEPX questions** are detected (e.g. `USN Number` and `College Email ID`).
*Non-STEPX Microsoft Forms (e.g. general surveys or library forms) are automatically ignored.*

### 3. Session & Time Agnostic
Whether the form title is:
- `"SVCE - STEPX Phase 0 Attendance Form - 10:15 AM"`
- `"SVCE - STEPX Phase 1 Attendance Form - 2:30 PM"`
- `"STEPX Phase 2 Check-in"`
The extension extracts normalized question labels rather than hardcoded input indexes.

### 4. Normalized Question Aliases
Question titles are normalized by stripping leading numbers (`1.`, `2)`), asterisks (`*`), punctuation, and repeated spaces. Supported mappings include:

| Target Field | Matched Question Variations |
|---|---|
| **Name** | `Name`, `Full Name`, `Student Name`, `Name of the student` |
| **Email** | `College Email ID`, `College Email`, `Email ID`, `Email Address`, `Email` |
| **USN** | `USN Number`, `USN No`, `USN`, `University ID`, `Student ID`, `Registration Number` |
| **Mobile** | `Mobile number`, `Mobile No`, `Mobile`, `Phone Number`, `Phone No`, `Phone`, `Contact Number` |
| **Attendance** | `Are you attending the session?`, `Will you attend the session?`, `Attending the session`, `Are you attending` |

### 5. Microsoft Forms & React Compatibility
- Uses `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` to trigger React and Fluent UI synthetic state watchers.
- Dispatches bubbling `input` and `change` events.
- Employs a debounced `MutationObserver` to support dynamically rendered questions without CPU spin or infinite loops.
- Scopes Yes/No attendance selection strictly to the attendance question container to avoid altering unrelated Yes/No survey items.

### 6. Overwrite & Submit Protection
- **Never overwrites**: If you manually typed into a field, the extension preserves your manual entry.
- **Never auto-submits**: Submitting forms requires your explicit click on the "Submit" button.

### 8. Manual "Fill Current Form" Button
If you open a form after saving details, or want to manually re-trigger autofill at any time:
1. Click the **STEPX AutoFill** toolbar icon.
2. Click **Fill Current Form**.
3. The popup communicates directly with the active tab and reports:
   - `✓ 5/5 fields filled` (or `⚠ X/5 fields filled`).

---

## 🔒 Security & Privacy

- **100% Local Execution**: All credentials remain stored exclusively in `chrome.storage.local`.
- **Zero External Telemetry**: No APIs, analytics, third-party libraries, or cloud sync.
- **Minimal Permissions**: Requests only `"storage"`, `"activeTab"`, `"scripting"`, and host permissions for `forms.cloud.microsoft`, `forms.office.com`, and `forms.microsoft.com`.
- **No Console Credential Leaks**: Credentials are never logged in developer console outputs.

---

## 🧪 Automated Test Suite

Run the full automated test suite using Node.js:
```bash
npm test
```

### Verified Test Cases:
- ✔ **TEST 1**: Fresh STEPX form fills Name, Email, USN, Phone, and Attendance (Yes).
- ✔ **TEST 2**: Attendance set to No switches selection even if form defaulted to Yes.
- ✔ **TEST 3**: Attendance set to Yes switches selection even if form defaulted to No.
- ✔ **TEST 4**: Manually typed Name is NOT overwritten.
- ✔ **TEST 5**: Form with changed title and time still autofills completely.
- ✔ **TEST 6**: Unrelated non-STEPX Microsoft Form is completely ignored.
- ✔ **TEST 7**: Dynamically added questions inserted after initial load are detected.
- ✔ **TEST 8**: Form submit button is NEVER clicked automatically.
- ✔ **TEST 9**: Manual 'Fill Current Form' button triggers autofill and returns result.
- ✔ **TEST 10**: Popup validates email, phone, and required fields.

---

## ⚠️ Known Limitations
- The extension requires the form page to include the keyword `"STEPX"` and at least two standard questions. Forms without the STEPX keyword are intentionally skipped to prevent false-positive autofill on general surveys.
- If Microsoft Forms is embedded in a cross-origin iframe with restrictive sandbox policies that block content scripts, open the form in its direct URL tab (`https://forms.office.com/...`).

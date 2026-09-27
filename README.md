# 🚀 STEPX AutoFill (Manifest V3 Chrome/Edge Extension)

**STEPX AutoFill** is a lightweight, secure browser extension designed to instantly autofill recurring Microsoft Forms used for **STEPX attendance**.

> **Important:** This extension **NEVER automatically submits forms**. It only autofills your saved attendance fields, leaving the final review and manual submission entirely in your control.

---

## ✨ Features

- Automatically fills supported STEPX Microsoft Forms
- Enter your details **once** and reuse them across forms
- Works across different STEPX sessions and timings
- Supports multiple STEPX Microsoft Forms
- Detects questions by their labels instead of fixed input positions
- Handles dynamically loaded Microsoft Forms
- Supports Yes/No attendance questions
- Does not overwrite information you manually entered
- Includes a manual **Fill Current Form** option
- No backend or external API
- No analytics or tracking
- Personal information stays locally in your browser
- Never automatically submits forms

---

## 📁 Project Structure

```text
16 chrome_form filler/
├── manifest.json             # Manifest V3 specification
├── README.md                 # Documentation & installation guide
├── package.json              # Dev dependencies and test scripts
│
├── popup/                    # Extension popup interface
│   ├── popup.html            # Popup layout
│   ├── popup.css             # Popup styling
│   └── popup.js              # Form validation & local storage
│
├── content/                  # Injected content script
│   └── content.js            # STEPX detection, field matching & autofill
│
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
├── scripts/
│   └── generate-icons.js
│
└── test/
    ├── extension.test.js
    └── ms-forms-demo.html
```

---

# 📥 How to Get the Extension

There are two common ways to get the extension folder.

### Option 1 — Download from GitHub

If the project is hosted on GitHub:

1. Open the GitHub repository.
2. Click the green **Code** button.
3. Click **Download ZIP**.
4. Save the ZIP file.
5. Extract the ZIP file.

You should get a folder similar to:

```text
stepx-autofill/
```

Inside it, you should see:

```text
manifest.json
README.md
popup/
content/
icons/
```

### ⚠️ Important

When loading the extension, select the folder that **directly contains `manifest.json`**.

Correct:

```text
stepx-autofill/
├── manifest.json
├── popup/
├── content/
└── icons/
```

Incorrect:

```text
stepx-autofill/
└── another-folder/
    └── manifest.json
```

If you downloaded a ZIP, **extract it first**. Do not select the ZIP file itself.

---

### Option 2 — Use an Existing Project Folder

If you already have the project on your computer, simply locate the project folder.

For example:

```text
D:\00 study\projects\16 chrome_form filler
```

Make sure the folder contains:

```text
manifest.json
```

at its root.

---

# 🌐 Supported Microsoft Forms Domains

The extension supports Microsoft Forms hosted on:

- `https://forms.cloud.microsoft/*`
- `https://forms.office.com/*`
- `https://forms.microsoft.com/*`

---

# 🧩 Installing in Google Chrome

### Step 1 — Open Chrome Extensions

Open Chrome and enter:

```text
chrome://extensions/
```

Or:

**Menu ⋮ → Extensions → Manage Extensions**

### Step 2 — Enable Developer Mode

Turn on:

**Developer mode**

You will see additional options including:

**Load unpacked**

### Step 3 — Load the Extension

Click:

**Load unpacked**

Select the **extension folder** — the folder containing `manifest.json`.

For example:

```text
D:\00 study\projects\16 chrome_form filler
```

Then click **Select Folder**.

### Step 4 — Confirm Installation

You should now see:

**STEPX AutoFill**

in your Chrome extensions list.

### Step 5 — Pin the Extension

Click the puzzle-piece icon:

**🧩 → STEPX AutoFill → Pin**

The extension will now be available directly from your Chrome toolbar.

---

# 🌐 Installing in Microsoft Edge

### Step 1

Open:

```text
edge://extensions/
```

### Step 2

Enable:

**Developer mode**

### Step 3

Click:

**Load unpacked**

### Step 4

Select the folder containing:

```text
manifest.json
```

For example:

```text
D:\00 study\projects\16 chrome_form filler
```

### Step 5

Pin **STEPX AutoFill** to the Edge toolbar.

---

# ⚙️ First-Time Setup

After installing the extension:

### 1. Open the Extension

Click:

**🧩 → STEPX AutoFill**

### 2. Enter Your Details

Enter:

- **Full Name**
- **College Email ID**
- **USN Number**
- **Mobile Number**
- **Are you attending?** — Select `Yes` or `No`

### 3. Click `Save Details`

You should see:

```text
✓ Details saved
```

Your information is stored locally using:

```text
chrome.storage.local
```

You only need to do this once.

---

# 🚀 Using STEPX AutoFill

After your details have been saved:

### 1. Open a STEPX Microsoft Form

For example:

```text
SVCE - STEPX Phase 0 Attendance Form - 10:15 AM
```

The session time or phase can change:

```text
STEPX Phase 0 - 10:15 AM
STEPX Phase 1 - 2:30 PM
STEPX Phase 2 - 4:00 PM
```

The extension does not depend on the session time.

### 2. The Extension Detects the Form

STEPX AutoFill checks for:

- `STEPX`
- Known STEPX questions such as:
  - Name
  - College Email ID
  - USN Number
  - Mobile number
  - Are you attending the session?

### 3. Fields Are Automatically Filled

The extension fills the available supported fields using your saved information.

You should see:

```text
Name
        ↓
Your saved name

College Email ID
        ↓
Your saved email

USN Number
        ↓
Your saved USN

Mobile number
        ↓
Your saved phone number

Are you attending?
        ↓
Your saved Yes/No preference
```

---

# 🖱️ Manual "Fill Current Form"

If automatic filling does not happen immediately, you can manually trigger it.

1. Open the STEPX Microsoft Form.
2. Click the **STEPX AutoFill** extension icon.
3. Click **Fill Current Form**.

The extension will scan the current page and attempt to fill the supported fields.

You may see:

```text
✓ 5/5 fields filled
```

or:

```text
⚠ 4/5 fields filled
```

---

# 🔄 Updating the Extension

If you installed the extension using **Load unpacked** and the code changes:

1. Open:

```text
chrome://extensions/
```

2. Find **STEPX AutoFill**.
3. Click the **↻ Reload** button.
4. Return to the Microsoft Form.
5. Refresh the page with:

```text
Ctrl + R
```

The updated extension will now be active.

---

# 🧠 How Form Detection Works

STEPX AutoFill does **not** rely on the position of inputs.

It does not assume:

```text
input[0] = Name
input[1] = Email
input[2] = USN
```

Instead, it identifies the question associated with each input.

For example:

```text
Name *
      ↓
Name

College Email ID *
      ↓
Email

USN Number *
      ↓
USN

Mobile number *
      ↓
Mobile
```

This allows the form to change the order of questions without necessarily breaking the extension.

---

# 🔎 Supported Question Variations

| Target Field | Matched Question Variations |
|---|---|
| **Name** | `Name`, `Full Name`, `Student Name`, `Name of the student` |
| **Email** | `College Email ID`, `College Email`, `Email ID`, `Email Address`, `Email` |
| **USN** | `USN Number`, `USN No`, `USN`, `University ID`, `Student ID`, `Registration Number` |
| **Mobile** | `Mobile number`, `Mobile No`, `Mobile`, `Phone Number`, `Phone No`, `Phone`, `Contact Number` |
| **Attendance** | `Are you attending the session?`, `Will you attend the session?`, `Attending the session`, `Are you attending` |

Question text is normalized before matching.

The extension tolerates:

- Question numbers
- `*` required markers
- Extra spaces
- Minor punctuation differences
- Different capitalization

For example:

```text
1. Name *
```

can be normalized to:

```text
name
```

---

# 🛡️ Existing User Input Is Protected

The extension does **not** overwrite a field if you have already entered something manually.

For example:

```text
Name

[ Himesh Kumar ]
```

If you manually entered the value, STEPX AutoFill will leave it unchanged.

---

# 🚫 No Automatic Submission

STEPX AutoFill **never clicks Submit automatically**.

The workflow is:

```text
Open Form
    ↓
Autofill
    ↓
Review your information
    ↓
Click Submit yourself
```

This gives you the opportunity to check:

- Name
- Email
- USN
- Mobile number
- Attendance

before submitting.

---

# 🔐 Security & Privacy

STEPX AutoFill is designed to operate locally.

Your information is stored using:

```text
chrome.storage.local
```

The extension does **not** send your information to an external server.

### Stored Locally

- Name
- Email
- USN
- Mobile number
- Attendance preference

### No External Services

The extension does not use:

- Backend servers
- External APIs
- Analytics
- Tracking
- External databases
- AI services
- Third-party data services

### No Credential Logging

Personal information is not intentionally printed to the browser developer console.

---

# 🔑 Required Permissions

The extension uses only the permissions required for its functionality:

```text
storage
activeTab
scripting
```

It also requires access to:

```text
forms.cloud.microsoft
forms.office.com
forms.microsoft.com
```

---

# 🧪 Running Tests

If you are developing the extension and have Node.js installed:

```bash
npm install
```

Then run:

```bash
npm test
```

### Verified Test Cases

- ✔ **TEST 1:** Fresh STEPX form fills Name, Email, USN, Phone, and Attendance
- ✔ **TEST 2:** Attendance set to No switches selection even if the form defaulted to Yes
- ✔ **TEST 3:** Attendance set to Yes switches selection even if the form defaulted to No
- ✔ **TEST 4:** Manually typed Name is NOT overwritten
- ✔ **TEST 5:** Form with changed title and time still autofills
- ✔ **TEST 6:** Unrelated non-STEPX Microsoft Form is ignored
- ✔ **TEST 7:** Dynamically added questions are detected
- ✔ **TEST 8:** Form Submit button is NEVER clicked automatically
- ✔ **TEST 9:** Manual `Fill Current Form` button triggers autofill
- ✔ **TEST 10:** Popup validates required fields and user input

---

# 🧰 Development

### Requirements

- Google Chrome or Microsoft Edge
- Node.js
- npm

Optional:

- VS Code
- Playwright for browser testing

---

# ⚠️ Troubleshooting

## Extension Doesn't Appear

Go to:

```text
chrome://extensions/
```

Make sure **STEPX AutoFill** is enabled.

---

## Form Isn't Being Filled

Try:

1. Refresh the Microsoft Form.
2. Open the extension.
3. Click **Fill Current Form**.
4. Make sure your details were saved.
5. Make sure the page is a supported Microsoft Forms domain.

---

## "No Access Needed" Appears

If Chrome says:

```text
No access needed

These extensions don't need to see and change
information on this site.
```

make sure the extension has host access for:

```text
https://forms.cloud.microsoft/*
```

Then:

1. Reload the extension from `chrome://extensions/`
2. Refresh the Microsoft Form.

---

## Extension Was Updated but Changes Aren't Visible

Go to:

```text
chrome://extensions/
```

Click:

**↻ Reload**

on STEPX AutoFill.

Then refresh the form.

---

# ⚠️ Known Limitations

- The extension is intentionally designed for STEPX forms.
- Forms without recognizable STEPX indicators are ignored.
- Microsoft Forms DOM changes may require future updates.
- If Microsoft Forms changes its question structure or controls, autofill may temporarily stop working until the extension is updated.
- Cross-origin embedded Forms may require opening the direct Microsoft Forms URL.
- The extension never automatically submits forms.

---

# 🎯 Design Philosophy

STEPX AutoFill follows a simple workflow:

```text
Enter details once
       ↓
Open STEPX Form
       ↓
Autofill
       ↓
Review
       ↓
Submit manually
```

No repetitive typing.

No unnecessary permissions.

No external servers.

No automatic submission.

Just a faster way to handle repetitive attendance forms. 🚀

---

# 📜 License

For example:

```text
MIT License
```

if you decide to release the project under the MIT License.

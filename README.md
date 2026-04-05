# UK Visa Sponsor Checker for LinkedIn

A lightweight Chrome Extension that seamlessly integrates with LinkedIn to highlight whether a company is registered to sponsor UK visas (Skilled Worker, Global Business Mobility, etc.).

Stop wasting time applying to roles only to find out later that the company cannot sponsor your visa! This extension instantly adds a clear **✓ UK Sponsor** (Green) or **✗ No Sponsor** (Red) badge right next to the company name on LinkedIn Job Search, Collections, and Company pages.

## ✨ Features

* **Real-time Highlighting:** Automatically injects visual badges next to company names as you scroll through LinkedIn.
* **Smart Matching:** Normalizes company names (removing "Ltd", "Inc", etc.) and handles "Trading As" (t/a) names to ensure high accuracy matching against the UK Government's register.
* **Extremely Fast:** Data is bucketed alphabetically (A-Z) and cached in your browser's local storage. It only downloads the exact data it needs, keeping the extension lightning fast and memory-efficient.
* **Always Up-to-Date:** Powered by a daily GitHub Action that fetches the latest CSV directly from the UK Government website, cleans it, and updates the data repository every night at midnight.

## 🏗️ Architecture

This project is split into two main parts:

1. **The Data Pipeline (`/update.js` & `.github/workflows/update.yml`)**
   * A Node.js script runs daily via GitHub Actions.
   * It scrapes the dynamic URL for the latest *Register of licensed sponsors* CSV from `gov.uk`.
   * It cleans the data, groups companies by their starting letter to create tiny JSON files, and pushes them to the `/data` folder in the `main` branch.

2. **The Chrome Extension (`/extension`)**
   * A Content Script (`content.js`) observes the LinkedIn DOM for job cards and company titles.
   * It fetches the corresponding alphabetical JSON bucket directly from the GitHub raw content URL.
   * Uses a `MutationObserver` and modern CSS `:has()` selectors to reliably attach badges even within LinkedIn's heavily obfuscated and changing React UI.

## 🚀 How to Install (Developer Mode)

Since this extension is not yet published on the Chrome Web Store, you can load it locally:

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Turn on **Developer mode** using the toggle switch in the top right corner.
4. Click the **Load unpacked** button in the top left corner.
5. Select the `extension` folder inside this repository.
6. Open [LinkedIn Jobs](https://www.linkedin.com/jobs/) and start browsing!

## 🛠️ Tech Stack

* **Frontend:** Vanilla JavaScript (ES6+), CSS3, HTML5
* **Backend/Data:** Node.js, GitHub Actions
* **Data Source:** [UK Home Office Register of Licensed Sponsors](https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers)

## 📝 Permissions

* `storage`: Used to securely cache the sponsor data buckets locally for 24 hours, minimizing network requests and maximizing speed.
* `host_permissions`: Requires access to `https://raw.githubusercontent.com/*` to download the daily updated sponsor lists.

## 🤝 Contributing

Feel free to open an issue or submit a pull request if you notice any bugs with LinkedIn's changing UI selectors or have ideas for improving the matching algorithm.
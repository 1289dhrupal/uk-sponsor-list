// Cache to store our downloaded JSON buckets so we don't fetch the same letter twice
const bucketCache = {};

// Calculate next 12:30 AM UTC (to align with the GitHub Action daily run at Midnight UTC)
function getNextExpiryTime() {
    const now = new Date();
    const expiry = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 30, 0, 0));
    if (now.getTime() >= expiry.getTime()) {
        expiry.setUTCDate(expiry.getUTCDate() + 1);
    }
    return expiry.getTime();
}

// Normalization function (Must exactly match the one in our Node.js script)
function cleanCompanyName(name) {
    let cleanName = name.toLowerCase().replace(/["'.,()]/g, ' ');
    cleanName = cleanName.replace(/\b(ltd|limited|plc|llp|uk|group|inc|corp|services)\b/g, '');
    return cleanName.replace(/\s+/g, ' ').trim();
}

// Function to fetch data and inject the badge
async function checkCompanySponsorship(rawName, element) {
    // 1. Clean up the text (LinkedIn sometimes includes newlines or "·" like "Company Name · Location")
    const companyName = rawName.split('\n')[0].split('·')[0].trim();
    const cleanName = cleanCompanyName(companyName);

    if (!cleanName || cleanName.length <= 2 || /^\d+$/.test(cleanName)) {
        return;
    }

    // 2. Prevent checking and injecting if the badge is already physically in the DOM
    if (element.querySelector('.uk-sponsor-badge')) {
        return;
    }

    // 3. Lock the element temporarily using the company name. 
    if (element.dataset.fetchingSponsor === cleanName) {
        return;
    }
    element.dataset.fetchingSponsor = cleanName;

    // Determine which bucket to check
    const firstChar = cleanName.charAt(0);
    const bucket = /[a-z]/.test(firstChar) ? firstChar : 'other';

    // Fetch the bucket from GitHub if we haven't already
    if (!bucketCache[bucket]) {
        try {
            const cacheKey = `uk_sponsor_bucket_${bucket}`;

            // 1. Try to get data from local Chrome storage first
            const storedData = await chrome.storage.local.get(cacheKey);

            // 2. Check if we have data and if it hasn't expired (before 12:30 AM UTC)
            if (storedData[cacheKey] && storedData[cacheKey].expiry > Date.now()) {
                bucketCache[bucket] = storedData[cacheKey].data;
            } else {
                // 3. Otherwise, fetch fresh data from GitHub
                // Replace '1289dhrupal' and 'uk-sponsor-list' if your GitHub username or repo name is different
                const url = `https://raw.githubusercontent.com/1289dhrupal/uk-sponsor-list/main/data/${bucket}.json`;
                const response = await fetch(url);

                if (response.ok) {
                    const data = await response.json();
                    bucketCache[bucket] = data;

                    // Save to Chrome local storage with the new expiration time
                    await chrome.storage.local.set({
                        [cacheKey]: {
                            data: data,
                            expiry: getNextExpiryTime()
                        }
                    });
                } else {
                    bucketCache[bucket] = {};
                }
            }
        } catch (error) {
            console.error("Failed to fetch sponsor data from GitHub:", error);
            return;
        }
    }

    // Check if the company exists in our database
    let sponsorData = bucketCache[bucket][cleanName];

    // Smart Partial Matching (Fixes "Goldman Sachs" vs "Goldman Sachs International")
    if (!sponsorData) {
        const allKeys = Object.keys(bucketCache[bucket]);
        const match = allKeys.find(key =>
            key.startsWith(cleanName + ' ') || cleanName.startsWith(key + ' ')
        );
        if (match) {
            sponsorData = bucketCache[bucket][match];
        }
    }

    // Create the visual badge
    const badge = document.createElement('span');
    badge.className = 'uk-sponsor-badge';

    if (sponsorData) {
        badge.innerText = '✓ UK Sponsor';
        badge.title = 'This company is registered to sponsor UK Visas.';
    } else {
        badge.innerText = '✗ No Sponsor';
        badge.title = 'This company is not on the UK Home Office Register.';
        badge.classList.add('negative');
    }

    // Append it right next to the company name
    element.appendChild(badge);
}

// Set up a MutationObserver to watch for new job cards loading as the user scrolls
const observer = new MutationObserver((mutations) => {
    // 1. STANDARD LINKEDIN SELECTORS (Covers most normal pages)
    const selectors = [
        '.job-card-container__primary-description',
        '.job-card-container__company-name',
        '.job-details-jobs-unified-top-card__company-name',
        '.job-details-jobs-unified-top-card__primary-description',
        '.artdeco-entity-lockup__subtitle',
        '.entity-result__primary-subtitle',
        '.job-card-list__company-name',
        'div[class*="company-name"]',
        'span[class*="company-name"]',
        'a[href*="/company/"] > span'
    ].join(', ');

    const companyElements = document.querySelectorAll(selectors);

    companyElements.forEach(el => {
        const rawName = el.innerText.trim();
        if (rawName && !rawName.includes('View') && !rawName.includes('See all')) {
            checkCompanySponsorship(rawName, el);
        }
    });

    // 2. DYNAMIC REACT LISTS (Semantic Search & Collections)
    // Target the outer card using the componentkey and role=button attributes
    const dynamicCards = document.querySelectorAll('div[role="button"][componentkey]');

    dynamicCards.forEach(card => {
        // Inside these specific cards, LinkedIn consistently places the job title in the 1st <p> tag, 
        // the Company Name in the 2nd <p> tag, and the Location in the 3rd <p> tag.
        const paragraphs = card.querySelectorAll('p');

        if (paragraphs.length >= 2) {
            const companyNameEl = paragraphs[1]; // Target the 2nd paragraph
            const rawName = companyNameEl.innerText.trim();

            // Prevent capturing random buttons or non-company elements like "159 applicants"
            if (rawName && !rawName.includes('View') && !rawName.includes('See all') && !rawName.includes('applicant')) {
                checkCompanySponsorship(rawName, companyNameEl);
            }
        }
    });
});

// Start watching the page
observer.observe(document.body, { childList: true, subtree: true });
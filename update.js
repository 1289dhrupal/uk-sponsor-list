const fs = require('fs');

async function updateSponsors() {
    // 1. Pull the main page URL from the GitHub environment variable
    const govPageUrl = process.env.GOV_PAGE_URL;

    if (!govPageUrl) {
        console.error("Error: GOV_PAGE_URL environment variable is not set.");
        process.exit(1);
    }

    console.log(`Fetching UK Gov page from: ${govPageUrl}`);

    try {
        const pageRes = await fetch(govPageUrl);
        const html = await pageRes.text();

        // 2. Extract the dynamic CSV link using Regex
        // This looks for the specific URL pattern the UK Gov uses for its media files
        const csvUrlMatch = html.match(/href="(https:\/\/assets\.publishing\.service\.gov\.uk\/media\/[^"]+\.csv)"/);

        if (!csvUrlMatch) {
            console.error("Could not find the CSV link on the page.");
            process.exit(1);
        }

        const csvUrl = csvUrlMatch[1];
        console.log(`Found dynamic CSV URL: ${csvUrl}`);
        console.log("Downloading and parsing CSV...");

        // 3. Download the actual CSV file
        const csvRes = await fetch(csvUrl);
        const csvText = await csvRes.text();

        const lines = csvText.split('\n');
        const sponsors = {};

        // 4. Skip the header row and process the data
        for (let i = 1; i < lines.length; i++) {
            // Basic split by comma. Note: this is a simple split and assumes 
            // the company names themselves do not contain commas inside quotes.
            const columns = lines[i].split(',');

            if (columns.length > 0 && columns[0]) {
                let name = columns[0];

                // 5. Normalization Function
                // Lowercase, remove punctuation, strip common corporate suffixes
                name = name.toLowerCase()
                    .replace(/[.,]/g, '')
                    .replace(/\b(ltd|limited|plc|llp|uk|group|inc|corp)\b/g, '')
                    .trim();

                // Add to our JSON object map for instant lookups later
                if (name) {
                    sponsors[name] = true;
                }
            }
        }

        // 6. Save the output to a local file
        fs.writeFileSync('sponsors.json', JSON.stringify(sponsors));
        console.log(`Successfully saved ${Object.keys(sponsors).length} companies to sponsors.json`);

    } catch (error) {
        console.error("An error occurred during the update process:", error);
        process.exit(1);
    }
}

updateSponsors();
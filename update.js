const fs = require('fs');
const path = require('path');

async function updateSponsors() {
    const govPageUrl = process.env.GOV_PAGE_URL;

    if (!govPageUrl) {
        console.error("Error: GOV_PAGE_URL environment variable is not set.");
        process.exit(1);
    }

    console.log(`Fetching UK Gov page from: ${govPageUrl}`);

    try {
        const pageRes = await fetch(govPageUrl);
        const html = await pageRes.text();

        const csvUrlMatch = html.match(/href="(https:\/\/assets\.publishing\.service\.gov\.uk\/media\/[^"]+\.csv)"/);

        if (!csvUrlMatch) {
            console.error("Could not find the CSV link on the page.");
            process.exit(1);
        }

        const csvUrl = csvUrlMatch[1];
        console.log(`Found dynamic CSV URL: ${csvUrl}`);
        console.log("Downloading and parsing CSV...");

        const csvRes = await fetch(csvUrl);
        const csvText = await csvRes.text();

        const lines = csvText.split('\n');

        // Initialize our alphabet buckets including 'other' for numbers/symbols
        const groupedSponsors = { other: {} };
        for (let i = 97; i <= 122; i++) {
            groupedSponsors[String.fromCharCode(i)] = {};
        }

        const routeEnums = {};
        const ratingEnums = {};
        let routeCounter = 1;
        let ratingCounter = 1;

        // Helper functions to manage our space-saving enums
        function getRouteId(routeStr) {
            if (!routeStr) return 0;
            if (!routeEnums[routeStr]) {
                routeEnums[routeStr] = routeCounter++;
            }
            return routeEnums[routeStr];
        }

        function getRatingId(ratingStr) {
            if (!ratingStr) return 0;
            if (!ratingEnums[ratingStr]) {
                ratingEnums[ratingStr] = ratingCounter++;
            }
            return ratingEnums[ratingStr];
        }

        // Skip the header row
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Smart CSV Splitter: correctly splits by comma while ignoring commas inside double quotes
            const columns = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(col => col.replace(/^"|"$/g, '').trim());

            let name = columns[0];
            const rawRating = columns[3] || '';
            const rawRoute = columns[4] || '';

            if (name) {
                name = name.toLowerCase().trim();

                // Handle "Trading As" variations
                let variations = [];
                if (name.includes(' t/a ')) {
                    variations = name.split(' t/a ');
                } else if (name.includes(' trading as ')) {
                    variations = name.split(' trading as ');
                } else {
                    variations = [name];
                }

                const routeId = getRouteId(rawRoute);
                const ratingId = getRatingId(rawRating);

                variations.forEach(v => {
                    // 1. Remove rogue quotes and punctuation, replace with space
                    let cleanName = v.replace(/["'.,()]/g, ' ');

                    // 2. Strip common corporate suffixes
                    cleanName = cleanName.replace(/\b(ltd|limited|plc|llp|uk|group|inc|corp|services)\b/g, '');

                    // 3. Remove multiple spaces and trim
                    cleanName = cleanName.replace(/\s+/g, ' ').trim();

                    // 4. Validate: Ignore if it is just numbers or too short
                    if (cleanName && cleanName.length > 2 && !/^\d+$/.test(cleanName)) {

                        // Determine which bucket this company belongs in based on the first letter
                        const firstChar = cleanName.charAt(0);
                        const bucket = /[a-z]/.test(firstChar) ? firstChar : 'other';

                        if (!groupedSponsors[bucket][cleanName]) {
                            groupedSponsors[bucket][cleanName] = [];
                        }

                        // Prevent adding duplicate license types for the same company variation
                        const exists = groupedSponsors[bucket][cleanName].find(item => item.type === routeId && item.rating === ratingId);
                        if (!exists) {
                            groupedSponsors[bucket][cleanName].push({ type: routeId, rating: ratingId });
                        }
                    }
                });
            }
        }

        // Prepare the output directory
        const outputDir = path.join(__dirname, 'data');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        // Write the metadata file
        const metadataOutput = {
            types: Object.fromEntries(Object.entries(routeEnums).map(([k, v]) => [v, k])),
            ratings: Object.fromEntries(Object.entries(ratingEnums).map(([k, v]) => [v, k]))
        };
        fs.writeFileSync(path.join(outputDir, 'metadata.json'), JSON.stringify(metadataOutput, null, 4));
        console.log('Successfully saved metadata.json');

        // Write individual a-z and other files
        let totalCompaniesProcessed = 0;
        for (const [bucket, data] of Object.entries(groupedSponsors)) {
            const companyCount = Object.keys(data).length;
            if (companyCount > 0) {
                fs.writeFileSync(path.join(outputDir, `${bucket}.json`), JSON.stringify(data, null, 4));
                totalCompaniesProcessed += companyCount;
            }
        }

        console.log(`Successfully split and saved ${totalCompaniesProcessed} companies across alphabetical files in the /data folder.`);

    } catch (error) {
        console.error("An error occurred during the update process:", error);
        process.exit(1);
    }
}

updateSponsors();
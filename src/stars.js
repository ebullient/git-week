#!/usr/bin/env node

import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { runGraphQL } from './lib/github.js';
import { getMonday, getNextMonday, formatDate} from './lib/dateUtils.js';

function parseRepoString(repoString) {
    const parts = repoString.split('/');
    if (parts.length !== 2) {
        throw new Error(`Invalid repository format: ${repoString}. Expected format: owner/repo`);
    }
    return { owner: parts[0], name: parts[1] };
}

function fetchAllStargazers(owner, name) {
    const stargazers = [];
    let hasNextPage = true;
    let after = null;
    const batchSize = 100;

    console.log(`   Fetching stargazers for ${owner}/${name}...`);

    while (hasNextPage) {
        const variables = {
            owner,
            name,
            first: batchSize,
            ...(after && { after })
        };

        const result = runGraphQL('stargazersQuery', variables);

        if (!result.data?.repository?.stargazers) {
            console.error(`Failed to fetch stargazers for ${owner}/${name}`);
            break;
        }

        const stargazerData = result.data.repository.stargazers;

        for (const edge of stargazerData.edges) {
            if (edge.starredAt) {
                stargazers.push(new Date(edge.starredAt));
            }
        }

        hasNextPage = stargazerData.pageInfo.hasNextPage;
        after = stargazerData.pageInfo.endCursor;

        console.log('   Fetched', stargazers.length, 'stargazers so far...');
    }

    console.log('   Total stargazers fetched', stargazers.length);
    return stargazers;
}

function generateCumulativeData(stargazers, finalWeek) {
    if (stargazers.length === 0) {
        return {};
    }

    // Use next Monday as exclusive upper bound (like go script)
    const finalMonday = getNextMonday(finalWeek);
    const upperBound =  new Date(`${finalMonday}T00:00:00.000Z`);

    // Filter out stargazers after the target Monday
    const filteredStargazers = stargazers
            .filter(star => star < upperBound)
            .sort((a, b) => a.getTime() - b.getTime());
    if (finalWeek) {
        console.log('   Filtered', stargazers.length, 'stargazers to', filteredStargazers.length, '(those before', finalMonday, ')');
    }

    if (filteredStargazers.length === 0) {
        return {};
    }
    const cumulative = {};

    for (let i = 0; i < filteredStargazers.length; i++) {
        const star = filteredStargazers[i];
        const starMonday = getMonday(star);
        const cumulativeCount = i + 1; // This star is the (i+1)th star overall

        // Store cumulative count (will overwrite if multiple stars in same Monday)
        cumulative[starMonday] = cumulativeCount;
    }
    return cumulative;
}

function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: npm run stars <repo1,repo2,...> <output_dir> [date]');
        console.error('Example: npm run stars username/repo1,username/repo2 /path/to/output');
        process.exit(1);
    }

    const reposArg = args[0];
    const outputDir = args[1];
    const finalWeek = getMonday(args[2]);

    // Parse repository list
    const repoStrings = reposArg.split(',').map(s => s.trim());
    console.log('Processing', repoStrings.length, 'repositories through week of', finalWeek);

    // Ensure output directory exists
    mkdirSync(outputDir, { recursive: true });

    // Load existing data
    const allData = {};

    // Process each repository
    for (const repoString of repoStrings) {
        try {
            const { owner, name } = parseRepoString(repoString);
            const repoName = `${owner}/${name}`;

            console.log('🚀 Processing', repoName);

            const stargazers = fetchAllStargazers(owner, name);
            const cumulativeData = generateCumulativeData(stargazers, finalWeek);
            const sortedCumulative = new Map([...Object.entries(cumulativeData)].sort());

            allData[repoName] = {
                name: repoName,
                cumulative: Object.fromEntries(sortedCumulative)
            };
            console.log('   Updated data for', repoName);
        } catch (error) {
            console.error(` Error processing repository ${repoString}:`, error.message);
        }
    }

    // Write updated data
    const outputPath = `${outputDir}/stargazers.json`;
    writeFileSync(outputPath, JSON.stringify(Object.values(allData), null, 2));
    console.log('✅ Stargazer data updated:', outputPath);
}

main();
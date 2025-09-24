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

    console.log(`Fetching stargazers for ${owner}/${name}...`);

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

        console.log(`Fetched ${stargazers.length} stargazers so far...`);
    }

    console.log('Total stargazers fetched', stargazers.length);
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
            .sort();
    if (finalWeek) {
        console.log(`Filtered ${stargazers.length} stargazers to ${filteredStargazers.length} (before ${finalMonday})`);
    }

    if (filteredStargazers.length === 0) {
        return {};
    }

    const cumulative = {};

    // Generate weekly cumulative counts for weeks that actually have stars
    for (const star of filteredStargazers) {
        const starMonday = getMonday(star);

        // Only update if this is a new Monday or higher count
        const existingCount = cumulative[starMonday] || 0;
        cumulative[starMonday] = existingCount + 1;
    }
    return cumulative;
}

function generateChartsMarkdown(allData, outputPath) {
    // Get all unique dates across all repositories
    const allDates = new Set();
    for (const repoName of Object.keys(allData)) {
        const repo = allData[repoName];
        if (repo) {
            for (const date of Object.keys(repo.cumulative)) {
                allDates.add(date);
            }
        }
    }

    // Sort dates and get range
    const sortedDates = Array.from(allDates).sort();
    const begin = sortedDates[0];
    const end = sortedDates[sortedDates.length - 1];

    // Generate all Mondays between begin and end
    const allMondays = [];
    const current = new Date(`${begin}T00:00:00.000Z`);
    const endDate = new Date(`${end}T00:00:00.000Z`);

    while (current <= endDate) {
        allMondays.push(formatDate(current));
        current.setUTCDate(current.getUTCDate() + 7);
    }

    // Generate YAML chart configuration
    const chartYaml = [
        'type: line',
        `labels: [${allMondays.map(date => `"${date}"`).join(', ')}]`,
        'series:'
    ];

    // Create series for each repository in input order
    for (const repoName of Object.keys(allData)) {
        const repo = allData[repoName];
        const cumulative = repo.cumulative;

        const data = [];
        let prev = 0;
        for(const date of allMondays) {
            const add = cumulative[date] || 0;
            prev = prev + add;
            data.push(prev);
        }

        chartYaml.push(
            `  - title: "${repo.name}"`,
            `    data: [${data.join(', ')}]`,
            '    pointRadius: 0',
            '    pointHoverRadius: 0'
        );
        repo.total = prev;
    }

    // Generate markdown content
    const content = [
        '# Repository Stargazers Analysis',
        '',
        '## Chart',
        '',
        '```chart',
        chartYaml.join('\n'),
        '```',
        '',
        '## Summary',
        ''
    ];

    // Add summary for each repository in input order
    for (const repoName of Object.keys(allData)) {
        const repo = allData[repoName];
        const dates = Object.keys(repo.cumulative);
        const firstDate = dates[0];
        const latestDate = dates[dates.length - 1];
        const count = repo.total;

        content.push(`### ${repo.name}`);
        content.push(`- **Total Stars**: ${count}`);
        content.push(`- **Data Points**: ${dates.length}`);
        content.push(`- **Date Range**: ${firstDate} to ${latestDate}`);
        content.push('');
    }

    // Write the file
    writeFileSync(outputPath, content.join('\n'));
    console.log(`Generated charts markdown: ${outputPath}`);
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

            console.log(`\\nProcessing ${repoName}...`);

            const stargazers = fetchAllStargazers(owner, name);
            const cumulativeData = generateCumulativeData(stargazers, finalWeek);
            const sortedCumulative = new Map([...Object.entries(cumulativeData)].sort());

            allData[repoName] = {
                name: repoName,
                cumulative: Object.fromEntries(sortedCumulative)
            };
            console.log(`Updated data for ${repoName}`);
        } catch (error) {
            console.error(`Error processing repository ${repoString}:`, error.message);
        }
    }

    // Write updated data
    const outputPath = `${outputDir}/stargazers.json`;
    writeFileSync(outputPath, JSON.stringify(Object.values(allData), null, 2));
    console.log(`\\nStargazer data updated: ${outputPath}`);

    // Generate charts markdown using input order
    const chartsPath = `${outputDir}/stargazers.md`;
    generateChartsMarkdown(allData, chartsPath);

    // // Print summary
    // console.log('\\nSummary:');
    // for (const repo of allData) {
    //     const dates = Object.keys(repo.cumulative);
    //     if (dates.length > 0) {
    //         const latestDate = dates.sort().pop();
    //         const latestCount = repo.cumulative[latestDate];
    //         console.log(`- ${repo.name}: ${latestCount} stars (as of ${latestDate})`);
    //     }
    // }
}

main();
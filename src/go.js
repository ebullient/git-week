#!/usr/bin/env node

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { runGraphQL } from './lib/github.js';
import { getMonday, getNextMonday } from './lib/dateUtils.js';

function generateMarkdown(outputPath, contributions) {

    const contributionsCollection = contributions.data.user.contributionsCollection;

    // Aggregate contributions by repository
    const repoContributions = new Map();
    const repoTags = new Set();

    // Process commits
    for (const item of contributionsCollection.commitContributionsByRepository) {
        const repoName = item.repository.nameWithOwner;
        if (!repoContributions.has(repoName)) {
            repoContributions.set(repoName, { issues: 0, commits: 0, prs: 0, reviews: 0 });
        }
        repoContributions.get(repoName).commits = item.contributions.totalCount;
        repoTags.add(`gh-stats/${repoName}`);
    }

    // Process issues
    for (const item of contributionsCollection.issueContributionsByRepository) {
        const repoName = item.repository.nameWithOwner;
        if (!repoContributions.has(repoName)) {
            repoContributions.set(repoName, { issues: 0, commits: 0, prs: 0, reviews: 0 });
        }
        repoContributions.get(repoName).issues = item.contributions.totalCount;
        repoTags.add(`gh-stats/${repoName}`);
    }

    // Process PRs
    for (const item of contributionsCollection.pullRequestContributionsByRepository) {
        const repoName = item.repository.nameWithOwner;
        if (!repoContributions.has(repoName)) {
            repoContributions.set(repoName, { issues: 0, commits: 0, prs: 0, reviews: 0 });
        }
        repoContributions.get(repoName).prs = item.contributions.totalCount;
        repoTags.add(`gh-stats/${repoName}`);
    }

    // Process PR reviews
    for (const item of contributionsCollection.pullRequestReviewContributionsByRepository) {
        const repoName = item.repository.nameWithOwner;
        if (!repoContributions.has(repoName)) {
            repoContributions.set(repoName, { issues: 0, commits: 0, prs: 0, reviews: 0 });
        }
        repoContributions.get(repoName).reviews = item.contributions.totalCount;
        repoTags.add(`gh-stats/${repoName}`);
    }

    // Generate frontmatter
    const frontmatter = [
        '---',
        'contributions:',
        `  issues: ${contributionsCollection.totalIssueContributions}`,
        `  commits: ${contributionsCollection.totalCommitContributions}`,
        `  repositories: ${contributionsCollection.totalRepositoryContributions}`,
        `  pull_requests: ${contributionsCollection.totalPullRequestContributions}`,
        `  pull_request_reviews: ${contributionsCollection.totalPullRequestReviewContributions}`,
        'tags:',
        ...Array.from(repoTags).sort().map(tag => `  - ${tag}`),
        '---',
        ''
    ].join('\n');

    // Generate body
    const body = [
        '# Contributions for the week',
        '',
        `- **Total Issue Contributions**: ${contributionsCollection.totalIssueContributions}`,
        `- **Total Commit Contributions**: ${contributionsCollection.totalCommitContributions}`,
        `- **Total Repository Contributions**: ${contributionsCollection.totalRepositoryContributions}`,
        `- **Total Pull Request Contributions**: ${contributionsCollection.totalPullRequestContributions}`,
        `- **Total Pull Request Review Contributions**: ${contributionsCollection.totalPullRequestReviewContributions}`,
        '',
        '### Contributions by Repository',
        '',
        '| Repository | Issues | Commits | PRs | PR Reviews |',
        '|------------|--------|---------|-----|------------|'
    ];

    // Sort repositories by total contributions (descending)
    const sortedRepos = Array.from(repoContributions.entries()).sort((a, b) => {
        const totalA = a[1].issues + a[1].commits + a[1].prs + a[1].reviews;
        const totalB = b[1].issues + b[1].commits + b[1].prs + b[1].reviews;
        return totalB - totalA;
    });

    for (const [repoName, stats] of sortedRepos) {
        const formatStat = (num) => num > 0 ? `**${num}**` : '0';
        body.push(`| ${repoName} | ${formatStat(stats.issues)} | ${formatStat(stats.commits)} | ${formatStat(stats.prs)} | ${formatStat(stats.reviews)} |`);
    }

    const content = frontmatter + body.join('\n');

    // Ensure output directory exists
    mkdirSync(dirname(outputPath), { recursive: true });

    // Write file
    writeFileSync(outputPath, content);
    console.log(`Generated contribution report: ${outputPath}`);
}

function main() {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.error('Usage: npm run go <username> <output_dir> [date]');
        process.exit(1);
    }

    const username = args[0];
    const outputDir = args[1];
    const dateArg = args[2];

    // Calculate week start (Monday) and end (next Monday for exclusive range)
    const weekStartStr = getMonday(dateArg);
    const weekStart = new Date(`${weekStartStr}T00:00:00.000Z`);
    const weekEndStr = getNextMonday(weekStartStr);
    const weekEnd = new Date(`${weekEndStr}T00:00:00.000Z`);

    console.log(`Fetching contributions for ${username} from ${weekStartStr} to ${weekEndStr} (exclusive)`);

    // Prepare variables for GraphQL query
    const variables = {
        login: username,
        from: weekStart.toISOString(),
        to: weekEnd.toISOString()
    };

    // Execute query
    const contributions = runGraphQL('contributionsQuery', variables);

    if (!contributions.data?.user) {
        console.error('Failed to fetch user data');
        process.exit(1);
    }

    // Generate output filename
    const year = weekStart.getFullYear();
    const outputPath = join(outputDir, year.toString(), `${weekStartStr}_gh.md`);

    // Generate markdown
    generateMarkdown(outputPath, contributions);
}

main();
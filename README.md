# Git Week

A tool for tracking GitHub contributions and repository stargazer growth using GitHub GraphQL API.

## Prerequisites

- Node.js
- GitHub CLI (`gh`) installed and authenticated

## Installation

```bash
npm install
```

## Usage

### Generate Weekly Contribution Report

Creates a markdown report of GitHub contributions for a given week:

```bash
npm run go <username> <output_dir> [date]
```

Examples:
```bash
# Generate report for current week
npm run go username /path/for/output/

# Generate report for specific week (finds nearest Monday)
npm run go username /path/for/output/ 2025-09-15
```

The output file will be placed at: `<output_dir>/<year>/<monday_date>_gh.md`

### Update Stargazer Data

Updates JSON file with cumulative stargazer counts by week for tracked repositories and generates an Obsidian-compatible charts markdown file:

```bash
npm run stars <repo1,repo2,...> <output_dir> [date]
```

Examples:
```bash
# Update stargazer data for multiple repositories
npm run stars username/repo1,username/repo2 /path/for/output/

# Update for specific date
npm run stars username/repo1,username/repo2 /path/for/output/ 2025-09-15
```

The output files will be:
- `<output_dir>/stargazers.json` - Raw data

## Output Formats

### Contribution Report (Markdown)

- YAML frontmatter with contribution counts and repository tags
- Summary of total contributions by type
- Table of contributions by repository

### Stargazer Data (JSON)

- Array of repositories with cumulative stargazer counts by week
- Weekly data points showing growth over time

## Project Structure

```
├── src/
│   ├── go.js           # Contribution tracking script
│   ├── stars.js        # Stargazer tracking script
│   └── lib/
│       └── github.js   # Common GraphQL utilities
├── graphql/
│   ├── contributionsQuery.graphql
│   └── stargazersQuery.graphql
├── package.json
└── README.md
```
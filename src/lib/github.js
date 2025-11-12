import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const scriptRoot = dirname(dirname(__dirname));

export function runGraphQL(queryFile, variables = {}) {
    const queryPath = join(scriptRoot, 'graphql', `${queryFile}.graphql`);

    const args = [
        'api',
        'graphql',
        '-F',
        `query=@${queryPath}`
    ];

    // Add variables as parameters
    for (const [key, value] of Object.entries(variables)) {
        args.push('-F');
        args.push(`${key}=${value}`);
    }

    const { status, stdout, stderr } = spawnSync('gh', args);

    const output = new TextDecoder().decode(stdout).trim();

    if (status !== 0) {
        const errorOutput = new TextDecoder().decode(stderr);
        console.error(`GraphQL query failed (${status}):`, errorOutput);
        process.exit(1);
    }

    try {
        const result = JSON.parse(output);
        if (result.errors) {
            console.error('GraphQL errors:', result.errors);
            process.exit(1);
        }
        return result;
    } catch (error) {
        console.error('Failed to parse GraphQL response:', error.message);
        console.error('Raw output:', output);
        process.exit(1);
    }
}

export function fetchUserEvents(username) {
    const args = [
        'api',
        '/users/' + username + '/events',
        '--paginate'
    ];

    const { status, stdout, stderr } = spawnSync('gh', args);

    const output = new TextDecoder().decode(stdout).trim();

    if (status !== 0) {
        const errorOutput = new TextDecoder().decode(stderr);
        console.error(`Failed to fetch events (${status}):`, errorOutput);
        process.exit(1);
    }

    try {
        return JSON.parse(output);
    } catch (error) {
        console.error('Failed to parse events response:', error.message);
        console.error('Raw output:', output);
        process.exit(1);
    }
}

export function fetchCommit(repoName, sha) {
    const args = [
        'api',
        `/repos/${repoName}/commits/${sha}`,
        '--jq',
        '{message: (.commit.message | split("\\n")[0]), date: (.commit.author.date | split("T")[0])}'
    ];

    const { status, stdout, stderr } = spawnSync('gh', args);

    const output = new TextDecoder().decode(stdout).trim();

    if (status !== 0) {
        const errorOutput = new TextDecoder().decode(stderr);
        console.error(`Failed to fetch commit ${sha} (${status}):`, errorOutput);
        return null;
    }

    try {
        return JSON.parse(output);
    } catch (error) {
        console.error('Failed to parse commit response:', error.message);
        return null;
    }
}
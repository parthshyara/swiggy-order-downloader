import puppeteer from 'puppeteer';
import { authenticateSession, loadSession } from './auth';
import { scrapeOrders } from './scraper';

// Configuration
import readline from 'readline';

function parseDate(dateStr: string): Date {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) {
        throw new Error(`Invalid date format: ${dateStr}. Use YYYY-MM-DD.`);
    }
    return d;
}

function getDebugFlag() {
    return process.argv.includes('--debug-logs');
}

function promptUser(query: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
}



async function main() {
    console.log('--- Swiggy Order Logger ---');

    // Check for debug flag
    const debugLogs = getDebugFlag();
    if (debugLogs) console.log('Debug Logs: ENABLED');

    const endDate = new Date(); // Always today

    // Interactive Input
    let startDate: Date;
    try {
        const dateInput = await promptUser('Enter Start Date (YYYY-MM-DD) [Enter to default: 7 days ago]: ');
        if (!dateInput.trim()) {
            startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
        } else {
            startDate = parseDate(dateInput.trim());
        }
    } catch (e) {
        console.error('Invalid date input. Exiting.');
        process.exit(1);
    }

    console.log(`Date Range: ${startDate.toDateString()} - ${endDate.toDateString()}`);

    try {
        // 1. Auth Phase
        // Ensure user is logged in. If not, wait for them.
        const isLoggedIn = await authenticateSession();
        if (!isLoggedIn) {
            console.error('Authentication failed. Exiting.');
            return;
        }

        console.log('Session confirmed. Proceeding to scrape...');

        // 2. Scrape Phase - Start FRESH browser
        console.log('Launching Shared Browser Session for Scraping...');
        const browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 900 });

        if (debugLogs) {
            page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        }

        // Load the session we (maybe just) captured
        await loadSession(page);

        // Pass the page instance to the scraper
        await scrapeOrders(page, startDate, endDate, 'Defence Colony');

        // 3. Close the browser
        await browser.close();

    } catch (e) {
        console.error('Fatal Error:', e);
    }
}

main();

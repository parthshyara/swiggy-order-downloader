
import puppeteer, { Page } from 'puppeteer';
import fs from 'fs-extra';

const SESSION_FILE = 'session.json';
const HEADERS_FILE = 'headers.json';

export async function ensureLoggedIn(page: Page): Promise<boolean> {
    // 1. Try to load existing session
    if (await fs.pathExists(SESSION_FILE)) {
        console.log('Found existing session. Loading...');
        const cookies = await fs.readJson(SESSION_FILE);
        await page.setCookie(...cookies);
        return true;
    }

    // 2. Perform Login Flow if no session
    console.log('No session found. Initiating login flow...');
    console.log('\nNOTE: Please log in and navigate to the "Orders" page to capture session.');

    // Requests Listener
    const headersPromise = new Promise<void>((resolve) => {
        const handler = async (request: any) => {
            if (request.url().includes('/dapi/order/all') || request.url().includes('/api/v1/orders')) {
                console.log('Captured Orders API request! Saving headers...');
                const headers = request.headers();
                await fs.writeJson(HEADERS_FILE, headers, { spaces: 2 });
                console.log(`Headers saved to ${HEADERS_FILE}`);
                page.off('request', handler); // Cleanup
                resolve();
            }
        };
        page.on('request', handler);
    });

    await page.goto('https://www.swiggy.com/my-account/orders', { waitUntil: 'networkidle2' });

    console.log('Waiting for login and session capture...');

    try {
        await Promise.race([
            headersPromise,
            new Promise((_, reject) => setTimeout(() => reject('Timeout waiting for headers (5 min)'), 300000))
        ]);

        console.log('Successfully captured session!');
        const cookies = await page.cookies();
        await fs.writeJson(SESSION_FILE, cookies, { spaces: 2 });
        return true;

    } catch (e) {
        console.error('Login Failed/Timeout:', e);
        return false;
    }
}

export async function loadSession(page: Page): Promise<boolean> {
    // Helper for scraper if needed, or scraper can just rely on ensuringLoggedIn having run
    if (await fs.pathExists(SESSION_FILE)) {
        const cookies = await fs.readJson(SESSION_FILE);
        await page.setCookie(...cookies);
        return true;
    }
    return false;
}

export async function authenticateSession(): Promise<boolean> {
    if (await fs.pathExists(SESSION_FILE)) {
        return true;
    }

    console.log('No session found. Launching Browser for Login & Capture...');
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized', '--disable-blink-features=AutomationControlled']
    });

    try {
        const page = await browser.newPage();
        const loggedIn = await ensureLoggedIn(page);
        await browser.close();
        return loggedIn;
    } catch (e) {
        console.error('Auth Error:', e);
        await browser.close();
        return false;
    }
}

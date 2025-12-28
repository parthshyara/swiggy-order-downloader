import { Page } from 'puppeteer';
import { SwiggyOrder } from './types';

export interface CalibrationClip {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Injects a UI overlay to let the user select the receipt area for cropping.
 */
export async function performCalibration(page: Page): Promise<CalibrationClip> {
    console.log('--- AUTO-CALIBRATION: CLICKING BOTTOM RIGHT ---');

    // Wait for a moment to ensure sidebar is open
    await new Promise(r => setTimeout(r, 2000));

    return (await page.evaluate(() => {
        return new Promise<CalibrationClip>((resolve) => {
            // We want to capture the element at the near bottom-right
            // The sidebar usually occupies the right side.
            const x = window.innerWidth - 50;
            const y = window.innerHeight - 50;

            console.log(`Auto-clicking at ${x}, ${y}`);

            // Simply identify the element at that point
            const el = document.elementFromPoint(x, y) as HTMLElement;

            if (el) {
                console.log('--- ELEMENT FOUND VIA AUTO-CLICK ---');
                console.log('TAG:', el.tagName);
                console.log('CLASS:', el.className);

                const rect = el.getBoundingClientRect();
                resolve({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
            } else {
                console.warn('No element found at auto-click coordinates');
                // Fallback to full right side?
                resolve({ x: window.innerWidth - 500, y: 0, width: 500, height: window.innerHeight });
            }
        });
    })) as CalibrationClip;
}

/**
 * Scrolls the page and clicks "Show More Orders" until the start date is reached.
 */
export async function expandOrderList(page: Page, startDate: Date, capturedOrders: Map<string, SwiggyOrder>) {
    console.log('Expanding list until start date is reached in API data...');
    let expansionDone = false;

    while (!expansionDone) {
        const allCaptured = Array.from(capturedOrders.values());
        if (allCaptured.length > 0) {
            const oldest = allCaptured[allCaptured.length - 1];
            const oldestDate = new Date(oldest.order_time);
            console.log(`Oldest API Order: ${oldestDate.toDateString()}`);
            if (oldestDate < startDate) { expansionDone = true; break; }
        }

        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 1500));

        const showMoreClicked = await page.evaluate(() => {
            const divs = Array.from(document.querySelectorAll('div, span, button'));
            const btn = divs.find(el => el.textContent?.trim() === 'Show More Orders');
            if (btn) { (btn as HTMLElement).click(); return true; }
            return false;
        });

        if (showMoreClicked) {
            console.log('\nClicked "Show More Orders"');
            await new Promise(r => setTimeout(r, 3000));
        } else {
            console.log('No "Show More" button found. Assuming end of list.');
            expansionDone = true;
        }
    }
}

/**
 * Clicks the element containing the specific Order ID to open details.
 */
export async function clickOrderDetails(page: Page, orderId: string): Promise<boolean> {
    return page.evaluate((oid) => {
        // Helper to find element by text using TreeWalker
        function findElementByText(text: string): HTMLElement | null {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
            let node: Node | null;
            while (node = walker.nextNode()) {
                if (node.nodeValue && node.nodeValue.includes(text)) {
                    return node.parentElement as HTMLElement;
                }
            }
            return null;
        }

        const orderIdEl = findElementByText(oid);
        if (orderIdEl) {
            console.log(`Found Order ID element: ${orderIdEl.tagName}. Clicking it directly.`);
            orderIdEl.scrollIntoView({ block: 'center' });
            orderIdEl.click();
            return true;
        }
        return false;
    }, orderId);
}

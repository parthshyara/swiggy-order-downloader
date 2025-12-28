import { Page } from 'puppeteer';
import fs from 'fs-extra';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import { SwiggyOrder, CONFIG } from './types';
import { performCalibration, CalibrationClip, expandOrderList, clickOrderDetails } from './helpers';

// State
let CALIBRATED_CLIP: CalibrationClip | null = null;

export async function scrapeOrders(page: Page, startDate: Date, endDate: Date, address_filter: string) {
    console.log(`\nStarting Hybrid Scraper (API + UI) from ${startDate.toDateString()} to ${endDate.toDateString()}`);

    // Setup
    await fs.emptyDir(CONFIG.screenshotDir);
    if (await fs.pathExists(CONFIG.csvFile)) await fs.remove(CONFIG.csvFile);
    await fs.ensureDir('debug');

    const csvWriter = createObjectCsvWriter({
        path: CONFIG.csvFile,
        header: [
            { id: 'serial', title: 'Serial' },
            { id: 'items', title: 'Items' },
            { id: 'orderId', title: 'Order ID' },
            { id: 'date', title: 'Date' },
            { id: 'amount', title: 'Amount' },
            { id: 'total', title: 'Total' },
            { id: 'restaurant', title: 'Restaurant' },
        ]
    });

    const capturedOrders = new Map<string, SwiggyOrder>();

    // Network Interceptor
    page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('dapi/order/all') && response.request().method() === 'GET') {
            try {
                const json = await response.json();
                if (json.statusCode === 0 && json.data && Array.isArray(json.data.orders)) {
                    const orders = json.data.orders as SwiggyOrder[];
                    console.log(`Interceptor: Captured ${orders.length} orders from API.`);
                    for (const o of orders) capturedOrders.set(o.order_id, o);
                }
            } catch (e) { }
        }
    });

    try {
        await page.goto(CONFIG.ordersUrl, { waitUntil: 'networkidle2' });

        // 1. EXPANSION
        await expandOrderList(page, startDate, capturedOrders);

        // 2. PROCESSING
        console.log('\nProcessing captured API orders...');
        const sortedOrders = Array.from(capturedOrders.values())
            .map(o => ({ ...o, dateObj: new Date(o.order_time) }))
            .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

        let serialNumber = 1;


        for (const order of sortedOrders) {
            if (order.dateObj > endDate) continue;
            if (order.dateObj < startDate) break;

            // Skip orders not from the specified address
            if (!order.delivery_address.address.includes(address_filter)) continue;

            console.log(`[${serialNumber}] Processing Order ${order.order_id} (${order.dateObj.toDateString()})`);

            const success = await clickOrderDetails(page, order.order_id);

            if (success) {
                try { await page.waitForSelector(CONFIG.sidePanelSelector, { timeout: 8000 }); } catch (e) { }
                await new Promise(r => setTimeout(r, 1500));

                if (!CALIBRATED_CLIP) {
                    CALIBRATED_CLIP = await performCalibration(page);
                    console.log('Calibration Locked:', CALIBRATED_CLIP);
                }

                const screenshotPath = path.join(CONFIG.screenshotDir, `${serialNumber}.png`);
                try {
                    if (CALIBRATED_CLIP && CALIBRATED_CLIP.width > 0 && CALIBRATED_CLIP.height > 0) {
                        const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
                        const adjustedClip = {
                            x: CALIBRATED_CLIP.x + scroll.x,
                            y: CALIBRATED_CLIP.y + scroll.y,
                            width: CALIBRATED_CLIP.width,
                            height: CALIBRATED_CLIP.height
                        };
                        await page.screenshot({ path: screenshotPath, clip: adjustedClip });
                    } else {
                        await page.screenshot({ path: screenshotPath });
                    }
                } catch (e) { await page.screenshot({ path: screenshotPath }); }

                await page.keyboard.press('Escape');
                try {
                    await page.waitForSelector(CONFIG.sidePanelSelector, { hidden: true, timeout: 3000 });
                } catch (e) {
                    const overlay = await page.$('#overlay');
                    if (overlay) await overlay.click();
                }

                await csvWriter.writeRecords([{
                    serial: serialNumber,
                    items: order.order_items[0].name,
                    orderId: order.order_id,
                    date: order.dateObj.toDateString().split(' ').slice(1).join(' '),
                    amount: order.order_total,
                    total: order.order_total,
                    restaurant: order.restaurant_name,
                }]);
                serialNumber++;

            } else {
                console.warn(`Could not find DOM element for Order ${order.order_id}`);
            }
        }
    } catch (e) {
        console.error('Error during scraping:', e);
    }
}

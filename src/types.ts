export interface SwiggyOrder {
    order_id: string;
    order_time: string;
    order_total: number;
    restaurant_name: string;
    order_items: { name: string }[];
    delivery_address: { address: string };
}

export interface ScraperConfig {
    screenshotDir: string;
    csvFile: string;
    ordersUrl: string;
    sidePanelSelector: string;
}

export const CONFIG: ScraperConfig = {
    screenshotDir: 'screenshots',
    csvFile: 'orders.csv',
    ordersUrl: 'https://www.swiggy.com/my-account/orders',
    sidePanelSelector: '#overlay-sidebar-root'
};

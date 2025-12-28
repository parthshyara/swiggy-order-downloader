# Swiggy Orders Scraper

A robust, text-based scraper to download your Swiggy order history and receipts.

## Features
- **Hybrid Extraction**: Intercepts Swiggy's internal API to get accurate order data (Items, Prices, Dates).
- **Smart Screenshots**: Uses "Auto-Click Calibration" to automatically detect and capture pixel-perfect receipts without manual intervention.
- **Robust Navigation**: Finds buttons by text ("View Details") rather than brittle CSS classes, ensuring long-term stability.
- **Session Management**: Logs in once, saves session keys, and reuses them.

## Installation

1. Clone the repo.
2. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. **Start the Scraper**:
   ```bash
   npm start
   ```
   - The script will interactively ask for the **Start Date** (YYYY-MM-DD).
   - Press **Enter** to default to the last 7 days.
   - End Date is automatically set to **Today**.

   **Debug Mode (View Page Logs)**:
   ```bash
   npm start -- --debug-logs
   ```


2. **First Run (Login)**:
   - A Chromium window will open.
   - Log in to Swiggy using your Phone Number.
   - **Navigate to the "Orders" page** (`my-account/orders`).
   - The script will detect the network traffic and capture your session automatically.

3. **Auto-Capture**:
   - The script will open each order's details.
   - It automatically simulates a click to detect the sidebar.
   - Screenshots are saved automatically without any user input.

4. **Output**:
   - `orders.csv`: Spreadsheet with Order ID, Date, Restaurant, Items, Amount.
   - `screenshots/`: Folder containing images of every order receipt.

## License
GNU GPLv3

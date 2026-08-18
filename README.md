# Job Fair Drinks

Partners at their job fair stand scan a QR code, order drinks from their phone, and someone from the bar brings it over. No need to leave the stand.

## One-time setup (before the event)

1. Install [Node.js](https://nodejs.org) (the LTS version) on the laptop you'll use to run this at the venue. Just run the installer with default options.
2. Open a terminal in this folder and install dependencies:

   ```bash
   npm install
   ```

## Running it at the venue

1. Connect the laptop to the venue wifi (the same network the partners' and bar staff's phones/tablets will use).
2. Start the server:

   ```bash
   npm start
   ```

3. The terminal will print a few addresses, e.g.:

   ```
   On the venue wifi (use this for QR codes to work on phones):
     http://192.168.1.42:3000/admin.html
   ```

   **Open that `192.168.x.x` address** (not `localhost`) in the laptop's browser. The Admin page will also warn you if you're on the wrong address.

4. On the **Admin** page:
   - Add/edit the drink menu (Water, Coffee, Coca-Cola, etc. are added by default - edit as needed).
   - Add one stand per partner (e.g. "Acme Corp - Stand 12").
5. Go to the **Print QR codes** page and print it - one QR code per stand, ready to cut out and tape to each stand's table.
6. Open the **Bar dashboard** page on the screen/tablet at the bar. It updates automatically every few seconds and plays a sound when a new order comes in.

## During the event

- A partner scans their stand's QR code, picks drinks, and taps "Send order".
- The order instantly shows up in the **Pending** column of the bar dashboard.
- Bar staff click "Start preparing" then "Mark delivered" as they go - the partner's phone shows the live status.
- If you add or remove stands/drinks mid-event, it takes effect immediately (no restart needed).

## Notes

- All data (stands, drinks, orders) is saved to `data.json` in this folder, so if you stop and restart the server nothing is lost.
- This is designed to run on the local wifi network only - no internet connection or external hosting is required.
- To reset everything before a new event, stop the server and delete `data.json`.

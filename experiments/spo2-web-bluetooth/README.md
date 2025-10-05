# Zacurate SpO2 Web Bluetooth Probe

Standalone proof-of-concept for connecting a Zacurate pulse oximeter to the browser via Web Bluetooth. This stays isolated from the primary Reset Biology app.

## Requirements

- Chrome, Edge, or Opera on desktop or Chrome/Samsung Internet on Android.
- HTTPS origin (production) or http://localhost during development.
- Zacurate device advertising the Pulse Oximeter Service (0x1822). Update the UUIDs in main.js if the device uses custom services.

## Quick Start

1. From this folder, serve the files over HTTPS or localhost. Examples:
   - Run: npx http-server -S -C cert.pem -K key.pem (self-signed certificate).
   - Run: npx serve . (defaults to localhost over HTTP, which works when browsing via http://localhost).
   - If the Zacurate device does not appear in the filtered list, the script falls back to the full Bluetooth picker so you can choose it manually.
2. Open the served page in a compatible browser.
3. Power on the Zacurate oximeter.
4. Choose "Connect & Listen (Spot-Check)" or "Connect & Listen (Continuous)" and pick the device in the browser picker.
5. Watch the live readings and logs. Close the tab or click "Disconnect" to release the device.

## Notes

- iOS and iPadOS browsers do not expose Web Bluetooth. Use a native bridge or HealthKit sync for Apple users.
- The parser handles the standard PLX Spot-Check and Continuous characteristics. If the device sends proprietary data, capture the raw hex from the log and adjust parseContinuousMeasurement / parseSpotMeasurement in main.js.
- The UI exposes the raw payload in hex so you can validate field layouts for non-standard Zacurate firmware.
- Background sync is not available in the browser; the page must stay open to stream readings.

## Next Steps

- Confirm the device exposes the standard service using an app like nRF Connect.
- Hook the parsed measurements into your API once the flow is validated.
- If you need iOS coverage, pair this POC with a lightweight native bridge that forwards measurements to the backend.

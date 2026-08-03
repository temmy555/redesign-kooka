# Agoda catalog import

Source: [KOOKA Residence Surabaya on Agoda](https://www.agoda.com/kooka-residence-surabaya/hotel/surabaya-id.html)

The Agoda listing is used as a public catalog reference for authentic property photography and room-type names. It is not the operational source of truth for physical room units, availability, rate plans, taxes, or prices.

## Imported material

- 27 property photographs are stored locally under `public/images/agoda-kooka`.
- The normalized source catalog is stored in `data/sources/agoda-kooka-residence.json`.
- File hashes and dimensions are stored in `data/sources/agoda-kooka-assets.integrity.json` after synchronization.
- Two room-type names were visible and could be identified reliably:
  - Mezzanine — 3 Adults.
  - 2 Bedroom Villa.

The listing referred to other room types but did not expose reliable names, capacities, amenities, or rate-plan details for the selected sold-out date. Those values were not invented or activated in the booking inventory.

## Operational boundaries

- Agoda's displayed room count must not overwrite KOOKA's physical unit inventory.
- Agoda availability must not open or close inventory in this application.
- Agoda dynamic prices and promotions are not imported.
- The listing's breakfast statement is not imported. The approved project policy remains room-only, with food and drinks ordered separately.
- The two recognized room types remain review data until Front Office or Owner confirms their physical unit mapping, capacity, amenities, and base pricing through the audited Room Master workflow.

## Refreshing the local copies

Run:

```sh
npm run assets:sync:agoda
```

The command downloads each declared public source image, validates it, normalizes it as JPEG, and refreshes the integrity manifest. It never changes room units or booking data.

Before production publication, KOOKA should confirm that it owns or is licensed to reuse every photograph from its Agoda listing.

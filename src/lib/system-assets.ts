// System-default header/background assets are NOT synced to the server — the
// mobile app seeds them locally from its bundle (see HeaderSeeder.kt /
// BackgroundSeeder.kt). We ship the SAME real images with the webapp and map
// their fixed system IDs here, so invoices using a default asset render too.
const SYSTEM_ASSETS: Record<string, string> = {
  // headers (00000000-0000-0000-0002-00000000000N -> header_N.png)
  "00000000-0000-0000-0002-000000000001": "/system-assets/header_1.png",
  "00000000-0000-0000-0002-000000000002": "/system-assets/header_2.png",
  "00000000-0000-0000-0002-000000000003": "/system-assets/header_3.png",
  "00000000-0000-0000-0002-000000000004": "/system-assets/header_4.png",
  "00000000-0000-0000-0002-000000000005": "/system-assets/header_5.png",
  "00000000-0000-0000-0002-000000000006": "/system-assets/header_6.png",
  "00000000-0000-0000-0002-000000000007": "/system-assets/header_7.png",
  "00000000-0000-0000-0002-000000000008": "/system-assets/header_8.png",
  "00000000-0000-0000-0002-000000000009": "/system-assets/header_9.png",
  // background
  "00000000-0000-0000-0003-000000000001": "/system-assets/background_1.png",
};

// Returns the bundled image path for a system-default asset id, or null.
export function systemAssetImage(id?: string | null): string | null {
  if (!id) return null;
  return SYSTEM_ASSETS[id] ?? null;
}

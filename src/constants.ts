import type {
  DeviceSpec,
  GradientPreset,
  ExportSize,
  PlatformKey,
} from "./types";

export const GITHUB_REPO_URL = "https://github.com/inceptyon-labs/prestige";

export const devices: DeviceSpec[] = [
  {
    id: "iphone-17-pro-max",
    label: "iPhone 17 Pro Max",
    width: 1320,
    height: 2868,
    screenInset: { top: 20, right: 20, bottom: 20, left: 20 },
    cornerRadius: 115,
    frameRadius: { outer: "14%/6.5%", inner: "12.5%/5.8%" },
    notchWidth: 250,
    notchHeight: 70,
    hasIsland: true,
    colors: [
      {
        id: "cosmic-orange",
        label: "Cosmic Orange",
        frame: "#C8612A",
        frameColors: ["#E07A3E", "#C8612A", "#A04E1E", "#C8612A", "#E07A3E"],
        screen: "#000",
      },
      {
        id: "deep-blue",
        label: "Deep Blue",
        frame: "#1F2D4A",
        frameColors: ["#324367", "#1F2D4A", "#141E33", "#1F2D4A", "#324367"],
        screen: "#000",
      },
      {
        id: "silver",
        label: "Silver",
        frame: "#D9D9DB",
        frameColors: ["#EAEAEC", "#D9D9DB", "#BFBFC2", "#D9D9DB", "#EAEAEC"],
        screen: "#000",
      },
      {
        id: "natural-titanium",
        label: "Natural Titanium",
        frame: "#8C8883",
        frameColors: ["#AAA59E", "#8C8883", "#75726D", "#8C8883", "#AAA59E"],
        screen: "#000",
      },
      {
        id: "black-titanium",
        label: "Black Titanium",
        frame: "#282828",
        frameColors: ["#4a4a4a", "#282828", "#1c1c1e", "#282828", "#4a4a4a"],
        screen: "#000",
      },
      {
        id: "white-titanium",
        label: "White Titanium",
        frame: "#E3E3E4",
        frameColors: ["#F2F2F2", "#E3E3E4", "#D1D1D2", "#E3E3E4", "#F2F2F2"],
        screen: "#000",
      },
      {
        id: "gold",
        label: "Gold",
        frame: "#D4B782",
        frameColors: ["#E5CC9D", "#D4B782", "#B89A66", "#D4B782", "#E5CC9D"],
        screen: "#000",
      },
      {
        id: "rose",
        label: "Rose",
        frame: "#D9A7A7",
        frameColors: ["#E8BFBF", "#D9A7A7", "#BF8C8C", "#D9A7A7", "#E8BFBF"],
        screen: "#000",
      },
      {
        id: "midnight-green",
        label: "Midnight Green",
        frame: "#3B5043",
        frameColors: ["#4D6557", "#3B5043", "#293B30", "#3B5043", "#4D6557"],
        screen: "#000",
      },
    ],
  },
  {
    id: "ipad-pro-13",
    label: 'iPad Pro 13" (M4)',
    width: 2064,
    height: 2752,
    screenInset: { top: 40, right: 40, bottom: 40, left: 40 },
    cornerRadius: 55,
    frameRadius: { outer: "3%/2.5%", inner: "2.5%/2%" },
    notchWidth: 0,
    notchHeight: 0,
    hasIsland: false,
    colors: [
      {
        id: "space-black",
        label: "Space Black",
        frame: "#1c1c1e",
        frameColors: ["#2c2c2e", "#1c1c1e", "#0d0d0d", "#1c1c1e", "#2c2c2e"],
        screen: "#000",
      },
      {
        id: "silver",
        label: "Silver",
        frame: "#e0e0e0",
        frameColors: ["#ffffff", "#e0e0e0", "#d1d1d6", "#e0e0e0", "#ffffff"],
        screen: "#000",
      },
      {
        id: "space-gray",
        label: "Space Gray",
        frame: "#4e4e50",
        frameColors: ["#636365", "#4e4e50", "#3a3a3c", "#4e4e50", "#636365"],
        screen: "#000",
      },
      {
        id: "starlight",
        label: "Starlight",
        frame: "#EDE6D6",
        frameColors: ["#F7F1E3", "#EDE6D6", "#D9D1BC", "#EDE6D6", "#F7F1E3"],
        screen: "#000",
      },
      {
        id: "midnight",
        label: "Midnight",
        frame: "#1A1F2B",
        frameColors: ["#2A2F3B", "#1A1F2B", "#10141C", "#1A1F2B", "#2A2F3B"],
        screen: "#000",
      },
    ],
  },
  {
    id: "macbook-pro-16",
    label: 'MacBook Pro 16"',
    width: 2880,
    height: 1800,
    screenInset: { top: 35, right: 30, bottom: 30, left: 30 },
    cornerRadius: 14,
    frameRadius: { outer: "0.6%/1%", inner: "0.4%/0.7%" },
    notchWidth: 230,
    notchHeight: 28,
    hasIsland: false,
    colors: [
      {
        id: "space-black",
        label: "Space Black",
        frame: "#1F1F22",
        frameColors: ["#33333A", "#1F1F22", "#0F0F12", "#1F1F22", "#33333A"],
        screen: "#000",
      },
      {
        id: "silver",
        label: "Silver",
        frame: "#D9D9DB",
        frameColors: ["#EAEAEC", "#D9D9DB", "#BFBFC2", "#D9D9DB", "#EAEAEC"],
        screen: "#000",
      },
      {
        id: "space-gray",
        label: "Space Gray",
        frame: "#4E4E50",
        frameColors: ["#636365", "#4E4E50", "#3A3A3C", "#4E4E50", "#636365"],
        screen: "#000",
      },
      {
        id: "midnight",
        label: "Midnight",
        frame: "#1A1F2B",
        frameColors: ["#2A2F3B", "#1A1F2B", "#10141C", "#1A1F2B", "#2A2F3B"],
        screen: "#000",
      },
      {
        id: "starlight",
        label: "Starlight",
        frame: "#EDE6D6",
        frameColors: ["#F7F1E3", "#EDE6D6", "#D9D1BC", "#EDE6D6", "#F7F1E3"],
        screen: "#000",
      },
    ],
  },
  {
    id: "samsung-galaxy-s25-ultra",
    label: "Samsung Galaxy S25 Ultra",
    width: 1440,
    height: 3120,
    screenInset: { top: 14, right: 14, bottom: 14, left: 14 },
    cornerRadius: 45,
    frameRadius: { outer: "4%/2%", inner: "3.5%/1.8%" },
    notchWidth: 0,
    notchHeight: 0,
    hasIsland: false,
    colors: [
      {
        id: "titanium-silverblue",
        label: "Titanium Silverblue",
        frame: "#A8B5C4",
        frameColors: ["#BFCAD7", "#A8B5C4", "#8E9CAD", "#A8B5C4", "#BFCAD7"],
        screen: "#000",
      },
      {
        id: "titanium-black",
        label: "Titanium Black",
        frame: "#1a1a1a",
        frameColors: ["#2d2d2d", "#1a1a1a", "#0f0f0f", "#1a1a1a", "#2d2d2d"],
        screen: "#000",
      },
      {
        id: "titanium-whitesilver",
        label: "Titanium Whitesilver",
        frame: "#E5E5E7",
        frameColors: ["#F2F2F4", "#E5E5E7", "#CFCFD1", "#E5E5E7", "#F2F2F4"],
        screen: "#000",
      },
      {
        id: "titanium-gray",
        label: "Titanium Gray",
        frame: "#7a7a7a",
        frameColors: ["#8f8f8f", "#7a7a7a", "#656565", "#7a7a7a", "#8f8f8f"],
        screen: "#000",
      },
      {
        id: "titanium-pinkgold",
        label: "Titanium Pink Gold",
        frame: "#D9B6A3",
        frameColors: ["#E8CABA", "#D9B6A3", "#BF9C89", "#D9B6A3", "#E8CABA"],
        screen: "#000",
      },
      {
        id: "titanium-jadegreen",
        label: "Titanium Jade Green",
        frame: "#7AA89A",
        frameColors: ["#92BAAE", "#7AA89A", "#608E80", "#7AA89A", "#92BAAE"],
        screen: "#000",
      },
      {
        id: "titanium-jetblack",
        label: "Titanium Jetblack",
        frame: "#0D0D0F",
        frameColors: ["#252528", "#0D0D0F", "#000000", "#0D0D0F", "#252528"],
        screen: "#000",
      },
    ],
  },
  {
    id: "samsung-galaxy-tab-s10-plus",
    label: "Samsung Galaxy Tab S10+",
    width: 1752,
    height: 2800,
    screenInset: { top: 30, right: 30, bottom: 30, left: 30 },
    cornerRadius: 38,
    frameRadius: { outer: "3%/2%", inner: "2.5%/1.5%" },
    notchWidth: 0,
    notchHeight: 0,
    hasIsland: false,
    colors: [
      {
        id: "moonstone-gray",
        label: "Moonstone Gray",
        frame: "#5C636B",
        frameColors: ["#737A82", "#5C636B", "#444A52", "#5C636B", "#737A82"],
        screen: "#000",
      },
      {
        id: "platinum-silver",
        label: "Platinum Silver",
        frame: "#D9D9DB",
        frameColors: ["#EAEAEC", "#D9D9DB", "#BFBFC2", "#D9D9DB", "#EAEAEC"],
        screen: "#000",
      },
      {
        id: "graphite",
        label: "Graphite",
        frame: "#3c3c3c",
        frameColors: ["#4f4f4f", "#3c3c3c", "#292929", "#3c3c3c", "#4f4f4f"],
        screen: "#000",
      },
      {
        id: "beige",
        label: "Beige",
        frame: "#d9d0c5",
        frameColors: ["#ebe3d9", "#d9d0c5", "#c7beb3", "#d9d0c5", "#ebe3d9"],
        screen: "#000",
      },
    ],
  },
];

export const gradientPresets: GradientPreset[] = [
  { id: "sunset", label: "Sunset", from: "#ff7e5f", to: "#feb47b" },
  { id: "ocean", label: "Ocean", from: "#2b5876", to: "#4e4376" },
  { id: "mint", label: "Mint", from: "#00b09b", to: "#96c93d" },
  { id: "berry", label: "Berry", from: "#e1eec3", to: "#f05053" },
  { id: "royal", label: "Royal", from: "#141E30", to: "#243B55" },
  { id: "rose", label: "Rose", from: "#f4c4f3", to: "#fc67fa" },
];

export const exportSizes: ExportSize[] = [
  {
    id: "iphone-6.9",
    label: 'iPhone 6.9" (1320×2868) — App Store required',
    width: 1320,
    height: 2868,
  },
  {
    id: "ipad-13",
    label: 'iPad 13" (2064×2752) — App Store required',
    width: 2064,
    height: 2752,
  },
  {
    id: "mac",
    label: "Mac (2880×1800) — App Store required",
    width: 2880,
    height: 1800,
  },
  {
    id: "android-phone",
    label: "Android Phone (1080×1920) — Google Play",
    width: 1080,
    height: 1920,
  },
  {
    id: "android-tablet-10",
    label: 'Android Tablet 10" (1600×2560) — Google Play',
    width: 1600,
    height: 2560,
  },
];

/**
 * Maps each platform variant to its flagship device + required export size.
 * Used by "Duplicate as platform" to spin up a sibling project pre-configured
 * for the target app store.
 */
export const PLATFORMS: {
  key: PlatformKey;
  label: string;
  deviceId: string;
  exportSizeId: string;
}[] = [
  {
    key: "ios-phone",
    label: "iPhone",
    deviceId: "iphone-17-pro-max",
    exportSizeId: "iphone-6.9",
  },
  {
    key: "ios-tablet",
    label: "iPad",
    deviceId: "ipad-pro-13",
    exportSizeId: "ipad-13",
  },
  {
    key: "macos",
    label: "Mac",
    deviceId: "macbook-pro-16",
    exportSizeId: "mac",
  },
  {
    key: "android-phone",
    label: "Android Phone",
    deviceId: "samsung-galaxy-s25-ultra",
    exportSizeId: "android-phone",
  },
  {
    key: "android-tablet",
    label: "Android Tablet",
    deviceId: "samsung-galaxy-tab-s10-plus",
    exportSizeId: "android-tablet-10",
  },
];

export const getPlatform = (key: PlatformKey) =>
  PLATFORMS.find((p) => p.key === key) ?? PLATFORMS[0];

/**
 * Best-effort: infer which platform a project is targeting from its current
 * device id. Used when a legacy (un-tagged) project gets cloned — we tag the
 * source with the inferred platform so siblings render correctly in the
 * grouped picker.
 */
export const inferPlatformFromDevice = (
  deviceId: string,
): PlatformKey | undefined =>
  PLATFORMS.find((p) => p.deviceId === deviceId)?.key;

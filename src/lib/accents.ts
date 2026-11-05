/**
 * Colour themes. Each sets the accent (buttons, links, focus), the deep "ink" used for the
 * dashboard banner and dark panels, and the metallic highlight that goes with it. The CSS for
 * them lives in styles.css under "Colour themes" — generated from this list by
 * scripts/accents-css.mjs, so run `npm run accents` after changing a value here.
 */
export type Accent = {
  id: string;
  name: string;
  /** Short description in the picker. */
  note: string;
  light: { accent: string; gold: string; goldSoft: string };
  dark: { accent: string; onAccent: string; gold: string; goldSoft: string };
  /** The dark surfaces: banner gradient (bright → hi → deep → lo). */
  ink: { bright: string; hi: string; deep: string; lo: string };
  /** Highlight on the dark surfaces: text, ring, and the metallic gradient for badges. */
  onInk: { text: string; ring: string; metalHi: string; metalLo: string };
  /** r, g, b of the warm glow and of the cool glow behind the banner. */
  glow: string;
  glow2: string;
};

export const ACCENTS: Accent[] = [
  {
    id: 'emerald',
    name: 'Emerald',
    note: 'Deep green & gold',
    light: { accent: '#0f5c46', gold: '#b8914f', goldSoft: '#e9d4a6' },
    dark: { accent: '#5fbf98', onAccent: '#0b1f18', gold: '#d6b26e', goldSoft: '#6b5630' },
    ink: { bright: '#1b6b54', hi: '#154a3b', deep: '#0e2a21', lo: '#0a1f18' },
    onInk: { text: '#e9cf96', ring: '#d6b26e', metalHi: '#ecd39c', metalLo: '#c79f5a' },
    glow: '214, 178, 110',
    glow2: '47, 160, 120',
  },
  {
    id: 'sapphire',
    name: 'Sapphire',
    note: 'Navy & champagne',
    light: { accent: '#1f4e8c', gold: '#a8875a', goldSoft: '#e4d6bb' },
    dark: { accent: '#86aeea', onAccent: '#0b1730', gold: '#d8bd8c', goldSoft: '#5e5038' },
    ink: { bright: '#24538f', hi: '#1b3d6e', deep: '#112647', lo: '#0a1830' },
    onInk: { text: '#ecdcb6', ring: '#d8bd8c', metalHi: '#efe0bd', metalLo: '#c4a676' },
    glow: '216, 189, 140',
    glow2: '76, 128, 214',
  },
  {
    id: 'plum',
    name: 'Plum',
    note: 'Aubergine & rose gold',
    light: { accent: '#6b3d7c', gold: '#b27a68', goldSoft: '#ecd2c8' },
    dark: { accent: '#c9a0dc', onAccent: '#22112a', gold: '#e2ac9a', goldSoft: '#5f3f37' },
    ink: { bright: '#6a3d7a', hi: '#4b2a5a', deep: '#2e1838', lo: '#1d0f24' },
    onInk: { text: '#f1cbbd', ring: '#e2ac9a', metalHi: '#f3d3c6', metalLo: '#c98d79' },
    glow: '226, 172, 154',
    glow2: '160, 96, 190',
  },
  {
    id: 'garnet',
    name: 'Garnet',
    note: 'Burgundy & gold',
    light: { accent: '#8a2e40', gold: '#b48e55', goldSoft: '#ebd8b4' },
    dark: { accent: '#e8929f', onAccent: '#2a0c13', gold: '#dcbc80', goldSoft: '#5f4c2e' },
    ink: { bright: '#7d2a3b', hi: '#5c1f2c', deep: '#3a121c', lo: '#260b12' },
    onInk: { text: '#eed6a6', ring: '#dcbc80', metalHi: '#efd9a6', metalLo: '#c49b5c' },
    glow: '220, 188, 128',
    glow2: '196, 70, 96',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    note: 'Deep teal & sand',
    light: { accent: '#135f6d', gold: '#b08a57', goldSoft: '#e8d5b6' },
    dark: { accent: '#6cc3cf', onAccent: '#06222a', gold: '#dcb57e', goldSoft: '#5d4a30' },
    ink: { bright: '#176a78', hi: '#114d58', deep: '#0a2f37', lo: '#061f25' },
    onInk: { text: '#eed5ab', ring: '#dcb57e', metalHi: '#f0d8ae', metalLo: '#c49866' },
    glow: '220, 181, 126',
    glow2: '48, 160, 178',
  },
  {
    id: 'graphite',
    name: 'Graphite',
    note: 'Charcoal & champagne',
    light: { accent: '#2f3944', gold: '#a8905e', goldSoft: '#e4d9c0' },
    dark: { accent: '#c3ccd5', onAccent: '#14181d', gold: '#d6c08e', goldSoft: '#58503a' },
    ink: { bright: '#3b4550', hi: '#2a323b', deep: '#191e24', lo: '#0f1216' },
    onInk: { text: '#e8dab4', ring: '#d6c08e', metalHi: '#ece0bd', metalLo: '#bea472' },
    glow: '214, 192, 142',
    glow2: '120, 138, 156',
  },
];

export const DEFAULT_ACCENT = 'emerald';
export const findAccent = (id: string | null | undefined) => ACCENTS.find((a) => a.id === id) ?? ACCENTS[0];

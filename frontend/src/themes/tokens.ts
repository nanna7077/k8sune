import { 
  createDarkTheme, 
  type BrandVariants, 
  type Theme 
} from "@fluentui/react-components";

export const ACCENT_OPTIONS = [
  { id: 'indigo', label: 'Indigo', color: '#aebdff' },
  { id: 'violet', label: 'Violet', color: '#d0b4ff' },
  { id: 'rose', label: 'Rose', color: '#ffb4cf' },
  { id: 'amber', label: 'Amber', color: '#ffc984' },
  { id: 'mint', label: 'Mint', color: '#8de3c0' },
] as const;

export type AccentId = typeof ACCENT_OPTIONS[number]['id'];
export const DEFAULT_ACCENT: AccentId = 'indigo';

const mix = (from: string, to: string, amount: number) => {
  const parse = (color: string) => [1, 3, 5].map(index => Number.parseInt(color.slice(index, index + 2), 16));
  const [r1, g1, b1] = parse(from);
  const [r2, g2, b2] = parse(to);
  const channel = (start: number, end: number) => Math.round(start + (end - start) * amount).toString(16).padStart(2, '0');
  return `#${channel(r1, r2)}${channel(g1, g2)}${channel(b1, b2)}`;
};

const getAccentColor = (accent: AccentId) => ACCENT_OPTIONS.find(option => option.id === accent)?.color ?? ACCENT_OPTIONS[0].color;

const createBrand = (accent: AccentId): BrandVariants => {
  const color = getAccentColor(accent);
  const shades = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160] as const;
  return Object.fromEntries(shades.map((shade, index) => [shade, mix('#08090d', color, 0.08 + index * 0.056)])) as BrandVariants;
};

export const getK8suneTheme = (accent: AccentId = DEFAULT_ACCENT): Theme => ({
  ...createDarkTheme(createBrand(accent)),
  colorNeutralBackground1: "#0b0c10",
  colorNeutralBackground2: "#12141b",
  colorNeutralBackground3: "#1b1e28",
  colorNeutralBackground4: "#252a38",
  
  colorNeutralStroke1: "#2a2e3a",
  colorNeutralStroke2: "#1a1d26",
  
  colorBrandForeground1: getAccentColor(accent),
  colorBrandForeground2: mix('#0b0c10', getAccentColor(accent), 0.84),
  
  borderRadiusMedium: "8px",
  borderRadiusLarge: "14px",
});

export const k8suneTheme = getK8suneTheme();

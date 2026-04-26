import { 
  createDarkTheme, 
  type BrandVariants, 
  type Theme 
} from "@fluentui/react-components";

// Sophisticated pink-tinted slate/zinc palette
const k8suneBrand: BrandVariants = {
  10: "#020203",
  20: "#111114",
  30: "#1b1b1f",
  40: "#232329",
  50: "#2c2c33",
  60: "#36363f",
  70: "#40404b",
  80: "#4b4b58",
  90: "#565665",
  100: "#626273",
  110: "#6e6e81",
  120: "#7b7b90",
  130: "#88889f",
  140: "#9696af",
  150: "#a4a4bf",
  160: "#ffb6c1" // Accent pink
};

export const k8suneTheme: Theme = {
  ...createDarkTheme(k8suneBrand),
  colorNeutralBackground1: "#09090b", // Shadcn zinc-950
  colorNeutralBackground2: "#18181b", // Shadcn zinc-900
  colorNeutralBackground3: "#27272a", // Shadcn zinc-800
  colorNeutralBackground4: "#3f3f46", // Shadcn zinc-700
  
  colorNeutralStroke1: "#27272a", // Border color
  colorNeutralStroke2: "#18181b",
  
  colorBrandForeground1: "#ffb6c1",
  colorBrandForeground2: "#ffa6b3",
  
  borderRadiusMedium: "6px",
  borderRadiusLarge: "8px",
};

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        pond: {
          DEFAULT: "hsl(var(--pond-teal))",
          light: "hsl(var(--pond-teal-light))",
        },
        amber: {
          DEFAULT: "hsl(var(--sunset-amber))",
        },
        pine: {
          DEFAULT: "hsl(var(--pine-green))",
        },
        mist: {
          DEFAULT: "hsl(var(--mist))",
        },
        venterra: {
          navy: "#15284B",
          "san-marino": "#3D66B9",
          bay: "#294782",
          indigo: "#5A81CF",
          "monte-carlo": "#7DCAC2",
          pink: "#E02472",
          "white-smoke": "#F6F6F5",
          "terra-cotta": "#BD4830",
          "quill-gray": "#D6D6D2",
          "blue-chill": "#3B9189",
          delta: "#9B9B96",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
};

export default config;

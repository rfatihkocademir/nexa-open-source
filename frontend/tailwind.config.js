/** @type {import('tailwindcss').Config} */
export default {
	darkMode: ["class"],
	content: [
		"./index.html",
		"./src/**/*.{js,ts,jsx,tsx}",
	],
	theme: {
		screens: {
			'sm': '640px',
			'md': '768px',
			'lg': '1024px',
			'xl': '1280px',
			'2xl': '1836px',
			'3xl': '1920px',
		},
		extend: {
				fontFamily: {
					sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
					heading: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
					mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
				},
			boxShadow: {
				'sm': 'var(--shadow-sm)',
				'md': 'var(--shadow-md)',
				'lg': 'var(--shadow-lg)',
				'xl': 'var(--shadow-xl)',
				'premium': 'var(--shadow-premium)',
			},
			borderRadius: {
				'2xl': 'var(--radius-panel)',
				xl: 'var(--radius-panel)',
				lg: 'var(--radius-panel)',
				md: 'var(--radius-card)',
				sm: 'var(--radius-control)'
			},
			colors: {
				background: 'var(--background)',
				foreground: 'var(--foreground)',
				header: {
					DEFAULT: 'var(--header)',
					foreground: 'var(--header-foreground)',
					border: 'var(--header-border)',
				},
				card: {
					DEFAULT: 'var(--card)',
					foreground: 'var(--card-foreground)'
				},
				popover: {
					DEFAULT: 'var(--popover)',
					foreground: 'var(--popover-foreground)'
				},
				primary: {
					DEFAULT: 'var(--primary)',
					foreground: 'var(--primary-foreground)'
				},
				secondary: {
					DEFAULT: 'var(--secondary)',
					foreground: 'var(--secondary-foreground)'
				},
				muted: {
					DEFAULT: 'var(--muted)',
					foreground: 'var(--muted-foreground)'
				},
				accent: {
					DEFAULT: 'var(--accent)',
					foreground: 'var(--accent-foreground)'
				},
				destructive: {
					DEFAULT: 'var(--destructive)',
					foreground: 'var(--destructive-foreground)'
				},
				success: {
					DEFAULT: 'var(--success)',
					foreground: 'var(--success-foreground)'
				},
				error: {
					DEFAULT: 'var(--error)',
					foreground: 'var(--error-foreground)'
				},
				warning: {
					DEFAULT: 'var(--warning)',
					foreground: 'var(--warning-foreground)'
				},
				info: {
					DEFAULT: 'var(--info)',
					foreground: 'var(--info-foreground)'
				},
				border: 'var(--border)',
				input: 'var(--input)',
				ring: 'var(--ring)',
				chart: {
					'1': 'var(--chart-1)',
					'2': 'var(--chart-2)',
					'3': 'var(--chart-3)',
					'4': 'var(--chart-4)',
					'5': 'var(--chart-5)'
				},
				sidebar: {
					DEFAULT: 'var(--sidebar-background)',
					foreground: 'var(--sidebar-foreground)',
					primary: 'var(--sidebar-primary)',
					'primary-foreground': 'var(--sidebar-primary-foreground)',
					accent: 'var(--sidebar-accent)',
					'accent-foreground': 'var(--sidebar-accent-foreground)',
					border: 'var(--sidebar-border)',
					ring: 'var(--sidebar-ring)'
				}
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
}

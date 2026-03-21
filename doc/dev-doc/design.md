# Spendline — Design System

Single source of truth for all UI decisions. Every component, page, and element follows this guide exactly.

---

## Brand

### Logo
- Wordmark: `$pendline` — `$` always in `#2ECC8A`, `pendline` in white
- Icon: green rounded square with white `$` symbol (see favicon)
- BETA badge: 10px uppercase, green border `#2ECC8A33`, green text `#2ECC8A`, transparent fill
- Never stretch, recolor, or rearrange the logo
- Minimum wordmark height: 18px

### Tagline
`LLM COST MONITORING` — always uppercase, letter-spacing 0.15em, color `#8b949e`

---

## Color Palette

```
/* Backgrounds */
--bg-primary:      #0d1117    page background
--bg-secondary:    #161b22    cards, sidebar, modals
--bg-tertiary:     #21262d    inputs, hover states, table rows on hover
--bg-overlay:      #0d1117CC  modal backdrop (80% opacity)

/* Borders */
--border-default:  #30363d    standard borders
--border-subtle:   #21262d    dividers, inner borders

/* Brand */
--green:           #2ECC8A    primary accent — CTAs, active states, highlights
--green-hover:     #25a870    green hover state
--green-muted:     #2ECC8A1A  10% green tint background

/* Text */
--text-primary:    #e6edf3    headings, values, important text
--text-secondary:  #8b949e    labels, secondary info, placeholders when focused
--text-muted:      #484f58    placeholders, disabled states

/* Semantic */
--success:         #2ECC8A
--warning:         #d29922
--error:           #f85149
--info:            #58a6ff

/* Cost color coding */
--cost-low:        #2ECC8A    < $0.01
--cost-medium:     #d29922    $0.01 – $0.10
--cost-high:       #f85149    > $0.10

/* Latency color coding */
--latency-fast:    #2ECC8A    < 1000ms
--latency-medium:  #d29922    1000ms – 3000ms
--latency-slow:    #f85149    > 3000ms
```

---

## Typography

### Fonts
Load both from Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

- **UI & Headings:** `Syne` — weights 400, 500, 700, 800
- **Code & Monospace:** `JetBrains Mono` — weights 400, 500
- **Fallback:** `system-ui, -apple-system, sans-serif`

### Type Scale
```
Display:  64px / Syne 800 / line-height 1.0  / letter-spacing -2px   (landing headline only)
H1:       40px / Syne 700 / line-height 1.1  / letter-spacing -1px
H2:       28px / Syne 700 / line-height 1.2  / letter-spacing -0.5px
H3:       20px / Syne 600 / line-height 1.3
H4:       16px / Syne 600 / line-height 1.4
Body:     15px / Syne 400 / line-height 1.7
Small:    13px / Syne 400 / line-height 1.5
Micro:    11px / Syne 500 / line-height 1.4  / letter-spacing 0.05em  (badges, labels)
Code:     14px / JetBrains Mono 400 / line-height 1.7
Code sm:  13px / JetBrains Mono 400
```

---

## Spacing

Base unit: 4px. Use multiples only. Never odd pixel values.

```
4px   xs
8px   sm
12px  sm+
16px  md
24px  lg
32px  xl
48px  2xl
64px  3xl
```

---

## Border Radius

```
4px     badges, small chips, table cells
8px     buttons, inputs, small cards
12px    cards, panels
16px    large cards, modals
9999px  toggle switches, pill badges
```

---

## Components

### Buttons

**Primary (CTA)**
```css
background: #2ECC8A;
color: #0d1117;           /* dark text on green — never white */
font: Syne 500 14px;
height: 40px;
padding: 0 20px;
border-radius: 8px;
border: none;
cursor: pointer;
transition: background 200ms ease;

&:hover { background: #25a870; }
&:active { transform: scale(0.98); }
```

**Secondary**
```css
background: #21262d;
color: #e6edf3;
border: 1px solid #30363d;
height: 40px;
padding: 0 20px;
border-radius: 8px;

&:hover { background: #30363d; }
```

**Ghost**
```css
background: transparent;
color: #8b949e;
border: none;
height: 40px;
padding: 0 16px;

&:hover { color: #e6edf3; }
```

**Danger**
```css
background: transparent;
color: #f85149;
border: 1px solid #f8514933;
height: 40px;
padding: 0 20px;
border-radius: 8px;

&:hover { background: #f8514915; }
```

### Inputs

```css
background: #0d1117;
border: 1px solid #30363d;
border-radius: 8px;
height: 40px;
padding: 0 12px;
font: Syne 400 14px;
color: #e6edf3;
outline: none;
transition: border-color 200ms ease;
width: 100%;

&::placeholder { color: #484f58; }
&:focus { border-color: #2ECC8A; }
```

### Cards

```css
background: #161b22;
border: 1px solid #21262d;
border-radius: 12px;
padding: 24px;
```

### Stat Cards

```
background: #161b22
border: 1px solid #21262d
border-radius: 12px
padding: 20px 24px

Value:        32px Syne 700 #e6edf3
Label:        13px Syne 400 #8b949e, margin-top 4px
Change badge: 12px Syne 500, padding 2px 8px, border-radius 4px
  - Positive change (spend up): background #f851491A, color #f85149
  - Negative change (spend down): background #2ECC8A1A, color #2ECC8A
  (lower spend = good, hence green for negative)
```

### Tables

```css
/* Header row */
background: #0d1117;
border-bottom: 1px solid #21262d;
color: #8b949e;
font: Syne 500 12px;
text-transform: uppercase;
letter-spacing: 0.05em;
padding: 12px 16px;

/* Data rows */
background: transparent;
border-bottom: 1px solid #21262d;
color: #e6edf3;
font: Syne 400 14px;
padding: 12px 16px;
transition: background 150ms ease;

/* Row hover */
&:hover { background: #161b22; }

/* Monospace cells (cost, latency, tokens, IDs) */
font: JetBrains Mono 400 13px;

/* Expanded row */
background: #0d1117;
padding: 16px;
border-bottom: 1px solid #21262d;
```

### Code Blocks

```css
background: #0d1117;
border: 1px solid #21262d;
border-radius: 8px;
padding: 16px 20px;
font: JetBrains Mono 400 13px;
line-height: 1.7;
overflow-x: auto;

/* Syntax highlighting */
.keyword   { color: #ff7b72; }   /* import, from, def */
.string    { color: #a5d6ff; }   /* "strings" */
.function  { color: #d2a8ff; }   /* function names */
.number    { color: #f0883e; }   /* numbers */
.comment   { color: #8b949e; }   /* # comments */
.brand     { color: #2ECC8A; }   /* track, spendline tokens */
.model     { color: #2ECC8A; }   /* model names */
```

### Sidebar Navigation

```css
/* Container */
width: 240px;
background: #0d1117;
border-right: 1px solid #21262d;
height: 100vh;
position: fixed;
left: 0; top: 0;
display: flex;
flex-direction: column;

/* Nav item */
height: 40px;
padding: 0 16px;
display: flex;
align-items: center;
gap: 10px;
font: Syne 500 14px;
color: #8b949e;
border-radius: 0;
cursor: pointer;
transition: all 150ms ease;
border-left: 2px solid transparent;

/* Hover */
&:hover {
  background: #161b22;
  color: #e6edf3;
}

/* Active */
&.active {
  border-left: 2px solid #2ECC8A;
  color: #2ECC8A;
  background: #2ECC8A0D;
}

/* Icon */
width: 18px; height: 18px;
stroke-width: 1.5;
flex-shrink: 0;
```

### Badges / Tags

```css
/* Default */
background: #21262d; color: #8b949e;

/* Success */
background: #2ECC8A1A; color: #2ECC8A;

/* Warning */
background: #d299221A; color: #d29922;

/* Error */
background: #f851491A; color: #f85149;

/* Info */
background: #58a6ff1A; color: #58a6ff;

/* Shared */
font: Syne 500 11px;
text-transform: uppercase;
letter-spacing: 0.05em;
padding: 2px 8px;
border-radius: 4px;
white-space: nowrap;
```

### Toast Notifications

```css
position: fixed;
bottom: 24px; right: 24px;
z-index: 9999;
width: 320px;
background: #161b22;
border: 1px solid #30363d;
border-radius: 10px;
padding: 14px 16px;
font: Syne 400 14px;
color: #e6edf3;
display: flex;
align-items: center;
gap: 10px;

/* Left accent */
border-left: 3px solid var(--accent); /* green/red/blue */

/* Animation */
animation: slideIn 200ms ease;
@keyframes slideIn {
  from { transform: translateX(120%); opacity: 0; }
  to   { transform: translateX(0);    opacity: 1; }
}
/* Auto-dismiss: 4000ms */
```

### Modal

```css
/* Backdrop */
position: fixed; inset: 0;
background: #0d1117CC;
z-index: 1000;
display: flex;
align-items: center;
justify-content: center;

/* Panel */
background: #161b22;
border: 1px solid #30363d;
border-radius: 16px;
padding: 32px;
width: 480px;
max-width: calc(100vw - 48px);

/* Animation */
animation: modalIn 200ms ease;
@keyframes modalIn {
  from { transform: scale(0.96); opacity: 0; }
  to   { transform: scale(1);    opacity: 1; }
}
```

### Progress Bar

```css
/* Track */
background: #21262d;
height: 6px;
border-radius: 3px;
overflow: hidden;

/* Fill */
background: #2ECC8A;
height: 100%;
border-radius: 3px;
transition: width 300ms ease;

/* At 80%+ */
&.warning { background: #d29922; }

/* At 100%+ */
&.danger  { background: #f85149; }
```

### Toggle Switch

```css
/* Track */
width: 32px; height: 18px;
border-radius: 9px;
background: #30363d;
position: relative;
cursor: pointer;
transition: background 200ms ease;

&.on { background: #2ECC8A; }

/* Thumb */
width: 14px; height: 14px;
border-radius: 50%;
background: #fff;
position: absolute;
top: 2px; left: 2px;
transition: transform 200ms ease;

.on & { transform: translateX(14px); }
```

### Skeleton Loading

```css
background: linear-gradient(
  90deg,
  #161b22 25%,
  #21262d 50%,
  #161b22 75%
);
background-size: 200% 100%;
animation: shimmer 1.5s ease-in-out infinite;
border-radius: 4px;

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## Charts (Recharts)

### Spend Area Chart

```
Line color:       #2ECC8A, strokeWidth 2
Area fill:        linearGradient #2ECC8A 30% opacity top → 0% bottom
Grid lines:       horizontal only, stroke #21262d, strokeDasharray "3 3"
X axis:           JetBrains Mono 12px, fill #484f58, no axis line
Y axis:           JetBrains Mono 12px, fill #484f58, tickFormatter: "$X"
Tooltip:          background #161b22, border #30363d, radius 8px
Tooltip label:    Syne 500 13px #e6edf3
Active dot:       fill #2ECC8A, r 4, strokeWidth 0
CartesianGrid:    vertical false
```

### Model Bar Chart

```
Bar radius:       [4, 4, 0, 0] (top corners only)
Bar max width:    40px
Grid lines:       horizontal only, same as above
Y axis:           "$X" formatter
Legend:           bottom, Syne 400 12px
```

### Model Color Map
Use consistently across all charts and tables:

```typescript
export const MODEL_COLORS: Record<string, string> = {
  'claude-opus-4-6':           '#d2a8ff',
  'claude-sonnet-4-6':         '#bc8cff',
  'claude-haiku-4-5':          '#8957e5',
  'claude-3-5-sonnet-20241022':'#a78bfa',
  'claude-3-5-haiku-20241022': '#7c3aed',
  'gpt-5.2':                   '#60a5fa',
  'gpt-5-mini':                '#3b82f6',
  'gpt-5-nano':                '#1d4ed8',
  'gpt-4o':                    '#93c5fd',
  'gpt-4o-mini':               '#bfdbfe',
  'gpt-4.1':                   '#38bdf8',
  'gpt-4.1-mini':              '#7dd3fc',
  'o3':                        '#0ea5e9',
  'o4-mini':                   '#0284c7',
  'gemini-3-1-pro-preview':    '#4ade80',
  'gemini-2-5-pro':            '#86efac',
  'gemini-2-5-flash':          '#bbf7d0',
  'deepseek-chat':             '#fb923c',
  'deepseek-reasoner':         '#f97316',
  'unknown':                   '#484f58',
}
```

---

## Page Layouts

### Landing Page
```
max-width: 1200px, margin: 0 auto, padding: 0 48px
Grid: two columns — 1fr + 440px, gap: 60px
Nav: flex space-between, padding: 28px 48px
Breakpoint 768px: single column, auth card full width, stacks below hero
```

### Dashboard Shell
```
Sidebar: 240px fixed left
Content: margin-left 240px, padding 32px, max-width none
Top bar: height 60px, border-bottom #21262d, flex space-between
Content inner: max-width 1200px, margin 0 auto
```

### Stat Cards Grid
```
grid-template-columns: repeat(4, 1fr)  (desktop)
repeat(2, 1fr)                          (tablet <1024px)
1fr                                     (mobile <768px)
gap: 16px
```

### Background Pattern (landing page only)
```css
background-image:
  linear-gradient(rgba(46,204,138,0.03) 1px, transparent 1px),
  linear-gradient(90deg, rgba(46,204,138,0.03) 1px, transparent 1px);
background-size: 48px 48px;
```

---

## Icons

Use **Lucide React** exclusively.
- Default size: 18px
- Table cells: 16px
- Navigation: 18px
- Stroke width: 1.5px always
- Never use filled icon variants

Key icons:
```
LayoutDashboard   Overview nav
List              Request Log nav
Bell              Alerts nav
Key               API Keys nav
Settings          Settings nav
Copy              Copy to clipboard
Check             Success / copied confirmation
AlertTriangle     Warning states
XCircle           Error states
TrendingUp        Positive metric change
TrendingDown      Negative metric change
Github            GitHub OAuth button
ChevronDown       Dropdown selectors
ExternalLink      External links (docs)
Trash2            Delete / revoke actions
Eye / EyeOff      Show / hide API key
Download          CSV export
RefreshCw         Retry / refresh
User              User avatar placeholder
Zap               Speed / latency indicator
DollarSign        Cost indicator
```

---

## Motion

All transitions: `200ms ease`. No exceptions. No bounces. No spring physics.

```
Button hover:         background-color 200ms ease
Button active:        scale(0.98) — instant
Input focus:          border-color 200ms ease
Nav item hover:       background, color 150ms ease
Toast entry:          translateX 200ms ease
Modal entry:          scale + opacity 200ms ease
Skeleton:             background-position 1.5s ease-in-out infinite
Progress bar fill:    width 300ms ease
Toggle switch:        background, transform 200ms ease
Tab switch:           opacity 150ms ease
Sidebar collapse:     translateX(-240px) 250ms ease
SWR revalidation:     no animation — data updates silently
```

---

## Responsive Breakpoints

```
mobile:   < 768px
tablet:   768px – 1024px
desktop:  > 1024px
```

Mobile behaviour:
- Sidebar: slide-out drawer triggered by hamburger (☰) in top bar
- Stat cards: 1 column
- Tables: horizontally scrollable, min-width 600px
- Code blocks: horizontally scrollable
- Auth card: full width, stacks below hero text
- Modal: full width with 16px side margins

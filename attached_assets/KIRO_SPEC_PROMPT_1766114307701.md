# Cronkite: AI-Powered RSS Reader — Frontend Design Spec

## Paste this into Kiro's Spec mode to generate requirements → design → tasks

---

## Project Overview

Build the **frontend UI** for "Cronkite" — a visually stunning, modern RSS reader application. This spec focuses on **design and UI implementation only** (no backend, no database, use mock data).

**Name**: Cronkite (after Walter Cronkite, "the most trusted man in America")
**Tagline**: "And that's the way it is"

---

## 🎨 DESIGN REQUIREMENTS (Critical — Read First)

### Design Philosophy
This must be a **premium, modern application** — NOT a generic Bootstrap/Material UI look. 

**Reference aesthetics**: Pinterest, Medium, Linear, Notion, Vercel Dashboard

### Typography
| Element | Font | Weight | Size |
|---------|------|--------|------|
| Headlines | Inter Display or Satoshi | 600-700 | 24-32px |
| Body text | Inter | 400-500 | 14-16px |
| Article content | Source Serif Pro | 400 | 18px, line-height 1.7 |
| Metadata/timestamps | JetBrains Mono | 400 | 12-13px |

### Color Palette

**Light Mode:**
```
Background:        #FAFAF9 (warm off-white)
Card surface:      #FFFFFF with subtle shadow
Card hover:        #F5F5F4
Primary accent:    #4F46E5 (deep indigo)
Secondary accent:  #F97316 (warm coral)
Text primary:      #18181B (near-black)
Text secondary:    #3F3F46 (dark gray)
Text muted:        #71717A
Borders:           #E4E4E7
```

**Dark Mode:**
```
Background:        #09090B (rich dark)
Card surface:      #18181B
Card hover:        #27272A
Primary accent:    #818CF8 (bright indigo)
Secondary accent:  #FB923C (light coral)
Text primary:      #FAFAFA (off-white)
Text secondary:    #A1A1AA
Borders:           #27272A
```

### UI Characteristics
- **Generous whitespace** — Let content breathe (p-4, p-6, gap-4, gap-6)
- **Subtle shadows** — Layered depth (shadow-sm, shadow-md)
- **Rounded corners** — Modern feel (rounded-lg, rounded-xl, rounded-2xl)
- **Smooth transitions** — 200-300ms ease-out on all interactions
- **Skeleton loaders** — Elegant pulsing placeholders, NOT spinners
- **Micro-interactions** — Hover lifts, focus rings, button presses

### What NOT To Do
- ❌ No harsh 1px borders everywhere
- ❌ No boxy, cramped layouts
- ❌ No default system fonts
- ❌ No jarring instant transitions
- ❌ No generic card styles
- ❌ No spinners (use skeletons)

---

## Core Feature: MASONRY LAYOUT

The **only** article view is a **masonry grid layout** (Pinterest-style).

### What is Masonry?
A grid where items of **variable heights** stack in columns, filling vertical space efficiently like stones in a wall. Each column fills independently — items don't align horizontally into rows.

```
┌─────────┬─────────┬─────────┬─────────┐
│ LARGE   │ Medium  │ Small   │ Medium  │
│ Card    ├─────────┤ Card    ├─────────┤
│ (tall)  │ Small   ├─────────┤ LARGE   │
├─────────┤ Card    │ Medium  │ Card    │
│ Medium  ├─────────┤ Card    │ (tall)  │
│ Card    │ Medium  ├─────────┼─────────┤
├─────────┤ Card    │ Small   │ Small   │
│ Small   ├─────────┤ Card    │ Card    │
└─────────┴─────────┴─────────┴─────────┘
```

### Implementation Approach
Use **CSS Columns** for simplicity:
```css
.masonry-grid {
  column-count: 4;        /* 4 columns on desktop */
  column-gap: 1.5rem;     /* 24px gap */
}

.masonry-card {
  break-inside: avoid;    /* Prevent card splitting */
  margin-bottom: 1.5rem;
}

/* Responsive */
@media (max-width: 1024px) { column-count: 3; }
@media (max-width: 768px)  { column-count: 2; }
@media (max-width: 480px)  { column-count: 1; }
```

Alternative: `react-masonry-css` library or CSS Grid with `grid-template-rows: masonry` (experimental).

### Card Sizes (Based on Relevancy Score)

Cards have **three sizes** determined by a relevancy score (0-100):

| Score | Size | Visual Treatment |
|-------|------|------------------|
| 80-100 | **LARGE** | Hero image (16:9), full title, full excerpt (3-4 lines), source + timestamp, prominent |
| 50-79 | **MEDIUM** | Thumbnail (optional), full title, truncated excerpt (2 lines), source + timestamp |
| 0-49 | **SMALL** | No image, title only (2 lines max), source + timestamp, compact |

### Relevancy Score Definition
For mock data, assign scores. In production, calculated from:
- **Recency** (40%): 2hrs = 40pts, 24hrs = 20pts, older = 5pts
- **Source Priority** (25%): High = 25pts, Medium = 15pts, Low = 5pts
- **Engagement** (20%): Based on user's starring patterns
- **AI Interest** (15%): Based on reading history similarity

---

## UI Components

### 1. App Shell / Layout

```
┌────────────────────────────────────────────────────────────────┐
│ HEADER                                                          │
│ ┌──────────┐  ┌─────────────────────────────┐  ┌────┐ ┌─────┐ │
│ │ Logo     │  │ 🔍 Search articles...       │  │ ⚙️ │ │ 👤  │ │
│ └──────────┘  └─────────────────────────────┘  └────┘ └─────┘ │
├────────────────────────────────────────────────────────────────┤
│ SIDEBAR (collapsible)    │  MAIN CONTENT                       │
│ ┌──────────────────────┐ │  ┌────────────────────────────────┐ │
│ │ + Add Feed           │ │  │  Filter: All | Unread | ★      │ │
│ ├──────────────────────┤ │  ├────────────────────────────────┤ │
│ │ All Articles    (42) │ │  │                                │ │
│ │ Unread          (12) │ │  │    MASONRY GRID OF CARDS       │ │
│ │ ★ Starred        (5) │ │  │                                │ │
│ ├──────────────────────┤ │  │  ┌─────┐ ┌───┐ ┌─────┐ ┌───┐  │ │
│ │ 📁 Tech              │ │  │  │     │ │   │ │     │ │   │  │ │
│ │   • TechCrunch  (8)  │ │  │  │ LG  │ │ S │ │ MD  │ │ S │  │ │
│ │   • Ars Tech    (4)  │ │  │  │     │ ├───┤ ├─────┤ ├───┤  │ │
│ │   • Verge       (6)  │ │  │  ├─────┤ │   │ │     │ │   │  │ │
│ │ 📁 News              │ │  │  │ MD  │ │MD │ │ LG  │ │MD │  │ │
│ │   • BBC         (3)  │ │  │  │     │ │   │ │     │ │   │  │ │
│ │   • NPR         (2)  │ │  │  └─────┘ └───┘ └─────┘ └───┘  │ │
│ └──────────────────────┘ │  └────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

### 2. Article Cards (3 Variants)

#### LARGE Card (score 80-100)
```
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │         HERO IMAGE (16:9)           │ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Article Title Goes Here and Can        │
│ Span Multiple Lines If Needed          │
│                                         │
│ Full excerpt text that provides more   │
│ context about the article. This can    │
│ be 3-4 lines of text to give users     │
│ enough information to decide...        │
│                                         │
│ 🔵 TechCrunch  •  2 hours ago     ★ ○  │
└─────────────────────────────────────────┘
```

#### MEDIUM Card (score 50-79)
```
┌─────────────────────────────┐
│ ┌─────┐                     │
│ │ IMG │ Article Title Here  │
│ │64x64│ Can Be Two Lines    │
│ └─────┘                     │
│                             │
│ Brief excerpt text that     │
│ spans about two lines...    │
│                             │
│ 🟢 BBC  •  5h ago      ★ ○  │
└─────────────────────────────┘
```

#### SMALL Card (score 0-49)
```
┌─────────────────────────────┐
│ Article Title Here Max Two  │
│ Lines Then Truncate...      │
│                             │
│ 🟡 NPR  •  1d ago      ★ ○  │
└─────────────────────────────┘
```

### 3. Card Interactions

| State | Visual Change |
|-------|---------------|
| Default | White/dark surface, subtle shadow |
| Hover | Lift up (translateY -2px), stronger shadow, slight scale (1.01) |
| Read | Reduced opacity (0.7), muted colors |
| Starred | Gold star icon filled |
| Focus | Indigo ring (ring-2 ring-indigo-500) |

### 4. Article Detail (Slide-over Panel)

When user clicks a card, a **slide-over panel** opens from the right:

```
┌──────────────────────────────────────────┐
│ ← Back                              ✕    │
├──────────────────────────────────────────┤
│                                          │
│ Article Title That Can Be                │
│ Quite Long and Engaging                  │
│                                          │
│ 🔵 TechCrunch  •  By Author Name         │
│ December 18, 2025  •  8 min read         │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ ★ Star    📋 Copy Link    🔗 Open   │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ ✨ AI Summary                    ▼   │ │
│ │                                      │ │
│ │ • Key point one from the article    │ │
│ │ • Second important takeaway         │ │
│ │ • Third insight or finding          │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ Article body content with beautiful     │
│ typography. Uses Source Serif Pro at    │
│ 18px with generous line-height...       │
│                                          │
│ Paragraphs have good spacing between    │
│ them for easy reading...                │
│                                          │
└──────────────────────────────────────────┘
```

### 5. Sidebar

- **Collapsible** on desktop (icon-only mode)
- **Hidden by default** on mobile (hamburger menu)
- **Sections**: Quick filters, Folders (expandable), Feeds with unread counts
- **Feed items** show colored dot (favicon color) + name + unread badge

### 6. Header

- Logo (left)
- Search bar (center, expandable)
- Settings icon
- User avatar/menu (right)
- Dark mode toggle

### 7. Onboarding Wizard (Multi-step Modal)

**Step 1: Welcome**
- Animated illustration
- "Welcome to Cronkite"
- "Let's personalize your feed"
- [Get Started] button

**Step 2: Interest Selection**
- Grid of category cards (3-4 columns)
- Categories: Tech, News, Gaming, Science, Business, Sports, Music, Movies, Food, Travel, Programming, Design, etc.
- Multi-select with checkmarks
- "Select at least 3 topics"

**Step 3: Region (Optional)**
- "Add local news?"
- Country dropdown
- [Skip] option

**Step 4: Feed Preview**
- List of recommended feeds based on selections
- Toggleable checkboxes
- Feed name + description + "~X articles/day"

**Step 5: Done**
- "You're all set!"
- Summary of selections
- [Start Reading] button

---

## Tech Stack

- **Framework**: Next.js 14+ (App Router) or Vite + React
- **Language**: TypeScript (strict mode)
- **Styling**: TailwindCSS
- **Components**: shadcn/ui (customize the theme!)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Fonts**: Google Fonts (Inter, Source Serif Pro) + JetBrains Mono

---

## Mock Data Structure

```typescript
interface Article {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  url: string;
  imageUrl?: string;
  author?: string;
  publishedAt: Date;
  feedId: string;
  feedName: string;
  feedColor: string; // For the colored dot
  relevancyScore: number; // 0-100
  isRead: boolean;
  isStarred: boolean;
}

interface Feed {
  id: string;
  name: string;
  url: string;
  iconColor: string;
  unreadCount: number;
  folderId?: string;
}

interface Folder {
  id: string;
  name: string;
  feeds: Feed[];
  isExpanded: boolean;
}
```

Generate 30-50 mock articles with varied relevancy scores to demonstrate masonry layout.

---

## Pages / Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page (if not logged in) or redirect to `/reader` |
| `/reader` | Main masonry view with sidebar |
| `/reader/article/[id]` | Article detail (can be slide-over or page) |
| `/onboarding` | Multi-step onboarding wizard |
| `/settings` | User preferences (dark mode, etc.) |

---

## Responsive Breakpoints

| Breakpoint | Columns | Sidebar |
|------------|---------|---------|
| Desktop (1280px+) | 4 columns | Expanded |
| Laptop (1024px) | 3 columns | Collapsed (icons) |
| Tablet (768px) | 2 columns | Hidden (hamburger) |
| Mobile (480px) | 1 column | Hidden (hamburger) |

---

## Acceptance Criteria

### Visual Quality
- [ ] Looks like a premium SaaS product, not a Bootstrap template
- [ ] Typography hierarchy is clear and elegant
- [ ] Colors match the defined palette
- [ ] Dark mode is fully implemented and polished
- [ ] All interactions have smooth 200-300ms transitions
- [ ] Skeleton loaders appear during data fetching

### Masonry Layout
- [ ] Cards arrange in true masonry pattern (no row alignment)
- [ ] Large/Medium/Small cards render correctly based on score
- [ ] Responsive: 4 → 3 → 2 → 1 columns
- [ ] Cards have hover lift effect
- [ ] Read articles have muted appearance

### Components
- [ ] Sidebar is collapsible with smooth animation
- [ ] Article detail panel slides in from right
- [ ] Onboarding wizard has step indicator and animations
- [ ] Search bar expands on focus
- [ ] All buttons have hover/active states

---

## Implementation Order

1. Set up project with TailwindCSS, shadcn/ui, Framer Motion
2. Configure custom theme (colors, fonts, shadows)
3. Build app shell (Header, Sidebar, Main area)
4. Implement masonry grid with CSS columns
5. Create 3 card variants (Large, Medium, Small)
6. Add card interactions (hover, read state, star)
7. Build article detail slide-over panel
8. Implement onboarding wizard
9. Add dark mode toggle
10. Polish animations and transitions
11. Test responsive breakpoints

---

Generate the requirements.md, design.md, and tasks.md for this frontend design spec.

# InferenceAdvisor

A plain-English guide for anyone who wants to run an open-source AI model but isn't sure which model or hardware to pick.

You answer three questions (what you're building, how many people will use it, what matters most). The site recommends one model + GPU setup and explains **what you're getting** (the AI, the computer, the monthly bill) and **why it fits** (bar charts for quality, speed, capacity and memory).

## Folder structure

```text
src/
├── app/
│   ├── layout.tsx            # Fonts, page title, and the loading splash
│   ├── globals.css           # Colors, slider styling, splash-screen animation (.splash-*)
│   └── page.tsx              # The whole page: questions, state, and the result
├── components/
│   └── SplashScreen.tsx      # Animated loading screen (cube fans out to GPUs)
└── lib/
    └── inference-engine.ts   # Calculation engine + model/GPU data (don't change formulas lightly)
```

## How state flows

1. `config` in `page.tsx` holds every answer. Sliders update it instantly.
2. `debouncedConfig` copies it ~90 ms later so the page stays smooth while dragging.
3. `runFullMatrixSimulation(debouncedConfig)` scores every model × GPU combination.
4. `recommendations` picks "Our pick", a cheaper option and a smarter option (all different).
5. `view` turns the chosen option's numbers into plain English (seconds, words per second, people).
6. The URL query string and `localStorage` mirror the answers, so "Share" links reopen the same result.

## Where to edit things

- **Use-case names and descriptions:** `USE_CASE_PRESETS` in `src/lib/inference-engine.ts`.
- **Wording of questions, explanations, glossary:** `src/app/page.tsx`.
- **Loading screen:** timing in `src/components/SplashScreen.tsx` (`SHOW_MS`), look in `globals.css` (`.splash-*`).
- **Colors:** accent is blue-600 (`#2563eb`); background is white. Change classes in `page.tsx` / `globals.css`.
- **Fonts:** `src/app/layout.tsx` (Space Grotesk for text, JetBrains Mono for numbers).

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000
npx tsc --noEmit
```

# ChessRoyale

A browser-based chess game built with React, TypeScript, and Vite.

## Tech Stack

- **React 19** + **TypeScript** — UI
- **Vite** — dev server & build tooling
- **ESLint** — linting

## Getting Started

```bash
npm install        # install dependencies
npm run dev        # start dev server (http://localhost:5173)
npm run build      # type-check + production build
npm run preview    # preview the production build
npm run lint       # run ESLint
```

## Project Structure

```
ChessRoyale/
├── public/          # static assets
├── src/             # application source
│   ├── App.tsx      # root component
│   └── main.tsx     # entry point
├── index.html       # HTML shell
└── vite.config.ts   # Vite config
```

## Roadmap

- [ ] Board rendering & piece layout
- [ ] Move generation & legality (standard chess rules)
- [ ] Two-player local play
- [ ] Game state (check, checkmate, stalemate, draws)
- [ ] Real-time multiplayer ("Royale" mode)

## License

TBD

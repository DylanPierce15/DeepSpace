# Task: Build and Test the Game Feature

## Objective

Build a working multiplayer game using the `GameRoom` DO, create a test app, and iteratively fix issues using HMR.

## What Already Exists

- **GameRoom DO**: `packages/deepspace/src/server/rooms/game-room.ts` — authoritative tick loop, player management, input collection, state broadcast. Read this first.
- **useGameRoom hook**: `packages/deepspace/src/client/storage/hooks/useGameRoom.ts` — provides `{ state, sendInput, players, connected }`. Read this.
- **Protocol constants**: `packages/deepspace/src/shared/protocol/constants.ts` — MSG_GAME_* constants.

## What You Need to Build

### 1. Game Feature in SDK (`src/features/game/`)

```
src/features/game/
  index.ts          # barrel: GamePage, GameLobby, GameView
  components/
    GamePage.tsx     # main page: lobby or active game
    GameLobby.tsx    # waiting room: player list, ready up, start game
    GameView.tsx     # the actual game rendering
```

**Build a simple multiplayer game** — something like:
- **Tag/chase**: Players are colored dots on a 2D field. One is "it". Touch another player to tag them. Simple enough to verify real-time sync works.
- Or **cooperative drawing race**: All players draw toward a target. First to reach it wins.
- Or **reaction time game**: Shapes appear, players click them. Fastest wins.

Pick whatever is simplest to implement and test. The point is proving the GameRoom tick loop, player sync, and input handling work.

**GamePage** should:
- Accept optional props: `{ roomId?: string, className?: string }`
- Show a lobby if no game is active
- Show the game view during gameplay
- Use `useGameRoom(roomId)` hook

**GameLobby** should:
- Show connected players with ready state
- "Ready" button
- "Start Game" button (when all ready)

**GameView** should:
- Render game state on a canvas or with divs
- Capture keyboard/mouse input, send via `sendInput()`
- Show other players' positions in real time
- Display score/status

### 2. Test App Setup

Same pattern as canvas — scaffold, add GameRoom DO to worker, add route, add page.

Worker additions:
```ts
import { GameRoom } from 'deepspace/worker'
export class AppGameRoom extends GameRoom {
  constructor(state: DurableObjectState, env: Env) {
    super(state, env, { tickRate: 20 }) // 20 ticks/sec
  }
}
// Add to __DO_MANIFEST__, add /game/:roomId route
```

### 3. Playwright Tests

`tests/local/tests/game.spec.ts`:

1. **Page load**: Game page renders, shows lobby
2. **Join game**: Sign in, see self in player list
3. **Ready up**: Click ready, status updates
4. **Two players**: Both join, both see each other in lobby
5. **Start game**: All ready, start, game view appears
6. **Input handling**: Send input (keypress/click), game state updates
7. **Real-time sync**: Player 1 moves, Player 2 sees updated position
8. **Game end**: Game reaches end condition, results displayed

## Development Workflow

Same as canvas prompt — start with local test app files for HMR, move to SDK when working. See `prompts/canvas-feature-build.md` for the full workflow description.

## Files to Read First

1. `packages/deepspace/src/server/rooms/game-room.ts`
2. `packages/deepspace/src/server/rooms/base-room.ts` — lifecycle hooks
3. `packages/deepspace/src/client/storage/hooks/useGameRoom.ts`
4. `packages/deepspace/src/shared/protocol/constants.ts`
5. `packages/deepspace/src/features/messaging/components/ChatPage.tsx` — props pattern reference
6. `tests/local/tests/messaging.spec.ts` — test pattern reference

## Success Criteria

1. Game lobby shows connected players
2. Players can ready up and start a game
3. Game state updates in real time across multiple browsers
4. Input from one player affects shared game state
5. Game ends and shows results
6. All Playwright tests pass
7. Feature exported from SDK: `import { GamePage } from 'deepspace'`

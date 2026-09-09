# API v2 class diagrams

Source of truth for domain types under `apiv2/src/domain`. HTTP contracts: [API_DOCUMENTATION.md](../../API_DOCUMENTATION.md). Runtime create/play/surrender flow: [GAME_FLOW.md](GAME_FLOW.md). Rewards detail: [GameOutcome-diagram.md](value-object/GameOutcome-diagram.md).

## Layers

```mermaid
classDiagram
    class Router
    class AuthController
    class ExternalController
    class GameController
    class UserController
    class EntityController
    class GameProcessorService
    class GameService
    class UserService
    class EntityService
    class S3GameRepository
    class S3UserRepository
    class S3EntityRepository
    class GameEntity
    class UserEntity
    class JsonEntity
    class Game
    class UserProfile

    Router --> AuthController
    Router --> ExternalController
    Router --> GameController
    Router --> UserController
    Router --> EntityController

    ExternalController --> GameProcessorService
    ExternalController --> UserService
    GameController --> GameService
    UserController --> UserService
    EntityController --> EntityService

    GameProcessorService --> S3GameRepository
    GameProcessorService --> Game
    GameService --> S3GameRepository
    UserService --> S3UserRepository
    EntityService --> S3EntityRepository

    S3GameRepository --> GameEntity
    S3UserRepository --> UserEntity
    S3EntityRepository --> JsonEntity

    GameEntity ..> Game : toGame / fromGame
    UserEntity ..> UserProfile : toUserProfile / fromUserProfile
    GameEntity o-- JsonEntity : backing store
    UserEntity o-- JsonEntity : backing store
```

`/apiv2/external/games` goes through `GameProcessorService` (create context + `Action`). `/apiv2/internal/games` goes through `GameService` (admin CRUD + ETag).

## Resolvers (player API)

`GameProcessorService.resolverFor(kind)` picks a `GameResolver` per action. Missing `createContext.kind` is Classic. Round/surrender/best-of stay in `GameProcessor`. `NpcActor.nextAction` decides whether the NPC throws and builds that `Action`; `doNpcAction` only applies it.

```mermaid
classDiagram
    class GameProcessorService {
        -resolverFor(kind) GameResolver
        -processorFor(game) GameProcessor
        +updateGame(userId, gameId, action)
    }

    class GameProcessor {
        -resolver: GameResolver
        -npcActor: NpcActor
        +processAction(game, action, userId) Game
        +doNpcAction(game) void
    }

    class NpcActor {
        +nextAction(game) Action
    }

    class GameResolver {
        <<interface>>
        +calculateSubRoundResult(subRound, outcome)
        +addGameOutcome(outcome, userId, isWinner)
    }

    class ClassicGameResolver {
        +calculateSubRoundResult(subRound, outcome)
    }

    class ExtendedGameResolver {
        +calculateSubRoundResult(subRound, outcome)
    }

    GameProcessorService --> GameProcessor : per action
    GameProcessorService --> ClassicGameResolver : classic or missing kind
    GameProcessorService --> ExtendedGameResolver : extended
    GameProcessor --> GameResolver
    GameProcessor --> NpcActor
    ClassicGameResolver ..|> GameResolver
    ExtendedGameResolver ..|> GameResolver
```

Classic: same `MoveType` is always a draw; `size` unused. Extended: same type compares `size` (higher wins, equal draw); different types still use Classic RPS.

## Persistence (delegating backing store)

`UserEntity` and `GameEntity` do not extend `BaseEntity`. Each wraps a `JsonEntity` for S3 JSON + ETag, and delegates rules to a pure domain object.

```mermaid
classDiagram
    class BaseEntity {
        <<abstract>>
        +id: string
        +data: JsonValue
        +etag?: string
        +metadata?: EntityMetadata
        +merge(partial) this
        +withETag(etag) this
    }

    class JsonEntity {
        +id: string
        +data: JsonValue
    }

    class GameEntity {
        -_backed: JsonEntity
        +id: string
        +usersIds: string[]
        +rounds: Round[]
        +status: GameStatus
        +createContext?: GameCreateContext
        +endTime?: number
        +outcome: object
        +toGame() Game
        +addRound(round) GameEntity
        +finish() GameEntity
        +finishRound(roundId) GameEntity
    }

    class UserEntity {
        -_backed: JsonEntity
        +id: string
        +name: string
        +externalId: number
        +updateName(name) UserEntity
        +toJSON() object
    }

    class Game {
        +id: string
        +usersIds: string[]
        +status: GameStatus
        +rounds: Round[]
        +outcome: GameOutcome
        +createContext?: GameCreateContext
        +endTime?: number
        +addRound(round) void
        +finish() void
        +finishRound(roundId) Game
        +getMovesForUser(userId) Move[]
    }

    class UserProfile {
        +id: string
        +name: string
        +externalId: number
        +updateName(name) UserProfile
        +merge(partial) UserProfile
    }

    class IEntityRepository {
        <<interface>>
    }
    class IGameRepository {
        <<interface>>
    }
    class S3EntityRepository
    class S3GameRepository

    BaseEntity <|-- JsonEntity
    GameEntity o-- JsonEntity : _backed
    UserEntity o-- JsonEntity : _backed
    GameEntity ..> Game
    UserEntity ..> UserProfile
    IEntityRepository <|.. S3EntityRepository
    IGameRepository <|.. S3GameRepository
```

`User` is an alias of `UserEntity`.

## Game aggregate

Stored shape: `Game` → `Round[]` → `SubRound[]` → `Move[]`. Moves are not children of `Round`. `Game.addMoveToRound` throws; add moves on a `SubRound`.

```mermaid
classDiagram
    class Game {
        +id: string
        +usersIds: string[]
        +status: GameStatus
        +rounds: Round[]
        +outcome: GameOutcome
        +createContext?: GameCreateContext
        +endTime?: number
    }

    class Round {
        +id: string
        +status: RoundStatus
        +startTime: number
        +winnerId?: string
        +endTime?: number
        +subRounds: SubRound[]
        +finish() void
        +getLastSubRound() SubRound
    }

    class SubRound {
        +idNum: number
        +startAt: number
        +finishedAt: number
        +updatedAt: number
        +status: SubRoundStatus
        +winnerId?: string
        +moves: Move[]
    }

    class Move {
        +userId: string
        +context: MoveContext
        +time: number
    }

    class MoveContext {
        +moveType: MoveType
        +size: number
        +decorId: number
    }

    class Action {
        +type: ActionType
        +context: ActionContext
    }

    class ActionContext {
        +move?: Move
    }

    class GameCreateContext {
        +gameType: GameType
        +rounds: RoundsLength
        +kind: KindOfGame
        +level: GameLevel
        +episode: EpisodeContext
    }

    class GameOutcome {
        +rewards: Map
        +addReward(userId, event) void
        +getRewardsByUserId(userId) OutcomeEvent
    }

    class GameStatus {
        <<enumeration>>
        created
        started
        finished
        broken
    }

    class GameTypeLength {
        <<enumeration>>
        BO1
        BO3
        BO5
        BO7
        BO9
        BO11
        BO19
    }

    class RoundStatus {
        <<enumeration>>
        finished
        pending
        current
    }

    class SubRoundStatus {
        <<enumeration>>
        init
        wait_player
        done
        surrendered
    }

    class MoveType {
        <<enumeration>>
        Stone
        Paper
        Scissors
    }

    class ActionType {
        <<enumeration>>
        Surrender
        Move
    }

    class GameType {
        <<enumeration>>
        PVP
        PVE
    }

    class RoundsLength {
        <<enumeration>>
        BO1
        BO3
        BO7
    }

    class KindOfGame {
        <<enumeration>>
        classic
        extended
    }

    class GameLevel {
        +name: string
    }

    class EpisodeContext {
        +name: string
    }

    Game "1" *-- "*" Round
    Game "1" *-- "1" GameOutcome
    Game --> GameStatus
    Game --> GameCreateContext
    Round "1" *-- "*" SubRound
    Round --> RoundStatus
    SubRound "1" *-- "*" Move
    SubRound --> SubRoundStatus
    Move "1" *-- "1" MoveContext
    MoveContext --> MoveType
    Action "1" *-- "1" ActionContext
    Action --> ActionType
    ActionContext --> Move
    GameCreateContext --> GameType
    GameCreateContext --> RoundsLength
    GameCreateContext --> KindOfGame
    GameCreateContext --> GameLevel
    GameCreateContext --> EpisodeContext
```

`RoundsLength` is the create-context field (`BO1` / `BO3` / `BO7`) used for victory. `GameTypeLength` is used by `Medal.gameLength`, not stored on `Game`.

`KindOfGame.classic` uses `ClassicGameResolver` (same `MoveType` is always a draw; `size` unused). `KindOfGame.extended` uses `ExtendedGameResolver` (same type: higher `size` wins, equal size is a draw; different types ignore `size`).

## Processor responses (external games)

```mermaid
classDiagram
    class CreateGameResponse {
        +status: created|failed
        +gameId: string
    }

    class GameResponse {
        +status: string
        +payload: GameResponsePayload
    }

    class UpdateGameResponse {
        +status: updated|failed
        +gameId: string
        +payload: GameResponsePayload
        +message: string
    }

    class GameResponsePayload {
        +gameContext: GameContext
        +playerContext: PlayerContext
        +enemyContext: EnemyContext
    }

    class GameContext {
        +status: GameStatus
        +initGameContext?: InitGameContext
    }

    class PlayerContext {
        +roundStates: RoundState[]
    }

    class RoundState {
        +status: RoundStatus
        +started: Date
        +finished: Date
        +roundId: string
        +winnerId?: string
        +subRoundStates: SubRoundState[]
    }

    class SubRoundState {
        +idNum: number
        +status: SubRoundStatus
        +started: Date
        +finished: Date
        +updated: Date
        +winnerId?: string
        +moves: Move[]
    }

    GameResponse --> GameResponsePayload
    UpdateGameResponse --> GameResponsePayload
    GameResponsePayload --> GameContext
    GameResponsePayload --> PlayerContext
    GameResponsePayload --> EnemyContext
    PlayerContext --> RoundState
    RoundState --> SubRoundState
    SubRoundState --> Move
```

Admin `GameResponseDto` still flattens every `SubRound.moves` onto the round and maps `status` to `isFinished`. The processor payload keeps `subRoundStates`.

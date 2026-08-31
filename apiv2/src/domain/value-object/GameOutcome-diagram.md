# GameOutcome Class Diagram

```mermaid
classDiagram
    class GameOutcome {
        +rewards: Map~string, OutcomeEvent[]~
        +constructor()
        +addReward(userId: string, outcomeEvent: OutcomeEvent) void
        +getRewardsByUserId(userId: string) OutcomeEvent
        +toJSON() object
        +fromJSON(data) GameOutcome$
        -validateUserId(userId: string) void
        -validateOutcomeEvent(outcomeEvent: OutcomeEvent) void
    }

    class OutcomeEvent {
        +type: OutcomeEventType
        +points: PointOutcomeEvent[]
        +coins: CoinOutcomeEvent[]
        +medals: MedalOutcomeEvent[]
        +constructor(type: OutcomeEventType)
        +addPointEvent(pointEvent: PointOutcomeEvent) void
        +addCoinEvent(coinEvent: CoinOutcomeEvent) void
        +addMedalEvent(medalEvent: MedalOutcomeEvent) void
        +toJSON() object
        +fromJSON(data) OutcomeEvent$
    }

    class PointOutcomeEvent {
        +amount: number
        +type: RewardPointType
        +constructor(amount, type)
        +toJSON() object
        +fromJSON(data) PointOutcomeEvent$
    }

    class CoinOutcomeEvent {
        +amount: number
        +coinDescriptionId: string
        +constructor(amount, coinDescriptionId)
        +toJSON() object
        +fromJSON(data) CoinOutcomeEvent$
    }

    class MedalOutcomeEvent {
        +amount: number
        +medal: Medal
        +constructor(amount, medal)
        +toJSON() object
        +fromJSON(data) MedalOutcomeEvent$
    }

    class OutcomeEventType {
        <<enumeration>>
        Points
        Coins
        Medals
    }

    class RewardPointType {
        <<enumeration>>
        Experience
        Wins
        Games
    }

    class Medal {
        +issuerId: number
        +enemyId: number
        +createdTime: number
        +madeOf: Material
        +gameLength: GameTypeLength
        +toJSON() object
        +fromJSON(data) Medal$
    }

    GameOutcome "1" --> "*" OutcomeEvent : rewards (by userId)
    OutcomeEvent --> "*" PointOutcomeEvent : points
    OutcomeEvent --> "*" CoinOutcomeEvent : coins
    OutcomeEvent --> "*" MedalOutcomeEvent : medals
    OutcomeEvent --> OutcomeEventType : type
    PointOutcomeEvent --> RewardPointType : type
    MedalOutcomeEvent --> Medal : medal
```

## Structure Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           GameOutcome                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  rewards: Map<string, OutcomeEvent[]>                                    │
│     └── userId → [OutcomeEvent, OutcomeEvent, ...]                       │
├─────────────────────────────────────────────────────────────────────────┤
│  + addReward(userId, outcomeEvent)                                       │
│  + getRewardsByUserId(userId) → OutcomeEvent  (aggregated)                │
│  + toJSON() / fromJSON()                                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ 1..* per userId
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          OutcomeEvent                                    │
├─────────────────────────────────────────────────────────────────────────┤
│  type: OutcomeEventType (POINTS | COINS | MEDALS)                         │
│  points: PointOutcomeEvent[]                                              │
│  coins: CoinOutcomeEvent[]                                                │
│  medals: MedalOutcomeEvent[]                                              │
├─────────────────────────────────────────────────────────────────────────┤
│  + addPointEvent / addCoinEvent / addMedalEvent                          │
└─────────────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ PointOutcomeEvent│ │ CoinOutcomeEvent │ │MedalOutcomeEvent  │
├──────────────────┤ ├──────────────────┤ ├──────────────────┤
│ amount: number   │ │ amount: number   │ │ amount: number   │
│ type: RewardPoint│ │ coinDescriptionId│ │ medal: Medal     │
│   Type           │ │   : string       │ │                  │
└──────────────────┘ └──────────────────┘ └────────┬─────────┘
       │                                              │
       ▼                                              ▼
┌──────────────────┐                         ┌──────────────┐
│ RewardPointType  │                         │    Medal     │
│ EXPERIENCE       │                         │ issuerId     │
│ WINS             │                         │ enemyId      │
│ GAMES            │                         │ createdTime  │
└──────────────────┘                         │ madeOf       │
                                             │ gameLength   │
                                             └──────────────┘
```

## getRewardsByUserId aggregation logic

- **Points**: grouped by `RewardPointType`, amounts summed → one `PointOutcomeEvent` per type
- **Coins**: grouped by `coinDescriptionId`, amounts summed → one `CoinOutcomeEvent` per description
- **Medals**: all collected (no aggregation)

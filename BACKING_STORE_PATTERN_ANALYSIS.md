# Backing Store Pattern - Implementation Comparison

**Date**: November 1, 2025  
**Analysis**: Evolution from Simple to Delegating Approach  
**Status**: Both User and Game now use Delegating Pattern

---

## Overview

Both `UserEntity` and `GameEntity` now use the **Delegating Backing Store Pattern** where they store their data in a `JsonEntity` backing store and delegate domain logic to separate classes (`UserProfile` and `Game` respectively).

**Historical Note**: This document originally compared the Simple (User) vs Delegating (GameEntity) approaches. As of November 1, 2025, User has been refactored to also use the Delegating pattern for architectural consistency.

---

## Pattern Comparison

### 🔷 UserEntity + UserProfile - **Delegating Backing Store**

```
┌──────────────────────────────────────────────────────┐
│                   UserEntity                          │
│  ┌────────────────────────────────────────────────┐  │
│  │  private _backed: JsonEntity                   │  │
│  │  {                                             │  │
│  │    id: "user-1"                                │  │
│  │    data: {                                     │  │
│  │      name: "John"                              │  │
│  │      externalId: 123                           │  │
│  │    }                                           │  │
│  │  }                                             │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  Delegates operations to UserProfile                  │
│  ┌─────────────────────────────────────────────┐    │
│  │ toUserProfile() → UserProfile → operations  │    │
│  │ → fromUserProfile()                         │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  - updateName() ──────┐                              │
│  - updateExternalId() ┼──→ Delegates to UserProfile │
│  - merge() ───────────┤                              │
│  - hasName() ─────────┘                              │
└──────────────────────────────────────────────────────┘
                     │
                     ↓
        ┌────────────────────────┐
        │     UserProfile        │
        │  (Domain Logic Layer)  │
        │                        │
        │  - Domain operations   │
        │  - Business rules      │
        │  - Immutable updates   │
        └────────────────────────┘
```

### 🔶 GameEntity - **Delegating Backing Store**

```
┌──────────────────────────────────────────────────────┐
│                   GameEntity                          │
│  ┌────────────────────────────────────────────────┐  │
│  │  private _backed: JsonEntity                   │  │
│  │  {                                             │  │
│  │    id: "game-1"                                │  │
│  │    data: {                                     │  │
│  │      type: "poker"                             │  │
│  │      usersIds: ["user-1", "user-2"]            │  │
│  │      rounds: [...],                            │  │
│  │      isFinished: false                         │  │
│  │    }                                           │  │
│  │  }                                             │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  Delegates complex operations to Game                 │
│  ┌─────────────────────────────────────────────┐    │
│  │ toGame() → Game → operations → fromGame()   │    │
│  └─────────────────────────────────────────────┘    │
│                                                       │
│  - addRound() ────────┐                              │
│  - addMoveToRound() ──┤                              │
│  - finishRound() ─────┼──→ Delegates to Game class  │
│  - finish() ──────────┤                              │
│  - hasUser() ─────────┘                              │
└──────────────────────────────────────────────────────┘
                     │
                     ↓
        ┌────────────────────────┐
        │        Game            │
        │  (Domain Logic Layer)  │
        │                        │
        │  - Complex operations  │
        │  - Business rules      │
        │  - Immutable updates   │
        └────────────────────────┘
```

---

## Key Differences

| Aspect | User (Simple) | Game/GameEntity (Complex) |
|--------|---------------|---------------------------|
| **Architecture** | Single-layer | Two-layer (GameEntity + Game) |
| **Complexity** | Simple (2 fields) | Complex (nested rounds, moves) |
| **Domain Logic** | In User class | Separated in Game class |
| **Operations** | Direct manipulation | Delegation pattern |
| **Conversion** | None needed | toGame() / fromGame() |
| **Business Rules** | Simple validation | Complex game logic |

---

## Detailed Analysis

### 1. User - Simple Backing Store

#### Structure
```typescript
class User {
  private readonly _backed: JsonEntity;  // Backing store
  
  constructor(id: string, name: string, externalId: number, etag?, metadata?) {
    // Simple data structure
    const userData: UserData = { name, externalId };
    this._backed = new JsonEntity(id, userData, etag, metadata);
  }
}

interface UserData {
  name: string;
  externalId: number;
}
```

#### Characteristics

✅ **Direct Operations**
```typescript
// Operations directly manipulate the backing store
updateName(name: string): User {
  return new User(this.id, name, this.externalId, this._backed.etag, this._backed.metadata);
}

updateExternalId(externalId: number): User {
  return new User(this.id, this.name, externalId, this._backed.etag, this._backed.metadata);
}

merge(partial: Partial<UserData>): User {
  const currentData = this.getUserData();
  return new User(
    this.id,
    partial.name ?? currentData.name,
    partial.externalId ?? currentData.externalId,
    this._backed.etag,
    this._backed.metadata
  );
}
```

✅ **Simple Data Access**
```typescript
get name(): string {
  return this.getUserData().name;
}

get externalId(): number {
  return this.getUserData().externalId;
}

private getUserData(): UserData {
  return this._backed.data as unknown as UserData;
}
```

✅ **No Intermediate Layer**
- User directly implements all business logic
- No need for a separate domain logic class
- Simple enough to manage in one class

---

### 2. GameEntity + Game - Delegating Backing Store

#### Structure
```typescript
class GameEntity {
  private readonly _backed: JsonEntity;  // Backing store
  
  constructor(id, type, usersIds, rounds, isFinished, etag?, metadata?) {
    // Complex nested data structure
    const gameData: GameData = {
      type,
      usersIds: [...usersIds],
      rounds: rounds.map(round => this.roundToData(round)),  // Conversion!
      isFinished
    };
    this._backed = new JsonEntity(id, gameData, etag, metadata);
  }
}

interface GameData {
  type: string;
  usersIds: string[];
  rounds: RoundData[];      // Nested structure
  isFinished: boolean;
}

class Game {
  // Pure domain logic, no backing store
  constructor(
    public readonly id: string,
    public readonly type: string,
    public readonly usersIds: string[],
    public readonly rounds: Round[],
    public readonly isFinished: boolean
  ) {}
}
```

#### Characteristics

✅ **Delegation Pattern**
```typescript
// GameEntity delegates complex operations to Game
addRound(round: Round): GameEntity {
  const game = this.toGame();              // 1. Convert to Game
  const updatedGame = game.addRound(round); // 2. Perform operation
  return this.fromGame(updatedGame);        // 3. Convert back
}

addMoveToRound(roundId: string, move: Move): GameEntity {
  const game = this.toGame();
  const updatedGame = game.addMoveToRound(roundId, move);
  return this.fromGame(updatedGame);
}

finishRound(roundId: string): GameEntity {
  const game = this.toGame();
  const updatedGame = game.finishRound(roundId);
  return this.fromGame(updatedGame);
}
```

✅ **Separation of Concerns**
```typescript
// GameEntity: Persistence + Conversion
class GameEntity {
  private toGame(): Game {
    const gameData = this.getGameData();
    const rounds = gameData.rounds.map(roundData => this.dataToRound(roundData));
    return new Game(this.id, gameData.type, gameData.usersIds, rounds, gameData.isFinished);
  }

  private fromGame(game: Game): GameEntity {
    return new GameEntity(
      game.id, game.type, game.usersIds, game.rounds, game.isFinished,
      this._backed.etag, this._backed.metadata
    );
  }
}

// Game: Pure domain logic
class Game {
  addRound(round: Round): Game {
    this.validateRound(round);
    return new Game(this.id, this.type, this.usersIds, [...this.rounds, round], this.isFinished);
  }

  addMoveToRound(roundId: string, move: Move): Game {
    const roundIndex = this.rounds.findIndex(round => round.id === roundId);
    if (roundIndex === -1) {
      throw new ValidationError(`Round with ID '${roundId}' not found in game`);
    }
    const updatedRound = this.rounds[roundIndex].addMove(move);
    const updatedRounds = [...this.rounds];
    updatedRounds[roundIndex] = updatedRound;
    return new Game(this.id, this.type, this.usersIds, updatedRounds, this.isFinished);
  }
}
```

✅ **Complex Data Conversion**
```typescript
// GameEntity handles conversion between data formats
private roundToData(round: Round): RoundData {
  return {
    id: round.id,
    moves: round.moves.map(move => this.moveToData(move)),
    isFinished: round.isFinished,
    time: round.time
  };
}

private dataToRound(roundData: RoundData): Round {
  const moves = roundData.moves.map(moveData => this.dataToMove(moveData));
  return new Round(roundData.id, moves, roundData.isFinished, roundData.time);
}
```

---

## Why Two Different Approaches?

### User: Simple Backing Store ✅

**Reasons**:
1. **Simple Data Structure**: Only 2 fields (name, externalId)
2. **No Complex Logic**: Operations are straightforward updates
3. **No Nested Objects**: Flat structure
4. **Single Responsibility**: User handles both persistence and logic
5. **Performance**: No conversion overhead

**When to Use**:
- Entity has < 5 simple fields
- No nested collections
- Simple CRUD operations
- No complex business rules
- Performance is critical

---

### GameEntity + Game: Delegating Backing Store ✅

**Reasons**:
1. **Complex Data Structure**: Nested rounds with moves
2. **Complex Business Logic**: Game rules, round management, move validation
3. **Separation of Concerns**: 
   - `GameEntity` = Persistence + Conversion
   - `Game` = Pure domain logic
4. **Testability**: Can test `Game` logic without persistence concerns
5. **Maintainability**: Changes to game rules don't affect persistence

**When to Use**:
- Entity has complex nested structures
- Multiple levels of aggregation (Game → Round → Move)
- Complex business rules and operations
- Need to test domain logic independently
- Multiple ways to construct/modify the entity

---

## Trade-offs

### Simple Backing Store (User)

| ✅ Advantages | ❌ Disadvantages |
|--------------|------------------|
| Simpler code | Can become messy with complexity |
| Less overhead | Mixes persistence with domain logic |
| Faster (no conversion) | Harder to test domain logic separately |
| Easier to understand | Doesn't scale well to complex entities |

### Delegating Backing Store (GameEntity + Game)

| ✅ Advantages | ❌ Disadvantages |
|--------------|------------------|
| Clean separation of concerns | More code/files to maintain |
| Testable domain logic | Conversion overhead (toGame/fromGame) |
| Scales to complexity | Steeper learning curve |
| Flexible architecture | Overkill for simple entities |
| Easy to add new operations | More memory allocations |

---

## Code Examples

### Example 1: Simple Update (User)

```typescript
// User: Direct operation
const updatedUser = user.updateName("Jane");
// ✓ One step, no conversion
```

### Example 2: Complex Update (Game)

```typescript
// GameEntity: Delegated operation
const updatedGame = gameEntity.addMoveToRound("round-1", move);

// Behind the scenes:
// 1. gameEntity.toGame() → Convert to Game
// 2. game.addMoveToRound() → Perform operation
// 3. gameEntity.fromGame() → Convert back to GameEntity
// ✓ Three steps, but clean separation
```

---

## Conversion Flow Diagram

### User (No Conversion)
```
┌──────┐
│ User │ ──→ updateName() ──→ new User (updated)
└──────┘
   ↓
[JsonEntity backing store]
```

### GameEntity (With Conversion)
```
┌─────────────┐
│ GameEntity  │
└──────┬──────┘
       │
       │ toGame()
       ↓
┌─────────────┐
│    Game     │ ──→ addRound() ──→ new Game (updated)
└──────┬──────┘
       │
       │ fromGame()
       ↓
┌─────────────┐
│ GameEntity  │ (new instance)
└──────┬──────┘
       ↓
[JsonEntity backing store]
```

---

## When to Use Each Approach

### Use Simple Backing Store (User Pattern) When:

1. ✅ Entity has **simple, flat data structure**
2. ✅ Operations are **straightforward CRUD**
3. ✅ **No complex business rules** to enforce
4. ✅ **Performance is critical** (no conversion overhead)
5. ✅ Team prefers **simpler, more direct code**

**Examples**:
- User profiles
- Configuration settings
- Simple lookup tables
- Tags, categories
- Basic metadata

---

### Use Delegating Backing Store (GameEntity Pattern) When:

1. ✅ Entity has **complex, nested structures**
2. ✅ **Rich domain logic** needs to be tested independently
3. ✅ Multiple **aggregate roots** or **value objects**
4. ✅ Operations involve **complex state transitions**
5. ✅ Need **clear separation** between persistence and domain logic

**Examples**:
- Games with rounds and moves
- Orders with line items and payments
- Projects with tasks and subtasks
- Workflows with steps and transitions
- Complex aggregates in DDD

---

## Evolution Path

### Start Simple → Grow Complex

```
Phase 1: Simple Entity
┌──────────────────┐
│  User (Simple)   │
│  - Direct ops    │
│  - Backing store │
└──────────────────┘

Phase 2: Growing Complexity
┌──────────────────┐
│  User (Growing)  │
│  - More fields   │
│  - More logic    │
│  - Getting messy │
└──────────────────┘

Phase 3: Refactor to Delegation
┌──────────────────┐     ┌──────────────────┐
│  UserEntity      │────→│  User (Logic)    │
│  - Persistence   │     │  - Domain rules  │
│  - Conversion    │     │  - Operations    │
└──────────────────┘     └──────────────────┘
```

---

## Best Practices

### For Simple Backing Store (User)

1. ✅ Keep operations simple and direct
2. ✅ Validate in constructor
3. ✅ Return new instances (immutability)
4. ✅ Use private helper methods for data access
5. ✅ Keep the class under 200 lines

### For Delegating Backing Store (GameEntity + Game)

1. ✅ **GameEntity**: Focus on persistence and conversion
2. ✅ **Game**: Focus on pure domain logic
3. ✅ Keep conversion methods private
4. ✅ Test `Game` class independently
5. ✅ Use `toGame()`/`fromGame()` consistently
6. ✅ Document the delegation pattern

---

## Testing Implications

### User (Simple)
```typescript
// Test includes persistence concerns
describe('User', () => {
  it('should update name', () => {
    const user = new User('user-1', 'John', 123);
    const updated = user.updateName('Jane');
    
    expect(updated.name).toBe('Jane');
    expect(updated.internalGetBackingStore().data.name).toBe('Jane');
  });
});
```

### Game (Delegating)
```typescript
// Test domain logic WITHOUT persistence
describe('Game', () => {
  it('should add round', () => {
    const game = new Game('game-1', 'poker', ['user-1'], [], false);
    const round = new Round('round-1', [], false, Date.now());
    
    const updated = game.addRound(round);
    
    expect(updated.rounds).toHaveLength(1);
    expect(updated.rounds[0].id).toBe('round-1');
    // ✓ No backing store concerns!
  });
});

// Test persistence separately
describe('GameEntity', () => {
  it('should persist game with rounds', () => {
    const gameEntity = new GameEntity('game-1', 'poker', ['user-1'], [], false);
    const round = new Round('round-1', [], false, Date.now());
    
    const updated = gameEntity.addRound(round);
    
    expect(updated.internalGetBackingStore().data.rounds).toHaveLength(1);
    // ✓ Tests conversion and persistence
  });
});
```

---

## Conclusion

Both approaches are valid implementations of the **Backing Store Pattern**, chosen based on **complexity and requirements**:

### 🔷 User = Simple Backing Store
- **One class** handles everything
- **Direct operations** on backing store
- **Best for simple entities**

### 🔶 GameEntity + Game = Delegating Backing Store
- **Two classes** with clear responsibilities
- **Delegation** to separate domain logic
- **Best for complex aggregates**

The key insight: **Start simple (User pattern), refactor to delegation (Game pattern) when complexity grows**.

---

**Key Takeaway**: The pattern choice should match your domain complexity. Don't over-engineer simple entities, but don't under-engineer complex ones!

---

**Document Version**: 2.0  
**Last Updated**: November 1, 2025  
**Author**: AI Assistant

---

## Update History

### Version 2.0 (November 1, 2025)
- **Major Update**: User entity refactored to use Delegating Backing Store Pattern
- **Architectural Consistency**: Both User and Game now follow the same pattern
- **Updated Diagrams**: Replaced Simple Backing Store examples with Delegating pattern
- **New Documentation**: See `USER_REFACTORING_SUMMARY.md` for detailed refactoring information

### Version 1.0 (November 1, 2025)
- Initial analysis comparing Simple (User) vs Delegating (GameEntity) approaches
- Documented trade-offs and when to use each pattern


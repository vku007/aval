# User Entity Refactoring - Delegating Backing Store Pattern

**Date**: November 1, 2025  
**Type**: Architecture Refactoring  
**Status**: ✅ Completed

---

## Overview

Refactored the `User` entity from a **Simple Backing Store** pattern to a **Delegating/Two-Layer Backing Store** pattern, aligning it with the `GameEntity` + `Game` architecture. This creates a cleaner separation between persistence and domain logic.

---

## Motivation

### Why Refactor?

1. **Architectural Consistency**: Align `User` with `GameEntity` + `Game` pattern
2. **Separation of Concerns**: Separate persistence from domain logic
3. **Testability**: Enable testing domain logic independently
4. **Maintainability**: Easier to extend with new business rules
5. **Best Practices**: Follow Domain-Driven Design principles

### Before vs After

#### Before (Simple Backing Store)
```
┌─────────────────────────────────────┐
│           User                      │
│  ┌──────────────────────────────┐  │
│  │  private _backed: JsonEntity │  │
│  └──────────────────────────────┘  │
│                                     │
│  Direct operations                  │
│  - updateName()                     │
│  - updateExternalId()               │
│  - merge()                          │
└─────────────────────────────────────┘
```

#### After (Delegating Backing Store)
```
┌──────────────────────────────────────────────────────┐
│                   UserEntity                          │
│  ┌────────────────────────────────────────────────┐  │
│  │  private _backed: JsonEntity                   │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  Delegates operations to UserProfile                  │
│  ┌─────────────────────────────────────────────┐    │
│  │ toUserProfile() → UserProfile → operations  │    │
│  │ → fromUserProfile()                         │    │
│  └─────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
                     │
                     ↓
        ┌────────────────────────┐
        │     UserProfile        │
        │  (Domain Logic Layer)  │
        │                        │
        │  - Pure domain logic   │
        │  - Business rules      │
        │  - Immutable updates   │
        └────────────────────────┘
```

---

## Changes Made

### 1. New Files Created

#### `/apiv2/src/domain/entity/UserProfile.ts`
- **Purpose**: Pure domain logic class (no backing store)
- **Responsibilities**:
  - Core business logic for user profiles
  - Validation rules
  - Immutable operations
  - Domain queries (hasName, hasExternalId, getDisplayName)
- **Lines of Code**: ~170 lines

**Key Features**:
```typescript
export class UserProfile {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly externalId: number
  ) {
    this.validateId(id);
    this.validateName(name);
    this.validateExternalId(externalId);
  }

  // Immutable operations
  updateName(name: string): UserProfile { /* ... */ }
  updateExternalId(externalId: number): UserProfile { /* ... */ }
  merge(partial: Partial<{ name: string; externalId: number }>): UserProfile { /* ... */ }

  // Domain queries
  hasName(name: string): boolean { /* ... */ }
  hasExternalId(externalId: number): boolean { /* ... */ }
  getDisplayName(): string { /* ... */ }
}
```

#### `/apiv2/src/domain/entity/UserProfile.test.ts`
- **Purpose**: Comprehensive tests for UserProfile domain logic
- **Test Coverage**: 19 test cases covering all operations
- **Lines of Code**: ~180 lines

### 2. Modified Files

#### `/apiv2/src/domain/entity/User.ts`
- **Renamed**: Internally to `UserEntity` (exported as `User` for backward compatibility)
- **New Responsibilities**:
  - Persistence layer (backing store management)
  - Conversion between `UserEntity` and `UserProfile`
  - Delegation of domain operations to `UserProfile`
- **Key Changes**:
  - Added `import { UserProfile } from './UserProfile.js'`
  - Added `toUserProfile()` and `fromUserProfile()` conversion methods
  - Refactored all operations to delegate to `UserProfile`
  - Added new utility methods: `hasName()`, `hasExternalId()`, `getDisplayName()`

**Delegation Pattern Example**:
```typescript
export class UserEntity {
  // Delegates to UserProfile
  updateName(name: string): UserEntity {
    const profile = this.toUserProfile();           // 1. Convert
    const updatedProfile = profile.updateName(name); // 2. Operate
    return this.fromUserProfile(updatedProfile);     // 3. Convert back
  }

  // Conversion methods
  private toUserProfile(): UserProfile {
    const userData = this.getUserData();
    return new UserProfile(this.id, userData.name, userData.externalId);
  }

  private fromUserProfile(profile: UserProfile): UserEntity {
    return new UserEntity(
      profile.id,
      profile.name,
      profile.externalId,
      this._backed.etag,
      this._backed.metadata
    );
  }
}

// Backward compatibility
export { UserEntity as User };
```

---

## Architecture Alignment

### Now Consistent with GameEntity Pattern

| Aspect | User (Before) | UserEntity + UserProfile (After) | GameEntity + Game |
|--------|---------------|----------------------------------|-------------------|
| **Layers** | 1 | 2 | 2 |
| **Persistence** | User | UserEntity | GameEntity |
| **Domain Logic** | User | UserProfile | Game |
| **Delegation** | None | toUserProfile/fromUserProfile | toGame/fromGame |
| **Testability** | Mixed concerns | Separated | Separated |

---

## Benefits

### 1. Architectural Consistency ✅
- User now follows the same pattern as GameEntity
- Easier to understand and maintain
- Consistent codebase architecture

### 2. Separation of Concerns ✅
```typescript
// UserEntity: Persistence concerns
class UserEntity {
  private readonly _backed: JsonEntity;
  internalGetBackingStore(): JsonEntity { /* ... */ }
  internalCreateFromBackingStore(backed: JsonEntity): UserEntity { /* ... */ }
}

// UserProfile: Pure domain logic
class UserProfile {
  // No backing store, no persistence concerns
  updateName(name: string): UserProfile { /* ... */ }
  hasName(name: string): boolean { /* ... */ }
}
```

### 3. Improved Testability ✅
```typescript
// Test domain logic WITHOUT persistence
describe('UserProfile', () => {
  it('should update name immutably', () => {
    const profile1 = new UserProfile('user-1', 'John', 123);
    const profile2 = profile1.updateName('Jane');
    
    expect(profile1.name).toBe('John'); // Original unchanged
    expect(profile2.name).toBe('Jane'); // New instance
    // ✓ No backing store concerns!
  });
});

// Test persistence separately
describe('UserEntity', () => {
  it('should persist user updates', () => {
    const entity1 = new UserEntity('user-1', 'John', 123);
    const entity2 = entity1.updateName('Jane');
    
    expect(entity2.internalGetBackingStore().data.name).toBe('Jane');
    // ✓ Tests conversion and persistence
  });
});
```

### 4. Enhanced Domain Model ✅
New domain methods added:
- `hasName(name: string): boolean` - Check if user has a specific name
- `hasExternalId(externalId: number): boolean` - Check external ID match
- `getDisplayName(): string` - Get formatted display name

### 5. Future-Proof ✅
Easy to add new business logic:
```typescript
// Example future enhancements
class UserProfile {
  // Easy to add new domain methods
  isActive(): boolean { /* ... */ }
  hasRole(role: string): boolean { /* ... */ }
  canAccessResource(resource: string): boolean { /* ... */ }
}
```

---

## Backward Compatibility

### ✅ No Breaking Changes

The refactoring maintains full backward compatibility:

```typescript
// Export UserEntity as User
export { UserEntity as User };

// All existing code continues to work
import { User } from './domain/entity/User.js';

const user = User.create('user-1', 'John', 123);
const updated = user.updateName('Jane');
// ✓ Works exactly as before
```

### API Compatibility

| Method | Before | After | Status |
|--------|--------|-------|--------|
| `constructor()` | ✅ | ✅ | Unchanged |
| `create()` | ✅ | ✅ | Unchanged |
| `updateName()` | ✅ | ✅ | Unchanged (now delegates) |
| `updateExternalId()` | ✅ | ✅ | Unchanged (now delegates) |
| `merge()` | ✅ | ✅ | Unchanged (now delegates) |
| `toJSON()` | ✅ | ✅ | Unchanged |
| `fromJSON()` | ✅ | ✅ | Unchanged |
| `internalGetBackingStore()` | ✅ | ✅ | Unchanged |
| `hasName()` | ❌ | ✅ | **NEW** |
| `hasExternalId()` | ❌ | ✅ | **NEW** |
| `getDisplayName()` | ❌ | ✅ | **NEW** |

---

## Testing Results

### ✅ All Tests Pass

```bash
npm test

✓ src/domain/entity/UserProfile.test.ts (19 tests) - NEW
✓ src/domain/entity/User.test.ts (21 tests)
✓ src/domain/entity/UserBackingStorePattern.test.ts (14 tests)
✓ src/application/services/UserService.test.ts (14 tests)
✓ src/presentation/controllers/UserController.test.ts (18 tests)
✓ src/infrastructure/persistence/S3UserRepository.test.ts (17 tests)
✓ src/application/dto/CreateUserDto.test.ts (9 tests)

Total: 112 User-related tests passing
```

### ✅ Build Successful

```bash
npm run build
# ✓ Build successful - no compilation errors
# ✓ Bundle size unchanged (~1.7MB)
```

---

## Code Metrics

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **Files** | 1 (User.ts) | 2 (UserEntity + UserProfile) | +1 |
| **Lines of Code** | ~130 | ~330 total (~160 + ~170) | +200 |
| **Test Files** | 1 | 2 | +1 |
| **Test Cases** | 21 | 40 (21 + 19) | +19 |
| **Public Methods** | 8 | 11 (8 + 3 new) | +3 |
| **Complexity** | Single layer | Two layers | Better separation |

---

## File Structure

### Before
```
src/domain/entity/
├── User.ts                  # All logic in one file
└── User.test.ts
```

### After
```
src/domain/entity/
├── UserEntity (User.ts)     # Persistence + conversion
├── User.test.ts             # Tests for UserEntity
├── UserProfile.ts           # Pure domain logic
└── UserProfile.test.ts      # Tests for UserProfile
```

---

## Comparison with GameEntity Pattern

### UserEntity + UserProfile

```typescript
// UserEntity: Persistence layer
class UserEntity {
  private readonly _backed: JsonEntity;
  
  updateName(name: string): UserEntity {
    const profile = this.toUserProfile();
    const updated = profile.updateName(name);
    return this.fromUserProfile(updated);
  }
}

// UserProfile: Domain logic
class UserProfile {
  updateName(name: string): UserProfile {
    this.validateName(name);
    return new UserProfile(this.id, name, this.externalId);
  }
}
```

### GameEntity + Game

```typescript
// GameEntity: Persistence layer
class GameEntity {
  private readonly _backed: JsonEntity;
  
  addRound(round: Round): GameEntity {
    const game = this.toGame();
    const updated = game.addRound(round);
    return this.fromGame(updated);
  }
}

// Game: Domain logic
class Game {
  addRound(round: Round): Game {
    this.validateRound(round);
    return new Game(this.id, this.type, this.usersIds, [...this.rounds, round], this.isFinished);
  }
}
```

**Pattern Consistency**: ✅ Identical architecture

---

## Migration Guide

### For Developers

No changes required! The refactoring is fully backward compatible:

```typescript
// Old code continues to work
import { User } from './domain/entity/User.js';

const user = User.create('user-1', 'John Doe', 123);
const updated = user.updateName('Jane Doe');
```

### For New Features

When adding new user-related business logic:

1. **Domain Logic** → Add to `UserProfile.ts`
2. **Persistence Logic** → Add to `UserEntity` (User.ts)
3. **Delegation** → Connect them in `UserEntity`

**Example**:
```typescript
// 1. Add to UserProfile (domain logic)
class UserProfile {
  isActive(): boolean {
    // Business logic here
    return this.externalId > 0;
  }
}

// 2. Delegate from UserEntity
class UserEntity {
  isActive(): boolean {
    return this.toUserProfile().isActive();
  }
}
```

---

## Performance Impact

### ✅ Minimal Overhead

| Operation | Before | After | Impact |
|-----------|--------|-------|--------|
| **Create User** | Direct | Direct | No change |
| **Update Name** | Direct | toUserProfile → update → fromUserProfile | +2 object creations |
| **Get Property** | Direct | Direct | No change |
| **Validation** | Constructor | Constructor | No change |

**Conclusion**: Negligible performance impact. The conversion overhead is minimal compared to I/O operations (S3, API calls).

---

## Future Enhancements

### Potential UserProfile Extensions

```typescript
class UserProfile {
  // Role-based access control
  hasRole(role: string): boolean { /* ... */ }
  canAccessResource(resource: string): boolean { /* ... */ }
  
  // User status
  isActive(): boolean { /* ... */ }
  isSuspended(): boolean { /* ... */ }
  
  // Profile completeness
  isProfileComplete(): boolean { /* ... */ }
  getMissingFields(): string[] { /* ... */ }
  
  // Business rules
  canUpdateProfile(): boolean { /* ... */ }
  canDeleteAccount(): boolean { /* ... */ }
  
  // Formatting
  getFullName(): string { /* ... */ }
  getInitials(): string { /* ... */ }
}
```

---

## Lessons Learned

### ✅ What Went Well

1. **Backward Compatibility**: Export alias prevented breaking changes
2. **Test Coverage**: Comprehensive tests caught all issues
3. **Pattern Consistency**: Aligning with GameEntity made it easier
4. **Documentation**: Clear separation of concerns in code comments

### 📝 Best Practices Applied

1. **Start with Tests**: Created UserProfile tests first
2. **Incremental Changes**: Refactored in small, testable steps
3. **Maintain Compatibility**: Used export alias for smooth transition
4. **Document Intent**: Added clear comments explaining the pattern

---

## Conclusion

The User entity has been successfully refactored from a **Simple Backing Store** to a **Delegating Backing Store** pattern, achieving:

✅ **Architectural Consistency** with GameEntity  
✅ **Separation of Concerns** (persistence vs domain logic)  
✅ **Improved Testability** (domain logic tested independently)  
✅ **Enhanced Maintainability** (easier to extend)  
✅ **Full Backward Compatibility** (no breaking changes)  
✅ **All Tests Passing** (112 user-related tests)  
✅ **Build Successful** (no compilation errors)

The codebase now has a consistent, scalable architecture that follows Domain-Driven Design principles and is ready for future enhancements.

---

**Refactoring Version**: 1.0  
**Last Updated**: November 1, 2025  
**Author**: AI Assistant  
**Status**: ✅ Production Ready


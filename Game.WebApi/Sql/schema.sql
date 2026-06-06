-- Game.WebApi schema (hand-written DDL, replaces EF migrations for game data).
-- Identity tables (AspNetUsers, etc.) are created separately via EnsureCreated().
-- This script is idempotent: CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE on seeds,
-- so re-running it on every app startup preserves existing player data.
-- For a clean reset, delete game.db (+ -shm/-wal) before starting the app.
-- Per-player runtime tables are 3NF. PlayerResources is intentionally a single wide row
-- (Gold/Wood/Food/Mana/Iron columns) by product decision; not 3NF for the resource list,
-- but the resource set is small and fixed.

PRAGMA foreign_keys = ON;

-- =============================================================
-- 1. Catalog (lookup) tables
-- =============================================================
CREATE TABLE IF NOT EXISTS Races (
    Id   INTEGER PRIMARY KEY,
    Name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ResourceTypes (
    Id   INTEGER PRIMARY KEY,
    Name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS WorkerTypes (
    Id   INTEGER PRIMARY KEY,
    Name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS TroopTiers (
    Id   INTEGER PRIMARY KEY,
    Name TEXT NOT NULL UNIQUE,
    Tier INTEGER NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS BuildingTypes (
    Id       INTEGER PRIMARY KEY,
    Code     TEXT NOT NULL UNIQUE,
    Name     TEXT NOT NULL,
    LandCost INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ResearchBranches (
    Id   INTEGER PRIMARY KEY,
    Name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS HeroRarities (
    Id        INTEGER PRIMARY KEY,
    Name      TEXT NOT NULL UNIQUE,
    SortOrder INTEGER NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS ResearchNodes (
    Id          INTEGER PRIMARY KEY,
    Code        TEXT NOT NULL UNIQUE,
    Name        TEXT NOT NULL,
    BranchId    INTEGER NOT NULL REFERENCES ResearchBranches(Id),
    Tier        INTEGER NOT NULL,
    Slot        INTEGER NOT NULL,
    CostGold    INTEGER NULL,
    CostMana    INTEGER NULL,
    Description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ResearchPrerequisites (
    ResearchId             INTEGER NOT NULL REFERENCES ResearchNodes(Id) ON DELETE CASCADE,
    PrerequisiteResearchId INTEGER NOT NULL REFERENCES ResearchNodes(Id) ON DELETE CASCADE,
    PRIMARY KEY (ResearchId, PrerequisiteResearchId)
);

CREATE TABLE IF NOT EXISTS Heroes (
    Id                  INTEGER PRIMARY KEY,
    Code                TEXT NOT NULL UNIQUE,
    Name                TEXT NOT NULL,
    Icon                TEXT NOT NULL,
    RarityId            INTEGER NOT NULL REFERENCES HeroRarities(Id),
    CostGold            INTEGER NOT NULL,
    CostMana            INTEGER NULL,
    RequiredTavernLevel INTEGER NULL,
    Description         TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS HeroResearchPrerequisites (
    HeroId     INTEGER NOT NULL REFERENCES Heroes(Id) ON DELETE CASCADE,
    ResearchId INTEGER NOT NULL REFERENCES ResearchNodes(Id) ON DELETE CASCADE,
    PRIMARY KEY (HeroId, ResearchId)
);

-- =============================================================
-- 2. Per-player runtime tables
-- =============================================================
CREATE TABLE IF NOT EXISTS Players (
    Id               TEXT    PRIMARY KEY,
    UserId           TEXT    NOT NULL UNIQUE,
    Name             TEXT    NOT NULL,
    RaceId           INTEGER NULL REFERENCES Races(Id),
    Phase            TEXT    NOT NULL DEFAULT 'CREATION_RACE',
    ActionPoints     INTEGER NOT NULL DEFAULT 100,
    MaxActionPoints  INTEGER NOT NULL DEFAULT 100,
    Spies            INTEGER NOT NULL DEFAULT 0,
    Blooddolls       INTEGER NOT NULL DEFAULT 0,
    Acres            INTEGER NOT NULL DEFAULT 100,
    Population       REAL    NOT NULL DEFAULT 100,
    CreatedAt        TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Single wide row per player. Denormalized by design.
-- REAL because resources accrue fractionally via production multipliers.
CREATE TABLE IF NOT EXISTS PlayerResources (
    PlayerId TEXT PRIMARY KEY REFERENCES Players(Id) ON DELETE CASCADE,
    Gold     REAL NOT NULL DEFAULT 0,
    Wood     REAL NOT NULL DEFAULT 0,
    Food     REAL NOT NULL DEFAULT 0,
    Mana     REAL NOT NULL DEFAULT 0,
    Iron     REAL NOT NULL DEFAULT 0,
    Blood    REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS PlayerStartingResources (
    PlayerId       TEXT    NOT NULL REFERENCES Players(Id) ON DELETE CASCADE,
    ResourceTypeId INTEGER NOT NULL REFERENCES ResourceTypes(Id),
    PRIMARY KEY (PlayerId, ResourceTypeId)
);

CREATE TABLE IF NOT EXISTS PlayerUnlockedResources (
    PlayerId       TEXT    NOT NULL REFERENCES Players(Id) ON DELETE CASCADE,
    ResourceTypeId INTEGER NOT NULL REFERENCES ResourceTypes(Id),
    PRIMARY KEY (PlayerId, ResourceTypeId)
);

CREATE TABLE IF NOT EXISTS PlayerBuildings (
    PlayerId       TEXT    NOT NULL REFERENCES Players(Id) ON DELETE CASCADE,
    BuildingTypeId INTEGER NOT NULL REFERENCES BuildingTypes(Id),
    Level          INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (PlayerId, BuildingTypeId)
);

CREATE TABLE IF NOT EXISTS PlayerWorkers (
    PlayerId       TEXT    NOT NULL REFERENCES Players(Id) ON DELETE CASCADE,
    ResourceTypeId INTEGER NOT NULL REFERENCES ResourceTypes(Id),
    WorkerTypeId   INTEGER NOT NULL REFERENCES WorkerTypes(Id),
    Count          INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (PlayerId, ResourceTypeId, WorkerTypeId)
);

CREATE TABLE IF NOT EXISTS PlayerTroops (
    PlayerId    TEXT    NOT NULL REFERENCES Players(Id) ON DELETE CASCADE,
    TroopTierId INTEGER NOT NULL REFERENCES TroopTiers(Id),
    Count       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (PlayerId, TroopTierId)
);

CREATE TABLE IF NOT EXISTS PlayerResearch (
    PlayerId    TEXT    NOT NULL REFERENCES Players(Id) ON DELETE CASCADE,
    ResearchId  INTEGER NOT NULL REFERENCES ResearchNodes(Id),
    UnlockedAt  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (PlayerId, ResearchId)
);

CREATE TABLE IF NOT EXISTS PlayerHeroes (
    PlayerId   TEXT    NOT NULL REFERENCES Players(Id) ON DELETE CASCADE,
    HeroId     INTEGER NOT NULL REFERENCES Heroes(Id),
    AcquiredAt TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (PlayerId, HeroId)
);

-- Wizard Tower state. One row per player (created lazily on first save).
-- LastRaidJson is a display-only blob (RaidReportDto) — the server never
-- reads it, so JSON keeps the schema simple.
CREATE TABLE IF NOT EXISTS PlayerWizardry (
    PlayerId     TEXT PRIMARY KEY REFERENCES Players(Id) ON DELETE CASCADE,
    Wizards      INTEGER NOT NULL DEFAULT 0,
    NextRaidAt   INTEGER NOT NULL DEFAULT 0,
    LastRaidJson TEXT NULL
);

-- Built schools of magic and their level (1-5). School codes are
-- client-defined strings ('defence', 'attack', ...) like spell ids below.
CREATE TABLE IF NOT EXISTS PlayerSpellSchools (
    PlayerId TEXT    NOT NULL REFERENCES Players(Id) ON DELETE CASCADE,
    School   TEXT    NOT NULL,
    Level    INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (PlayerId, School)
);

CREATE TABLE IF NOT EXISTS PlayerSpells (
    PlayerId TEXT NOT NULL REFERENCES Players(Id) ON DELETE CASCADE,
    SpellId  TEXT NOT NULL,
    PRIMARY KEY (PlayerId, SpellId)
);

CREATE TABLE IF NOT EXISTS PlayerSpellBuffs (
    PlayerId  TEXT    NOT NULL REFERENCES Players(Id) ON DELETE CASCADE,
    SpellId   TEXT    NOT NULL,
    ExpiresAt INTEGER NOT NULL,
    PRIMARY KEY (PlayerId, SpellId)
);

-- Timed attack missions in flight. Id is the frontend-generated mission id;
-- StartedAt/EndsAt are ms since epoch (JS Date.now()) — resolution happens
-- client-side, the server only persists missions across sessions.
CREATE TABLE IF NOT EXISTS PlayerAttacks (
    Id        TEXT    NOT NULL,
    PlayerId  TEXT    NOT NULL REFERENCES Players(Id) ON DELETE CASCADE,
    Type      TEXT    NOT NULL,
    Tier1     INTEGER NOT NULL DEFAULT 0,
    Tier2     INTEGER NOT NULL DEFAULT 0,
    Tier3     INTEGER NOT NULL DEFAULT 0,
    StartedAt INTEGER NOT NULL,
    EndsAt    INTEGER NOT NULL,
    PRIMARY KEY (PlayerId, Id)
);

-- =============================================================
-- 3. Catalog seed data (small lookups only; heroes + research in their own files)
-- =============================================================
INSERT OR IGNORE INTO Races (Id, Name) VALUES
    (1, 'Human'),
    (2, 'Elven'),
    (3, 'Dwarf'),
    (4, 'Orc'),
    (5, 'Vampire');

INSERT OR IGNORE INTO ResourceTypes (Id, Name) VALUES
    (1, 'Gold'),
    (2, 'Wood'),
    (3, 'Food'),
    (4, 'Mana'),
    (5, 'Iron');

INSERT OR IGNORE INTO WorkerTypes (Id, Name) VALUES
    (1, 'basic'),
    (2, 'panda');

INSERT OR IGNORE INTO TroopTiers (Id, Name, Tier) VALUES
    (1, 'tier1', 1),
    (2, 'tier2', 2),
    (3, 'tier3', 3);

INSERT OR IGNORE INTO ResearchBranches (Id, Name) VALUES
    (1, 'military'),
    (2, 'economy'),
    (3, 'civic'),
    (4, 'construction'),
    (5, 'espionage'),
    (6, 'magic'),
    (7, 'warfare');

INSERT OR IGNORE INTO HeroRarities (Id, Name, SortOrder) VALUES
    (1, 'common',    1),
    (2, 'uncommon',  2),
    (3, 'rare',      3),
    (4, 'epic',      4),
    (5, 'legendary', 5);

-- BuildingTypes: 5 resource buildings + Barracks + Housing + Tavern.
-- LandCost from BUILDING_LAND in src/store/gameStore.ts:135.
INSERT OR IGNORE INTO BuildingTypes (Id, Code, Name, LandCost) VALUES
    (1, 'Food',     'Farm',     5),
    (2, 'Wood',     'Lumber',   2),
    (3, 'Iron',     'Mine',     1),
    (4, 'Gold',     'Treasury', 1),
    (5, 'Mana',     'Sanctum',  0),
    (6, 'Housing',  'Housing',  1),
    (7, 'Barracks', 'Barracks', 1),
    (8, 'Tavern',   'Tavern',   2),
    (9, 'WizardTower', 'Wizard Tower', 2);

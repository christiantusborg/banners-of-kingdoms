-- Hero catalog. Translated from HEROES in src/store/gameStore.ts:224-259.
-- Rarity IDs: common=1, uncommon=2, rare=3, epic=4, legendary=5
-- Research IDs referenced below match the IDs assigned in seed_research.sql.

INSERT OR IGNORE INTO Heroes (Id, Code, Name, Icon, RarityId, CostGold, CostMana, RequiredTavernLevel, Description) VALUES
    -- Common (1 000 g)
    (1,  'town_crier',     'Town Crier',     '🗣️',  1,  1000, NULL, NULL, 'Population growth +50%'),
    (2,  'innkeeper',      'Innkeeper',      '🍺',  1,  1000, NULL, NULL, 'Tavern & Housing upgrade cost -25%'),
    (3,  'village_elder',  'Village Elder',  '👴',  1,  1000, NULL, NULL, '+5 Gold per tick (flat)'),
    (4,  'wandering_bard', 'Wandering Bard', '🎻',  1,  1000, NULL, NULL, 'AP regen 20% faster'),
    (5,  'pickpocket',     'Pickpocket',     '🪙',  1,  1000, NULL, NULL, 'Each Spy +1 Gold per tick'),

    -- Uncommon (3 000 g)
    (6,  'master_farmer',     'Master Farmer',     '🌾',  2,  3000, NULL, NULL, 'Food production +50%'),
    (7,  'master_lumberjack', 'Master Lumberjack', '🪓',  2,  3000, NULL, NULL, 'Wood production +50%'),
    (8,  'foreman_mines',     'Foreman of Mines',  '⛏️',  2,  3000, NULL, NULL, 'Iron + Gold production +50%'),
    (9,  'arcane_researcher', 'Arcane Researcher', '🔮',  2,  3000, NULL, NULL, 'Mana production +25%, research Mana costs -15%'),
    (10, 'trade_baron',       'Trade Baron',       '⚖️',  2,  3000, NULL, NULL, 'Market ratio -1'),
    (11, 'royal_weaponsmith', 'Royal Weaponsmith', '🗡️',  2,  3000, NULL, NULL, 'All troops attack +1'),
    (12, 'master_armorer',    'Master Armorer',    '🛡️',  2,  3000, NULL, NULL, 'All troops defense +1'),
    (13, 'veteran_scout',     'Veteran Scout',     '🐎',  2,  3000, NULL, NULL, 'Explore gives 1.5x acres'),
    (14, 'drill_sergeant',    'Drill Sergeant',    '📣',  2,  3000, NULL, NULL, 'Troop training Food/Iron -50%'),
    (15, 'master_builder',    'Master Builder',    '🏗️',  2,  3000, NULL, NULL, 'Building Gold/Wood costs -25%'),

    -- Rare (10 000 g)
    (16, 'war_general',         'War General',         '⚔️',  3, 10000, NULL, NULL, 'Conquest gains +50% acres'),
    (17, 'cunning_tactician',   'Cunning Tactician',   '🎯',  3, 10000, NULL, NULL, 'Conquest troop losses halved'),
    (18, 'court_architect',     'Court Architect',     '🏛️',  3, 10000, NULL, NULL, 'Each Housing level +10 pop cap'),
    (19, 'royal_steward',       'Royal Steward',       '👑',  3, 10000, NULL, NULL, 'Max AP +50, regen 2x faster'),
    (20, 'spymaster',           'Spymaster',           '🕵️',  3, 10000, NULL, NULL, 'Each Spy +3 Gold and +1 random resource/tick'),
    (21, 'battlefield_surgeon', 'Battlefield Surgeon', '🚑',  3, 10000, NULL, NULL, '25% of Conquest losses revive as Tier 1'),
    (22, 'loremaster',          'Loremaster',          '📚',  3, 10000, NULL, NULL, 'All research Gold costs -20%'),

    -- Epic (25 000 g)
    (23, 'knight_commander', 'Knight Commander', '🛡️', 4, 25000, NULL, NULL, 'All troops +15% attack & defense'),
    (24, 'archmagus',        'Archmagus',        '🧙', 4, 25000, NULL, NULL, 'All research costs (gold & mana) -30%'),
    (26, 'grand_marshal',    'Grand Marshal',    '🎖️', 4, 25000, NULL, NULL, '+1 simultaneous attack'),

    -- Legendary (50 000 g + 1 000 m, requires Tavern 8 + archmage research)
    (25, 'dragon_rider', 'Dragon Rider', '🐉', 5, 50000, 1000, 8, 'Conquest 0% losses, +25 bonus acres, all troops +10% atk/def');

INSERT OR IGNORE INTO HeroResearchPrerequisites (HeroId, ResearchId) VALUES
    (25, 49); -- dragon_rider <- archmage

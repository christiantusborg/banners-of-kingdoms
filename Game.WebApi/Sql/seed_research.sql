-- Research catalog. Translated from RESEARCH in src/store/gameStore.ts:161-222.
-- Branch IDs: military=1, economy=2, civic=3, construction=4, espionage=5, magic=6
-- ResearchNode IDs assigned sequentially below.

INSERT OR IGNORE INTO ResearchNodes (Id, Code, Name, BranchId, Tier, Slot, CostGold, CostMana, Description) VALUES
    -- Military
    (1,  'iron_weapons',    'Iron Weapons',    1, 1, 1,   500, NULL, 'Tier 1 attack +1'),
    (2,  'steel_weapons',   'Steel Weapons',   1, 2, 1,  1500, NULL, 'Tier 1 attack +2, Tier 2 attack +1'),
    (3,  'forged_blades',   'Forged Blades',   1, 3, 1,  4000, NULL, 'Tier 2 attack +2, Tier 3 attack +1'),
    (4,  'master_smithing', 'Master Smithing', 1, 4, 1, 10000, NULL, 'Tier 3 attack +3 (also requires Mining)'),
    (5,  'leather_armor',   'Leather Armor',   1, 1, 2,   500, NULL, 'Tier 1 defense +1'),
    (6,  'chain_mail',      'Chain Mail',      1, 2, 2,  1500, NULL, 'Tier 1 def +2, Tier 2 def +1'),
    (7,  'plate_armor',     'Plate Armor',     1, 3, 2,  4000, NULL, 'Tier 2 def +2, Tier 3 def +1'),
    (8,  'tempered_steel',  'Tempered Steel',  1, 4, 2, 10000, NULL, 'Tier 3 def +3 (also requires Mining)'),
    (9,  'drill',           'Drill',           1, 1, 3,  1000, NULL, 'Troops consume 25% less Food'),
    (10, 'quartermaster',   'Quartermaster',   1, 2, 3,  3000, NULL, 'Troop Gold maintenance -25%'),
    (11, 'war_banners',     'War Banners',     1, 3, 3,  8000, NULL, 'Conquest gains +50% acres'),

    -- Economy
    (12, 'agriculture',           'Agriculture',           2, 1, 1,   500, NULL, 'Food production +25%'),
    (13, 'forestry',              'Forestry',              2, 1, 2,   500, NULL, 'Wood production +25%'),
    (14, 'mining',                'Mining',                2, 1, 3,   500, NULL, 'Iron and Gold production +25%'),
    (15, 'crop_rotation',         'Crop Rotation',         2, 2, 1,  2000, NULL, 'Food +50% (stacks -> +75%)'),
    (16, 'lumber_mill',           'Lumber Mill',           2, 2, 2,  2000, NULL, 'Wood +50% (stacks -> +75%)'),
    (17, 'deep_shafts',           'Deep Shafts',           2, 2, 3,  2000, NULL, 'Iron + Gold +50% (stacks)'),
    (18, 'industrial_revolution', 'Industrial Revolution', 2, 3, 2,  8000, NULL, 'All resource production +25% (multiplicative)'),
    (19, 'banking',               'Banking',               2, 1, 4,  1000, NULL, 'Market ratio 5:1 -> 4:1'),
    (20, 'free_trade',            'Free Trade',            2, 2, 4,  4000, NULL, 'Market ratio 4:1 -> 3:1'),
    (21, 'merchant_guild',        'Merchant Guild',        2, 3, 4, 10000, NULL, 'Market ratio 3:1 -> 2:1'),

    -- Civic
    (22, 'architecture', 'Architecture', 3, 1, 1,  500, NULL, 'Each Housing level: +5 pop cap (-> 15/level)'),
    (23, 'plumbing',     'Plumbing',     3, 2, 1, 1500, NULL, 'Population growth rate x2'),
    (24, 'sanitation',   'Sanitation',   3, 3, 1, 3000, NULL, 'Housing: +10 pop/level more (-> 25/level)'),
    (25, 'census',       'Census',       3, 4, 1, 8000, NULL, 'Worker cap per resource building 5 -> 10'),
    (26, 'bureaucracy',  'Bureaucracy',  3, 1, 2, 1000, NULL, 'Max Action Points 100 -> 150'),
    (27, 'stewardship',  'Stewardship',  3, 2, 2, 3000, NULL, 'AP regen 120s -> 60s'),
    (28, 'royal_decree', 'Royal Decree', 3, 3, 2, 8000, NULL, 'Max AP 150 -> 250, regen 30s'),

    -- Construction
    (29, 'engineering',    'Engineering',    4, 1, 1,  500, NULL, 'Building Gold cost -25%'),
    (30, 'foundations',    'Foundations',    4, 2, 1, 1500, NULL, 'Building Wood cost -25%'),
    (31, 'surveying',      'Surveying',      4, 2, 2, 2000, NULL, 'Building land cost -1 (min 1)'),
    (32, 'megastructures', 'Megastructures', 4, 3, 2, 6000, NULL, 'Building land cost halved (rounded down, min 1)'),

    -- Espionage
    (33, 'espionage_101', 'Espionage 101', 5, 1, 1,  1000, NULL, 'Each Spy generates +2 Gold per tick'),
    (34, 'subterfuge',    'Subterfuge',    5, 2, 1,  3000, NULL, 'Each Spy also +1 random resource per tick'),
    (35, 'sabotage',      'Sabotage',      5, 3, 1,  6000, NULL, 'Kidnap costs 1 troop instead of 2'),
    (36, 'master_spies',  'Master Spies',  5, 4, 1, 10000, NULL, 'Spies count as Tier 1 troops for attack/defense'),

    -- Magic
    (37, 'mana_awakening',   'Mana Awakening',   6, 1, 2, 2000, NULL, 'Unlocks the Magic tree. +5 base Mana production'),
    (38, 'spark',            'Spark',            6, 2, 1, NULL,  100, 'Conquest now costs 5% troops (was 10%)'),
    (39, 'mending',          'Mending',          6, 2, 2, NULL,  100, 'Half of Conquest troop losses return as Tier 1'),
    (40, 'scrying',          'Scrying',          6, 2, 3, NULL,  100, 'Spy hire/fire no longer costs AP'),
    (41, 'fireball',         'Fireball',         6, 3, 1, NULL,  300, 'Each Conquest grants +5 acres bonus'),
    (42, 'greater_heal',     'Greater Heal',     6, 3, 2, NULL,  300, 'Population growth rate +50%'),
    (43, 'minds_eye',        'Mind''s Eye',      6, 3, 3, NULL,  300, 'Each Spy +1 random resource per tick (stacks)'),
    (44, 'conjure_familiar', 'Conjure Familiar', 6, 3, 4, NULL,  400, 'All troops +5% attack and +5% defense'),
    (45, 'inferno',          'Inferno',          6, 4, 1, NULL,  800, 'Conquest costs 0% troops (no losses)'),
    (46, 'sanctuary',        'Sanctuary',        6, 4, 2, NULL,  800, 'Locked resources still produce at half rate'),
    (47, 'charm',            'Charm',            6, 4, 3, NULL,  800, 'Spies count as peasants for population attack/defense bonus'),
    (48, 'elemental_pact',   'Elemental Pact',   6, 4, 4, NULL, 1000, 'All resource production +50% (multiplicative)'),
    (49, 'archmage',         'Archmage',         6, 5, 3, NULL, 2500, 'Capstone: +25% troop stats, +100 max AP');

INSERT OR IGNORE INTO ResearchPrerequisites (ResearchId, PrerequisiteResearchId) VALUES
    -- Military
    (2,  1),                            -- steel_weapons   <- iron_weapons
    (3,  2),                            -- forged_blades   <- steel_weapons
    (4,  3), (4, 14),                   -- master_smithing <- forged_blades, mining
    (6,  5),                            -- chain_mail      <- leather_armor
    (7,  6),                            -- plate_armor     <- chain_mail
    (8,  7), (8, 14),                   -- tempered_steel  <- plate_armor, mining
    (10, 9),                            -- quartermaster   <- drill
    (11, 10),                           -- war_banners     <- quartermaster

    -- Economy
    (15, 12),                           -- crop_rotation   <- agriculture
    (16, 13),                           -- lumber_mill     <- forestry
    (17, 14),                           -- deep_shafts     <- mining
    (18, 15), (18, 16), (18, 17),       -- industrial_rev. <- all three
    (20, 19),                           -- free_trade      <- banking
    (21, 20),                           -- merchant_guild  <- free_trade

    -- Civic
    (23, 22),                           -- plumbing        <- architecture
    (24, 23),                           -- sanitation      <- plumbing
    (25, 24),                           -- census          <- sanitation
    (27, 26),                           -- stewardship     <- bureaucracy
    (28, 27),                           -- royal_decree    <- stewardship

    -- Construction
    (30, 29),                           -- foundations     <- engineering
    (31, 29),                           -- surveying       <- engineering
    (32, 30), (32, 31),                 -- megastructures  <- foundations, surveying

    -- Espionage
    (34, 33),                           -- subterfuge      <- espionage_101
    (35, 34),                           -- sabotage        <- subterfuge
    (36, 35),                           -- master_spies    <- sabotage

    -- Magic
    (38, 37),                           -- spark           <- mana_awakening
    (39, 37),                           -- mending         <- mana_awakening
    (40, 37),                           -- scrying         <- mana_awakening
    (41, 38),                           -- fireball        <- spark
    (42, 39),                           -- greater_heal    <- mending
    (43, 40),                           -- minds_eye       <- scrying
    (44, 38), (44, 39),                 -- conjure_familiar <- spark, mending
    (45, 41),                           -- inferno         <- fireball
    (46, 42),                           -- sanctuary       <- greater_heal
    (47, 43),                           -- charm           <- minds_eye
    (48, 44), (48, 40),                 -- elemental_pact  <- conjure_familiar, scrying
    (49, 45), (49, 46), (49, 47), (49, 48); -- archmage    <- inferno, sanctuary, charm, elemental_pact

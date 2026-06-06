namespace Game.WebApi.Dtos;

// Mirrors the GameState shape in src/store/gameStore.ts so the frontend can PUT/GET
// without translation. Catalog references (research, heroes, buildings, resources)
// are sent as their string code (e.g. "iron_weapons", "Gold") matching the seeded
// Code/Name columns. The server resolves to FK IDs when persisting.

public class GameStateDto
{
    public PlayerDto Player { get; set; } = new();
    public ProvinceDto Province { get; set; } = new();
    public MilitaryDto Military { get; set; } = new();
    public Dictionary<string, int> Buildings { get; set; } = new();
    // Resources tick with fractional production multipliers, so they're doubles.
    public Dictionary<string, double> Resources { get; set; } = new();
    public Dictionary<string, WorkerStateDto> Workers { get; set; } = new();
    public string Phase { get; set; } = "CREATION_RACE";
    public List<string> Research { get; set; } = new();
    public List<string> Heroes { get; set; } = new();
    public List<AttackDto> Attacks { get; set; } = new();
    public int Wizards { get; set; }
    public SpellStateDto Spells { get; set; } = new();
    // Vampire-specific sub-pop + resource. Always present so the round-trip
    // is symmetric for every race (non-vampires save/load these as 0).
    public int Blooddolls { get; set; }
    public double Blood { get; set; }
}

public class PlayerDto
{
    public string Name { get; set; } = "Player";
    public string? Race { get; set; }
    public List<string> StartingResources { get; set; } = new();
    public List<string> UnlockedResources { get; set; } = new();
    public int ActionPoints { get; set; } = 100;
    public int MaxActionPoints { get; set; } = 100;
    public int Spies { get; set; }
}

public class ProvinceDto
{
    public int Acres { get; set; } = 100;
    // Population grows fractionally each tick.
    public double Population { get; set; } = 100;
}

public class MilitaryDto
{
    public int Tier1 { get; set; }
    public int Tier2 { get; set; }
    public int Tier3 { get; set; }
}

public class WorkerStateDto
{
    public int Basic { get; set; }
    public int Panda { get; set; }
}

// A timed attack mission. The game logic (launch costs, resolution rewards)
// lives entirely in the frontend; the server just persists the missions so
// they survive logout. Timestamps are ms-since-epoch to match Date.now().
public class AttackDto
{
    public string Id { get; set; } = "";
    public string Type { get; set; } = "";
    public int Tier1 { get; set; }
    public int Tier2 { get; set; }
    public int Tier3 { get; set; }
    public long StartedAt { get; set; }
    public long EndsAt { get; set; }
}

// Wizard Tower state. Like attacks, all game logic (spell effects, raid
// resolution) is client-side; the server persists the state so buffs and
// the raid schedule survive logout. Timestamps are ms since epoch.
public class SpellStateDto
{
    public Dictionary<string, int> Schools { get; set; } = new();
    public List<string> Researched { get; set; } = new();
    public List<SpellBuffDto> Buffs { get; set; } = new();
    public long NextRaidAt { get; set; }
    public RaidReportDto? LastRaid { get; set; }
}

public class SpellBuffDto
{
    public string SpellId { get; set; } = "";
    public long ExpiresAt { get; set; }
}

public class RaidReportDto
{
    public long At { get; set; }
    public int Strength { get; set; }
    public int Defense { get; set; }
    public bool Won { get; set; }
    public bool Repelled { get; set; }
    public int LootGold { get; set; }
}

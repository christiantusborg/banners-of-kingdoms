using System.Data;
using Game.WebApi.Dtos;
using Microsoft.Data.Sqlite;

namespace Game.WebApi.Services;

public class GameStateRepository
{
    private readonly string _connectionString;

    public GameStateRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("DefaultConnection missing.");
    }

    public async Task<GameStateDto?> LoadAsync(string userId, CancellationToken ct)
    {
        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync(ct);

        var playerRow = await QuerySingleAsync(conn,
            @"SELECT p.Id, p.Name, r.Name AS RaceName, p.Phase, p.ActionPoints, p.MaxActionPoints,
                     p.Spies, p.Blooddolls, p.Acres, p.Population
              FROM Players p LEFT JOIN Races r ON r.Id = p.RaceId
              WHERE p.UserId = $userId",
            new() { ["$userId"] = userId }, ct);

        if (playerRow is null) return null;

        var playerId = (string)playerRow["Id"];
        var dto = new GameStateDto
        {
            Phase = (string)playerRow["Phase"],
            Player = new PlayerDto
            {
                Name = (string)playerRow["Name"],
                Race = playerRow["RaceName"] as string,
                ActionPoints = Convert.ToInt32(playerRow["ActionPoints"]),
                MaxActionPoints = Convert.ToInt32(playerRow["MaxActionPoints"]),
                Spies = Convert.ToInt32(playerRow["Spies"]),
            },
            Province = new ProvinceDto
            {
                Acres = Convert.ToInt32(playerRow["Acres"]),
                Population = Convert.ToDouble(playerRow["Population"]),
            },
            Blooddolls = Convert.ToInt32(playerRow["Blooddolls"]),
        };

        var resRow = await QuerySingleAsync(conn,
            "SELECT Gold, Wood, Food, Mana, Iron, Blood FROM PlayerResources WHERE PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct);
        if (resRow is not null)
        {
            dto.Resources["Gold"] = Convert.ToDouble(resRow["Gold"]);
            dto.Resources["Wood"] = Convert.ToDouble(resRow["Wood"]);
            dto.Resources["Food"] = Convert.ToDouble(resRow["Food"]);
            dto.Resources["Mana"] = Convert.ToDouble(resRow["Mana"]);
            dto.Resources["Iron"] = Convert.ToDouble(resRow["Iron"]);
            dto.Blood = Convert.ToDouble(resRow["Blood"]);
        }

        var military = await QueryListAsync(conn,
            @"SELECT t.Tier, COALESCE(pt.Count, 0) AS Count
              FROM TroopTiers t LEFT JOIN PlayerTroops pt
                ON pt.TroopTierId = t.Id AND pt.PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct);
        foreach (var row in military)
        {
            var tier = Convert.ToInt32(row["Tier"]);
            var count = Convert.ToInt32(row["Count"]);
            if (tier == 1) dto.Military.Tier1 = count;
            else if (tier == 2) dto.Military.Tier2 = count;
            else if (tier == 3) dto.Military.Tier3 = count;
        }

        var buildings = await QueryListAsync(conn,
            @"SELECT bt.Code, COALESCE(pb.Level, 0) AS Level
              FROM BuildingTypes bt LEFT JOIN PlayerBuildings pb
                ON pb.BuildingTypeId = bt.Id AND pb.PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct);
        foreach (var row in buildings)
        {
            dto.Buildings[(string)row["Code"]] = Convert.ToInt32(row["Level"]);
        }

        foreach (var resName in new[] { "Gold", "Wood", "Food", "Mana", "Iron" })
        {
            dto.Workers[resName] = new WorkerStateDto();
        }
        var workers = await QueryListAsync(conn,
            @"SELECT rt.Name AS ResourceName, wt.Name AS WorkerName, pw.Count
              FROM PlayerWorkers pw
              JOIN ResourceTypes rt ON rt.Id = pw.ResourceTypeId
              JOIN WorkerTypes wt   ON wt.Id = pw.WorkerTypeId
              WHERE pw.PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct);
        foreach (var row in workers)
        {
            var res = (string)row["ResourceName"];
            var worker = (string)row["WorkerName"];
            var count = Convert.ToInt32(row["Count"]);
            if (!dto.Workers.ContainsKey(res)) dto.Workers[res] = new WorkerStateDto();
            if (worker == "basic") dto.Workers[res].Basic = count;
            else if (worker == "panda") dto.Workers[res].Panda = count;
        }

        dto.Player.StartingResources = (await QueryListAsync(conn,
            @"SELECT rt.Name FROM PlayerStartingResources psr
              JOIN ResourceTypes rt ON rt.Id = psr.ResourceTypeId
              WHERE psr.PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct))
            .Select(r => (string)r["Name"]).ToList();

        dto.Player.UnlockedResources = (await QueryListAsync(conn,
            @"SELECT rt.Name FROM PlayerUnlockedResources pur
              JOIN ResourceTypes rt ON rt.Id = pur.ResourceTypeId
              WHERE pur.PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct))
            .Select(r => (string)r["Name"]).ToList();

        dto.Research = (await QueryListAsync(conn,
            @"SELECT rn.Code FROM PlayerResearch pr
              JOIN ResearchNodes rn ON rn.Id = pr.ResearchId
              WHERE pr.PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct))
            .Select(r => (string)r["Code"]).ToList();

        dto.Heroes = (await QueryListAsync(conn,
            @"SELECT h.Code FROM PlayerHeroes ph
              JOIN Heroes h ON h.Id = ph.HeroId
              WHERE ph.PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct))
            .Select(r => (string)r["Code"]).ToList();

        dto.Attacks = (await QueryListAsync(conn,
            @"SELECT Id, Type, Tier1, Tier2, Tier3, StartedAt, EndsAt
              FROM PlayerAttacks WHERE PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct))
            .Select(r => new AttackDto
            {
                Id = (string)r["Id"],
                Type = (string)r["Type"],
                Tier1 = Convert.ToInt32(r["Tier1"]),
                Tier2 = Convert.ToInt32(r["Tier2"]),
                Tier3 = Convert.ToInt32(r["Tier3"]),
                StartedAt = Convert.ToInt64(r["StartedAt"]),
                EndsAt = Convert.ToInt64(r["EndsAt"]),
            }).ToList();

        return dto;
    }

    public async Task SaveAsync(string userId, string fallbackName, GameStateDto state, CancellationToken ct)
    {
        await using var conn = new SqliteConnection(_connectionString);
        await conn.OpenAsync(ct);
        await using var tx = (SqliteTransaction)await conn.BeginTransactionAsync(ct);

        var existingPlayerId = (string?)await ExecScalarAsync(conn, tx,
            "SELECT Id FROM Players WHERE UserId = $userId",
            new() { ["$userId"] = userId }, ct);

        var playerId = existingPlayerId ?? Guid.NewGuid().ToString();
        int? raceId = state.Player.Race is null
            ? null
            : Convert.ToInt32(await ExecScalarAsync(conn, tx,
                "SELECT Id FROM Races WHERE Name = $name",
                new() { ["$name"] = state.Player.Race }, ct));

        var name = string.IsNullOrWhiteSpace(state.Player.Name) ? fallbackName : state.Player.Name;

        if (existingPlayerId is null)
        {
            await ExecNonQueryAsync(conn, tx,
                @"INSERT INTO Players
                  (Id, UserId, Name, RaceId, Phase, ActionPoints, MaxActionPoints, Spies, Blooddolls, Acres, Population)
                  VALUES ($id, $userId, $name, $raceId, $phase, $ap, $maxAp, $spies, $bd, $acres, $pop)",
                new()
                {
                    ["$id"] = playerId,
                    ["$userId"] = userId,
                    ["$name"] = name,
                    ["$raceId"] = (object?)raceId ?? DBNull.Value,
                    ["$phase"] = state.Phase,
                    ["$ap"] = state.Player.ActionPoints,
                    ["$maxAp"] = state.Player.MaxActionPoints,
                    ["$spies"] = state.Player.Spies,
                    ["$bd"] = state.Blooddolls,
                    ["$acres"] = state.Province.Acres,
                    ["$pop"] = state.Province.Population,
                }, ct);
        }
        else
        {
            await ExecNonQueryAsync(conn, tx,
                @"UPDATE Players SET
                    Name = $name, RaceId = $raceId, Phase = $phase,
                    ActionPoints = $ap, MaxActionPoints = $maxAp, Spies = $spies,
                    Blooddolls = $bd, Acres = $acres, Population = $pop
                  WHERE Id = $id",
                new()
                {
                    ["$id"] = playerId,
                    ["$name"] = name,
                    ["$raceId"] = (object?)raceId ?? DBNull.Value,
                    ["$phase"] = state.Phase,
                    ["$ap"] = state.Player.ActionPoints,
                    ["$maxAp"] = state.Player.MaxActionPoints,
                    ["$spies"] = state.Player.Spies,
                    ["$bd"] = state.Blooddolls,
                    ["$acres"] = state.Province.Acres,
                    ["$pop"] = state.Province.Population,
                }, ct);
        }

        var gold = state.Resources.GetValueOrDefault("Gold");
        var wood = state.Resources.GetValueOrDefault("Wood");
        var food = state.Resources.GetValueOrDefault("Food");
        var mana = state.Resources.GetValueOrDefault("Mana");
        var iron = state.Resources.GetValueOrDefault("Iron");
        await ExecNonQueryAsync(conn, tx,
            @"INSERT INTO PlayerResources (PlayerId, Gold, Wood, Food, Mana, Iron, Blood)
              VALUES ($pid, $g, $w, $f, $m, $i, $b)
              ON CONFLICT(PlayerId) DO UPDATE SET
                Gold = excluded.Gold, Wood = excluded.Wood, Food = excluded.Food,
                Mana = excluded.Mana, Iron = excluded.Iron, Blood = excluded.Blood",
            new()
            {
                ["$pid"] = playerId,
                ["$g"] = gold, ["$w"] = wood, ["$f"] = food, ["$m"] = mana, ["$i"] = iron,
                ["$b"] = state.Blood,
            }, ct);

        await ExecNonQueryAsync(conn, tx, "DELETE FROM PlayerBuildings WHERE PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct);
        var buildingIds = await LookupIdsAsync(conn, tx, "BuildingTypes", "Code", state.Buildings.Keys, ct);
        foreach (var (code, level) in state.Buildings)
        {
            if (!buildingIds.TryGetValue(code, out var btId)) continue;
            await ExecNonQueryAsync(conn, tx,
                "INSERT INTO PlayerBuildings (PlayerId, BuildingTypeId, Level) VALUES ($pid, $bt, $lvl)",
                new() { ["$pid"] = playerId, ["$bt"] = btId, ["$lvl"] = level }, ct);
        }

        await ExecNonQueryAsync(conn, tx, "DELETE FROM PlayerTroops WHERE PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct);
        var troopTiers = await DictAsync(conn, tx, "SELECT Tier, Id FROM TroopTiers", ct);
        foreach (var (tier, count) in new[] { (1, state.Military.Tier1), (2, state.Military.Tier2), (3, state.Military.Tier3) })
        {
            if (count <= 0) continue;
            var key = tier.ToString();
            if (!troopTiers.TryGetValue(key, out var tid)) continue;
            await ExecNonQueryAsync(conn, tx,
                "INSERT INTO PlayerTroops (PlayerId, TroopTierId, Count) VALUES ($pid, $t, $c)",
                new() { ["$pid"] = playerId, ["$t"] = tid, ["$c"] = count }, ct);
        }

        await ExecNonQueryAsync(conn, tx, "DELETE FROM PlayerWorkers WHERE PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct);
        var resIds = await LookupIdsAsync(conn, tx, "ResourceTypes", "Name", state.Workers.Keys, ct);
        var workerTypeIds = await DictAsync(conn, tx, "SELECT Name, Id FROM WorkerTypes", ct);
        foreach (var (resName, worker) in state.Workers)
        {
            if (!resIds.TryGetValue(resName, out var rid)) continue;
            foreach (var (workerName, count) in new[] { ("basic", worker.Basic), ("panda", worker.Panda) })
            {
                if (count <= 0) continue;
                if (!workerTypeIds.TryGetValue(workerName, out var wid)) continue;
                await ExecNonQueryAsync(conn, tx,
                    "INSERT INTO PlayerWorkers (PlayerId, ResourceTypeId, WorkerTypeId, Count) VALUES ($pid, $r, $w, $c)",
                    new() { ["$pid"] = playerId, ["$r"] = rid, ["$w"] = wid, ["$c"] = count }, ct);
            }
        }

        await ReplaceResourceJunctionAsync(conn, tx, "PlayerStartingResources", playerId, state.Player.StartingResources, ct);
        await ReplaceResourceJunctionAsync(conn, tx, "PlayerUnlockedResources", playerId, state.Player.UnlockedResources, ct);

        await ExecNonQueryAsync(conn, tx, "DELETE FROM PlayerResearch WHERE PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct);
        if (state.Research.Count > 0)
        {
            var researchIds = await LookupIdsAsync(conn, tx, "ResearchNodes", "Code", state.Research, ct);
            foreach (var code in state.Research)
            {
                if (!researchIds.TryGetValue(code, out var rid)) continue;
                await ExecNonQueryAsync(conn, tx,
                    "INSERT INTO PlayerResearch (PlayerId, ResearchId) VALUES ($pid, $r)",
                    new() { ["$pid"] = playerId, ["$r"] = rid }, ct);
            }
        }

        await ExecNonQueryAsync(conn, tx, "DELETE FROM PlayerHeroes WHERE PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct);
        if (state.Heroes.Count > 0)
        {
            var heroIds = await LookupIdsAsync(conn, tx, "Heroes", "Code", state.Heroes, ct);
            foreach (var code in state.Heroes)
            {
                if (!heroIds.TryGetValue(code, out var hid)) continue;
                await ExecNonQueryAsync(conn, tx,
                    "INSERT INTO PlayerHeroes (PlayerId, HeroId) VALUES ($pid, $h)",
                    new() { ["$pid"] = playerId, ["$h"] = hid }, ct);
            }
        }

        await ExecNonQueryAsync(conn, tx, "DELETE FROM PlayerAttacks WHERE PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct);
        foreach (var attack in state.Attacks)
        {
            if (string.IsNullOrEmpty(attack.Id)) continue;
            await ExecNonQueryAsync(conn, tx,
                @"INSERT INTO PlayerAttacks (Id, PlayerId, Type, Tier1, Tier2, Tier3, StartedAt, EndsAt)
                  VALUES ($id, $pid, $type, $t1, $t2, $t3, $start, $end)",
                new()
                {
                    ["$id"] = attack.Id,
                    ["$pid"] = playerId,
                    ["$type"] = attack.Type,
                    ["$t1"] = attack.Tier1,
                    ["$t2"] = attack.Tier2,
                    ["$t3"] = attack.Tier3,
                    ["$start"] = attack.StartedAt,
                    ["$end"] = attack.EndsAt,
                }, ct);
        }

        await tx.CommitAsync(ct);
    }

    private static async Task ReplaceResourceJunctionAsync(
        SqliteConnection conn, SqliteTransaction tx, string table,
        string playerId, IEnumerable<string> resourceNames, CancellationToken ct)
    {
        await ExecNonQueryAsync(conn, tx, $"DELETE FROM {table} WHERE PlayerId = $pid",
            new() { ["$pid"] = playerId }, ct);
        var resIds = await LookupIdsAsync(conn, tx, "ResourceTypes", "Name", resourceNames, ct);
        foreach (var (name, id) in resIds)
        {
            await ExecNonQueryAsync(conn, tx,
                $"INSERT OR IGNORE INTO {table} (PlayerId, ResourceTypeId) VALUES ($pid, $r)",
                new() { ["$pid"] = playerId, ["$r"] = id }, ct);
        }
    }

    private static async Task<Dictionary<string, int>> LookupIdsAsync(
        SqliteConnection conn, SqliteTransaction tx, string table, string keyColumn,
        IEnumerable<string> keys, CancellationToken ct)
    {
        var distinct = keys.Where(k => !string.IsNullOrEmpty(k)).Distinct().ToList();
        var result = new Dictionary<string, int>();
        if (distinct.Count == 0) return result;
        var placeholders = string.Join(",", distinct.Select((_, i) => $"$k{i}"));
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = $"SELECT {keyColumn}, Id FROM {table} WHERE {keyColumn} IN ({placeholders})";
        for (var i = 0; i < distinct.Count; i++)
        {
            cmd.Parameters.AddWithValue($"$k{i}", distinct[i]);
        }
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            result[reader.GetString(0)] = reader.GetInt32(1);
        }
        return result;
    }

    private static async Task<Dictionary<string, int>> DictAsync(
        SqliteConnection conn, SqliteTransaction tx, string sql, CancellationToken ct)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = sql;
        var dict = new Dictionary<string, int>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            dict[reader.GetValue(0).ToString()!] = reader.GetInt32(1);
        }
        return dict;
    }

    private static async Task<int> ExecNonQueryAsync(
        SqliteConnection conn, SqliteTransaction tx, string sql,
        Dictionary<string, object> parameters, CancellationToken ct)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = sql;
        foreach (var (key, value) in parameters)
        {
            cmd.Parameters.AddWithValue(key, value);
        }
        return await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task<object?> ExecScalarAsync(
        SqliteConnection conn, SqliteTransaction tx, string sql,
        Dictionary<string, object> parameters, CancellationToken ct)
    {
        var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = sql;
        foreach (var (key, value) in parameters)
        {
            cmd.Parameters.AddWithValue(key, value);
        }
        var result = await cmd.ExecuteScalarAsync(ct);
        return result == DBNull.Value ? null : result;
    }

    private static async Task<Dictionary<string, object>?> QuerySingleAsync(
        SqliteConnection conn, string sql,
        Dictionary<string, object> parameters, CancellationToken ct)
    {
        var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        foreach (var (key, value) in parameters)
        {
            cmd.Parameters.AddWithValue(key, value);
        }
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        var row = new Dictionary<string, object>();
        for (var i = 0; i < reader.FieldCount; i++)
        {
            row[reader.GetName(i)] = reader.IsDBNull(i) ? null! : reader.GetValue(i);
        }
        return row;
    }

    private static async Task<List<Dictionary<string, object>>> QueryListAsync(
        SqliteConnection conn, string sql,
        Dictionary<string, object> parameters, CancellationToken ct)
    {
        var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        foreach (var (key, value) in parameters)
        {
            cmd.Parameters.AddWithValue(key, value);
        }
        var rows = new List<Dictionary<string, object>>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var row = new Dictionary<string, object>();
            for (var i = 0; i < reader.FieldCount; i++)
            {
                row[reader.GetName(i)] = reader.IsDBNull(i) ? null! : reader.GetValue(i);
            }
            rows.Add(row);
        }
        return rows;
    }
}

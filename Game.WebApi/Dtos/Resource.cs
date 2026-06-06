namespace Game.WebApi.Dtos;

public class ResourceToUser
{
    public Guid UserId  { get; set; }
    public Guid ResourceId { get; set; }
    public int Count { get; set; }
    public int Work  { get; set; }
    public int Booster { get; set; }
    public int UnUsedClick  { get; set; }
}

public class Resource
{
    public Guid ResourceId { get; set; }
    public string Name { get; set; }
}

public class TroopType
{
    public Guid TroopTypeId { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string Image { get; set; }
    public int Attack  { get; set; }
    public int Defense { get; set; }
    public double GoldCost { get; set; }
    public double FoodCost { get; set; }
} 


public class Troop
{
    public Guid UserId  { get; set; }
    public Guid TroopId { get; set; }
    public int Count { get; set; }
}



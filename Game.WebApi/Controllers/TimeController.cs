using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Game.WebApi.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/time")]
public class TimeController : ControllerBase
{
    // Single source of truth for day/night. Day = 07:00 – 18:59 server-local.
    [HttpGet]
    public IActionResult Get()
    {
        var now = DateTimeOffset.Now;
        var hour = now.Hour;
        return Ok(new
        {
            serverTime = now.ToString("o"),
            serverHour = hour,
            isNight = hour < 7 || hour >= 19,
        });
    }
}

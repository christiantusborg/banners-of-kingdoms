using System.Security.Claims;
using Game.WebApi.Dtos;
using Game.WebApi.Models;
using Game.WebApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace Game.WebApi.Controllers;

[ApiController]
[Authorize]
[Route("api/game")]
public class GameStateController : ControllerBase
{
    private readonly GameStateRepository _repo;
    private readonly UserManager<ApplicationUser> _userManager;

    public GameStateController(GameStateRepository repo, UserManager<ApplicationUser> userManager)
    {
        _repo = repo;
        _userManager = userManager;
    }

    [HttpGet("state")]
    [ProducesResponseType(typeof(GameStateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var state = await _repo.LoadAsync(userId, ct);
        if (state is null) return NoContent();
        return Ok(state);
    }

    [HttpPut("state")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Put([FromBody] GameStateDto state, CancellationToken ct)
    {
        var userId = GetUserId();
        if (userId is null) return Unauthorized();

        var user = await _userManager.FindByIdAsync(userId);
        var fallbackName = user?.DisplayName ?? user?.Email ?? "Player";

        await _repo.SaveAsync(userId, fallbackName, state, ct);
        return NoContent();
    }

    private string? GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
}

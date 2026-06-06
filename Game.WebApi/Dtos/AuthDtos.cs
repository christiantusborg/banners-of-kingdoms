using System.ComponentModel.DataAnnotations;

namespace Game.WebApi.Dtos;

public record RegisterRequest(
    [Required, EmailAddress] string Email,
    [Required, MinLength(3), MaxLength(64)] string DisplayName,
    [Required, MinLength(8), MaxLength(128)] string Password);

public record LoginRequest(
    [Required, EmailAddress] string Email,
    [Required] string Password);

public record AuthResponse(
    string Token,
    DateTime ExpiresAt,
    string UserId,
    string Email,
    string DisplayName);

public record MeResponse(
    string UserId,
    string Email,
    string DisplayName,
    DateTime CreatedAt);

public record ErrorResponse(string Message, IDictionary<string, string[]>? Errors = null);

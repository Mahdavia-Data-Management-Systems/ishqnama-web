namespace Ishqnama.Application.Dtos;

public sealed record FavoriteDto(
    string Id,
    string Kind,
    string? ListId,
    string Title,
    DateTimeOffset CreatedAt);

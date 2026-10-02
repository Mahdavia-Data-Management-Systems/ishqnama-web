using Ishqnama.Application.Dtos;

namespace Ishqnama.Api.Contracts;

public sealed record CreateBookmarkRequest(string Title, string Icon);

public sealed record UpdatePositionRequest(int ChapterNumber, int VerseNumber);

public sealed record HistoryRequest(string Title, string Url);

public sealed record VerseListDetailsRequest(string? Title, string? Description);

public sealed record VerseListGroupsRequest(List<VerseListGroupDto>? Groups);

public sealed record FavoriteRequest(string? Kind, string? ListId);

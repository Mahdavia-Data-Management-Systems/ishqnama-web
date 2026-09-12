namespace Ishqnama.Api.Contracts;

public sealed record CreateBookmarkRequest(string Title, string Icon);

public sealed record UpdatePositionRequest(int ChapterNumber, int VerseNumber);

public sealed record HistoryRequest(string Title, string Url);

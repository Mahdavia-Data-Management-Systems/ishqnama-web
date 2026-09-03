using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;

namespace Ishqnama.Application.Services;

public sealed class SearchService(IQuranReadOnlyRepository repository)
{
    public async Task<PagedResponse<SearchResultDto>> SearchAsync(
        string query, string scope, int translationId, int page, int pageSize)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 50);
        return await repository.SearchAsync(query, scope, translationId, page, pageSize);
    }
}

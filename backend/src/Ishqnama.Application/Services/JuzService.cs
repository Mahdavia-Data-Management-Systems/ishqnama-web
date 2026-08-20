using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;

namespace Ishqnama.Application.Services;

public sealed class JuzService(IQuranReadOnlyRepository repository)
{
    public Task<List<JuzDto>> GetAllJuzAsync()
        => repository.GetAllJuzAsync();

    public async Task<PagedResponse<VerseDto>?> GetJuzVersesAsync(
        int juzNumber, int? translationId, int page, int pageSize)
    {
        if (!await repository.JuzExistsAsync(juzNumber))
            return null;

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);
        return await repository.GetJuzVersesAsync(juzNumber, translationId, page, pageSize);
    }
}

using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;

namespace Ishqnama.Application.Services;

public sealed class RukuService(IQuranReadOnlyRepository repository)
{
    public Task<List<RukuDto>> GetRukusAsync(int? chapterNum = null, int? juzNum = null)
        => repository.GetRukusAsync(chapterNum, juzNum);

    public async Task<List<VerseDto>?> GetRukuVersesAsync(int rukuId, int? translationId = null)
    {
        if (!await repository.RukuExistsAsync(rukuId))
            return null;
        return await repository.GetRukuVersesAsync(rukuId, translationId);
    }
}

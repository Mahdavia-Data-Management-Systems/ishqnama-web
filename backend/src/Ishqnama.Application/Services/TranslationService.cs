using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;

namespace Ishqnama.Application.Services;

public sealed class TranslationService(IQuranReadOnlyRepository repository)
{
    public Task<List<TranslationDto>> GetTranslationsAsync()
        => repository.GetTranslationsAsync();
}

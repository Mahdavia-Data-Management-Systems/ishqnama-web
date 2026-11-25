using Ishqnama.Application.Dtos;
using Ishqnama.Application.Interfaces;

namespace Ishqnama.Application.Services;

public sealed class BibliographyService(IQuranReadOnlyRepository repository)
{
    public Task<List<BibliographyBookDto>> GetBibliographyAsync()
        => repository.GetBibliographyAsync();
}

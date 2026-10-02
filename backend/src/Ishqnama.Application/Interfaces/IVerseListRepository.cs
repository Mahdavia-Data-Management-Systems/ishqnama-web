using Ishqnama.Domain.Entities;

namespace Ishqnama.Application.Interfaces;

public interface IVerseListRepository
{
    Task<VerseList?> GetAsync(string id);
    Task<IReadOnlyList<VerseList>> GetManyAsync(IReadOnlyCollection<string> ids);
    Task<IReadOnlyList<VerseList>> GetByOwnerAsync(string ownerId);
    Task<int> CountByOwnerAsync(string ownerId);
    Task CreateAsync(VerseList list);

    /// <summary>
    /// Reads the list, applies <paramref name="mutate"/> and writes it back, retrying when another
    /// write landed in between (so "Add to list" from the reader never loses an editor's change).
    /// Throws <see cref="KeyNotFoundException"/> when the list does not exist; exceptions thrown by
    /// <paramref name="mutate"/> propagate without writing.
    /// </summary>
    Task<VerseList> UpdateAsync(string id, Action<VerseList> mutate);

    Task DeleteAsync(string id);
}

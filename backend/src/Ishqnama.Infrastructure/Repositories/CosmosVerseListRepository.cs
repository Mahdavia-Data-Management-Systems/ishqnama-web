using System.Net;
using Ishqnama.Application.Interfaces;
using Ishqnama.Domain.Entities;
using Microsoft.Azure.Cosmos;

namespace Ishqnama.Infrastructure.Repositories;

/// <summary>
/// Verse lists in their own container, partitioned by <c>/id</c>: a shared link is a point read,
/// and an owner's lists are a small cross-partition query on <c>ownerId</c>.
/// </summary>
public sealed class CosmosVerseListRepository(
    CosmosClient cosmosClient,
    string databaseName,
    string containerName) : IVerseListRepository
{
    private const int MaxUpdateAttempts = 5;

    private readonly Container _container = cosmosClient.GetContainer(databaseName, containerName);

    public async Task<VerseList?> GetAsync(string id)
    {
        try
        {
            var response = await _container.ReadItemAsync<VerseList>(id, new PartitionKey(id));
            return response.Resource;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<IReadOnlyList<VerseList>> GetManyAsync(IReadOnlyCollection<string> ids)
    {
        if (ids.Count == 0)
            return [];
        var response = await _container.ReadManyItemsAsync<VerseList>(
            ids.Select(id => (id, new PartitionKey(id))).ToList());
        return response.Resource.ToList();
    }

    public async Task<IReadOnlyList<VerseList>> GetByOwnerAsync(string ownerId)
    {
        var query = new QueryDefinition(
                "SELECT * FROM c WHERE c.ownerId = @ownerId ORDER BY c.updatedAt DESC")
            .WithParameter("@ownerId", ownerId);

        var results = new List<VerseList>();
        using var feed = _container.GetItemQueryIterator<VerseList>(query);
        while (feed.HasMoreResults)
        {
            var page = await feed.ReadNextAsync();
            results.AddRange(page);
        }
        return results;
    }

    public async Task<int> CountByOwnerAsync(string ownerId)
    {
        var query = new QueryDefinition("SELECT VALUE COUNT(1) FROM c WHERE c.ownerId = @ownerId")
            .WithParameter("@ownerId", ownerId);

        var total = 0;
        using var feed = _container.GetItemQueryIterator<int>(query);
        while (feed.HasMoreResults)
        {
            var page = await feed.ReadNextAsync();
            total += page.Sum();
        }
        return total;
    }

    public Task CreateAsync(VerseList list)
        => _container.CreateItemAsync(list, new PartitionKey(list.Id));

    public async Task<VerseList> UpdateAsync(string id, Action<VerseList> mutate)
    {
        var pk = new PartitionKey(id);
        for (var attempt = 1; ; attempt++)
        {
            ItemResponse<VerseList> current;
            try
            {
                current = await _container.ReadItemAsync<VerseList>(id, pk);
            }
            catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
            {
                throw new KeyNotFoundException($"List '{id}' not found.");
            }

            var list = current.Resource;
            mutate(list);

            try
            {
                await _container.ReplaceItemAsync(list, id, pk,
                    new ItemRequestOptions { IfMatchEtag = current.ETag });
                return list;
            }
            catch (CosmosException ex) when (
                ex.StatusCode == HttpStatusCode.PreconditionFailed && attempt < MaxUpdateAttempts)
            {
                // Another write landed between the read and the replace: read it and apply again
            }
            catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
            {
                throw new KeyNotFoundException($"List '{id}' not found.");
            }
        }
    }

    public async Task DeleteAsync(string id)
    {
        try
        {
            await _container.DeleteItemAsync<VerseList>(id, new PartitionKey(id));
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            // Already deleted — no-op
        }
    }
}

using System.Text.Json;
using Ishqnama.Application.Dtos;
using Ishqnama.Application.Mappings;
using Ishqnama.Domain.Entities;

namespace Ishqnama.Application.Tests;

public sealed class BibliographyMappingTests
{
    private static readonly Book Tabari = new()
    {
        BookId = 1, Title = "جامع البيان", Author = "ابن جرير الطبري", AuthorDeathYearHijri = 310
    };

    private static readonly Book Musnad = new() { BookId = 2, Title = "مسند أحمد", Kind = "mahdavi" };

    private static readonly Book Uncited = new() { BookId = 3, Title = "كتاب" };

    private static readonly Dictionary<(int Chapter, int Verse), int> Rukus = new()
    {
        [(2, 146)] = 19,
        [(2, 255)] = 36,
        [(3, 7)] = 43,
    };

    private static int _nextSegmentId = 1;

    private static TranslationSegment Segment(
        int chapter, int verse, int index, params (short Ordinal, short Sort, Book Book, string Reference)[] citations)
    {
        var id = _nextSegmentId++;
        return new TranslationSegment
        {
            TranslationSegmentId = id,
            TranslationId = 2,
            ChapterNumber = chapter,
            VerseNumber = verse,
            SegmentIndex = index,
            Citations = citations.Select(c => new TranslationSegmentCitation
            {
                TranslationSegmentId = id,
                BlockOrdinal = c.Ordinal,
                SortOrder = c.Sort,
                BookId = c.Book.BookId,
                Book = c.Book,
                Reference = c.Reference,
            }).ToList(),
        };
    }

    private static List<BibliographyBookDto> Bibliography() => new[]
    {
        Segment(3, 7, 0, (1, 1, Tabari, "3:7")),
        Segment(2, 255, 1, (1, 2, Tabari, "2:255 s1 b1-2"), (1, 1, Musnad, "musnad")),
        Segment(2, 255, 0, (2, 1, Tabari, "2:255 s0 b2"), (1, 1, Tabari, "2:255 s0 b1")),
        Segment(2, 146, 0),
    }.ToBibliography(Rukus);

    [Fact]
    public void Books_come_most_cited_first_and_uncited_books_are_left_out()
    {
        var books = Bibliography();

        Assert.Equal([Tabari.BookId, Musnad.BookId], books.Select(b => b.BookId));
        Assert.Equal([4, 1], books.Select(b => b.CitationCount));
        Assert.DoesNotContain(books, b => b.BookId == Uncited.BookId);
    }

    [Fact]
    public void A_book_carries_its_own_fields()
    {
        var books = Bibliography();

        Assert.Equal(("جامع البيان", "ابن جرير الطبري", 310, null),
            (books[0].Title, books[0].Author, books[0].AuthorDeathYearHijri, books[0].Kind));
        Assert.Equal(("مسند أحمد", null, null, "mahdavi"),
            (books[1].Title, books[1].Author, books[1].AuthorDeathYearHijri, books[1].Kind));
    }

    [Fact]
    public void Citations_run_in_reading_order_with_their_ruku()
    {
        var citations = Bibliography()[0].Citations!;

        Assert.Equal(
            ["2:255 s0 b1", "2:255 s0 b2", "2:255 s1 b1-2", "3:7"],
            citations.Select(c => c.Reference));
        Assert.Equal([36, 36, 36, 43], citations.Select(c => c.RukuId));
        Assert.Equal((3, 7), (citations[3].ChapterNumber, citations[3].VerseNumber));
    }

    [Fact]
    public void The_count_equals_the_number_of_citations()
        => Assert.All(Bibliography(), b => Assert.Equal(b.Citations!.Count, b.CitationCount));

    [Fact]
    public void The_wire_shape_is_camel_case()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        using var json = JsonDocument.Parse(JsonSerializer.Serialize(Bibliography(), options));
        var book = json.RootElement[0];
        Assert.Equal(1, book.GetProperty("bookId").GetInt32());
        Assert.Equal(4, book.GetProperty("citationCount").GetInt32());
        Assert.Equal(310, book.GetProperty("authorDeathYearHijri").GetInt32());
        Assert.Equal(JsonValueKind.Null, book.GetProperty("kind").ValueKind);

        var citation = book.GetProperty("citations")[0];
        Assert.Equal(2, citation.GetProperty("chapterNumber").GetInt32());
        Assert.Equal(255, citation.GetProperty("verseNumber").GetInt32());
        Assert.Equal(36, citation.GetProperty("rukuId").GetInt32());
        Assert.Equal(JsonValueKind.Null, citation.GetProperty("note").ValueKind);
    }
}

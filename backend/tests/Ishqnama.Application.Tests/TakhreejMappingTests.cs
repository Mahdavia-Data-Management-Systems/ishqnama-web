using System.Text.Json;
using Ishqnama.Application.Dtos;
using Ishqnama.Application.Mappings;
using Ishqnama.Domain.Entities;

namespace Ishqnama.Application.Tests;

public sealed class TakhreejMappingTests
{
    private static readonly Book Tabari = new()
    {
        BookId = 1, Title = "جامع البيان", Author = "ابن جرير الطبري", AuthorDeathYearHijri = 310, Kind = "tafsir"
    };

    private static readonly Book Musnad = new() { BookId = 2, Title = "مسند أحمد" };

    private static TranslationSegment Segment(params TranslationSegmentCitation[] citations) => new()
    {
        TranslationSegmentId = 7,
        TranslationId = 2,
        ChapterNumber = 2,
        VerseNumber = 146,
        SegmentIndex = 0,
        TranslationText = "translation",
        Explanation = "<mark>passage<ins data-takhreej=\"1\"></ins></mark>",
        Citations = citations,
    };

    private static TranslationSegmentCitation Citation(
        short ordinal, short sortOrder, Book book,
        string? reference = null, string? note = null, string? url = null) => new()
    {
        TranslationSegmentId = 7,
        BlockOrdinal = ordinal,
        SortOrder = sortOrder,
        BookId = book.BookId,
        Book = book,
        Reference = reference,
        Note = note,
        Url = url,
    };

    [Fact]
    public void A_segment_without_citations_has_null_takhreej()
    {
        var dto = Segment().ToDto();

        Assert.Null(dto.Takhreej);
        Assert.Equal("translation", dto.TranslationText);
        Assert.NotNull(dto.Explanation);
    }

    [Fact]
    public void Blocks_come_in_ordinal_order_and_citations_in_sort_order()
    {
        var dto = Segment(
            Citation(2, 2, Tabari, "b2-s2"),
            Citation(1, 3, Tabari, "b1-s3"),
            Citation(2, 1, Musnad, "b2-s1"),
            Citation(1, 1, Musnad, "b1-s1"),
            Citation(1, 2, Tabari, "b1-s2")).ToDto();

        Assert.NotNull(dto.Takhreej);
        Assert.Equal([1, 2], dto.Takhreej.Select(b => b.Ordinal));
        Assert.Equal(["b1-s1", "b1-s2", "b1-s3"], dto.Takhreej[0].Citations.Select(c => c.Reference));
        Assert.Equal(["b2-s1", "b2-s2"], dto.Takhreej[1].Citations.Select(c => c.Reference));
    }

    [Fact]
    public void A_citation_carries_all_six_fields()
    {
        var dto = Segment(
            Citation(1, 1, Tabari, "ج ٢ ص ٢٧٣", "عن ابن عباس", "https://example.org/tabari/2/273")).ToDto();

        var citation = Assert.Single(Assert.Single(dto.Takhreej!).Citations);
        Assert.Equal(
            new CitationDto(
                "جامع البيان", "ابن جرير الطبري", 310,
                "ج ٢ ص ٢٧٣", "عن ابن عباس", "https://example.org/tabari/2/273"),
            citation);
    }

    [Fact]
    public void Missing_author_year_reference_note_and_url_stay_null()
    {
        var dto = Segment(Citation(1, 1, Musnad)).ToDto();

        var citation = Assert.Single(Assert.Single(dto.Takhreej!).Citations);
        Assert.Equal(new CitationDto("مسند أحمد", null, null, null, null, null), citation);
    }

    [Fact]
    public void The_wire_shape_is_camel_case_with_null_takhreej_for_a_plain_segment()
    {
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);

        using var cited = JsonDocument.Parse(JsonSerializer.Serialize(
            Segment(Citation(1, 1, Musnad, "ح ٨")).ToDto(), options));
        var block = cited.RootElement.GetProperty("takhreej")[0];
        Assert.Equal(1, block.GetProperty("ordinal").GetInt32());
        var citation = block.GetProperty("citations")[0];
        Assert.Equal("مسند أحمد", citation.GetProperty("title").GetString());
        Assert.Equal(JsonValueKind.Null, citation.GetProperty("author").ValueKind);
        Assert.Equal(JsonValueKind.Null, citation.GetProperty("authorDeathYearHijri").ValueKind);
        Assert.Equal("ح ٨", citation.GetProperty("reference").GetString());
        Assert.Equal(JsonValueKind.Null, citation.GetProperty("note").ValueKind);
        Assert.Equal(JsonValueKind.Null, citation.GetProperty("url").ValueKind);

        using var plain = JsonDocument.Parse(JsonSerializer.Serialize(Segment().ToDto(), options));
        Assert.Equal(JsonValueKind.Null, plain.RootElement.GetProperty("takhreej").ValueKind);
    }
}

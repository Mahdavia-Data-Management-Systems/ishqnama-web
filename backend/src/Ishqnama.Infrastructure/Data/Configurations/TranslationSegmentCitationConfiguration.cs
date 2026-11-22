using Ishqnama.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ishqnama.Infrastructure.Data.Configurations;

public sealed class TranslationSegmentCitationConfiguration : IEntityTypeConfiguration<TranslationSegmentCitation>
{
    public void Configure(EntityTypeBuilder<TranslationSegmentCitation> builder)
    {
        builder.ToTable("TranslationSegmentCitations");
        builder.HasKey(c => c.CitationId);

        builder.Property(c => c.CitationId).ValueGeneratedOnAdd();

        builder.HasOne(c => c.TranslationSegment)
            .WithMany(ts => ts.Citations)
            .HasForeignKey(c => c.TranslationSegmentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Book)
            .WithMany(b => b.Citations)
            .HasForeignKey(c => c.BookId)
            .OnDelete(DeleteBehavior.NoAction);

        // Named by string: an anonymous-type key expression adds a trim warning (IL2026) to the API image.
        builder.HasIndex(
                nameof(TranslationSegmentCitation.TranslationSegmentId),
                nameof(TranslationSegmentCitation.BlockOrdinal),
                nameof(TranslationSegmentCitation.SortOrder))
            .IsUnique();
    }
}

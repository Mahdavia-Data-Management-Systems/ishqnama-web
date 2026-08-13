using Ishqnama.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ishqnama.Api.Data.Configurations;

public sealed class TranslationSegmentConfiguration : IEntityTypeConfiguration<TranslationSegment>
{
    public void Configure(EntityTypeBuilder<TranslationSegment> builder)
    {
        builder.ToTable("TranslationSegments", t =>
            t.HasCheckConstraint("CK_TranslationSegments_HasContent",
                "\"TranslationText\" IS NOT NULL OR \"Explanation\" IS NOT NULL"));

        builder.HasKey(ts => ts.TranslationSegmentId);

        builder.Property(ts => ts.TranslationSegmentId).ValueGeneratedOnAdd();
        builder.Property(ts => ts.SegmentIndex).HasDefaultValue(0);

        builder.HasOne(ts => ts.Translation)
            .WithMany(t => t.TranslationSegments)
            .HasForeignKey(ts => ts.TranslationId);

        builder.HasOne(ts => ts.Verse)
            .WithMany(v => v.TranslationSegments)
            .HasForeignKey(ts => new { ts.ChapterNumber, ts.VerseNumber });

        builder.HasIndex(ts => new { ts.TranslationId, ts.ChapterNumber, ts.VerseNumber, ts.SegmentIndex })
            .IsUnique();

        builder.HasIndex(ts => new { ts.ChapterNumber, ts.VerseNumber })
            .HasDatabaseName("IX_TranslationSegments_Verse");
    }
}

using Ishqnama.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ishqnama.Infrastructure.Data.Configurations;

public sealed class ChapterTranslationConfiguration : IEntityTypeConfiguration<ChapterTranslation>
{
    public void Configure(EntityTypeBuilder<ChapterTranslation> builder)
    {
        builder.ToTable("ChapterTranslations");
        builder.HasKey(ct => new { ct.ChapterNumber, ct.LanguageCode });

        builder.Property(ct => ct.LanguageCode).HasMaxLength(10);
        builder.Property(ct => ct.TranslatedName).IsRequired();

        builder.HasOne(ct => ct.Chapter)
            .WithMany(c => c.ChapterTranslations)
            .HasForeignKey(ct => ct.ChapterNumber);

        builder.HasOne(ct => ct.Language)
            .WithMany(l => l.ChapterTranslations)
            .HasForeignKey(ct => ct.LanguageCode);

        builder.HasIndex(ct => ct.LanguageCode).HasDatabaseName("IX_ChapterTranslations_Language");
    }
}

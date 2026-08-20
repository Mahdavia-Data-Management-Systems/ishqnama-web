using Ishqnama.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ishqnama.Infrastructure.Data.Configurations;

public sealed class TranslationConfiguration : IEntityTypeConfiguration<Translation>
{
    public void Configure(EntityTypeBuilder<Translation> builder)
    {
        builder.ToTable("Translations");
        builder.HasKey(t => t.TranslationId);

        builder.Property(t => t.TranslationId).ValueGeneratedOnAdd();
        builder.Property(t => t.LanguageCode).HasMaxLength(10).IsRequired();
        builder.Property(t => t.ScriptCode).HasMaxLength(10).IsRequired();
        builder.Property(t => t.BookName).IsRequired();
        builder.Property(t => t.Translator).IsRequired();

        builder.HasOne(t => t.Language)
            .WithMany(l => l.Translations)
            .HasForeignKey(t => t.LanguageCode);

        builder.HasOne(t => t.Script)
            .WithMany(s => s.Translations)
            .HasForeignKey(t => t.ScriptCode);

        builder.HasIndex(t => new { t.LanguageCode, t.ScriptCode, t.BookName }).IsUnique();
    }
}

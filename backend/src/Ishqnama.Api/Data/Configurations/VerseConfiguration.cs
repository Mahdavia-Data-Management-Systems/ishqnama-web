using Ishqnama.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ishqnama.Api.Data.Configurations;

public sealed class VerseConfiguration : IEntityTypeConfiguration<Verse>
{
    public void Configure(EntityTypeBuilder<Verse> builder)
    {
        builder.ToTable("Verses");
        builder.HasKey(v => new { v.ChapterNumber, v.VerseNumber });

        builder.Property(v => v.ArabicText).IsRequired();
        builder.Property(v => v.HasSajdah).HasDefaultValue(false);

        builder.HasOne(v => v.Chapter)
            .WithMany(c => c.Verses)
            .HasForeignKey(v => v.ChapterNumber);

        builder.HasOne(v => v.Juz)
            .WithMany(j => j.Verses)
            .HasForeignKey(v => v.JuzNumber);

        builder.HasOne(v => v.Ruku)
            .WithMany(r => r.Verses)
            .HasForeignKey(v => v.RukuId);

        builder.HasOne(v => v.Manzil)
            .WithMany(m => m.Verses)
            .HasForeignKey(v => v.ManzilNumber);

        builder.HasIndex(v => v.JuzNumber).HasDatabaseName("IX_Verses_JuzNumber");
        builder.HasIndex(v => v.RukuId).HasDatabaseName("IX_Verses_RukuId");
        builder.HasIndex(v => v.ManzilNumber).HasDatabaseName("IX_Verses_ManzilNumber");
    }
}

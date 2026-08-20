using Ishqnama.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ishqnama.Infrastructure.Data.Configurations;

public sealed class RukuConfiguration : IEntityTypeConfiguration<Ruku>
{
    public void Configure(EntityTypeBuilder<Ruku> builder)
    {
        builder.ToTable("Rukus");
        builder.HasKey(r => r.RukuId);

        builder.Property(r => r.RukuId).ValueGeneratedOnAdd();

        builder.HasOne(r => r.Chapter)
            .WithMany(c => c.Rukus)
            .HasForeignKey(r => r.ChapterNumber);

        builder.HasOne(r => r.Juz)
            .WithMany(j => j.Rukus)
            .HasForeignKey(r => r.JuzNumber);

        builder.HasIndex(r => new { r.ChapterNumber, r.RankInChapter }).IsUnique();
        builder.HasIndex(r => r.ChapterNumber).HasDatabaseName("IX_Rukus_ChapterNumber");
        builder.HasIndex(r => r.JuzNumber).HasDatabaseName("IX_Rukus_JuzNumber");
    }
}

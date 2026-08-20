using Ishqnama.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ishqnama.Infrastructure.Data.Configurations;

public sealed class ChapterConfiguration : IEntityTypeConfiguration<Chapter>
{
    public void Configure(EntityTypeBuilder<Chapter> builder)
    {
        builder.ToTable("Chapters");
        builder.HasKey(c => c.ChapterNumber);

        builder.Property(c => c.ChapterNumber).ValueGeneratedNever();
        builder.Property(c => c.ArabicName).IsRequired();
        builder.Property(c => c.TransliteratedName).IsRequired();
        builder.Property(c => c.RevelationType).IsRequired();
    }
}

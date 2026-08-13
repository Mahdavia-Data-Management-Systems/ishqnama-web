using Ishqnama.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ishqnama.Api.Data.Configurations;

public sealed class LanguageConfiguration : IEntityTypeConfiguration<Language>
{
    public void Configure(EntityTypeBuilder<Language> builder)
    {
        builder.ToTable("Languages");
        builder.HasKey(l => l.LanguageCode);

        builder.Property(l => l.LanguageCode).HasMaxLength(10);
        builder.Property(l => l.Name).IsRequired();
        builder.Property(l => l.IsRTL).HasDefaultValue(false);
    }
}

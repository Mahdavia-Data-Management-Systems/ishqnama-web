using Ishqnama.Api.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ishqnama.Api.Data.Configurations;

public sealed class JuzConfiguration : IEntityTypeConfiguration<Juz>
{
    public void Configure(EntityTypeBuilder<Juz> builder)
    {
        builder.ToTable("Juz");
        builder.HasKey(j => j.JuzNumber);

        builder.Property(j => j.JuzNumber).ValueGeneratedNever();
        builder.Property(j => j.ArabicName).IsRequired();
        builder.Property(j => j.TransliteratedName).IsRequired();
    }
}

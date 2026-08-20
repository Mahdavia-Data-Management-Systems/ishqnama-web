using Ishqnama.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ishqnama.Infrastructure.Data.Configurations;

public sealed class ManzilConfiguration : IEntityTypeConfiguration<Manzil>
{
    public void Configure(EntityTypeBuilder<Manzil> builder)
    {
        builder.ToTable("Manzils");
        builder.HasKey(m => m.ManzilNumber);

        builder.Property(m => m.ManzilNumber).ValueGeneratedNever();
        builder.Property(m => m.ArabicName).IsRequired();
        builder.Property(m => m.TransliteratedName).IsRequired();
    }
}

using Ishqnama.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ishqnama.Infrastructure.Data.Configurations;

public sealed class ScriptConfiguration : IEntityTypeConfiguration<Script>
{
    public void Configure(EntityTypeBuilder<Script> builder)
    {
        builder.ToTable("Scripts");
        builder.HasKey(s => s.ScriptCode);

        builder.Property(s => s.ScriptCode).HasMaxLength(10);
        builder.Property(s => s.Name).IsRequired();
        builder.Property(s => s.IsRTL).HasDefaultValue(false);
    }
}

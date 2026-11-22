using Ishqnama.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Ishqnama.Infrastructure.Data.Configurations;

public sealed class BookConfiguration : IEntityTypeConfiguration<Book>
{
    public void Configure(EntityTypeBuilder<Book> builder)
    {
        builder.ToTable("Books");
        builder.HasKey(b => b.BookId);

        builder.Property(b => b.BookId).ValueGeneratedOnAdd();
        builder.Property(b => b.Title).IsRequired();

        // Named by string: an anonymous-type key expression adds a trim warning (IL2026) to the API image.
        builder.HasIndex(nameof(Book.Title), nameof(Book.Author))
            .IsUnique()
            .HasDatabaseName("UQ_Books_Title_Author");
    }
}

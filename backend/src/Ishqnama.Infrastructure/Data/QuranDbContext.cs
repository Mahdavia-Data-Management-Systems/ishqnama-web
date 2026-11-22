using Ishqnama.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Ishqnama.Infrastructure.Data;

public sealed class QuranDbContext(DbContextOptions<QuranDbContext> options) : DbContext(options)
{
    public DbSet<Language> Languages => Set<Language>();
    public DbSet<Script> Scripts => Set<Script>();
    public DbSet<Chapter> Chapters => Set<Chapter>();
    public DbSet<ChapterTranslation> ChapterTranslations => Set<ChapterTranslation>();
    public DbSet<Juz> Juz => Set<Juz>();
    public DbSet<Manzil> Manzils => Set<Manzil>();
    public DbSet<Ruku> Rukus => Set<Ruku>();
    public DbSet<Verse> Verses => Set<Verse>();
    public DbSet<Translation> Translations => Set<Translation>();
    public DbSet<TranslationSegment> TranslationSegments => Set<TranslationSegment>();
    public DbSet<Book> Books => Set<Book>();
    public DbSet<TranslationSegmentCitation> TranslationSegmentCitations => Set<TranslationSegmentCitation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(QuranDbContext).Assembly);
    }
}

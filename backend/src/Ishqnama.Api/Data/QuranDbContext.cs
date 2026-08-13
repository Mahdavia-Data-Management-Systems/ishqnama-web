using Ishqnama.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Ishqnama.Api.Data;

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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(QuranDbContext).Assembly);
    }
}

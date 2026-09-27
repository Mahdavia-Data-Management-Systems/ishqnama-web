import type { JuzDto } from "@/types/api";

/**
 * All 30 ajza of the Quran. The divisions never change, so they ship with the
 * app instead of being fetched from GET /api/juz. Snapshot of that endpoint.
 * A startVerse of 0 is the chapter's bismillah.
 */
export const JUZ: readonly JuzDto[] = [
  { juzNumber: 1, arabicName: "آلم", transliteratedName: "Alīf-Lām-Mīm", startChapter: 1, startVerse: 0, endChapter: 2, endVerse: 141 },
  { juzNumber: 2, arabicName: "سَيَقُولُ", transliteratedName: "Sayaqūlu", startChapter: 2, startVerse: 142, endChapter: 2, endVerse: 252 },
  { juzNumber: 3, arabicName: "تِلْكَ ٱلْرُّسُلُ", transliteratedName: "Tilka ’r-Rusulu", startChapter: 2, startVerse: 253, endChapter: 3, endVerse: 91 },
  { juzNumber: 4, arabicName: "لَنْ تَنَالُوْا", transliteratedName: "Lan Tanālu", startChapter: 3, startVerse: 92, endChapter: 4, endVerse: 23 },
  { juzNumber: 5, arabicName: "وَٱلْمُحْصَنَاتُ", transliteratedName: "Wa’l-muḥṣanātu", startChapter: 4, startVerse: 24, endChapter: 4, endVerse: 147 },
  { juzNumber: 6, arabicName: "لَا يُحِبُّ ٱللهُ", transliteratedName: "Lā yuḥibbu-’llāhu", startChapter: 4, startVerse: 148, endChapter: 5, endVerse: 82 },
  { juzNumber: 7, arabicName: "وَإِذَا سَمِعُوا", transliteratedName: "Wa ’Idha Samiʿū", startChapter: 5, startVerse: 83, endChapter: 6, endVerse: 110 },
  { juzNumber: 8, arabicName: "وَلَوْ أَنَّنَا", transliteratedName: "Wa-law annanā", startChapter: 6, startVerse: 111, endChapter: 7, endVerse: 87 },
  { juzNumber: 9, arabicName: "قَالَ ٱلْمَلَأُ", transliteratedName: "Qāla ’l-mala’u", startChapter: 7, startVerse: 88, endChapter: 8, endVerse: 40 },
  { juzNumber: 10, arabicName: "وَٱعْلَمُواْ", transliteratedName: "Wa-’aʿlamū", startChapter: 8, startVerse: 41, endChapter: 9, endVerse: 92 },
  { juzNumber: 11, arabicName: "يَعْتَذِرُونَ", transliteratedName: "Yaʿtazerūn", startChapter: 9, startVerse: 93, endChapter: 11, endVerse: 5 },
  { juzNumber: 12, arabicName: "وَمَا مِنْ دَآبَّةٍ", transliteratedName: "Wa mā min dābbatin", startChapter: 11, startVerse: 6, endChapter: 12, endVerse: 52 },
  { juzNumber: 13, arabicName: "وَمَا أُبَرِّئُ", transliteratedName: "Wa mā ubarri’u", startChapter: 12, startVerse: 53, endChapter: 15, endVerse: 1 },
  { juzNumber: 14, arabicName: "رُبَمَا", transliteratedName: "Alīf-Lām-Rā’/Rubamā", startChapter: 15, startVerse: 2, endChapter: 16, endVerse: 128 },
  { juzNumber: 15, arabicName: "سُبْحَانَ ٱلَّذِى", transliteratedName: "Subḥāna ’lladhī", startChapter: 17, startVerse: 0, endChapter: 18, endVerse: 74 },
  { juzNumber: 16, arabicName: "قَالَ أَلَمْ", transliteratedName: "Qāla ’alam", startChapter: 18, startVerse: 75, endChapter: 20, endVerse: 135 },
  { juzNumber: 17, arabicName: "ٱقْتَرَبَ لِلْنَّاسِ", transliteratedName: "Iqtaraba li’n-nāsi", startChapter: 21, startVerse: 0, endChapter: 22, endVerse: 78 },
  { juzNumber: 18, arabicName: "قَدْ أَفْلَحَ", transliteratedName: "Qad ’aflaḥa", startChapter: 23, startVerse: 0, endChapter: 25, endVerse: 20 },
  { juzNumber: 19, arabicName: "وَقَالَ ٱلَّذِينَ", transliteratedName: "Wa-qāla ’lladhīna", startChapter: 25, startVerse: 21, endChapter: 27, endVerse: 60 },
  { juzNumber: 20, arabicName: "أَمَّنْ خَلَقَ", transliteratedName: "’A’man Khalaqa", startChapter: 27, startVerse: 61, endChapter: 29, endVerse: 44 },
  { juzNumber: 21, arabicName: "وَلَا تُجَدِلُو", transliteratedName: "Wa la tujādilū", startChapter: 29, startVerse: 45, endChapter: 33, endVerse: 30 },
  { juzNumber: 22, arabicName: "وَمَنْ يَّقْنُتْ", transliteratedName: "Wa-man yaqnut", startChapter: 33, startVerse: 31, endChapter: 36, endVerse: 21 },
  { juzNumber: 23, arabicName: "وَمَآ لي", transliteratedName: "Wa-Mali", startChapter: 36, startVerse: 22, endChapter: 39, endVerse: 31 },
  { juzNumber: 24, arabicName: "فَمَنْ أَظْلَمُ", transliteratedName: "Fa-man ’aẓlamu", startChapter: 39, startVerse: 32, endChapter: 41, endVerse: 46 },
  { juzNumber: 25, arabicName: "إِلَيْهِ يُرَدُّ", transliteratedName: "Ilayhi yuraddu", startChapter: 41, startVerse: 47, endChapter: 45, endVerse: 37 },
  { juzNumber: 26, arabicName: "حم", transliteratedName: "Ḥā’ Mīm", startChapter: 46, startVerse: 0, endChapter: 51, endVerse: 30 },
  { juzNumber: 27, arabicName: "قَالَ فَمَا خَطْبُكُم", transliteratedName: "Qāla fa-mā khaṭbukum", startChapter: 51, startVerse: 31, endChapter: 57, endVerse: 29 },
  { juzNumber: 28, arabicName: "قَدْ سَمِعَ ٱللهُ", transliteratedName: "Qad samiʿa ’llāhu", startChapter: 58, startVerse: 0, endChapter: 66, endVerse: 12 },
  { juzNumber: 29, arabicName: "تَبَارَكَ ٱلَّذِى", transliteratedName: "Tabāraka ’lladhī", startChapter: 67, startVerse: 0, endChapter: 77, endVerse: 50 },
  { juzNumber: 30, arabicName: "عَمَّ", transliteratedName: "‘Amma", startChapter: 78, startVerse: 0, endChapter: 114, endVerse: 6 },
];

/** Juz by its number (1-30). */
export const JUZ_BY_NUMBER: ReadonlyMap<number, JuzDto> = new Map(JUZ.map((j) => [j.juzNumber, j]));

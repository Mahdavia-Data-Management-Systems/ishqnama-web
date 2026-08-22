export interface Verse {
  number: number;
  arabic: string;
  translations: {
    urdu: string;
    hindi: string;
    english: string;
  };
}

export const fatihaVerses: Verse[] = [
  {
    number: 1,
    arabic: "بِسْمِ اللَّهِ الرَّحْمَـٰنِ الرَّحِيمِ",
    translations: {
      urdu: "شروع اللہ کے نام سے جو بڑا مہربان نہایت رحم والا ہے",
      hindi: "अल्लाह के नाम से जो बड़ा मेहरबान निहायत रहम वाला है",
      english: "In the name of Allah, the Most Gracious, the Most Merciful.",
    },
  },
  {
    number: 2,
    arabic: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
    translations: {
      urdu: "سب تعریف اللہ کے لیے ہے جو تمام جہانوں کا پالنے والا ہے",
      hindi: "सब तारीफ़ अल्लाह के लिए है जो तमाम जहानों का पालने वाला है",
      english: "All praise is due to Allah, Lord of all the worlds.",
    },
  },
  {
    number: 3,
    arabic: "الرَّحْمَـٰنِ الرَّحِيمِ",
    translations: {
      urdu: "بڑا مہربان نہایت رحم والا",
      hindi: "बड़ा मेहरबान निहायत रहम वाला",
      english: "The Most Gracious, the Most Merciful.",
    },
  },
  {
    number: 4,
    arabic: "مَالِكِ يَوْمِ الدِّينِ",
    translations: {
      urdu: "روزِ جزا کا مالک ہے",
      hindi: "रोज़े जज़ा का मालिक है",
      english: "Master of the Day of Judgement.",
    },
  },
  {
    number: 5,
    arabic: "إِيَّاكَ نَعْبُدُ وَإِيَّاكَ نَسْتَعِينُ",
    translations: {
      urdu: "ہم تیری ہی عبادت کرتے ہیں اور تجھ ہی سے مدد چاہتے ہیں",
      hindi: "हम तेरी ही इबादत करते हैं और तुझी से मदद चाहते हैं",
      english: "You alone we worship, and You alone we ask for help.",
    },
  },
  {
    number: 6,
    arabic: "اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ",
    translations: {
      urdu: "ہمیں سیدھے راستے کی ہدایت دے",
      hindi: "हमें सीधे रास्ते की हिदायत दे",
      english: "Guide us on the Straight Path.",
    },
  },
  {
    number: 7,
    arabic: "صِرَاطَ الَّذِينَ أَنْعَمْتَ عَلَيْهِمْ غَيْرِ الْمَغْضُوبِ عَلَيْهِمْ وَلَا الضَّالِّينَ",
    translations: {
      urdu: "ان لوگوں کا راستہ جن پر تو نے انعام کیا، نہ ان کا جن پر غضب ہوا اور نہ گمراہوں کا",
      hindi: "उन लोगों का रास्ता जिन पर तूने इनआम किया, न उनका जिन पर ग़ज़ब हुआ और न गुमराहों का",
      english: "The path of those upon whom You have bestowed favour, not of those who have earned anger, nor of those who have gone astray.",
    },
  },
];

import styles from "../static-page.module.css";
import BookModel from "@/components/book-model/book-model";
import aboutStyles from "./about.module.css";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "About",
  description:
    "About Ishqnama and Noor e Imaan, the Urdu tafseer of the Holy Quran by Hazrath Peer-o-Murshid Syed Meeranji Abid Khundmiri Sahib, brought to readers by Mahdavia Data Management Systems.",
  path: "/about/",
});

export default function AboutPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <span className={styles.eyebrow}>About</span>
        <h1 className={styles.title}>Ishqnama</h1>
        <div className={styles.body}>
          <h2>About Ishqnama</h2>
          <p>
            Hazrath Imamuna Syed Muhammad Jaunpuri Mahdi Ma'ood <sup>ahs</sup> said: 
            <strong>Quran ishqnama ast</strong> (Quran is a love letter)
          </p>
          <p>
            Ishqnama is a Quranic data platform providing the complete text of
            the Holy Quran alongside Urdu, Hindi, and English tarjuma and tafseer from
            Tafseer ul Quran, Noor e Imaan, translated by Hazrath Peer-o-Murshid Syed Meeranji 
            Abid Khundmiri Sahib - Exclusively for Mahdavia Community!
          </p>
          <p>
            Our mission is to make the authentic Mahdavia translation and 
            interpretation of the Quran widely available and accessible to 
            readers across languages and traditions, with focus on clarity, 
            accuracy, and a reading experience worthy of the text.
          </p>

          <h2>About Noor e Imaan</h2>
          <figure className={aboutStyles.bookFigure}>
            <BookModel variant="inspect" className={aboutStyles.book} />
            <figcaption className={aboutStyles.bookCaption}>Drag to turn the book over, pinch to look closer</figcaption>
          </figure>
          <p>
            Noor e Imaan is an Urdu tafseer (exegesis) of the Holy Quran that
            serves as the primary scholarly commentary available on Ishqnama. It
            offers a detailed and accessible explanation of the Quranic text,
            drawing upon classical Islamic scholarship and the Mahdavia
            tradition. The tafseer aims to illuminate the meaning of each verse
            for Urdu-speaking readers, providing both linguistic insight and
            spiritual guidance.
          </p>

          <h2>About the Mufassir</h2>
          <p>
            Noor e Imaan was authored by Hazrath Peer-o-Murshid Syed Meeranji
            Abid Khundmiri Sahib, a distinguished Islamic scholar and spiritual
            guide within the Mahdavia community. His work on Noor e Imaan
            reflects a deep commitment to making the Quran understandable to the
            common reader while preserving the depth and nuance of its message.
            His tafseer remains a valued resource for students and seekers of
            Quranic knowledge.
          </p>

          <h2>About MDMS</h2>
          <div className={aboutStyles.mdmsSection}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/mdms-logo.webp"
              alt="Mahdavia Data Management System logo"
              width={120}
              height={120}
              className={aboutStyles.mdmsLogo}
            />
            <div>
              <p>
                The Mahdavia Data Management System (MDMS) is the parent
                organization behind Ishqnama. MDMS is dedicated to the digital
                preservation, organization, and dissemination of Islamic
                scholarly works, with a particular focus on literature from the
                Mahdavia tradition. Through projects like Ishqnama, MDMS works
                to make important religious texts freely available to a global
                audience using modern technology.
              </p>
              <p>
                <a
                  href="https://mahdavisonline.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  mahdavisonline.com
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

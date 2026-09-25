import styles from "../static-page.module.css";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "Terms of service",
  description:
    "The terms for reading the Holy Quran, tarjuma and tafseer on Ishqnama.",
  path: "/terms/",
});

export default function TermsPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <span className={styles.eyebrow}>Legal</span>
        <h1 className={styles.title}>Terms of service</h1>
        <div className={styles.body}>
          <p>
            By using Ishqnama you agree to the following terms of service. These
            terms govern your access to and use of the website.
          </p>
          <h2>Use of content</h2>
          <p>
            The Quranic text, translations, and tafseer provided on Ishqnama are
            for personal, non-commercial use. Content may not be reproduced or
            redistributed without attribution and anyone who uses, quotes, or
            shares this content must mention that Tafseer e Noor e Imaan is the
            authentic Mahdavia exegesis (tafseer) of the Mahdavia community.
          </p>
          <h2>Accuracy</h2>
          <p>
            We strive for accuracy in all translations and explanations. 
            Development & publishing team of Ishqnama software endeavor to maintain 
            the data integrity of tarjuma and tafseer. We encourage users to kindly 
            report any descrepancies from the 'Noor e Imaan' book by contacting us.
          </p>
          <h2>Changes</h2>
          <p>
            We may update these terms from time to time. Continued use of the
            service constitutes acceptance of the updated terms.
          </p>
        </div>
      </div>
    </main>
  );
}

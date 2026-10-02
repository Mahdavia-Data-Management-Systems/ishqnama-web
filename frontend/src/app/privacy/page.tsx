import styles from "../static-page.module.css";
import { pageMetadata } from "@/lib/page-metadata";

export const metadata = pageMetadata({
  title: "Privacy policy",
  description:
    "How Ishqnama handles your account, reading settings, bookmarks and history.",
  path: "/privacy/",
});

export default function PrivacyPage() {
  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <span className={styles.eyebrow}>Legal</span>
        <h1 className={styles.title}>Privacy policy</h1>
        <div className={styles.body}>
          <p>
            Ishqnama respects your privacy. This policy explains what data we
            collect and how we use it.
          </p>
          <h2>Authentication</h2>
          <p>
            When you sign in with <a href="https://mahdavisonline.com" target="_blank" rel="noopener noreferrer">MahdavisOnline</a>, 
            we receive your name and email address to identify your account. 
            We do not store your password.
          </p>
          <h2>Reading data</h2>
          <p>
            Bookmarks, lists of ayaat, favourite lists and reading history are
            stored to provide a personalised experience. This data is not
            shared with third parties.
          </p>
          <h2>Published lists</h2>
          <p>
            A list of ayaat you make stays private while it is a draft. When
            you publish it, its title, description, ayaat and captions, and the
            name on your account, can be read by anyone who has its link. You
            can unpublish or delete it at any time, and the link stops working.
          </p>
          <h2>How the site is used</h2>
          <p>
            To find out what is slow or broken, and which parts of Ishqnama
            readers use, we record which pages are opened, how quickly they
            appear, errors that happen, and actions such as sharing a verse,
            adding a bookmark or publishing a list. When you are signed in, these records carry a
            scrambled code made from your account, so we can follow a problem
            you hit without knowing who you are. They never include your name,
            email address, what you search for, what you read in the
            explanations, or what you write in your lists. Two small cookies let us count visits; they are used
            for nothing else. The records are kept for 30 days.
          </p>
          <h2>Contact</h2>
          <p>
            If you have questions about this privacy policy, please reach out
            through our contact page.
          </p>
        </div>
      </div>
    </main>
  );
}

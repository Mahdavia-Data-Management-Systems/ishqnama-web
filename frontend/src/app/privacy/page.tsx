import styles from "../static-page.module.css";

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
            When you sign in with Microsoft Entra ID, we receive your name and
            email address to identify your account. We do not store your
            password.
          </p>
          <h2>Reading data</h2>
          <p>
            Bookmarks, favourites, and reading history are stored to provide a
            personalised experience. This data is not shared with third parties.
          </p>
          <h2>Analytics</h2>
          <p>
            We may collect anonymous usage data to improve the service. No
            personally identifiable information is included in analytics.
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

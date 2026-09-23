import { Link } from 'react-router-dom';

const LAST_UPDATED = '23 September 2026';
const CONTACT_EMAIL = 'support@readyall.org';

/**
 * Public privacy policy.
 *
 * App Store Connect requires a reachable privacy policy URL before an app can
 * be submitted, and this route is intentionally outside authentication so a
 * reviewer and any prospective user can read it without an account.
 *
 * This describes the application's actual behavior and is not legal advice. It
 * should be reviewed before public release.
 */
export function Privacy() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold text-content-primary sm:text-3xl">Privacy policy</h1>
        <p className="mt-1 text-sm text-content-muted">Last updated {LAST_UPDATED}</p>
      </div>

      <p className="text-sm text-content-secondary">
        Logbook Companion records and analyses rowing training. This policy explains what the
        application stores, why it stores it, and how to remove it.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-content-primary">What is collected</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-content-secondary">
          <li><strong>Account details.</strong> Your email address and a display name.</li>
          <li>
            <strong>Training data.</strong> Workouts you log or import, including distance, time,
            pace, stroke data, splits and any notes you add.
          </li>
          <li>
            <strong>Profile and preferences.</strong> Optional details such as height, weight,
            benchmarks and goals, used to calculate pacing and analysis.
          </li>
          <li>
            <strong>Performance monitor data.</strong> When you connect a Concept2 PM5 over
            Bluetooth, the workout data it reports during a piece.
          </li>
          <li>
            <strong>Team data.</strong> If you use coaching features, the sessions, scores, notes
            and rosters you create.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-content-primary">How it is used</h2>
        <p className="text-sm text-content-secondary">
          Your data is used to provide the application: storing your training history, producing
          analysis, matching workouts to plans, and sharing work with a team you belong to. It is
          not sold, and it is not used for advertising.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-content-primary">Bluetooth</h2>
        <p className="text-sm text-content-secondary">
          Bluetooth is used solely to connect to a nearby Concept2 performance monitor and read
          workout data from it. It is not used for location, tracking or advertising, and the
          application does not scan for unrelated devices.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-content-primary">Services and sharing</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-content-secondary">
          <li>
            <strong>Supabase</strong> hosts the database and authentication that store your account
            and training data.
          </li>
          <li>
            <strong>Concept2</strong> receives data only if you connect your logbook, and only for
            workouts you choose to publish. Anything published is then governed by Concept2's own
            privacy policy.
          </li>
          <li>
            <strong>Coaches and teammates</strong> can see training and team records shared with a
            team you join, according to your role on that team.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-content-primary">Deleting your account</h2>
        <p className="text-sm text-content-secondary">
          You can delete your account at any time from <strong>Settings &rarr; Profile &rarr; Delete
          account</strong>. This permanently removes your profile, workouts, training history,
          preferences and stored Concept2 credentials. It cannot be undone.
        </p>
        <p className="text-sm text-content-secondary">
          Two things intentionally survive deletion. Team records created by a coach remain with the
          squad, with the coach's identity removed, so a team does not lose its own history.
          Workouts already published to Concept2 live in your Concept2 logbook and must be deleted
          there.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-content-primary">Retention</h2>
        <p className="text-sm text-content-secondary">
          Data is kept until you delete it or delete your account. There is no separate archive of a
          deleted account.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-content-primary">Children</h2>
        <p className="text-sm text-content-secondary">
          Rowing programmes often include junior athletes. Accounts are intended to be created by
          the athlete or their guardian. If you believe a child's data has been stored without
          appropriate consent, contact us and it will be removed.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-content-primary">Contact</h2>
        <p className="text-sm text-content-secondary">
          Questions about this policy or your data: <a className="text-accent-primary-text underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
      </section>

      <div className="pt-2">
        <Link to="/" className="text-sm text-accent-primary-text underline">Back to Logbook Companion</Link>
      </div>
    </main>
  );
}

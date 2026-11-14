import Link from "next/link";
import { Brand, Icon } from "@/components/brand";
import { SiteNavigation } from "@/components/public/site-navigation";
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="public-site">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteNavigation />
      {children}
      <footer className="site-footer">
        <div className="footer-main">
          <div>
            <Brand />
            <p>
              A little thread through
              <br />
              the everyday.
            </p>
          </div>
          <nav aria-label="Footer">
            <Link href="/how-it-works">How it works</Link>
            <Link href="/for-clinicians">For clinicians</Link>
            <Link href="/privacy">Privacy & limitations</Link>
            <Link href="/login">
              Clinician sign in <Icon name="arrow" />
            </Link>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>AIriane · Nonclinical wellbeing support</span>
          <span>For emergencies, contact local emergency services.</span>
        </div>
      </footer>
    </div>
  );
}

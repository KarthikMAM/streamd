# Security Policy

## Supported versions

Security fixes target the `main` branch and the most recent `0.x` tag.
Older tags do not receive backports.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's
[private vulnerability reporting][gh-report] to file a confidential
report against `KarthikMAM/streamd`. If that is unavailable, email the
maintainer listed on the GitHub profile of the owner of this
repository.

Please include:

- A description of the issue and the affected package(s).
- Steps to reproduce, including a minimal code sample.
- The impact you believe it has (denial of service, XSS, information
  disclosure, etc.).
- Suggested fixes, if you have them.

## Response timeline

- Acknowledgement within **5 business days** of receipt.
- Triage + severity assessment within **10 business days**.
- Fix or mitigation released within **90 days** for high severity,
  longer for lower severity.

We will coordinate disclosure with the reporter and request a CVE when
appropriate.

## Hardening notes for consumers

- Run untrusted markdown through the `sanitize` plugin from
  `@streamd/plugins` before rendering. It strips raw HTML and rewrites
  unsafe URL schemes by default.
- The HTML renderer's `classPrefix` + `wrapRoot` options scope emitted
  class names; pair with a content-security-policy that forbids
  inline scripts.
- `@streamd/react` and `@streamd/react-native` use
  `dangerouslySetInnerHTML` / raw HTML fallback for `HtmlBlock` and
  `HtmlInline` tokens only when the input was not sanitised. Apply
  `sanitize()` in the plugin pipeline when rendering user input.

[gh-report]: https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability

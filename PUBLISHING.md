# Publishing SFTP Xavi

SFTP Xavi is an independently maintained extension for Visual Studio Code. Its extension ID is `luckyshot.sftp-xavi`. The `publisher` field identifies the intended Marketplace publisher; it does not register the account or prove ownership.

## Before the first Marketplace publication

1. Sign in to [publisher management](https://marketplace.visualstudio.com/manage/publishers/) with the account that owns the intended publisher. Confirm ownership of `luckyshot` or choose an available publisher ID you control and update `package.json` accordingly.
2. Review the Marketplace agreement shown during publisher setup. Keep the distinct SFTP Xavi name and artwork, the independent-fork statement, and the upstream license and attribution notices.
3. Run `npm ci` and `npm run check`. Test SFTP/FTP against representative live servers; the first independent version remains marked as a preview until broader testing is complete.
4. Package a committed and pushed revision with `npm run package -- --githubBranch <commit-sha>` and inspect the VSIX. This pins README links and artwork to the packaged source instead of another branch. Confirm the icon, identity, README, LICENSE, NOTICE.md, and dependency license texts are included.
5. Publish through your own publisher account. Do not publish to, impersonate, or claim an official handover from Natizyskunk or liximomo.

Packaging and local installation are separate from Marketplace publication. This repository does not automatically publish Marketplace releases.

## Branding and attribution

Use **SFTP Xavi** as the product name, or **SFTP Xavi for Visual Studio Code** when mentioning the platform in the name. Use the original orange hexagon/X artwork; do not substitute the Microsoft logo or the upstream extension icon. The PNG icon is rendered from `resources/icon.svg`; on macOS it can be regenerated with `sips -s format png resources/icon.svg --out resources/icon.png`.

The README names the upstream projects and makes the lack of affiliation explicit. Preserve LICENSE, NOTICE.md, THIRD_PARTY_NOTICES.md, and historical contributor credits in distributions. Upstream releases are labeled as historical releases in CHANGELOG.md. When updating runtime dependencies, refresh their license texts in THIRD_PARTY_NOTICES.md.

Replace old upstream screenshots with captures of SFTP Xavi before adding screenshots to the listing. Do not present upstream screenshots or mockups as captures of this fork. The inherited screenshot has been removed; current screenshots have not yet been captured.

## Official references

- [Extension publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Microsoft's naming and icon guidance](https://code.visualstudio.com/brand/)
- [Extension manifest and Marketplace presentation](https://code.visualstudio.com/api/references/extension-manifest)
- [Marketplace participation policies](https://aka.ms/vsmarketplace-policies)

The original license and bundled third-party license notices remain authoritative for their respective material.

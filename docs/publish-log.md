# Publish Log

## 2026-08-10 00:57 Asia/Taipei

- Task: publish categorized media article index link fixes.
- Production URL: https://lawrence-financial-site.pages.dev/articles
- Cloudflare deployment preview: https://581fa9c1.lawrence-financial-site.pages.dev
- Git content commit deployed: `6944c04c524f26051e34cdbb67d126ee37348f54`
- Publish snapshot: `D:\AI\lawrence_financial_site\output\publish-media-article-20260810-005746`
- Deployment command: `npx --yes wrangler pages deploy "<snapshot-dir>" --project-name=lawrence-financial-site --branch=main --commit-hash=6944c04c524f26051e34cdbb67d126ee37348f54 --commit-message="Publish article link fixes" --commit-dirty=true --skip-caching`

Validation:

- Production `/articles` returned HTTP 200.
- Confirmed Smart article replacement URL is present.
- Confirmed Business Today podcast page URL is present.
- Confirmed Spotify EP207 URL is present.
- Confirmed YouTube EP89 URL is present.
- Confirmed old UDN 404 URL is absent.
- Confirmed `podcasts.apple.com` links are absent.

Notes:

- Prior link check found LinkedIn returning HTTP 999 to the automated checker; this is treated as bot protection, not a broken public link.
- Unrelated existing worktree changes were left untouched.

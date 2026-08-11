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

## 2026-08-10 02:16 Asia/Taipei

- Task: confirm publish log and production status after article link deployment.
- Production URL checked: https://lawrence-financial-site.pages.dev/articles
- Latest log backup commit before this entry: `69cbbaa2b13173f7d9072d904db508630d6fe40d`
- Deployed content commit: `6944c04c524f26051e34cdbb67d126ee37348f54`

Validation:

- Production `/articles` returned HTTP 200.
- Confirmed Smart article replacement URL is present.
- Confirmed Business Today podcast page URL is present.
- Confirmed old UDN 404 URL is absent.
- Confirmed `podcasts.apple.com` links are absent.

## 2026-08-11 18:49 Asia/Taipei

- Task: add a new `講座與活動` category to the articles index for Facebook public activity links.
- Production URL checked: https://lawrence-financial-site.pages.dev/articles
- Cloudflare deployment preview: https://cc9eb6e0.lawrence-financial-site.pages.dev
- Git content commit deployed: `33a071dc2d253289e7fa27b867c3b6c7e0ec98f4`
- Publish snapshot: `D:\AI\lawrence_financial_site\output\publish-media-article-20260811-184904`

Validation:

- Production `/articles` returned HTTP 200.
- Confirmed `講座與活動` navigation and section are present.
- Confirmed 52 Facebook share links are present in production.
- Confirmed Facebook share links are unique after removing one duplicate input URL.
- Facebook pages may restrict automated metadata extraction, so cards use conservative labels: Facebook public activity record, date unspecified, and details deferred to the original FB page.

## 2026-08-11 18:58 Asia/Taipei

- Task: confirm production status and log state for the Facebook events publishing update.
- Production URL checked: https://lawrence-financial-site.pages.dev/articles
- Latest content commit: `33a071dc2d253289e7fa27b867c3b6c7e0ec98f4`
- Latest publish log commit before this entry: `28b4852cddb4fd84ddcc77a68039be70a272a361`
- Publish snapshot still current: `D:\AI\lawrence_financial_site\output\publish-media-article-20260811-184904`

Validation:

- Production `/articles` returned HTTP 200.
- Confirmed `講座與活動` navigation and section are present.
- Confirmed 52 Facebook share links are present in production.
- Confirmed the 52 Facebook share links are unique.
- Confirmed `docs/publish-log.md` is valid UTF-8; any garbled Chinese seen in PowerShell output is terminal display encoding, not file corruption.

## 2026-08-11 22:54 Asia/Taipei

- Task: publish Facebook event card summaries for the `講座與活動` section.
- Production URL checked: https://lawrence-financial-site.pages.dev/articles
- Cloudflare deployment preview: https://1146ce05.lawrence-financial-site.pages.dev
- Git content commit deployed: `443529ec89734e6f7d992b21a4901fef2a19fbd9`
- Publish snapshot: `D:\AI\lawrence_financial_site\output\publish-media-article-20260811-225419`
- Static zip backup: `D:\AI\lawrence_financial_site_backups\lawrence_financial_site_static_20260811_225419.zip`
- Deployment command: `npx --yes wrangler pages deploy "<snapshot-dir>" --project-name=lawrence-financial-site --branch=main --commit-hash=443529ec89734e6f7d992b21a4901fef2a19fbd9 --commit-message="Add Facebook event summaries" --commit-dirty=true --skip-caching`

Validation:

- Production `/articles` returned HTTP 200.
- Preview `/articles` returned HTTP 200.
- Confirmed 52 Facebook event cards remain present.
- Confirmed 52 Facebook share links remain present.
- Confirmed representative summary cards are present in production: `高雄「傳家」信託講座`, `Google 板橋傳承規劃分享`, and `Facebook 登入限制連結 47`.
- Confirmed old placeholder title `Facebook 講座與活動紀錄 01` is absent from production.

Notes:

- Facebook metadata extraction produced usable summaries for public pages where available; login-limited, photo-only, or metadata-empty links were labeled as limited or unavailable and deferred to the original FB page.
- PowerShell `Invoke-WebRequest` returned a local response-object error during verification, so production verification used `curl.exe` plus UTF-8 string checks instead.
- Unrelated existing worktree changes were left untouched.

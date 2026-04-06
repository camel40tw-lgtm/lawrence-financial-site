# Lawrence Financial Site

Cloudflare Pages 靜態網站專案。

## 專案結構

```text
lawrence_financial_site_netlify_v2/
├─ 404.html
├─ about.html
├─ article-retirement-cashflow.html
├─ articles.html
├─ contact.html
├─ index.html
├─ robots.txt
├─ services.html
├─ sitemap.xml
├─ thanks.html
├─ _headers
├─ assets/
│  ├─ main.js
│  └─ styles.css
└─ images/
   ├─ favicon.svg
   ├─ lawrence-about-seated-portrait.jpg
   ├─ lawrence-home-hero-standing.jpg
   ├─ lawrence-profile-standing.jpg
   └─ site-social-share.png
```

## 圖片命名規則

- `lawrence-home-hero-standing.jpg`
  首頁 Hero 主視覺照片。
- `lawrence-about-seated-portrait.jpg`
  關於我頁左側人物照片。
- `lawrence-profile-standing.jpg`
  個人標準形象照，供文章頁、結構化資料與其他共用區塊使用。
- `site-social-share.png`
  Open Graph / Twitter 社群分享圖。
- `favicon.svg`
  網站 favicon。

## 主要頁面

- `index.html`
  首頁。
- `about.html`
  關於我。
- `services.html`
  服務項目。
- `articles.html`
  文章列表。
- `article-retirement-cashflow.html`
  單篇文章頁。
- `contact.html`
  聯絡與預約表單。
- `thanks.html`
  表單送出成功頁。
- `404.html`
  找不到頁面。

## 部署

- 平台：Cloudflare Pages
- 靜態資源樣式檔：`assets/styles.css`
- 前端互動腳本：`assets/main.js`

## 整理紀錄

- 已移除舊 Netlify 殘留設定。
- 已移除未使用的舊分享圖。
- 已統一圖片命名，避免隨機碼與用途混雜。

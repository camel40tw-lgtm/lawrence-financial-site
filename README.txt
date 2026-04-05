駱潤生 Lawrence｜金融顧問風 Netlify 可上線版 v2

更新內容
1. 修正首頁右側照片過淡問題，移除任何淡化效果並提高對比呈現。
2. 新增文章頁 articles.html。
3. 新增文章內頁 article-retirement-cashflow.html。
4. 加入預約按鈕與 LINE 浮動按鈕。
5. contact.html 已加入 Netlify Forms 表單。
6. 已加入 SEO 結構：
   - title / description / canonical
   - Open Graph / Twitter Card
   - JSON-LD 結構化資料
   - robots.txt / sitemap.xml
7. 已預留 GA4 與 Meta Pixel 安裝碼。

部署前請修改
A. 所有頁面的:
   - G-XXXXXXXXXX -> 你的 GA4 ID
   - 123456789012345 -> 你的 Meta Pixel ID
   - https://your-domain.com -> 你的正式網域
B. LINE 連結:
   - https://line.me/R/ti/p/@yourlineid -> 你的 LINE 官方帳號或個人連結
C. 若要外部預約系統:
   - 可把 contact.html#booking 改成你的 Calendly / TidyCal 連結

Netlify 部署
1. 解壓縮
2. 登入 Netlify
3. Drag and Drop 整個資料夾內容
4. 指定正式網域後，記得把 canonical、og:url、sitemap、robots 的網域改掉

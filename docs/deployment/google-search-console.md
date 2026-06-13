# Google Search Console Launch Checklist

## Before submission

1. Deploy the frontend build to `https://www.educlub.co.ke`.
2. Confirm these URLs return HTTP 200:
   - `https://www.educlub.co.ke/`
   - `https://www.educlub.co.ke/courses`
   - `https://www.educlub.co.ke/typing`
   - `https://www.educlub.co.ke/holiday-bootcamps`
   - `https://www.educlub.co.ke/for-schools`
   - `https://www.educlub.co.ke/sitemap.xml`
   - `https://www.educlub.co.ke/robots.txt`
3. View page source on several public pages and confirm each has its own title, description,
   canonical URL, H1 text and JSON-LD.
4. Confirm private routes such as `/learner`, `/school-admin` and `/system-admin` are not included
   in the sitemap.

## Connect Google Search Console

1. Open [Google Search Console](https://search.google.com/search-console).
2. Add a **Domain property** for `educlub.co.ke`.
3. Add the DNS TXT verification record supplied by Google at the domain DNS provider.
4. After verification, open **Sitemaps** and submit:

   ```text
   https://www.educlub.co.ke/sitemap.xml
   ```

5. Use **URL Inspection** to request indexing for:
   - `/`
   - `/courses`
   - `/courses/scratch-coding`
   - `/typing`
   - `/holiday-bootcamps`
   - `/for-schools`

## Monitor and improve

Review Search Console every two to four weeks:

- **Pages:** indexing errors, excluded pages and canonical selection
- **Performance:** queries, impressions, clicks, countries and devices
- **Core Web Vitals:** mobile usability and loading performance
- **Enhancements:** Course and FAQ structured-data warnings

Use real query impressions to improve headings, FAQs and internal links. Do not create duplicate
pages merely to repeat keywords. Rankings depend on relevance, technical quality, useful content,
trusted links, competition and time; first position cannot be guaranteed.

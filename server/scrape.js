import express from 'express';
import FirecrawlApp from '@mendable/firecrawl-js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_API_KEY
});

router.post('/scrape-site', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required.' });
  }

  try {
    // Scrape URL and extract rendered content as clean Markdown
    const scrapeResult = await firecrawl.scrapeUrl(url, {
      formats: ['markdown'],
      onlyMainContent: true
    });

    if (!scrapeResult.success) {
      throw new Error(scrapeResult.error || 'Failed to scrape target URL.');
    }

    res.json({
      success: true,
      url: url,
      markdown: scrapeResult.markdown,
      metadata: scrapeResult.metadata
    });
  } catch (err) {
    console.error('Firecrawl Scraping Failure:', err);
    res.status(500).json({ error: err.message || 'URL scraping failed.' });
  }
});

export default router;
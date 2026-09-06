import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import stripeRouter from './stripe.js';
import auditRouter from './audit.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use('/api/stripe', stripeRouter);
app.use('/api/audit', auditRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[Server] API engine running on http://localhost:${PORT}`);
});

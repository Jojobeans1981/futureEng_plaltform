import express from 'express';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const stripeKey = process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY !== 'your-stripe-secret-key' ? process.env.STRIPE_SECRET_KEY : 'sk_test_mockKeyForLocalDev1234567890';
const stripe = new Stripe(stripeKey);

const supabase = createClient(process.env.SUPABASE_URL || 'https://placeholder.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key');

router.get('/status', (req, res) => res.json({ status: 'stripe route active' }));

export default router;

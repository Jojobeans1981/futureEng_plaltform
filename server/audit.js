import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Google Gen AI Client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Universal LLM Execution Engine with Forced Gemini Fallback on Anthropic Errors
 */
async function callLLM(prompt) {
  let claudeFailed = false;
  let errorMessage = '';

  // 1. Attempt Primary Call: Anthropic Claude 3.5 Sonnet
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    // Check for explicit API error response from Anthropic (HTTP errors or error JSON payload)
    if (!response.ok || data.error) {
      claudeFailed = true;
      errorMessage = data.error?.message || `HTTP ${response.status} - Anthropic Request Failed`;
      console.warn(`[AI PIPELINE WARN] Anthropic error detected ("${errorMessage}"). Triggering Gemini fallback...`);
    } else if (data.content && data.content[0]?.text) {
      return data.content[0].text;
    } else {
      claudeFailed = true;
      errorMessage = 'Invalid response format from Anthropic API.';
    }
  } catch (err) {
    claudeFailed = true;
    errorMessage = err.message;
    console.warn(`[AI PIPELINE WARN] Network error contacting Anthropic ("${errorMessage}"). Triggering Gemini fallback...`);
  }

  // 2. Secondary Fallback: Gemini 3.1 Pro (Fires if Claude fails or returns any credit/status error)
  if (claudeFailed) {
    try {
      console.log('[AI PIPELINE INFO] Invoking Gemini 3.1 Pro fallback engine...');
      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });

      if (geminiResponse && geminiResponse.text) {
        console.log('[AI PIPELINE SUCCESS] Gemini successfully generated diagnostic response.');
        return geminiResponse.text;
      } else {
        throw new Error('Gemini returned an empty response.');
      }
    } catch (geminiError) {
      console.error('[AI PIPELINE FATAL] Both Anthropic and Gemini engines failed:', geminiError.message);
      throw new Error(`AI Engines Failed. Primary (Anthropic): ${errorMessage} | Secondary (Gemini): ${geminiError.message}`);
    }
  }
}

router.post('/analyze', async (req, res) => {
  const {
    userId,
    companyName,
    industry,
    teamSize,
    currentStack,
    revenueModel,
    targetICP,
    conversionRate,
    painPoints,
    deliverableType,
    scrapedMarkdown
  } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    // 1. Credit Check & Deduction
    const { data: creditDeducted, error: creditErr } = await supabase.rpc('deduct_user_credit', {
      user_id_param: userId
    });

    const isFreemiumFallback = creditErr || !creditDeducted;

    // 2. Freemium Teaser Path
    if (isFreemiumFallback) {
      const fallbackPrompt = `
You are an Executive SaaS Advisor. Provide a brief 2-paragraph teaser diagnostic for ${companyName} (${industry}).
Target ICP: ${targetICP}.
${scrapedMarkdown ? `Site Content Snapshot:\n${scrapedMarkdown.slice(0, 1000)}...` : ''}

Deliverable:
1. High-Level Positioning Summary (2-3 sentences)
2. One core bottleneck identified.
Do not provide full execution roadmaps or asset copy.
`;
      const teaserReport = await callLLM(fallbackPrompt);

      return res.json({
        success: true,
        isFreemium: true,
        report: teaserReport,
        message: 'Free preview generated. Upgrade credits to unlock full roadmap.'
      });
    }

    // 3. Full Paid Multi-Agent Pipeline
    const agentAPrompt = `
You are Agent A: Elite SaaS Growth & Positioning Specialist.
Evaluate ${companyName}:
Industry: ${industry} | ICP: ${targetICP} | Current Conversion Rate: ${conversionRate}
${scrapedMarkdown ? `\nSCRAPED LANDING PAGE CONTENT:\n${scrapedMarkdown}\n` : ''}

Identify positioning gaps, value proposition weak spots, and conversion leaks. Return 3 actionable fixes.
`;

    const agentBPrompt = `
You are Agent B: Enterprise Systems Architect.
Evaluate ${companyName}:
Tech Stack: ${currentStack} | Team Size: ${teamSize} | Bottlenecks: ${painPoints}

Identify technical debt, API workflow bottlenecks, and scalability risks. Return 3 technical upgrades.
`;

    // Execute Agents in Parallel using the resilient caller
    const [growthAnalysis, techAnalysis] = await Promise.all([
      callLLM(agentAPrompt),
      callLLM(agentBPrompt)
    ]);

    const synthesisPrompt = `
You are Agent C: Master Executive Synthesizer for ${companyName}.
Combine the following evaluations into a cohesive diagnostic report and 90-day action plan:

[GROWTH EVALUATION]:
${growthAnalysis}

[SYSTEMS EVALUATION]:
${techAnalysis}

Return your output formatted with:
# Executive Diagnostic Score: (0-100/100)
## Executive Summary
## Key Strategic Bottlenecks
## 30-60-90 Day Execution Roadmap
## Generated High-Value Assets (Cold Email Copy, Landing Page Copy Fixes, Technical Spec)
`;

    const finalReport = await callLLM(synthesisPrompt);

    // Save report record
    const { data: reportRecord, error: reportErr } = await supabase
      .from('reports')
      .insert([{ user_id: userId, company_name: companyName, deliverable_type: deliverableType, raw_report: finalReport, input_payload: req.body }])
      .select()
      .single();

    if (reportErr) throw reportErr;

    // Seed task board items
    const initialTasks = [
      { user_id: userId, report_id: reportRecord.id, title: 'Fix Core Messaging & Positioning (Growth Agent)', timeframe: '30 Days', owner: 'Growth Lead' },
      { user_id: userId, report_id: reportRecord.id, title: 'Resolve Tech Bottlenecks & API Pipelines (Systems Agent)', timeframe: '60 Days', owner: 'Engineering Lead' },
      { user_id: userId, report_id: reportRecord.id, title: 'Deploy Updated Conversion Funnel & Asset Copy', timeframe: '90 Days', owner: 'Product / Operations' }
    ];

    await supabase.from('action_items').insert(initialTasks);

    res.json({ success: true, isFreemium: false, report: finalReport, reportId: reportRecord.id });

  } catch (err) {
    console.error('Multi-Agent Analysis Failure:', err);
    res.status(500).json({ error: err.message || 'Diagnostic generation failed.' });
  }
});

export default router;
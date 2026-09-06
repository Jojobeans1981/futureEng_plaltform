import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function callClaude(prompt) {
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

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI Engine Provider Error: ${errText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

router.post('/analyze', async (req, res) => {
  const {
    userId,
    companyName,
    industry,
    teamSize,
    currentStack,
    revenueModel,
    monthlyRevenue,
    targetICP,
    conversionRate,
    painPoints,
    deliverableType,
    scrapedMarkdown,
    documentContent
  } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    // 1. Atomic Credit Guard
    const { data: success, error: creditErr } = await supabase.rpc('deduct_user_credit', {
      user_id_param: userId
    });

    if (creditErr || !success) {
      return res.status(402).json({ error: 'Insufficient credits or deduction failed.' });
    }

    // 2. Agent A: Growth & Positioning Evaluation
    const agentAPrompt = `
You are Agent A: Elite SaaS Growth & Positioning Specialist.
Evaluate ${companyName}:
Industry: ${industry} | ICP: ${targetICP} | Current Conversion Rate: ${conversionRate}
${scrapedMarkdown ? `\nSCRAPED LANDING PAGE CONTENT:\n${scrapedMarkdown}\n` : ''}

Identify positioning gaps, value proposition weak spots, and conversion leaks. Return 3 actionable fixes.
`;

    // 3. Agent B: Technical Systems Architecture Evaluation
    const agentBPrompt = `
You are Agent B: Enterprise Systems Architect.
Evaluate ${companyName}:
Tech Stack: ${currentStack} | Team Size: ${teamSize} | Bottlenecks: ${painPoints}
${documentContent ? `\nSUPPLEMENTAL DOCS:\n${documentContent}\n` : ''}

Identify technical debt, API workflow bottlenecks, and scalability risks. Return 3 technical upgrades.
`;

    // Execute Agent A & Agent B in Parallel
    const [growthAnalysis, techAnalysis] = await Promise.all([
      callClaude(agentAPrompt),
      callClaude(agentBPrompt)
    ]);

    // 4. Agent C: Master Synthesis & Execution Engine
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

    const finalReport = await callClaude(synthesisPrompt);

    // 5. Save Report to Database
    const { data: reportRecord, error: reportErr } = await supabase
      .from('reports')
      .insert([
        {
          user_id: userId,
          company_name: companyName,
          deliverable_type: deliverableType,
          raw_report: finalReport,
          input_payload: req.body
        }
      ])
      .select()
      .single();

    if (reportErr) throw reportErr;

    // Create Initial Action Board Items
    const initialTasks = [
      {
        user_id: userId,
        report_id: reportRecord.id,
        title: `Fix Core Messaging & Positioning (Growth Agent)`,
        timeframe: '30 Days',
        owner: 'Growth Lead'
      },
      {
        user_id: userId,
        report_id: reportRecord.id,
        title: `Resolve Tech Bottlenecks & API Pipelines (Systems Agent)`,
        timeframe: '60 Days',
        owner: 'Engineering Lead'
      },
      {
        user_id: userId,
        report_id: reportRecord.id,
        title: `Deploy Updated Conversion Funnel & Asset Copy`,
        timeframe: '90 Days',
        owner: 'Product / Operations'
      }
    ];

    await supabase.from('action_items').insert(initialTasks);

    res.json({ success: true, report: finalReport, reportId: reportRecord.id });
  } catch (err) {
    console.error('Multi-Agent Analysis Failure:', err);
    res.status(500).json({ error: err.message || 'Diagnostic generation failed.' });
  }
});

export default router;
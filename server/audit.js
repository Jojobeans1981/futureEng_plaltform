import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function generateAIReport(prompt) {
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
    socialLinks,
    documentContent
  } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required.' });
  }

  try {
    const { data: success, error: creditErr } = await supabase.rpc('deduct_user_credit', {
      user_id_param: userId
    });

    if (creditErr || !success) {
      return res.status(402).json({ error: 'Insufficient credits or deduction failed.' });
    }

    const prompt = `
You are an Elite Enterprise Systems Architect and SaaS Growth Strategist.
Perform a high-level diagnostic for ${companyName}.

ORGANIZATIONAL METRICS:
- Company: ${companyName}
- Industry: ${industry} | Team Size: ${teamSize}
- Revenue Model: ${revenueModel} | Est. Revenue: ${monthlyRevenue}
- Target ICP: ${targetICP} | Conversion Metrics: ${conversionRate}
- Primary Tech Stack: ${currentStack}
- Digital Footprint: ${socialLinks}
- Critical Bottlenecks: ${painPoints}
${documentContent ? `\nSUPPLEMENTAL DOCUMENTATION:\n${documentContent}\n` : ''}

PRIMARY DELIVERABLE REQUIRED: ${deliverableType}

Generate a precision strategic execution audit formatted with crisp headers, concrete recommendations, financial projections, and actionable technical solutions.
`;

    const reportText = await generateAIReport(prompt);

    const { data: reportRecord, error: reportErr } = await supabase
      .from('reports')
      .insert([
        {
          user_id: userId,
          company_name: companyName,
          deliverable_type: deliverableType,
          raw_report: reportText,
          input_payload: req.body
        }
      ])
      .select()
      .single();

    if (reportErr) throw reportErr;

    const initialTasks = [
      {
        user_id: userId,
        report_id: reportRecord.id,
        title: `Audit Core Stack & Resolve ${painPoints.slice(0, 30)}...`,
        timeframe: '30 Days',
        owner: 'Engineering Lead'
      },
      {
        user_id: userId,
        report_id: reportRecord.id,
        title: `Deploy Updated ICP Strategy targeting ${targetICP.slice(0, 30)}...`,
        timeframe: '60 Days',
        owner: 'Growth / Sales'
      },
      {
        user_id: userId,
        report_id: reportRecord.id,
        title: `Automate Revenue & Data Pipeline Infrastructure`,
        timeframe: '90 Days',
        owner: 'Operations'
      }
    ];

    await supabase.from('action_items').insert(initialTasks);

    res.json({ success: true, report: reportText, reportId: reportRecord.id });
  } catch (err) {
    console.error('Audit Processing Failure:', err);
    res.status(500).json({ error: err.message || 'Diagnostic execution failed.' });
  }
});

export default router;
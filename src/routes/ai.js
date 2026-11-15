const express = require('express');
const { parseMedicationPrompt, MEDICAL_DISCLAIMER } = require('../services/geminiService');
const { requireAuth, requireWriteAccess } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

/**
 * POST /api/ai/parse-medication
 * Parse natural language medication instructions into form fields
 */
router.post('/parse-medication', requireWriteAccess, async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Instruction prompt text is required.' });
  }

  try {
    const result = await parseMedicationPrompt(prompt);
    return res.json({
      success: true,
      source: result.source,
      medication: result.medication,
      disclaimer: MEDICAL_DISCLAIMER
    });
  } catch (err) {
    console.error('[AI] Parsing error:', err);
    return res.status(500).json({
      error: 'Failed to process natural language prescription',
      details: err.message,
      disclaimer: MEDICAL_DISCLAIMER
    });
  }
});

module.exports = router;

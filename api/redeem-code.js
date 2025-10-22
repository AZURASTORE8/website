const express = require('express');
const router = express.Router();

// Mock database of valid codes and their rewards
const rewardCodes = {
  'WELCOME10': { reward: '10% Discount', valid: true },
  'FREESHIP': { reward: 'Free Shipping', valid: true },
  'SUMMER25': { reward: '25% Off', valid: true },
  'RANDOM-CODE-123': { reward: 'Reward claimed successfully', valid: true }
};

// Redeem code endpoint
router.post('/', (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Code is required'
      });
    }
    
    const reward = rewardCodes[code];
    
    if (!reward || !reward.valid) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired code'
      });
    }

    res.json({
      success: true,
      code: code,
      reward: reward.reward,
      message: 'Reward claimed successfully!'
    });
    
  } catch (error) {
    console.error('Error redeeming code:', error);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request'
    });
  }
});

module.exports = router;
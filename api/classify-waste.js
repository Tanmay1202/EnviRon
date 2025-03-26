import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Add CORS headers
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); // Or your specific domain
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, userLocation, userId } = req.body;

    if (!imageBase64 || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Here you would add your image classification logic
    // For now, returning mock data
    const mockClassification = {
      labels: ['plastic bottle'],
      wasteType: 'recyclable',
      locations: [
        {
          name: 'Local Recycling Center',
          address: '123 Green Street',
          rating: 4.5
        }
      ]
    };

    return res.status(200).json(mockClassification);

  } catch (error) {
    console.error('Classification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 
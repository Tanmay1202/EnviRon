const vision = require('@google-cloud/vision');
const { Client } = require('@googlemaps/google-maps-services-js');
const cors = require('cors')({ origin: true });

// Parse the JSON credentials from the environment variable
const credentialsJson = process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
if (!credentialsJson) {
  throw new Error('GOOGLE_CLOUD_CREDENTIALS_JSON environment variable is not set');
}

let credentials;
try {
  credentials = JSON.parse(credentialsJson);
} catch (error) {
  throw new Error('Failed to parse GOOGLE_CLOUD_CREDENTIALS_JSON: ' + error.message);
}

const visionClient = new vision.ImageAnnotatorClient({
  credentials: credentials
});
const googleMapsClient = new Client({});

const classifyWasteType = (labels) => {
  const recyclable = ['plastic bottle', 'bottle', 'can', 'paper', 'plastic', 'glass', 'metal'];
  const hazardous = ['battery', 'electronics', 'chemical', 'paint'];
  const donatable = ['clothes', 'furniture', 'book'];
  const organic = ['food', 'organic'];

  const matchedLabel = labels.find(label =>
    [...recyclable, ...hazardous, ...donatable, ...organic].some(key => label.includes(key))
  );

  if (!matchedLabel) return 'General Waste';
  if (recyclable.some(key => matchedLabel.includes(key))) return 'Recyclable';
  if (hazardous.some(key => matchedLabel.includes(key))) return 'Hazardous';
  if (donatable.some(key => matchedLabel.includes(key))) return 'Donatable';
  if (organic.some(key => matchedLabel.includes(key))) return 'Organic';
  return 'General Waste';
};

const findNearbyLocations = async (wasteType, userLocation) => {
  let query;
  switch (wasteType) {
    case 'Recyclable': query = 'recycling center'; break;
    case 'Hazardous': query = 'hazardous waste disposal'; break;
    case 'Donatable': query = 'thrift store OR donation center'; break;
    case 'Organic': query = 'compost facility'; break;
    default: query = 'waste disposal';
  }

  try {
    const response = await googleMapsClient.placesNearby({
      params: {
        location: userLocation,
        radius: 5000,
        keyword: query,
        key: process.env.GOOGLE_MAPS_API_KEY,
      },
    });
    return response.data.results.slice(0, 3).map(place => ({
      name: place.name,
      address: place.vicinity,
      rating: place.rating || 'N/A',
    }));
  } catch (error) {
    console.error('Location error:', error);
    return [];
  }
};

module.exports = async (req, res) => {
  await cors(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { imageBase64, userLocation } = req.body;
    if (!imageBase64 || !userLocation?.lat || !userLocation?.lng) {
      return res.status(400).json({ error: 'Missing image or location' });
    }

    try {
      const [visionResult] = await visionClient.labelDetection({
        image: { content: imageBase64 },
      });
      const labels = visionResult.labelAnnotations.map(label => label.description.toLowerCase());
      const wasteType = classifyWasteType(labels);
      const locations = await findNearbyLocations(wasteType, userLocation);

      res.status(200).json({ labels, wasteType, locations });
    } catch (error) {
      console.error('Classification error:', error);
      res.status(500).json({ error: 'Failed to classify image' });
    }
  });
};
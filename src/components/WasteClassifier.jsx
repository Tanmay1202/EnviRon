// src/components/WasteClassifier.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FaCamera, FaLeaf, FaSun, FaMoon, FaBars, FaTimes, FaMedal } from 'react-icons/fa';
import { supabase } from '../supabase';
import toast, { Toaster } from 'react-hot-toast';

const WasteClassifier = () => {
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [badgeNotification, setBadgeNotification] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();

  // Check for dark mode preference on mount
  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setIsDarkMode(prefersDark);
  }, []);

  // Check if the user is authenticated on component mount
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
      }
    };
    checkUser();
  }, [navigate]);

  // Handle image upload and validation
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        setError('Please upload a valid image (JPEG, PNG, or JPG).');
        toast.error('Please upload a valid image (JPEG, PNG, or JPG).');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB.');
        toast.error('Image size must be less than 5MB.');
        return;
      }

      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setResult(null);
      setError('');
      setBadgeNotification(null);
    }
  };

  // Classify the waste item using the backend server and update user progress
  const handleClassify = async () => {
    if (!image) {
      setError('Please upload an image to classify.');
      toast.error('Please upload an image to classify.');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setBadgeNotification(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Get user location
      let userLocation;
      try {
        userLocation = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }),
            (err) => reject(err)
          );
        });
      } catch (err) {
        throw new Error('Failed to get your location. Please enable location services.');
      }

      // Convert the image to base64 for the backend
      const imageBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(image);
      });

      // Get the backend URL from environment variables or use a default
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://your-backend-url.com';
      console.log('Using backend URL:', backendUrl);

      // Call the backend API
      const response = await fetch(`${backendUrl}/api/classify-waste`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ imageBase64, userLocation }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Backend response:', data);

      // Map waste type to classification details
      const classificationMap = {
        'plastic bottle': { isRecyclable: true, material: 'Plastic', instructions: 'Remove cap and label, rinse thoroughly, then place in blue recycling bin.', tip: 'Use a reusable water bottle to reduce plastic waste.' },
        'bottle': { isRecyclable: true, material: 'Plastic', instructions: 'Remove cap and label, rinse thoroughly, then place in blue recycling bin.', tip: 'Use a reusable water bottle to reduce plastic waste.' },
        'can': { isRecyclable: true, material: 'Aluminum', instructions: 'Rinse to remove any residue, then place in blue recycling bin.', tip: 'Opt for bulk purchases to reduce packaging waste.' },
        'paper': { isRecyclable: true, material: 'Paper', instructions: 'Ensure it\'s clean and free of food residue, then place in blue recycling bin.', tip: 'Switch to digital documents to reduce paper usage.' },
        'food': { isRecyclable: false, material: 'Organic Waste', instructions: 'Dispose in green compost bin if available, or in black landfill bin.', tip: 'Compost food scraps to reduce landfill waste.' },
        'wrapper': { isRecyclable: false, material: 'Plastic Film', instructions: 'Dispose in black landfill bin. Plastic films are not recyclable in most curbside programs.', tip: 'Use reusable containers to avoid plastic wrappers.' },
        'plastic': { isRecyclable: true, material: 'Plastic', instructions: 'Rinse and place in blue recycling bin if accepted locally.', tip: 'Reduce plastic use by choosing reusable alternatives.' },
        'glass': { isRecyclable: true, material: 'Glass', instructions: 'Rinse and place in blue recycling bin if accepted locally.', tip: 'Reuse glass containers to reduce waste.' },
        'metal': { isRecyclable: true, material: 'Metal', instructions: 'Rinse and place in blue recycling bin.', tip: 'Opt for products with minimal packaging.' },
        'organic': { isRecyclable: false, material: 'Organic Waste', instructions: 'Dispose in green compost bin if available, or in black landfill bin.', tip: 'Compost organic waste to reduce landfill impact.' },
        'battery': { isRecyclable: false, material: 'Hazardous Waste', instructions: 'Take to a hazardous waste facility or battery recycling drop-off.', tip: 'Use rechargeable batteries to reduce waste.' },
        'electronics': { isRecyclable: false, material: 'Hazardous Waste', instructions: 'Take to an e-waste recycling center.', tip: 'Donate working electronics to extend their lifespan.' },
        'chemical': { isRecyclable: false, material: 'Hazardous Waste', instructions: 'Dispose at a hazardous waste facility.', tip: 'Use eco-friendly alternatives to reduce chemical use.' },
        'paint': { isRecyclable: false, material: 'Hazardous Waste', instructions: 'Dispose at a hazardous waste facility.', tip: 'Buy only what you need to avoid excess paint.' },
        'clothes': { isRecyclable: false, material: 'Donatable', instructions: 'Donate to a thrift store or charity if in good condition.', tip: 'Buy second-hand clothes to reduce textile waste.' },
        'furniture': { isRecyclable: false, material: 'Donatable', instructions: 'Donate to a thrift store or charity if in good condition.', tip: 'Upcycle old furniture to give it a new life.' },
        'book': { isRecyclable: false, material: 'Donatable', instructions: 'Donate to a library, school, or charity.', tip: 'Share books with friends to reduce waste.' }
      };

      let classificationResult, disposalInstructions, wasteReductionTip, itemName;
      const matchedLabel = data.labels.find(label => Object.keys(classificationMap).some(key => label.includes(key)));
      if (matchedLabel) {
        const matchedKey = Object.keys(classificationMap).find(key => matchedLabel.includes(key));
        const itemData = classificationMap[matchedKey];
        itemName = matchedKey;
        classificationResult = itemData.isRecyclable ? `Recyclable - ${itemData.material}` : `Non-Recyclable - ${itemData.material}`;
        disposalInstructions = itemData.instructions;
        wasteReductionTip = itemData.tip;
      } else {
        itemName = 'unknown';
        classificationResult = 'Non-Recyclable - Unknown Material';
        disposalInstructions = 'Dispose in black landfill bin.';
        wasteReductionTip = 'Consider researching the item\'s recyclability or reducing its use.';
      }

      // Upload the image to Supabase Storage
      const fileExt = image.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('waste-images')
        .upload(fileName, image);

      if (uploadError) {
        throw new Error(
          uploadError.message.includes('permission')
            ? 'You do not have permission to upload to this folder. Please contact support.'
            : 'Failed to upload image. Please check your internet connection and try again.'
        );
      }

      const { data: urlData } = supabase.storage
        .from('waste-images')
        .getPublicUrl(fileName);

      const imageUrl = urlData.publicUrl;

      // Save the classification result to the database
      const weight = classificationResult.includes('Recyclable') ? 0.1 : 0;
      const { error: insertError } = await supabase.from('classifications').insert({
        user_id: user.id,
        item: itemName,
        result: classificationResult,
        image_url: imageUrl,
        weight,
      });

      if (insertError) {
        throw new Error('Failed to save classification: ' + insertError.message);
      }

      // Update challenge progress for "Eco-Warrior" if the item is recyclable
      if (classificationResult.includes('Recyclable')) {
        const { data: challengeData, error: challengeError } = await supabase
          .from('challenges')
          .select('id, goal')
          .eq('name', 'Eco-Warrior')
          .single();

        if (challengeError) {
          throw new Error('Failed to fetch challenge data: ' + challengeError.message);
        }

        if (challengeData) {
          const { data: userChallengeData, error: userChallengeError } = await supabase
            .from('challenge_participants')
            .select('progress')
            .eq('user_id', user.id)
            .eq('challenge_id', challengeData.id);

          if (userChallengeError) {
            throw new Error('Failed to fetch challenge progress: ' + userChallengeError.message);
          }

          const userChallenge = userChallengeData.length > 0 ? userChallengeData[0] : null;
          let newProgress = (userChallenge?.progress || 0) + weight;
          if (newProgress >= challengeData.goal) {
            newProgress = challengeData.goal;
          }

          const { error: upsertChallengeError } = await supabase
            .from('challenge_participants')
            .upsert({
              user_id: user.id,
              challenge_id: challengeData.id,
              progress: newProgress,
              completed: newProgress >= challengeData.goal,
            }, {
              onConflict: ['user_id', 'challenge_id']
            });

          if (upsertChallengeError) {
            throw new Error('Failed to update challenge progress: ' + upsertChallengeError.message);
          }

          if (newProgress >= challengeData.goal) {
            const { data: userData, error: userDataError } = await supabase
              .from('users')
              .select('badges, level')
              .eq('id', user.id)
              .single();

            if (userDataError) {
              throw new Error('Failed to fetch user data for badge update: ' + userDataError.message);
            }

            let badges = userData.badges || [];
            let currentLevel = userData.level || 1;
            if (!badges.includes('Eco-Warrior')) {
              badges.push('Eco-Warrior');
              if (currentLevel < 1) {
                currentLevel = 1;
              }
              const { error: badgeUpdateError } = await supabase
                .from('users')
                .update({ badges, level: currentLevel })
                .eq('id', user.id);

              if (badgeUpdateError) {
                throw new Error('Failed to award badge: ' + badgeUpdateError.message);
              }
              setBadgeNotification('Eco-Warrior');
              toast.success('Congratulations! You earned the "Eco-Warrior" badge!');
            }
          }
        }
      }

      // Update user points and check for additional badges
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('points, badges')
        .eq('id', user.id)
        .single();

      if (fetchError) {
        throw new Error('Failed to fetch user data: ' + fetchError.message);
      }

      const newPoints = (userData.points || 0) + (classificationResult.includes('Recyclable') ? 20 : 5);
      let badges = userData.badges || [];

      const { data: recyclableCountData, error: recyclableCountError } = await supabase
        .from('classifications')
        .select('id')
        .eq('user_id', user.id)
        .ilike('result', 'Recyclable%');

      if (recyclableCountError) {
        throw new Error('Failed to fetch recyclable count: ' + recyclableCountError.message);
      }

      if (recyclableCountData.length >= 10 && !badges.includes('Recycler Pro')) {
        badges.push('Recycler Pro');
        setBadgeNotification('Recycler Pro');
        toast.success('Congratulations! You earned the "Recycler Pro" badge!');
      }

      const co2Saved = recyclableCountData.length * 0.2;
      if (co2Saved >= 5 && !badges.includes('Climate Champion')) {
        badges.push('Climate Champion');
        setBadgeNotification('Climate Champion');
        toast.success('Congratulations! You earned the "Climate Champion" badge!');
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ points: newPoints, badges })
        .eq('id', user.id);

      if (updateError) {
        throw new Error('Failed to update user data: ' + updateError.message);
      }

      // Set the classification result for display
      setResult({
        classification: classificationResult,
        instructions: disposalInstructions,
        tip: wasteReductionTip,
        wasteType: data.wasteType,
        locations: data.locations || [],
      });
      toast.success('Waste classified successfully!');
    } catch (err) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
      toast.error(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Toggle sidebar for mobile view
  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Handle user sign-out
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully!');
    navigate('/');
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gradient-to-br from-gray-50 to-gray-100'} flex flex-col`}>
      <Toaster position="bottom-right" />
      <header className={`flex justify-between items-center p-4 md:p-6 ${isDarkMode ? 'bg-gray-800' : 'bg-gradient-to-r from-teal-500 to-blue-500'} shadow-lg`}>
        <div className="flex items-center space-x-4">
          <button onClick={toggleSidebar} className="md:hidden text-white focus:outline-none">
            {isSidebarOpen ? <FaTimes className="h-6 w-6" /> : <FaBars className="h-6 w-6" />}
          </button>
          <motion.div
            className={`${isDarkMode ? 'bg-gray-700' : 'bg-white'} p-2 rounded-full shadow-md`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <FaLeaf className={`h-6 w-6 ${isDarkMode ? 'text-teal-300' : 'text-teal-500'}`} />
          </motion.div>
          <h1 className="text-xl md:text-2xl font-bold text-white">EnviRon</h1>
        </div>
        <div className="hidden md:flex items-center space-x-4">
          <Link to="/dashboard" className="text-white hover:text-gray-200 transition-colors">
            Dashboard
          </Link>
          <Link to="/community" className="text-white hover:text-gray-200 transition-colors">
            Community
          </Link>
          <Link to="/classify" className="text-white hover:text-gray-200 transition-colors">
            Classify Waste
          </Link>
          <Link to="/profile" className="text-white hover:text-gray-200 transition-colors">
            Profile
          </Link>
          <motion.button
            onClick={toggleDarkMode}
            className={`p-2 rounded-full ${isDarkMode ? 'bg-gray-700 text-yellow-300' : 'bg-white text-gray-800'}`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? <FaSun /> : <FaMoon />}
          </motion.button>
          <motion.button
            onClick={handleSignOut}
            className="px-4 py-2 text-white font-medium rounded-full bg-red-500 hover:bg-red-600 transition-colors shadow-lg"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Sign Out"
          >
            Sign Out
          </motion.button>
        </div>
      </header>

      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            className={`md:hidden fixed inset-y-0 left-0 w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg z-50 p-6`}
            initial={{ x: -256 }}
            animate={{ x: 0 }}
            exit={{ x: -256 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Menu</h2>
              <button onClick={toggleSidebar} className={`${isDarkMode ? 'text-white' : 'text-gray-800'} focus:outline-none`}>
                <FaTimes className="h-6 w-6" />
              </button>
            </div>
            <nav className="space-y-4">
              <Link
                to="/dashboard"
                onClick={toggleSidebar}
                className={`block text-lg ${isDarkMode ? 'text-gray-200 hover:text-teal-300' : 'text-gray-800 hover:text-teal-500'} transition-colors`}
              >
                Dashboard
              </Link>
              <Link
                to="/community"
                onClick={toggleSidebar}
                className={`block text-lg ${isDarkMode ? 'text-gray-200 hover:text-teal-300' : 'text-gray-800 hover:text-teal-500'} transition-colors`}
              >
                Community
              </Link>
              <Link
                to="/classify"
                onClick={toggleSidebar}
                className={`block text-lg ${isDarkMode ? 'text-gray-200 hover:text-teal-300' : 'text-gray-800 hover:text-teal-500'} transition-colors`}
              >
                Classify Waste
              </Link>
              <Link
                to="/profile"
                onClick={toggleSidebar}
                className={`block text-lg ${isDarkMode ? 'text-gray-200 hover:text-teal-300' : 'text-gray-800 hover:text-teal-500'} transition-colors`}
              >
                Profile
              </Link>
              <button
                onClick={toggleDarkMode}
                className={`flex items-center space-x-2 text-lg ${isDarkMode ? 'text-gray-200 hover:text-teal-300' : 'text-gray-800 hover:text-teal-500'} transition-colors`}
              >
                {isDarkMode ? <FaSun /> : <FaMoon />}
                <span>{isDarkMode ? 'Light Mode' : 'Dark Mode'}</span>
              </button>
              <button
                onClick={() => {
                  handleSignOut();
                  toggleSidebar();
                }}
                className="flex items-center space-x-2 text-lg text-red-500 hover:text-red-600 transition-colors"
              >
                <span>Sign Out</span>
              </button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 flex items-center justify-center p-4 md:p-6">
        <motion.div
          className={`w-full max-w-md ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'} rounded-2xl shadow-lg p-8 border relative overflow-hidden`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="absolute inset-0 shadow-[inset_0_0_10px_rgba(45,212,191,0.3)] rounded-2xl pointer-events-none" />
          <h2 className={`text-2xl md:text-3xl font-bold text-center mb-6 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            Classify Waste
          </h2>

          {error && (
            <motion.p
              className="text-red-500 text-center mb-4 p-2 bg-red-100 rounded-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {error}
            </motion.p>
          )}

          {badgeNotification && (
            <motion.div
              className={`text-center mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-700'} flex items-center justify-center space-x-2`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <FaMedal className="text-yellow-400" />
              <span>Congratulations! You earned the "{badgeNotification}" badge!</span>
            </motion.div>
          )}

          <div className="mb-6">
            <label className={`block text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-2`}>Upload an image of the waste item</label>
            <div className="flex items-center justify-center w-full">
              <label
                htmlFor="image-upload"
                className={`flex flex-col items-center justify-center w-full h-40 border-2 ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-300 bg-gray-100'} border-dashed rounded-lg cursor-pointer hover:bg-gray-200 transition-all`}
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FaCamera className={`w-8 h-8 mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Click to upload an image</p>
                  </div>
                )}
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <motion.button
            onClick={handleClassify}
            disabled={loading}
            className={`w-full py-3 rounded-lg font-semibold text-white ${loading ? 'bg-gray-500 cursor-not-allowed' : isDarkMode ? 'bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700' : 'bg-gradient-to-r from-teal-400 to-blue-400 hover:from-teal-500 hover:to-blue-500'} transition-all shadow-lg flex items-center justify-center space-x-2`}
            whileHover={{ scale: loading ? 1 : 1.05 }}
            whileTap={{ scale: loading ? 1 : 0.95 }}
          >
            {loading ? (
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
            ) : (
              <span>Classify</span>
            )}
          </motion.button>

          {result && (
            <motion.div
              className={`mt-6 p-4 rounded-lg ${result.classification.includes('Recyclable') ? (isDarkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700') : (isDarkMode ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-700')}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h3 className="text-lg font-semibold mb-2">Classification Result</h3>
              <p><strong>Result:</strong> {result.classification}</p>
              <p><strong>Disposal Instructions:</strong> {result.instructions}</p>
              <p><strong>Waste Reduction Tip:</strong> {result.tip}</p>

              <h3 className="text-lg font-semibold mt-4">Suggested Locations</h3>
              {result.locations.length > 0 ? (
                <ul className="list-disc pl-5 mt-2">
                  {result.locations.map((location, index) => (
                    <li key={index} className="mb-2">
                      <strong>{location.name}</strong> - {location.address} (Rating: {location.rating})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2">No nearby locations found. Try searching manually for {result.wasteType.toLowerCase()} disposal options.</p>
              )}
            </motion.div>
          )}
        </motion.div>
      </main>

      <footer className={`p-4 text-center ${isDarkMode ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-600'} shadow-inner`}>
        <p>© 2025 EnviRon. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default WasteClassifier;
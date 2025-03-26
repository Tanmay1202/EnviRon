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

  // Remove the hardcoded fallback URL
  const [apiUrl] = useState(import.meta.env.VITE_API_URL || window.location.origin);

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

  // Modify handleClassify function
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
      // Use the current origin as the API base URL
      const apiBaseUrl = window.location.origin;
      console.log('Using API URL:', apiBaseUrl); // Debug log

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      const imageBase64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(image);
      });

      const response = await fetch(`${apiBaseUrl}/api/classify-waste`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          imageBase64,
          userId: session.user.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      
      // Process successful response
      const classificationResult = {
        classification: data.labels[0],
        wasteType: data.wasteType,
        locations: data.locations || [],
        instructions: getDisposalInstructions(data.wasteType),
        tip: getWasteReductionTip(data.wasteType),
      };

      setResult(classificationResult);
      toast.success('Waste classified successfully!');

      // Update user progress and check for badges
      try {
        await updateUserProgress(session.user.id, data.wasteType);
      } catch (err) {
        console.error('Failed to update progress:', err);
        // Don't throw here, as the main classification was successful
        toast.warning('Progress update failed. Please try again later.');
      }

    } catch (err) {
      console.error('Classification error:', err);
      setError(err.message || 'Failed to classify image. Please try again.');
      toast.error(err.message || 'Failed to classify image. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // New helper function for updating user progress
  const updateUserProgress = async (userId, wasteType) => {
    const isRecyclable = wasteType.toLowerCase() === 'recyclable';
    const weight = isRecyclable ? 0.1 : 0;

    const { error: updateError } = await supabase
      .from('classifications')
      .insert({
        user_id: userId,
        item: wasteType,
        result: isRecyclable ? 'Recyclable' : 'Non-Recyclable',
        weight,
      });

    if (updateError) {
      throw new Error('Failed to save classification');
    }

    // Check and update badges
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('points, badges')
      .eq('id', userId)
        .single();

    if (userError) {
      throw new Error('Failed to fetch user data');
      }

    const newPoints = (userData.points || 0) + (isRecyclable ? 20 : 5);
      let badges = userData.badges || [];

    // Add badge logic here
    if (isRecyclable && !badges.includes('Eco-Warrior')) {
      badges.push('Eco-Warrior');
      setBadgeNotification('Eco-Warrior');
    }

    const { error: pointsError } = await supabase
        .from('users')
        .update({ points: newPoints, badges })
      .eq('id', userId);

    if (pointsError) {
      throw new Error('Failed to update points');
    }
  };

  // Helper functions for instructions and tips
  const getDisposalInstructions = (wasteType) => {
    const instructions = {
      recyclable: 'Clean and place in the recycling bin',
      organic: 'Place in the compost bin',
      hazardous: 'Take to a hazardous waste facility',
      landfill: 'Place in the general waste bin',
      // Add more waste types as needed
    };
    return instructions[wasteType.toLowerCase()] || 'Check local disposal guidelines';
  };

  const getWasteReductionTip = (wasteType) => {
    const tips = {
      recyclable: 'Consider reusable alternatives',
      organic: 'Try composting at home',
      hazardous: 'Look for eco-friendly alternatives',
      landfill: 'Look for recyclable alternatives',
      // Add more waste types as needed
    };
    return tips[wasteType.toLowerCase()] || 'Reduce, Reuse, Recycle when possible';
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
const Setting = require('../models/Setting');

const settingsCache = {}; // Simple in-memory cache

const loadSettings = async (req, res, next) => {
    try {
        // Check if settings are already in cache
        if (Object.keys(settingsCache).length === 0) {
            const settingsFromDB = await Setting.find();
            settingsFromDB.forEach(setting => {
                settingsCache[setting.key] = setting.value;
            });
        }

        // Set default if not in DB
        if (!settingsCache.lowAttendanceThreshold) {
            settingsCache.lowAttendanceThreshold = '75'; // Default value
        }
        
        // Attach settings to res.locals to make them available in all EJS templates
        res.locals.settings = settingsCache;
        next();
    } catch (error) {
        console.error('Error loading settings:', error);
        // Fallback to default if DB fails
        res.locals.settings = { lowAttendanceThreshold: '75' };
        next();
    }
};

// Function to clear cache when settings are updated
const clearSettingsCache = () => {
    for (const key in settingsCache) {
        delete settingsCache[key];
    }
};

module.exports = { loadSettings, clearSettingsCache };
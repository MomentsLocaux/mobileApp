const path = require('path');

const projectRoot = path.dirname(require.resolve('./package.json'));
require('dotenv').config({ path: path.join(projectRoot, '.env'), quiet: true });

const adsEnabled = process.env.EXPO_PUBLIC_FEATURE_ADS === 'true';

/** Keep the Google ads SDK out of store binaries while the flag is off. */
module.exports = {
  dependencies: adsEnabled
    ? {}
    : {
        'react-native-google-mobile-ads': {
          platforms: {
            ios: null,
            android: null,
          },
        },
      },
};

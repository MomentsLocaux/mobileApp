import React from 'react';
import {createRoot} from 'react-dom/client';
import OnboardingScreen from '@/screens/onboarding/OnboardingScreen';
window.review={routes:[],profiles:[],preferences:[]};
createRoot(document.getElementById('root')).render(<OnboardingScreen />);

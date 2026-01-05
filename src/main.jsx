import React from 'react';
import ReactDOM from 'react-dom/client';
import NeonPitRoguelikeV3 from './components/NeonPitRoguelikeV3.jsx';

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(React.createElement(NeonPitRoguelikeV3));
  
  // Hide loading message
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }
}

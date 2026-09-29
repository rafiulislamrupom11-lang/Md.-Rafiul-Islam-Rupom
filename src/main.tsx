import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {BrandLogoProvider} from './components/BrandLogo.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <BrandLogoProvider>
    <App />
  </BrandLogoProvider>,
);


import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { accounts, loadConfig } from './account.ts';
import './styles.css';
import './styles/tutor.css';
import './styles/progress.css';
import './styles/board.css';
import './styles/canvas.css';
import './styles/settings.css';
import './styles/landing.css';

const root = createRoot(document.getElementById('root')!);

// With Clerk keys on the server, the app is a signed-in SaaS that saves to the account;
// without them (a static host, `npm run dev` with no keys) it runs on this device only.
void loadConfig().then(async ({ clerkPublishableKey }) => {
  if (!clerkPublishableKey) {
    return root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
  accounts.set(true);
  const { SaasRoot } = await import('./SaasRoot.tsx');
  root.render(
    <StrictMode>
      <SaasRoot publishableKey={clerkPublishableKey} />
    </StrictMode>,
  );
});

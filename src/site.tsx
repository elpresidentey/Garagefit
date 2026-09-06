import { useEffect, useRef, useState } from 'react';
import App from './App';
import Landing from './landing';

/** Landing at `/`, comparator at `#/app`. Legacy `?`-only share links normalize to `#/app`. */
function isAppHash(): boolean {
  if (location.hash.startsWith('#/app')) return true;
  const q = new URLSearchParams(location.search);
  if ([...q.keys()].length > 0) {
    history.replaceState(null, '', location.pathname + location.search + '#/app');
    return true;
  }
  return false;
}

export default function Site() {
  const [app, setApp] = useState(isAppHash);
  const ref = useRef(app);
  useEffect(() => {
    const on = () => {
      const next = isAppHash();
      if (next !== ref.current) {
        ref.current = next;
        setApp(next);
        requestAnimationFrame(() => window.scrollTo(0, 0));
      }
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => {
    if (!app) document.body.style.overflow = '';
  }, [app]);
  return app ? <App /> : <Landing />;
}

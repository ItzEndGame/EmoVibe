import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// CRA's dev-mode error overlay treats every window "error" event as a
// fatal crash, including this one — which Chrome itself only ever
// dispatches as a benign, self-recovering layout-timing notice, never an
// actual failure. It's typically triggered by a ResizeObserver used
// internally by some third-party library in the tree, not by our own
// code. This only suppresses that exact message from the overlay; any
// other error still shows normally.
window.addEventListener('error', (e) => {
  if (
    e.message === 'ResizeObserver loop completed with undelivered notifications.' ||
    e.message === 'ResizeObserver loop limit exceeded'
  ) {
    e.stopImmediatePropagation();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
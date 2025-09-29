import React from 'react';

export function Footer() {
  return (
    <footer className="bg-base-200/50 border-base-300 mt-auto border-t py-4 text-center">
      <div className="container mx-auto px-4">
        <p className="text-base-content/60 text-sm">
          Made by{' '}
          <a
            href="https://crudgames.com"
            target="_blank"
            rel="noopener noreferrer"
            className="link-hover link font-medium"
          >
            CRUDgames.com
          </a>{' '}
          for{' '}
          <a
            href="https://geolarp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="link-hover link font-medium"
          >
            geoLARP.com
          </a>
        </p>
        <p className="text-base-content/40 mt-1 text-xs">
          Open source template available
        </p>
      </div>
    </footer>
  );
}

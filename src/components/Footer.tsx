import React from 'react';

export function Footer() {
  return (
    <footer className="bg-base-200/50 border-base-300 mt-auto border-t py-4 text-center sm:py-6">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-base-content/60 text-sm leading-relaxed">
          Made by{' '}
          <a
            href="https://crudgames.com"
            target="_blank"
            rel="noopener noreferrer"
            className="link-hover link inline-block min-h-11 align-middle leading-11 font-medium"
          >
            CRUDgames.com
          </a>{' '}
          for{' '}
          <a
            href="https://geolarp.com"
            target="_blank"
            rel="noopener noreferrer"
            className="link-hover link inline-block min-h-11 align-middle leading-11 font-medium"
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

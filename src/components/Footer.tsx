import React from 'react';
import { FOOTER_LINKS } from '@/config/footer-links';

const [CRUDGAMES, GEOLARP, SCRIPTHAMMER] = FOOTER_LINKS;

export function Footer() {
  return (
    // data-site-footer: the twin routes hide this and render their own compact
    // strip in its place (globals.css, #301). An attribute rather than a tag
    // selector, so the rule cannot catch the strip's own <footer>.
    <footer
      data-site-footer
      className="bg-base-300 mt-auto py-4 text-center sm:py-6"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-base-content text-sm leading-relaxed">
          Made by{' '}
          <a
            href={CRUDGAMES.href}
            target="_blank"
            rel="noopener noreferrer"
            className="link-hover link inline-block min-h-11 align-middle leading-11 font-medium"
          >
            {CRUDGAMES.label}
          </a>{' '}
          for{' '}
          <a
            href={GEOLARP.href}
            target="_blank"
            rel="noopener noreferrer"
            className="link-hover link inline-block min-h-11 align-middle leading-11 font-medium"
          >
            {GEOLARP.label}
          </a>
        </p>
        <p className="text-base-content mt-1 text-xs">
          Built with{' '}
          <a
            href={SCRIPTHAMMER.href}
            target="_blank"
            rel="noopener noreferrer"
            className="link-hover link"
          >
            {SCRIPTHAMMER.label}
          </a>{' '}
          template
        </p>
      </div>
    </footer>
  );
}

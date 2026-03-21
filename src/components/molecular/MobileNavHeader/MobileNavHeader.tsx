import React from 'react';

export interface MobileNavHeaderProps {
  /** Title text to display */
  title: string;
}

/**
 * MobileNavHeader component
 * Mobile navigation bar with hamburger menu button.
 * Uses htmlFor="sidebar-drawer" to toggle the DaisyUI drawer checkbox.
 * Hidden on md+ breakpoints.
 * @category molecular
 */
export default function MobileNavHeader({ title }: MobileNavHeaderProps) {
  return (
    <div className="navbar bg-base-100 border-base-300 shrink-0 border-b md:hidden">
      <div className="flex-none">
        <label
          htmlFor="sidebar-drawer"
          className="btn btn-square btn-ghost min-h-11 min-w-11"
          aria-label="Open sidebar"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            className="inline-block h-5 w-5 stroke-current"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h16"
            ></path>
          </svg>
        </label>
      </div>
      <div className="flex-1">
        <span className="text-lg font-semibold">{title}</span>
      </div>
    </div>
  );
}

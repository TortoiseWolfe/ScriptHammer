import React from 'react';

export interface EmptyConversationStateProps {
  /** Callback to open the sidebar on mobile */
  onOpenSidebar: () => void;
}

/**
 * EmptyConversationState component
 * Displays a placeholder when no conversation is selected.
 * Shows a chat icon, heading, and a mobile-only button to open the sidebar.
 * @category molecular
 */
export default function EmptyConversationState({ onOpenSidebar }: EmptyConversationStateProps) {
  return (
    <div className="bg-base-200 flex h-full items-center justify-center">
      <div className="text-center">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className="text-base-content mx-auto mb-4 h-24 w-24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
          />
        </svg>
        <h2 className="mb-2 text-xl font-semibold">Select a conversation</h2>
        <p className="text-base-content/85">
          Choose a conversation from the sidebar to start messaging
        </p>
        <button
          className="btn btn-primary mt-4 min-h-11 md:hidden"
          onClick={onOpenSidebar}
        >
          Open Sidebar
        </button>
      </div>
    </div>
  );
}

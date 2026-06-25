import React from 'react';

interface FancyButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export function FancyButton({ children, onClick }: FancyButtonProps) {
  return (
    <button onClick={onClick} className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-md">
      {children}
    </button>
  );
}

export default FancyButton;

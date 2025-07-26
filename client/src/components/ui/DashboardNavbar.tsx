import React, { useState } from 'react';
import { Home, User, Settings } from 'lucide-react'; // Removed unused imports Mail, Search

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
}

interface DashboardNavbarProps {
  position?: 'left' | 'right';
  items?: NavItem[];
}

const defaultItems: NavItem[] = [
  { id: 'home', label: '', icon: <Home size={20} /> },
  { id: 'profile', label: '', icon: <User size={20} /> },
  { id: 'settings', label: '', icon: <Settings size={20} /> },
];

const DashboardNavbar: React.FC<DashboardNavbarProps> = ({ 
  position = 'left',
  items = defaultItems, // Use a default variable to avoid recreating array on every render
}) => {
  const [activeItem, setActiveItem] = useState('home');

  const positionClasses = position === 'left' 
    ? 'left-0' 
    : 'right-0';

  return (
    <nav
      className={`fixed top-1/2 -translate-y-1/2 ${positionClasses} w-16 bg-black/90 backdrop-blur-lg rounded-full shadow-2xl border-r border-gray-800 flex flex-col items-center py-6 z-50`}
      style={{ height: 'auto' }}
    >
      {/* Navigation Items */}
      <div className="flex flex-col space-y-6 w-full items-center">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveItem(item.id)}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-200 group hover:scale-105 ${
              activeItem === item.id
                ? 'bg-white text-black shadow-lg shadow-white/25'
                : 'text-white hover:bg-gray-900 hover:text-gray-300'
            }`}
          >
            <span className={`transition-transform duration-200 ${
              activeItem === item.id ? 'scale-110' : 'group-hover:scale-110'
            }`}>
              {item.icon}
            </span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default DashboardNavbar;
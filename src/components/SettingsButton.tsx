/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Settings } from 'lucide-react';

interface SettingsButtonProps {
  onClick: () => void;
}

const SettingsButtonComponent: React.FC<SettingsButtonProps> = ({ onClick }) => {
  return (
    <button
      id="reva-settings-header-btn"
      onClick={onClick}
      title="Open REVA Settings"
      className="p-2 rounded-full bg-[#120722]/80 border border-purple-900/50 hover:border-purple-500/80 text-purple-300 hover:text-purple-100 backdrop-blur-md transition-all duration-200 cursor-pointer shadow-[0_0_15px_rgba(107,33,168,0.2)] hover:shadow-[0_0_20px_rgba(168,85,247,0.4)]"
    >
      <Settings className="w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-300 hover:rotate-45" />
    </button>
  );
};

export const SettingsButton = React.memo(SettingsButtonComponent);

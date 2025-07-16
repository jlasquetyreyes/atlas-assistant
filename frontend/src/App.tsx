import React, { useState } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { DiffHistoryTable } from './components/DiffHistoryTable';
import { Bot, History, Search } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'browse'>('chat');

  const tabs = [
    {
      id: 'chat' as const,
      label: 'Atlas Assistant',
      icon: Bot,
    },
    {
      id: 'history' as const,
      label: 'Revision History',
      icon: History,
    },
    {
      id: 'browse' as const,
      label: 'Browse Atlas',
      icon: Search,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <img 
                src="/atlas-logo.png" 
                alt="Atlas" 
                className="h-8 w-auto"
              />
            </div>
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Connected</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`mr-2 h-5 w-5 ${
                      activeTab === tab.id ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'
                    }`} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {activeTab === 'chat' && (
            <div>
              <ChatInterface className="max-w-4xl mx-auto" />
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <div className="mb-6">
                <h3 className="text-2xl font-semibold text-gray-900 mb-2">Revision History</h3>
                <p className="text-gray-600">
                  The following is a complete history of changes and updates to the Atlas Edit Weekly Proposal for Agent Launch
                </p>
              </div>
              <DiffHistoryTable />
            </div>
          )}

          {activeTab === 'browse' && (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Search className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-3">Browse Atlas</h3>
                <p className="text-lg text-gray-600 mb-4">Coming Soon</p>
                <p className="text-gray-500 max-w-md mx-auto">
                  We're working on an advanced browsing interface that will allow you to explore and navigate through Atlas documents with ease.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src="/atlas-logo.png" 
                alt="Atlas" 
                className="h-6 w-auto opacity-60"
              />
            </div>
            <div className="flex items-center space-x-6 text-sm text-gray-500">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span>Live</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
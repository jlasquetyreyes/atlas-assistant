import React from 'react';
import { ChatInterface } from './components/ChatInterface';
import { DiffHistoryTable } from './components/DiffHistoryTable';

function App() {
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
        <div className="space-y-8">
          {/* Chat Interface */}
          <div className="mb-12">
            <ChatInterface className="max-w-4xl mx-auto" />
          </div>

          {/* Diff History Table */}
          <div>
            <div className="mb-6">
              <h3 className="text-2xl font-semibold text-gray-900 mb-2">Revision History</h3>
              <p className="text-gray-600">
                The following is a complete history of changes and updates to the Atlas Edit Weekly Proposal for Agent Launch
              </p>
            </div>
            <DiffHistoryTable />
          </div>
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
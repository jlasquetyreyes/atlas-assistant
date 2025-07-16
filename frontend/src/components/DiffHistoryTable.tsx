import React, { useState, useEffect } from 'react';
import { RefreshCw, Calendar, FileText, Hash, Clock, Plus, Edit, Trash2, GitBranch } from 'lucide-react';

interface DiffHistoryItem {
  change_id: string;
  block_id: string;
  change_type: 'added' | 'updated' | 'deleted';
  previous_snapshot_time: string;
  current_snapshot_time: string;
  old_text?: string | null;
  new_text?: string | null;
  old_parent?: string | null;
  new_parent?: string | null;
  old_type?: string | null;
  new_type?: string | null;
}

interface DiffHistoryTableProps {
  className?: string;
}

// Simple word-level diff function
const createWordDiff = (oldText: string, newText: string) => {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  
  // Simple LCS-based diff algorithm
  const matrix: number[][] = [];
  for (let i = 0; i <= oldWords.length; i++) {
    matrix[i] = [];
    for (let j = 0; j <= newWords.length; j++) {
      if (i === 0) matrix[i][j] = j;
      else if (j === 0) matrix[i][j] = i;
      else if (oldWords[i - 1] === newWords[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = 1 + Math.min(
          matrix[i - 1][j],
          matrix[i][j - 1],
          matrix[i - 1][j - 1]
        );
      }
    }
  }
  
  // Backtrack to find the diff
  const oldResult: Array<{ word: string; type: 'removed' | 'unchanged' }> = [];
  const newResult: Array<{ word: string; type: 'added' | 'unchanged' }> = [];
  
  let i = oldWords.length;
  let j = newWords.length;
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      oldResult.unshift({ word: oldWords[i - 1], type: 'unchanged' });
      newResult.unshift({ word: newWords[j - 1], type: 'unchanged' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || matrix[i][j - 1] <= matrix[i - 1][j])) {
      newResult.unshift({ word: newWords[j - 1], type: 'added' });
      j--;
    } else if (i > 0) {
      oldResult.unshift({ word: oldWords[i - 1], type: 'removed' });
      i--;
    }
  }
  
  return { oldResult, newResult };
};

const DiffText: React.FC<{ 
  oldText?: string | null; 
  newText?: string | null; 
  type: 'old' | 'new' 
}> = ({ oldText, newText, type }) => {
  if (!oldText && !newText) return null;
  
  // If only one text exists, show it without highlighting
  if (!oldText || !newText) {
    const text = oldText || newText || '';
    return (
      <pre className="whitespace-pre-wrap break-words">
        {text}
      </pre>
    );
  }
  
  // Create diff
  const { oldResult, newResult } = createWordDiff(oldText, newText);
  const result = type === 'old' ? oldResult : newResult;
  
  return (
    <pre className="whitespace-pre-wrap break-words">
      {result.map((item, index) => {
        if (item.type === 'unchanged') {
          return <span key={index}>{item.word}</span>;
        } else if (item.type === 'removed') {
          return (
            <span 
              key={index} 
              className="bg-red-200 text-red-800 px-1 rounded"
              title="Removed text"
            >
              {item.word}
            </span>
          );
        } else if (item.type === 'added') {
          return (
            <span 
              key={index} 
              className="bg-green-200 text-green-800 px-1 rounded"
              title="Added text"
            >
              {item.word}
            </span>
          );
        }
        return null;
      })}
    </pre>
  );
};

export const DiffHistoryTable: React.FC<DiffHistoryTableProps> = ({ className = '' }) => {
  const [data, setData] = useState<DiffHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDiffHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('https://atlas-node-232731001131.europe-west3.run.app/diff_history');
      
      if (!response.ok) {
        throw new Error('Failed to fetch diff history');
      }
      
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching diff history:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiffHistory();
  }, []);

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return <Plus className="w-4 h-4 text-green-500" />;
      case 'updated':
        return <Edit className="w-4 h-4 text-blue-500" />;
      case 'deleted':
        return <Trash2 className="w-4 h-4 text-red-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return 'bg-green-100 text-green-800';
      case 'updated':
        return 'bg-blue-100 text-blue-800';
      case 'deleted':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to check if two values are different
  const areValuesDifferent = (oldValue?: string | null, newValue?: string | null) => {
    return oldValue !== newValue;
  };

  return (
    <div className={`bg-white rounded-2xl shadow-xl border border-gray-100 ${className}`}>
      {/* Table Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Revision History</h3>
              <p className="text-sm text-gray-500">Recent document changes and modifications</p>
            </div>
          </div>
          <button
            onClick={fetchDiffHistory}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-3">
              <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
              <span className="text-gray-600">Loading revision history...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-red-500" />
              </div>
              <p className="text-red-600 font-medium">Error loading data</p>
              <p className="text-gray-500 text-sm mt-1">{error}</p>
              <button
                onClick={fetchDiffHistory}
                className="mt-3 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {!loading && !error && data.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6 text-gray-400" />
              </div>
              <p className="text-gray-600 font-medium">No revision history found</p>
              <p className="text-gray-500 text-sm mt-1">There are no document changes to display</p>
            </div>
          </div>
        )}

        {!loading && !error && data.length > 0 && (
          <div className="max-h-[600px] overflow-auto relative">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[2000px]">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      <div className="flex items-center space-x-1">
                        <Hash className="w-4 h-4" />
                        <span>Change Type</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-80">
                      <div className="flex items-center space-x-1">
                        <FileText className="w-4 h-4" />
                        <span>Block ID</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Timestamps</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="flex items-center space-x-1">
                        <FileText className="w-4 h-4" />
                        <span>Content Changes</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-80">
                      <div className="flex items-center space-x-1">
                        <GitBranch className="w-4 h-4" />
                        <span>Parent Hierarchy</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>Type</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.map((item, index) => (
                    <tr key={item.change_id || index} className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-4 py-4 whitespace-nowrap align-top">
                        <div className="flex items-center space-x-2">
                          {getChangeIcon(item.change_type)}
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getChangeTypeColor(item.change_type)}`}>
                            {item.change_type}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 align-top">
                        <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded break-all">
                          {item.block_id}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 align-top">
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-gray-600 block">Old:</span>
                            <div className="text-xs text-gray-500">
                              {formatTimestamp(item.previous_snapshot_time)}
                            </div>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-gray-600 block">New:</span>
                            <div className="text-xs text-gray-900">
                              {formatTimestamp(item.current_snapshot_time)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 align-top">
                        <div className="space-y-4 min-w-[500px] max-w-[700px]">
                          {areValuesDifferent(item.old_text, item.new_text) ? (
                            <>
                              {item.old_text && (
                                <div>
                                  <span className="text-xs font-medium text-red-600 mb-2 block">Previous Content:</span>
                                  <div className="font-mono text-xs bg-red-50 p-3 rounded border border-red-200 max-h-40 overflow-y-auto">
                                    <DiffText oldText={item.old_text} newText={item.new_text} type="old" />
                                  </div>
                                </div>
                              )}
                              {item.new_text && (
                                <div>
                                  <span className="text-xs font-medium text-green-600 mb-2 block">New Content:</span>
                                  <div className="font-mono text-xs bg-green-50 p-3 rounded border border-green-200 max-h-40 overflow-y-auto">
                                    <DiffText oldText={item.old_text} newText={item.new_text} type="new" />
                                  </div>
                                </div>
                              )}
                            </>
                          ) : (
                            // Show single entry when content is the same
                            (item.old_text || item.new_text) && (
                              <div>
                                <span className="text-xs font-medium text-gray-600 mb-2 block">Content:</span>
                                <div className="font-mono text-xs bg-gray-100 p-3 rounded border border-gray-200 max-h-40 overflow-y-auto">
                                  <pre className="whitespace-pre-wrap break-words">
                                    {item.old_text || item.new_text}
                                  </pre>
                                </div>
                              </div>
                            )
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 align-top">
                        {areValuesDifferent(item.old_parent, item.new_parent) ? (
                          <div className="space-y-3">
                            {item.old_parent && (
                              <div>
                                <span className="text-xs font-medium text-red-600 block mb-1">Previous Parent:</span>
                                <div className="font-mono text-xs bg-red-50 px-2 py-1 rounded border border-red-200 break-all max-w-xs">
                                  {item.old_parent}
                                </div>
                              </div>
                            )}
                            {item.new_parent && (
                              <div>
                                <span className="text-xs font-medium text-green-600 block mb-1">New Parent:</span>
                                <div className="font-mono text-xs bg-green-50 px-2 py-1 rounded border border-green-200 break-all max-w-xs">
                                  {item.new_parent}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          // Show single entry when values are the same
                          (item.old_parent || item.new_parent) && (
                            <div>
                              <span className="text-xs font-medium text-gray-600 block mb-1">Parent:</span>
                              <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200 break-all max-w-xs">
                                {item.old_parent || item.new_parent}
                              </div>
                            </div>
                          )
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 align-top">
                        {areValuesDifferent(item.old_type, item.new_type) ? (
                          <div className="space-y-2">
                            {item.old_type && (
                              <div>
                                <span className="text-xs font-medium text-red-600 block">Old:</span>
                                <div className="font-mono text-xs bg-red-50 px-2 py-1 rounded border border-red-200">
                                  {item.old_type}
                                </div>
                              </div>
                            )}
                            {item.new_type && (
                              <div>
                                <span className="text-xs font-medium text-green-600 block">New:</span>
                                <div className="font-mono text-xs bg-green-50 px-2 py-1 rounded border border-green-200">
                                  {item.new_type}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          // Show single entry when values are the same
                          (item.old_type || item.new_type) && (
                            <div className="font-mono text-xs bg-gray-100 px-2 py-1 rounded border border-gray-200">
                              {item.old_type || item.new_type}
                            </div>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
"use client";

import { useState, useEffect, useCallback } from "react";
import { Star, Clock, Trash2, Edit2, X } from "lucide-react";
import type { SavedQuery, QueryHistory } from "@/lib/types/saved-queries";
import {
  getSavedQueries,
  deleteSavedQuery,
  updateQueryLabel,
  getRecentQueries,
  markQueryUsed,
} from "@/lib/utils/saved-queries";

type Props = {
  onSelectQuery: (query: string) => void;
  onClose: () => void;
};

export function SavedQueriesPanel({ onSelectQuery, onClose }: Props) {
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(() => getSavedQueries());
  const [recentQueries, setRecentQueries] = useState<QueryHistory[]>(() => getRecentQueries(10));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const loadQueries = useCallback(() => {
    setSavedQueries(getSavedQueries());
    setRecentQueries(getRecentQueries(10));
  }, []);

  const handleSelectQuery = useCallback((query: SavedQuery) => {
    markQueryUsed(query.id);
    onSelectQuery(query.query);
    onClose();
  }, [onSelectQuery, onClose]);

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteSavedQuery(id);
    loadQueries();
  }

  function handleStartEdit(query: SavedQuery, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(query.id);
    setEditLabel(query.label);
  }

  function handleSaveEdit(id: string) {
    if (editLabel.trim()) {
      updateQueryLabel(id, editLabel.trim());
      loadQueries();
    }
    setEditingId(null);
    setEditLabel("");
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditLabel("");
  }

  return (
    <div className="saved-queries-panel">
      <div className="saved-queries-header">
        <h3>Saved Queries</h3>
        <button
          onClick={onClose}
          className="close-btn"
          aria-label="Close"
          type="button"
        >
          <X size={18} />
        </button>
      </div>

      <div className="saved-queries-content">
        {/* Saved/Bookmarked Queries */}
        {savedQueries.length > 0 && (
          <div className="queries-section">
            <div className="section-header">
              <Star size={14} className="text-kumo-pink" />
              <span>Bookmarks ({savedQueries.length})</span>
            </div>
            <div className="queries-list">
              {savedQueries.map((query) => (
                <div
                  key={query.id}
                  className="query-item"
                  onClick={() => handleSelectQuery(query)}
                >
                  {editingId === query.id ? (
                    <div className="query-edit" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(query.id);
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                        autoFocus
                        className="query-edit-input"
                      />
                      <button
                        onClick={() => handleSaveEdit(query.id)}
                        className="query-btn"
                        type="button"
                        title="Save"
                      >
                        ✓
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="query-btn"
                        type="button"
                        title="Cancel"
                      >
                        ✗
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="query-info">
                        <div className="query-label">{query.label}</div>
                        <div className="query-meta">
                          Used {query.useCount} time{query.useCount !== 1 ? "s" : ""}
                        </div>
                      </div>
                      <div className="query-actions">
                        <button
                          onClick={(e) => handleStartEdit(query, e)}
                          className="query-action-btn"
                          title="Edit label"
                          type="button"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => handleDelete(query.id, e)}
                          className="query-action-btn"
                          title="Delete"
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Queries */}
        {recentQueries.length > 0 && (
          <div className="queries-section">
            <div className="section-header">
              <Clock size={14} className="text-muted-fg" />
              <span>Recent</span>
            </div>
            <div className="queries-list">
              {recentQueries.map((query) => (
                <div
                  key={query.id}
                  className="query-item recent"
                  onClick={() => {
                    onSelectQuery(query.query);
                    onClose();
                  }}
                >
                  <div className="query-info">
                    <div className="query-label">{query.query}</div>
                    <div className="query-meta">
                      {new Date(query.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {savedQueries.length === 0 && recentQueries.length === 0 && (
          <div className="empty-state">
            <Star size={48} className="text-muted-fg" style={{ opacity: 0.3 }} />
            <p>No saved queries yet</p>
            <p className="empty-hint">
              Use the star icon next to the chat input to save frequently-used queries
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

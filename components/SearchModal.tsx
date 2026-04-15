"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Search, Clock, X, Command } from "lucide-react";
import { fuzzySearch, highlightMatch, getSearchHistory, addToSearchHistory, type SearchResult } from "@/lib/utils/search";

type Props = {
  onClose: () => void;
  onSelectQuery: (query: string) => void;
};

export function SearchModal({ onClose, onSelectQuery }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => getSearchHistory());
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSelectHistory = useCallback(
    (historyQuery: string) => {
      onSelectQuery(historyQuery);
      onClose();
    },
    [onSelectQuery, onClose]
  );

  // Build search results from query
  useEffect(() => {
    if (!query.trim()) {
      // Show quick actions when no query
      setResults(getQuickActions());
      setSelectedIndex(0);
      return;
    }

    const searchResults: SearchResult[] = [];

    // Add search history matches
    const historyMatches = fuzzySearch(
      searchHistory,
      query,
      (h) => h,
      0.3
    );

    historyMatches.slice(0, 3).forEach((h) => {
      searchResults.push({
        id: `history-${h}`,
        type: "action",
        title: h,
        subtitle: "Recent search",
        icon: "🕒",
        action: () => handleSelectHistory(h),
      });
    });

    // Add quick actions that match
    const quickActions = getQuickActions();
    const actionMatches = fuzzySearch(
      quickActions,
      query,
      (a) => a.title + " " + (a.subtitle || ""),
      0.3
    );

    searchResults.push(...actionMatches.slice(0, 5));

    setResults(searchResults);
    setSelectedIndex(0);
  }, [query, searchHistory, handleSelectHistory]);

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      if (result.type === "action" && result.title !== query) {
        // Quick action
        result.action();
      } else {
        // Search query
        addToSearchHistory(query);
        onSelectQuery(query);
      }
      onClose();
    },
    [query, onSelectQuery, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            handleSelectResult(results[selectedIndex]);
          } else if (query.trim()) {
            addToSearchHistory(query);
            onSelectQuery(query);
            onClose();
          }
          break;
      }
    },
    [onClose, results, selectedIndex, query, handleSelectResult, onSelectQuery]
  );

  // Scroll selected item into view
  useEffect(() => {
    const selectedElement = document.querySelector(`.search-result-item.selected`);
    selectedElement?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  return (
    <>
      <div className="search-overlay" onClick={onClose} />
      <div className="search-modal">
        <div className="search-header">
          <Search size={18} className="search-icon" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search for customers, items, categories..."
            className="search-input"
          />
          <button
            onClick={onClose}
            className="search-close-btn"
            title="Close (Esc)"
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="search-results">
          {results.length === 0 && query.trim() && (
            <div className="search-empty">
              <p>{`No results found for "${query}"`}</p>
              <p className="search-empty-hint">
                Press Enter to search anyway
              </p>
            </div>
          )}

          {results.length === 0 && !query.trim() && (
            <div className="search-section">
              <div className="search-section-header">
                <Command size={14} />
                <span>Quick Actions</span>
              </div>
              <div className="search-section-hint">
                Start typing to search, or select an action below
              </div>
            </div>
          )}

          {results.map((result, index) => (
            <div
              key={result.id}
              className={`search-result-item ${index === selectedIndex ? "selected" : ""}`}
              onClick={() => handleSelectResult(result)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="search-result-icon">
                {result.icon || getTypeIcon(result.type)}
              </div>
              <div className="search-result-content">
                <div
                  className="search-result-title"
                  dangerouslySetInnerHTML={{
                    __html: highlightMatch(result.title, query),
                  }}
                />
                {result.subtitle && (
                  <div className="search-result-subtitle">{result.subtitle}</div>
                )}
              </div>
              {index === selectedIndex && (
                <div className="search-result-kbd">↵</div>
              )}
            </div>
          ))}
        </div>

        <div className="search-footer">
          <div className="search-footer-hint">
            <kbd>↑</kbd> <kbd>↓</kbd> Navigate
          </div>
          <div className="search-footer-hint">
            <kbd>↵</kbd> Select
          </div>
          <div className="search-footer-hint">
            <kbd>Esc</kbd> Close
          </div>
        </div>
      </div>
    </>
  );
}

// ── Helper Functions ──────────────────────────────────────────────────

function getQuickActions(): SearchResult[] {
  return [
    {
      id: "action-churn",
      type: "action",
      title: "Find customers at risk of churning",
      subtitle: "Churn Prediction",
      icon: "⚠️",
      action: () => {},
    },
    {
      id: "action-demand",
      type: "action",
      title: "Forecast demand for products",
      subtitle: "Demand Forecasting",
      icon: "📈",
      action: () => {},
    },
    {
      id: "action-reverse",
      type: "action",
      title: "Get reverse recommendations",
      subtitle: "Product Matching",
      icon: "🔄",
      action: () => {},
    },
    {
      id: "action-affinity",
      type: "action",
      title: "Analyze cold start items",
      subtitle: "Affinity Analysis",
      icon: "🧊",
      action: () => {},
    },
    {
      id: "action-export",
      type: "action",
      title: "Export data to CSV",
      subtitle: "Data Export",
      icon: "💾",
      action: () => {},
    },
  ];
}

function getTypeIcon(type: SearchResult["type"]): string {
  switch (type) {
    case "customer":
      return "👤";
    case "item":
      return "📦";
    case "category":
      return "🏷️";
    case "action":
      return "⚡";
    default:
      return "🔍";
  }
}

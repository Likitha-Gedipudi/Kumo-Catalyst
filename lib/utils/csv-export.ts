// ── CSV Export Utilities ──────────────────────────────────────────────────

/**
 * Convert data array to CSV string
 */
export function arrayToCSV<T extends Record<string, any>>(
  data: T[],
  headers?: Record<keyof T, string>
): string {
  if (!data || data.length === 0) return "";

  // Get column keys from first row
  const keys = Object.keys(data[0]) as (keyof T)[];

  // Build header row (use custom headers if provided, otherwise use keys)
  const headerRow = keys
    .map((key) => {
      const header = headers?.[key] ?? String(key);
      // Escape quotes and wrap in quotes if contains comma/quote/newline
      return escapeCsvField(header);
    })
    .join(",");

  // Build data rows
  const dataRows = data.map((row) =>
    keys
      .map((key) => {
        const value = row[key];
        // Handle null/undefined
        if (value === null || value === undefined) return "";
        // Convert to string and escape
        return escapeCsvField(String(value));
      })
      .join(",")
  );

  return [headerRow, ...dataRows].join("\n");
}

/**
 * Escape a CSV field value
 */
function escapeCsvField(value: string): string {
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Trigger browser download of CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Add UTF-8 BOM for Excel compatibility
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up
  URL.revokeObjectURL(url);
}

/**
 * Generate timestamped filename
 */
export function generateFilename(prefix: string): string {
  const now = new Date();
  const date = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // HH-MM-SS
  return `${prefix}-${date}-${time}.csv`;
}

// ── Specialized Export Functions ──────────────────────────────────────────

/**
 * Export churn customer list
 */
export function exportChurnCustomers(customers: any[]): void {
  const csvData = customers.map((c) => ({
    user_id: c.userId || c.user_id,
    churn_probability: `${((c.churnProbability || c.churn_probability || 0) * 100).toFixed(1)}%`,
    total_spend: c.totalSpend || c.total_spend || 0,
    order_count: c.orderCount || c.order_count || 0,
    days_since_last_purchase: c.daysSinceLastPurchase || c.days_since_last_purchase || 0,
    top_signal: c.topSignal || c.top_signal || "",
    win_back_item: c.winBackArticle?.name || c.winBackArticle?.itemName || "",
  }));

  const headers = {
    user_id: "Customer ID",
    churn_probability: "Churn Risk",
    total_spend: "Total Spend ($)",
    order_count: "Orders",
    days_since_last_purchase: "Days Since Purchase",
    top_signal: "Top Risk Signal",
    win_back_item: "Recommended Win-Back Item",
  };

  const csv = arrayToCSV(csvData, headers);
  downloadCSV(csv, generateFilename("churn-customers"));
}

/**
 * Export demand forecast
 */
export function exportDemandForecast(categories: any[], items?: any[]): void {
  const csvData = categories.map((c) => ({
    category: c.category,
    demand_score: c.demandScore?.toFixed(2) || "",
    trend: c.trend || "",
  }));

  const headers = {
    category: "Category",
    demand_score: "Demand Score",
    trend: "Trend",
  };

  const csv = arrayToCSV(csvData, headers);
  downloadCSV(csv, generateFilename("demand-forecast"));
}

/**
 * Export reverse recommendation (inventory clearance targets)
 */
export function exportReverseRecommendation(users: any[], itemName?: string): void {
  const csvData = users.map((u) => ({
    user_id: u.userId || u.user_id,
    purchase_probability: `${((u.purchaseProbability || u.purchase_probability || 0) * 100).toFixed(1)}%`,
    total_spend: u.totalSpend || u.total_spend || 0,
    order_count: u.orderCount || u.order_count || 0,
  }));

  const headers = {
    user_id: "Customer ID",
    purchase_probability: "Purchase Probability",
    total_spend: "Total Spend ($)",
    order_count: "Orders",
  };

  const csv = arrayToCSV(csvData, headers);
  const filename = itemName
    ? `reverse-rec-${itemName.replace(/\s+/g, "-").toLowerCase()}`
    : "reverse-rec";
  downloadCSV(csv, generateFilename(filename));
}

/**
 * Export cold affinity (new category launch targets)
 */
export function exportColdAffinity(users: any[], categoryName?: string): void {
  const csvData = users.map((u) => ({
    user_id: u.userId || u.user_id,
    affinity_score: u.affinityScore?.toFixed(2) || u.affinity_score?.toFixed(2) || "",
    total_spend: u.totalSpend || u.total_spend || 0,
    order_count: u.orderCount || u.order_count || 0,
  }));

  const headers = {
    user_id: "Customer ID",
    affinity_score: "Affinity Score",
    total_spend: "Total Spend ($)",
    order_count: "Orders",
  };

  const csv = arrayToCSV(csvData, headers);
  const filename = categoryName
    ? `cold-affinity-${categoryName.replace(/\s+/g, "-").toLowerCase()}`
    : "cold-affinity";
  downloadCSV(csv, generateFilename(filename));
}

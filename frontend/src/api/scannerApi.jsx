const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const scanWebsite = async (url, options = {}) => {
  const response = await fetch(`${API_BASE_URL}/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ url, ...options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to scan website");
  }

  return response.json();
};

export const getScanHistory = async (page = 1, limit = 10) => {
  const response = await fetch(
    `${API_BASE_URL}/scan?page=${page}&limit=${limit}`,
    {
      method: "GET",
      headers: {
        ...getAuthHeaders(),
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch scan history");
  }

  return response.json();
};

export const getScanStatus = async (jobId) => {
  const response = await fetch(`${API_BASE_URL}/scan/status/${jobId}`, {
    method: "GET",
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch scan status");
  }

  return response.json();
};

export const getQueueStatus = async () => {
  const response = await fetch(`${API_BASE_URL}/scan/queue/status`, {
    method: "GET",
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch queue status");
  }

  return response.json();
};

export const exportScanPDF = async (scanId) => {
  const response = await fetch(`${API_BASE_URL}/scan/${scanId}/export/pdf`, {
    method: "GET",
    headers: {
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to export PDF");
  }

  return response.blob();
};

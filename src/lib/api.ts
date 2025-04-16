import { getAuthToken } from "./auth";

type FetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  headers?: Record<string, string>;
  body?: any;
};

/**
 * Makes an authenticated API request
 * @param endpoint The API endpoint (without the leading slash)
 * @param options Fetch options
 * @returns The response data
 */
export async function fetchAPI<T = any>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const token = getAuthToken();
  
  // Debug: Log token existence
  console.log(`API Request to ${endpoint}: Authentication token ${token ? 'exists' : 'missing'}`);
  
  const isFormData = options.body instanceof FormData;
  
  const headers: Record<string, string> = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
  };

  // Debug: Log the final headers
  console.log("Request headers:", headers);

  const fetchOptions: RequestInit = {
    method: options.method || "GET",
    headers,
    body: options.body
      ? isFormData
        ? options.body
        : JSON.stringify(options.body)
      : undefined,
  };

  const response = await fetch(`/api/${endpoint}`, fetchOptions);
  const data = await response.json();

  if (!response.ok) {
    console.error(`API error (${response.status}):`, data);
    throw new Error(data.error || "An error occurred");
  }

  return data as T;
}

/**
 * Sends an authenticated GET request
 */
export function get<T = any>(endpoint: string): Promise<T> {
  return fetchAPI<T>(endpoint);
}

/**
 * Sends an authenticated POST request
 */
export function post<T = any>(endpoint: string, data: any): Promise<T> {
  return fetchAPI<T>(endpoint, {
    method: "POST",
    body: data,
  });
}

/**
 * Sends an authenticated PUT request
 */
export function put<T = any>(endpoint: string, data: any): Promise<T> {
  return fetchAPI<T>(endpoint, {
    method: "PUT",
    body: data,
  });
}

/**
 * Sends an authenticated DELETE request
 */
export function del<T = any>(endpoint: string): Promise<T> {
  return fetchAPI<T>(endpoint, {
    method: "DELETE",
  });
} 
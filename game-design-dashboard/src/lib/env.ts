export const FLAGS = {
  USE_MOCK: import.meta.env.VITE_USE_MOCK === "true",
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5173",
};

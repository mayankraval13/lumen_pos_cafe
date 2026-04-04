export const getToken = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('pos_token');
};

export const setToken = (token: string): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('pos_token', token);
  }
};

export const clearToken = (): void => {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('pos_token');
  }
};

export interface Context {
  isAdmin: boolean;
}

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export async function createContext(request: Request): Promise<Context> {
  // Extract API key from Authorization header
  const authHeader = request.headers.get('Authorization');
  const apiKey = authHeader?.replace('Bearer ', '');

  return {
    isAdmin: apiKey === ADMIN_API_KEY
  };
}

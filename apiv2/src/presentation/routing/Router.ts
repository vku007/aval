import type { HttpRequest, HttpResponse } from '../../infrastructure/http/HttpTypes.js';

type RouteHandler = (request: HttpRequest) => Promise<HttpResponse>;
type Middleware = (request: HttpRequest, next: () => Promise<HttpResponse>) => Promise<HttpResponse>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

/**
 * Simple router with middleware support
 */
export class Router {
  private routes: Route[] = [];
  private middlewares: Middleware[] = [];

  /**
   * Add middleware
   */
  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * Register GET route
   */
  get(path: string, handler: RouteHandler): this {
    return this.addRoute('GET', path, handler);
  }

  /**
   * Register POST route
   */
  post(path: string, handler: RouteHandler): this {
    return this.addRoute('POST', path, handler);
  }

  /**
   * Register PUT route
   */
  put(path: string, handler: RouteHandler): this {
    return this.addRoute('PUT', path, handler);
  }

  /**
   * Register PATCH route
   */
  patch(path: string, handler: RouteHandler): this {
    return this.addRoute('PATCH', path, handler);
  }

  /**
   * Register DELETE route
   */
  delete(path: string, handler: RouteHandler): this {
    return this.addRoute('DELETE', path, handler);
  }

  /**
   * Handle incoming request
   */
  async handle(request: HttpRequest): Promise<HttpResponse> {
    // Execute middleware chain
    let index = 0;
    const executeMiddleware = async (): Promise<HttpResponse> => {
      if (index < this.middlewares.length) {
        const middleware = this.middlewares[index++];
        return middleware(request, executeMiddleware);
      }
      // All middleware executed, now route
      return this.executeRoute(request);
    };

    return executeMiddleware();
  }

  /**
   * Add route
   */
  private addRoute(method: string, path: string, handler: RouteHandler): this {
    const { pattern, paramNames } = this.pathToRegex(path);
    this.routes.push({ method, pattern, paramNames, handler });
    return this;
  }

  /**
   * Execute matched route
   */
  private async executeRoute(request: HttpRequest): Promise<HttpResponse> {
    for (const route of this.routes) {
      if (route.method !== request.method) continue;

      const match = route.pattern.exec(request.path);
      if (!match) continue;

      // Extract path parameters
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });

      // Merge with existing params
      request.params = { ...request.params, ...params };

      return route.handler(request);
    }

    // No route matched - 404
    throw new Error(`No route matched: ${request.method} ${request.path}`);
  }

  /**
   * Convert path pattern to regex
   * Examples:
   *   /files -> ^/files$
   *   /files/:name -> ^/files/([^/]+)$
   *   /files/:name/meta -> ^/files/([^/]+)/meta$
   */
  private pathToRegex(path: string): { pattern: RegExp; paramNames: string[] } {
    const paramNames: string[] = [];
    
    const regexPattern = path
      .replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, (match) => {
        paramNames.push(match.slice(1)); // Remove leading ':'
        return '([^/]+)';
      })
      .replace(/\//g, '\\/'); // Escape forward slashes

    return {
      pattern: new RegExp(`^${regexPattern}$`),
      paramNames
    };
  }
}


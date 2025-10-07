export const log = (...args: unknown[]) => {
    try {
      const line = JSON.stringify({ ts: new Date().toISOString(), msg: args });
      console.log(line);
    } catch {
      console.log(...args);
    }
  };
  
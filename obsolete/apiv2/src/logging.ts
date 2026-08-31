export type LogLevel = "info" | "warn" | "error";

export const log = (level: LogLevel, data: Record<string, unknown>) => {
  try {
    const line = JSON.stringify({ 
      timestamp: new Date().toISOString(), 
      level, 
      ...data 
    });
    console.log(line);
  } catch (err) {
    console.log(JSON.stringify({ 
      timestamp: new Date().toISOString(), 
      level: "error", 
      message: "Failed to log",
      error: String(err)
    }));
  }
};
  
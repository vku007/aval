export interface AppConfig {
  aws: {
    region: string;
  };
  s3: {
    bucket: string;
    prefix: string;
    maxBodyBytes: number;
  };
  cors: {
    allowedOrigin: string;
  };
  tags: {
    app: string;
    environment: string;
  };
}

export function loadConfig(): AppConfig {
  return {
    aws: {
      region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-north-1'
    },
    s3: {
      bucket: process.env.BUCKET_NAME || '',
      prefix: process.env.JSON_PREFIX || 'json/',
      maxBodyBytes: Number(process.env.MAX_BODY_BYTES || 1048576) // 1MB
    },
    cors: {
      allowedOrigin: process.env.CORS_ORIGIN || 'https://vkp-consulting.fr'
    },
    tags: {
      app: process.env.APP_TAG || 'vkp-api',
      environment: process.env.ENVIRONMENT || 'prod'
    }
  };
}


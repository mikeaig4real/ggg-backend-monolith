import { init } from '@hyperdx/node-opentelemetry';

export const startTracing = () => {
  init({
    service: process.env.OTEL_SERVICE_NAME || 'ggg-backend',
    apiKey:
      process.env.OTEL_EXPORTER_OTLP_HEADERS?.split('=')[1] ||
      '110e294e-34b1-461d-afe2-eecc09a8a1be',
  });
  console.log('HyperDX Tracing initialized');
};

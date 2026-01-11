import { Socket } from 'socket.io';

export const getAuthTokenFromWebsocketHeaderHelper = (
  client: Socket,
): string | undefined => {
  // Check headers first
  const authorization = client.handshake.headers.authorization;
  if (authorization) {
    const parts = authorization.split(' ');
    return parts.length === 2 ? parts[1] : parts[0];
  }

  // Check auth object (standard socket.io-client auth: { token })
  const authToken = client.handshake.auth?.token;
  if (authToken) {
    return authToken;
  }

  return undefined;
};

export * from './template.helper';

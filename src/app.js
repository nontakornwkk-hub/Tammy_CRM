const http = require('node:http');

function createServer() {
  return http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200);
      response.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    response.writeHead(404);
    response.end(JSON.stringify({ error: 'Not found' }));
  });
}

module.exports = { createServer };

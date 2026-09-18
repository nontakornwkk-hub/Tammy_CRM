const { createServer } = require('./app');

const port = Number.parseInt(process.env.PORT || '3000', 10);
const server = createServer();

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});

import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize, resolve, sep } from 'node:path'

const args = new Map()
for (let index = 2; index < process.argv.length; index += 2) {
  args.set(process.argv[index], process.argv[index + 1])
}

const host = args.get('--host') ?? '127.0.0.1'
const port = Number(args.get('--port') ?? 5173)
const distDir = resolve('dist')
const indexFile = join(distDir, 'index.html')

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
}

function sendFile(response, filePath) {
  const type = mimeTypes[extname(filePath)] ?? 'application/octet-stream'
  response.writeHead(200, { 'Content-Type': type })
  createReadStream(filePath).pipe(response)
}

function resolveRequestPath(url) {
  const requestedPath = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname)
  const normalizedPath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, '')
  const filePath = resolve(join(distDir, normalizedPath))

  if (!filePath.startsWith(distDir + sep) && filePath !== distDir) {
    return indexFile
  }

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    return filePath
  }

  return indexFile
}

createServer((request, response) => {
  sendFile(response, resolveRequestPath(request.url ?? '/'))
}).listen(port, host, () => {
  console.log(`SPA preview running at http://${host}:${port}`)
})

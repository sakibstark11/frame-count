# Frame Count API

A TypeScript API for counting MP3 audio frames. The upload is streamed and frames are counted as bytes arrive, with no MP3 parsing library and no temporary files on disk.

## How it works

`POST /file-upload` accepts an MP3 in one of two body shapes, and both feed the same frame counter as the request body streams in:

- **`multipart/form-data`**: parsed by busboy, and every file part is streamed straight into the counter. A part that is neither mime `audio/mpeg` nor named `*.mp3` is rejected with a 400.
- **`audio/mpeg`**: the raw body is read directly with `req.on('data')` and streamed into the counter chunk by chunk.
- Any other `Content-Type` is rejected before either path runs.
- The counter (`src/utils/mp3Parser.ts`, `createFrameCounter`) is a small state machine fed one chunk at a time. It skips an ID3v2 tag if one is present, finds each frame header, computes the frame size from the bitrate, sample rate and padding bit, and jumps straight to the next header without ever scanning a frame's audio data. A leading Xing/Info/VBRI metadata frame is recognised and skipped rather than counted. If a header turns out to be invalid, the counter resyncs byte by byte until it finds a real one.
- Per-request memory is bounded: at most one network chunk plus up to 44 carried bytes, regardless of how large the upload is. The 44-byte carry is enough to inspect the start of the first frame for a VBR header, plus a countdown of bytes still owed to the frame currently in progress.
- A frame header or frame body that is split across two chunks is handled by that same carry — the counter picks up exactly where the previous chunk left off.
- Set `LOG_LEVEL=debug` to log every decision the counter makes (chunk consumed, bytes held for the next chunk, frame continuing into the next chunk, ID3v2 tag check, no frame sync found, metadata frame skipped, frame counted, stream finished). Every line carries the request id. The default level is `info`.

## Thoughts on Scalability

Streaming the frame count removes the memory ceiling for a single POST — a 128 MB container can now count a 250 MB upload without ever holding the file whole. The design below is only worth building if uploads need to be resumable, or if processing needs to move off the request path entirely (for example, to run at a scale where a client can't hold a connection open for the full upload).

A more scalable design might look like this:

- A /start-count endpoint where the client provides metadata (e.g., file size, number of chunks) and receives a job ID.
- The client uploads chunks to /file-upload/{job-id}/{chunk-number}.
- Once all chunks are uploaded, the job is added to a queue.
- Workers pick up queued jobs, process the audio, store the results, and the client can fetch the final output afterwards.

## Features

- Streaming frame counter with a constant, bounded memory footprint
- Accepts either `multipart/form-data` or a raw `audio/mpeg` body
- TypeScript implementation with strict linting
- Unit tests that validate frame counting accuracy against MediaInfo
- Structured logging with Pino, including a request id on every line
- Prettier-enforced formatting
- Multi-stage Docker build (dev, build, prod)

## Prerequisites

- Docker and Docker Compose, or Node 20+ for running locally without Docker
- VS Code (optional, for devcontainer support)

## Development Setup

### Option 1: Docker Compose (Recommended)

Start the development server:
```bash
make up
```

The API will be available at `http://localhost:3000`. The `dev` stage runs `npm run dev` under nodemon, and `docker-compose.yml` sets `CHOKIDAR_USEPOLLING=1` so file changes made on the host are still picked up and the server restarts inside the container.

#### Available Make Commands

```bash
make help          # Show all available commands
make up            # Start development server in background
make down          # Stop development server
make logs          # Show server logs
make shell         # Open shell in running container
make lint          # Run ESLint
make lint-fix      # Run ESLint with --fix
make format        # Run prettier then eslint fix in container
make test          # Run unit tests
make test-watch    # Run tests in watch mode
make typecheck     # Run TypeScript type checking
make clean         # Stop containers and cleanup
```

### Option 2: VS Code Dev Container

1. Open the project in VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
3. Type and select `Dev Containers: Reopen in Container`
4. VS Code will build and start the development environment

### Option 3: Local (no Docker)

```bash
npm install
npm run dev
```

`npm run dev` runs the server under nodemon and ts-node, restarting on every `.ts` save. `npm run build && npm start` builds to `dist` and runs the compiled output instead.

## Production image

```bash
docker build --target prod -t frame-count-api .
docker run -p 3000:3000 frame-count-api
```

The `prod` stage starts from `node:22-bullseye-slim`, installs only production dependencies with `npm ci --omit=dev`, copies the compiled `dist` output from the `build` stage, and runs `node dist/server.js` with `NODE_ENV=production`.

## API Usage

### Upload MP3 File for Frame Counting

Multipart form upload:
```bash
curl -X POST -F "file=@tests/fixtures/sample.mp3" http://localhost:3000/file-upload
```

Raw `audio/mpeg` body — `--data-binary` is required here, since a plain `-d` corrupts the bytes:
```bash
curl -X POST --data-binary @tests/fixtures/sample.mp3 -H 'Content-Type: audio/mpeg' http://localhost:3000/file-upload
```

Both return, for the bundled fixture:
```json
{"frameCount":6089}
```

**Error responses:**

| Condition | `error` |
| --- | --- |
| `Content-Type` is neither `multipart/form-data` nor `audio/mpeg` | `Expected Content-Type multipart/form-data or audio/mpeg` |
| Multipart file part isn't mime `audio/mpeg` or named `*.mp3` | `Only MP3 files are allowed` |
| Multipart body can't be parsed | `Malformed multipart body` |

### Health Check

```bash
curl http://localhost:3000/health -w "\n"
```

**Response:**
```json
{
  "status": "ok"
}
```

## Logging

`LOG_LEVEL` controls verbosity and defaults to `info`. Set `LOG_LEVEL=debug` to also log every decision the frame counter makes as it consumes the stream: bytes consumed per chunk, bytes carried over to the next chunk, a frame continuing into the next chunk, the ID3v2 tag check, failure to find a frame sync, a metadata frame being skipped, each frame counted, and the stream finishing. Every log line, at any level, carries the request id so a single upload's logs can be followed end to end.

## Testing

The project includes unit tests that validate frame counting accuracy against MediaInfo:

```bash
# Run tests
make test

# Run tests in watch mode
make test-watch
```

Tests are type-checked by ts-jest when they run; they are not part of the `tsc` build output, since `tsconfig.json` only includes `src`.

## Formatting and Linting

```bash
npm run format
```

`format` runs `prettier --write` over `src` and `tests`, then `npm run lint:fix`. Prettier's settings, in `.prettierrc`, are no semicolons, single quotes, no trailing commas and a 120-column width, matching the equivalent ESLint rules.

```bash
npm run lint       # Check only
npm run lint:fix   # Check and fix
```

## Project Structure

```
├── src/
│   ├── routes/          # HTTP route handlers
│   ├── utils/           # MP3 frame counter and logger
│   ├── middleware/      # Request logging middleware
│   └── server.ts        # Express server setup
├── tests/
│   ├── fixtures/        # Test MP3 files
│   └── *.test.ts        # Unit tests
├── .devcontainer/       # VS Code dev container configuration
├── docker-compose.yml   # Docker Compose for development
├── Dockerfile           # Multi-stage container definition (dev, build, prod)
├── .prettierrc          # Prettier formatting rules
└── Makefile             # Development workflow commands
```

## Technical Details

- **Framework:** Express.js with TypeScript
- **File Upload:** busboy for multipart parsing; the raw `audio/mpeg` body is read directly from the request stream
- **Logging:** Pino and pino-http, with structured JSON output and a request id on every line
- **Testing:** Jest with ts-jest, validated against MediaInfo
- **Linting/Formatting:** ESLint with strict TypeScript rules, Prettier
- **Development:** Docker-based, multi-stage (dev, build, prod), with hot reload

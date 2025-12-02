# Frame Count API

A TypeScript API for counting MP3 audio frames. The application parses MP3 files and returns the exact number of audio frames without using external MP3 parsing libraries.

## Features

- RESTful API endpoint for MP3 frame counting
- TypeScript implementation with strict linting
- Comprehensive unit tests with MediaInfo validation
- Structured logging with Pino
- Docker-based development environment

## Prerequisites

- Docker and Docker Compose
- VS Code (optional, for devcontainer support)

## Development Setup

### Option 1: Docker Compose (Recommended)

Start the development server:
```bash
make up
```

The API will be available at `http://localhost:3000` with hot reload enabled.

#### Available Make Commands

```bash
make help          # Show all available commands
make up            # Start development server in background
make down          # Stop development server
make logs          # Show server logs
make shell         # Open shell in running container
make lint          # Run ESLint
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

## API Usage

### Upload MP3 File for Frame Counting

```bash
curl -X POST -F "file=@tests/fixtures/sample.mp3" http://localhost:3000/file-upload -w "\n"
```

**Response:**
```json
{
  "frameCount": 1234
}
```

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

## Testing

The project includes comprehensive unit tests that validate frame counting accuracy against MediaInfo:

```bash
# Run tests
make test

# Run tests in watch mode
make test-watch
```

## Project Structure

```
├── src/
│   ├── routes/          # HTTP route handlers
│   ├── services/        # Business logic layer
│   ├── utils/           # Utility functions and MP3 parser
│   └── server.ts        # Express server setup
├── tests/
│   ├── fixtures/        # Test MP3 files
│   └── *.test.ts        # Unit tests
├── .devcontainer/       # VS Code dev container configuration
├── docker-compose.yml   # Docker Compose for development
├── Dockerfile           # Container definition
└── Makefile             # Development workflow commands
```

## Technical Details

- **Framework:** Express.js with TypeScript
- **File Upload:** Multer middleware
- **Logging:** Pino with structured JSON output
- **Testing:** Jest with MediaInfo validation
- **Linting:** ESLint with strict TypeScript rules
- **Development:** Docker-based with hot reload

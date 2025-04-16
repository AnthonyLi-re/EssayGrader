# Essay Grading Platform

A modern web application for grading essays with AI, built with Next.js, TypeScript, and Tailwind CSS.

## Features

- **AI-Powered Essay Grading**: Uses Mistral AI (via OpenRouter) for analyzing and scoring essays based on content, language, and organization.
- **OCR Integration**: Extracts text from uploaded PDF documents and images using Google Cloud Vision API.
- **Two-Step Submission Process**: User-friendly interface for submitting essay questions and student responses.
- **Score Breakdown**: Provides detailed feedback with scores for content, language, organization, and overall quality.

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure environment variables (see below)
4. Run the development server: `npm run dev`

## Required Environment Variables

- `DATABASE_URL`: URL for the SQLite database
- `NEXTAUTH_URL`: Your app's URL (http://localhost:3000 for development)
- `NEXTAUTH_SECRET`: Secret key for NextAuth.js
- `OPENROUTER_API_KEY`: Your OpenRouter API key for accessing Mistral AI models
- `GOOGLE_CREDENTIALS_JSON`: JSON credentials for Google Cloud Vision API (for OCR)
- OAuth provider credentials (if using Google Auth)

## API Integrations

### Mistral AI (via OpenRouter)
The platform uses Mistral's AI models through OpenRouter's API for essay analysis and grading, providing detailed feedback and scoring through the `/api/openai` endpoint (despite the endpoint name).

### Google Cloud Vision
Used for extracting text from uploaded essay files (PDFs and images). Requires setting up the `GOOGLE_CREDENTIALS_JSON` environment variable with your Google Cloud credentials.

## Example .env file

```
# Database
DATABASE_URL="file:./dev.db"

# Next Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-change-in-production"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# OpenRouter API (for Mistral AI access)
OPENROUTER_API_KEY="your-openrouter-api-key"

# Google Cloud Vision API (for OCR)
GOOGLE_CREDENTIALS_JSON="your-google-credentials-json"
```

## License

MIT License

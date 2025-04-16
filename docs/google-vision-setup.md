# Setting Up Google Cloud Vision API

This guide will help you set up Google Cloud Vision API for OCR functionality in the application.

## Prerequisites

1. Google Cloud Platform (GCP) account
2. A GCP project with billing enabled

## Steps to Set Up

### 1. Enable the Vision API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to "APIs & Services" > "Library"
4. Search for "Vision API"
5. Click on "Cloud Vision API" and click "Enable"

### 2. Create Service Account Credentials

1. In the Google Cloud Console, navigate to "APIs & Services" > "Credentials"
2. Click "Create credentials" > "Service account"
3. Enter a name and description for the service account
4. Select "Editor" role for basic access
5. Click "Continue" and then "Done"
6. Find your new service account in the list and click on it
7. Go to the "Keys" tab
8. Click "Add Key" > "Create new key"
9. Choose "JSON" key type and click "Create"
10. The key file will be downloaded to your computer

### 3. Configure Environment Variables

Option 1: Set `GOOGLE_APPLICATION_CREDENTIALS` path variable
```
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your-project-credentials.json"
```

Option 2: For services like Vercel, set the entire JSON content as an environment variable:

1. Open the downloaded JSON key file
2. Set the environment variable `GOOGLE_APPLICATION_CREDENTIALS_JSON` with the entire content

For example, in your `.env.local` file:
```
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account","project_id":"your-project","private_key_id":"..."}
```

## Usage

Once the API is set up, the OCR functionality will be available through the `/api/test-ocr` endpoint. This endpoint accepts images and PDFs and returns the extracted text. 
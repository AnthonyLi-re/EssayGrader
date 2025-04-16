import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import * as fs from 'fs/promises';
import * as vision from '@google-cloud/vision';
import sharp from 'sharp';

// Maximum file size (10MB for Google Cloud Vision)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Function to get a Vision client (with credentials handling)
async function getVisionClient() {
  // In environments like Vercel, we can't store files, so we create a temp credentials file
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      const tempPath = join(tmpdir(), `google-credentials-${Date.now()}.json`);
      
      // Write credentials to temp file
      writeFileSync(tempPath, JSON.stringify(credentials), { encoding: 'utf-8' });
      
      // Set the environment variable to point to our temp file
      process.env.GOOGLE_APPLICATION_CREDENTIALS = tempPath;
      
      // Create and return client
      const client = new vision.ImageAnnotatorClient();
      
      // Return client with cleanup function to delete temp file
      return {
        client,
        cleanup: () => {
          try {
            unlinkSync(tempPath);
          } catch (error) {
            console.error('Error cleaning up temp credentials file:', error);
          }
        }
      };
    } catch (error) {
      console.error('Error parsing credentials from environment variable:', error);
      throw new Error('Failed to set up Google Cloud Vision client');
    }
  }
  
  // If using the default credentials file
  return {
    client: new vision.ImageAnnotatorClient(),
    cleanup: () => {} // No cleanup needed
  };
}

// Clean OCR text using OpenRouter LLM
async function cleanTextWithLLM(text: string, textType: 'question' | 'essay' = 'essay') {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log('OpenRouter API key not found, skipping LLM cleaning');
    return text;
  }

  try {
    console.log(`Cleaning ${textType} OCR text with LLM...`);
    const startTime = Date.now();

    // Different prompts for questions vs essays
    let promptContent = '';
    
    if (textType === 'question') {
      promptContent = `Clean this queston text: fix spelling, grammar, punctuation, and coherence while preserving the original meaning and structure(KEEP THE STRUCTURE). Remove any irrelevant formatting instructions(Including some components that could possibly be the boarder, header, footer, etc.), you may need to deal with some transpositions issue caused by the OCR. Output only the corrected text, no explanations, give me the questions only, dont create a whole essay, remember to keep the structure of the question. Here is the text:\n\n${text}`;
    } else {
      promptContent = `Clean this essay text: fix spelling, grammar, punctuation, and coherence while preserving the original meaning and logical flow. Maintain paragraph structure where possible. Remove any irrelevant formatting instructions, headers, footers, or page numbers. Reconstruct sentences that may have been split due to OCR errors. Output only the corrected essay text, no explanations. Here is the text:\n\n${text}`;
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Essay Grading Platform'
      },
      body: JSON.stringify({
        model: 'mistralai/mistral-small-3.1-24b-instruct:free',
        messages: [
          {
            role: 'user',
            content: promptContent
          }
        ],
        temperature: 0.1,
        max_tokens: 4000,
        // Add data policies to allow prompt sharing/training
        data_policies: {
          allow_prompt_training: true,
          allow_sharing: true
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error from OpenRouter:', errorData);
      return text; // Return original text if LLM cleaning fails
    }

    const data = await response.json();
    const cleanedText = data.choices[0]?.message?.content?.trim() || text;
    
    console.log(`LLM ${textType} text cleaning completed in ${(Date.now() - startTime) / 1000} seconds`);
    return cleanedText;
  } catch (error) {
    console.error(`Error cleaning ${textType} text with LLM:`, error);
    return text; // Return original text if LLM cleaning fails
  }
}

// Main handler for POST requests
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Process the form data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Check file type
    const supportedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'application/pdf'
    ];
    
    if (!supportedTypes.includes(file.type)) {
      return NextResponse.json({
        error: `Unsupported file type: ${file.type}. Supported types are: JPEG, PNG, WEBP, TIFF, and PDF.`
      }, { status: 400 });
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      console.log(`File size ${file.size / 1024 / 1024}MB exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB. Will try to compress.`);
      
      // For images (not PDFs) we can try compression
      if (file.type.startsWith('image/')) {
        try {
          const buffer = await file.arrayBuffer();
          const compressedBuffer = await sharp(Buffer.from(buffer))
            .jpeg({ quality: 75 }) // Compress with reduced quality
            .toBuffer();
          
          console.log(`Compressed image from ${file.size / 1024}KB to ${compressedBuffer.length / 1024}KB`);
          
          // If still too large, reject
          if (compressedBuffer.length > MAX_FILE_SIZE) {
            return NextResponse.json({
              error: `File still too large after compression: ${compressedBuffer.length / 1024 / 1024}MB. Maximum is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
            }, { status: 400 });
          }
          
          // Process the compressed image
          const text = await processWithVision(compressedBuffer, formData);
          
          // Clean text with LLM if enabled
          const cleanedText = formData.get('cleanWithLLM') === 'true' 
            ? await cleanTextWithLLM(text, formData.get('textType') as 'question' | 'essay' || 'essay')
            : text;
          
          return NextResponse.json({
            text: cleanedText,
            originalText: text !== cleanedText ? text : undefined,
            processingTime: `${(Date.now() - startTime) / 1000} seconds`
          });
        } catch (error) {
          console.error('Error compressing image:', error);
          return NextResponse.json({
            error: `File size ${file.size / 1024 / 1024}MB exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB.`
          }, { status: 400 });
        }
      } else {
        // Can't compress PDFs
        return NextResponse.json({
          error: `File size ${file.size / 1024 / 1024}MB exceeds limit of ${MAX_FILE_SIZE / 1024 / 1024}MB.`
        }, { status: 400 });
      }
    }
    
    // Get file buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Process with Google Cloud Vision
    const text = await processWithVision(buffer, formData);
    
    // Clean text with LLM if enabled
    const cleanedText = formData.get('cleanWithLLM') === 'true' 
      ? await cleanTextWithLLM(text, formData.get('textType') as 'question' | 'essay' || 'essay')
      : text;
    
    console.log(`Processed file in ${(Date.now() - startTime) / 1000} seconds`);
    
    return NextResponse.json({
      text: cleanedText,
      originalText: text !== cleanedText ? text : undefined,
      processingTime: `${(Date.now() - startTime) / 1000} seconds`
    });
  } catch (error: any) {
    console.error('Error processing OCR request:', error);
    return NextResponse.json({ 
      error: error.message || 'An error occurred during OCR processing' 
    }, { status: 500 });
  }
}

async function processWithVision(buffer: Buffer, formData: FormData) {
  // Get language hints if provided
  const languages = formData.get('languages') as string;
  const languageHints = languages ? languages.split(',').map(l => l.trim()) : ['en'];
  
  console.log(`Processing OCR with language hints: ${languageHints.join(', ')}`);
  
  // Get Vision client
  const { client, cleanup } = await getVisionClient();
  
  try {
    const startTime = Date.now();
    
    // Determine if this is a PDF
    const isPDF = buffer.subarray(0, 5).toString() === '%PDF-';
    
    let textContent = '';
    if (isPDF) {
      // Process PDF document
      const request = {
        requests: [{
          inputConfig: {
            content: buffer.toString('base64'),
            mimeType: 'application/pdf',
          },
          features: [{ type: 'TEXT_DETECTION' as const }],
          imageContext: {
            languageHints,
          }
        }]
      };
      
      const [result] = await client.batchAnnotateFiles(request);
      
      // Extract text from all pages, with proper null checks
      if (result?.responses?.[0]?.responses) {
        const responses = result.responses[0].responses;
        
        if (responses.length > 0) {
          for (const response of responses) {
            if (response?.fullTextAnnotation?.text) {
              textContent += response.fullTextAnnotation.text + '\n\n';
            }
          }
        }
        
        // If we got no text content, set a default message
        if (!textContent.trim()) {
          textContent = 'No text detected in the PDF document';
        }
      } else {
        textContent = 'Failed to process PDF document';
      }
      
      console.log(`PDF processed in ${(Date.now() - startTime) / 1000} seconds`);
    } else {
      // Process image
      const [textDetection] = await client.textDetection({
        image: { content: buffer.toString('base64') },
        imageContext: {
          languageHints,
        }
      });
      
      console.log(`Image processed in ${(Date.now() - startTime) / 1000} seconds`);
      
      if (textDetection?.fullTextAnnotation?.text) {
        textContent = textDetection.fullTextAnnotation.text;
      } else {
        textContent = 'No text detected in the image';
      }
    }
    
    return textContent || 'No text extracted';
  } finally {
    // Clean up any temporary credentials file
    cleanup();
  }
} 
import { Mistral } from '@mistralai/mistralai';
import sharp from 'sharp';

export interface OCRPage {
  pageNum: number;
  text: string;
  markdown?: string;
}

// Maximum file size for Mistral OCR API (5MB in bytes)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

let client: Mistral | null = null;

// Initialize the Mistral client (singleton pattern)
function getMistralClient(): Mistral {
  if (!client) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error("MISTRAL_API_KEY is not set in environment variables");
    }
    client = new Mistral({ apiKey });
  }
  return client;
}

/**
 * Process a file with OCR using Mistral's API
 * @param file The file to process
 * @returns Extracted text from the file
 */
export async function processFileWithUrl(file: any): Promise<string> {
  try {
    // Get the file type and size
    const fileName = file.name || "unknown";
    console.log(`Processing file: ${fileName} (${file.size / (1024 * 1024)}MB)`);

    // Check if file is an image
    const imageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/tiff'];
    
    // Check if file is a document
    const docTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    // Reject PDF files - they must be pre-processed on client
    if (file.type === 'application/pdf') {
      throw new Error(
        "PDF files must be pre-processed as images on the client side. " +
        "The server doesn't support direct PDF processing."
      );
    }
    
    let extractedText = '';
    
    if (imageTypes.includes(file.type)) {
      // For image files, compress if needed
      const compressedImage = await compressImage(file);
      extractedText = await sendImageToOCR(compressedImage);
    } else if (file.type === 'text/plain') {
      // For text files, read directly
      console.log("Text file detected, reading directly");
      try {
        extractedText = await file.text();
      } catch (textError: any) {
        console.error("Error reading text file:", textError);
        throw new Error(`Failed to read text file: ${textError.message}`);
      }
    } else if (docTypes.includes(file.type)) {
      // For DOC/DOCX files only (PDF is rejected above)
      console.log(`Document detected (${file.type}), processing with document extraction`);
      try {
        // Convert document to buffer
        const docBuffer = Buffer.from(await file.arrayBuffer());
        
        // Check size limits
        if (docBuffer.length > MAX_FILE_SIZE) {
          throw new Error(
            `Document size (${(docBuffer.length / (1024 * 1024)).toFixed(2)}MB) exceeds the ` +
            `maximum allowed size for API processing (${MAX_FILE_SIZE / (1024 * 1024)}MB). ` +
            `Please reduce the file size before uploading.`
          );
        }
        
        // Send to Mistral API directly as a document
        const base64Doc = docBuffer.toString('base64');
        const mimeType = file.type;
        
        // Send to Mistral API
        const mistral = getMistralClient();
        const response = await mistral.chat.complete({
          model: "mistral-large-2-2405",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Please extract all text from this document. Return only the extracted text, no additional commentary."
                },
                {
                  type: "document_url",
                  documentUrl: `data:${mimeType};base64,${base64Doc}`
                }
              ]
            }
          ]
        });
        
        // Extract the text from the response
        const content = response.choices?.[0]?.message?.content;
        extractedText = typeof content === 'string' ? content : "No text extracted from document";
        
      } catch (docError: any) {
        console.error("Error processing document:", docError);
        throw new Error(`Failed to process document: ${docError.message}`);
      }
    } else {
      throw new Error(`Unsupported file type: ${file.type}. Only images, Word documents, and text files are supported.`);
    }
    
    // Clean the extracted text with AI if OpenRouter API key is available
    if (process.env.OPENROUTER_API_KEY && extractedText) {
      try {
        console.log("Cleaning extracted text with AI...");
        const cleanedText = await cleanTextWithOpenRouter(extractedText);
        return cleanedText;
      } catch (cleaningError) {
        console.error("Error cleaning text with AI:", cleaningError);
        // Return the original text if cleaning fails
        return extractedText;
      }
    } else {
      return extractedText;
    }
  } catch (error: any) {
    console.error("Error processing file with OCR:", error);
    throw new Error(`OCR processing failed: ${error.message}`);
  }
}

/**
 * Clean OCR text using OpenRouter LLM
 */
async function cleanTextWithOpenRouter(text: string): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.log('OpenRouter API key not found, skipping LLM cleaning');
    return text;
  }

  try {
    console.log('Cleaning OCR text with LLM...');
    const startTime = Date.now();

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Essay Grading Platform'
      },
      body: JSON.stringify({
        model: 'arliai/qwq-32b-arliai-rpr-v1:free',
        messages: [
          {
            role: 'user',
            content: `give me the original essay from this post-OCR text:\n\n${text}`
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
    
    console.log(`LLM text cleaning completed in ${(Date.now() - startTime) / 1000} seconds`);
    return cleanedText;
  } catch (error) {
    console.error('Error cleaning text with LLM:', error);
    return text; // Return original text if LLM cleaning fails
  }
}

/**
 * Compress an image to ensure it's within the size limit
 */
async function compressImage(imageFile: any): Promise<Buffer> {
  try {
    // Convert file to buffer
    const arrayBuffer = await imageFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // If the file is already small enough, return it as is
    if (buffer.length <= MAX_FILE_SIZE) {
      return buffer;
    }
    
    console.log(`Image size (${buffer.length / (1024 * 1024)}MB) exceeds limit, compressing...`);
    
    // Use sharp to compress the image
    // First resize the image to reduce dimensions if it's very large
    let quality = 80;
    let compressedBuffer: Buffer;
    
    try {
      // First try resize to reasonable dimensions
      compressedBuffer = await sharp(buffer)
        .resize({
          width: 1500,
          height: 2000,
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: quality })
        .toBuffer();
    } catch (resizeError) {
      console.error("Error during initial resize, trying basic compression:", resizeError);
      // If resize fails, try direct compression
      compressedBuffer = buffer;
    }
    
    // Progressively reduce quality until we get under the limit
    while (compressedBuffer.length > MAX_FILE_SIZE && quality > 10) {
      try {
        compressedBuffer = await sharp(buffer)
          .jpeg({ quality: quality })
          .toBuffer();
        
        console.log(`Compressed to quality ${quality}: ${compressedBuffer.length / (1024 * 1024)}MB`);
      } catch (compressError) {
        console.error(`Error compressing at quality ${quality}:`, compressError);
        // If compression fails at this quality, try one step lower
        quality -= 10;
        continue;
      }
      quality -= 10;
    }
    
    if (compressedBuffer.length > MAX_FILE_SIZE) {
      console.warn("Compression couldn't reduce image below limit. Using most compressed version anyway.");
    }
    
    return compressedBuffer;
  } catch (error) {
    console.error("Error compressing image:", error);
    // If compression completely fails, return the original buffer
    const originalBuffer = Buffer.from(await imageFile.arrayBuffer());
    return originalBuffer;
  }
}

/**
 * Send an image to the Mistral OCR API
 */
async function sendImageToOCR(imageBuffer: Buffer): Promise<string> {
  try {
    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');
    
    // Send to Mistral API
    const mistral = getMistralClient();
    const response = await mistral.chat.complete({
      model: "mistral-large-2-2405",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please extract all text from this image. Return only the extracted text, no additional commentary."
            },
            {
              type: "image_url",
              imageUrl: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ]
    });
    
    // Extract the text from the response
    const content = response.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content : "No text extracted";
  } catch (error) {
    console.error("Error sending image to OCR:", error);
    throw error;
  }
} 
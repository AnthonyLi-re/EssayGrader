// This file contains client-side PDF utilities
'use client';

// This is a placeholder for a PDF utility library
// In a real implementation, you would use libraries like pdf.js or pdf-lib
// to convert PDFs to images for OCR processing
import { PDFDocument } from 'pdf-lib';
import Pica from 'pica';
// Remove static import of PDF.js
// import * as pdfjsLib from 'pdfjs-dist';

// Maximum size for OCR processing (in bytes) - 10MB
export const MAX_OCR_FILE_SIZE = 10 * 1024 * 1024;

// Target size for compressed files (in bytes) - 5MB
export const TARGET_COMPRESSED_SIZE = 5 * 1024 * 1024;

// Use more compatible loading approach for PDF.js that works with Next.js
async function loadPdfJs() {
  if (typeof window === 'undefined') {
    throw new Error('PDF processing can only run in browser environment');
  }
  
  const pdfjsLib = await import('pdfjs-dist');
  // Set CDN worker path with version
  pdfjsLib.GlobalWorkerOptions.workerSrc = 
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
  
  return pdfjsLib;
}

/**
 * Validates if a file is suitable for OCR processing
 */
export function validateFileForOCR(file: File): { valid: boolean; message: string } {
  // Check file type
  const validTypes = [
    'application/pdf', 
    'image/jpeg', 
    'image/png', 
    'image/tiff',
    'image/webp',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      message: "Please upload a valid document or image file (PDF, DOC, DOCX, JPG, PNG, TIFF, WebP, GIF, TXT)"
    };
  }

  // For size validation, we'll compress files that are too large
  // So we can be more permissive with the initial size check
  const MAX_INITIAL_SIZE = 30 * 1024 * 1024; // 30MB initial max
  if (file.size > MAX_INITIAL_SIZE) {
    return {
      valid: false,
      message: `File is too large. Maximum allowed size is ${MAX_INITIAL_SIZE / (1024 * 1024)}MB`
    };
  }

  // All checks passed
  return { valid: true, message: "" };
}

/**
 * Compresses a file (PDF or image) for OCR processing
 * Returns a compressed version of the file if it's above MAX_OCR_FILE_SIZE
 * Otherwise returns the original file
 */
export async function compressFileForOCR(file: File): Promise<File> {
  console.log(`[Compression] Checking if file needs compression: ${file.name} (${file.size / 1024 / 1024}MB)`);
  
  // If the file is already under the limit, return it as is
  if (file.size <= MAX_OCR_FILE_SIZE) {
    console.log(`[Compression] File already within size limit, using as is.`);
    return file;
  }
  
  // Compress based on file type
  if (isPdfFile(file)) {
    return await compressPdf(file);
  } else if (isImageFile(file)) {
    return await compressImage(file);
  }
  
  // If we can't compress it, return the original
  return file;
}

/**
 * Compresses a PDF file by reducing quality and optimizing
 */
async function compressPdf(file: File): Promise<File> {
  console.log(`[Compression] Compressing PDF: ${file.name}`);
  
  try {
    // Read the file as an ArrayBuffer
    const fileBuffer = await file.arrayBuffer();
    
    // Load the PDF
    const pdfDoc = await PDFDocument.load(fileBuffer, {
      // Use lower quality settings
      updateMetadata: false
    });
    
    // Get original page count
    const pageCount = pdfDoc.getPageCount();
    console.log(`[Compression] PDF has ${pageCount} pages`);
    
    // Save with compression settings
    const compressedBytes = await pdfDoc.save({
      // Use maximum compression
      useObjectStreams: true,
      addDefaultPage: false
    });
    
    // Create a new file from the compressed bytes
    const compressedSize = compressedBytes.byteLength;
    console.log(`[Compression] Original: ${file.size / 1024}KB, Compressed: ${compressedSize / 1024}KB`);
    
    const compressedFile = new File(
      [compressedBytes], 
      file.name.replace('.pdf', '.compressed.pdf'), 
      { type: 'application/pdf' }
    );
    
    return compressedFile;
  } catch (error) {
    console.error(`[Compression] Error compressing PDF:`, error);
    return file; // Return original on error
  }
}

/**
 * Compresses an image by resizing and reducing quality
 */
async function compressImage(file: File): Promise<File> {
  console.log(`[Compression] Compressing image: ${file.name}`);
  
  try {
    // Create an image element
    const img = document.createElement('img');
    const imgLoaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
    });
    
    // Load the image
    img.src = URL.createObjectURL(file);
    await imgLoaded;
    
    // Create a canvas to draw the image
    const canvas = document.createElement('canvas');
    const pica = new Pica();
    
    // Determine optimal size reduction
    const maxDimension = 2000; // Max width/height in pixels
    let width = img.width;
    let height = img.height;
    
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round(height * (maxDimension / width));
        width = maxDimension;
      } else {
        width = Math.round(width * (maxDimension / height));
        height = maxDimension;
      }
    }
    
    // Set canvas size
    canvas.width = width;
    canvas.height = height;
    
    // Resize the image using pica (high quality resizer)
    await pica.resize(img, canvas, {
      unsharpAmount: 80,
      unsharpRadius: 0.6,
      unsharpThreshold: 2
    });
    
    // Get the compressed image
    const compressedBlob = await pica.toBlob(canvas, file.type, 0.8); // 0.8 quality for JPEG
    const compressedFile = new File(
      [compressedBlob],
      file.name.replace(/\.[^.]+$/, '.compressed$&'),
      { type: file.type }
    );
    
    console.log(`[Compression] Original: ${file.size / 1024}KB, Compressed: ${compressedFile.size / 1024}KB`);
    return compressedFile;
  } catch (error) {
    console.error(`[Compression] Error compressing image:`, error);
    return file; // Return original on error
  }
}

/**
 * Processes a PDF file using Google Cloud Vision API
 * No longer converts to images client-side since the API accepts PDFs directly
 * 
 * @param pdfFile The PDF file to process
 * @returns Promise<boolean> indicating success
 */
export async function convertPdfToImages(pdfFile: File): Promise<File[]> {
  console.log(`[PDF Utils] Preparing PDF for OCR processing: ${pdfFile.name} (${pdfFile.size / 1024}KB)`);
  
  // We no longer need to convert PDFs to images as Google Cloud Vision API accepts PDFs directly
  // This function is kept for backward compatibility but now just returns the original PDF file
  // wrapped in an array for the existing code to handle
  
  // We'll compress the PDF if it's too large
  try {
    // Ensure the PDF is within size limits for the API
    const compressedFile = await compressFileForOCR(pdfFile);
    
    if (compressedFile !== pdfFile) {
      console.log(`[PDF Utils] PDF compressed for API processing: ${compressedFile.size / 1024}KB`);
    }
    
    // Return the PDF file as-is in an array to maintain API compatibility
    // This allows existing code to work without major changes
    return [compressedFile];
  } catch (error) {
    console.error(`[PDF Utils] Error preparing PDF for OCR:`, error);
    throw error;
  }
}

/**
 * @deprecated Use convertPdfToImages instead to process all pages
 */
export async function convertPdfToImage(pdfFile: File): Promise<File | null> {
  // This function is deprecated - we now use Google Cloud Vision API directly
  // which accepts PDFs without client-side conversion
  console.log(`[PDF Utils] Using direct PDF processing: ${pdfFile.name} (${pdfFile.size} bytes)`);
  
  // Just compress the file if needed and return it
  const compressedFile = await compressFileForOCR(pdfFile);
  return compressedFile;
}

/**
 * Helper function to check if a file is a PDF
 */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf';
}

/**
 * Helper function to check if a file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Debug function to help diagnose OCR issues
 */
export function logOCRDebugInfo(file: File, response: any): void {
  console.group('OCR Debug Information');
  console.log('File Name:', file.name);
  console.log('File Type:', file.type);
  console.log('File Size:', (file.size / 1024).toFixed(2), 'KB');
  
  if (response) {
    console.log('API Response Status:', response.status || 'N/A');
    console.log('Extracted Text Length:', response.text?.length || 0);
    if (response.error) {
      console.error('Error:', response.error);
    }
  } else {
    console.log('No API response available');
  }
  
  console.groupEnd();
} 
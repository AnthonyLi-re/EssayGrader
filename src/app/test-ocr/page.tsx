'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export default function TestOCR() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [processingMessage, setProcessingMessage] = useState('Starting OCR process...');
  
  // Always use English and LLM cleaning
  const languages = 'en';
  const cleanWithLLM = true;

  // Processing messages that will rotate while waiting
  const processingMessages = [
    "Scanning document...",
    "Converting image to text...",
    "Reading text from document...",
    "Analyzing document structure...",
    "Cleaning up OCR artifacts...",
    "Reconstructing paragraphs...",
    "Enhancing text with AI...",
    "Almost there...",
    "Putting it all together..."
  ];

  // Rotate processing messages while in processing state
  useEffect(() => {
    if (!processing) return;
    
    let messageIndex = 0;
    const interval = setInterval(() => {
      messageIndex = (messageIndex + 1) % processingMessages.length;
      setProcessingMessage(processingMessages[messageIndex]);
    }, 3000); // Change message every 3 seconds
    
    return () => clearInterval(interval);
  }, [processing]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toISOString()}] ${message}`]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      addLog(`File selected: ${selectedFile.name} (${selectedFile.type}, ${selectedFile.size / 1024} KB)`);
    }
  };

  const processFile = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    setProcessing(true);
    setError('');
    setResult('');
    setProcessingMessage(processingMessages[0]);
    addLog(`Starting processing of ${file.name}`);

    try {
      // Create form data for upload
      const formData = new FormData();
      formData.append('file', file);
      
      // Add language hints for Google Cloud Vision
      formData.append('languages', languages);
      
      // Always clean with LLM
      formData.append('cleanWithLLM', cleanWithLLM.toString());
      addLog(`Using AI to clean up OCR text`);

      addLog(`Processing document...`);
      
      // Send to our test endpoint
      const response = await fetch('/api/test-ocr', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error: ${response.status}`);
      }

      const data = await response.json();
      setResult(data.text || 'No text extracted');
      addLog(`Success! Received ${data.text?.length || 0} characters of text`);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to process file';
      setError(errorMessage);
      addLog(`Error: ${errorMessage}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-6">Document Text Extraction</h1>
      
      <div className="grid gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>
              Upload an image or PDF to extract text using AI-enhanced OCR
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Input 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp,image/tiff,application/pdf" 
                  onChange={handleFileChange}
                  disabled={processing}
                />
                {file && (
                  <p className="text-sm mt-1">
                    Selected: {file.name} ({Math.round(file.size / 1024)} KB)
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  File size limit: 10MB
                </p>
              </div>
              
              <Button 
                onClick={processFile} 
                disabled={!file || processing}
              >
                {processing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : 'Extract Text'}
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {(result || processing) && (
          <Card>
            <CardHeader>
              <CardTitle>Extracted Text</CardTitle>
            </CardHeader>
            <CardContent>
              {processing ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                  <span className="text-lg font-medium">{processingMessage}</span>
                  <p className="text-sm text-muted-foreground mt-2">
                    This may take a minute or two depending on the document complexity.
                  </p>
                </div>
              ) : (
                <Textarea 
                  value={result} 
                  rows={15} 
                  readOnly
                  className="font-mono"
                />
              )}
            </CardContent>
          </Card>
        )}
        
        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardHeader>
            <CardTitle>Debug Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-3 rounded-md h-[150px] overflow-y-auto font-mono text-xs">
              {logs.length > 0 ? (
                logs.map((log, i) => (
                  <div key={i} className="pb-1">
                    {log}
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No logs yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 